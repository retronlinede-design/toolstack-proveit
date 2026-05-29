import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE_FOLDERS_STORAGE_KEY,
  LOCAL_MIRROR_STORAGE_KEY,
  countCaseFolders,
  getLocalStorageDiagnostics,
  readLocalMirrorSummary,
  writeLocalMirrorFromFullBackup,
} from "./storageDiagnostics.js";

function withFakeLocalStorage(callback) {
  const originalLocalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };

  try {
    return callback(values);
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
}

test("countCaseFolders returns the local folder definition count", () => {
  withFakeLocalStorage((values) => {
    values.set(CASE_FOLDERS_STORAGE_KEY, JSON.stringify([
      { id: "folder-1", name: "Finance" },
      { id: "folder-2", name: "Housing" },
    ]));

    assert.equal(countCaseFolders(), 2);
  });
});

test("countCaseFolders treats missing or invalid folder data as empty", () => {
  withFakeLocalStorage((values) => {
    assert.equal(countCaseFolders(), 0);
    values.set(CASE_FOLDERS_STORAGE_KEY, "{bad json");
    assert.equal(countCaseFolders(), 0);
    values.set(CASE_FOLDERS_STORAGE_KEY, JSON.stringify({ id: "folder-1" }));
    assert.equal(countCaseFolders(), 0);
  });
});

test("readLocalMirrorSummary reports mirror metadata", () => {
  withFakeLocalStorage((values) => {
    values.set(LOCAL_MIRROR_STORAGE_KEY, JSON.stringify({
      exportType: "FULL_BACKUP_ALL",
      timestamp: "2026-05-29T10:00:00.000Z",
      caseCount: 3,
      quickCaptureCount: 1,
      folderCount: 2,
      payload: { exportType: "FULL_BACKUP_ALL", data: { cases: [] } },
    }));

    assert.deepEqual(readLocalMirrorSummary(), {
      exists: true,
      timestamp: "2026-05-29T10:00:00.000Z",
      caseCount: 3,
      folderCount: 2,
      corrupt: false,
    });
  });
});

test("readLocalMirrorSummary handles missing and corrupt mirror data", () => {
  withFakeLocalStorage((values) => {
    assert.deepEqual(readLocalMirrorSummary(), {
      exists: false,
      timestamp: "",
      caseCount: 0,
      folderCount: 0,
      corrupt: false,
    });

    values.set(LOCAL_MIRROR_STORAGE_KEY, "{bad json");
    assert.deepEqual(readLocalMirrorSummary(), {
      exists: true,
      timestamp: "",
      caseCount: 0,
      folderCount: 0,
      corrupt: true,
    });
  });
});

test("writeLocalMirrorFromFullBackup writes mirror for valid full backups with cases", () => {
  withFakeLocalStorage((values) => {
    const payload = {
      exportType: "FULL_BACKUP_ALL",
      appData: { folders: [{ id: "folder-1", name: "Finance" }] },
      data: {
        cases: [{ id: "case-1" }],
        quickCaptures: [{ id: "capture-1" }],
      },
    };

    const mirror = writeLocalMirrorFromFullBackup(payload);
    const stored = JSON.parse(values.get(LOCAL_MIRROR_STORAGE_KEY));

    assert.equal(mirror.caseCount, 1);
    assert.equal(stored.caseCount, 1);
    assert.equal(stored.quickCaptureCount, 1);
    assert.equal(stored.folderCount, 1);
    assert.deepEqual(stored.payload, payload);
  });
});

test("writeLocalMirrorFromFullBackup refuses to overwrite with zero-case backup", () => {
  withFakeLocalStorage((values) => {
    const existing = {
      exportType: "FULL_BACKUP_ALL",
      timestamp: "2026-05-29T10:00:00.000Z",
      caseCount: 2,
      quickCaptureCount: 0,
      folderCount: 0,
      payload: { exportType: "FULL_BACKUP_ALL", data: { cases: [{ id: "case-old" }, { id: "case-2" }] } },
    };
    values.set(LOCAL_MIRROR_STORAGE_KEY, JSON.stringify(existing));

    const result = writeLocalMirrorFromFullBackup({
      exportType: "FULL_BACKUP_ALL",
      data: { cases: [] },
    });

    assert.equal(result, null);
    assert.deepEqual(JSON.parse(values.get(LOCAL_MIRROR_STORAGE_KEY)), existing);
  });
});

test("writeLocalMirrorFromFullBackup reads folders from appData.folders", () => {
  withFakeLocalStorage((values) => {
    writeLocalMirrorFromFullBackup({
      exportType: "FULL_BACKUP_ALL",
      appData: { folders: [{ id: "folder-app", name: "App Folder" }] },
      data: {
        folders: [{ id: "folder-data", name: "Data Folder" }],
        cases: [{ id: "case-1" }],
      },
    });

    const stored = JSON.parse(values.get(LOCAL_MIRROR_STORAGE_KEY));
    assert.equal(stored.folderCount, 1);
    assert.deepEqual(stored.payload.appData.folders, [{ id: "folder-app", name: "App Folder" }]);
  });
});

test("local storage diagnostics sees mirror after write", () => {
  withFakeLocalStorage(() => {
    writeLocalMirrorFromFullBackup({
      exportType: "FULL_BACKUP_ALL",
      appData: { folders: [{ id: "folder-1", name: "Finance" }] },
      data: { cases: [{ id: "case-1" }] },
    });

    const diagnostics = getLocalStorageDiagnostics();
    assert.equal(diagnostics.localMirrorExists, true);
    assert.equal(diagnostics.localMirrorCaseCount, 1);
    assert.equal(diagnostics.localMirrorFolderCount, 1);
  });
});
