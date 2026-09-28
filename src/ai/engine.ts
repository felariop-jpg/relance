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
  cause?: { code?: string; message?: string };
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
  // No HTTP status means the request never got an answer: offline, timed out
  // (the SDK's timeout is a plain Error "Request timed out."), reset, DNS...
  const transport = `${err.name ?? ''} ${message} ${err.cause?.code ?? ''} ${err.cause?.message ?? ''}`;
  if (
    status === undefined &&
    (error instanceof TypeError ||
      /connection|network|fetch|timed? ?out|socket|offline|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|aborted/i.test(transport))
  ) {
    return new GenerationError('network', message || err.cause?.code || '');
  }
  return new GenerationError('unknown', message);
}

export const MAX_BUSY_RETRIES = 4;
/** Transient network failures (timeout, reset, dropped connection) are retried this many times. */
export const MAX_NETWORK_RETRIES = 3;

/** Whether the device has a connection, and a way to wait for one. Injected so tests control it. */
export interface Connectivity {
  isOnline(): boolean;
  waitForOnline(): Promise<void>;
}

export const browserConnectivity: Connectivity = {
  isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  waitForOnline: () =>
    new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || browserConnectivity.isOnline()) return resolve();
      window.addEventListener('online', () => resolve(), { once: true });
    }),
};

/** Node (the snapshot script) has no offline signal; retries cover dropped connections. */
export const alwaysOnline: Connectivity = { isOnline: () => true, waitForOnline: async () => {} };

/** Waits before retrying a network failure: about 2s, 4s, 8s. */
export function networkBackoffMs(attempt: number): number {
  return 2000 * 2 ** attempt + Math.floor(Math.random() * 400);
}

/** Waits before retrying a 429/529: the server's Retry-After if given, else 2s, 4s, 8s, 16s. */
export function backoffMs(attempt: number, suggested?: number): number {
  return Math.min(30_000, suggested ?? 2000 * 2 ** attempt) + Math.floor(Math.random() * 400);
}

/**
 * A gendered dual form such as « ravi(e) », « certain·e » or « heureux/se »:
 * reads like a form letter, so the reply counts as malformed.
 */
export function dualForm(text: string): string | null {
  return /\p{L}+(?:\((?:e|es|ne|nes|se|ses|le|les|ve|ves|ice|trice)\)|·(?:e|es|ne|se|rice)\b|\/(?:e|se|ve|ne)\b)/iu.exec(text)?.[0] ?? null;
}

export interface GenerateResult {
  output: DraftOutput;
  /** Summed over every attempt, including a discarded malformed one. */
  usage: TokenUsage;
}

export interface RetryOptions {
  sleep?: Sleep;
  connectivity?: Connectivity;
  /** True while waiting out a rate limit or overload. */
  onWaiting?: (waiting: boolean) => void;
  /** True while paused because the device is offline. */
  onOffline?: (offline: boolean) => void;
}

/**
 * Calls the model, retrying what is likely to succeed on a second try:
 * - rate limits and overload: back off (Retry-After if given), up to 4 times;
 * - network failures (timeout, reset, dropped connection): back off, up to 3 times;
 *   if the device is offline, wait for the connection without using up a retry;
 * - a malformed or wrong-language reply: once.
 * Anything else (a rejected key, no credit...) throws at once for this draft.
 */
export async function generateWithRetries(
  request: DraftRequest,
  expectedLanguage: Lang,
  send: Send,
  options: RetryOptions = {},
): Promise<GenerateResult> {
  const { sleep = realSleep, connectivity = browserConnectivity, onWaiting, onOffline } = options;
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let busyRetries = 0;
  let networkRetries = 0;
  let malformed = 0;
  for (;;) {
    let reply: Awaited<ReturnType<Send>>;
    try {
      reply = await send(request);
    } catch (error) {
      const failure = classifyError(error);
      if (failure.code === 'network') {
        if (!connectivity.isOnline()) {
          onOffline?.(true);
          await connectivity.waitForOnline();
          onOffline?.(false);
          continue;
        }
        if (networkRetries < MAX_NETWORK_RETRIES) {
          await sleep(networkBackoffMs(networkRetries));
          networkRetries++;
          continue;
        }
      }
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
    const dual = parsed.success ? dualForm(`${parsed.data.subject}\n${parsed.data.body}`) : null;
    if (parsed.success && parsed.data.language === expectedLanguage && !dual) return { output: parsed.data, usage };
    malformed++;
    if (malformed >= 2) {
      const detail = !parsed.success
        ? parsed.error.issues.map((i) => `${i.path.join('.') || 'reply'}: ${i.message}`).join('; ')
        : dual
          ? `dual gender form "${dual}"`
          : `language ${parsed.data.language}, expected ${expectedLanguage}`;
      const failure = new GenerationError('malformed', detail);
      Object.assign(failure, { usage });
      throw failure;
    }
  }
}
