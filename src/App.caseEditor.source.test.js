import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/App.jsx", "utf8");

test("Case editor uses DialogShell without changing the established save handler", () => {
  assert.match(source, /import DialogShell from "\.\/components\/shared\/DialogShell"/);
  assert.match(source, /function CaseEditorDialog\(/);
  assert.match(source, /<DialogShell/);
  assert.match(source, /onSave=\{handleSaveCase\}/);
  assert.match(source, /dismissOnBackdrop=\{false\}/);
  assert.match(source, /initialFocusRef=\{caseNameInputRef\}/);
});

test("Case editor sessions protect actual edits while keeping new and edit baselines separate", () => {
  assert.match(source, /initialFormFingerprintRef = useRef\(JSON\.stringify\(form\)\)/);
  assert.match(source, /initialFormFingerprintRef\.current !== JSON\.stringify\(form\)/);
  assert.match(source, /Discard unsaved changes\?/);
  assert.match(source, /key=\{editingCase \? `edit:\$\{editingCase\.id\}` : "new"\}/);
});

test("Case editor retains the full pre-existing case form and its category values", () => {
  for (const fieldId of ["case-editor-name", "case-editor-description", "case-editor-category", "case-editor-custom-category", "case-editor-notes-field"]) {
    assert.match(source, new RegExp(fieldId));
  }
  for (const category of ["general", "personal", "work", "housing", "legal", "custom"]) {
    assert.match(source, new RegExp(`value="${category}"`));
  }
});
