import { db } from './db';
import type { Contact, Draft, DraftStatus, Settings } from './schema';
import { pickVersion, type TemplateFamily } from './templates';
import { resolveLanguage } from '../lib/language';
import { fillPlaceholders, placeholderValues } from '../lib/placeholders';

export function newDraft(
  fields: Pick<Draft, 'contactId' | 'templateId' | 'language'> & Partial<Draft>,
): Draft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    subject: '',
    body: '',
    personalizationUsed: '',
    status: 'generated',
    source: 'template',
    notesAvailable: true,
    payloadJson: null,
    usage: null,
    costEur: 0,
    error: null,
    instruction: '',
    exportedAt: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/** Drafts that use the template text as-is, placeholders filled locally. No AI. */
export async function createTemplateDrafts(
  contacts: Contact[],
  family: TemplateFamily,
  settings: Settings,
): Promise<Draft[]> {
  const drafts = contacts.flatMap((contact) => {
    const language = resolveLanguage(contact, settings);
    const template = pickVersion(family, language);
    if (!template) return [];
    const values = placeholderValues(contact, settings);
    return [
      newDraft({
        contactId: contact.id,
        templateId: template.id,
        language: template.language,
        subject: fillPlaceholders(template.subject, values),
        body: fillPlaceholders(template.body, values),
        source: 'template',
        notesAvailable: Boolean(contact.notes.trim()),
      }),
    ];
  });
  await db.drafts.bulkAdd(drafts);
  return drafts;
}

export async function updateDraft(id: string, patch: Partial<Draft>): Promise<void> {
  await db.drafts.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

/** Saves typed changes; a freshly generated draft becomes "edited". */
export async function editDraftText(
  id: string,
  patch: Partial<Pick<Draft, 'subject' | 'body'>>,
): Promise<void> {
  const draft = await db.drafts.get(id);
  if (!draft) return;
  const status: DraftStatus = draft.status === 'generated' ? 'edited' : draft.status;
  await updateDraft(id, { ...patch, status });
}

export async function setDraftStatus(ids: string[], status: DraftStatus): Promise<void> {
  const now = new Date().toISOString();
  await db.drafts.where('id').anyOf(ids).modify({ status, updatedAt: now });
}

export async function deleteDrafts(ids: string[]): Promise<Draft[]> {
  return db.transaction('rw', db.drafts, async () => {
    const drafts = (await db.drafts.bulkGet(ids)).filter((d): d is Draft => Boolean(d));
    await db.drafts.bulkDelete(ids);
    return drafts;
  });
}

export async function restoreDrafts(drafts: Draft[]): Promise<void> {
  await db.drafts.bulkPut(drafts);
}

/** A reload interrupts generation; those cards become retryable errors. */
export async function markInterruptedDrafts(): Promise<void> {
  await db.drafts
    .where('status')
    .equals('pending')
    .modify({ status: 'failed', error: { code: 'interrupted', detail: '' } });
}

/** Records the export and, if asked, marks the contacts as contacted today. */
export async function markExported(
  drafts: Draft[],
  options: { markContacted: boolean; today: string },
): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', db.drafts, db.contacts, async () => {
    await db.drafts
      .where('id')
      .anyOf(drafts.map((d) => d.id))
      .modify({ exportedAt: now, updatedAt: now });
    if (options.markContacted) {
      await db.contacts
        .where('id')
        .anyOf(drafts.map((d) => d.contactId))
        .modify({ lastContacted: options.today, updatedAt: now });
    }
  });
}
