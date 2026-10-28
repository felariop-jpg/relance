import type { Contact, ContactType, Draft, Settings, Template } from '../../db/schema';
import { dueGroups, nextBatch, upcoming, type Upcoming } from '../../lib/schedule';

export const SETUP_ITEMS = ['apiKey', 'senderName', 'contacts', 'backup'] as const;
export type SetupItem = (typeof SETUP_ITEMS)[number];

/** Drafts still waiting for a decision (same count as the Review tab). */
export const REVIEW_STATUSES: Draft['status'][] = ['generated', 'edited', 'failed', 'pending'];

export interface OverviewData {
  setup: Record<SetupItem, boolean>;
  setupDone: boolean;
  counts: Record<'total' | 'noNotes' | ContactType, number>;
  /** People due this month and not drafted yet, per template. */
  due: { people: number; groups: { family: string; name: string; count: number }[] };
  next: Upcoming | undefined;
  drafts: { toReview: number; approvedNotExported: number };
}

/** Everything the Overview shows, from local data only. */
export function overviewData(
  contacts: Contact[],
  drafts: Draft[],
  templates: Template[],
  settings: Settings,
  today: Date,
): OverviewData {
  const setup: Record<SetupItem, boolean> = {
    apiKey: settings.apiKey.trim() !== '',
    senderName: settings.senderName.trim() !== '',
    contacts: contacts.length > 0,
    backup: settings.lastBackupAt !== null,
  };
  const groups = dueGroups(contacts, templates, drafts, settings, today)
    .map((g) => ({ family: g.family.family, name: g.family.name, ids: g.entries.filter((e) => !e.hasOpenDraft).map((e) => e.contact.id) }))
    .filter((g) => g.ids.length > 0);
  return {
    setup,
    setupDone: SETUP_ITEMS.every((item) => setup[item]),
    counts: {
      total: contacts.length,
      client: contacts.filter((c) => c.contactType === 'client').length,
      prospect: contacts.filter((c) => c.contactType === 'prospect').length,
      lead: contacts.filter((c) => c.contactType === 'lead').length,
      noNotes: contacts.filter((c) => !c.notes.trim()).length,
    },
    due: {
      people: new Set(groups.flatMap((g) => g.ids)).size,
      groups: groups.map(({ family, name, ids }) => ({ family, name, count: ids.length })),
    },
    next: nextBatch(upcoming(contacts, templates, settings, today)),
    drafts: {
      toReview: drafts.filter((d) => REVIEW_STATUSES.includes(d.status)).length,
      approvedNotExported: drafts.filter((d) => d.status === 'approved' && !d.exportedAt).length,
    },
  };
}
