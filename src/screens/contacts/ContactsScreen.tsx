import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { inputBase, inputClass } from '../../components/Field';
import { PlusIcon, SearchIcon, TrashIcon, UploadIcon } from '../../components/icons';
import { db } from '../../db/db';
import { CONTACT_TYPES, type Contact, type ContactType } from '../../db/schema';
import { useSettings } from '../../db/settings';
import { loadSampleContacts, SAMPLE_CSV_URL } from '../../lib/sample';
import { ContactForm } from './ContactForm';
import { ContactTable } from './ContactTable';
import { DeleteDialog } from './DeleteDialog';
import { ImportDialog } from './ImportDialog';
import { matchesQuery, sortContacts, type Sort, type SortKey } from './sorting';

type Notice = { tone: 'success' | 'info' | 'error'; text: string };

export function ContactsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const settings = useSettings();
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContactType | ''>('');
  const [sort, setSort] = useState<Sort>({ key: 'firstName', dir: 'asc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);

  const visible = useMemo(() => {
    if (!contacts) return [];
    const filtered = contacts.filter(
      (c) => (!typeFilter || c.contactType === typeFilter) && matchesQuery(c, query, locale),
    );
    return sortContacts(filtered, sort, settings, locale, t);
  }, [contacts, query, typeFilter, sort, settings, locale, t]);

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

  const editingContact = editing === 'new' ? null : editing;
  const total = contacts?.length ?? 0;
  const filtering = query.trim() !== '' || typeFilter !== '';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('contacts.title')}</h1>
          {contacts && total > 0 && (
            <p className="text-sm text-stone-500">
              {filtering
                ? t('contacts.showing', { shown: visible.length, total })
                : t('contacts.count', { count: total })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setImporting(true)}>
            <UploadIcon />
            {t('contacts.import')}
          </Button>
          <Button variant="primary" onClick={() => setEditing('new')}>
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

      {!contacts && <p className="py-10 text-center text-stone-500">{t('common.loading')}</p>}

      {contacts && total === 0 && (
        <Banner
          tone="warning"
          title={t('contacts.empty.title')}
          actions={
            <>
              <Button variant="primary" size="sm" onClick={() => setImporting(true)}>
                {t('contacts.import')}
              </Button>
              <Button size="sm" onClick={() => setEditing('new')}>
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
            <a
              href={SAMPLE_CSV_URL}
              download="sample-contacts.csv"
              className="font-medium underline underline-offset-4"
            >
              {t('contacts.empty.downloadSample')}
            </a>
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
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
            <select
              aria-label={t('contacts.filterType')}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ContactType | '')}
              className={inputBase}
            >
              <option value="">{t('contacts.allTypes')}</option>
              {CONTACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`contactTypes.${type}`)}
                </option>
              ))}
            </select>
            {/* Lives in the filter row so selecting never shifts the table. */}
            {selectedVisible.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-stone-700">
                  {t('contacts.selected', { count: selectedVisible.length })}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  {t('contacts.clearSelection')}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setPendingDelete(selectedVisible)}>
                  <TrashIcon />
                  {t('contacts.deleteSelected')}
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
                onClick={() => {
                  setQuery('');
                  setTypeFilter('');
                }}
              >
                {t('contacts.clearSearch')}
              </Button>
            </div>
          ) : (
            <ContactTable
              contacts={visible}
              settings={settings}
              sort={sort}
              onSort={onSort}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onEdit={setEditing}
              onSaveError={() => setNotice({ tone: 'error', text: t('contacts.saveFailed') })}
            />
          )}
        </>
      )}

      {editing && (
        <ContactForm
          key={editingContact?.id ?? 'new'}
          contact={editingContact}
          settings={settings}
          onClose={() => setEditing(null)}
          onDeleteRequest={(c) => setPendingDelete([c.id])}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {pendingDelete && (
        <DeleteDialog
          ids={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDeleted={() => {
            const gone = new Set(pendingDelete);
            setSelected((s) => new Set([...s].filter((id) => !gone.has(id))));
            if (editingContact && gone.has(editingContact.id)) setEditing(null);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}
