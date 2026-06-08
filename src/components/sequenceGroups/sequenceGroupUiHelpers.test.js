import test from "node:test";
import assert from "node:assert/strict";
import {
  getRelationshipRelationLabel,
  getRelationshipWarningLabel,
  getSequenceRecordKey,
  getSequenceGroupStatus,
  getSequenceGroupStatusClasses,
  getTimelineTypeClasses,
  summarizeSequenceGroups,
  sequenceRecordMatchesSearch,
} from "./sequenceGroupUiHelpers.js";

test("sequence group UI helpers keep record keys and type classes stable", () => {
  assert.equal(getSequenceRecordKey({ recordType: "evidence", id: "ev-1" }), "evidence:ev-1");
  assert.equal(getTimelineTypeClasses("incidents"), "border-red-200 bg-red-50 text-red-700");
  assert.equal(getTimelineTypeClasses("evidence"), "border-lime-200 bg-lime-50 text-lime-700");
  assert.equal(getTimelineTypeClasses("documents"), "border-sky-200 bg-sky-50 text-sky-700");
  assert.equal(getTimelineTypeClasses("strategy"), "border-violet-200 bg-violet-50 text-violet-700");
  assert.equal(getTimelineTypeClasses("ledger"), "border-violet-200 bg-violet-50 text-violet-700");
});

test("sequence group UI helpers map relationship labels", () => {
  assert.equal(getRelationshipWarningLabel("incident_no_linked_evidence"), "No linked evidence");
  assert.equal(getRelationshipWarningLabel("unknown"), "Weak link");
  assert.equal(getRelationshipRelationLabel("incident_evidence"), "proves/supports");
  assert.equal(getRelationshipRelationLabel("other"), "linked record");
});

test("sequenceRecordMatchesSearch filters common display fields", () => {
  const record = { title: "Rent payment", summary: "Bank transfer", status: "open", date: "2026-05-10" };
  assert.equal(sequenceRecordMatchesSearch(record, ""), true);
  assert.equal(sequenceRecordMatchesSearch(record, "bank"), true);
  assert.equal(sequenceRecordMatchesSearch(record, "closed"), false);
});

test("sequence group UI helpers classify compact group statuses", () => {
  assert.equal(getSequenceGroupStatus({ totalCount: 0, warnings: {} }, 0), "empty");
  assert.equal(getSequenceGroupStatus({ totalCount: 3, warnings: {} }, 2), "weak proof");
  assert.equal(getSequenceGroupStatus({ totalCount: 3, warnings: { incidentsWithoutEvidence: true } }, 0), "needs review");
  assert.equal(getSequenceGroupStatus({ totalCount: 3, warnings: {} }, 0), "ready");
  assert.match(getSequenceGroupStatusClasses("ready"), /lime/);
  assert.match(getSequenceGroupStatusClasses("weak proof"), /amber/);
});

test("summarizeSequenceGroups returns compact manager metrics", () => {
  const summary = summarizeSequenceGroups([
    { totalCount: 2, warnings: {}, weakLinkCount: 0 },
    { totalCount: 1, warnings: { noIncidents: true }, weakLinkCount: 0 },
    { totalCount: 5, warnings: {}, weakLinkCount: 3 },
  ], 4, 3);

  assert.deepEqual(summary, {
    totalGroups: 3,
    groupsNeedingReview: 2,
    ungroupedRecords: 4,
    weakLinks: 3,
  });
});
