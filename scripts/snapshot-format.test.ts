import { describe, expect, it } from 'vitest';
import { failedBody, key, okBody, parseSnapshot, quotedPhrases, renderSnapshot, sourceCheck, type Entry, type Job } from './snapshot-format';

const jobs: Job[] = [
  { contactId: 'fx-01', contactCase: 'Rich notes', heading: 'Spring check-in (en)' },
  { contactId: 'fx-01', contactCase: 'Rich notes', heading: 'Holiday greeting (en)' },
  { contactId: 'fx-02', contactCase: 'Empty notes', heading: 'Spring check-in (en)' },
];

// The format the first real run produced (old-style failure line).
const firstRun = `# Draft snapshot

Model: \`claude-sonnet-5\` · Prompt + templates hash: \`2159bb28e959\`

Raw model output (placeholders not yet filled). Regenerate with \`npm run drafts:snapshot\`.

## fx-01: Rich notes

### Spring check-in (en)

**Subject:** How is your year going?

**Personalization used:** The half marathon.

> Hello Hannah,
>
> {{signature}}

### Holiday greeting (en)

**FAILED:** Error: unknown: Request timed out.

## fx-02: Empty notes

### Spring check-in (en)

**Subject:** Hello

**Personalization used:** No notes were available.

> Hi Gareth,
`;

describe('snapshot file', () => {
  it('reads drafts and gaps from the file the first run wrote', () => {
    const parsed = parseSnapshot(firstRun);
    expect(parsed).toMatchObject({ model: 'claude-sonnet-5', hash: '2159bb28e959' });
    expect(parsed.entries.get(key('fx-01', 'Spring check-in (en)'))?.kind).toBe('ok');
    expect(parsed.entries.get(key('fx-01', 'Holiday greeting (en)'))?.kind).toBe('failed');
    expect(parsed.entries.get(key('fx-02', 'Spring check-in (en)'))?.kind).toBe('ok');
  });

  it('keeps every existing draft byte for byte when filling a gap', () => {
    const { entries } = parseSnapshot(firstRun);
    entries.set(key('fx-01', 'Holiday greeting (en)'), {
      kind: 'ok',
      body: okBody({ subject: 'Warm wishes', body: 'Hello Hannah,\n\n{{signature}}', personalizationUsed: 'Her new role.' }),
    });
    const out = renderSnapshot('claude-sonnet-5', '2159bb28e959', jobs, entries);
    const before = firstRun.split('### Holiday greeting (en)')[0];
    expect(out.startsWith(before)).toBe(true); // header and the first draft unchanged
    expect(out).toContain('## fx-02: Empty notes\n\n### Spring check-in (en)\n\n**Subject:** Hello');
    expect(out).not.toContain('FAILED');
    expect(out).not.toContain('drafts are missing');
  });

  it('marks gaps with their reason so they cannot be mistaken for a bad draft', () => {
    const entries = new Map<string, Entry>([[key('fx-01', 'Spring check-in (en)'), { kind: 'failed', body: failedBody('network', 'Request timed out.') }]]);
    const out = renderSnapshot('m', 'h', jobs, entries);
    expect(out).toContain('**Not generated (network: the connection dropped, the device was offline, or the request timed out, even after 3 retries).** Error: Request timed out.');
    expect(out).toContain('--retry-failed');
    expect(out).toContain('**3 of 3 drafts are missing**'); // one failed, two never run
    expect(out).toContain('**Not generated (not run yet).**');
    const reparsed = parseSnapshot(out);
    expect([...reparsed.entries.values()].map((e) => e.kind)).toEqual(['failed', 'pending', 'pending']);
  });
});

describe('source check', () => {
  const entry = (personalization: string): Entry => ({
    kind: 'ok',
    body: okBody({ subject: 's', body: 'b', personalizationUsed: personalization }),
  });
  it('passes when every quote is in the notes, and flags quotes that are not', () => {
    const sources = 'Ran the London half marathon in April for a local charity. Promoted to head of operations.';
    const lines = sourceCheck([
      { label: 'ok', entry: entry('Used "Promoted to head of operations" and “half marathon in April”.'), sources },
      { label: 'bad', entry: entry('Used "ran it for a good cause".'), sources },
      { label: 'none', entry: entry('Used her promotion.'), sources },
      { label: 'empty', entry: entry('No notes were available.'), sources: '' },
    ]);
    expect(lines[0]).toContain('2 problem(s) in 4 drafts');
    expect(lines).toContain('- bad: quote not in the contact\'s data: "ran it for a good cause"');
    expect(lines).toContain('- none: no source phrase quoted');
  });
  it('reads French guillemets', () => {
    expect(quotedPhrases('Utilisé « Vient d\'ouvrir un deuxième atelier »')).toEqual(["Vient d'ouvrir un deuxième atelier"]);
  });
  it('does not treat the Checks section as a contact', () => {
    const md = '# Draft snapshot\n\n## Checks\n\n**Source check:** ok\n\n## fx-01: A\n\n### T (en)\n\n**Subject:** x\n';
    expect([...parseSnapshot(md).entries.keys()]).toEqual(['fx-01|T (en)']);
  });
});

describe('snapshot date', () => {
  it('records the date given to the model in the header, and reads it back', () => {
    const out = renderSnapshot('m', 'h', jobs, new Map(), [], ['Date given to the model: `2026-09-28`', '']);
    expect(out).toContain('Date given to the model: `2026-09-28`');
    expect(parseSnapshot(out).date).toBe('2026-09-28');
  });
});

describe('opening check', () => {
  it('ignores the greeting and the name, and counts drafts that share six opening words', async () => {
    const { openingWords, openingCheck } = await import('./snapshot-format');
    expect(openingWords('Hello Hannah,\n\nSpring always feels like a good moment to look up.', 'Hannah')).toBe('spring always feels like a good');
    expect(openingWords('Bonjour Léa,\n\nLe printemps est toujours un bon moment', 'Léa')).toBe('le printemps est toujours un bon');
    const e = (text: string): Entry => ({ kind: 'ok', body: okBody({ subject: 's', personalizationUsed: 'p', body: text }) });
    const lines = openingCheck([
      { group: 'Spring', label: 'a', firstName: 'Ann', entry: e('Hello Ann,\n\nSpring always feels like a good moment, Ann.') },
      { group: 'Spring', label: 'b', firstName: 'Bo', entry: e('Hi Bo,\n\nSpring always feels like a good moment.') },
      { group: 'Spring', label: 'c', firstName: 'Cy', entry: e('Hello Cy,\n\nCongratulations on the new role.') },
      { group: 'Holiday', label: 'd', firstName: 'Di', entry: e('Dear Di,\n\nWarm wishes.') },
    ]);
    expect(lines).toContain('- Spring: 2 of 3');
    expect(lines).toContain('- Holiday: 0 of 1');
    expect(lines.at(-1)).toBe('Total: 2 drafts with a repeated opening.');
  });
});
