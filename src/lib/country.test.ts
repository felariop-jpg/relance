import { describe, expect, it } from 'vitest';
import { countryCodes, countryName, parseCountry } from './country';

describe('parseCountry', () => {
  it('accepts ISO-2 codes in any case', () => {
    expect(parseCountry('fr')).toBe('FR');
    expect(parseCountry(' LU ')).toBe('LU');
  });

  it('accepts English and French names, with or without accents', () => {
    expect(parseCountry('Luxembourg')).toBe('LU');
    expect(parseCountry('Germany')).toBe('DE');
    expect(parseCountry('Allemagne')).toBe('DE');
    expect(parseCountry('Belgique')).toBe('BE');
    expect(parseCountry('Suisse')).toBe('CH');
    expect(parseCountry('etats-unis')).toBe('US');
    expect(parseCountry('UK')).toBe('GB');
  });

  it("returns '' for blank and null for unknown", () => {
    expect(parseCountry('')).toBe('');
    expect(parseCountry('Atlantis')).toBeNull();
    expect(parseCountry('ZZ')).toBeNull();
  });
});

describe('countryCodes', () => {
  it('lists real countries and excludes groupings', () => {
    const codes = countryCodes();
    expect(codes).toContain('FR');
    expect(codes).toContain('LU');
    expect(codes).not.toContain('EU');
    expect(codes).not.toContain('UN');
    expect(codes).toHaveLength(250);
    expect(codes).not.toContain('FX');
    expect(codes).not.toContain('UK');
  });

  it('names countries in the UI language', () => {
    expect(countryName('DE', 'fr')).toBe('Allemagne');
    expect(countryName('DE', 'en')).toBe('Germany');
    expect(countryName('', 'en')).toBe('');
  });
});
