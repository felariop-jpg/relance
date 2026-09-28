import { updateSettings } from '../db/settings';
import { todayIso } from '../lib/dates';
import { downloadFile } from '../lib/download';
import { backupFileName, createBackup } from './backup';

/** Downloads a full backup and records when it happened. Returns the file name. */
export async function downloadBackup(): Promise<string> {
  const backup = await createBackup();
  const name = backupFileName(todayIso());
  downloadFile(JSON.stringify(backup, null, 2), name, 'application/json');
  await updateSettings({ lastBackupAt: new Date().toISOString(), backupReminderSnoozedUntil: null });
  return name;
}
