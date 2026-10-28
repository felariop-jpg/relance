import { useLiveQuery } from 'dexie-react-hooks';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compareVoice, type CompareSide, type VoiceComparison } from '../../ai/compare';
import { estimateCostEur } from '../../ai/model';
import { Button } from '../../components/Button';
import { Field, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { db } from '../../db/db';
import { useTemplates } from '../../db/hooks';
import { useSettings } from '../../db/settings';
import { canUseTemplate, groupFamilies, pickVersion } from '../../db/templates';
import { resolveLanguage } from '../../lib/language';
import { formatEur } from '../../lib/money';
import { contactName } from '../contacts/ContactTable';

/**
 * Writes one email twice, with and without the voice samples, side by side.
 * The only way to see what the samples actually change.
 */
export function VoiceCompare() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const id = useId();
  const settings = useSettings();
  const templates = useTemplates();
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);
  const [contactId, setContactId] = useState('');
  const [family, setFamily] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VoiceComparison | null>(null);

  const saved = settings.voiceSamples.some((s) => s.trim());
  const hasKey = settings.apiKey.trim() !== '';
  const sorted = useMemo(
    () => [...(contacts ?? [])].sort((a, b) => contactName(a).localeCompare(contactName(b), locale)),
    [contacts, locale],
  );
  // Start with someone who has notes: the comparison is clearest on a real email.
  const contact = sorted.find((c) => c.id === contactId) ?? sorted.find((c) => c.notes.trim()) ?? sorted[0];
  const usable = useMemo(() => {
    if (!contact || !templates) return [];
    const language = resolveLanguage(contact, settings);
    return groupFamilies(templates, settings.uiLanguage).flatMap((f) => {
      const template = pickVersion(f, language);
      return template && canUseTemplate(template, contact, settings.withheldFields) ? [{ family: f, template }] : [];
    });
  }, [contact, templates, settings]);
  const chosen = usable.find((u) => u.family.family === family) ?? usable[0];

  const blocked = !saved ? 'noSamples' : !hasKey ? 'noKey' : !contact ? 'noContacts' : !chosen ? 'noTemplate' : null;

  async function run() {
    if (!contact || !chosen) return;
    setConfirming(false);
    setRunning(true);
    setResult(null);
    try {
      setResult(await compareVoice(contact, chosen.template));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div>
        <h3 className="font-medium">{t('settings.voice.compare.title')}</h3>
        <p className="text-sm text-stone-600">{t('settings.voice.compare.body')}</p>
      </div>

      {blocked ? (
        <>
          <Button disabled>{t('settings.voice.compare.button')}</Button>
          <p className="text-sm text-stone-600">{t(`settings.voice.compare.unavailable.${blocked}`)}</p>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`${id}-contact`} label={t('settings.voice.compare.contact')}>
              <select
                id={`${id}-contact`}
                className={inputClass}
                value={contact!.id}
                onChange={(e) => {
                  setContactId(e.target.value);
                  setResult(null);
                }}
              >
                {sorted.map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactName(c)}
                    {c.company ? ` · ${c.company}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`${id}-template`} label={t('settings.voice.compare.template')}>
              <select
                id={`${id}-template`}
                className={inputClass}
                value={chosen!.family.family}
                onChange={(e) => {
                  setFamily(e.target.value);
                  setResult(null);
                }}
              >
                {usable.map((u) => (
                  <option key={u.family.family} value={u.family.family}>
                    {u.family.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button variant="primary" disabled={running} onClick={() => setConfirming(true)}>
            {running ? t('settings.voice.compare.running') : t('settings.voice.compare.button')}
          </Button>
        </>
      )}

      {result && (
        <div className="space-y-2" aria-live="polite">
          <div className="grid gap-3 md:grid-cols-2">
            <Side title={t('settings.voice.compare.with')} side={result.withSamples} />
            <Side title={t('settings.voice.compare.without')} side={result.withoutSamples} />
          </div>
          {(result.totalEur > 0 || result.withSamples.ok || result.withoutSamples.ok) && (
            <p className="text-sm text-stone-600">
              {t('settings.voice.compare.cost', { cost: formatEur(result.totalEur, locale, t) })}{' '}
              {result.withSamples.ok && result.withoutSamples.ok && t('settings.voice.compare.variation')}
            </p>
          )}
        </div>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title={t('settings.voice.compare.confirmTitle')}
        footer={
          <>
            <Button onClick={() => setConfirming(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={run}>
              {t('settings.voice.compare.confirm')}
            </Button>
          </>
        }
      >
        {contact && (
          <p>
            {t('settings.voice.compare.confirmBody', {
              name: contactName(contact),
              cost: formatEur(estimateCostEur(2), locale, t),
            })}
          </p>
        )}
      </Modal>
    </div>
  );
}

function Side({ title, side }: { title: string; side: CompareSide }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3">
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-stone-600 uppercase">{title}</h4>
      {side.ok ? (
        <>
          <p className="mb-2 font-medium">{side.subject}</p>
          <p className="text-sm whitespace-pre-wrap">{side.body}</p>
        </>
      ) : (
        <p className="text-sm text-red-800">{t(`review.errors.${side.code}`, { defaultValue: t('review.errors.unknown') })}</p>
      )}
    </section>
  );
}
