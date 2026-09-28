import { importContacts, type ImportResult } from '../db/contacts';
import { applyMapping, parseCsvText, suggestMapping } from './csv';

export const SAMPLE_CSV_URL = `${import.meta.env.BASE_URL}sample-contacts.csv`;

/** Imports the bundled fictional contacts. Safe to run twice (email de-duplication). */
export async function loadSampleContacts(): Promise<ImportResult> {
  const response = await fetch(SAMPLE_CSV_URL);
  if (!response.ok) throw new Error(`Sample CSV: HTTP ${response.status}`);
  const parsed = parseCsvText(await response.text(), true);
  const { contacts } = applyMapping(parsed, suggestMapping(parsed.headers), {
    defaultType: 'client',
  });
  return importContacts(contacts);
}
