import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addContact, emptyContact, importContacts } from './contacts';
import type { ContactInput } from './schema';
import { buildContactsCsv, CONTACTS_CSV_HEADERS } from '../export/contactsCsv';
import { applyMapping, defaultTypeIndexes, parseCsvText, suggestMapping } from '../lib/csv';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

const person = (firstName: string, extra: Partial<ContactInput> = {}): ContactInput => ({
  ...emptyContact(),
  firstName,
  ...extra,
});

const byName = async (firstName: string) => (await db.contacts.where('firstName').equals(firstName).toArray())[0];

describe('Contact ID on import', () => {
  it('adds a contact with its ID (trimmed)', async () => {
    const result = await importContacts([person('Ann', { externalId: '  C-001 ', email: 'ann@example.com' })]);
    expect(result).toMatchObject({ added: 1, updated: 0, duplicates: 0 });
    expect((await byName('Ann')).externalId).toBe('C-001');
  });

  it('updates the contact with the same ID (case-insensitive) on re-import', async () => {
    await importContacts([person('Ann', { externalId: 'C-001', company: 'Old Co' })]);
    const before = await byName('Ann');
    await new Promise((r) => setTimeout(r, 5));
    const result = await importContacts([person('Ann', { externalId: 'c-001', company: 'New Co' })]);
    expect(result).toMatchObject({ added: 0, updated: 1, updatedIndexes: [0], duplicates: 0 });
    const after = await db.contacts.get(before.id);
    expect(after?.company).toBe('New Co');
    expect(after!.updatedAt > before.updatedAt).toBe(true);
    expect(await db.contacts.count()).toBe(1);
  });

  it('never erases stored values with blank cells', async () => {
    await importContacts([
      person('Ann', { externalId: 'C-001', notes: 'Likes long walks.', phone: '+00 111', country: 'FR', language: 'fr' }),
    ]);
    await importContacts([person('Ann', { externalId: 'C-001', company: 'Example Co' })]);
    expect(await byName('Ann')).toMatchObject({
      notes: 'Likes long walks.',
      phone: '+00 111',
      country: 'FR',
      language: 'fr',
      company: 'Example Co',
    });
  });

  it('keeps the later last-contacted date', async () => {
    await importContacts([person('Ann', { externalId: 'C-001', lastContacted: '2026-05-01' })]);
    const older = await importContacts([person('Ann', { externalId: 'C-001', lastContacted: '2026-01-01' })]);
    expect(older).toMatchObject({ updated: 0, unchanged: 1, unchangedIndexes: [0] });
    expect((await byName('Ann')).lastContacted).toBe('2026-05-01');
    await importContacts([person('Ann', { externalId: 'C-001', lastContacted: '2026-06-15' })]);
    expect((await byName('Ann')).lastContacted).toBe('2026-06-15');
  });

  it('keeps the stored type when the file has no type column', async () => {
    await importContacts([person('Ann', { externalId: 'C-001', contactType: 'prospect' })]);
    await importContacts([person('Ann', { externalId: 'C-001', contactType: 'client' })], { keepType: true });
    expect((await byName('Ann')).contactType).toBe('prospect');
    await importContacts([person('Ann', { externalId: 'C-001', contactType: 'lead' })]);
    expect((await byName('Ann')).contactType).toBe('lead');
  });

  it('keeps the stored type when a type cell is blank or unrecognised', async () => {
    await importContacts([person('Ann', { externalId: 'C-001', contactType: 'prospect' })]);
    const parsed = parseCsvText('Contact ID,First name,Type\nC-001,Ann,Partner\nC-002,Bo,\nC-003,Cy,lead\n', true);
    const mapped = applyMapping(parsed, suggestMapping(parsed.headers), { defaultType: 'client' });
    expect(defaultTypeIndexes(mapped)).toEqual([0, 1]);
    await importContacts(mapped.contacts, { keepType: defaultTypeIndexes(mapped) });
    // Ann keeps her stored type; new contacts still get the default.
    expect((await byName('Ann')).contactType).toBe('prospect');
    expect((await byName('Bo')).contactType).toBe('client');
    expect((await byName('Cy')).contactType).toBe('lead');
  });

  it('links a contact imported before IDs existed, by email', async () => {
    const id = await addContact(person('Ann', { email: 'ann@example.com', notes: 'Met at a fair.' }));
    const result = await importContacts([
      person('Ann', { externalId: 'C-001', email: 'ANN@example.com', company: 'Example Co' }),
    ]);
    expect(result).toMatchObject({ added: 0, updated: 1, duplicates: 0 });
    expect(await db.contacts.get(id)).toMatchObject({
      externalId: 'C-001',
      company: 'Example Co',
      notes: 'Met at a fair.',
    });
    expect(await db.contacts.count()).toBe(1);
  });

  it('skips a row whose email belongs to a contact with a different ID', async () => {
    await importContacts([
      person('Ann', { externalId: 'C-001', email: 'ann@example.com' }),
      person('Bo', { email: 'bo@example.com' }),
    ]);
    const result = await importContacts([
      person('Other', { externalId: 'C-002', email: 'ann@example.com' }),
      // The ID matches Ann, but the email is Bo's: never give two contacts one address.
      person('Ann', { externalId: 'C-001', email: 'bo@example.com' }),
    ]);
    expect(result).toMatchObject({ added: 0, updated: 0, duplicates: 2, duplicateIndexes: [0, 1] });
    expect((await byName('Ann')).email).toBe('ann@example.com');
    expect((await byName('Bo')).externalId).toBe('');
    expect(await db.contacts.count()).toBe(2);
  });

  it('skips the second row with the same ID in one file', async () => {
    const result = await importContacts([
      person('Ann', { externalId: 'C-001' }),
      person('Ann twin', { externalId: 'c-001' }),
    ]);
    expect(result).toMatchObject({ added: 1, duplicates: 1, duplicateIndexes: [1] });
    expect(await db.contacts.count()).toBe(1);
  });

  it('still skips rows without an ID whose email exists, and never overwrites', async () => {
    await importContacts([person('Ann', { externalId: 'C-001', email: 'ann@example.com', company: 'Kept' })]);
    const result = await importContacts([
      person('Ann', { email: 'ann@example.com', company: 'Ignored' }),
      person('No email'),
    ]);
    expect(result).toEqual({
      added: 1,
      updated: 0,
      updatedIndexes: [],
      unchanged: 0,
      unchangedIndexes: [],
      duplicates: 1,
      duplicateIndexes: [0],
    });
    expect((await byName('Ann')).company).toBe('Kept');
  });
});

describe('contacts CSV export', () => {
  it('maps every heading automatically', () => {
    const mapping = suggestMapping([...CONTACTS_CSV_HEADERS]);
    expect(mapping).not.toContain(null);
    expect(new Set(mapping).size).toBe(CONTACTS_CSV_HEADERS.length);
  });

  it('round-trips: export, edit in a spreadsheet, import updates instead of duplicating', async () => {
    await importContacts([
      person('Ann', {
        externalId: 'C-001',
        lastName: 'Martin',
        email: 'ann@example.com',
        phone: '+00 111',
        company: 'Example, Co',
        country: 'FR',
        language: 'fr',
        contactType: 'prospect',
        serviceHistory: 'Two workshops.',
        notes: 'Said "call me in spring".\nPrefers email.',
        whereMet: 'A trade fair',
        openThread: 'Asked for a quote',
        lastContacted: '2026-03-02',
      }),
      person('Bo', { email: 'bo@example.com' }),
    ]);
    const before = await db.contacts.orderBy('firstName').toArray();

    const csv = buildContactsCsv(before);
    expect(csv.split('\r\n')[0]).toBe(CONTACTS_CSV_HEADERS.join(','));

    const parsed = parseCsvText(csv, true);
    const mapping = suggestMapping(parsed.headers);
    const mapped = applyMapping(parsed, mapping, { defaultType: 'client' });
    const { externalId: _id, createdAt: _c, updatedAt: _u, id: _i, ...annFields } = before[0];
    expect(mapped.contacts[0]).toEqual({ ...annFields, externalId: 'C-001' });

    // Unchanged file: nothing added, nothing changed.
    const same = await importContacts(mapped.contacts, { keepType: defaultTypeIndexes(mapped) });
    expect(same).toMatchObject({ added: 0, updated: 0, unchanged: 1, duplicates: 1 });

    // Edited in the spreadsheet: the row updates Ann.
    parsed.rows[0][mapping.indexOf('company')] = 'Example SA';
    const edited = applyMapping(parsed, mapping, { defaultType: 'client' });
    const result = await importContacts(edited.contacts);
    expect(result).toMatchObject({ added: 0, updated: 1 });
    expect(await db.contacts.count()).toBe(2);
    expect((await db.contacts.get(before[0].id))?.company).toBe('Example SA');
  });
});
