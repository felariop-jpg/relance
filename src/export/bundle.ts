import Papa from 'papaparse';
import { strToU8, zipSync } from 'fflate';
import type { Contact, Draft } from '../db/schema';
import { buildEml, emlFileName } from './eml';

export interface ExportItem {
  draft: Draft;
  contact: Contact;
}

/** One .eml per draft, zipped. */
export function buildEmlZip(items: ExportItem[]): Uint8Array<ArrayBuffer> {
  const taken = new Set<string>();
  const files: Record<string, Uint8Array> = {};
  for (const { draft, contact } of items) {
    const name = emlFileName(
      [[contact.firstName, contact.lastName].filter(Boolean).join(' '), draft.subject],
      taken,
    );
    files[name] = strToU8(
      buildEml({
        toName: [contact.firstName, contact.lastName].filter(Boolean).join(' '),
        toEmail: contact.email,
        subject: draft.subject,
        body: draft.body,
      }),
    );
  }
  return zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>;
}

export const BREVO_COLUMNS = ['EMAIL', 'FIRSTNAME', 'LASTNAME', 'SUBJECT', 'BODY'] as const;

/** A CSV Brevo can import as contacts with SUBJECT and BODY attributes. */
export function buildBrevoCsv(items: ExportItem[]): string {
  return Papa.unparse({
    fields: [...BREVO_COLUMNS],
    data: items.map(({ draft, contact }) => [
      contact.email,
      contact.firstName,
      contact.lastName,
      draft.subject,
      draft.body,
    ]),
  });
}
