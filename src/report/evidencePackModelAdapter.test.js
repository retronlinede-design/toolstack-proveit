import assert from "node:assert/strict";
import test from "node:test";

import { buildEvidencePackReportFromModel } from "./evidencePackModelAdapter.js";
import { buildEvidencePackReport } from "./reportBuilder.js";
import { buildCaseReportModel } from "./reportModel.js";

function buildCase() {
  return {
    id: "case-evidence",
    name: "Evidence comparison",
    category: "investigation",
    status: "open",
    incidents: [{ id: "i1", title: "Leak reported", eventDate: "2026-01-01", evidenceStatus: "documented", linkedEvidenceIds: ["e1"] }],
    evidence: [
      { id: "e1", title: "Ceiling photo", date: "2026-01-02", status: "available", evidenceRole: "corroborating", functionSummary: "Shows visible water damage", linkedIncidentIds: ["i1"], attachments: [{ id: "a1", name: "ceiling.jpg", type: "image/jpeg", size: 123, dataUrl: "data:image/jpeg;base64,abc" }] },
      { id: "e2", title: "Loose note", date: "", status: "draft", functionSummary: "", attachments: [] },
    ],
    documents: [],
    ledger: [],
    strategy: [],
    watchItems: [],
    parties: [],
  };
}

const generatedAt = "2026-07-26T00:00:00.000Z";

test("Evidence Pack model adapter matches existing whole-case factual output", () => {
  const source = buildCase();
  const legacy = buildEvidencePackReport(source, { scopeType: "case" }, { generatedAt });
  const model = buildCaseReportModel(source, { generatedAt });
  const adapted = buildEvidencePackReportFromModel(model, { generatedAt });

  for (const key of ["reportType", "title", "audience", "scopeType", "sequenceGroup", "scopeLabel", "sourceCaseId", "generatedAt", "includedEvidenceCount"]) {
    assert.deepEqual(adapted[key], legacy[key]);
  }
  assert.deepEqual(adapted.caseOverview, legacy.caseOverview);
  assert.deepEqual(adapted.includedEvidenceIds, legacy.includedEvidenceIds);
  assert.deepEqual(adapted.atAGlance, legacy.atAGlance);
  assert.deepEqual(adapted.evidenceMatrix, legacy.evidenceMatrix);
  assert.deepEqual(adapted.supportedIncidents, legacy.supportedIncidents);
  assert.deepEqual(adapted.unlinkedWeakEvidence, legacy.unlinkedWeakEvidence);
});

test("Evidence Pack adapter respects the model's exact sequence-group primary scope", () => {
  const source = buildCase();
  source.evidence[0].sequenceGroup = "Issue (A)";
  source.evidence[1].sequenceGroup = "Other";
  const model = buildCaseReportModel(source, {
    generatedAt,
    scope: "sequenceGroup",
    sequenceGroupName: "issue (a)",
  });
  const adapted = buildEvidencePackReportFromModel(model, { generatedAt });
  assert.deepEqual(adapted.includedEvidenceIds, ["e1"]);
  assert.equal(adapted.scopeType, "sequenceGroup");
});

test("Evidence Pack adapter safely handles an empty model", () => {
  const adapted = buildEvidencePackReportFromModel(null, { generatedAt });
  assert.equal(adapted.includedEvidenceCount, 0);
  assert.deepEqual(adapted.evidenceMatrix, []);
});
