import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/Checkbox';
import { WarningIcon } from '../../components/icons';
import type { Contact, Settings } from '../../db/schema';
import { countryName } from '../../lib/country';
import { formatDate } from '../../lib/dates';
import { resolveLanguage } from '../../lib/language';
import { contactName } from './ContactTable';

/** Small-screen fallback for the contacts table: one tappable row per contact. */
export function ContactList({
  contacts,
  settings,
  selected,
  onToggle,
  onEdit,
}: {
  contacts: Contact[];
  settings: Settings;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (contact: Contact) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
      {contacts.map((c) => {
        const name = contactName(c);
        return (
          <li key={c.id} className={`flex items-start gap-3 px-3 py-3 ${selected.has(c.id) ? 'bg-accent-50/70' : ''}`}>
            <Checkbox
              className="mt-1 h-5 w-5"
              checked={selected.has(c.id)}
              onChange={() => onToggle(c.id)}
              aria-label={t('contacts.selectRow', { name })}
            />
            <button
              type="button"
              onClick={() => onEdit(c)}
              aria-label={t('contacts.openContact', { name })}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block font-medium">{name}</span>
              <span className="block truncate text-sm text-stone-500">
                {[c.company, countryName(c.country, i18n.language)].filter(Boolean).join(' · ')}
              </span>
              <span className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded bg-stone-100 px-1.5 py-0.5">{t(`contactTypes.${c.contactType}`)}</span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5">
                  {t(`languages.${resolveLanguage(c, settings)}`)}
                </span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5">
                  {c.lastContacted ? formatDate(c.lastContacted, i18n.language) : t('contacts.never')}
                </span>
                {!c.notes && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                    <WarningIcon />
                    {t('contacts.noNotes')}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
