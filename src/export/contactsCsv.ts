import Papa from 'papaparse';
import type { Contact } from '../db/schema';
import { todayIso } from '../lib/dates';
import { downloadFile } from '../lib/download';

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

/** Downloads every contact as relance-contacts-<date>.csv (with a BOM, for Excel). Nothing leaves the device. */
export function downloadContactsCsv(contacts: Contact[]): void {
  downloadFile('\uFEFF' + buildContactsCsv(contacts), `relance-contacts-${todayIso()}.csv`, 'text/csv;charset=utf-8');
}
