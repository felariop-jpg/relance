/**
 * Two tabs = two connections to the same IndexedDB database. "Tab A" uses the
 * app's own functions (the singleton `db`); "tab B" is a second Dexie
 * connection doing the same kind of writes another tab would. Writes are
 * interleaved; nothing either tab wrote may be lost.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, RelanceDB } from './db';
import {
  addContact,
  changedFields,
  contactToInput,
  deleteContacts,
  emptyContact,
  importContacts,
  restoreFromTrash,
  updateContact,
} from './contacts';
import { newDraft } from './drafts';
import { SETTINGS_ID, type Contact, type ContactInput } from './schema';
import { ensureSettings, getSettings, modifySettings } from './settings';
import { createBackup, restoreBackup, undoRestore } from '../export/backup';
import { loadSampleContacts } from '../lib/sample';
import { clearTourLeftovers } from '../tour/tourState';

const tabB = new RelanceDB('relance');
const person = (firstName: string, extra: Partial<ContactInput> = {}) => ({ ...emptyContact(), firstName, ...extra });
const jitter = () => new Promise((r) => setTimeout(r, Math.random() * 4));
const stamp = () => new Date().toISOString();

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
});
afterAll(() => tabB.close());

describe('two tabs writing at the same time', () => {
  it('interleaved adds, imports, edits and deletes lose nothing', async () => {
    // Tab A imports 40; tab B adds 40 one by one, at the same time.
    const tabBAdds = Array.from({ length: 40 }, (_, i) => async () => {
      await jitter();
      const now = stamp();
      await tabB.contacts.add({ ...person(`B${i}`), id: `b-${i}`, createdAt: now, updatedAt: now } as Contact);
    });
    await Promise.all([
      importContacts(Array.from({ length: 40 }, (_, i) => person(`A${i}`, { email: `a${i}@example.com` }))),
      ...tabBAdds.map((f) => f()),
    ]);
    expect(await db.contacts.count()).toBe(80);

    // Both tabs edit the SAME records, different fields, interleaved.
    const shared = (await db.contacts.where('firstName').startsWith('B').toArray()).slice(0, 20);
    await Promise.all(
      shared.flatMap((c) => [
        (async () => {
          await jitter();
          await updateContact(c.id, { notes: `notes from A ${c.id}` });
        })(),
        (async () => {
          await jitter();
          await tabB.contacts.update(c.id, { company: `company from B ${c.id}`, updatedAt: stamp() });
        })(),
      ]),
    );
    for (const c of await db.contacts.bulkGet(shared.map((s) => s.id))) {
      expect(c?.notes).toBe(`notes from A ${c!.id}`);
      expect(c?.company).toBe(`company from B ${c!.id}`);
    }

    // Tab B deletes 5 while tab A edits 5 others: exactly those 5 go.
    const all = await db.contacts.toArray();
    const toDelete = all.slice(0, 5).map((c) => c.id);
    await Promise.all([
      tabB.contacts.bulkDelete(toDelete),
      ...all.slice(5, 10).map((c) => updateContact(c.id, { phone: '+00 000' })),
    ]);
    expect(await db.contacts.count()).toBe(75);
  });

  it('saving an old form keeps what another tab changed meanwhile', async () => {
    const id = await addContact(person('Ann', { notes: 'Original' }));
    const opened = contactToInput((await db.contacts.get(id))!); // form opens in tab A
    await tabB.contacts.update(id, { lastContacted: '2026-09-01', notes: 'Updated in B', updatedAt: stamp() });
    // Tab A changes only the company and saves.
    const saved = await updateContact(id, changedFields(opened, { ...opened, company: 'New Co' }));
    expect(saved).toBe(true);
    const after = (await db.contacts.get(id))!;
    expect(after).toMatchObject({ company: 'New Co', lastContacted: '2026-09-01', notes: 'Updated in B' });
  });

  it('saving a contact that another tab deleted reports it instead of failing silently', async () => {
    const id = await addContact(person('Gone'));
    await tabB.contacts.delete(id);
    expect(await updateContact(id, { notes: 'x' })).toBe(false);
  });

  it('a delete in one tab can be restored from the other, with drafts, only once', async () => {
    const ids = [];
    for (let i = 0; i < 12; i++) ids.push(await addContact(person(`P${i}`)));
    await db.drafts.add(newDraft({ contactId: ids[0], templateId: 't', language: 'en', body: 'Hi' }));

    await deleteContacts(ids); // tab A deletes everything
    expect(await tabB.contacts.count()).toBe(0);

    const [entry] = await tabB.trash.toArray(); // tab B sees the trash entry
    expect(entry.contacts).toHaveLength(12);
    // Both tabs press Restore at the same moment.
    await Promise.all([restoreFromTrash(entry.id), restoreFromTrash(entry.id)]);
    expect(await db.contacts.count()).toBe(12);
    expect(await db.drafts.count()).toBe(1);
    expect(await db.trash.count()).toBe(0);
  });

  it('restoring never overwrites a record that exists again', async () => {
    const id = await addContact(person('Ann', { notes: 'v1' }));
    const removed = await deleteContacts([id]);
    const now = stamp();
    await tabB.contacts.add({ ...person('Ann', { notes: 'v2 re-added' }), id, createdAt: now, updatedAt: now } as Contact);
    await restoreFromTrash(removed.trashId);
    expect((await db.contacts.get(id))?.notes).toBe('v2 re-added');
  });

  it('undoing a backup restore keeps contacts another tab added meanwhile', async () => {
    await addContact(person('Before', { email: 'before@example.com' }));
    const backup = await createBackup();
    backup.contacts = [{ ...backup.contacts[0], id: 'from-backup', firstName: 'FromBackup', email: 'fb@example.com' }];
    const before = await createBackup();
    await restoreBackup(backup, 'replace'); // tab A replaces everything
    const now = stamp();
    await tabB.contacts.add({ ...person('AddedInB'), id: 'b-new', createdAt: now, updatedAt: now } as Contact);
    await undoRestore(before, backup); // tab A undoes
    const names = (await db.contacts.toArray()).map((c) => c.firstName).sort();
    expect(names).toEqual(['AddedInB', 'Before']);
  });

  it('clearing the tour sample contacts keeps what another tab added meanwhile, and undo never duplicates', async () => {
    await loadSampleContacts(new Date(2026, 8, 28));
    const now = stamp();
    const [, undo] = await Promise.all([
      tabB.contacts.add({ ...person('Own', { email: 'own@company.test' }), id: 'own', createdAt: now, updatedAt: now }),
      clearTourLeftovers([]),
    ]);
    expect((await db.contacts.toArray()).map((c) => c.id)).toEqual(['own']);
    // Undo twice (two tabs' toasts): the samples come back once.
    await Promise.all([undo(), undo()]);
    expect(await db.contacts.count()).toBe(13);
  });

  it('two tabs adding different country overrides keep both', async () => {
    await Promise.all([
      modifySettings((s) => {
        s.countryLanguageOverrides = { ...s.countryLanguageOverrides, LU: 'fr' };
      }),
      jitter().then(() =>
        tabB.settings
          .where('id')
          .equals(SETTINGS_ID)
          .modify((s) => {
            s.countryLanguageOverrides = { ...s.countryLanguageOverrides, BE: 'fr' };
          }),
      ),
      modifySettings((s) => {
        s.withheldFields = [...s.withheldFields, 'company'];
      }),
    ]);
    const settings = await getSettings();
    expect(settings.countryLanguageOverrides).toEqual({ LU: 'fr', BE: 'fr' });
    expect(settings.withheldFields).toEqual(['company']);
  });
});
