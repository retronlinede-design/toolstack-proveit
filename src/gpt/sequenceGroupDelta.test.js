import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceGroupReviewPackage,
  ingestSequenceGroupDelta,
  SEQUENCE_GROUP_DELTA_CONTRACT_VERSION,
} from "./sequenceGroupDelta.js";

function makeCase() {
  return {
    id: "case-1",
    name: "Test Case",
    incidents: [
      {
        id: "inc-1",
        title: "Leak incident",
        eventDate: "2024-01-01",
        status: "open",
        description: "Water entered the flat.",
        sequenceGroup: "Leak",
        linkedEvidenceIds: ["ev-1"],
        createdAt: "inc-created",
      },
      {
        id: "inc-2",
        title: "Repair incident",
        sequenceGroup: "Repair",
        createdAt: "inc2-created",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        title: "Leak photo",
        capturedAt: "2024-01-02",
        status: "verified",
        functionSummary: "Shows water damage.",
        sequenceGroup: "Leak",
        linkedIncidentIds: ["inc-1"],
        attachments: [{ id: "att-1", name: "photo.png", dataUrl: "data:image/png;base64,SECRET_BINARY" }],
        createdAt: "ev-created",
      },
      {
        id: "ev-2",
        title: "Ungrouped note",
        functionSummary: "Needs grouping.",
        sequenceGroup: "",
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Landlord email",
        documentDate: "2024-01-03",
        summary: "Email about repair.",
        textContent: "FULL DOCUMENT TEXT SHOULD NOT BE INCLUDED",
        sequenceGroup: "Repair",
        linkedRecordIds: ["inc-2"],
        basedOnEvidenceIds: ["ev-1"],
        attachments: [{ id: "att-2", name: "email.eml", bytes: "SECRET_BYTES" }],
        createdAt: "doc-created",
      },
    ],
    strategy: [
      {
        id: "str-1",
        title: "Escalation plan",
        date: "2024-01-04",
        notes: "Use evidence to request repairs.",
        sequenceGroup: "Leak",
        linkedRecordIds: ["inc-1", "ev-1"],
        createdAt: "str-created",
      },
    ],
    ledger: [
      { id: "ledger-1", sequenceGroup: "Ignored" },
    ],
  };
}

function makeDelta(operations, caseId = "AUTO") {
  return {
    app: "proveit",
    contractVersion: SEQUENCE_GROUP_DELTA_CONTRACT_VERSION,
    target: { caseId },
    operations,
  };
}

test("buildSequenceGroupReviewPackage includes groups and ungrouped records without binary or full text", () => {
  const reviewPackage = buildSequenceGroupReviewPackage(makeCase(), {
    exportedAt: "2026-05-10T00:00:00.000Z",
  });
  const serialized = JSON.stringify(reviewPackage);

  assert.equal(reviewPackage.exportType, "SEQUENCE_GROUP_REVIEW_PACKAGE");
  assert.equal(reviewPackage.contractVersion, "1.0");
  assert.deepEqual(reviewPackage.groups.map((group) => group.name), ["Leak", "Repair"]);
  assert.deepEqual(reviewPackage.groups.find((group) => group.name === "Leak").counts, {
    incidents: 1,
    evidence: 1,
    documents: 0,
    strategy: 1,
  });
  assert.deepEqual(reviewPackage.ungroupedRecords.map((record) => record.id), ["ev-2"]);
  assert.deepEqual(
    reviewPackage.groups.find((group) => group.name === "Leak").records.find((record) => record.id === "ev-1").linkedIncidentIds,
    ["inc-1"],
  );
  assert.ok(!serialized.includes("SECRET_BINARY"));
  assert.ok(!serialized.includes("SECRET_BYTES"));
  assert.ok(!serialized.includes("FULL DOCUMENT TEXT SHOULD NOT BE INCLUDED"));
});

test("valid moveRecords delta applies", () => {
  const result = ingestSequenceGroupDelta(makeDelta({
    moveRecords: [{ recordType: "incidents", recordId: "inc-2", targetGroup: "Leak" }],
  }), makeCase(), { apply: true });

  assert.equal(result.ok, true);
  assert.equal(result.updatedCase.incidents.find((record) => record.id === "inc-2").sequenceGroup, "Leak");
  assert.equal(result.updatedCase.incidents.find((record) => record.id === "inc-2").createdAt, "inc2-created");
  assert.equal(result.preview.moveRecords[0].fromGroup, "Repair");
});

test("valid renameGroups delta applies", () => {
  const result = ingestSequenceGroupDelta(makeDelta({
    renameGroups: [{ fromGroup: "Leak", toGroup: "Water Leak" }],
  }), makeCase(), { apply: true });

  assert.equal(result.ok, true);
  assert.equal(result.updatedCase.incidents.find((record) => record.id === "inc-1").sequenceGroup, "Water Leak");
  assert.equal(result.updatedCase.evidence.find((record) => record.id === "ev-1").sequenceGroup, "Water Leak");
  assert.equal(result.updatedCase.strategy.find((record) => record.id === "str-1").sequenceGroup, "Water Leak");
});

test("valid mergeGroups delta applies", () => {
  const result = ingestSequenceGroupDelta(makeDelta({
    mergeGroups: [{ fromGroup: "Repair", toGroup: "Leak" }],
  }), makeCase(), { apply: true });

  assert.equal(result.ok, true);
  assert.equal(result.updatedCase.incidents.find((record) => record.id === "inc-2").sequenceGroup, "Leak");
  assert.equal(result.updatedCase.documents.find((record) => record.id === "doc-1").sequenceGroup, "Leak");
});

test("valid clearRecords delta applies", () => {
  const result = ingestSequenceGroupDelta(makeDelta({
    clearRecords: [{ recordType: "evidence", recordId: "ev-1" }],
  }), makeCase(), { apply: true });

  assert.equal(result.ok, true);
  assert.equal(result.updatedCase.evidence.find((record) => record.id === "ev-1").sequenceGroup, "");
});

test("invalid record ID is rejected", () => {
  const result = ingestSequenceGroupDelta(makeDelta({
    moveRecords: [{ recordType: "incidents", recordId: "missing", targetGroup: "Leak" }],
  }), makeCase());

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown incidents record "missing"/);
});

test("invalid group is rejected for merge and rename sources", () => {
  const result = ingestSequenceGroupDelta(makeDelta({
    renameGroups: [{ fromGroup: "Missing", toGroup: "New" }],
    mergeGroups: [{ fromGroup: "Repair", toGroup: "Missing" }],
  }), makeCase());

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /fromGroup "Missing" does not exist/);
  assert.match(result.errors.join("\n"), /toGroup "Missing" does not exist/);
});

test("unknown operation is rejected", () => {
  const result = ingestSequenceGroupDelta(makeDelta({
    deleteRecords: [{ recordType: "incidents", recordId: "inc-1" }],
  }), makeCase());

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Unsupported field at delta\.operations\.deleteRecords/);
});

test("unknown fields are rejected", () => {
  const result = ingestSequenceGroupDelta({
    ...makeDelta({
      moveRecords: [{ recordType: "incidents", recordId: "inc-1", targetGroup: "Leak", note: "Nope" }],
    }),
    backupData: {},
  }, makeCase());

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Unsupported field at delta\.backupData/);
  assert.match(result.errors.join("\n"), /Unsupported field at operations\.moveRecords\[0\]\.note/);
});

test("AUTO caseId is accepted and mismatched caseId is rejected", () => {
  const autoResult = ingestSequenceGroupDelta(makeDelta({
    clearRecords: [{ recordType: "strategy", recordId: "str-1" }],
  }, "AUTO"), makeCase());
  const mismatchResult = ingestSequenceGroupDelta(makeDelta({
    clearRecords: [{ recordType: "strategy", recordId: "str-1" }],
  }, "other-case"), makeCase());

  assert.equal(autoResult.ok, true);
  assert.equal(mismatchResult.ok, false);
  assert.match(mismatchResult.errors.join("\n"), /does not match selected case/);
});

test("duplicate conflicting operations are rejected", () => {
  const result = ingestSequenceGroupDelta(makeDelta({
    moveRecords: [
      { recordType: "incidents", recordId: "inc-1", targetGroup: "Leak" },
      { recordType: "incidents", recordId: "inc-1", targetGroup: "Repair" },
    ],
    clearRecords: [{ recordType: "incidents", recordId: "inc-1" }],
  }), makeCase());

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /conflicts with another operation/);
  assert.match(result.errors.join("\n"), /conflicts with a move operation/);
});
