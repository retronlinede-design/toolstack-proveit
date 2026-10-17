import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/App.jsx", "utf8");

test("Document and Case Record editor uses DialogShell with the shared accessible form boundary", () => {
  assert.match(source, /\{documentModalOpen && \(\s*<DialogShell/);
  assert.match(source, /width="wide"/);
  assert.match(source, /dismissOnBackdrop=\{false\}/);
  assert.match(source, /initialFocusRef=\{documentTitleInputRef\}/);
  assert.match(source, /footer=\{documentModalFooter\}/);
});

test("Document editor establishes an independent full-form dismissal baseline for each session", () => {
  assert.match(source, /documentFormFingerprintRef\.current = JSON\.stringify\(nextForm\)/);
  assert.match(source, /documentFormFingerprintRef\.current !== JSON\.stringify\(documentForm\)/);
  assert.match(source, /Discard unsaved changes\?/);
  assert.match(source, /key=\{`\$\{selectedCaseId\}:\$\{documentModalMode\}:\$\{editingDocumentId \|\| "new"\}`\}/);
});

test("Document migration preserves the existing save and tracking-record compatibility paths", () => {
  assert.match(source, /const documentInput = documentModalMode === "record"/);
  assert.match(source, /ensureRecordDocumentForm\(documentForm\)/);
  assert.match(source, /upsertDocumentEntryInCase\(currentCase, documentInput, editingDocumentId\)/);
  assert.match(source, /handleDocumentFiles/);
  assert.match(source, /removeDocumentAttachment/);
  assert.match(source, /updateRecordDocumentForm\(\{ tableText: e\.target\.value \}\)/);
});

test("successful document saves retain their direct close path without a dismissal warning", () => {
  const saveStart = source.indexOf("  const saveDocumentEntry = async () => {");
  const saveEnd = source.indexOf("\n  const handleDocumentFiles", saveStart);
  const saveSource = source.slice(saveStart, saveEnd);
  assert.match(saveSource, /closeDocumentModal\(\);/);
  assert.doesNotMatch(saveSource, /requestCloseDocumentModal/);
});
