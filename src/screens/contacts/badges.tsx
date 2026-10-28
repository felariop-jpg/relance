import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningIcon } from '../../components/icons';
import type { ContactType, Lang } from '../../db/schema';

/** One colour per type, dark enough text for contrast on the light background. */
export const TYPE_BADGE: Record<ContactType, string> = {
  client: 'bg-accent-50 text-accent-800 ring-accent-100',
  prospect: 'bg-sky-50 text-sky-800 ring-sky-200',
  lead: 'bg-violet-50 text-violet-800 ring-violet-200',
};

const badge = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset';

export function TypeBadge({ type }: { type: ContactType }) {
  const { t } = useTranslation();
  return <span className={`${badge} ${TYPE_BADGE[type]}`}>{t(`contactTypes.${type}`)}</span>;
}

/** "EN" or "FR"; automatic languages get a quieter style and a small "auto". */
export function LanguageBadge({ language, auto }: { language: Lang; auto: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={`${badge} ${auto ? 'bg-white text-stone-700 ring-stone-300' : 'bg-stone-100 text-stone-800 ring-stone-300'}`}>
      <span className="uppercase">{language}</span>
      {auto && <span className="font-normal text-stone-600">{t('contacts.auto')}</span>}
    </span>
  );
}

export function NoNotesBadge() {
  const { t } = useTranslation();
  return (
    <span title={t('contacts.noNotesHint')} className={`${badge} bg-amber-100 text-amber-900 ring-amber-200`}>
      <WarningIcon />
      {t('contacts.noNotes')}
    </span>
  );
}

export function DueBadge() {
  const { t } = useTranslation();
  return (
    <span title={t('contacts.dueHint')} className={`${badge} bg-accent-700 text-white ring-accent-700`}>
      {t('contacts.due')}
    </span>
  );
}

/**
 * A badge that turns into a drop-down when clicked (or Enter/Space on it), so
 * the table isn't a wall of drop-downs. Saves on change; Escape or leaving
 * the field puts the badge back.
 */
export function BadgeSelect<V extends string>({
  label,
  value,
  options,
  onSave,
  children,
}: {
  /** Accessible name, e.g. "Type: Anne Martin". */
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onSave: (value: V) => void;
  /** The badge shown while not editing. */
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <select
        autoFocus
        aria-label={label}
        value={value}
        className="rounded border border-accent-600 bg-white py-0.5 pr-1 text-sm focus:outline-none"
        onChange={(e) => {
          setEditing(false);
          if (e.target.value !== value) onSave(e.target.value as V);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setEditing(false);
          }
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <button
      type="button"
      // The visible badge text is the value; say both what it is and whose it is.
      aria-label={`${label}, ${options.find((o) => o.value === value)?.label ?? value}`}
      onClick={() => setEditing(true)}
      className="rounded-full hover:ring-2 hover:ring-stone-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600"
    >
      {children}
    </button>
  );
}

