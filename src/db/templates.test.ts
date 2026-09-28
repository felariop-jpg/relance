import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { BUILT_IN_TEMPLATES } from './seed';
import { ensureSettings } from './settings';
import { ensureTemplatesSeeded, groupFamilies, pickVersion, restoreBuiltInTemplates } from './templates';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
});

describe('templates', () => {
  it('seeds the built-ins once, and never brings back ones the user deleted', async () => {
    await ensureTemplatesSeeded();
    expect(await db.templates.count()).toBe(BUILT_IN_TEMPLATES.length);
    await db.templates.delete('builtin-holiday-en');
    await ensureTemplatesSeeded();
    expect(await db.templates.get('builtin-holiday-en')).toBeUndefined();
  });

  it('restores only missing built-ins and keeps edits', async () => {
    await ensureTemplatesSeeded();
    await db.templates.update('builtin-spring-checkin-en', { subject: 'Edited' });
    await db.templates.bulkDelete(['builtin-holiday-en', 'builtin-holiday-fr']);
    expect(await restoreBuiltInTemplates()).toBe(2);
    expect((await db.templates.get('builtin-spring-checkin-en'))?.subject).toBe('Edited');
    expect(await restoreBuiltInTemplates()).toBe(0);
  });

  it('groups by family and falls back to the other language', () => {
    const families = groupFamilies(BUILT_IN_TEMPLATES.filter((t) => t.id !== 'builtin-reengage-fr'), 'fr');
    const reengage = families.find((f) => f.family === 'reengage')!;
    expect(reengage.name).toBe('Re-engagement');
    expect(pickVersion(reengage, 'fr')?.language).toBe('en');
    expect(families.find((f) => f.family === 'holiday')!.name).toBe('Vœux de fin d’année');
  });
});

describe('schema upgrade (v3 schedule migration)', () => {
  it('moves unchanged built-in schedules to the new default months, and leaves edits alone', async () => {
    const { default: Dexie } = await import('dexie');
    const name = 'relance-upgrade-test';
    const v1 = new Dexie(name);
    v1.version(1).stores({ contacts: 'id', drafts: 'id', templates: 'id, family, language, isBuiltIn', settings: 'id' });
    await v1.table('templates').bulkAdd([
      { id: 'builtin-planning-en', family: 'planning', isBuiltIn: true, scheduleRule: { month: 9, minGapDays: 60 } },
      { id: 'builtin-holiday-fr', family: 'holiday', isBuiltIn: true, scheduleRule: { month: 12, minGapDays: 0 } },
      { id: 'builtin-planning-fr', family: 'planning', isBuiltIn: true, scheduleRule: { month: 10, minGapDays: 30 } },
    ]);
    v1.close();
    const { RelanceDB } = await import('./db');
    const v2 = new RelanceDB(name);
    const rows = Object.fromEntries((await v2.templates.toArray()).map((t) => [t.id, t.scheduleRule]));
    expect(rows['builtin-planning-en']).toEqual({ month: 8, minGapDays: 60 });
    expect(rows['builtin-holiday-fr']).toEqual({ month: 11, minGapDays: 0 });
    expect(rows['builtin-planning-fr']).toEqual({ month: 10, minGapDays: 30 }); // edited by the user: kept
    v2.close();
  });

  it('also runs for a browser that was already on v2', async () => {
    const { default: Dexie } = await import('dexie');
    const name = 'relance-upgrade-from-v2';
    const old = new Dexie(name);
    old.version(1).stores({ contacts: 'id', drafts: 'id', templates: 'id, family, language, isBuiltIn', settings: 'id' });
    old.version(2).stores({ trash: 'id, deletedAt' });
    await old.table('templates').add({ id: 'builtin-holiday-en', family: 'holiday', isBuiltIn: true, scheduleRule: { month: 12, minGapDays: 0 } });
    old.close();
    const { RelanceDB } = await import('./db');
    const current = new RelanceDB(name);
    expect((await current.templates.get('builtin-holiday-en'))?.scheduleRule).toEqual({ month: 11, minGapDays: 0 });
    current.close();
  });
});

describe('templates that need "where you met"', () => {
  it('only the post-event built-ins require it, and only contacts with a value can use them', async () => {
    const { canUseTemplate } = await import('./templates');
    const needWhereMetOnly = BUILT_IN_TEMPLATES.filter((t) => t.requiresAnyOf.join() === 'whereMet').map((t) => t.family);
    expect([...new Set(needWhereMetOnly)]).toEqual(['post-event']);
    const tpl = BUILT_IN_TEMPLATES.find((t) => t.family === 'post-event')!;
    expect(canUseTemplate(tpl, { whereMet: '' })).toBe(false);
    expect(canUseTemplate(tpl, { whereMet: '  ' })).toBe(false);
    expect(canUseTemplate(tpl, { whereMet: 'Lyon trade fair' })).toBe(true);
    expect(canUseTemplate(BUILT_IN_TEMPLATES[0], {})).toBe(true);
  });

  it('every built-in states a distinct purpose', () => {
    const en = BUILT_IN_TEMPLATES.filter((t) => t.language === 'en').map((t) => t.purpose);
    expect(en.every((p) => p.length > 30)).toBe(true);
    expect(new Set(en).size).toBe(en.length);
  });

  it('the v4 upgrade gives old contacts an empty "where you met" and old templates their purpose', async () => {
    const { default: Dexie } = await import('dexie');
    const name = 'relance-upgrade-v4';
    const old = new Dexie(name);
    old.version(1).stores({ contacts: 'id', drafts: 'id', templates: 'id, family, language, isBuiltIn', settings: 'id' });
    old.version(2).stores({ trash: 'id, deletedAt' });
    old.version(3).stores({});
    await old.table('contacts').add({ id: 'c1', firstName: 'Old' });
    await old.table('templates').add({ id: 'builtin-post-event-en', family: 'post-event', isBuiltIn: true, scheduleRule: null });
    old.close();
    const { RelanceDB } = await import('./db');
    const db4 = new RelanceDB(name);
    expect((await db4.contacts.get('c1'))?.whereMet).toBe('');
    const t = await db4.templates.get('builtin-post-event-en');
    expect(t?.requiresAnyOf).toEqual(['whereMet']);
    expect(t).not.toHaveProperty('requiresWhereMet');
    expect(t?.purpose).toContain('whereMet');
    db4.close();
  });
});

describe('write dialog data layer', () => {
  it('skips contacts that cannot use the template', async () => {
    const { addContact, emptyContact } = await import('./contacts');
    const { createTemplateDrafts } = await import('./drafts');
    const { getSettings } = await import('./settings');
    await ensureTemplatesSeeded();
    await addContact({ ...emptyContact(), firstName: 'NoEvent' });
    await addContact({ ...emptyContact(), firstName: 'MetAtFair', whereMet: 'Lyon fair' });
    const family = groupFamilies(await db.templates.toArray(), 'en').find((f) => f.family === 'post-event')!;
    const drafts = await createTemplateDrafts(await db.contacts.toArray(), family, await getSettings());
    expect(drafts).toHaveLength(1);
    expect((await db.contacts.get(drafts[0].contactId))?.firstName).toBe('MetAtFair');
  });
});

describe('schema v5', () => {
  it('replaces unedited old built-in briefs with the new ones and keeps edited ones', async () => {
    const { default: Dexie } = await import('dexie');
    const { PREVIOUS_BUILT_IN_INSTRUCTIONS } = await import('./migrations/previous-briefs');
    const name = 'relance-upgrade-v5';
    const old = new Dexie(name);
    old.version(1).stores({ contacts: 'id', drafts: 'id', templates: 'id, family, language, isBuiltIn', settings: 'id' });
    old.version(2).stores({ trash: 'id, deletedAt' });
    old.version(3).stores({});
    old.version(4).stores({});
    await old.table('templates').bulkAdd([
      { id: 'builtin-holiday-en', family: 'holiday', isBuiltIn: true, instructions: PREVIOUS_BUILT_IN_INSTRUCTIONS['builtin-holiday-en'] },
      { id: 'builtin-holiday-fr', family: 'holiday', isBuiltIn: true, instructions: 'Mes propres consignes.' },
    ]);
    old.close();
    const { RelanceDB } = await import('./db');
    const db5 = new RelanceDB(name);
    expect((await db5.templates.get('builtin-holiday-en'))?.instructions).toMatch(/^Must achieve:/);
    expect((await db5.templates.get('builtin-holiday-fr'))?.instructions).toBe('Mes propres consignes.');
    db5.close();
  });
});

describe('re-engagement needs something to re-engage about', () => {
  it('is unavailable for a contact with only a bare note, and available with work history, a meeting place or something left open', async () => {
    const { canUseTemplate } = await import('./templates');
    const reengage = BUILT_IN_TEMPLATES.find((t) => t.family === 'reengage' && t.language === 'fr')!;
    expect(canUseTemplate(reengage, { serviceHistory: '', whereMet: '', openThread: '' })).toBe(false); // fx-08: "Aime le vélo"
    expect(canUseTemplate(reengage, { serviceHistory: 'Workshop in 2024.' })).toBe(true);
    expect(canUseTemplate(reengage, { whereMet: 'Lyon fair' })).toBe(true);
    expect(canUseTemplate(reengage, { openThread: 'Asked about remote-only teams.' })).toBe(true);
  });

  it('ignores a field the user withholds from the AI', async () => {
    const { canUseTemplate } = await import('./templates');
    const reengage = BUILT_IN_TEMPLATES.find((t) => t.family === 'reengage')!;
    expect(canUseTemplate(reengage, { serviceHistory: 'Workshop.' }, ['serviceHistory'])).toBe(false);
  });

  it('the v6 upgrade turns the old flag into the new list and gates re-engagement', async () => {
    const { default: Dexie } = await import('dexie');
    const name = 'relance-upgrade-v6';
    const old = new Dexie(name);
    old.version(1).stores({ contacts: 'id', drafts: 'id', templates: 'id, family, language, isBuiltIn', settings: 'id' });
    old.version(2).stores({ trash: 'id, deletedAt' });
    for (const v of [3, 4, 5]) old.version(v).stores({});
    await old.table('templates').bulkAdd([
      { id: 'builtin-reengage-en', family: 'reengage', isBuiltIn: true, requiresWhereMet: false },
      { id: 'custom-1-en', family: 'custom-1', isBuiltIn: false, requiresWhereMet: true },
    ]);
    await old.table('contacts').add({ id: 'c', firstName: 'X', whereMet: '' });
    old.close();
    const { RelanceDB } = await import('./db');
    const db6 = new RelanceDB(name);
    expect((await db6.templates.get('builtin-reengage-en'))?.requiresAnyOf).toEqual(['openThread', 'serviceHistory', 'whereMet']);
    expect((await db6.templates.get('custom-1-en'))?.requiresAnyOf).toEqual(['whereMet']);
    expect((await db6.contacts.get('c'))?.openThread).toBe('');
    db6.close();
  });
});
