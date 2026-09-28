import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from './db';
import { SETTINGS_ID, type Settings } from './schema';
import { defaultSettings } from './settings-defaults';

export { defaultSettings };

/** Creates the settings row on first launch. Safe to call repeatedly. */
export async function ensureSettings(): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get(SETTINGS_ID);
    if (existing) return withDefaults(existing);
    const fresh = defaultSettings();
    await db.settings.add(fresh);
    return fresh;
  });
}

/** Fills fields added after the row was first written. */
function withDefaults(row: Partial<Settings>): Settings {
  return { ...defaultSettings(), ...row, id: SETTINGS_ID };
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_ID);
  return row ? withDefaults(row) : defaultSettings();
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await ensureSettings();
  await db.settings.update(SETTINGS_ID, patch);
}

/**
 * Changes settings with a function applied inside one transaction to the
 * latest stored row. Use this for lists and maps (country overrides, withheld
 * fields) so two tabs changing different entries never undo each other.
 */
export async function modifySettings(change: (settings: Settings) => void): Promise<void> {
  await ensureSettings();
  await db.transaction('rw', db.settings, async () => {
    const row = await db.settings.get(SETTINGS_ID);
    if (!row) return;
    const next = withDefaults(row);
    change(next);
    await db.settings.put(next);
  });
}

/** true once the stored settings have been read (so first-run never flashes). */
export function useSettingsLoaded(): boolean {
  return useLiveQuery(() => db.settings.get(SETTINGS_ID), []) !== undefined;
}

/** Live settings; defaults until the row has loaded, so callers never wait. */
export function useSettings(): Settings {
  const row = useLiveQuery(() => db.settings.get(SETTINGS_ID), []);
  return useMemo(() => (row ? withDefaults(row) : defaultSettings()), [row]);
}
