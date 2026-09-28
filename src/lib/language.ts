import type { Contact, Lang, Settings } from '../db/schema';
import { fold } from './text';

/**
 * Built-in defaults. Deliberately tiny: only countries where French is
 * overwhelmingly the language of business. Multilingual countries (BE, CA,
 * CH, LU, ...) have no default; users set them in countryLanguageOverrides.
 */
export const BUILT_IN_COUNTRY_LANGUAGE: Readonly<Record<string, Lang>> = {
  FR: 'fr',
  MC: 'fr',
};

type LanguageSettings = Pick<Settings, 'defaultLanguage' | 'countryLanguageOverrides'>;

/** The language a contact gets when their own language is set to automatic. */
export function languageForCountry(country: string, settings: LanguageSettings): Lang {
  const code = country.toUpperCase();
  return (
    settings.countryLanguageOverrides[code] ??
    BUILT_IN_COUNTRY_LANGUAGE[code] ??
    settings.defaultLanguage
  );
}

/**
 * Resolution order: explicit contact.language → user's country override →
 * built-in country default → settings.defaultLanguage.
 */
export function resolveLanguage(
  contact: Pick<Contact, 'language' | 'country'>,
  settings: LanguageSettings,
): Lang {
  return contact.language ?? languageForCountry(contact.country, settings);
}

const LANGUAGE_WORDS: Record<string, Lang> = {
  en: 'en',
  eng: 'en',
  english: 'en',
  anglais: 'en',
  fr: 'fr',
  fra: 'fr',
  fre: 'fr',
  french: 'fr',
  francais: 'fr',
};

/** Reads a language from free text ("FR", "fr-BE", "Français"). null if unknown. */
export function parseLanguage(raw: string): Lang | null {
  const value = fold(raw);
  if (!value) return null;
  const base = value.split(/[-_\s]/)[0];
  return LANGUAGE_WORDS[value] ?? LANGUAGE_WORDS[base] ?? null;
}

export function browserLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  return (navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
