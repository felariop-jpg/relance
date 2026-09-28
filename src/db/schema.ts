export const LANGUAGES = ['en', 'fr'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const CONTACT_TYPES = ['client', 'prospect', 'lead'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  /** ISO 3166-1 alpha-2, uppercase, or '' when unknown. */
  country: string;
  /** Explicit choice. null = automatic, see resolveLanguage(). */
  language: Lang | null;
  contactType: ContactType;
  /** What work was done together. Free text. */
  serviceHistory: string;
  /** The personalization hook: the most important field. */
  notes: string;
  /** YYYY-MM-DD, or null if never. */
  lastContacted: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ContactInput = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * pending/failed are generation lifecycle states; the four review states
 * (generated, edited, approved, skipped) come from the spec.
 */
export const DRAFT_STATUSES = [
  'pending',
  'failed',
  'generated',
  'edited',
  'approved',
  'skipped',
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/** ai = written by the model; demo = canned example (no API key); template = template text only. */
export type DraftSource = 'ai' | 'demo' | 'template';

export const DRAFT_ERROR_CODES = [
  'network',
  'auth',
  'rate_limit',
  'overloaded',
  'malformed',
  'billing',
  'interrupted',
  'unknown',
] as const;
export type DraftErrorCode = (typeof DRAFT_ERROR_CODES)[number];

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface Draft {
  id: string;
  contactId: string;
  templateId: string;
  subject: string;
  body: string;
  language: Lang;
  /** The model's own report of which detail it used. */
  personalizationUsed: string;
  status: DraftStatus;
  source: DraftSource;
  /** False when notes were empty or withheld: the card shows a warning. */
  notesAvailable: boolean;
  /** Exact JSON request body sent to the API (or that would have been, in demo mode). */
  payloadJson: string | null;
  usage: TokenUsage | null;
  costEur: number;
  error: { code: DraftErrorCode; detail: string } | null;
  /** Last extra instruction given when regenerating ("shorter", "plus formel"). */
  instruction: string;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Due in `month` (1–12) if at least `minGapDays` have passed since last contact. */
export interface ScheduleRule {
  month: number;
  minGapDays: number;
}

export interface Template {
  id: string;
  /** Shared by the EN and FR versions of the same template. */
  family: string;
  name: string;
  language: Lang;
  subject: string;
  body: string;
  /** Natural-language guidance passed to the model. */
  instructions: string;
  scheduleRule: ScheduleRule | null;
  /** Contact types this template is meant for. Empty = everyone. */
  appliesTo: ContactType[];
  isBuiltIn: boolean;
}

/**
 * The ONLY contact fields that may ever be sent to the Anthropic API.
 * This is an allowlist: a field added to Contact is withheld unless it is
 * deliberately added here. See src/ai/redact.ts and PRIVACY.md.
 */
export const API_FIELDS = [
  'firstName',
  'company',
  'country',
  'language',
  'contactType',
  'serviceHistory',
  'notes',
] as const satisfies readonly (keyof Contact)[];
export type ApiField = (typeof API_FIELDS)[number];

export const SETTINGS_ID = 'singleton';

export interface Settings {
  id: typeof SETTINGS_ID;
  apiKey: string;
  signature: string;
  calendlyLink: string;
  senderName: string;
  uiLanguage: Lang;
  /** Last step of language resolution. */
  defaultLanguage: Lang;
  /** ISO-2 country code → language. Empty by default. */
  countryLanguageOverrides: Record<string, Lang>;
  /** API fields the user chose never to send. Global, not per contact. */
  withheldFields: ApiField[];
  /** Up to 3 emails the user wrote, used as a style reference. */
  voiceSamples: string[];
  /** Running total of what generation has cost, in EUR. */
  costTotalEur: number;
  /** When the running total was last reset (ISO). */
  costSince: string;
  lastBackupAt: string | null;
  backupReminderSnoozedUntil: string | null;
  templatesSeeded: boolean;
  firstRunDone: boolean;
}

export const VOICE_SAMPLE_LIMIT = 3;
export const VOICE_SAMPLE_MAX_CHARS = 2000;
