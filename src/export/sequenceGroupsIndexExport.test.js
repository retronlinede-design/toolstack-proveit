import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSequenceGroupsIndexReport,
  exportSequenceGroupsIndexJson,
  exportSequenceGroupsIndexMarkdown,
} from "./sequenceGroupsIndexExport.js";

function buildIndexCase() {
  return {
    id: "case-index-1",
    name: "Index case",
    reference: "REF-001",
    status: "open",
    incidents: [
      {
        id: "inc-1",
        title: "Mould found",
        date: "2024-01-02",
        eventDate: "2024-01-02",
        status: "open",
        evidenceStatus: "needs_evidence",
        sequenceGroup: "Mould chain",
        isMilestone: true,
        linkedEvidenceIds: [],
        linkedRecordIds: ["doc-1"],
      },
      {
        id: "inc-2",
        title: "Rent issue",
        date: "2024-02-01",
        eventDate: "2024-02-01",
        status: "open",
        evidenceStatus: "documented",
        sequenceGroup: "Rent chain",
        linkedEvidenceIds: ["ev-2"],
      },
      {
        id: "inc-ungrouped",
        title: "Ungrouped incident",
        date: "2024-03-01",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        title: "Photo",
        date: "2024-01-03",
        status: "verified",
        sequenceGroup: "Mould chain",
        linkedIncidentIds: ["inc-1"],
      },
      {
        id: "ev-2",
        title: "Receipt",
        date: "2024-02-02",
        status: "verified",
        sequenceGroup: "Rent chain",
        linkedIncidentIds: ["inc-2"],
      },
      {
        id: "ev-ungrouped",
        title: "Loose evidence",
        date: "2024-04-01",
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Inspection email",
        documentDate: "2024-01-04",
        sequenceGroup: "Mould chain",
        linkedRecordIds: ["inc-1"],
        attachments: [{ dataUrl: "data:image/png;base64,abc" }],
      },
    ],
    strategy: [
      {
        id: "str-1",
        title: "Prepare repair escalation",
        date: "2024-01-05",
        sequenceGroup: "Mould chain",
      },
    ],
  };
}

test("buildSequenceGroupsIndexReport exports all groups", () => {
  const report = buildSequenceGroupsIndexReport(buildIndexCase());

  assert.deepEqual(report.sequenceGroups.map((group) => group.name), ["Mould chain", "Rent chain"]);
});

test("buildSequenceGroupsIndexReport includes counts", () => {
  const report = buildSequenceGroupsIndexReport(buildIndexCase());
  const mould = report.sequenceGroups.find((group) => group.name === "Mould chain");

  assert.equal(report.totals.sequenceGroupCount, 2);
  assert.equal(report.totals.groupedRecordCount, 6);
  assert.equal(mould.counts.incidents, 1);
  assert.equal(mould.counts.evidence, 1);
  assert.equal(mould.counts.documents, 1);
  assert.equal(mould.counts.strategy, 1);
});

test("buildSequenceGroupsIndexReport includes ungrouped summary", () => {
  const report = buildSequenceGroupsIndexReport(buildIndexCase());

  assert.equal(report.ungroupedSummary.counts.total, 2);
  assert.equal(report.ungroupedSummary.counts.incidents, 1);
  assert.equal(report.ungroupedSummary.counts.evidence, 1);
  assert.deepEqual(report.ungroupedSummary.sampleRecords.map((record) => record.id), ["inc-ungrouped", "ev-ungrouped"]);
});

test("exportSequenceGroupsIndexJson is valid compact JSON", () => {
  const payload = exportSequenceGroupsIndexJson(buildIndexCase());
  const parsed = JSON.parse(JSON.stringify(payload));

  assert.equal(parsed.exportType, "SEQUENCE_GROUPS_INDEX_REPORT");
  assert.equal(parsed.schemaVersion, "1.0");
  assert.equal(parsed.importable, false);
  assert.equal(JSON.stringify(parsed).includes("data:image/png;base64"), false);
  assert.equal(parsed.gptPromptBlock.includes("recommend which chains should be audited first"), true);
});

test("exportSequenceGroupsIndexMarkdown includes group names", () => {
  const markdown = exportSequenceGroupsIndexMarkdown(buildIndexCase());

  assert.match(markdown, /# Sequence Groups Index Report/);
  assert.match(markdown, /### Mould chain/);
  assert.match(markdown, /### Rent chain/);
  assert.match(markdown, /## Ungrouped Records/);
});
