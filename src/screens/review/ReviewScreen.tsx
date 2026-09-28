import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { DownloadIcon } from '../../components/icons';
import { db } from '../../db/db';
import { deleteDrafts, restoreDrafts } from '../../db/drafts';
import { useContactMap, useTemplates } from '../../db/hooks';
import type { Draft } from '../../db/schema';
import type { ExportItem } from '../../export/bundle';
import { showToast } from '../../lib/toast';
import { href } from '../../nav';
import { DraftCard } from './DraftCard';
import { ExportDialog } from './ExportDialog';

const FILTERS = ['toReview', 'approved', 'skipped', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const inFilter = (d: Draft, f: Filter) =>
  f === 'all' ||
  (f === 'approved' && d.status === 'approved') ||
  (f === 'skipped' && d.status === 'skipped') ||
  (f === 'toReview' && d.status !== 'approved' && d.status !== 'skipped');

export function ReviewScreen() {
  const { t } = useTranslation();
  const drafts = useLiveQuery(() => db.drafts.orderBy('createdAt').reverse().toArray(), []);
  const contacts = useContactMap();
  const templates = useTemplates();
  const templateMap = useMemo(() => new Map((templates ?? []).map((tp) => [tp.id, tp])), [templates]);
  const [filter, setFilter] = useState<Filter>('toReview');
  const [exporting, setExporting] = useState(false);

  const visible = useMemo(() => (drafts ?? []).filter((d) => inFilter(d, filter)), [drafts, filter]);
  const exportItems: ExportItem[] = useMemo(
    () =>
      (drafts ?? []).flatMap((draft) => {
        const contact = contacts?.get(draft.contactId);
        return draft.status === 'approved' && contact ? [{ draft, contact }] : [];
      }),
    [drafts, contacts],
  );

  async function remove(draft: Draft) {
    const removed = await deleteDrafts([draft.id]);
    showToast({
      tone: 'info',
      message: t('review.removed', { count: removed.length }),
      undo: () => restoreDrafts(removed),
    });
  }

  if (!drafts || !contacts) {
    return <p className="py-10 text-center text-stone-500">{t('common.loading')}</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 pb-24">
      <h1 className="text-2xl font-semibold tracking-tight">{t('review.title')}</h1>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 px-6 py-12 text-center">
          <p className="font-medium">{t('review.empty.title')}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">{t('review.empty.body')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a href={href('due')} className="rounded-md bg-accent-700 px-4 py-2 text-sm font-medium text-white hover:bg-accent-800">
              {t('nav.due')}
            </a>
            <a href={href('contacts')} className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-100">
              {t('nav.contacts')}
            </a>
          </div>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={t('review.filters.label')} className="flex gap-1 overflow-x-auto rounded-lg bg-stone-200/60 p-1">
            {FILTERS.map((f) => {
              const n = drafts.filter((d) => inFilter(d, f)).length;
              return (
                <button
                  key={f}
                  role="tab"
                  type="button"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className="min-h-9 flex-1 rounded-md px-3 text-sm font-medium whitespace-nowrap text-stone-600 aria-selected:bg-white aria-selected:text-stone-900 aria-selected:shadow-sm"
                >
                  {t(`review.filters.${f}`)} <span className="text-stone-400">{n}</span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-stone-500">{t('review.emptyFilter')}</p>
          ) : (
            <div className="space-y-4">
              {visible.map((d) => (
                <DraftCard
                  key={d.id}
                  draft={d}
                  contact={contacts.get(d.contactId)}
                  template={templateMap.get(d.templateId)}
                  onRemove={remove}
                />
              ))}
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <p className="text-sm text-stone-600">
                {exportItems.length === 0 ? t('review.noneApproved') : null}
              </p>
              <Button variant="primary" className="min-h-11" disabled={exportItems.length === 0} onClick={() => setExporting(true)}>
                <DownloadIcon />
                {t('review.exportApproved', { count: exportItems.length })}
              </Button>
            </div>
          </div>
        </>
      )}

      {exporting && <ExportDialog items={exportItems} onClose={() => setExporting(false)} />}
    </section>
  );
}
