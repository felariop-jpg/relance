import { useSyncExternalStore } from 'react';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
  /** When present, the toast shows an Undo button. */
  undo?: () => void | Promise<void>;
}

export const UNDO_WINDOW_MS = 10_000;
const DEFAULT_MS = 6_000;

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

export function dismissToast(id: string): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/**
 * Shows a toast. Undo toasts stay 10 seconds; whatever the undo closure holds
 * (deleted rows, discarded edits) is released when the toast goes.
 */
export function showToast(toast: Omit<Toast, 'id'> & { durationMs?: number }): string {
  const id = crypto.randomUUID();
  const { durationMs, ...rest } = toast;
  toasts = [...toasts.slice(-3), { ...rest, id }];
  timers.set(id, setTimeout(() => dismissToast(id), durationMs ?? (toast.undo ? UNDO_WINDOW_MS : DEFAULT_MS)));
  emit();
  return id;
}

export async function runUndo(id: string): Promise<void> {
  const toast = toasts.find((t) => t.id === id);
  dismissToast(id);
  await toast?.undo?.();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => toasts);
}
