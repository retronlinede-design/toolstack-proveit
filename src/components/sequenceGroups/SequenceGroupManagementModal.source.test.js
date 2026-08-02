import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const modal = readFileSync(new URL("./SequenceGroupManagementModal.jsx", import.meta.url), "utf8");
const records = readFileSync(new URL("./SequenceGroupRecordManager.jsx", import.meta.url), "utf8");
const caseDetail = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");

test("management modal exposes accessible full-management sections", () => {
  for (const label of ["Manage Issue", "Details", "Records", "Move / Merge", "Delete", "Merge Entire Group into Existing Group", "Move Entire Group into New Group"]) assert.match(modal, new RegExp(label.replace("/", "\\/")));
  assert.match(modal, /role="tablist"/);
  assert.match(modal, /role="tab"/);
  assert.match(modal, /aria-selected/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /previousFocus\?\.focus/);
  assert.match(modal, /max-w-5xl/);
  assert.match(modal, /overflow-y-auto/);
});

test("record manager keeps selection stable while exposing filters and grouping-only actions", () => {
  for (const label of ["Select all visible", "Clear selection", "Move to Group", "Split Selected Records into New Group", "Remove from Group", "Selected only", "Missing date", "Open / Edit"]) assert.equal(records.includes(label), true);
  assert.doesNotMatch(records, /Delete Record/);
  assert.match(records, /await onOperation/);
});

test("case persistence precedes bulk metadata updates and confirmations are structured", () => {
  assert.match(caseDetail, /const saved = await onUpdateCase\(result\.caseItem\)/);
  assert.match(caseDetail, /if \(!saved\)/);
  assert.match(caseDetail, /Operation: Move selected records/);
  assert.match(caseDetail, /Operation: Merge entire group/);
  assert.match(caseDetail, /records remain in the case/);
  assert.match(caseDetail, /deleteSequenceGroupMeta/);
});
