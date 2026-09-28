import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emptyContact } from '../db/contacts';
import { defaultSettings } from '../db/settings';
import { BUILT_IN_TEMPLATES } from '../db/seed';
import { applyMapping, parseCsvText, suggestMapping } from '../lib/csv';
import { unknownPlaceholders } from '../lib/placeholders';
import { draftOutputSchema } from './schema';
import { demoOutput } from './demo';

const sample = (() => {
  const parsed = parseCsvText(readFileSync('public/sample-contacts.csv', 'utf8'), true);
  return applyMapping(parsed, suggestMapping(parsed.headers), { defaultType: 'client' }).contacts.map(
    (c, i) => ({ ...c, id: String(i), createdAt: '', updatedAt: '' }),
  );
})();

describe('demo drafts', () => {
  for (const ui of ['en', 'fr'] as const) {
    const settings = defaultSettings(ui);
    it(`are valid for every sample contact and template (${ui} interface)`, () => {
      for (const contact of sample) {
        for (const template of BUILT_IN_TEMPLATES) {
          const { output } = demoOutput(contact, template, settings);
          expect(draftOutputSchema.safeParse(output).success).toBe(true);
          expect(output.body).not.toContain('{{opening}}');
          expect(unknownPlaceholders(output.body)).toEqual([]);
          expect(output.body.split(/\s+/).length).toBeLessThan(150);
        }
      }
    });
  }

  it('are personal for sample contacts with notes, and say so plainly otherwise', () => {
    const settings = defaultSettings('en');
    const amelie = sample.find((c) => c.firstName === 'Amélie')!;
    const ben = sample.find((c) => c.firstName === 'Ben')!;
    const spring = BUILT_IN_TEMPLATES[0];
    expect(demoOutput(amelie, spring, settings)).toMatchObject({ personal: true });
    expect(demoOutput(amelie, spring, settings).output.language).toBe('fr');
    const noNotes = demoOutput(ben, spring, settings);
    expect(noNotes.personal).toBe(false);
    expect(noNotes.output.personalizationUsed).toMatch(/No notes/);
    const stranger = demoOutput({ ...amelie, email: 'someone@else.test' }, spring, settings);
    expect(stranger.personal).toBe(false);
    expect(stranger.output.personalizationUsed).toMatch(/demo mode/i);
  });

  it('handle user-made template families', () => {
    const custom = { ...BUILT_IN_TEMPLATES[0], family: 'custom-1' };
    const contact = { ...emptyContact(), id: 'x', firstName: 'Zoé', notes: 'x', createdAt: '', updatedAt: '' };
    const { output } = demoOutput(contact, custom, defaultSettings('fr'));
    expect(output.body.startsWith('Hello {{firstName}},')).toBe(true);
    expect(output.personalizationUsed).toMatch(/mode démo/);
  });
});
