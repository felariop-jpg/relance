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
