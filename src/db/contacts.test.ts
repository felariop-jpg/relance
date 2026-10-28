import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  addContact,
  deleteContacts,
  emptyContact,
  importContacts,
  restoreContacts,
  purgeTrash,
  updateContact,
  validateContact,
} from './contacts';
import { ensureSettings, updateSettings } from './settings';
import { newDraft } from './drafts';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

const person = (firstName: string, email = '') => ({ ...emptyContact(), firstName, email });

describe('contacts', () => {
  it('adds a contact with trimmed fields and timestamps', async () => {
    const id = await addContact({ ...person('  Ann '), country: 'lu' });
    const stored = await db.contacts.get(id);
    expect(stored).toMatchObject({ firstName: 'Ann', country: 'LU', language: null });
    expect(stored?.createdAt).toBe(stored?.updatedAt);
  });

  it('updates a contact and bumps updatedAt', async () => {
    const id = await addContact(person('Ann'));
    const before = await db.contacts.get(id);
    await new Promise((r) => setTimeout(r, 5));
    await updateContact(id, { notes: ' New job ' });
    const after = await db.contacts.get(id);
    expect(after?.notes).toBe('New job');
    expect(after!.updatedAt > before!.updatedAt).toBe(true);
    expect(after?.createdAt).toBe(before?.createdAt);
  });

  it('deletes contacts together with their drafts', async () => {
    const keep = await addContact(person('Keep'));
    const drop = await addContact(person('Drop'));
    await db.drafts.bulkAdd([
      newDraft({ id: 'd1', contactId: keep, templateId: 't', language: 'en' }),
      newDraft({ id: 'd2', contactId: drop, templateId: 't', language: 'en' }),
    ]);
    const removed = await deleteContacts([drop]);
    expect((await db.contacts.toArray()).map((c) => c.firstName)).toEqual(['Keep']);
    expect((await db.drafts.toArray()).map((d) => d.id)).toEqual(['d1']);

    expect(await db.trash.count()).toBe(1);
    await restoreContacts(removed);
    expect(await db.trash.count()).toBe(0);
    expect(await db.contacts.count()).toBe(2);
    expect((await db.drafts.toArray()).map((d) => d.id).sort()).toEqual(['d1', 'd2']);
  });

  it('imports while skipping duplicate emails, case-insensitively', async () => {
    await addContact(person('Existing', 'ann@example.com'));
    const result = await importContacts([
      person('Ann again', 'ANN@example.com'),
      person('Bo', 'bo@example.com'),
      person('Bo twice', 'bo@example.com'),
      person('No email one'),
      person('No email two'),
    ]);
    expect(result).toEqual({
      added: 3,
      updated: 0,
      updatedIndexes: [],
      unchanged: 0,
      unchangedIndexes: [],
      duplicates: 2,
      duplicateIndexes: [0, 2],
    });
    expect(await db.contacts.count()).toBe(4);
  });

  it('validates first name and email format', () => {
    expect(validateContact(person(' '))).toEqual({ firstName: 'required' });
    expect(validateContact(person('Ann', 'not-an-email'))).toEqual({ email: 'invalid' });
    expect(validateContact(person('Ann', 'ann@example.com'))).toEqual({});
    expect(validateContact(person('Ann'))).toEqual({});
  });
});

describe('trash', () => {
  it('purges entries older than 30 days only', async () => {
    const old = await addContact(person('Old'));
    const recent = await addContact(person('Recent'));
    const a = await deleteContacts([old]);
    await db.trash.update(a.trashId, { deletedAt: '2020-01-01T00:00:00.000Z' });
    await deleteContacts([recent]);
    expect(await purgeTrash()).toBe(1);
    expect((await db.trash.toArray())[0].contacts[0].firstName).toBe('Recent');
  });
});

describe('settings', () => {
  it('creates defaults once and keeps later changes', async () => {
    const first = await ensureSettings();
    expect(first).toMatchObject({
      defaultLanguage: 'en',
      countryLanguageOverrides: {},
      withheldFields: [],
      firstRunDone: false,
    });
    await updateSettings({ senderName: 'Sam' });
    const again = await ensureSettings();
    expect(again.senderName).toBe('Sam');
    expect(await db.settings.count()).toBe(1);
  });
});

describe('drafts that need input', () => {
  it('an approved draft that gains a [PLACEHOLDER] goes back to review', async () => {
    const { editDraftText, setDraftStatus } = await import('./drafts');
    const id = await addContact(person('Ann'));
    const draft = newDraft({ contactId: id, templateId: 't', language: 'en', body: 'Hi' });
    await db.drafts.add(draft);
    await setDraftStatus([draft.id], 'approved');
    await editDraftText(draft.id, { body: 'Hi, the book is [TITLE OF THE BOOK].' });
    expect((await db.drafts.get(draft.id))?.status).toBe('edited');
    await setDraftStatus([draft.id], 'approved');
    await editDraftText(draft.id, { body: 'Hi, the book is Deep Work.' });
    expect((await db.drafts.get(draft.id))?.status).toBe('approved');
  });
});
