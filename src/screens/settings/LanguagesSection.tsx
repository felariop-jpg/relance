import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Field, inputBase, inputClass } from '../../components/Field';
import { CloseIcon } from '../../components/icons';
import { LANGUAGES, type Lang } from '../../db/schema';
import { updateSettings, useSettings } from '../../db/settings';
import { countryName, countryOptions } from '../../lib/country';
import { Section } from './Section';

export function LanguagesSection() {
  const { t, i18n } = useTranslation();
  const id = useId();
  const settings = useSettings();
  const overrides = settings.countryLanguageOverrides;
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState<Lang>('fr');
  const options = useMemo(() => countryOptions(i18n.language), [i18n.language]);
  const rows = Object.entries(overrides).sort(([a], [b]) =>
    countryName(a, i18n.language).localeCompare(countryName(b, i18n.language), i18n.language),
  );

  const setOverrides = (next: Record<string, Lang>) => void updateSettings({ countryLanguageOverrides: next });

  return (
    <Section id="languages" title={t('settings.languages.title')} description={<p>{t('settings.languages.body')}</p>}>
      <div className="space-y-5">
        <Field id={`${id}-default`} label={t('settings.languages.default')} hint={t('settings.languages.builtIn')}>
          <select
            id={`${id}-default`}
            className={`${inputClass} sm:max-w-xs`}
            value={settings.defaultLanguage}
            onChange={(e) => void updateSettings({ defaultLanguage: e.target.value as Lang })}
            aria-describedby={`${id}-default-hint`}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`languages.${l}`)}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <h3 className="text-sm font-medium">{t('settings.languages.overrides')}</h3>
          <p className="mb-2 text-xs text-stone-500">{t('settings.languages.overridesHint')}</p>
          {rows.length === 0 ? (
            <p className="text-sm text-stone-500">{t('settings.languages.none')}</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-md border border-stone-200">
              {rows.map(([code, lang]) => (
                <li key={code} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-sm">{countryName(code, i18n.language)}</span>
                  <select
                    aria-label={t('contacts.cellLabel', { field: t('settings.languages.language'), name: countryName(code, i18n.language) })}
                    className={`${inputBase} py-1.5`}
                    value={lang}
                    onChange={(e) => setOverrides({ ...overrides, [code]: e.target.value as Lang })}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {t(`languages.${l}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={t('settings.languages.remove', { country: countryName(code, i18n.language) })}
                    className="h-9 w-9 rounded p-2.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                    onClick={() => {
                      const { [code]: _removed, ...rest } = overrides;
                      setOverrides(rest);
                    }}
                  >
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!country) return;
              setOverrides({ ...overrides, [country]: language });
              setCountry('');
            }}
          >
            <label className="flex flex-col text-xs text-stone-500">
              {t('settings.languages.country')}
              <select className={`${inputBase} mt-1 py-1.5`} value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">{t('settings.languages.choose')}</option>
                {options
                  .filter((o) => !overrides[o.code])
                  .map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-stone-500">
              {t('settings.languages.language')}
              <select className={`${inputBase} mt-1 py-1.5`} value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {t(`languages.${l}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={!country}>
              {t('settings.languages.add')}
            </Button>
          </form>
        </div>
      </div>
    </Section>
  );
}
