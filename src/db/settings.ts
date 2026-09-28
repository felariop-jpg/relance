import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { SETTINGS_ID, type Lang, type Settings } from './schema';
import { browserLanguage } from '../lib/language';

export function defaultSettings(uiLanguage: Lang = browserLanguage()): Settings {
  return {
    id: SETTINGS_ID,
    apiKey: '',
    signature: '',
    calendlyLink: '',
    senderName: '',
    uiLanguage,
    defaultLanguage: 'en',
    countryLanguageOverrides: {},
    withheldFields: [],
    firstRunDone: false,
  };
}

/** Creates the settings row on first launch. Safe to call repeatedly. */
export async function ensureSettings(): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get(SETTINGS_ID);
    if (existing) return existing;
    const fresh = defaultSettings();
    await db.settings.add(fresh);
    return fresh;
  });
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get(SETTINGS_ID)) ?? defaultSettings();
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await ensureSettings();
  await db.settings.update(SETTINGS_ID, patch);
}

/** Live settings; defaults until the row has loaded, so callers never wait. */
export function useSettings(): Settings {
  const row = useLiveQuery(() => db.settings.get(SETTINGS_ID), []);
  return row ?? defaultSettings();
}
