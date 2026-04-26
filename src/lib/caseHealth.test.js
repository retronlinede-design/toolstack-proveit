import test from "node:test";
import assert from "node:assert/strict";

import { getCaseHealthReport } from "./caseHealth.js";

test("getCaseHealthReport classifies missing incident support as a gap, not a blocker", () => {
  const report = getCaseHealthReport({
    incidents: [
      {
        id: "inc-1",
        title: "Noise complaint",
        description: "Repeated noise late at night.",
        eventDate: "2024-01-01",
        attachments: [],
        linkedEvidenceIds: [],
      },
    ],
    evidence: [],
    tasks: [],
    strategy: [],
  });

  const incidentIssue = report.issues
    .find((group) => group.category === "Incidents")
    ?.items.find((item) => item.id === "inc-1");

  assert.equal(report.totalIssues, 0);
  assert.equal(report.status, "Healthy");
  assert.equal(incidentIssue?.severity, "advisory");
  assert.equal(incidentIssue?.classification, "gap");
  assert.match(incidentIssue?.detail || "", /attachment or linked evidence/);
});

test("getCaseHealthReport classifies missing evidence links and availability as gaps", () => {
  const report = getCaseHealthReport({
    incidents: [{
      id: "inc-1",
      title: "Incident",
      description: "Known incident",
      eventDate: "2024-01-01",
      attachments: [{ id: "att-1" }],
    }],
    evidence: [
      {
        id: "ev-1",
        title: "Photo note",
        description: "Evidence still being collected.",
        eventDate: "2024-01-02",
        linkedIncidentIds: [],
        attachments: [],
        availability: {
          physical: { hasOriginal: false },
          digital: { hasDigital: false },
        },
      },
    ],
    tasks: [],
    strategy: [],
  });

  const evidenceIssue = report.issues
    .find((group) => group.category === "Evidence")
    ?.items.find((item) => item.id === "ev-1");

  assert.equal(report.totalIssues, 0);
  assert.equal(report.status, "Healthy");
  assert.equal(evidenceIssue?.severity, "advisory");
  assert.equal(evidenceIssue?.classification, "gap");
  assert.match(evidenceIssue?.detail || "", /linked incident/);
  assert.match(evidenceIssue?.detail || "", /physical or digital availability/);
});

test("getCaseHealthReport keeps critical missing evidence title as blocking", () => {
  const report = getCaseHealthReport({
    incidents: [{ id: "inc-1", title: "Incident", description: "Known incident", eventDate: "2024-01-01" }],
    evidence: [
      {
        id: "ev-1",
        title: "",
        eventDate: "2024-01-02",
        linkedIncidentIds: ["inc-1"],
        attachments: [],
        availability: {
          physical: { hasOriginal: true },
          digital: { hasDigital: false },
        },
      },
    ],
    tasks: [],
    strategy: [],
  });

  const blockingIssue = report.issues
    .find((group) => group.category === "Evidence")
    ?.items.find((item) => item.id === "ev-1" && item.severity === "blocking");

  assert.equal(report.totalIssues, 1);
  assert.equal(report.status, "Needs review");
  assert.equal(blockingIssue?.detail, "Missing: title");
});

test("getCaseHealthReport lowers status when multiple meaningful gaps exist without blockers", () => {
  const report = getCaseHealthReport({
    incidents: [
      {
        id: "inc-1",
        title: "First incident",
        description: "Known incident",
        eventDate: "2024-01-01",
        attachments: [],
        linkedEvidenceIds: [],
      },
      {
        id: "inc-2",
        title: "Second incident",
        description: "Another known incident",
        eventDate: "2024-01-02",
        attachments: [],
        linkedEvidenceIds: [],
      },
    ],
    evidence: [],
    tasks: [],
    strategy: [],
  });

  const gapIssues = report.issues
    .flatMap((group) => group.items)
    .filter((item) => item.classification === "gap");

  assert.equal(report.totalIssues, 0);
  assert.equal(gapIssues.length, 2);
  assert.equal(report.status, "Needs review");
});

test("getCaseHealthReport keeps only minor informational advisories Healthy", () => {
  const report = getCaseHealthReport({
    incidents: [
      {
        id: "inc-1",
        title: "Duplicate title",
        description: "First incident",
        eventDate: "2024-01-01",
        attachments: [{ id: "att-1" }],
        linkedEvidenceIds: [],
      },
      {
        id: "inc-2",
        title: "Duplicate title",
        description: "Second incident",
        eventDate: "2024-01-02",
        attachments: [{ id: "att-2" }],
        linkedEvidenceIds: [],
      },
    ],
    evidence: [],
    tasks: [],
    strategy: [],
  });

  const advisoryIssues = report.issues
    .flatMap((group) => group.items)
    .filter((item) => item.severity === "advisory");
  const gapIssues = advisoryIssues.filter((item) => item.classification === "gap");

  assert.equal(report.totalIssues, 0);
  assert.equal(advisoryIssues.length, 2);
  assert.equal(gapIssues.length, 0);
  assert.equal(report.status, "Healthy");
});

test("getCaseHealthReport keeps blocker thresholds dominant", () => {
  const needsReviewReport = getCaseHealthReport({
    incidents: [],
    evidence: [],
    tasks: [{ id: "task-1", title: "", status: "open", date: "2024-01-01" }],
    strategy: [],
  });

  const highRiskReport = getCaseHealthReport({
    incidents: [],
    evidence: [],
    tasks: Array.from({ length: 6 }, (_, index) => ({
      id: `task-${index}`,
      title: "",
      status: "open",
      date: `2024-01-0${index + 1}`,
    })),
    strategy: [],
  });

  assert.equal(needsReviewReport.totalIssues, 1);
  assert.equal(needsReviewReport.status, "Needs review");
  assert.equal(highRiskReport.totalIssues, 6);
  assert.equal(highRiskReport.status, "High risk");
});

test("getCaseHealthReport flags one stale-link issue per affected record", () => {
  const report = getCaseHealthReport({
    incidents: [
      {
        id: "inc-1",
        title: "Incident",
        description: "Known incident",
        eventDate: "2024-01-01",
        linkedEvidenceIds: ["ev-missing", "ev-missing-2"],
        linkedIncidentRefs: [{ incidentId: "inc-missing", type: "RELATED_TO" }],
      },
    ],
    evidence: [],
    tasks: [],
    strategy: [],
    documents: [],
    ledger: [],
  });

  const linkIssues = report.issues.find((group) => group.category === "Links")?.items || [];
  const incidentIssue = linkIssues.find((item) => item.id === "inc-1");

  assert.equal(incidentIssue?.title, "Missing linked records");
  assert.equal(incidentIssue?.type, "incidents");
  assert.equal(incidentIssue?.tab, "incidents");
  assert.equal(incidentIssue?.severity, "advisory");
  assert.equal(incidentIssue?.classification, "gap");
  assert.equal(incidentIssue?.missingLinkCount, 3);
  assert.match(incidentIssue?.detail || "", /3 missing linked records/);
});

test("getCaseHealthReport flags stale document and ledger linked records", () => {
  const documentRecord = { id: "doc-1", title: "Document", linkedRecordIds: ["ev-1", "missing-doc-link"] };
  const ledgerRecord = { id: "ledger-1", label: "Ledger", linkedRecordIds: ["missing-ledger-link"] };
  const report = getCaseHealthReport({
    incidents: [],
    evidence: [{ id: "ev-1", title: "Evidence", eventDate: "2024-01-01" }],
    tasks: [],
    strategy: [],
    documents: [documentRecord],
    ledger: [ledgerRecord],
  });

  const linkIssues = report.issues.find((group) => group.category === "Links")?.items || [];
  const documentIssue = linkIssues.find((item) => item.id === "doc-1");
  const ledgerIssue = linkIssues.find((item) => item.id === "ledger-1");

  assert.equal(documentIssue?.title, "Missing linked records");
  assert.equal(documentIssue?.type, "documents");
  assert.equal(documentIssue?.tab, "documents");
  assert.equal(documentIssue?.record, documentRecord);
  assert.equal(documentIssue?.missingLinkCount, 1);
  assert.equal(ledgerIssue?.title, "Missing linked records");
  assert.equal(ledgerIssue?.type, "ledger");
  assert.equal(ledgerIssue?.tab, "ledger");
  assert.equal(ledgerIssue?.record, ledgerRecord);
  assert.equal(ledgerIssue?.missingLinkCount, 1);
});
