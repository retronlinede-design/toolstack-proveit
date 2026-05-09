import test from "node:test";
import assert from "node:assert/strict";

import { THREAD_ISSUE_REPORT, buildThreadIssueReport } from "./reportBuilder.js";

function buildCase() {
  return {
    id: "case-1",
    name: "Demo Case",
    category: "Housing",
    status: "active",
    actionSummary: {
      nextActions: ["Leak thread: request repair log", "Unrelated next step"],
      criticalDeadlines: ["Leak thread deadline: 2024-02-20"],
    },
    incidents: [
      {
        id: "inc-1",
        title: "Leak reported",
        date: "2024-01-05",
        eventDate: "2024-01-05",
        status: "open",
        evidenceStatus: "needs_evidence",
        description: "Water leaked through ceiling.",
        sequenceGroup: "Leak thread",
        linkedEvidenceIds: ["ev-1"],
        linkedRecordIds: ["doc-1"],
      },
      {
        id: "inc-2",
        title: "Different problem",
        date: "2024-01-02",
        sequenceGroup: "Noise thread",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        title: "Ceiling photo",
        capturedAt: "2024-01-06",
        status: "verified",
        evidenceRole: "ANCHOR_EVIDENCE",
        functionSummary: "Shows water damage after the leak.",
        linkedIncidentIds: ["inc-1"],
        attachments: [{ id: "att-1", name: "ceiling.jpg", dataUrl: "data:image/jpeg;base64,abc" }],
      },
      {
        id: "ev-2",
        title: "Noise recording",
        date: "2024-01-03",
        sequenceGroup: "Noise thread",
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Repair email",
        documentDate: "2024-01-07",
        category: "email",
        summary: "Landlord acknowledges repair request.",
        sequenceGroup: "Other thread",
        linkedRecordIds: ["inc-1"],
      },
      {
        id: "doc-2",
        title: "Unrelated document",
        documentDate: "2024-01-01",
        sequenceGroup: "Other thread",
      },
    ],
    strategy: [
      {
        id: "str-1",
        title: "Ask for timeline?",
        date: "2024-01-08",
        status: "open",
        notes: "Confirm when repairs were promised?",
        sequenceGroup: "Leak thread",
      },
    ],
    ledger: [
      {
        id: "led-1",
        label: "Repair cost estimate",
        period: "2024-01",
        expectedAmount: 200,
        paidAmount: 0,
        status: "unpaid",
        linkedRecordIds: ["doc-1"],
      },
      {
        id: "led-2",
        label: "Unrelated bill",
        period: "2024-01",
        linkedRecordIds: ["inc-2"],
      },
    ],
  };
}

test("buildThreadIssueReport builds a structured report for a sequenceGroup", () => {
  const report = buildThreadIssueReport(buildCase(), "Leak thread", {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.reportType, THREAD_ISSUE_REPORT);
  assert.equal(report.title, "Thread / Issue Report: Leak thread");
  assert.equal(report.audience, "general");
  assert.equal(report.scopeType, "sequenceGroup");
  assert.equal(report.sequenceGroup, "Leak thread");
  assert.equal(report.sourceCaseId, "case-1");
  assert.equal(report.generatedAt, "2024-02-01T00:00:00.000Z");
  assert.deepEqual(report.caseOverview, {
    name: "Demo Case",
    category: "Housing",
    status: "active",
  });
  assert.equal(report.threadSummary.incidentCount, 1);
  assert.equal(report.threadSummary.evidenceCount, 1);
  assert.equal(report.threadSummary.documentCount, 1);
  assert.equal(report.threadSummary.strategyCount, 1);
  assert.equal(report.threadSummary.ledgerCount, 1);
  assert.deepEqual(report.atAGlance, {
    incidentCount: 1,
    evidenceCount: 1,
    documentCount: 1,
    ledgerCount: 1,
    openUnsupportedIncidentCount: 0,
    keyDiagnosticWarningCount: report.diagnosticsSummary.warningCount,
  });
  assert.equal(report.scopeSummary, 'Records in sequenceGroup "Leak thread" plus directly linked records.');
});

test("buildThreadIssueReport includes matching sequenceGroup records plus directly linked records", () => {
  const report = buildThreadIssueReport(buildCase(), "Leak thread", {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.deepEqual(new Set(report.includedRecordIds), new Set(["inc-1", "ev-1", "doc-1", "str-1", "led-1"]));
  assert.deepEqual(report.incidents.map((item) => item.id), ["inc-1"]);
  assert.deepEqual(report.evidence.map((item) => item.id), ["ev-1"]);
  assert.deepEqual(report.documents.map((item) => item.id), ["doc-1"]);
  assert.deepEqual(report.ledger.map((item) => item.id), ["led-1"]);
});

test("buildThreadIssueReport sorts chronology by date with missing dates last", () => {
  const report = buildThreadIssueReport(buildCase(), "Leak thread", {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.deepEqual(report.chronology.map((item) => item.id), ["led-1", "inc-1", "ev-1", "doc-1", "str-1"]);
});

test("buildThreadIssueReport groups chronology by date and separates undated records", () => {
  const caseItem = buildCase();
  caseItem.evidence.push({
    id: "ev-3",
    title: "Undated leak note",
    sequenceGroup: "Leak thread",
    functionSummary: "Undated note about the leak.",
  });

  const report = buildThreadIssueReport(caseItem, "Leak thread", {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.deepEqual(report.chronologyGroups.map((group) => group.date), ["2024-01", "2024-01-05", "2024-01-06", "2024-01-07", "2024-01-08"]);
  assert.deepEqual(report.undatedChronology.map((item) => item.id), ["ev-3"]);
});

test("buildThreadIssueReport populates report sections with linked labels and attachment metadata", () => {
  const report = buildThreadIssueReport(buildCase(), "Leak thread", {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.deepEqual(report.incidents[0].linkedEvidenceTitles, ["Ceiling photo"]);
  assert.equal(report.incidents[0].isMilestone, false);
  assert.equal(report.incidents[0].sequenceGroup, "Leak thread");
  assert.deepEqual(report.evidence[0].linkedIncidentTitles, ["Leak reported"]);
  assert.deepEqual(report.evidenceMatrix[0].linkedIncidentTitles, ["Leak reported"]);
  assert.deepEqual(report.evidence[0].attachmentNames, ["ceiling.jpg"]);
  assert.equal(report.evidence[0].attachmentCount, 1);
  assert.deepEqual(report.documents[0].linkedRecords.map((item) => item.title), ["Leak reported"]);
  assert.equal(report.ledger[0].differenceAmount, 200);
});

test("buildThreadIssueReport includes diagnostics and deterministic actions", () => {
  const report = buildThreadIssueReport(buildCase(), "Leak thread", {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.diagnostics.sequenceGroup.name, "Leak thread");
  assert.equal(report.diagnosticsSummary.unsupportedIncidentCount, 0);
  assert.equal(typeof report.diagnosticsSummary.warningCount, "number");
  assert.ok(Array.isArray(report.diagnostics.warnings));
  assert.ok(Array.isArray(report.diagnostics.suggestions));
  assert.deepEqual(report.openQuestions.map((item) => item.id), ["str-1"]);
  assert.deepEqual(report.nextActions.map((item) => item.source), ["strategy", "actionSummary", "actionSummary"]);
});

test("buildThreadIssueReport handles empty or missing sequenceGroup gracefully", () => {
  const report = buildThreadIssueReport(buildCase(), "   ", {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.sequenceGroup, "");
  assert.deepEqual(report.includedRecordIds, []);
  assert.equal(report.threadSummary.incidentCount, 0);
  assert.equal(report.chronology.length, 0);
  assert.ok(report.diagnostics.warnings.some((warning) => warning.id === "missing-sequence-group"));
});
