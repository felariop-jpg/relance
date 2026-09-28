import { importContacts, type ImportResult } from '../db/contacts';
import { applyMapping, parseCsvText, suggestMapping } from './csv';
import { todayIso } from './dates';

const HEADERS = [
  'First name', 'Last name', 'Email', 'Phone', 'Company', 'Country', 'Language', 'Type',
  'Service history', 'Notes', 'Where we met', 'Left open', 'Last contacted',
] as const;

interface SampleRow {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  country: string;
  language?: 'en' | 'fr';
  type: 'client' | 'prospect' | 'lead';
  /** `year` is the current year, so no text goes stale. */
  serviceHistory?: (year: number) => string;
  notes?: string;
  whereMet?: (year: number) => string;
  openThread?: string;
  /** Days before today; absent = never contacted. */
  lastContactedDaysAgo?: number;
}

/**
 * The bundled fictional contacts. Every date and year is worked out from today
 * when they are loaded or downloaded, so the sample never looks out of date.
 */
const ROWS: SampleRow[] = [
  { firstName: 'Amélie', lastName: 'Rousseau', email: 'amelie.rousseau@example.com', company: 'Atelier Verrier & Fils', country: 'FR', type: 'client',
    serviceHistory: (y) => `Two-day team workshop in ${y - 1}; follow-up coaching for the managers.`,
    notes: 'Her daughter started university in Lyon this autumn. She mentioned wanting to revisit the workshop format for new hires.',
    lastContactedDaysAgo: 150 },
  { firstName: 'Tom', lastName: 'Hendricks', email: 'tom.hendricks@example.org', company: 'Northgate Freight Services', country: 'GB', type: 'client',
    serviceHistory: () => 'Advisory project on onboarding process (three months).',
    notes: 'Moving to a new office in the spring. Asked for a short summary of what worked, to share with his new director.' },
  { firstName: 'Sofia', lastName: 'Almeida', email: 'sofia.almeida@example.net', company: 'Maré Studio', country: 'PT', language: 'en', type: 'prospect',
    notes: 'Met briefly at a regional HR meetup. Interested but said timing was not right before the summer.',
    whereMet: (y) => `Regional HR meetup, spring ${y - 1}`,
    lastContactedDaysAgo: 290 },
  { firstName: 'Julien', lastName: 'Marchal', email: 'julien.marchal@example.com', company: 'Boulangeries Marchal', country: 'BE', language: 'fr', type: 'client',
    serviceHistory: () => 'Coaching sessions for the operations team.',
    notes: 'Took over the family business from his father last year. Very proud of the new site.' },
  { firstName: 'Nadia', lastName: 'Benali', email: 'nadia.benali@example.org', company: 'Clairval Conseil', country: 'FR', type: 'lead',
    notes: 'Downloaded the guide from the website and replied asking about pricing for small teams.',
    openThread: 'Her question about pricing for small teams' },
  { firstName: 'Lukas', lastName: 'Steiner', email: 'lukas.steiner@example.com', company: 'Alpenlicht Engineering', country: 'CH', language: 'en', type: 'prospect',
    notes: 'Speaker at the spring conference in Geneva. We talked about remote teams and his project in Oslo.',
    whereMet: () => 'Spring conference, Geneva',
    lastContactedDaysAgo: 410 },
  { firstName: 'Claire', lastName: 'Dubois', email: 'claire.dubois@example.net', company: 'Maison Lune Édition', country: 'LU', language: 'fr', type: 'client',
    serviceHistory: (y) => `Annual review workshop (${y - 2} and ${y - 1}).`,
    notes: 'Prefers email over calls. Her team grew from 8 to 14 people this year.',
    lastContactedDaysAgo: 21 },
  { firstName: 'Ben', lastName: 'Okafor', email: 'ben.okafor@example.org', company: 'Greenleaf Community Trust', country: 'GB', type: 'client',
    serviceHistory: () => 'Pro bono session for the volunteer coordinators.',
    lastContactedDaysAgo: 230 },
  { firstName: 'Marie-Hélène', lastName: 'Faure', email: 'mh.faure@example.com', company: 'Cabinet Faure & Associés', country: 'MC', type: 'prospect',
    notes: 'Introduced by a mutual contact. Interested in a session for her partners in the autumn.',
    openThread: 'A session for her partners in the autumn' },
  { firstName: 'Emma', lastName: 'Lindqvist', email: 'emma.lindqvist@example.net', company: 'Nordvik Design Co.', country: 'SE', type: 'lead',
    notes: 'Met at a conference stand in Brussels. Asked to be kept in mind for next year.',
    whereMet: () => 'Conference stand, Brussels',
    lastContactedDaysAgo: 75 },
  { firstName: 'Daniel', lastName: 'Weber', email: 'daniel.weber@example.com', company: 'Weber Haustechnik', country: 'DE', type: 'client',
    serviceHistory: (y) => `Process review, then quarterly check-ins through ${y - 1}.`,
    notes: 'Just back from parental leave. Mentioned the team handled things well while he was away.',
    lastContactedDaysAgo: 9 },
  { firstName: 'Isabelle', lastName: 'Moreau', email: 'isabelle.moreau@example.org', company: 'Les Jardins de Sologne', country: 'FR', type: 'client',
    serviceHistory: () => 'Workshop on team communication.',
    notes: 'Runs a garden centre with seasonal staff. The busy season ends in October.',
    lastContactedDaysAgo: 330 },
];

function daysAgo(today: Date, days: number): string {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return todayIso(date);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The sample contacts as a CSV file, dated relative to `today`. */
export function sampleContactsCsv(today = new Date()): string {
  const year = today.getFullYear();
  const lines = ROWS.map((r) =>
    [
      r.firstName, r.lastName, r.email, '', r.company, r.country, r.language ?? '', r.type,
      r.serviceHistory?.(year) ?? '', r.notes ?? '', r.whereMet?.(year) ?? '', r.openThread ?? '',
      r.lastContactedDaysAgo === undefined ? '' : daysAgo(today, r.lastContactedDaysAgo),
    ].map(csvCell).join(','),
  );
  return [HEADERS.join(','), ...lines].join('\n') + '\n';
}

/** Imports the bundled fictional contacts. Safe to run twice (email de-duplication). */
export async function loadSampleContacts(today = new Date()): Promise<ImportResult> {
  const parsed = parseCsvText(sampleContactsCsv(today), true);
  const { contacts } = applyMapping(parsed, suggestMapping(parsed.headers), {
    defaultType: 'client',
  });
  return importContacts(contacts);
}
