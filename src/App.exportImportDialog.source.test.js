import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("Export and Import dialog preserves existing export and import action wiring", () => {
  assert.match(appSource, /onClick=\{handleFullBackup\}/);
  assert.match(appSource, /onClick=\{exportSelectedCaseBackup\}/);
  assert.match(appSource, /exportCaseReasoningExport\(selectedCase\.id\)/);
  assert.match(appSource, /exportCaseReasoningExportV3\(selectedCase\.id\)/);
  assert.match(appSource, /onChange=\{importData\}/);
  assert.match(appSource, /onClick=\{restoreRescueSnapshot\}/);
});

test("Export and Import retains direct file selection while presenting its safety guidance", () => {
  assert.match(appSource, /accept="application\/json,\.json"/);
  assert.match(appSource, /Choose and Import Backup JSON/);
  assert.match(appSource, /Choosing a JSON file starts the existing import process immediately/);
  assert.match(appSource, /Cases and records merge by ID/);
  assert.match(appSource, /Imports do not compare timestamps or resolve conflicts/);
});

test("Export and Import uses accessible collapsible Backup, Restore, and Recovery sections", () => {
  assert.match(appSource, /className="proveit-utility-dialog proveit-export-import-dialog"/);
  assert.match(appSource, /Backup &amp; Export/);
  assert.match(appSource, /Restore or Merge a Backup/);
  assert.match(appSource, /Limited Recovery/);
  assert.match(appSource, /aria-expanded=\{exportImportExpandedSection === "backup"\}/);
  assert.match(appSource, /aria-expanded=\{exportImportExpandedSection === "restore"\}/);
  assert.match(appSource, /aria-expanded=\{exportImportExpandedSection === "recovery"\}/);
  assert.match(appSource, /proveit-export-import-section-trigger/);
  assert.match(appSource, /proveit-modal-action-primary/);
  assert.match(appSource, /proveit-modal-action-secondary/);
});

test("Export and Import uses a keyboard-operable import button and protects the active import lifecycle", () => {
  assert.match(appSource, /ref=\{importFileInputRef\}/);
  assert.match(appSource, /onClick=\{\(\) => importFileInputRef\.current\?\.click\(\)\}/);
  assert.match(appSource, /disabled=\{importBusy\}/);
  assert.match(appSource, /Selected file:/);
  assert.match(appSource, /role="status" aria-live="polite"/);
  assert.match(appSource, /const requestExportImportClose = \(\) => \{/);
  assert.match(appSource, /Import in progress\. Wait for it to finish before closing this dialog\./);
  assert.match(appSource, /onRequestClose=\{requestExportImportClose\}/);
  assert.match(appSource, /if \(importBusy\) return "restore"/);
  assert.match(appSource, /setImportBusy\(true\)/);
  assert.match(appSource, /finally \{\s+setImportBusy\(false\);/);
});
