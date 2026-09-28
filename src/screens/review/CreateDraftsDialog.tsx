import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { db } from '../../db/db';
import { createTemplateDrafts } from '../../db/drafts';
import { useTemplates } from '../../db/hooks';
import { LANGUAGES, type Contact, type Lang } from '../../db/schema';
import { useSettings } from '../../db/settings';
import { groupFamilies } from '../../db/templates';
import { resolveLanguage } from '../../lib/language';
import { showToast } from '../../lib/toast';
import { href } from '../../nav';

export function CreateDraftsDialog({
  contactIds,
  initialFamily,
  onClose,
}: {
  contactIds: string[];
  initialFamily?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const templates = useTemplates();
  const contacts = useLiveQuery(
    async () =>
      (await db.contacts.bulkGet(contactIds)).filter((c): c is Contact => Boolean(c)),
    [contactIds],
  );
  const families = useMemo(
    () => groupFamilies(templates ?? [], i18n.language as Lang),
    [templates, i18n.language],
  );
  const [chosen, setChosen] = useState<string | undefined>(initialFamily);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const family = families.find((f) => f.family === chosen) ?? families[0];

  const byLanguage = useMemo(() => {
    const counts: Record<Lang, number> = { en: 0, fr: 0 };
    for (const c of contacts ?? []) counts[resolveLanguage(c, settings)]++;
    return counts;
  }, [contacts, settings]);

  const count = contacts?.length ?? 0;

  async function submit() {
    if (!family || !contacts) return;
    setBusy(true);
    setFailed(false);
    try {
      const drafts = await createTemplateDrafts(contacts, family, settings);
      onClose();
      window.location.hash = href('review');
      showToast({ tone: 'success', message: t('create.done', { count: drafts.length }) });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('create.title')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !family || count === 0}>
            {t('create.submit', { count })}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {failed && <Banner tone="error">{t('create.failed')}</Banner>}
        <p className="text-sm text-stone-600">{t('create.for', { count })}</p>

        {families.length === 0 ? (
          <Banner tone="warning">{t('create.noTemplates')}</Banner>
        ) : (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('create.template')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {families.map((f) => (
                <label
                  key={f.family}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-300 p-3 has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50"
                >
                  <input
                    type="radio"
                    name="family"
                    className="mt-1 accent-accent-700"
                    checked={family?.family === f.family}
                    onChange={() => setChosen(f.family)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{f.name}</span>
                    <span className="block truncate text-sm text-stone-500">
                      {(f.versions[i18n.language as Lang] ?? Object.values(f.versions)[0])?.subject}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {family &&
          LANGUAGES.filter((l) => byLanguage[l] > 0 && !family.versions[l]).map((l) => (
            <Banner key={l} tone="info">
              {t('create.fallback', {
                count: byLanguage[l],
                language: t(`languages.${l}`).toLowerCase(),
                fallback: t(`languages.${l === 'en' ? 'fr' : 'en'}`).toLowerCase(),
              })}
            </Banner>
          ))}

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('create.method')}</legend>
          <label className="flex items-start gap-3 rounded-lg border border-accent-600 bg-accent-50 p-3">
            <input type="radio" name="method" className="mt-1 accent-accent-700" checked readOnly />
            <span>
              <span className="block font-medium">{t('create.methodTemplate')}</span>
              <span className="block text-sm text-stone-600">{t('create.methodTemplateHint')}</span>
            </span>
          </label>
        </fieldset>
      </div>
    </Modal>
  );
}
