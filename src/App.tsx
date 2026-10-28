import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { docUrl } from './config';
import { db } from './db/db';
import { LANGUAGES, type Lang } from './db/schema';
import { updateSettings, useSettings, useSettingsLoaded } from './db/settings';
import { FirstRun } from './screens/firstrun/FirstRun';
import { href, landingRoute, ROUTES, useRoute } from './nav';
import { Menu, menuItemClass } from './components/Menu';
import { CONTAINER } from './components/layout';
import { OverviewScreen } from './screens/overview/OverviewScreen';
import { ContactsScreen } from './screens/contacts/ContactsScreen';
import { DueNowScreen } from './screens/due/DueNowScreen';
import { ReviewScreen } from './screens/review/ReviewScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { Toaster } from './components/Toaster';
import { DemoBanner } from './components/DemoBanner';
import { OtherTabsNotice } from './components/OtherTabsNotice';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useNavCounts } from './useNavCounts';
import { Tour } from './tour/Tour';
import { startTour, useTour } from './tour/tourState';

export function App() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const route = useRoute();
  const loaded = useSettingsLoaded();
  const counts = useNavCounts();
  const tour = useTour();
  const contactCount = useLiveQuery(() => db.contacts.count(), []);
  const lang: Lang = i18n.language === 'fr' ? 'fr' : 'en';
  const hasKey = settings.apiKey.trim() !== '';

  // No route yet (a plain visit): Overview once there are contacts, else Contacts.
  useEffect(() => {
    if (route === null && contactCount !== undefined) window.location.replace(href(landingRoute(contactCount)));
  }, [route, contactCount]);

  // The tour starts once by itself, right after the welcome is completed.
  useEffect(() => {
    if (loaded && settings.firstRunDone && settings.tourState === 'queued' && !tour.active) void startTour();
  }, [loaded, settings.firstRunDone, settings.tourState, tour.active]);

  useEffect(() => {
    document.title = route ? `${t(`nav.${route}`)} · ${t('app.name')}` : t('app.name');
  }, [route, t, settings.uiLanguage]);

  useEffect(() => {
    void i18n.changeLanguage(settings.uiLanguage);
    document.documentElement.lang = settings.uiLanguage;
  }, [i18n, settings.uiLanguage]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className={`${CONTAINER} flex flex-wrap items-center gap-x-8 gap-y-2 py-3`}>
          <a href={href('overview')} className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600">
            <img src="./favicon.svg" alt="" className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
          </a>
          <nav aria-label={t('nav.label')} className="order-last w-full sm:order-none sm:w-auto">
            <ul className="-mx-2 flex flex-wrap gap-1">
              {ROUTES.map((r) => (
                <li key={r}>
                  <a
                    href={href(r)}
                    aria-current={route === r ? 'page' : undefined}
                    className="block rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-stone-600 outline-none hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-accent-600 aria-[current=page]:bg-accent-50 aria-[current=page]:text-accent-800"
                  >
                    {t(`nav.${r}`)}
                    {counts[r] > 0 && (
                      <span className="ml-1.5 rounded-full bg-accent-700 px-1.5 py-0.5 text-xs font-semibold text-white">
                        <span className="sr-only">{' '}</span>
                        {counts[r]}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
          <a
            href={href('settings', { section: 'ai' })}
            title={hasKey ? t('header.connectedHint') : t('header.demoHint')}
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent-600 sm:inline-flex ${
              hasKey ? 'border-accent-100 bg-accent-50 text-accent-800' : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${hasKey ? 'bg-accent-600' : 'bg-amber-500'}`} />
            {hasKey ? t('header.connected') : t('header.demo')}
          </a>
          <div
            role="group"
            aria-label={t('header.uiLanguage')}
            className="flex rounded-md border border-stone-300 p-0.5 text-xs font-semibold"
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
          <Menu
            button={<span aria-hidden="true">?</span>}
            buttonLabel={t('header.help')}
            buttonClassName="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            {(close) => (
              <ul>
                <li>
                  <button
                    type="button"
                    className={menuItemClass}
                    onClick={() => {
                      close();
                      void startTour();
                    }}
                  >
                    {t('tour.nav')}
                  </button>
                </li>
                <li>
                  <a href={docUrl('getting-started', lang)} target="_blank" rel="noreferrer" className={menuItemClass} onClick={close}>
                    {t('header.guide')}
                  </a>
                </li>
                <li>
                  <a href={docUrl('privacy', lang)} target="_blank" rel="noreferrer" className={menuItemClass} onClick={close}>
                    {t('header.privacy')}
                  </a>
                </li>
              </ul>
            )}
          </Menu>
          </div>
        </div>
      </header>
      <DemoBanner />
      <OtherTabsNotice />

      <main className={`${CONTAINER} w-full flex-1 py-6`}>
        <ErrorBoundary resetKey={route ?? ''}>
          {route === 'overview' && <OverviewScreen />}
          {route === 'contacts' && <ContactsScreen />}
          {route === 'due' && <DueNowScreen />}
          {route === 'review' && <ReviewScreen />}
          {route === 'settings' && <SettingsScreen />}
        </ErrorBoundary>
      </main>

      {loaded && !settings.firstRunDone && <FirstRun />}
      <Tour />
      <Toaster />

      <footer className="border-t border-stone-200 bg-white">
        <p className={`${CONTAINER} py-3 text-xs text-stone-600`}>{t('footer.local')}</p>
      </footer>
    </div>
  );
}
