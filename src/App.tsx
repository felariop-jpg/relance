import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './db/schema';
import { updateSettings, useSettings } from './db/settings';
import { href, ROUTES, useRoute } from './nav';
import { ContactsScreen } from './screens/contacts/ContactsScreen';
import { DueNowScreen } from './screens/due/DueNowScreen';
import { ReviewScreen } from './screens/review/ReviewScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { Toaster } from './components/Toaster';
import { DemoBanner } from './components/DemoBanner';

export function App() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const route = useRoute();

  useEffect(() => {
    void i18n.changeLanguage(settings.uiLanguage);
    document.documentElement.lang = settings.uiLanguage;
  }, [i18n, settings.uiLanguage]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <a href={href('contacts')} className="flex items-center gap-2">
            <img src="./favicon.svg" alt="" className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
          </a>
          <nav aria-label={t('nav.label')} className="order-last w-full sm:order-none sm:w-auto">
            <ul className="-mx-2 flex gap-1 overflow-x-auto">
              {ROUTES.map((r) => (
                <li key={r}>
                  <a
                    href={href(r)}
                    aria-current={route === r ? 'page' : undefined}
                    className="block rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-stone-600 hover:bg-stone-100 hover:text-stone-900 aria-[current=page]:bg-accent-50 aria-[current=page]:text-accent-800"
                  >
                    {t(`nav.${r}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div
            role="group"
            aria-label={t('header.uiLanguage')}
            className="ml-auto flex rounded-md border border-stone-300 p-0.5 text-xs font-semibold"
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                lang={lang}
                aria-pressed={settings.uiLanguage === lang}
                onClick={() => void updateSettings({ uiLanguage: lang })}
                title={t(`languages.${lang}`)}
                className="rounded px-2 py-1 text-stone-600 uppercase hover:text-stone-900 aria-pressed:bg-stone-800 aria-pressed:text-white"
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </header>
      <DemoBanner />

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6">
        {route === 'contacts' && <ContactsScreen />}
        {route === 'due' && <DueNowScreen />}
        {route === 'review' && <ReviewScreen />}
        {route === 'settings' && <SettingsScreen />}
      </main>

      <Toaster />

      <footer className="border-t border-stone-200 bg-white">
        <p className="mx-auto max-w-screen-2xl px-4 py-3 text-xs text-stone-500">{t('footer.local')}</p>
      </footer>
    </div>
  );
}
