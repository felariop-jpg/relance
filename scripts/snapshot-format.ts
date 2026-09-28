/**
 * The format of fixtures/drafts-snapshot.md, kept separate (and tested) so
 * `--retry-failed` can fill gaps without touching the drafts already there.
 *
 *   ## fx-01: Rich notes, English client
 *   ### Spring check-in (en)
 *   **Subject:** …            ← a draft
 *   **Not generated (network…):** … ← a gap, with its reason
 */

export type EntryKind = 'ok' | 'failed' | 'pending';
export interface Entry {
  kind: EntryKind;
  /** Lines between the heading and the next heading, without surrounding blank lines. */
  body: string[];
}

export interface Job {
  contactId: string;
  contactCase: string;
  /** e.g. "Spring check-in (en)" */
  heading: string;
}

export const key = (contactId: string, heading: string) => `${contactId}|${heading}`;

const RETRY_HINT = '_This is a gap in the snapshot, not a draft. Fill it with `npm run drafts:snapshot -- --retry-failed`._';

const REASONS: Record<string, string> = {
  network: 'network: the connection dropped, the device was offline, or the request timed out, even after 3 retries',
  rate_limit: 'rate limit: the API was still busy after automatic retries',
  overloaded: 'overloaded: the API was still overloaded after automatic retries',
  auth: 'API key rejected',
  billing: 'no credit left on the Anthropic account',
  malformed: 'malformed reply: the model returned an unusable answer twice',
  unknown: 'unexpected error',
};

export function okBody(output: { subject: string; body: string; personalizationUsed: string }): string[] {
  return [
    `**Subject:** ${output.subject}`,
    '',
    `**Personalization used:** ${output.personalizationUsed}`,
    '',
    ...output.body.split('\n').map((l) => (l ? `> ${l}` : '>')),
  ];
}

export function failedBody(code: string, detail: string): string[] {
  const reason = REASONS[code] ?? code;
  return [`**Not generated (${reason}).** Error: ${detail || 'none given'}`, '', RETRY_HINT];
}

export function pendingBody(): string[] {
  return ['**Not generated (not run yet).** The run stopped before reaching this draft.', '', RETRY_HINT];
}

export function parseSnapshot(markdown: string): {
  model: string | null;
  hash: string | null;
  date: string | null;
  entries: Map<string, Entry>;
} {
  const model = /^Model: `([^`]+)`/m.exec(markdown)?.[1] ?? null;
  const date = /^Date given to the model: `([^`]+)`/m.exec(markdown)?.[1] ?? null;
  const hash = /hash: `([0-9a-f]+)`/.exec(markdown)?.[1] ?? null;
  const entries = new Map<string, Entry>();
  let contact: string | null = null;
  let heading: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (!contact || !heading) return;
    while (body.length && body[0].trim() === '') body.shift();
    while (body.length && body[body.length - 1].trim() === '') body.pop();
    const text = body.join('\n');
    const kind: EntryKind = /^\*\*(FAILED|Not generated \(not run yet\))/m.test(text)
      ? /not run yet/.test(text)
        ? 'pending'
        : 'failed'
      : /^\*\*Not generated/m.test(text)
        ? 'failed'
        : 'ok';
    entries.set(key(contact, heading), { kind, body });
  };
  for (const line of markdown.split('\n')) {
    // "## fx-01: …" starts a contact; any other "## …" (such as "## Checks") is not one.
    const h2 = /^## (.*)$/.exec(line);
    const h3 = /^### (.+)$/.exec(line);
    if (h2 || h3) {
      flush();
      body = [];
      if (h2) {
        contact = /^(\S+?): /.exec(h2[1])?.[1] ?? null;
        heading = null;
      } else heading = h3![1];
    } else if (heading) body.push(line);
  }
  flush();
  return { model, hash, date, entries };
}

export function renderSnapshot(
  model: string,
  hash: string,
  jobs: Job[],
  entries: Map<string, Entry>,
  checks: string[] = [],
  extraHeader: string[] = [],
): string {
  const gaps = jobs.filter((j) => entries.get(key(j.contactId, j.heading))?.kind !== 'ok').length;
  const lines = [
    '# Draft snapshot',
    '',
    `Model: \`${model}\` · Prompt + templates hash: \`${hash}\``,
    '',
    ...extraHeader,
    'Raw model output (placeholders not yet filled). Regenerate with `npm run drafts:snapshot`.',
    '',
  ];
  if (checks.length > 0) lines.push('## Checks', '', ...checks, '');
  if (gaps > 0) {
    lines.push(
      `**${gaps} of ${jobs.length} drafts are missing** (marked "Not generated" below, with the reason). Fill them with \`npm run drafts:snapshot -- --retry-failed\`.`,
      '',
    );
  }
  let current = '';
  for (const job of jobs) {
    if (job.contactId !== current) {
      current = job.contactId;
      lines.push(`## ${job.contactId}: ${job.contactCase}`, '');
    }
    const entry = entries.get(key(job.contactId, job.heading)) ?? { kind: 'pending', body: pendingBody() };
    lines.push(`### ${job.heading}`, '', ...entry.body, '');
  }
  return lines.join('\n');
}

/** The parts of a written draft, read back from its lines in the file. */
export function readDraft(entry: Entry): { subject: string; personalization: string; body: string } | null {
  if (entry.kind !== 'ok') return null;
  const subject = entry.body.find((l) => l.startsWith('**Subject:** '))?.slice(13) ?? '';
  const personalization = entry.body.find((l) => l.startsWith('**Personalization used:** '))?.slice(26) ?? '';
  const body = entry.body
    .filter((l) => l.startsWith('>'))
    .map((l) => l.replace(/^> ?/, ''))
    .join('\n');
  return { subject, personalization, body };
}

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/…|\.\.\./g, ' ')
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Phrases quoted in personalizationUsed ("…", “…”, « … »). */
export function quotedPhrases(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"|“([^”]+)”|«\s*([^»]+?)\s*»/g)].map((m) => (m[1] ?? m[2] ?? m[3]).trim());
}

/** True if every word of the quote appears in the source, in the same order (a trimmed quote adds nothing). */
function inOrder(quote: string, source: string): boolean {
  const words = source.split(' ');
  let i = 0;
  for (const w of quote.split(' ')) {
    while (i < words.length && words[i] !== w) i++;
    if (i === words.length) return false;
    i++;
  }
  return true;
}

export interface SourceItem {
  label: string;
  entry: Entry;
  /** notes, serviceHistory, whereMet, openThread: what personalisation may quote. */
  sources: string;
  /** Plain contact data (company, first name, country, today...), never flagged when quoted. */
  data?: string[];
  /** The contact has notes (only then is a quote required). */
  hasNotes?: boolean;
}

/**
 * Check 1: does each draft cite its sources, and do those quotes exist?
 * Only text presented as a quotation is checked. Contact fields (company,
 * name, country...) are data, not personalisation, so quoting them is fine.
 * Without notes, the model's quotes of its own wording are not sources, so
 * they are ignored; with notes, any quote not in the contact's data is flagged.
 */
export function sourceCheck(items: SourceItem[]): string[] {
  const problems: string[] = [];
  let checked = 0;
  for (const { label, entry, sources, data = [], hasNotes = Boolean(sources.trim()) } of items) {
    const draft = readDraft(entry);
    if (!draft) continue;
    checked++;
    const source = squash(sources);
    const values = data.map(squash).filter(Boolean);
    const ownText = squash(`${draft.subject} ${draft.body}`);
    const quotes = quotedPhrases(draft.personalization);
    if (hasNotes && quotes.length === 0 && !/no notes|aucune note|not use|n'utilise|pas utilisé/i.test(draft.personalization)) {
      problems.push(`- ${label}: no source phrase quoted`);
    }
    for (const raw of quotes) {
      const q = squash(raw);
      if (!q) continue;
      if (source.includes(q) || inOrder(q, source)) continue;
      if (values.some((v) => v.includes(q))) continue; // the quote is (part of) a contact field
      if (!hasNotes && ownText.includes(q)) continue;
      problems.push(`- ${label}: quote not in the contact's data: "${raw}"`);
    }
  }
  return [
    `**Source check:** ${problems.length === 0 ? `all ${checked} drafts quote only phrases found in their contact's data.` : `${problems.length} problem(s) in ${checked} drafts:`}`,
    ...problems,
  ];
}

/** Check: French drafts must not use dual gender forms such as « ravi(e) ». */
export function dualFormCheck(items: { label: string; entry: Entry }[], find: (text: string) => string | null): string[] {
  const hits = items.flatMap(({ label, entry }) => {
    const d = readDraft(entry);
    const f = d ? find(`${d.subject}\n${d.body}`) : null;
    return f ? [`- ${label}: "${f}"`] : [];
  });
  return [`**Dual gender forms:** ${hits.length === 0 ? 'none.' : `${hits.length}:`}`, ...hits];
}

const GREETING = /^(hello|hi|hey|dear|good (morning|afternoon)|bonjour|bonsoir|cher|chère|madame|monsieur)\b/i;

/** The first six words of the email after the greeting line, lower-cased, names removed. */
export function openingWords(body: string, firstName: string): string {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length && (GREETING.test(lines[0]) || (lines[0].endsWith(',') && lines[0].split(/\s+/).length <= 4))) lines.shift();
  const name = firstName.toLowerCase();
  return lines
    .join(' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== name)
    .slice(0, 6)
    .join(' ');
}

/**
 * Check 2 (the owner's metric): per template, how many drafts share their
 * first six words (after the greeting) with another draft of the same template.
 */
export function openingCheck(items: { group: string; label: string; entry: Entry; firstName: string }[]): string[] {
  const groups = new Map<string, { label: string; opening: string }[]>();
  for (const { group, label, entry, firstName } of items) {
    const d = readDraft(entry);
    if (!d) continue;
    const list = groups.get(group) ?? [];
    list.push({ label, opening: openingWords(d.body, firstName) });
    groups.set(group, list);
  }
  const lines = ['**Repeated openings** (drafts sharing their first six words with another draft of the same template):', ''];
  let total = 0;
  for (const [group, list] of groups) {
    const counts = new Map<string, number>();
    for (const { opening } of list) counts.set(opening, (counts.get(opening) ?? 0) + 1);
    const repeated = list.filter((x) => (counts.get(x.opening) ?? 0) > 1);
    total += repeated.length;
    lines.push(`- ${group}: ${repeated.length} of ${list.length}`);
    for (const opening of [...new Set(repeated.map((r) => r.opening))]) {
      lines.push(`  - "${opening}…" × ${counts.get(opening)}`);
    }
  }
  lines.push('', `Total: ${total} drafts with a repeated opening.`);
  return lines;
}

/** Check: drafts that left a [PLACEHOLDER] for the user instead of guessing. */
export function placeholderCheck(items: { label: string; entry: Entry }[], find: (text: string) => string[]): string[] {
  const hits = items.flatMap(({ label, entry }) => {
    const d = readDraft(entry);
    const found = d ? find(`${d.subject}\n${d.body}`) : [];
    return found.length ? [`- ${label}: ${found.join(', ')}`] : [];
  });
  return [
    `**Needs your input** (drafts with a [PLACEHOLDER] instead of an invented value): ${hits.length === 0 ? 'none.' : `${hits.length}:`}`,
    ...hits,
  ];
}

/** Hedged guesses at a consequence or someone's situation ("I imagine…", « cela doit… »). */
export const HEDGED_GUESS =
  /\b(I imagine|I expect|I suspect|I'?m sure|I am sure|I bet|I guess|that must|this must|must have been|must be (quite|a|so)|no doubt|presumably)\b|(j['’]imagine|je suppose|je suis (sûre?|certaine?) que|cela doit|ça doit|doit être (un|une|très|assez)|a dû|sans doute)/iu;

/** Words for feelings; the stem is enough ("nerv" matches nervous, nerveux, nervosité). */
const FEELINGS = [
  'nerv', 'anxi', 'worr', 'stress', 'apprehens', 'appréhens', 'afraid', 'scared', 'fear', 'upset', 'frustrat', 'overwhelm',
  'inquiet', 'inquiét', 'peur', 'angoiss', 'crain', 'débord', 'soucieu', 'tendu', 'tension',
];
const feelingIn = (text: string) => FEELINGS.find((f) => text.toLowerCase().includes(f)) ?? null;

/**
 * Words that turn a hedge into a claim about consequences or circumstances
 * (plans, priorities, situation, work changing), as opposed to a mild remark
 * about a fact's ordinary character ("that must be a busy time").
 */
export const CONSEQUENCE =
  /\b(plans?|priorit|situation|circumstance|different|chang|next year|the year ahead|mean[st]?\b|lead|result|impact|affect|now that|hiring|recruit|projets?|priorités?|situation|différent|chang|l'an prochain|l'année prochaine|l'année à venir|signifie|veut dire|amener|entraîn|conséquen|recrut|désormais)/iu;

/** The sentence around a match. */
function sentenceAt(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index), text.lastIndexOf('\n', index)) + 1;
  const ends = ['.', '!', '?', '\n'].map((c) => text.indexOf(c, index)).filter((i) => i >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) + 1 : text.length).trim();
}

/**
 * Check: hedges split into inferred consequences (should be zero) and mild
 * acknowledgements (reported, not a failure), plus feelings stated back.
 */
export function inferenceCheck(items: { label: string; entry: Entry; notes: string }[]): string[] {
  const consequences: string[] = [];
  const mild: string[] = [];
  const feelings: string[] = [];
  for (const { label, entry, notes } of items) {
    const d = readDraft(entry);
    if (!d) continue;
    const text = `${d.subject}\n${d.body}`;
    const hedge = HEDGED_GUESS.exec(text);
    if (hedge) {
      const sentence = sentenceAt(text, hedge.index);
      (CONSEQUENCE.test(sentence) ? consequences : mild).push(`- ${label}: "${sentence}"`);
    }
    if (feelingIn(notes)) {
      const echoed = feelingIn(text);
      if (echoed) feelings.push(`- ${label}: the notes record a feeling and the email mentions one ("${echoed}…")`);
    }
  }
  return [
    `**Inferred consequences** (a hedge claiming a fact changed their plans, work or situation; should be none): ${consequences.length === 0 ? 'none.' : `${consequences.length}:`}`,
    ...consequences,
    '',
    `Mild acknowledgements (for information, not a failure; e.g. « ça doit être une période chargée »): ${mild.length}${mild.length ? ':' : '.'}`,
    ...mild,
    '',
    `**Feelings stated back** (a feeling from the notes echoed in the email): ${feelings.length === 0 ? 'none.' : `${feelings.length}:`}`,
    ...feelings,
  ];
}
