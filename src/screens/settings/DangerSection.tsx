import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { db } from '../../db/db';
import { Section } from './Section';

/** The one action that still asks for confirmation: it cannot be undone. */
export function DangerSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Section id="danger" title={t('settings.danger.title')} description={<p>{t('settings.danger.body')}</p>}>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {t('settings.danger.button')}
      </Button>
      {open && <DeleteEverythingDialog onClose={() => setOpen(false)} />}
    </Section>
  );
}

function DeleteEverythingDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const word = t('settings.danger.word');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const matches = typed.trim().toUpperCase() === word.toUpperCase();

  async function confirm() {
    if (!matches) return;
    setBusy(true);
    try {
      await db.delete();
      window.location.replace(window.location.pathname);
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
      title={t('settings.danger.dialogTitle')}
      footer={
        <>
          <Button onClick={onClose} data-autofocus>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!matches || busy}>
            {t('settings.danger.confirm')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        {failed && <Banner tone="error">{t('settings.danger.failed')}</Banner>}
        <p className="text-stone-700">{t('settings.danger.dialogBody')}</p>
        <label htmlFor={`${id}-word`} className="block text-sm font-medium">
          {t('settings.danger.typeWord', { word })}
        </label>
        <input
          id={`${id}-word`}
          className={`${inputClass} font-mono`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </form>
    </Modal>
  );
}
