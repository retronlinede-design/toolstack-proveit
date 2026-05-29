import { DB_NAME, DB_VERSION, STORE_NAMES } from "./dbConstants.js";

export const QUICK_CAPTURE_STORAGE_KEY = "toolstack.proveit.v1.captures";
export const CASE_FOLDERS_STORAGE_KEY = "toolstack.proveit.v1.folders";
export const LOCAL_MIRROR_STORAGE_KEY = "toolstack.proveit.v1.localMirror";

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

export function readLocalMirrorSummary() {
  try {
    const saved = localStorage.getItem(LOCAL_MIRROR_STORAGE_KEY);
    if (!saved) {
      return {
        exists: false,
        timestamp: "",
        caseCount: 0,
        folderCount: 0,
        corrupt: false,
      };
    }

    const parsed = JSON.parse(saved);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.exportType !== "FULL_BACKUP_ALL" ||
      !parsed.payload ||
      parsed.payload.exportType !== "FULL_BACKUP_ALL"
    ) {
      return {
        exists: true,
        timestamp: "",
        caseCount: 0,
        folderCount: 0,
        corrupt: true,
      };
    }

    const payload = parsed.payload;
    const payloadData = payload?.data || payload;
    const payloadCaseCount = Array.isArray(payloadData?.cases) ? payloadData.cases.length : 0;
    const payloadFolderSource = Array.isArray(payload?.appData?.folders)
      ? payload.appData.folders
      : Array.isArray(payloadData?.folders)
        ? payloadData.folders
        : [];

    return {
      exists: true,
      timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : "",
      caseCount: Number.isFinite(parsed.caseCount) ? parsed.caseCount : payloadCaseCount,
      folderCount: Number.isFinite(parsed.folderCount) ? parsed.folderCount : payloadFolderSource.length,
      corrupt: false,
    };
  } catch {
    return {
      exists: true,
      timestamp: "",
      caseCount: 0,
      folderCount: 0,
      corrupt: true,
    };
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
  const mirrorSummary = readLocalMirrorSummary();

  return {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    objectStoreNames: Array.from(db.objectStoreNames),
    recordCounts,
    localStorage: {
      quickCaptureCount: countQuickCaptures(),
      folderCount: countCaseFolders(),
      localMirrorExists: mirrorSummary.exists && !mirrorSummary.corrupt,
      localMirrorTimestamp: mirrorSummary.timestamp,
      localMirrorCaseCount: mirrorSummary.caseCount,
      localMirrorFolderCount: mirrorSummary.folderCount,
    },
  };
}
