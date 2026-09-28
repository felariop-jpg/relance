import { db } from '../db/db';
import { newDraft, updateDraft } from '../db/drafts';
import { SETTINGS_ID, type Contact, type Draft, type Settings } from '../db/schema';
import { getSettings } from '../db/settings';
import { canUseTemplate, otherTemplatesFor, pickVersion, type TemplateFamily } from '../db/templates';
import { resolveLanguage } from '../lib/language';
import { todayIso } from '../lib/dates';
import { needsInput } from '../lib/needsInput';
import { fillPlaceholders, placeholderValues } from '../lib/placeholders';
import { anthropicSend } from './anthropic';
import { demoOutput } from './demo';
import { classifyError, generateWithRetries, realSleep, type Connectivity, type Send, type Sleep } from './engine';
import { costEur } from './model';
import { buildRequest } from './prompt';
import { notesAvailable } from './redact';

export interface GenerateDeps {
  /** Defaults to the Anthropic API with the key from settings. */
  send?: Send;
  sleep?: Sleep;
  /** Pause before a demo draft appears, so demo mode feels like the real thing. */
  demoDelayMs?: number;
  onWaiting?: (waiting: boolean) => void;
  connectivity?: Connectivity;
  onOffline?: (offline: boolean) => void;
}

export type GenerateOutcome =
  | { ok: true; costEur: number; needsInput: boolean }
  | { ok: false; code: string; costEur: number };

async function addToRunningTotal(cost: number): Promise<void> {
  if (cost <= 0) return;
  await db.settings
    .where('id')
    .equals(SETTINGS_ID)
    .modify((s) => {
      s.costTotalEur = (s.costTotalEur ?? 0) + cost;
    });
}

/**
 * Writes one draft. Each draft is saved on its own, so a failure here never
 * touches any other draft in the batch.
 */
export async function generateDraft(draftId: string, deps: GenerateDeps = {}): Promise<GenerateOutcome> {
  const sleep = deps.sleep ?? realSleep;
  const draft = await db.drafts.get(draftId);
  if (!draft) return { ok: false, code: 'unknown', costEur: 0 };
  const [contact, template, settings] = await Promise.all([
    db.contacts.get(draft.contactId),
    db.templates.get(draft.templateId),
    getSettings(),
  ]);
  if (!contact || !template) {
    await updateDraft(draftId, { status: 'failed', error: { code: 'unknown', detail: 'missing contact or template' } });
    return { ok: false, code: 'unknown', costEur: 0 };
  }

  const otherTemplates = otherTemplatesFor(await db.templates.toArray(), template.family, resolveLanguage(contact, settings));
  const request = buildRequest({ contact, template, settings, instruction: draft.instruction, today: todayIso(), otherTemplates });
  const language = resolveLanguage(contact, settings);
  const demo = !settings.apiKey.trim() && !deps.send;
  await updateDraft(draftId, { status: 'pending', error: null, payloadJson: JSON.stringify(request) });

  try {
    let output;
    let usage = null;
    let personal = notesAvailable(contact, settings);
    if (demo) {
      const result = demoOutput(contact, template, settings);
      output = result.output;
      personal = result.personal;
      await sleep(deps.demoDelayMs ?? 350 + Math.floor(Math.random() * 500));
    } else {
      const send = deps.send ?? anthropicSend(settings.apiKey.trim());
      const result = await generateWithRetries(request, language, send, {
        sleep,
        connectivity: deps.connectivity,
        onWaiting: deps.onWaiting,
        onOffline: deps.onOffline,
      });
      output = result.output;
      usage = result.usage;
    }
    const cost = usage ? costEur(usage) : 0;
    const values = placeholderValues(contact, settings);
    await updateDraft(draftId, {
      subject: fillPlaceholders(output.subject, values),
      body: fillPlaceholders(output.body, values),
      language: output.language,
      personalizationUsed: output.personalizationUsed,
      status: 'generated',
      source: demo ? 'demo' : 'ai',
      notesAvailable: personal,
      usage,
      costEur: cost,
      error: null,
    });
    await addToRunningTotal(cost);
    return { ok: true, costEur: cost, needsInput: needsInput(output) };
  } catch (error) {
    const failure = classifyError(error);
    // A malformed reply still used tokens; they count towards the real cost.
    const spent = (failure as { usage?: { inputTokens: number; outputTokens: number } }).usage;
    const cost = spent ? costEur(spent) : 0;
    await updateDraft(draftId, { status: 'failed', error: { code: failure.code, detail: failure.detail } });
    await addToRunningTotal(cost);
    return { ok: false, code: failure.code, costEur: cost };
  }
}

/** Creates one pending card per contact, in each contact's language. */
export async function createPendingDrafts(
  contacts: Contact[],
  family: TemplateFamily,
  settings: Settings,
): Promise<Draft[]> {
  const drafts = contacts.flatMap((contact) => {
    const language = resolveLanguage(contact, settings);
    const template = pickVersion(family, language);
    if (!template || !canUseTemplate(template, contact, settings.withheldFields)) return [];
    return [
      newDraft({
        contactId: contact.id,
        templateId: template.id,
        language,
        status: 'pending',
        source: settings.apiKey.trim() ? 'ai' : 'demo',
        notesAvailable: notesAvailable(contact, settings),
      }),
    ];
  });
  await db.drafts.bulkAdd(drafts);
  return drafts;
}
