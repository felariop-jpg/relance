import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkApiKey } from '../../ai/anthropic';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Field, inputClass } from '../../components/Field';
import { docUrl } from '../../config';
import { updateSettings, useSettings } from '../../db/settings';
import type { Lang } from '../../db/schema';
import { formatDate } from '../../lib/dates';
import { formatEur } from '../../lib/money';
import { EUR_PER_USD } from '../../ai/model';
import { PRICING_URL } from '../../config';
import { showToast } from '../../lib/toast';
import { maskApiKey } from '../../lib/mask';
import { Section } from './Section';

export function AiSection() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const id = useId();
  const [key, setKey] = useState(settings.apiKey);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'invalid' | 'network'>('idle');
  const touched = useRef(false);

  // Pick up the stored key once it loads, unless the user already typed.
  useEffect(() => {
    if (!touched.current) setKey(settings.apiKey);
  }, [settings.apiKey]);

  const save = (value: string) => {
    touched.current = true;
    setKey(value);
    setStatus('idle');
    void updateSettings({ apiKey: value.trim() });
  };

  async function check() {
    setStatus('checking');
    setStatus(await checkApiKey(key.trim()));
  }

  return (
    <Section id="ai" title={t('settings.ai.title')} description={<p>{t('settings.ai.body')}</p>}>
      <div className="space-y-3">
        <Field
          id={`${id}-key`}
          label={t('settings.ai.key')}
          hint={
            <>
              {t('settings.ai.keyHint')}{' '}
              <a
                href={docUrl('api-key', i18n.language as Lang)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent-700 underline underline-offset-4"
              >
                {t('settings.ai.guide')}
              </a>
            </>
          }
        >
          <div className="flex gap-2">
            {!visible && key.trim() ? (
              // Saved key, hidden: only its last four characters. Show to see or change it.
              <input
                id={`${id}-key`}
                type="text"
                readOnly
                className={`${inputClass} bg-stone-50 font-mono text-stone-700`}
                value={maskApiKey(key)}
                aria-describedby={`${id}-key-hint ${id}-key-masked`}
              />
            ) : (
              <input
                id={`${id}-key`}
                type={visible ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                className={`${inputClass} font-mono`}
                value={key}
                onChange={(e) => save(e.target.value)}
                aria-describedby={`${id}-key-hint`}
              />
            )}
            <Button onClick={() => setVisible((v) => !v)}>{visible ? t('settings.ai.hide') : t('settings.ai.show')}</Button>
          </div>
        </Field>
        {!visible && key.trim() && (
          <p id={`${id}-key-masked`} className="-mt-1 text-sm text-stone-600">
            {t('settings.ai.maskedHint')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={check} disabled={!key.trim() || status === 'checking'}>
            {status === 'checking' ? t('settings.ai.checking') : t('settings.ai.check')}
          </Button>
          {!key.trim() && <span className="text-sm text-stone-600">{t('settings.ai.empty')}</span>}
        </div>
        {status === 'ok' && <Banner tone="success">{t('settings.ai.ok')}</Banner>}
        {status === 'invalid' && <Banner tone="error">{t('settings.ai.invalid')}</Banner>}
        {status === 'network' && <Banner tone="error">{t('settings.ai.network')}</Banner>}
      </div>
    </Section>
  );
}

export function CostSection() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();

  function reset() {
    const before = { costTotalEur: settings.costTotalEur, costSince: settings.costSince };
    void updateSettings({ costTotalEur: 0, costSince: new Date().toISOString() });
    showToast({ tone: 'info', message: t('settings.cost.resetDone'), undo: () => void updateSettings(before) });
  }

  return (
    <Section id="cost" title={t('settings.cost.title')} description={<p>{t('settings.cost.hint')}</p>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-medium">
          {t('settings.cost.total', {
            date: formatDate(settings.costSince.slice(0, 10), i18n.language),
            cost: formatEur(settings.costTotalEur, i18n.language, t),
          })}
        </p>
        <Button onClick={reset} disabled={settings.costTotalEur === 0}>
          {t('settings.cost.reset')}
        </Button>
      </div>
      <p className="mt-3 text-sm text-stone-600">
        {t('settings.cost.estimateNote', { rate: EUR_PER_USD.toLocaleString(i18n.language) })}{' '}
        <a href={PRICING_URL} target="_blank" rel="noreferrer" className="font-medium text-accent-700 underline underline-offset-4">
          {t('settings.cost.pricing')}
        </a>
      </p>
    </Section>
  );
}
