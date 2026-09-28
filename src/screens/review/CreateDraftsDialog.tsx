import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { db } from '../../db/db';
import { createTemplateDrafts } from '../../db/drafts';
import { enqueueDrafts } from '../../ai/batch';
import { createPendingDrafts } from '../../ai/generate';
import { MethodPicker, type Method } from './MethodPicker';
import { useTemplates } from '../../db/hooks';
import { LANGUAGES, type Contact, type Lang } from '../../db/schema';
import { useSettings } from '../../db/settings';
import { canUseTemplate, groupFamilies, missingOpenThread, pickVersion } from '../../db/templates';
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
  const [method, setMethod] = useState<Method>('ai');
  const [busy, setBusy] = useState(false);
  const demo = !settings.apiKey.trim();
  const [failed, setFailed] = useState(false);
  // How many of the chosen contacts each template can actually be used for.
  const eligibleFor = (f: (typeof families)[number]) =>
    (contacts ?? []).filter((c) => {
      const version = pickVersion(f, resolveLanguage(c, settings));
      return version ? canUseTemplate(version, c, settings.withheldFields) : false;
    }).length;
  const usable = families.filter((f) => eligibleFor(f) > 0);
  const family = usable.find((f) => f.family === chosen) ?? usable[0];

  const byLanguage = useMemo(() => {
    const counts: Record<Lang, number> = { en: 0, fr: 0 };
    for (const c of contacts ?? []) counts[resolveLanguage(c, settings)]++;
    return counts;
  }, [contacts, settings]);

  const total = contacts?.length ?? 0;
  const eligibleContacts = (contacts ?? []).filter((c) => {
    const version = family ? pickVersion(family, resolveLanguage(c, settings)) : undefined;
    return version ? canUseTemplate(version, c, settings.withheldFields) : false;
  });
  const needFinishing = family && method === 'ai' && !demo ? missingOpenThread(family, eligibleContacts, settings.withheldFields) : 0;
  const count = family ? eligibleFor(family) : 0;

  async function submit() {
    if (!family || !contacts) return;
    setBusy(true);
    setFailed(false);
    try {
      if (method === 'template') {
        const drafts = await createTemplateDrafts(contacts, family, settings);
        showToast({ tone: 'success', message: t('create.done', { count: drafts.length }) });
      } else {
        const drafts = await createPendingDrafts(contacts, family, settings);
        enqueueDrafts(drafts.map((d) => d.id));
      }
      onClose();
      window.location.hash = href('review');
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
              {families.map((f) => {
                const unavailable = eligibleFor(f) === 0;
                const required = [...new Set(Object.values(f.versions).flatMap((v) => v?.requiresAnyOf ?? []))];
                const fields = required.map((r) => t('create.quoted', { name: t(`fields.${r}`) })).join(t('create.or'));
                return (
                  <label
                    key={f.family}
                    className={`flex items-start gap-3 rounded-lg border border-stone-300 p-3 has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50 ${unavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="family"
                      className="mt-1 accent-accent-700"
                      disabled={unavailable}
                      checked={family?.family === f.family}
                      onChange={() => setChosen(f.family)}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{f.name}</span>
                      <span className="block text-sm text-stone-500">
                        {unavailable && required.length > 0
                          ? t('create.unavailable', { fields })
                          : (f.versions[i18n.language as Lang] ?? Object.values(f.versions)[0])?.purpose}
                      </span>
                      {required.length > 0 && !unavailable && (
                        <span className="mt-1 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                          {t('create.needsFields', { fields })}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {needFinishing > 0 && <Banner tone="warning">{t('create.willNeedOpenThread', { count: needFinishing })}</Banner>}

        {family && count < total && (
          <Banner tone="info">
            {t('create.leftOut', {
              count: total - count,
              fields: [...new Set(Object.values(family.versions).flatMap((v) => v?.requiresAnyOf ?? []))]
                .map((r) => t('create.quoted', { name: t(`fields.${r}`) }))
                .join(t('create.or')),
            })}
          </Banner>
        )}

        {family &&
          LANGUAGES.filter((l) => byLanguage[l] > 0 && !family.versions[l]).map((l) => (
            <Banner key={l} tone="info">
              {t('create.fallback', {
                count: byLanguage[l],
                language: t(`languagesInline.${l}`),
                fallback: t(`languagesInline.${l === 'en' ? 'fr' : 'en'}`),
              })}
            </Banner>
          ))}

        <MethodPicker method={method} onChange={setMethod} demo={demo} count={count} />
      </div>
    </Modal>
  );
}
