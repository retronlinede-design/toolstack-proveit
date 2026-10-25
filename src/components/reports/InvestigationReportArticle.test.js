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
const reactUrl = import.meta.resolve("react");
const foundationUrl = new URL("./document/ReportDocumentFoundation.jsx", import.meta.url);
const stylesUrl = new URL("./document/reportDocumentStyles.js", import.meta.url).href;
const foundationTransformed = await transformWithOxc(await readFile(foundationUrl, "utf8"), foundationUrl.pathname);
const foundationCode = foundationTransformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`).replaceAll('from "./reportDocumentStyles.js"', `from "${stylesUrl}"`);
const foundationImportUrl = `data:text/javascript;base64,${Buffer.from(foundationCode).toString("base64")}`;
const articleUrl = new URL("./InvestigationReportArticle.jsx", import.meta.url);
const articleTransformed = await transformWithOxc(await readFile(articleUrl, "utf8"), articleUrl.pathname);
const articleCode = articleTransformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`).replaceAll('from "react"', `from "${reactUrl}"`).replaceAll('import "./InvestigationReportArticle.css";', "").replaceAll('from "./document/index.js"', `from "${foundationImportUrl}"`);
const { default: InvestigationReportArticle } = await import(`data:text/javascript;base64,${Buffer.from(articleCode).toString("base64")}`);

function documentFixture(issue = true) {
  const caseData = { id: "case", name: "Heating Case", status: "open", parties: [{ id: "p1", name: "Alex", role: "Tenant" }], issues: issue ? [{ id: "issue-id", reference: "ISS-003", name: "Heating Failure", purpose: "Review heating failures", status: "open", priority: "high", ownerPartyId: "p1", reviewDate: "2026-09-01", currentPosition: "Response remains outstanding.", createdAt: "2026-01-01", updatedAt: "2026-08-01" }] : [], incidents: [{ id: "inc-1", title: "Heating stopped", eventDate: "2026-03-01", description: "No heat", sequenceGroupId: issue ? "issue-id" : "", sequenceGroup: issue ? "Heating Failure" : "", linkedEvidenceIds: ["ev-1"], linkedPartyIds: ["p1"] }], evidence: [{ id: "ev-1", title: "Photograph", date: "2026-03-01", functionSummary: "Records temperature", evidenceType: "Photograph", sequenceGroupId: issue ? "issue-id" : "", sequenceGroup: issue ? "Heating Failure" : "", linkedIncidentIds: ["inc-1"] }], documents: [], ledger: [], strategy: [], watchItems: [] };
  const model = buildCaseReportModel(caseData, { scope: issue ? "sequenceGroup" : "case", issueId: issue ? "issue-id" : "", sequenceGroupName: issue ? "Heating Failure" : "", generatedAt: "2026-08-02T12:00:00Z" });
  return buildInvestigationReportDocument(model, getReportDefinition("investigation"), { generatedAt: "2026-08-02T12:00:00Z" });
}
function render(document) { return renderToStaticMarkup(React.createElement(InvestigationReportArticle, { reportDocument: document })); }

test("renders a concise professional Investigation briefing with source integrity", () => {
  const html = render(documentFixture());
  for (const label of ["Investigation Report", "Investigation Overview", "Scope and Questions Under Examination", "Relevant Chronology", "Evidence and Recorded Matters", "Inconsistencies and Unresolved Matters", "Outstanding Investigative Actions", "Supporting References", "Source Notes and Document Control"]) assert.match(html, new RegExp(label));
  assert.match(html, /ISS-003 — Heating Failure/); assert.match(html, /Recorded current position/); assert.match(html, /Response remains outstanding/); assert.match(html, /Status: Draft/);
  assert.match(html, /Record reference/); assert.match(html, /Incident: inc-1 — Heating stopped/); assert.match(html, /Evidence: ev-1 — Photograph/); assert.match(html, /do not independently prove an assertion/);
  assert.match(html, /Show detailed appendices for review or print/); assert.doesNotMatch(html, /Appendix A|Appendix B|<h2[^>]*>Document control<\/h2>/i);
});

test("uses semantic, accessible, responsive, and print-safe presentation", () => {
  const html = render(documentFixture());
  assert.match(html, /^<article/); assert.match(html, /<h1/); assert.match(html, /aria-expanded="false"/); assert.match(html, /aria-controls="investigation-report-detailed-appendices"/); assert.doesNotMatch(html, /Page \d+ of|overflow-x-auto|whitespace-nowrap/);
});

test("contains no legacy terminology, placeholders, GPT prompts, or UUID-only prose", () => {
  const html = render(documentFixture());
  assert.doesNotMatch(html, /Sequence Group|Thread|Chain|Bundle|Combined Diagnostics|TODO|Coming soon|GPT prompt/i); assert.doesNotMatch(html, />issue-id</); assert.match(html, /structured records and relationships/);
  const wholeCase = render(documentFixture(false)); assert.match(wholeCase, /Whole case/); assert.match(wholeCase, /No structured whole-case question or current focus/);
});

test("uses the named A4 Investigation Report print contract without simulated page numbering", async () => {
  const css = await readFile(new URL("./InvestigationReportArticle.css", import.meta.url), "utf8");
  assert.match(css, /@page investigation-report/); assert.match(css, /size: A4 portrait/); assert.match(css, /page: investigation-report/); assert.match(css, /break-after: avoid/); assert.match(css, /page-break-inside: avoid/); assert.doesNotMatch(css, /counter\(page\)|Page \d+/i);
});

test("keeps detailed schedules opt-in and leaves the structured document contract untouched", async () => {
  const source = await readFile(articleUrl, "utf8");
  assert.match(source, /aria-expanded=\{showDetails\}/); assert.match(source, /Show detailed appendices for review or print/); assert.match(source, /Detailed schedules are excluded from the default briefing printout/); assert.match(source, /uniqueByStableIdentity/);
  assert.doesNotMatch(source, /buildInvestigationReportDocument|formatReportDocumentAsMarkdown/);
});

test("preserves direct, linked, verification, and unavailable-source distinctions without repeating a finding", () => {
  const reportDocument = structuredClone(documentFixture());
  const evidence = reportDocument.sections.find((section) => section.id === "evidence-overview").items[0];
  evidence.verificationState = "Verified";
  evidence.sourceReference.scopeRelation = "linked-context";
  const sourceRegister = reportDocument.sections.find((section) => section.id === "source-register");
  const directGroup = sourceRegister.groups.find((group) => group.id === "direct-issue-records");
  directGroup.items = directGroup.items.filter((item) => item.recordId !== evidence.id);
  sourceRegister.groups.find((group) => group.id === "linked-context").items.push({ ...evidence.sourceReference, scopeRelation: "linked-context" });
  sourceRegister.groups.find((group) => group.id === "unresolved-references").items.push({ recordType: "evidence", recordId: "missing", scopeRelation: "unavailable", label: "Unavailable source record: evidence missing", targetLabel: "Unresolved record reference" });
  const outstanding = reportDocument.sections.find((section) => section.id === "outstanding-matters");
  const duplicate = { id: "gap-1", message: "Repeated structural concern" };
  outstanding.groups = [{ id: "one", label: "Evidence gaps", items: [duplicate] }, { id: "two", label: "Link gaps", items: [duplicate] }];
  const html = render(reportDocument);
  assert.match(html, /Verification:/); assert.match(html, /Additional linked context/); assert.match(html, /Unavailable source record: evidence missing/); assert.equal([...html.matchAll(/Repeated structural concern/g)].length, 1);
});

