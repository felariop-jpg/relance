import type { Contact, Lang, Settings, Template } from '../db/schema';
import { resolveLanguage } from '../lib/language';
import { MAX_OUTPUT_TOKENS, MODEL } from './model';
import { notesAvailable, redactForApi, type RedactedContact } from './redact';
import { draftTool, TOOL_NAME } from './schema';

/** Shared rules sent with every generation. */
export const SYSTEM_PROMPT = `You write short, personal follow-up emails. The person using this tool reads, edits and sends every email themselves. Each email must read as if they wrote it individually to this one person: it is a relationship, not a lead, and this is not a mail merge.

Rules:
1. Write the whole email in the language given in "language" ("en" = English, "fr" = French). Never mix languages in one email, even if the notes or the template are in another language.
2. Keep the body under 150 words, in short paragraphs of one to three sentences.
3. Open with something specific to this person, taken from their notes. If "notesAvailable" is false, do not invent any personal detail: open warmly but simply, and say plainly in personalizationUsed that no notes were available.
4. Never invent facts, shared history, statistics, names, events or dates. If the notes do not support a claim, leave it out.
5. No pressure and no artificial urgency. Never write "just following up", "circling back", "I wanted to reach out", "touching base", "je me permets de vous relancer" or "je reviens vers vous".
6. End with a low-commitment invitation (for example, that they are welcome to reply whenever it suits them). Do not ask for a meeting or a call.
7. Follow the template's purpose and instructions. The template's reference text shows the purpose and tone; do not copy it word for word.
8. In French, use "vous". Where you can, avoid wording that assumes the gender of the recipient or the sender.
9. If "extraInstruction" is present, apply it, as long as it does not break the rules above.

Placeholders. The sender's own details are added later on the sender's computer. Use these tokens exactly, and never write or guess the real values:
- {{signature}}: the sign-off, on its own last line. Write nothing after it, and no name before it.
- {{calendlyLink}}: a booking link, on its own line, only if the template's reference text uses it.
- {{lastName}}: the recipient's surname, only if you truly need it.
Use no other {{...}} tokens. The recipient's surname, email address and phone number are deliberately not provided.

Voice samples. If "voiceSamples" is present, they are emails the sender actually wrote. Match their sentence length, warmth, greeting and sign-off habits, and level of formality. Never copy content, facts, names or phrases from them.

Output: call the ${TOOL_NAME} tool once. personalizationUsed is one short sentence written in "reportLanguage".`;

export interface PromptInput {
  contact: Contact;
  template: Template;
  settings: Pick<
    Settings,
    'withheldFields' | 'defaultLanguage' | 'countryLanguageOverrides' | 'voiceSamples' | 'uiLanguage'
  >;
  /** Optional regeneration instruction ("shorter", "plus formel"). */
  instruction?: string;
}

/** The data part of the request: everything contact-related goes through redactForApi. */
export interface PromptData {
  language: Lang;
  reportLanguage: Lang;
  notesAvailable: boolean;
  withheldByUser: string[];
  template: { name: string; instructions: string; referenceSubject: string; referenceText: string };
  contact: RedactedContact;
  voiceSamples?: string[];
  extraInstruction?: string;
}

export function buildPromptData({ contact, template, settings, instruction }: PromptInput): PromptData {
  const samples = settings.voiceSamples.map((s) => s.trim()).filter(Boolean);
  const data: PromptData = {
    language: resolveLanguage(contact, settings),
    reportLanguage: settings.uiLanguage,
    notesAvailable: notesAvailable(contact, settings),
    withheldByUser: [...settings.withheldFields],
    template: {
      name: template.name,
      instructions: template.instructions,
      referenceSubject: template.subject,
      referenceText: template.body,
    },
    contact: redactForApi(contact, settings),
  };
  if (samples.length > 0) data.voiceSamples = samples;
  if (instruction?.trim()) data.extraInstruction = instruction.trim();
  return data;
}

/** The exact request body sent to the Messages API. Also stored on the draft. */
export function buildRequest(input: PromptInput) {
  const data = buildPromptData(input);
  return {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [draftTool],
    tool_choice: { type: 'tool' as const, name: TOOL_NAME },
    messages: [{ role: 'user' as const, content: JSON.stringify(data, null, 2) }],
  };
}

export type DraftRequest = ReturnType<typeof buildRequest>;
