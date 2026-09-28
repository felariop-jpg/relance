import { API_FIELDS, type ApiField, type Contact, type Settings } from '../db/schema';
import { resolveLanguage } from '../lib/language';

/** The only contact data that may reach the API. */
export type RedactedContact = Partial<Record<ApiField, string>>;

/**
 * Builds the contact part of the API payload from an ALLOWLIST.
 *
 * Only fields in API_FIELDS are copied, minus any the user chose to withhold.
 * Everything else — lastName, email, phone, and any field added to Contact in
 * the future — is left behind by construction, because nothing here iterates
 * over the contact's own keys.
 */
export function redactForApi(
  contact: Contact,
  settings: Pick<Settings, 'withheldFields' | 'defaultLanguage' | 'countryLanguageOverrides'>,
): RedactedContact {
  const withheld = new Set<ApiField>(settings.withheldFields);
  const out: RedactedContact = {};
  for (const field of API_FIELDS) {
    if (withheld.has(field)) continue;
    // language is sent as the resolved value, never null.
    const value = field === 'language' ? resolveLanguage(contact, settings) : contact[field];
    out[field] = typeof value === 'string' ? value : '';
  }
  return out;
}

/** Notes are the personalization hook; the card warns when they are missing. */
export function notesAvailable(contact: Contact, settings: Pick<Settings, 'withheldFields'>): boolean {
  return !settings.withheldFields.includes('notes') && contact.notes.trim() !== '';
}
