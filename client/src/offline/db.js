/**
 * The on-device store behind offline mode.
 *
 * Two object stores, both namespaced by the signed-in user's id:
 *
 *   cache  — the last successful response for a given read, so the app can
 *            render without a network. Overwritten on every successful fetch.
 *   outbox — writes made while offline, waiting to be replayed.
 *
 * IndexedDB rather than localStorage because a workout history is far past the
 * ~5MB localStorage ceiling, and because writes there are synchronous and would
 * jank the set-logging UI on a cheap phone.
 *
 * Everything is keyed by user id. This is the whole reason vite.config's
 * `runtimeCaching` is empty: a Workbox HTTP cache is keyed by URL and cannot
 * know who owns a row, so signing out and back in as someone else could serve
 * the previous account's data. A store that carries the owner can be scoped on
 * read and wiped on sign-out.
 */

const DB_NAME = 'liftlog-offline';
const DB_VERSION = 1;
export const CACHE_STORE = 'cache';
export const OUTBOX_STORE = 'outbox';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    // Private browsing, a locked-down profile, or a disabled storage setting
    // all surface here. Offline is an enhancement, so the app has to keep
    // working without it rather than refusing to start.
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        // Key is `${userId}:${key}` — a compound key would need an index to
        // wipe one user's rows, and a string prefix does the same job.
        db.createObjectStore(CACHE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: 'seq', autoIncrement: true });
        outbox.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked by another tab'));
  }).catch((err) => {
    // Don't cache the rejection — a later call may succeed (e.g. the blocking
    // tab closed), and a permanently poisoned promise would disable offline
    // mode for the life of the page.
    dbPromise = null;
    throw err;
  });

  return dbPromise;
}

function run(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;
        try {
          result = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        tx.oncomplete = () => resolve(result?.__request ? result.__request.result : result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Wrap an IDBRequest so `run` resolves with its result once the tx commits. */
const req = (request) => ({ __request: request });

export async function cacheGet(userId, key) {
  if (!userId) return null;
  const row = await run(CACHE_STORE, 'readonly', (s) => req(s.get(`${userId}:${key}`)));
  return row ? row.data : null;
}

export async function cacheGetEntry(userId, key) {
  if (!userId) return null;
  return run(CACHE_STORE, 'readonly', (s) => req(s.get(`${userId}:${key}`)));
}

export async function cacheSet(userId, key, data) {
  if (!userId) return;
  await run(CACHE_STORE, 'readwrite', (s) =>
    s.put({ id: `${userId}:${key}`, userId, key, data, savedAt: Date.now() }),
  );
}

export async function cacheDelete(userId, key) {
  if (!userId) return;
  await run(CACHE_STORE, 'readwrite', (s) => s.delete(`${userId}:${key}`));
}

/** Drop every cached read for one user. Used on sign-out. */
export async function cacheClearUser(userId) {
  if (!userId) return;
  await run(CACHE_STORE, 'readwrite', (s) => {
    const cursorReq = s.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      if (cursor.value.userId === userId) cursor.delete();
      cursor.continue();
    };
  });
}

/** Drop cached reads matching a key prefix — e.g. every page of history. */
export async function cacheDeletePrefix(userId, prefix) {
  if (!userId) return;
  await run(CACHE_STORE, 'readwrite', (s) => {
    const cursorReq = s.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      if (cursor.value.userId === userId && String(cursor.value.key).startsWith(prefix)) {
        cursor.delete();
      }
      cursor.continue();
    };
  });
}

export async function outboxAdd(entry) {
  return run(OUTBOX_STORE, 'readwrite', (s) => req(s.add(entry)));
}

export async function outboxAll(userId) {
  if (!userId) return [];
  const rows = await run(OUTBOX_STORE, 'readonly', (s) => req(s.index('userId').getAll(userId)));
  return rows || [];
}

export async function outboxDelete(seq) {
  await run(OUTBOX_STORE, 'readwrite', (s) => s.delete(seq));
}

export async function outboxUpdate(entry) {
  await run(OUTBOX_STORE, 'readwrite', (s) => s.put(entry));
}
