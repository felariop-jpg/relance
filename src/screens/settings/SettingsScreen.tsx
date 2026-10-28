import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { routeParams, useHash } from '../../nav';
import { useSettings } from '../../db/settings';
import { AiSection, CostSection } from './AiSection';
import { BackupSection } from './BackupSection';
import { DangerSection } from './DangerSection';
import { LanguagesSection } from './LanguagesSection';
import { PrivacySection } from './PrivacySection';
import { TemplatesSection } from './TemplatesSection';
import { VoiceSection } from './VoiceSection';
import { YouSection } from './YouSection';

/** The page order, grouped for the side menu. */
const GROUPS = [
  {
    id: 'ai',
    title: 'settings.groups.ai',
    sections: [
      ['ai', 'settings.ai.title'],
      ['privacy', 'settings.privacy.title'],
      ['cost', 'settings.cost.title'],
    ],
  },
  {
    id: 'emails',
    title: 'settings.groups.emails',
    sections: [
      ['you', 'settings.you.title'],
      ['languages', 'settings.languages.title'],
      ['voice', 'settings.voice.title'],
      ['templates', 'templates.title'],
    ],
  },
  {
    id: 'data',
    title: 'settings.groups.data',
    sections: [
      ['backup', 'settings.backup.title'],
      ['danger', 'settings.danger.title'],
    ],
  },
] as const;

type SectionEntry = (typeof GROUPS)[number]['sections'][number];
const ALL_SECTIONS: SectionEntry[] = GROUPS.flatMap((g): SectionEntry[] => [...g.sections]);
const SECTION_IDS: string[] = ALL_SECTIONS.map(([id]) => id);

const pill = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-accent-600';

export function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  const hash = useHash();
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Links such as #/settings?section=you (from the Overview or the header badge) open at that section.
  useEffect(() => {
    const section = routeParams(hash).get('section');
    if (!section || !SECTION_IDS.includes(section)) return;
    const timer = setTimeout(() => jump(section), 50);
    return () => clearTimeout(timer);
  }, [hash]);

  const hasKey = settings.apiKey.trim() !== '';
  const hasName = settings.senderName.trim() !== '';
  const ok = 'border-accent-100 bg-accent-50 text-accent-800';
  const missing = 'border-amber-300 bg-amber-50 text-amber-900';

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => jump('ai')} className={`${pill} ${hasKey ? ok : missing}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${hasKey ? 'bg-accent-600' : 'bg-amber-500'}`} />
            {hasKey ? t('settings.status.keySet') : t('settings.status.keyMissing')}
          </button>
          <button type="button" onClick={() => jump('you')} className={`${pill} ${hasName ? ok : missing}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${hasName ? 'bg-accent-600' : 'bg-amber-500'}`} />
            {hasName ? t('settings.status.nameSet', { name: settings.senderName.trim() }) : t('settings.status.nameMissing')}
          </button>
        </div>
      </div>

      {/* Narrow screens: one scroll with anchor links. */}
      <nav aria-label={t('settings.jump')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm lg:hidden">
        {ALL_SECTIONS.map(([id, key]) => (
          <button key={id} type="button" onClick={() => jump(id)} className="text-accent-700 underline-offset-4 hover:underline">
            {t(key)}
          </button>
        ))}
      </nav>

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,48rem)] lg:gap-8">
        {/* Wide screens: a grouped side menu that stays in view. */}
        <nav aria-label={t('settings.jump')} className="hidden lg:block">
          <div className="sticky top-4 space-y-4">
            {GROUPS.map((g) => (
              <div key={g.id}>
                <p className="px-2 text-xs font-semibold tracking-wide text-stone-600 uppercase">{t(g.title)}</p>
                <ul className="mt-1 space-y-0.5">
                  {g.sections.map(([id, key]) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => jump(id)}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-accent-600"
                      >
                        {t(key)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          <GroupLabel>{t('settings.groups.ai')}</GroupLabel>
          <AiSection />
          <PrivacySection />
          <CostSection />
          <GroupLabel>{t('settings.groups.emails')}</GroupLabel>
          <YouSection />
          <LanguagesSection />
          <VoiceSection />
          <TemplatesSection />
          <GroupLabel>{t('settings.groups.data')}</GroupLabel>
          <BackupSection />
          <DangerSection />
        </div>
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: string }) {
  return <p className="pt-2 text-xs font-semibold tracking-wide text-stone-600 uppercase first:pt-0">{children}</p>;
}
