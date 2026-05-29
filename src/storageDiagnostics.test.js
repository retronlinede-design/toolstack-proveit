import test from "node:test";
import assert from "node:assert/strict";

import { CASE_FOLDERS_STORAGE_KEY, countCaseFolders } from "./storageDiagnostics.js";

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
