import { db } from '../db/db';
import { updateDraft } from '../db/drafts';
import type { Draft } from '../db/schema';
import { showToast } from '../lib/toast';
import { generateDraft, type GenerateDeps } from './generate';

const RESTORABLE = [
  'subject',
  'body',
  'language',
  'personalizationUsed',
  'status',
  'source',
  'notesAvailable',
  'payloadJson',
  'usage',
  'costEur',
  'error',
  'instruction',
] as const satisfies readonly (keyof Draft)[];

/**
 * Rewrites one draft, optionally with an instruction. The previous version is
 * kept in memory so the toast can put it back.
 */
export async function rewriteDraft(
  id: string,
  instruction: string,
  messages: { done: string },
  deps: GenerateDeps = {},
): Promise<void> {
  const before = await db.drafts.get(id);
  if (!before) return;
  const snapshot = Object.fromEntries(RESTORABLE.map((k) => [k, before[k]])) as Partial<Draft>;
  await updateDraft(id, { instruction: instruction.trim() });
  const outcome = await generateDraft(id, deps);
  if (outcome.ok) {
    showToast({ tone: 'success', message: messages.done, undo: () => updateDraft(id, snapshot) });
  }
}
