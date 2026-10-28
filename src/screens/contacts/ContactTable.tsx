import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/Checkbox';
import { HelpTip } from '../../components/HelpTip';
import { PencilIcon, SortIcon } from '../../components/icons';
import { updateContact } from '../../db/contacts';
import {
  CONTACT_TYPES,
  LANGUAGES,
  type Contact,
  type ContactInput,
  type Lang,
  type OptionalColumn,
  type Settings,
} from '../../db/schema';
import { countryName } from '../../lib/country';
import { formatDate, isPlausibleDate, todayIso } from '../../lib/dates';
import { languageForCountry, resolveLanguage } from '../../lib/language';
import { BadgeSelect, DueBadge, LanguageBadge, NoNotesBadge, TypeBadge } from './badges';
import type { Sort, SortKey } from './sorting';

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
  /** Contacts due this month and not drafted yet: they get a "Due" badge. */
  dueIds: Set<string>;
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
  dueIds,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const selectedCount = contacts.filter((c) => selected.has(c.id)).length;
  const allSelected = contacts.length > 0 && selectedCount === contacts.length;
  const shown = new Set<OptionalColumn>(settings.contactColumns);

  const save = (id: string, patch: Partial<ContactInput>) =>
    updateContact(id, patch).catch(onSaveError);

  const typeOptions = CONTACT_TYPES.map((type) => ({ value: type, label: t(`contactTypes.${type}`) }));

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
          className={`inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-stone-200/70 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-accent-600 ${active ? 'bg-accent-50 font-semibold text-accent-800' : ''}`}
        >
          {label}
          <SortIcon dir={active ? sort.dir : null} className={active ? 'text-sm' : 'text-sm opacity-60'} />
        </button>
        {help && <span className="ml-1">{help}</span>}
      </th>
    );
  };
  const plain = (column: OptionalColumn) => (
    <th scope="col" className="px-2 py-2 text-left font-medium whitespace-nowrap">
      {t(`fields.${column}`)}
    </th>
  );

  return (
    // Scrolls inside itself (both ways) so the header row can stay visible.
    <div className="relative max-h-[calc(100dvh-15rem)] min-h-64 overflow-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-stone-50 text-xs text-stone-700 shadow-[0_1px_0_var(--color-stone-200)]">
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
            {shown.has('email') && header('email')}
            {shown.has('phone') && plain('phone')}
            {shown.has('externalId') && plain('externalId')}
            {header('country')}
            {header('language', '', <HelpTip topic={t('fields.language')}>{t('help.languageAuto')}</HelpTip>)}
            {header('contactType')}
            {header('lastContacted')}
            {shown.has('whereMet') && plain('whereMet')}
            <th scope="col" data-tour="notes" className="w-full min-w-[16rem] px-2 py-2 text-left font-medium">
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
            const language = resolveLanguage(c, settings);
            return (
              <tr
                key={c.id}
                className={`border-t border-stone-100 align-top ${isSelected ? 'bg-accent-50/70 hover:bg-accent-50' : 'hover:bg-stone-100/80'}`}
              >
                <td className="px-3 py-2">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggle(c.id)}
                    aria-label={t('contacts.selectRow', { name })}
                  />
                </td>
                <td className="px-2 py-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      className="text-left font-medium whitespace-nowrap text-stone-900 hover:underline"
                    >
                      {c.firstName}
                    </button>
                    {dueIds.has(c.id) && <DueBadge />}
                  </span>
                  {!shown.has('email') && c.email && (
                    <span className="block max-w-[14rem] truncate text-xs text-stone-600" title={c.email}>
                      {c.email}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{c.lastName}</td>
                <td className="max-w-[11rem] truncate px-2 py-2" title={c.company}>
                  {c.company}
                </td>
                {shown.has('email') && (
                  <td className="max-w-[13rem] truncate px-2 py-2 text-stone-700" title={c.email}>
                    {c.email}
                  </td>
                )}
                {shown.has('phone') && <td className="px-2 py-2 whitespace-nowrap text-stone-700">{c.phone}</td>}
                {shown.has('externalId') && <td className="px-2 py-2 whitespace-nowrap text-stone-700">{c.externalId}</td>}
                <td className="max-w-[8rem] truncate px-2 py-2" title={countryName(c.country, locale)}>
                  {countryName(c.country, locale)}
                </td>
                <td className="px-2 py-1.5">
                  <BadgeSelect
                    label={t('contacts.cellLabel', { field: t('fields.language'), name })}
                    value={c.language ?? ''}
                    options={[
                      { value: '', label: t('contacts.languageAuto', { language: t(`languages.${languageForCountry(c.country, settings)}`) }) },
                      ...LANGUAGES.map((lang) => ({ value: lang, label: t(`languages.${lang}`) })),
                    ]}
                    onSave={(value) => save(c.id, { language: (value || null) as Lang | null })}
                  >
                    <LanguageBadge language={language} auto={c.language === null} />
                  </BadgeSelect>
                </td>
                <td className="px-2 py-1.5">
                  <BadgeSelect
                    label={t('contacts.cellLabel', { field: t('fields.contactType'), name })}
                    value={c.contactType}
                    options={typeOptions}
                    onSave={(contactType) => save(c.id, { contactType })}
                  >
                    <TypeBadge type={c.contactType} />
                  </BadgeSelect>
                </td>
                <td className="px-1 py-1.5">
                  <DateCell
                    value={c.lastContacted}
                    label={t('contacts.cellLabel', { field: t('fields.lastContacted'), name })}
                    onSave={(lastContacted) => save(c.id, { lastContacted })}
                  />
                </td>
                {shown.has('whereMet') && (
                  <td className="max-w-[12rem] truncate px-2 py-2 text-stone-700" title={c.whereMet}>
                    {c.whereMet}
                  </td>
                )}
                <td className="px-2 py-2">
                  {c.notes ? (
                    // Two lines; the full text on hover (title) or when focused with the keyboard.
                    <span
                      data-tour="notes-cell"
                      tabIndex={0}
                      title={c.notes}
                      className="line-clamp-2 rounded text-stone-700 focus:line-clamp-none focus-visible:outline-2 focus-visible:outline-accent-600"
                    >
                      {c.notes}
                    </span>
                  ) : (
                    <NoNotesBadge />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
                    aria-label={t('contacts.editContact', { name })}
                    title={t('common.edit')}
                    className="rounded p-1.5 text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
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
      className={`w-full rounded border border-transparent px-1 py-0.5 text-left whitespace-nowrap hover:border-stone-300 ${value ? '' : 'text-stone-600 italic'}`}
    >
      {value ? formatDate(value, i18n.language) : t('contacts.never')}
    </button>
  );
}
