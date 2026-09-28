import { describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES } from '../db/seed';
import { fillPlaceholders, placeholderValues, unknownPlaceholders } from './placeholders';

const values = placeholderValues(
  { firstName: 'Anne', lastName: 'Martin', company: 'Exemple SARL', email: 'anne@example.com' },
  { senderName: 'Sam', signature: 'Sam Lee\nConsulting', calendlyLink: '' },
);

describe('fillPlaceholders', () => {
  it('replaces known placeholders, tolerating spaces inside braces', () => {
    expect(fillPlaceholders('Dear {{firstName}} {{ lastName }},', values)).toBe('Dear Anne Martin,');
  });

  it('drops a line whose placeholders are all empty', () => {
    const text = 'Hello {{firstName}},\n\nBook here: {{calendlyLink}}\n\n{{signature}}';
    expect(fillPlaceholders(text, values)).toBe('Hello Anne,\n\nSam Lee\nConsulting');
  });

  it('keeps a line when at least one placeholder has a value, and tidies spacing', () => {
    const v = { ...values, lastName: '' };
    expect(fillPlaceholders('Dear {{firstName}} {{lastName}},', v)).toBe('Dear Anne,');
  });

  it('leaves unknown placeholders visible', () => {
    expect(fillPlaceholders('Hi {{nickname}}', values)).toBe('Hi {{nickname}}');
    expect(unknownPlaceholders('Hi {{nickname}} {{firstName}} {{nickname}}')).toEqual(['nickname']);
  });

  it('falls back to the sender name when there is no signature', () => {
    const v = placeholderValues(
      { firstName: 'A', lastName: '', company: '', email: '' },
      { senderName: 'Sam', signature: '  ', calendlyLink: '' },
    );
    expect(v.signature).toBe('Sam');
  });
});

describe('built-in templates', () => {
  it('exist in English and French for every family', () => {
    const families = new Set(BUILT_IN_TEMPLATES.map((t) => t.family));
    expect(families.size).toBe(5);
    for (const family of families) {
      const langs = BUILT_IN_TEMPLATES.filter((t) => t.family === family).map((t) => t.language);
      expect(langs.sort()).toEqual(['en', 'fr']);
    }
  });

  it('only use known placeholders', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(unknownPlaceholders(t.subject + t.body), t.id).toEqual([]);
    }
  });

  it('avoid the banned follow-up phrases', () => {
    const banned = /just following up|circling back|wanted to reach out|je me permets de vous relancer/i;
    for (const t of BUILT_IN_TEMPLATES) expect(t.body, t.id).not.toMatch(banned);
  });
});
