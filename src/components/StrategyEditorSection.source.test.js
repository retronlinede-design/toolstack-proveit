import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editorSource = readFileSync("src/components/StrategyEditorSection.jsx", "utf8");
const modalSource = readFileSync("src/components/RecordModal.jsx", "utf8");
const appSource = readFileSync("src/App.jsx", "utf8");

test("strategy modal uses the dedicated editor inside the shared save flow", () => {
  assert.match(modalSource, /recordType === "strategy" \? \(\s*<StrategyEditorSection/);
  assert.match(modalSource, /prepareRecordFormForSave\(recordForm, recordType, caseParties\)/);
  assert.match(modalSource, /saveRecord\(payload\)/);
  assert.match(modalSource, /Linked Case Items/);
  assert.match(modalSource, /Upload attachments/);
});

test("strategy editor exposes structured planning fields and party ownership", () => {
  for (const field of ["strategyType", "objective", "rationale", "desiredOutcome", "priority", "reviewDate", "decisionStatus", "ownerPartyId", "assumptions", "risks", "nextSteps"]) {
    assert.match(editorSource, new RegExp(`recordForm\\.${field}`));
  }
  assert.match(editorSource, /caseParties\.map/);
  assert.match(editorSource, /type="date" value=\{recordForm\.reviewDate/);
  assert.match(editorSource, /<StringListEditor/);
});

test("shared form defaults and hydration include safe strategy list state", () => {
  assert.match(appSource, /strategyType: ""/);
  assert.match(appSource, /ownerPartyId: ""/);
  assert.match(appSource, /assumptions: Array\.isArray\(currentRecord\?\.assumptions\)/);
  assert.match(appSource, /nextSteps: Array\.isArray\(initialFormState\.nextSteps\)/);
});
