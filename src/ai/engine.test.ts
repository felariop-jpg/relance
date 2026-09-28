import { describe, expect, it } from 'vitest';
import { emptyContact } from '../db/contacts';
import { defaultSettings } from '../db/settings';
import { BUILT_IN_TEMPLATES } from '../db/seed';
import {
  classifyError,
  GenerationError,
  generateWithRetries,
  MAX_BUSY_RETRIES,
  MAX_NETWORK_RETRIES,
  type Connectivity,
  type Send,
} from './engine';
import { buildRequest } from './prompt';

const request = buildRequest({
  contact: { ...emptyContact(), id: 'c', firstName: 'Anne', createdAt: '', updatedAt: '' },
  template: BUILT_IN_TEMPLATES[0],
  settings: defaultSettings('en'),
});
const good = { subject: 'Hello', body: 'Hello Anne,\n\n{{signature}}', language: 'en', personalizationUsed: 'No notes.' };
const usage = { inputTokens: 100, outputTokens: 20 };

function scripted(steps: (unknown | Error)[]): Send & { calls: number } {
  const send = (async () => {
    const step = steps[send.calls++];
    if (step instanceof Error || (step as { status?: number })?.status) throw step;
    return { toolInput: step, usage };
  }) as unknown as Send & { calls: number };
  send.calls = 0;
  return send;
}

const apiError = (status: number, message = '', headers: Record<string, string> = {}) =>
  Object.assign(new Error(message), { status, headers });
const noSleep = async () => {};

describe('generateWithRetries', () => {
  it('returns a valid draft and its usage', async () => {
    const result = await generateWithRetries(request, 'en', scripted([good]), { sleep: noSleep });
    expect(result.output.subject).toBe('Hello');
    expect(result.usage).toEqual(usage);
  });

  it('retries once on a malformed reply, counting both calls', async () => {
    const send = scripted([{ subject: '' }, good]);
    const result = await generateWithRetries(request, 'en', send, { sleep: noSleep });
    expect(send.calls).toBe(2);
    expect(result.usage).toEqual({ inputTokens: 200, outputTokens: 40 });
  });

  it('gives up after a second malformed reply', async () => {
    const send = scripted([{ nope: 1 }, 'not even an object']);
    await expect(generateWithRetries(request, 'en', send, { sleep: noSleep })).rejects.toMatchObject({ code: 'malformed' });
    expect(send.calls).toBe(2);
  });

  it('treats a reply in the wrong language as malformed', async () => {
    const send = scripted([{ ...good, language: 'fr' }, { ...good, language: 'fr' }]);
    await expect(generateWithRetries(request, 'en', send, { sleep: noSleep })).rejects.toMatchObject({ code: 'malformed' });
  });

  it('backs off and retries on 429, honouring Retry-After', async () => {
    const waits: number[] = [];
    const send = scripted([apiError(429, 'rate limited', { 'retry-after': '3' }), apiError(529), good]);
    const result = await generateWithRetries(request, 'en', send, { sleep: async (ms) => void waits.push(ms) });
    expect(result.output.subject).toBe('Hello');
    expect(waits[0]).toBeGreaterThanOrEqual(3000);
    expect(waits[0]).toBeLessThan(3500);
    expect(waits).toHaveLength(2);
  });

  it('surfaces a rate limit after the retries run out', async () => {
    const send = scripted(Array.from({ length: MAX_BUSY_RETRIES + 1 }, () => apiError(429)));
    await expect(generateWithRetries(request, 'en', send, { sleep: noSleep })).rejects.toMatchObject({ code: 'rate_limit' });
    expect(send.calls).toBe(MAX_BUSY_RETRIES + 1);
  });

  it('fails fast on a bad key', async () => {
    const send = scripted([apiError(401, 'invalid x-api-key'), good]);
    await expect(generateWithRetries(request, 'en', send, { sleep: noSleep })).rejects.toMatchObject({ code: 'auth' });
    expect(send.calls).toBe(1);
  });
});

describe('classifyError', () => {
  it.each([
    [apiError(401), 'auth'],
    [apiError(403), 'auth'],
    [apiError(429), 'rate_limit'],
    [apiError(529), 'overloaded'],
    [apiError(500), 'overloaded'],
    [apiError(400, 'Your credit balance is too low'), 'billing'],
    [apiError(400, 'bad request'), 'unknown'],
    [new TypeError('Failed to fetch'), 'network'],
    [Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' }), 'network'],
    [new Error('Request timed out.'), 'network'], // the SDK's APIConnectionTimeoutError
    [Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } }), 'network'],
    [Object.assign(new Error('boom'), { cause: { code: 'ENOTFOUND' } }), 'network'],
  ])('%s → %s', (error, code) => {
    expect(classifyError(error).code).toBe(code);
  });

  it('passes GenerationErrors through', () => {
    const e = new GenerationError('malformed', 'x');
    expect(classifyError(e)).toBe(e);
  });
});

describe('network failures', () => {
  const timeout = () => new Error('Request timed out.');
  const online: Connectivity = { isOnline: () => true, waitForOnline: async () => {} };

  it('retries a timeout or reset up to three times with growing waits', async () => {
    const waits: number[] = [];
    const send = scripted([timeout(), Object.assign(new Error('x'), { cause: { code: 'ECONNRESET' } }), timeout(), good]);
    const result = await generateWithRetries(request, 'en', send, { sleep: async (ms) => void waits.push(ms), connectivity: online });
    expect(result.output.subject).toBe('Hello');
    expect(send.calls).toBe(MAX_NETWORK_RETRIES + 1);
    expect(waits).toHaveLength(3);
    expect(waits[1]).toBeGreaterThan(waits[0]);
    expect(waits[2]).toBeGreaterThan(waits[1]);
  });

  it('marks the draft failed as a network problem after the third retry', async () => {
    const send = scripted(Array.from({ length: MAX_NETWORK_RETRIES + 1 }, timeout));
    await expect(generateWithRetries(request, 'en', send, { sleep: noSleep, connectivity: online })).rejects.toMatchObject({
      code: 'network',
    });
    expect(send.calls).toBe(MAX_NETWORK_RETRIES + 1);
  });

  it('while offline, waits for the connection instead of using up retries', async () => {
    let isOnline = false;
    let reconnect!: () => void;
    const connectivity: Connectivity = {
      isOnline: () => isOnline,
      waitForOnline: () => new Promise<void>((resolve) => (reconnect = () => ((isOnline = true), resolve()))),
    };
    const offlineStates: boolean[] = [];
    // Five failures in a row while offline would exceed the retry limit if they counted.
    const send = scripted([timeout(), timeout(), good]);
    const pending = generateWithRetries(request, 'en', send, {
      sleep: noSleep,
      connectivity,
      onOffline: (o) => offlineStates.push(o),
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(offlineStates).toEqual([true]);
    expect(send.calls).toBe(1); // paused, not hammering
    reconnect();
    const result = await pending;
    expect(result.output.subject).toBe('Hello');
    expect(offlineStates).toEqual([true, false]);
  });

  it('never retries a rejected key', async () => {
    const send = scripted([apiError(401), good]);
    await expect(generateWithRetries(request, 'en', send, { sleep: noSleep, connectivity: online })).rejects.toMatchObject({ code: 'auth' });
    expect(send.calls).toBe(1);
  });
});
