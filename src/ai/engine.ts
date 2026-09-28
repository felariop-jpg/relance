import type { DraftErrorCode, Lang, TokenUsage } from '../db/schema';
import type { DraftRequest } from './prompt';
import { draftOutputSchema, type DraftOutput } from './schema';

/** One call to the model. Injected so tests and the snapshot script can swap it. */
export type Send = (request: DraftRequest) => Promise<{ toolInput: unknown; usage: TokenUsage }>;
export type Sleep = (ms: number) => Promise<void>;

export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class GenerationError extends Error {
  constructor(
    readonly code: DraftErrorCode,
    readonly detail = '',
    readonly retryAfterMs?: number,
  ) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
  }
}

interface ErrorLike {
  status?: number;
  name?: string;
  message?: string;
  headers?: { get?: (name: string) => string | null } | Record<string, string>;
}

function retryAfter(err: ErrorLike): number | undefined {
  const h = err.headers;
  const raw =
    h && typeof (h as { get?: unknown }).get === 'function'
      ? (h as { get: (n: string) => string | null }).get('retry-after')
      : (h as Record<string, string> | undefined)?.['retry-after'];
  const seconds = raw ? Number(raw) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

/** Maps SDK/network errors to the codes the Review card explains. */
export function classifyError(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error;
  const err = (error ?? {}) as ErrorLike;
  const status = typeof err.status === 'number' ? err.status : undefined;
  const message = (err.message ?? '').slice(0, 300);
  if (status === 401 || status === 403) return new GenerationError('auth', message);
  if (status === 429) return new GenerationError('rate_limit', message, retryAfter(err));
  if (status === 529 || (status !== undefined && status >= 500)) {
    return new GenerationError('overloaded', message, retryAfter(err));
  }
  if (status === 400 && /credit balance|billing/i.test(message)) return new GenerationError('billing', message);
  if (status === undefined && (/connection|network|fetch|timeout/i.test(`${err.name} ${message}`) || error instanceof TypeError)) {
    return new GenerationError('network', message);
  }
  return new GenerationError('unknown', message);
}

export const MAX_BUSY_RETRIES = 4;

/** Waits before retrying a 429/529: the server's Retry-After if given, else 2s, 4s, 8s, 16s. */
export function backoffMs(attempt: number, suggested?: number): number {
  return Math.min(30_000, suggested ?? 2000 * 2 ** attempt) + Math.floor(Math.random() * 400);
}

export interface GenerateResult {
  output: DraftOutput;
  /** Summed over every attempt, including a discarded malformed one. */
  usage: TokenUsage;
}

/**
 * Calls the model with automatic back-off on rate limits and overload, and one
 * retry for a malformed or wrong-language reply. Anything else throws a
 * GenerationError for that single draft.
 */
export async function generateWithRetries(
  request: DraftRequest,
  expectedLanguage: Lang,
  send: Send,
  sleep: Sleep = realSleep,
  onWaiting?: (waiting: boolean) => void,
): Promise<GenerateResult> {
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let busyRetries = 0;
  let malformed = 0;
  for (;;) {
    let reply: Awaited<ReturnType<Send>>;
    try {
      reply = await send(request);
    } catch (error) {
      const failure = classifyError(error);
      const busy = failure.code === 'rate_limit' || failure.code === 'overloaded';
      if (busy && busyRetries < MAX_BUSY_RETRIES) {
        onWaiting?.(true);
        await sleep(backoffMs(busyRetries, failure.retryAfterMs));
        onWaiting?.(false);
        busyRetries++;
        continue;
      }
      throw failure;
    }
    usage.inputTokens += reply.usage.inputTokens;
    usage.outputTokens += reply.usage.outputTokens;
    const parsed = draftOutputSchema.safeParse(reply.toolInput);
    if (parsed.success && parsed.data.language === expectedLanguage) return { output: parsed.data, usage };
    malformed++;
    if (malformed >= 2) {
      const detail = parsed.success
        ? `language ${parsed.data.language}, expected ${expectedLanguage}`
        : parsed.error.issues.map((i) => `${i.path.join('.') || 'reply'}: ${i.message}`).join('; ');
      const failure = new GenerationError('malformed', detail);
      Object.assign(failure, { usage });
      throw failure;
    }
  }
}
