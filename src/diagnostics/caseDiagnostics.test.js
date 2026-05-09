import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeCaseDiagnostics,
  analyzeChronology,
  analyzeEvidenceCoverage,
  analyzeSequenceGroup,
} from "./caseDiagnostics.js";

function baseCase() {
  return {
    id: "case-1",
    name: "Diagnostics Case",
    incidents: [
      {
        id: "inc-1",
        title: "Reported leak",
        date: "2024-01-01",
        evidenceStatus: "needs_evidence",
        linkedEvidenceIds: ["ev-1"],
        sequenceGroup: "Leak thread",
      },
      {
        id: "inc-2",
        title: "Unsupported issue",
        evidenceStatus: "needs_evidence",
        sequenceGroup: "Leak thread",
      },
      {
        id: "inc-3",
        title: "Broken link issue",
        date: "2024-01-03",
        linkedEvidenceIds: ["missing-ev"],
      },
    ],
    evidence: [
      {
        id: "ev-1",
        title: "Leak photo",
        date: "2024-01-02",
        linkedIncidentIds: ["inc-1"],
        sequenceGroup: "Leak thread",
      },
      {
        id: "ev-2",
        title: "Unused receipt",
        date: "2024-01-04",
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Repair log",
        documentDate: "2024-01-05",
        sequenceGroup: "Leak thread",
        textContent: "[TRACK RECORD]\n--- SUMMARY (GPT READY) ---\nRepair log.",
        basedOnEvidenceIds: ["ev-1"],
      },
      {
        id: "doc-2",
        title: "No date document",
      },
    ],
    ledger: [
      {
        id: "ledger-1",
        label: "Repair cost",
        linkedRecordIds: ["doc-1"],
      },
    ],
    strategy: [
      {
        id: "str-1",
        title: "Reported leak",
        sequenceGroup: "Leak thread",
        status: "open",
      },
    ],
    tasks: [
      { id: "task-1", title: "Follow up", status: "open" },
    ],
  };
}

test("analyzeCaseDiagnostics detects orphan and broken link records", () => {
  const diagnostics = analyzeCaseDiagnostics(baseCase());

  assert.equal(diagnostics.integrity.brokenLinks.length, 1);
  assert.equal(diagnostics.integrity.brokenLinks[0].targetId, "missing-ev");
  assert.equal(
    diagnostics.integrity.orphanRecords.some((record) => record.id === "ev-2"),
    true
  );
});

test("analyzeEvidenceCoverage reports supported incidents and unused evidence", () => {
  const coverage = analyzeEvidenceCoverage(baseCase());

  assert.equal(coverage.incidentEvidenceCounts["inc-1"], 2);
  assert.equal(
    coverage.incidentsNeedingEvidence.some((record) => record.id === "inc-2"),
    true
  );
  assert.deepEqual(coverage.unusedEvidence.map((record) => record.id), ["ev-2"]);
  assert.equal(coverage.trackingRecordProvenance[0].document.id, "doc-1");
});

test("analyzeChronology reports missing chronology dates", () => {
  const chronology = analyzeChronology(baseCase());

  assert.equal(
    chronology.missingDateRecords.some((record) => record.id === "doc-2"),
    true
  );
  assert.equal(chronology.firstDate, "2024-01-01");
  assert.equal(chronology.lastDate, "2024-01-05");
});

test("analyzeSequenceGroup groups supported record types", () => {
  const allGroups = analyzeSequenceGroup(baseCase());
  const group = analyzeSequenceGroup(baseCase(), "Leak thread");

  assert.equal(allGroups.groups.length, 1);
  assert.equal(group.totalCount, 5);
  assert.equal(group.counts.incident, 2);
  assert.equal(group.counts.evidence, 1);
  assert.equal(group.counts.tracking_record, 1);
  assert.equal(group.counts.strategy, 1);
});

test("analyzeCaseDiagnostics reports duplicate title suspicion", () => {
  const diagnostics = analyzeCaseDiagnostics(baseCase());

  assert.equal(diagnostics.duplicates.titleSuspicions.length, 1);
  assert.equal(diagnostics.duplicates.titleSuspicions[0].normalizedTitle, "reported leak");
});

test("analyzeCaseDiagnostics output has stable top-level structure", () => {
  const diagnostics = analyzeCaseDiagnostics(baseCase());

  assert.deepEqual(Object.keys(diagnostics), [
    "overview",
    "integrity",
    "evidenceCoverage",
    "chronology",
    "sequenceGroups",
    "duplicates",
    "openIssues",
    "milestoneCoverage",
    "risks",
    "warnings",
    "suggestions",
  ]);
  assert.equal(Object.hasOwn(diagnostics, "exportedAt"), false);
  assert.equal(diagnostics.overview.caseId, "case-1");
});
