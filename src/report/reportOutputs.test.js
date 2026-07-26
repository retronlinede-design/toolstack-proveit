import assert from "node:assert/strict";
import test from "node:test";
import { buildReportOutput, getReportOutputFilename } from "./reportOutputs.js";

const document = { schemaVersion: 1, report: { id: "document", title: "Document Pack", generatedAt: "2026-07-26T12:00:00Z", completeness: "complete" }, source: { caseId: "", caseName: "Case: A/B & very long name", sourceRevision: { fingerprint: "abc" }, scope: { type: "sequenceGroup", sequenceGroupName: "Issue: #1" } }, summary: {}, notices: [], sections: [{ id: "document-schedule", rows: [] }] };

test("shared output preparation returns deterministic safe Markdown and JSON files", () => {
  assert.equal(getReportOutputFilename(document, "markdown"), "proveit-case-a-b-very-long-name-document-issue-1-2026-07-26.md");
  const markdown = buildReportOutput(document, "markdown"); const json = buildReportOutput(document, "json");
  assert.equal(markdown.mimeType, "text/markdown;charset=utf-8"); assert.equal(json.mimeType, "application/json;charset=utf-8");
  assert.match(markdown.content, /Document Schedule/); assert.equal(JSON.parse(json.content).report.id, "document");
});

test("shared output preparation rejects unsupported formats", () => assert.throws(() => buildReportOutput(document, "pdf"), /Unsupported/));

test("deterministic report filenames include report type scope and date", () => {
  for (const id of ["incidentSchedule", "chronologyReport", "caseAudit"]) {
    const next = { ...document, report: { ...document.report, id, title: id }, sections: id === "incidentSchedule" ? [{ id: "incident-schedule", rows: [] }, { id: "evidence-coverage", rows: [] }, { id: "incident-quality-findings", items: [] }, { id: "unresolved-references", items: [] }] : [{ id: "record-type-totals", metadata: {} }, { id: "chronology", groups: [] }] };
    const output = buildReportOutput(next, "json"); assert.match(output.filename, new RegExp(`${id.toLowerCase()}-issue-1-2026-07-26\\.json$`)); assert.equal(output.mimeType, "application/json;charset=utf-8");
  }
});
