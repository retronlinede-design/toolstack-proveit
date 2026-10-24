import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const caseDetail = readFileSync("src/components/CaseDetail.jsx", "utf8");
const workspace = readFileSync("src/components/caseDetail/AiWorkspaceTab.jsx", "utf8");

test("AI Workspace is rendered as a case tab with its full-width tool controls", () => {
  assert.match(caseDetail, /activeTab === "ai-workspace"/);
  assert.match(caseDetail, /<AiWorkspaceTab/);
  assert.match(workspace, /data-ai-workspace-tool-navigation/);
  assert.match(workspace, /data-ai-workspace-primary/);
  assert.doesNotMatch(workspace, /data-ai-workspace-rail/);
  assert.match(workspace, /Selected tool/);
  assert.match(workspace, /Technical tool/);
  assert.match(workspace, /Use this when/);
  assert.match(workspace, /Best suited to/);
  assert.match(workspace, /Workflow/);
  assert.match(workspace, /Recommended GPT/);
  assert.match(workspace, /Example questions/);
});

test("AI Workspace remains a sectioned case-specific interface", () => {
  assert.match(workspace, /AI Workspace/);
  assert.match(workspace, /Case-specific AI workspace/);
  assert.match(workspace, /Prepare bounded external AI handoffs and reviewed updates/);
  assert.match(workspace, /Case Context/);
  assert.match(workspace, /Issue Review/);
  assert.match(workspace, /Case Quality/);
  assert.match(workspace, /Reviewed updates/);
  assert.match(workspace, /navigationGroups\.map/);
  assert.match(workspace, /sectionById\.get\("share-case-context"\)/);
  assert.match(workspace, /data-ai-workspace-advanced/);
  assert.match(workspace, /data-ai-workspace-tool-list/);
  assert.match(workspace, /\{task\.technicalTool\}/);
});

test("obsolete AI modal state and document-level keyboard handlers are removed", () => {
  assert.doesNotMatch(caseDetail, /aiToolsOpen/);
  assert.doesNotMatch(caseDetail, /handleAiToolsKeyDown/);
  assert.match(workspace, /onOpenGptUpdate/);
});

test("AI Workspace entry points retain their requested tool and reset workspace context per case", () => {
  assert.match(caseDetail, /function openAiWorkspace\(toolId, requestedIssueId = ""\)/);
  assert.match(caseDetail, /setActiveTab\("ai-workspace"\)/);
  assert.match(caseDetail, /onOpenAiWorkspace=\{\(\) => openAiWorkspace/);
  assert.match(caseDetail, /onClick=\{\(\) => openAiWorkspace\(activeAiTool/);
  assert.match(caseDetail, /setActiveAiTask\("download-ai-workspace-snapshot"\)/);
  assert.match(caseDetail, /\[selectedCase\?\.id\]\);/);
  assert.match(caseDetail, /The selected Issue is no longer available/);
});

test("AI Workspace shows canonical case context and does not embed Reports Centre articles", () => {
  assert.match(workspace, /Case ID/);
  assert.match(workspace, /caseRevision/);
  assert.match(workspace, /<dt>Scope<\/dt>/);
  assert.match(workspace, /issue\.id === issueSelection/);
  assert.doesNotMatch(workspace, /recommendedContent/);
  assert.doesNotMatch(workspace, /IncidentScheduleReportArticle|ChronologyReportArticle|CaseAuditReportArticle/);
  assert.match(caseDetail, /caseName=\{selectedCase\.name\}/);
  assert.match(caseDetail, /caseRevision=\{selectedCase\.revision\}/);
  assert.doesNotMatch(workspace, /Open Issue Audit/);
  assert.doesNotMatch(workspace, /sequence-audit/);
});

test("External Drafting Handoff retains the management pack builders outside AI Workspace", () => {
  assert.match(caseDetail, /buildManagementReportBuilderSpecialistPrompt/);
  assert.match(caseDetail, /handleCopyExternalDraftingSpecialistPrompt/);
  assert.match(caseDetail, /issueId: selectedReportCentreIssue\.id/);
  assert.doesNotMatch(workspace, /Copy Specialist Prompt/);
  assert.doesNotMatch(workspace, /Copy Narrative Polish Prompt/);
  assert.match(workspace, /Copy Markdown Prompt/);
});

test("Issue-scoped AI handoff controls retain canonical Issue IDs", () => {
  assert.match(caseDetail, /const nextIssueId = selectedSequenceGroupId \|\| timelineIssueOptions\[0\]\?\.id \|\| ""/);
  assert.match(caseDetail, /function getAiToolIssueScope/);
  assert.match(caseDetail, /buildFullChainGptPack\(selectedCase, "", \{/);
  assert.match(caseDetail, /\.\.\.scope/);
  assert.match(workspace, /option key=\{issue\.id\} value=\{issue\.id\}/);
});

test("Issue Review selects an existing scoped builder and retains legacy task compatibility", () => {
  assert.match(caseDetail, /ISSUE_REVIEW_MODES\.find\(\(mode\) => mode\.toolId === toolId \|\| mode\.legacyTaskId === toolId\)/);
  assert.match(caseDetail, /setActiveAiTask\(qualityMode \? "case-quality-review" : issueReviewMode \? "issue-review"/);
  assert.match(caseDetail, /const legacyIssueMode = ISSUE_REVIEW_MODES\.find\(\(mode\) => mode\.legacyTaskId === activeAiTask\)/);
  assert.match(caseDetail, /function selectIssueReviewMode\(modeId\)/);
  assert.match(caseDetail, /task\.actionKind === "issue-review"/);
  assert.match(caseDetail, /setIssueReviewMode\(ISSUE_REVIEW_MODES\[0\]\.id\)/);
  assert.match(workspace, /type="issue-review"/);
  assert.match(workspace, /Issue Review modes/);
  assert.match(workspace, /selectedIssueReviewMode\.toolId/);
  assert.match(workspace, /disabled=\{disabledForMissingIssue\}/);
});

test("AI Workspace preserves Issue identity but disables a stale scoped handoff", () => {
  assert.match(caseDetail, /if \(timelineIssueOptions\.some\(\(issue\) => issue\.id === aiToolsSequenceGroup\)\) return/);
  assert.match(caseDetail, /setAiToolsSequenceGroup\(""\)/);
  assert.match(caseDetail, /The selected Issue is no longer available\. Choose an Issue before creating an Issue-scoped handoff\./);
  assert.match(workspace, /activeToolNeedsIssue && !selectedIssue/);
  assert.match(workspace, /disabled=\{disabledForMissingIssue\}/);
});

test("Case Quality Review selects an existing audit builder without changing its output pathway", () => {
  assert.match(caseDetail, /CASE_QUALITY_REVIEW_MODES\.find\(\(mode\) => mode\.toolId === toolId \|\| mode\.legacyTaskId === toolId\)/);
  assert.match(caseDetail, /setActiveAiTask\(qualityMode \? "case-quality-review"/);
  assert.match(caseDetail, /const legacyMode = CASE_QUALITY_REVIEW_MODES\.find\(\(mode\) => mode\.legacyTaskId === activeAiTask\)/);
  assert.match(caseDetail, /function selectCaseQualityReviewMode\(modeId\)/);
  assert.match(caseDetail, /setAiToolsFeedback\(""\)/);
  assert.match(workspace, /type="quality"/);
  assert.match(workspace, /Case Quality Review checks/);
  assert.match(workspace, /selectedCaseQualityReviewMode\.toolId/);
  assert.match(workspace, /They do not run embedded AI analysis or change case data/);
});
