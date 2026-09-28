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

export function parseSnapshot(markdown: string): { model: string | null; hash: string | null; entries: Map<string, Entry> } {
  const model = /^Model: `([^`]+)`/m.exec(markdown)?.[1] ?? null;
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
    const h2 = /^## (\S+?): /.exec(line);
    const h3 = /^### (.+)$/.exec(line);
    if (h2 || h3) {
      flush();
      body = [];
      if (h2) {
        contact = h2[1];
        heading = null;
      } else heading = h3![1];
    } else if (heading) body.push(line);
  }
  flush();
  return { model, hash, entries };
}

export function renderSnapshot(model: string, hash: string, jobs: Job[], entries: Map<string, Entry>): string {
  const gaps = jobs.filter((j) => entries.get(key(j.contactId, j.heading))?.kind !== 'ok').length;
  const lines = [
    '# Draft snapshot',
    '',
    `Model: \`${model}\` · Prompt + templates hash: \`${hash}\``,
    '',
    'Raw model output (placeholders not yet filled). Regenerate with `npm run drafts:snapshot`.',
    '',
  ];
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
