import { describe, expect, it } from 'vitest';
import { emptyContact } from '../db/contacts';
import { newDraft } from '../db/drafts';
import { BUILT_IN_TEMPLATES } from '../db/seed';
import { defaultSettings } from '../db/settings-defaults';
import type { Contact } from '../db/schema';
import { anyScheduledThisMonth, daysSince, dueGroups, isDue, nextBatch, upcoming } from './schedule';
import { applyMapping, parseCsvText, suggestMapping } from './csv';
import { sampleContactsCsv } from './sample';

const rule = { month: 8, minGapDays: 60 };
const aug = new Date(2026, 7, 28);

function contact(id: string, patch: Partial<Contact> = {}): Contact {
  return { ...emptyContact(), id, firstName: id, createdAt: '', updatedAt: '', ...patch };
}

describe('isDue', () => {
  it('needs the right month', () => {
    expect(isDue(contact('a'), rule, [], aug)).toBe(true);
    expect(isDue(contact('a'), rule, [], new Date(2026, 8, 1))).toBe(false);
  });

  it('respects the minimum gap, counting whole days', () => {
    expect(isDue(contact('a', { lastContacted: '2026-06-29' }), rule, [], aug)).toBe(true); // 60 days
    expect(isDue(contact('a', { lastContacted: '2026-06-30' }), rule, [], aug)).toBe(false); // 59 days
  });

  it('treats never-contacted as due, and filters by contact type', () => {
    expect(isDue(contact('a', { contactType: 'lead' }), rule, ['client'], aug)).toBe(false);
    expect(isDue(contact('a', { contactType: 'client' }), rule, ['client'], aug)).toBe(true);
  });

  it('counts days across a year boundary', () => {
    expect(daysSince('2025-12-31', new Date(2026, 0, 1))).toBe(1);
  });
});

describe('dueGroups', () => {
  const settings = defaultSettings('en');
  const contacts = [
    contact('client-old', { contactType: 'client', lastContacted: '2026-01-01' }),
    contact('client-recent', { contactType: 'client', lastContacted: '2026-08-01' }),
    contact('prospect-never', { contactType: 'prospect', country: 'FR' }),
    contact('lead', { contactType: 'lead' }),
  ];

  it('lists who is due in August for late-summer planning, in their language', () => {
    const groups = dueGroups(contacts, BUILT_IN_TEMPLATES, [], settings, aug);
    expect(groups.map((g) => g.family.family)).toEqual(['planning']);
    const entries = groups[0].entries;
    expect(entries.map((e) => e.contact.id)).toEqual(['prospect-never', 'client-old']);
    expect(entries[0].template.language).toBe('fr');
    expect(entries[1].template.language).toBe('en');
  });

  it('flags contacts that already have an open draft for that template', () => {
    const drafts = [newDraft({ contactId: 'client-old', templateId: 'builtin-planning-en', language: 'en' })];
    const [group] = dueGroups(contacts, BUILT_IN_TEMPLATES, drafts, settings, aug);
    expect(group.entries.find((e) => e.contact.id === 'client-old')?.hasOpenDraft).toBe(true);
    const exported = [{ ...drafts[0], exportedAt: '2026-08-02T10:00:00Z' }];
    const [again] = dueGroups(contacts, BUILT_IN_TEMPLATES, exported, settings, aug);
    expect(again.entries.find((e) => e.contact.id === 'client-old')?.hasOpenDraft).toBe(false);
  });

  it('shows the holiday greeting to everyone in November', () => {
    const [group] = dueGroups(contacts, BUILT_IN_TEMPLATES, [], settings, new Date(2026, 10, 5));
    expect(group.family.family).toBe('holiday');
    expect(group.entries).toHaveLength(4);
  });

  it('lists upcoming scheduled templates, soonest first', () => {
    const next = upcoming(contacts, BUILT_IN_TEMPLATES, settings, aug);
    expect(next.map((u) => [u.family.family, u.month])).toEqual([
      ['holiday', 11],
      ['reengage', 2],
      ['spring-checkin', 4],
    ]);
  });

  it('counts only contacts the template can be used for', () => {
    // Re-engagement needs "Left open", work done together or where you met.
    const prospects = [
      contact('bare', { contactType: 'prospect' }),
      contact('met', { contactType: 'prospect', whereMet: 'Lyon fair' }),
    ];
    const reengage = upcoming(prospects, BUILT_IN_TEMPLATES, settings, aug).find((u) => u.family.family === 'reengage');
    expect(reengage?.count).toBe(1);
  });
});

describe('Due now across the year (sample contacts, built-in templates)', () => {
  const settings = defaultSettings('en');
  for (let month = 0; month < 12; month++) {
    const today = new Date(2026, month, 15);
    it(`has something useful to lead with in ${today.toLocaleString('en', { month: 'long' })}`, () => {
      const parsed = parseCsvText(sampleContactsCsv(today), true);
      const contacts = applyMapping(parsed, suggestMapping(parsed.headers), { defaultType: 'client' }).contacts.map(
        (c, i) => ({ ...c, id: String(i), createdAt: '', updatedAt: '' }),
      );
      const groups = dueGroups(contacts, BUILT_IN_TEMPLATES, [], settings, today);
      const next = upcoming(contacts, BUILT_IN_TEMPLATES, settings, today);
      if (groups.length > 0) {
        expect(anyScheduledThisMonth(BUILT_IN_TEMPLATES, settings, today)).toBe(true);
      } else {
        const headline = nextBatch(next);
        expect(headline).toBeDefined();
        expect(headline!.count).toBeGreaterThan(0);
        // The headline batch is never more than three months away with the built-in schedule.
        expect((headline!.month - (month + 1) + 12) % 12).toBeLessThanOrEqual(3);
      }
      // Coming up counts match what Due now shows on the 1st of that month.
      for (const u of next) {
        const first = new Date(today.getFullYear() + (u.month < month + 1 ? 1 : 0), u.month - 1, 1);
        const due = dueGroups(contacts, BUILT_IN_TEMPLATES, [], settings, first).find((g) => g.family.family === u.family.family);
        expect(due?.entries.length ?? 0).toBe(u.count);
      }
    });
  }
});
