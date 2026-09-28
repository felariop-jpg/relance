import { useEffect } from 'react';

export interface ReviewKeyActions {
  move: (step: 1 | -1) => void;
  approve: () => void;
  skip: () => void;
  edit: () => void;
  rewrite: () => void;
  help: () => void;
  /** Called after Esc leaves a text field. */
  leaveField: () => void;
}

/**
 * j/k/a/s/e/r/? on the Review screen. Paused while a text field has focus
 * (Esc leaves the field) and while any dialog is open.
 */
export function useReviewKeys(actions: ReviewKeyActions): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const field = (e.target as HTMLElement | null)?.closest?.(
        'input, textarea, select, [contenteditable="true"]',
      ) as HTMLElement | null;
      if (field) {
        if (e.key === 'Escape') {
          e.preventDefault();
          field.blur();
          actions.leaveField();
        }
        return;
      }
      const handlers: Record<string, () => void> = {
        j: () => actions.move(1),
        k: () => actions.move(-1),
        a: actions.approve,
        s: actions.skip,
        e: actions.edit,
        r: actions.rewrite,
        '?': actions.help,
      };
      const handler = handlers[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);
}
