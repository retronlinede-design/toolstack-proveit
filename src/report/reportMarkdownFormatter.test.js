import assert from "node:assert/strict";
import test from "node:test";

import { buildEvidenceScheduleDocument } from "./evidenceScheduleDocument.js";
import { getReportDefinition } from "./reportDefinitions.js";
import { formatReportDocumentAsMarkdown } from "./reportMarkdownFormatter.js";
import { buildCaseReportModel } from "./reportModel.js";

function markdownFor(caseData) {
  const model = buildCaseReportModel(caseData, { generatedAt: "2026-07-26T00:00:00.000Z" });
  return formatReportDocumentAsMarkdown(buildEvidenceScheduleDocument(model, getReportDefinition("evidence"), { generatedAt: model.generatedAt }));
}

test("Markdown formatter emits the shared Evidence Schedule sections and provenance", () => {
  const markdown = markdownFor({
    id: "case-md", name: "Case | Markdown", status: "open", category: "test",
    incidents: [{ id: "i1", title: "Incident", linkedEvidenceIds: ["e1"] }],
    evidence: [{ id: "e1", title: "Photo | Note", date: "2026-01-01", functionSummary: "Line one\nLine two", linkedIncidentIds: ["i1"], attachments: [{ id: "a1", name: "photo.jpg", dataUrl: "data:image/jpeg;base64,abc" }] }],
  });
  for (const heading of ["# Evidence Pack", "## Case Details", "## Report Scope", "## Evidence Schedule", "## Supported Incidents", "## Weak or Unlinked Evidence", "## Unresolved References", "## Notices"]) assert.match(markdown, new RegExp(heading));
  assert.match(markdown, /Case \\| Markdown/);
  assert.match(markdown, /Photo \\| Note/);
  assert.match(markdown, /Line one<br>Line two/);
  assert.match(markdown, /Source revision: fnv1a-/);
  assert.match(markdown, /Attachments are metadata-only/);
  assert.equal(markdown.includes("base64"), false);
  assert.equal(markdown.includes("data:image"), false);
  assert.equal(markdown.includes("[object Object]"), false);
});

test("Markdown formatter renders empty sections clearly", () => {
  const markdown = markdownFor({ id: "empty", name: "Empty" });
  assert.match(markdown, /No evidence is included in this scope/);
  assert.match(markdown, /## Supported Incidents\n\n- None/);
  assert.match(markdown, /## Unresolved References\n\n- None/);
});
