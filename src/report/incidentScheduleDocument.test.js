import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseReportModel } from "./reportModel.js";
import { getReportDefinition } from "./reportDefinitions.js";
import { getReportDocumentSection, validateReportDocument } from "./reportDocument.js";
import { buildIncidentScheduleDocument } from "./incidentScheduleDocument.js";

function fixture() {
  return { id: "case-1", name: "Case One", status: "active", category: "investigation", parties: [{ id: "p1", name: "Alex", role: "Witness" }], incidents: [
    { id: "i1", title: "Dated incident", eventDate: "2026-07-01", description: "Incident detail", sequenceGroup: "Alpha", linkedEvidenceIds: ["e1"], linkedDocumentIds: ["d1"], linkedPartyIds: ["p1"], attachments: [{ id: "a1", name: "photo.png", dataUrl: "data:image/png;base64,AAA" }] },
    { id: "i2", title: "Unresolved incident", eventDate: "bad-date", sequenceGroup: "Alpha", linkedEvidenceIds: ["missing-evidence"] },
    { id: "i3", title: "Archived incident", archived: true },
  ], evidence: [{ id: "e1", title: "Supporting evidence", linkedIncidentIds: ["i1"] }, { id: "e2", title: "Reverse evidence", linkedIncidentIds: ["i2"], sequenceGroup: "Elsewhere" }], documents: [{ id: "d1", title: "Document" }], strategy: [{ id: "s1", title: "Strategy", linkedIncidentIds: ["i1"] }], watchItems: [{ id: "w1", title: "Watch", linkedIncidentIds: ["i1"] }], ledger: [{ id: "l1", title: "Ledger", linkedIncidentIds: ["i1"] }],
  };
}
function build(options = {}) { const model = buildCaseReportModel(fixture(), { includeArchived: true, ...options, generatedAt: "2026-07-26T12:00:00Z" }); return buildIncidentScheduleDocument(model, getReportDefinition("incidentSchedule"), { generatedAt: "2026-07-26T12:00:00Z" }); }

test("builds complete incident rows with direct and reverse structured relationships", () => {
  const document = build(); const rows = getReportDocumentSection(document, "incident-schedule").rows; const first = rows.find((row) => row.incidentId === "i1");
  assert.equal(document.report.id, "incidentSchedule"); assert.equal(document.summary.scopedIncidentCount, 3); assert.deepEqual(first.linkedEvidence.map((item) => item.id), ["e1"]); assert.deepEqual(first.linkedDocuments.map((item) => item.id), ["d1"]); assert.deepEqual(first.linkedStrategies.map((item) => item.id), ["s1"]); assert.deepEqual(first.linkedWatch.map((item) => item.id), ["w1"]); assert.deepEqual(first.linkedLedger.map((item) => item.id), ["l1"]); assert.deepEqual(first.resolvedParties, [{ id: "p1", name: "Alex", role: "Witness" }]); assert.deepEqual(first.attachmentFilenames, ["photo.png"]); assert.doesNotMatch(JSON.stringify(document), /base64|data:image/); assert.equal(validateReportDocument(document).valid, true);
});

test("derives evidence coverage without legal conclusions and prevents duplicate links", () => {
  const document = build(); const coverage = getReportDocumentSection(document, "evidence-coverage").rows;
  assert.equal(coverage.find((item) => item.incidentId === "i1").coverageStatus, "supported");
  assert.equal(coverage.find((item) => item.incidentId === "i1").supportingEvidenceCount, 1);
  assert.equal(coverage.find((item) => item.incidentId === "i2").coverageStatus, "partially-supported");
  assert.match(document.notices.find((item) => item.code === "COVERAGE_POLICY").message, /does not determine whether an incident is proven/);
});

test("uses exact Sequence Group membership and handles empty missing and archived scopes", () => {
  const scoped = build({ scope: "sequenceGroup", sequenceGroupName: "alpha" });
  assert.deepEqual(getReportDocumentSection(scoped, "incident-schedule").rows.map((row) => row.incidentId), ["i1", "i2"]);
  const missing = build({ scope: "sequenceGroup", sequenceGroupName: "Missing" }); assert.equal(missing.source.scope.isValid, false); assert.equal(missing.summary.scopedIncidentCount, 0);
  const excludedModel = buildCaseReportModel(fixture(), { includeArchived: false }); const excluded = buildIncidentScheduleDocument(excludedModel, { ...getReportDefinition("incidentSchedule"), includeArchived: false }); assert.equal(excluded.summary.archivedIncidentCount, 0);
});

test("projects deterministic quality findings and leaves input immutable", () => {
  const source = fixture(); const snapshot = structuredClone(source); const model = buildCaseReportModel(source); const document = buildIncidentScheduleDocument(model, getReportDefinition("incidentSchedule")); const codes = getReportDocumentSection(document, "incident-quality-findings").items.map((item) => item.code);
  assert.ok(codes.includes("INCIDENT_MALFORMED_DATE")); assert.ok(codes.includes("INCIDENT_UNRESOLVED_RECORD")); assert.ok(codes.includes("INCIDENT_ARCHIVED")); assert.deepEqual(source, snapshot); assert.doesNotThrow(() => JSON.stringify(document));
});

test("empty and malformed models produce a valid useful document", () => { const document = buildIncidentScheduleDocument({}, getReportDefinition("incidentSchedule")); assert.equal(document.summary.scopedIncidentCount, 0); assert.deepEqual(getReportDocumentSection(document, "incident-schedule").rows, []); assert.equal(validateReportDocument(document).valid, true); });
