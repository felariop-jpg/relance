import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from './db';
import type { Contact, Template } from './schema';

export function useContactMap(): Map<string, Contact> | undefined {
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);
  return useMemo(() => contacts && new Map(contacts.map((c) => [c.id, c])), [contacts]);
}

export function useTemplates(): Template[] | undefined {
  return useLiveQuery(() => db.templates.toArray(), []);
}
