import { useTranslation } from 'react-i18next';
import { AiSection, CostSection } from './AiSection';
import { BackupSection } from './BackupSection';
import { DangerSection } from './DangerSection';
import { LanguagesSection } from './LanguagesSection';
import { PrivacySection } from './PrivacySection';
import { TemplatesSection } from './TemplatesSection';
import { VoiceSection } from './VoiceSection';
import { YouSection } from './YouSection';

const SECTIONS = [
  ['ai', 'settings.ai.title'],
  ['you', 'settings.you.title'],
  ['privacy', 'settings.privacy.title'],
  ['languages', 'settings.languages.title'],
  ['voice', 'settings.voice.title'],
  ['templates', 'templates.title'],
  ['cost', 'settings.cost.title'],
  ['backup', 'settings.backup.title'],
  ['danger', 'settings.danger.title'],
] as const;

export function SettingsScreen() {
  const { t } = useTranslation();
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
      <nav aria-label={t('settings.jump')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {SECTIONS.map(([id, key]) => (
          <button key={id} type="button" onClick={() => jump(id)} className="text-accent-700 underline-offset-4 hover:underline">
            {t(key)}
          </button>
        ))}
      </nav>
      <AiSection />
      <YouSection />
      <PrivacySection />
      <LanguagesSection />
      <VoiceSection />
      <TemplatesSection />
      <CostSection />
      <BackupSection />
      <DangerSection />
    </div>
  );
}
