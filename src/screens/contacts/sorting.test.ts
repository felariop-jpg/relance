import { describe, expect, it } from 'vitest';
import { emptyContact } from '../../db/contacts';
import { defaultSettings } from '../../db/settings-defaults';
import type { Contact } from '../../db/schema';
import { countriesInUse, filterContacts, filtersFromParams, hasFilters, NO_FILTERS } from './sorting';

const contact = (id: string, patch: Partial<Contact> = {}): Contact => ({
  ...emptyContact(),
  id,
  firstName: id,
  createdAt: '',
  updatedAt: '',
  ...patch,
});
const settings = defaultSettings('en');
const people = [
  contact('anne', { country: 'FR', contactType: 'client', notes: 'Met in Lyon' }),
  contact('bo', { country: 'BE', contactType: 'prospect', language: 'fr' }),
  contact('cy', { country: 'GB', contactType: 'lead', notes: 'Asked about rates' }),
  contact('dee', { country: '', contactType: 'client' }),
];
const ids = (list: Contact[]) => list.map((c) => c.id);

describe('filterContacts', () => {
  it('filters by type, country and notes', () => {
    expect(ids(filterContacts(people, { ...NO_FILTERS, type: 'client' }, settings, 'en'))).toEqual(['anne', 'dee']);
    expect(ids(filterContacts(people, { ...NO_FILTERS, country: 'BE' }, settings, 'en'))).toEqual(['bo']);
    expect(ids(filterContacts(people, { ...NO_FILTERS, notes: 'missing' }, settings, 'en'))).toEqual(['bo', 'dee']);
  });

  it('filters by the language drafts would use, automatic or chosen', () => {
    // FR → French automatically; Bo chose French; the rest default to English.
    expect(ids(filterContacts(people, { ...NO_FILTERS, language: 'fr' }, settings, 'en'))).toEqual(['anne', 'bo']);
    expect(ids(filterContacts(people, { ...NO_FILTERS, language: 'en' }, settings, 'en'))).toEqual(['cy', 'dee']);
  });

  it('combines filters with the search', () => {
    expect(ids(filterContacts(people, { ...NO_FILTERS, type: 'client', query: 'lyon' }, settings, 'en'))).toEqual(['anne']);
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, notes: 'missing' })).toBe(true);
  });
});

describe('filtersFromParams', () => {
  it('reads filters from an Overview link and ignores unknown values', () => {
    expect(filtersFromParams(new URLSearchParams('type=prospect&notes=missing'))).toEqual({
      ...NO_FILTERS,
      type: 'prospect',
      notes: 'missing',
    });
    expect(filtersFromParams(new URLSearchParams('type=partner&language=de&country=france&notes=yes'))).toEqual(NO_FILTERS);
    expect(filtersFromParams(new URLSearchParams('country=fr')).country).toBe('FR');
  });
});

describe('countriesInUse', () => {
  it('lists each country once, sorted by name, without blanks', () => {
    expect(countriesInUse(people, 'en').map((c) => c.code)).toEqual(['BE', 'FR', 'GB']);
  });
});
