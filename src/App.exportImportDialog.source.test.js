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

test("Export and Import dialog retains direct file selection without adding an import confirmation", () => {
  assert.match(appSource, /accept="application\/json,\.json"/);
  assert.match(appSource, /Import Backup JSON/);
  assert.match(appSource, /Cases and records merge by ID/);
  assert.match(appSource, /Import does not compare timestamps or provide conflict resolution/);
});

test("Export and Import uses the shared utility dialog and semantic action styles", () => {
  assert.match(appSource, /className="proveit-utility-dialog proveit-export-import-dialog"/);
  assert.match(appSource, /proveit-modal-section/);
  assert.match(appSource, /proveit-modal-action-primary/);
  assert.match(appSource, /proveit-modal-action-secondary/);
});
