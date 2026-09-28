import type { ReactNode } from 'react';

/** Input styling without a width, for inline controls. */
export const inputBase =
  'rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-accent-600 focus:outline-2 focus:outline-accent-600/30 aria-[invalid=true]:border-red-600';

export const inputClass = `${inputBase} block w-full`;

export function Field({
  id,
  label,
  hint,
  error,
  help,
  children,
  className = '',
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** A HelpTip shown after the label (outside it, so it isn't part of the field's name). */
  help?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {help ? (
        <div className="mb-1 flex items-center gap-1.5">
          <label htmlFor={id} className="text-sm font-medium text-stone-800">
            {label}
          </label>
          {help}
        </div>
      ) : (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-800">
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
