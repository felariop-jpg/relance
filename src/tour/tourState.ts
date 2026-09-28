import { useSyncExternalStore } from 'react';
import { createPendingDrafts, generateDraft } from '../ai/generate';
import { db } from '../db/db';
import type { Contact, Draft } from '../db/schema';
import { getSettings, updateSettings } from '../db/settings';
import { canUseTemplate, groupFamilies, pickVersion } from '../db/templates';
import { resolveLanguage } from '../lib/language';
import { SAMPLE_EMAILS } from '../lib/sample';
import type { Route } from '../nav';

export type StepId = 'sample' | 'contacts' | 'due' | 'generate' | 'review' | 'export';

export interface TourStep {
  id: StepId;
  route: Route;
  /** CSS selectors: the first visible match, or with `union` the first visible match of each, together. */
  targets: string[];
  union?: boolean;
  /**
   * One step that shows two things in turn (the review card: its "Used" line, then
   * what was sent to the AI). Next moves through the parts before the next step.
   */
  parts?: { targets: string[]; body: 'tour.review.body' | 'tour.review.payload' }[];
}

/** The workflow, in the order a user actually works, not the order of the nav. */
export const STEPS: TourStep[] = [
  { id: 'sample', route: 'contacts', targets: [] },
  // Desktop: the Notes header and the first note. Phones: the contact list.
  { id: 'contacts', route: 'contacts', targets: ['[data-tour="notes"]', '[data-tour="notes-cell"]', '[data-tour="contacts"]'], union: true },
  { id: 'due', route: 'due', targets: ['[data-tour="due"]', '[data-tour="upcoming"]'], union: true },
  { id: 'generate', route: 'due', targets: ['[data-tour="generate"]'] },
  {
    id: 'review',
    route: 'review',
    targets: ['[data-tour="draft-used"]'],
    parts: [
      { targets: ['[data-tour="draft-used"]'], body: 'tour.review.body' },
      { targets: ['[data-tour="draft-payload"]'], body: 'tour.review.payload' },
    ],
  },
  { id: 'export', route: 'review', targets: ['[data-tour="export"]'] },
];

interface TourSnapshot {
  active: boolean;
  steps: TourStep[];
  index: number;
  /** Which part of a step with `parts` is showing. */
  part: number;
  /** Example drafts written by the tour, offered for removal at the end. */
  exampleIds: string[];
}

let state: TourSnapshot = { active: false, steps: [], index: 0, part: 0, exampleIds: [] };
const listeners = new Set<() => void>();
const set = (next: Partial<TourSnapshot>) => {
  state = { ...state, ...next };
  for (const l of listeners) l();
};

/** The current tour state, outside React. */
export const tourSnapshot = (): TourSnapshot => state;

export function useTour(): TourSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/**
 * Starts the tour. It runs on real content: with no contacts it opens by offering
 * the sample contacts; otherwise it uses the user's own.
 */
export async function startTour(): Promise<void> {
  const hasContacts = (await db.contacts.count()) > 0;
  set({ active: true, index: 0, part: 0, exampleIds: [], steps: STEPS.filter((s) => s.id !== 'sample' || !hasContacts) });
  await updateSettings({ tourState: 'started' });
}

export function goTo(index: number, part = 0): void {
  if (index >= 0 && index < state.steps.length) set({ index, part });
}

/** Next part of this step, else the next step. */
export function forward(): void {
  const parts = state.steps[state.index]?.parts;
  if (parts && state.part < parts.length - 1) set({ part: state.part + 1 });
  else goTo(state.index + 1);
}

/** Previous part of this step, else the previous step (at its last part). */
export function backward(): void {
  if (state.part > 0) return set({ part: state.part - 1 });
  const previous = state.steps[state.index - 1];
  if (previous) goTo(state.index - 1, previous.parts ? previous.parts.length - 1 : 0);
}

/** Skipping is remembered, so the tour never starts on its own again. */
export async function endTour(how: 'skipped' | 'finished'): Promise<void> {
  set({ active: false });
  await updateSettings({ tourState: how });
}

export function rememberExamples(ids: string[]): void {
  set({ exampleIds: [...state.exampleIds, ...ids] });
}

/** Drafts the review step can show: anything written, whatever its status. */
export function hasShowableDrafts(drafts: Draft[]): boolean {
  return drafts.some((d) => d.status !== 'pending' && d.status !== 'failed');
}

/**
 * Three free example drafts for the review step, marked "Example": the demo
 * writer, even when an API key is set, so the tour never spends anything or
 * sends anything. Prefers contacts with notes, and the sample contacts.
 */
export async function writeExampleDrafts(count = 3): Promise<string[]> {
  const [contacts, templates, settings] = await Promise.all([db.contacts.toArray(), db.templates.toArray(), getSettings()]);
  const sample = (c: Contact) => /@example\.(com|net|org)$/i.test(c.email);
  const chosen = [...contacts]
    .sort((a, b) => Number(sample(b)) - Number(sample(a)) || Number(!!b.notes.trim()) - Number(!!a.notes.trim()))
    .slice(0, count);
  const families = groupFamilies(templates, settings.uiLanguage);
  const ids: string[] = [];
  for (const contact of chosen) {
    const family = families.find((f) => {
      const template = pickVersion(f, resolveLanguage(contact, settings));
      return template && canUseTemplate(template, contact, settings.withheldFields);
    });
    if (!family) continue;
    const drafts = await createPendingDrafts([contact], family, settings);
    ids.push(...drafts.map((d) => d.id));
  }
  await Promise.all(ids.map((id) => generateDraft(id, { forceDemo: true, demoDelayMs: 250 })));
  return ids;
}

export const isSampleContact = (c: Pick<Contact, 'email'>) => SAMPLE_EMAILS.has(c.email.toLowerCase());

/** What "Start with my own contacts" would clear: the sample contacts, and the tour's other example drafts. */
export function tourLeftovers(contacts: Contact[], drafts: Draft[], exampleIds: string[]) {
  const samples = contacts.filter(isSampleContact);
  const sampleIds = new Set(samples.map((c) => c.id));
  const examples = drafts.filter((d) => exampleIds.includes(d.id) && !sampleIds.has(d.contactId));
  return { samples, examples };
}

/**
 * Clears the sample contacts (with all their drafts) and the tour's example drafts,
 * so Relance is back to an empty start. Made-up data, so it skips Recently deleted
 * (a new user would otherwise meet "Recently deleted (12)"); the returned undo puts
 * back whatever is still missing.
 */
export async function clearTourLeftovers(exampleIds: string[]): Promise<() => Promise<void>> {
  return db.transaction('rw', db.contacts, db.drafts, async () => {
    const [contacts, drafts] = await Promise.all([db.contacts.toArray(), db.drafts.toArray()]);
    const { samples, examples } = tourLeftovers(contacts, drafts, exampleIds);
    const sampleIds = new Set(samples.map((c) => c.id));
    const removedDrafts = [...drafts.filter((d) => sampleIds.has(d.contactId)), ...examples];
    await db.drafts.bulkDelete(removedDrafts.map((d) => d.id));
    await db.contacts.bulkDelete([...sampleIds]);
    return async () => {
      await db.transaction('rw', db.contacts, db.drafts, async () => {
        const haveContacts = new Set((await db.contacts.bulkGet([...sampleIds])).filter(Boolean).map((c) => c!.id));
        await db.contacts.bulkAdd(samples.filter((c) => !haveContacts.has(c.id)));
        const haveDrafts = new Set((await db.drafts.bulkGet(removedDrafts.map((d) => d.id))).filter(Boolean).map((d) => d!.id));
        await db.drafts.bulkAdd(removedDrafts.filter((d) => !haveDrafts.has(d.id)));
      });
    };
  });
}
