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
    incidents: [{ id: "inc-1", title: "Incident", description: "Known incident", eventDate: "2024-01-01" }],
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
