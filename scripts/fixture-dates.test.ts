import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveFixtureDates } from './fixture-dates';

const fixtures = JSON.parse(readFileSync('fixtures/contacts.json', 'utf8')) as Record<string, string>[];

describe('fixture dates', () => {
  it('resolve against the snapshot date', () => {
    expect(resolveFixtureDates('in {year-2}, {year}; {date-17}; {date-17:fr}', '2026-09-28')).toBe(
      'in 2024, 2026; 2026-09-11; 11 septembre 2026',
    );
    expect(resolveFixtureDates({ a: ['{date-365}'] }, '2031-03-01')).toEqual({ a: ['2030-03-01'] });
  });

  it('give the pinned snapshot date the values the committed snapshot was made with', () => {
    const byId = Object.fromEntries(resolveFixtureDates(fixtures, '2026-09-28').map((c) => [c.id, c]));
    expect(byId['fx-01'].serviceHistory).toBe('Two team workshops in 2024 and a follow-up review in January.');
    expect(byId['fx-01'].lastContacted).toBe('2025-02-10');
    expect(byId['fx-05'].serviceHistory.startsWith('2021: needs assessment')).toBe(true);
    expect(byId['fx-12'].whereMet).toBe('Salon des entrepreneurs de Lyon, 11 septembre 2026');
  });

  it('leave no literal year or unresolved token in the fixtures', () => {
    const raw = readFileSync('fixtures/contacts.json', 'utf8');
    expect(raw).not.toMatch(/\b(19|20)\d\d\b/);
    expect(JSON.stringify(resolveFixtureDates(fixtures, '2030-01-01'))).not.toMatch(/\{(year|date)/);
  });
});
