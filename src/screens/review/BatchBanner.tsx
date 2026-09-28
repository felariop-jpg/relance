import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBatch } from '../../ai/batch';
import { Banner } from '../../components/Banner';
import { useSettings } from '../../db/settings';
import { formatEur } from '../../lib/money';
import { href } from '../../nav';

/** Progress while a batch runs; the outcome and real cost once it ends. */
export function BatchBanner() {
  const { t, i18n } = useTranslation();
  const batch = useBatch();
  const settings = useSettings();
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  useEffect(() => {
    if (batch.running) setDismissedAt(null);
  }, [batch.running]);

  if (batch.total === 0 || dismissedAt !== null) return null;

  if (batch.running) {
    return (
      <Banner tone="info">
        <p className="font-medium">{t('batch.writing', { done: batch.done + batch.failed, total: batch.total })}</p>
        {batch.offline && <p className="font-medium">{t('batch.offline')}</p>}
        {batch.waiting && <p>{t('batch.waiting')}</p>}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-200">
          <div
            className="h-full bg-sky-600 transition-all"
            style={{ width: `${Math.round(((batch.done + batch.failed) / batch.total) * 100)}%` }}
          />
        </div>
      </Banner>
    );
  }

  const demo = !settings.apiKey.trim();
  return (
    <Banner tone={batch.failed > 0 ? 'warning' : 'success'} onDismiss={() => setDismissedAt(Date.now())}>
      <p className="font-medium">
        {t('batch.finished', { count: batch.done })}{' '}
        {batch.failed > 0 && t('batch.failed', { count: batch.failed })}
      </p>
      <p>
        {demo && batch.costEur === 0
          ? t('batch.demoCost')
          : t('batch.cost', { cost: formatEur(batch.costEur, i18n.language, t) })}
      </p>
      {batch.authFailed && (
        <p>
          {t('batch.authFailed')}{' '}
          <a href={href('settings')} className="font-medium underline underline-offset-4">
            {t('demo.goSettings')}
          </a>
        </p>
      )}
    </Banner>
  );
}
