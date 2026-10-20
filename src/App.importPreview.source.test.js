import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");

test("backup selection generates a bounded preview without calling the restore path", () => {
  const selectionStart = source.indexOf("const importData = async");
  const confirmationStart = source.indexOf("const confirmImportData = async");
  const selection = source.slice(selectionStart, confirmationStart);
  assert.match(selection, /buildImportPreview\(parsed/);
  assert.doesNotMatch(selection, /restoreBackupPayload\(parsed/);
  assert.match(selection, /pendingImportFileRef\.current = file/);
  assert.match(selection, /summary: preview/);
  assert.match(selection, /setImportPreview\(null\)/);
});

test("confirmation re-reads, preflights, and rejects a stale preview before restore", () => {
  const confirmationStart = source.indexOf("const confirmImportData = async");
  const confirmationEnd = source.indexOf("const restoreRescueSnapshot", confirmationStart);
  const confirmation = source.slice(confirmationStart, confirmationEnd);
  assert.match(confirmation, /const text = await pendingFile\.text\(\)/);
  assert.match(confirmation, /const preflight = preflightBackupPayload\(parsed/);
  assert.match(confirmation, /matchesImportPreviewBaseline\(preview\.baseline/);
  assert.match(confirmation, /Local cases, folders, or quick captures changed after this preview/);
  assert.ok(confirmation.indexOf("matchesImportPreviewBaseline(preview.baseline") < confirmation.indexOf("await requireRecentFullBackup()"));
  assert.match(confirmation, /restoreBackupPayload\(parsed, \{ source: "file", expectedPreviewBaseline: preview\.baseline \}\)/);
  assert.match(confirmation, /importConfirmationRef\.current/);
});

test("restore repeats the stale-baseline check before emergency backup and atomic persistence", () => {
  const restoreStart = source.indexOf("const restoreBackupPayload = async");
  const restoreEnd = source.indexOf("const importData = async", restoreStart);
  const restore = source.slice(restoreStart, restoreEnd);
  const staleCheck = restore.indexOf("matchesImportPreviewBaseline(expectedPreviewBaseline");
  assert.ok(staleCheck >= 0);
  assert.ok(staleCheck < restore.indexOf("createEmergencyBackupFromDb(`restoreBackupPayload:before:${source}`)"));
  assert.match(restore, /await saveCasesAndImages\(mergedCases/);
});
