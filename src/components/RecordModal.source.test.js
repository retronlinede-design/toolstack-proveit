import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/RecordModal.jsx", "utf8");

test("incident modal unlinks evidence from local form state before save", () => {
  assert.match(source, /const unlinkEvidenceFromIncidentForm = \(evidenceId\) =>/);
  assert.match(source, /linkedEvidenceIds: nextLinkedEvidenceIds/);
  assert.match(source, /evidenceStatus: recordType === "incidents" && nextLinkedEvidenceIds\.length === 0/);
  assert.match(source, /onClick=\{\(\) => unlinkEvidenceFromIncidentForm\(evidenceItem\.id\)\}/);
  assert.doesNotMatch(source, /onClick=\{\(\) => onUnlinkEvidenceFromIncident\(recordForm\.id, evidenceItem\.id\)\}/);
});

test("incident modal renders linked parties selector from case parties", () => {
  assert.match(source, /caseParties = \[\]/);
  assert.match(source, /\{recordType === "incidents" && \(\s*<LinkedPartiesSelector/);
  assert.match(source, /parties=\{caseParties\}/);
  assert.match(source, /linkedPartyIds=\{recordForm\.linkedPartyIds\}/);
  assert.match(source, /setRecordForm\(\(prev\) => \(\{ \.\.\.prev, linkedPartyIds \}\)\)/);
});

test("evidence modal renders linked parties selector from case parties", () => {
  assert.match(source, /\{recordType === "evidence" && \(\s*<LinkedPartiesSelector/);
  assert.match(source, /parties=\{caseParties\}/);
  assert.match(source, /linkedPartyIds=\{recordForm\.linkedPartyIds\}/);
});

test("record editors use Issue terminology and explain the record choice", () => {
  assert.match(source, />Issue<\/label>/);
  assert.match(source, /Assign this record to the Issue or case thread it belongs to\./);
  assert.match(source, /Record something that happened\./);
  assert.match(source, /Record material that supports or challenges a point\./);
  assert.match(source, /considered approach, position, risks, and planned response/);
});
