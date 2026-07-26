import assert from "node:assert/strict";
import test from "node:test";
import { buildDocumentPackReport } from "./reportBuilder.js";
import { buildCaseReportModel } from "./reportModel.js";
import { buildDocumentPackReportFromModel } from "./documentPackModelAdapter.js";

const fixture = { id: "c1", name: "Case", documents: [{ id: "d1", title: "Contract", documentDate: "2026-01-02", createdAt: "2026-01-03", updatedAt: "2026-01-04", category: "contract", sequenceGroup: "A&B", summary: "Terms", textContent: "Full text", linkedRecordIds: ["i1"], attachments: [{ id: "a1", name: "contract.pdf", type: "application/pdf", size: 12, dataUrl: "data:bad" }] }], incidents: [{ id: "i1", title: "Signing", eventDate: "2026-01-01", sequenceGroup: "A&B", linkedRecordIds: ["d1"] }] };

test("Document Pack model adapter preserves legacy whole-case facts", () => {
  const generatedAt = "2026-07-26T00:00:00.000Z";
  const legacy = buildDocumentPackReport(fixture, { scopeType: "case" }, { generatedAt });
  const adapted = buildDocumentPackReportFromModel(buildCaseReportModel(fixture, { generatedAt }), { generatedAt });
  assert.deepEqual(adapted, legacy);
});

test("Document Pack adapter preserves exact structured sequence-group scope", () => {
  const model = buildCaseReportModel(fixture, { scope: "sequenceGroup", sequenceGroupName: "a&b" });
  assert.deepEqual(buildDocumentPackReportFromModel(model).includedDocumentIds, ["d1"]);
});
