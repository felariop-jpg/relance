import { describe, expect, it } from 'vitest';
import { languageForCountry, parseLanguage, resolveLanguage } from './language';

const base = { defaultLanguage: 'en' as const, countryLanguageOverrides: {} };

describe('resolveLanguage', () => {
  it('uses the explicit contact language first', () => {
    expect(resolveLanguage({ language: 'en', country: 'FR' }, base)).toBe('en');
    expect(resolveLanguage({ language: 'fr', country: 'GB' }, base)).toBe('fr');
  });

  it('uses the user country override before built-in defaults', () => {
    const settings = { ...base, countryLanguageOverrides: { FR: 'en' as const, LU: 'fr' as const } };
    expect(resolveLanguage({ language: null, country: 'FR' }, settings)).toBe('en');
    expect(resolveLanguage({ language: null, country: 'LU' }, settings)).toBe('fr');
  });

  it('defaults only FR and MC to French', () => {
    expect(resolveLanguage({ language: null, country: 'FR' }, base)).toBe('fr');
    expect(resolveLanguage({ language: null, country: 'MC' }, base)).toBe('fr');
    for (const country of ['BE', 'CA', 'CH', 'LU', 'GB', 'US', 'DE', '']) {
      expect(resolveLanguage({ language: null, country }, base)).toBe('en');
    }
  });

  it('falls back to the default language', () => {
    expect(resolveLanguage({ language: null, country: 'DE' }, { ...base, defaultLanguage: 'fr' })).toBe('fr');
    expect(resolveLanguage({ language: null, country: '' }, { ...base, defaultLanguage: 'fr' })).toBe('fr');
  });

  it('matches lowercase country codes', () => {
    expect(languageForCountry('mc', base)).toBe('fr');
  });
});

describe('parseLanguage', () => {
  it.each([
    ['fr', 'fr'],
    ['FR', 'fr'],
    ['fr-BE', 'fr'],
    ['Français', 'fr'],
    ['french', 'fr'],
    ['en', 'en'],
    ['en_GB', 'en'],
    ['English', 'en'],
    ['Anglais', 'en'],
  ])('%s → %s', (raw, expected) => {
    expect(parseLanguage(raw)).toBe(expected);
  });

  it('returns null for blank or unknown values', () => {
    expect(parseLanguage('')).toBeNull();
    expect(parseLanguage('de')).toBeNull();
    expect(parseLanguage('Deutsch')).toBeNull();
  });
});
