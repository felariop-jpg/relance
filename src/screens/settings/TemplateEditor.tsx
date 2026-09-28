import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoTextarea } from '../../components/AutoTextarea';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Field, inputBase, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { db } from '../../db/db';
import { CONTACT_TYPES, LANGUAGES, type ContactType, type Lang, type Template } from '../../db/schema';
import type { TemplateFamily } from '../../db/templates';
import { monthName } from '../../lib/dates';
import { PLACEHOLDERS, unknownPlaceholders } from '../../lib/placeholders';
import { showToast } from '../../lib/toast';

interface VersionState {
  include: boolean;
  id: string;
  name: string;
  subject: string;
  body: string;
  instructions: string;
  isBuiltIn: boolean;
}

export interface EditorState {
  family: string;
  isNew: boolean;
  scheduleOn: boolean;
  month: number;
  minGapDays: number;
  appliesTo: ContactType[];
  versions: Record<Lang, VersionState>;
}

export function editorStateFrom(family: TemplateFamily | null): EditorState {
  const familyId = family?.family ?? `custom-${crypto.randomUUID().slice(0, 8)}`;
  const any = family ? (family.versions.en ?? family.versions.fr) : undefined;
  const version = (lang: Lang): VersionState => {
    const t = family?.versions[lang];
    return {
      include: family ? Boolean(t) : true,
      id: t?.id ?? `${familyId}-${lang}`,
      name: t?.name ?? '',
      subject: t?.subject ?? '',
      body: t?.body ?? '',
      instructions: t?.instructions ?? '',
      isBuiltIn: t?.isBuiltIn ?? false,
    };
  };
  return {
    family: familyId,
    isNew: !family,
    scheduleOn: Boolean(any?.scheduleRule),
    month: any?.scheduleRule?.month ?? new Date().getMonth() + 1,
    minGapDays: any?.scheduleRule?.minGapDays ?? 60,
    appliesTo: any?.appliesTo ?? [],
    versions: { en: version('en'), fr: version('fr') },
  };
}

export function TemplateEditor({
  initial,
  baseline,
  onClose,
  onDiscard,
}: {
  initial: EditorState;
  /** What "unchanged" means; differs from `initial` after an Undo restores edits. */
  baseline: EditorState;
  onClose: () => void;
  onDiscard: (unsaved: EditorState) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [state, setState] = useState<EditorState>(initial);
  const [tab, setTab] = useState<Lang>(i18n.language === 'fr' ? 'fr' : 'en');
  const [invalid, setInvalid] = useState(false);
  const snapshot = useRef(JSON.stringify(baseline));
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const dirty = JSON.stringify(state) !== snapshot.current;

  const v = state.versions[tab];
  const setVersion = (patch: Partial<VersionState>) =>
    setState((s) => ({ ...s, versions: { ...s.versions, [tab]: { ...s.versions[tab], ...patch } } }));

  const insert = (token: string) => {
    const field = lastField.current;
    const key = field?.dataset.field === 'subject' ? 'subject' : 'body';
    const text = `{{${token}}}`;
    const current = v[key];
    const start = field?.selectionStart ?? current.length;
    const end = field?.selectionEnd ?? current.length;
    setVersion({ [key]: current.slice(0, start) + text + current.slice(end) });
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  async function save() {
    const included = LANGUAGES.filter((l) => state.versions[l].include);
    const complete = included.filter((l) => state.versions[l].name.trim() && state.versions[l].body.trim());
    if (complete.length === 0 || complete.length !== included.length) {
      setInvalid(true);
      return;
    }
    const rule = state.scheduleOn ? { month: state.month, minGapDays: Math.max(0, state.minGapDays) } : null;
    const rows: Template[] = included.map((language) => {
      const ver = state.versions[language];
      return {
        id: ver.id,
        family: state.family,
        language,
        name: ver.name.trim(),
        subject: ver.subject.trim(),
        body: ver.body.trim(),
        instructions: ver.instructions.trim(),
        scheduleRule: rule,
        appliesTo: state.appliesTo,
        isBuiltIn: ver.isBuiltIn,
      };
    });
    const removed = LANGUAGES.filter((l) => !state.versions[l].include).map((l) => state.versions[l].id);
    const base = JSON.parse(snapshot.current) as EditorState;
    const ruleChanged =
      base.scheduleOn !== state.scheduleOn ||
      base.month !== state.month ||
      base.minGapDays !== state.minGapDays ||
      JSON.stringify(base.appliesTo) !== JSON.stringify(state.appliesTo);
    await db.transaction('rw', db.templates, async () => {
      for (const row of rows) {
        const existing = await db.templates.get(row.id);
        if (!existing) {
          await db.templates.add(row);
          continue;
        }
        // Only what changed in this editor, so edits saved from another tab
        // to other fields of the same template are kept.
        const was = base.versions[row.language];
        const patch: Partial<Template> = {};
        for (const key of ['name', 'subject', 'body', 'instructions'] as const) {
          if (was[key].trim() !== row[key]) patch[key] = row[key];
        }
        if (ruleChanged) {
          patch.scheduleRule = row.scheduleRule;
          patch.appliesTo = row.appliesTo;
        }
        if (Object.keys(patch).length > 0) await db.templates.update(row.id, patch);
      }
      await db.templates.bulkDelete(removed);
    });
    showToast({ tone: 'success', message: t('templates.saved') });
    onClose();
  }

  const unknown = unknownPlaceholders(v.subject + v.body);

  return (
    <Modal
      open
      size="lg"
      onClose={() => (dirty ? onDiscard(state) : onClose())}
      title={state.isNew ? t('templates.newTitle') : t('templates.editTitle')}
      footer={
        <>
          <Button onClick={() => (dirty ? onDiscard(state) : onClose())}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {invalid && <Banner tone="error">{t('templates.needVersion')}</Banner>}

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">{t('templates.schedule')}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" className="accent-accent-700" checked={!state.scheduleOn} onChange={() => setState((s) => ({ ...s, scheduleOn: false }))} />
            {t('templates.scheduleNone')}
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" className="accent-accent-700" checked={state.scheduleOn} onChange={() => setState((s) => ({ ...s, scheduleOn: true }))} />
              {t('templates.scheduleMonth')}
            </label>
            <select
              aria-label={t('templates.scheduleMonth')}
              className={`${inputBase} py-1.5`}
              disabled={!state.scheduleOn}
              value={state.month}
              onChange={(e) => setState((s) => ({ ...s, month: Number(e.target.value) }))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m, i18n.language)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex flex-wrap items-center gap-2 pl-6 text-sm">
            {t('templates.gap')}
            <input
              type="number"
              min={0}
              max={3650}
              disabled={!state.scheduleOn}
              className={`${inputBase} w-24 py-1.5`}
              value={state.minGapDays}
              onChange={(e) => setState((s) => ({ ...s, minGapDays: Number(e.target.value) || 0 }))}
            />
            {t('templates.days')}
          </label>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">{t('templates.appliesTo')}</legend>
          <p className="mb-2 text-xs text-stone-500">{t('templates.appliesToHint')}</p>
          <div className="flex flex-wrap gap-4">
            {CONTACT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={state.appliesTo.includes(type)}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      appliesTo: e.target.checked ? [...s.appliesTo, type] : s.appliesTo.filter((x) => x !== type),
                    }))
                  }
                />
                {t(`contactTypesPlural.${type}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div role="tablist" className="flex gap-1 border-b border-stone-200">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                role="tab"
                type="button"
                aria-selected={tab === lang}
                onClick={() => setTab(lang)}
                className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-stone-500 aria-selected:border-accent-700 aria-selected:text-stone-900"
              >
                {t('templates.version', { language: t(`languagesInline.${lang}`) })}
              </button>
            ))}
          </div>

          <div className="space-y-4 pt-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={v.include} onChange={(e) => setVersion({ include: e.target.checked })} />
              {t('templates.includeVersion', { language: t(`languagesInline.${tab}`) })}
            </label>

            {v.include && (
              <>
                <Field id={`${id}-${tab}-name`} label={t('templates.name')}>
                  <input id={`${id}-${tab}-name`} className={inputClass} value={v.name} onChange={(e) => setVersion({ name: e.target.value })} />
                </Field>
                <Field id={`${id}-${tab}-subject`} label={t('templates.subject')}>
                  <input
                    id={`${id}-${tab}-subject`}
                    data-field="subject"
                    className={inputClass}
                    value={v.subject}
                    onFocus={(e) => (lastField.current = e.currentTarget)}
                    onChange={(e) => setVersion({ subject: e.target.value })}
                  />
                </Field>
                <Field id={`${id}-${tab}-body`} label={t('templates.bodyLabel')}>
                  <AutoTextarea
                    id={`${id}-${tab}-body`}
                    data-field="body"
                    rows={8}
                    className={`${inputClass} resize-none font-[inherit] leading-relaxed`}
                    value={v.body}
                    onFocus={(e) => (lastField.current = e.currentTarget)}
                    onChange={(e) => setVersion({ body: e.target.value })}
                  />
                </Field>
                <div>
                  <p className="text-sm font-medium">{t('templates.placeholders')}</p>
                  <p className="mb-2 text-xs text-stone-500">{t('templates.placeholdersHint')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insert(p)}
                        className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs hover:border-accent-600 hover:bg-accent-50"
                      >
                        <span className="font-mono">{`{{${p}}}`}</span>{' '}
                        <span className="text-stone-500">{t(`templates.placeholder.${p}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {unknown.length > 0 && (
                  <Banner tone="warning">{t('templates.unknown', { list: unknown.map((u) => `{{${u}}}`).join(', ') })}</Banner>
                )}
                <Field id={`${id}-${tab}-instr`} label={t('templates.instructions')} hint={t('templates.instructionsHint')}>
                  <AutoTextarea
                    id={`${id}-${tab}-instr`}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    value={v.instructions}
                    onChange={(e) => setVersion({ instructions: e.target.value })}
                    aria-describedby={`${id}-${tab}-instr-hint`}
                  />
                </Field>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
