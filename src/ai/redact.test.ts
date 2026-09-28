import { describe, expect, it } from 'vitest';
import { emptyContact } from '../db/contacts';
import { API_FIELDS, type Contact } from '../db/schema';
import { defaultSettings } from '../db/settings';
import { BUILT_IN_TEMPLATES } from '../db/seed';
import { buildRequest } from './prompt';
import { notesAvailable, redactForApi } from './redact';

// Values that must never appear anywhere in what is sent.
const SECRET = {
  lastName: 'SENTINEL-LASTNAME',
  email: 'sentinel.email@private.invalid',
  phone: '+00 SENTINEL 0000',
};

function sensitiveContact(overrides: Partial<Contact> = {}): Contact {
  return {
    ...emptyContact(),
    id: 'SENTINEL-ID',
    firstName: 'Anne',
    company: 'Exemple SARL',
    country: 'FR',
    notes: 'Started a new role in March.',
    serviceHistory: 'Workshop in 2024.',
    createdAt: 'SENTINEL-CREATED',
    updatedAt: 'SENTINEL-UPDATED',
    lastContacted: '1999-12-31',
    ...SECRET,
    ...overrides,
  };
}

const settings = defaultSettings('en');

describe('redactForApi', () => {
  it('sends only allowlisted fields', () => {
    const payload = redactForApi(sensitiveContact(), settings);
    expect(Object.keys(payload).sort()).toEqual([...API_FIELDS].sort());
  });

  it('never includes last name, email or phone', () => {
    const json = JSON.stringify(redactForApi(sensitiveContact(), settings));
    for (const value of Object.values(SECRET)) expect(json).not.toContain(value);
    expect(json).not.toMatch(/lastName|email|phone/);
  });

  it('never includes ids, timestamps or the last-contacted date', () => {
    const json = JSON.stringify(redactForApi(sensitiveContact(), settings));
    expect(json).not.toContain('SENTINEL');
    expect(json).not.toContain('1999-12-31');
  });

  it('withholds a field added to the schema in future (opt-in, not opt-out)', () => {
    const future = { ...sensitiveContact(), healthStatus: 'SENTINEL-FUTURE', mobile: 'SENTINEL-MOBILE' } as Contact;
    const json = JSON.stringify(redactForApi(future, settings));
    expect(json).not.toContain('SENTINEL-FUTURE');
    expect(json).not.toContain('SENTINEL-MOBILE');
  });

  it('withholds every non-allowlisted key, whatever its value', () => {
    const contact = sensitiveContact();
    const allowed = new Set<string>(API_FIELDS);
    const poisoned = { ...contact } as Record<string, unknown>;
    for (const key of Object.keys(contact)) if (!allowed.has(key)) poisoned[key] = `POISON-${key}`;
    expect(JSON.stringify(redactForApi(poisoned as unknown as Contact, settings))).not.toContain('POISON');
  });

  it('drops fields the user chose to withhold', () => {
    const payload = redactForApi(sensitiveContact(), { ...settings, withheldFields: ['notes', 'company'] });
    expect(payload).not.toHaveProperty('notes');
    expect(payload).not.toHaveProperty('company');
    expect(JSON.stringify(payload)).not.toContain('Started a new role');
  });

  it('sends the resolved language, never null', () => {
    expect(redactForApi(sensitiveContact({ language: null, country: 'FR' }), settings).language).toBe('fr');
    expect(redactForApi(sensitiveContact({ language: null, country: 'LU' }), settings).language).toBe('en');
  });
});

describe('notesAvailable', () => {
  it('is false when notes are empty or withheld', () => {
    expect(notesAvailable(sensitiveContact(), settings)).toBe(true);
    expect(notesAvailable(sensitiveContact({ notes: '   ' }), settings)).toBe(false);
    expect(notesAvailable(sensitiveContact(), { withheldFields: ['notes'] })).toBe(false);
  });
});

describe('the full API request', () => {
  const template = BUILT_IN_TEMPLATES[0];
  const privateSettings = {
    ...settings,
    apiKey: 'sk-ant-SENTINEL-KEY',
    signature: 'SENTINEL-SIGNATURE',
    calendlyLink: 'https://SENTINEL-CALENDLY.invalid',
    senderName: 'SENTINEL-SENDER',
  };

  it('contains none of the private contact fields or the sender details', () => {
    const json = JSON.stringify(buildRequest({ today: '2026-09-28', contact: sensitiveContact(), template, settings: privateSettings }));
    for (const value of Object.values(SECRET)) expect(json).not.toContain(value);
    expect(json).not.toContain('SENTINEL');
  });

  it('tells the model when notes are unavailable', () => {
    const request = buildRequest({ today: '2026-09-28', contact: sensitiveContact({ notes: '' }), template, settings });
    expect(JSON.parse(request.messages[0].content).notesAvailable).toBe(false);
  });

  it('includes voice samples and an extra instruction only when present', () => {
    const plain = JSON.parse(buildRequest({ today: '2026-09-28', contact: sensitiveContact(), template, settings }).messages[0].content);
    expect(plain).not.toHaveProperty('voiceSamples');
    expect(plain).not.toHaveProperty('extraInstruction');
    const withExtras = JSON.parse(
      buildRequest({ today: '2026-09-28',
        contact: sensitiveContact(),
        template,
        settings: { ...settings, voiceSamples: ['Hi there, Sam', '  '] },
        instruction: ' shorter ',
      }).messages[0].content,
    );
    expect(withExtras.voiceSamples).toEqual(['Hi there, Sam']);
    expect(withExtras.extraInstruction).toBe('shorter');
  });

  it('forces the save_draft tool', () => {
    const request = buildRequest({ today: '2026-09-28', contact: sensitiveContact(), template, settings });
    expect(request.tool_choice).toEqual({ type: 'tool', name: 'save_draft' });
    expect(request.model).toBe('claude-sonnet-5');
  });
});

describe('the payload panel', () => {
  it('shows the message (contact data) first and keeps every field', async () => {
    const { readablePayload } = await import('../screens/review/PayloadPanel');
    const request = buildRequest({ today: '2026-09-28', contact: sensitiveContact(), template: BUILT_IN_TEMPLATES[0], settings });
    const readable = readablePayload(JSON.stringify(request));
    expect(readable.trimStart().startsWith('{\n  "messages"')).toBe(true);
    const parsed = JSON.parse(readable);
    expect(parsed.messages[0].content.contact.firstName).toBe('Anne');
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(request).sort());
  });
});

describe('dates', () => {
  it('tells the model today\'s date, because it cannot know it', () => {
    const request = buildRequest({ contact: sensitiveContact(), template: BUILT_IN_TEMPLATES[0], settings, today: '2026-09-28' });
    expect(JSON.parse(request.messages[0].content).today).toBe('2026-09-28');
    expect(request.system).toContain('Do not name a specific year unless that year is written in the contact');
  });
});

describe('sender gender', () => {
  const template = BUILT_IN_TEMPLATES[0];
  it('is sent only for French drafts, defaulting to unspecified', () => {
    const fr = JSON.parse(buildRequest({ contact: sensitiveContact({ country: 'FR' }), template, settings, today: '2026-09-28' }).messages[0].content);
    expect(fr.senderGender).toBe('unspecified');
    const en = JSON.parse(buildRequest({ contact: sensitiveContact({ country: 'GB' }), template, settings, today: '2026-09-28' }).messages[0].content);
    expect(en).not.toHaveProperty('senderGender');
    const fem = JSON.parse(
      buildRequest({ contact: sensitiveContact({ country: 'FR' }), template, settings: { ...settings, senderGender: 'feminine' }, today: '2026-09-28' }).messages[0].content,
    );
    expect(fem.senderGender).toBe('feminine');
  });
});

describe('template purposes', () => {
  it('sends this template\'s purpose, the other templates\' purposes, and where you met', () => {
    const template = BUILT_IN_TEMPLATES.find((t) => t.family === 'post-event' && t.language === 'en')!;
    const data = JSON.parse(
      buildRequest({
        contact: sensitiveContact({ whereMet: 'Lyon trade fair' }),
        template,
        settings,
        today: '2026-09-28',
        otherTemplates: [{ name: 'Spring check-in', purpose: 'A check-in.' }, { name: 'Empty', purpose: ' ' }],
      }).messages[0].content,
    );
    expect(data.template.purpose).toBe(template.purpose);
    expect(data.otherTemplates).toEqual([{ name: 'Spring check-in', purpose: 'A check-in.' }]);
    expect(data.contact.whereMet).toBe('Lyon trade fair');
  });
});
