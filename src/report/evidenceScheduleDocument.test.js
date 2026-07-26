import assert from "node:assert/strict";
import test from "node:test";

import { getReportDefinition } from "./reportDefinitions.js";
import { validateReportDocument } from "./reportDocument.js";
import {
  buildEvidenceScheduleDocument,
  projectEvidenceDocumentToLegacyViewModel,
} from "./evidenceScheduleDocument.js";
import { buildEvidencePackReport } from "./reportBuilder.js";
import { buildCaseReportModel } from "./reportModel.js";

function buildCase() {
  return {
    id: "case-evidence-document",
    name: "Evidence document",
    category: "investigation",
    status: "open",
    incidents: [
      { id: "i1", title: "Incident A", eventDate: "2026-01-01", sequenceGroup: "Issue: A", evidenceStatus: "documented", linkedEvidenceIds: ["e1"] },
      { id: "i2", title: "Incident B", eventDate: "bad-date", sequenceGroup: "Other", evidenceStatus: "needs_evidence" },
    ],
    evidence: [
      { id: "e1", title: "Photograph", date: "2026-01-02", sequenceGroup: "Issue: A", status: "available", evidenceRole: "corroborating", evidenceType: "digital", proofStatus: "verified", functionSummary: "Shows damage | at the site", source: "Camera", linkedIncidentIds: ["i1"], linkedRecordIds: ["missing-record"], attachments: [{ id: "a1", name: "photo.jpg", type: "image/jpeg", size: 100, dataUrl: "data:image/jpeg;base64,abc" }] },
      { id: "e2", title: "Archived note", date: "", sequenceGroup: "Other", status: "archived", functionSummary: "", linkedPartyIds: ["missing-party"], attachments: [] },
    ],
    documents: [], ledger: [], strategy: [], watchItems: [], parties: [],
  };
}

const generatedAt = "2026-07-26T12:00:00.000Z";
const definition = getReportDefinition("evidence");

function buildDocument(caseData = buildCase(), modelOptions = {}) {
  const model = buildCaseReportModel(caseData, { generatedAt, ...modelOptions });
  return buildEvidenceScheduleDocument(model, definition, { generatedAt });
}

test("whole-case Evidence Schedule contains required factual sections and metadata", () => {
  const document = buildDocument();
  assert.deepEqual(validateReportDocument(document), { valid: true, errors: [] });
  assert.equal(document.report.id, "evidence");
  assert.equal(document.report.completeness, "complete");
  assert.equal(document.summary.includedEvidenceCount, 2);
  assert.equal(document.summary.scopedIncidentCount, 2);
  assert.deepEqual(document.sections.map((section) => section.id), ["case-overview", "evidence-schedule", "supported-incidents", "weak-unlinked-evidence", "diagnostics", "unresolved-references", "notices"]);
  const row = document.sections[1].rows[0];
  assert.equal(row.evidenceId, "e1");
  assert.equal(row.verificationState, "verified");
  assert.equal(row.evidenceType, "digital");
  assert.deepEqual(row.linkedIncidentIds, ["i1"]);
  assert.deepEqual(row.attachmentFilenames, ["photo.jpg"]);
  assert.equal(row.archived, false);
});

test("Evidence Schedule preserves legacy factual output through its compatibility projection", () => {
  const source = buildCase();
  const legacy = buildEvidencePackReport(source, { scopeType: "case" }, { generatedAt });
  const projected = projectEvidenceDocumentToLegacyViewModel(buildDocument(source));
  assert.deepEqual(projected, legacy);
});

test("Sequence Group Evidence Schedule remains structured and factually equivalent", () => {
  const source = buildCase();
  const document = buildDocument(source, { scope: "sequenceGroup", sequenceGroupName: "Issue: A" });
  const projected = projectEvidenceDocumentToLegacyViewModel(document);
  const legacy = buildEvidencePackReport(source, { scopeType: "sequenceGroup", sequenceGroup: "Issue: A" }, { generatedAt });
  assert.deepEqual(projected.includedEvidenceIds, legacy.includedEvidenceIds);
  assert.deepEqual(projected.evidenceMatrix, legacy.evidenceMatrix);
  assert.deepEqual(projected.supportedIncidents, legacy.supportedIncidents);
  assert.equal(document.source.scope.type, "sequenceGroup");
});

test("Sequence Group Evidence Schedule preserves legacy directly linked evidence context", () => {
  const source = buildCase();
  source.evidence.push({ id: "e-linked", title: "Linked external evidence", sequenceGroup: "Other", functionSummary: "Linked context", linkedIncidentIds: ["i1"] });
  const document = buildDocument(source, { scope: "sequenceGroup", sequenceGroupName: "Issue: A" });
  const projected = projectEvidenceDocumentToLegacyViewModel(document);
  const legacy = buildEvidencePackReport(source, { scopeType: "sequenceGroup", sequenceGroup: "Issue: A" }, { generatedAt });
  assert.deepEqual(projected.includedEvidenceIds, legacy.includedEvidenceIds);
  assert.ok(projected.includedEvidenceIds.includes("e-linked"));
});

test("empty metadata group and missing group produce safe empty documents", () => {
  const metadataOnly = buildDocument(buildCase(), { scope: "sequenceGroup", sequenceGroupName: "Metadata Only", sequenceGroupMeta: { "Metadata Only": { description: "Empty" } } });
  assert.equal(metadataOnly.source.scope.isValid, true);
  assert.equal(metadataOnly.summary.includedEvidenceCount, 0);
  assert.deepEqual(metadataOnly.sections[1].rows, []);

  const missing = buildDocument(buildCase(), { scope: "sequenceGroup", sequenceGroupName: "Missing" });
  assert.equal(missing.source.scope.isValid, false);
  assert.equal(missing.summary.includedEvidenceCount, 0);
});

test("archived evidence malformed dates unresolved references and metadata-only attachments remain explicit", () => {
  const document = buildDocument();
  const archived = document.sections[1].rows.find((row) => row.evidenceId === "e2");
  assert.equal(archived.archived, true);
  assert.equal(archived.dateStatus, "missing");
  assert.ok(document.sections.find((section) => section.id === "unresolved-references").items.length >= 2);
  const json = JSON.stringify(document);
  assert.equal(json.includes("base64"), false);
  assert.equal(json.includes("data:image"), false);
  assert.match(document.notices.find((notice) => notice.code === "ATTACHMENT_METADATA_ONLY").message, /metadata only/);
});

test("weak and unlinked evidence classifications remain available", () => {
  const document = buildDocument();
  const weak = document.sections.find((section) => section.id === "weak-unlinked-evidence").diagnostics;
  assert.deepEqual(weak.unlinkedEvidence.map((item) => item.id), ["e2"]);
  assert.deepEqual(weak.evidenceMissingFunctionSummary.map((item) => item.id), ["e2"]);
  assert.deepEqual(weak.evidenceWithoutAttachments.map((item) => item.id), ["e2"]);
});
