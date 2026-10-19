import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./App.jsx", import.meta.url), "utf8");

test("AUDIT-008: restore preflight runs before emergency backup, attachment restore, and the atomic canonical save", () => {
  const preflight = source.indexOf("const preflight = preflightBackupPayload(parsed");
  assert.ok(preflight >= 0);
  assert.ok(preflight < source.indexOf("createEmergencyBackupFromDb(`restoreBackupPayload:before:${source}`)"));
  assert.ok(source.indexOf("restoreFullBackupCase(caseItem", preflight) > preflight);
  assert.ok(source.indexOf("await saveCasesAndImages(mergedCases", preflight) > preflight);
});

test("atomic restore stages full-backup binaries and commits them with every merged case", () => {
  assert.match(source, /deferWrites: isFullBackup/);
  assert.match(source, /restoreSession\.stagedImages\(\)/);
  assert.match(source, /saveCasesAndImages\(mergedCases/);
});

test("AUDIT-008: startup filters malformed stored cases before normalization and rewrite", () => {
  assert.match(source, /validateStoredCaseForNormalization\(caseItem\)\.ok/);
  assert.match(source, /const validStoredCases = loadedCases\.filter/);
  assert.match(source, /validStoredCases\.map\(\(caseItem\) => normalizeStoredCase/);
});
