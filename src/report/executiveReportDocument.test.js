import assert from "node:assert/strict";
import test from "node:test";

import { buildActiveReportDocument } from "./buildActiveReportDocument.js";
import { buildExecutiveReportDocument } from "./executiveReportDocument.js";
import { getReportDefinition } from "./reportDefinitions.js";
import { buildCaseReportModel } from "./reportModel.js";
import { formatReportDocumentAsMarkdown } from "./reportMarkdownFormatter.js";
import { buildReportOutput } from "./reportOutputs.js";

const generatedAt = "2026-10-18T12:00:00.000Z";
function source() {
  return { id: "case-1", name: "Heating Case", status: "open", issues: [{ id: "issue-1", reference: "ISS-001", name: "Heating", purpose: "Resolve the heating failure.", currentPosition: "A response remains outstanding.", status: "open", priority: "high", reviewDate: "2026-10-20", createdAt: "2026-01-01", updatedAt: "2026-10-01" }], incidents: [{ id: "inc-1", title: "Heating stopped", eventDate: "2026-10-01", description: "The heating stopped.", sequenceGroupId: "issue-1", sequenceGroup: "Heating", linkedEvidenceIds: ["ev-1"] }], evidence: [{ id: "ev-1", title: "Thermostat photograph", date: "2026-10-01", sequenceGroupId: "issue-1", sequenceGroup: "Heating", linkedIncidentIds: ["inc-1"], verificationStatus: "verified", functionSummary: "Records the displayed temperature." }], documents: [{ id: "doc-1", title: "Repair request", documentDate: "2026-10-02", sequenceGroupId: "issue-1", sequenceGroup: "Heating", summary: "Request for a repair." }], strategy: [{ id: "strategy-1", title: "Seek response", sequenceGroupId: "issue-1", sequenceGroup: "Heating", nextSteps: ["Send a reminder."] }], watchItems: [] };
}
function build() {
  const model = buildCaseReportModel(source(), { scope: "sequenceGroup", issueId: "issue-1", sequenceGroupName: "Heating", generatedAt, includeDiagnostics: true });
  return { model, document: buildExecutiveReportDocument(model, getReportDefinition("executive"), { generatedAt }) };
}

test("builds a concise deterministic Issue-centred Executive Report with canonical record references", () => {
  const { document } = build();
  assert.equal(document.report.id, "executive");
  assert.equal(document.summary.issue.displayLabel, "ISS-001 — Heating");
  assert.equal(document.sections.find((item) => item.id === "key-findings").items[0].sourceReference.recordId, "inc-1");
  assert.equal(document.sections.find((item) => item.id === "supporting-evidence").items[0].sourceReference.recordId, "ev-1");
  assert.match(document.sections.find((item) => item.id === "key-findings").items[0].classification, /not independently established/);
  assert.match(document.sections.find((item) => item.id === "contradictions-and-questions").metadata.contradictionNote, /does not infer contradictions/);
  assert.doesNotMatch(JSON.stringify(document), /base64|data:image|legal conclusion/i);
});

test("Markdown and JSON exports retain concise sections and references", () => {
  const { model, document } = build();
  const markdown = formatReportDocumentAsMarkdown(document);
  const exported = buildActiveReportDocument({ reportId: "executive", reportModel: model, definition: getReportDefinition("executive"), generatedAt });
  const jsonOutput = JSON.parse(buildReportOutput(document, "json").content);
  for (const heading of ["# Executive Report", "## Issue Overview", "## Key Findings and Relevant Facts", "## Significant Supporting Evidence", "## Contradictions and Unresolved Questions", "## Recommended Next Steps"]) assert.match(markdown, new RegExp(heading));
  assert.match(markdown, /Incident: inc-1 — Heating stopped/);
  assert.equal(exported.reportDocument.report.id, "executive");
  assert.equal(exported.reportDocument.source.scope.issueId, "issue-1");
  assert.equal(jsonOutput.report.id, "executive");
  assert.equal(jsonOutput.source.scope.issueId, "issue-1");
});

test("missing Issues remain unresolved without falling back to another Issue", () => {
  const model = buildCaseReportModel(source(), { scope: "sequenceGroup", issueId: "deleted-issue", sequenceGroupName: "", generatedAt, includeDiagnostics: true });
  const document = buildExecutiveReportDocument(model, getReportDefinition("executive"), { generatedAt });
  assert.equal(document.source.scope.isValid, false);
  assert.equal(document.summary.directRecordCount, 0);
  assert.match(document.sections.find((item) => item.id === "issue-overview").text, /could not be resolved/);
});
