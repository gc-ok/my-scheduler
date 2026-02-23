// src/utils/db.ts
const DB_NAME = "SchedulerDB";
const STORE_NAME = "appState";
const DB_VERSION = 1;

// Schema version for detecting stale saved data after app updates.
// Bump this when ScheduleConfig shape changes in a breaking way.
const SCHEMA_VERSION = 1;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

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
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};
