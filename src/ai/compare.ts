import { db } from '../db/db';
import type { Contact, Template } from '../db/schema';
import { getSettings } from '../db/settings';
import { otherTemplatesFor } from '../db/templates';
import { todayIso } from '../lib/dates';
import { resolveLanguage } from '../lib/language';
import { fillPlaceholders, placeholderValues } from '../lib/placeholders';
import { anthropicSend } from './anthropic';
import { classifyError, generateWithRetries, type Send, type Sleep } from './engine';
import { addToRunningTotal } from './generate';
import { costEur } from './model';
import { buildRequest } from './prompt';

export type CompareSide =
  | { ok: true; subject: string; body: string; costEur: number; payloadJson: string }
  | { ok: false; code: string; costEur: number; payloadJson: string };

export interface VoiceComparison {
  withSamples: CompareSide;
  withoutSamples: CompareSide;
  totalEur: number;
}

/**
 * Writes the same email for one contact twice, once with the user's voice samples
 * and once without, so the user can see what the samples change. Nothing is saved
 * as a draft; both calls count towards the running cost total.
 */
export async function compareVoice(
  contact: Contact,
  template: Template,
  deps: { send?: Send; sleep?: Sleep; today?: string } = {},
): Promise<VoiceComparison> {
  const settings = await getSettings();
  const language = resolveLanguage(contact, settings);
  const otherTemplates = otherTemplatesFor(await db.templates.toArray(), template.family, language);
  const today = deps.today ?? todayIso();
  const send = deps.send ?? anthropicSend(settings.apiKey.trim());
  const values = placeholderValues(contact, settings);

  async function side(voiceSamples: string[]): Promise<CompareSide> {
    const request = buildRequest({ contact, template, settings: { ...settings, voiceSamples }, today, otherTemplates });
    const payloadJson = JSON.stringify(request);
    try {
      const { output, usage } = await generateWithRetries(request, language, send, { sleep: deps.sleep });
      return {
        ok: true,
        subject: fillPlaceholders(output.subject, values),
        body: fillPlaceholders(output.body, values),
        costEur: costEur(usage),
        payloadJson,
      };
    } catch (error) {
      const failure = classifyError(error);
      const spent = (failure as { usage?: { inputTokens: number; outputTokens: number } }).usage;
      return { ok: false, code: failure.code, costEur: spent ? costEur(spent) : 0, payloadJson };
    }
  }

  const [withSamples, withoutSamples] = await Promise.all([side(settings.voiceSamples), side([])]);
  const totalEur = withSamples.costEur + withoutSamples.costEur;
  await addToRunningTotal(totalEur);
  return { withSamples, withoutSamples, totalEur };
}
