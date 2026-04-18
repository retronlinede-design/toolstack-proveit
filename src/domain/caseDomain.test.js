import test from "node:test";
import assert from "node:assert/strict";

import {
  applyRecordPatchToCase,
  convertQuickCaptureToRecord,
  deleteDocumentEntryFromCase,
  deleteLedgerEntryFromCase,
  deleteRecordFromCase,
  getIncidentLinkGroups,
  mergeCase,
  normalizeCase,
  normalizeRecord,
  syncCaseLinks,
  upsertDocumentEntryInCase,
  upsertLedgerEntryInCase,
  upsertRecordInCase,
} from "./caseDomain.js";

const iso = (value) => new Date(value).toISOString();

test("normalizeRecord applies shared timeline fields to evidence and preserves capturedAt behavior", () => {
  const attachment = { id: "file-1", name: "photo.png" };
  const createdAt = iso("2024-01-01T09:00:00Z");
  const updatedAt = iso("2024-01-02T09:00:00Z");

  const record = normalizeRecord({
    id: "ev-1",
    title: " Evidence ",
    date: "2024-02-03",
    attachments: [attachment],
    availability: {
      physical: { hasOriginal: true, location: "Box A", notes: "Original" },
      digital: { hasDigital: false, files: [] },
    },
    status: "not-a-valid-evidence-status",
    createdAt,
    updatedAt,
  }, "evidence");

  assert.equal(record.id, "ev-1");
  assert.equal(record.type, "evidence");
  assert.equal(record.title, " Evidence ");
  assert.equal(record.status, "needs_review");
  assert.equal(record.sourceType, "other");
  assert.equal(record.capturedAt, "2024-02-03");
  assert.equal(record.importance, "unreviewed");
  assert.equal(record.relevance, "medium");
  assert.equal(record.evidenceRole, "OTHER");
  assert.equal(record.sequenceGroup, "");
  assert.equal(record.functionSummary, "");
  assert.deepEqual(record.availability.physical, {
    hasOriginal: true,
    location: "Box A",
    notes: "Original",
  });
  assert.equal(record.availability.digital.hasDigital, true);
  assert.deepEqual(record.availability.digital.files, []);
  assert.equal(record.eventDate, "2024-02-03");
  assert.equal(record.createdAt, createdAt);
  assert.equal(record.updatedAt, updatedAt);
});

test("normalizeRecord preserves valid evidence structural fields", () => {
  const record = normalizeRecord({
    id: "ev-1",
    title: "Evidence",
    date: "2024-02-03",
    evidenceRole: "ANCHOR_EVIDENCE",
    sequenceGroup: "  Notice sequence  ",
    functionSummary: "  Shows the first written warning.  ",
    usedIn: ["Legacy use"],
  }, "evidence");

  assert.equal(record.evidenceRole, "ANCHOR_EVIDENCE");
  assert.equal(record.sequenceGroup, "Notice sequence");
  assert.equal(record.functionSummary, "Shows the first written warning.");
  assert.deepEqual(record.usedIn, ["Legacy use"]);
});

test("normalizeRecord defaults invalid evidenceRole to OTHER", () => {
  const record = normalizeRecord({
    id: "ev-1",
    title: "Evidence",
    date: "2024-02-03",
    evidenceRole: "anchor_evidence",
    sequenceGroup: 123,
    functionSummary: ["not-string"],
  }, "evidence");

  assert.equal(record.evidenceRole, "OTHER");
  assert.equal(record.sequenceGroup, "");
  assert.equal(record.functionSummary, "");
});

test("normalizeRecord keeps evidence capturedAt independent from eventDate", () => {
  const record = normalizeRecord({
    id: "ev-1",
    title: "Evidence",
    date: "2024-02-03",
    capturedAt: "2024-02-10",
    createdAt: iso("2024-01-01T09:00:00Z"),
  }, "evidence");

  assert.equal(record.eventDate, "2024-02-03");
  assert.equal(record.capturedAt, "2024-02-10");
});

test("normalizeRecord normalizes timeline-capable incident records", () => {
  const createdAt = iso("2024-04-02T10:00:00Z");

  const record = normalizeRecord({
    id: "inc-1",
    type: "wrong-type",
    title: "Incident",
    date: "2024-04-01",
    incidentDate: "2024-03-31",
    status: "invalid",
    createdAt,
  }, "incidents");

  assert.equal(record.type, "incidents");
  assert.equal(record.status, "open");
  assert.equal(record.eventDate, "2024-04-01");
  assert.equal(record.createdAt, createdAt);
  assert.equal(record.updatedAt, createdAt);
});

test("normalizeRecord preserves valid linkedIncidentRefs on incidents", () => {
  const record = normalizeRecord({
    id: "inc-1",
    title: "Incident",
    date: "2024-04-01",
    linkedIncidentRefs: [
      { incidentId: "inc-2", type: "CAUSES" },
      { incidentId: "inc-3", type: "RELATED_TO" },
    ],
  }, "incidents");

  assert.deepEqual(record.linkedIncidentRefs, [
    { incidentId: "inc-2", type: "CAUSES" },
    { incidentId: "inc-3", type: "RELATED_TO" },
  ]);
});

test("normalizeRecord drops invalid incident link refs", () => {
  const record = normalizeRecord({
    id: "inc-1",
    title: "Incident",
    date: "2024-04-01",
    linkedIncidentRefs: [
      { incidentId: "inc-2", type: "CAUSES" },
      { incidentId: "inc-3", type: "causes" },
      { incidentId: "", type: "RELATED_TO" },
      { incidentId: "inc-4", type: "BLOCKS" },
      null,
      "inc-5",
    ],
  }, "incidents");

  assert.deepEqual(record.linkedIncidentRefs, [
    { incidentId: "inc-2", type: "CAUSES" },
  ]);
});

test("normalizeRecord drops self incident links", () => {
  const record = normalizeRecord({
    id: "inc-1",
    title: "Incident",
    date: "2024-04-01",
    linkedIncidentRefs: [
      { incidentId: "inc-1", type: "CAUSES" },
      { incidentId: "inc-2", type: "RELATED_TO" },
    ],
  }, "incidents");

  assert.deepEqual(record.linkedIncidentRefs, [
    { incidentId: "inc-2", type: "RELATED_TO" },
  ]);
});

test("normalizeRecord dedupes incident link refs by target incident id", () => {
  const record = normalizeRecord({
    id: "inc-1",
    title: "Incident",
    date: "2024-04-01",
    linkedIncidentRefs: [
      { incidentId: "inc-2", type: "CAUSES" },
      { incidentId: "inc-2", type: "RELATED_TO" },
      { incidentId: "inc-3", type: "RELATED_TO" },
    ],
  }, "incidents");

  assert.deepEqual(record.linkedIncidentRefs, [
    { incidentId: "inc-2", type: "CAUSES" },
    { incidentId: "inc-3", type: "RELATED_TO" },
  ]);
});

test("normalizeRecord keeps incident linkedEvidenceIds unchanged with linkedIncidentRefs", () => {
  const record = normalizeRecord({
    id: "inc-1",
    title: "Incident",
    date: "2024-04-01",
    linkedEvidenceIds: ["ev-1"],
    linkedIncidentRefs: [{ incidentId: "inc-2", type: "CAUSES" }],
  }, "incidents");

  assert.deepEqual(record.linkedEvidenceIds, ["ev-1"]);
  assert.deepEqual(record.linkedIncidentRefs, [{ incidentId: "inc-2", type: "CAUSES" }]);
});

test("normalizeCase builds the current canonical shape and sorts timeline arrays", () => {
  const normalized = normalizeCase({
    id: "case-1",
    name: "  Housing Case  ",
    category: " HOUSING ",
    status: "invalid",
    notes: "notes",
    description: "description",
    tags: "not-array",
    createdAt: iso("2024-01-01"),
    updatedAt: iso("2024-01-02"),
    incidents: [
      { id: "inc-late", title: "Late", date: "2024-05-02", createdAt: iso("2024-05-02T09:00:00Z") },
      { id: "inc-early", title: "Early", date: "2024-05-01", createdAt: iso("2024-05-01T09:00:00Z") },
    ],
    evidence: [
      { id: "ev-b", title: "B", date: "2024-05-02" },
      { id: "ev-a", title: "A", date: "2024-05-01" },
    ],
    strategy: [
      { id: "str-2", title: "Second", date: "2024-06-02", createdAt: iso("2024-06-02T09:00:00Z") },
      { id: "str-1", title: "First", date: "2024-06-01", createdAt: iso("2024-06-01T09:00:00Z") },
    ],
    tasks: [{ id: "task-1", title: "Task", date: "2024-07-01", createdAt: iso("2024-07-01T09:00:00Z") }],
    ledger: [{ id: "ledger-1", category: "bad", label: "Rent", expectedAmount: "10", paidAmount: "4" }],
    documents: [{ id: "doc-1", title: "Doc", linkedRecordIds: "bad" }],
    actionSummary: {
      currentFocus: "Focus",
      nextActions: "bad",
      importantReminders: ["Remember"],
      strategyFocus: ["Strategy"],
      criticalDeadlines: ["currently dropped"],
    },
  });

  assert.equal(normalized.name, "Housing Case");
  assert.equal(normalized.category, "housing");
  assert.equal(normalized.status, "open");
  assert.deepEqual(normalized.tags, []);
  assert.deepEqual(normalized.incidents.map((item) => item.id), ["inc-early", "inc-late"]);
  assert.deepEqual(normalized.evidence.map((item) => item.id), ["ev-a", "ev-b"]);
  assert.deepEqual(normalized.evidence.map((item) => item.eventDate), ["2024-05-01", "2024-05-02"]);
  assert.deepEqual(normalized.strategy.map((item) => item.id), ["str-1", "str-2"]);
  assert.equal(normalized.ledger[0].category, "other");
  assert.equal(normalized.ledger[0].differenceAmount, 6);
  assert.deepEqual(normalized.documents[0].linkedRecordIds, []);
  assert.deepEqual(normalized.actionSummary, {
    currentFocus: "Focus",
    nextActions: [],
    importantReminders: ["Remember"],
    strategyFocus: ["Strategy"],
    criticalDeadlines: ["currently dropped"],
    updatedAt: "",
  });
});

test("syncCaseLinks updates incident-to-evidence reverse links and preserves unneeded records", () => {
  const caseItem = {
    id: "case-1",
    evidence: [
      { id: "ev-1", title: "Evidence 1", linkedIncidentIds: [] },
      { id: "ev-2", title: "Evidence 2", linkedIncidentIds: ["inc-1"] },
      { id: "ev-3", title: "Evidence 3", linkedIncidentIds: ["other-inc"] },
    ],
    incidents: [{ id: "inc-1", title: "Incident", linkedEvidenceIds: ["ev-1"] }],
  };

  const updated = syncCaseLinks(caseItem, caseItem.incidents[0], "incidents");
  const ev1 = updated.evidence.find((item) => item.id === "ev-1");
  const ev2 = updated.evidence.find((item) => item.id === "ev-2");
  const ev3 = updated.evidence.find((item) => item.id === "ev-3");

  assert.deepEqual(ev1.linkedIncidentIds, ["inc-1"]);
  assert.match(ev1.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(ev2.linkedIncidentIds, []);
  assert.match(ev2.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(ev3, caseItem.evidence[2]);
});

test("syncCaseLinks updates evidence-to-incident reverse links", () => {
  const caseItem = {
    id: "case-1",
    evidence: [{ id: "ev-1", title: "Evidence", linkedIncidentIds: ["inc-2"] }],
    incidents: [
      { id: "inc-1", title: "Incident 1", linkedEvidenceIds: ["ev-1"] },
      { id: "inc-2", title: "Incident 2", linkedEvidenceIds: [] },
    ],
  };

  const updated = syncCaseLinks(caseItem, caseItem.evidence[0], "evidence");
  const inc1 = updated.incidents.find((item) => item.id === "inc-1");
  const inc2 = updated.incidents.find((item) => item.id === "inc-2");

  assert.deepEqual(inc1.linkedEvidenceIds, []);
  assert.match(inc1.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(inc2.linkedEvidenceIds, ["ev-1"]);
  assert.match(inc2.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("applyRecordPatchToCase patches incidents and syncs evidence links", () => {
  const caseItem = normalizeCase({
    id: "case-1",
    name: "Case",
    incidents: [{
      id: "inc-1",
      title: "Old incident",
      date: "2024-01-01",
      description: "Old",
      linkedEvidenceIds: [],
      createdAt: iso("2024-01-01T09:00:00Z"),
    }],
    evidence: [{ id: "ev-1", title: "Evidence", linkedIncidentIds: [] }],
  });

  const updated = applyRecordPatchToCase(caseItem, "incidents", "inc-1", {
    title: "New incident",
    linkedEvidenceIds: ["ev-1"],
    edited: true,
  });

  assert.notEqual(updated, caseItem);
  assert.equal(updated.incidents[0].id, "inc-1");
  assert.equal(updated.incidents[0].title, "New incident");
  assert.equal(updated.incidents[0].description, "Old");
  assert.deepEqual(updated.incidents[0].linkedEvidenceIds, ["ev-1"]);
  assert.equal(updated.incidents[0].edited, true);
  assert.deepEqual(updated.evidence[0].linkedIncidentIds, ["inc-1"]);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("applyRecordPatchToCase preserves current unsupported-type and missing-record behavior", () => {
  const caseItem = normalizeCase({
    id: "case-1",
    name: "Case",
    evidence: [{ id: "ev-1", title: "Evidence" }],
    strategy: [{ id: "str-1", title: "Strategy", date: "2024-01-01" }],
  });

  assert.equal(applyRecordPatchToCase(caseItem, "evidence", "ev-1", { title: "Ignored" }), caseItem);
  assert.equal(applyRecordPatchToCase(caseItem, "strategy", "missing", { title: "Ignored" }), caseItem);
});

test("deleteRecordFromCase removes deleted incident id from linked evidence only", () => {
  const unchangedEvidence = {
    id: "ev-unchanged",
    title: "Unchanged evidence",
    linkedIncidentIds: ["inc-other"],
    updatedAt: iso("2024-01-01T09:00:00Z"),
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    incidents: [
      { id: "inc-delete", title: "Delete me" },
      { id: "inc-keep", title: "Keep me" },
    ],
    evidence: [
      { id: "ev-linked", title: "Linked evidence", linkedIncidentIds: ["inc-delete", "inc-other"] },
      unchangedEvidence,
    ],
  };

  const updated = deleteRecordFromCase(caseItem, "incidents", "inc-delete");
  const linkedEvidence = updated.evidence.find((item) => item.id === "ev-linked");

  assert.deepEqual(updated.incidents.map((item) => item.id), ["inc-keep"]);
  assert.deepEqual(linkedEvidence.linkedIncidentIds, ["inc-other"]);
  assert.match(linkedEvidence.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(updated.evidence.find((item) => item.id === "ev-unchanged"), unchangedEvidence);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("deleteRecordFromCase removes dangling incident refs and preserves unrelated incidents", () => {
  const unchangedIncident = {
    id: "inc-unchanged",
    title: "Unchanged incident",
    linkedIncidentRefs: [{ incidentId: "inc-other", type: "RELATED_TO" }],
    updatedAt: iso("2024-01-01T09:00:00Z"),
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    incidents: [
      { id: "inc-delete", title: "Delete me" },
      {
        id: "inc-changed",
        title: "Changed incident",
        linkedIncidentRefs: [
          { incidentId: "inc-delete", type: "CAUSES" },
          { incidentId: "inc-other", type: "RELATED_TO" },
        ],
        updatedAt: iso("2024-01-01T09:30:00Z"),
      },
      unchangedIncident,
    ],
    evidence: [
      { id: "ev-linked", title: "Linked evidence", linkedIncidentIds: ["inc-delete", "inc-other"] },
    ],
  };

  const updated = deleteRecordFromCase(caseItem, "incidents", "inc-delete");
  const changedIncident = updated.incidents.find((item) => item.id === "inc-changed");
  const linkedEvidence = updated.evidence.find((item) => item.id === "ev-linked");

  assert.deepEqual(updated.incidents.map((item) => item.id), ["inc-changed", "inc-unchanged"]);
  assert.deepEqual(changedIncident.linkedIncidentRefs, [
    { incidentId: "inc-other", type: "RELATED_TO" },
  ]);
  assert.match(changedIncident.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(changedIncident.updatedAt, "2024-01-01T09:30:00.000Z");
  assert.equal(updated.incidents.find((item) => item.id === "inc-unchanged"), unchangedIncident);
  assert.deepEqual(linkedEvidence.linkedIncidentIds, ["inc-other"]);
  assert.match(linkedEvidence.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("getIncidentLinkGroups puts outgoing CAUSES in outcomes", () => {
  const outcome = { id: "inc-outcome", title: "Outcome" };
  const caseItem = {
    incidents: [
      {
        id: "inc-current",
        title: "Current",
        linkedIncidentRefs: [{ incidentId: "inc-outcome", type: "CAUSES" }],
      },
      outcome,
    ],
  };

  const groups = getIncidentLinkGroups(caseItem, "inc-current");

  assert.deepEqual(groups.outcomes, [
    { ref: { incidentId: "inc-outcome", type: "CAUSES" }, incident: outcome },
  ]);
  assert.deepEqual(groups.causes, []);
  assert.deepEqual(groups.related, []);
});

test("getIncidentLinkGroups puts incoming CAUSES in causes", () => {
  const cause = {
    id: "inc-cause",
    title: "Cause",
    linkedIncidentRefs: [{ incidentId: "inc-current", type: "CAUSES" }],
  };
  const caseItem = {
    incidents: [
      { id: "inc-current", title: "Current" },
      cause,
    ],
  };

  const groups = getIncidentLinkGroups(caseItem, "inc-current");

  assert.deepEqual(groups.outcomes, []);
  assert.deepEqual(groups.causes, [
    { ref: { incidentId: "inc-current", type: "CAUSES" }, incident: cause },
  ]);
  assert.deepEqual(groups.related, []);
});

test("getIncidentLinkGroups shows RELATED_TO symmetrically in related", () => {
  const outgoingRelated = { id: "inc-outgoing", title: "Outgoing related" };
  const incomingRelated = {
    id: "inc-incoming",
    title: "Incoming related",
    linkedIncidentRefs: [{ incidentId: "inc-current", type: "RELATED_TO" }],
  };
  const caseItem = {
    incidents: [
      {
        id: "inc-current",
        title: "Current",
        linkedIncidentRefs: [{ incidentId: "inc-outgoing", type: "RELATED_TO" }],
      },
      outgoingRelated,
      incomingRelated,
    ],
  };

  const groups = getIncidentLinkGroups(caseItem, "inc-current");

  assert.deepEqual(groups.related, [
    { ref: { incidentId: "inc-outgoing", type: "RELATED_TO" }, incident: outgoingRelated },
    { ref: { incidentId: "inc-current", type: "RELATED_TO" }, incident: incomingRelated },
  ]);
});

test("getIncidentLinkGroups ignores missing target incidents safely", () => {
  const caseItem = {
    incidents: [
      {
        id: "inc-current",
        title: "Current",
        linkedIncidentRefs: [
          { incidentId: "inc-missing-outcome", type: "CAUSES" },
          { incidentId: "inc-missing-related", type: "RELATED_TO" },
        ],
      },
      {
        id: "inc-cause",
        title: "Cause",
        linkedIncidentRefs: [{ incidentId: "inc-current", type: "CAUSES" }],
      },
    ],
  };

  const groups = getIncidentLinkGroups(caseItem, "inc-current");

  assert.deepEqual(groups.outcomes, []);
  assert.deepEqual(groups.causes, [
    {
      ref: { incidentId: "inc-current", type: "CAUSES" },
      incident: caseItem.incidents[1],
    },
  ]);
  assert.deepEqual(groups.related, []);
  assert.deepEqual(getIncidentLinkGroups(caseItem, "missing"), {
    outcomes: [],
    causes: [],
    related: [],
  });
});

test("getIncidentLinkGroups dedupes related results", () => {
  const related = {
    id: "inc-related",
    title: "Related",
    linkedIncidentRefs: [{ incidentId: "inc-current", type: "RELATED_TO" }],
  };
  const caseItem = {
    incidents: [
      {
        id: "inc-current",
        title: "Current",
        linkedIncidentRefs: [{ incidentId: "inc-related", type: "RELATED_TO" }],
      },
      related,
    ],
  };

  const groups = getIncidentLinkGroups(caseItem, "inc-current");

  assert.deepEqual(groups.related, [
    { ref: { incidentId: "inc-related", type: "RELATED_TO" }, incident: related },
  ]);
});

test("deleteRecordFromCase removes deleted evidence id from linked incidents only", () => {
  const unchangedIncident = {
    id: "inc-unchanged",
    title: "Unchanged incident",
    linkedEvidenceIds: ["ev-other"],
    updatedAt: iso("2024-01-01T09:00:00Z"),
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence: [
      { id: "ev-delete", title: "Delete me" },
      { id: "ev-keep", title: "Keep me" },
    ],
    incidents: [
      { id: "inc-linked", title: "Linked incident", linkedEvidenceIds: ["ev-delete", "ev-other"] },
      unchangedIncident,
    ],
  };

  const updated = deleteRecordFromCase(caseItem, "evidence", "ev-delete");
  const linkedIncident = updated.incidents.find((item) => item.id === "inc-linked");

  assert.deepEqual(updated.evidence.map((item) => item.id), ["ev-keep"]);
  assert.deepEqual(linkedIncident.linkedEvidenceIds, ["ev-other"]);
  assert.match(linkedIncident.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(updated.incidents.find((item) => item.id === "inc-unchanged"), unchangedIncident);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("deleteRecordFromCase preserves non-linking record type delete behavior", () => {
  const evidence = [{ id: "ev-1", linkedIncidentIds: ["inc-1"] }];
  const incidents = [{ id: "inc-1", linkedEvidenceIds: ["ev-1"] }];
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence,
    incidents,
    strategy: [
      { id: "str-delete", title: "Delete me" },
      { id: "str-keep", title: "Keep me" },
    ],
  };

  const updated = deleteRecordFromCase(caseItem, "strategy", "str-delete");

  assert.deepEqual(updated.strategy.map((item) => item.id), ["str-keep"]);
  assert.equal(updated.evidence, evidence);
  assert.equal(updated.incidents, incidents);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("deleteLedgerEntryFromCase removes target ledger entry and preserves unrelated unnormalized data", () => {
  const evidence = [{ id: "ev-1", title: "Evidence without normalized timeline fields" }];
  const actionSummary = {
    currentFocus: "Focus",
    nextActions: "not-normalized",
    criticalDeadlines: "not-normalized",
  };
  const documents = [{ id: "doc-1", title: "Document", linkedRecordIds: "not-normalized" }];
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence,
    actionSummary,
    documents,
    ledger: [
      { id: "ledger-delete", label: "Delete me" },
      { id: "ledger-keep", label: "Keep me" },
    ],
  };

  const updated = deleteLedgerEntryFromCase(caseItem, "ledger-delete");

  assert.deepEqual(updated.ledger.map((item) => item.id), ["ledger-keep"]);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.evidence, evidence);
  assert.equal(updated.actionSummary, actionSummary);
  assert.equal(updated.documents, documents);
  assert.equal(updated.evidence[0].eventDate, undefined);
  assert.equal(updated.actionSummary.nextActions, "not-normalized");
  assert.equal(updated.documents[0].linkedRecordIds, "not-normalized");
});

test("deleteDocumentEntryFromCase removes target document entry and preserves unrelated unnormalized data", () => {
  const incidents = [{ id: "inc-1", title: "Incident without normalized timeline fields" }];
  const actionSummary = {
    currentFocus: "Focus",
    nextActions: "not-normalized",
    criticalDeadlines: "not-normalized",
  };
  const ledger = [{ id: "ledger-1", label: "Ledger", expectedAmount: "not-normalized" }];
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    incidents,
    actionSummary,
    ledger,
    documents: [
      { id: "doc-delete", title: "Delete me" },
      { id: "doc-keep", title: "Keep me" },
    ],
  };

  const updated = deleteDocumentEntryFromCase(caseItem, "doc-delete");

  assert.deepEqual(updated.documents.map((item) => item.id), ["doc-keep"]);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.incidents, incidents);
  assert.equal(updated.actionSummary, actionSummary);
  assert.equal(updated.ledger, ledger);
  assert.equal(updated.incidents[0].eventDate, undefined);
  assert.equal(updated.actionSummary.nextActions, "not-normalized");
  assert.equal(updated.ledger[0].expectedAmount, "not-normalized");
});

test("upsertRecordInCase create prepends non-timeline records and preserves unrelated sections", () => {
  const evidence = [{ id: "ev-1", title: "Evidence" }];
  const ledger = [{ id: "ledger-1", label: "Ledger" }];
  const existingTask = { id: "task-old", title: "Old task" };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence,
    ledger,
    tasks: [existingTask],
  };

  const updated = upsertRecordInCase(caseItem, "tasks", {
    id: "task-new",
    title: " New task ",
    date: "2024-02-01",
    description: " Description ",
    notes: " Notes ",
    attachments: [],
    availability: { digital: { files: [], hasDigital: false } },
    linkedIncidentIds: [],
    linkedEvidenceIds: [],
    linkedRecordIds: ["ev-1"],
  });

  assert.deepEqual(updated.tasks.map((item) => item.id), ["task-new", "task-old"]);
  assert.equal(updated.tasks[0].title, "New task");
  assert.equal(updated.tasks[0].description, "Description");
  assert.deepEqual(updated.tasks[0].linkedRecordIds, ["ev-1"]);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.evidence, evidence);
  assert.equal(updated.ledger, ledger);
});

test("upsertRecordInCase edit replaces an existing record by id and refreshes case timestamp", () => {
  const documents = [{ id: "doc-1", title: "Document" }];
  const unchangedTask = { id: "task-2", title: "Keep task" };
  const editingRecord = {
    id: "task-1",
    title: "Old task",
    date: "2024-01-01",
    description: "Old",
    notes: "Old notes",
    linkedRecordIds: ["old-link"],
    createdAt: iso("2024-01-01T09:00:00Z"),
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    documents,
    tasks: [editingRecord, unchangedTask],
  };

  const updated = upsertRecordInCase(caseItem, "tasks", {
    title: " Updated task ",
    date: "2024-03-01",
    description: " Updated description ",
    notes: " Updated notes ",
    attachments: [],
    availability: { digital: { files: [], hasDigital: false } },
    linkedIncidentIds: [],
    linkedEvidenceIds: [],
  }, editingRecord);

  assert.equal(updated.tasks.length, 2);
  assert.equal(updated.tasks[0].id, "task-1");
  assert.equal(updated.tasks[0].title, "Updated task");
  assert.equal(updated.tasks[0].description, "Updated description");
  assert.equal(updated.tasks[0].notes, "Updated notes");
  assert.deepEqual(updated.tasks[0].linkedRecordIds, ["old-link"]);
  assert.equal(updated.tasks[0].edited, true);
  assert.equal(updated.tasks[1], unchangedTask);
  assert.match(updated.tasks[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.documents, documents);
});

test("upsertRecordInCase mirrors evidence attachments into availability and syncs linked incidents", () => {
  const attachment = { id: "att-1", name: "photo.png" };
  const ledger = [{ id: "ledger-1", label: "Ledger" }];
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    ledger,
    evidence: [],
    incidents: [
      { id: "inc-1", title: "Incident", linkedEvidenceIds: [] },
    ],
  };

  const updated = upsertRecordInCase(caseItem, "evidence", {
    id: "ev-1",
    title: "Evidence",
    date: "2024-02-01",
    description: "",
    notes: "",
    attachments: [attachment],
    availability: {
      physical: { hasOriginal: false, location: "", notes: "" },
      digital: { hasDigital: false, files: [] },
    },
    linkedIncidentIds: ["inc-1"],
    linkedEvidenceIds: [],
    linkedRecordIds: [],
  });

  assert.equal(updated.evidence[0].id, "ev-1");
  assert.deepEqual(updated.evidence[0].attachments, [attachment]);
  assert.deepEqual(updated.evidence[0].availability.digital.files, [attachment]);
  assert.equal(updated.evidence[0].availability.digital.hasDigital, true);
  assert.deepEqual(updated.incidents[0].linkedEvidenceIds, ["ev-1"]);
  assert.match(updated.incidents[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(updated.ledger, ledger);
});

test("upsertRecordInCase persists evidence structural fields on create", () => {
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence: [],
    incidents: [
      { id: "inc-1", title: "Incident", linkedEvidenceIds: [] },
    ],
  };

  const updated = upsertRecordInCase(caseItem, "evidence", {
    id: "ev-1",
    title: "Evidence",
    date: "2024-02-01",
    description: "",
    notes: "",
    attachments: [],
    availability: {
      physical: { hasOriginal: false, location: "", notes: "" },
      digital: { hasDigital: false, files: [] },
    },
    importance: "critical",
    relevance: "high",
    status: "verified",
    usedIn: ["Legacy"],
    reviewNotes: "Review note",
    evidenceRole: "TIMELINE_EVIDENCE",
    sequenceGroup: "  Repair sequence  ",
    functionSummary: "  Places the repair request in sequence.  ",
    linkedIncidentIds: ["inc-1"],
    linkedEvidenceIds: [],
    linkedRecordIds: [],
  });

  assert.equal(updated.evidence[0].evidenceRole, "TIMELINE_EVIDENCE");
  assert.equal(updated.evidence[0].sequenceGroup, "Repair sequence");
  assert.equal(updated.evidence[0].functionSummary, "Places the repair request in sequence.");
  assert.deepEqual(updated.evidence[0].usedIn, ["Legacy"]);
  assert.deepEqual(updated.evidence[0].linkedIncidentIds, ["inc-1"]);
  assert.deepEqual(updated.incidents[0].linkedEvidenceIds, ["ev-1"]);
});

test("upsertRecordInCase persists evidence structural fields on edit", () => {
  const editingRecord = {
    id: "ev-1",
    title: "Old evidence",
    date: "2024-02-01",
    attachments: [],
    availability: {
      physical: { hasOriginal: false, location: "", notes: "" },
      digital: { hasDigital: false, files: [] },
    },
    evidenceRole: "OTHER",
    sequenceGroup: "Old sequence",
    functionSummary: "Old function",
    linkedIncidentIds: [],
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence: [editingRecord],
    incidents: [
      { id: "inc-1", title: "Incident", linkedEvidenceIds: [] },
    ],
  };

  const updated = upsertRecordInCase(caseItem, "evidence", {
    title: "Updated evidence",
    date: "2024-02-02",
    description: "",
    notes: "",
    attachments: [],
    availability: {
      physical: { hasOriginal: false, location: "", notes: "" },
      digital: { hasDigital: false, files: [] },
    },
    evidenceRole: "CORROBORATING_EVIDENCE",
    sequenceGroup: "  Updated sequence  ",
    functionSummary: "  Corroborates the incident report.  ",
    linkedIncidentIds: ["inc-1"],
    linkedEvidenceIds: [],
  }, editingRecord);

  assert.equal(updated.evidence[0].evidenceRole, "CORROBORATING_EVIDENCE");
  assert.equal(updated.evidence[0].sequenceGroup, "Updated sequence");
  assert.equal(updated.evidence[0].functionSummary, "Corroborates the incident report.");
  assert.deepEqual(updated.evidence[0].linkedIncidentIds, ["inc-1"]);
  assert.deepEqual(updated.incidents[0].linkedEvidenceIds, ["ev-1"]);
  assert.equal(updated.evidence[0].edited, true);
});

test("upsertRecordInCase forces evidence digital availability false when attachments are empty", () => {
  const editingRecord = {
    id: "ev-1",
    title: "Old evidence",
    date: "2024-02-01",
    attachments: [{ id: "old-att", name: "old.png" }],
    availability: {
      physical: { hasOriginal: false, location: "", notes: "" },
      digital: { hasDigital: true, files: [{ id: "old-att", name: "old.png" }] },
    },
    linkedIncidentIds: [],
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence: [editingRecord],
    incidents: [],
  };

  const updated = upsertRecordInCase(caseItem, "evidence", {
    title: "Updated evidence",
    date: "2024-02-02",
    description: "",
    notes: "",
    attachments: [],
    availability: {
      physical: { hasOriginal: false, location: "", notes: "" },
      digital: { hasDigital: true, files: [{ id: "old-att", name: "old.png" }] },
    },
    linkedIncidentIds: [],
    linkedEvidenceIds: [],
  }, editingRecord);

  assert.deepEqual(updated.evidence[0].attachments, []);
  assert.deepEqual(updated.evidence[0].availability.digital.files, []);
  assert.equal(updated.evidence[0].availability.digital.hasDigital, false);
  assert.equal(updated.evidence[0].edited, true);
});

test("upsertRecordInCase sorts timeline-capable records after upsert and syncs incident links", () => {
  const documents = [{ id: "doc-1", title: "Document" }];
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    documents,
    incidents: [
      { id: "inc-late", title: "Late", date: "2024-03-03", eventDate: "2024-03-03", createdAt: iso("2024-03-03T09:00:00Z"), linkedEvidenceIds: [] },
    ],
    evidence: [
      { id: "ev-1", title: "Evidence", date: "2024-03-02", eventDate: "2024-03-02", linkedIncidentIds: [] },
    ],
  };

  const updated = upsertRecordInCase(caseItem, "incidents", {
    id: "inc-early",
    title: "Early",
    date: "2024-03-01",
    description: "",
    notes: "",
    attachments: [],
    availability: { digital: { files: [], hasDigital: false } },
    linkedIncidentIds: [],
    linkedEvidenceIds: ["ev-1"],
    linkedRecordIds: [],
  });

  assert.deepEqual(updated.incidents.map((item) => item.id), ["inc-early", "inc-late"]);
  assert.deepEqual(updated.evidence[0].linkedIncidentIds, ["inc-early"]);
  assert.match(updated.evidence[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.documents, documents);
});

test("upsertRecordInCase persists linkedIncidentRefs on incident create", () => {
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    incidents: [
      { id: "inc-existing", title: "Existing", date: "2024-03-03", eventDate: "2024-03-03", createdAt: iso("2024-03-03T09:00:00Z"), linkedEvidenceIds: [] },
    ],
    evidence: [
      { id: "ev-1", title: "Evidence", date: "2024-03-02", eventDate: "2024-03-02", linkedIncidentIds: [] },
    ],
  };

  const updated = upsertRecordInCase(caseItem, "incidents", {
    id: "inc-new",
    title: "New incident",
    date: "2024-03-01",
    description: "",
    notes: "",
    attachments: [],
    availability: { digital: { files: [], hasDigital: false } },
    linkedIncidentIds: [],
    linkedEvidenceIds: ["ev-1"],
    linkedIncidentRefs: [
      { incidentId: "inc-existing", type: "CAUSES" },
      { incidentId: "inc-new", type: "RELATED_TO" },
    ],
    linkedRecordIds: [],
  });

  const created = updated.incidents.find((item) => item.id === "inc-new");
  assert.deepEqual(created.linkedIncidentRefs, [
    { incidentId: "inc-existing", type: "CAUSES" },
  ]);
  assert.deepEqual(created.linkedEvidenceIds, ["ev-1"]);
  assert.deepEqual(updated.evidence[0].linkedIncidentIds, ["inc-new"]);
});

test("upsertRecordInCase persists linkedIncidentRefs on incident edit", () => {
  const editingRecord = {
    id: "inc-1",
    title: "Old incident",
    date: "2024-03-01",
    description: "Old",
    notes: "",
    linkedEvidenceIds: ["ev-old"],
    linkedIncidentRefs: [{ incidentId: "inc-old", type: "RELATED_TO" }],
    createdAt: iso("2024-03-01T09:00:00Z"),
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    incidents: [
      editingRecord,
      { id: "inc-2", title: "Second", date: "2024-03-02", eventDate: "2024-03-02", createdAt: iso("2024-03-02T09:00:00Z"), linkedEvidenceIds: [] },
    ],
    evidence: [
      { id: "ev-1", title: "Evidence", date: "2024-03-02", eventDate: "2024-03-02", linkedIncidentIds: [] },
      { id: "ev-old", title: "Old Evidence", date: "2024-03-02", eventDate: "2024-03-02", linkedIncidentIds: ["inc-1"] },
    ],
  };

  const updated = upsertRecordInCase(caseItem, "incidents", {
    title: "Updated incident",
    date: "2024-03-01",
    description: "Updated",
    notes: "",
    attachments: [],
    availability: { digital: { files: [], hasDigital: false } },
    linkedIncidentIds: [],
    linkedEvidenceIds: ["ev-1"],
    linkedIncidentRefs: [
      { incidentId: "inc-2", type: "RELATED_TO" },
      { incidentId: "inc-2", type: "CAUSES" },
    ],
  }, editingRecord);

  const edited = updated.incidents.find((item) => item.id === "inc-1");
  assert.equal(edited.title, "Updated incident");
  assert.deepEqual(edited.linkedIncidentRefs, [
    { incidentId: "inc-2", type: "RELATED_TO" },
  ]);
  assert.deepEqual(edited.linkedEvidenceIds, ["ev-1"]);
  assert.deepEqual(updated.evidence.find((item) => item.id === "ev-1").linkedIncidentIds, ["inc-1"]);
  assert.deepEqual(updated.evidence.find((item) => item.id === "ev-old").linkedIncidentIds, []);
});

test("convertQuickCaptureToRecord creates a record, prepends non-timeline targets, and marks capture converted", () => {
  const evidence = [{ id: "ev-1", title: "Evidence" }];
  const existingTask = { id: "task-old", title: "Old task" };
  const capture = {
    id: "capture-1",
    caseId: "case-1",
    title: "Captured task",
    date: "2024-04-01",
    note: "Captured note",
    attachments: [{ id: "att-1", name: "note.png" }],
    status: "unreviewed",
    convertedTo: null,
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence,
    tasks: [existingTask],
  };

  const result = convertQuickCaptureToRecord(caseItem, capture, "tasks");

  assert.equal(result.case.tasks[0], result.record);
  assert.equal(result.case.tasks[1], existingTask);
  assert.equal(result.record.title, "Captured task");
  assert.equal(result.record.date, "2024-04-01");
  assert.equal(result.record.description, "Captured note");
  assert.match(result.record.notes, /^Converted from Quick Capture on /);
  assert.deepEqual(result.record.attachments, capture.attachments);
  assert.match(result.record.id, /.+/);
  assert.match(result.case.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(result.case.updatedAt, caseItem.updatedAt);
  assert.equal(result.case.evidence, evidence);
  assert.deepEqual(result.capture, {
    ...capture,
    status: "converted",
    convertedTo: "tasks",
    updatedAt: result.capture.updatedAt,
  });
  assert.match(result.capture.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("convertQuickCaptureToRecord preserves timeline sort behavior for target collections", () => {
  const capture = {
    id: "capture-1",
    caseId: "case-1",
    title: "Early incident",
    date: "2024-01-01",
    note: "Captured note",
    status: "unreviewed",
    convertedTo: null,
  };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    incidents: [
      { id: "inc-late", title: "Late incident", date: "2024-02-01", eventDate: "2024-02-01", createdAt: iso("2024-02-01T09:00:00Z") },
    ],
  };

  const result = convertQuickCaptureToRecord(caseItem, capture, "incidents");

  assert.deepEqual(result.case.incidents.map((item) => item.id), [result.record.id, "inc-late"]);
  assert.equal(result.record.type, "incidents");
  assert.equal(result.capture.convertedTo, "incidents");
});

test("convertQuickCaptureToRecord preserves current edge behavior for missing attachments and does not sync links", () => {
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence: [],
    incidents: [
      { id: "inc-1", title: "Incident", linkedEvidenceIds: [] },
    ],
  };
  const capture = {
    id: "capture-1",
    caseId: "case-1",
    title: "Captured evidence",
    date: "2024-03-01",
    note: "Evidence note",
    status: "unreviewed",
    convertedTo: null,
  };

  const result = convertQuickCaptureToRecord(caseItem, capture, "evidence");

  assert.deepEqual(result.record.attachments, []);
  assert.deepEqual(result.record.linkedIncidentIds, []);
  assert.deepEqual(result.case.incidents[0].linkedEvidenceIds, []);
  assert.equal(result.capture.status, "converted");
  assert.equal(result.capture.convertedTo, "evidence");
});

test("upsertLedgerEntryInCase create appends a normalized ledger entry and refreshes case timestamp", () => {
  const evidence = [{ id: "ev-1", title: "Evidence" }];
  const documents = [{ id: "doc-1", title: "Document" }];
  const existingLedger = { id: "ledger-existing", label: "Existing", expectedAmount: 5, paidAmount: 2 };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence,
    documents,
    ledger: [existingLedger],
  };

  const updated = upsertLedgerEntryInCase(caseItem, {
    label: "Rent",
    expectedAmount: "100",
    paidAmount: "40",
  });

  assert.equal(updated.ledger.length, 2);
  assert.equal(updated.ledger[0], existingLedger);
  assert.equal(updated.ledger[1].label, "Rent");
  assert.equal(updated.ledger[1].category, "other");
  assert.equal(updated.ledger[1].currency, "EUR");
  assert.equal(updated.ledger[1].status, "planned");
  assert.equal(updated.ledger[1].method, "bank_transfer");
  assert.equal(updated.ledger[1].proofStatus, "missing");
  assert.equal(updated.ledger[1].expectedAmount, 100);
  assert.equal(updated.ledger[1].paidAmount, 40);
  assert.equal(updated.ledger[1].differenceAmount, 60);
  assert.equal(updated.ledger[1].edited, false);
  assert.match(updated.ledger[1].id, /.+/);
  assert.match(updated.ledger[1].createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(updated.ledger[1].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.evidence, evidence);
  assert.equal(updated.documents, documents);
});

test("upsertLedgerEntryInCase edit replaces an existing ledger entry by id and preserves unrelated sections", () => {
  const incidents = [{ id: "inc-1", title: "Incident" }];
  const strategy = [{ id: "str-1", title: "Strategy" }];
  const unchangedLedger = { id: "ledger-2", label: "Keep", expectedAmount: 7, paidAmount: 7 };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    incidents,
    strategy,
    ledger: [
      {
        id: "ledger-1",
        label: "Old Rent",
        category: "rent",
        expectedAmount: "100",
        paidAmount: "20",
        createdAt: iso("2024-01-01T09:00:00Z"),
        updatedAt: iso("2024-01-01T09:00:00Z"),
      },
      unchangedLedger,
    ],
  };

  const updated = upsertLedgerEntryInCase(caseItem, {
    label: "Updated Rent",
    expectedAmount: "100",
    paidAmount: "80",
  }, "ledger-1");

  assert.equal(updated.ledger.length, 2);
  assert.equal(updated.ledger[0].id, "ledger-1");
  assert.equal(updated.ledger[0].label, "Updated Rent");
  assert.equal(updated.ledger[0].category, "rent");
  assert.equal(updated.ledger[0].expectedAmount, 100);
  assert.equal(updated.ledger[0].paidAmount, 80);
  assert.equal(updated.ledger[0].differenceAmount, 20);
  assert.equal(updated.ledger[0].edited, true);
  assert.equal(updated.ledger[0].createdAt, iso("2024-01-01T09:00:00Z"));
  assert.match(updated.ledger[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(updated.ledger[1], unchangedLedger);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.incidents, incidents);
  assert.equal(updated.strategy, strategy);
});

test("upsertDocumentEntryInCase create appends a normalized document entry with attachments and refreshes case timestamp", () => {
  const attachment = { id: "att-1", name: "lease.pdf" };
  const evidence = [{ id: "ev-1", title: "Evidence" }];
  const ledger = [{ id: "ledger-1", label: "Ledger" }];
  const existingDocument = { id: "doc-existing", title: "Existing document" };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    evidence,
    ledger,
    documents: [existingDocument],
  };

  const updated = upsertDocumentEntryInCase(caseItem, {
    title: "Lease",
    attachments: [attachment],
    linkedRecordIds: "not-array",
  });

  assert.equal(updated.documents.length, 2);
  assert.equal(updated.documents[0], existingDocument);
  assert.equal(updated.documents[1].title, "Lease");
  assert.equal(updated.documents[1].category, "other");
  assert.equal(updated.documents[1].documentDate, "");
  assert.equal(updated.documents[1].source, "");
  assert.equal(updated.documents[1].summary, "");
  assert.equal(updated.documents[1].textContent, "");
  assert.deepEqual(updated.documents[1].attachments, [attachment]);
  assert.deepEqual(updated.documents[1].linkedRecordIds, []);
  assert.equal(updated.documents[1].edited, false);
  assert.match(updated.documents[1].id, /.+/);
  assert.match(updated.documents[1].createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(updated.documents[1].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.evidence, evidence);
  assert.equal(updated.ledger, ledger);
});

test("upsertDocumentEntryInCase edit replaces an existing document entry by id and preserves unrelated sections", () => {
  const incidents = [{ id: "inc-1", title: "Incident" }];
  const strategy = [{ id: "str-1", title: "Strategy" }];
  const unchangedDocument = { id: "doc-2", title: "Keep" };
  const existingAttachment = { id: "att-old", name: "old.pdf" };
  const newAttachment = { id: "att-new", name: "new.pdf" };
  const caseItem = {
    id: "case-1",
    updatedAt: iso("2024-01-01T08:00:00Z"),
    incidents,
    strategy,
    documents: [
      {
        id: "doc-1",
        title: "Old title",
        category: "notice",
        attachments: [existingAttachment],
        linkedRecordIds: ["ev-1"],
        createdAt: iso("2024-01-01T09:00:00Z"),
        updatedAt: iso("2024-01-01T09:00:00Z"),
      },
      unchangedDocument,
    ],
  };

  const updated = upsertDocumentEntryInCase(caseItem, {
    title: "Updated title",
    attachments: [newAttachment],
  }, "doc-1");

  assert.equal(updated.documents.length, 2);
  assert.equal(updated.documents[0].id, "doc-1");
  assert.equal(updated.documents[0].title, "Updated title");
  assert.equal(updated.documents[0].category, "notice");
  assert.deepEqual(updated.documents[0].attachments, [newAttachment]);
  assert.deepEqual(updated.documents[0].linkedRecordIds, ["ev-1"]);
  assert.equal(updated.documents[0].edited, true);
  assert.equal(updated.documents[0].createdAt, iso("2024-01-01T09:00:00Z"));
  assert.match(updated.documents[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(updated.documents[1], unchangedDocument);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(updated.updatedAt, caseItem.updatedAt);
  assert.equal(updated.incidents, incidents);
  assert.equal(updated.strategy, strategy);
});

test("mergeCase normalizes both sides, merges collections by id, and keeps current action summary selection", () => {
  const existing = {
    id: "case-1",
    name: "Existing Name",
    category: "housing",
    status: "open",
    notes: "existing notes",
    description: "existing description",
    tags: ["existing", "shared"],
    createdAt: iso("2024-01-01"),
    updatedAt: iso("2024-01-02"),
    incidents: [
      { id: "inc-1", title: "Existing incident", date: "2024-01-02", description: "existing", createdAt: iso("2024-01-02T09:00:00Z") },
    ],
    evidence: [{ id: "ev-1", title: "Existing evidence", linkedIncidentIds: ["inc-1"] }],
    tasks: [{ id: "task-1", title: "Existing task" }],
    strategy: [{ id: "str-1", title: "Existing strategy", date: "2024-01-04", createdAt: iso("2024-01-04T09:00:00Z") }],
    ledger: [{ id: "ledger-1", label: "Old ledger", expectedAmount: "5", paidAmount: "2" }],
    documents: [{ id: "doc-1", title: "Old doc", summary: "old" }],
    actionSummary: {
      currentFocus: "Existing focus",
      nextActions: ["Existing action"],
      importantReminders: [],
      strategyFocus: [],
      updatedAt: "existing-summary-time",
    },
  };

  const incoming = {
    id: "case-1",
    name: "Incoming Name",
    category: "",
    status: "archived",
    notes: "",
    description: "incoming description",
    tags: ["incoming", "shared"],
    updatedAt: iso("2024-02-01"),
    incidents: [
      { id: "inc-1", title: "Incoming incident", date: "2024-01-03", linkedEvidenceIds: ["ev-1"] },
      { id: "inc-2", title: "New incident", date: "2024-01-01" },
    ],
    evidence: [{ id: "ev-2", title: "Incoming evidence" }],
    ledger: [{ id: "ledger-1", label: "New ledger", expectedAmount: "9", paidAmount: "3" }],
    documents: [{ id: "doc-1", title: "New doc" }],
    actionSummary: {
      currentFocus: "",
      nextActions: [],
      importantReminders: [],
      strategyFocus: [],
      updatedAt: "",
    },
  };

  const merged = mergeCase(existing, incoming);

  assert.equal(merged.name, "Incoming Name");
  assert.equal(merged.category, "general");
  assert.equal(merged.status, "archived");
  assert.equal(merged.notes, "existing notes");
  assert.equal(merged.description, "incoming description");
  assert.deepEqual(merged.tags, ["existing", "shared", "incoming"]);
  assert.equal(merged.createdAt, iso("2024-01-01"));
  assert.equal(merged.updatedAt, iso("2024-02-01"));
  assert.deepEqual(merged.incidents.map((item) => item.id), ["inc-2", "inc-1"]);
  assert.equal(merged.incidents.find((item) => item.id === "inc-1").title, "Incoming incident");
  assert.deepEqual(merged.incidents.find((item) => item.id === "inc-1").linkedEvidenceIds, ["ev-1"]);
  assert.deepEqual(merged.evidence.map((item) => item.id), ["ev-1", "ev-2"]);
  assert.equal(merged.ledger[0].label, "New ledger");
  assert.equal(merged.ledger[0].differenceAmount, 6);
  assert.equal(merged.documents[0].title, "New doc");
  assert.deepEqual(merged.actionSummary, {
    currentFocus: "Existing focus",
    nextActions: ["Existing action"],
    importantReminders: [],
    strategyFocus: [],
    criticalDeadlines: [],
    updatedAt: "existing-summary-time",
  });
});
