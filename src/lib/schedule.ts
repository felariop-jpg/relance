import type { Contact, Draft, ScheduleRule, Settings, Template } from '../db/schema';
import { canUseTemplate, groupFamilies, pickVersion, type TemplateFamily } from '../db/templates';
import { resolveLanguage } from './language';

const DAY = 86_400_000;

/** Whole days from an ISO date (YYYY-MM-DD) to `today`, in the user's calendar. */
export function daysSince(iso: string, today: Date): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(y, m - 1, d)) / DAY,
  );
}

/** A template's rule applies this month, to this type of contact, after the gap. */
export function isDue(
  contact: Pick<Contact, 'contactType' | 'lastContacted'>,
  rule: ScheduleRule,
  appliesTo: Template['appliesTo'],
  today: Date,
): boolean {
  if (rule.month !== today.getMonth() + 1) return false;
  if (appliesTo.length > 0 && !appliesTo.includes(contact.contactType)) return false;
  if (!contact.lastContacted) return true;
  return daysSince(contact.lastContacted, today) >= rule.minGapDays;
}

/** Drafts that are still in play block a second one for the same template family. */
export function openDraftKeys(drafts: Draft[], templates: Template[]): Set<string> {
  const familyOf = new Map(templates.map((t) => [t.id, t.family]));
  const keys = new Set<string>();
  for (const d of drafts) {
    if (d.exportedAt || d.status === 'skipped') continue;
    const family = familyOf.get(d.templateId);
    if (family) keys.add(`${d.contactId}:${family}`);
  }
  return keys;
}

export interface DueEntry {
  contact: Contact;
  template: Template;
  daysSince: number | null;
  /** Already has an unsent, unskipped draft from this template family. */
  hasOpenDraft: boolean;
}

export interface DueGroup {
  family: TemplateFamily;
  rule: ScheduleRule;
  appliesTo: Template['appliesTo'];
  entries: DueEntry[];
}

/** The rule and audience of a family (both language versions normally share them). */
export function familyRule(family: TemplateFamily): { rule: ScheduleRule | null; appliesTo: Template['appliesTo'] } {
  const version = family.versions.en ?? family.versions.fr;
  return { rule: version?.scheduleRule ?? null, appliesTo: version?.appliesTo ?? [] };
}

export function dueGroups(
  contacts: Contact[],
  templates: Template[],
  drafts: Draft[],
  settings: Settings,
  today: Date,
): DueGroup[] {
  const open = openDraftKeys(drafts, templates);
  return groupFamilies(templates, settings.uiLanguage).flatMap((family) => {
    const { rule, appliesTo } = familyRule(family);
    if (!rule) return [];
    const entries = contacts
      .filter((c) => isDue(c, rule, appliesTo, today))
      .flatMap((contact) => {
        const template = pickVersion(family, resolveLanguage(contact, settings));
        if (!template || !canUseTemplate(template, contact, settings.withheldFields)) return [];
        return [
          {
            contact,
            template,
            daysSince: contact.lastContacted ? daysSince(contact.lastContacted, today) : null,
            hasOpenDraft: open.has(`${contact.id}:${family.family}`),
          },
        ];
      })
      .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity));
    return entries.length > 0 ? [{ family, rule, appliesTo, entries }] : [];
  });
}

export interface Upcoming {
  family: TemplateFamily;
  rule: ScheduleRule;
  appliesTo: Template['appliesTo'];
  month: number;
  count: number;
  /** The contacts counted, so "Write these emails" can start with them. */
  contactIds: string[];
}

/** Would this contact get this family's email in the rule's month (type, gap, required details)? */
function qualifies(contact: Contact, family: TemplateFamily, rule: ScheduleRule, appliesTo: Template['appliesTo'], settings: Settings, when: Date): boolean {
  if (!isDue(contact, rule, appliesTo, when)) return false;
  const template = pickVersion(family, resolveLanguage(contact, settings));
  return !!template && canUseTemplate(template, contact, settings.withheldFields);
}

/**
 * Scheduled templates in the next 12 months (excluding this one), soonest first.
 * Counts use the same checks as Due now, as things stand on the 1st of that month.
 */
export function upcoming(contacts: Contact[], templates: Template[], settings: Settings, today: Date): Upcoming[] {
  const current = today.getMonth() + 1;
  return groupFamilies(templates, settings.uiLanguage)
    .flatMap((family) => {
      const { rule, appliesTo } = familyRule(family);
      if (!rule || rule.month === current) return [];
      const year = today.getFullYear() + (rule.month < current ? 1 : 0);
      const firstOfMonth = new Date(year, rule.month - 1, 1);
      const contactIds = contacts.filter((c) => qualifies(c, family, rule, appliesTo, settings, firstOfMonth)).map((c) => c.id);
      return [{ family, rule, appliesTo, month: rule.month, count: contactIds.length, contactIds }];
    })
    .sort((a, b) => ((a.month - current + 12) % 12) - ((b.month - current + 12) % 12));
}

/** The batch to headline when nobody is due: the soonest one that will include someone, else the soonest. */
export function nextBatch(list: Upcoming[]): Upcoming | undefined {
  return list.find((u) => u.count > 0) ?? list[0];
}

/** Whether any template is scheduled for today's month (to explain an empty Due now). */
export function anyScheduledThisMonth(templates: Template[], settings: Settings, today: Date): boolean {
  const current = today.getMonth() + 1;
  return groupFamilies(templates, settings.uiLanguage).some((f) => familyRule(f).rule?.month === current);
}
