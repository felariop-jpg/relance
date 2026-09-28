import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { addContact, emptyContact } from '../db/contacts';
import { ensureSettings, getSettings, updateSettings } from '../db/settings';
import { ensureTemplatesSeeded } from '../db/templates';
import { newDraft } from '../db/drafts';
import { loadSampleContacts } from '../lib/sample';
import { backward, clearTourLeftovers, endTour, forward, goTo, startTour, tourSnapshot, writeExampleDrafts } from './tourState';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
  await ensureTemplatesSeeded();
});

const stepIds = () => tourSnapshot().steps.map((s) => s.id);

describe('guided tour', () => {
  it('opens with the sample-contacts offer only when there are no contacts', async () => {
    await startTour();
    expect(stepIds()).toEqual(['sample', 'contacts', 'due', 'generate', 'review', 'export']);
    expect(tourSnapshot()).toMatchObject({ active: true, index: 0 });
    expect((await getSettings()).tourState).toBe('started');

    await addContact({ ...emptyContact(), firstName: 'Ann' });
    await startTour();
    expect(stepIds()).toEqual(['contacts', 'due', 'generate', 'review', 'export']);
  });

  it('moves between steps within bounds', async () => {
    await startTour();
    goTo(2);
    expect(tourSnapshot().index).toBe(2);
    goTo(99);
    expect(tourSnapshot().index).toBe(2);
  });

  it('shows both parts of the review step before moving on, and back again', async () => {
    await addContact({ ...emptyContact(), firstName: 'Ann' });
    await startTour();
    const review = stepIds().indexOf('review');
    goTo(review);
    forward();
    expect(tourSnapshot()).toMatchObject({ index: review, part: 1 });
    forward();
    expect(tourSnapshot()).toMatchObject({ index: review + 1, part: 0 });
    backward();
    expect(tourSnapshot()).toMatchObject({ index: review, part: 1 });
    backward();
    backward();
    expect(tourSnapshot()).toMatchObject({ index: review - 1, part: 0 });
  });

  it('remembers skipping and finishing', async () => {
    await startTour();
    await endTour('skipped');
    expect(tourSnapshot().active).toBe(false);
    expect((await getSettings()).tourState).toBe('skipped');
    await startTour();
    await endTour('finished');
    expect((await getSettings()).tourState).toBe('finished');
  });

  it('writes free example drafts, even with an API key, preferring the sample contacts', async () => {
    await updateSettings({ apiKey: 'sk-ant-test' });
    await loadSampleContacts(new Date(2026, 8, 28));
    await addContact({ ...emptyContact(), firstName: 'Real', email: 'real@company.test', notes: 'Something.' });
    const ids = await writeExampleDrafts();
    expect(ids).toHaveLength(3);
    const drafts = await db.drafts.bulkGet(ids);
    for (const d of drafts) expect(d).toMatchObject({ source: 'demo', status: 'generated', costEur: 0 });
    const contacts = await db.contacts.bulkGet(drafts.map((d) => d!.contactId));
    expect(contacts.every((c) => /@example\.(com|net|org)$/.test(c!.email))).toBe(true);
    expect((await getSettings()).costTotalEur).toBe(0);
  });

  it('clears the sample contacts and example drafts, never the user\'s own, and can undo it', async () => {
    await loadSampleContacts(new Date(2026, 8, 28));
    const ownId = await addContact({ ...emptyContact(), firstName: 'Real', email: 'real@company.test', notes: 'Met in Lyon.' });
    // Examples for everyone, including the user's own contact...
    const examples = await writeExampleDrafts(13);
    const ownExample = (await db.drafts.bulkGet(examples)).find((d) => d!.contactId === ownId)!;
    // ...and a draft the user wrote themselves, which must survive.
    const mine = newDraft({ contactId: ownId, templateId: ownExample.templateId, language: 'en', status: 'approved' });
    await db.drafts.add(mine);

    const undo = await clearTourLeftovers(examples);
    expect((await db.contacts.toArray()).map((c) => c.id)).toEqual([ownId]);
    expect((await db.drafts.toArray()).map((d) => d.id)).toEqual([mine.id]);

    // Made-up data doesn't clutter Recently deleted.
    expect(await db.trash.count()).toBe(0);

    await undo();
    expect(await db.contacts.count()).toBe(13);
    expect(await db.drafts.get(ownExample.id)).toBeDefined();
  });
});
