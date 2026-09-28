import { z } from 'zod';
import { LANGUAGES } from '../db/schema';

export const TOOL_NAME = 'save_draft';

/** What the model must return, validated before anything is saved. */
export const draftOutputSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  language: z.enum(LANGUAGES),
  personalizationUsed: z.string().trim().min(1).max(600),
});
export type DraftOutput = z.infer<typeof draftOutputSchema>;

export const draftTool = {
  name: TOOL_NAME,
  description: 'Save the finished email draft. Call this exactly once.',
  input_schema: {
    type: 'object' as const,
    properties: {
      subject: { type: 'string', description: 'Short, natural subject line in the email language.' },
      body: { type: 'string', description: 'The email as plain text. No Markdown.' },
      language: { type: 'string', enum: [...LANGUAGES], description: 'Language of the email.' },
      personalizationUsed: {
        type: 'string',
        description:
          'In reportLanguage: each source phrase used, in straight double quotes exactly as written in the data and in its original language, followed by "→ rendering" when the email is in another language; or "No source:" / "Aucune source :" and a short explanation.',
      },
    },
    required: ['subject', 'body', 'language', 'personalizationUsed'],
    additionalProperties: false,
  },
};
