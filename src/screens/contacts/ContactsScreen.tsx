import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { inputBase, inputClass } from '../../components/Field';
import { CloseIcon, ColumnsIcon, DownloadIcon, PlusIcon, SearchIcon, TrashIcon, UploadIcon } from '../../components/icons';
import { Menu } from '../../components/Menu';
import { Checkbox } from '../../components/Checkbox';
import { useTemplates } from '../../db/hooks';
import { dueGroups } from '../../lib/schedule';
import { href, routeParams } from '../../nav';
import { db } from '../../db/db';
import { CONTACT_TYPES, LANGUAGES, OPTIONAL_COLUMNS, type Contact, type ContactInput, type ContactType, type Lang } from '../../db/schema';
import { deleteContacts, restoreContacts } from '../../db/contacts';
import { showToast } from '../../lib/toast';
import { BackupReminder } from '../settings/BackupReminder';
import { CreateDraftsDialog } from '../review/CreateDraftsDialog';
import { MailIcon } from '../../components/icons';
import { useTrash } from '../../db/trash';
import { TrashDialog } from './TrashDialog';
import { modifySettings, useSettings } from '../../db/settings';
import { loadSampleContacts, sampleContactsCsv } from '../../lib/sample';
import { downloadFile } from '../../lib/download';
import { downloadContactsCsv } from '../../export/contactsCsv';
import { ContactForm } from './ContactForm';
import { ContactTable } from './ContactTable';
import { ContactList } from './ContactList';
import { ImportDialog } from './ImportDialog';
import {
  countriesInUse,
  filterContacts,
  filtersFromParams,
  hasFilters,
  NO_FILTERS,
  sortContacts,
  type ContactFilters,
  type Sort,
  type SortKey,
} from './sorting';

type Notice = { tone: 'success' | 'info' | 'error'; text: string };

export function ContactsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const settings = useSettings();
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);

  const drafts = useLiveQuery(() => db.drafts.toArray(), []);
  const templates = useTemplates();
  // Links from the Overview can pre-set a filter (#/contacts?notes=missing) or open a dialog (?action=import).
  const [filters, setFilters] = useState<ContactFilters>(() => filtersFromParams(routeParams()));
  const setFilter = <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const query = filters.query;
  const [sort, setSort] = useState<Sort>({ key: 'firstName', dir: 'asc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ contact: Contact | null; draft?: ContactInput } | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [writingFor, setWritingFor] = useState<string[] | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const trash = useTrash();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);

  useEffect(() => {
    const params = routeParams();
    const action = params.get('action');
    if (!action) return;
    if (action === 'import') setImporting(true);
    if (action === 'add') setEditing({ contact: null });
    // Drop the action so Back or a reload doesn't open the dialog again.
    params.delete('action');
    window.history.replaceState(null, '', href('contacts', Object.fromEntries(params)));
  }, []);

  const visible = useMemo(() => {
    if (!contacts) return [];
    return sortContacts(filterContacts(contacts, filters, settings, locale), sort, settings, locale, t);
  }, [contacts, filters, sort, settings, locale, t]);

  const countries = useMemo(() => countriesInUse(contacts ?? [], locale), [contacts, locale]);

  // Due this month and not drafted yet, for the "Due" badge on rows.
  const dueIds = useMemo(() => {
    if (!contacts || !drafts || !templates) return new Set<string>();
    return new Set(
      dueGroups(contacts, templates, drafts, settings, new Date()).flatMap((g) =>
        g.entries.filter((e) => !e.hasOpenDraft).map((e) => e.contact.id),
      ),
    );
  }, [contacts, drafts, templates, settings]);

  // Bulk actions only ever touch rows the user can see.
  const selectedVisible = visible.filter((c) => selected.has(c.id)).map((c) => c.id);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((s) => {
      const allOn = visible.length > 0 && visible.every((c) => s.has(c.id));
      const next = new Set(s);
      for (const c of visible) {
        if (allOn) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });

  // Deleting is immediate; the toast's Undo puts everything back for 10 seconds.
  async function remove(ids: string[]) {
    try {
      const removed = await deleteContacts(ids);
      const gone = new Set(ids);
      setSelected((s) => new Set([...s].filter((id) => !gone.has(id))));
      showToast({
        tone: 'info',
        message: t('contacts.deletedRecoverable', { count: removed.contacts.length }),
        undo: () => restoreContacts(removed),
      });
    } catch {
      setNotice({ tone: 'error', text: t('contacts.saveFailed') });
    }
  }

  function discard(contact: Contact | null, draft: ContactInput) {
    setEditing(null);
    showToast({
      tone: 'info',
      message: t('form.discarded'),
      undo: () => setEditing({ contact, draft }),
    });
  }

  async function loadSample() {
    setSampleBusy(true);
    try {
      const { added } = await loadSampleContacts();
      setNotice(
        added > 0
          ? { tone: 'success', text: t('contacts.sampleLoaded', { count: added }) }
          : { tone: 'info', text: t('contacts.sampleAlreadyLoaded') },
      );
    } catch {
      setNotice({ tone: 'error', text: t('contacts.sampleError') });
    } finally {
      setSampleBusy(false);
    }
  }

  const total = contacts?.length ?? 0;
  const filtering = hasFilters(filters);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('contacts.title')}</h1>
          {contacts && total > 0 && (
            <p className="text-sm text-stone-600">
              {filtering
                ? t('contacts.showing', { shown: visible.length, total })
                : t('contacts.count', { count: total })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {trash && trash.length > 0 && (
            <Button variant="ghost" onClick={() => setShowTrash(true)}>
              {t('trash.open', { count: trash.reduce((n, e) => n + e.contacts.length, 0) })}
            </Button>
          )}
          <Button onClick={() => setImporting(true)}>
            <UploadIcon />
            {t('contacts.import')}
          </Button>
          {contacts && total > 0 && (
            <Button
              onClick={() => downloadContactsCsv(contacts)}
            >
              <DownloadIcon />
              {t('contacts.exportCsv')}
            </Button>
          )}
          <Button variant="primary" onClick={() => setEditing({ contact: null })}>
            <PlusIcon />
            {t('contacts.add')}
          </Button>
        </div>
      </div>

      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      {contacts && <BackupReminder contactCount={total} />}

      {!contacts && <p className="py-10 text-center text-stone-600">{t('common.loading')}</p>}

      {contacts && total === 0 && (
        <Banner
          tone="warning"
          title={t('contacts.empty.title')}
          actions={
            <>
              <Button variant="primary" size="sm" onClick={() => setImporting(true)}>
                {t('contacts.import')}
              </Button>
              <Button size="sm" onClick={() => setEditing({ contact: null })}>
                {t('contacts.add')}
              </Button>
              <Button size="sm" onClick={loadSample} disabled={sampleBusy}>
                {t('contacts.empty.loadSample')}
              </Button>
            </>
          }
        >
          <p>{t('contacts.empty.body')}</p>
          <p>
            <button
              type="button"
              onClick={() =>
                downloadFile('\uFEFF' + sampleContactsCsv(), 'sample-contacts.csv', 'text/csv;charset=utf-8')
              }
              className="font-medium underline underline-offset-4"
            >
              {t('contacts.empty.downloadSample')}
            </button>
            {'. '}
            {t('contacts.empty.sampleHint')}
          </p>
        </Banner>
      )}

      {contacts && total > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                aria-label={t('contacts.search')}
                placeholder={t('contacts.searchPlaceholder')}
                value={query}
                onChange={(e) => setFilter('query', e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
            <select
              aria-label={t('contacts.filterType')}
              value={filters.type}
              onChange={(e) => setFilter('type', e.target.value as ContactType | '')}
              className={`${inputBase} max-w-full`}
            >
              <option value="">{t('contacts.allTypes')}</option>
              {CONTACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`contactTypes.${type}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t('contacts.filterCountry')}
              value={filters.country}
              onChange={(e) => setFilter('country', e.target.value)}
              className={`${inputBase} max-w-full`}
            >
              <option value="">{t('contacts.allCountries')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t('contacts.filterLanguage')}
              value={filters.language}
              onChange={(e) => setFilter('language', e.target.value as Lang | '')}
              className={`${inputBase} max-w-full`}
            >
              <option value="">{t('contacts.allLanguages')}</option>
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {t(`languages.${lang}`)}
                </option>
              ))}
            </select>
            {filters.notes === 'missing' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 py-1 pr-1 pl-3 text-sm font-medium text-amber-900">
                {t('contacts.filterNoNotes')}
                <button
                  type="button"
                  onClick={() => setFilter('notes', '')}
                  aria-label={t('contacts.clearNoNotes')}
                  className="rounded-full p-1 hover:bg-amber-200"
                >
                  <CloseIcon />
                </button>
              </span>
            )}
            <div className="hidden md:block">
              <Menu
                align="left"
                buttonClassName="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
                button={
                  <>
                    <ColumnsIcon />
                    {t('contacts.columns')}
                  </>
                }
              >
                {() => (
                  <fieldset className="px-2 py-1">
                    <legend className="px-1 pb-1 text-xs font-medium text-stone-600">{t('contacts.columnsHint')}</legend>
                    {OPTIONAL_COLUMNS.map((column) => (
                      <label key={column} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-stone-100">
                        <Checkbox
                          checked={settings.contactColumns.includes(column)}
                          onChange={(e) => {
                            const on = e.target.checked;
                            // Changed on the latest row, so another tab's choice isn't undone.
                            void modifySettings((s) => {
                              s.contactColumns = on
                                ? [...new Set([...s.contactColumns, column])]
                                : s.contactColumns.filter((c) => c !== column);
                            });
                          }}
                        />
                        {t(`fields.${column}`)}
                      </label>
                    ))}
                  </fieldset>
                )}
              </Menu>
            </div>
            {/* Lives in the filter row so selecting never shifts the table. */}
            {selectedVisible.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-stone-700">
                  {t('contacts.selected', { count: selectedVisible.length })}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  {t('contacts.clearSelection')}
                </Button>
                <Button size="sm" variant="danger" onClick={() => void remove(selectedVisible)}>
                  <TrashIcon />
                  {t('contacts.deleteSelected')}
                </Button>
                <Button size="sm" variant="primary" onClick={() => setWritingFor(selectedVisible)}>
                  <MailIcon />
                  {t('contacts.writeEmails')}
                </Button>
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center">
              <p className="text-stone-600">{t('contacts.noMatch')}</p>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => setFilters(NO_FILTERS)}
              >
                {t('contacts.clearSearch')}
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <ContactTable
                  contacts={visible}
                  settings={settings}
                  sort={sort}
                  onSort={onSort}
                  selected={selected}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  onEdit={(contact) => setEditing({ contact })}
                  onSaveError={() => setNotice({ tone: 'error', text: t('contacts.saveFailed') })}
                  dueIds={dueIds}
                />
              </div>
              <div className="md:hidden">
                <ContactList
                  contacts={visible}
                  settings={settings}
                  selected={selected}
                  onToggle={toggle}
                  onEdit={(contact) => setEditing({ contact })}
                  dueIds={dueIds}
                />
              </div>
            </>
          )}
        </>
      )}

      {editing && (
        <ContactForm
          key={editing.contact?.id ?? 'new'}
          contact={editing.contact}
          initialDraft={editing.draft}
          settings={settings}
          onClose={() => setEditing(null)}
          onDiscard={(draft) => discard(editing.contact, draft)}
          onDeleteRequest={(c) => {
            setEditing(null);
            void remove([c.id]);
          }}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {showTrash && <TrashDialog onClose={() => setShowTrash(false)} />}
      {writingFor && (
        <CreateDraftsDialog contactIds={writingFor} onClose={() => setWritingFor(null)} />
      )}
    </section>
  );
}
