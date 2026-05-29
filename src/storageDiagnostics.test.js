import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE_FOLDERS_STORAGE_KEY,
  countCaseFolders,
  getLocalStorageDiagnostics,
} from "./storageDiagnostics.js";
import {
  RESCUE_SNAPSHOT_STORAGE_KEY,
  readRescueSnapshotSummary,
  writeRescueSnapshot,
} from "./rescueSnapshot.js";

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

test("local storage diagnostics sees rescue snapshot after write", () => {
  withFakeLocalStorage(() => {
    writeRescueSnapshot({
      cases: [{ id: "case-1" }],
      folders: [{ id: "folder-1", name: "Finance" }],
      imageCount: 48,
    });

    const diagnostics = getLocalStorageDiagnostics();
    assert.equal(diagnostics.rescueSnapshotExists, true);
    assert.equal(diagnostics.rescueSnapshotCaseCount, 1);
    assert.equal(diagnostics.rescueSnapshotFolderCount, 1);
    assert.equal(diagnostics.rescueSnapshotImageCount, 48);
  });
});

test("readRescueSnapshotSummary handles missing and corrupt rescue data", () => {
  withFakeLocalStorage((values) => {
    assert.deepEqual(readRescueSnapshotSummary(), {
      exists: false,
      timestamp: "",
      caseCount: 0,
      folderCount: 0,
      imageCount: 0,
      corrupt: false,
    });

    values.set(RESCUE_SNAPSHOT_STORAGE_KEY, "{bad json");
    assert.deepEqual(readRescueSnapshotSummary(), {
      exists: false,
      timestamp: "",
      caseCount: 0,
      folderCount: 0,
      imageCount: 0,
      corrupt: true,
    });
  });
});
