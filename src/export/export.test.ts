import Papa from 'papaparse';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { emptyContact } from '../db/contacts';
import { newDraft } from '../db/drafts';
import { buildBrevoCsv, buildEmlZip, BREVO_COLUMNS } from './bundle';
import { buildEml, emlFileName, encodeHeaderValue } from './eml';

function decodeBody(eml: string): string {
  const [, body] = eml.split('\r\n\r\n');
  const binary = atob(body.replace(/\r\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function decodeWords(value: string): string {
  return value
    .split(/\r\n /)
    .map((w) => {
      const m = /^=\?UTF-8\?B\?(.*)\?=$/.exec(w);
      if (!m) return w;
      return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
    })
    .join('');
}

describe('buildEml', () => {
  const eml = buildEml({
    toName: 'Hélène Duclos',
    toEmail: 'helene@example.com',
    subject: 'Belles fêtes de fin d’année, Hélène — avec un sujet assez long pour être découpé',
    body: 'Bonjour Hélène,\n\nÀ bientôt.',
  });

  it('is an unsent draft with no sender or date', () => {
    expect(eml).toContain('X-Unsent: 1');
    expect(eml).not.toMatch(/^From:/m);
    expect(eml).not.toMatch(/^Date:/m);
  });

  it('uses CRLF line endings and a UTF-8 base64 body', () => {
    expect(eml).toContain('Content-Type: text/plain; charset=UTF-8\r\n');
    expect(decodeBody(eml)).toBe('Bonjour Hélène,\r\n\r\nÀ bientôt.');
  });

  it('encodes accented subjects and names, within header length limits', () => {
    const subject = /^Subject: (.*(?:\r\n .*)*)/m.exec(eml)![1];
    expect(decodeWords(subject)).toBe(
      'Belles fêtes de fin d’année, Hélène — avec un sujet assez long pour être découpé',
    );
    for (const line of eml.split('\r\n')) expect(line.length).toBeLessThanOrEqual(78);
    expect(eml).toMatch(/^To: =\?UTF-8\?B\?.+\?= <helene@example\.com>$/m);
  });

  it('quotes ASCII names with special characters and omits To without an email', () => {
    expect(buildEml({ toName: 'Martin, Anne', toEmail: 'a@example.com', subject: 's', body: '' })).toContain(
      'To: "Martin, Anne" <a@example.com>',
    );
    expect(buildEml({ toName: 'Anne', toEmail: '', subject: 's', body: '' })).not.toMatch(/^To:/m);
  });

  it('cannot be tricked into extra headers', () => {
    const evil = buildEml({ toName: 'A', toEmail: 'a@example.com\r\nBcc: x@example.com', subject: 'Hi\r\nBcc: y@example.com', body: '' });
    expect(evil).not.toMatch(/^Bcc:/m);
  });

  it('keeps plain ASCII subjects readable', () => {
    expect(encodeHeaderValue('Hello')).toBe('Hello');
  });
});

describe('emlFileName', () => {
  it('strips unsafe characters and keeps names unique', () => {
    const taken = new Set<string>();
    expect(emlFileName(['Anne Martin', 'Hello: a/b?'], taken)).toBe('Anne Martin - Hello ab.eml');
    expect(emlFileName(['Anne Martin', 'Hello: a/b?'], taken)).toBe('Anne Martin - Hello ab (2).eml');
  });
});

const contact = { ...emptyContact(), id: 'c1', firstName: 'Anne', lastName: 'Martin', email: 'anne@example.com', createdAt: '', updatedAt: '' };
const draft = newDraft({ contactId: 'c1', templateId: 't', language: 'fr', subject: 'Bonjour', body: 'Ligne 1\nLigne "2", avec virgule' });

describe('export bundles', () => {
  it('zips one .eml per draft', () => {
    const files = unzipSync(buildEmlZip([{ draft, contact }, { draft, contact }]));
    expect(Object.keys(files)).toEqual(['Anne Martin - Bonjour.eml', 'Anne Martin - Bonjour (2).eml']);
    expect(strFromU8(files['Anne Martin - Bonjour.eml'])).toContain('To: Anne Martin <anne@example.com>');
  });

  it('builds a Brevo CSV that round-trips quotes, commas and line breaks', () => {
    const parsed = Papa.parse<string[]>(buildBrevoCsv([{ draft, contact }]));
    expect(parsed.data[0]).toEqual([...BREVO_COLUMNS]);
    expect(parsed.data[1]).toEqual(['anne@example.com', 'Anne', 'Martin', 'Bonjour', 'Ligne 1\nLigne "2", avec virgule']);
  });
});
