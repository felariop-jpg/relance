import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { estimateCostEur } from '../../ai/model';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { inputClass } from '../../components/Field';
import { MailIcon, SearchIcon, WarningIcon } from '../../components/icons';
import { db } from '../../db/db';
import { useTemplates } from '../../db/hooks';
import { useSettings } from '../../db/settings';
import { formatSince, monthName } from '../../lib/dates';
import { formatEur } from '../../lib/money';
import { anyScheduledThisMonth, dueGroups, nextBatch, upcoming, type DueGroup } from '../../lib/schedule';
import { href } from '../../nav';
import { CreateDraftsDialog } from '../review/CreateDraftsDialog';
import { matchesQuery } from '../contacts/sorting';
import { contactName } from '../contacts/ContactTable';
import { DueGenerateDialog, type DueJob } from './DueGenerateDialog';
import { ruleText } from './ruleText';

const keyOf = (contactId: string, family: string) => `${contactId}:${family}`;

export function DueNowScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const settings = useSettings();
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);
  const drafts = useLiveQuery(() => db.drafts.toArray(), []);
  const templates = useTemplates();
  const today = useMemo(() => new Date(), []);

  const groups = useMemo(
    () => (contacts && drafts && templates ? dueGroups(contacts, templates, drafts, settings, today) : undefined),
    [contacts, drafts, templates, settings, today],
  );
  const next = useMemo(
    () => (contacts && templates ? upcoming(contacts, templates, settings, today) : []),
    [contacts, templates, settings, today],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const initialised = useRef(false);
  // Everyone due (and not already drafted) starts ticked; untick to leave out.
  useEffect(() => {
    if (!groups || initialised.current) return;
    initialised.current = true;
    setSelected(
      new Set(groups.flatMap((g) => g.entries.filter((e) => !e.hasOpenDraft).map((e) => keyOf(e.contact.id, g.family.family)))),
    );
  }, [groups]);

  const [confirming, setConfirming] = useState<DueJob[] | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set());
  const [manualWriting, setManualWriting] = useState(false);

  if (!groups || !contacts) return <p className="py-10 text-center text-stone-500">{t('common.loading')}</p>;

  // Nobody due: lead with the next batch, then Coming up, then choosing contacts by hand.
  const idle = groups.length === 0;
  const headline = idle ? nextBatch(next) : undefined;

  const selectable = (g: DueGroup) => g.entries.filter((e) => !e.hasOpenDraft);
  const count = groups.reduce(
    (n, g) => n + selectable(g).filter((e) => selected.has(keyOf(e.contact.id, g.family.family))).length,
    0,
  );

  const toggle = (key: string) =>
    setSelected((s) => {
      const nextSet = new Set(s);
      if (nextSet.has(key)) nextSet.delete(key);
      else nextSet.add(key);
      return nextSet;
    });

  const toggleGroup = (g: DueGroup, on: boolean) =>
    setSelected((s) => {
      const nextSet = new Set(s);
      for (const e of selectable(g)) {
        const key = keyOf(e.contact.id, g.family.family);
        if (on) nextSet.add(key);
        else nextSet.delete(key);
      }
      return nextSet;
    });

  const jobs = (): DueJob[] =>
    groups
      .map((g) => ({
        family: g.family,
        contacts: selectable(g)
          .filter((e) => selected.has(keyOf(e.contact.id, g.family.family)))
          .map((e) => e.contact),
      }))
      .filter((j) => j.contacts.length > 0);

  const manualShown = contacts
    .filter((c) => matchesQuery(c, manualQuery, locale))
    .sort((a, b) => contactName(a).localeCompare(contactName(b), locale));

  return (
    <section className="mx-auto max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('due.title')}</h1>
        <p className="text-sm text-stone-500">
          {t('due.today', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(today) })}
        </p>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 px-6 py-10 text-center">
          <p className="text-stone-700">{t('due.noContacts')}</p>
          <a href={href('contacts')} className="mt-3 inline-block font-medium text-accent-700 underline underline-offset-4">
            {t('nav.contacts')}
          </a>
        </div>
      ) : (
        <>
          {idle ? (
            <p className="text-sm text-stone-600">
              {t(anyScheduledThisMonth(templates ?? [], settings, today) ? 'due.nothingAllRecent' : 'due.nothingNoneScheduled', {
                month: monthName(today.getMonth() + 1, locale),
              })}
            </p>
          ) : (
            <p className="text-sm text-stone-600">{t('due.intro')}</p>
          )}

          {idle && headline && (
            <section data-tour="due" className="rounded-xl border border-accent-100 bg-accent-50 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {t('due.nextTitle', { name: headline.family.name, month: monthName(headline.month, locale) })}
              </h2>
              <p className="mt-1 text-stone-700">
                {t('due.nextCount', { count: headline.count })}{' '}
                <span className="text-stone-500">{ruleText(headline.rule, headline.appliesTo, locale, t)}</span>
              </p>
            </section>
          )}

          {groups.map((g) => {
            const pickable = selectable(g);
            const on = pickable.filter((e) => selected.has(keyOf(e.contact.id, g.family.family))).length;
            return (
              <section key={g.family.family} data-tour="due" className="rounded-xl border border-stone-200 bg-white">
                <header className="flex items-start gap-3 border-b border-stone-100 px-4 py-3">
                  <Checkbox
                    className="mt-1 h-5 w-5"
                    checked={pickable.length > 0 && on === pickable.length}
                    indeterminate={on > 0 && on < pickable.length}
                    disabled={pickable.length === 0}
                    onChange={(e) => toggleGroup(g, e.target.checked)}
                    aria-label={t('due.selectGroup', { name: g.family.name })}
                  />
                  <div>
                    <h2 className="font-semibold">{g.family.name}</h2>
                    <p className="text-sm text-stone-500">{ruleText(g.rule, g.appliesTo, locale, t)}</p>
                  </div>
                </header>
                <ul className="divide-y divide-stone-100">
                  {g.entries.map((e) => {
                    const key = keyOf(e.contact.id, g.family.family);
                    const name = contactName(e.contact);
                    return (
                      <li key={key}>
                        <label
                          className={`flex min-h-12 items-center gap-3 px-4 py-2 ${e.hasOpenDraft ? 'text-stone-400' : 'cursor-pointer hover:bg-stone-50'}`}
                        >
                          <Checkbox
                            className="h-5 w-5"
                            checked={!e.hasOpenDraft && selected.has(key)}
                            disabled={e.hasOpenDraft}
                            onChange={() => toggle(key)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{name}</span>
                            <span className="block truncate text-sm text-stone-500">
                              {[
                                e.contact.company,
                                t(`languages.${e.template.language}`),
                                e.daysSince === null
                                  ? t('due.never')
                                  : t('due.lastContact', { when: formatSince(e.daysSince, locale) }),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          {e.hasOpenDraft ? (
                            <span className="text-xs">{t('due.alreadyDrafted')}</span>
                          ) : (
                            !e.contact.notes && (
                              <span
                                title={t('contacts.noNotesHint')}
                                className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900"
                              >
                                <WarningIcon />
                                {t('contacts.noNotes')}
                              </span>
                            )
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {next.length > 0 && (
            <section data-tour="upcoming">
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">{t('due.upcoming')}</h2>
              <ul className="space-y-1 text-sm text-stone-600">
                {next.map((u) => (
                  <li key={u.family.family}>
                    {t('due.upcomingItem', { name: u.family.name, month: monthName(u.month, locale), count: u.count })}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-stone-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <h2 className="font-semibold">{t('due.manual')}</h2>
                <p className="text-sm text-stone-500">{t(idle ? 'due.manualHintIdle' : 'due.manualHint')}</p>
              </div>
              <Button
                data-tour={idle ? 'generate' : undefined}
                variant={idle && !manualOpen ? 'primary' : undefined}
                onClick={() => setManualOpen((v) => !v)}
                aria-expanded={manualOpen}
              >
                {manualOpen ? t('due.hideManual') : t('due.manual')}
              </Button>
            </header>
            {manualOpen && (
              <div className="space-y-3 border-t border-stone-100 px-4 py-3">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
                  <input
                    type="search"
                    aria-label={t('due.manualSearch')}
                    placeholder={t('contacts.searchPlaceholder')}
                    className={`${inputClass} pl-9`}
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setManualSelected(new Set([...manualSelected, ...manualShown.map((c) => c.id)]))}
                >
                  {t('due.manualSelectShown')}
                </Button>
                <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-200">
                  {manualShown.map((c) => (
                    <li key={c.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-stone-50">
                        <Checkbox
                          className="h-5 w-5"
                          checked={manualSelected.has(c.id)}
                          onChange={() =>
                            setManualSelected((s) => {
                              const n = new Set(s);
                              if (n.has(c.id)) n.delete(c.id);
                              else n.add(c.id);
                              return n;
                            })
                          }
                        />
                        <span className="font-medium">{contactName(c)}</span>
                        <span className="truncate text-sm text-stone-500">{c.company}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="primary"
                  disabled={manualSelected.size === 0}
                  onClick={() => setManualWriting(true)}
                >
                  <MailIcon />
                  {t('due.writeFor', { count: manualSelected.size })}
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      {groups.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600" aria-live="polite">
              {t('due.selected', { count })}
              {count > 0 && !settings.apiKey.trim() ? '' : count > 0 ? ` · ${t('due.estimate', { cost: formatEur(estimateCostEur(count), locale, t) })}` : ''}
            </p>
            <Button data-tour="generate" variant="primary" className="min-h-11" disabled={count === 0} onClick={() => setConfirming(jobs())}>
              <MailIcon />
              {t('due.generate')}
            </Button>
          </div>
        </div>
      )}

      {confirming && <DueGenerateDialog jobs={confirming} onClose={() => setConfirming(null)} />}
      {manualWriting && (
        <CreateDraftsDialog contactIds={[...manualSelected]} onClose={() => setManualWriting(false)} />
      )}
    </section>
  );
}
