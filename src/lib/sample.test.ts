import { describe, expect, it } from 'vitest';
import { applyMapping, parseCsvText, suggestMapping } from './csv';
import { sampleContactsCsv } from './sample';

function contactsOn(today: Date) {
  const parsed = parseCsvText(sampleContactsCsv(today), true);
  return applyMapping(parsed, suggestMapping(parsed.headers), { defaultType: 'client' }).contacts;
}

describe('sample contacts', () => {
  for (const today of [new Date(2026, 8, 28), new Date(2031, 0, 3), new Date(2040, 6, 15)]) {
    it(`are dated relative to ${today.toDateString()}`, () => {
      const contacts = contactsOn(today);
      expect(contacts).toHaveLength(12);
      const dates = contacts.map((c) => c.lastContacted).filter((d): d is string => !!d);
      expect(contacts.length - dates.length).toBeGreaterThanOrEqual(3);
      const ages = dates.map((d) => Math.round((+today - +new Date(`${d}T00:00`)) / 86_400_000));
      expect(Math.min(...ages)).toBeLessThan(30);
      expect(Math.max(...ages)).toBeGreaterThan(365);
      expect(ages.every((a) => a > 0 && a < 500)).toBe(true);
      // Any year mentioned in the text is recent, never a fixed past year.
      const years = contacts
        .flatMap((c) => [c.serviceHistory, c.notes, c.whereMet].join(' ').match(/\b(19|20)\d\d\b/g) ?? [])
        .map(Number);
      expect(years.length).toBeGreaterThan(0);
      expect(years.every((y) => y >= today.getFullYear() - 2 && y < today.getFullYear())).toBe(true);
    });
  }
});
