import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { DownloadIcon, KeyboardIcon } from '../../components/icons';
import { db } from '../../db/db';
import { deleteDrafts, restoreDrafts, setDraftStatus } from '../../db/drafts';
import { enqueueDrafts } from '../../ai/batch';
import { rewriteDraft } from '../../ai/rewrite';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useReviewKeys } from './useReviewKeys';
import { useContactMap, useTemplates } from '../../db/hooks';
import type { Draft } from '../../db/schema';
import type { ExportItem } from '../../export/bundle';
import { showToast } from '../../lib/toast';
import { needsInput } from '../../lib/needsInput';
import { href } from '../../nav';
import { DraftCard } from './DraftCard';
import { ExportDialog } from './ExportDialog';
import { BatchBanner } from './BatchBanner';

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
  const [showKeys, setShowKeys] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const visible = useMemo(() => (drafts ?? []).filter((d) => inFilter(d, filter)), [drafts, filter]);
  const exportItems: ExportItem[] = useMemo(
    () =>
      (drafts ?? []).flatMap((draft) => {
        const contact = contacts?.get(draft.contactId);
        // A draft still containing a [PLACEHOLDER] is never exported.
        return draft.status === 'approved' && contact && !needsInput(draft) ? [{ draft, contact }] : [];
      }),
    [drafts, contacts],
  );

  async function remove(ids: string[]) {
    const removed = await deleteDrafts(ids);
    showToast({
      tone: 'info',
      message: t('review.removed', { count: removed.length }),
      undo: () => restoreDrafts(removed),
    });
  }

  // Keyboard focus follows the "active" card; default to the first one shown.
  // When the active card leaves the list (approved while viewing "To review"),
  // the card that takes its place becomes active, like an inbox.
  const lastIndex = useRef(0);
  const found = visible.findIndex((d) => d.id === activeId);
  const activeIndex = found >= 0 ? found : Math.min(lastIndex.current, Math.max(0, visible.length - 1));
  const active = visible[activeIndex] as Draft | undefined;
  lastIndex.current = activeIndex;
  useEffect(() => {
    if (active && active.id !== activeId) {
      setActiveId(active.id);
      if (document.activeElement === document.body || document.activeElement?.closest('article') === null) {
        cardRefs.current.get(active.id)?.focus({ preventScroll: true });
      }
    }
  }, [active, activeId]);

  const focusCard = useCallback((id: string | undefined) => {
    const el = id ? cardRefs.current.get(id) : undefined;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const toggle = useCallback((d: Draft | undefined, status: 'approved' | 'skipped') => {
    if (!d || d.status === 'pending' || d.status === 'failed') return;
    if (status === 'approved' && d.status !== 'approved' && needsInput(d)) {
      showToast({ tone: 'error', message: t('review.needsInputShort') });
      return;
    }
    void setDraftStatus([d.id], d.status === status ? 'generated' : status);
  }, [t]);

  const keyActions = useMemo(
    () => ({
      move: (step: 1 | -1) => {
        const next = visible[Math.min(visible.length - 1, Math.max(0, activeIndex + step))];
        if (next) {
          setActiveId(next.id);
          focusCard(next.id);
        }
      },
      approve: () => toggle(active, 'approved'),
      skip: () => toggle(active, 'skipped'),
      edit: () => {
        const body = active && cardRefs.current.get(active.id)?.querySelector<HTMLTextAreaElement>('[data-draft-body]');
        if (!body) return;
        body.focus();
        body.setSelectionRange(body.value.length, body.value.length);
      },
      rewrite: () => {
        if (active && active.status !== 'pending') void rewriteDraft(active.id, '', { done: t('review.rewritten') });
      },
      help: () => setShowKeys(true),
      leaveField: () => focusCard(active?.id),
    }),
    [visible, activeIndex, active, focusCard, toggle, t],
  );
  useReviewKeys(keyActions);

  const approvable = visible.filter((d) => (d.status === 'generated' || d.status === 'edited') && !needsInput(d));
  const failed = visible.filter((d) => d.status === 'failed');

  async function approveAll() {
    await setDraftStatus(approvable.map((d) => d.id), 'approved');
    showToast({
      tone: 'success',
      message: t('review.bulk.approved', { count: approvable.length }),
      undo: () => setDraftStatus(approvable.map((d) => d.id), 'generated'),
    });
  }

  if (!drafts || !contacts) {
    return <p className="py-10 text-center text-stone-500">{t('common.loading')}</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('review.title')}</h1>
        {drafts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowKeys(true)}
            className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-200/60 hover:text-stone-800 sm:inline-flex"
          >
            <KeyboardIcon />
            {t('review.shortcutsHint')}
            <kbd className="rounded border border-stone-300 bg-white px-1.5 font-mono text-xs">?</kbd>
          </button>
        )}
      </div>
      <BatchBanner />

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

          {visible.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-500">{t('review.bulk.label')}</span>
              {approvable.length > 0 && (
                <Button size="sm" className="min-h-11 sm:min-h-8" onClick={approveAll}>
                  {t('review.bulk.approve', { count: approvable.length })}
                </Button>
              )}
              {failed.length > 0 && (
                <Button size="sm" className="min-h-11 sm:min-h-8" onClick={() => enqueueDrafts(failed.map((d) => d.id))}>
                  {t('review.bulk.retry', { count: failed.length })}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 sm:min-h-8"
                onClick={() => void remove(visible.filter((d) => d.status !== 'pending').map((d) => d.id))}
              >
                {t('review.bulk.remove', { count: visible.filter((d) => d.status !== 'pending').length })}
              </Button>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="py-10 text-center text-stone-500">{t('review.emptyFilter')}</p>
          ) : (
            <div className="space-y-4">
              {visible.map((d) => (
                <DraftCard
                  key={d.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(d.id, el);
                    else cardRefs.current.delete(d.id);
                  }}
                  draft={d}
                  contact={contacts.get(d.contactId)}
                  template={templateMap.get(d.templateId)}
                  active={d.id === active?.id}
                  onActivate={() => setActiveId(d.id)}
                  onRemove={(draft) => void remove([draft.id])}
                />
              ))}
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <p className="text-sm text-stone-600">
                {exportItems.length === 0 ? t('review.noneApproved') : null}
              </p>
              <Button data-tour="export" variant="primary" className="min-h-11" disabled={exportItems.length === 0} onClick={() => setExporting(true)}>
                <DownloadIcon />
                {t('review.exportApproved', { count: exportItems.length })}
              </Button>
            </div>
          </div>
        </>
      )}

      {exporting && <ExportDialog items={exportItems} onClose={() => setExporting(false)} />}
      {showKeys && <ShortcutsDialog onClose={() => setShowKeys(false)} />}
    </section>
  );
}
