import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

function getSourceSlice(startNeedle, endNeedle) {
  const start = appSource.indexOf(startNeedle);
  assert.notEqual(start, -1, `Missing source marker: ${startNeedle}`);
  const end = appSource.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `Missing source marker: ${endNeedle}`);
  return appSource.slice(start, end);
}

test("startup case load does not save empty/default cases back to IndexedDB", () => {
  const startupLoadEffect = getSourceSlice("// Load cases from IndexedDB", "// Load images when a case is selected");

  assert.match(startupLoadEffect, /const loadedCases = await getAllCases\(\)/);
  assert.match(startupLoadEffect, /setCases\(normalized\)/);
  assert.doesNotMatch(startupLoadEffect, /saveCase\s*\(/);
  assert.doesNotMatch(startupLoadEffect, /deleteCase\s*\(/);
});

test("restore/import creates an emergency backup before processing imported cases", () => {
  const restoreFunction = getSourceSlice(
    "const restoreBackupPayload = async",
    "const importData = async"
  );

  const backupIndex = restoreFunction.indexOf("createEmergencyBackupFromDb");
  const importedIndex = restoreFunction.indexOf("const imported = parsed?.data || parsed");
  const currentCasesIndex = restoreFunction.indexOf("const currentCases = await getAllCases()");

  assert.ok(backupIndex >= 0, "restoreBackupPayload should create an emergency backup");
  assert.ok(backupIndex < importedIndex, "backup should happen before import validation/processing");
  assert.ok(currentCasesIndex > importedIndex, "restore should load current cases for merge");
  assert.doesNotMatch(restoreFunction, /deleteCase\s*\(/);
  assert.doesNotMatch(restoreFunction, /deleteCaseFromDb\s*\(/);
});

