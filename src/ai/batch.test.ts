import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { addContact, emptyContact } from '../db/contacts';
import { ensureSettings, getSettings, updateSettings } from '../db/settings';
import { ensureTemplatesSeeded, groupFamilies } from '../db/templates';
import { enqueueDrafts, getBatchState, resetBatch, setBatchDeps } from './batch';
import type { Connectivity, Send } from './engine';
import { createPendingDrafts, generateDraft } from './generate';

const good = (language: string) => ({
  subject: 'Hi',
  body: 'Hello {{firstName}} {{lastName}},\n\nBest,\n{{signature}}',
  language,
  personalizationUsed: 'Their new role.',
});
const usage = { inputTokens: 1000, outputTokens: 200 };

async function setup(n: number) {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
  await ensureTemplatesSeeded();
  await updateSettings({ apiKey: 'sk-test', signature: 'Sam', senderName: 'Sam' });
  for (let i = 0; i < n; i++) {
    await addContact({ ...emptyContact(), firstName: `P${i}`, lastName: `Last${i}`, country: 'GB', notes: 'New role.' });
  }
  const family = groupFamilies(await db.templates.toArray(), 'en').find((f) => f.family === 'spring-checkin')!;
  return createPendingDrafts(await db.contacts.orderBy('firstName').toArray(), family, await getSettings());
}

async function settled() {
  for (let i = 0; i < 200 && getBatchState().running; i++) await new Promise((r) => setTimeout(r, 5));
}

beforeEach(() => resetBatch());

describe('generateDraft', () => {
  it('saves the draft with placeholders filled locally, the payload and the cost', async () => {
    const [draft] = await setup(1);
    const send: Send = async () => ({ toolInput: good('en'), usage });
    const outcome = await generateDraft(draft.id, { send, sleep: async () => {} });
    expect(outcome.ok).toBe(true);
    const saved = (await db.drafts.get(draft.id))!;
    expect(saved.body).toBe('Hello P0 Last0,\n\nBest,\nSam');
    expect(saved.status).toBe('generated');
    expect(saved.source).toBe('ai');
    expect(JSON.parse(saved.payloadJson!).model).toBe('claude-sonnet-5');
    expect(saved.payloadJson).not.toContain('Last0');
    expect(saved.costEur).toBeGreaterThan(0);
    expect((await getSettings()).costTotalEur).toBeCloseTo(saved.costEur);
  });

  it('uses the demo fixture when there is no API key, without any network call', async () => {
    const [draft] = await setup(1);
    await updateSettings({ apiKey: '' });
    const outcome = await generateDraft(draft.id, { sleep: async () => {}, demoDelayMs: 0 });
    expect(outcome).toEqual({ ok: true, costEur: 0 });
    const saved = (await db.drafts.get(draft.id))!;
    expect(saved.source).toBe('demo');
    expect(saved.body).toContain('Hello P0');
    expect(saved.payloadJson).toBeTruthy();
  });
});

describe('batch', () => {
  it('keeps going when one draft fails, and loses nothing', async () => {
    const drafts = await setup(6);
    setBatchDeps({
      sleep: async () => {},
      connectivity: { isOnline: () => true, waitForOnline: async () => {} },
      send: async (req) => {
        // P2's requests keep failing on the network, past all three retries.
        if (JSON.parse(req.messages[0].content).contact.firstName === 'P2') {
          throw Object.assign(new Error('socket hang up'), { name: 'APIConnectionError' });
        }
        return { toolInput: good('en'), usage };
      },
    });
    enqueueDrafts(drafts.map((d) => d.id));
    await settled();
    const saved = await db.drafts.toArray();
    expect(saved.filter((d) => d.status === 'generated')).toHaveLength(5);
    const failed = saved.filter((d) => d.status === 'failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].error?.code).toBe('network');
    expect(getBatchState()).toMatchObject({ running: false, total: 6, done: 5, failed: 1 });
  });

  it('marks malformed replies on their own card only', async () => {
    const drafts = await setup(3);
    const bad = drafts[1].contactId;
    setBatchDeps({
      sleep: async () => {},
      send: async (req) => {
        const isBad = JSON.parse(req.messages[0].content).contact.firstName === 'P1';
        return { toolInput: isBad ? { subject: 42 } : good('en'), usage };
      },
    });
    enqueueDrafts(drafts.map((d) => d.id));
    await settled();
    const saved = await db.drafts.toArray();
    expect(saved.find((d) => d.contactId === bad)?.error?.code).toBe('malformed');
    expect(saved.filter((d) => d.status === 'generated')).toHaveLength(2);
  });

  it('stops calling the API after a rejected key, keeping finished drafts', async () => {
    const drafts = await setup(8);
    let calls = 0;
    setBatchDeps({
      sleep: async () => {},
      send: async () => {
        calls++;
        if (calls >= 2) throw Object.assign(new Error('invalid x-api-key'), { status: 401 });
        return { toolInput: good('en'), usage };
      },
    });
    enqueueDrafts(drafts.map((d) => d.id));
    await settled();
    const saved = await db.drafts.toArray();
    expect(saved.filter((d) => d.status === 'generated')).toHaveLength(1);
    expect(saved.filter((d) => d.error?.code === 'auth')).toHaveLength(7);
    expect(calls).toBeLessThanOrEqual(4); // only calls already in flight
    expect(getBatchState().authFailed).toBe(true);
  });

  it('pauses while offline and finishes every draft after reconnecting', async () => {
    const drafts = await setup(5);
    let online = false;
    const waiters: (() => void)[] = [];
    const connectivity: Connectivity = {
      isOnline: () => online,
      waitForOnline: () => (online ? Promise.resolve() : new Promise<void>((r) => waiters.push(r))),
    };
    let calls = 0;
    setBatchDeps({
      sleep: async () => {},
      connectivity,
      send: async () => {
        calls++;
        return { toolInput: good('en'), usage };
      },
    });
    enqueueDrafts(drafts.map((d) => d.id));
    await new Promise((r) => setTimeout(r, 20));
    expect(getBatchState()).toMatchObject({ running: true, offline: true, failed: 0 });
    expect(calls).toBe(0);
    expect((await db.drafts.toArray()).every((d) => d.status === 'pending')).toBe(true);

    online = true;
    waiters.splice(0).forEach((resume) => resume());
    await settled();
    expect(getBatchState()).toMatchObject({ running: false, offline: false, done: 5, failed: 0 });
    expect((await db.drafts.toArray()).every((d) => d.status === 'generated')).toBe(true);
  });

  it('a connection that drops mid-batch recovers within the retries', async () => {
    const drafts = await setup(4);
    let call = 0;
    setBatchDeps({
      sleep: async () => {},
      connectivity: { isOnline: () => true, waitForOnline: async () => {} },
      send: async () => {
        call++;
        if (call === 2 || call === 3) throw new Error('Request timed out.');
        return { toolInput: good('en'), usage };
      },
    });
    enqueueDrafts(drafts.map((d) => d.id));
    await settled();
    expect(getBatchState()).toMatchObject({ done: 4, failed: 0 });
  });
});
