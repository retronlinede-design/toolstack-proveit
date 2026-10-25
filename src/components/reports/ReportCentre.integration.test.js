import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const componentUrl = new URL("./ReportCentreControls.jsx", import.meta.url);
const caseDetailSource = await readFile(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const appSource = await readFile(new URL("../../App.jsx", import.meta.url), "utf8");
const scopeUrl = new URL("../../report/reportScopes.js", import.meta.url).href;
const definitionsUrl = new URL("../../report/reportDefinitions.js", import.meta.url).href;
const configUrl = new URL("./reportCentreConfig.js", import.meta.url);
const configSource = (await readFile(configUrl, "utf8"))
  .replace('from "../../report/reportScopes.js"', `from "${scopeUrl}"`)
  .replace('from "../../report/reportDefinitions.js"', `from "${definitionsUrl}"`);
const importableConfigUrl = `data:text/javascript;base64,${Buffer.from(configSource).toString("base64")}`;
const outputUrl = new URL("./ReportOutputActions.jsx", import.meta.url);
const outputTransformed = await transformWithOxc(await readFile(outputUrl, "utf8"), outputUrl.pathname);
const importableOutputUrl = `data:text/javascript;base64,${Buffer.from(outputTransformed.code
  .replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`)
  .replaceAll('from "../../report/reportScopes.js"', `from "${scopeUrl}"`)).toString("base64")}`;
const transformed = await transformWithOxc(await readFile(componentUrl, "utf8"), componentUrl.pathname);
const runtimeUrl = import.meta.resolve("react/jsx-runtime");
const importableCode = transformed.code
  .replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`)
  .replaceAll('from "../../report/reportScopes.js"', `from "${scopeUrl}"`)
  .replaceAll('from "./ReportOutputActions.jsx"', `from "${importableOutputUrl}"`)
  .replaceAll('from "./reportCentreConfig.js"', `from "${importableConfigUrl}"`);
const module = await import(`data:text/javascript;base64,${Buffer.from(importableCode).toString("base64")}`);
const configModule = await import(importableConfigUrl);
const {
  default: ReportCentreControls,
  ReportCentrePreviewSummary,
} = module;
const { REPORT_CENTRE_TYPES } = configModule;

const noOp = () => {};

function renderControls(overrides = {}) {
  return renderToStaticMarkup(React.createElement(ReportCentreControls, {
    reportType: "management",
    scopeType: "case",
    issues: [{ id: "issue-alpha", label: "ISS-001 — Alpha" }, { id: "issue-beta", label: "ISS-002 — Beta" }],
    selectedIssueId: "issue-alpha",
    markdownAvailable: false,
    onReportTypeChange: noOp,
    onScopeTypeChange: noOp,
    onIssueChange: noOp,
    onPrint: noOp,
    onCopyMarkdown: noOp,
    onOpenSequenceGroupAudit: noOp,
    ...overrides,
  }));
}

function renderPreview(reportType, scopeType, scopeLabel) {
  return renderToStaticMarkup(React.createElement(ReportCentrePreviewSummary, {
    reportType,
    scopeType,
    scopeLabel,
  }));
}

test("Reports Centre prioritises main reports and keeps specialist and internal formats accessible", () => {
  const html = renderControls();
  for (const label of ["Executive Report", "Case Position Brief", "Issue Investigation Report", "Client Update Draft", "Incident Schedule", "Evidence Schedule", "Case Quality Audit", "Operational Brief"]) assert.match(html, new RegExp(label));
  for (const heading of ["1 · Choose purpose", "2 · Choose scope", "Main Reports", "Specialist Schedules", "Internal Tools &amp; Documentation"]) assert.match(html, new RegExp(heading));
  assert.match(html, /Issue Audit/);
  assert.match(html, /External Drafting Handoff/);
  assert.match(html, /external AI drafting service/);
  for (const label of ["Copy JSON Pack", "Copy Markdown Prompt", "Copy Specialist Review Prompt"]) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /Unavailable Reports/);
  assert.match(html, /not independently verified or approved/);
  assert.match(html, /Audience/);
  assert.match(html, /Completeness/);
  assert.match(html, /<details class="case-file-reports-specialist">/);
  assert.match(html, /Case Documentation/);
  assert.doesNotMatch(html, /Print Pack/);
});

test("changing report type changes the rendered preview description", () => {
  const evidence = renderPreview("evidence", "case", "Whole case");
  const action = renderPreview("action", "sequenceGroup", "sequenceGroup: Alpha");

  assert.match(evidence, /complete Evidence Schedule report document/);
  assert.doesNotMatch(evidence, /structured case and sequence-group assignments/);
  assert.match(action, /separating recorded case actions from deterministic data-quality corrections/);
  assert.match(action, /Scope: sequenceGroup: Alpha/);
});

test("Management and Client reports are rendered as whole-case only", () => {
  for (const reportType of ["management", "client"]) {
    const html = renderControls({ reportType, scopeType: "sequenceGroup" });
    assert.match(html, /Whole Case/);
    assert.doesNotMatch(html, />Sequence Group</);
    assert.match(html, /aria-pressed="true" disabled=""/);
    assert.match(html, /whole case only/i);
  }
  assert.match(renderPreview("management", "case", "Whole case"), /executive briefing focused on the current position/);
});

test("sequence-group-capable reports render honest scope controls and labels", () => {
  const html = renderControls({ reportType: "evidence", scopeType: "sequenceGroup" });
  assert.match(html, /Whole Case/);
  assert.match(html, />Issue</);
  assert.match(html, /id="report-centre-issue"/);
  assert.match(html, /<option value="issue-alpha" selected="">ISS-001 — Alpha<\/option>/);

  const preview = renderPreview("evidence", "sequenceGroup", "Issue: Alpha");
  assert.match(preview, /Scope: Issue: Alpha/);
});

test("empty sequence group collections render a useful empty state", () => {
  const html = renderControls({
    reportType: "action",
    scopeType: "sequenceGroup",
    issues: [],
    selectedIssueId: "",
  });
  assert.match(html, /No Issues exist in this case yet/);
  assert.doesNotMatch(html, /Print \/ Save PDF/);
});

test("Incident Schedule and Chronology Report expose complete scoped previews", () => {
  for (const reportType of ["incidentSchedule", "chronologyReport"]) {
    const controls = renderControls({ reportType, scopeType: "sequenceGroup" });
    assert.match(controls, /Whole Case/); assert.match(controls, />Issue</);
    assert.match(renderPreview(reportType, "sequenceGroup", "Issue: Alpha"), /Scope: Issue: Alpha/);
  }
  assert.match(caseDetailSource, /<IncidentScheduleReportArticle/); assert.match(caseDetailSource, /<ChronologyReportArticle/); assert.match(caseDetailSource, /reportCentreIncidentDocument/); assert.match(caseDetailSource, /reportCentreChronologyDocument/);
});

test("Case Audit Report remains available as an advanced internal tool", () => {
  const controls = renderControls({ reportType: "caseAudit", scopeType: "sequenceGroup" });
  assert.match(controls, /Internal Tools &amp; Documentation/); assert.match(controls, /Whole Case/); assert.match(controls, />Issue</);
  assert.match(renderPreview("caseAudit", "sequenceGroup", "Sequence Group: Alpha"), /internal deterministic audit/i);
  assert.match(caseDetailSource, /<CaseAuditReportArticle/); assert.match(caseDetailSource, /reportCentreCaseAuditDocument/); assert.match(caseDetailSource, /This Issue contains no directly assigned records to audit/);
});

test("complete Investigation document scope is explicit", () => {
  const wholeCase = renderPreview("investigation", "case", "Whole case");
  const group = renderPreview("investigation", "sequenceGroup", "sequenceGroup: Alpha");
  assert.match(wholeCase, /Complete professional investigation document/);
  assert.doesNotMatch(wholeCase, /12 evidence records|bounded/i);
  assert.match(group, /selected Issue/);
});

test("optional control values do not prevent the Report Centre from rendering", () => {
  assert.doesNotThrow(() => renderControls({ issues: undefined, selectedIssueId: undefined }));
});

test("External Drafting Handoff uses the existing canonical Issue selector and fails closed when unavailable", () => {
  const scoped = renderControls({ externalDraftingScopeType: "sequenceGroup", externalDraftingIssueAvailable: true });
  assert.match(scoped, /External Drafting Handoff scope/);
  assert.match(scoped, /id="external-drafting-issue"/);
  assert.match(scoped, /<option value="issue-alpha" selected="">ISS-001 — Alpha<\/option>/);

  const unavailable = renderControls({
    externalDraftingScopeType: "sequenceGroup",
    selectedIssueId: "removed-issue",
    externalDraftingIssueAvailable: false,
  });
  assert.match(unavailable, /The selected Issue is no longer available/);
  assert.match(unavailable, /disabled=""/);
});

test("the active CaseDetail Report Centre uses the rendered control boundary", () => {
  assert.match(caseDetailSource, /<ReportCentreControls/);
  assert.match(caseDetailSource, /externalDraftingScopeType=\{externalDraftingScopeType\}/);
  assert.match(caseDetailSource, /buildManagementReportBuilderPack\(selectedCase, "", getExternalDraftingScope\(\)\)/);
  assert.match(caseDetailSource, /buildManagementReportBuilderMarkdownPrompt\(selectedCase, "", getExternalDraftingScope\(\)\)/);
  assert.match(caseDetailSource, /buildManagementReportBuilderSpecialistPrompt\(selectedCase, "", getExternalDraftingScope\(\)\)/);
  assert.match(caseDetailSource, /issueId: reportCentreScope\.issueId/);
  assert.doesNotMatch(caseDetailSource, /find\(\(issue\) => String\(issue\?\.name/);
  assert.match(caseDetailSource, /<ReportContextHeader/);
  assert.match(caseDetailSource, /<ReportCentrePreviewSummary/);
  assert.match(caseDetailSource, /reportDocument={reportCentreActiveDocument}/);
  assert.match(caseDetailSource, /<InvestigationReportArticle reportDocument={reportCentreInvestigationDocument}/);
  assert.match(caseDetailSource, /<ExecutiveReportArticle reportDocument={reportCentreActiveDocument}/);
  assert.match(caseDetailSource, /buildExecutiveDraftCandidate/);
  assert.match(caseDetailSource, /Saved Drafts/);
  assert.match(caseDetailSource, /Viewing saved historical snapshot/);
  assert.match(caseDetailSource, /Save new Draft revision/);
  assert.match(caseDetailSource, /useState\("executive"\)/);
  assert.match(caseDetailSource, /useState\("sequenceGroup"\)/);
  assert.doesNotMatch(caseDetailSource, /reportCentreType === "investigation"[\s\S]{0,200}<CaseBundleReportArticle/);
  assert.match(caseDetailSource, /className="case-file-reports space-y-5"/);
  assert.match(caseDetailSource, /Review the selected report/);
  assert.match(caseDetailSource, /Export the reviewed preview/);
  assert.match(caseDetailSource, /Original attachments are not embedded/);
  assert.match(caseDetailSource, /<ReportOutputActions/);
  assert.match(caseDetailSource, /id="case-documentation"/);
  assert.match(caseDetailSource, /id="internal-case-summary"/);
  assert.match(caseDetailSource, /Internal Case Summary/);
  assert.match(caseDetailSource, /Legacy Specialist Format/);
  assert.match(caseDetailSource, /<CaseBundleReportArticle/);
  assert.doesNotMatch(caseDetailSource, /activeTab === "pack"/);
  assert.doesNotMatch(caseDetailSource, /onOpenPrintPack/);
  assert.doesNotMatch(caseDetailSource, /\{ id: "client", label: "Client Report"/);
  assert.doesNotMatch(caseDetailSource, /variant="pack"/);
});

test("Executive Draft saving waits for the existing persistence acknowledgement", () => {
  assert.match(caseDetailSource, /const saved = await onUpdateCase\(\{ \.\.\.selectedCase, reportLibrary: candidate\.reportLibrary \}\)/);
  assert.match(caseDetailSource, /if \(!saved\) \{\s*if \(selectedCaseRef\.current\?\.id === savingCaseId\) setExecutiveDraftFeedback\("Draft was not saved/);
  assert.match(appSource, /await saveCase\(canonicalCase\);\s*setCases/);
  assert.match(appSource, /return true;/);
});

test("the active Evidence Pack follows model document and unchanged renderer path", () => {
  assert.match(caseDetailSource, /buildCaseReportModel\(selectedCase/);
  assert.match(caseDetailSource, /buildEvidenceScheduleDocument\(reportCentreModel, getReportDefinition\("evidence"\)\)/);
  assert.match(caseDetailSource, /projectEvidenceDocumentToLegacyViewModel\(reportCentreEvidenceDocument\)/);
  assert.match(caseDetailSource, /<EvidencePackReportArticle/);
});

test("Document and Ledger packs share one factual model and retain their existing renderers", () => {
  assert.match(caseDetailSource, /buildDocumentScheduleDocument\(reportCentreModel, getReportDefinition\("document"\)\)/);
  assert.match(caseDetailSource, /projectDocumentDocumentToLegacyViewModel\(reportCentreDocumentDocument\)/);
  assert.match(caseDetailSource, /buildLedgerScheduleDocument\(reportCentreModel, getReportDefinition\("ledger"\)\)/);
  assert.match(caseDetailSource, /projectLedgerDocumentToLegacyViewModel\(reportCentreLedgerDocument\)/);
  assert.match(caseDetailSource, /<DocumentPackReportArticle/);
  assert.match(caseDetailSource, /<LedgerPackReportArticle/);
});

test("disabled placeholder reports do not appear in Reports Centre navigation", () => {
  const html = renderControls();
  assert.doesNotMatch(html, /Unavailable Reports/);
  assert.doesNotMatch(caseDetailSource, /Internal Report — Unavailable/);
  assert.doesNotMatch(caseDetailSource, /id: "lawyer", label: "Lawyer Pack — Unavailable", available: false/);
});
