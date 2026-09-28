import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from './db/db';
import { useSettings } from './db/settings';
import { dueGroups } from './lib/schedule';
import type { Route } from './nav';

/** Small counters on the tabs: drafts waiting for review, and people due now. */
export function useNavCounts(): Record<Route, number> {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const [contacts, drafts, templates] = await Promise.all([
      db.contacts.toArray(),
      db.drafts.toArray(),
      db.templates.toArray(),
    ]);
    return { contacts, drafts, templates };
  }, []);
  return useMemo(() => {
    if (!data) return { contacts: 0, due: 0, review: 0, settings: 0 };
    const review = data.drafts.filter((d) => ['generated', 'edited', 'failed', 'pending'].includes(d.status)).length;
    const due = new Set(
      dueGroups(data.contacts, data.templates, data.drafts, settings, new Date()).flatMap((g) =>
        g.entries.filter((e) => !e.hasOpenDraft).map((e) => e.contact.id),
      ),
    ).size;
    return { contacts: 0, due, review, settings: 0 };
  }, [data, settings]);
}
