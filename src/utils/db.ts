// src/utils/db.ts
const DB_NAME = "SchedulerDB";
const STORE_NAME = "appState";
const DB_VERSION = 1;

// Schema version for detecting stale saved data after app updates.
// Bump this when ScheduleConfig shape changes in a breaking way.
const SCHEMA_VERSION = 1;

// Module-level connection cache. Once established, saves can start a transaction
// immediately without an async round-trip — required for reliable beforeunload saves.
let _cachedDB: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (_cachedDB) return Promise.resolve(_cachedDB);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      _cachedDB = request.result;
      resolve(_cachedDB);
    };

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveToDB = async (key: string, value: unknown): Promise<void> => {
  try {
    const db = await initDB();
    // Stamp schema version alongside config saves
    if (key === "config") {
      const versionTx = db.transaction(STORE_NAME, "readwrite");
      versionTx.objectStore(STORE_NAME).put(SCHEMA_VERSION, "__schemaVersion");
    }
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("IndexedDB Save Error:", err);
  }
};

/**
 * Synchronous-start save using the cached IDB connection.
 * Starts the IDB transaction in the same call stack — suitable for use in
 * beforeunload where async promise chains may not resolve before the page
 * is destroyed. No-ops silently if the connection hasn't been established yet.
 */
export const saveToDBSync = (key: string, value: unknown): void => {
  if (!_cachedDB) return;
  try {
    const tx = _cachedDB.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    if (key === "config") {
      store.put(SCHEMA_VERSION, "__schemaVersion");
    }
  } catch {
    // Best-effort only — nothing useful to do in a beforeunload context
  }
};

export const loadFromDB = async <T = unknown>(key: string): Promise<T | null> => {
  try {
    const db = await initDB();

    // On config loads, check schema version. Wipe if stale.
    if (key === "config") {
      const version = await new Promise<number | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get("__schemaVersion");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (version !== undefined && version !== SCHEMA_VERSION) {
        console.warn(`Schema version mismatch (saved: ${version}, current: ${SCHEMA_VERSION}). Clearing stale data.`);
        await clearDB();
        return null;
      }
    }

    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("IndexedDB Load Error:", err);
    return null;
  }
};

export const clearDB = async (): Promise<void> => {
  const db = await initDB();
  _cachedDB = null; // clear cache so next open re-establishes
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};
