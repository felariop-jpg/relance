import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * A button that opens a small panel of links, buttons or checkboxes (a
 * disclosure, not an ARIA menu, so Tab moves through the items as usual).
 * Escape closes it and returns focus to the button; so does clicking
 * outside or tabbing away.
 */
export function Menu({
  button,
  buttonLabel,
  buttonClassName = '',
  align = 'right',
  children,
}: {
  button: ReactNode;
  /** Accessible name when the button shows only an icon or a symbol. */
  buttonLabel?: string;
  buttonClassName?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div
      ref={wrapper}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          // Only the menu closes: not a dialog or the tour underneath.
          e.stopPropagation();
          e.preventDefault();
          close();
        }
      }}
      onBlur={(e) => {
        if (open && !wrapper.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={buttonLabel}
        onClick={() => setOpen((v) => !v)}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          className={`absolute top-full z-40 mt-1 min-w-56 rounded-lg border border-stone-200 bg-white p-1 text-sm shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** Classes for a row inside a Menu (a link or a button). */
export const menuItemClass =
  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-accent-600';
