// Export and import of all of a user's data as one JSON file.
import * as db from './db.js';

const APP_ID = 'WeightTracker';
export const SCHEMA_VERSION = 1;

// Secrets stay on the device: backup files are plain JSON that can be emailed or stored anywhere.
const withoutSecrets = (settings) => ({ ...settings, usda: { ...settings.usda, apiKey: '' } });

export async function buildExport(userId) {
  const data = {};
  for (const store of db.STORES) data[store] = await db.getAllByUser(store, userId);
  data.settings = data.settings.map(withoutSecrets);
  return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), userId, data };
}

export function parseExport(text) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid backup (it is not JSON).');
  }
  if (file?.app !== APP_ID || typeof file.data !== 'object') throw new Error('This file is not a Weight Tracker backup.');
  if (file.schemaVersion > SCHEMA_VERSION) throw new Error('This backup is from a newer version of the app. Update the app first.');
  return file;
}

// Imports the file's records into the given user. Records in the file replace records on this
// device with the same id; nothing else on the device is deleted. Returns the count per store.
export async function importInto(file, userId) {
  const counts = {};
  // Keep this device's API key; a backup never carries one (older backups might).
  const localKey = (await db.get('settings', userId))?.usda?.apiKey ?? '';
  for (const store of db.STORES) {
    const records = Array.isArray(file.data[store]) ? file.data[store] : [];
    const remapped = records
      .filter((r) => r && typeof r === 'object' && r.id)
      .map((r) => {
        const record = { ...r, userId };
        // users and settings are keyed by the user's own id
        if (store === 'users' || store === 'settings') record.id = userId;
        if (store === 'settings') record.usda = { ...r.usda, apiKey: localKey };
        return record;
      });
    if (remapped.length) await db.putMany(store, remapped);
    counts[store] = remapped.length;
  }
  return counts;
}
