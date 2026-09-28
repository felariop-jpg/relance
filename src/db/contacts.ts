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
    lastContacted: null,
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
    lastContacted: input.lastContacted || null,
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

export async function updateContact(id: string, patch: Partial<ContactInput>): Promise<void> {
  const current = await db.contacts.get(id);
  if (!current) return;
  const next = normalizeContact({ ...contactToInput(current), ...patch });
  await db.contacts.update(id, { ...next, updatedAt: now() });
}

/** Everything removed by a delete, kept in memory so it can be undone. */
export interface DeletedContacts {
  contacts: Contact[];
  drafts: Draft[];
}

/** Deletes contacts and every draft written for them; returns what was removed. */
export async function deleteContacts(ids: string[]): Promise<DeletedContacts> {
  if (ids.length === 0) return { contacts: [], drafts: [] };
  return db.transaction('rw', db.contacts, db.drafts, async () => {
    const contacts = (await db.contacts.bulkGet(ids)).filter((c): c is Contact => Boolean(c));
    const drafts = await db.drafts.where('contactId').anyOf(ids).toArray();
    await db.drafts.bulkDelete(drafts.map((d) => d.id));
    await db.contacts.bulkDelete(ids);
    return { contacts, drafts };
  });
}

/** Puts deleted contacts and their drafts back exactly as they were. */
export async function restoreContacts(deleted: DeletedContacts): Promise<void> {
  await db.transaction('rw', db.contacts, db.drafts, async () => {
    await db.contacts.bulkPut(deleted.contacts);
    await db.drafts.bulkPut(deleted.drafts);
  });
}

export interface ImportResult {
  added: number;
  /** Skipped because a contact with the same email already exists. */
  duplicates: number;
  /** Positions (in the input array) of the rows skipped as duplicates. */
  duplicateIndexes: number[];
}

/**
 * Adds contacts, skipping any whose email (case-insensitive) matches an
 * existing contact or an earlier row. Never merges or overwrites.
 */
export async function importContacts(inputs: ContactInput[]): Promise<ImportResult> {
  const result = await db.transaction('rw', db.contacts, async () => {
    const existing = await db.contacts.toArray();
    const seen = new Set(existing.map((c) => c.email.toLowerCase()).filter(Boolean));
    const stamp = now();
    const toAdd: Contact[] = [];
    const duplicateIndexes: number[] = [];
    inputs.forEach((raw, index) => {
      const input = normalizeContact(raw);
      const key = input.email.toLowerCase();
      if (key && seen.has(key)) {
        duplicateIndexes.push(index);
        return;
      }
      if (key) seen.add(key);
      toAdd.push({ ...input, id: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp });
    });
    await db.contacts.bulkAdd(toAdd);
    return { added: toAdd.length, duplicates: duplicateIndexes.length, duplicateIndexes };
  });
  if (result.added > 0) void requestPersistentStorage();
  return result;
}
