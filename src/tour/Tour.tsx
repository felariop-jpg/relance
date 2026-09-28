import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { db } from '../db/db';
import { loadSampleContacts } from '../lib/sample';
import { showToast } from '../lib/toast';
import { href } from '../nav';
import {
  backward,
  clearTourLeftovers,
  endTour,
  forward,
  goTo,
  hasShowableDrafts,
  rememberExamples,
  tourLeftovers,
  useTour,
  writeExampleDrafts,
} from './tourState';

const visible = (el: Element) => el.getClientRects().length > 0;

function targetRect(selectors: string[], union: boolean): DOMRect | null {
  const rects: DOMRect[] = [];
  for (const selector of selectors) {
    const el = [...document.querySelectorAll(selector)].find(visible);
    if (!el) continue;
    rects.push(el.getBoundingClientRect());
    if (!union) break;
  }
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  return new DOMRect(left, top, Math.max(...rects.map((r) => r.right)) - left, Math.max(...rects.map((r) => r.bottom)) - top);
}

function dialogOrPopoverOpen(): boolean {
  if (document.querySelector('dialog[open]')) return true;
  try {
    return !!document.querySelector(':popover-open');
  } catch {
    return false;
  }
}

/**
 * The guided tour: a highlight ring and an explanation card. Nothing is blocked:
 * the page stays usable underneath, and Escape or Skip ends it at any step.
 */
export function Tour() {
  const { t } = useTranslation();
  const tour = useTour();
  const drafts = useLiveQuery(() => db.drafts.toArray(), []);
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);
  // Set when the tour is ending and there are sample contacts or example drafts to offer clearing.
  const [closing, setClosing] = useState<null | 'skipped' | 'finished'>(null);
  const leftovers = tourLeftovers(contacts ?? [], drafts ?? [], tour.exampleIds);
  const hasLeftovers = leftovers.samples.length > 0 || leftovers.examples.length > 0;
  const step = tour.active ? tour.steps[tour.index] : undefined;
  const part = step?.parts?.[tour.part];
  const targets = part?.targets ?? step?.targets;
  const last = tour.index === tour.steps.length - 1 && (!step?.parts || tour.part === step.parts.length - 1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<Element | null>(null);

  const needsExamples = step?.id === 'generate' && drafts !== undefined && !hasShowableDrafts(drafts);
  const union = !!step?.union;

  // Focus goes back where it was when the tour ends.
  useEffect(() => {
    setClosing(null);
    if (tour.active) {
      returnFocus.current = document.activeElement;
    } else if (returnFocus.current instanceof HTMLElement && document.contains(returnFocus.current)) {
      returnFocus.current.focus();
    }
  }, [tour.active]);

  // Each step opens its screen once; after that the user may go anywhere.
  useEffect(() => {
    if (!step || !targets) return;
    setFailed(false);
    if (window.location.hash !== href(step.route)) window.location.hash = href(step.route);
    let tries = 0;
    const find = setInterval(() => {
      const el = targets.map((s) => [...document.querySelectorAll(s)].find(visible)).find(Boolean);
      if (el || ++tries > 30) {
        clearInterval(find);
        el?.scrollIntoView?.({ block: 'center' });
        setRect(targetRect(targets, union));
        requestAnimationFrame(() => heading.current?.focus());
      }
    }, 100);
    return () => clearInterval(find);
  }, [step, targets, union]);

  // Follow the target as the page scrolls, resizes or its content changes.
  const measure = useCallback(() => {
    if (targets) setRect(targetRect(targets, union));
  }, [targets, union]);
  useEffect(() => {
    if (!step) return;
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', later, true);
    window.addEventListener('resize', later);
    const timer = setInterval(measure, 500);
    return () => {
      window.removeEventListener('scroll', later, true);
      window.removeEventListener('resize', later);
      clearInterval(timer);
      cancelAnimationFrame(frame);
    };
  }, [step, measure]);

  // Below the target, else above it, else in the corner; a bottom sheet on phones.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !step) return;
    if (window.innerWidth < 640) return setPlace(null);
    const corner = { right: 16, bottom: 16 };
    if (!rect) return setPlace(corner);
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    const top = Math.min(Math.max(8, rect.top), window.innerHeight - h - 8);
    // Narrow targets (a column, a button): beside them, so the card never covers what it explains.
    if (rect.width < window.innerWidth * 0.4) {
      if (rect.left - 14 - w >= 8) return setPlace({ top, left: rect.left - 14 - w });
      if (rect.right + 14 + w <= window.innerWidth - 8) return setPlace({ top, left: rect.right + 14 });
    }
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8);
    if (rect.bottom + 14 + h <= window.innerHeight - 8) return setPlace({ top: rect.bottom + 14, left });
    if (rect.top - 14 - h >= 8) return setPlace({ top: rect.top - 14 - h, left });
    setPlace(corner);
  }, [rect, step, busy, failed, needsExamples, t]);

  // Ending, by Skip or Finish: first offer to clear the examples, so Relance isn't left full of made-up people.
  const end = useCallback(
    (how: 'skipped' | 'finished') => (hasLeftovers ? setClosing(how) : void endTour(how)),
    [hasLeftovers],
  );
  const skip = useCallback(() => end(last ? 'finished' : 'skipped'), [end, last]);

  async function startFresh() {
    if (!closing) return;
    setBusy(true);
    try {
      const undo = await clearTourLeftovers(tour.exampleIds);
      window.location.hash = href('contacts');
      showToast({ tone: 'success', message: t('tour.end.cleared'), undo });
    } finally {
      setBusy(false);
      void endTour(closing);
    }
  }
  const keep = () => closing && void endTour(closing);

  useEffect(() => {
    if (closing) requestAnimationFrame(() => heading.current?.focus());
  }, [closing]);

  const primary = useCallback(async () => {
    if (!step || busy) return;
    if (step.id === 'sample') {
      setBusy(true);
      try {
        await loadSampleContacts();
        goTo(tour.index + 1);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    } else if (needsExamples) {
      setBusy(true);
      try {
        rememberExamples(await writeExampleDrafts());
        goTo(tour.index + 1);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    } else if (last) {
      end('finished');
    } else {
      forward();
    }
  }, [step, busy, needsExamples, last, tour.index, end]);


  // Escape skips; arrow keys and Enter move on while the tour card (or nothing) has focus.
  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dialogOrPopoverOpen()) return;
        e.preventDefault();
        if (closing) keep();
        else skip();
        return;
      }
      if (closing) {
        if (e.key === 'Enter' && (document.activeElement === heading.current || document.activeElement === document.body)) {
          e.preventDefault();
          void startFresh();
        }
        return;
      }
      const active = document.activeElement;
      const onCard = active === heading.current || active === card.current;
      const inCard = !!card.current?.contains(active);
      if (!inCard && active !== document.body) return;
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && (onCard || active === document.body))) {
        e.preventDefault();
        void primary();
      } else if (e.key === 'ArrowLeft' && (tour.index > 0 || tour.part > 0) && !busy) {
        e.preventDefault();
        backward();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, skip, primary, tour.index, tour.part, busy, closing]);

  if (!step) return null;

  if (closing) {
    return (
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="fixed right-4 bottom-4 left-4 z-30 rounded-xl border border-stone-200 bg-white p-4 shadow-xl sm:left-auto sm:w-[24rem]"
      >
        <h2 id="tour-title" ref={heading} tabIndex={-1} className="font-semibold focus:outline-none">
          {t(leftovers.samples.length > 0 ? 'tour.end.title' : 'tour.end.titleExamples')}
        </h2>
        <p id="tour-body" className="mt-1 text-sm text-stone-700">
          {t(leftovers.samples.length > 0 ? 'tour.end.body' : 'tour.end.bodyExamples')}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={keep}>
            {t('tour.end.keep')}
          </Button>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void startFresh()}>
            {t(leftovers.samples.length > 0 ? 'tour.end.startFresh' : 'tour.end.removeExamples')}
          </Button>
        </div>
      </div>
    );
  }

  const title = t(`tour.${step.id}.title`);
  const body = part
    ? t(part.body)
    : step.id === 'generate'
      ? t(needsExamples ? 'tour.generate.bodyExamples' : 'tour.generate.body')
      : t(`tour.${step.id}.body`);
  const action =
    step.id === 'sample'
      ? t(busy ? 'tour.sample.loading' : 'tour.sample.load')
      : needsExamples
        ? t(busy ? 'tour.generate.writing' : 'tour.generate.write')
        : t(last ? 'tour.finish' : 'tour.next');

  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-30 rounded-lg ring-4 ring-accent-600 ring-offset-2 ring-offset-white transition-all"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={`fixed z-30 rounded-xl border border-stone-200 bg-white p-4 shadow-xl ${place ? 'w-[22rem] max-w-[calc(100vw-1rem)]' : 'inset-x-2 bottom-2'}`}
        style={place ?? undefined}
      >
        <p className="text-xs font-medium text-stone-500">
          {t('tour.stepOf', { n: tour.index + 1, total: tour.steps.length })}
        </p>
        <h2 id="tour-title" ref={heading} tabIndex={-1} className="mt-1 font-semibold focus:outline-none">
          {title}
        </h2>
        <p id="tour-body" className="mt-1 text-sm text-stone-700">
          {body}
        </p>
        {failed && (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {t(step.id === 'sample' ? 'contacts.sampleError' : 'tour.generate.failed')}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(tour.index > 0 || tour.part > 0) && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={backward}>
              {t('tour.back')}
            </Button>
          )}
          <span className="flex-1" />
          {!last && (
            <Button size="sm" variant="ghost" onClick={skip}>
              {t('tour.skip')}
            </Button>
          )}
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void primary()}>
            {action}
          </Button>
        </div>
      </div>
    </>
  );
}
