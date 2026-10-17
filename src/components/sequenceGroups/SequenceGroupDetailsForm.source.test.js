import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(new URL("./SequenceGroupDetailsForm.jsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("./SequenceGroupManagementModal.jsx", import.meta.url), "utf8");
const caseDetail = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");

test("Issue Details preserves its existing fields and validates through the original save boundary", () => {
  for (const label of ["Issue name", "Purpose", "Description", "Status", "Priority", "Owner", "Review date", "Current position"]) assert.match(form, new RegExp(label));
  assert.match(form, /validateSequenceGroupInput\(form, existingNames, group\.name\)/);
  assert.match(form, /const saved = await onSave\(result\.value\)/);
  assert.match(modal, /onSave=\{onSaveDetails\}/);
  assert.match(caseDetail, /updateCaseIssue\(canonical, issue\.id, value\)/);
});

test("Issue Details only clears its draft baseline after a successful save", () => {
  assert.match(form, /if \(saved\) \{/);
  assert.match(form, /baselineRef\.current = createSequenceGroupDetailsBaseline\(result\.value\)/);
  assert.match(form, /onDirtyChange\?\.\(false\)/);
  assert.match(caseDetail, /return false;/);
  assert.match(caseDetail, /return true;/);
});
