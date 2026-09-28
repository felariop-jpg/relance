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
    senderGender: 'unspecified',
    voiceSamples: [],
    costTotalEur: 0,
    costSince: new Date().toISOString(),
    lastBackupAt: null,
    backupReminderSnoozedUntil: null,
    templatesSeeded: false,
    firstRunDone: false,
  };
}
