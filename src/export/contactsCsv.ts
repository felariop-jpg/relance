import Papa from 'papaparse';
import type { Contact } from '../db/schema';

/**
 * Column headings, in order. Each one is recognised by suggestMapping, so an
 * exported file imports again with no manual mapping (and updates contacts by
 * Contact ID).
 */
export const CONTACTS_CSV_HEADERS = [
  'Contact ID', 'First name', 'Last name', 'Email', 'Phone', 'Company', 'Country', 'Language', 'Type',
  'Service history', 'Notes', 'Where we met', 'Left open', 'Last contacted',
] as const;

/** Every contact as a CSV file. Language is blank when automatic. */
export function buildContactsCsv(contacts: Contact[]): string {
  return Papa.unparse({
    fields: [...CONTACTS_CSV_HEADERS],
    data: contacts.map((c) => [
      c.externalId,
      c.firstName,
      c.lastName,
      c.email,
      c.phone,
      c.company,
      c.country,
      c.language ?? '',
      c.contactType,
      c.serviceHistory,
      c.notes,
      c.whereMet,
      c.openThread,
      c.lastContacted ?? '',
    ]),
  });
}
