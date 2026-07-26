import assert from "node:assert/strict";
import test from "node:test";

import { buildEvidenceScheduleDocument } from "./evidenceScheduleDocument.js";
import { getReportDefinition } from "./reportDefinitions.js";
import { formatReportDocumentAsJson } from "./reportJsonFormatter.js";
import { buildCaseReportModel } from "./reportModel.js";

test("JSON formatter preserves the complete serialisable report document", () => {
  const model = buildCaseReportModel({ id: "case-json", name: "JSON", evidence: [{ id: "e1", title: "Photo", attachments: [{ id: "a1", name: "photo.jpg", dataUrl: "data:image/jpeg;base64,abc" }] }] }, { generatedAt: "2026-07-26T00:00:00.000Z" });
  const document = buildEvidenceScheduleDocument(model, getReportDefinition("evidence"), { generatedAt: model.generatedAt });
  const output = formatReportDocumentAsJson(document);
  const parsed = JSON.parse(output);
  assert.deepEqual(parsed, document);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.source.sourceRevision.fingerprint, model.sourceRevision.fingerprint);
  assert.equal(output.includes("base64"), false);
  assert.equal(output.includes("data:image"), false);
});

test("JSON formatter safely handles missing input", () => {
  assert.equal(formatReportDocumentAsJson(null), "{}");
});
