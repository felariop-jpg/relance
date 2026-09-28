import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyMapping,
  countIssues,
  decodeCsvBytes,
  hasNameColumn,
  looksLikeSpreadsheet,
  parseContactType,
  parseCsvText,
  setMapping,
  suggestMapping,
} from './csv';

describe('parseCsvText', () => {
  it('splits header and rows and pads short rows', () => {
    const parsed = parseCsvText('a,b,c\n1,2\n\n4,5,6\n', true);
    expect(parsed.headers).toEqual(['a', 'b', 'c']);
    expect(parsed.rows).toEqual([
      ['1', '2', ''],
      ['4', '5', '6'],
    ]);
  });

  it('treats every row as data when there is no header', () => {
    const parsed = parseCsvText('Ann,Lee\nBo,Chan', false);
    expect(parsed.headers).toEqual(['', '']);
    expect(parsed.rows).toHaveLength(2);
  });

  it('detects semicolon delimiters (French-locale Excel)', () => {
    const parsed = parseCsvText('Prénom;Nom;Société\nAnne;Martin;Exemple SARL', true);
    expect(parsed.headers).toEqual(['Prénom', 'Nom', 'Société']);
    expect(parsed.rows[0]).toEqual(['Anne', 'Martin', 'Exemple SARL']);
  });

  it('keeps quoted commas and line breaks inside a cell', () => {
    const parsed = parseCsvText('name,notes\nAnn,"Line one, still one\nline two"', true);
    expect(parsed.rows[0][1]).toBe('Line one, still one\nline two');
  });
});

describe('decodeCsvBytes', () => {
  it('decodes UTF-8 and strips the byte-order mark', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('Hélène')]);
    expect(decodeCsvBytes(bytes)).toBe('Hélène');
  });

  it('falls back to Windows-1252 for older Excel exports', () => {
    // "Hélène" in Windows-1252
    const bytes = new Uint8Array([0x48, 0xe9, 0x6c, 0xe8, 0x6e, 0x65]);
    expect(decodeCsvBytes(bytes)).toBe('Hélène');
  });
});

describe('suggestMapping', () => {
  it('recognises common English and French headers', () => {
    expect(
      suggestMapping(['Prénom', 'Nom', 'E-mail', 'Société', 'Pays', 'Langue', 'Dernier contact']),
    ).toEqual(['firstName', 'lastName', 'email', 'company', 'country', 'language', 'lastContacted']);
    expect(suggestMapping(['First Name', 'Surname', 'Email Address', 'Organisation'])).toEqual([
      'firstName',
      'lastName',
      'email',
      'company',
    ]);
  });

  it('leaves unknown columns unmapped and never maps a field twice', () => {
    expect(suggestMapping(['Email', 'Mail', 'Favourite colour', ''])).toEqual([
      'email',
      null,
      null,
      null,
    ]);
  });

  it('maps a lone "Name" column to full name', () => {
    expect(suggestMapping(['Name', 'Email'])).toEqual(['fullName', 'email']);
  });

  it('maps every column of the bundled sample file', () => {
    const text = readFileSync('public/sample-contacts.csv', 'utf8');
    const mapping = suggestMapping(parseCsvText(text, true).headers);
    expect(mapping).not.toContain(null);
  });
});

describe('setMapping', () => {
  it('moves a field from one column to another', () => {
    expect(setMapping(['email', null], 1, 'email')).toEqual([null, 'email']);
    expect(setMapping(['email', 'notes'], 1, null)).toEqual(['email', null]);
  });
});

describe('applyMapping', () => {
  const parsed = parseCsvText(
    [
      'Name,Mail,Land,Lang,Kind,Seen',
      'Anne Martin,anne@example.com,France,,Prospect,25/03/2025',
      'Bo,bo@example.com,Atlantis,fr-BE,unknown,not a date',
      ',nobody@example.com,,,,',
      'Jean Paul Sartre,,LU,English,lead,',
    ].join('\n'),
    true,
  );
  const mapping = ['fullName', 'email', 'country', 'language', 'contactType', 'lastContacted'] as const;
  const result = applyMapping(parsed, [...mapping], { defaultType: 'client' });

  it('splits full names at the first space', () => {
    expect(result.contacts.map((c) => [c.firstName, c.lastName])).toEqual([
      ['Anne', 'Martin'],
      ['Bo', ''],
      ['Jean', 'Paul Sartre'],
    ]);
  });

  it('skips and counts rows without a first name', () => {
    expect(result.missingName).toBe(1);
  });

  it('reads countries, languages, types and dates', () => {
    const [anne, bo, jean] = result.contacts;
    expect(anne).toMatchObject({ country: 'FR', language: null, contactType: 'prospect', lastContacted: '2025-03-25' });
    expect(bo).toMatchObject({ country: '', language: 'fr', contactType: 'client', lastContacted: null });
    expect(jean).toMatchObject({ country: 'LU', language: 'en', contactType: 'lead' });
  });

  it('counts values it could not read', () => {
    expect(countIssues(result)).toEqual({ unknownCountry: 1, unknownDate: 1 });
  });

  it('does not count problems on rows later skipped as duplicates', () => {
    // Bo (index 1) has the unknown country and date; pretend Bo was a duplicate.
    expect(countIssues(result, [1])).toEqual({ unknownCountry: 0, unknownDate: 0 });
  });

  it('prefers a dedicated first-name column over a split full name', () => {
    const p = parseCsvText('First,Full\nAnn,Annie Lee', true);
    const [c] = applyMapping(p, ['firstName', 'fullName'], { defaultType: 'lead' }).contacts;
    expect(c).toMatchObject({ firstName: 'Ann', lastName: 'Lee', contactType: 'lead' });
  });
});

describe('small helpers', () => {
  it('knows when a name column is mapped', () => {
    expect(hasNameColumn(['email'])).toBe(false);
    expect(hasNameColumn(['email', 'fullName'])).toBe(true);
  });

  it('recognises spreadsheet files that are not CSV', () => {
    expect(looksLikeSpreadsheet('contacts.xlsx')).toBe(true);
    expect(looksLikeSpreadsheet('contacts.numbers')).toBe(true);
    expect(looksLikeSpreadsheet('contacts.csv')).toBe(false);
  });

  it('reads contact types in English and French', () => {
    expect(parseContactType('Client')).toBe('client');
    expect(parseContactType('customer')).toBe('client');
    expect(parseContactType('Piste')).toBe('lead');
    expect(parseContactType('vip')).toBeNull();
  });
});
