import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { CheckIcon, DownloadIcon, MailIcon, PlusIcon, UploadIcon } from '../../components/icons';
import { db } from '../../db/db';
import { useTemplates } from '../../db/hooks';
import { CONTACT_TYPES } from '../../db/schema';
import { useSettings } from '../../db/settings';
import { downloadBackup } from '../../export/backupActions';
import { downloadContactsCsv } from '../../export/contactsCsv';
import { formatDate, monthName } from '../../lib/dates';
import { formatEur } from '../../lib/money';
import { loadSampleContacts } from '../../lib/sample';
import { showToast } from '../../lib/toast';
import { href } from '../../nav';
import { ruleText } from '../due/ruleText';
import { overviewData, SETUP_ITEMS, type SetupItem } from './overview';

const SETUP_LINKS: Record<SetupItem, string> = {
  apiKey: href('settings', { section: 'ai' }),
  senderName: href('settings', { section: 'you' }),
  contacts: href('contacts'),
  backup: href('settings', { section: 'backup' }),
};

const linkButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600';
const primaryLink = `${linkButton} border-accent-700 bg-accent-700 text-white hover:bg-accent-800`;
const secondaryLink = `${linkButton} border-stone-300 bg-white text-stone-800 hover:bg-stone-100`;

function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-4 ${className}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** The starting page: what's left to set up, who's due, what's waiting. Local data only. */
export function OverviewScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const settings = useSettings();
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);
  const drafts = useLiveQuery(() => db.drafts.toArray(), []);
  const templates = useTemplates();
  const today = useMemo(() => new Date(), []);
  const [sampleBusy, setSampleBusy] = useState(false);

  const data = useMemo(
    () => (contacts && drafts && templates ? overviewData(contacts, drafts, templates, settings, today) : undefined),
    [contacts, drafts, templates, settings, today],
  );
  if (!data || !contacts) return <p className="py-10 text-center text-stone-600">{t('common.loading')}</p>;

  async function backUp() {
    try {
      const name = await downloadBackup();
      showToast({ tone: 'success', message: t('settings.backup.downloaded', { name }) });
    } catch {
      showToast({ tone: 'error', message: t('settings.backup.failed') });
    }
  }

  async function loadSample() {
    setSampleBusy(true);
    try {
      const { added } = await loadSampleContacts();
      showToast({ tone: 'success', message: t('contacts.sampleLoaded', { count: added }) });
    } catch {
      showToast({ tone: 'error', message: t('contacts.sampleError') });
    } finally {
      setSampleBusy(false);
    }
  }

  const done = SETUP_ITEMS.filter((item) => data.setup[item]).length;
  const { counts } = data;
  const never = t('overview.activity.never');

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('overview.title')}</h1>
        <p className="text-sm text-stone-600">
          {t('due.today', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(today) })}
        </p>
      </div>

      {contacts.length === 0 && (
        <section className="rounded-xl border border-accent-100 bg-accent-50 px-5 py-6">
          <h2 className="text-lg font-semibold">{t('overview.empty.title')}</h2>
          <p className="mt-1 max-w-2xl text-stone-700">{t('overview.empty.body')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={href('contacts', { action: 'import' })} className={primaryLink}>
              <UploadIcon />
              {t('contacts.import')}
            </a>
            <a href={href('contacts', { action: 'add' })} className={secondaryLink}>
              <PlusIcon />
              {t('contacts.add')}
            </a>
            <Button onClick={() => void loadSample()} disabled={sampleBusy}>
              {t('contacts.empty.loadSample')}
            </Button>
          </div>
        </section>
      )}

      {!data.setupDone && (
        <Card title={t('overview.setup.title')}>
          <p className="mb-2 text-sm text-stone-600">{t('overview.setup.progress', { done, total: SETUP_ITEMS.length })}</p>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
            <div className="h-full rounded-full bg-accent-600" style={{ width: `${(done / SETUP_ITEMS.length) * 100}%` }} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SETUP_ITEMS.map((item) => {
              const ok = data.setup[item];
              return (
                <li key={item} className="flex items-start gap-3 rounded-lg border border-stone-100 px-3 py-2">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${ok ? 'border-accent-600 bg-accent-600 text-white' : 'border-stone-400'}`}
                  >
                    {ok && <CheckIcon className="text-xs" />}
                  </span>
                  <span className="min-w-0">
                    {ok ? (
                      <span className="block font-medium text-stone-600 line-through decoration-stone-400">
                        {t(`overview.setup.${item}`)}
                        <span className="sr-only"> ({t('overview.setup.done')})</span>
                      </span>
                    ) : (
                      <a href={SETUP_LINKS[item]} className="block font-medium text-accent-700 underline underline-offset-4">
                        {t(`overview.setup.${item}`)}
                      </a>
                    )}
                    <span className="block text-sm text-stone-600">{t(`overview.setup.${item}Hint`)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {contacts.length > 0 && (
        <>
          <ul data-tour="overview" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Tile label={t('overview.tiles.total')} value={counts.total} to={href('contacts')} />
            {CONTACT_TYPES.map((type) => (
              <Tile
                key={type}
                label={t(`overview.tiles.${type}`)}
                value={counts[type]}
                share={counts.total ? counts[type] / counts.total : 0}
                to={href('contacts', { type })}
              />
            ))}
            <Tile
              label={t('overview.tiles.noNotes')}
              value={counts.noNotes}
              hint={t('overview.tiles.noNotesHint')}
              warn={counts.noNotes > 0}
              to={href('contacts', { notes: 'missing' })}
            />
          </ul>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title={t('overview.due.title')}>
              {data.due.people > 0 ? (
                <>
                  <p className="text-3xl font-semibold">{data.due.people}</p>
                  <p className="text-sm text-stone-600">{t('overview.due.people', { count: data.due.people })}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {data.due.groups.map((g) => (
                      <li key={g.family} className="flex justify-between gap-2">
                        <span>{g.name}</span>
                        <span className="font-medium tabular-nums">{g.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-stone-600">{t('overview.due.none')}</p>
              )}
              {data.next && (
                <p className="mt-3 border-t border-stone-100 pt-3 text-sm">
                  <span className="font-medium">
                    {t('due.nextTitle', { name: data.next.family.name, month: monthName(data.next.month, locale) })}
                  </span>{' '}
                  <span className="text-stone-600">
                    {t('due.nextCount', { count: data.next.count })} {ruleText(data.next.rule, data.next.appliesTo, locale, t)}
                  </span>
                </p>
              )}
              <a href={href('due')} className={`${data.due.people > 0 ? primaryLink : secondaryLink} mt-4`}>
                <MailIcon />
                {t('overview.writeEmails')}
              </a>
            </Card>

            <Card title={t('overview.drafts.title')}>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-sm text-stone-600">{t('overview.drafts.toReview')}</dt>
                  <dd className="text-3xl font-semibold tabular-nums">{data.drafts.toReview}</dd>
                </div>
                <div>
                  <dt className="text-sm text-stone-600">{t('overview.drafts.approved')}</dt>
                  <dd className="text-3xl font-semibold tabular-nums">{data.drafts.approvedNotExported}</dd>
                </div>
              </dl>
              <a href={href('review')} className={`${data.drafts.toReview + data.drafts.approvedNotExported > 0 ? primaryLink : secondaryLink} mt-4`}>
                {t('overview.drafts.open')}
              </a>
            </Card>

            <Card title={t('overview.activity.title')}>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-600">{t('overview.activity.lastImport')}</dt>
                  <dd className="font-medium">{settings.lastImportAt ? formatDate(settings.lastImportAt.slice(0, 10), locale) : never}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-600">{t('overview.activity.lastBackup')}</dt>
                  <dd className="font-medium">{settings.lastBackupAt ? formatDate(settings.lastBackupAt.slice(0, 10), locale) : never}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-stone-600">
                    {t('overview.activity.cost', { date: formatDate(settings.costSince.slice(0, 10), locale) })}
                  </dt>
                  <dd className="font-medium">{formatEur(settings.costTotalEur, locale, t)}</dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card title={t('overview.actions.title')}>
            <div className="flex flex-wrap gap-2">
              <a href={href('contacts', { action: 'import' })} className={secondaryLink}>
                <UploadIcon />
                {t('contacts.import')}
              </a>
              <Button onClick={() => downloadContactsCsv(contacts)}>
                <DownloadIcon />
                {t('contacts.exportCsv')}
              </Button>
              <a href={href('due')} className={secondaryLink}>
                <MailIcon />
                {t('overview.writeEmails')}
              </a>
              <Button onClick={() => void backUp()}>
                <DownloadIcon />
                {t('overview.actions.backup')}
              </Button>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  to,
  share,
  hint,
  warn = false,
}: {
  label: string;
  value: number;
  to: string;
  /** 0–1: drawn as a thin bar under the number. */
  share?: number;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <li>
      <a
        href={to}
        className={`block h-full rounded-xl border bg-white p-4 hover:border-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 ${warn ? 'border-amber-300' : 'border-stone-200'}`}
      >
        <span className="block text-sm text-stone-600">{label}</span>
        <span className="block text-3xl font-semibold tabular-nums">{value}</span>
        {share !== undefined && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
            <span className="block h-full rounded-full bg-accent-600" style={{ width: `${Math.round(share * 100)}%` }} />
          </span>
        )}
        {hint && <span className="mt-1 block text-xs text-stone-600">{hint}</span>}
      </a>
    </li>
  );
}
