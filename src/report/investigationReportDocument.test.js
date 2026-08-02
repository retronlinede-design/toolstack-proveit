import assert from "node:assert/strict";
import test from "node:test";

import { validateReportDocument } from "./reportDocument.js";
import { buildCaseReportModel } from "./reportModel.js";
import { getReportDefinition } from "./reportDefinitions.js";
import { buildInvestigationReportDocument } from "./investigationReportDocument.js";

const generatedAt = "2026-08-02T12:00:00.000Z";
function caseFixture() {
  return {
    id: "case-1", name: "Heating case", status: "open", category: "Housing", updatedAt: "2026-08-01T09:00:00Z",
    issues: [{ id: "issue-stable", reference: "ISS-003", name: "Heating Failure", purpose: "Document recurring failures.", description: "Winter heating issue", status: "waiting_response", priority: "high", ownerPartyId: "p1", reviewDate: "2026-07-30", currentPosition: "The repair response remains outstanding.", createdAt: "2026-01-01", updatedAt: "2026-07-28" }],
    parties: [{ id: "p1", displayName: "Alex Tenant", role: "Tenant", organisation: "" }],
    incidents: [{ id: "i1", title: "Heating stopped", eventDate: "2026-03-01", description: "No heating", sequenceGroupId: "issue-stable", sequenceGroup: "Heating Failure", linkedEvidenceIds: ["e1"], linkedPartyIds: ["p1", "missing-party"] }, { id: "i2", title: "Old linked context", eventDate: "2026-02-01", sequenceGroup: "Other Issue", linkedRecordIds: ["i1"], archived: true }],
    evidence: [{ id: "e1", title: "Thermostat photograph", date: "2026-03-01", sequenceGroupId: "issue-stable", sequenceGroup: "Heating Failure", linkedIncidentIds: ["i1"], evidenceType: "Photograph", verificationStatus: "verified", functionSummary: "Records the thermostat reading", attachments: [{ id: "a1", name: "photo.jpg", type: "image/jpeg", dataUrl: "data:image/jpeg;base64,secret" }] }],
    documents: [{ id: "d1", title: "Repair email", documentDate: "bad-date", sequenceGroupId: "issue-stable", sequenceGroup: "Heating Failure", linkedIncidentIds: ["i1"], category: "Correspondence", summary: "Repair request" }],
    ledger: [{ id: "l1", label: "Rent", date: "2026-03-03", sequenceGroupId: "issue-stable", sequenceGroup: "Heating Failure", amount: 100, currency: "EUR", status: "disputed", proofStatus: "missing" }, { id: "l2", label: "Temporary heater", date: "2026-03-04", sequenceGroupId: "issue-stable", sequenceGroup: "Heating Failure", amount: 50, currency: "GBP", status: "pending" }],
    strategy: [{ id: "s1", title: "Request response", sequenceGroupId: "issue-stable", sequenceGroup: "Heating Failure", status: "active", objective: "Obtain response", nextSteps: ["Send reminder"], reviewDate: "2026-07-31", ownerPartyId: "p1" }],
    watchItems: [{ id: "w1", title: "Monitor temperature", sequenceGroupId: "issue-stable", sequenceGroup: "Heating Failure", status: "monitoring", watchFor: "Further failure", reviewDate: "2026-08-03" }],
  };
}
function build(source = caseFixture(), options = {}) {
  const model = buildCaseReportModel(source, { generatedAt, includeArchived: true, includeDiagnostics: true, ...options });
  return { model, document: buildInvestigationReportDocument(model, getReportDefinition("investigation"), { generatedAt }) };
}

test("whole-case investigation is complete, deterministic, serialisable, and binary safe", () => {
  const source = caseFixture(); const before = structuredClone(source); const first = build(source).document; const second = build(source).document;
  assert.equal(first.report.id, "investigation"); assert.equal(first.report.completeness, "complete"); assert.equal(first.report.generatedAt, generatedAt); assert.deepEqual(first, second); assert.deepEqual(source, before); assert.equal(validateReportDocument(first).valid, true); assert.doesNotThrow(() => JSON.stringify(first)); assert.doesNotMatch(JSON.stringify(first), /base64|data:image|secret/);
  assert.deepEqual(first.summary.statistics, { incident: 2, evidence: 1, document: 1, ledger: 2, strategy: 1, watch: 1, parties: 1, linkedContext: 0, unresolvedReferences: 1, auditFindings: first.summary.auditFindingCount, archivedRecords: 1 });
});

test("Issue scope resolves stable identity and preserves direct versus linked context", () => {
  const { document } = build(caseFixture(), { scope: "sequenceGroup", issueId: "issue-stable", sequenceGroupName: "obsolete name" });
  assert.deepEqual(document.summary.issue, { id: "issue-stable", reference: "ISS-003", name: "Heating Failure", displayLabel: "ISS-003 — Heating Failure", purpose: "Document recurring failures.", status: "waiting_response", priority: "high", ownerPartyId: "p1", ownerName: "Alex Tenant", reviewDate: "2026-07-30", currentPosition: "The repair response remains outstanding.", updatedAt: "2026-07-28" });
  assert.equal(document.recordReferences.direct.some((item) => item.id === "i1"), true); assert.equal(document.recordReferences.linkedContext.some((item) => item.id === "i2"), true); assert.equal(document.recordReferences.direct.some((item) => item.id === "i2"), false); assert.equal(new Set(document.recordReferences.direct.map((item) => `${item.type}:${item.id}`)).size, document.recordReferences.direct.length);
});

test("empty, metadata-only, and missing Issue states are explicit", () => {
  const empty = build({ id: "empty", name: "Empty", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] }).document; assert.equal(empty.summary.summaryText, "No investigation records are available in this case.");
  const source = caseFixture(); source.issues.push({ id: "issue-empty", reference: "ISS-004", name: "Metadata Only", status: "open", priority: "normal", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  const metadata = build(source, { scope: "sequenceGroup", issueId: "issue-empty", sequenceGroupName: "Metadata Only" }).document; assert.match(metadata.summary.summaryText, /ISS-004 — Metadata Only exists but currently contains no directly assigned/);
  const missing = build(source, { scope: "sequenceGroup", issueId: "missing", sequenceGroupName: "Missing" }).document; assert.equal(missing.summary.scopeValid, false); assert.equal(missing.summary.summaryText, "The selected Issue could not be resolved.");
});

test("chronology, unresolved references, multiple currencies, and appendices preserve factual coverage", () => {
  const { model, document } = build(); const appendixTypes = document.appendices.map((item) => item.type);
  assert.deepEqual(appendixTypes, ["incident-schedule", "chronology", "evidence-schedule", "document-schedule", "ledger-schedule", "audit-findings", "reference-index"]);
  assert.equal(document.appendices.find((item) => item.type === "chronology").groups.some((group) => group.groupType === "malformed"), true);
  assert.deepEqual(document.sections.find((item) => item.id === "financial-position").metadata.totalsByCurrency.map((item) => item.currency).sort(), ["EUR", "GBP"]);
  assert.equal(document.unresolvedReferences.some((item) => item.targetId === "missing-party"), true);
  assert.equal(document.appendices.find((item) => item.type === "reference-index").items.length, model.records.primaryScopedRecords.length);
});

test("current position and existing Strategy, Watch, and Issue reviews become labelled actions", () => {
  const { document } = build(caseFixture(), { scope: "sequenceGroup", issueId: "issue-stable", sequenceGroupName: "Heating Failure" });
  const current = document.sections.find((item) => item.id === "current-position").metadata; const actions = document.sections.find((item) => item.id === "next-actions").items;
  assert.equal(current.currentPosition, "The repair response remains outstanding."); assert.equal(current.ownerName, "Alex Tenant");
  assert.equal(actions.some((item) => item.sourceType === "Issue review"), true); assert.equal(actions.some((item) => item.action === "Send reminder" && item.sourceType === "Strategy"), true); assert.equal(actions.some((item) => item.sourceType === "To Watch review"), true);
});

test("no Evidence, Documents, or Ledger omits irrelevant appendices without implying merit", () => {
  const source = caseFixture(); source.evidence = []; source.documents = []; source.ledger = []; source.incidents[0].linkedEvidenceIds = [];
  const { document } = build(source); assert.equal(document.sections.find((item) => item.id === "evidence-overview").metadata.total, 0); assert.equal(document.sections.find((item) => item.id === "supporting-documents").metadata.total, 0); assert.equal(document.sections.some((item) => item.id === "financial-position"), false); assert.equal(document.appendices.some((item) => ["evidence-schedule", "document-schedule", "ledger-schedule"].includes(item.type)), false); assert.match(document.notices[0].message, /does not determine legal merit/);
});
