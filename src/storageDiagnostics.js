import { DB_NAME, DB_VERSION, STORE_NAMES } from "./dbConstants.js";

export const QUICK_CAPTURE_STORAGE_KEY = "toolstack.proveit.v1.captures";
export const CASE_FOLDERS_STORAGE_KEY = "toolstack.proveit.v1.folders";

function countQuickCaptures() {
  try {
    const saved = localStorage.getItem(QUICK_CAPTURE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function countCaseFolders() {
  try {
    const saved = localStorage.getItem(CASE_FOLDERS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function getStorageDiagnostics() {
  const { dbPromise } = await import("./db.js");
  const db = await dbPromise;
  const recordCounts = {};

  for (const storeName of Object.values(STORE_NAMES)) {
    recordCounts[storeName] = db.objectStoreNames.contains(storeName)
      ? await db.count(storeName)
      : null;
  }

  return {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    objectStoreNames: Array.from(db.objectStoreNames),
    recordCounts,
    localStorage: {
      quickCaptureCount: countQuickCaptures(),
      folderCount: countCaseFolders(),
    },
  };
}
