import type { Contact, Lang, Settings, Template } from '../db/schema';
import { resolveLanguage } from '../lib/language';
import { notesAvailable } from './redact';
import type { DraftOutput } from './schema';
import fixture from './demo-drafts.json';

type Pair = [string, string];
interface Fixture {
  families: Record<string, Record<Lang, { subject: string; body: string }>>;
  openings: Record<string, Record<Lang, Pair> & { workRelated?: boolean }>;
  generic: Record<Lang, Pair>;
  noNotes: Record<Lang, string>;
}
const data = fixture as unknown as Fixture;

/**
 * Demo mode (no API key): a canned draft from a committed fixture. Nothing is
 * sent anywhere. The sample contacts get openings that match their notes, so
 * the demo shows what personalisation looks like; other contacts get a
 * clearly-labelled generic example.
 */
export function demoOutput(
  contact: Contact,
  template: Template,
  settings: Pick<Settings, 'withheldFields' | 'defaultLanguage' | 'countryLanguageOverrides' | 'uiLanguage'>,
): { output: DraftOutput; personal: boolean } {
  const language = resolveLanguage(contact, settings);
  const report = settings.uiLanguage;
  const family = data.families[template.family] ?? data.families.other;
  const known = data.openings[contact.email.toLowerCase()];
  const hasNotes = notesAvailable(contact, settings);
  const skipOpening = template.family === 'holiday' && known?.workRelated;

  let opening: string;
  let used: string;
  let personal = false;
  if (!hasNotes) {
    opening = data.generic[language][0];
    used = data.noNotes[report];
  } else if (known && !skipOpening) {
    opening = known[language][0];
    used = known[report][1];
    personal = true;
  } else {
    opening = data.generic[language][0];
    used = data.generic[report][1];
  }
  const fill = (text: string) => text.replace('{{opening}}', opening);
  return {
    output: {
      subject: fill(family[language].subject),
      body: fill(family[language].body),
      language,
      personalizationUsed: used,
    },
    personal,
  };
}
