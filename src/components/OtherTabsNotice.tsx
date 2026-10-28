import { CONTAINER } from './layout';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOtherTabsOpen } from '../lib/tabs';
import { CloseIcon, InfoIcon } from './icons';

/** Non-blocking notice when Relance is also open in another tab or window. */
export function OtherTabsNotice() {
  const { t } = useTranslation();
  const others = useOtherTabsOpen();
  const [dismissed, setDismissed] = useState(false);
  if (!others || dismissed) return null;
  return (
    <div role="status" className="border-b border-sky-200 bg-sky-50 text-sky-950">
      <div className={`${CONTAINER} flex items-center gap-3 py-2 text-sm`}>
        <InfoIcon className="shrink-0" />
        <p className="flex-1">{t('tabs.notice')}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('common.close')}
          className="h-7 w-7 shrink-0 rounded p-1.5 opacity-60 hover:bg-black/5 hover:opacity-100"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
