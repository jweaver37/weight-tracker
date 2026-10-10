// Export / import actions shared by Settings and the backup reminder.
import { buildExport, importInto, parseExport } from '../data/backup.js';
import { currentUserId } from '../data/repo.js';
import { todayStr } from '../core/dates.js';
import { state, saveSettings, loadSettings } from './state.js';
import { confirmDialog, infoDialog, toast } from './dom.js';
import { downloadBlob, pickFile } from './files.js';

export async function exportBackup() {
  const file = await buildExport(currentUserId());
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `weight-tracker-backup-${todayStr()}.json`);
  await saveSettings({ ...state.settings, lastBackupAt: new Date().toISOString() });
  toast('Backup downloaded');
}

// Returns true when data was imported.
export async function importBackup() {
  const fileHandle = await pickFile('application/json,.json');
  if (!fileHandle) return false;
  let file;
  try {
    file = parseExport(await fileHandle.text());
  } catch (err) {
    await infoDialog(err.message, { title: 'Can’t import' });
    return false;
  }
  const total = Object.values(file.data).reduce((n, records) => n + (Array.isArray(records) ? records.length : 0), 0);
  const ok = await confirmDialog(
    `Import ${total} records from the backup made ${new Date(file.exportedAt).toLocaleString()}? ` +
      'Your settings will be replaced by the backup’s settings. Other data on this device is kept.',
    { title: 'Import backup', okLabel: 'Import' },
  );
  if (!ok) return false;
  await importInto(file, currentUserId());
  await loadSettings();
  toast('Backup imported');
  return true;
}
