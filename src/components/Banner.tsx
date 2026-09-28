import type { ReactNode } from 'react';
import { CheckIcon, CloseIcon, InfoIcon, WarningIcon } from './icons';
import { useTranslation } from 'react-i18next';

type Tone = 'info' | 'warning' | 'success' | 'error';

const TONES: Record<Tone, string> = {
  info: 'bg-sky-50 border-sky-200 text-sky-950',
  warning: 'bg-amber-50 border-amber-300 text-amber-950',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-950',
  error: 'bg-red-50 border-red-200 text-red-950',
};

const ICONS: Record<Tone, typeof InfoIcon> = {
  info: InfoIcon,
  warning: WarningIcon,
  success: CheckIcon,
  error: WarningIcon,
};

export function Banner({
  tone,
  title,
  children,
  actions,
  onDismiss,
}: {
  tone: Tone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}
    >
      <Icon className="mt-0.5 shrink-0 text-base" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="space-y-1">{children}</div>}
        {actions && <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('common.close')}
          className="-m-1 h-7 w-7 shrink-0 rounded p-1.5 opacity-60 hover:bg-black/5 hover:opacity-100"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
