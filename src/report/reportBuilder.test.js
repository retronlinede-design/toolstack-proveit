import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE_BUNDLE_REPORT,
  DOCUMENT_PACK_REPORT,
  EVIDENCE_PACK_REPORT,
  EXECUTIVE_SUMMARY_REPORT,
  LEDGER_PACK_REPORT,
  THREAD_ISSUE_REPORT,
  buildCaseBundleReport,
  buildDocumentPackReport,
  buildEvidencePackReport,
  buildExecutiveSummaryReport,
  buildLedgerPackReport,
  buildThreadIssueReport,
} from "./reportBuilder.js";

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
        textContent: "The landlord acknowledged the repair request and promised a contractor visit.",
        sequenceGroup: "Other thread",
        linkedRecordIds: ["inc-1", "ev-1", "str-1"],
        attachments: [{ id: "doc-att-1", name: "repair-email.pdf", type: "application/pdf", size: 1234, dataUrl: "data:application/pdf;base64,abc" }],
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
        subType: "repair_cost",
        method: "bank transfer",
        reference: "REF-001",
        proofType: "invoice",
        proofStatus: "verified",
        batchLabel: "repairs",
        status: "unpaid",
        linkedRecordIds: ["doc-1", "ev-1"],
      },
      {
        id: "led-2",
        label: "Unrelated bill",
        period: "2024-01",
        linkedRecordIds: ["inc-2"],
      },
      {
        id: "led-3",
        label: "Refund credit",
        period: "2024-02",
        paidAmount: 50,
        category: "refund",
        subType: "credit",
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
  assert.deepEqual(report.documents[0].linkedRecords.map((item) => item.title), ["Leak reported", "Ceiling photo", "Ask for timeline?"]);
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

test("buildExecutiveSummaryReport builds high-level case summary sections", () => {
  const caseItem = buildCase();
  caseItem.description = "A concise case description.";
  caseItem.createdAt = "2024-01-01T00:00:00.000Z";
  caseItem.updatedAt = "2024-02-01T00:00:00.000Z";
  caseItem.actionSummary.currentFocus = "Get the leak repair confirmed.";

  const report = buildExecutiveSummaryReport(caseItem, {
    generatedAt: "2024-02-02T00:00:00.000Z",
  });

  assert.equal(report.reportType, EXECUTIVE_SUMMARY_REPORT);
  assert.equal(report.title, "Executive Summary");
  assert.equal(report.sourceCaseId, "case-1");
  assert.deepEqual(report.caseOverview, {
    name: "Demo Case",
    category: "Housing",
    status: "active",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-02-01T00:00:00.000Z",
    description: "A concise case description.",
  });
  assert.equal(report.currentPosition.operationalSummary, "Get the leak repair confirmed.");
  assert.equal(report.atAGlance.incidentCount, 2);
  assert.equal(report.atAGlance.evidenceCount, 2);
  assert.equal(report.atAGlance.documentCount, 2);
  assert.equal(report.atAGlance.sequenceGroupCount, 3);
  assert.ok(report.atAGlance.openIssueCount > 0);
});

test("buildExecutiveSummaryReport sorts key chronology newest first with undated deadlines last", () => {
  const caseItem = buildCase();
  caseItem.incidents[0].isMilestone = true;
  caseItem.incidents.push({
    id: "inc-3",
    title: "Latest incident",
    eventDate: "2024-02-01",
    sequenceGroup: "Leak thread",
  });

  const report = buildExecutiveSummaryReport(caseItem, {
    generatedAt: "2024-02-02T00:00:00.000Z",
  });

  assert.equal(report.keyTimeline[0].id, "inc-3");
  assert.ok(report.keyTimeline.find((item) => item.id === "inc-1").isMilestone);
  assert.equal(report.keyTimeline.at(-1).recordType, "deadline");
});

test("buildExecutiveSummaryReport includes diagnostics, evidence, and sequence groups", () => {
  const report = buildExecutiveSummaryReport(buildCase(), {
    generatedAt: "2024-02-02T00:00:00.000Z",
  });

  assert.equal(report.strongestEvidence[0].id, "ev-1");
  assert.ok(report.missingEvidence.some((item) => item.id === "inc-2"));
  assert.ok(report.risksAndConcerns.some((item) => item.id === "missing-proof"));
  assert.ok(report.recommendedNextSteps.some((item) => item.source === "actionSummary"));
  assert.deepEqual(report.sequenceGroupOverview.map((group) => group.name), ["Leak thread", "Noise thread", "Other thread"]);
  assert.ok(report.sequenceGroupOverview.find((group) => group.name === "Other thread").warnings.includes("No incidents"));
  assert.equal(typeof report.diagnosticsSummary.chronologyGapCount, "number");
});

test("buildExecutiveSummaryReport handles empty case safely", () => {
  const report = buildExecutiveSummaryReport({ id: "empty-case" }, {
    generatedAt: "2024-02-02T00:00:00.000Z",
  });

  assert.equal(report.sourceCaseId, "empty-case");
  assert.equal(report.caseOverview.name, "");
  assert.equal(report.atAGlance.incidentCount, 0);
  assert.deepEqual(report.keyTimeline, []);
  assert.deepEqual(report.strongestEvidence, []);
  assert.deepEqual(report.sequenceGroupOverview, []);
  assert.equal(report.currentPosition.operationalSummary, "No current operational summary recorded.");
});

test("buildEvidencePackReport builds a whole-case evidence pack", () => {
  const report = buildEvidencePackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.reportType, EVIDENCE_PACK_REPORT);
  assert.equal(report.title, "Evidence Pack: Whole Case");
  assert.equal(report.scopeType, "case");
  assert.equal(report.scopeLabel, "Whole case");
  assert.equal(report.includedEvidenceCount, 2);
  assert.deepEqual(report.includedEvidenceIds, ["ev-1", "ev-2"]);
  assert.equal(report.atAGlance.evidenceCount, 2);
  assert.equal(report.atAGlance.linkedEvidenceCount, 1);
  assert.equal(report.atAGlance.unlinkedEvidenceCount, 1);
  assert.equal(report.atAGlance.incidentsSupportedCount, 1);
  assert.equal(report.atAGlance.evidenceWithAttachmentsCount, 1);
  assert.equal(report.atAGlance.evidenceMissingFunctionSummaryCount, 1);
});

test("buildEvidencePackReport builds a sequenceGroup-scoped evidence pack", () => {
  const report = buildEvidencePackReport(buildCase(), {
    scopeType: "sequenceGroup",
    sequenceGroup: "Leak thread",
  }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.title, "Evidence Pack: Leak thread");
  assert.equal(report.scopeType, "sequenceGroup");
  assert.equal(report.sequenceGroup, "Leak thread");
  assert.deepEqual(report.includedEvidenceIds, ["ev-1"]);
  assert.equal(report.atAGlance.evidenceCount, 1);
  assert.equal(report.atAGlance.linkedEvidenceCount, 1);
  assert.equal(report.atAGlance.unlinkedEvidenceCount, 0);
});

test("buildEvidencePackReport includes linked incidents and linked records in matrix", () => {
  const report = buildEvidencePackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  const matrixItem = report.evidenceMatrix.find((item) => item.id === "ev-1");
  assert.deepEqual(matrixItem.linkedIncidents.map((item) => item.title), ["Leak reported"]);
  assert.deepEqual(matrixItem.attachmentNames, ["ceiling.jpg"]);
  assert.equal(matrixItem.attachmentCount, 1);
});

test("buildEvidencePackReport identifies missing summaries and unlinked weak evidence", () => {
  const report = buildEvidencePackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.deepEqual(report.unlinkedWeakEvidence.unlinkedEvidence.map((item) => item.id), ["ev-2"]);
  assert.deepEqual(report.unlinkedWeakEvidence.evidenceMissingFunctionSummary.map((item) => item.id), ["ev-2"]);
  assert.deepEqual(report.unlinkedWeakEvidence.evidenceWithoutAttachments.map((item) => item.id), ["ev-2"]);
  assert.ok(Array.isArray(report.diagnostics.unusedEvidence));
});

test("buildEvidencePackReport handles no evidence gracefully", () => {
  const report = buildEvidencePackReport({ id: "case-empty", name: "Empty", incidents: [] }, { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.includedEvidenceCount, 0);
  assert.deepEqual(report.includedEvidenceIds, []);
  assert.deepEqual(report.evidenceMatrix, []);
  assert.deepEqual(report.supportedIncidents, []);
  assert.equal(report.atAGlance.evidenceCount, 0);
});

test("buildDocumentPackReport builds a whole-case document pack", () => {
  const report = buildDocumentPackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.reportType, DOCUMENT_PACK_REPORT);
  assert.equal(report.title, "Document Pack: Whole Case");
  assert.equal(report.scopeType, "case");
  assert.equal(report.scopeLabel, "Whole case");
  assert.equal(report.includedDocumentCount, 2);
  assert.deepEqual(report.includedDocumentIds, ["doc-1", "doc-2"]);
  assert.equal(report.atAGlance.documentCount, 2);
  assert.equal(report.atAGlance.linkedDocumentCount, 1);
  assert.equal(report.atAGlance.unlinkedDocumentCount, 1);
  assert.equal(report.atAGlance.linkedIncidentCount, 1);
  assert.equal(report.atAGlance.linkedEvidenceCount, 1);
  assert.equal(report.atAGlance.documentWithAttachmentsCount, 1);
});

test("buildDocumentPackReport builds a sequenceGroup-scoped document pack", () => {
  const report = buildDocumentPackReport(buildCase(), {
    scopeType: "sequenceGroup",
    sequenceGroup: "Leak thread",
  }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.title, "Document Pack: Leak thread");
  assert.equal(report.scopeType, "sequenceGroup");
  assert.equal(report.sequenceGroup, "Leak thread");
  assert.deepEqual(report.includedDocumentIds, ["doc-1"]);
  assert.equal(report.atAGlance.documentCount, 1);
  assert.equal(report.atAGlance.linkedDocumentCount, 1);
});

test("buildDocumentPackReport includes linked records and attachment metadata", () => {
  const report = buildDocumentPackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  const document = report.documentMatrix.find((item) => item.id === "doc-1");
  assert.deepEqual(document.linkedIncidents.map((item) => item.title), ["Leak reported"]);
  assert.deepEqual(document.linkedEvidence.map((item) => item.title), ["Ceiling photo"]);
  assert.deepEqual(document.linkedStrategy.map((item) => item.title), ["Ask for timeline?"]);
  assert.deepEqual(document.attachmentNames, ["repair-email.pdf"]);
  assert.deepEqual(document.attachmentMetadata, [{
    id: "doc-att-1",
    name: "repair-email.pdf",
    type: "application/pdf",
    size: 1234,
  }]);
  assert.equal(document.textExcerpt, "The landlord acknowledged the repair request and promised a contractor visit.");
});

test("buildDocumentPackReport identifies unlinked and weak documents", () => {
  const report = buildDocumentPackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.deepEqual(report.unlinkedWeakDocuments.unlinkedDocuments.map((item) => item.id), ["doc-2"]);
  assert.deepEqual(report.unlinkedWeakDocuments.documentsMissingSummary.map((item) => item.id), ["doc-2"]);
  assert.deepEqual(report.unlinkedWeakDocuments.documentsWithoutAttachments.map((item) => item.id), ["doc-2"]);
  assert.ok(Array.isArray(report.diagnostics.orphanDocuments));
});

test("buildLedgerPackReport builds a whole-case ledger pack", () => {
  const report = buildLedgerPackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.reportType, LEDGER_PACK_REPORT);
  assert.equal(report.title, "Ledger Pack: Whole Case");
  assert.equal(report.scopeType, "case");
  assert.equal(report.scopeLabel, "Whole case");
  assert.equal(report.includedLedgerCount, 3);
  assert.deepEqual(report.includedLedgerIds, ["led-1", "led-2", "led-3"]);
  assert.equal(report.atAGlance.totalEntryCount, 3);
  assert.equal(report.atAGlance.entriesWithProofCount, 1);
  assert.equal(report.atAGlance.entriesWithoutProofCount, 2);
  assert.equal(report.atAGlance.linkedEntryCount, 2);
  assert.equal(report.atAGlance.unlinkedEntryCount, 1);
});

test("buildLedgerPackReport builds a sequenceGroup-scoped ledger pack", () => {
  const report = buildLedgerPackReport(buildCase(), {
    scopeType: "sequenceGroup",
    sequenceGroup: "Leak thread",
  }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.title, "Ledger Pack: Leak thread");
  assert.equal(report.scopeType, "sequenceGroup");
  assert.equal(report.sequenceGroup, "Leak thread");
  assert.deepEqual(report.includedLedgerIds, ["led-1"]);
  assert.equal(report.atAGlance.totalEntryCount, 1);
});

test("buildLedgerPackReport calculates totals", () => {
  const report = buildLedgerPackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.atAGlance.totalAmount, 250);
  assert.equal(report.atAGlance.debitTotal, 200);
  assert.equal(report.atAGlance.creditTotal, 50);
});

test("buildLedgerPackReport includes linked proof records", () => {
  const report = buildLedgerPackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  const entry = report.ledgerMatrix.find((item) => item.id === "led-1");
  assert.equal(entry.amount, 200);
  assert.equal(entry.subType, "repair_cost");
  assert.equal(entry.method, "bank transfer");
  assert.equal(entry.reference, "REF-001");
  assert.equal(entry.proofType, "invoice");
  assert.equal(entry.batchLabel, "repairs");
  assert.equal(entry.hasProof, true);
  assert.deepEqual(entry.linkedDocuments.map((item) => item.title), ["Repair email"]);
  assert.deepEqual(entry.linkedEvidence.map((item) => item.title), ["Ceiling photo"]);
  assert.deepEqual(report.proofSummary.entriesLinkedToProofRecords.map((item) => item.id), ["led-1"]);
});

test("buildLedgerPackReport identifies missing proof and weak ledger entries", () => {
  const report = buildLedgerPackReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.deepEqual(report.proofSummary.entriesWithMissingProof.map((item) => item.id), ["led-2", "led-3"]);
  assert.deepEqual(report.unlinkedWeakLedger.unlinkedLedgerEntries.map((item) => item.id), ["led-3"]);
  assert.ok(Array.isArray(report.diagnostics.orphanLedger));
});

test("buildCaseBundleReport builds a whole-case bundle", () => {
  const report = buildCaseBundleReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.reportType, CASE_BUNDLE_REPORT);
  assert.equal(report.title, "Case Bundle: Whole Case");
  assert.equal(report.scopeType, "case");
  assert.equal(report.scopeLabel, "Whole case");
  assert.equal(report.sections.threadIssue, null);
  assert.equal(report.sections.evidencePack.reportType, EVIDENCE_PACK_REPORT);
  assert.equal(report.sections.documentPack.reportType, DOCUMENT_PACK_REPORT);
  assert.equal(report.sections.ledgerPack.reportType, LEDGER_PACK_REPORT);
  assert.ok(report.sections.strategyActions);
  assert.ok(report.sections.combinedDiagnostics);
});

test("buildCaseBundleReport builds a sequenceGroup-scoped bundle", () => {
  const report = buildCaseBundleReport(buildCase(), {
    scopeType: "sequenceGroup",
    sequenceGroup: "Leak thread",
  }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.equal(report.title, "Case Bundle: Leak thread");
  assert.equal(report.scopeType, "sequenceGroup");
  assert.equal(report.sequenceGroup, "Leak thread");
  assert.equal(report.sections.threadIssue.reportType, THREAD_ISSUE_REPORT);
  assert.deepEqual(report.sections.evidencePack.includedEvidenceIds, ["ev-1"]);
  assert.deepEqual(report.sections.documentPack.includedDocumentIds, ["doc-1"]);
  assert.deepEqual(report.sections.ledgerPack.includedLedgerIds, ["led-1"]);
});

test("buildCaseBundleReport includes all selected sections", () => {
  const report = buildCaseBundleReport(buildCase(), {
    scopeType: "sequenceGroup",
    sequenceGroup: "Leak thread",
  }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.deepEqual(report.contentsSummary.map((item) => item.key), [
    "threadIssue",
    "evidencePack",
    "documentPack",
    "ledgerPack",
    "strategyActions",
    "diagnosticsSummary",
  ]);
  assert.equal(report.contentsSummary.every((item) => item.selected), true);
  assert.equal(report.generationMetadata.sectionCount, 6);
});

test("buildCaseBundleReport supports only selected sections", () => {
  const report = buildCaseBundleReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
    sections: {
      threadIssue: false,
      evidencePack: true,
      documentPack: false,
      ledgerPack: false,
      strategyActions: false,
      diagnosticsSummary: false,
    },
  });

  assert.ok(report.sections.evidencePack);
  assert.equal(report.sections.threadIssue, null);
  assert.equal(report.sections.documentPack, null);
  assert.equal(report.sections.ledgerPack, null);
  assert.equal(report.sections.strategyActions, null);
  assert.equal(report.sections.combinedDiagnostics, null);
  assert.deepEqual(report.contentsSummary.filter((item) => item.included).map((item) => item.key), ["evidencePack"]);
});

test("buildCaseBundleReport includes combined diagnostics once", () => {
  const report = buildCaseBundleReport(buildCase(), { scopeType: "case" }, {
    generatedAt: "2024-02-01T00:00:00.000Z",
  });

  assert.ok(report.sections.combinedDiagnostics);
  assert.equal(Object.keys(report.sections).filter((key) => key.toLowerCase().includes("diagnostic")).length, 1);
  assert.equal(report.contentsSummary.filter((item) => item.key === "diagnosticsSummary").length, 1);
});
