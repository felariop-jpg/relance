import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components/Checkbox';
import { WarningIcon } from '../../components/icons';
import { REPO_URL } from '../../config';
import { API_FIELDS, type ApiField } from '../../db/schema';
import { modifySettings, useSettings } from '../../db/settings';
import { Section } from './Section';

export function PrivacySection() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const withheld = new Set(settings.withheldFields);
  const privacyUrl = `${REPO_URL}/blob/main/${i18n.language === 'fr' ? 'PRIVACY.fr.md' : 'PRIVACY.md'}`;

  const toggle = (field: ApiField, sent: boolean) =>
    void modifySettings((s) => {
      const next = new Set(s.withheldFields);
      if (sent) next.delete(field);
      else next.add(field);
      s.withheldFields = API_FIELDS.filter((f) => next.has(f));
    });

  return (
    <Section
      id="privacy"
      title={t('settings.privacy.title')}
      description={
        <p>
          {t('settings.privacy.summary')}{' '}
          <a href={privacyUrl} target="_blank" rel="noreferrer" className="font-medium text-accent-700 underline underline-offset-4">
            {t('settings.privacy.readMore')}
          </a>
        </p>
      }
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('settings.privacy.sent')}</legend>
        <ul className="space-y-2">
          {API_FIELDS.map((field) => (
            <li key={field}>
              <label className="flex min-h-9 cursor-pointer items-center gap-3">
                <Checkbox className="h-5 w-5" checked={!withheld.has(field)} onChange={(e) => toggle(field, e.target.checked)} />
                <span className="text-sm">{t(`settings.privacy.fields.${field}`)}</span>
              </label>
              {field === 'notes' && (
                <p
                  className={`mt-1 ml-8 flex items-start gap-2 rounded-md px-3 py-2 text-sm ${withheld.has('notes') ? 'bg-amber-100 font-medium text-amber-950' : 'bg-amber-50 text-amber-900'}`}
                >
                  <WarningIcon className="mt-0.5 shrink-0" />
                  {t('settings.privacy.notesWarning')}
                </p>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-stone-600">{t('settings.privacy.neverSent')}</p>
      </fieldset>
    </Section>
  );
}
