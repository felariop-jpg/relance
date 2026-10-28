import Papa from 'papaparse';
import { CONTACT_TYPES, type ContactInput, type ContactType } from '../db/schema';
import { emptyContact } from '../db/contacts';
import { parseCountry } from './country';
import { detectDayFirst, parseDate } from './dates';
import { parseLanguage } from './language';
import { fold } from './text';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** UTF-8 first; falls back to Windows-1252, which older Excel versions export. */
export function decodeCsvBytes(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^﻿/, '');
}

export async function readCsvFile(file: File): Promise<string> {
  return decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
}

export function looksLikeSpreadsheet(fileName: string): boolean {
  return /\.(xlsx|xlsm|xls|numbers|ods)$/i.test(fileName);
}

/** Delimiter is auto-detected (comma, semicolon, tab). */
export function parseCsvText(text: string, hasHeader: boolean): ParsedCsv {
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  const all = parsed.data.filter((row) => row.some((cell) => cell.trim() !== ''));
  const width = all.reduce((max, row) => Math.max(max, row.length), 0);
  const pad = (row: string[]) =>
    Array.from({ length: width }, (_, i) => (row[i] ?? '').trim());
  const rows = all.map(pad);
  const headerRow = hasHeader && rows.length > 0 ? rows[0] : null;
  const headers = Array.from({ length: width }, (_, i) => headerRow?.[i] ?? '');
  return { headers, rows: headerRow ? rows.slice(1) : rows };
}

export const IMPORT_TARGETS = [
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'company',
  'country',
  'language',
  'contactType',
  'serviceHistory',
  'notes',
  'whereMet',
  'openThread',
  'lastContacted',
  'externalId',
] as const;
export type ImportTarget = (typeof IMPORT_TARGETS)[number];

/** One entry per CSV column: where it goes, or null for "don't import". */
export type ColumnMapping = (ImportTarget | null)[];

const HEADER_HINTS: Record<ImportTarget, string[]> = {
  firstName: ['first name', 'firstname', 'first', 'given name', 'forename', 'prenom'],
  lastName: ['last name', 'lastname', 'surname', 'family name', 'nom', 'nom de famille'],
  fullName: ['name', 'full name', 'contact name', 'contact', 'nom complet'],
  email: ['email', 'e mail', 'mail', 'email address', 'adresse email', 'adresse e mail', 'adresse mail', 'courriel'],
  phone: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'portable', 'gsm', 'numero de telephone'],
  company: ['company', 'company name', 'organisation', 'organization', 'employer', 'account', 'entreprise', 'societe', 'employeur', 'structure'],
  country: ['country', 'country code', 'pays'],
  language: ['language', 'lang', 'locale', 'langue'],
  contactType: ['type', 'contact type', 'category', 'status', 'type de contact', 'categorie', 'statut'],
  serviceHistory: ['service history', 'work done together', 'travail realise ensemble', 'history', 'services', 'work done', 'projects', 'historique', 'prestations', 'projets'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks', 'commentaires', 'commentaire', 'remarques'],
  whereMet: ['where we met', 'where you met', 'where met', 'met at', 'first met', 'event', 'lieu de rencontre', 'rencontre', 'rencontre a', 'evenement'],
  openThread: ['left open', 'open thread', 'open question', 'pending', 'unresolved', 'en suspens', 'point en suspens', 'reste en suspens', 'question en attente'],
  externalId: ['contact id', 'id', 'contact identifier', 'external id', 'reference', 'ref', 'contact reference', 'contact ref', 'identifiant', 'identifiant contact', 'identifiant du contact', 'id contact', 'reference contact', 'ref contact'],
  lastContacted: ['last contacted', 'last contact', 'last contact date', 'last email', 'dernier contact', 'date dernier contact', 'date du dernier contact'],
};

function normalizeHeader(header: string): string {
  return fold(header).replace(/[_\-.:]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** A starting suggestion only; the user confirms every column. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const used = new Set<ImportTarget>();
  return headers.map((header) => {
    const h = normalizeHeader(header);
    if (!h) return null;
    for (const target of IMPORT_TARGETS) {
      if (used.has(target)) continue;
      if (HEADER_HINTS[target].includes(h)) {
        used.add(target);
        return target;
      }
    }
    return null;
  });
}

/**
 * A file Relance already knows how to read (its own export, the sample file, or
 * headings matching its field names): every named column is recognised and
 * there is a name column, so the column screen can be skipped.
 */
export function isRecognisedFormat(headers: string[]): boolean {
  const mapping = suggestMapping(headers);
  return headers.every((h, i) => !h.trim() || mapping[i] !== null) && hasNameColumn(mapping);
}

/** Assigns `target` to column `index`, clearing it from any other column. */
export function setMapping(
  mapping: ColumnMapping,
  index: number,
  target: ImportTarget | null,
): ColumnMapping {
  return mapping.map((current, i) => {
    if (i === index) return target;
    return target !== null && current === target ? null : current;
  });
}

export function hasNameColumn(mapping: ColumnMapping): boolean {
  return mapping.includes('firstName') || mapping.includes('fullName');
}

const TYPE_WORDS: Record<string, ContactType> = {
  customer: 'client',
  clients: 'client',
  cliente: 'client',
  prospects: 'prospect',
  leads: 'lead',
  piste: 'lead',
  pistes: 'lead',
};

export function parseContactType(raw: string): ContactType | null {
  const value = fold(raw);
  if ((CONTACT_TYPES as readonly string[]).includes(value)) return value as ContactType;
  return TYPE_WORDS[value] ?? null;
}

export interface MappingOptions {
  /** Used when a row has no recognisable type. */
  defaultType: ContactType;
}

export interface MappingResult {
  contacts: ContactInput[];
  /**
   * Per contact (same order): which values could not be read and were left blank,
   * and whether the type is the default one (no type column, blank or unrecognised).
   */
  issues: { unknownCountry: boolean; unknownDate: boolean; defaultType: boolean }[];
  /** Rows skipped because no first name could be found. */
  missingName: number;
}

/** Rows whose type is the default rather than read from the file: updates keep the stored type. */
export function defaultTypeIndexes(result: MappingResult): number[] {
  return result.issues.flatMap((issue, i) => (issue.defaultType ? [i] : []));
}

/** Counts unreadable values among the contacts that were actually added. */
export function countIssues(
  result: MappingResult,
  skippedIndexes: number[] = [],
): { unknownCountry: number; unknownDate: number } {
  const skipped = new Set(skippedIndexes);
  const kept = result.issues.filter((_, i) => !skipped.has(i));
  return {
    unknownCountry: kept.filter((i) => i.unknownCountry).length,
    unknownDate: kept.filter((i) => i.unknownDate).length,
  };
}

export function applyMapping(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  options: MappingOptions,
): MappingResult {
  const col = (target: ImportTarget) => mapping.indexOf(target);
  const dateCol = col('lastContacted');
  const dayFirst = dateCol >= 0 ? detectDayFirst(parsed.rows.map((r) => r[dateCol])) : true;

  const result: MappingResult = { contacts: [], issues: [], missingName: 0 };

  for (const row of parsed.rows) {
    const get = (target: ImportTarget) => {
      const i = col(target);
      return i >= 0 ? (row[i] ?? '').trim() : '';
    };

    let firstName = get('firstName');
    let lastName = get('lastName');
    const full = get('fullName');
    if (full) {
      const space = full.indexOf(' ');
      const first = space === -1 ? full : full.slice(0, space);
      const rest = space === -1 ? '' : full.slice(space + 1).trim();
      if (!firstName) firstName = first;
      if (!lastName) lastName = rest;
    }
    if (!firstName) {
      result.missingName++;
      continue;
    }

    const countryRaw = get('country');
    const country = parseCountry(countryRaw);
    const dateRaw = get('lastContacted');
    const lastContacted = parseDate(dateRaw, dayFirst);
    const contactType = parseContactType(get('contactType'));
    result.issues.push({
      unknownCountry: country === null,
      unknownDate: Boolean(dateRaw) && lastContacted === null,
      defaultType: contactType === null,
    });

    result.contacts.push({
      ...emptyContact(),
      firstName,
      lastName,
      email: get('email'),
      phone: get('phone'),
      company: get('company'),
      country: country ?? '',
      language: parseLanguage(get('language')),
      contactType: contactType ?? options.defaultType,
      serviceHistory: get('serviceHistory'),
      notes: get('notes'),
      whereMet: get('whereMet'),
      openThread: get('openThread'),
      lastContacted,
      externalId: get('externalId'),
    });
  }
  return result;
}
