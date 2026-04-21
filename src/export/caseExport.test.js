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

test("buildCaseReasoningExportPayload activeIssues includes additive recordType without changing existing fields", () => {
  const payload = buildCaseReasoningExportPayload(buildReasoningCase());

  const earlyIncident = payload.data.activeIssues.find((item) => item.id === "inc-1");
  const middleEvidence = payload.data.activeIssues.find((item) => item.id === "ev-1");

  assert.equal(earlyIncident.recordType, "incident");
  assert.deepEqual(earlyIncident, {
    id: "inc-1",
    recordType: "incident",
    title: "Early incident",
    status: "open",
    importance: "low",
    summary: "Early incident description",
  });

  assert.equal(middleEvidence.recordType, "evidence");
  assert.deepEqual(middleEvidence, {
    id: "ev-1",
    recordType: "evidence",
    title: "Middle evidence",
    status: "needs_review",
    importance: "high",
    summary: "Middle evidence description",
  });
});

test("buildCaseReasoningExportPayload evidenceSummary includes structured evidence metadata", () => {
  const caseItem = buildReasoningCase();
  caseItem.evidence[0] = {
    ...caseItem.evidence[0],
    evidenceRole: "ANCHOR_EVIDENCE",
    sequenceGroup: "Repair sequence",
    functionSummary: "Shows when the repair issue first became documented.",
  };

  const payload = buildCaseReasoningExportPayload(caseItem);
  const evidence = payload.data.evidenceSummary.find((item) => item.id === "ev-1");

  assert.equal(evidence.evidenceRole, "ANCHOR_EVIDENCE");
  assert.equal(evidence.sequenceGroup, "Repair sequence");
  assert.equal(evidence.functionSummary, "Shows when the repair issue first became documented.");
  assert.equal(evidence.title, "Middle evidence");
  assert.equal(evidence.attachmentCount, 1);
});

test("buildCaseReasoningExportPayload evidenceSummary includes compact linkedIncidents from linkedIncidentIds", () => {
  const caseItem = buildReasoningCase();
  caseItem.evidence[0] = {
    ...caseItem.evidence[0],
    linkedIncidentIds: ["inc-1", "inc-2"],
  };

  const payload = buildCaseReasoningExportPayload(caseItem);
  const evidence = payload.data.evidenceSummary.find((item) => item.id === "ev-1");

  assert.deepEqual(evidence.linkedIncidentIds, ["inc-1", "inc-2"]);
  assert.deepEqual(evidence.linkedIncidents, [
    { id: "inc-1", title: "Early incident", date: "2024-01-01" },
    { id: "inc-2", title: "Late incident", date: "2024-01-03" },
  ]);
  assert.deepEqual(evidence.resolvedLinks.incidents, [
    {
      id: "inc-1",
      title: "Early incident",
      date: "2024-01-01",
      recordType: "incident",
      summary: "Early incident description",
    },
    {
      id: "inc-2",
      title: "Late incident",
      date: "2024-01-03",
      recordType: "incident",
      summary: "Late incident description",
    },
  ]);
});

test("buildCaseReasoningExportPayload evidenceSummary omits missing linked incident targets safely", () => {
  const caseItem = buildReasoningCase();
  caseItem.evidence[0] = {
    ...caseItem.evidence[0],
    linkedIncidentIds: ["inc-1", "inc-missing"],
  };

  const payload = buildCaseReasoningExportPayload(caseItem);
  const evidence = payload.data.evidenceSummary.find((item) => item.id === "ev-1");

  assert.deepEqual(evidence.linkedIncidents, [
    { id: "inc-1", title: "Early incident", date: "2024-01-01" },
  ]);
});

test("buildCaseReasoningExportPayload evidence linked incident entries remain compact", () => {
  const caseItem = buildReasoningCase();
  caseItem.evidence[0] = {
    ...caseItem.evidence[0],
    linkedIncidentIds: ["inc-1"],
  };

  const payload = buildCaseReasoningExportPayload(caseItem);
  const evidence = payload.data.evidenceSummary.find((item) => item.id === "ev-1");

  assert.deepEqual(Object.keys(evidence.linkedIncidents[0]).sort(), ["date", "id", "title"]);
  assert.deepEqual(evidence.linkedIncidents, [
    { id: "inc-1", title: "Early incident", date: "2024-01-01" },
  ]);
});

test("buildCaseReasoningExportPayload documentSummary includes bounded textExcerpt and readable linkedRecords", () => {
  const caseItem = buildReasoningCase();
  caseItem.documents[0] = {
    ...caseItem.documents[0],
    textContent: "A".repeat(1200),
    linkedRecordIds: ["ev-1", "inc-2", "task-1", "str-1", "missing"],
  };

  const payload = buildCaseReasoningExportPayload(caseItem, "detailed");
  const document = payload.data.documentSummary.find((item) => item.id === "doc-1");

  assert.equal(document.hasTextContent, true);
  assert.equal(document.textExcerpt, "A".repeat(1000));
  assert.equal(document.textExcerpt.length, 1000);
  assert.deepEqual(document.linkedRecordIds, ["ev-1", "inc-2", "task-1", "str-1", "missing"]);
  assert.deepEqual(document.linkedRecords, [
    { id: "ev-1", recordType: "evidence", title: "Middle evidence", date: "2024-01-02" },
    { id: "inc-2", recordType: "incident", title: "Late incident", date: "2024-01-03" },
    { id: "task-1", recordType: "task", title: "Task 1", date: "" },
    { id: "str-1", recordType: "strategy", title: "Main strategy", date: "2024-01-05" },
  ]);
});

test("buildCaseReasoningExportPayload documentSummary uses empty textExcerpt when textContent is missing", () => {
  const caseItem = buildReasoningCase();
  delete caseItem.documents[0].textContent;

  const payload = buildCaseReasoningExportPayload(caseItem);
  const document = payload.data.documentSummary.find((item) => item.id === "doc-1");

  assert.equal(document.hasTextContent, false);
  assert.equal(document.textExcerpt, "");
});

test("buildCaseReasoningExportPayload documentSummary includes attachmentNames only without payload data", () => {
  const caseItem = buildReasoningCase();
  caseItem.documents[0] = {
    ...caseItem.documents[0],
    attachments: [
      fixtureAttachment,
      {
        id: "att-2",
        name: "lease.pdf",
        storage: { type: "indexeddb", imageId: "img-2" },
        dataUrl: "data:application/pdf;base64,abc",
      },
    ],
  };

  const payload = buildCaseReasoningExportPayload(caseItem);
  const document = payload.data.documentSummary.find((item) => item.id === "doc-1");

  assert.equal(document.attachmentCount, 2);
  assert.deepEqual(document.attachmentNames, ["photo.png", "lease.pdf"]);
  assert.equal(document.attachments, undefined);
  assert.equal(document.storage, undefined);
  assert.equal(document.dataUrl, undefined);
  assert.equal(document.backupDataUrl, undefined);
});

test("buildCaseReasoningExportPayload ledgerSummary includes totals and readable entries", () => {
  const caseItem = buildReasoningCase();
  caseItem.ledger = [
    {
      id: "ledger-1",
      category: "rent",
      label: "January rent",
      period: "2024-01",
      expectedAmount: 1000,
      paidAmount: 750,
      differenceAmount: 250,
      currency: "EUR",
      dueDate: "2024-01-05",
      paymentDate: "2024-01-06",
      status: "part-paid",
      proofStatus: "partial",
      counterparty: "Landlord",
      notes: "Part payment with evidence link",
      linkedRecordIds: ["ev-1", "inc-1", "doc-1", "missing"],
    },
    {
      id: "ledger-2",
      category: "deposit",
      label: "Deposit refund",
      period: "2024",
      expectedAmount: "500",
      paidAmount: "100",
      currency: "EUR",
      dueDate: "2024-02-01",
      paymentDate: "",
      status: "disputed",
      proofStatus: "missing",
      counterparty: "Landlord",
      notes: "Missing refund",
      linkedRecordIds: [],
    },
  ];

  const payload = buildCaseReasoningExportPayload(caseItem, "detailed");

  assert.deepEqual(payload.data.ledgerSummary.totals, {
    entryCount: 2,
    expectedTotal: 1500,
    paidTotal: 850,
    differenceTotal: 650,
    currencies: ["EUR"],
  });
  assert.deepEqual(payload.data.ledgerSummary.entries[0], {
    id: "ledger-1",
    category: "rent",
    label: "January rent",
    period: "2024-01",
    expectedAmount: 1000,
    paidAmount: 750,
    differenceAmount: 250,
    currency: "EUR",
    dueDate: "2024-01-05",
    paymentDate: "2024-01-06",
    status: "part-paid",
    proofStatus: "partial",
    counterparty: "Landlord",
    notes: "Part payment with evidence link",
    linkedRecordIds: ["ev-1", "inc-1", "doc-1", "missing"],
    linkedRecords: [
      { id: "ev-1", recordType: "evidence", title: "Middle evidence", date: "2024-01-02" },
      { id: "inc-1", recordType: "incident", title: "Early incident", date: "2024-01-01" },
      { id: "doc-1", recordType: "document", title: "Document", date: "2024-01-06" },
    ],
    resolvedLinks: {
      records: [
        { id: "ev-1", recordType: "evidence", title: "Middle evidence", date: "2024-01-02" },
        { id: "inc-1", recordType: "incident", title: "Early incident", date: "2024-01-01" },
        { id: "doc-1", recordType: "document", title: "Document", date: "2024-01-06" },
      ],
    },
  });
  assert.deepEqual(payload.data.ledgerSummary.entries[1].linkedRecords, []);
  assert.deepEqual(payload.data.ledgerSummary.entries[1].resolvedLinks, { records: [] });
});

test("buildCaseReasoningExportPayload ledgerSummary entries are bounded by mode while totals cover all entries", () => {
  const caseItem = buildReasoningCase();
  caseItem.ledger = Array.from({ length: 30 }, (_, index) => ({
    id: `ledger-${index + 1}`,
    category: "rent",
    label: `Ledger ${index + 1}`,
    expectedAmount: 10,
    paidAmount: 4,
    differenceAmount: 6,
    currency: index === 29 ? "USD" : "EUR",
    status: "planned",
    proofStatus: "missing",
    linkedRecordIds: [],
  }));

  const compact = buildCaseReasoningExportPayload(caseItem, "compact");
  const detailed = buildCaseReasoningExportPayload(caseItem, "detailed");

  assert.equal(compact.data.ledgerSummary.entries.length, 10);
  assert.equal(detailed.data.ledgerSummary.entries.length, 25);
  assert.equal(compact.data.ledgerSummary.totals.entryCount, 30);
  assert.equal(detailed.data.ledgerSummary.totals.entryCount, 30);
  assert.equal(compact.data.ledgerSummary.totals.expectedTotal, 300);
  assert.equal(compact.data.ledgerSummary.totals.paidTotal, 120);
  assert.equal(compact.data.ledgerSummary.totals.differenceTotal, 180);
  assert.deepEqual(compact.data.ledgerSummary.totals.currencies, ["EUR", "USD"]);
});

test("buildCaseReasoningExportPayload ledgerSummary does not include attachment or binary payload fields", () => {
  const caseItem = buildReasoningCase();
  caseItem.ledger = [
    {
      id: "ledger-1",
      category: "other",
      label: "Ledger with unrelated payload-shaped fields",
      expectedAmount: 1,
      paidAmount: 0,
      currency: "EUR",
      linkedRecordIds: ["ev-1"],
      attachments: [fixtureAttachment],
      dataUrl: "data:text/plain;base64,abc",
      backupDataUrl: "data:text/plain;base64,backup",
      storage: { type: "indexeddb", imageId: "img-ledger" },
    },
  ];

  const payload = buildCaseReasoningExportPayload(caseItem);
  const ledgerEntry = payload.data.ledgerSummary.entries[0];

  assert.equal(ledgerEntry.attachments, undefined);
  assert.equal(ledgerEntry.dataUrl, undefined);
  assert.equal(ledgerEntry.backupDataUrl, undefined);
  assert.equal(ledgerEntry.storage, undefined);
  assert.deepEqual(ledgerEntry.linkedRecords, [
    { id: "ev-1", recordType: "evidence", title: "Middle evidence", date: "2024-01-02" },
  ]);
});

test("buildCaseReasoningExportPayload chronology includes date-sorted cross-subsystem items", () => {
  const caseItem = buildReasoningCase();
  caseItem.ledger = [
    {
      id: "ledger-1",
      label: "February payment",
      paymentDate: "2024-02-02",
      dueDate: "2024-02-01",
      notes: "Ledger payment note",
      linkedRecordIds: ["ev-1"],
    },
  ];
  caseItem.tasks[0] = {
    ...caseItem.tasks[0],
    date: "2024-01-07",
    description: "Task chronology description",
    linkedRecordIds: ["inc-1"],
  };

  const payload = buildCaseReasoningExportPayload(caseItem, "detailed");

  assert.equal(payload.data.chronology.totalItems, 17);
  assert.deepEqual(
    payload.data.chronology.items.slice(0, 6).map((item) => ({
      id: item.id,
      recordType: item.recordType,
      date: item.date,
      title: item.title,
    })),
    [
      { id: "ledger-1", recordType: "ledger", date: "2024-02-02", title: "February payment" },
      { id: "task-1", recordType: "task", date: "2024-01-07", title: "Task 1" },
      { id: "doc-1", recordType: "document", date: "2024-01-06", title: "Document" },
      { id: "str-1", recordType: "strategy", date: "2024-01-05", title: "Main strategy" },
      { id: "ev-2", recordType: "evidence", date: "2024-01-04", title: "Latest evidence" },
      { id: "inc-2", recordType: "incident", date: "2024-01-03", title: "Late incident" },
    ]
  );
  assert.deepEqual(payload.data.chronology.items[0].linkedRecordIds, ["ev-1"]);
  assert.deepEqual(payload.data.chronology.items[1].linkedRecordIds, ["inc-1"]);
});

test("buildCaseReasoningExportPayload chronology entries are bounded by mode while totalItems covers all sources", () => {
  const caseItem = buildReasoningCase();
  caseItem.ledger = Array.from({ length: 60 }, (_, index) => ({
    id: `ledger-${index + 1}`,
    label: `Ledger ${index + 1}`,
    dueDate: `2024-03-${String((index % 28) + 1).padStart(2, "0")}`,
    linkedRecordIds: [],
  }));

  const compact = buildCaseReasoningExportPayload(caseItem, "compact");
  const detailed = buildCaseReasoningExportPayload(caseItem, "detailed");

  assert.equal(compact.data.chronology.totalItems, 76);
  assert.equal(detailed.data.chronology.totalItems, 76);
  assert.equal(compact.data.chronology.items.length, 20);
  assert.equal(detailed.data.chronology.items.length, 50);
});

test("buildCaseReasoningExportPayload chronology does not change recentTimeline", () => {
  const payload = buildCaseReasoningExportPayload(buildReasoningCase());

  assert.deepEqual(
    payload.data.recentTimeline.map((item) => item.id),
    ["ev-2", "inc-2", "ev-1", "inc-1"]
  );
  assert.deepEqual(
    payload.data.chronology.items.map((item) => item.recordType).slice(0, 4),
    ["document", "strategy", "evidence", "incident"]
  );
});

test("buildCaseReasoningExportPayload chronology omits attachment and binary payload fields", () => {
  const caseItem = buildReasoningCase();
  caseItem.documents[0] = {
    ...caseItem.documents[0],
    attachments: [fixtureAttachment],
    dataUrl: "data:text/plain;base64,abc",
    backupDataUrl: "data:text/plain;base64,backup",
  };

  const payload = buildCaseReasoningExportPayload(caseItem);
  const documentItem = payload.data.chronology.items.find((item) => item.id === "doc-1");

  assert.deepEqual(Object.keys(documentItem).sort(), [
    "date",
    "id",
    "linkedRecordIds",
    "linkedRecords",
    "recordType",
    "resolvedLinks",
    "summary",
    "title",
  ]);
  assert.equal(documentItem.attachments, undefined);
  assert.equal(documentItem.dataUrl, undefined);
  assert.equal(documentItem.backupDataUrl, undefined);
  assert.equal(documentItem.storage, undefined);
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
  assert.deepEqual(current.linkedIncidentRefs, [{ incidentId: "inc-outcome", type: "CAUSES" }]);
  assert.deepEqual(current.resolvedLinks.incidents, {
    causes: [
      {
        id: "inc-cause",
        title: "Cause incident",
        date: "2024-01-03",
        recordType: "incident",
        summary: "Cause description",
      },
    ],
    outcomes: [
      {
        id: "inc-outcome",
        title: "Outcome incident",
        date: "2024-01-01",
        recordType: "incident",
        summary: "Outcome description",
      },
    ],
    related: [
      {
        id: "inc-related",
        title: "Related incident",
        date: "2024-01-02",
        recordType: "incident",
        summary: "Related description",
      },
    ],
  });
});

test("buildCaseReasoningExportPayload incidentSummary includes readable linkedEvidence without changing linkedEvidenceIds", () => {
  const caseItem = buildReasoningCase();
  caseItem.incidents[0] = {
    ...caseItem.incidents[0],
    linkedEvidenceIds: ["ev-1", "ev-missing"],
  };
  caseItem.evidence[0] = {
    ...caseItem.evidence[0],
    evidenceRole: "ANCHOR_EVIDENCE",
  };

  const payload = buildCaseReasoningExportPayload(caseItem, "detailed");
  const incident = payload.data.incidentSummary.find((item) => item.id === "inc-1");

  assert.deepEqual(incident.linkedEvidenceIds, ["ev-1", "ev-missing"]);
  assert.deepEqual(incident.linkedEvidence, [
    {
      id: "ev-1",
      title: "Middle evidence",
      date: "2024-01-02",
      status: "needs_review",
      importance: "critical",
      relevance: "high",
      evidenceRole: "ANCHOR_EVIDENCE",
      recordType: "evidence",
      summary: "Middle evidence description",
    },
  ]);
  assert.deepEqual(incident.resolvedLinks.evidence, [
    {
      id: "ev-1",
      title: "Middle evidence",
      date: "2024-01-02",
      status: "needs_review",
      importance: "critical",
      relevance: "high",
      evidenceRole: "ANCHOR_EVIDENCE",
      recordType: "evidence",
      summary: "Middle evidence description",
    },
  ]);
});

test("buildCaseReasoningExportPayload incidentSummary includes readable linkedRecords without changing linkedRecordIds", () => {
  const caseItem = buildReasoningCase();
  caseItem.incidents[0] = {
    ...caseItem.incidents[0],
    linkedRecordIds: ["doc-1", "task-1", "missing-record"],
  };

  const payload = buildCaseReasoningExportPayload(caseItem, "detailed");
  const incident = payload.data.incidentSummary.find((item) => item.id === "inc-1");

  assert.deepEqual(incident.linkedRecordIds, ["doc-1", "task-1", "missing-record"]);
  assert.deepEqual(incident.linkedRecords, [
    {
      id: "doc-1",
      title: "Document",
      recordType: "document",
      summary: "Document summary",
      date: "2024-01-06",
    },
    {
      id: "task-1",
      title: "Task 1",
      recordType: "task",
      summary: "Task 1 description",
      date: "",
    },
  ]);
  assert.deepEqual(incident.resolvedLinks.records, [
    {
      id: "doc-1",
      title: "Document",
      recordType: "document",
      summary: "Document summary",
      date: "2024-01-06",
    },
    {
      id: "task-1",
      title: "Task 1",
      recordType: "task",
      summary: "Task 1 description",
      date: "",
    },
  ]);
});

test("buildCaseReasoningExportPayload strategy current and openTasks preserve raw links with resolved records", () => {
  const caseItem = buildReasoningCase();
  caseItem.strategy[0] = {
    ...caseItem.strategy[0],
    linkedRecordIds: ["inc-1", "doc-1"],
  };
  caseItem.tasks[0] = {
    ...caseItem.tasks[0],
    linkedRecordIds: ["ev-1", "missing-record"],
  };

  const payload = buildCaseReasoningExportPayload(caseItem, "detailed");

  assert.deepEqual(payload.data.strategy.current[0].linkedRecordIds, ["inc-1", "doc-1"]);
  assert.deepEqual(payload.data.strategy.current[0].linkedRecords, [
    { id: "inc-1", recordType: "incident", title: "Early incident", date: "2024-01-01" },
    { id: "doc-1", recordType: "document", title: "Document", date: "2024-01-06" },
  ]);
  assert.deepEqual(payload.data.strategy.current[0].resolvedLinks, {
    records: [
      { id: "inc-1", recordType: "incident", title: "Early incident", date: "2024-01-01" },
      { id: "doc-1", recordType: "document", title: "Document", date: "2024-01-06" },
    ],
  });
  assert.deepEqual(payload.data.openTasks[0].linkedRecordIds, ["ev-1", "missing-record"]);
  assert.deepEqual(payload.data.openTasks[0].linkedRecords, [
    { id: "ev-1", recordType: "evidence", title: "Middle evidence", date: "2024-01-02" },
  ]);
  assert.deepEqual(payload.data.openTasks[0].resolvedLinks, {
    records: [
      { id: "ev-1", recordType: "evidence", title: "Middle evidence", date: "2024-01-02" },
    ],
  });
});

test("buildCaseReasoningExportPayload linkedEvidence omits binary attachment data", () => {
  const payload = buildCaseReasoningExportPayload(buildReasoningCase(), "detailed");
  const incident = payload.data.incidentSummary.find((item) => item.id === "inc-1");

  assert.deepEqual(Object.keys(incident.linkedEvidence[0]).sort(), [
    "date",
    "evidenceRole",
    "id",
    "importance",
    "recordType",
    "relevance",
    "status",
    "summary",
    "title",
  ]);
  assert.equal(incident.linkedEvidence[0].dataUrl, undefined);
  assert.equal(incident.linkedEvidence[0].backupDataUrl, undefined);
  assert.equal(incident.linkedEvidence[0].attachments, undefined);
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
  assert.equal(compact.data.evidenceSummary.length, 2);
  assert.equal(detailed.data.evidenceSummary.length, 2);
});
