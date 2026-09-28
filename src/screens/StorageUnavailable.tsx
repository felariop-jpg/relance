import { I18nextProvider, useTranslation } from 'react-i18next';
import type { i18n as I18n } from 'i18next';

function Message() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-lg px-4 py-20">
      <h1 className="text-2xl font-semibold">{t('storage.title')}</h1>
      <p className="mt-4 text-stone-700">{t('storage.body')}</p>
      <p className="mt-3 text-stone-700">{t('storage.fix')}</p>
    </section>
  );
}

/** Shown when the browser refuses local storage (some private windows, strict settings). */
export function StorageUnavailable({ i18n }: { i18n: I18n }) {
  return (
    <I18nextProvider i18n={i18n}>
      <Message />
    </I18nextProvider>
  );
}
