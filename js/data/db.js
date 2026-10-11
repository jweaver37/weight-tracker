// Thin promise wrapper around IndexedDB. Every store is keyed by `id` and indexed by `userId`;
// dated stores also have a [userId, date] index.

const DB_NAME = 'weight-tracker';
// Bump the version when adding a store; upgrades create any store that is missing.
const DB_VERSION = 3;

export const STORES = ['users', 'settings', 'logEntries', 'customFields', 'weights', 'workouts', 'activities', 'recipes', 'milestones', 'water', 'measurements'];
const DATED_STORES = ['logEntries', 'weights', 'workouts', 'water', 'measurements'];

let dbPromise = null;

export function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: 'id' });
        store.createIndex('userId', 'userId');
        if (DATED_STORES.includes(name)) store.createIndex('userId_date', ['userId', 'date']);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer version open in another tab (e.g. after an app update) instead of blocking it.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

// Runs fn(store) in a transaction and resolves with the result of the request fn returns (if any)
// once the transaction commits.
async function run(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const get = (store, id) => run(store, 'readonly', (s) => s.get(id));
export const put = (store, record) => run(store, 'readwrite', (s) => s.put(record));
export const remove = (store, id) => run(store, 'readwrite', (s) => s.delete(id));
export const getAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const getAllByUser = (store, userId) => run(store, 'readonly', (s) => s.index('userId').getAll(userId));
export const getByUserDate = (store, userId, date) =>
  run(store, 'readonly', (s) => s.index('userId_date').getAll([userId, date]));
export const getByUserDateRange = (store, userId, from, to) =>
  run(store, 'readonly', (s) => s.index('userId_date').getAll(IDBKeyRange.bound([userId, from], [userId, to])));

export function putMany(store, records) {
  return run(store, 'readwrite', (s) => {
    for (const record of records) s.put(record);
  });
}
