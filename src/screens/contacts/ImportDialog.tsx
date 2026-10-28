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
  countIssues,
  defaultTypeIndexes,
  hasNameColumn,
  isRecognisedFormat,
  looksLikeSpreadsheet,
  parseCsvText,
  readCsvFile,
  suggestMapping,
  type ColumnMapping,
} from '../../lib/csv';
import { ColumnMapper } from './ColumnMapper';
import { PayloadPanel } from '../review/PayloadPanel';
import { useSettings } from '../../db/settings';
import { docUrl } from '../../config';
import { formatEur } from '../../lib/money';
import type { Lang } from '../../db/schema';
import {
  applySuggestions,
  buildMappingRequest,
  estimateMappingCostEur,
  matchColumns,
  type MatchErrorCode,
  type Suggestions,
} from '../../ai/mapColumns';

/** confirm = the file's columns were all recognised, so the column screen is skipped. */
type Step = 'choose' | 'confirm' | 'map' | 'done';

/** AI column matching: offered, running, or finished (the exact request kept for the panel). */
type AiState =
  | { status: 'idle' }
  | { status: 'running'; sentJson: string }
  | { status: 'matched'; sentJson: string; applied: Suggestions; costEur: number }
  | { status: 'failed'; sentJson: string | null; code: MatchErrorCode; costEur: number };
type Outcome = Pick<ImportResult, 'added' | 'updated' | 'unchanged' | 'duplicates'> & {
  missingName: number;
  unknownCountry: number;
  unknownDate: number;
};

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const id = useId();
  const settings = useSettings();
  const hasKey = settings.apiKey.trim() !== '';
  const [step, setStep] = useState<Step>('choose');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMappingState] = useState<ColumnMapping>([]);
  const [defaultType, setDefaultType] = useState<ContactType>('client');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [aiOffered, setAiOffered] = useState(false);
  const [ai, setAi] = useState<AiState>({ status: 'idle' });

  const parsed = useMemo(() => (file ? parseCsvText(file.text, hasHeader) : null), [file, hasHeader]);
  const preview = useMemo(
    () => (parsed && hasNameColumn(mapping) ? applyMapping(parsed, mapping, { defaultType }) : null),
    [parsed, mapping, defaultType],
  );

  // What "Match with AI" would send now: headings and value shapes of the unmatched columns only.
  const aiRequest = useMemo(
    () => (parsed && step === 'map' && aiOffered && ai.status === 'idle' ? buildMappingRequest(parsed, mapping) : null),
    [parsed, step, aiOffered, ai.status, mapping],
  );

  /** Starts on the recognised-format confirmation, or on the column screen with the AI offer. */
  function startMapping(text: string, header: boolean) {
    const headers = parseCsvText(text, header).headers;
    const recognised = header && isRecognisedFormat(headers);
    setMappingState(suggestMapping(header ? headers : headers.map(() => '')));
    setAiOffered(!recognised);
    setAi({ status: 'idle' });
    return recognised;
  }

  async function runAiMatch() {
    if (!aiRequest) return;
    const sentJson = JSON.stringify(aiRequest);
    setAi({ status: 'running', sentJson });
    const result = await matchColumns(aiRequest);
    if (!result.ok) {
      setAi({ status: 'failed', sentJson: result.code === 'no_key' ? null : sentJson, code: result.code, costEur: result.costEur });
      return;
    }
    // Only pre-fills the column screen: the user still checks every column and clicks Import.
    const { mapping: next, applied } = applySuggestions(mapping, result.suggestions);
    setMappingState(next);
    setAi({ status: 'matched', sentJson, applied, costEur: result.costEur });
  }

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
      setStep(startMapping(text, true) ? 'confirm' : 'map');
    } catch {
      setError(t('import.readError'));
    }
  }

  function toggleHeader(next: boolean) {
    setHasHeader(next);
    if (file) startMapping(file.text, next);
  }

  async function runImport() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      // A default type (no type column, blank or unrecognised cell) never replaces a stored type.
      const result = await importContacts(preview.contacts, { keepType: defaultTypeIndexes(preview) });
      // Only count unreadable values on rows that were actually added.
      setOutcome({
        added: result.added,
        updated: result.updated,
        unchanged: result.unchanged,
        duplicates: result.duplicates,
        missingName: preview.missingName,
        ...countIssues(preview, [...result.duplicateIndexes, ...result.updatedIndexes, ...result.unchangedIndexes]),
      });
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
    ) : step === 'map' || step === 'confirm' ? (
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
        <Button variant="primary" onClick={runImport} disabled={busy || readyCount === 0 || ai.status === 'running'}>
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

        {step === 'confirm' && preview && (
          <>
            <Banner tone={preview.missingName > 0 ? 'warning' : 'success'} title={t('import.recognised')}>
              <p>{t('import.ready', { count: preview.contacts.length })}</p>
              {preview.missingName > 0 && <p>{t('import.missingName', { count: preview.missingName })}</p>}
            </Banner>
            <p className="text-sm text-stone-700">
              <span className="text-stone-500">{t('import.fileName', { name: file?.name })}</span>{' '}
              <button
                type="button"
                onClick={() => setStep('map')}
                className="font-medium text-accent-700 underline underline-offset-4"
              >
                {t('import.adjustColumns')}
              </button>
            </p>
          </>
        )}

        {step === 'map' && parsed && (
          <>
            <p className="text-sm text-stone-700">{t('import.mapIntro')}</p>
            {aiOffered && (aiRequest || ai.status !== 'idle') && (
              <AiMatchPanel
                ai={ai}
                request={aiRequest}
                hasKey={hasKey}
                locale={locale}
                onMatch={() => void runAiMatch()}
                onDecline={() => setAiOffered(false)}
              />
            )}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="text-stone-500">{t('import.fileName', { name: file?.name })}</span>
              <label className="inline-flex items-center gap-2">
                <Checkbox checked={hasHeader} onChange={(e) => toggleHeader(e.target.checked)} />
                {t('import.hasHeader')}
              </label>
            </div>
            <ColumnMapper
              parsed={parsed}
              mapping={mapping}
              onChange={setMappingState}
              aiSuggested={ai.status === 'matched' ? ai.applied : undefined}
            />
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
          <Banner
            tone="success"
            title={
              outcome.added === 0 && outcome.updated > 0
                ? t('import.updated', { count: outcome.updated })
                : t('import.added', { count: outcome.added })
            }
          >
            {outcome.added > 0 && outcome.updated > 0 && <p>{t('import.updated', { count: outcome.updated })}</p>}
            {outcome.unchanged > 0 && <p>{t('import.unchanged', { count: outcome.unchanged })}</p>}
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

/** The offer to match columns with the AI, what it would send, and how it went. */
function AiMatchPanel({
  ai,
  request,
  hasKey,
  locale,
  onMatch,
  onDecline,
}: {
  ai: AiState;
  request: ReturnType<typeof buildMappingRequest>;
  hasKey: boolean;
  locale: string;
  onMatch: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const panel = (json: string, sent: boolean) => (
    <PayloadPanel
      payloadJson={json}
      demo={false}
      title={sent ? t('import.ai.sentTitle') : t('import.ai.payloadTitle')}
      note={sent ? t('import.ai.sentNote') : t('import.ai.payloadNote')}
    />
  );

  if (ai.status === 'matched') {
    return (
      <div className="space-y-2">
        <Banner tone="success">
          <p>
            {ai.applied.size > 0 ? t('import.ai.matched', { count: ai.applied.size }) : t('import.ai.noneMatched')}
          </p>
          <p>{t('import.ai.cost', { cost: formatEur(ai.costEur, locale, t) })}</p>
        </Banner>
        {panel(ai.sentJson, true)}
      </div>
    );
  }
  if (ai.status === 'failed') {
    return (
      <div className="space-y-2">
        <Banner tone="warning">
          <p>{t(`import.ai.errors.${ai.code}`)}</p>
          <p>{t('import.ai.fallback')}</p>
          {ai.costEur > 0 && <p>{t('import.ai.cost', { cost: formatEur(ai.costEur, locale, t) })}</p>}
        </Banner>
        {ai.sentJson && panel(ai.sentJson, true)}
      </div>
    );
  }
  const running = ai.status === 'running';
  const json = running ? ai.sentJson : request ? JSON.stringify(request) : null;
  return (
    <div className="space-y-2">
      <Banner
        tone="info"
        title={t('import.ai.offer')}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={onMatch} disabled={!hasKey || running || !request}>
              {running ? t('import.ai.running') : t('import.ai.match')}
            </Button>
            <Button size="sm" onClick={onDecline} disabled={running}>
              {t('import.ai.decline')}
            </Button>
          </>
        }
      >
        <p>{t('import.ai.explain')}</p>
        {request && <p>{t('import.ai.estimate', { cost: formatEur(estimateMappingCostEur(request), locale, t) })}</p>}
        {!hasKey && (
          <p>
            {t('import.ai.needsKey')}{' '}
            <a
              href={docUrl('api-key', locale as Lang)}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              {t('import.ai.keyGuide')}
            </a>
          </p>
        )}
      </Banner>
      {json && panel(json, false)}
    </div>
  );
}
