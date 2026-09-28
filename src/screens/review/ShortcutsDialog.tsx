import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/Modal';

const KEYS = [
  ['j', 'next'],
  ['k', 'previous'],
  ['a', 'approve'],
  ['s', 'skip'],
  ['e', 'edit'],
  ['r', 'rewrite'],
  ['esc', 'leave'],
  ['?', 'help'],
] as const;

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open size="sm" onClose={onClose} title={t('shortcuts.title')}>
      <dl className="divide-y divide-stone-100">
        {KEYS.map(([key, action]) => (
          <div key={key} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-sm text-stone-700">{t(`shortcuts.${action}`)}</dt>
            <dd>
              <kbd className="inline-block min-w-8 rounded border border-stone-300 bg-stone-50 px-2 py-0.5 text-center font-mono text-sm shadow-sm">
                {key === 'esc' ? t('shortcuts.keyEsc') : key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-stone-500">{t('shortcuts.note')}</p>
    </Modal>
  );
}
