import assert from "node:assert/strict";
import test from "node:test";

import { buildCaseReportModel, REPORT_MODEL_RECORD_TYPES } from "./reportModel.js";

function buildCase() {
  return {
    id: "case-1",
    name: "Model case",
    category: "investigation",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    activeTab: "evidence",
    parties: [{ id: "p1", displayName: "Alex", role: "Witness", organisation: "Example Ltd" }],
    incidents: [{ id: "i1", title: "Incident", eventDate: "2026-01-02", sequenceGroup: "Issue: Alpha", linkedEvidenceIds: ["e1"], linkedPartyIds: ["p1", "missing-party"], outcome: "Pending" }],
    evidence: [{ id: "e1", title: "Evidence", date: "2026-01-03", sequenceGroup: "issue: alpha", linkedIncidentIds: ["i1", "missing-record", "missing-record"], functionSummary: "Supports the incident", verificationStatus: "verified", attachments: [{ id: "a1", name: "photo.jpg", type: "image/jpeg", size: 42, dataUrl: "data:image/jpeg;base64,abc", backupDataUrl: "data:x", blob: { bytes: [1] } }] }],
    documents: [{ id: "d1", title: "Document", documentDate: "invalid-date", sequenceGroup: "Unregistered Group", summary: "Source document" }],
    ledger: [{ id: "l1", label: "Payment", paymentDate: "2026-01-04", sequenceGroup: "Issue: Alpha", amount: "100.00", status: "paid" }],
    strategy: [{ id: "s1", title: "Strategy", reviewDate: "2026-01-05", objective: "Next step", priority: "high", status: "archived" }],
    watchItems: [{ id: "w1", title: "Watch", watchFor: "Development", status: "watching" }],
  };
}

const options = {
  generatedAt: "2026-07-26T00:00:00.000Z",
  sequenceGroupMeta: {
    "Issue: Alpha": { description: "Primary issue" },
    "Metadata Only": { description: "Registered without records" },
  },
};

test("empty and malformed cases return a stable serialisable model shape", () => {
  for (const value of [undefined, null, {}, { incidents: "bad", parties: 4 }]) {
    const model = buildCaseReportModel(value, { ...options, includeDiagnostics: false });
    assert.equal(model.schemaVersion, 1);
    assert.deepEqual(Object.keys(model.records), ["all", "primaryScopedRecords", "byType"]);
    assert.equal(model.scope.isValid, true);
    assert.equal(model.totals.uniqueRecordCount, 0);
    assert.doesNotThrow(() => JSON.stringify(model));
  }
});

test("the model projects all six factual record types", () => {
  const model = buildCaseReportModel(buildCase(), { ...options, includeDiagnostics: false });
  assert.deepEqual(model.records.all.map((record) => record.type), REPORT_MODEL_RECORD_TYPES.map((item) => item.type));
  assert.equal(model.totals.uniqueRecordCount, 6);
  assert.deepEqual(model.totals.byType, { incident: 1, evidence: 1, document: 1, ledger: 1, strategy: 1, watch: 1 });
  assert.equal(model.records.byType.ledger[0].details.amount, "100.00");
  assert.equal(model.records.byType.evidence[0].details.verificationStatus, "verified");
  assert.equal(model.records.byType.incident[0].details.outcome, "Pending");
  assert.equal(model.records.byType.strategy[0].details.priority, "high");
  assert.equal(model.records.byType.watch[0].details.watchFor, "Development");
});

test("case and sequence group scopes use exact structured membership", () => {
  const caseModel = buildCaseReportModel(buildCase(), { ...options, includeDiagnostics: false });
  assert.equal(caseModel.scope.type, "case");
  assert.equal(caseModel.totals.scopedRecordCount, 6);

  const scoped = buildCaseReportModel(buildCase(), { ...options, scope: "sequenceGroup", sequenceGroupName: "  ISSUE: ALPHA  ", includeDiagnostics: false });
  assert.equal(scoped.scope.isValid, true);
  assert.deepEqual(scoped.records.primaryScopedRecords.map((record) => record.id), ["i1", "e1", "l1"]);
  assert.equal(scoped.records.primaryScopedRecords.some((record) => record.title.includes("Issue: Alpha")), false);
});

test("empty and metadata-only groups are valid while missing groups are invalid", () => {
  const metadataOnly = buildCaseReportModel(buildCase(), { ...options, scope: "sequenceGroup", sequenceGroupName: "Metadata Only", includeDiagnostics: false });
  assert.equal(metadataOnly.scope.isValid, true);
  assert.equal(metadataOnly.totals.scopedRecordCount, 0);
  assert.equal(metadataOnly.sequenceGroups.find((group) => group.name === "Metadata Only").metadataOnly, true);

  const missing = buildCaseReportModel(buildCase(), { ...options, scope: "sequenceGroup", sequenceGroupName: "Missing", includeDiagnostics: false });
  assert.equal(missing.scope.isValid, false);
  assert.deepEqual(missing.records.primaryScopedRecords, []);
});

test("groups preserve metadata, inferred labels, ordering, type totals, and ungrouped records", () => {
  const model = buildCaseReportModel(buildCase(), { ...options, includeDiagnostics: false });
  assert.deepEqual(model.sequenceGroups.map((group) => group.name), ["Issue: Alpha", "Metadata Only", "Unregistered Group"]);
  const alpha = model.sequenceGroups[0];
  assert.equal(alpha.description, "Primary issue");
  assert.equal(alpha.registered, true);
  assert.deepEqual(alpha.totals.byType, { incident: 1, evidence: 1, document: 0, ledger: 1, strategy: 0, watch: 0 });
  assert.equal(model.sequenceGroups[2].inferred, true);
  assert.deepEqual(model.ungroupedRecords.map((record) => record.id), ["s1", "w1"]);
  assert.equal(model.totals.groupedUniqueRecordCount, 4);
  assert.equal(model.totals.groupAppearanceCount, 4);
  assert.equal(model.totals.ungroupedRecordCount, 2);
});

test("chronology is scope aware, stable, and honours archived policy", () => {
  const all = buildCaseReportModel(buildCase(), { ...options, includeDiagnostics: false });
  assert.deepEqual(all.chronology.map((item) => item.recordId), ["i1", "e1", "l1", "s1", "d1", "w1"]);
  assert.equal(all.chronology.find((item) => item.recordId === "d1").dateStatus, "malformed");
  assert.equal(all.chronology.find((item) => item.recordId === "w1").dateStatus, "missing");

  const activeOnly = buildCaseReportModel(buildCase(), { ...options, includeArchived: false, includeDiagnostics: false });
  assert.equal(activeOnly.records.all.some((record) => record.id === "s1"), false);
  assert.equal(activeOnly.totals.archivedRecordCount, 0);
});

test("parties and record links preserve stable IDs and report unresolved references once", () => {
  const model = buildCaseReportModel(buildCase(), { ...options, includeDiagnostics: false });
  const incident = model.records.byType.incident[0];
  const evidence = model.records.byType.evidence[0];
  assert.deepEqual(incident.resolvedParties[0], { id: "p1", name: "Alex", role: "Witness" });
  assert.equal(incident.resolvedParties[1].unresolved, true);
  assert.equal(evidence.links.find((link) => link.targetId === "i1").targetTitle, "Incident");
  assert.equal(evidence.links.find((link) => link.targetId === "missing-record").targetTitle, "Unresolved record");
  assert.equal(model.unresolvedReferences.filter((item) => item.targetId === "missing-record").length, 1);
  assert.equal(model.totals.unresolvedReferenceCount, 2);
});

test("attachment metadata is retained while binary fields are recursively excluded", () => {
  const model = buildCaseReportModel(buildCase(), { ...options, includeDiagnostics: false });
  assert.deepEqual(model.records.byType.evidence[0].attachmentMetadata, [{ id: "a1", filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 42, source: "", createdAt: "" }]);
  const json = JSON.stringify(model);
  assert.equal(json.includes("base64"), false);
  assert.equal(json.includes("backupDataUrl"), false);
  assert.equal(json.includes('"blob"'), false);
});

test("source fingerprint is deterministic, factual, and ignores UI and attachment binary changes", () => {
  const first = buildCase();
  const sameFacts = structuredClone(first);
  sameFacts.activeTab = "documents";
  sameFacts.evidence[0].attachments[0].dataUrl = "data:image/jpeg;base64,different";
  sameFacts.evidence[0].attachments[0].backupDataUrl = "data:different";
  const factualChange = structuredClone(first);
  factualChange.evidence[0].functionSummary = "Changed factual summary";

  const a = buildCaseReportModel(first, { ...options, includeDiagnostics: false }).sourceRevision.fingerprint;
  const b = buildCaseReportModel(sameFacts, { ...options, includeDiagnostics: false }).sourceRevision.fingerprint;
  const c = buildCaseReportModel(factualChange, { ...options, includeDiagnostics: false }).sourceRevision.fingerprint;
  const activeView = buildCaseReportModel(first, { ...options, includeArchived: false, includeDiagnostics: false });
  assert.equal(a, b);
  assert.equal(a, activeView.sourceRevision.fingerprint);
  assert.equal(activeView.sourceRevision.recordCount, 6);
  assert.notEqual(a, c);
});

test("building the model does not mutate records arrays attachments or source ordering", () => {
  const source = buildCase();
  const before = structuredClone(source);
  const model = buildCaseReportModel(source, options);
  assert.deepEqual(source, before);
  assert.notEqual(model.records.all[0], source.incidents[0]);
  assert.notEqual(model.records.byType.evidence[0].attachmentMetadata[0], source.evidence[0].attachments[0]);
});

test("diagnostics can be included or omitted without changing model facts", () => {
  const included = buildCaseReportModel(buildCase(), options);
  const omitted = buildCaseReportModel(buildCase(), { ...options, includeDiagnostics: false });
  assert.ok(included.diagnostics.case.integrity);
  assert.match(included.diagnostics.records.coverageNote, /Watch coverage is limited/);
  assert.equal(omitted.diagnostics.case, null);
  assert.equal(included.sourceRevision.fingerprint, omitted.sourceRevision.fingerprint);
});

test("the complete mixed model remains JSON serialisable", () => {
  const model = buildCaseReportModel(buildCase(), options);
  const parsed = JSON.parse(JSON.stringify(model));
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.records.all.length, 6);
});

test("Issue scope resolves by immutable ID and exposes human reference after rename", () => {
  const source = buildCase();
  source.issues = [{ id: "issue_stable", reference: "ISS-003", name: "Renamed Issue", description: "", purpose: "", status: "open", priority: "high", ownerPartyId: null, reviewDate: null, currentPosition: "", createdAt: "2026-01-01", updatedAt: "2026-01-02" }];
  source.incidents[0].sequenceGroupId = "issue_stable";
  source.incidents[0].sequenceGroup = "Renamed Issue";
  const model = buildCaseReportModel(source, { ...options, scope: "sequenceGroup", issueId: "issue_stable" });
  assert.equal(model.scope.isValid, true);
  assert.equal(model.scope.issueReference, "ISS-003");
  assert.equal(model.scope.displayLabel, "ISS-003 — Renamed Issue");
  assert.equal(model.sequenceGroups.find((group) => group.issueId === "issue_stable").priority, "high");
});
