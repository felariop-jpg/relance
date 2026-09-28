import { useId, useMemo, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { inputBase } from '../../components/Field';
import { UploadIcon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { importContacts, type ImportResult } from '../../db/contacts';
import { CONTACT_TYPES, type ContactType } from '../../db/schema';
import {
  applyMapping,
  hasNameColumn,
  looksLikeSpreadsheet,
  parseCsvText,
  readCsvFile,
  suggestMapping,
  type ColumnMapping,
  type MappingResult,
} from '../../lib/csv';
import { ColumnMapper } from './ColumnMapper';

type Step = 'choose' | 'map' | 'done';
type Outcome = ImportResult & Omit<MappingResult, 'contacts'>;

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [step, setStep] = useState<Step>('choose');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMappingState] = useState<ColumnMapping>([]);
  const [defaultType, setDefaultType] = useState<ContactType>('client');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const parsed = useMemo(() => (file ? parseCsvText(file.text, hasHeader) : null), [file, hasHeader]);
  const preview = useMemo(
    () => (parsed && hasNameColumn(mapping) ? applyMapping(parsed, mapping, { defaultType }) : null),
    [parsed, mapping, defaultType],
  );

  async function handleFile(chosen: File | undefined) {
    if (!chosen) return;
    setError(null);
    if (looksLikeSpreadsheet(chosen.name)) {
      setError(t('import.spreadsheetFile'));
      return;
    }
    try {
      const text = await readCsvFile(chosen);
      if (parseCsvText(text, false).rows.length === 0) {
        setError(t('import.emptyFile'));
        return;
      }
      setFile({ name: chosen.name, text });
      setHasHeader(true);
      setMappingState(suggestMapping(parseCsvText(text, true).headers));
      setStep('map');
    } catch {
      setError(t('import.readError'));
    }
  }

  function toggleHeader(next: boolean) {
    setHasHeader(next);
    if (next && file) setMappingState(suggestMapping(parseCsvText(file.text, true).headers));
  }

  async function runImport() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importContacts(preview.contacts);
      const { contacts: _contacts, ...counts } = preview;
      setOutcome({ ...result, ...counts });
      setStep('done');
    } catch {
      setError(t('import.importFailed'));
    } finally {
      setBusy(false);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  };

  const readyCount = preview?.contacts.length ?? 0;

  const footer =
    step === 'choose' ? (
      <Button onClick={onClose}>{t('common.cancel')}</Button>
    ) : step === 'map' ? (
      <>
        <Button
          className="mr-auto"
          onClick={() => {
            setStep('choose');
            setFile(null);
            setError(null);
          }}
        >
          {t('common.back')}
        </Button>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={runImport} disabled={busy || readyCount === 0}>
          {busy ? t('import.importing') : t('import.importButton', { count: readyCount })}
        </Button>
      </>
    ) : (
      <Button variant="primary" onClick={onClose} autoFocus>
        {t('import.done')}
      </Button>
    );

  return (
    <Modal
      open
      size={step === 'map' ? 'lg' : 'md'}
      onClose={onClose}
      title={step === 'done' ? t('import.doneTitle') : t('import.title')}
      footer={footer}
    >
      <div className="space-y-4">
        {error && <Banner tone="error">{error}</Banner>}

        {step === 'choose' && (
          <>
            <div className="text-sm text-stone-700">
              <p>{t('import.chooseIntro')}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('import.howExcel')}</li>
                <li>{t('import.howNumbers')}</li>
                <li>{t('import.howSheets')}</li>
              </ul>
            </div>
            <label
              htmlFor={`${id}-file`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragging ? 'border-accent-600 bg-accent-50' : 'border-stone-300 hover:border-stone-400'
              }`}
            >
              <UploadIcon className="text-2xl text-stone-500" />
              <span className="font-medium text-accent-700 underline underline-offset-4">
                {t('import.chooseFile')}
              </span>
              <span className="text-sm text-stone-500">{t('import.dropHere')}</span>
              <input
                id={`${id}-file`}
                type="file"
                accept=".csv,.txt,text/csv"
                className="sr-only"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </>
        )}

        {step === 'map' && parsed && (
          <>
            <p className="text-sm text-stone-700">{t('import.mapIntro')}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="text-stone-500">{t('import.fileName', { name: file?.name })}</span>
              <label className="inline-flex items-center gap-2">
                <Checkbox checked={hasHeader} onChange={(e) => toggleHeader(e.target.checked)} />
                {t('import.hasHeader')}
              </label>
            </div>
            <ColumnMapper parsed={parsed} mapping={mapping} onChange={setMappingState} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={`${id}-type`} className="font-medium">
                {t('import.defaultType')}
              </label>
              <select
                id={`${id}-type`}
                className={`${inputBase} py-1.5`}
                value={defaultType}
                onChange={(e) => setDefaultType(e.target.value as ContactType)}
              >
                {CONTACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`contactTypes.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            {preview ? (
              <Banner tone={preview.missingName > 0 ? 'warning' : 'info'}>
                <p>{t('import.ready', { count: preview.contacts.length })}</p>
                {preview.missingName > 0 && (
                  <p>{t('import.missingName', { count: preview.missingName })}</p>
                )}
              </Banner>
            ) : (
              <Banner tone="warning">{t('import.needName')}</Banner>
            )}
          </>
        )}

        {step === 'done' && outcome && (
          <Banner tone="success" title={t('import.added', { count: outcome.added })}>
            {outcome.duplicates > 0 && <p>{t('import.duplicates', { count: outcome.duplicates })}</p>}
            {outcome.missingName > 0 && (
              <p>{t('import.skippedName', { count: outcome.missingName })}</p>
            )}
            {outcome.unknownCountry > 0 && (
              <p>{t('import.unknownCountry', { count: outcome.unknownCountry })}</p>
            )}
            {outcome.unknownDate > 0 && (
              <p>{t('import.unknownDate', { count: outcome.unknownDate })}</p>
            )}
          </Banner>
        )}
      </div>
    </Modal>
  );
}
