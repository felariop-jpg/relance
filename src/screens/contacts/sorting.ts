import type { TFunction } from 'i18next';
import { CONTACT_TYPES, LANGUAGES, type Contact, type ContactType, type Lang, type Settings } from '../../db/schema';
import { countryName } from '../../lib/country';
import { resolveLanguage } from '../../lib/language';
import { fold } from '../../lib/text';

export const SORT_KEYS = [
  'firstName',
  'lastName',
  'company',
  'email',
  'country',
  'language',
  'contactType',
  'lastContacted',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

function sortText(c: Contact, key: SortKey, settings: Settings, locale: string, t: TFunction): string {
  switch (key) {
    case 'country':
      return countryName(c.country, locale);
    case 'language':
      return t(`languages.${resolveLanguage(c, settings)}`);
    case 'contactType':
      return t(`contactTypes.${c.contactType}`);
    case 'lastContacted':
      return c.lastContacted ?? '';
    default:
      return c[key];
  }
}

/** Empty values always sort last, whichever the direction. */
export function sortContacts(
  contacts: Contact[],
  sort: Sort,
  settings: Settings,
  locale: string,
  t: TFunction,
): Contact[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const dir = sort.dir === 'asc' ? 1 : -1;
  const keyed = contacts.map((c) => ({ c, v: sortText(c, sort.key, settings, locale, t) }));
  keyed.sort((a, b) => {
    if (!a.v !== !b.v) return a.v ? -1 : 1;
    const primary = collator.compare(a.v, b.v) * dir;
    if (primary !== 0) return primary;
    return (
      collator.compare(a.c.firstName, b.c.firstName) || collator.compare(a.c.lastName, b.c.lastName)
    );
  });
  return keyed.map((k) => k.c);
}

/** Every word of the query must appear somewhere in the contact. */
export function matchesQuery(c: Contact, query: string, locale: string): boolean {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fold(
    [
      c.firstName,
      c.lastName,
      c.email,
      c.phone,
      c.company,
      c.notes,
      c.whereMet,
      c.openThread,
      c.serviceHistory,
      countryName(c.country, locale),
    ].join(' '),
  );
  return terms.every((term) => haystack.includes(term));
}

export interface ContactFilters {
  query: string;
  type: ContactType | '';
  /** ISO-2 code, or '' for any. */
  country: string;
  /** The language drafts would be written in (explicit or automatic). */
  language: Lang | '';
  /** 'missing' = only contacts without notes. */
  notes: '' | 'missing';
}

export const NO_FILTERS: ContactFilters = { query: '', type: '', country: '', language: '', notes: '' };

export function hasFilters(f: ContactFilters): boolean {
  return f.query.trim() !== '' || f.type !== '' || f.country !== '' || f.language !== '' || f.notes !== '';
}

export function filterContacts(contacts: Contact[], f: ContactFilters, settings: Settings, locale: string): Contact[] {
  return contacts.filter(
    (c) =>
      (!f.type || c.contactType === f.type) &&
      (!f.country || c.country === f.country) &&
      (!f.language || resolveLanguage(c, settings) === f.language) &&
      (f.notes !== 'missing' || !c.notes.trim()) &&
      matchesQuery(c, f.query, locale),
  );
}

/** Filters from a link such as #/contacts?type=client or ?notes=missing (from the Overview). Unknown values are ignored. */
export function filtersFromParams(params: URLSearchParams): ContactFilters {
  const type = params.get('type') ?? '';
  const language = params.get('language') ?? '';
  const country = (params.get('country') ?? '').toUpperCase();
  return {
    ...NO_FILTERS,
    type: (CONTACT_TYPES as readonly string[]).includes(type) ? (type as ContactType) : '',
    language: (LANGUAGES as readonly string[]).includes(language) ? (language as Lang) : '',
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    notes: params.get('notes') === 'missing' ? 'missing' : '',
  };
}

/** The countries that appear in the list, sorted by name, for the country filter. */
export function countriesInUse(contacts: Contact[], locale: string): { code: string; name: string }[] {
  const codes = [...new Set(contacts.map((c) => c.country).filter(Boolean))];
  return codes
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
