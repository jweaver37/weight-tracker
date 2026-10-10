// Record access for the active user. Every saved record gets an id, the user's id and timestamps.
import * as db from './db.js';

let activeUserId = null;

export const newId = () => crypto.randomUUID();
export const currentUserId = () => activeUserId;

// Single user for now: use the first user on this device, creating one on first run.
export async function initUser() {
  const users = await db.getAll('users');
  if (users.length) {
    activeUserId = users.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0].id;
  } else {
    const now = new Date().toISOString();
    activeUserId = newId();
    await db.put('users', { id: activeUserId, userId: activeUserId, name: '', createdAt: now, updatedAt: now });
  }
  return activeUserId;
}

function stamp(record) {
  const now = new Date().toISOString();
  return {
    ...record,
    id: record.id ?? newId(),
    userId: record.userId ?? activeUserId,
    createdAt: record.createdAt ?? now,
    updatedAt: now,
  };
}

export async function save(store, record) {
  const stamped = stamp(record);
  await db.put(store, stamped);
  return stamped;
}

export const remove = (store, id) => db.remove(store, id);
export const listAll = (store) => db.getAllByUser(store, activeUserId);
export const listForDate = (store, date) => db.getByUserDate(store, activeUserId, date);
export const listRange = (store, from, to) => db.getByUserDateRange(store, activeUserId, from, to);

// Settings use the user's id as their record id: one settings record per user.
export const getSettings = () => db.get('settings', activeUserId);
export const saveSettings = (settings) => save('settings', { ...settings, id: activeUserId });
