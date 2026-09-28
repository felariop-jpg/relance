import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { addContact, emptyContact } from '../db/contacts';
import { ensureSettings, getSettings, updateSettings } from '../db/settings';
import { ensureTemplatesSeeded } from '../db/templates';
import { compareVoice } from './compare';
import type { Send } from './engine';
import type { DraftRequest } from './prompt';

const usage = { inputTokens: 1000, outputTokens: 200 };
const reply = (text: string) => ({
  toolInput: { subject: 'Hi', body: `Hello {{firstName}},\n\n${text}\n\n{{signature}}`, language: 'en', personalizationUsed: 'No source: none.' },
  usage,
});

async function setup() {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
  await ensureTemplatesSeeded();
  await updateSettings({ apiKey: 'sk-test', signature: 'Sam', voiceSamples: ['Hi there! Cheers, Sam', '  '] });
  const id = await addContact({ ...emptyContact(), firstName: 'Ann', lastName: 'Secret', country: 'GB', notes: 'New role.' });
  const contact = (await db.contacts.get(id))!;
  const template = (await db.templates.toArray()).find((t) => t.family === 'spring-checkin' && t.language === 'en')!;
  return { contact, template };
}


beforeEach(async () => {
  await db.drafts.clear();
});

describe('compareVoice', () => {
  it('writes the same email with and without the samples, and nothing else differs', async () => {
    const { contact, template } = await setup();
    const requests: DraftRequest[] = [];
    const send: Send = async (request) => {
      requests.push(request);
      return reply(JSON.stringify(request).includes('Cheers, Sam') ? 'Hi there!' : 'Hello.');
    };
    const result = await compareVoice(contact, template, { send, sleep: async () => {}, today: '2026-09-28' });

    expect(result.withSamples).toMatchObject({ ok: true, body: 'Hello Ann,\n\nHi there!\n\nSam' });
    expect(result.withoutSamples).toMatchObject({ ok: true, body: 'Hello Ann,\n\nHello.\n\nSam' });
    const [a, b] = [JSON.parse(result.withSamples.payloadJson), JSON.parse(result.withoutSamples.payloadJson)];
    expect(JSON.stringify(a)).toContain('Cheers, Sam');
    expect(JSON.stringify(b)).not.toContain('Cheers, Sam');
    expect(a.system).toEqual(b.system);
    expect(JSON.stringify(a)).not.toContain('Secret');
    expect(requests).toHaveLength(2);
    // Not saved as drafts, but counted in the running total.
    expect(await db.drafts.count()).toBe(0);
    expect((await getSettings()).costTotalEur).toBeCloseTo(result.totalEur);
    expect(result.totalEur).toBeGreaterThan(0);
  });

  it('keeps one side when the other fails', async () => {
    const { contact, template } = await setup();
    let calls = 0;
    const send: Send = async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error('bad key'), { status: 401 });
      return reply('Fine.');
    };
    const result = await compareVoice(contact, template, { send, sleep: async () => {} });
    const sides = [result.withSamples, result.withoutSamples];
    expect(sides.filter((s) => s.ok)).toHaveLength(1);
    expect(sides.find((s) => !s.ok)).toMatchObject({ code: 'auth', costEur: 0 });
  });
});
