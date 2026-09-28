import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { deleteContacts } from '../../db/contacts';

export function DeleteDialog({
  ids,
  onClose,
  onDeleted,
}: {
  ids: string[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const count = ids.length;

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      await deleteContacts(ids);
      onDeleted();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={t('delete.title', { count })}
      footer={
        <>
          <Button onClick={onClose} autoFocus>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>
            {t('delete.confirm', { count })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {failed && <Banner tone="error">{t('contacts.saveFailed')}</Banner>}
        <p className="text-stone-700">{t('delete.body')}</p>
      </div>
    </Modal>
  );
}
