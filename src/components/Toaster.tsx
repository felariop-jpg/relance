import { useTranslation } from 'react-i18next';
import { dismissToast, runUndo, useToasts } from '../lib/toast';
import { CloseIcon } from './icons';

const TONES = {
  info: 'bg-stone-900 text-white',
  success: 'bg-stone-900 text-white',
  error: 'bg-red-800 text-white',
};

export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${TONES[toast.tone]}`}
        >
          <span className="flex-1">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => void runUndo(toast.id)}
              className="min-h-9 rounded px-3 font-semibold text-accent-100 underline-offset-4 hover:underline"
            >
              {t('common.undo')}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label={t('common.close')}
            className="h-8 w-8 shrink-0 rounded p-2 opacity-70 hover:bg-white/10 hover:opacity-100"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
