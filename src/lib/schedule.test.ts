import { describe, expect, it } from 'vitest';
import { emptyContact } from '../db/contacts';
import { newDraft } from '../db/drafts';
import { BUILT_IN_TEMPLATES } from '../db/seed';
import { defaultSettings } from '../db/settings-defaults';
import type { Contact } from '../db/schema';
import { daysSince, dueGroups, isDue, upcoming } from './schedule';

const rule = { month: 9, minGapDays: 60 };
const sept = new Date(2026, 8, 28);

function contact(id: string, patch: Partial<Contact> = {}): Contact {
  return { ...emptyContact(), id, firstName: id, createdAt: '', updatedAt: '', ...patch };
}

describe('isDue', () => {
  it('needs the right month', () => {
    expect(isDue(contact('a'), rule, [], sept)).toBe(true);
    expect(isDue(contact('a'), rule, [], new Date(2026, 9, 1))).toBe(false);
  });

  it('respects the minimum gap, counting whole days', () => {
    expect(isDue(contact('a', { lastContacted: '2026-07-30' }), rule, [], sept)).toBe(true); // 60 days
    expect(isDue(contact('a', { lastContacted: '2026-07-31' }), rule, [], sept)).toBe(false); // 59 days
  });

  it('treats never-contacted as due, and filters by contact type', () => {
    expect(isDue(contact('a', { contactType: 'lead' }), rule, ['client'], sept)).toBe(false);
    expect(isDue(contact('a', { contactType: 'client' }), rule, ['client'], sept)).toBe(true);
  });

  it('counts days across a year boundary', () => {
    expect(daysSince('2025-12-31', new Date(2026, 0, 1))).toBe(1);
  });
});

describe('dueGroups', () => {
  const settings = defaultSettings('en');
  const contacts = [
    contact('client-old', { contactType: 'client', lastContacted: '2026-01-01' }),
    contact('client-recent', { contactType: 'client', lastContacted: '2026-09-01' }),
    contact('prospect-never', { contactType: 'prospect', country: 'FR' }),
    contact('lead', { contactType: 'lead' }),
  ];

  it('lists who is due in September for late-summer planning, in their language', () => {
    const groups = dueGroups(contacts, BUILT_IN_TEMPLATES, [], settings, sept);
    expect(groups.map((g) => g.family.family)).toEqual(['planning']);
    const entries = groups[0].entries;
    expect(entries.map((e) => e.contact.id)).toEqual(['prospect-never', 'client-old']);
    expect(entries[0].template.language).toBe('fr');
    expect(entries[1].template.language).toBe('en');
  });

  it('flags contacts that already have an open draft for that template', () => {
    const drafts = [newDraft({ contactId: 'client-old', templateId: 'builtin-planning-en', language: 'en' })];
    const [group] = dueGroups(contacts, BUILT_IN_TEMPLATES, drafts, settings, sept);
    expect(group.entries.find((e) => e.contact.id === 'client-old')?.hasOpenDraft).toBe(true);
    const exported = [{ ...drafts[0], exportedAt: '2026-09-02T10:00:00Z' }];
    const [again] = dueGroups(contacts, BUILT_IN_TEMPLATES, exported, settings, sept);
    expect(again.entries.find((e) => e.contact.id === 'client-old')?.hasOpenDraft).toBe(false);
  });

  it('shows the holiday greeting to everyone in December', () => {
    const [group] = dueGroups(contacts, BUILT_IN_TEMPLATES, [], settings, new Date(2026, 11, 5));
    expect(group.family.family).toBe('holiday');
    expect(group.entries).toHaveLength(4);
  });

  it('lists upcoming scheduled templates, soonest first', () => {
    const next = upcoming(contacts, BUILT_IN_TEMPLATES, settings, sept);
    expect(next.map((u) => [u.family.family, u.month])).toEqual([
      ['holiday', 12],
      ['reengage', 2],
      ['spring-checkin', 4],
    ]);
  });
});
