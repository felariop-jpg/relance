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

describe('placeholder check', () => {
  it('lists drafts that left a placeholder', async () => {
    const { placeholderCheck } = await import('./snapshot-format');
    const { inputPlaceholders } = await import('../src/lib/needsInput');
    const e = (body: string): Entry => ({ kind: 'ok', body: okBody({ subject: 's', personalizationUsed: 'p', body }) });
    const lines = placeholderCheck(
      [
        { label: 'fx-12 post-event', entry: e('Le livre : [TITRE DU LIVRE].') },
        { label: 'fx-01 spring', entry: e('Hello.') },
      ],
      inputPlaceholders,
    );
    expect(lines).toEqual([
      '**Needs your input** (drafts with a [PLACEHOLDER] instead of an invented value): 1:',
      '- fx-12 post-event: [TITRE DU LIVRE]',
    ]);
  });
});

describe('inference check', () => {
  it('flags hedged consequences and feelings stated back, and passes clean drafts', async () => {
    const { inferenceCheck } = await import('./snapshot-format');
    const e = (body: string): Entry => ({ kind: 'ok', body: okBody({ subject: 's', personalizationUsed: 'p', body }) });
    const lines = inferenceCheck([
      { label: 'fx-11 planning', notes: 'Left the partnership.', entry: e('I imagine leaving the partnership means your plans look different.') },
      { label: 'fx-09 reengage', notes: 'A bit nervous about the four-day week.', entry: e("Surtout avec l'appréhension que cela suscitait.") },
      { label: 'fx-09 clean', notes: 'A bit nervous about the four-day week.', entry: e('Comment se passe la semaine de quatre jours ?') },
      { label: 'fr hedge', notes: '', entry: e('Cela doit être un grand changement.') },
    ]);
    expect(lines[0]).toContain('2:');
    expect(lines).toContain('- fx-11 planning: "I imagine"');
    expect(lines.find((l) => l.startsWith('- fr hedge'))).toContain('Cela doit');
    expect(lines.find((l) => l.startsWith('**Feelings'))).toContain('1:');
    expect(lines.some((l) => l.startsWith('- fx-09 reengage'))).toBe(true);
    expect(lines.some((l) => l.startsWith('- fx-09 clean'))).toBe(false);
  });
});

describe('source check noise', () => {
  const e = (personalization: string, body = 'Hello.'): Entry => ({ kind: 'ok', body: okBody({ subject: 's', body, personalizationUsed: personalization }) });
  it('does not flag contact fields, trailing punctuation, trimmed quotes or no-notes self-quotes', () => {
    const lines = sourceCheck([
      { label: 'company', entry: e('Used "Price Logistics".'), sources: 'Advisory session in 2023.', data: ['Price Logistics'], hasNotes: false },
      { label: 'comma', entry: e('Used "the most useful thing the company did that year,"'), sources: 'Says the leadership programme was the most useful thing the company did that year.', hasNotes: true },
      { label: 'trimmed', entry: e('Used "managing across two sites".'), sources: 'Now managing 30 people across two sites.', hasNotes: true },
      { label: 'greeting', entry: e('The opening ("Hope this finds you well") is plain.', 'Hi,\nHope this finds you well.'), sources: '', hasNotes: false },
      { label: 'today', entry: e('Worked out from "today".'), sources: 'Left the partnership.', data: ['today', '2026-09-28'], hasNotes: true },
      { label: 'no-notes prose', entry: e('No notes were available, so nothing personal was used.'), sources: 'Advisory session.', hasNotes: false },
    ]);
    expect(lines).toEqual(['**Source check:** all 6 drafts quote only phrases found in their contact\'s data.']);
  });
  it('still flags invented quotes, including in a no-notes draft when the quote is not the email itself', () => {
    const lines = sourceCheck([
      { label: 'book', entry: e('Used "The Culture Code".', 'Le livre, The Culture Code.'), sources: 'Asked for the name of the book I mentioned.', hasNotes: true },
      { label: 'project', entry: e('Used « votre projet avec Studio Martin ».'), sources: 'Aime le vélo.', data: ['Studio Martin'], hasNotes: true },
      { label: 'added words', entry: e('Used "your daughter settling in well as finance director".'), sources: 'His daughter joined as finance director.', hasNotes: true },
    ]);
    expect(lines[0]).toContain('3 problem(s)');
  });
});
