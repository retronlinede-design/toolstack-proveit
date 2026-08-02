import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { buildInvestigationReportDocument } from "../../report/investigationReportDocument.js";
import { buildCaseReportModel } from "../../report/reportModel.js";
import { getReportDefinition } from "../../report/reportDefinitions.js";

const runtimeUrl = import.meta.resolve("react/jsx-runtime");
const foundationUrl = new URL("./document/ReportDocumentFoundation.jsx", import.meta.url);
const stylesUrl = new URL("./document/reportDocumentStyles.js", import.meta.url).href;
const foundationTransformed = await transformWithOxc(await readFile(foundationUrl, "utf8"), foundationUrl.pathname);
const foundationCode = foundationTransformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`).replaceAll('from "./reportDocumentStyles.js"', `from "${stylesUrl}"`);
const foundationImportUrl = `data:text/javascript;base64,${Buffer.from(foundationCode).toString("base64")}`;
const articleUrl = new URL("./InvestigationReportArticle.jsx", import.meta.url);
const articleTransformed = await transformWithOxc(await readFile(articleUrl, "utf8"), articleUrl.pathname);
const articleCode = articleTransformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`).replaceAll('from "./document/index.js"', `from "${foundationImportUrl}"`);
const { default: InvestigationReportArticle } = await import(`data:text/javascript;base64,${Buffer.from(articleCode).toString("base64")}`);

function documentFixture(issue = true) {
  const caseData = { id: "case", name: "Heating Case", status: "open", parties: [{ id: "p1", name: "Alex", role: "Tenant" }], issues: issue ? [{ id: "issue-id", reference: "ISS-003", name: "Heating Failure", purpose: "Review heating failures", status: "open", priority: "high", ownerPartyId: "p1", reviewDate: "2026-09-01", currentPosition: "Response remains outstanding.", createdAt: "2026-01-01", updatedAt: "2026-08-01" }] : [], incidents: [{ id: "inc-1", title: "Heating stopped", eventDate: "2026-03-01", description: "No heat", sequenceGroupId: issue ? "issue-id" : "", sequenceGroup: issue ? "Heating Failure" : "", linkedEvidenceIds: ["ev-1"], linkedPartyIds: ["p1"] }], evidence: [{ id: "ev-1", title: "Photograph", date: "2026-03-01", functionSummary: "Records temperature", evidenceType: "Photograph", sequenceGroupId: issue ? "issue-id" : "", sequenceGroup: issue ? "Heating Failure" : "", linkedIncidentIds: ["inc-1"] }], documents: [], ledger: [], strategy: [], watchItems: [] };
  const model = buildCaseReportModel(caseData, { scope: issue ? "sequenceGroup" : "case", issueId: issue ? "issue-id" : "", sequenceGroupName: issue ? "Heating Failure" : "", generatedAt: "2026-08-02T12:00:00Z" });
  return buildInvestigationReportDocument(model, getReportDefinition("investigation"), { generatedAt: "2026-08-02T12:00:00Z" });
}
function render(document) { return renderToStaticMarkup(React.createElement(InvestigationReportArticle, { reportDocument: document })); }

test("renders the complete professional Investigation document hierarchy", () => {
  const html = render(documentFixture());
  for (const label of ["Investigation Report", "Document control", "Executive Summary", "Current Position", "Investigation Snapshot", "Key Findings", "Narrative Chronology", "Evidence Overview", "Supporting Documents", "People Involved", "Outstanding Matters", "Next Actions", "Appendix A", "Appendix B", "Technical Reference Index"]) assert.match(html, new RegExp(label));
  assert.match(html, /ISS-003 — Heating Failure/); assert.match(html, /User-authored current position/); assert.match(html, /Response remains outstanding/); assert.match(html, /AI assistance/); assert.match(html, />None</);
});

test("uses semantic, accessible, responsive, dark, and print-safe presentation", () => {
  const html = render(documentFixture());
  assert.match(html, /^<article/); assert.match(html, /<h1/); assert.match(html, /<caption/); assert.match(html, /scope="col"/); assert.match(html, /dark:/); assert.match(html, /print:/); assert.match(html, /sm:grid-cols/); assert.doesNotMatch(html, /Page \d+ of|overflow-x-auto|whitespace-nowrap/);
});

test("contains no legacy terminology, placeholders, GPT prompts, or UUID-only prose", () => {
  const html = render(documentFixture());
  assert.doesNotMatch(html, /Sequence Group|Thread|Chain|Bundle|Combined Diagnostics|TODO|Coming soon|GPT prompt/i); assert.doesNotMatch(html, />issue-id</); assert.match(html, /structured records and relationships/);
  const wholeCase = render(documentFixture(false)); assert.match(wholeCase, /Whole case/); assert.match(wholeCase, /No reliable whole-case current focus/);
});

