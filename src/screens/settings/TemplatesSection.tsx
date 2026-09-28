import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { PencilIcon, PlusIcon, TrashIcon } from '../../components/icons';
import { docUrl } from '../../config';
import { db } from '../../db/db';
import { useTemplates } from '../../db/hooks';
import { LANGUAGES, type Lang } from '../../db/schema';
import { groupFamilies, restoreBuiltInTemplates, type TemplateFamily } from '../../db/templates';
import { familyRule } from '../../lib/schedule';
import { showToast } from '../../lib/toast';
import { ruleText } from '../due/ruleText';
import { editorStateFrom, TemplateEditor, type EditorState } from './TemplateEditor';
import { Section } from './Section';

export function TemplatesSection() {
  const { t, i18n } = useTranslation();
  const templates = useTemplates();
  const families = groupFamilies(templates ?? [], i18n.language as Lang);
  const [editing, setEditing] = useState<{ state: EditorState; baseline: EditorState } | null>(null);
  const open = (state: EditorState) => setEditing({ state, baseline: state });

  async function remove(family: TemplateFamily) {
    const rows = Object.values(family.versions).filter((x) => x !== undefined);
    await db.templates.bulkDelete(rows.map((r) => r.id));
    showToast({
      tone: 'info',
      message: t('templates.deleted', { name: family.name }),
      undo: () => db.templates.bulkPut(rows).then(() => undefined),
    });
  }

  async function restore() {
    const n = await restoreBuiltInTemplates();
    showToast({ tone: 'success', message: n > 0 ? t('templates.restored', { count: n }) : t('templates.restoredNone') });
  }

  return (
    <Section
      id="templates"
      title={t('templates.title')}
      description={
        <p>
          {t('templates.body')}{' '}
          <a href={docUrl('templates', i18n.language as Lang)} target="_blank" rel="noreferrer" className="font-medium text-accent-700 underline underline-offset-4">
            {t('templates.guide')}
          </a>
        </p>
      }
    >
      {templates && families.length === 0 && <p className="mb-3 text-sm text-stone-500">{t('templates.empty')}</p>}
      <ul className={`divide-y divide-stone-100 rounded-md border border-stone-200 ${families.length === 0 ? 'hidden' : ''}`}>
        {families.map((f) => {
          const { rule, appliesTo } = familyRule(f);
          return (
            <li key={f.family} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{f.name}</p>
                <p className="text-sm text-stone-500">
                  {rule ? ruleText(rule, appliesTo, i18n.language, t) : t('templates.noSchedule')}
                </p>
              </div>
              <div className="flex gap-1">
                {LANGUAGES.filter((l) => f.versions[l]).map((l) => (
                  <span key={l} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-stone-600 uppercase">
                    {l}
                  </span>
                ))}
              </div>
              <Button size="sm" onClick={() => open(editorStateFrom(f))}>
                <PencilIcon />
                {t('templates.edit')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void remove(f)} aria-label={t('contacts.cellLabel', { field: t('templates.delete'), name: f.name })}>
                <TrashIcon />
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => open(editorStateFrom(null))}>
          <PlusIcon />
          {t('templates.new')}
        </Button>
        <Button variant="ghost" onClick={restore}>
          {t('templates.restore')}
        </Button>
      </div>
      {editing && (
        <TemplateEditor
          key={editing.state.family}
          initial={editing.state}
          baseline={editing.baseline}
          onClose={() => setEditing(null)}
          onDiscard={(unsaved) => {
            const { baseline } = editing;
            setEditing(null);
            showToast({ tone: 'info', message: t('templates.discarded'), undo: () => setEditing({ state: unsaved, baseline }) });
          }}
        />
      )}
    </Section>
  );
}
