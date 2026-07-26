import assert from "node:assert/strict";
import test from "node:test";
import { getReportDefinition } from "./reportDefinitions.js";
import { buildCaseReportModel } from "./reportModel.js";
import { buildDocumentScheduleDocument, projectDocumentDocumentToLegacyViewModel } from "./documentScheduleDocument.js";

test("Document Schedule is complete, serialisable, metadata-only, and projects to the legacy view", () => {
  const model = buildCaseReportModel({ id: "c", name: "Case", documents: [{ id: "d", title: "Doc", documentDate: "bad", attachments: [{ id: "a", name: "x.pdf", dataUrl: "data:bad" }], linkedRecordIds: ["missing"] }] });
  const document = buildDocumentScheduleDocument(model, getReportDefinition("document"));
  assert.equal(document.report.id, "document");
  assert.equal(document.report.completeness, "complete");
  assert.equal(document.sections.find((item) => item.id === "document-schedule").rows[0].dateStatus, "malformed");
  assert.doesNotMatch(JSON.stringify(document), /data:bad/);
  assert.equal(projectDocumentDocumentToLegacyViewModel(document).documentMatrix[0].title, "Doc");
});
