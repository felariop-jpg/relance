import { useTranslation } from 'react-i18next';
import { href } from '../nav';

export function Placeholder({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm font-medium uppercase tracking-wide text-stone-500">
        {t('placeholder.title')}
      </p>
      <p className="mt-4 text-stone-600">{t('placeholder.body')}</p>
      <a
        href={href('contacts')}
        className="mt-6 inline-block font-medium text-accent-700 underline underline-offset-4 hover:text-accent-800"
      >
        {t('placeholder.goContacts')}
      </a>
    </section>
  );
}
