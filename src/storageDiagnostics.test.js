import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE_FOLDERS_STORAGE_KEY,
  LOCAL_MIRROR_STORAGE_KEY,
  countCaseFolders,
  readLocalMirrorSummary,
} from "./storageDiagnostics.js";

test("countCaseFolders returns the local folder definition count", () => {
  const originalLocalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
  };

  try {
    values.set(CASE_FOLDERS_STORAGE_KEY, JSON.stringify([
      { id: "folder-1", name: "Finance" },
      { id: "folder-2", name: "Housing" },
    ]));

    assert.equal(countCaseFolders(), 2);
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});

test("countCaseFolders treats missing or invalid folder data as empty", () => {
  const originalLocalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
  };

  try {
    assert.equal(countCaseFolders(), 0);
    values.set(CASE_FOLDERS_STORAGE_KEY, "{bad json");
    assert.equal(countCaseFolders(), 0);
    values.set(CASE_FOLDERS_STORAGE_KEY, JSON.stringify({ id: "folder-1" }));
    assert.equal(countCaseFolders(), 0);
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});

test("readLocalMirrorSummary reports mirror metadata", () => {
  const originalLocalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
  };

  try {
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
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});

test("readLocalMirrorSummary handles missing and corrupt mirror data", () => {
  const originalLocalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
  };

  try {
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
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});
