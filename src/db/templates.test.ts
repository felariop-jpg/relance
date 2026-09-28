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
