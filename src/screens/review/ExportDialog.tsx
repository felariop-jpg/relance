import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { Modal } from '../../components/Modal';
import { markExported } from '../../db/drafts';
import { buildBrevoCsv, buildEmlZip, buildTxtZip, type ExportItem } from '../../export/bundle';
import { todayIso } from '../../lib/dates';
import { downloadFile } from '../../lib/download';

type Format = 'eml' | 'txt' | 'brevo';

export function ExportDialog({ items, onClose }: { items: ExportItem[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<Format>('eml');
  // Off by default: a wrong "last contacted" silently hides people from Due now.
  const [markContacted, setMarkContacted] = useState(false);
  const [done, setDone] = useState<{ format: Format; fileName: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const count = items.length;
  const missingEmail = items.filter((i) => !i.contact.email).length;

  async function submit() {
    setFailed(false);
    try {
      const today = todayIso();
      let fileName: string;
      if (format === 'eml') {
        fileName = `relance-drafts-${today}.zip`;
        downloadFile(buildEmlZip(items), fileName, 'application/zip');
      } else if (format === 'txt') {
        fileName = `relance-drafts-text-${today}.zip`;
        downloadFile(buildTxtZip(items), fileName, 'application/zip');
      } else {
        fileName = `relance-brevo-${today}.csv`;
        downloadFile(buildBrevoCsv(items), fileName, 'text/csv;charset=utf-8');
      }
      await markExported(
        items.map((i) => i.draft),
        { markContacted, today },
      );
      setDone({ format, fileName });
    } catch {
      setFailed(true);
    }
  }

  const option = (value: Format, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-300 p-3 has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50">
      <input
        type="radio"
        name="format"
        className="mt-1 accent-accent-700"
        checked={format === value}
        onChange={() => setFormat(value)}
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-stone-600">{hint}</span>
      </span>
    </label>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={done ? t('export.doneTitle') : t('export.title')}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose} autoFocus>
            {t('import.done')}
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={submit} disabled={count === 0}>
              {t('export.submit')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3 text-stone-700">
          <p className="text-sm text-stone-500">{t('export.fileName', { name: done.fileName })}</p>
          <p>{done.format === 'eml' ? t('export.doneEml') : done.format === 'txt' ? t('export.doneTxt') : t('export.doneBrevo')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {failed && <Banner tone="error">{t('export.failed')}</Banner>}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t('export.format')}</legend>
            {option('eml', t('export.eml'), t('export.emlHint'))}
            {option('txt', t('export.txt'), t('export.txtHint'))}
            {option('brevo', t('export.brevo'), t('export.brevoHint'))}
          </fieldset>
          {missingEmail > 0 && <Banner tone="warning">{t('export.noEmail', { count: missingEmail })}</Banner>}
          <label className="flex items-start gap-3">
            <Checkbox
              className="mt-0.5"
              checked={markContacted}
              onChange={(e) => setMarkContacted(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">{t('export.markContacted', { count })}</span>
              <span className="block text-sm text-stone-500">{t('export.markContactedHint')}</span>
            </span>
          </label>
        </div>
      )}
    </Modal>
  );
}
