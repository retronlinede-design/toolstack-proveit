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

test("Settings dialog groups controls into accessible, collapsible sections", () => {
  for (const label of ["Security", "Data &amp; Backups", "Advanced", "About", "Storage Diagnostics", "Browser profile"]) {
    assert.match(appSource, new RegExp(label));
  }
  assert.match(appSource, /const \[settingsExpandedSection, setSettingsExpandedSection\] = useState\("security"\)/);
  assert.match(appSource, /aria-expanded=\{settingsExpandedSection === "security"\}/);
  assert.match(appSource, /aria-controls="settings-section-security"/);
  assert.match(appSource, /hidden=\{settingsExpandedSection !== "security"\}/);
  assert.match(appSource, /proveit-settings-section-trigger/);
  assert.match(appSource, /if \(appLockFormError && current === "security"\) return "security"/);
  assert.match(appSource, /proveit-settings-error/);
  assert.match(appSource, /role="alert"/);
});
