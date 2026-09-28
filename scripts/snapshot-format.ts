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

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Phrases quoted in personalizationUsed ("…", “…”, « … »). */
export function quotedPhrases(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"|“([^”]+)”|«\s*([^»]+?)\s*»/g)].map((m) => (m[1] ?? m[2] ?? m[3]).trim());
}

/**
 * Check 1: does each draft cite its sources, and do those quotes exist?
 * A quote that isn't in the contact's own data means the self-report (or the
 * draft) drifted from the facts.
 */
export function sourceCheck(
  items: { label: string; entry: Entry; sources: string }[],
): string[] {
  const problems: string[] = [];
  let checked = 0;
  for (const { label, entry, sources } of items) {
    const draft = readDraft(entry);
    if (!draft) continue;
    checked++;
    const quotes = quotedPhrases(draft.personalization);
    const haystack = squash(sources);
    if (haystack && quotes.length === 0 && !/no notes|aucune note|not use|n'utilise|pas utilisé/i.test(draft.personalization)) {
      problems.push(`- ${label}: no source phrase quoted`);
    }
    for (const q of quotes) if (!haystack.includes(squash(q))) problems.push(`- ${label}: quote not in the contact's data: "${q}"`);
  }
  return [
    `**Source check:** ${problems.length === 0 ? `all ${checked} drafts quote only phrases found in their contact's notes or work history.` : `${problems.length} problem(s) in ${checked} drafts:`}`,
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
