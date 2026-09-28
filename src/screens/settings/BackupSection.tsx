import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { DownloadIcon, UploadIcon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { useSettings } from '../../db/settings';
import { createBackup, parseBackup, restoreBackup, undoRestore, type Backup } from '../../export/backup';
import { downloadBackup } from '../../export/backupActions';
import { formatDate } from '../../lib/dates';
import { showToast } from '../../lib/toast';
import { Section } from './Section';

export function BackupSection() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<Backup | null>(null);

  async function download() {
    setError(null);
    try {
      const name = await downloadBackup();
      showToast({ tone: 'success', message: t('settings.backup.downloaded', { name }) });
    } catch {
      setError(t('settings.backup.failed'));
    }
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    const parsed = parseBackup(await file.text());
    if (parsed.ok) setRestoring(parsed.backup);
    else setError(t(`settings.restore.${parsed.error}`));
  }

  return (
    <Section id="backup" title={t('settings.backup.title')} description={<p>{t('settings.backup.body')}</p>}>
      <div className="space-y-3">
        {error && <Banner tone="error">{error}</Banner>}
        <p className="text-sm text-stone-600">
          {settings.lastBackupAt
            ? t('settings.backup.last', { date: formatDate(settings.lastBackupAt.slice(0, 10), i18n.language) })
            : t('settings.backup.never')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={download}>
            <DownloadIcon />
            {t('settings.backup.download')}
          </Button>
          <label
            htmlFor={`${id}-file`}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-medium hover:bg-stone-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-600"
          >
            <UploadIcon />
            {t('settings.backup.restore')}
            <input
              id={`${id}-file`}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
      {restoring && <RestoreDialog backup={restoring} onClose={() => setRestoring(null)} />}
    </Section>
  );
}

function RestoreDialog({ backup, onClose }: { backup: Backup; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setBusy(true);
    setFailed(false);
    try {
      // Kept in memory so the toast can undo the restore.
      const before = await createBackup();
      const result = await restoreBackup(backup, mode);
      onClose();
      showToast({
        tone: 'success',
        message: t('settings.restore.done', { ...result }),
        undo: () => void undoRestore(before, backup),
      });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  const option = (value: 'merge' | 'replace') => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-300 p-3 has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50">
      <input
        type="radio"
        name="restore-mode"
        className="mt-1 accent-accent-700"
        checked={mode === value}
        onChange={() => setMode(value)}
      />
      <span>
        <span className="block font-medium">{t(`settings.restore.${value}`)}</span>
        <span className="block text-sm text-stone-600">{t(`settings.restore.${value}Hint`)}</span>
      </span>
    </label>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={t('settings.restore.title')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {t('settings.restore.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {failed && <Banner tone="error">{t('settings.restore.failed')}</Banner>}
        <p className="text-sm text-stone-600">
          {t('settings.restore.summary', {
            date: formatDate(backup.exportedAt.slice(0, 10), i18n.language),
            contacts: backup.contacts.length,
            drafts: backup.drafts.length,
            templates: backup.templates.length,
          })}
        </p>
        <fieldset className="space-y-2">
          {option('merge')}
          {option('replace')}
        </fieldset>
      </div>
    </Modal>
  );
}
