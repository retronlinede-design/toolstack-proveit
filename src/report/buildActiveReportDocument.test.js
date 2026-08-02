import assert from "node:assert/strict";
import test from "node:test";
import { buildActiveReportDocument, reportHasDocumentBuilder } from "./buildActiveReportDocument.js";
import { buildCaseReportModel } from "./reportModel.js";
import { getReportDefinition } from "./reportDefinitions.js";

test("dispatches all ten shared report-document builders", () => { const model = buildCaseReportModel({ id: "case", incidents: [], evidence: [], documents: [], ledger: [] }); for (const id of ["client", "management", "investigation", "evidence", "document", "ledger", "incidentSchedule", "chronologyReport", "caseAudit", "action"]) { const result = buildActiveReportDocument({ reportId: id, reportModel: model, definition: getReportDefinition(id), generatedAt: "2026-07-26T12:00:00Z" }); assert.equal(result.supported, true); assert.equal(result.reportDocument.report.id, id); assert.equal(reportHasDocumentBuilder(id), true); } });
test("returns a clear unsupported result without falling back", () => { const result = buildActiveReportDocument({ reportId: "unknown" }); assert.equal(result.supported, false); assert.equal(result.reportDocument, null); assert.match(result.error, /does not use/); });
