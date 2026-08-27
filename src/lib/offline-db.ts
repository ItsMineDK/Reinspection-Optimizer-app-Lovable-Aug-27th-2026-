/**
 * Tiny SSR-safe IndexedDB wrapper used for offline persistence:
 * app state, civic address mappings and pre-cached map tiles.
 */

const DB_NAME = "route-optimizer-offline";
const DB_VERSION = 1;
export const STORE_STATE = "state";
export const STORE_CIVIC = "civic";
export const STORE_TILES = "tiles";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of [STORE_STATE, STORE_CIVIC, STORE_TILES]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.error("IndexedDB open failed", req.error);
        resolve(null);
      };
    } catch (err) {
      console.error("IndexedDB unavailable", err);
      resolve(null);
    }
  });
  return dbPromise;
}

export async function idbGet<T>(store: string, key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store, "readonly").objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbGetAllEntries<T>(store: string): Promise<[string, T][]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const os = db.transaction(store, "readonly").objectStore(store);
      const keysReq = os.getAllKeys();
      const valsReq = os.getAll();
      const tx = os.transaction;
      tx.oncomplete = () =>
        resolve(
          (keysReq.result as IDBValidKey[]).map(
            (k, i) => [String(k), (valsReq.result as T[])[i] as T] as [string, T],
          ),
        );
      tx.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function idbCount(store: string): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store, "readonly").objectStore(store).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export async function idbClear(store: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}