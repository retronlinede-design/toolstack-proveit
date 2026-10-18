import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("Settings dialog preserves existing App Lock and utility callback wiring", () => {
  assert.match(appSource, /onClick=\{lockApp\}/);
  assert.match(appSource, /handleAppLockSessionUnlockToggle/);
  assert.match(appSource, /handleAutoLockChange/);
  assert.match(appSource, /onClick=\{handleSaveAppLock\}/);
  assert.match(appSource, /onClick=\{resetCorruptAppLock\}/);
  assert.match(appSource, /setExportImportOpen\(true\)/);
  assert.match(appSource, /handleStorageDiagnostics\(\)/);
});

test("Settings dialog retains all operational sections and accessible error feedback", () => {
  for (const label of ["Security & Privacy", "Data & Backups", "Storage Diagnostics", "App Info"]) {
    assert.match(appSource, new RegExp(label));
  }
  assert.match(appSource, /proveit-settings-error/);
  assert.match(appSource, /role="alert"/);
});
