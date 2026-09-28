import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enqueueDrafts } from '../../ai/batch';
import { createPendingDrafts } from '../../ai/generate';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { createTemplateDrafts } from '../../db/drafts';
import type { Contact } from '../../db/schema';
import { useSettings } from '../../db/settings';
import { missingOpenThread, type TemplateFamily } from '../../db/templates';
import { showToast } from '../../lib/toast';
import { href } from '../../nav';
import { MethodPicker, type Method } from '../review/MethodPicker';

export interface DueJob {
  family: TemplateFamily;
  contacts: Contact[];
}

export function DueGenerateDialog({ jobs, onClose }: { jobs: DueJob[]; onClose: () => void }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const [method, setMethod] = useState<Method>('ai');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const count = jobs.reduce((n, j) => n + j.contacts.length, 0);
  const demo = !settings.apiKey.trim();

  async function submit() {
    setBusy(true);
    setFailed(false);
    try {
      if (method === 'template') {
        let made = 0;
        for (const job of jobs) made += (await createTemplateDrafts(job.contacts, job.family, settings)).length;
        showToast({ tone: 'success', message: t('create.done', { count: made }) });
      } else {
        const ids: string[] = [];
        for (const job of jobs) ids.push(...(await createPendingDrafts(job.contacts, job.family, settings)).map((d) => d.id));
        enqueueDrafts(ids);
      }
      onClose();
      window.location.hash = href('review');
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('due.confirmTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={submit} disabled={busy || count === 0}>
            {t('create.submit', { count })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {failed && <Banner tone="error">{t('create.failed')}</Banner>}
        <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
          {jobs.map((job) => (
            <li key={job.family.family}>
              {t('due.groupLine', { name: job.family.name, count: job.contacts.length })}
              {method === 'ai' && !demo && missingOpenThread(job.family, job.contacts, settings.withheldFields) > 0 && (
                <span className="text-amber-800">
                  {' · '}
                  {t('due.willNeedOpenThread', { count: missingOpenThread(job.family, job.contacts, settings.withheldFields) })}
                </span>
              )}
            </li>
          ))}
        </ul>
        <MethodPicker method={method} onChange={setMethod} demo={demo} count={count} />
      </div>
    </Modal>
  );
}
