import { z } from 'zod';
import { db } from '../db/db';
import { newDraft } from '../db/drafts';
import { emptyContact } from '../db/contacts';
import {
  API_FIELDS,
  CONTACT_TYPES,
  DRAFT_ERROR_CODES,
  DRAFT_STATUSES,
  GATE_FIELDS,
  LANGUAGES,
  SENDER_GENDERS,
  TOUR_STATES,
  SETTINGS_ID,
  type Contact,
  type Draft,
  type Settings,
  type Template,
} from '../db/schema';
import { defaultSettings, getSettings } from '../db/settings';

export const BACKUP_FORMAT = 'relance-backup';
export const BACKUP_VERSION = 1;

const str = z.string().catch('');
const lang = z.enum(LANGUAGES);
const isoOrNull = z.string().nullable().catch(null);

const contactSchema = z
  .object({
    id: z.string().min(1),
    firstName: z.string().min(1),
    lastName: str,
    email: str,
    phone: str,
    company: str,
    country: str,
    language: lang.nullable().catch(null),
    contactType: z.enum(CONTACT_TYPES).catch('client'),
    serviceHistory: str,
    notes: str,
    whereMet: str,
    openThread: str,
    lastContacted: isoOrNull,
    externalId: str,
    createdAt: str,
    updatedAt: str,
  })
  .transform((c): Contact => ({ ...emptyContact(), ...c }));

const draftSchema = z
  .object({
    id: z.string().min(1),
    contactId: z.string().min(1),
    templateId: str,
    subject: str,
    body: str,
    language: lang.catch('en'),
    personalizationUsed: str,
    status: z.enum(DRAFT_STATUSES).catch('generated'),
    source: z.enum(['ai', 'demo', 'template']).catch('template'),
    notesAvailable: z.boolean().catch(true),
    payloadJson: z.string().nullable().catch(null),
    usage: z
      .object({ inputTokens: z.number(), outputTokens: z.number() })
      .nullable()
      .catch(null),
    costEur: z.number().catch(0),
    error: z
      .object({ code: z.enum(DRAFT_ERROR_CODES), detail: str })
      .nullable()
      .catch(null),
    instruction: str,
    exportedAt: isoOrNull,
    createdAt: str,
    updatedAt: str,
  })
  .transform((d): Draft => newDraft(d));

const templateSchema = z
  .object({
  id: z.string().min(1),
  family: z.string().min(1),
  name: str,
  language: lang,
  subject: str,
  body: str,
  purpose: str,
  instructions: str,
  scheduleRule: z
    .object({ month: z.number().int().min(1).max(12), minGapDays: z.number().int().min(0) })
    .nullable()
    .catch(null),
  appliesTo: z.array(z.enum(CONTACT_TYPES)).catch([]),
  requiresAnyOf: z.array(z.enum(GATE_FIELDS)).optional(),
  // Backups made before requiresAnyOf existed.
  requiresWhereMet: z.boolean().optional(),
  isBuiltIn: z.boolean().catch(false),
})
  .transform(({ requiresWhereMet, requiresAnyOf, ...t }): Template => ({
    ...t,
    requiresAnyOf: requiresAnyOf ?? (requiresWhereMet ? ['whereMet'] : []),
  }));

const settingsSchema = z
  .object({
    signature: str,
    calendlyLink: str,
    senderName: str,
    uiLanguage: lang.catch('en'),
    defaultLanguage: lang.catch('en'),
    countryLanguageOverrides: z.record(z.string(), lang).catch({}),
    withheldFields: z.array(z.enum(API_FIELDS)).catch([]),
    voiceSamples: z.array(z.string()).catch([]),
    senderGender: z.enum(SENDER_GENDERS).catch('unspecified'),
    costTotalEur: z.number().catch(0),
    costSince: str,
    lastBackupAt: isoOrNull,
    backupReminderSnoozedUntil: isoOrNull,
    templatesSeeded: z.boolean().catch(true),
    firstRunDone: z.boolean().catch(true),
    tourState: z.enum(TOUR_STATES).catch('finished'),
  })
  .partial();

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int(),
  exportedAt: z.string(),
  contacts: z.array(contactSchema),
  drafts: z.array(draftSchema),
  templates: z.array(templateSchema),
  settings: settingsSchema,
});

export type Backup = z.infer<typeof backupSchema>;

/** Everything except the API key, which stays only in this browser. */
export async function createBackup(): Promise<Backup> {
  const [contacts, drafts, templates, settings] = await Promise.all([
    db.contacts.toArray(),
    db.drafts.toArray(),
    db.templates.toArray(),
    getSettings(),
  ]);
  const { apiKey: _apiKey, id: _id, ...rest } = settings;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    contacts,
    drafts,
    templates,
    settings: rest,
  };
}

export type BackupError = 'notJson' | 'notBackup' | 'tooNew';

export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: BackupError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notJson' };
  }
  const version = (raw as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version > BACKUP_VERSION) return { ok: false, error: 'tooNew' };
  const parsed = backupSchema.safeParse(raw);
  return parsed.success ? { ok: true, backup: parsed.data } : { ok: false, error: 'notBackup' };
}

export interface RestoreResult {
  contacts: number;
  drafts: number;
  templates: number;
}

/**
 * replace: this browser's data becomes the backup (API key kept).
 * merge: adds what is missing; for records in both, the most recently
 * updated wins. A contact whose email already exists under another id is
 * skipped. Current settings are kept.
 */
export async function restoreBackup(backup: Backup, mode: 'merge' | 'replace'): Promise<RestoreResult> {
  return db.transaction('rw', [db.contacts, db.drafts, db.templates, db.settings], async () => {
    if (mode === 'replace') {
      const current = await getSettings();
      await Promise.all([db.contacts.clear(), db.drafts.clear(), db.templates.clear()]);
      await db.contacts.bulkAdd(backup.contacts);
      await db.drafts.bulkAdd(backup.drafts);
      await db.templates.bulkAdd(backup.templates);
      const settings: Settings = {
        ...defaultSettings(current.uiLanguage),
        ...backup.settings,
        id: SETTINGS_ID,
        apiKey: current.apiKey,
      };
      await db.settings.put(settings);
      return {
        contacts: backup.contacts.length,
        drafts: backup.drafts.length,
        templates: backup.templates.length,
      };
    }

    const existingContacts = new Map((await db.contacts.toArray()).map((c) => [c.id, c]));
    const emails = new Set(
      [...existingContacts.values()].map((c) => c.email.toLowerCase()).filter(Boolean),
    );
    const contacts = backup.contacts.filter((c) => {
      const mine = existingContacts.get(c.id);
      if (mine) return c.updatedAt > mine.updatedAt;
      if (c.email && emails.has(c.email.toLowerCase())) return false;
      if (c.email) emails.add(c.email.toLowerCase());
      return true;
    });
    const knownContactIds = new Set([...existingContacts.keys(), ...contacts.map((c) => c.id)]);
    const existingDrafts = new Map((await db.drafts.toArray()).map((d) => [d.id, d]));
    const drafts = backup.drafts.filter((d) => {
      if (!knownContactIds.has(d.contactId)) return false;
      const mine = existingDrafts.get(d.id);
      return !mine || d.updatedAt > mine.updatedAt;
    });
    const existingTemplates = new Set((await db.templates.toArray()).map((t) => t.id));
    const templates = backup.templates.filter((t) => !existingTemplates.has(t.id));
    await db.contacts.bulkPut(contacts);
    await db.drafts.bulkPut(drafts);
    await db.templates.bulkPut(templates);
    return { contacts: contacts.length, drafts: drafts.length, templates: templates.length };
  });
}

/**
 * Undoes a restore record by record: puts back every record as it was before,
 * and removes only records the restore itself added. Anything created in the
 * meantime (for example in another tab) is left alone.
 */
export async function undoRestore(before: Backup, restored: Backup): Promise<void> {
  const current = await getSettings();
  await db.transaction('rw', [db.contacts, db.drafts, db.templates, db.settings], async () => {
    const tables = [
      [db.contacts, before.contacts, restored.contacts],
      [db.drafts, before.drafts, restored.drafts],
      [db.templates, before.templates, restored.templates],
    ] as const;
    for (const [table, was, added] of tables) {
      const keep = new Set(was.map((r) => r.id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (table as any).bulkDelete(added.map((r) => r.id).filter((id) => !keep.has(id)));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (table as any).bulkPut(was);
    }
    await db.settings.put({ ...defaultSettings(current.uiLanguage), ...before.settings, id: SETTINGS_ID, apiKey: current.apiKey });
  });
}

export function backupFileName(today: string): string {
  return `relance-backup-${today}.json`;
}

const DAY = 86_400_000;
export const BACKUP_REMINDER_CONTACTS = 50;
export const BACKUP_REMINDER_DAYS = 30;
export const BACKUP_SNOOZE_DAYS = 7;

/** More than 50 contacts and no backup in 30 days (and not snoozed). */
export function needsBackupReminder(contactCount: number, settings: Settings, now = new Date()): boolean {
  if (contactCount <= BACKUP_REMINDER_CONTACTS) return false;
  if (settings.backupReminderSnoozedUntil && new Date(settings.backupReminderSnoozedUntil) > now) return false;
  if (!settings.lastBackupAt) return true;
  return now.getTime() - new Date(settings.lastBackupAt).getTime() > BACKUP_REMINDER_DAYS * DAY;
}

export function snoozeUntil(now = new Date()): string {
  return new Date(now.getTime() + BACKUP_SNOOZE_DAYS * DAY).toISOString();
}
