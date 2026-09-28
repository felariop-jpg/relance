import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { restoreFromTrash, TRASH_DAYS } from '../../db/contacts';
import { emptyTrash, putBackTrash, useTrash } from '../../db/trash';
import { showToast } from '../../lib/toast';
import { contactName } from './ContactTable';

/** "Recently deleted": deletions from any tab, restorable for 30 days. */
export function TrashDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const entries = useTrash() ?? [];
  const when = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  async function restore(id: string) {
    const { contacts } = await restoreFromTrash(id);
    showToast({ tone: 'success', message: t('trash.restored', { count: contacts }) });
  }

  async function empty() {
    const removed = await emptyTrash();
    showToast({ tone: 'info', message: t('trash.emptied'), undo: () => putBackTrash(removed) });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('trash.title')}
      footer={
        <>
          {entries.length > 0 && (
            <Button variant="ghost" className="mr-auto text-red-700 hover:bg-red-50" onClick={empty}>
              {t('trash.empty')}
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-stone-600">{t('trash.body', { days: TRASH_DAYS })}</p>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-stone-500">{t('trash.none')}</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-md border border-stone-200">
          {entries.map((e) => {
            const names = e.contacts.map(contactName);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {names.slice(0, 3).join(', ')}
                    {names.length > 3 && ` ${t('trash.andMore', { count: names.length - 3 })}`}
                  </p>
                  <p className="text-sm text-stone-500">{t('trash.deletedAt', { date: when(e.deletedAt) })}</p>
                </div>
                <Button size="sm" onClick={() => void restore(e.id)}>
                  {t('trash.restore', { count: e.contacts.length })}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
