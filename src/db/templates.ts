import { db } from './db';
import type { Lang, Template } from './schema';
import { BUILT_IN_TEMPLATES } from './seed';
import { getSettings, updateSettings } from './settings';

/** Adds the built-in templates the first time the app runs. */
export async function ensureTemplatesSeeded(): Promise<void> {
  const settings = await getSettings();
  if (settings.templatesSeeded) return;
  await db.transaction('rw', db.templates, db.settings, async () => {
    await db.templates.bulkPut(BUILT_IN_TEMPLATES);
    await updateSettings({ templatesSeeded: true });
  });
}

/** Puts back any built-in template the user deleted. Never overwrites edits. */
export async function restoreBuiltInTemplates(): Promise<number> {
  const existing = new Set((await db.templates.toArray()).map((t) => t.id));
  const missing = BUILT_IN_TEMPLATES.filter((t) => !existing.has(t.id));
  await db.templates.bulkAdd(missing);
  return missing.length;
}

export interface TemplateFamily {
  family: string;
  /** Name in the requested language, falling back to any version. */
  name: string;
  versions: Partial<Record<Lang, Template>>;
}

export function groupFamilies(templates: Template[], lang: Lang): TemplateFamily[] {
  const map = new Map<string, TemplateFamily>();
  for (const t of templates) {
    const entry = map.get(t.family) ?? { family: t.family, name: t.name, versions: {} };
    entry.versions[t.language] = t;
    if (t.language === lang) entry.name = t.name;
    map.set(t.family, entry);
  }
  const order = BUILT_IN_TEMPLATES.map((t) => t.family);
  return [...map.values()].sort((a, b) => {
    const ia = order.indexOf(a.family);
    const ib = order.indexOf(b.family);
    if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.name.localeCompare(b.name);
  });
}

/** The version for a contact's language, or the other language if only one exists. */
export function pickVersion(family: TemplateFamily, lang: Lang): Template | undefined {
  return family.versions[lang] ?? Object.values(family.versions)[0];
}

/** A template that needs "where you met" can only be used for contacts that have it. */
export function canUseTemplate(template: Pick<Template, 'requiresWhereMet'>, contact: { whereMet?: string }): boolean {
  return !template.requiresWhereMet || Boolean(contact.whereMet?.trim());
}

/** The other families' names and purposes, in `lang` where available, for the prompt. */
export function otherTemplatesFor(templates: Template[], family: string, lang: Lang): { name: string; purpose: string }[] {
  return groupFamilies(templates, lang)
    .filter((f) => f.family !== family)
    .map((f) => pickVersion(f, lang))
    .filter((t): t is Template => Boolean(t))
    .map((t) => ({ name: t.name, purpose: t.purpose }));
}
