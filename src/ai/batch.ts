import { useSyncExternalStore } from 'react';
import { updateDraft } from '../db/drafts';
import { generateDraft, type GenerateDeps } from './generate';

/** How many drafts are written at the same time. */
export const CONCURRENCY = 3;

export interface BatchState {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  costEur: number;
  /** A 401 stopped the batch: the key needs fixing before anything else can work. */
  authFailed: boolean;
  /** Waiting out a rate limit before retrying automatically. */
  waiting: boolean;
}

const idle: BatchState = { running: false, total: 0, done: 0, failed: 0, costEur: 0, authFailed: false, waiting: false };
let state: BatchState = idle;
let queue: string[] = [];
let active = 0;
let waitingCount = 0;
let deps: GenerateDeps = {};
const listeners = new Set<() => void>();

function set(patch: Partial<BatchState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** For tests: replace the network and timers. */
export function setBatchDeps(next: GenerateDeps): void {
  deps = next;
}

export function resetBatch(): void {
  queue = [];
  active = 0;
  waitingCount = 0;
  set(idle);
}

/**
 * Queues drafts for writing. Each draft succeeds or fails on its own; a
 * failure never stops the others, except a rejected API key, after which the
 * rest are marked with the same error instead of making calls bound to fail.
 */
export function enqueueDrafts(ids: string[]): void {
  if (ids.length === 0) return;
  if (!state.running) set({ ...idle, running: true, total: ids.length });
  else set({ total: state.total + ids.length, authFailed: false });
  queue.push(...ids);
  pump();
}

function pump() {
  while (active < CONCURRENCY && queue.length > 0) {
    const id = queue.shift()!;
    active++;
    void work(id).finally(() => {
      active--;
      if (queue.length === 0 && active === 0) set({ running: false, waiting: false });
      else pump();
    });
  }
}

async function work(id: string) {
  if (state.authFailed) {
    await updateDraft(id, { status: 'failed', error: { code: 'auth', detail: '' } });
    set({ failed: state.failed + 1 });
    return;
  }
  const outcome = await generateDraft(id, {
    ...deps,
    onWaiting: (waiting) => {
      waitingCount += waiting ? 1 : -1;
      set({ waiting: waitingCount > 0 });
    },
  });
  if (outcome.ok) set({ done: state.done + 1, costEur: state.costEur + outcome.costEur });
  else {
    set({
      failed: state.failed + 1,
      costEur: state.costEur + outcome.costEur,
      authFailed: state.authFailed || outcome.code === 'auth',
    });
  }
}

export function getBatchState(): BatchState {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBatch(): BatchState {
  return useSyncExternalStore(subscribe, getBatchState, getBatchState);
}
