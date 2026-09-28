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
3. Opening. When "notesAvailable" is true, the first sentence after the greeting must be built from this contact's own specifics (something written in their notes, serviceHistory or whereMet). It must not be generic framing about the season, the time of year, the passing of time or why you are writing. When "notesAvailable" is false, do not invent any personal detail: open as "openingApproach" describes, and say plainly in personalizationUsed that no notes were available. If "openingApproach" conflicts with template.purpose, the purpose wins. Never use stock openings such as "Spring always feels like a good moment", "look up from the day-to-day", "it seemed a good moment to say hello", "It's been a while and I thought of you", "As the year winds down", « lever la tête du quotidien », « Alors que l'année se termine » or « Cela fait un moment ». Every recipient's email must read as written for them: two people must never receive the same opening sentence.
4. Facts. State only facts that are written in "notes" or "serviceHistory". You may reword a fact, but never add to it: no motive, reason, cause, feeling, outcome, circumstance or context that is not written there. If the notes say someone ran a race, do not say why, how it went or what it meant to them; if they mention a change at work, do not guess how it is going or how people feel about it. When unsure whether something is written, leave it out. Never invent shared history, events, statistics, names or dates.
5. No pressure and no artificial urgency. Never write "just following up", "circling back", "I wanted to reach out", "touching base", "je me permets de vous relancer" or "je reviens vers vous".
6. End with a low-commitment invitation (for example, that they are welcome to reply whenever it suits them). Do not ask for a meeting or a call.
7. Each kind of email has one job, given in "template.purpose"; do that job and only that one. "otherTemplates" lists the sender's other kinds of email and their jobs: do not drift into them. In particular, a check-in asks how the person is doing now and does not revisit past work beyond acknowledging that you know each other; a re-engagement leans on the time since you last spoke and on the specific thing left unresolved; a post-event email is about where you met ("whereMet") and what you talked about there; a greeting mentions no work at all. Follow "template.instructions" for what the email must achieve, contain and avoid. There is no model email to follow: the wording is yours, built from this contact's data.
8. In French, use "vous", and never assume the recipient's gender. For words about the sender: if "senderGender" is "feminine" or "masculine", make them agree with it, consistently. If "senderGender" is "unspecified", write every sentence about the sender so that it needs no gender agreement at all (for example « ce sera avec plaisir » or « j'en serais heureux » becomes « ce serait un plaisir »). Never write a dual form such as « ravi(e) », « certain·e » or « heureux/se ».
9. If "extraInstruction" is present, apply it, as long as it does not break the rules above.
10. Dates. "today" is today's date (YYYY-MM-DD); your own sense of the current year is not reliable. Work out every relative time reference ("last year", "this spring", "next year", "recently") from "today" and from dates written in the contact's data. Do not name a specific year unless that year is written in the contact's data. Never call something "last year", "this year" or "recent" unless a date in the data, compared with "today", shows it; otherwise leave the time reference out. For wishes about the coming year, write "the year ahead" rather than a year number.

Placeholders. The sender's own details are added later on the sender's computer. Use these tokens exactly, and never write or guess the real values:
- {{signature}}: the sign-off, on its own last line. Write nothing after it, and no name before it.
- {{calendlyLink}}: a booking link, on its own line, only if template.instructions asks for it.
- {{lastName}}: the recipient's surname, only if you truly need it.
Use no other {{...}} tokens. The recipient's surname, email address and phone number are deliberately not provided.

Voice samples. If "voiceSamples" is present, they are emails the sender actually wrote. Match their sentence length, warmth, greeting and sign-off habits, and level of formality. Never copy content, facts, names or phrases from them.

Output: call the ${TOOL_NAME} tool once. personalizationUsed is written in "reportLanguage" and must quote, in double quotation marks and exactly as written (in their original language), every phrase from "notes" or "serviceHistory" that the email draws on, for example: Used "promoted to head of operations" and "rethink how new managers are onboarded". If the email uses no such phrase, say so plainly.`;

/**
 * Ways to open when there are no notes. The code picks one per contact and
 * template (stable, so a rewrite doesn't flip it), because a model given the
 * same prompt picks the same opening every time.
 */
export const OPENING_APPROACHES = {
  work: 'Start from the work you did together, as written in serviceHistory, stated plainly and without adding detail.',
  question: 'Start with a short, direct question about how they are doing.',
  why: "Start with one plain sentence saying why you are writing, in terms of this email's purpose, without mentioning the season or the time of year.",
  company: 'Start from their organisation, named from "company", without guessing anything about it.',
  relationship: 'Start with one warm sentence acknowledging that you know each other, without claiming any shared history that is not written.',
} as const;
export type OpeningApproach = keyof typeof OPENING_APPROACHES;

function stableIndex(text: string, size: number): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % size;
}

export function chooseOpeningApproach(
  contact: Pick<Contact, 'id' | 'serviceHistory' | 'company'>,
  template: Pick<Template, 'family'>,
  settings: Pick<Settings, 'withheldFields'>,
): string {
  const sent = (field: 'serviceHistory' | 'company') => !settings.withheldFields.includes(field) && contact[field].trim() !== '';
  const options = (Object.keys(OPENING_APPROACHES) as OpeningApproach[]).filter(
    (a) => (a !== 'work' || sent('serviceHistory')) && (a !== 'company' || sent('company')),
  );
  return OPENING_APPROACHES[options[stableIndex(`${contact.id}:${template.family}`, options.length)]];
}

export interface PromptInput {
  contact: Contact;
  template: Template;
  settings: Pick<
    Settings,
    'withheldFields' | 'defaultLanguage' | 'countryLanguageOverrides' | 'voiceSamples' | 'uiLanguage' | 'senderGender'
  >;
  /** Optional regeneration instruction ("shorter", "plus formel"). */
  instruction?: string;
  /** The sender's other kinds of email (same language where possible), so the model can tell them apart. */
  otherTemplates?: { name: string; purpose: string }[];
  /** Today's date, YYYY-MM-DD, in the user's time zone. The model can't know it. */
  today: string;
}

/** The data part of the request: everything contact-related goes through redactForApi. */
export interface PromptData {
  today: string;
  language: Lang;
  reportLanguage: Lang;
  notesAvailable: boolean;
  withheldByUser: string[];
  template: { name: string; purpose: string; instructions: string };
  /** Only when notes are unavailable: how to open, varied per contact. */
  openingApproach?: string;
  otherTemplates: { name: string; purpose: string }[];
  contact: RedactedContact;
  voiceSamples?: string[];
  extraInstruction?: string;
  /** Only for French drafts: how words about the sender agree. */
  senderGender?: Settings['senderGender'];
}

export function buildPromptData({ contact, template, settings, instruction, today, otherTemplates = [] }: PromptInput): PromptData {
  const samples = settings.voiceSamples.map((s) => s.trim()).filter(Boolean);
  // Contact first: it is what a user checks in "What was sent to the AI".
  const data: PromptData = {
    today,
    contact: redactForApi(contact, settings),
    notesAvailable: notesAvailable(contact, settings),
    withheldByUser: [...settings.withheldFields],
    language: resolveLanguage(contact, settings),
    reportLanguage: settings.uiLanguage,
    template: {
      name: template.name,
      purpose: template.purpose,
      instructions: template.instructions,
    },
    otherTemplates: otherTemplates.filter((t) => t.purpose.trim()),
  };
  if (!data.notesAvailable) data.openingApproach = chooseOpeningApproach(contact, template, settings);
  if (data.language === 'fr') data.senderGender = settings.senderGender ?? 'unspecified';
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
