/**
 * AI column matching for CSV import. The AI never sees contact data: for each
 * column it gets the heading and a value *shape* worked out here ("email-like",
 * "short text (avg 12 chars)"), never a cell value. buildMappingRequest is the
 * only path from a file to the request, and it is built from an allowlist:
 * column number, heading, shape. Contact ID is never offered as a field.
 */
import { z } from 'zod';
import type { TokenUsage } from '../db/schema';
import { getSettings } from '../db/settings';
import { parseContactType, IMPORT_TARGETS, type ColumnMapping, type ImportTarget, type ParsedCsv } from '../lib/csv';
import { parseCountry } from '../lib/country';
import { parseDate } from '../lib/dates';
import { parseLanguage } from '../lib/language';
import { anthropicSend } from './anthropic';
import { alwaysOnline, browserConnectivity, callWithRetries, classifyError, type Connectivity, type Send, type Sleep, type Validate } from './engine';
import { addToRunningTotal } from './generate';
import { costEur, MAX_OUTPUT_TOKENS, MODEL } from './model';

/** Fields the AI may suggest. Contact ID stays out of the AI, as everywhere else. */
export const AI_TARGETS = IMPORT_TARGETS.filter((t) => t !== 'externalId');
export type AiTarget = Exclude<ImportTarget, 'externalId'>;

/** One line per field, sent to the AI so it knows what each one is for. */
export const FIELD_DESCRIPTIONS: Record<AiTarget, string> = {
  firstName: "The person's first (given) name only.",
  lastName: "The person's last (family) name only.",
  fullName: 'First and last name together in one column.',
  email: 'Email address.',
  phone: 'Phone number.',
  company: 'The company or organisation the person works for.',
  country: 'Country, as a name or a 2-letter code.',
  language: 'Language to write to the person in (e.g. en, fr).',
  contactType: 'Relationship category: client, prospect or lead.',
  serviceHistory: 'What work or services were done together.',
  notes: 'Free-form notes about the person.',
  whereMet: 'Where or at which event you met the person.',
  openThread: 'A question, request or proposal left open with the person.',
  lastContacted: 'Date of the last contact with the person.',
};

// ---------------------------------------------------------------- shapes

type ValueKind = 'email-like' | 'phone-like' | 'date' | 'country code' | 'country name' | 'language' | 'contact type' | 'number';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().\/-]+$/;
const NUMBER = /^-?\d+(?:[.,]\d+)?$/;

/** What kind of value this is, or null for plain text. Never returns the value. */
export function valueKind(raw: string): ValueKind | null {
  const v = raw.trim();
  if (!v) return null;
  if (EMAIL.test(v)) return 'email-like';
  if (parseDate(v, true) || parseDate(v, false)) return 'date';
  const digits = v.replace(/\D/g, '').length;
  if (PHONE.test(v) && digits <= 15 && (digits >= 8 || (digits >= 6 && /[+\s().\/-]/.test(v)))) return 'phone-like';
  if (NUMBER.test(v)) return 'number';
  if (parseContactType(v)) return 'contact type';
  // "FR" is a country code; "fr" a language.
  if (v.length === 2 && v === v.toUpperCase() && parseCountry(v)) return 'country code';
  if (v.length <= 3 && parseLanguage(v)) return 'language';
  const country = parseCountry(v);
  if (country) return v.length === 2 ? 'country code' : 'country name';
  if (parseLanguage(v)) return 'language';
  return null;
}

/** Most values (80 %) of one kind → that kind; otherwise text, by average length. */
export const DOMINANT_SHARE = 0.8;
export const LONG_TEXT_CHARS = 60;

/**
 * The shape of a column's values, worked out locally. The result never contains
 * a value from the file: only a kind name, or "short/long text" and an average length.
 */
export function columnShape(values: string[]): string {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (filled.length === 0) return 'empty';
  const counts = new Map<ValueKind, number>();
  for (const v of filled) {
    const kind = valueKind(v);
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  for (const [kind, n] of counts) if (n / filled.length >= DOMINANT_SHARE) return kind;
  const avg = Math.round(filled.reduce((sum, v) => sum + v.length, 0) / filled.length);
  return `${avg >= LONG_TEXT_CHARS ? 'long' : 'short'} text (avg ${avg} chars)`;
}

export const MAX_HEADING_CHARS = 60;

/**
 * A heading as sent, or null. A heading that looks like data (an email, phone,
 * date or number: often a first row of contacts read as headings) or is too
 * long to be a column name is withheld.
 */
export function safeHeading(header: string): string | null {
  const h = header.trim();
  if (!h || h.length > MAX_HEADING_CHARS) return null;
  const kind = valueKind(h);
  if (kind === 'email-like' || kind === 'phone-like' || kind === 'date' || kind === 'number') return null;
  return h;
}

// ---------------------------------------------------------------- request

export const MAPPING_TOOL_NAME = 'save_column_matches';

export const MAPPING_SYSTEM_PROMPT = `You match the columns of a spreadsheet of contacts to the fields of a contact list.
You see each column's heading (null when not available) and the shape of its values, never the values themselves.
Headings may be in any language and may be abbreviated.
For each column, choose the one field it most likely holds, or null if none fits or you are unsure.
Use each field for at most one column. Give a confidence between 0 and 1.
Call ${MAPPING_TOOL_NAME} exactly once.`;

const mappingTool = {
  name: MAPPING_TOOL_NAME,
  description: 'Save the column matches. Call this exactly once.',
  input_schema: {
    type: 'object' as const,
    properties: {
      matches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            column: { type: 'integer', description: 'The column number given.' },
            field: { type: ['string', 'null'], description: 'One of the field names given, or null.' },
            confidence: { type: 'number', description: 'From 0 (a guess) to 1 (certain).' },
          },
          required: ['column', 'field', 'confidence'],
          additionalProperties: false,
        },
      },
    },
    required: ['matches'],
    additionalProperties: false,
  },
};

/** Exactly what the user message contains. Nothing else about the file is sent. */
export interface MappingPromptData {
  fields: { name: AiTarget; description: string }[];
  columns: { column: number; heading: string | null; shape: string }[];
}

const DATA_KINDS = new Set<ValueKind | null>(['email-like', 'phone-like', 'date']);

/**
 * True when the heading row holds an email, phone or date: it is most likely a
 * row of contacts read as headings, so no heading from it may be sent.
 */
export function headingsLookLikeData(headers: string[]): boolean {
  return headers.some((h) => DATA_KINDS.has(valueKind(h)));
}

/**
 * Builds the request for the columns still unmatched, offering only the fields
 * not used yet. Allowlist: column number, safeHeading(heading), columnShape(values).
 * If the heading row looks like data, every heading is sent as null.
 * Returns null when there is nothing for the AI to match.
 */
export function buildMappingRequest(parsed: ParsedCsv, mapping: ColumnMapping) {
  const used = new Set(mapping.filter(Boolean));
  const withholdHeadings = headingsLookLikeData(parsed.headers);
  const fields = AI_TARGETS.filter((t) => !used.has(t)).map((name) => ({ name, description: FIELD_DESCRIPTIONS[name] }));
  const columns = parsed.headers.flatMap((header, i) =>
    mapping[i] ? [] : [{ column: i + 1, heading: withholdHeadings ? null : safeHeading(header), shape: columnShape(parsed.rows.map((r) => r[i] ?? '')) }],
  );
  if (columns.length === 0 || fields.length === 0) return null;
  const data: MappingPromptData = { fields, columns };
  return {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: MAPPING_SYSTEM_PROMPT,
    tools: [mappingTool],
    tool_choice: { type: 'tool' as const, name: MAPPING_TOOL_NAME },
    messages: [{ role: 'user' as const, content: JSON.stringify(data, null, 2) }],
  };
}

export type MappingRequest = NonNullable<ReturnType<typeof buildMappingRequest>>;

/** Rough tokens: about 3 characters each in, and a short entry per column out. Priced like drafts. */
export function estimateMappingCostEur(request: MappingRequest): number {
  const columns = (JSON.parse(request.messages[0].content) as MappingPromptData).columns.length;
  return costEur({ inputTokens: Math.ceil(JSON.stringify(request).length / 3), outputTokens: 30 + 25 * columns });
}

// ---------------------------------------------------------------- reply

const replySchema = z.object({
  matches: z.array(
    z.object({
      column: z.number().int(),
      field: z.string().nullable(),
      confidence: z.number().min(0).max(1).optional(),
    }),
  ),
});

/** Column index (0-based) → suggested field. */
export type Suggestions = Map<number, ImportTarget>;

/**
 * Validates a reply against the request: matches for columns that weren't sent,
 * field names that weren't offered and nulls are dropped; when two columns claim
 * one field, the higher confidence wins. A reply of the wrong shape is malformed.
 */
export function parseMappingReply(request: MappingRequest): Validate<Suggestions> {
  const sent = JSON.parse(request.messages[0].content) as MappingPromptData;
  const columns = new Set(sent.columns.map((c) => c.column));
  const fields = new Set<string>(sent.fields.map((f) => f.name));
  return (toolInput) => {
    const parsed = replySchema.safeParse(toolInput);
    if (!parsed.success) {
      return { ok: false, detail: parsed.error.issues.map((i) => `${i.path.join('.') || 'reply'}: ${i.message}`).join('; ') };
    }
    const best = new Map<string, { column: number; confidence: number }>();
    const claimed = new Set<number>();
    const ranked = [...parsed.data.matches].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    for (const m of ranked) {
      if (!m.field || !fields.has(m.field) || !columns.has(m.column) || claimed.has(m.column) || best.has(m.field)) continue;
      best.set(m.field, { column: m.column, confidence: m.confidence ?? 0 });
      claimed.add(m.column);
    }
    const suggestions: Suggestions = new Map();
    for (const [field, { column }] of best) suggestions.set(column - 1, field as ImportTarget);
    return { ok: true, value: suggestions };
  };
}

/** Fills only columns still unmatched with fields not used yet. Returns what was applied. */
export function applySuggestions(mapping: ColumnMapping, suggestions: Suggestions): { mapping: ColumnMapping; applied: Suggestions } {
  const next = [...mapping];
  const applied: Suggestions = new Map();
  for (const [index, field] of suggestions) {
    if (index >= next.length || next[index] !== null || next.includes(field)) continue;
    next[index] = field;
    applied.set(index, field);
  }
  return { mapping: next, applied };
}

// ---------------------------------------------------------------- call

export type MatchErrorCode = 'no_key' | 'network' | 'auth' | 'rate_limit' | 'overloaded' | 'malformed' | 'billing' | 'unknown';

export type MatchResult =
  | { ok: true; suggestions: Suggestions; costEur: number }
  | { ok: false; code: MatchErrorCode; costEur: number };

/**
 * Asks the AI to match the request's columns. Without an API key (demo mode)
 * nothing is sent. Offline fails at once rather than waiting. The cost, failures
 * included, goes into the running total.
 */
export async function matchColumns(
  request: MappingRequest,
  deps: { send?: Send<MappingRequest>; sleep?: Sleep; connectivity?: Connectivity } = {},
): Promise<MatchResult> {
  const apiKey = (await getSettings()).apiKey.trim();
  if (!apiKey) return { ok: false, code: 'no_key', costEur: 0 };
  if (!(deps.connectivity ?? browserConnectivity).isOnline()) return { ok: false, code: 'network', costEur: 0 };
  const send = deps.send ?? anthropicSend<MappingRequest>(apiKey);
  try {
    const { value, usage } = await callWithRetries(request, send, parseMappingReply(request), {
      sleep: deps.sleep,
      connectivity: alwaysOnline,
    });
    const cost = costEur(usage);
    await addToRunningTotal(cost);
    return { ok: true, suggestions: value, costEur: cost };
  } catch (error) {
    const failure = classifyError(error);
    const spent = (failure as { usage?: TokenUsage }).usage;
    const cost = spent ? costEur(spent) : 0;
    await addToRunningTotal(cost);
    const code = failure.code === 'interrupted' ? 'unknown' : failure.code;
    return { ok: false, code, costEur: cost };
  }
}
