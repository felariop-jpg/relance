import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { TrashEntry } from './schema';

/** Live list of recently deleted contacts, newest first, shared by every tab. */
export function useTrash(): TrashEntry[] | undefined {
  return useLiveQuery(() => db.trash.orderBy('deletedAt').reverse().toArray(), []);
}

/** Empties the trash now; returns what was removed so the toast can undo it. */
export async function emptyTrash(): Promise<TrashEntry[]> {
  return db.transaction('rw', db.trash, async () => {
    const all = await db.trash.toArray();
    await db.trash.clear();
    return all;
  });
}

export async function putBackTrash(entries: TrashEntry[]): Promise<void> {
  await db.trash.bulkPut(entries);
}
