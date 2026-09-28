import { useTranslation } from 'react-i18next';
import { useSettings } from '../db/settings';
import { href } from '../nav';

/** Always visible while there is no API key, so nobody mistakes examples for AI output. */
export function DemoBanner() {
  const { t } = useTranslation();
  const settings = useSettings();
  if (settings.apiKey.trim()) return null;
  return (
    <div role="status" className="border-b border-amber-300 bg-amber-100 text-amber-950">
      <p className="mx-auto max-w-screen-2xl px-4 py-2 text-sm">
        {t('demo.banner')}{' '}
        <a href={href('settings')} className="font-semibold underline underline-offset-4">
          {t('demo.goSettings')}
        </a>
      </p>
    </div>
  );
}
