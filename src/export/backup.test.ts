import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { addContact, emptyContact } from '../db/contacts';
import { newDraft } from '../db/drafts';
import { defaultSettings, ensureSettings, getSettings, updateSettings } from '../db/settings';
import { ensureTemplatesSeeded } from '../db/templates';
import { createBackup, needsBackupReminder, parseBackup, restoreBackup } from './backup';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
  await ensureTemplatesSeeded();
});

describe('backup', () => {
  it('never includes the API key', async () => {
    await updateSettings({ apiKey: 'sk-ant-secret-value', senderName: 'Sam' });
    const text = JSON.stringify(await createBackup());
    expect(text).not.toContain('sk-ant-secret-value');
    expect(text).not.toContain('apiKey');
    expect(text).toContain('Sam');
  });

  it('round-trips through replace, keeping the current API key', async () => {
    const id = await addContact({ ...emptyContact(), firstName: 'Anne', email: 'anne@example.com' });
    await db.drafts.add(newDraft({ contactId: id, templateId: 't', language: 'fr', body: 'Bonjour' }));
    const text = JSON.stringify(await createBackup());

    await Promise.all([db.contacts.clear(), db.drafts.clear()]);
    await updateSettings({ apiKey: 'sk-ant-current' });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    await restoreBackup(parsed.backup, 'replace');

    expect((await db.contacts.toArray()).map((c) => c.firstName)).toEqual(['Anne']);
    expect((await db.drafts.toArray()).map((d) => d.body)).toEqual(['Bonjour']);
    expect(await db.templates.count()).toBe(10);
    expect((await getSettings()).apiKey).toBe('sk-ant-current');
  });

  it('merges without duplicating contacts that share an email', async () => {
    await addContact({ ...emptyContact(), firstName: 'Anne', email: 'anne@example.com' });
    const backup = await createBackup();
    backup.contacts.push({ ...backup.contacts[0], id: 'other-id', firstName: 'Anne copy' });
    backup.contacts.push({ ...backup.contacts[0], id: 'new-id', firstName: 'Bo', email: 'bo@example.com' });
    const result = await restoreBackup(backup, 'merge');
    expect(result.contacts).toBe(1);
    expect((await db.contacts.toArray()).map((c) => c.firstName).sort()).toEqual(['Anne', 'Bo']);
  });

  it('rejects files that are not Relance backups', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'notJson' });
    expect(parseBackup('{"hello":1}')).toEqual({ ok: false, error: 'notBackup' });
    expect(parseBackup('{"format":"relance-backup","version":99}')).toEqual({ ok: false, error: 'tooNew' });
  });
});

describe('backup reminder', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const s = defaultSettings('en');
  it('only nags above 50 contacts', () => {
    expect(needsBackupReminder(50, s, now)).toBe(false);
    expect(needsBackupReminder(51, s, now)).toBe(true);
  });
  it('respects a recent backup and a snooze', () => {
    expect(needsBackupReminder(80, { ...s, lastBackupAt: '2026-05-20T00:00:00Z' }, now)).toBe(false);
    expect(needsBackupReminder(80, { ...s, lastBackupAt: '2026-04-01T00:00:00Z' }, now)).toBe(true);
    expect(needsBackupReminder(80, { ...s, backupReminderSnoozedUntil: '2026-06-05T00:00:00Z' }, now)).toBe(false);
  });
});
