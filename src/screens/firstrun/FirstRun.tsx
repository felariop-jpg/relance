import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { inputClass } from '../../components/Field';
import { CheckIcon } from '../../components/icons';
import { docUrl } from '../../config';
import { LANGUAGE_ENDONYMS, LANGUAGES, type Lang } from '../../db/schema';
import { updateSettings, useSettings } from '../../db/settings';
import { loadSampleContacts } from '../../lib/sample';
import { href } from '../../nav';
import { ImportDialog } from '../contacts/ImportDialog';

/** Three short steps, shown once. Every step can be skipped. */
export function FirstRun() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const [step, setStep] = useState(1);
  const [key, setKey] = useState(settings.apiKey);
  const [importing, setImporting] = useState(false);
  const [sampleError, setSampleError] = useState(false);

  const finish = () => {
    void updateSettings({ firstRunDone: true, apiKey: key.trim() });
    window.location.hash = href('contacts');
  };

  async function sample() {
    setSampleError(false);
    try {
      await loadSampleContacts();
      finish();
    } catch {
      setSampleError(true);
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-stone-50" role="dialog" aria-modal="true" aria-labelledby="firstrun-title">
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="./favicon.svg" alt="" className="h-8 w-8" />
            <span className="text-lg font-semibold">{t('app.name')}</span>
          </div>
          <div className="flex rounded-md border border-stone-300 p-0.5 text-xs font-semibold">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                lang={lang}
                aria-pressed={settings.uiLanguage === lang}
                onClick={() => void updateSettings({ uiLanguage: lang })}
                className="rounded px-2 py-1 text-stone-600 aria-pressed:bg-stone-800 aria-pressed:text-white"
              >
                {LANGUAGE_ENDONYMS[lang]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-stone-500">{t('firstRun.step', { n: step })}</p>

          {step === 1 && (
            <>
              <h1 id="firstrun-title" className="mt-2 text-2xl font-semibold">
                {t('firstRun.welcome.title')}
              </h1>
              <p className="mt-3 text-stone-700">{t('firstRun.welcome.lead')}</p>
              <ul className="mt-4 space-y-2">
                {(['does1', 'does2', 'does3'] as const).map((k) => (
                  <li key={k} className="flex gap-2 text-stone-700">
                    <CheckIcon className="mt-1 shrink-0 text-accent-700" />
                    {t(`firstRun.welcome.${k}`)}
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-2 rounded-lg bg-accent-50 p-4 text-accent-800">
                <p className="font-semibold">{t('firstRun.welcome.never')}</p>
                <p>{t('firstRun.welcome.local')}</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="firstrun-title" className="mt-2 text-2xl font-semibold">
                {t('firstRun.key.title')}
              </h1>
              <p className="mt-3 text-stone-700">{t('firstRun.key.body')}</p>
              <a
                href={docUrl('api-key', i18n.language as Lang)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block font-medium text-accent-700 underline underline-offset-4"
              >
                {t('firstRun.key.guide')}
              </a>
              <label htmlFor="firstrun-key" className="mt-5 block text-sm font-medium">
                {t('settings.ai.key')}
              </label>
              <input
                id="firstrun-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                className={`${inputClass} mt-1 font-mono`}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <p className="mt-3 text-sm text-stone-500">{t('firstRun.key.later')}</p>
            </>
          )}

          {step === 3 && (
            <>
              <h1 id="firstrun-title" className="mt-2 text-2xl font-semibold">
                {t('firstRun.contacts.title')}
              </h1>
              <p className="mt-3 text-stone-700">{t('firstRun.contacts.body')}</p>
              {sampleError && (
                <div className="mt-4">
                  <Banner tone="error">{t('contacts.sampleError')}</Banner>
                </div>
              )}
              <div className="mt-5 flex flex-col gap-2">
                <Button variant="primary" className="min-h-12" onClick={() => setImporting(true)}>
                  {t('firstRun.contacts.import')}
                </Button>
                <Button className="min-h-12" onClick={sample}>
                  {t('firstRun.contacts.sample')}
                </Button>
                <Button variant="ghost" className="min-h-12" onClick={finish}>
                  {t('firstRun.contacts.empty')}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={finish} className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-800">
            {t('firstRun.skip')}
          </button>
          <div className="flex gap-2">
            {step > 1 && <Button onClick={() => setStep(step - 1)}>{t('firstRun.back')}</Button>}
            {step < 3 && (
              <Button variant="primary" onClick={() => setStep(step + 1)}>
                {t('firstRun.next')}
              </Button>
            )}
          </div>
        </div>
      </div>
      {importing && (
        <ImportDialog
          onClose={() => {
            setImporting(false);
            finish();
          }}
        />
      )}
    </div>
  );
}
