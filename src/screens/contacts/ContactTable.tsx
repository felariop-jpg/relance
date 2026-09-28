import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/Checkbox';
import { HelpTip } from '../../components/HelpTip';
import { PencilIcon, SortIcon, WarningIcon } from '../../components/icons';
import { updateContact } from '../../db/contacts';
import {
  CONTACT_TYPES,
  LANGUAGES,
  type Contact,
  type ContactInput,
  type Lang,
  type Settings,
} from '../../db/schema';
import { countryName } from '../../lib/country';
import { formatDate, isPlausibleDate, todayIso } from '../../lib/dates';
import { languageForCountry } from '../../lib/language';
import type { Sort, SortKey } from './sorting';

const inlineSelect =
  'w-full cursor-pointer rounded border border-transparent bg-transparent py-0.5 pr-1 text-sm hover:border-stone-300 focus:border-accent-600 focus:outline-none';

export function contactName(c: Contact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ');
}

interface Props {
  contacts: Contact[];
  settings: Settings;
  sort: Sort;
  onSort: (key: SortKey) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (contact: Contact) => void;
  onSaveError: () => void;
}

export function ContactTable({
  contacts,
  settings,
  sort,
  onSort,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onSaveError,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const selectedCount = contacts.filter((c) => selected.has(c.id)).length;
  const allSelected = contacts.length > 0 && selectedCount === contacts.length;

  const save = (id: string, patch: Partial<ContactInput>) =>
    updateContact(id, patch).catch(onSaveError);

  const header = (key: SortKey, extra = '', help?: ReactNode) => {
    const active = sort.key === key;
    const label = t(`fields.${key}`);
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
        className={`px-2 py-2 text-left font-medium whitespace-nowrap ${extra}`}
      >
        <button
          type="button"
          onClick={() => onSort(key)}
          title={t('contacts.sortBy', { column: label })}
          className={`inline-flex items-center gap-1 rounded hover:text-stone-900 ${active ? 'text-stone-900' : ''}`}
        >
          {label}
          <SortIcon dir={active ? sort.dir : null} className={active ? '' : 'opacity-40'} />
        </button>
        {help && <span className="ml-1">{help}</span>}
      </th>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-stone-50 text-xs text-stone-600">
          <tr>
            <th scope="col" className="w-10 px-3 py-2">
              <Checkbox
                checked={allSelected}
                indeterminate={selectedCount > 0 && !allSelected}
                onChange={onToggleAll}
                aria-label={t('contacts.selectAll')}
              />
            </th>
            {header('firstName')}
            {header('lastName')}
            {header('company')}
            {header('email', 'hidden 2xl:table-cell')}
            {header('country')}
            {header('language', '', <HelpTip topic={t('fields.language')}>{t('help.languageAuto')}</HelpTip>)}
            {header('contactType')}
            {header('lastContacted')}
            <th scope="col" className="px-2 py-2 text-left font-medium">
              {t('fields.notes')}
            </th>
            <th scope="col" className="w-10 px-2 py-2">
              <span className="sr-only">{t('contacts.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => {
            const name = contactName(c);
            const isSelected = selected.has(c.id);
            return (
              <tr
                key={c.id}
                className={`border-t border-stone-100 ${isSelected ? 'bg-accent-50/70' : 'hover:bg-stone-50'}`}
              >
                <td className="px-3 py-1.5">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggle(c.id)}
                    aria-label={t('contacts.selectRow', { name })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
                    className="text-left font-medium whitespace-nowrap text-stone-900 hover:underline"
                  >
                    {c.firstName}
                  </button>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">{c.lastName}</td>
                <td className="max-w-[11rem] truncate px-2 py-1.5" title={c.company}>
                  {c.company}
                </td>
                <td className="hidden max-w-[13rem] truncate px-2 py-1.5 text-stone-600 2xl:table-cell" title={c.email}>
                  {c.email}
                </td>
                <td className="max-w-[8rem] truncate px-2 py-1.5" title={countryName(c.country, locale)}>
                  {countryName(c.country, locale)}
                </td>
                <td className="px-1 py-1.5">
                  <select
                    className={`${inlineSelect} min-w-[7.5rem]`}
                    aria-label={t('contacts.cellLabel', { field: t('fields.language'), name })}
                    value={c.language ?? ''}
                    onChange={(e) => save(c.id, { language: (e.target.value || null) as Lang | null })}
                  >
                    <option value="">
                      {t('contacts.languageAuto', {
                        language: t(`languages.${languageForCountry(c.country, settings)}`),
                      })}
                    </option>
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {t(`languages.${lang}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1.5">
                  <select
                    className={`${inlineSelect} min-w-[6rem]`}
                    aria-label={t('contacts.cellLabel', { field: t('fields.contactType'), name })}
                    value={c.contactType}
                    onChange={(e) =>
                      save(c.id, { contactType: e.target.value as Contact['contactType'] })
                    }
                  >
                    {CONTACT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`contactTypes.${type}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1.5">
                  <DateCell
                    value={c.lastContacted}
                    label={t('contacts.cellLabel', { field: t('fields.lastContacted'), name })}
                    onSave={(lastContacted) => save(c.id, { lastContacted })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  {c.notes ? (
                    <span className="block w-[16rem] truncate text-stone-600" title={c.notes}>
                      {c.notes}
                    </span>
                  ) : (
                    <span
                      title={t('contacts.noNotesHint')}
                      className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-amber-900"
                    >
                      <WarningIcon />
                      {t('contacts.noNotes')}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
                    aria-label={t('contacts.editContact', { name })}
                    title={t('common.edit')}
                    className="rounded p-1.5 text-stone-500 hover:bg-stone-200/60 hover:text-stone-900"
                  >
                    <PencilIcon />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Shows the formatted date; becomes a date picker on click. Saves on Enter or
 * blur (not on every keystroke, which would store half-typed years).
 * Escape cancels.
 */
function DateCell({
  value,
  label,
  onSave,
}: {
  value: string | null;
  label: string;
  onSave: (value: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const next = draft || null;
    setDraft(null);
    if (next !== value && isPlausibleDate(next)) onSave(next);
  };

  if (draft !== null) {
    return (
      <input
        type="date"
        autoFocus
        aria-label={label}
        value={draft}
        max={todayIso()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
          }
        }}
        className="rounded border border-accent-600 px-1 py-0.5 text-sm"
      />
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setDraft(value ?? '')}
      className={`w-full rounded border border-transparent px-1 py-0.5 text-left whitespace-nowrap hover:border-stone-300 ${value ? '' : 'text-stone-400'}`}
    >
      {value ? formatDate(value, i18n.language) : t('contacts.never')}
    </button>
  );
}
