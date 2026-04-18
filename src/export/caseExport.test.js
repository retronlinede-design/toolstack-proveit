import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCaseReasoningExportPayload,
  sanitizeAttachmentForExport,
  sanitizeCaseForExport,
  sanitizeRecordForExport,
} from "./caseExport.js";

const fixtureAttachment = {
  id: "att-1",
  name: "photo.png",
  type: "image/png",
  mimeType: "image/png",
  size: 123,
  kind: "image",
  createdAt: "2024-01-01T09:00:00.000Z",
  emailMeta: { subject: "Subject" },
  storage: { type: "indexeddb", imageId: "img-1" },
  dataUrl: "data:image/png;base64,abc",
  backupDataUrl: "data:image/png;base64,backup",
  file: { name: "raw-file" },
};

function buildReasoningCase() {
  return {
    id: "case-1",
    name: "Housing Case",
    category: "housing",
    status: "open",
    description: "Detailed case description",
    notes: "Case notes",
    createdAt: "2024-01-01T09:00:00.000Z",
    updatedAt: "2024-02-01T09:00:00.000Z",
    actionSummary: {
      currentFocus: "Current focus",
      nextActions: ["Next action"],
      importantReminders: ["Reminder"],
      strategyFocus: ["Strategy focus"],
      criticalDeadlines: ["Deadline"],
      updatedAt: "2024-02-01T10:00:00.000Z",
    },
    incidents: [
      {
        id: "inc-1",
        type: "incidents",
        title: "Early incident",
        status: "open",
        eventDate: "2024-01-01",
        date: "2024-01-01",
        description: "Early incident description",
        linkedEvidenceIds: ["ev-1"],
        attachments: [fixtureAttachment],
      },
      {
        id: "inc-2",
        type: "incidents",
        title: "Late incident",
        status: "open",
        eventDate: "2024-01-03",
        date: "2024-01-03",
        description: "Late incident description",
        linkedEvidenceIds: ["ev-2"],
      },
    ],
    evidence: [
      {
        id: "ev-1",
        type: "evidence",
        title: "Middle evidence",
        status: "needs_review",
        importance: "critical",
        relevance: "high",
        sourceType: "digital",
        eventDate: "2024-01-02",
        date: "2024-01-02",
        description: "Middle evidence description",
        linkedIncidentIds: ["inc-1"],
        attachments: [fixtureAttachment],
        availability: {
          physical: { hasOriginal: false, location: "", notes: "" },
          digital: { hasDigital: true, files: [fixtureAttachment] },
        },
      },
      {
        id: "ev-2",
        type: "evidence",
        title: "Latest evidence",
        status: "needs_review",
        importance: "strong",
        relevance: "medium",
        sourceType: "digital",
        eventDate: "2024-01-04",
        date: "2024-01-04",
        description: "Latest evidence description",
        linkedIncidentIds: ["inc-2"],
      },
    ],
    tasks: Array.from({ length: 10 }, (_, index) => ({
      id: `task-${index + 1}`,
      type: "tasks",
      title: `Task ${index + 1}`,
      status: index === 9 ? "done" : "open",
      priority: "medium",
      description: `Task ${index + 1} description`,
    })),
    strategy: [
      {
        id: "str-1",
        type: "strategy",
        title: "Main strategy",
        status: "open",
        eventDate: "2024-01-05",
        description: "Main strategy description",
        linkedRecordIds: ["inc-1"],
      },
    ],
    documents: [
      {
        id: "doc-1",
        title: "Document",
        category: "legal",
        documentDate: "2024-01-06",
        source: "email",
        summary: "Document summary",
        textContent: "Document text",
        linkedRecordIds: ["ev-1"],
        attachments: [fixtureAttachment],
      },
    ],
  };
}

test("sanitizeAttachmentForExport omits binary and data-url style payload fields", () => {
  const sanitized = sanitizeAttachmentForExport(fixtureAttachment);

  assert.deepEqual(sanitized, {
    id: "att-1",
    name: "photo.png",
    type: "image/png",
    mimeType: "image/png",
    size: 123,
    kind: "image",
    createdAt: "2024-01-01T09:00:00.000Z",
    emailMeta: { subject: "Subject" },
    storage: { type: "indexeddb", imageId: "img-1" },
  });
  assert.equal(Object.hasOwn(sanitized, "dataUrl"), false);
  assert.equal(Object.hasOwn(sanitized, "backupDataUrl"), false);
  assert.equal(Object.hasOwn(sanitized, "file"), false);
});

test("sanitizeRecordForExport sanitizes attachments and availability digital files", () => {
  const sanitized = sanitizeRecordForExport({
    id: "ev-1",
    title: "Evidence",
    attachments: [fixtureAttachment],
    availability: {
      physical: { hasOriginal: true, location: "Box", notes: "Original" },
      digital: {
        hasDigital: true,
        files: [fixtureAttachment],
      },
    },
  });

  assert.equal(sanitized.attachments[0].dataUrl, undefined);
  assert.equal(sanitized.attachments[0].backupDataUrl, undefined);
  assert.equal(sanitized.availability.digital.files[0].dataUrl, undefined);
  assert.equal(sanitized.availability.digital.files[0].backupDataUrl, undefined);
  assert.deepEqual(sanitized.availability.physical, {
    hasOriginal: true,
    location: "Box",
    notes: "Original",
  });
});

test("sanitizeCaseForExport preserves canonical actionSummary shape including criticalDeadlines", () => {
  const sanitized = sanitizeCaseForExport(buildReasoningCase());

  assert.deepEqual(sanitized.actionSummary, {
    currentFocus: "Current focus",
    nextActions: ["Next action"],
    importantReminders: ["Reminder"],
    strategyFocus: ["Strategy focus"],
    criticalDeadlines: ["Deadline"],
    updatedAt: "2024-02-01T10:00:00.000Z",
  });
  assert.equal(sanitized.evidence[0].attachments[0].dataUrl, undefined);
  assert.equal(sanitized.documents[0].attachments[0].backupDataUrl, undefined);
});

test("buildCaseReasoningExportPayload returns expected core shape for a valid case", () => {
  const payload = buildCaseReasoningExportPayload(buildReasoningCase());

  assert.equal(payload.app, "proveit");
  assert.equal(payload.contractVersion, "2.0");
  assert.equal(payload.exportType, "CASE_REASONING_EXPORT");
  assert.equal(payload.importable, false);
  assert.equal(payload.includesBinaryData, false);
  assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(payload.data.case, {
    id: "case-1",
    name: "Housing Case",
    category: "housing",
    status: "open",
    lastUpdated: "2024-02-01T09:00:00.000Z",
  });
  assert.equal(payload.data.caseState.currentSituation, "open case with 2 incidents, 2 evidence items, 1 documents, and 8 open tasks.");
  assert.deepEqual(payload.data.actionSummary.criticalDeadlines, ["Deadline"]);
  assert.equal(payload.data.evidenceSummary[0].attachmentCount, 1);
  assert.equal(payload.data.documentSummary[0].attachmentCount, 1);
  assert.equal(payload.data.reasoningV2.evidencePosture.evidenceCount, 2);
});

test("buildCaseReasoningExportPayload recentTimeline includes incidents and evidence ordered by timeline data", () => {
  const payload = buildCaseReasoningExportPayload(buildReasoningCase());

  assert.deepEqual(
    payload.data.recentTimeline.map((item) => item.id),
    ["ev-2", "inc-2", "ev-1", "inc-1"]
  );
  assert.deepEqual(
    payload.data.recentTimeline.map((item) => item.date),
    ["2024-01-04", "2024-01-03", "2024-01-02", "2024-01-01"]
  );
});

test("buildCaseReasoningExportPayload incidentSummary includes derived incidentLinks", () => {
  const caseItem = buildReasoningCase();
  caseItem.incidents = [
    {
      id: "inc-current",
      type: "incidents",
      title: "Current incident",
      eventDate: "2024-01-04",
      date: "2024-01-04",
      description: "Current description",
      linkedEvidenceIds: [],
      linkedIncidentRefs: [{ incidentId: "inc-outcome", type: "CAUSES" }],
    },
    {
      id: "inc-cause",
      type: "incidents",
      title: "Cause incident",
      eventDate: "2024-01-03",
      date: "2024-01-03",
      description: "Cause description",
      linkedIncidentRefs: [{ incidentId: "inc-current", type: "CAUSES" }],
    },
    {
      id: "inc-related",
      type: "incidents",
      title: "Related incident",
      eventDate: "2024-01-02",
      date: "2024-01-02",
      description: "Related description",
      linkedIncidentRefs: [{ incidentId: "inc-current", type: "RELATED_TO" }],
    },
    {
      id: "inc-outcome",
      type: "incidents",
      title: "Outcome incident",
      eventDate: "2024-01-01",
      date: "2024-01-01",
      description: "Outcome description",
    },
  ];

  const payload = buildCaseReasoningExportPayload(caseItem, "detailed");
  const current = payload.data.incidentSummary.find((item) => item.id === "inc-current");

  assert.deepEqual(current.incidentLinks, {
    causes: [{ id: "inc-cause", title: "Cause incident", date: "2024-01-03" }],
    outcomes: [{ id: "inc-outcome", title: "Outcome incident", date: "2024-01-01" }],
    related: [{ id: "inc-related", title: "Related incident", date: "2024-01-02" }],
  });
  assert.deepEqual(current.linkedEvidenceIds, []);
});

test("buildCaseReasoningExportPayload omits missing linked incident targets safely", () => {
  const caseItem = buildReasoningCase();
  caseItem.incidents = [
    {
      id: "inc-current",
      type: "incidents",
      title: "Current incident",
      eventDate: "2024-01-02",
      date: "2024-01-02",
      description: "Current description",
      linkedIncidentRefs: [
        { incidentId: "inc-missing-outcome", type: "CAUSES" },
        { incidentId: "inc-missing-related", type: "RELATED_TO" },
      ],
    },
    {
      id: "inc-cause",
      type: "incidents",
      title: "Cause incident",
      eventDate: "2024-01-01",
      date: "2024-01-01",
      linkedIncidentRefs: [{ incidentId: "inc-current", type: "CAUSES" }],
    },
  ];

  const payload = buildCaseReasoningExportPayload(caseItem);
  const current = payload.data.incidentSummary.find((item) => item.id === "inc-current");

  assert.deepEqual(current.incidentLinks, {
    causes: [{ id: "inc-cause", title: "Cause incident", date: "2024-01-01" }],
    outcomes: [],
    related: [],
  });
});

test("buildCaseReasoningExportPayload linked incident entries remain compact", () => {
  const caseItem = buildReasoningCase();
  caseItem.incidents = [
    {
      id: "inc-current",
      type: "incidents",
      title: "Current incident",
      eventDate: "2024-01-02",
      date: "2024-01-02",
      linkedIncidentRefs: [{ incidentId: "inc-related", type: "RELATED_TO" }],
    },
    {
      id: "inc-related",
      type: "incidents",
      title: "Related incident",
      eventDate: "2024-01-01",
      date: "2024-01-01",
      description: "This should not be exported in incidentLinks.",
      linkedEvidenceIds: ["ev-1"],
      linkedIncidentRefs: [{ incidentId: "inc-current", type: "RELATED_TO" }],
    },
  ];

  const payload = buildCaseReasoningExportPayload(caseItem);
  const current = payload.data.incidentSummary.find((item) => item.id === "inc-current");

  assert.deepEqual(Object.keys(current.incidentLinks.related[0]).sort(), ["date", "id", "title"]);
  assert.deepEqual(current.incidentLinks.related, [
    { id: "inc-related", title: "Related incident", date: "2024-01-01" },
  ]);
});

test("buildCaseReasoningExportPayload locks compact and detailed limits", () => {
  const compact = buildCaseReasoningExportPayload(buildReasoningCase(), "compact");
  const detailed = buildCaseReasoningExportPayload(buildReasoningCase(), "detailed");

  assert.equal(compact.data.openTasks.length, 8);
  assert.equal(detailed.data.openTasks.length, 9);
  assert.equal(compact.data.recentTimeline.length, 4);
  assert.equal(detailed.data.recentTimeline.length, 4);
  assert.equal(compact.data.incidentSummary.length, 2);
  assert.equal(detailed.data.incidentSummary.length, 2);
});
