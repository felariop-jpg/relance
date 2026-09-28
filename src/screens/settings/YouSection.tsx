import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoTextarea } from '../../components/AutoTextarea';
import { Field, inputClass } from '../../components/Field';
import { LANGUAGE_ENDONYMS, LANGUAGES } from '../../db/schema';
import { updateSettings, useSettings } from '../../db/settings';
import { Section } from './Section';
import { useSettingDraft } from './useSettingDraft';

export function YouSection() {
  const { t } = useTranslation();
  const id = useId();
  const settings = useSettings();
  const [name, setName, flushName] = useSettingDraft('senderName');
  const [signature, setSignature, flushSignature] = useSettingDraft('signature');
  const [link, setLink, flushLink] = useSettingDraft('calendlyLink');
  const linkInvalid = link.trim() !== '' && !/^https?:\/\/\S+\.\S+/.test(link.trim());

  return (
    <Section id="you" title={t('settings.you.title')} description={<p>{t('settings.you.body')}</p>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-name`} label={t('settings.you.senderName')}>
          <input id={`${id}-name`} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} onBlur={flushName} autoComplete="name" />
        </Field>
        <Field id={`${id}-ui`} label={t('settings.you.uiLanguage')}>
          <select
            id={`${id}-ui`}
            className={inputClass}
            value={settings.uiLanguage}
            onChange={(e) => void updateSettings({ uiLanguage: e.target.value as 'en' | 'fr' })}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang} lang={lang}>
                {LANGUAGE_ENDONYMS[lang]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-sig`} label={t('settings.you.signature')} hint={t('settings.you.signatureHint')} className="sm:col-span-2">
          <AutoTextarea
            id={`${id}-sig`}
            rows={3}
            className={`${inputClass} resize-none`}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            onBlur={flushSignature}
            aria-describedby={`${id}-sig-hint`}
          />
        </Field>
        <Field
          id={`${id}-link`}
          label={t('settings.you.calendly')}
          hint={t('settings.you.calendlyHint')}
          error={linkInvalid ? t('settings.you.calendlyInvalid') : undefined}
          className="sm:col-span-2"
        >
          <input
            id={`${id}-link`}
            type="url"
            inputMode="url"
            className={inputClass}
            placeholder={t('settings.you.calendlyPlaceholder')}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={flushLink}
            aria-invalid={linkInvalid}
            aria-describedby={linkInvalid ? `${id}-link-error` : `${id}-link-hint`}
          />
        </Field>
      </div>
    </Section>
  );
}
