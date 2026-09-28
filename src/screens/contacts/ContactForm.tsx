import { useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Field, inputClass } from '../../components/Field';
import { TrashIcon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import {
  addContact,
  changedFields,
  contactToInput,
  emptyContact,
  normalizeContact,
  updateContact,
  validateContact,
  type ContactErrors,
} from '../../db/contacts';
import {
  CONTACT_TYPES,
  LANGUAGES,
  type Contact,
  type ContactInput,
  type ContactType,
  type Lang,
  type Settings,
} from '../../db/schema';
import { countryOptions } from '../../lib/country';
import { todayIso } from '../../lib/dates';
import { languageForCountry } from '../../lib/language';

/** Add (contact = null) or edit a contact. Mount it only while it should be open. */
export function ContactForm({
  contact,
  settings,
  initialDraft,
  onClose,
  onDiscard,
  onDeleteRequest,
}: {
  contact: Contact | null;
  settings: Settings;
  /** Restores unsaved edits after an Undo. */
  initialDraft?: ContactInput;
  onClose: () => void;
  /** Called instead of onClose when closing would lose edits; the caller offers Undo. */
  onDiscard: (unsaved: ContactInput) => void;
  onDeleteRequest: (contact: Contact) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const initial = useMemo(() => (contact ? contactToInput(contact) : emptyContact()), [contact]);
  const [draft, setDraft] = useState<ContactInput>(initialDraft ?? initial);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState<false | 'error' | 'gone'>(false);

  const countries = useMemo(() => countryOptions(i18n.language), [i18n.language]);
  const dirty =
    JSON.stringify(normalizeContact(draft)) !== JSON.stringify(normalizeContact(initial));

  const set = <K extends keyof ContactInput>(key: K, value: ContactInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const requestClose = () => (dirty ? onDiscard(draft) : onClose());

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateContact(draft);
    setErrors(found);
    const firstInvalid = (['firstName', 'email', 'lastContacted'] as const).find((k) => found[k]);
    if (firstInvalid) {
      document.getElementById(`${id}-${firstInvalid}`)?.focus();
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    try {
      if (contact) {
        // Only what was changed in this form: edits made meanwhile in another
        // tab (or by an export) to other fields are kept.
        const saved = await updateContact(contact.id, changedFields(initial, draft));
        if (!saved) {
          setSaveFailed('gone');
          setSaving(false);
          return;
        }
      } else await addContact(draft);
      onClose();
    } catch {
      setSaveFailed('error');
      setSaving(false);
    }
  }

  const fid = (name: string) => `${id}-${name}`;
  const described = (name: string, hasHint: boolean) =>
    errors[name as keyof ContactErrors] ? `${fid(name)}-error` : hasHint ? `${fid(name)}-hint` : undefined;

  const text = (name: 'firstName' | 'lastName' | 'email' | 'phone' | 'company', type = 'text') => (
    <Field
      id={fid(name)}
      label={
        <>
          {t(`fields.${name}`)}
          {name === 'firstName' && (
            <span className="ml-1 font-normal text-stone-500">({t('common.required')})</span>
          )}
        </>
      }
      error={
        errors[name as keyof ContactErrors] &&
        t(name === 'firstName' ? 'form.firstNameRequired' : 'form.emailInvalid')
      }
    >
      <input
        id={fid(name)}
        type={type}
        className={inputClass}
        value={draft[name]}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={Boolean(errors[name as keyof ContactErrors])}
        aria-describedby={described(name, false)}
        autoComplete="off"
        autoFocus={name === 'firstName' && !contact}
      />
    </Field>
  );

  const footer = (
    <>
      {contact && (
        <Button
          variant="ghost"
          className="mr-auto text-red-700 hover:bg-red-50"
          onClick={() => onDeleteRequest(contact)}
        >
          <TrashIcon />
          {t('form.deleteContact')}
        </Button>
      )}
      <Button onClick={requestClose}>{t('common.cancel')}</Button>
      <Button variant="primary" type="submit" form={fid('form')} disabled={saving}>
        {t('common.save')}
      </Button>
    </>
  );

  const autoLanguage = t(`languages.${languageForCountry(draft.country, settings)}`);

  return (
    <Modal
      open
      onClose={requestClose}
      title={contact ? t('form.editTitle') : t('form.addTitle')}
      footer={footer}
    >
      <form id={fid('form')} onSubmit={submit} noValidate className="space-y-4">
        {saveFailed && (
          <Banner tone="error">{saveFailed === 'gone' ? t('form.deletedElsewhere') : t('form.saveFailed')}</Banner>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {text('firstName')}
          {text('lastName')}
          {text('email', 'email')}
          {text('phone', 'tel')}
          {text('company')}

          <Field id={fid('country')} label={t('fields.country')}>
            <select
              id={fid('country')}
              className={inputClass}
              value={draft.country}
              onChange={(e) => set('country', e.target.value)}
            >
              <option value="">{t('form.countryNone')}</option>
              {draft.country && !countries.some((c) => c.code === draft.country) && (
                <option value={draft.country}>{draft.country}</option>
              )}
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id={fid('language')} label={t('fields.language')} hint={t('form.languageHint')}>
            <select
              id={fid('language')}
              className={inputClass}
              value={draft.language ?? ''}
              onChange={(e) => set('language', (e.target.value || null) as Lang | null)}
              aria-describedby={described('language', true)}
            >
              <option value="">{t('form.languageAuto', { language: autoLanguage })}</option>
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {t(`languages.${lang}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field id={fid('contactType')} label={t('fields.contactType')}>
            <select
              id={fid('contactType')}
              className={inputClass}
              value={draft.contactType}
              onChange={(e) => set('contactType', e.target.value as ContactType)}
            >
              {CONTACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`contactTypes.${type}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id={fid('lastContacted')}
            label={t('fields.lastContacted')}
            hint={t('form.lastContactedHint')}
            error={errors.lastContacted && t('form.dateInvalid')}
          >
            <input
              id={fid('lastContacted')}
              type="date"
              className={inputClass}
              max={todayIso()}
              value={draft.lastContacted ?? ''}
              onChange={(e) => set('lastContacted', e.target.value || null)}
              aria-invalid={Boolean(errors.lastContacted)}
              aria-describedby={described('lastContacted', true)}
            />
          </Field>
        </div>

        <Field id={fid('notes')} label={t('fields.notes')} hint={t('form.notesHint')}>
          <textarea
            id={fid('notes')}
            rows={5}
            className={inputClass}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            aria-describedby={described('notes', true)}
          />
        </Field>

        <Field
          id={fid('serviceHistory')}
          label={t('fields.serviceHistory')}
          hint={t('form.serviceHistoryHint')}
        >
          <textarea
            id={fid('serviceHistory')}
            rows={3}
            className={inputClass}
            value={draft.serviceHistory}
            onChange={(e) => set('serviceHistory', e.target.value)}
            aria-describedby={described('serviceHistory', true)}
          />
        </Field>
      </form>
    </Modal>
  );
}
