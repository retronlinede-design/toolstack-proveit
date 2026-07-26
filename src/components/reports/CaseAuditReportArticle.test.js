import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { buildCaseAuditDocument } from "../../report/caseAuditDocument.js";
import { buildCaseReportModel } from "../../report/reportModel.js";
import { getReportDefinition } from "../../report/reportDefinitions.js";

const url = new URL("./CaseAuditReportArticle.jsx", import.meta.url); const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname); const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`).replaceAll('from "../../report/reportDocument.js"', `from "${new URL("../../report/reportDocument.js", import.meta.url).href}"`); const Article = (await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)).default;
function render(caseData) { const model = buildCaseReportModel(caseData, { generatedAt: "2026-07-26T12:00:00Z" }); const document = buildCaseAuditDocument(model, getReportDefinition("caseAudit"), { generatedAt: model.generatedAt }); return renderToStaticMarkup(React.createElement(Article, { reportDocument: document, className: "print:shadow-none dark:bg-neutral-900" })); }
test("renders status metrics severities categories codes record IDs notices and provenance", () => { const html = render({ id: "case", incidents: [{ id: "i1", title: "i1", eventDate: "bad" }] }); for (const text of ["Case Audit Report", "Audit Status", "Summary", "Findings by Severity", "Critical Findings", "Findings by Category", "Date Quality", "RECORD_MALFORMED_PRIMARY_DATE", "i1", "Sequence Group Coverage", "Ledger Integrity", "Notices", "Source revision"]) assert.match(html, new RegExp(text)); assert.match(html, /print:shadow-none/); assert.match(html, /<table/); });
test("renders deterministic no-findings and no-Ledger states without crashing", () => { const document = { schemaVersion: 1, report: { title: "Case Audit Report" }, source: { sourceRevision: { fingerprint: "abc" } }, summary: { auditStatus: "No critical structural issues detected" }, notices: [], sections: [{ id: "findings-by-severity", items: [] }, { id: "findings-by-category", categories: [] }, { id: "findings-by-record-type", metadata: {} }, { id: "unresolved-references", items: [] }, { id: "sequence-group-coverage", metadata: {} }, { id: "ledger-integrity", metadata: { entryCount: 0, totalsByCurrency: [] } }] }; const html = renderToStaticMarkup(React.createElement(Article, { reportDocument: document })); assert.match(html, /No audit findings were generated/); assert.match(html, /does not confirm that the case is factually or legally complete/); assert.match(html, /no Ledger records/i); });
