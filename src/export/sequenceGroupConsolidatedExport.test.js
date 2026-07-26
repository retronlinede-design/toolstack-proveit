import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAllSequenceGroupAuditsExport,
  buildCaseBySequenceGroupsExport,
  exportAllSequenceGroupAuditsMarkdown,
  exportCaseBySequenceGroupsMarkdown,
} from "./sequenceGroupConsolidatedExport.js";

function buildCase() {
  return {
    id: "case-42",
    name: "North / South Review",
    reference: "REF-42",
    description: "A complete test case.",
    incidents: [
      { id: "inc-b", title: "Later incident", eventDate: "2026-03-02", sequenceGroup: "Group B" },
      { id: "inc-a2", title: "Second incident", eventDate: "2026-02-01", sequenceGroup: "Group A" },
      { id: "inc-a1", title: "First incident", eventDate: "2026-01-01", sequenceGroup: "Group A", linkedEvidenceIds: ["missing-evidence"], linkedPartyIds: ["missing-party"] },
      { id: "inc-free", title: "Ungrouped incident", eventDate: "2025-12-01" },
    ],
    evidence: [
      { id: "ev-a", title: "Photograph", date: "2026-01-02", sequenceGroup: "Group A", attachments: [{ id: "att-1", name: "photo.jpg", type: "image/jpeg", size: 1234, data: "binary-data", blob: { unexpected: true } }] },
      { id: "ev-free", title: "Ungrouped note", date: "2026-04-01" },
    ],
    documents: [{ id: "doc-a", title: "Contract", documentDate: "2026-01-03", sequenceGroup: "Group A" }],
    strategy: [{ id: "str-a", title: "Interview plan", createdAt: "2026-01-04", sequenceGroup: "Group A" }],
    watchItems: [{ id: "watch-a", title: "Deadline", date: "2026-01-05", sequenceGroup: "Group A" }],
    parties: [{ id: "party-known", name: "Known Party" }],
  };
}

const meta = {
  "Group A": { description: "Primary chronology." },
  "Empty Group": { description: "Metadata retained without records." },
};

test("all-group audit export includes populated and metadata-only groups in manager order", () => {
  const source = buildCase();
  const before = structuredClone(source);
  const report = buildAllSequenceGroupAuditsExport(source, { sequenceGroupMeta: meta });

  assert.deepEqual(report.audits.map((group) => group.name), ["Empty Group", "Group A", "Group B"]);
  assert.equal(report.totals.sequenceGroups, 3);
  assert.equal(report.totals.groupedRecords, 7);
  assert.equal(report.audits[0].state, "metadata-only");
  assert.equal(report.audits[0].description, "Metadata retained without records.");
  assert.equal(report.audits[1].recordCount, 6);
  assert.equal(typeof report.audits[1].audit.diagnostics, "object");
  assert.equal(report.audits[1].records.length, 6);
  assert.deepEqual(source, before, "export assembly must not mutate case data");
});

test("all-group audit export handles a case with no groups", () => {
  const report = buildAllSequenceGroupAuditsExport({ id: "empty", incidents: [] });
  assert.equal(report.totals.sequenceGroups, 0);
  assert.deepEqual(report.audits, []);
});

test("full-case export includes grouped, ungrouped, diagnostics and deterministic chronology", () => {
  const report = buildCaseBySequenceGroupsExport(buildCase(), { sequenceGroupMeta: meta });
  const groupA = report.sequenceGroups.find((group) => group.name === "Group A");

  assert.equal(report.case.reference, "REF-42");
  assert.deepEqual(report.sequenceGroups.map((group) => group.name), ["Empty Group", "Group A", "Group B"]);
  assert.deepEqual(groupA.records.slice(0, 2).map((record) => record.id), ["inc-a1", "ev-a"]);
  assert.equal(report.ungroupedRecords.incidents[0].id, "inc-free");
  assert.equal(report.ungroupedRecords.evidence[0].id, "ev-free");
  assert.equal(report.totals.uniqueRecords, 9);
  assert.equal(report.totals.groupedRecordAppearances, 7);
  assert.equal(report.totals.ungroupedRecords, 2);
  assert.deepEqual(report.unresolvedReferences.map((item) => item.kind).sort(), ["party", "record"]);
});

test("full-case export retains only attachment metadata and tolerates missing fields", () => {
  const report = buildCaseBySequenceGroupsExport(buildCase(), { sequenceGroupMeta: meta });
  const attachment = report.sequenceGroups.find((group) => group.name === "Group A").records.find((record) => record.id === "ev-a").attachments[0];

  assert.deepEqual(attachment, { id: "att-1", name: "photo.jpg", type: "image/jpeg", size: 1234 });
  assert.equal(JSON.stringify(report).includes("binary-data"), false);
  assert.doesNotThrow(() => buildCaseBySequenceGroupsExport({ id: "minimal", incidents: [{ id: "one", sequenceGroup: "Only" }] }));
});

test("human-readable exports identify all groups, ungrouped records and missing references", () => {
  const allMarkdown = exportAllSequenceGroupAuditsMarkdown(buildCase(), { sequenceGroupMeta: meta });
  const fullMarkdown = exportCaseBySequenceGroupsMarkdown(buildCase(), { sequenceGroupMeta: meta });

  assert.match(allMarkdown, /# All Sequence Group Audits/);
  assert.match(allMarkdown, /## Empty Group/);
  assert.match(fullMarkdown, /# Full Case by Sequence Groups/);
  assert.match(fullMarkdown, /## Ungrouped Records/);
  assert.match(fullMarkdown, /Ungrouped incident/);
  assert.match(fullMarkdown, /## Unresolved and Missing References/);
});
