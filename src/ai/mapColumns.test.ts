import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { ensureSettings, getSettings, updateSettings } from '../db/settings';
import { parseCsvText, suggestMapping, type ColumnMapping } from '../lib/csv';
import type { Send } from './engine';
import {
  AI_TARGETS,
  applySuggestions,
  buildMappingRequest,
  columnShape,
  estimateMappingCostEur,
  matchColumns,
  parseMappingReply,
  safeHeading,
  valueKind,
  type MappingPromptData,
  type MappingRequest,
} from './mapColumns';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
});

// Every cell is a sentinel: none of them, nor any part of an email or phone, may be sent.
const CELLS = [
  ['SENTINEL-ANNE', 'sentinel.anne@private.invalid', '+33 6 12 34 56 78', '2024-03-02', 'SENTINEL note about a hard year that is kept private at all costs', 'SENTINEL-C-001'],
  ['SENTINEL-BO', 'sentinel.bo@private.invalid', '06 98 76 54 32', '15/04/2025', 'SENTINEL second private note that is also long enough to be long text', 'SENTINEL-C-002'],
];
const HEADINGS = ['Qui', 'Courrier perso', 'Joindre au', 'Vu le', 'Observations', 'Code'];
const csv = (rows: string[][]) => rows.map((r) => r.join(',')).join('\n');

function requestFor(text: string, header = true): MappingRequest {
  const parsed = parseCsvText(text, header);
  return buildMappingRequest(parsed, suggestMapping(header ? parsed.headers : parsed.headers.map(() => '')))!;
}
const promptData = (request: MappingRequest) => JSON.parse(request.messages[0].content) as MappingPromptData;

describe('value shapes', () => {
  it('names the kind of value without the value', () => {
    expect(columnShape(['ann@example.com', 'bo@example.org'])).toBe('email-like');
    expect(columnShape(['+33 6 12 34 56 78', '06 98 76 54 32', '0612345678'])).toBe('phone-like');
    expect(columnShape(['2024-03-02', '15/04/2025', '1/2/24'])).toBe('date');
    expect(columnShape(['FR', 'BE', 'LU'])).toBe('country code');
    expect(columnShape(['France', 'Belgique'])).toBe('country name');
    expect(columnShape(['12', '7', '3.5'])).toBe('number');
    expect(columnShape(['client', 'prospect', 'lead'])).toBe('contact type');
    expect(columnShape(['fr', 'en'])).toBe('language');
  });

  it('describes text by length only', () => {
    expect(columnShape(['Anne', 'Bo', 'Camille'])).toBe('short text (avg 4 chars)');
    const long = 'x'.repeat(140);
    expect(columnShape([long, long])).toBe('long text (avg 140 chars)');
  });

  it('calls a column with no values empty', () => {
    expect(columnShape(['', '  ', ''])).toBe('empty');
    expect(columnShape([])).toBe('empty');
  });

  it('needs most values to agree before naming a kind', () => {
    expect(columnShape(['ann@example.com', 'Anne', 'Bo', 'Cy'])).toMatch(/^short text/);
  });

  it('withholds headings that look like data', () => {
    expect(safeHeading('Courrier perso')).toBe('Courrier perso');
    expect(safeHeading('anne@example.com')).toBeNull();
    expect(safeHeading('+33 6 12 34 56 78')).toBeNull();
    expect(safeHeading('2024-03-02')).toBeNull();
    expect(safeHeading('12345')).toBeNull();
    expect(safeHeading('a'.repeat(61))).toBeNull();
    expect(valueKind('  ')).toBeNull();
  });
});

describe('buildMappingRequest privacy', () => {
  it('never contains a cell value, email, name or phone', () => {
    const request = requestFor(csv([HEADINGS, ...CELLS]));
    const json = JSON.stringify(request);
    expect(json).not.toContain('SENTINEL');
    expect(json).not.toMatch(/sentinel|private\.invalid|@/i);
    for (const row of CELLS) for (const cell of row) expect(json).not.toContain(cell);
    // No fragment of a phone number either.
    expect(json).not.toMatch(/12 34|98 76|0612|56 78/);
  });

  it('sends only column numbers, headings and shapes, plus the field list', () => {
    const data = promptData(requestFor(csv([HEADINGS, ...CELLS])));
    expect(Object.keys(data).sort()).toEqual(['columns', 'fields']);
    for (const column of data.columns) expect(Object.keys(column).sort()).toEqual(['column', 'heading', 'shape']);
    expect(data.columns.map((c) => c.shape)).toEqual([
      'short text (avg 12 chars)',
      'email-like',
      'phone-like',
      'date',
      'long text (avg 67 chars)',
      'short text (avg 14 chars)',
    ]);
    expect(data.columns.map((c) => c.heading)).toEqual(HEADINGS);
  });

  it('withholds every heading when the heading row is really a row of contacts', () => {
    const request = requestFor(csv(CELLS));
    const json = JSON.stringify(request);
    expect(json).not.toMatch(/sentinel|private\.invalid|@/i);
    expect(promptData(request).columns.every((c) => c.heading === null)).toBe(true);
  });

  it('sends no headings when the file has no heading row', () => {
    const request = requestFor(csv([['Anne Tester', 'Free text'], ['Bo Tester', 'More']]), false);
    expect(JSON.stringify(request)).not.toMatch(/Tester|Free text/);
  });

  it('sends only unmatched columns and unused fields, and never offers Contact ID', () => {
    const data = promptData(requestFor(csv([['First name', 'Email', 'Code', 'Observations'], ['A', 'a@example.com', 'x', 'y']])));
    expect(data.columns.map((c) => c.column)).toEqual([3, 4]);
    const offered = data.fields.map((f) => f.name);
    expect(offered).not.toContain('firstName');
    expect(offered).not.toContain('email');
    expect(offered).not.toContain('externalId');
    expect(AI_TARGETS).not.toContain('externalId');
  });

  it('is null when there is nothing to match', () => {
    const parsed = parseCsvText('First name,Email\nA,a@example.com\n', true);
    expect(buildMappingRequest(parsed, suggestMapping(parsed.headers))).toBeNull();
  });

  it('is estimated at under one euro cent', () => {
    const cost = estimateMappingCostEur(requestFor(csv([HEADINGS, ...CELLS])));
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01);
  });
});

describe('parseMappingReply', () => {
  const request = requestFor(csv([HEADINGS, ...CELLS]));
  const validate = parseMappingReply(request);
  const ok = (input: unknown) => {
    const result = validate(input);
    if (!result.ok) throw new Error(result.detail);
    return result.value;
  };

  it('keeps known fields for columns that were sent (column numbers are 1-based)', () => {
    const value = ok({ matches: [{ column: 1, field: 'fullName', confidence: 0.9 }, { column: 2, field: 'email', confidence: 1 }] });
    expect([...value]).toEqual([[1, 'email'], [0, 'fullName']]);
  });

  it('drops unknown field names, Contact ID, nulls and columns that were not sent', () => {
    const value = ok({
      matches: [
        { column: 1, field: 'birthday', confidence: 1 },
        { column: 6, field: 'externalId', confidence: 1 },
        { column: 3, field: null, confidence: 0.2 },
        { column: 99, field: 'notes', confidence: 1 },
      ],
    });
    expect(value.size).toBe(0);
  });

  it('gives a field to one column only, the more confident one', () => {
    const value = ok({
      matches: [
        { column: 5, field: 'notes', confidence: 0.4 },
        { column: 6, field: 'notes', confidence: 0.8 },
      ],
    });
    expect([...value]).toEqual([[5, 'notes']]);
  });

  it('rejects a reply of the wrong shape', () => {
    expect(validate(undefined).ok).toBe(false);
    expect(validate({ matches: 'notes' }).ok).toBe(false);
    expect(validate({ matches: [{ column: 'one', field: 'notes' }] }).ok).toBe(false);
  });

  it('only fills columns still unmatched, with fields not used yet', () => {
    const mapping: ColumnMapping = ['firstName', null, null];
    const { mapping: next, applied } = applySuggestions(mapping, new Map([[0, 'notes'], [1, 'firstName'], [2, 'notes']]));
    expect(next).toEqual(['firstName', null, 'notes']);
    expect([...applied]).toEqual([[2, 'notes']]);
  });
});

describe('matchColumns', () => {
  const request = requestFor(csv([HEADINGS, ...CELLS]));
  const usage = { inputTokens: 1000, outputTokens: 100 };
  const online = { isOnline: () => true, waitForOnline: async () => {} };

  it('sends nothing without an API key (demo mode)', async () => {
    const send = vi.fn<Send<MappingRequest>>();
    expect(await matchColumns(request, { send, connectivity: online })).toEqual({ ok: false, code: 'no_key', costEur: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends nothing while offline', async () => {
    await updateSettings({ apiKey: 'sk-test' });
    const send = vi.fn<Send<MappingRequest>>();
    const result = await matchColumns(request, { send, connectivity: { isOnline: () => false, waitForOnline: async () => {} } });
    expect(result).toMatchObject({ ok: false, code: 'network' });
    expect(send).not.toHaveBeenCalled();
  });

  it('returns suggestions and adds the cost to the running total', async () => {
    await updateSettings({ apiKey: 'sk-test' });
    const send = vi.fn<Send<MappingRequest>>(async () => ({
      toolInput: { matches: [{ column: 2, field: 'email', confidence: 0.95 }] },
      usage,
    }));
    const result = await matchColumns(request, { send, connectivity: online });
    expect(result.ok && [...result.suggestions]).toEqual([[1, 'email']]);
    expect(send).toHaveBeenCalledWith(request);
    expect(result.costEur).toBeGreaterThan(0);
    expect((await getSettings()).costTotalEur).toBeCloseTo(result.costEur);
  });

  it('retries a malformed reply once, then fails and still counts the cost', async () => {
    await updateSettings({ apiKey: 'sk-test' });
    const send = vi.fn<Send<MappingRequest>>(async () => ({ toolInput: { nope: true }, usage }));
    const result = await matchColumns(request, { send, connectivity: online });
    expect(result).toMatchObject({ ok: false, code: 'malformed' });
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.costEur).toBeGreaterThan(0);
    expect((await getSettings()).costTotalEur).toBeCloseTo(result.costEur);
  });

  it('reports a rejected key without retrying', async () => {
    await updateSettings({ apiKey: 'sk-bad' });
    const send = vi.fn<Send<MappingRequest>>(async () => {
      throw Object.assign(new Error('invalid x-api-key'), { status: 401 });
    });
    expect(await matchColumns(request, { send, connectivity: online })).toEqual({ ok: false, code: 'auth', costEur: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('waits out a rate limit, then succeeds', async () => {
    await updateSettings({ apiKey: 'sk-test' });
    let calls = 0;
    const send: Send<MappingRequest> = async () => {
      if (calls++ === 0) throw Object.assign(new Error('rate limited'), { status: 429 });
      return { toolInput: { matches: [] }, usage };
    };
    const result = await matchColumns(request, { send, connectivity: online, sleep: async () => {} });
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });
});
