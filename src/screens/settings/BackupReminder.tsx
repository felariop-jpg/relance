import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { updateSettings, useSettings } from '../../db/settings';
import { needsBackupReminder, snoozeUntil } from '../../export/backup';
import { downloadBackup } from '../../export/backupActions';
import { showToast } from '../../lib/toast';

export function BackupReminder({ contactCount }: { contactCount: number }) {
  const { t } = useTranslation();
  const settings = useSettings();
  if (!needsBackupReminder(contactCount, settings)) return null;

  async function download() {
    try {
      const name = await downloadBackup();
      showToast({ tone: 'success', message: t('settings.backup.downloaded', { name }) });
    } catch {
      showToast({ tone: 'error', message: t('settings.backup.failed') });
    }
  }

  return (
    <Banner
      tone="warning"
      title={t('backupReminder.title')}
      actions={
        <>
          <Button size="sm" variant="primary" onClick={download}>
            {t('backupReminder.download')}
          </Button>
          <Button size="sm" onClick={() => void updateSettings({ backupReminderSnoozedUntil: snoozeUntil() })}>
            {t('backupReminder.later')}
          </Button>
        </>
      }
    >
      <p>{t('backupReminder.body', { count: contactCount })}</p>
    </Banner>
  );
}
