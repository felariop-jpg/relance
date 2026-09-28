import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const popoverSupported = typeof HTMLElement !== 'undefined' && 'togglePopover' in HTMLElement.prototype;

/**
 * A small "?" button that opens one or two sentences of help at the moment the
 * question comes up. Uses the browser's popover (top layer), so it is never
 * clipped inside a scrolling dialog; Escape and clicking elsewhere close it.
 */
export function HelpTip({ topic, children }: { topic: string; children: ReactNode }) {
  const { t } = useTranslation();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const b = button.current;
    const p = panel.current;
    if (!popoverSupported || !b || !p) return;
    // React 18 doesn't know these attributes yet.
    p.setAttribute('popover', 'auto');
    b.setAttribute('popovertarget', p.id);
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      if (isOpen) place(b, p);
    };
    p.addEventListener('toggle', onToggle);
    return () => p.removeEventListener('toggle', onToggle);
  }, []);

  return (
    <span className="inline-flex align-middle">
      <button
        ref={button}
        type="button"
        aria-label={t('help.label', { topic })}
        aria-expanded={open}
        aria-controls={id}
        onClick={popoverSupported ? undefined : () => setOpen((v) => !v)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 bg-white text-xs leading-none font-semibold text-stone-600 normal-case hover:border-accent-600 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-600"
      >
        ?
      </button>
      <div
        ref={panel}
        id={id}
        role="note"
        hidden={!popoverSupported && !open}
        className={`max-w-xs rounded-lg border border-stone-200 bg-white p-3 text-left text-sm font-normal whitespace-normal normal-case text-stone-700 shadow-lg ${popoverSupported ? '' : 'absolute z-20 mt-6'}`}
      >
        {children}
      </div>
    </span>
  );
}

/** Below the button, or above it when there's no room; never off-screen. */
function place(button: HTMLElement, panel: HTMLElement) {
  const b = button.getBoundingClientRect();
  const width = Math.min(288, window.innerWidth - 16);
  Object.assign(panel.style, { position: 'fixed', inset: 'auto', margin: '0', width: `${width}px` });
  panel.style.left = `${Math.min(Math.max(8, b.left + b.width / 2 - width / 2), window.innerWidth - width - 8)}px`;
  const below = b.bottom + 6;
  const height = panel.offsetHeight;
  panel.style.top = `${below + height > window.innerHeight - 8 ? Math.max(8, b.top - 6 - height) : below}px`;
}
