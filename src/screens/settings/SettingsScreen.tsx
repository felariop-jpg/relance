import { useTranslation } from 'react-i18next';
import { BackupSection } from './BackupSection';

export function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
      <BackupSection />
      <p className="text-sm text-stone-500">{t('settings.more')}</p>
    </div>
  );
}
