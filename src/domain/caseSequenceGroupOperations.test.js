import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeCaseSequenceGroupsWithStats,
  moveCaseSequenceGroupRecords,
  removeCaseSequenceGroupRecords,
  splitCaseSequenceGroup,
} from "./caseDomain.js";

const buildCase = () => ({
  id: "case-1",
  incidents: [{ id: "i1", title: "Incident", sequenceGroup: "A", attachments: [{ id: "a1" }], linkedEvidenceIds: ["e1"] }],
  evidence: [{ id: "e1", title: "Evidence", sequenceGroup: "A", content: "unchanged" }],
  documents: [{ id: "d1", title: "Document", sequenceGroup: "A", fileName: "proof.pdf" }],
  strategy: [{ id: "s1", title: "Strategy", sequenceGroup: "B", priority: "high" }],
  watchItems: [{ id: "w1", title: "Watch", sequenceGroup: "A", status: "active" }],
  ledger: [{ id: "l1", sequenceGroup: "A", amount: 10 }],
});

test("moves selected mixed records immutably and preserves unrelated data", () => {
  const original = buildCase();
  const result = moveCaseSequenceGroupRecords({ caseData: original, sourceGroup: "A", destinationGroup: "B", recordRefs: [{ recordType: "incidents", recordId: "i1" }, { recordType: "watchItems", recordId: "w1" }] });
  assert.equal(result.success, true);
  assert.equal(result.affectedCount, 2);
  assert.equal(result.caseItem.incidents[0].sequenceGroup, "B");
  assert.deepEqual(result.caseItem.incidents[0].attachments, [{ id: "a1" }]);
  assert.deepEqual(result.caseItem.incidents[0].linkedEvidenceIds, ["e1"]);
  assert.equal(result.caseItem.evidence[0].sequenceGroup, "A");
  assert.deepEqual(result.caseItem.ledger, original.ledger);
  assert.equal(original.incidents[0].sequenceGroup, "A");
});

test("rejects a stale record reference without partially updating the case", () => {
  const original = buildCase();
  const result = moveCaseSequenceGroupRecords({ caseData: original, sourceGroup: "A", destinationGroup: "B", recordRefs: [{ recordType: "evidence", recordId: "e1" }, { recordType: "documents", recordId: "missing" }] });
  assert.equal(result.success, false);
  assert.equal(result.caseItem, original);
  assert.equal(result.affectedCount, 0);
  assert.match(result.errors[0], /not found/);
});

test("deduplicates references and blocks source as destination", () => {
  const original = buildCase();
  const ref = { recordType: "evidence", recordId: "e1" };
  const moved = moveCaseSequenceGroupRecords({ caseData: original, sourceGroup: "A", destinationGroup: "B", recordRefs: [ref, ref] });
  assert.equal(moved.affectedCount, 1);
  const blocked = moveCaseSequenceGroupRecords({ caseData: original, sourceGroup: "A", destinationGroup: "A", recordRefs: [ref] });
  assert.equal(blocked.success, false);
  assert.equal(blocked.caseItem, original);
});

test("removes selected assignments without deleting records", () => {
  const original = buildCase();
  const result = removeCaseSequenceGroupRecords({ caseData: original, groupName: "A", recordRefs: [{ recordType: "documents", recordId: "d1" }] });
  assert.equal(result.success, true);
  assert.equal(result.caseItem.documents.length, 1);
  assert.equal(result.caseItem.documents[0].sequenceGroup, "");
  assert.equal(result.caseItem.documents[0].fileName, "proof.pdf");
});

test("split moves only selected records and leaves the source intact", () => {
  const result = splitCaseSequenceGroup({ caseData: buildCase(), sourceGroup: "A", destinationGroup: "C", recordRefs: [{ recordType: "evidence", recordId: "e1" }] });
  assert.equal(result.caseItem.evidence[0].sequenceGroup, "C");
  assert.equal(result.caseItem.incidents[0].sequenceGroup, "A");
});

test("merge moves every registered source record and leaves Ledger untouched", () => {
  const original = buildCase();
  const result = mergeCaseSequenceGroupsWithStats({ caseData: original, sourceGroup: "A", destinationGroup: "B" });
  assert.equal(result.success, true);
  assert.equal(result.affectedCount, 4);
  for (const type of ["incidents", "evidence", "documents", "watchItems"]) assert.equal(result.caseItem[type][0].sequenceGroup, "B");
  assert.equal(result.caseItem.strategy[0].sequenceGroup, "B");
  assert.deepEqual(result.caseItem.ledger, original.ledger);
});

test("metadata-only empty groups can merge without changing case data", () => {
  const original = buildCase();
  const result = mergeCaseSequenceGroupsWithStats({ caseData: original, sourceGroup: "Empty", destinationGroup: "B" });
  assert.equal(result.success, true);
  assert.equal(result.affectedCount, 0);
  assert.equal(result.caseItem, original);
});
