import type { ReactNode } from 'react';

export function Section({
  id,
  title,
  description,
  help,
  children,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  /** A HelpTip next to the title. */
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-stone-200 bg-white p-5">
      {help ? (
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          {help}
        </div>
      ) : (
        <h2 className="text-lg font-semibold">{title}</h2>
      )}
      {description && <div className="mt-1 max-w-2xl text-sm text-stone-600">{description}</div>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
