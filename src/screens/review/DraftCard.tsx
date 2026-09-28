import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoTextarea } from '../../components/AutoTextarea';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { inputClass } from '../../components/Field';
import { CheckIcon, InfoIcon, TrashIcon, WarningIcon } from '../../components/icons';
import { editDraftText, setDraftStatus } from '../../db/drafts';
import type { Contact, Draft, Template } from '../../db/schema';
import { formatDate } from '../../lib/dates';
import { unknownPlaceholders } from '../../lib/placeholders';

const SAVE_DELAY_MS = 400;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function DraftCard({
  draft,
  contact,
  template,
  onRemove,
}: {
  draft: Draft;
  contact: Contact | undefined;
  template: Template | undefined;
  onRemove: (draft: Draft) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<Pick<Draft, 'subject' | 'body'>>>({});

  // Take outside changes (e.g. a regenerated draft) unless the user is mid-edit.
  useEffect(() => {
    if (timer.current) return;
    setSubject(draft.subject);
    setBody(draft.body);
  }, [draft.subject, draft.body]);

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      await editDraftText(draft.id, patch);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (field: 'subject' | 'body', value: string) => {
    if (field === 'subject') setSubject(value);
    else setBody(value);
    pending.current[field] = value;
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const name = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') : t('review.deletedContact');
  const unknown = unknownPlaceholders(subject + body);
  const approved = draft.status === 'approved';
  const skipped = draft.status === 'skipped';

  return (
    <article
      aria-labelledby={`${id}-name`}
      className={`rounded-xl border bg-white shadow-sm ${approved ? 'border-emerald-300' : skipped ? 'border-stone-200 opacity-70' : 'border-stone-200'}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0">
          <h2 id={`${id}-name`} className="font-semibold">
            {name}
          </h2>
          <p className="truncate text-sm text-stone-500">
            {contact?.email || <span className="text-amber-700">{t('review.noEmail')}</span>}
            {contact?.company ? ` · ${contact.company}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded bg-stone-100 px-2 py-1 font-medium text-stone-700">{template?.name}</span>
          <span className="rounded bg-stone-100 px-2 py-1 font-medium text-stone-700">
            {t(`languages.${draft.language}`)}
          </span>
          <span className="rounded bg-stone-100 px-2 py-1 text-stone-600">{t(`review.source.${draft.source}`)}</span>
          <span
            className={`rounded px-2 py-1 font-medium ${approved ? 'bg-emerald-100 text-emerald-900' : skipped ? 'bg-stone-200 text-stone-700' : 'bg-sky-100 text-sky-900'}`}
          >
            {t(`review.status.${draft.status}`)}
          </span>
        </div>
      </header>

      <div className="space-y-3 px-4 py-3">
        <Personalization draft={draft} />

        <div>
          <label htmlFor={`${id}-subject`} className="mb-1 block text-xs font-medium text-stone-500">
            {t('review.subject')}
          </label>
          <input
            id={`${id}-subject`}
            className={`${inputClass} font-medium`}
            value={subject}
            onChange={(e) => change('subject', e.target.value)}
            onBlur={() => void flush()}
          />
        </div>
        <div>
          <label htmlFor={`${id}-body`} className="mb-1 block text-xs font-medium text-stone-500">
            {t('review.body')}
          </label>
          <AutoTextarea
            id={`${id}-body`}
            data-draft-body
            className={`${inputClass} min-h-40 resize-none leading-relaxed`}
            value={body}
            onChange={(e) => change('body', e.target.value)}
            onBlur={() => void flush()}
          />
        </div>

        {unknown.length > 0 && (
          <Banner tone="warning">
            {t('review.unknownPlaceholders', { list: unknown.map((u) => `{{${u}}}`).join(', ') })}
          </Banner>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-4 py-3">
        <Button
          variant={approved ? 'primary' : 'secondary'}
          aria-pressed={approved}
          className="min-h-11 sm:min-h-0"
          onClick={() => void setDraftStatus([draft.id], approved ? 'generated' : 'approved')}
        >
          <CheckIcon />
          {approved ? t('review.approved') : t('review.approve')}
        </Button>
        <Button
          aria-pressed={skipped}
          className="min-h-11 sm:min-h-0"
          onClick={() => void setDraftStatus([draft.id], skipped ? 'generated' : 'skipped')}
        >
          {skipped ? t('review.skipped') : t('review.skip')}
        </Button>
        <Button variant="ghost" className="min-h-11 sm:min-h-0" onClick={() => onRemove(draft)}>
          <TrashIcon />
          {t('review.remove')}
        </Button>
        <span className="ml-auto text-xs text-stone-500" aria-live="polite">
          {draft.exportedAt && t('review.exported', { date: formatDate(draft.exportedAt.slice(0, 10), i18n.language) })}
          {draft.exportedAt && saveState !== 'idle' && ' · '}
          {saveState === 'saving' && t('review.saving')}
          {saveState === 'saved' && t('review.saved')}
          {saveState === 'error' && <span className="text-red-700">{t('review.saveFailed')}</span>}
        </span>
      </footer>
    </article>
  );
}

function Personalization({ draft }: { draft: Draft }) {
  const { t } = useTranslation();
  if (draft.source === 'template') {
    return (
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <InfoIcon className="shrink-0" />
        {t('review.notPersonal')}
      </p>
    );
  }
  if (!draft.personalizationUsed) return null;
  return draft.notesAvailable ? (
    <p className="flex items-start gap-2 rounded-md bg-accent-50 px-3 py-2 text-sm text-accent-800">
      <InfoIcon className="mt-0.5 shrink-0" />
      {draft.personalizationUsed}
    </p>
  ) : (
    <p className="flex items-start gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
      <WarningIcon className="mt-0.5 shrink-0" />
      {draft.personalizationUsed}
    </p>
  );
}
