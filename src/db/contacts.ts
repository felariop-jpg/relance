import { db } from './db';
import type { Contact, ContactInput, Draft } from './schema';
import { requestPersistentStorage } from './storage';
import { isPlausibleDate } from '../lib/dates';

export function emptyContact(): ContactInput {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    country: '',
    language: null,
    contactType: 'client',
    serviceHistory: '',
    notes: '',
    whereMet: '',
    openThread: '',
    lastContacted: null,
    externalId: '',
  };
}

export function contactToInput(contact: Contact): ContactInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = contact;
  return input;
}

export function normalizeContact(input: ContactInput): ContactInput {
  return {
    ...input,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    company: input.company.trim(),
    country: input.country.trim().toUpperCase(),
    serviceHistory: input.serviceHistory.trim(),
    notes: input.notes.trim(),
    // Contacts saved before this field existed have no value.
    whereMet: (input.whereMet ?? '').trim(),
    openThread: (input.openThread ?? '').trim(),
    lastContacted: input.lastContacted || null,
    externalId: (input.externalId ?? '').trim(),
  };
}

export type ContactErrors = Partial<
  Record<'firstName' | 'email' | 'lastContacted', 'required' | 'invalid'>
>;

export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  if (!input.firstName.trim()) errors.firstName = 'required';
  const email = input.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'invalid';
  if (!isPlausibleDate(input.lastContacted)) errors.lastContacted = 'invalid';
  return errors;
}

function now(): string {
  return new Date().toISOString();
}

export async function addContact(input: ContactInput): Promise<string> {
  const stamp = now();
  const id = crypto.randomUUID();
  await db.contacts.add({ ...normalizeContact(input), id, createdAt: stamp, updatedAt: stamp });
  void requestPersistentStorage();
  return id;
}

/**
 * Writes only the fields given, never the whole record, inside one
 * transaction, so an edit made meanwhile in another tab (or by an export
 * marking "last contacted") is never overwritten. Returns false if the
 * contact no longer exists (for example, deleted in another tab).
 */
export async function updateContact(id: string, patch: Partial<ContactInput>): Promise<boolean> {
  return db.transaction('rw', db.contacts, async () => {
    const current = await db.contacts.get(id);
    if (!current) return false;
    const normalized = normalizeContact({ ...contactToInput(current), ...patch });
    const changes: Partial<Contact> = {};
    for (const key of Object.keys(patch) as (keyof ContactInput)[]) {
      (changes as Record<string, unknown>)[key] = normalized[key];
    }
    await db.contacts.update(id, { ...changes, updatedAt: now() });
    return true;
  });
}

/** The fields of `draft` that differ from `initial`, for saving a form without clobbering. */
export function changedFields(initial: ContactInput, draft: ContactInput): Partial<ContactInput> {
  const a = normalizeContact(initial);
  const b = normalizeContact(draft);
  const out: Partial<ContactInput> = {};
  for (const key of Object.keys(b) as (keyof ContactInput)[]) {
    if (a[key] !== b[key]) (out as Record<string, unknown>)[key] = draft[key];
  }
  return out;
}

/** Everything removed by a delete, also kept in the shared trash for 30 days. */
export interface DeletedContacts {
  trashId: string;
  contacts: Contact[];
  drafts: Draft[];
}

/**
 * Deletes contacts and their drafts, and files them in "Recently deleted" in
 * the same transaction. Every tab can see and restore that entry, so a delete
 * made in one tab is never unrecoverable from another.
 */
export async function deleteContacts(ids: string[]): Promise<DeletedContacts> {
  const trashId = crypto.randomUUID();
  if (ids.length === 0) return { trashId, contacts: [], drafts: [] };
  return db.transaction('rw', db.contacts, db.drafts, db.trash, async () => {
    const contacts = (await db.contacts.bulkGet(ids)).filter((c): c is Contact => Boolean(c));
    const drafts = await db.drafts.where('contactId').anyOf(ids).toArray();
    if (contacts.length > 0) {
      await db.trash.add({ id: trashId, deletedAt: now(), contacts, drafts });
    }
    await db.drafts.bulkDelete(drafts.map((d) => d.id));
    await db.contacts.bulkDelete(contacts.map((c) => c.id));
    return { trashId, contacts, drafts };
  });
}

/**
 * Puts a trash entry back. Only adds records that are missing, so nothing
 * created or edited since is overwritten. Safe to run twice or from two tabs.
 */
export async function restoreFromTrash(trashId: string): Promise<{ contacts: number; drafts: number }> {
  return db.transaction('rw', db.contacts, db.drafts, db.trash, async () => {
    const entry = await db.trash.get(trashId);
    if (!entry) return { contacts: 0, drafts: 0 };
    const haveContacts = new Set(
      (await db.contacts.bulkGet(entry.contacts.map((c) => c.id))).filter(Boolean).map((c) => c!.id),
    );
    const haveDrafts = new Set(
      (await db.drafts.bulkGet(entry.drafts.map((d) => d.id))).filter(Boolean).map((d) => d!.id),
    );
    const contacts = entry.contacts.filter((c) => !haveContacts.has(c.id));
    const drafts = entry.drafts.filter((d) => !haveDrafts.has(d.id));
    await db.contacts.bulkAdd(contacts);
    await db.drafts.bulkAdd(drafts);
    await db.trash.delete(trashId);
    return { contacts: contacts.length, drafts: drafts.length };
  });
}

/** Undo for a delete: same as restoring its trash entry. */
export async function restoreContacts(deleted: DeletedContacts): Promise<void> {
  await restoreFromTrash(deleted.trashId);
}

export const TRASH_DAYS = 30;

/** Permanently removes trash entries older than 30 days. Called at start-up. */
export async function purgeTrash(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_DAYS * 86_400_000).toISOString();
  return db.trash.where('deletedAt').below(cutoff).delete();
}

export interface ImportResult {
  added: number;
  /** Existing contacts (matched by Contact ID, or linked by email) that got new values. */
  updated: number;
  /** Positions (in the input array) of the rows that updated a contact. */
  updatedIndexes: number[];
  /** Rows that matched an existing contact but had nothing new in them. */
  unchanged: number;
  unchangedIndexes: number[];
  /** Skipped because of the same email address or Contact ID. */
  duplicates: number;
  /** Positions (in the input array) of the rows skipped as duplicates. */
  duplicateIndexes: number[];
}

export interface ImportOptions {
  /**
   * Rows whose type is only the default (no type column, or a blank or
   * unrecognised cell): updates keep the stored type. true = every row.
   */
  keepType?: boolean | number[];
}

/**
 * The fields of `row` worth writing onto `current`: non-empty cells only, so a
 * blank never erases what is stored, and the later last-contacted date.
 */
function importPatch(current: Contact, row: ContactInput, keepType: boolean): Partial<ContactInput> {
  const patch: Partial<ContactInput> = {};
  for (const key of Object.keys(row) as (keyof ContactInput)[]) {
    const value = row[key];
    if (value === '' || value === null || value === current[key]) continue;
    if (key === 'contactType' && keepType) continue;
    if (key === 'lastContacted' && current.lastContacted && (value as string) <= current.lastContacted) continue;
    (patch as Record<string, unknown>)[key] = value;
  }
  return patch;
}

/**
 * Adds and updates contacts from an imported file, in one transaction.
 *
 * - A row whose Contact ID matches a contact (case-insensitive) updates it.
 * - A row with a new Contact ID whose email belongs to a contact with no ID
 *   links to that contact (sets the ID) and updates it.
 * - A row whose email belongs to a contact with another ID, or that repeats a
 *   Contact ID seen earlier in the file, is skipped as a duplicate.
 * - A row with no Contact ID is added unless its email (case-insensitive)
 *   already exists; it never overwrites anything.
 *
 * Updates write only the changed fields (see importPatch), never whole records.
 */
export async function importContacts(inputs: ContactInput[], options: ImportOptions = {}): Promise<ImportResult> {
  const result = await db.transaction('rw', db.contacts, async () => {
    const byId = new Map<string, Contact>();
    const byEmail = new Map<string, Contact>();
    const index = (c: Contact) => {
      if (c.externalId) byId.set(c.externalId.toLowerCase(), c);
      if (c.email) byEmail.set(c.email.toLowerCase(), c);
    };
    (await db.contacts.toArray()).forEach(index);

    const stamp = now();
    const toAdd: Contact[] = [];
    const updates: { id: string; changes: Partial<Contact> }[] = [];
    const seenIds = new Set<string>();
    const keepTypeAt = new Set(Array.isArray(options.keepType) ? options.keepType : []);
    const updatedIndexes: number[] = [];
    const unchangedIndexes: number[] = [];
    const duplicateIndexes: number[] = [];

    inputs.forEach((raw, i) => {
      const input = normalizeContact(raw);
      const idKey = input.externalId.toLowerCase();
      const emailKey = input.email.toLowerCase();
      const emailOwner = emailKey ? byEmail.get(emailKey) : undefined;

      if (!idKey) {
        if (emailOwner) {
          duplicateIndexes.push(i);
          return;
        }
        const added = { ...input, id: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp };
        toAdd.push(added);
        index(added);
        return;
      }

      if (seenIds.has(idKey)) {
        duplicateIndexes.push(i);
        return;
      }
      seenIds.add(idKey);

      const target = byId.get(idKey) ?? (emailOwner && !emailOwner.externalId ? emailOwner : undefined);
      if (!target) {
        if (emailOwner) {
          duplicateIndexes.push(i);
          return;
        }
        const added = { ...input, id: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp };
        toAdd.push(added);
        index(added);
        return;
      }
      // The ID matches, but the email is someone else's: don't give two contacts one address.
      if (emailOwner && emailOwner !== target) {
        duplicateIndexes.push(i);
        return;
      }

      const patch = importPatch(target, input, options.keepType === true || keepTypeAt.has(i));
      if (Object.keys(patch).length === 0) {
        unchangedIndexes.push(i);
        return;
      }
      const updatedContact = { ...target, ...patch };
      if (target.email && updatedContact.email !== target.email) byEmail.delete(target.email.toLowerCase());
      index(updatedContact);
      updates.push({ id: target.id, changes: { ...patch, updatedAt: stamp } });
      updatedIndexes.push(i);
    });

    await db.contacts.bulkAdd(toAdd);
    for (const { id, changes } of updates) await db.contacts.update(id, changes);
    return {
      added: toAdd.length,
      updated: updatedIndexes.length,
      updatedIndexes,
      unchanged: unchangedIndexes.length,
      unchangedIndexes,
      duplicates: duplicateIndexes.length,
      duplicateIndexes,
    };
  });
  if (result.added > 0) void requestPersistentStorage();
  return result;
}
