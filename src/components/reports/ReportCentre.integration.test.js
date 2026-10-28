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
const { REPORT_CENTRE_FAMILIES, REPORT_CENTRE_TYPES } = configModule;

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

test("Reports Centre groups every existing report under compact purpose-led navigation", () => {
  const html = renderControls();
  for (const label of ["Professional Reports", "Client Updates", "Technical Records", "Saved Reports"]) assert.match(html, new RegExp(label));
  for (const label of ["Executive Report", "Management Report", "Investigation Report"]) assert.match(html, new RegExp(label));
  for (const heading of ["Choose a report purpose", "Selected report", "Documentation, audit and external drafting utilities"]) assert.match(html, new RegExp(heading));
  assert.match(html, /Issue Audit/);
  assert.match(html, /External Drafting Handoff/);
  assert.match(html, /external AI drafting service/);
  for (const label of ["Copy JSON Pack", "Copy Markdown Prompt", "Copy Specialist Review Prompt"]) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /Unavailable Reports/);
  assert.match(html, /Neither independently verifies or approves the case record/);
  assert.match(html, /<details class="case-file-reports-specialist">/);
  for (const label of ["Documentation Builder", "Legacy Executive Summary", "Internal Case Summary", "Thread / Issue Report", "Legacy Evidence Pack", "Legacy Document Pack", "Legacy Ledger Pack", "Case Structure Export"]) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /Case Documentation/);
  assert.doesNotMatch(html, /Print Pack/);
});

test("Technical Records explains its traceable source-material role and keeps every technical report reachable", () => {
  const html = renderControls({ reportType: "incidentSchedule" });
  assert.match(html, /Traceable schedules, chronology, diagnostics, and operational source material/);
  assert.match(html, /evidence review and later report drafting/);
  for (const label of ["Incident Schedule", "Evidence Schedule", "Document Schedule", "Ledger Schedule", "Chronology", "Case Quality Audit", "Operational Brief"]) assert.match(html, new RegExp(label));
});

test("Advanced tools are grouped by purpose without removing utilities or their scope safeguards", () => {
  const html = renderControls({ externalDraftingScopeType: "sequenceGroup", externalDraftingIssueAvailable: true });
  for (const heading of ["Bounded external handoff", "Issue and case audit", "Documentation and supporting packs"]) assert.match(html, new RegExp(heading));
  assert.match(html, /This uses the Reports Centre Issue selector/);
  assert.match(html, /other advanced utilities retain their own scope/);
  assert.match(html, /Issue \/ All Issues \(own audit mode\)/);
  assert.match(html, /Selected canonical Issue \(own selection\)/);
  for (const label of ["Documentation Builder", "Legacy Executive Summary", "Internal Case Summary", "Thread / Issue Report", "Legacy Evidence Pack", "Legacy Document Pack", "Legacy Ledger Pack", "Case Structure Export", "Issue Audit", "External Drafting Handoff"]) assert.match(html, new RegExp(label));
});

test("every existing report type remains reachable from exactly one report family", () => {
  const familyTypes = REPORT_CENTRE_FAMILIES.flatMap((family) => family.reports).sort();
  assert.deepEqual(familyTypes, REPORT_CENTRE_TYPES.map((item) => item.value).sort());
  for (const type of REPORT_CENTRE_TYPES) {
    const html = renderControls({ reportType: type.value });
    assert.match(html, new RegExp(REPORT_CENTRE_FAMILIES.find((family) => family.reports.includes(type.value)).label));
    assert.match(html, new RegExp(`report-choice-${type.value}-purpose`));
  }
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

test("Case Audit Report remains available under Technical Records", () => {
  const controls = renderControls({ reportType: "caseAudit", scopeType: "sequenceGroup" });
  assert.match(controls, /Technical Records/); assert.match(controls, /Whole Case/); assert.match(controls, />Issue</);
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
  assert.match(caseDetailSource, /<InvestigationReportArticle reportDocument={reportCentreActiveDocument}/);
  assert.match(caseDetailSource, /<ExecutiveReportArticle reportDocument={reportCentreActiveDocument}/);
  assert.match(caseDetailSource, /buildExecutiveDraftCandidate/);
  assert.match(caseDetailSource, /Saved Reports/);
  assert.match(caseDetailSource, /Viewing an immutable saved Draft snapshot/);
  assert.match(caseDetailSource, /reportCentreDestination/);
  assert.match(caseDetailSource, /handleOpenSavedReports/);
  assert.match(caseDetailSource, /Save new Draft revision/);
  assert.match(caseDetailSource, /useState\("executive"\)/);
  assert.match(caseDetailSource, /useState\("sequenceGroup"\)/);
  assert.doesNotMatch(caseDetailSource, /reportCentreType === "investigation"[\s\S]{0,200}<CaseBundleReportArticle/);
  assert.match(caseDetailSource, /className="case-file-reports space-y-5"/);
  assert.match(caseDetailSource, /Review the selected report/);
  assert.match(caseDetailSource, /case-file-reports-document-layout/);
  assert.match(caseDetailSource, /case-file-reports-document-preview/);
  assert.match(caseDetailSource, /case-file-reports-actions-toolbar/);
  assert.match(caseDetailSource, /primaryAction=\{reportCentreType === "executive"/);
  assert.match(caseDetailSource, /Live preview/);
  assert.match(caseDetailSource, /Original attachments are not embedded/);
  assert.match(caseDetailSource, /<ReportOutputActions/);
  assert.match(caseDetailSource, /id="case-documentation"/);
  assert.match(caseDetailSource, /id="internal-case-summary"/);
  assert.match(caseDetailSource, /Internal Case Summary/);
  assert.match(caseDetailSource, /reportCentreAdvancedTool/);
  assert.match(caseDetailSource, /onOpenAdvancedTool=\{handleOpenReportCentreAdvancedTool\}/);
  assert.match(caseDetailSource, /hidden aria-hidden="true"/);
  assert.doesNotMatch(caseDetailSource, /Legacy Specialist Format/);
  assert.doesNotMatch(caseDetailSource, /Lawyer Pack coming later/);
  assert.match(caseDetailSource, /<CaseBundleReportArticle/);
  assert.doesNotMatch(caseDetailSource, /activeTab === "pack"/);
  assert.doesNotMatch(caseDetailSource, /onOpenPrintPack/);
  assert.doesNotMatch(caseDetailSource, /\{ id: "client", label: "Client Report"/);
  assert.doesNotMatch(caseDetailSource, /variant="pack"/);
});

test("professional report previews can prepare a local, freshness-checked AI Brief without changing report output flows", () => {
  assert.match(caseDetailSource, /import \{ buildAiBrief, getAiBriefFreshness, validateAiBrief \} from "\.\.\/report\/aiBrief\.js"/);
  assert.match(caseDetailSource, /const \[preparedAiBrief, setPreparedAiBrief\] = useState\(null\)/);
  assert.match(caseDetailSource, /const aiBriefEligible = \["executive", "management", "investigation", "client"\]\.includes\(reportCentreType\)/);
  assert.match(caseDetailSource, /const preparedAiBriefFreshness = useMemo/);
  assert.match(caseDetailSource, /const brief = buildAiBrief\(selectedCase, \{/);
  assert.match(caseDetailSource, /reportFamily: reportCentreType/);
  assert.match(caseDetailSource, /issueId: normalisedReportCentreScopeType === "sequenceGroup" \? selectedReportCentreIssue\.id : ""/);
  assert.match(caseDetailSource, /Prepared AI Brief JSON copied/);
  assert.match(caseDetailSource, /Prepared AI Brief JSON downloaded/);
  assert.match(caseDetailSource, /<AiBriefPanel brief=\{preparedAiBrief\} freshness=\{preparedAiBriefFreshness\}/);
  assert.match(caseDetailSource, /secondaryAction=\{aiBriefEligible \? \{ label: "Prepare AI Brief"/);
});

test("AI Draft preparation and validation remain local, use the original Brief, and do not enter report persistence flows", () => {
  assert.match(caseDetailSource, /import \{ parseAiDraft, parseAndValidateAiDraft \} from "\.\.\/report\/aiDraft\.js"/);
  assert.match(caseDetailSource, /import \{ buildAiDraftingRequest \} from "\.\.\/report\/aiDraftRequest\.js"/);
  assert.match(caseDetailSource, /const \[aiDraftText, setAiDraftText\] = useState\(""\)/);
  assert.match(caseDetailSource, /const \[aiDraftValidation, setAiDraftValidation\] = useState\(null\)/);
  assert.match(caseDetailSource, /buildAiDraftingRequest\(preparedAiBrief\)/);
  assert.match(caseDetailSource, /parseAndValidateAiDraft\(aiDraftText, preparedAiBrief\)/);
  assert.match(caseDetailSource, /preparedAiBriefFreshness !== "current"/);
  assert.match(caseDetailSource, /The pasted AI Draft text was preserved/);
  assert.match(caseDetailSource, /onCopyDraftingRequest=\{handleCopyAiDraftingRequest\}/);
  assert.match(caseDetailSource, /onValidateDraft=\{handleValidateAiDraft\}/);
  assert.doesNotMatch(caseDetailSource, /onUpdateCase\(\{ \.\.\.selectedCase, aiDraft/);
});

test("Management AI Draft previews are exact-validation-gated, local, and cannot replace live output routes", () => {
  assert.match(caseDetailSource, /import \{ buildManagementAiDraftPreview \} from "\.\.\/report\/managementAiDraftPreview\.js"/);
  assert.match(caseDetailSource, /const \[aiDraftValidatedText, setAiDraftValidatedText\] = useState\(""\)/);
  assert.match(caseDetailSource, /const \[managementAiDraftPreview, setManagementAiDraftPreview\] = useState\(null\)/);
  assert.match(caseDetailSource, /aiDraftValidatedText !== aiDraftText/);
  assert.match(caseDetailSource, /draft: aiDraftValidation\.normalisedDraft/);
  assert.match(caseDetailSource, /freshness: preparedAiBriefFreshness/);
  assert.match(caseDetailSource, /onPreviewManagementDraft=\{handlePreviewManagementAiDraft\}/);
  assert.match(caseDetailSource, /managementPreviewAvailable=\{reportCentreType === "management"/);
  assert.match(caseDetailSource, /className="print:hidden" aria-labelledby="management-ai-draft-preview-heading"/);
  assert.match(caseDetailSource, /Printing and export actions remain connected only to the ordinary live Management Report below/);
  assert.doesNotMatch(caseDetailSource, /onUpdateCase\(\{[^}]*managementAiDraftPreview/);
});

test("Management AI Draft acceptance persists only an acknowledged immutable draft revision from a current exact validation", () => {
  assert.match(caseDetailSource, /buildManagementAiDraftCandidate/);
  assert.match(caseDetailSource, /preparedAiBriefFreshness !== "current"/);
  assert.match(caseDetailSource, /parseAiDraft\(aiDraftText\)/);
  assert.match(caseDetailSource, /currentSourceFingerprint: reportCentreModel\?\.sourceRevision\?\.fingerprint/);
  assert.match(caseDetailSource, /reportLibrary: candidate\.reportLibrary/);
  assert.match(caseDetailSource, /if \(!saved\) \{\s*setAiDraftFeedback\("Management AI Draft was not saved/);
  assert.match(caseDetailSource, /Accept as Management Draft/);
  assert.match(caseDetailSource, /unapproved Draft revision only/);
  assert.doesNotMatch(caseDetailSource, /generatedReportVersions:[\s\S]{0,300}buildManagementAiDraftCandidate/);
});

test("Management AI Draft history opens only verified immutable snapshots and routes existing actions to that snapshot", () => {
  assert.match(caseDetailSource, /getManagementAiDrafts/);
  assert.match(caseDetailSource, /setSavedManagementAiDraftRevisionId\(""\)/);
  assert.match(caseDetailSource, /verifyManagementAiDraft\(selectedCase, draft\.revision\.id\)/);
  assert.match(caseDetailSource, /Saved Management AI Draft revisions/);
  assert.match(caseDetailSource, /AI-assisted \/ externally drafted/);
  assert.match(caseDetailSource, /reportCentreType === "management" && savedManagementAiDraft/);
  assert.match(caseDetailSource, /savedManagementAiDraft\.revision\.content\.reportDocument/);
  assert.match(caseDetailSource, /Viewing immutable Management AI Draft revision/);
  assert.match(caseDetailSource, /Open live Management Report/);
  assert.match(caseDetailSource, /reportCentreType === "management" && <ManagementReportArticle reportDocument=\{reportCentreActiveDocument\}/);
  assert.match(caseDetailSource, /This Management AI Draft cannot be exported/);
  assert.match(caseDetailSource, /This Management AI Draft cannot be printed/);
  assert.doesNotMatch(caseDetailSource, /onUpdateCase\(\{[^}]*savedManagementAiDraft/);
});

test("Management AI Draft lifecycle uses named human transitions, verified immutable history, and acknowledged case persistence", () => {
  assert.match(caseDetailSource, /buildManagementAiDraftLifecycleCandidate/);
  assert.match(caseDetailSource, /handleManagementAiDraftLifecycleTransition/);
  assert.match(caseDetailSource, /Human review and approval/);
  assert.match(caseDetailSource, /Outstanding human-review items/);
  assert.match(caseDetailSource, /Record human review/);
  assert.match(caseDetailSource, /Approve Management Draft/);
  assert.match(caseDetailSource, /currentBriefCaseRevision: reportCentreModel\?\.sourceRevision\?\.caseUpdatedAt/);
  assert.match(caseDetailSource, /const saved = await onUpdateCase\(\{ \.\.\.selectedCase, reportLibrary: candidate\.reportLibrary \}\)/);
  assert.match(caseDetailSource, /source fingerprint and revision/);
  assert.match(caseDetailSource, /historicalLifecycle: structuredClone\(savedManagementAiDraft\.revision\.lifecycle\)/);
});

test("Executive AI Draft workflow keeps the live report separate from validated preview, immutable acceptance, and human lifecycle controls", () => {
  assert.match(caseDetailSource, /buildExecutiveAiDraftPreview/);
  assert.match(caseDetailSource, /onPreviewExecutiveDraft=\{handlePreviewExecutiveAiDraft\}/);
  assert.match(caseDetailSource, /Accept as Executive Draft/);
  assert.match(caseDetailSource, /buildExecutiveAiDraftCandidate/);
  assert.match(caseDetailSource, /buildExecutiveAiDraftLifecycleCandidate/);
  assert.match(caseDetailSource, /verifyExecutiveAiDraft/);
  assert.match(caseDetailSource, /Record human review/);
  assert.match(caseDetailSource, /Approve Executive Draft/);
  assert.match(caseDetailSource, /Printing and export actions remain connected only to the ordinary live Executive Report below/);
});

test("Investigation AI Draft workflow preserves the separate live report, immutable snapshots, and named lifecycle controls", () => {
  assert.match(caseDetailSource, /buildInvestigationAiDraftPreview/);
  assert.match(caseDetailSource, /onPreviewInvestigationDraft=\{handlePreviewInvestigationAiDraft\}/);
  assert.match(caseDetailSource, /Accept as Investigation Draft/);
  assert.match(caseDetailSource, /buildInvestigationAiDraftCandidate/);
  assert.match(caseDetailSource, /buildInvestigationAiDraftLifecycleCandidate/);
  assert.match(caseDetailSource, /verifyInvestigationAiDraft/);
  assert.match(caseDetailSource, /Saved Investigation AI Draft revisions/);
  assert.match(caseDetailSource, /Approve Investigation Draft/);
  assert.match(caseDetailSource, /direct-versus-linked context/);
});

test("Executive Draft saving waits for the existing persistence acknowledgement", () => {
  assert.match(caseDetailSource, /const saved = await onUpdateCase\(\{ \.\.\.selectedCase, reportLibrary: candidate\.reportLibrary \}\)/);
  assert.match(caseDetailSource, /if \(!saved\) \{\s*if \(selectedCaseRef\.current\?\.id === savingCaseId\) setExecutiveDraftFeedback\("Draft was not saved/);
  assert.match(appSource, /await saveCase\(canonicalCase\);\s*setCases/);
  assert.match(appSource, /return true;/);
});

test("Client Update Save and Render persists its immutable revision and language slot through one acknowledged case update", () => {
  assert.match(caseDetailSource, /buildClientUpdateDraftCandidate\(\{/);
  assert.match(caseDetailSource, /acceptedNarrative: nextText/);
  assert.match(caseDetailSource, /sourceFingerprint: clientNarrativeMeta\.sourceRevision/);
  assert.match(caseDetailSource, /provenance: extractReportDocumentProvenance\(document\)/);
  assert.match(caseDetailSource, /const saved = await onUpdateCase\(\{[\s\S]*generatedReportVersions: \{ \.\.\.existingVersions, \[lang\]: nextText \},[\s\S]*reportLibrary: candidate\.reportLibrary/);
  assert.match(caseDetailSource, /if \(!saved\) \{\s*setReportPromptFeedback\("Client Update was not saved/);
  assert.match(caseDetailSource, /validation\.revisionState !== "current"/);
  assert.match(caseDetailSource, /setSavedClientUpdateSnapshot\(\{ caseId: selectedCase\.id, revision: candidate\.revision \}\)/);
});

test("Client Update historical revisions are integrity-gated and render their saved snapshots", () => {
  assert.match(caseDetailSource, /getClientUpdateSavedDrafts\(selectedCase\)/);
  assert.match(caseDetailSource, /verifyClientUpdateSavedDraft\(selectedCase, draft\.revision\.id\)/);
  assert.match(caseDetailSource, /activeSavedClientUpdateRevision\.content\.reportDocument/);
  assert.match(caseDetailSource, /activeSavedClientUpdateRevision\.content\[format === "json" \? "json" : "markdown"\]/);
  assert.match(caseDetailSource, /Saved Client Update revisions/);
  assert.match(caseDetailSource, /Viewing immutable Client Update revision/);
  assert.match(caseDetailSource, /Open live Client Update/);
  assert.match(caseDetailSource, /setSavedClientUpdateRevisionId\(""\)/);
});

test("Client Update review controls use the immutable lifecycle candidate and only acknowledge a persisted transition", () => {
  assert.match(caseDetailSource, /buildClientUpdateLifecycleCandidate\(\{/);
  assert.match(caseDetailSource, /revisionId: savedClientUpdateDraft\.revision\.id/);
  assert.match(caseDetailSource, /reviewerName: clientUpdateReviewer/);
  assert.match(caseDetailSource, /currentFingerprint: reportCentreModel\?\.sourceRevision\?\.fingerprint/);
  assert.match(caseDetailSource, /const saved = await onUpdateCase\(\{ \.\.\.selectedCase, reportLibrary: candidate\.reportLibrary \}\)/);
  assert.match(caseDetailSource, /Client Update review status was not saved\. The prior lifecycle status remains in effect/);
  assert.match(caseDetailSource, /Mark for review/);
  assert.match(caseDetailSource, /Human reviewer/);
  assert.match(caseDetailSource, /Approve revision/);
  assert.match(caseDetailSource, /Approval requires a named human reviewer and a current source fingerprint/);
});

test("legacy Client Update drafts require explicit confirmation and preserve unknown historical provenance", () => {
  assert.match(caseDetailSource, /getLegacyClientUpdateNarratives\(selectedCase\)/);
  assert.match(caseDetailSource, /Legacy draft — historical source provenance unknown/);
  assert.match(caseDetailSource, /Create immutable draft from legacy text/);
  assert.match(caseDetailSource, /Confirm create immutable draft/);
  assert.match(caseDetailSource, /buildLegacyClientUpdateDraftCandidate\(\{/);
  assert.match(caseDetailSource, /createLegacyClientUpdateSnapshot\(liveDocument, importedAt\)/);
  assert.match(caseDetailSource, /const saved = await onUpdateCase\(\{ \.\.\.selectedCase, reportLibrary: candidate\.reportLibrary \}\)/);
  assert.match(caseDetailSource, /The original legacy text remains unchanged/);
  assert.match(caseDetailSource, /legacy narrative provenance: unknown/);
  assert.match(caseDetailSource, /cannot be approved as current/);
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
