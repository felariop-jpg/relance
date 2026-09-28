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
          'One short sentence, in reportLanguage, naming the detail from the notes you used, or stating plainly that no notes were available.',
      },
    },
    required: ['subject', 'body', 'language', 'personalizationUsed'],
    additionalProperties: false,
  },
};
