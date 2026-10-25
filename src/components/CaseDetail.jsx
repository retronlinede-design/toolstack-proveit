import { useState, useEffect, useMemo, useRef } from "react";
import { ArrowUp, BookOpen, Briefcase, ChevronDown, ChevronRight, Download, FileText, GripVertical, Network, Search, ShieldCheck, Tags, Target, Users, Waypoints } from "lucide-react";
import proveItHeaderLogo from "../assets/proveitheader.png";
import { isTimelineCapable, getCaseHealthReport } from "../lib/caseHealth";
import {
  getCaseSequenceGroups,
  getCaseSequenceGroupDetails,
  getIncidentsUsingRecord,
  RECORD_TYPE_LABELS,
  buildRecordTypeConversionPreview,
  clearRecordSequenceGroup,
  convertRecordTypeInCase,
} from "../domain/caseDomain.js";
import { getRecordDisplayMeta, resolveRecordById } from "../domain/linkingResolvers.js";
import { buildNarrativeSections } from "../lib/narrativeBuilder.js";
import { PROVEIT_REPORT_PROMPT_V1, parseProveItReportV1 } from "../lib/proveitReportFormat.js";
import { CLIENT_REPORT_PROMPT_REVISION, validateClientReportNarrative } from "../report/clientReportValidation.js";
import { DEFAULT_REPORT_DISPLAY_LANGUAGE, REPORT_DISPLAY_LANGUAGES } from "../lib/reportHeadingLabels.js";
import { analyzeCaseDiagnostics, runAttachmentIntegrityCheck } from "../diagnostics/caseDiagnostics.js";
import { runOperationalIntegrityCheck } from "../diagnostics/operationalIntegrity.js";
import { repairIncidentEventDates, scanIncidentDateMismatches } from "../domain/incidentDateRepair.js";
import { buildSequenceGroupReviewPackage, ingestSequenceGroupDelta } from "../gpt/sequenceGroupDelta.js";
import {
  exportSequenceGroupAuditJson,
  exportSequenceGroupAuditMarkdown,
  printSequenceGroupAuditPdf,
} from "../export/sequenceGroupAuditExport.js";
import {
  exportSequenceGroupsIndexJson,
  exportSequenceGroupsIndexMarkdown,
} from "../export/sequenceGroupsIndexExport.js";
import {
  buildAllSequenceGroupAuditsExport,
  buildCaseBySequenceGroupsExport,
  exportAllSequenceGroupAuditsMarkdown,
  exportCaseBySequenceGroupsMarkdown,
} from "../export/sequenceGroupConsolidatedExport.js";
import { resolveIssueExportScope } from "../export/issueScope.js";
import {
  exportGptProtocolPackJson,
  exportGptProtocolPackMarkdown,
} from "../export/gptProtocolPack.js";
import { buildCaseReasoningExportPayload } from "../export/caseExport.js";
import { buildAiWorkspaceCurrentCase, AI_WORKSPACE_CURRENT_CASE_FILENAME } from "../export/aiWorkspace.js";
import { downloadJson } from "../browser/downloadJson.js";
import { downloadSplitReasoningPackage } from "../export/splitReasoningPackage.js";
import {
  buildCaseSliceMarkdownPrompt,
  buildCaseSlicePack,
  buildChainCompletionMarkdownPrompt,
  buildChainCompletionPack,
  buildFullChainGptMarkdownPrompt,
  buildFullChainGptPack,
  buildManagementReportBuilderMarkdownPrompt,
  buildManagementReportBuilderPack,
  buildManagementReportBuilderSpecialistPrompt,
  buildMissingFunctionSummaryMarkdownPrompt,
  buildMissingFunctionSummaryPack,
  buildUngroupedEvidenceAuditMarkdownPrompt,
  buildUngroupedEvidenceAuditPack,
  buildUngroupedIncidentsAuditMarkdownPrompt,
  buildUngroupedIncidentsAuditPack,
  buildWeakLinksAuditMarkdownPrompt,
  buildWeakLinksAuditPack,
} from "../export/gptAuditPacks.js";
import { buildCaseBundleReport, buildDocumentPackReport, buildEvidencePackReport, buildExecutiveSummaryNarrativePolishPrompt, buildExecutiveSummaryReport, buildLedgerPackReport, buildThreadIssueReport } from "../report/reportBuilder.js";
import { buildActionPlanReport } from "../report/actionPlanReport.js";
import { normaliseReportScope } from "../report/reportScopes.js";
import { getReportDefinition } from "../report/reportDefinitions.js";
import { buildCaseReportModel } from "../report/reportModel.js";
import { buildEvidenceScheduleDocument, projectEvidenceDocumentToLegacyViewModel } from "../report/evidenceScheduleDocument.js";
import { buildDocumentScheduleDocument, projectDocumentDocumentToLegacyViewModel } from "../report/documentScheduleDocument.js";
import { buildLedgerScheduleDocument, projectLedgerDocumentToLegacyViewModel } from "../report/ledgerScheduleDocument.js";
import { buildActiveReportDocument } from "../report/buildActiveReportDocument.js";
import { buildReportOutput } from "../report/reportOutputs.js";
import { buildExecutiveDraftCandidate, getExecutiveDraftFreshness, getExecutiveSavedDraft, getExecutiveSavedDrafts } from "../report/reportDrafts.js";
import { getLinkChipClasses } from "./linkChipStyles";
import {
  moveCaseNavigationItem,
  normaliseCaseNavigationOrder,
  readCaseNavigationOrder,
  resetCaseNavigationOrder,
  saveCaseNavigationOrder,
} from "./caseDetail/caseNavigationOrder.js";
import LinkedChip from "./LinkedChip";
import RecordCard from "./RecordCard";
import CaseBundleReportArticle from "./reports/CaseBundleReportArticle";
import DocumentPackReportArticle from "./reports/DocumentPackReportArticle";
import EvidencePackReportArticle from "./reports/EvidencePackReportArticle";
import ExecutiveSummaryReportArticle from "./reports/ExecutiveSummaryReportArticle";
import GeneratedClientReportArticle from "./reports/GeneratedClientReportArticle";
import LedgerPackReportArticle from "./reports/LedgerPackReportArticle";
import IncidentScheduleReportArticle from "./reports/IncidentScheduleReportArticle.jsx";
import ChronologyReportArticle from "./reports/ChronologyReportArticle.jsx";
import CaseAuditReportArticle from "./reports/CaseAuditReportArticle.jsx";
import InvestigationReportArticle from "./reports/InvestigationReportArticle.jsx";
import ManagementReportArticle from "./reports/ManagementReportArticle.jsx";
import ClientReportArticle from "./reports/ClientReportArticle.jsx";
import ActionPlanReportArticle from "./reports/ActionPlanReportArticle.jsx";
import ExecutiveReportArticle from "./reports/ExecutiveReportArticle.jsx";
import ThreadIssueReportArticle from "./reports/ThreadIssueReportArticle";
import ReportCentreControls, { ReportCentrePreviewSummary } from "./reports/ReportCentreControls";
import { getReportCentreIssueOptions, resolveReportCentreIssueSelection } from "./reports/reportCentreIssueSelection.js";
import ReportOutputActions from "./reports/ReportOutputActions.jsx";
import { REPORT_CENTRE_PRESENTATION } from "./reports/reportCentreConfig.js";
import ReportContextHeader from "./reports/ReportContextHeader.jsx";
import SequenceGroupManager from "./sequenceGroups/SequenceGroupManager";
import {
  actionSummaryToForm,
  applyActionSummaryPatch,
  emptyActionSummaryForm,
  formToActionSummary,
  getActionText,
  normalizeActionSummary,
} from "./caseDetail/actionSummaryHelpers";
import ActionSummaryModal from "./caseDetail/ActionSummaryModal";
import ActionSummaryPanel from "./caseDetail/ActionSummaryPanel";
import CaseBriefingDashboard from "./caseBriefing/CaseBriefingDashboard.jsx";
import { getOverviewRecordLaunch } from "./caseBriefing/overviewRecordLaunch.js";
import { buildCaseBriefingModel } from "../caseBriefing/buildCaseBriefingModel.js";
import { assignRecordToIssue, createCaseIssue, deleteCaseIssue, getCaseIssueSelectionOptions, mergeCaseIssues, normalizeCaseIssues, removeRecordFromIssue, resolveCaseIssue, updateCaseIssue } from "../domain/issueDomain.js";
import { didSequenceGroupSelectionChange, resolveSequenceGroupReturnTarget } from "./sequenceGroups/sequenceGroupSelection.js";
import {
  isTimelineIssueFilterValid,
  isTimelineItemInIssueFilter,
  TIMELINE_ALL_ISSUES_FILTER,
  TIMELINE_UNASSIGNED_ISSUES_FILTER,
} from "./caseDetail/timelineIssueFilter.js";
import { resolveTimelineIssueNavigationTarget } from "./caseDetail/timelineIssueNavigation.js";
import ActiveLedgerRecordModal from "./caseDetail/ActiveLedgerRecordModal";
import AiWorkspaceTab from "./caseDetail/AiWorkspaceTab";
import DocumentsTab from "./caseDetail/DocumentsTab";
import FloatingWorkspaceMenu from "./caseDetail/FloatingWorkspaceMenu";
import LedgerTab from "./caseDetail/LedgerTab";
import PartiesTab from "./caseDetail/PartiesTab";
import RecordsTab from "./caseDetail/RecordsTab";
import StrategyWorkspace from "./caseDetail/StrategyWorkspace";
import WatchWorkspace, { WatchEditor } from "./caseDetail/WatchWorkspace";
import { AI_TASK_GUIDANCE, AI_TOOL_OPTIONS, AI_WORKSPACE_SECTIONS, CASE_QUALITY_REVIEW_MODES, ISSUE_REVIEW_MODES } from "./caseDetail/aiToolsConfig.js";
import { sortChronological } from "./caseDetail/ledgerViewHelpers";
import { confirmAndArchiveOpenStrategy } from "./caseDetail/strategyWorkspaceHelpers.js";
import {
  compareRecordsNewestFirst,
  compareRecordsOldestFirst,
  parseCalendarDate,
} from "./caseDetail/recordDateOrdering.js";
import { toTimelineItems } from "./caseDetail/timelineItemHelpers";
import {
  formatRecordTableHeader,
  generateLedgerEntries,
  getDifferenceClasses,
  getRecordStatusClasses,
  getRecordTableHeaders,
  getRecordTypeLabel,
  isTrackingRecord,
  parseTrackingRecord,
} from "./caseDetail/trackingRecordHelpers";
import { buildFloatingToolActions } from "./caseDetail/workspaceToolActions.js";
import { shouldShowFloatingWorkspaceMenu } from "./caseDetail/workspaceMenuVisibility.js";
import {
  getSequenceGroupMetaForCase,
  deleteSequenceGroupMeta,
  mergeSequenceGroupMeta,
  readSequenceGroupMetaStore,
  renameSequenceGroupMeta,
  renameSequenceGroupMetaInStore,
  resolveSequenceGroupMergeDescription,
  saveSequenceGroupMeta,
} from "../sequenceGroupMeta.js";

const ENABLE_SUPABASE_REMOTE = false;

function renderCompactLinkRow(label, items, renderChip) {
  if (!items || items.length === 0) return null;
  const renderedChips = items.map(renderChip).filter(Boolean);
  const visibleChips = renderedChips.slice(0, 4);
  const remainingCount = renderedChips.length - visibleChips.length;
  const missingCount = items.length - renderedChips.length;

  if (renderedChips.length === 0 && missingCount === 0) return null;

  return (
    <div className="mt-1 flex items-start gap-2">
      <div className="w-24 shrink-0 pt-0.5 text-[11px] text-neutral-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {visibleChips}
        {remainingCount > 0 && (
          <span className={getLinkChipClasses("neutral")}>
            +{remainingCount}
          </span>
        )}
        {missingCount > 0 && (
          <span className={getLinkChipClasses("neutral", "cursor-default opacity-70")}>
            {missingCount} missing link{missingCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function renderSequenceGroupChip(value, { navigationIssue, onOpenIssue } = {}) {
  const sequenceGroup = typeof value === "string" ? value.trim() : "";
  if (!sequenceGroup) return null;

  const issueLabel = [navigationIssue?.reference, navigationIssue?.name].filter(Boolean).join(" — ") || sequenceGroup;
  if (navigationIssue?.id && typeof onOpenIssue === "function") {
    return (
      <button
        type="button"
        className="case-file-timeline-issue-link inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600"
        onClick={(event) => {
          event.stopPropagation();
          onOpenIssue(navigationIssue.id);
        }}
        aria-label={`Open Issue ${issueLabel}`}
      >
        <Tags className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
        <span className="truncate">{sequenceGroup}</span>
      </button>
    );
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
      <Tags className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
      <span className="truncate">{sequenceGroup}</span>
    </span>
  );
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}


function normalizeReportLanguage(value) {
  return REPORT_DISPLAY_LANGUAGES.includes(value) ? value : DEFAULT_REPORT_DISPLAY_LANGUAGE;
}

function getGeneratedReportTextForLanguage(caseItem, language) {
  const lang = normalizeReportLanguage(language);
  const versionText = safeText(caseItem?.generatedReportVersions?.[lang]);
  return versionText || safeText(caseItem?.generatedReportText);
}

export default function CaseDetail({
  selectedCase,
  caseFolderName = "Inbox",
  activeTab,
  setActiveTab,
  tabs,
  imageCache,
  attachmentImages = [],
  attachmentDiagnosticCases = [],
  setSelectedCaseId,
  openRecordModal,
  openSequenceManagerRecordEdit,
  renderCaseList,
  openEditRecordModal,
  openEditCaseModal,
  deleteRecord,
  exportSelectedCase,
  onUpdateCase,
  onExportSnapshot,
  onCopyLinkMapExport,
  onSendReasoningSnapshotToSupabase,
  onOpenGptDeltaModal,
  onOpenPinManager,
  isPinLocked = false,
  isCaseCurrentlyLocked = false,
  issueFixFeedback = "",
  onViewRecord,
  onPreviewFile,
  openLedgerModal,
  deleteLedgerEntry,
  duplicateLedgerEntry,
  saveParty,
  deleteParty,
  openDocumentModal,
  deleteDocumentEntry,
  saveTrackingRecordTable,
  reviewQueueSection,
  syncStatus = "idle",
  syncMessage = "",
  supabaseReasoningExportStatus = "idle",
  supabaseReasoningExportMessage = "",
}) {
  const isCaseRecordsWorkspace = activeTab === "records" || activeTab === "ledger";
  const [caseNavigationOrder, setCaseNavigationOrder] = useState(() => readCaseNavigationOrder());
  const [draggedCaseNavigationId, setDraggedCaseNavigationId] = useState("");
  const [caseNavigationDropTarget, setCaseNavigationDropTarget] = useState("");
  const [caseNavigationAnnouncement, setCaseNavigationAnnouncement] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [overviewWatchItem, setOverviewWatchItem] = useState(undefined);
  const [ideas, setIdeas] = useState([]);
  const [workspaceActionMenuOpen, setWorkspaceActionMenuOpen] = useState(false);
  const [activeAiTask, setActiveAiTask] = useState("download-ai-workspace-snapshot");
  const [activeAiTool, setActiveAiTool] = useState("missing-function-summaries");
  const [aiToolsSequenceGroup, setAiToolsSequenceGroup] = useState("");
  const [aiToolsFeedback, setAiToolsFeedback] = useState("");
  const [caseQualityReviewMode, setCaseQualityReviewMode] = useState(CASE_QUALITY_REVIEW_MODES[0].id);
  const [issueReviewMode, setIssueReviewMode] = useState(ISSUE_REVIEW_MODES[0].id);
  const [caseSliceRecordIdsText, setCaseSliceRecordIdsText] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    setActiveAiTask("download-ai-workspace-snapshot");
    setActiveAiTool("missing-function-summaries");
    setAiToolsSequenceGroup("");
    setAiToolsFeedback("");
    setCaseQualityReviewMode(CASE_QUALITY_REVIEW_MODES[0].id);
    setIssueReviewMode(ISSUE_REVIEW_MODES[0].id);
    setCaseSliceRecordIdsText("");
    setSavedExecutiveRevisionId("");
    setExecutiveRevisionTargetReportId("");
    setExecutiveDraftFeedback("");
  }, [selectedCase?.id]);
  useEffect(() => {
    const legacyMode = CASE_QUALITY_REVIEW_MODES.find((mode) => mode.legacyTaskId === activeAiTask);
    if (legacyMode) {
      setActiveAiTask("case-quality-review");
      setActiveAiTool(legacyMode.toolId);
      setCaseQualityReviewMode(legacyMode.id);
      setAiToolsFeedback("");
      return;
    }
    const legacyIssueMode = ISSUE_REVIEW_MODES.find((mode) => mode.legacyTaskId === activeAiTask);
    if (!legacyIssueMode) return;
    setActiveAiTask("issue-review");
    setActiveAiTool(legacyIssueMode.toolId);
    setIssueReviewMode(legacyIssueMode.id);
    setAiToolsFeedback("");
  }, [activeAiTask]);
  const [timelineView, setTimelineView] = useState("all");
  const [timelineMilestonesOnly, setTimelineMilestonesOnly] = useState(false);
  const [timelineSequenceGroupFilter, setTimelineSequenceGroupFilter] = useState(TIMELINE_ALL_ISSUES_FILTER);
  const [expandedTimelineItems, setExpandedTimelineItems] = useState(() => new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const [incidentSearch, setIncidentSearch] = useState("");
  const [incidentFilter, setIncidentFilter] = useState("all");
  const [incidentSequenceGroupFilter, setIncidentSequenceGroupFilter] = useState("all");
  const [incidentSort, setIncidentSort] = useState("newest-first");
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [evidenceSequenceGroupFilter, setEvidenceSequenceGroupFilter] = useState("all");
  const [evidenceQuickFilter, setEvidenceQuickFilter] = useState("all");
  const [expandedDocuments, setExpandedDocuments] = useState({});
  const [showVerifiedEvidence, setShowVerifiedEvidence] = useState(false);
  const [activeLedgerRecord, setActiveLedgerRecord] = useState(null);
  const [showStructuredRecords, setShowStructuredRecords] = useState(false);
  const [actionSummaryEditOpen, setActionSummaryEditOpen] = useState(false);
  const [quickActionInput, setQuickActionInput] = useState("");
  const [actionSummaryForm, setActionSummaryForm] = useState(emptyActionSummaryForm);
  const incidentSearchInputRef = useRef(null);
  const evidenceSearchInputRef = useRef(null);
  const [reportMode, setReportMode] = useState("internal");
  const [reportDisplayLanguage, setReportDisplayLanguage] = useState(DEFAULT_REPORT_DISPLAY_LANGUAGE);
  const [generatedReportDraft, setGeneratedReportDraft] = useState("");
  const [renderedReportText, setRenderedReportText] = useState("");
  const [clientNarrativeMeta, setClientNarrativeMeta] = useState({});
  const clientNarrativeCaseIdRef = useRef("");
  const [reportPromptFeedback, setReportPromptFeedback] = useState("");
  const [reportCentreScopeType, setReportCentreScopeType] = useState("sequenceGroup");
  const [reportCentreIssueId, setReportCentreIssueId] = useState("");
  const [externalDraftingScopeType, setExternalDraftingScopeType] = useState("case");
  const [reportCentreType, setReportCentreType] = useState("executive");
  const [reportCentreDestination, setReportCentreDestination] = useState("reports");
  const [reportCentreOutputFeedback, setReportCentreOutputFeedback] = useState("");
  const [savedExecutiveRevisionId, setSavedExecutiveRevisionId] = useState("");
  const [executiveRevisionTargetReportId, setExecutiveRevisionTargetReportId] = useState("");
  const [savingExecutiveDraft, setSavingExecutiveDraft] = useState(false);
  const [executiveDraftFeedback, setExecutiveDraftFeedback] = useState("");
  const savingExecutiveDraftRef = useRef(false);
  const [caseStructureReportOpen, setCaseStructureReportOpen] = useState(false);
  const [clientReportGeneratorOpen, setClientReportGeneratorOpen] = useState(false);
  const [threadIssueReportOpen, setThreadIssueReportOpen] = useState(false);
  const [threadIssueReportIssueId, setThreadIssueReportIssueId] = useState("");
  const [threadIssueReportVisibility, setThreadIssueReportVisibility] = useState({
    diagnostics: true,
    documents: true,
    ledger: true,
    strategy: true,
  });
  const [evidencePackReportOpen, setEvidencePackReportOpen] = useState(false);
  const [evidencePackScopeType, setEvidencePackScopeType] = useState("case");
  const [evidencePackIssueId, setEvidencePackIssueId] = useState("");
  const [documentPackReportOpen, setDocumentPackReportOpen] = useState(false);
  const [documentPackScopeType, setDocumentPackScopeType] = useState("case");
  const [documentPackIssueId, setDocumentPackIssueId] = useState("");
  const [ledgerPackReportOpen, setLedgerPackReportOpen] = useState(false);
  const [ledgerPackScopeType, setLedgerPackScopeType] = useState("case");
  const [ledgerPackIssueId, setLedgerPackIssueId] = useState("");
  const [caseBundleReportOpen, setCaseBundleReportOpen] = useState(false);
  const [executiveSummaryReportOpen, setExecutiveSummaryReportOpen] = useState(true);
  const [executiveSummaryPolishDraft, setExecutiveSummaryPolishDraft] = useState("");
  const [executiveSummaryPolishFeedback, setExecutiveSummaryPolishFeedback] = useState("");
  const [caseBundleScopeType, setCaseBundleScopeType] = useState("case");
  const [caseBundleIssueId, setCaseBundleIssueId] = useState("");
  const [caseBundleSections, setCaseBundleSections] = useState({
    threadIssue: true,
    evidencePack: true,
    documentPack: true,
    ledgerPack: true,
    strategyActions: true,
    diagnosticsSummary: true,
  });
  const [caseStructureReportText, setCaseStructureReportText] = useState("");
  const [caseStructureReportFeedback, setCaseStructureReportFeedback] = useState("");
  const [sequenceGroupManagerOpen, setSequenceGroupManagerOpen] = useState(false);
  const [sequenceRenameInputs, setSequenceRenameInputs] = useState({});
  const [sequenceGroupFeedback, setSequenceGroupFeedback] = useState("");
  const [selectedSequenceGroupId, setSelectedSequenceGroupId] = useState("");
  const [selectedSequenceGroupName, setSelectedSequenceGroupName] = useState("");
  const [sequenceGroupSearch, setSequenceGroupSearch] = useState("");
  const [sequenceMoveInputs, setSequenceMoveInputs] = useState({});
  const [sequenceNewGroupInputs, setSequenceNewGroupInputs] = useState({});
  const [sequenceGroupDeltaDraft, setSequenceGroupDeltaDraft] = useState("");
  const [sequenceGroupDeltaResult, setSequenceGroupDeltaResult] = useState(null);
  const [sequenceTimelineSort, setSequenceTimelineSort] = useState("asc");
  const [highlightedSequenceRecordKey, setHighlightedSequenceRecordKey] = useState("");
  const [sequenceRelationshipFilter, setSequenceRelationshipFilter] = useState("all");
  const [sequenceGroupAuditExportOpen, setSequenceGroupAuditExportOpen] = useState(false);
  const [sequenceGroupAuditScope, setSequenceGroupAuditScope] = useState("selected");
  const [sequenceGroupAuditIssueId, setSequenceGroupAuditIssueId] = useState("");
  const [sequenceGroupAuditLegacyName, setSequenceGroupAuditLegacyName] = useState("");
  const [sequenceGroupAuditFormat, setSequenceGroupAuditFormat] = useState("json");
  const [sequenceGroupAuditFeedback, setSequenceGroupAuditFeedback] = useState("");
  const [incidentDateRepairOpen, setIncidentDateRepairOpen] = useState(false);
  const [incidentDateRepairSelectedIds, setIncidentDateRepairSelectedIds] = useState([]);
  const [incidentDateRepairFeedback, setIncidentDateRepairFeedback] = useState("");
  const [recordConversion, setRecordConversion] = useState(null);
  const activeGeneratedReportLanguage = normalizeReportLanguage(selectedCase?.activeGeneratedReportLanguage);
  const sequenceGroups = useMemo(() => getCaseSequenceGroups(selectedCase), [selectedCase]);
  const sequenceGroupDetails = useMemo(() => getCaseSequenceGroupDetails(selectedCase), [selectedCase]);
  const selectedCaseRef = useRef(selectedCase);

  useEffect(() => {
    selectedCaseRef.current = selectedCase;
  }, [selectedCase]);

  function setSequenceGroupSelection({ issue = null, issueId = "", groupName = "" } = {}) {
    const resolvedIssue = issue
      || (safeText(issueId).trim() ? resolveCaseIssue(selectedCase, { issueId }) : null)
      || (!safeText(issueId).trim() && safeText(groupName).trim() ? resolveCaseIssue(selectedCase, { issueName: groupName }) : null);
    if (resolvedIssue) {
      setSelectedSequenceGroupId(resolvedIssue.id);
      setSelectedSequenceGroupName(resolvedIssue.name);
      return;
    }
    setSelectedSequenceGroupId("");
    setSelectedSequenceGroupName(safeText(groupName).trim());
  }

  useEffect(() => {
    if (!sequenceGroupManagerOpen || !selectedSequenceGroupId) return;
    const issue = resolveCaseIssue(selectedCase, { issueId: selectedSequenceGroupId });
    if (!issue) {
      setSequenceGroupFeedback("The selected Issue is no longer available. Choose another Issue to continue.");
      return;
    }
    if (selectedSequenceGroupName !== issue.name) setSelectedSequenceGroupName(issue.name);
  }, [selectedCase, selectedSequenceGroupId, selectedSequenceGroupName, sequenceGroupManagerOpen]);
  const timelineIssueOptions = useMemo(() => getCaseIssueSelectionOptions(selectedCase), [selectedCase]);

  useEffect(() => {
    if (!aiToolsSequenceGroup) return;
    if (timelineIssueOptions.some((issue) => issue.id === aiToolsSequenceGroup)) return;
    setAiToolsSequenceGroup("");
    setAiToolsFeedback("The selected Issue is no longer available. Choose an Issue before creating an Issue-scoped handoff.");
  }, [aiToolsSequenceGroup, timelineIssueOptions]);
  const reportCentreIssues = useMemo(() => getReportCentreIssueOptions(selectedCase), [selectedCase]);
  const sequenceGroupAuditSelection = useMemo(() => {
    const issueId = safeText(sequenceGroupAuditIssueId).trim();
    const legacyName = safeText(sequenceGroupAuditLegacyName).trim();
    if (!selectedCase || (!issueId && !legacyName)) return { scope: null, error: "", issueId, legacyName };
    try {
      return {
        scope: resolveIssueExportScope(selectedCase, issueId ? { issueId, issueName: legacyName } : { issueName: legacyName }),
        error: "",
        issueId,
        legacyName,
      };
    } catch (error) {
      return { scope: null, error: error?.message || "The selected Issue could not be resolved safely.", issueId, legacyName };
    }
  }, [selectedCase, sequenceGroupAuditIssueId, sequenceGroupAuditLegacyName]);
  const legacySequenceGroupAuditOptions = useMemo(() => sequenceGroups
    .map((group) => group.name)
    .filter((name) => !timelineIssueOptions.some((issue) => issue.name === name))
    .filter((name) => {
      try {
        return resolveIssueExportScope(selectedCase, { issueName: name }).kind === "legacy";
      } catch {
        return false;
      }
    }), [selectedCase, sequenceGroups, timelineIssueOptions]);
  const selectedSequenceGroupAuditGroup = sequenceGroupAuditSelection.scope?.name || sequenceGroupAuditSelection.legacyName;
  useEffect(() => {
    if (isTimelineIssueFilterValid(selectedCase, incidentSequenceGroupFilter)) return;
    setIncidentSequenceGroupFilter(TIMELINE_ALL_ISSUES_FILTER);
  }, [incidentSequenceGroupFilter, selectedCase]);
  useEffect(() => {
    if (isTimelineIssueFilterValid(selectedCase, evidenceSequenceGroupFilter)) return;
    setEvidenceSequenceGroupFilter(TIMELINE_ALL_ISSUES_FILTER);
  }, [evidenceSequenceGroupFilter, selectedCase]);
  useEffect(() => {
    if (isTimelineIssueFilterValid(selectedCase, timelineSequenceGroupFilter)) return;
    setTimelineSequenceGroupFilter(TIMELINE_ALL_ISSUES_FILTER);
  }, [selectedCase, timelineSequenceGroupFilter]);
  const incidentDateMismatchReport = useMemo(
    () => scanIncidentDateMismatches(selectedCase),
    [selectedCase]
  );
  const reportCentreIssueSelection = useMemo(() => resolveReportCentreIssueSelection(reportCentreIssues, reportCentreIssueId), [reportCentreIssues, reportCentreIssueId]);
  const selectedReportCentreIssue = reportCentreIssueSelection.selectedIssue;
  const externalDraftingScope = useMemo(() => {
    if (externalDraftingScopeType !== "sequenceGroup") return { scope: {}, error: "" };
    if (!selectedReportCentreIssue) {
      return {
        scope: null,
        error: reportCentreIssueSelection.requestedIssueId
          ? "The selected Issue is no longer available. Select an existing Issue before preparing a scoped handoff."
          : "Select an existing Issue before preparing a scoped handoff.",
      };
    }
    return { scope: { issueId: selectedReportCentreIssue.id }, error: "" };
  }, [externalDraftingScopeType, reportCentreIssueSelection.requestedIssueId, selectedReportCentreIssue]);
  const threadIssueReportIssueSelection = useMemo(
    () => resolveReportCentreIssueSelection(reportCentreIssues, threadIssueReportIssueId),
    [reportCentreIssues, threadIssueReportIssueId]
  );
  const selectedThreadIssueReportIssue = threadIssueReportIssueSelection.selectedIssue;
  const threadIssueReport = useMemo(() => {
    if (!selectedCase || !selectedThreadIssueReportIssue) return null;
    return buildThreadIssueReport(selectedCase, selectedThreadIssueReportIssue.name, {
      issueId: selectedThreadIssueReportIssue.id,
    });
  }, [selectedCase, selectedThreadIssueReportIssue]);
  const evidencePackIssueSelection = useMemo(
    () => resolveReportCentreIssueSelection(reportCentreIssues, evidencePackIssueId),
    [evidencePackIssueId, reportCentreIssues]
  );
  const selectedEvidencePackIssue = evidencePackIssueSelection.selectedIssue;
  const evidencePackReport = useMemo(() => {
    if (!selectedCase) return null;
    if (evidencePackScopeType === "sequenceGroup" && !selectedEvidencePackIssue) return null;
    return buildEvidencePackReport(selectedCase, {
      scopeType: evidencePackScopeType,
      issueId: selectedEvidencePackIssue?.id,
      sequenceGroup: selectedEvidencePackIssue?.name,
    });
  }, [selectedCase, evidencePackScopeType, selectedEvidencePackIssue]);
  const documentPackIssueSelection = useMemo(
    () => resolveReportCentreIssueSelection(reportCentreIssues, documentPackIssueId),
    [documentPackIssueId, reportCentreIssues]
  );
  const selectedDocumentPackIssue = documentPackIssueSelection.selectedIssue;
  const documentPackReport = useMemo(() => {
    if (!selectedCase) return null;
    if (documentPackScopeType === "sequenceGroup" && !selectedDocumentPackIssue) return null;
    return buildDocumentPackReport(selectedCase, {
      scopeType: documentPackScopeType,
      issueId: selectedDocumentPackIssue?.id,
      sequenceGroup: selectedDocumentPackIssue?.name,
    });
  }, [selectedCase, documentPackScopeType, selectedDocumentPackIssue]);
  const ledgerPackIssueSelection = useMemo(
    () => resolveReportCentreIssueSelection(reportCentreIssues, ledgerPackIssueId),
    [ledgerPackIssueId, reportCentreIssues]
  );
  const selectedLedgerPackIssue = ledgerPackIssueSelection.selectedIssue;
  const ledgerPackReport = useMemo(() => {
    if (!selectedCase) return null;
    if (ledgerPackScopeType === "sequenceGroup" && !selectedLedgerPackIssue) return null;
    return buildLedgerPackReport(selectedCase, {
      scopeType: ledgerPackScopeType,
      issueId: selectedLedgerPackIssue?.id,
      sequenceGroup: selectedLedgerPackIssue?.name,
    });
  }, [selectedCase, ledgerPackScopeType, selectedLedgerPackIssue]);
  const caseBundleIssueSelection = useMemo(
    () => resolveReportCentreIssueSelection(reportCentreIssues, caseBundleIssueId),
    [caseBundleIssueId, reportCentreIssues]
  );
  const selectedCaseBundleIssue = caseBundleIssueSelection.selectedIssue;
  const caseBundleReport = useMemo(() => {
    if (!selectedCase) return null;
    if (caseBundleScopeType === "sequenceGroup" && !selectedCaseBundleIssue) return null;
    return buildCaseBundleReport(selectedCase, {
      scopeType: caseBundleScopeType,
      issueId: selectedCaseBundleIssue?.id,
      sequenceGroup: selectedCaseBundleIssue?.name,
    }, {
      sections: caseBundleSections,
    });
  }, [selectedCase, caseBundleScopeType, selectedCaseBundleIssue, caseBundleSections]);
  const executiveSummaryReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildExecutiveSummaryReport(selectedCase);
  }, [selectedCase]);
  const normalisedReportCentreScopeType = normaliseReportScope(reportCentreType, reportCentreScopeType);
  const reportCentreScope = useMemo(() => ({
    scopeType: normalisedReportCentreScopeType,
    issueId: normalisedReportCentreScopeType === "sequenceGroup" ? reportCentreIssueSelection.requestedIssueId : "",
    sequenceGroup: normalisedReportCentreScopeType === "sequenceGroup" ? reportCentreIssueSelection.sequenceGroupName : "",
  }), [normalisedReportCentreScopeType, reportCentreIssueSelection]);
  const reportCentreModel = useMemo(() => {
    if (!selectedCase) return null;
    return buildCaseReportModel(selectedCase, {
      scope: reportCentreScope.scopeType,
      sequenceGroupName: reportCentreScope.sequenceGroup,
      issueId: reportCentreScope.issueId,
      includeArchived: true,
      includeDiagnostics: true,
      sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
    });
  }, [selectedCase, reportCentreScope]);
  const savedExecutiveDrafts = useMemo(() => getExecutiveSavedDrafts(selectedCase).map((item) => {
    const historicalScope = item.revision.content.reportDocument?.source?.scope || {};
    if (!selectedCase) return { ...item, freshness: "unknown" };
    const historicalModel = buildCaseReportModel(selectedCase, {
      scope: historicalScope.type === "sequenceGroup" ? "sequenceGroup" : "case",
      issueId: historicalScope.issueId || "",
      sequenceGroupName: historicalScope.sequenceGroupName || "",
      includeArchived: true,
      includeDiagnostics: true,
      sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
    });
    return {
      ...item,
      freshness: getExecutiveDraftFreshness(
        item.revision,
        historicalModel.sourceRevision?.fingerprint,
        historicalScope.type !== "sequenceGroup" || historicalModel.scope?.isValid
      ),
    };
  }), [selectedCase]);
  const savedExecutiveDraft = useMemo(
    () => getExecutiveSavedDraft(selectedCase, savedExecutiveRevisionId),
    [selectedCase, savedExecutiveRevisionId]
  );
  const reportCentreEvidenceDocument = useMemo(() => reportCentreModel ? buildEvidenceScheduleDocument(reportCentreModel, getReportDefinition("evidence")) : null, [reportCentreModel]);
  const reportCentreDocumentDocument = useMemo(() => reportCentreModel ? buildDocumentScheduleDocument(reportCentreModel, getReportDefinition("document")) : null, [reportCentreModel]);
  const reportCentreLedgerDocument = useMemo(() => reportCentreModel ? buildLedgerScheduleDocument(reportCentreModel, getReportDefinition("ledger")) : null, [reportCentreModel]);
  const reportCentreIncidentDocument = useMemo(() => reportCentreModel ? buildActiveReportDocument({ reportId: "incidentSchedule", reportModel: reportCentreModel, definition: getReportDefinition("incidentSchedule") }).reportDocument : null, [reportCentreModel]);
  const reportCentreChronologyDocument = useMemo(() => reportCentreModel ? buildActiveReportDocument({ reportId: "chronologyReport", reportModel: reportCentreModel, definition: getReportDefinition("chronologyReport") }).reportDocument : null, [reportCentreModel]);
  const reportCentreCaseAuditDocument = useMemo(() => reportCentreModel ? buildActiveReportDocument({ reportId: "caseAudit", reportModel: reportCentreModel, definition: getReportDefinition("caseAudit") }).reportDocument : null, [reportCentreModel]);
  const reportCentreInvestigationDocument = useMemo(() => reportCentreModel ? buildActiveReportDocument({ reportId: "investigation", reportModel: reportCentreModel, definition: getReportDefinition("investigation") }).reportDocument : null, [reportCentreModel]);
  const reportCentreExecutiveDocument = useMemo(() => reportCentreModel ? buildActiveReportDocument({ reportId: "executive", reportModel: reportCentreModel, definition: getReportDefinition("executive") }).reportDocument : null, [reportCentreModel]);
  const reportCentreManagementDocument = useMemo(() => reportCentreModel ? buildActiveReportDocument({ reportId: "management", reportModel: reportCentreModel, definition: getReportDefinition("management") }).reportDocument : null, [reportCentreModel]);
  const reportCentreClientValidation = useMemo(() => validateClientReportNarrative(renderedReportText, { sourceRevision: clientNarrativeMeta.sourceRevision, currentSourceRevision: reportCentreModel?.sourceRevision?.fingerprint }), [clientNarrativeMeta.sourceRevision, renderedReportText, reportCentreModel?.sourceRevision?.fingerprint]);
  const reportCentreClientDocument = useMemo(() => reportCentreModel && renderedReportText.trim() && reportCentreClientValidation.valid ? buildActiveReportDocument({ reportId: "client", reportModel: reportCentreModel, definition: getReportDefinition("client"), options: { generatedNarrative: parseProveItReportV1(renderedReportText), generatedNarrativeMeta: clientNarrativeMeta } }).reportDocument : null, [clientNarrativeMeta, renderedReportText, reportCentreClientValidation.valid, reportCentreModel]);
  const reportCentreActionDocument = useMemo(() => reportCentreModel ? buildActiveReportDocument({ reportId: "action", reportModel: reportCentreModel, definition: getReportDefinition("action"), options: { caseBriefing: selectedCase?.actionSummary || {}, legacyTasks: selectedCase?.tasks || [] } }).reportDocument : null, [reportCentreModel, selectedCase?.actionSummary, selectedCase?.tasks]);
  const reportCentreEvidencePackReport = useMemo(() => reportCentreEvidenceDocument ? projectEvidenceDocumentToLegacyViewModel(reportCentreEvidenceDocument) : null, [reportCentreEvidenceDocument]);
  const reportCentreDocumentPackReport = useMemo(() => reportCentreDocumentDocument ? projectDocumentDocumentToLegacyViewModel(reportCentreDocumentDocument) : null, [reportCentreDocumentDocument]);
  const reportCentreLedgerPackReport = useMemo(() => reportCentreLedgerDocument ? projectLedgerDocumentToLegacyViewModel(reportCentreLedgerDocument) : null, [reportCentreLedgerDocument]);
  const reportCentreLiveActiveDocument = reportCentreType === "executive" ? reportCentreExecutiveDocument
    : reportCentreType === "management" ? reportCentreManagementDocument
    : reportCentreType === "action" ? reportCentreActionDocument
    : reportCentreType === "client" ? reportCentreClientDocument
    : reportCentreType === "investigation" ? reportCentreInvestigationDocument
    : reportCentreType === "evidence" ? reportCentreEvidenceDocument
    : reportCentreType === "document" ? reportCentreDocumentDocument
      : reportCentreType === "ledger" ? reportCentreLedgerDocument
        : reportCentreType === "incidentSchedule" ? reportCentreIncidentDocument
          : reportCentreType === "chronologyReport" ? reportCentreChronologyDocument
            : reportCentreType === "caseAudit" ? reportCentreCaseAuditDocument : null;
  const reportCentreActiveDocument = reportCentreType === "executive" && savedExecutiveDraft
    ? savedExecutiveDraft.revision.content.reportDocument
    : reportCentreLiveActiveDocument;
  const reportCentreCountLabel = useMemo(() => {
    if (reportCentreType === "executive") return `${reportCentreExecutiveDocument?.summary?.directRecordCount || 0} scoped records`;
    if (reportCentreType === "management") return `${reportCentreManagementDocument?.summary?.openIssueCount || 0} active Issues`;
    if (reportCentreType === "client") return reportCentreClientDocument ? `${reportCentreClientDocument.summary?.activeIssueCount || 0} active Issues` : "Draft not validated";
    if (reportCentreType === "action") return `${reportCentreActionDocument?.summary?.activeActionCount || 0} active actions`;
    if (reportCentreType === "investigation") return `${reportCentreInvestigationDocument?.summary?.directRecordCount || 0} investigation records`;
    if (reportCentreType === "evidence") return `${reportCentreEvidenceDocument?.summary?.includedEvidenceCount || 0} evidence records`;
    if (reportCentreType === "document") return `${reportCentreDocumentDocument?.summary?.includedDocumentCount || 0} documents`;
    if (reportCentreType === "ledger") return `${reportCentreLedgerDocument?.summary?.includedLedgerCount || 0} ledger entries`;
    if (reportCentreType === "incidentSchedule") return `${reportCentreIncidentDocument?.summary?.scopedIncidentCount || 0} incidents`;
    if (reportCentreType === "chronologyReport") return `${reportCentreChronologyDocument?.summary?.totalChronologyEntries || 0} chronology entries`;
    if (reportCentreType === "caseAudit") return `${reportCentreCaseAuditDocument?.summary?.totalFindings || 0} audit findings`;
    return "";
  }, [reportCentreActionDocument, reportCentreCaseAuditDocument, reportCentreChronologyDocument, reportCentreClientDocument, reportCentreDocumentDocument, reportCentreEvidenceDocument, reportCentreExecutiveDocument, reportCentreIncidentDocument, reportCentreInvestigationDocument, reportCentreLedgerDocument, reportCentreManagementDocument, reportCentreType]);
  const reportCentreActionPlan = useMemo(() => {
    if (!selectedCase) return null;
    return buildActionPlanReport(selectedCase, reportCentreScope);
  }, [selectedCase, reportCentreScope]);

  useEffect(() => {
    if (reportCentreScopeType !== normalisedReportCentreScopeType) {
      setReportCentreScopeType(normalisedReportCentreScopeType);
    }
  }, [normalisedReportCentreScopeType, reportCentreScopeType]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextText = getGeneratedReportTextForLanguage(selectedCase, activeGeneratedReportLanguage);
      setReportDisplayLanguage(activeGeneratedReportLanguage);
      setGeneratedReportDraft(nextText);
      setRenderedReportText(nextText);
      if (clientNarrativeCaseIdRef.current !== selectedCase?.id) {
        clientNarrativeCaseIdRef.current = selectedCase?.id || "";
        setClientNarrativeMeta({});
      }
      setReportPromptFeedback("");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    selectedCase,
    activeGeneratedReportLanguage,
  ]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (activeTab !== "generate-report") return;
    const timeout = window.setTimeout(() => {
      setClientReportGeneratorOpen(false);
      setCaseStructureReportOpen(false);
      setThreadIssueReportOpen(false);
      setEvidencePackReportOpen(false);
      setDocumentPackReportOpen(false);
      setLedgerPackReportOpen(false);
      setCaseBundleReportOpen(false);
      setExecutiveSummaryReportOpen(true);
      setExecutiveSummaryPolishFeedback("");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeTab]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setWorkspaceActionMenuOpen(false), 0);
    return () => window.clearTimeout(timeout);
  }, [selectedCase?.id, isPinLocked]);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const toggleDocumentExpanded = (id) => {
    setExpandedDocuments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleGroup = (cat) => setExpandedGroups((prev) => ({ ...prev, [cat]: !prev[cat] }));

  function openActionSummaryEdit() {
    setActionSummaryForm(actionSummaryToForm(selectedCase?.actionSummary || {}));
    setActionSummaryEditOpen(true);
  }

  function updateActionSummary(nextActionSummary) {
    if (!selectedCase) return false;

    return onUpdateCase({
      ...selectedCase,
      actionSummary: nextActionSummary,
    });
  }

  function applyActionSummaryUpdate(patch) {
    updateActionSummary(applyActionSummaryPatch(rawActionSummary, patch));
  }

  async function saveActionSummary() {
    if (!selectedCase) return false;
    return updateActionSummary(formToActionSummary(actionSummaryForm, rawActionSummary));
  }

  function openSequenceGroupManager(preferredGroup = "") {
    const preferredIssue = resolveCaseIssue(selectedCase, { issueId: preferredGroup }) || resolveCaseIssue(selectedCase, { issueName: preferredGroup });
    const preferredName = preferredIssue?.name || preferredGroup;
    const selectedGroup = sequenceGroups.find((group) => group.name === preferredName) || sequenceGroups[0] || null;
    const selectedIssue = selectedGroup ? resolveCaseIssue(selectedCase, { issueName: selectedGroup.name }) : null;
    setSequenceRenameInputs({});
    setSequenceMoveInputs({});
    setSequenceNewGroupInputs({});
    setSequenceGroupDeltaDraft("");
    setSequenceGroupDeltaResult(null);
    setSequenceTimelineSort("asc");
    setHighlightedSequenceRecordKey("");
    setSequenceRelationshipFilter("all");
    setSequenceGroupSearch("");
    setSequenceGroupSelection({ issue: selectedIssue, groupName: selectedGroup?.name || "" });
    setSequenceGroupFeedback("");
    setSequenceGroupManagerOpen(true);
  }

  function openSequenceGroupAuditExport(preferredSelection = {}) {
    const requested = typeof preferredSelection === "string"
      ? { issueName: preferredSelection }
      : (preferredSelection || {});
    const requestedIssueId = safeText(requested.issueId).trim();
    const requestedLegacyName = safeText(requested.issueName || requested.legacyName).trim();
    const resolvedIssue = requestedIssueId
      ? resolveCaseIssue(selectedCase, { issueId: requestedIssueId })
      : requestedLegacyName
        ? resolveCaseIssue(selectedCase, { issueName: requestedLegacyName })
        : null;
    setSequenceGroupAuditIssueId(resolvedIssue?.id || requestedIssueId);
    setSequenceGroupAuditLegacyName(resolvedIssue ? "" : requestedLegacyName);
    setSequenceGroupAuditScope("selected");
    setSequenceGroupAuditFormat("json");
    setSequenceGroupAuditFeedback("");
    setSequenceGroupAuditExportOpen(true);
  }

  function openSequenceGroupAuditExportFromManager(issueSelection) {
    setSequenceGroupManagerOpen(false);
    openSequenceGroupAuditExport(issueSelection);
  }

  function openIncidentDateRepairTool() {
    setIncidentDateRepairSelectedIds([]);
    setIncidentDateRepairFeedback("");
    setIncidentDateRepairOpen(true);
  }

  function toggleIncidentDateRepairSelection(incidentId) {
    setIncidentDateRepairSelectedIds((current) =>
      current.includes(incidentId)
        ? current.filter((id) => id !== incidentId)
        : [...current, incidentId]
    );
    setIncidentDateRepairFeedback("");
  }

  function selectAllIncidentDateRepairs() {
    setIncidentDateRepairSelectedIds(incidentDateMismatchReport.map((item) => item.id));
    setIncidentDateRepairFeedback("");
  }

  function clearIncidentDateRepairSelection() {
    setIncidentDateRepairSelectedIds([]);
    setIncidentDateRepairFeedback("");
  }

  async function handleRepairSelectedIncidentDates() {
    if (!selectedCase) return;
    if (incidentDateRepairSelectedIds.length === 0) {
      setIncidentDateRepairFeedback("Select at least one incident to repair.");
      return;
    }

    const updatedCase = repairIncidentEventDates(selectedCase, incidentDateRepairSelectedIds);
    if (updatedCase === selectedCase) {
      setIncidentDateRepairFeedback("No selected incidents needed repair.");
      return;
    }

    const saved = await onUpdateCase(updatedCase);
    if (!saved) {
      setIncidentDateRepairFeedback("Could not save incident date repairs.");
      return;
    }

    setIncidentDateRepairSelectedIds([]);
    setIncidentDateRepairFeedback(`Repaired ${incidentDateRepairSelectedIds.length} incident date mismatch${incidentDateRepairSelectedIds.length === 1 ? "" : "es"}.`);
  }

  function downloadTextFile(contents, filename, type) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function getAuditExportFilename(extension) {
    const casePart = (selectedCase?.id || selectedCase?.name || "case").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "case";
    const groupPart = (selectedSequenceGroupAuditGroup || "sequence-group").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sequence-group";
    const datePart = new Date().toISOString().slice(0, 10);
    return `proveit-sequence-group-audit-${casePart}-${groupPart}-${datePart}.${extension}`;
  }

  function getConsolidatedSequenceGroupFilename(scope, extension) {
    const casePart = (selectedCase?.name || selectedCase?.id || "case").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "case";
    const suffix = scope === "all" ? "all-sequence-group-audits" : "full-case-by-sequence-groups";
    return `proveit-${casePart}-${suffix}.${extension}`;
  }

  function getSequenceGroupsIndexFilename(extension) {
    const casePart = (selectedCase?.id || selectedCase?.name || "case").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "case";
    const datePart = new Date().toISOString().slice(0, 10);
    return `proveit-sequence-groups-index-${casePart}-${datePart}.${extension}`;
  }

  function getGptProtocolPackFilename(extension) {
    const datePart = new Date().toISOString().slice(0, 10);
    return `proveit-gpt-protocol-pack-${datePart}.${extension}`;
  }

  function handleDownloadGptProtocolPackJson() {
    const payload = exportGptProtocolPackJson();
    downloadTextFile(JSON.stringify(payload, null, 2), getGptProtocolPackFilename("json"), "application/json");
  }

  function handleDownloadGptProtocolPackMarkdown() {
    const markdown = exportGptProtocolPackMarkdown();
    downloadTextFile(markdown, getGptProtocolPackFilename("md"), "text/markdown");
  }

  function handleDownloadSequenceGroupsIndexJson() {
    if (!selectedCase) return;

    try {
      const payload = exportSequenceGroupsIndexJson(selectedCase, {
        sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
      });
      downloadTextFile(JSON.stringify(payload, null, 2), getSequenceGroupsIndexFilename("json"), "application/json");
      setSequenceGroupFeedback("Issues Index JSON downloaded.");
    } catch (error) {
      console.error("Failed to export sequence groups index JSON", error);
      setSequenceGroupFeedback("Could not create the Issues Index JSON.");
    }
  }

  function handleDownloadSequenceGroupsIndexMarkdown() {
    if (!selectedCase) return;

    try {
      const markdown = exportSequenceGroupsIndexMarkdown(selectedCase, {
        sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
      });
      downloadTextFile(markdown, getSequenceGroupsIndexFilename("md"), "text/markdown");
      setSequenceGroupFeedback("Issues Index Markdown downloaded.");
    } catch (error) {
      console.error("Failed to export sequence groups index Markdown", error);
      setSequenceGroupFeedback("Could not create the Issues Index Markdown.");
    }
  }

  function handleRunSequenceGroupAuditExport() {
    if (!selectedCase) return;
    if (sequenceGroupAuditScope === "selected" && !sequenceGroupAuditSelection.scope) {
      setSequenceGroupAuditFeedback(sequenceGroupAuditSelection.error || "Select an existing Issue before creating this audit export.");
      return;
    }

    try {
      const exportOptions = {
        sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
      };
      if (sequenceGroupAuditScope === "all") {
        if (sequenceGroupAuditFormat === "json") {
          const payload = buildAllSequenceGroupAuditsExport(selectedCase, exportOptions);
          downloadTextFile(JSON.stringify(payload, null, 2), getConsolidatedSequenceGroupFilename("all", "json"), "application/json");
        } else {
          downloadTextFile(exportAllSequenceGroupAuditsMarkdown(selectedCase, exportOptions), getConsolidatedSequenceGroupFilename("all", "md"), "text/markdown");
        }
        setSequenceGroupAuditFeedback("All Issue Audits export created.");
        return;
      }
      if (sequenceGroupAuditScope === "full") {
        if (sequenceGroupAuditFormat === "json") {
          const payload = buildCaseBySequenceGroupsExport(selectedCase, exportOptions);
          downloadTextFile(JSON.stringify(payload, null, 2), getConsolidatedSequenceGroupFilename("full", "json"), "application/json");
        } else {
          downloadTextFile(exportCaseBySequenceGroupsMarkdown(selectedCase, exportOptions), getConsolidatedSequenceGroupFilename("full", "md"), "text/markdown");
        }
        setSequenceGroupAuditFeedback("Full Case by Issues export created.");
        return;
      }
      const selectedAuditOptions = {
        ...exportOptions,
        ...(sequenceGroupAuditSelection.scope.issueId ? { issueId: sequenceGroupAuditSelection.scope.issueId } : {}),
      };
      if (sequenceGroupAuditFormat === "json") {
        const payload = exportSequenceGroupAuditJson(selectedCase, selectedSequenceGroupAuditGroup, selectedAuditOptions);
        downloadTextFile(JSON.stringify(payload, null, 2), getAuditExportFilename("json"), "application/json");
      } else if (sequenceGroupAuditFormat === "markdown") {
        const markdown = exportSequenceGroupAuditMarkdown(selectedCase, selectedSequenceGroupAuditGroup, selectedAuditOptions);
        downloadTextFile(markdown, getAuditExportFilename("md"), "text/markdown");
      } else if (sequenceGroupAuditFormat === "pdf") {
        const opened = printSequenceGroupAuditPdf(selectedCase, selectedSequenceGroupAuditGroup, selectedAuditOptions);
        if (!opened) {
          setSequenceGroupAuditFeedback("Could not open the print view. Check popup settings and try JSON or Markdown.");
          return;
        }
      }

      setSequenceGroupAuditFeedback("Issue Audit Pack created.");
    } catch (error) {
      console.error("Failed to export sequence group audit", error);
      setSequenceGroupAuditFeedback("Could not create the Issue Audit Pack.");
    }
  }

  const getSequenceRecordKey = (record) => `${record.recordType}:${record.id}`;

  const getRenamedSequenceGroupMeta = (fromName, toName) => {
    const renamedStore = renameSequenceGroupMetaInStore(readSequenceGroupMetaStore(), selectedCase?.id, fromName, toName);
    return getSequenceGroupMetaForCase(selectedCase?.id, renamedStore);
  };

  const persistRenamedSequenceGroupMeta = (fromName, toName) => {
    try {
      renameSequenceGroupMeta(selectedCase.id, fromName, toName);
      return true;
    } catch (error) {
      setSequenceGroupFeedback(`The Issue was saved, but its legacy compatibility metadata could not be updated. ${error?.message || ""}`.trim());
      return false;
    }
  };

  async function handleRenameSequenceGroup(groupName) {
    if (!selectedCase) return;

    const nextName = safeText(sequenceRenameInputs[groupName]).trim();
    if (!nextName) {
      setSequenceGroupFeedback("Enter a replacement name before renaming.");
      return;
    }

    if (nextName === groupName) {
      setSequenceGroupFeedback("The replacement name is the same as the current group.");
      return;
    }

    const canonical = normalizeCaseIssues(selectedCase, { sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()) }).caseData;
    const issue = resolveCaseIssue(canonical, { issueName: groupName });
    const result = issue && updateCaseIssue(canonical, issue.id, { name: nextName });
    if (!result?.success) return setSequenceGroupFeedback(result?.errors?.join(" ") || "Issue could not be renamed safely.");
    const renamedMeta = getRenamedSequenceGroupMeta(groupName, nextName);
    if (!(await onUpdateCase(result.caseData, { sequenceGroupMeta: renamedMeta }))) return setSequenceGroupFeedback("Issue could not be renamed safely.");
    setSelectedSequenceGroupName(nextName);
    if (!persistRenamedSequenceGroupMeta(groupName, nextName)) return;
    setSequenceRenameInputs((prev) => ({ ...prev, [groupName]: "" }));
    setSequenceGroupFeedback(`Renamed "${groupName}" to "${nextName}".`);
  }

  async function handleMergeSequenceGroup(fromGroup) {
    if (!selectedCase || !fromGroup) return;
    const targetGroup = safeText(sequenceMoveInputs[`merge:${fromGroup}`]).trim();
    if (!targetGroup) {
      setSequenceGroupFeedback("Choose a target group before merging.");
      return;
    }
    if (targetGroup === fromGroup) {
      setSequenceGroupFeedback("Choose a different target group before merging.");
      return;
    }

    const confirmed = window.confirm(`Merge "${fromGroup}" into "${targetGroup}"? Records in "${fromGroup}" will be moved to "${targetGroup}".`);
    if (!confirmed) return;

    const canonical = normalizeCaseIssues(selectedCase, { sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()) }).caseData;
    const source = resolveCaseIssue(canonical, { issueName: fromGroup });
    const destination = resolveCaseIssue(canonical, { issueName: targetGroup });
    const result = source && destination && mergeCaseIssues(canonical, source.id, destination.id);
    if (!result?.success || !(await onUpdateCase(result.caseData))) return setSequenceGroupFeedback(result?.errors?.join(" ") || "Issues could not be merged safely.");
    mergeSequenceGroupMeta(selectedCase.id, fromGroup, targetGroup);
    setSequenceGroupSelection({ issue: destination });
    setSequenceGroupFeedback(`Merged "${fromGroup}" into "${targetGroup}".`);
  }

  async function handleRemoveSequenceGroup(group) {
    if (!selectedCase || !group) return;

    const confirmed = window.confirm(`Clear "${group.name}" from ${group.totalCount} record${group.totalCount === 1 ? "" : "s"}? The records will be kept and become ungrouped.`);
    if (!confirmed) return;

    const canonical = normalizeCaseIssues(selectedCase, { sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()) }).caseData;
    const issue = resolveCaseIssue(canonical, { issueName: group.name });
    const result = issue && deleteCaseIssue(canonical, issue.id);
    if (!result?.success || !(await onUpdateCase(result.caseData))) return setSequenceGroupFeedback(result?.errors?.join(" ") || "Issue could not be removed safely.");
    deleteSequenceGroupMeta(selectedCase.id, group.name);
    setSequenceGroupSelection();
    setSequenceGroupFeedback(`Removed "${group.name}" from ${group.totalCount} record${group.totalCount === 1 ? "" : "s"}.`);
  }

  async function handleMoveSequenceRecord(record, targetGroup) {
    if (!selectedCase || !record) return;
    const nextGroup = safeText(targetGroup).trim();
    if (!nextGroup) {
      setSequenceGroupFeedback("Choose or enter an Issue before moving the record.");
      return;
    }

    const canonical = normalizeCaseIssues(selectedCase, { sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()) }).caseData;
    const destination = resolveCaseIssue(canonical, { issueName: nextGroup });
    const result = destination && assignRecordToIssue(canonical, record.recordType, record.id, destination.id);
    if (!result?.success || !(await onUpdateCase(result.caseData))) return setSequenceGroupFeedback(result?.errors?.join(" ") || "Record could not be moved safely.");
    setSequenceGroupSelection({ issue: destination });
    setSequenceGroupFeedback(`Moved "${record.title}" to "${nextGroup}".`);
  }

  function handleMoveSequenceRecordToExisting(record) {
    const key = getSequenceRecordKey(record);
    handleMoveSequenceRecord(record, sequenceMoveInputs[key]);
  }

  function handleMoveSequenceRecordToNew(record) {
    const key = getSequenceRecordKey(record);
    const targetGroup = safeText(sequenceNewGroupInputs[key]).trim();
    handleMoveSequenceRecord(record, targetGroup);
    if (targetGroup) setSequenceNewGroupInputs((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleClearSequenceRecord(record) {
    if (!selectedCase || !record) return;
    if (!(await onUpdateCase(clearRecordSequenceGroup(selectedCase, record.recordType, record.id)))) {
      setSequenceGroupFeedback("The case changed before this record could be updated. Refresh and try again.");
      return;
    }
    setSequenceGroupFeedback(`Removed "${record.title}" from its Issue.`);
  }

  function handleSelectSequenceTimelineItem(item) {
    if (!item) return;
    const key = `${item.recordType}:${item.id}`;
    setHighlightedSequenceRecordKey(key);
    const element = document.getElementById(`sequence-record-${item.recordType}-${item.id}`);
    if (element?.scrollIntoView) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleSelectSequenceRelationshipNode(node) {
    if (!node) return;
    const key = `${node.recordType}:${node.id}`;
    setHighlightedSequenceRecordKey(key);
    const element = document.getElementById(`sequence-record-${node.recordType}-${node.id}`);
    if (element?.scrollIntoView) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function closeWorkspaceActionMenu() {
    setWorkspaceActionMenuOpen(false);
  }

  function handleWorkspaceOpenSequenceGroups() {
    openSequenceGroupManager();
    closeWorkspaceActionMenu();
  }

  function restoreSequenceGroupManagerAfterEdit(context, { feedback, highlightedKey, selection } = {}) {
    if (!context) return;
    const targetSelection = selection || {
      issueId: context.selectedIssueId,
      groupName: context.selectedGroupName,
    };
    setSequenceGroupSelection(targetSelection);
    setSequenceGroupSearch(context.search);
    setSequenceRelationshipFilter(context.relationshipFilter);
    setSequenceTimelineSort(context.timelineSort);
    setHighlightedSequenceRecordKey(highlightedKey || context.highlightedRecordKey || "");
    setSequenceGroupFeedback(feedback || "");
    setSequenceGroupManagerOpen(true);

    window.setTimeout(() => {
      const scrollContainer = document.getElementById("sequence-group-manager-scroll");
      if (scrollContainer) {
        scrollContainer.scrollTop = context.scrollTop || 0;
      }
      if (highlightedKey) {
        const [recordType, recordId] = highlightedKey.split(":");
        const element = document.getElementById(`sequence-record-${recordType}-${recordId}`);
        if (element?.scrollIntoView) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 80);
  }

  function handleOpenSequenceRecordEdit(record) {
    if (!record || !openSequenceManagerRecordEdit) return;
    const key = `${record.recordType}:${record.id}`;
    const scrollContainer = document.getElementById("sequence-group-manager-scroll");
    const originatingSelection = resolveSequenceGroupReturnTarget(selectedCase, {
      issueId: selectedSequenceGroupId,
      groupName: selectedSequenceGroupName,
    });
    const managerContext = {
      selectedIssueId: originatingSelection.issue?.id || selectedSequenceGroupId,
      selectedGroupName: originatingSelection.groupName,
      search: sequenceGroupSearch,
      relationshipFilter: sequenceRelationshipFilter,
      timelineSort: sequenceTimelineSort,
      highlightedRecordKey: key,
      scrollTop: scrollContainer?.scrollTop || 0,
    };
    setHighlightedSequenceRecordKey(key);
    setSequenceGroupManagerOpen(false);
    openSequenceManagerRecordEdit(record.recordType, record, {
      activeGroupId: managerContext.selectedIssueId,
      activeGroupName: managerContext.selectedGroupName,
      onSaved: ({ recordId, recordType, previousSequenceGroup, previousSequenceGroupId, nextSequenceGroup, nextSequenceGroupId }) => {
        const savedKey = `${recordType}:${recordId}`;
        const previousGroup = safeText(previousSequenceGroup).trim();
        const nextGroup = safeText(nextSequenceGroup).trim();
        const currentCase = selectedCaseRef.current;
        const destinationSelection = resolveSequenceGroupReturnTarget(currentCase, {
          issueId: nextSequenceGroupId,
          groupName: nextGroup,
        });
        const sourceSelection = resolveSequenceGroupReturnTarget(currentCase, {
          issueId: previousSequenceGroupId || managerContext.selectedIssueId,
          groupName: previousGroup || managerContext.selectedGroupName,
        });
        const didMove = didSequenceGroupSelectionChange(sourceSelection, destinationSelection);
        let feedback = "Record saved. Returned to Issue.";
        let selection = sourceSelection;
        if (safeText(nextSequenceGroupId).trim() && destinationSelection.invalidCanonicalSelection) {
          feedback = "Record saved, but its assigned Issue is no longer available. Choose another Issue to continue.";
          selection = destinationSelection;
        } else if (nextGroup || nextSequenceGroupId) {
          selection = destinationSelection;
          if (didMove) {
            feedback = "Record moved to another Issue.";
          }
        } else if (previousGroup || previousSequenceGroupId) {
          feedback = "Record removed from this Issue.";
        }
        restoreSequenceGroupManagerAfterEdit(managerContext, {
          feedback,
          highlightedKey: selection.issue || selection.groupName ? savedKey : "",
          selection,
        });
      },
      onCancel: () => {
        const currentCase = selectedCaseRef.current;
        const selection = resolveSequenceGroupReturnTarget(currentCase, {
          issueId: managerContext.selectedIssueId,
          groupName: managerContext.selectedGroupName,
        });
        restoreSequenceGroupManagerAfterEdit(managerContext, {
          feedback: selection.invalidCanonicalSelection ? "The original Issue is no longer available. Choose another Issue to continue." : "Returned to Issue.",
          highlightedKey: selection.issue || selection.groupName ? key : "",
          selection,
        });
      },
    });
  }

  function handleWorkspaceOpenSequenceGroupAuditExport() {
    openSequenceGroupAuditExport();
    closeWorkspaceActionMenu();
  }

  function handleWorkspaceOpenIncidentDateRepairTool() {
    openIncidentDateRepairTool();
    closeWorkspaceActionMenu();
  }

  function handleWorkspaceBackToTop() {
    scrollToTop();
    closeWorkspaceActionMenu();
  }

  async function copySequenceGroupText(text) {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  function parseCaseSliceRecordIds(text = "") {
    const trimmed = text.trim();
    if (!trimmed) {
      return { incidents: [], evidence: [], documents: [], strategy: [], ledger: [] };
    }
    try {
      const parsed = JSON.parse(trimmed);
      return {
        incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        strategy: Array.isArray(parsed.strategy) ? parsed.strategy : [],
        ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
      };
    } catch {
      const selectedIds = { incidents: [], evidence: [], documents: [], strategy: [], ledger: [] };
      trimmed.split(/\r?\n/).forEach((line) => {
        const [rawType, rawIds = ""] = line.split(":");
        const type = rawType?.trim();
        if (!Object.prototype.hasOwnProperty.call(selectedIds, type)) return;
        selectedIds[type] = rawIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      });
      return selectedIds;
    }
  }

  function openAiWorkspace(toolId, requestedIssueId = "") {
    const nextIssueId = selectedSequenceGroupId || timelineIssueOptions[0]?.id || "";
    const qualityMode = CASE_QUALITY_REVIEW_MODES.find((mode) => mode.toolId === toolId || mode.legacyTaskId === toolId);
    const issueReviewMode = ISSUE_REVIEW_MODES.find((mode) => mode.toolId === toolId || mode.legacyTaskId === toolId);
    const matchingTask = AI_WORKSPACE_SECTIONS
      .flatMap((section) => section.groups?.flatMap((group) => group.tasks || []) || section.tasks || [])
      .find((task) => task.toolId === toolId || task.actionKind === toolId);
    setActiveAiTask(qualityMode ? "case-quality-review" : issueReviewMode ? "issue-review" : matchingTask?.id || "download-ai-workspace-snapshot");
    setActiveAiTool(qualityMode?.toolId || issueReviewMode?.toolId || matchingTask?.toolId || "");
    if (qualityMode) setCaseQualityReviewMode(qualityMode.id);
    if (issueReviewMode) setIssueReviewMode(issueReviewMode.id);
    setAiToolsSequenceGroup(requestedIssueId || nextIssueId);
    setAiToolsFeedback("");
    setActiveTab("ai-workspace");
    closeWorkspaceActionMenu();
  }

  function selectAiWorkspaceTask(task) {
    setActiveAiTask(task.id);
    if (task.actionKind === "case-quality-review") {
      const selectedMode = CASE_QUALITY_REVIEW_MODES.find((mode) => mode.id === caseQualityReviewMode) || CASE_QUALITY_REVIEW_MODES[0];
      setActiveAiTool(selectedMode.toolId);
    } else if (task.actionKind === "issue-review") {
      const selectedMode = ISSUE_REVIEW_MODES.find((mode) => mode.id === issueReviewMode) || ISSUE_REVIEW_MODES[0];
      setActiveAiTool(selectedMode.toolId);
    } else if (task.toolId) setActiveAiTool(task.toolId);
    if ((task.actionKind === "issue-review" || task.toolId === "chain-completion-pack" || task.toolId === "full-chain-gpt-pack") && !aiToolsSequenceGroup) {
      setAiToolsSequenceGroup(selectedSequenceGroupId || timelineIssueOptions[0]?.id || "");
    }
    setAiToolsFeedback("");
  }

  function selectCaseQualityReviewMode(modeId) {
    const nextMode = CASE_QUALITY_REVIEW_MODES.find((mode) => mode.id === modeId) || CASE_QUALITY_REVIEW_MODES[0];
    setCaseQualityReviewMode(nextMode.id);
    setActiveAiTool(nextMode.toolId);
    setAiToolsFeedback("");
  }

  function selectIssueReviewMode(modeId) {
    const nextMode = ISSUE_REVIEW_MODES.find((mode) => mode.id === modeId) || ISSUE_REVIEW_MODES[0];
    setIssueReviewMode(nextMode.id);
    setActiveAiTool(nextMode.toolId);
    setAiToolsFeedback("");
  }

  function getAiToolIssueScope(selection = aiToolsSequenceGroup) {
    if (selection && typeof selection === "object" && !Array.isArray(selection)) return selection;
    return selection ? { issueId: selection } : {};
  }

  function buildAiToolJson(toolId, issueSelection = aiToolsSequenceGroup) {
    if (!selectedCase) return null;
    const scope = getAiToolIssueScope(issueSelection);
    if (toolId === "case-slice-pack") return buildCaseSlicePack(selectedCase, parseCaseSliceRecordIds(caseSliceRecordIdsText));
    if (toolId === "missing-function-summaries") return buildMissingFunctionSummaryPack(selectedCase);
    if (toolId === "ungrouped-evidence-audit") return buildUngroupedEvidenceAuditPack(selectedCase);
    if (toolId === "ungrouped-incidents-audit") return buildUngroupedIncidentsAuditPack(selectedCase);
    if (toolId === "chain-completion-pack") return buildChainCompletionPack(selectedCase, "", scope);
    if (toolId === "full-chain-gpt-pack") return buildFullChainGptPack(selectedCase, "", {
      sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
      ...scope,
    });
    if (toolId === "weak-links-audit") return buildWeakLinksAuditPack(selectedCase);
    return null;
  }

  function buildAiToolMarkdown(toolId, issueSelection = aiToolsSequenceGroup) {
    if (!selectedCase) return "";
    const scope = getAiToolIssueScope(issueSelection);
    if (toolId === "case-slice-pack") return buildCaseSliceMarkdownPrompt(selectedCase, parseCaseSliceRecordIds(caseSliceRecordIdsText));
    if (toolId === "missing-function-summaries") return buildMissingFunctionSummaryMarkdownPrompt(selectedCase);
    if (toolId === "ungrouped-evidence-audit") return buildUngroupedEvidenceAuditMarkdownPrompt(selectedCase);
    if (toolId === "ungrouped-incidents-audit") return buildUngroupedIncidentsAuditMarkdownPrompt(selectedCase);
    if (toolId === "chain-completion-pack") return buildChainCompletionMarkdownPrompt(selectedCase, "", scope);
    if (toolId === "full-chain-gpt-pack") return buildFullChainGptMarkdownPrompt(selectedCase, "", {
      sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
      ...scope,
    });
    if (toolId === "weak-links-audit") return buildWeakLinksAuditMarkdownPrompt(selectedCase);
    return "";
  }

  async function handleCopyAiToolJson(toolId = activeAiTool, issueSelection = aiToolsSequenceGroup) {
    if (!selectedCase) return;
    try {
      const payload = buildAiToolJson(toolId, issueSelection);
      if (!payload) return;
      await copySequenceGroupText(JSON.stringify(payload, null, 2));
      setAiToolsFeedback("AI pack JSON copied.");
      setSequenceGroupFeedback("AI pack JSON copied.");
    } catch (error) {
      console.error("Failed to copy AI pack JSON", error);
      setAiToolsFeedback(error.message || "Could not copy AI pack JSON.");
      setSequenceGroupFeedback("Could not copy AI pack JSON.");
    }
  }

  async function handleCopyAiToolMarkdown(toolId = activeAiTool, issueSelection = aiToolsSequenceGroup) {
    if (!selectedCase) return;
    try {
      const markdown = buildAiToolMarkdown(toolId, issueSelection);
      if (!markdown) return;
      await copySequenceGroupText(markdown);
      setAiToolsFeedback("AI markdown prompt copied.");
      setSequenceGroupFeedback("AI markdown prompt copied.");
    } catch (error) {
      console.error("Failed to copy AI markdown prompt", error);
      setAiToolsFeedback(error.message || "Could not copy AI markdown prompt.");
      setSequenceGroupFeedback("Could not copy AI markdown prompt.");
    }
  }

  async function handleCreateManagedSequenceGroup(value) {
    if (!selectedCase) return;
    const result = createCaseIssue(selectedCase, value);
    if (!result.success) return setSequenceGroupFeedback(result.errors.join(" "));
    if (!(await onUpdateCase(result.caseData))) return;
    saveSequenceGroupMeta(selectedCase.id, result.issue.name, { description: result.issue.description });
    setSequenceGroupSelection({ issue: result.issue });
    setSequenceGroupFeedback(`Created Issue ${result.issue.reference} — ${result.issue.name}.`);
  }

  async function handleUpdateManagedSequenceGroup(currentName, value) {
    if (!selectedCase) return false;
    const canonical = normalizeCaseIssues(selectedCase, { sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()) }).caseData;
    const issue = resolveCaseIssue(canonical, { issueName: currentName });
    if (!issue) { setSequenceGroupFeedback("Issue could not be resolved safely."); return false; }
    const result = updateCaseIssue(canonical, issue.id, value);
    if (!result.success) { setSequenceGroupFeedback(result.errors.join(" ")); return false; }
    const renamed = result.issue.name !== currentName;
    const renamedMeta = renamed ? getRenamedSequenceGroupMeta(currentName, result.issue.name) : null;
    if (!(await onUpdateCase(result.caseData, renamed ? { sequenceGroupMeta: renamedMeta } : undefined))) return false;
    if (renamed) setSequenceGroupSelection({ issue: result.issue });
    if (renamed && !persistRenamedSequenceGroupMeta(currentName, result.issue.name)) return true;
    try {
      saveSequenceGroupMeta(selectedCase.id, result.issue.name, { description: result.issue.description });
    } catch (error) {
      setSequenceGroupFeedback(`The Issue was saved, but its legacy compatibility metadata could not be updated. ${error?.message || ""}`.trim());
      return true;
    }
    setSequenceGroupSelection({ issue: result.issue });
    setSequenceGroupFeedback(`Updated ${result.issue.reference} — ${result.issue.name}.`);
    return true;
  }

  async function handleDeleteManagedSequenceGroup(group) {
    if (!selectedCase || !group) return false;
    const confirmed = window.confirm(
      `Delete "${group.name}"? ${group.totalCount} assigned record${group.totalCount === 1 ? "" : "s"} will be kept and their sequence-group reference will be cleared.`
    );
    if (!confirmed) return false;

    const sequenceGroupMeta = getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore());
    const canonical = normalizeCaseIssues(selectedCase, { sequenceGroupMeta }).caseData;
    const issue = resolveCaseIssue(canonical, { issueName: group.name });
    if (!issue) return false;
    const result = deleteCaseIssue(canonical, issue.id);
    if (!result.success || !(await onUpdateCase(result.caseData))) return false;
    deleteSequenceGroupMeta(selectedCase.id, group.name);
    setSequenceGroupSelection();
    setSequenceGroupFeedback(`Deleted ${issue.reference} — ${issue.name}. Its records were kept and are now ungrouped; the reference is retired.`);
    return true;
  }

  async function handleManagedSequenceGroupOperation(operation) {
    if (!selectedCase || !operation?.type) return false;
    const sourceGroup = safeText(operation.sourceGroup).trim();
    const destinationGroup = safeText(operation.destinationGroup).trim();
    const affected = Array.isArray(operation.recordRefs) ? operation.recordRefs.length : 0;
    const canonical = normalizeCaseIssues(selectedCase, { sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()) }).caseData;
    const sourceIssue = resolveCaseIssue(canonical, { issueName: sourceGroup });
    const destinationIssue = resolveCaseIssue(canonical, { issueName: destinationGroup });
    const applySelectedRecords = (mutate) => {
      let caseData = canonical;
      for (const ref of operation.recordRefs || []) {
        const record = (Array.isArray(caseData[ref.recordType]) ? caseData[ref.recordType] : []).find((item) => item.id === ref.recordId);
        if (!record || record.sequenceGroupId !== sourceIssue?.id) return { success: false, errors: ["A selected record no longer belongs to the source Issue."] };
        const result = mutate(caseData, ref);
        if (!result.success) return result;
        caseData = result.caseData;
      }
      return { success: true, caseData, affectedCount: affected };
    };
    let result;
    let confirmation = "";

    if (operation.type === "move-records") {
      result = sourceIssue && destinationIssue
        ? applySelectedRecords((caseData, ref) => assignRecordToIssue(caseData, ref.recordType, ref.recordId, destinationIssue.id))
        : { success: false, errors: ["Issues could not be resolved safely."] };
      confirmation = `Operation: Move selected records\nSource: ${sourceGroup}\nDestination: ${destinationGroup}\nRecords affected: ${affected}\n\nThe records remain in the case. Their content, links, and attachments will not change.`;
    } else if (operation.type === "split-records") {
      const created = sourceIssue ? createCaseIssue(canonical, { name: destinationGroup, description: operation.destinationDescription || "" }) : null;
      result = created?.success
        ? (() => { let caseData = created.caseData; for (const ref of operation.recordRefs || []) { const assigned = assignRecordToIssue(caseData, ref.recordType, ref.recordId, created.issue.id); if (!assigned.success) return assigned; caseData = assigned.caseData; } return { success: true, caseData, affectedCount: affected }; })()
        : { success: false, errors: created?.errors || ["Source Issue could not be resolved safely."] };
      confirmation = `Operation: Split records into a new group\nSource: ${sourceGroup}\nDestination: ${destinationGroup}\nRecords affected: ${affected}\n\nUnselected records remain in the source group.`;
    } else if (operation.type === "remove-records") {
      result = sourceIssue
        ? applySelectedRecords((caseData, ref) => removeRecordFromIssue(caseData, ref.recordType, ref.recordId))
        : { success: false, errors: ["Source Issue could not be resolved safely."] };
      confirmation = `Operation: Remove selected records from Issue\nSource: ${sourceGroup}\nRecords affected: ${affected}\n\nThe records will remain in the case but will no longer belong to an Issue.`;
    } else if (operation.type === "merge-groups") {
      const merged = sourceIssue && destinationIssue ? mergeCaseIssues(canonical, sourceIssue.id, destinationIssue.id) : null;
      result = merged?.success ? { ...merged, success: true, affectedCount: Object.values(sequenceGroupDetails.groups.find((item) => item.name === sourceGroup)?.records || {}).flat().length } : { success: false, errors: merged?.errors || ["Issues could not be resolved safely."] };
      confirmation = `Operation: Merge entire group\nSource: ${sourceGroup}\nDestination: ${destinationGroup}\nRecords affected: ${result.affectedCount}\n\nDestination metadata remains primary. Source metadata is removed after the records are saved.`;
    } else if (operation.type === "rename-entire-group") {
      result = sourceIssue ? updateCaseIssue(canonical, sourceIssue.id, { name: destinationGroup, description: operation.destinationDescription || sourceIssue.description }) : { success: false, errors: ["Source Issue could not be resolved safely."] };
      if (result?.success) result = { ...result, affectedCount: affected };
      confirmation = `Operation: Move entire group to a new label\nSource: ${sourceGroup}\nDestination: ${destinationGroup}\nRecords affected: ${result.affectedCount}\n\nThe current group label will no longer exist.`;
    } else if (operation.type === "delete-group") {
      const group = sequenceGroupDetails.groups.find((item) => item.name === sourceGroup);
      return handleDeleteManagedSequenceGroup(group || { name: sourceGroup, totalCount: 0 });
    }

    if (!result?.success) {
      setSequenceGroupFeedback(result?.errors?.join(" ") || "The sequence-group operation could not be completed.");
      return false;
    }
    if (!window.confirm(confirmation)) return false;

    if (result.caseData !== canonical) {
      const renameMetadata = operation.type === "rename-entire-group"
        ? getRenamedSequenceGroupMeta(sourceGroup, destinationGroup)
        : null;
      const saved = await onUpdateCase(result.caseData, renameMetadata ? { sequenceGroupMeta: renameMetadata } : undefined);
      if (!saved) {
        setSequenceGroupFeedback("The case could not be saved. Legacy compatibility metadata was not changed.");
        return false;
      }
    }

    try {
      if (operation.type === "split-records") {
        saveSequenceGroupMeta(selectedCase.id, destinationGroup, { description: operation.destinationDescription });
        saveSequenceGroupMeta(selectedCase.id, sourceGroup, { description: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore())[sourceGroup]?.description || "" });
        setSequenceGroupSelection({ issue: resolveCaseIssue(result.caseData, { issueName: destinationGroup }), groupName: destinationGroup });
      } else if (operation.type === "remove-records") {
        saveSequenceGroupMeta(selectedCase.id, sourceGroup, { description: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore())[sourceGroup]?.description || "" });
      } else if (operation.type === "merge-groups") {
        const meta = getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore());
        const description = resolveSequenceGroupMergeDescription(meta[destinationGroup]?.description, meta[sourceGroup]?.description, operation.descriptionMode, operation.combinedDescription);
        saveSequenceGroupMeta(selectedCase.id, destinationGroup, { description });
        deleteSequenceGroupMeta(selectedCase.id, sourceGroup);
        setSequenceGroupSelection({ issue: resolveCaseIssue(result.caseData, { issueName: destinationGroup }), groupName: destinationGroup });
      } else if (operation.type === "rename-entire-group") {
        setSequenceGroupSelection({ issue: resolveCaseIssue(result.caseData, { issueName: destinationGroup }), groupName: destinationGroup });
        if (!persistRenamedSequenceGroupMeta(sourceGroup, destinationGroup)) return true;
        saveSequenceGroupMeta(selectedCase.id, destinationGroup, { description: operation.destinationDescription });
      }
    } catch (error) {
      setSequenceGroupFeedback(`The Issue records were saved, but legacy compatibility metadata could not be updated. ${error?.message || ""}`.trim());
      return true;
    }
    setSequenceGroupFeedback(`${result.affectedCount} record${result.affectedCount === 1 ? "" : "s"} updated successfully.`);
    return true;
  }

  async function handleDownloadSplitReasoningPackage() {
    if (!selectedCase) return;
    setAiToolsFeedback("Creating split reasoning package…");
    try {
      await downloadSplitReasoningPackage(selectedCase, {
        sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
      });
      setAiToolsFeedback("Split reasoning package downloaded.");
    } catch (error) {
      console.error("Failed to export split reasoning package", error);
      setAiToolsFeedback("Could not create the split reasoning package.");
    }
  }

  function handleDownloadAiWorkspaceSnapshot() {
    if (!selectedCase) return;
    try {
      downloadJson(buildAiWorkspaceCurrentCase(selectedCase), AI_WORKSPACE_CURRENT_CASE_FILENAME, { space: 2 });
      setAiToolsFeedback("AI Workspace CURRENT_CASE.json downloaded.");
    } catch (error) {
      console.error("Failed to export AI Workspace snapshot", error);
      setAiToolsFeedback(error.message || "Could not export AI Workspace snapshot.");
    }
  }

  async function handleCopyRecommendedGptJson() {
    if (!selectedCase) return;
    try {
      const payload = buildCaseReasoningExportPayload(selectedCase, "detailed");
      await copySequenceGroupText(JSON.stringify(payload, null, 2));
      setAiToolsFeedback("Recommended GPT JSON copied.");
      setSequenceGroupFeedback("Recommended GPT JSON copied.");
    } catch (error) {
      console.error("Failed to copy recommended GPT JSON", error);
      setAiToolsFeedback(error.message || "Could not copy recommended GPT JSON.");
      setSequenceGroupFeedback("Could not copy recommended GPT JSON.");
    }
  }

  async function handleCopySequenceGroupReviewPackage() {
    if (!selectedCase) return;

    try {
      const reviewPackage = buildSequenceGroupReviewPackage(selectedCase);
      await copySequenceGroupText(JSON.stringify(reviewPackage, null, 2));
      setSequenceGroupFeedback("Copied AI group review package.");
    } catch (error) {
      console.error("Failed to copy AI group review package", error);
      setSequenceGroupFeedback("Could not copy AI group review package.");
    }
  }

  function handleValidateSequenceGroupDelta() {
    if (!selectedCase) return;
    const result = ingestSequenceGroupDelta(sequenceGroupDeltaDraft, selectedCase);
    setSequenceGroupDeltaResult(result);
    if (result.ok) {
      setSequenceGroupFeedback("AI group suggestions are valid. Review the preview before applying.");
    } else {
      setSequenceGroupFeedback("AI group suggestions need fixes before they can be applied.");
    }
  }

  async function handleApplySequenceGroupDelta() {
    if (!selectedCase) return;
    const validation = ingestSequenceGroupDelta(sequenceGroupDeltaDraft, selectedCase);
    setSequenceGroupDeltaResult(validation);

    if (!validation.ok) {
      setSequenceGroupFeedback("AI group suggestions need fixes before they can be applied.");
      return;
    }

    const previewCount = Object.values(validation.preview || {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
    const confirmed = window.confirm(`Apply ${previewCount} AI Issue change${previewCount === 1 ? "" : "s"}?`);
    if (!confirmed) return;

    const result = ingestSequenceGroupDelta(sequenceGroupDeltaDraft, selectedCase, { apply: true });
    if (!(await onUpdateCase(result.updatedCase))) {
      setSequenceGroupFeedback("The case changed before these AI group changes could be applied. Refresh and review the suggestions again.");
      return;
    }
    setSequenceGroupDeltaDraft("");
    setSequenceGroupDeltaResult(null);
    setSequenceGroupFeedback(`Applied ${previewCount} AI Issue change${previewCount === 1 ? "" : "s"}.`);
  }

  async function handleCopyExecutiveSummaryPolishPrompt() {
    if (!executiveSummaryReport) return;
    try {
      await copySequenceGroupText(buildExecutiveSummaryNarrativePolishPrompt(executiveSummaryReport));
      setExecutiveSummaryPolishFeedback("Narrative polish prompt copied.");
    } catch (error) {
      console.error("Failed to copy executive summary polish prompt", error);
      setExecutiveSummaryPolishFeedback("Could not copy narrative polish prompt.");
    }
  }

  function handleClearExecutiveSummaryPolish() {
    setExecutiveSummaryPolishDraft("");
    setExecutiveSummaryPolishFeedback("Using deterministic Executive Summary.");
  }

  const health = selectedCase ? getCaseHealthReport(selectedCase) : null;
  const attachmentIntegrity = useMemo(() => runAttachmentIntegrityCheck({
    cases: attachmentDiagnosticCases.length > 0 ? attachmentDiagnosticCases : (selectedCase ? [selectedCase] : []),
    images: attachmentImages,
  }), [attachmentDiagnosticCases, attachmentImages, selectedCase]);
  const attachmentIntegrityIssueCount =
    attachmentIntegrity.orphanedRecordReferences.length +
    attachmentIntegrity.orphanedImages.length +
    attachmentIntegrity.metadataMismatches.length;
  const operationalIntegrity = useMemo(
    () => runOperationalIntegrityCheck(selectedCase || {}),
    [selectedCase]
  );
  const exportFreshness = operationalIntegrity.exportFreshness;
  const exportFreshnessIssueCount = exportFreshness.issues.length;
  const openOperationalLoops = operationalIntegrity.openOperationalLoops;
  const openOperationalLoopIssueCount = openOperationalLoops.issues.length;
  const overviewIncidents = selectedCase?.incidents || [];
  const overviewEvidence = selectedCase?.evidence || [];
  const overviewDocuments = selectedCase?.documents || [];
  const overviewRecords = overviewDocuments.filter(isTrackingRecord);
  const overviewSourceDocuments = overviewDocuments.filter((doc) => !isTrackingRecord(doc));
  const overviewUsefulDocuments = overviewSourceDocuments.filter((doc) =>
    safeText(doc.textContent).trim().length > 80 || safeText(doc.summary).trim().length > 20
  );
  const overviewLinkedEvidence = overviewEvidence.filter((item) =>
    Array.isArray(item.linkedIncidentIds) && item.linkedIncidentIds.length > 0
  );
  const overviewSupportedIncidents = overviewIncidents.filter((item) =>
    (Array.isArray(item.attachments) && item.attachments.length > 0) ||
    (Array.isArray(item.linkedEvidenceIds) && item.linkedEvidenceIds.length > 0)
  );
  const groupedWeakPoints = (health?.issues || [])
    .flatMap((group) => group.items.map((item) => ({ ...item, category: group.category })))
    .filter((item) => item.classification === "gap")
    .reduce((groups, item) => {
      const detail = safeText(item.detail).toLowerCase();
      const category = safeText(item.category).toLowerCase();
      let key = "Records/data weakness";
      if (category.includes("timeline") || detail.includes("date") || detail.includes("chronology")) {
        key = "Timeline/chronology weakness";
      } else if (detail.includes("linked incident") || detail.includes("linked evidence") || detail.includes("broken linked")) {
        key = "Structure/linking weakness";
      } else if (
        category.includes("evidence") ||
        detail.includes("physical") ||
        detail.includes("digital") ||
        detail.includes("availability") ||
        detail.includes("attachment")
      ) {
        key = "Evidence weakness";
      }
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }, {});
  const weakPointText = {
    "Evidence weakness": "Evidence support is incomplete for key incidents",
    "Structure/linking weakness": "Some records are not clearly linked into the case story",
    "Timeline/chronology weakness": "Chronology needs clearer dates or ordering",
    "Records/data weakness": "Some structured case data is incomplete",
  };
  const displayedWeakPoints = [
    "Evidence weakness",
    "Structure/linking weakness",
    "Timeline/chronology weakness",
    "Records/data weakness",
  ]
    .filter((category) => (groupedWeakPoints[category] || []).length > 0)
    .slice(0, 3)
    .map((category) => ({
      category,
      text: weakPointText[category],
    }));
  const meaningfulGapCount = (health?.issues || [])
    .flatMap((group) => group.items)
    .filter((item) => item.classification === "gap").length;
  const blockerCount = health?.totalIssues || 0;
  const hasIncidents = overviewIncidents.length > 0;
  const hasRecords = overviewRecords.length > 0;
  const hasEvidence = overviewEvidence.length > 0;
  const hasSomeLinking = overviewLinkedEvidence.length > 0 || overviewSupportedIncidents.length > 0;
  const hasStrongStructure =
    hasIncidents &&
    hasRecords &&
    hasEvidence &&
    overviewLinkedEvidence.length > 0 &&
    overviewSupportedIncidents.length > 0 &&
    displayedWeakPoints.length === 0;
  const casePosition = !hasIncidents && !hasRecords
    ? "Logging"
    : hasStrongStructure
      ? "Escalation-ready"
      : hasIncidents && hasRecords && hasSomeLinking
        ? "Structured"
        : "Building";
  const strengthScore =
    (hasIncidents ? 1 : 0) +
    (overviewIncidents.length >= 2 ? 1 : 0) +
    (hasEvidence ? 1 : 0) +
    (overviewLinkedEvidence.length > 0 ? 1 : 0) +
    (overviewSourceDocuments.length > 0 ? 1 : 0) +
    (overviewUsefulDocuments.length > 0 ? 1 : 0) +
    (overviewSupportedIncidents.length > 0 ? 1 : 0) +
    (hasRecords ? 1 : 0);
  const canBeStrong = blockerCount === 0 && meaningfulGapCount < 2;
  const caseStrength = canBeStrong && strengthScore >= 5
    ? "Strong"
    : strengthScore >= 2
      ? "Moderate"
      : "Weak";
  const positionStyleMap = {
    Logging: "border-neutral-200 bg-neutral-50 text-neutral-700",
    Building: "border-blue-200 bg-blue-50 text-blue-700",
    Structured: "border-amber-200 bg-amber-50 text-amber-700",
    "Escalation-ready": "border-lime-200 bg-lime-50 text-lime-700",
  };
  const strengthStyleMap = {
    Weak: "border-red-200 bg-red-50 text-red-700",
    Moderate: "border-amber-200 bg-amber-50 text-amber-700",
    Strong: "border-lime-200 bg-lime-50 text-lime-700",
  };
  const positionStyle = positionStyleMap[casePosition] || positionStyleMap.Logging;
  const strengthStyle = strengthStyleMap[caseStrength] || strengthStyleMap.Weak;
  const readinessDisplayMap = {
    Healthy: "Ready",
    "Needs review": "Needs work",
    "High risk": "Not ready",
  };
  const readinessLabel = readinessDisplayMap[health?.status] || health?.status || "Unknown";
  const issuesLabel = !health || health.totalIssues === 0
    ? "Low"
    : health.totalIssues <= 5
      ? "Medium"
      : "High";
  const criticalBlockers = (health?.issues || [])
    .flatMap(group => group.items)
    .filter(item => item.severity === "blocking")
    .slice(0, 3);

  const rawActionSummary = selectedCase?.actionSummary || {};
  const actionSummary = normalizeActionSummary(rawActionSummary);
  const {
    currentFocus,
    nextActions: storedNextActions = [],
    importantReminders = [],
    strategyFocus = [],
    criticalDeadlines = [],
  } = actionSummary;
  const activeNextActions = storedNextActions.filter((action) => !action.completed);
  const completedNextActions = storedNextActions.filter((action) => action.completed);
  const nextActions = activeNextActions.map(getActionText);
  const sequenceGroupMeta = getSequenceGroupMetaForCase(selectedCase?.id, readSequenceGroupMetaStore());
  const caseBriefingModel = useMemo(() => buildCaseBriefingModel({
    caseData: selectedCase,
    sequenceGroupMeta,
    diagnostics: health,
    now: new Date().toISOString(),
    folderName: caseFolderName,
  }), [selectedCase, sequenceGroupMeta, health, caseFolderName]);

  const copyActionSummaryToClipboard = () => {
    const text = `Focus: ${currentFocus || "—"}

Next:
${nextActions.join("\n") || "—"}

Reminders:
${importantReminders.join("\n") || "—"}

Strategy:
${strategyFocus.join("\n") || "—"}`;
    navigator.clipboard.writeText(text);
  };

  const addQuickAction = () => {
    const val = quickActionInput.trim();
    if (!val) return;

    applyActionSummaryUpdate({
      nextActions: [...storedNextActions, { text: val, completed: false, completedAt: null }],
      updatedAt: new Date().toISOString(),
    });
    setQuickActionInput("");
  };

  const handleQuickActionKeyDown = (e) => {
    if (e.key === 'Enter') {
      addQuickAction();
    }
  };

  const handleRemoveNextAction = (index) => {
    let activeIndex = -1;
    applyActionSummaryUpdate({
      nextActions: storedNextActions.filter((action) => {
        if (action.completed) return true;
        activeIndex += 1;
        return activeIndex !== index;
      }),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleMoveNextAction = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= activeNextActions.length || fromIndex === toIndex) return;

    const reorderedActiveActions = [...activeNextActions];
    const [item] = reorderedActiveActions.splice(fromIndex, 1);
    reorderedActiveActions.splice(toIndex, 0, item);
    let activeIndex = 0;
    const reordered = storedNextActions.map((action) => {
      if (action.completed) return action;
      const nextAction = reorderedActiveActions[activeIndex];
      activeIndex += 1;
      return nextAction;
    });

    applyActionSummaryUpdate({
      nextActions: reordered,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleToggleNextActionCompleted = (targetAction, completed) => {
    let updated = false;
    const updatedActions = storedNextActions.map((action) => {
      if (updated || action !== targetAction) return action;
      updated = true;
      return {
        ...action,
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      };
    });

    if (!updated) return;

    applyActionSummaryUpdate({
      nextActions: updatedActions,
      updatedAt: new Date().toISOString(),
    });
  };

  const packText = (value, fallback = "") => (typeof value === "string" && value.trim()) ? value.trim() : fallback;
  const packExecutiveSummary = (
    packText(currentFocus) ||
    packText(selectedCase?.caseState?.currentSituation) ||
    packText(selectedCase?.caseState?.mainProblem) ||
    packText(selectedCase?.notes) ||
    packText(selectedCase?.description) ||
    "No executive summary available."
  );
  const packAppendixItems = [
    ...(activeNextActions || []).map((item) => ({ kind: "Next step", text: getActionText(item) })),
    ...(importantReminders || []).map((item) => ({ kind: "Reminder", text: item })),
  ];

  const handleOpenIssue = (issue) => {
    if (issue.tab) setActiveTab(issue.tab);
    if (issue.type === "watchItems") {
      setActiveTab("watch");
      return;
    }
    if (issue.record && issue.type === "documents") {
      openDocumentModal(issue.record, issue.record.id, isTrackingRecord(issue.record) ? "record" : "document");
      return;
    }

    if (issue.record && issue.type === "ledger") {
      openLedgerModal(issue.record, issue.record.id);
      return;
    }

    if (issue.record && issue.type) {
      const editableRecordTypes = new Set(["incidents", "evidence", "strategy"]);
      if (!editableRecordTypes.has(issue.type)) return;

      const detail = (issue.detail || "").toLowerCase();
      const missingParts = detail.startsWith("missing:")
        ? detail.replace(/^missing:\s*/, "").split(",").map(part => part.trim()).filter(Boolean)
        : [];
      const focusField = missingParts.find(part => ["title", "date", "description"].includes(part)) || (
        detail.includes("title")
          ? "title"
          : detail.includes("date")
            ? "date"
            : detail.includes("description")
              ? "description"
              : null
      );
      const focusHint = missingParts.length > 1
        ? missingParts.filter(part => part !== focusField).join(", ")
        : "";
      openEditRecordModal(issue.type, issue.record, { focusField, focusHint, fromIssue: true });
      setTimeout(() => {
        const el = document.getElementById(`record-${issue.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  };

  const openLinkedRecord = (recordId, expectedRecordType = "") => {
    const found = resolveRecordById(selectedCase, recordId, expectedRecordType);
    if (!found) return;
    const editTypeMap = {
      incident: "incidents",
      evidence: "evidence",
      strategy: "strategy",
      ledger: "ledger",
    };

    if (found.recordType === "document") {
      openDocumentModal(found.record, found.record.id, found.typeLabel === "Document" ? "document" : "record");
      return;
    }

    if (found.recordType === "ledger") {
      setActiveTab("ledger");
      openLedgerModal(found.record, found.record.id);
      return;
    }

    const targetType = editTypeMap[found.recordType];
    if (!targetType) return;
    setActiveTab(targetType);
    openEditRecordModal(targetType, found.record);
  };

  const timelineFilterOptions = [
    { id: "all", label: "All" },
    { id: "incident", label: "Incidents" },
    { id: "evidence", label: "Evidence" },
    { id: "document", label: "Documents" },
    { id: "payment", label: "Payments" },
    { id: "strategy", label: "Strategy" },
  ];

  const trackingDocuments = useMemo(() => {
    return (selectedCase?.documents || []).filter(isTrackingRecord);
  }, [selectedCase?.documents]);

  const parsedTrackingRecords = trackingDocuments.map(parseTrackingRecord);
  const recordConversionOptions = ["incidents", "evidence", "documents", "strategy"];
  const recordConversionPreview = useMemo(() => {
    if (!recordConversion) return null;
    return buildRecordTypeConversionPreview(
      selectedCase,
      recordConversion.sourceType,
      recordConversion.recordId,
      recordConversion.targetType
    );
  }, [recordConversion, selectedCase]);

  function openRecordConversion(sourceType, record) {
    if (!record?.id) return;
    const targetType = recordConversionOptions.find((type) => type !== sourceType) || "";
    setRecordConversion({
      sourceType,
      recordId: record.id,
      targetType,
    });
  }

  async function applyRecordConversion() {
    if (!selectedCase || !recordConversionPreview) return;
    const result = convertRecordTypeInCase(
      selectedCase,
      recordConversionPreview.fromType,
      recordConversionPreview.recordId,
      recordConversionPreview.toType
    );
    if (!result.record || result.case === selectedCase) return;

    const saved = await onUpdateCase(result.case);
    if (!saved) return;

    setRecordConversion(null);
    setActiveTab(result.preview.toType === "documents" ? "documents" : result.preview.toType);
  }

  const getBasedOnEvidenceForTrackingRecord = (record) => {
    const evidenceIds = Array.isArray(record?.rawDocument?.basedOnEvidenceIds)
      ? record.rawDocument.basedOnEvidenceIds
      : [];
    return evidenceIds
      .map((evidenceId) => (selectedCase?.evidence || []).find((item) => item.id === evidenceId))
      .filter(Boolean);
  };

  const derivedTrackingLedger = generateLedgerEntries(parsedTrackingRecords);

  let totalOutgoing = 0;
  let totalIncoming = 0;

  derivedTrackingLedger.forEach(entry => {
    if (entry.status === "disputed" || entry.status === "pending") return;
    if (entry.direction === "outgoing") totalOutgoing += entry.amount;
    if (entry.direction === "incoming") totalIncoming += entry.amount;
  });
  const renderRecordCard = (item, recordType) => {
  return (
    <RecordCard
      item={item}
      recordType={recordType}
      selectedCase={selectedCase}
      imageCache={imageCache}
      onPreviewFile={onPreviewFile}
      onViewRecord={onViewRecord}
      openEditRecordModal={openEditRecordModal}
      onConvertRecord={openRecordConversion}
      onArchiveStrategy={async (strategyId) => {
        const result = confirmAndArchiveOpenStrategy(
          selectedCase,
          strategyId,
          () => window.confirm("Archive this Strategy? It will remain in the case, but will no longer be treated as active/open work.")
        );
        if (result.archived) await onUpdateCase(result.caseData);
      }}
      deleteRecord={deleteRecord}
      openLinkedRecord={openLinkedRecord}
      openRecordModal={openRecordModal}
    />
  );
};

  const renderListBlock = (items, emptyText, recordType, options = {}) => {
    if (!items || !items.length) {
      return (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          {emptyText}
        </div>
      );
    }

    if (!isTimelineCapable(recordType)) {
      return (
        <div className="space-y-3">
          {items.map((item) => renderRecordCard(item, recordType))}
        </div>
      );
    }

    // Chronological grouping logic (like in Timeline tab)
    const sorted = options.preserveOrder ? items : sortChronological(items);
    const groups = [];
    let lastDate = null;
    sorted.forEach(item => {
      const d = item.eventDate || item.date || "Unknown Date";
      if (d !== lastDate) {
        groups.push({ date: d, items: [item] });
        lastDate = d;
      } else {
        groups[groups.length - 1].items.push(item);
      }
    });

    return (
      <div className="space-y-8">
        {groups.map(group => (
          <div key={group.date} className="space-y-4">
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="mx-4 flex-shrink text-xs font-bold uppercase tracking-widest text-neutral-400">
                {group.date}
              </span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>
            <div className="space-y-3">
              {group.items.map(item => renderRecordCard(item, recordType))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const allEvidence = selectedCase?.evidence || [];
  const allIncidents = selectedCase?.incidents || [];
  const allDocuments = selectedCase?.documents || [];
  const allParties = selectedCase?.parties || [];
  const evidenceHasIncident = (evidence) => (
    Array.isArray(evidence?.linkedIncidentIds) && evidence.linkedIncidentIds.length > 0
  ) || allIncidents.some((incident) => (
    Array.isArray(incident?.linkedEvidenceIds) && incident.linkedEvidenceIds.includes(evidence?.id)
  ));
  const evidenceHasParties = (evidence) => Array.isArray(evidence?.linkedPartyIds) && evidence.linkedPartyIds.length > 0;
  const evidenceHasAttachmentOrAvailability = (evidence) => (
    (Array.isArray(evidence?.attachments) && evidence.attachments.length > 0) ||
    (Array.isArray(evidence?.availability?.digital?.files) && evidence.availability.digital.files.length > 0) ||
    Boolean(evidence?.availability?.digital?.hasDigital) ||
    Boolean(evidence?.availability?.physical?.hasOriginal) ||
    Boolean(safeText(evidence?.availability?.physical?.location).trim()) ||
    Boolean(safeText(evidence?.availability?.physical?.notes).trim()) ||
    Boolean(safeText(evidence?.availability?.digital?.notes).trim())
  );
  const evidenceHasFunctionSummary = (evidence) => Boolean(safeText(evidence?.functionSummary).trim());
  const evidenceLinkedToIncidents = allEvidence.filter(evidenceHasIncident);
  const evidenceUnlinked = allEvidence.filter((evidence) => !evidenceHasIncident(evidence));
  const evidenceWithParties = allEvidence.filter(evidenceHasParties);
  const evidenceWithAttachments = allEvidence.filter(evidenceHasAttachmentOrAvailability);
  const evidenceMissingFunctionSummary = allEvidence.filter((evidence) => !evidenceHasFunctionSummary(evidence));
  const evidenceWithoutParties = allEvidence.filter((evidence) => !evidenceHasParties(evidence));
  const evidenceWithoutAttachmentOrAvailability = allEvidence.filter((evidence) => !evidenceHasAttachmentOrAvailability(evidence));
  const evidenceSummaryCards = [
    { label: "Total Evidence", value: allEvidence.length },
    { label: "Linked to Incidents", value: evidenceLinkedToIncidents.length },
    { label: "Unlinked Evidence", value: evidenceUnlinked.length },
    { label: "Evidence with Parties", value: evidenceWithParties.length },
    { label: "Evidence with Attachments", value: evidenceWithAttachments.length },
    { label: "Missing Function Summary", value: evidenceMissingFunctionSummary.length },
  ];
  const evidenceAttentionIssues = [
    {
      key: "unlinked",
      filter: "unlinked",
      count: evidenceUnlinked.length,
      text: `${evidenceUnlinked.length} evidence item${evidenceUnlinked.length === 1 ? " is" : "s are"} not linked to an incident.`,
    },
    {
      key: "missing-parties",
      filter: "missing-parties",
      count: evidenceWithoutParties.length,
      text: `${evidenceWithoutParties.length} evidence item${evidenceWithoutParties.length === 1 ? "" : "s"} have no linked party.`,
    },
    {
      key: "missing-summary",
      filter: "missing-summary",
      count: evidenceMissingFunctionSummary.length,
      text: `${evidenceMissingFunctionSummary.length} evidence item${evidenceMissingFunctionSummary.length === 1 ? "" : "s"} have no function summary.`,
    },
    {
      key: "missing-attachments",
      filter: "missing-attachments",
      count: evidenceWithoutAttachmentOrAvailability.length,
      text: `${evidenceWithoutAttachmentOrAvailability.length} evidence item${evidenceWithoutAttachmentOrAvailability.length === 1 ? "" : "s"} have no attachment or recorded availability.`,
    },
  ].filter((issue) => issue.count > 0);
  const scrollToEvidenceList = () => {
    window.requestAnimationFrame(() => {
      document.getElementById("evidence-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openBriefingItem = (item) => {
    if (!item) return;
    const launch = getOverviewRecordLaunch(item, selectedCase);
    if (!launch.handled) return;
    if (launch.targetType === "case_briefing") {
      openActionSummaryEdit();
      return;
    }
    if (launch.targetType === "issue") {
      openSequenceGroupManager(launch.targetId || launch.targetName);
      return;
    }
    if (launch.targetType === "watch") {
      setOverviewWatchItem(launch.record);
      return;
    }
    if (launch.targetType === "document") {
      openDocumentModal(launch.record, launch.record.id, isTrackingRecord(launch.record) ? "record" : "document");
      return;
    }
    if (launch.targetType === "ledger") {
      openLedgerModal(launch.record, launch.record.id);
      return;
    }
    if (["incidents", "evidence", "strategy"].includes(launch.targetType)) {
      handleOpenIssue({ ...item, record: launch.record, type: launch.targetType, tab: undefined });
    }
  };
  const saveOverviewWatchItem = async (savedItem) => {
    const currentItems = selectedCase?.watchItems || [];
    const exists = currentItems.some((item) => item.id === savedItem.id);
    const saved = await onUpdateCase({
      ...selectedCase,
      watchItems: exists
        ? currentItems.map((item) => item.id === savedItem.id ? savedItem : item)
        : [savedItem, ...currentItems],
      updatedAt: new Date().toISOString(),
    });
    if (saved) setOverviewWatchItem(undefined);
  };
  const applyEvidenceFilter = (filter) => {
    setEvidenceFilter(filter);
    scrollToEvidenceList();
  };
  const evidenceMatchesSequenceGroup = (evidence) => {
    return isTimelineItemInIssueFilter(selectedCase, { source: evidence }, evidenceSequenceGroupFilter);
  };
  const evidenceSearchQuery = evidenceSearch.trim().toLowerCase();
  const evidenceMatchesSearch = (evidence) => {
    if (!evidenceSearchQuery) return true;
    const linkedIncidentTitles = allIncidents
      .filter((incident) => (
        (Array.isArray(evidence?.linkedIncidentIds) && evidence.linkedIncidentIds.includes(incident.id)) ||
        (Array.isArray(incident?.linkedEvidenceIds) && incident.linkedEvidenceIds.includes(evidence?.id))
      ))
      .map((incident) => incident.title);
    const linkedPartyNames = allParties
      .filter((party) => Array.isArray(evidence?.linkedPartyIds) && evidence.linkedPartyIds.includes(party.id))
      .flatMap((party) => [party.displayName, party.legalName, party.organisationName]);
    const searchValues = [
      evidence.title,
      evidence.description,
      evidence.functionSummary,
      evidence.reviewNotes,
      evidence.sequenceGroup,
      evidence.evidenceType,
      evidence.evidenceRole,
      evidence.status,
      ...(Array.isArray(evidence.tags) ? evidence.tags : []),
      ...linkedIncidentTitles,
      ...linkedPartyNames,
    ];
    return searchValues.some((value) => safeText(value).toLowerCase().includes(evidenceSearchQuery));
  };
  const evidenceTimes = allEvidence.map((item) => parseCalendarDate(item?.eventDate)).filter((time) => time !== null);
  const latestEvidenceTime = evidenceTimes.length > 0 ? Math.max(...evidenceTimes) : null;
  const evidenceNeedsAttention = (evidence) => (
    !evidenceHasIncident(evidence) ||
    !evidenceHasParties(evidence) ||
    !evidenceHasFunctionSummary(evidence) ||
    !evidenceHasAttachmentOrAvailability(evidence)
  );
  const evidenceMatchesQuickFilter = (evidence) => {
    if (evidenceQuickFilter === "all") return true;
    if (evidenceQuickFilter === "needs-attention") return evidenceNeedsAttention(evidence);
    if (evidenceQuickFilter === "unlinked") return !evidenceHasIncident(evidence);
    if (evidenceQuickFilter === "missing-parties") return !evidenceHasParties(evidence);
    if (evidenceQuickFilter === "missing-summary") return !evidenceHasFunctionSummary(evidence);
    if (evidenceQuickFilter === "missing-attachments") return !evidenceHasAttachmentOrAvailability(evidence);
    if (evidenceQuickFilter === "ungrouped") {
      return isTimelineItemInIssueFilter(selectedCase, { source: evidence }, TIMELINE_UNASSIGNED_ISSUES_FILTER);
    }
    if (evidenceQuickFilter === "recent") {
      const evidenceTime = parseCalendarDate(evidence?.eventDate);
      return evidenceTime !== null && latestEvidenceTime !== null && evidenceTime >= latestEvidenceTime - 1000 * 60 * 60 * 24 * 30;
    }
    return true;
  };
  const evidenceQuickFilterChips = [
    { id: "all", label: "All" },
    { id: "needs-attention", label: "Needs Attention" },
    { id: "unlinked", label: "Unlinked" },
    { id: "missing-parties", label: "No Parties" },
    { id: "missing-summary", label: "Missing Summary" },
    { id: "missing-attachments", label: "No Attachment" },
    { id: "ungrouped", label: "Ungrouped" },
    { id: "recent", label: "Recent" },
  ];
  const filteredEvidence = allEvidence.filter((evidence) => {
    if (!evidenceMatchesSequenceGroup(evidence)) return false;
    if (evidenceFilter === "needs_review" && evidence.status !== "needs_review") return false;
    if (evidenceFilter === "incomplete" && evidence.status !== "incomplete") return false;
    if (evidenceFilter === "verified" && evidence.status !== "verified") return false;
    if (evidenceFilter === "unlinked" && evidenceHasIncident(evidence)) return false;
    if (evidenceFilter === "missing-parties" && evidenceHasParties(evidence)) return false;
    if (evidenceFilter === "missing-summary" && evidenceHasFunctionSummary(evidence)) return false;
    if (evidenceFilter === "missing-attachments" && evidenceHasAttachmentOrAvailability(evidence)) return false;
    if (!evidenceMatchesQuickFilter(evidence)) return false;
    return evidenceMatchesSearch(evidence);
  });
  const sortedFilteredEvidence = [...filteredEvidence].sort(compareRecordsNewestFirst);
  const needsReviewEvidence = sortedFilteredEvidence.filter(item => item.status === "needs_review");
  const incompleteEvidence = sortedFilteredEvidence.filter(item => item.status === "incomplete");
  const verifiedEvidence = sortedFilteredEvidence.filter(item => item.status === "verified");
  const incidentIdsSupportedByEvidence = new Set([
    ...allIncidents.flatMap((incident) =>
      Array.isArray(incident?.linkedEvidenceIds) && incident.linkedEvidenceIds.length > 0 ? [incident.id] : []
    ),
    ...allEvidence.flatMap((evidence) => Array.isArray(evidence?.linkedIncidentIds) ? evidence.linkedIncidentIds : []),
  ]);
  const getIncidentDocumentLinks = (incident) => {
    const linkedRecordIds = Array.isArray(incident?.linkedRecordIds) ? incident.linkedRecordIds : [];
    return allDocuments.filter((document) => {
      const documentLinkedRecordIds = Array.isArray(document?.linkedRecordIds) ? document.linkedRecordIds : [];
      return linkedRecordIds.includes(document.id) || documentLinkedRecordIds.includes(incident.id);
    });
  };
  const getIncidentEvidenceLinks = (incident) => {
    const linkedEvidenceIds = Array.isArray(incident?.linkedEvidenceIds) ? incident.linkedEvidenceIds : [];
    return allEvidence.filter((evidence) => (
      linkedEvidenceIds.includes(evidence.id) ||
      (Array.isArray(evidence?.linkedIncidentIds) && evidence.linkedIncidentIds.includes(incident.id))
    ));
  };
  const getIncidentPartyLinks = (incident) => {
    const linkedPartyIds = Array.isArray(incident?.linkedPartyIds) ? incident.linkedPartyIds : [];
    return allParties.filter((party) => linkedPartyIds.includes(party.id));
  };
  const incidentMatchesSearch = (incident) => {
    if (!incidentSearchQuery) return true;

    const searchValues = [
      incident.title,
      incident.description,
      incident.sequenceGroup,
      ...(Array.isArray(incident.tags) ? incident.tags : []),
      ...getIncidentPartyLinks(incident).flatMap((party) => [
        party.displayName,
        party.legalName,
        party.organisationName,
      ]),
      ...getIncidentDocumentLinks(incident).map((document) => document.title),
      ...getIncidentEvidenceLinks(incident).map((evidence) => evidence.title),
    ];

    return searchValues.some((value) => safeText(value).toLowerCase().includes(incidentSearchQuery));
  };
  const incidentHasEvidence = (incident) => incident?.id && incidentIdsSupportedByEvidence.has(incident.id);
  const incidentHasParties = (incident) => Array.isArray(incident?.linkedPartyIds) && incident.linkedPartyIds.length > 0;
  const incidentHasDocuments = (incident) => getIncidentDocumentLinks(incident).length > 0;
  const isIncidentActive = (incident) => !["done", "closed", "archived"].includes(safeText(incident?.status).toLowerCase());
  const isIncidentReadyForReview = (incident) => (
    Boolean(safeText(incident?.title).trim()) &&
    Boolean(safeText(incident?.eventDate || incident?.date).trim()) &&
    incidentHasEvidence(incident) &&
    incidentHasParties(incident) &&
    incidentHasDocuments(incident)
  );
  const incidentsWithEvidence = allIncidents.filter(incidentHasEvidence);
  const incidentsWithoutEvidence = allIncidents.filter((incident) => !incidentHasEvidence(incident));
  const incidentsWithParties = allIncidents.filter(incidentHasParties);
  const incidentsWithoutParties = allIncidents.filter((incident) => !incidentHasParties(incident));
  const incidentsWithoutDocuments = allIncidents.filter((incident) => !incidentHasDocuments(incident));
  const incidentsReadyForReview = allIncidents.filter(isIncidentReadyForReview);
  const incidentSummaryCards = [
    { label: "Total Incidents", value: allIncidents.length },
    { label: "Active Incidents", value: allIncidents.filter(isIncidentActive).length },
    { label: "Incidents with Evidence", value: incidentsWithEvidence.length },
    { label: "Incidents without Evidence", value: incidentsWithoutEvidence.length },
    { label: "Incidents with Parties", value: incidentsWithParties.length },
    { label: "Incidents Ready for Review", value: incidentsReadyForReview.length },
  ];
  const incidentAttentionIssues = [
    {
      key: "missing-evidence",
      filter: "missing-evidence",
      count: incidentsWithoutEvidence.length,
      text: `${incidentsWithoutEvidence.length} incident${incidentsWithoutEvidence.length === 1 ? "" : "s"} have no supporting evidence.`,
    },
    {
      key: "missing-parties",
      filter: "missing-parties",
      count: incidentsWithoutParties.length,
      text: `${incidentsWithoutParties.length} incident${incidentsWithoutParties.length === 1 ? "" : "s"} have no linked parties.`,
    },
    {
      key: "missing-documents",
      filter: "missing-documents",
      count: incidentsWithoutDocuments.length,
      text: `${incidentsWithoutDocuments.length} incident${incidentsWithoutDocuments.length === 1 ? "" : "s"} have no linked documents.`,
    },
  ].filter((issue) => issue.count > 0);
  const scrollToIncidentList = () => {
    window.requestAnimationFrame(() => {
      document.getElementById("incident-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const applyIncidentAttentionFilter = (filter) => {
    setIncidentFilter(filter);
    scrollToIncidentList();
  };
  const incidentSearchQuery = incidentSearch.trim().toLowerCase();
  const incidentMatchesSequenceGroup = (incident) => {
    return isTimelineItemInIssueFilter(selectedCase, { source: incident }, incidentSequenceGroupFilter);
  };
  const filteredIncidents = allIncidents.filter((incident) => {
    if (!incidentMatchesSequenceGroup(incident)) return false;
    if (incidentFilter === "needs-attention" && incidentHasEvidence(incident) && incidentHasParties(incident) && incidentHasDocuments(incident)) return false;
    if (incidentFilter === "missing-evidence" && incidentHasEvidence(incident)) return false;
    if (incidentFilter === "missing-parties" && incidentHasParties(incident)) return false;
    if (incidentFilter === "missing-documents" && incidentHasDocuments(incident)) return false;
    if (incidentFilter === "ready-review" && !isIncidentReadyForReview(incident)) return false;
    if (incidentFilter === "recent") {
      const incidentTime = parseCalendarDate(incident?.eventDate);
      const incidentTimes = allIncidents.map((item) => parseCalendarDate(item?.eventDate)).filter((time) => time !== null);
      const latestIncidentTime = incidentTimes.length > 0 ? Math.max(...incidentTimes) : null;
      if (incidentTime === null || latestIncidentTime === null || incidentTime < latestIncidentTime - 1000 * 60 * 60 * 24 * 30) return false;
    }
    return incidentMatchesSearch(incident);
  });
  const getIncidentEvidenceCount = (incident) => {
    const directEvidenceIds = Array.isArray(incident?.linkedEvidenceIds) ? incident.linkedEvidenceIds : [];
    const reverseEvidenceIds = allEvidence.filter((evidence) =>
      Array.isArray(evidence?.linkedIncidentIds) && evidence.linkedIncidentIds.includes(incident.id)
    ).map((evidence) => evidence.id).filter(Boolean);
    return new Set([...directEvidenceIds, ...reverseEvidenceIds]).size;
  };
  const getIncidentAttentionScore = (incident) => (
    (incidentHasEvidence(incident) ? 0 : 1) +
    (incidentHasParties(incident) ? 0 : 1) +
    (incidentHasDocuments(incident) ? 0 : 1)
  );
  const sortedFilteredIncidents = [...filteredIncidents].sort((a, b) => {
    if (incidentSort === "newest-first") {
      return compareRecordsNewestFirst(a, b);
    }
    if (incidentSort === "oldest-first") {
      return compareRecordsOldestFirst(a, b);
    }
    if (incidentSort === "most-evidence") {
      return getIncidentEvidenceCount(b) - getIncidentEvidenceCount(a);
    }
    if (incidentSort === "least-evidence") {
      return getIncidentEvidenceCount(a) - getIncidentEvidenceCount(b);
    }
    if (incidentSort === "ready-review") {
      return Number(isIncidentReadyForReview(b)) - Number(isIncidentReadyForReview(a));
    }
    if (incidentSort === "needs-attention") {
      return getIncidentAttentionScore(b) - getIncidentAttentionScore(a);
    }
    return compareRecordsNewestFirst(a, b);
  });
  const activeQuickIncidentFilter = incidentSequenceGroupFilter === "__ungrouped__" ? "ungrouped" : incidentFilter;
  const incidentQuickFilterChips = [
    { id: "all", label: "All" },
    { id: "needs-attention", label: "Needs Attention" },
    { id: "missing-evidence", label: "No Evidence" },
    { id: "missing-parties", label: "No Parties" },
    { id: "missing-documents", label: "No Documents" },
    { id: "ungrouped", label: "Ungrouped" },
    { id: "ready-review", label: "Ready for Review" },
    { id: "recent", label: "Recent" },
  ];
  const applyIncidentQuickFilter = (filterId) => {
    if (filterId === "all") {
      setIncidentFilter("all");
      setIncidentSequenceGroupFilter("all");
      return;
    }
    if (filterId === "ungrouped") {
      setIncidentSequenceGroupFilter("__ungrouped__");
      setIncidentFilter("all");
      return;
    }
    setIncidentFilter(filterId);
  };

  const timelineItems = [
    ...toTimelineItems(selectedCase?.incidents, "incident"),
    ...toTimelineItems(selectedCase?.evidence, "evidence"),
    ...toTimelineItems(selectedCase?.documents, "document"),
    ...toTimelineItems(selectedCase?.ledger, "ledger"),
    ...toTimelineItems(selectedCase?.strategy, "strategy"),
  ].sort((a, b) => {
    if (!a.date && b.date) return 1;
    if (a.date && !b.date) return -1;
    if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  const overviewSummaryItems = [
    { label: "Parties", tabId: "parties", count: (selectedCase?.parties || []).length },
    { label: "Incidents", tabId: "incidents", count: (selectedCase?.incidents || []).length },
    { label: "Evidence", tabId: "evidence", count: (selectedCase?.evidence || []).length },
    { label: "Documents", tabId: "documents", count: (selectedCase?.documents || []).length },
    { label: "Records", tabId: "records", count: (selectedCase?.records || []).length },
    { label: "Timeline", tabId: "timeline", count: timelineItems.length },
  ];
  const incidentIdsWithEvidence = new Set([
    ...(selectedCase?.incidents || []).flatMap((incident) =>
      (incident?.linkedEvidenceIds || []).length > 0 ? [incident.id] : []
    ),
    ...(selectedCase?.evidence || []).flatMap((evidence) => evidence?.linkedIncidentIds || []),
  ]);
  const incidentsWithoutEvidenceCount = (selectedCase?.incidents || [])
    .filter((incident) => !incidentIdsWithEvidence.has(incident.id)).length;
  const unlinkedEvidenceCount = (selectedCase?.evidence || [])
    .filter((evidence) => (evidence?.linkedIncidentIds || []).length === 0).length;
  const documentsWithoutPartiesCount = (selectedCase?.documents || [])
    .filter((document) => (document?.linkedPartyIds || []).length === 0).length;
  const timelineItemsMissingDateCount = timelineItems
    .filter((item) => !safeText(item.date).trim()).length;
  const overviewAttentionIssues = [
    {
      key: "incidents-missing-evidence",
      tabId: "incidents",
      count: incidentsWithoutEvidenceCount,
      message: (count) => `${count} incident(s) have no supporting evidence.`,
    },
    {
      key: "evidence-missing-incident",
      tabId: "evidence",
      count: unlinkedEvidenceCount,
      message: (count) => `${count} evidence item(s) are not linked to an incident.`,
    },
    {
      key: "documents-missing-party",
      tabId: "documents",
      count: documentsWithoutPartiesCount,
      message: (count) => `${count} document(s) have no linked party.`,
    },
    {
      key: "timeline-missing-date",
      tabId: "timeline",
      count: timelineItemsMissingDateCount,
      message: (count) => `${count} timeline item(s) are missing a date.`,
    },
  ].filter((issue) => issue.count > 0);
  const overviewRecommendedAction = (() => {
    if ((selectedCase?.parties || []).length === 0) {
      return {
        message: "Add your first Party.",
        tabId: "parties",
        buttonLabel: "Open Parties tab",
      };
    }
    if ((selectedCase?.incidents || []).length === 0) {
      return {
        message: "Add your first Incident.",
        tabId: "incidents",
        buttonLabel: "Open Incidents tab",
      };
    }
    if (incidentsWithoutEvidenceCount > 0) {
      return {
        message: "Add supporting evidence to your investigation.",
        tabId: "incidents",
        buttonLabel: "Open Incidents tab",
      };
    }
    if (documentsWithoutPartiesCount > 0) {
      return {
        message: "Link Parties to your Documents.",
        tabId: "documents",
        buttonLabel: "Open Documents tab",
      };
    }
    if (timelineItemsMissingDateCount > 0) {
      return {
        message: "Review missing timeline dates.",
        tabId: "timeline",
        buttonLabel: "Open Timeline tab",
      };
    }
    return {
      message: "Your investigation is ready for reporting.",
      tabId: "generate-report",
      buttonLabel: "Open Reports tab",
    };
  })();
  const narrativeSections = useMemo(
    () => (selectedCase ? buildNarrativeSections(selectedCase) : []),
    [selectedCase]
  );
  const reportComposer = useMemo(() => {
    const scoredSections = narrativeSections
      .map((section, index) => {
        let score = 0;
        if (safeText(section?.incident?.description).trim()) score += 2;
        if ((section?.supportingEvidence || []).length >= 2) score += 2;
        if ((section?.supportingRecords || []).length >= 1) score += 2;
        if ((section?.establishes || []).length >= 1) score += 2;
        if ((section?.establishes || []).length >= 2) score += 1;

        return { ...section, score, originalIndex: index };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
        if (dateCompare !== 0) return dateCompare;
        return a.originalIndex - b.originalIndex;
      });

    const keyChainCount = scoredSections.length >= 7 ? 5 : scoredSections.length >= 5 ? 4 : Math.min(3, scoredSections.length);
    const keyChains = scoredSections.slice(0, keyChainCount);
    const supportingContext = scoredSections.slice(keyChainCount);

    const seenStatements = new Set();
    const corePosition = [];
    for (const section of keyChains) {
      for (const statement of section.establishes || []) {
        const normalized = safeText(statement).trim();
        const key = normalized.toLowerCase();
        if (!normalized || seenStatements.has(key)) continue;
        seenStatements.add(key);
        corePosition.push(normalized);
        if (corePosition.length >= 5) break;
      }
      if (corePosition.length >= 5) break;
    }

    return {
      keyChains,
      supportingContext,
      corePosition,
    };
  }, [narrativeSections]);
  const reportGapItems = useMemo(() => {
    const items = [...displayedWeakPoints.map((item) => item.text)];
    if (narrativeSections.length === 0) {
      items.push("No incident-based narrative chains are available yet.");
    }
    if (reportComposer.corePosition.length === 0) {
      items.push("Core Position is thin because the strongest sections do not yet establish clear support statements.");
    }
    if (reportComposer.keyChains.some((section) => (section.supportingEvidence || []).length === 0)) {
      items.push("Some key chains still have no linked evidence.");
    }
    if (reportComposer.keyChains.some((section) => (section.supportingRecords || []).length === 0)) {
      items.push("Some key chains do not yet include supporting records or documents.");
    }

    return items.filter((item, index) => items.indexOf(item) === index).slice(0, 5);
  }, [displayedWeakPoints, narrativeSections.length, reportComposer]);
  const normalizeClientIdeaKey = (value) =>
    safeText(value)
      .toLowerCase()
      .replace(/this (shows|confirms|indicates|suggests) that\s+/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const toClientMeaning = (value) => {
    const text = safeText(value).trim();
    if (!text) return "";

    const cleaned = text
      .replace(/\b(see document|digitise ?\/ ?upload|follow-up task created)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const replacements = [
      {
        pattern: /provides objective timestamps?/i,
        replacement: "This shows the timing can be checked clearly.",
      },
      {
        pattern: /establishes formal medical confirmation/i,
        replacement: "This confirms the medical condition was formally identified.",
      },
      {
        pattern: /^helps prove\s+/i,
        replacement: "This shows ",
      },
      {
        pattern: /^helps confirm\s+/i,
        replacement: "This confirms ",
      },
      {
        pattern: /^helps support\s+/i,
        replacement: "This shows ",
      },
      {
        pattern: /^this supports\s+/i,
        replacement: "This shows ",
      },
      {
        pattern: /^this indicates\s+/i,
        replacement: "This suggests ",
      },
    ];

    for (const rule of replacements) {
      if (!rule.pattern.test(cleaned)) continue;
      const rewritten = rule.pattern.source.startsWith("^")
        ? cleaned.replace(rule.pattern, rule.replacement)
        : rule.replacement;
      const normalized = rewritten
        .replace(/\b(document|documents|message|messages|photo|photos|letter|letters|evidence|record|records)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\s([.,!?;:])/g, "$1");
      return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
    }

    if (/^(this|it)\s+(shows|confirms|suggests)\b/i.test(cleaned)) {
      return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
    }

    return "";
  };
  const toClientConclusion = (value) => {
    const text = safeText(value).trim();
    if (!text) return "";

    const explicitRewrites = [
      {
        pattern: /provides objective timestamps?/i,
        replacement: "This shows the timing can be checked objectively.",
      },
      {
        pattern: /establishes formal medical confirmation/i,
        replacement: "This confirms the medical condition was formally identified.",
      },
      {
        pattern: /^helps prove\s+/i,
        replacement: "This shows ",
      },
      {
        pattern: /^helps confirm\s+/i,
        replacement: "This confirms ",
      },
      {
        pattern: /^helps support\s+/i,
        replacement: "This supports ",
      },
    ];

    for (const rule of explicitRewrites) {
      if (!rule.pattern.test(text)) continue;
      if (rule.replacement.endsWith(".")) return rule.replacement;
      const rewritten = text.replace(rule.pattern, rule.replacement);
      return /[.!?]$/.test(rewritten) ? rewritten : `${rewritten}.`;
    }

    if (/^(this|it)\s+(shows|confirms|indicates|suggests)\b/i.test(text)) {
      return /[.!?]$/.test(text) ? text : `${text}.`;
    }

    return text;
  };
  const deriveClientTrack = (section) => {
    const combinedText = [
      safeText(section?.incident?.title),
      safeText(section?.incident?.description),
      safeText(section?.incident?.notes),
      ...(section?.establishes || []),
      ...(section?.supportingEvidence || []).flatMap((item) => [
        safeText(item?.title),
        safeText(item?.functionSummary),
        safeText(item?.sequenceGroup),
        safeText(item?.evidenceRole),
      ]),
      ...(section?.supportingRecords || []).flatMap((item) => [
        safeText(item?.title),
        safeText(item?.summary),
        safeText(item?.recordType),
      ]),
    ]
      .join(" ")
      .toLowerCase();

    const trackRules = [
      {
        id: "workload",
        label: "Workload and overtime",
        patterns: [/overtime|workload|shift|duty|rota|roster|schedule|hours|staffing|long hours/gi],
      },
      {
        id: "fatigue",
        label: "Fatigue and rest",
        patterns: [/fatigue|rest break|rest period|sleep|exhaust|tired|turnaround|insufficient rest/gi],
      },
      {
        id: "medical",
        label: "Medical impact",
        patterns: [/medical|doctor|gp\b|clinic|hospital|diagnos|symptom|injur|treatment|condition|sick note/gi],
      },
      {
        id: "housing",
        label: "Housing defects",
        patterns: [/housing|landlord|tenant|repair|leak|heating|boiler|damp|disrepair|property|flat|apartment/gi],
      },
      {
        id: "safety",
        label: "Safety and mould",
        patterns: [/safety|unsafe|hazard|mould|mold|danger|risk|exposure|ventilation|fire|carbon monoxide/gi],
      },
      {
        id: "payment",
        label: "Payment and financial issues",
        patterns: [/payment|paid|wage|wages|salary|unpaid|invoice|receipt|cost|deposit|refund|bill|arrears|bank/gi],
      },
      {
        id: "communication",
        label: "Communication and management",
        patterns: [/manager|management|supervisor|email|whatsapp|message|text|call|communication|complaint|notice|reported|instruction/gi],
      },
    ];

    let bestTrack = { id: "other", label: "Other important issue", score: 0 };

    for (const track of trackRules) {
      let score = 0;
      for (const pattern of track.patterns) {
        const matches = combinedText.match(pattern);
        if (matches) score += matches.length;
      }
      if (score > bestTrack.score) {
        bestTrack = { id: track.id, label: track.label, score };
      }
    }

    return bestTrack;
  };
  const clientRankedSections = useMemo(
    () =>
      reportComposer.keyChains.map((section) => ({
        ...section,
        clientTrack: deriveClientTrack(section),
      })),
    [reportComposer.keyChains]
  );
  const clientSelectedChains = useMemo(() => {
    const selections = [];
    const seenTracks = new Set();
    const remaining = [];

    for (const section of clientRankedSections) {
      const trackId = section.clientTrack?.score > 0 ? section.clientTrack.id : "";
      if (trackId && !seenTracks.has(trackId) && selections.length < 3) {
        selections.push(section);
        seenTracks.add(trackId);
      } else {
        remaining.push(section);
      }
    }

    for (const section of remaining) {
      if (selections.length >= 3) break;
      selections.push(section);
    }

    return selections;
  }, [clientRankedSections]);
  const clientConcernTracks = useMemo(() => {
    const seen = new Set();
    const tracks = [];

    for (const section of clientSelectedChains) {
      const track = section.clientTrack;
      if (!track?.label || track.score <= 0 || seen.has(track.id)) continue;
      seen.add(track.id);
      tracks.push(track.label);
      if (tracks.length >= 5) break;
    }

    return tracks;
  }, [clientSelectedChains]);
  const clientGlobalConclusions = useMemo(() => {
    const seen = new Set();
    const results = [];

    for (const section of clientSelectedChains) {
      for (const statement of section.establishes || []) {
        const conclusion = toClientMeaning(statement) || toClientConclusion(statement);
        const key = normalizeClientIdeaKey(conclusion);
        if (!conclusion || !key || seen.has(key)) continue;
        seen.add(key);
        results.push(conclusion);
        if (results.length >= 5) break;
      }
      if (results.length >= 5) break;
    }

    return results;
  }, [clientSelectedChains]);
  const clientChainSections = useMemo(() => {
    const globalKeys = new Set(clientGlobalConclusions.map(normalizeClientIdeaKey));

    return clientSelectedChains.map((section) => {
      const seenLocal = new Set();
      const chainConclusions = [];
      for (const statement of section.establishes || []) {
        const conclusion = toClientMeaning(statement) || toClientConclusion(statement);
        const key = normalizeClientIdeaKey(conclusion);
        if (!conclusion || !key || globalKeys.has(key) || seenLocal.has(key)) continue;
        seenLocal.add(key);
        chainConclusions.push(conclusion);
        if (chainConclusions.length >= 3) break;
      }

      const keyProof = [];
      const seenProof = new Set();
      for (const item of section.supportingEvidence || []) {
        const proofText = toClientMeaning(item.functionSummary || "") || "";
        const proofKey = normalizeClientIdeaKey(proofText || item.title || "");
        if (!proofText || !proofKey || seenProof.has(proofKey)) continue;
        seenProof.add(proofKey);
        keyProof.push({
          id: item.id,
          title: item.title || "Untitled evidence",
          summary: proofText,
        });
        if (keyProof.length >= 3) break;
      }

      const whatHappened = (safeText(section.incident.description).trim() || safeText(section.incident.notes).trim())
        .replace(/\s+/g, " ")
        .trim();

      return {
        ...section,
        trackLabel: section.clientTrack?.score > 0 ? section.clientTrack.label : "Other important issue",
        shortWhatHappened: whatHappened,
        keyProof: keyProof.slice(0, keyProof.length >= 3 ? 3 : 2),
        chainConclusions: chainConclusions.slice(0, 3),
      };
    });
  }, [clientGlobalConclusions, clientSelectedChains]);
  const clientSummary = useMemo(() => {
    const cleanSentence = (value) =>
      safeText(value)
        .replace(/\b(link|evidence|record|chain|blocker|proof point|core position)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\s([.,!?;:])/g, "$1");

    const ensureSentence = (value) => {
      const text = cleanSentence(value);
      if (!text) return "";
      return /[.!?]$/.test(text) ? text : `${text}.`;
    };

    const mainProblem = ensureSentence(selectedCase?.caseState?.mainProblem);
    const fallbackDescription = ensureSentence(selectedCase?.description);
    const keyChainLead = clientChainSections
      .map((section) => {
        const title = safeText(section?.incident?.title).trim();
        const description = cleanSentence(section?.incident?.description);
        if (description) return description;
        if (title) return `${title} is one of the main parts of the issue`;
        return "";
      })
      .find(Boolean);
    const keyChainSentence = keyChainLead ? ensureSentence(keyChainLead) : "";

    const positionLead = clientGlobalConclusions
      .map((statement) => cleanSentence(statement))
      .find(Boolean);
    const positionSentence = positionLead ? ensureSentence(positionLead) : "";

    const summaryParts = [mainProblem, keyChainSentence, positionSentence]
      .filter(Boolean)
      .filter((part, index, array) =>
        array.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index
      )
      .slice(0, 3);

    if (summaryParts.length > 0) {
      return summaryParts.join(" ");
    }

    return (
      ensureSentence(selectedCase?.caseState?.mainProblem) ||
      fallbackDescription ||
      "There is not yet enough clear information to explain the situation properly."
    );
  }, [clientChainSections, clientGlobalConclusions, selectedCase]);
  const clientNextSteps = useMemo(() => {
    const actions = [];
    const hasMissingEvidenceGap = reportGapItems.some((item) => /no linked evidence|evidence support is incomplete|weaker proof|proof points/i.test(item));
    const hasMissingRecordsGap = reportGapItems.some((item) => /supporting records|records or documents|documents? are incomplete/i.test(item));
    const hasThinPositionGap = reportGapItems.some((item) => /core position is thin|no incident-based narrative chains/i.test(item));
    const caseText = [
      safeText(selectedCase?.category),
      ...clientSelectedChains.map((section) => `${safeText(section?.incident?.title)} ${safeText(section?.incident?.description)}`),
    ].join(" ").toLowerCase();
    const isHousingCase = /housing|landlord|rent|mould|mold|repair|leak|heating|temperature/.test(caseText);
    const isWorkCase = /work|shift|duty|rota|roster|manager|overtime|rest|hr|employer/.test(caseText);

    if (hasMissingEvidenceGap) {
      actions.push(
        isHousingCase
          ? "Keep copies of every letter, message, photo, and notice about the problem, especially anything showing when you reported it."
          : isWorkCase
            ? "Keep copies of the key messages, duty details, and written instructions that show what happened."
            : "Keep the clearest messages, photos, and documents that show what happened and when."
      );
    }

    if (hasMissingRecordsGap) {
      actions.push(
        isHousingCase
          ? "Ask for written copies of inspection notes, repair updates, appointments, or any response about the problem."
          : isWorkCase
            ? "Ask for written copies of rota changes, shift instructions, or other documents confirming the working arrangements."
            : "Ask for written copies of the documents that confirm the main dates, decisions, or events."
      );
    }

    if (hasThinPositionGap) {
      actions.push("Write a short timeline of the main events so the case can be explained clearly from start to finish.");
    }

    if (clientSelectedChains.length > 0) {
      const firstChain = clientSelectedChains[0];
      const chainTitle = safeText(firstChain?.incident?.title).trim();
      if (chainTitle) {
        actions.push(
          isHousingCase
            ? `Follow up in writing about "${chainTitle}" and keep a copy of what you send and any reply you receive.`
            : isWorkCase
              ? `Ask for any instructions about "${chainTitle}" in writing and keep copies of the reply.`
              : `Write a short, clear note explaining why "${chainTitle}" matters and keep it with the main documents and messages.`
        );
      }
    }

    if (clientSelectedChains.some((section) => (section.establishes || []).length > 0)) {
      actions.push(
        isHousingCase
          ? "Keep a dated log of the problem, including changes in condition, missed repairs, and copies of each notice you send."
          : isWorkCase
            ? "Keep a dated log of shifts, rest periods, instructions, and any concerns you raise."
            : "Keep the most important dates, messages, and documents together so they are ready to share if needed."
      );
    }

    if (actions.length < 3) {
      actions.push("Make sure the main dates, messages, and documents are easy to find and ready to share.");
      actions.push("Focus first on the parts of the case that have the clearest proof and the biggest practical impact.");
    }

    return actions
      .filter((item, index) => actions.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
      .slice(0, 5);
  }, [clientSelectedChains, reportGapItems, selectedCase?.category]);
  const clientMetricItems = (() => {
    const items = [];
    const keyIncidentCount = clientSelectedChains.length;
    const keyEvidenceCount = clientSelectedChains.reduce(
      (total, section) => total + (section.supportingEvidence || []).length,
      0
    );
    const datedKeyChains = clientSelectedChains
      .map((section) => safeText(section.date).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (keyIncidentCount > 0) {
      items.push({
        label: keyIncidentCount === 1 ? "Key incident" : "Key incidents",
        value: String(keyIncidentCount),
      });
    }

    if (keyEvidenceCount > 0) {
      items.push({
        label: "Key supporting documents",
        value: String(keyEvidenceCount),
      });
    }

    if (datedKeyChains.length >= 2) {
      items.push({
        label: "Issue duration",
        value: `${datedKeyChains[0]} to ${datedKeyChains[datedKeyChains.length - 1]}`,
      });
    }

    const hasTrackedPayments = derivedTrackingLedger.length > 0 && (totalOutgoing > 0 || totalIncoming > 0);
    if (hasTrackedPayments && (selectedCase?.category || "").toLowerCase().includes("housing")) {
      if (totalOutgoing > 0) {
        items.push({ label: "Tracked outgoing value", value: `€${totalOutgoing.toFixed(2)}` });
      }
      if (totalIncoming > 0) {
        items.push({ label: "Tracked incoming value", value: `€${totalIncoming.toFixed(2)}` });
      }
    }

    return items.slice(0, 4);
  })();
  const parsedGeneratedReport = useMemo(
    () => parseProveItReportV1(renderedReportText),
    [renderedReportText]
  );
  const generatedReportLooksLikePrompt = useMemo(() => {
    const text = safeText(generatedReportDraft).trim();
    if (!text) return false;

    return (
      /^create a client-facing report/i.test(text) ||
      /\bRules:\b/i.test(text) ||
      /ProveIt Report Format v1:/i.test(text)
    );
  }, [generatedReportDraft]);
  const generatedReportValidation = useMemo(() => validateClientReportNarrative(generatedReportDraft, { sourceRevision: clientNarrativeMeta.sourceRevision, currentSourceRevision: reportCentreModel?.sourceRevision?.fingerprint }), [clientNarrativeMeta.sourceRevision, generatedReportDraft, reportCentreModel?.sourceRevision?.fingerprint]);
  const generatedReportHasVisibleContent = useMemo(() => {
    return Boolean(
      parsedGeneratedReport.reportTitle ||
      parsedGeneratedReport.atAGlance?.length > 0 ||
      parsedGeneratedReport.yourSituation ||
      parsedGeneratedReport.mainAreasOfConcern.length > 0 ||
      parsedGeneratedReport.whatThisReportShows.length > 0 ||
      parsedGeneratedReport.milestoneTimeline?.length > 0 ||
      parsedGeneratedReport.issues.length > 0 ||
      parsedGeneratedReport.keyFacts.length > 0 ||
      parsedGeneratedReport.currentPosition ||
      parsedGeneratedReport.recommendedNextSteps.length > 0
    );
  }, [parsedGeneratedReport]);
  const generatedReportMilestoneTimeline = useMemo(() => {
    const incidentMilestones = (selectedCase?.incidents || [])
      .filter((incident) => !!incident?.isMilestone)
      .map((incident, index) => ({
        id: incident.id,
        recordType: "incident",
        date: incident.eventDate || incident.date || "",
        title: incident.title || "",
        summary: safeText(incident.description || incident.summary).trim(),
        originalIndex: index,
      }));
    const evidenceMilestones = (selectedCase?.evidence || [])
      .filter((evidence) => !!evidence?.isMilestone)
      .map((evidence, index) => ({
        id: evidence.id,
        recordType: "evidence",
        date: evidence.eventDate || evidence.date || evidence.capturedAt || "",
        title: evidence.title || "",
        summary: safeText(evidence.functionSummary || evidence.description || evidence.reviewNotes).trim(),
        originalIndex: index,
      }));

    return [...incidentMilestones, ...evidenceMilestones]
      .sort((a, b) => {
        const dateCompare = String(a?.date || "").localeCompare(String(b?.date || ""));
        if (dateCompare !== 0) return dateCompare;
        if (a.recordType !== b.recordType) return a.recordType === "incident" ? -1 : 1;
        return a.originalIndex - b.originalIndex;
      })
      .map((item) => ({
        id: item.id,
        recordType: item.recordType,
        date: item.date,
        title: item.title,
        summary: item.summary,
      }));
  }, [selectedCase?.incidents, selectedCase?.evidence]);
  const generatedReportOrderedIssues = useMemo(() => {
    const normalizeIssueKey = (value) =>
      safeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const incidentMilestones = generatedReportMilestoneTimeline.filter(
      (item) => item.recordType === "incident"
    );

    const matchResults = [];
    const orderedIssues = [...clientChainSections]
      .map((section, originalIndex) => {
        const sectionTitle = safeText(section?.incident?.title).trim();
        const normalizedSectionTitle = normalizeIssueKey(sectionTitle);
        const sectionDate = safeText(section?.date).trim();

        let matchedMilestone = incidentMilestones.find(
          (milestone) => safeText(milestone.title).trim() && safeText(milestone.title).trim() === sectionTitle
        );
        let matchType = matchedMilestone ? "exact_title" : "";

        if (!matchedMilestone && normalizedSectionTitle) {
          matchedMilestone = incidentMilestones.find(
            (milestone) => normalizeIssueKey(milestone.title) === normalizedSectionTitle
          );
          if (matchedMilestone) matchType = "normalized_title";
        }

        if (!matchedMilestone && sectionDate) {
          matchedMilestone = incidentMilestones.find(
            (milestone) => safeText(milestone.date).trim() === sectionDate
          );
          if (matchedMilestone) matchType = "same_date";
        }

        matchResults.push({
          title: sectionTitle || "Untitled issue",
          date: sectionDate || "",
          matchedMilestoneTitle: matchedMilestone?.title || "",
          matchedMilestoneDate: matchedMilestone?.date || "",
          matchType: matchType || "unmatched",
        });

        return {
          ...section,
          originalIndex,
          originalIssueTitle: sectionTitle,
          matchedMilestoneDate: safeText(matchedMilestone?.date).trim(),
          matchedMilestoneTitle: safeText(matchedMilestone?.title).trim(),
          hasMilestoneMatch: !!matchedMilestone,
        };
      })
      .sort((a, b) => {
        if (a.hasMilestoneMatch && b.hasMilestoneMatch) {
          const dateCompare = String(a.matchedMilestoneDate || "").localeCompare(String(b.matchedMilestoneDate || ""));
          if (dateCompare !== 0) return dateCompare;
          return a.originalIndex - b.originalIndex;
        }
        if (a.hasMilestoneMatch) return -1;
        if (b.hasMilestoneMatch) return 1;
        return a.originalIndex - b.originalIndex;
      });
    const alignedIssues = orderedIssues.map((section) => {
      const originalTitle = safeText(section.originalIssueTitle).trim();
      const matchedMilestoneTitle = safeText(section.matchedMilestoneTitle).trim();
      const normalizedOriginal = normalizeIssueKey(originalTitle);
      const normalizedMilestone = normalizeIssueKey(matchedMilestoneTitle);
      const shouldAlignTitle =
        section.hasMilestoneMatch &&
        matchedMilestoneTitle &&
        normalizedMilestone &&
        normalizedMilestone !== normalizedOriginal;

      return {
        ...section,
        finalIssueTitle: shouldAlignTitle ? matchedMilestoneTitle : originalTitle,
        titleAlignmentApplied: shouldAlignTitle,
      };
    });

    return { orderedIssues: alignedIssues, matchResults };
  }, [clientChainSections, generatedReportMilestoneTimeline]);
  const generatedReportPromptPackage = useMemo(() => {
    const compactLine = (value, fallback = "None") => {
      const text = safeText(value).replace(/\s+/g, " ").trim();
      return text || fallback;
    };
    const formatBullets = (items, fallback = "- None") => {
      const normalizedItems = (items || [])
        .map((item) => safeText(item).replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (normalizedItems.length === 0) return fallback;
      return normalizedItems.map((item) => `- ${item}`).join("\n");
    };
    const issueInput = generatedReportOrderedIssues.orderedIssues
      .slice(0, 3)
      .map((section, index) => {
        const lines = [
          `ISSUE_${index + 1}_TITLE: ${compactLine(section?.finalIssueTitle || section?.incident?.title, "Untitled issue")}`,
          `ISSUE_${index + 1}_DATE: ${compactLine(section?.date, "No date")}`,
          `ISSUE_${index + 1}_WHAT_HAPPENED: ${compactLine(section?.shortWhatHappened)}`,
          `ISSUE_${index + 1}_KEY_PROOF: ${
            (section?.keyProof || [])
              .map((item) => compactLine(item?.summary || item?.title))
              .filter(Boolean)
              .join(" || ") || "None"
          }`,
          `ISSUE_${index + 1}_WHAT_THIS_MEANS: ${
            (section?.chainConclusions || []).map((item) => compactLine(item)).join(" || ") || "None"
          }`,
        ];
        return lines.join("\n");
      })
      .join("\n\n");
    const milestoneBlock =
      generatedReportMilestoneTimeline.length > 0
        ? generatedReportMilestoneTimeline
            .map((item) =>
              `- ${safeText(item.date).replace(/\s+/g, " ").trim()} | ${item.recordType === "evidence" ? "Evidence" : "Incident"} | ${compactLine(item.title)} | ${safeText(item.summary).replace(/\s+/g, " ").trim()}`
            )
            .join("\n")
        : "None";

    return `[REPORT PROVENANCE]
PROMPT_REVISION: ${CLIENT_REPORT_PROMPT_REVISION}
SOURCE_REVISION: ${reportCentreModel?.sourceRevision?.fingerprint || "unknown"}
Use human Issue labels such as ISS-003 — Heating Failure. Never use a bare internal UUID in prose.
Distinguish recorded facts from explanatory commentary. Cite readable record type and title for material factual statements.
Do not claim allegations are proven, provide legal conclusions, or invent missing facts. State uncertainty clearly.

[REPORT INSTRUCTIONS]
${PROVEIT_REPORT_PROMPT_V1}

[PROVEIT DATA NOTES]
CASE_REASONING_EXPORT is the AI-facing, non-importable reasoning snapshot. It contains incidents, evidence, documents, ledger, strategy, actionSummary, chronology, milestones, links, and resolvedLinks.
Incidents are timeline anchors. Evidence proves or supports incidents. Documents are source or working documents. Ledger entries are measurable financial, time, or compliance records. Strategy records are analysis and planning notes. actionSummary is the active operational summary.
functionSummary says what evidence proves. evidenceRole says how evidence functions in the case. evidenceStatus on incidents describes proof coverage or gaps. sequenceGroup can connect incidents, evidence, documents, and strategy into one issue or thread.
GPT delta import contract:
- gpt-delta-1.0 supports only operations.patch.actionSummary and operations.patch.strategy. It does not support create operations or incidents, evidence, documents, or ledger patches.
- gpt-delta-2.0 supports operations.create.incidents, operations.create.evidence, operations.create.documents, operations.create.ledger, and operations.patch.incidents, operations.patch.evidence, operations.patch.documents, operations.patch.ledger, operations.patch.strategy.
- gpt-delta-2.0 does not support operations.patch.actionSummary or operations.create.strategy. Use gpt-delta-1.0 for actionSummary patches and patch existing strategy records instead of creating strategy records.
- gpt-delta-3.0 supports structured operations.patch.strategy, controlled operations.create.watchItems and operations.patch.watchItems, and append-only operations.append.watchObservations. It does not create strategy, incident, evidence, document, or ledger records.
- In gpt-delta-3.0, array patch fields are complete replacements. Observation history can only be extended through operations.append.watchObservations; attachments, observations replacement, conversion, and deletion are prohibited.
- A To Watch item is a monitored or developing concern. It is not evidence and must not be described as a confirmed incident unless the user separately records and verifies it.
- sequenceGroup content fields may be patched through supported gpt-delta-2.0 record patches, but sequence group cleanup belongs to sequence-group-delta-1.0, not gpt-delta-2.0. Use sequence-group-delta-1.0 only to move records, rename groups, merge groups, or clear records.
- Never include attachments, binary payloads, files, dataUrl, backupDataUrl, delete operations, schema changes, or unsupported fields in GPT deltas.
- Patch ids must be existing baseline record ids. Create operations may include unique tempId values for cross-links, but must not invent final ids. Do not guess ids or produce broken links.
- Array fields are full replacements, not incremental append instructions.
- Enum rules: importance must be unreviewed | critical | strong | supporting | weak. Evidence relevance must be high | medium | low. Do not put high, medium, or low in importance.

[CASE REPORT INPUT]
CASE_TITLE: ${compactLine(selectedCase?.name, "Untitled case")}
CASE_CATEGORY: ${compactLine(selectedCase?.category)}
CASE_STATUS: ${compactLine(selectedCase?.status)}
CASE_OVERVIEW: ${compactLine(clientSummary || selectedCase?.caseState?.mainProblem || selectedCase?.description)}

MAIN_AREAS_OF_CONCERN:
${formatBullets(clientConcernTracks)}

WHAT_THIS_REPORT_SHOWS:
${formatBullets(clientGlobalConclusions)}

KEY_FACTS:
${formatBullets(
  clientMetricItems.map((item) => `${compactLine(item.label)}: ${compactLine(item.value)}`),
  "- None"
)}

AT_A_GLANCE_NOTE: Summarize the case in 3-4 quick bullets for an immediate overview.
CURRENT_POSITION_NOTE: Summarize the current state of the case in 2-3 clear factual sentences.
SECTION_FOCUS_NOTE: Keep each report section distinct. Avoid repeating the same timeline, proof, or conclusion across multiple sections.
ISSUE_WHAT_HAPPENED_NOTE: Describe the issue directly and briefly. Focus on the problem, not a full timeline.
KEY_PROOF_NOTE: Name each proof item clearly by type where supported, such as Document, Photo, Log, Email, Message, Record, Receipt, or Screenshot. Keep each point factual and concise.
WHAT_THIS_MEANS_NOTE: Explain only impact and significance. Do not repeat proof names, dates, or timeline details from KEY_PROOF or MILESTONE_TIMELINE.
ANTI_DUPLICATION_NOTE: If the same fact would appear in more than one section, keep it only in the section where it is most useful.
RECOMMENDED_NEXT_STEPS_NOTE: Focus on clear, practical actions the client can take now. Keep steps concrete, document-focused, and directly tied to the case facts.

RECOMMENDED_NEXT_STEPS_CONTEXT:
${formatBullets(clientNextSteps)}

ISSUE_ORDER_NOTE: The issues below are already arranged in the most useful reading order based on the case timeline and milestone events. Keep this order unless the provided facts clearly require otherwise.
ISSUE_TITLE_ALIGNMENT_NOTE: Where an issue corresponds to a milestone event, the issue title may be aligned to the milestone wording for consistency and readability.
MILESTONE_NOTE: Milestone entries can be incidents or evidence; use the record type in the milestone line when it prevents ambiguity.

KEY_ISSUES:
${issueInput || "None"}

[MILESTONE_TIMELINE_DATA]
${milestoneBlock}`;
  }, [
    clientConcernTracks,
    clientGlobalConclusions,
    clientMetricItems,
    clientNextSteps,
    clientSummary,
    generatedReportOrderedIssues,
    generatedReportMilestoneTimeline,
    selectedCase?.category,
    selectedCase?.description,
    selectedCase?.name,
    selectedCase?.status,
    selectedCase?.caseState?.mainProblem,
    reportCentreModel?.sourceRevision?.fingerprint,
  ]);
  const reportCentreMarkdown = useMemo(() => {
    if (reportCentreType === "executive" && savedExecutiveDraft?.revision?.content?.markdown) return savedExecutiveDraft.revision.content.markdown;
    const document = reportCentreActiveDocument;
    if (document) return buildReportOutput(document, "markdown").content;
    if (reportCentreType !== "action" || !reportCentreActionPlan) return "";
    const listLines = (items = [], getText = (item) => item) =>
      items.length > 0 ? items.map((item) => `- ${getText(item)}`).join("\n") : "- None";
    return `# ${reportCentreActionPlan.title}

Case: ${reportCentreActionPlan.caseOverview.name || reportCentreActionPlan.sourceCaseId || "Untitled Case"}
Scope: ${reportCentreActionPlan.scopeLabel}
Generated: ${reportCentreActionPlan.generatedAt}

Local-first note: This report is generated from the local ProveIt case file. Review before sharing.

## Current Focus
${reportCentreActionPlan.currentFocus || "No current focus recorded."}

## Next Actions
${listLines(reportCentreActionPlan.nextActions)}

## Critical Deadlines
${listLines(reportCentreActionPlan.criticalDeadlines)}

## Risks
${listLines(reportCentreActionPlan.risks, (item) => `${item.label}: ${item.text}`)}

## Recommended Fixes
${listLines(reportCentreActionPlan.recommendedFixes)}`;
  }, [reportCentreActionPlan, reportCentreActiveDocument, reportCentreType, savedExecutiveDraft]);

  if (!selectedCase) return renderCaseList();

  const germanReportLanguageInstruction = `[LANGUAGE INSTRUCTION]
Generate the report in German.

Rules:
- Keep ALL section headings exactly as defined in ProveIt Report Format v1.
- Do NOT translate headings.
- Translate report body content into clear, formal German.
- Keep bullet formatting identical.
- Keep dates, names, amounts, case references, and document titles unchanged.
- Do not add legal advice.
- Do not add facts.
- Do not summarize or restructure the report.`;

  const copyGeneratedReportPrompt = async (language = "en") => {
    const lang = normalizeReportLanguage(language);
    await handleGeneratedReportLanguageChange(lang);
    const promptToCopy = lang === "de"
      ? `${germanReportLanguageInstruction}\n\n${generatedReportPromptPackage}`
      : generatedReportPromptPackage;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = promptToCopy;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setClientNarrativeMeta({ sourceRevision: reportCentreModel?.sourceRevision?.fingerprint || "", promptRevision: CLIENT_REPORT_PROMPT_REVISION, generatedAt: "", reviewed: false, approved: false });
      setReportPromptFeedback("Prompt copied.");
    } catch (error) {
      console.error("Failed to copy report prompt", error);
      setReportPromptFeedback("Copy failed.");
    }
  };

  const formatCaseStructureReport = (caseItem) => {
    const diagnostics = analyzeCaseDiagnostics(caseItem);
    const formatNode = (node) => `- ${node.title || node.id || "Untitled record"} [${node.type || "record"}]`;
    const formatNodeList = (nodes) => nodes.length > 0 ? nodes.map(formatNode).join("\n") : "- None";
    const nodeCounts = diagnostics.overview.nodeCountsByType || {};
    const averageLinks = diagnostics.integrity.linkDensity.averageLinksPerRecord.toFixed(2);
    const payload = { missingLinks: diagnostics.integrity.brokenLinks };
    const totalRecords = diagnostics.overview.totalRecords;
    const totalLinks = diagnostics.overview.totalLinks;
    const documentCount = diagnostics.overview.documentCount;
    const unlinkedRecords = diagnostics.integrity.orphanRecords;
    const weakRecords = diagnostics.integrity.weaklyLinkedRecords;
    const highlyConnectedRecords = diagnostics.integrity.highlyConnectedRecords;
    const incidentEvidenceCounts = new Map(Object.entries(diagnostics.evidenceCoverage.incidentEvidenceCounts));
    const incidentsNeedingEvidence = diagnostics.evidenceCoverage.incidentsNeedingEvidence;
    const witnessedContextualIncidents = diagnostics.evidenceCoverage.witnessedContextualIncidents;
    const unverifiedIncidents = diagnostics.evidenceCoverage.unverifiedIncidents;
    const incidentsWithEvidence = diagnostics.evidenceCoverage.incidentsWithEvidence;
    const unusedEvidence = diagnostics.evidenceCoverage.unusedEvidence;
    const formatTitleList = (nodes) =>
      nodes.length > 0 ? nodes.map((node) => `- ${node.title || node.id || "Untitled record"}`).join("\n") : "- None";
    const formatIncidentEvidenceCountList = (nodes) =>
      nodes.length > 0
        ? nodes.map((node) => `- ${node.title || node.id || "Untitled record"} — ${incidentEvidenceCounts.get(node.id) || 0}`).join("\n")
        : "- None";
    const evidenceById = new Map((caseItem?.evidence || []).map((evidence) => [evidence.id, evidence]));
    const trackingRecordProvenance = (caseItem?.documents || [])
      .filter((doc) => isTrackingRecord(doc) && Array.isArray(doc.basedOnEvidenceIds) && doc.basedOnEvidenceIds.length > 0)
      .map((doc) => ({
        doc,
        evidence: doc.basedOnEvidenceIds
          .map((evidenceId) => evidenceById.get(evidenceId))
          .filter(Boolean),
      }))
      .filter((entry) => entry.evidence.length > 0);
    const trackingRecordProvenanceText = trackingRecordProvenance.length > 0
      ? trackingRecordProvenance.map(({ doc, evidence }) =>
          `- ${doc.title || doc.id || "Untitled tracking record"}\n${evidence.map((item) => `  - ${item.title || item.id || "Untitled evidence"}`).join("\n")}`
        ).join("\n")
      : "- No tracking record provenance recorded.";
    const trackingRecordsByEvidence = new Map();
    trackingRecordProvenance.forEach(({ doc, evidence }) => {
      evidence.forEach((item) => {
        if (!trackingRecordsByEvidence.has(item.id)) {
          trackingRecordsByEvidence.set(item.id, { evidence: item, records: [] });
        }
        trackingRecordsByEvidence.get(item.id).records.push(doc);
      });
    });
    const evidenceUsedByTrackingRecordsText = trackingRecordsByEvidence.size > 0
      ? [...trackingRecordsByEvidence.values()].map(({ evidence, records }) =>
          `- ${evidence.title || evidence.id || "Untitled evidence"}\n${records.map((doc) => `  - ${doc.title || doc.id || "Untitled tracking record"}`).join("\n")}`
        ).join("\n")
      : "- No tracking record provenance recorded.";
    const sequenceRecords = [
      ...(caseItem?.incidents || []).map((record) => ({ ...record, sequenceType: "incident" })),
      ...(caseItem?.evidence || []).map((record) => ({ ...record, sequenceType: "evidence" })),
      ...(caseItem?.documents || []).map((record) => ({ ...record, sequenceType: "document" })),
      ...(caseItem?.strategy || []).map((record) => ({ ...record, sequenceType: "strategy" })),
      ...(caseItem?.watchItems || []).map((record) => ({ ...record, sequenceType: "monitored concern" })),
    ];
    const getSequenceRecordTitle = (record) => record.title || record.label || record.id || "Untitled record";
    const getSequenceRecordDate = (record) =>
      record.eventDate || record.date || record.documentDate || record.dueDate || record.paymentDate || record.period || record.createdAt || "";
    const sortSequenceRecords = (a, b) => {
      const dateA = getSequenceRecordDate(a);
      const dateB = getSequenceRecordDate(b);
      if (dateA && dateB && dateA !== dateB) return dateA.localeCompare(dateB);
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return getSequenceRecordTitle(a).localeCompare(getSequenceRecordTitle(b));
    };
    const sequenceGroups = new Map();
    const ungroupedSequenceRecords = [];

    sequenceRecords.forEach((record) => {
      const groupName = safeText(record.sequenceGroup).trim();
      if (!groupName) {
        ungroupedSequenceRecords.push(record);
        return;
      }
      if (!sequenceGroups.has(groupName)) sequenceGroups.set(groupName, []);
      sequenceGroups.get(groupName).push(record);
    });

    const formatSequenceRecord = (record) => `  - ${getSequenceRecordTitle(record)} [${record.sequenceType}]`;
    const groupedSequenceText = [...sequenceGroups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupName, records]) => `- ${groupName}:\n${records.sort(sortSequenceRecords).map(formatSequenceRecord).join("\n")}`)
      .join("\n");
    const ungroupedSequenceText = ungroupedSequenceRecords.length > 0
      ? ungroupedSequenceRecords.sort(sortSequenceRecords).map((record) => `- ${getSequenceRecordTitle(record)} [${record.sequenceType}]`).join("\n")
      : "- None";

    return `# CASE_STRUCTURE_REPORT

## OVERVIEW
- Total Records: ${totalRecords}
- Total Links: ${totalLinks}
- Average Links per Record: ${averageLinks}
- Broken Links: ${payload.missingLinks.length}

## RECORD DISTRIBUTION
- Incidents: ${nodeCounts.incident || 0}
- Evidence: ${nodeCounts.evidence || 0}
- Documents: ${documentCount}
- Strategy: ${nodeCounts.strategy || 0}
- To Watch: ${(caseItem?.watchItems || []).length}

## LINK INTEGRITY

Unlinked Records (0 links):
${formatNodeList(unlinkedRecords)}

Weak Records (1 link):
${formatNodeList(weakRecords)}

Highly Connected Records (5+ links):
${formatNodeList(highlyConnectedRecords)}

## EVIDENCE COVERAGE

Incidents Needing Evidence:
${formatTitleList(incidentsNeedingEvidence)}

Witnessed / Contextual Incidents:
${formatTitleList(witnessedContextualIncidents)}

Unverified Incidents:
${formatTitleList(unverifiedIncidents)}

Incidents with Evidence Count:
${formatIncidentEvidenceCountList(incidentsWithEvidence)}

Unused Evidence (not linked to incidents):
${formatTitleList(unusedEvidence)}

## TRACKING RECORD PROVENANCE

Tracking Records Based on Evidence:
${trackingRecordProvenanceText}

Evidence Used by Tracking Records:
${evidenceUsedByTrackingRecordsText}

## SEQUENCE GROUPS

Grouped Records:
${groupedSequenceText || "- None"}

Ungrouped Records:
${ungroupedSequenceText}

## ACTION LIST
- Link unlinked records to relevant incidents or evidence
- Add evidence to incidents without proof
- Strengthen weak records by adding cause/outcome links
- Assign sequenceGroup to ungrouped records
- Review highly connected records for relevance/noise`;
  };

  const handleGenerateCaseStructureReport = () => {
    try {
      const report = formatCaseStructureReport(selectedCase);
      setCaseStructureReportText(report);
      setCaseStructureReportFeedback("Case structure report generated.");
    } catch (error) {
      console.error("Failed to generate case structure report", error);
      setCaseStructureReportFeedback("Could not generate case structure report.");
    }
  };

  const handleCopyCaseStructureReport = async () => {
    try {
      const report = caseStructureReportText || formatCaseStructureReport(selectedCase);
      if (!caseStructureReportText) setCaseStructureReportText(report);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = report;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCaseStructureReportFeedback("Case structure report copied.");
    } catch (error) {
      console.error("Failed to copy case structure report", error);
      setCaseStructureReportFeedback("Copy failed.");
    }
  };

  const handleRenderGeneratedReport = async () => {
    const lang = activeGeneratedReportLanguage;
    const nextText = safeText(generatedReportDraft);
    const validation = validateClientReportNarrative(nextText, { sourceRevision: clientNarrativeMeta.sourceRevision, currentSourceRevision: reportCentreModel?.sourceRevision?.fingerprint });
    if (!validation.valid) {
      setReportPromptFeedback(validation.errors[0]?.message || "The Client Report draft could not be validated.");
      return;
    }
    setRenderedReportText(nextText);
    setClientNarrativeMeta((current) => ({ ...current, generatedAt: new Date().toISOString(), promptRevision: current.promptRevision || CLIENT_REPORT_PROMPT_REVISION, reviewed: false, approved: false }));

    const existingVersions = {
      en: safeText(selectedCase?.generatedReportVersions?.en),
      de: safeText(selectedCase?.generatedReportVersions?.de),
    };
    if (!existingVersions.en && safeText(selectedCase?.generatedReportText)) {
      existingVersions.en = safeText(selectedCase.generatedReportText);
    }

    const currentText = getGeneratedReportTextForLanguage(selectedCase, lang);
    if (nextText === currentText && existingVersions[lang] === nextText) return;

    await onUpdateCase({
      ...selectedCase,
      generatedReportVersions: {
        ...existingVersions,
        [lang]: nextText,
      },
      activeGeneratedReportLanguage: lang,
    });
  };
  const handleGeneratedReportLanguageChange = async (language) => {
    const lang = normalizeReportLanguage(language);
    setReportDisplayLanguage(lang);

    if (!selectedCase || lang === activeGeneratedReportLanguage) return;

    await onUpdateCase({
      ...selectedCase,
      activeGeneratedReportLanguage: lang,
      updatedAt: new Date().toISOString(),
    });
  };
  const reportDisplayDate = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const reportHeaderMeta = `Case: ${selectedCase?.id || "-"} - ${reportDisplayDate}`;
  const reportCoverSubtitle = [selectedCase?.category, selectedCase?.status]
    .map((item) => safeText(item).trim())
    .filter(Boolean)
    .join(" - ");
  const reportCentreScopeLabel = reportCentreScope.scopeType === "sequenceGroup"
    ? `Issue: ${reportCentreIssueSelection.displayLabel || (reportCentreIssueSelection.requestedIssueId ? "Unavailable Issue" : "Not selected")}`
    : "Whole case";
  const renderedReportCentreScopeLabel = savedExecutiveDraft
    ? savedExecutiveDraft.revision.content.reportDocument?.source?.scope?.type === "sequenceGroup"
      ? `Historical Issue: ${savedExecutiveDraft.revision.content.reportDocument.source.scope.issueReference || "Issue"} — ${savedExecutiveDraft.revision.content.reportDocument.source.scope.issueName || savedExecutiveDraft.revision.content.reportDocument.source.scope.sequenceGroupName || "Not recorded"}`
      : "Historical whole case"
    : reportCentreScopeLabel;
  const handleReportCentreTypeChange = (nextReportType) => {
    setReportCentreDestination("reports");
    setReportCentreType(nextReportType);
    setReportCentreScopeType((currentScope) => normaliseReportScope(nextReportType, currentScope));
    setSavedExecutiveRevisionId("");
    setExecutiveRevisionTargetReportId("");
    setExecutiveDraftFeedback("");
    setReportCentreOutputFeedback("");
  };
  const handleReportCentreFamilyChange = (familyId) => {
    const initialReportByFamily = {
      professional: "executive",
      client: "client",
      technical: "incidentSchedule",
    };
    handleReportCentreTypeChange(initialReportByFamily[familyId] || "executive");
  };
  const handleOpenSavedReports = () => {
    setReportCentreDestination("saved");
    setSavedExecutiveRevisionId("");
    setExecutiveRevisionTargetReportId("");
    setExecutiveDraftFeedback("");
    setReportCentreOutputFeedback("");
  };
  const handleCopyReportCentreMarkdown = async () => {
    if (!reportCentreMarkdown) return;
    try {
      await copySequenceGroupText(reportCentreMarkdown);
      setReportCentreOutputFeedback("Markdown copied.");
    } catch {
      setReportCentreOutputFeedback("Could not copy Markdown.");
    }
  };
  const handleDownloadReportCentreOutput = (format) => {
    try {
      const document = reportCentreActiveDocument;
      if (!document) throw new Error("No report document is available.");
      const output = buildReportOutput(document, format);
      const savedContent = reportCentreType === "executive" && savedExecutiveDraft
        ? savedExecutiveDraft.revision.content[format === "json" ? "json" : "markdown"]
        : "";
      downloadTextFile(savedContent || output.content, output.filename, output.mimeType);
      setReportCentreOutputFeedback(`${getReportDefinition(reportCentreType).label} ${format === "json" ? "JSON" : "Markdown"} downloaded.`);
    } catch (error) {
      console.error("Failed to prepare report output", error);
      setReportCentreOutputFeedback("Could not prepare this report output.");
    }
  };
  const handleReportCentreScopeChange = (scope) => {
    setSavedExecutiveRevisionId("");
    setExecutiveRevisionTargetReportId("");
    setExecutiveDraftFeedback("");
    setReportCentreOutputFeedback("");
    setReportCentreScopeType(scope);
  };
  const handleReportCentreIssueChange = (issueId) => {
    setSavedExecutiveRevisionId("");
    setExecutiveRevisionTargetReportId("");
    setExecutiveDraftFeedback("");
    setReportCentreOutputFeedback("");
    setReportCentreIssueId(issueId);
  };
  const handleSaveExecutiveDraft = async () => {
    if (!selectedCase || savingExecutiveDraftRef.current || !reportCentreExecutiveDocument) return;
    const savingCaseId = selectedCase.id;
    if (normalisedReportCentreScopeType === "sequenceGroup" && !selectedReportCentreIssue) {
      setExecutiveDraftFeedback("Choose an available Issue before saving an Issue-scoped Draft.");
      return;
    }
    savingExecutiveDraftRef.current = true;
    setSavingExecutiveDraft(true);
    setExecutiveDraftFeedback("");
    try {
      const markdown = buildReportOutput(reportCentreExecutiveDocument, "markdown").content;
      const json = buildReportOutput(reportCentreExecutiveDocument, "json").content;
      const candidate = await buildExecutiveDraftCandidate({
        caseItem: selectedCase,
        reportDocument: reportCentreExecutiveDocument,
        markdown,
        json,
        reportId: executiveRevisionTargetReportId,
      });
      const saved = await onUpdateCase({ ...selectedCase, reportLibrary: candidate.reportLibrary });
      if (!saved) {
        if (selectedCaseRef.current?.id === savingCaseId) setExecutiveDraftFeedback("Draft was not saved. The live preview remains available.");
        return;
      }
      if (selectedCaseRef.current?.id !== savingCaseId) return;
      setSavedExecutiveRevisionId(candidate.revision.id);
      setExecutiveRevisionTargetReportId("");
      setExecutiveDraftFeedback(`Draft revision ${candidate.revision.versionNumber} saved. It remains unapproved.`);
    } catch (error) {
      console.error("Failed to save Executive Report Draft", error);
      if (selectedCaseRef.current?.id === savingCaseId) setExecutiveDraftFeedback(error?.message || "Draft was not saved. The live preview remains available.");
    } finally {
      savingExecutiveDraftRef.current = false;
      setSavingExecutiveDraft(false);
    }
  };
  const handleCreateExecutiveRevision = (draft) => {
    const scope = draft?.revision?.content?.reportDocument?.source?.scope || {};
    setSavedExecutiveRevisionId("");
    setExecutiveRevisionTargetReportId(draft?.manifest?.id || "");
    if (scope.type === "sequenceGroup") {
      setReportCentreScopeType("sequenceGroup");
      setReportCentreIssueId(scope.issueId || "");
    } else {
      setReportCentreScopeType("case");
    }
    setExecutiveDraftFeedback("Live preview selected. Save Draft will create a new immutable revision of this Draft report.");
    setReportCentreDestination("reports");
  };
  const handleExternalDraftingScopeChange = (scope) => {
    setReportCentreOutputFeedback("");
    setExternalDraftingScopeType(scope === "sequenceGroup" ? "sequenceGroup" : "case");
  };
  const getExternalDraftingScope = () => {
    if (externalDraftingScope.error) throw new Error(externalDraftingScope.error);
    return externalDraftingScope.scope;
  };
  const handleCopyExternalDraftingJson = async () => {
    if (!selectedCase) return;
    try {
      const payload = buildManagementReportBuilderPack(selectedCase, "", getExternalDraftingScope());
      await copySequenceGroupText(JSON.stringify(payload, null, 2));
      setReportCentreOutputFeedback("External Drafting Handoff JSON pack copied.");
    } catch (error) {
      setReportCentreOutputFeedback(error?.message || "Could not prepare the External Drafting Handoff JSON pack.");
    }
  };
  const handleCopyExternalDraftingMarkdown = async () => {
    if (!selectedCase) return;
    try {
      await copySequenceGroupText(buildManagementReportBuilderMarkdownPrompt(selectedCase, "", getExternalDraftingScope()));
      setReportCentreOutputFeedback("External Drafting Handoff Markdown prompt copied.");
    } catch (error) {
      setReportCentreOutputFeedback(error?.message || "Could not prepare the External Drafting Handoff Markdown prompt.");
    }
  };
  const handleCopyExternalDraftingSpecialistPrompt = async () => {
    if (!selectedCase) return;
    try {
      await copySequenceGroupText(buildManagementReportBuilderSpecialistPrompt(selectedCase, "", getExternalDraftingScope()));
      setReportCentreOutputFeedback("External Drafting Handoff specialist review prompt copied.");
    } catch (error) {
      setReportCentreOutputFeedback(error?.message || "Could not prepare the External Drafting Handoff specialist review prompt.");
    }
  };
  const handleReportCentrePrint = () => {
    setReportCentreOutputFeedback(`${getReportDefinition(reportCentreType).label} print dialog opened.`);
    window.print();
  };
  const toggleThreadIssueReportSection = (section) => {
    setThreadIssueReportVisibility((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };
  const toggleCaseBundleSection = (section) => {
    setCaseBundleSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };
  const showFloatingWorkspaceMenu = shouldShowFloatingWorkspaceMenu({
    selectedCase,
    isCaseCurrentlyLocked,
    actionSummaryEditOpen,
    sequenceGroupManagerOpen,
    sequenceGroupAuditExportOpen,
    incidentDateRepairOpen,
    activeLedgerRecord,
  });
  const floatingToolActions = buildFloatingToolActions({
    handleWorkspaceOpenSequenceGroups,
    handleWorkspaceOpenSequenceGroupAuditExport,
    handleWorkspaceOpenIncidentDateRepairTool,
  });
  const aiToolOptions = AI_TOOL_OPTIONS;
  const aiWorkspaceSections = AI_WORKSPACE_SECTIONS;
  const aiToolById = new Map(aiToolOptions.map((tool) => [tool.id, tool]));
  const aiWorkspaceTasks = aiWorkspaceSections.flatMap((section) => section.groups?.flatMap((group) => group.tasks || []) || section.tasks || []);
  const activeAiTaskOption = aiWorkspaceTasks.find((task) => task.id === activeAiTask) || aiWorkspaceTasks[0];
  const selectedCaseQualityReviewMode = CASE_QUALITY_REVIEW_MODES.find((mode) => mode.id === caseQualityReviewMode) || CASE_QUALITY_REVIEW_MODES[0];
  const selectedIssueReviewMode = ISSUE_REVIEW_MODES.find((mode) => mode.id === issueReviewMode) || ISSUE_REVIEW_MODES[0];
  const activeAiTaskGuidance = AI_TASK_GUIDANCE[activeAiTaskOption?.id] || {};
  const activeAiToolOption = aiToolById.get(activeAiTaskOption?.toolId) || aiToolById.get(activeAiTool) || aiToolOptions[0];
  const activeAiTaskActionKind = activeAiTaskOption?.actionKind || "ai-tool";
  const activeAiTaskToolId = activeAiTaskOption?.actionKind === "case-quality-review" ? selectedCaseQualityReviewMode.toolId : activeAiTaskOption?.actionKind === "issue-review" ? selectedIssueReviewMode.toolId : activeAiTaskOption?.toolId || activeAiTool;
  const activeAiTaskPurpose = activeAiTaskOption?.actionKind === "case-quality-review" ? selectedCaseQualityReviewMode.description : activeAiTaskOption?.actionKind === "issue-review" ? selectedIssueReviewMode.description : activeAiTaskOption?.purpose || activeAiToolOption.purpose;
  const activeAiTaskContains = activeAiTaskOption?.contains || activeAiToolOption.contains || [];
  const activeAiTaskBestGpt = activeAiTaskOption?.bestGpt || activeAiToolOption.bestUsedFor || [];
  const activeAiTaskDoesNotInclude = activeAiTaskOption?.doesNotInclude || activeAiToolOption.doesNotInclude || [];
  const activeAiTaskSafety = activeAiTaskOption?.safety || [activeAiToolOption.safety].filter(Boolean);
  const activeAiTaskWorkflow = activeAiTaskGuidance.workflow || [];
  const activeAiRecommendedGpt = activeAiTaskGuidance.recommendedGpt || activeAiTaskBestGpt[0] || "General ChatGPT";
  const activeAiAlsoSuitableGpts = activeAiTaskGuidance.alsoSuitableFor || activeAiTaskBestGpt.slice(1);
  const activeAiExampleQuestions = activeAiTaskGuidance.exampleQuestions || [];
  const activeAiToolNeedsSequenceGroup = activeAiTaskToolId === "chain-completion-pack" || activeAiTaskToolId === "full-chain-gpt-pack";
  const formatCaseHeaderDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  };
  const caseHeaderSubtitle = selectedCase.category
    ? `${selectedCase.category} Workspace`
    : selectedCase.status
      ? `${selectedCase.status} Case Workspace`
      : "Case Workspace";
  const caseHeaderMetadata = [
    selectedCase.category ? { label: "Category", value: selectedCase.category } : null,
    formatCaseHeaderDate(selectedCase.createdAt) ? { label: "Created", value: formatCaseHeaderDate(selectedCase.createdAt) } : null,
    formatCaseHeaderDate(selectedCase.updatedAt) ? { label: "Updated", value: formatCaseHeaderDate(selectedCase.updatedAt) } : null,
  ].filter(Boolean);
  const caseHeaderMetrics = [
    { label: "Incidents", value: (selectedCase.incidents || []).length },
    { label: "Evidence", value: (selectedCase.evidence || []).length },
    { label: "Documents", value: (selectedCase.documents || []).length },
    { label: "Strategy", value: (selectedCase.strategy || []).length },
    { label: "Timeline", value: timelineItems.length },
    { label: "Issues", value: sequenceGroupDetails.groups.length },
  ];
  const caseWorkspaceTabs = tabs
      .flatMap((tab) => tab.id === "documents" ? [tab, { id: "records", label: "Case Records" }] : tab.id === "ledger" ? [] : [tab])
      .map((tab) => ({
        ...tab,
        label: tab.id === "generate-report" ? "Reports" : tab.label,
        secondary: ["strategy"].includes(tab.id),
        icon: {
          overview: BookOpen,
          parties: Users,
          incidents: ShieldCheck,
          evidence: Search,
          watch: Waypoints,
          documents: FileText,
          records: BookOpen,
          "ai-workspace": Briefcase,
          timeline: Waypoints,
          "generate-report": Download,
          strategy: Target,
        }[tab.id],
      }));
  const caseWorkspaceTabIds = caseWorkspaceTabs.map((tab) => tab.id);
  const orderedCaseWorkspaceTabs = (() => {
    const tabById = new Map(caseWorkspaceTabs.map((tab) => [tab.id, tab]));
    return normaliseCaseNavigationOrder(caseNavigationOrder, caseWorkspaceTabIds).map((id) => tabById.get(id)).filter(Boolean);
  })();
  const updateCaseNavigationOrder = (nextOrder, announcement) => {
    const normalisedOrder = normaliseCaseNavigationOrder(nextOrder, caseWorkspaceTabIds);
    setCaseNavigationOrder(normalisedOrder);
    saveCaseNavigationOrder(normalisedOrder);
    if (announcement) setCaseNavigationAnnouncement(announcement);
  };
  const moveCaseNavigationTab = (tabId, direction) => {
    const currentOrder = orderedCaseWorkspaceTabs.map((tab) => tab.id);
    const nextOrder = moveCaseNavigationItem(currentOrder, tabId, direction);
    if (nextOrder === currentOrder) return;
    const movedTab = caseWorkspaceTabs.find((tab) => tab.id === tabId);
    updateCaseNavigationOrder(nextOrder, `${movedTab?.label || "Section"} moved ${direction < 0 ? "left" : "right"}.`);
  };
  const clearCaseNavigationDrag = () => {
    setDraggedCaseNavigationId("");
    setCaseNavigationDropTarget("");
  };
  const handleCaseNavigationReorderKeyDown = (event, tab) => {
    if (event.key === "Escape") {
      event.preventDefault();
      clearCaseNavigationDrag();
      setCaseNavigationAnnouncement("Section reordering cancelled.");
      return;
    }
    if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    moveCaseNavigationTab(tab.id, event.key === "ArrowLeft" ? -1 : 1);
  };
  const resetCaseNavigation = () => {
    resetCaseNavigationOrder();
    setCaseNavigationOrder([]);
    setCaseNavigationAnnouncement("Case navigation order restored.");
  };

  return (
    <div className="case-file space-y-6">
      <div className="case-file-header case-workspace-header rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 print:hidden">
        <div className="case-file-header-layout grid gap-4">
        <div className="case-file-header-main min-w-0">
          <button onClick={() => setSelectedCaseId(null)} className="case-file-back-link mb-3 text-sm font-medium text-neutral-500 underline-offset-4 hover:underline">
            ← Back to Cases
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h2 className="min-w-0 text-2xl font-semibold leading-tight text-neutral-950 sm:text-3xl">{selectedCase.name}</h2>
            {selectedCase.status && <span className="case-file-status rounded-full px-2.5 py-1 text-[11px] font-semibold">{selectedCase.status}</span>}
            <button onClick={() => openEditCaseModal(selectedCase)} className="case-file-header-action rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600 transition-colors">
              Edit
            </button>
            <button
              onClick={() => onOpenPinManager?.(selectedCase)}
              className="case-file-header-action rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600 transition-colors"
            >
              {isPinLocked ? "Manage PIN" : "Set PIN"}
            </button>
          </div>
          <p className="mt-1 text-sm font-medium text-neutral-500">{caseHeaderSubtitle}</p>
          {caseHeaderMetadata.length > 0 && (
            <div className="case-file-metadata mt-3 flex flex-wrap gap-2">
              {caseHeaderMetadata.map((item) => (
                <span key={item.label} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
                  <span className="text-neutral-400">{item.label}:</span> {item.value}
                </span>
              ))}
            </div>
          )}
          <p className="case-file-privacy mt-2 text-xs font-medium text-neutral-500">
            {isPinLocked ? "Privacy lock: PIN enabled" : "Privacy lock: off"}
          </p>
          {selectedCase.notes ? <p className="case-file-description mt-3 text-sm leading-6 text-neutral-700">{selectedCase.notes}</p> : null}
          <div className="case-file-metrics case-workspace-metrics mt-4 flex flex-wrap gap-1.5" aria-label="Case metrics">
            {caseHeaderMetrics.map((metric) => (
              <span key={metric.label} className="case-workspace-metric inline-flex items-baseline gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-500">
                <strong className="font-semibold text-neutral-900">{metric.value}</strong>
                {metric.label}
              </span>
            ))}
          </div>
        </div>
        <div className="case-file-toolbar case-workspace-toolbar flex flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap items-end gap-3 lg:justify-end">
          <div className="case-toolbar-group">
            <div className="case-toolbar-label">Case</div>
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
            >
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div data-proveit-menu className="absolute bottom-full left-0 right-auto z-50 mb-2 max-h-[50vh] w-[calc(100vw-2rem)] max-w-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in duration-100 lg:bottom-auto lg:left-auto lg:right-0 lg:mb-0 lg:mt-2 lg:max-h-[75vh]">
                  <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Backup & Restore
                  </div>
                  <button
                    onClick={() => { exportSelectedCase(); setShowExportMenu(false); }}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-neutral-800">Download Full Case Backup</span>
                    <span className="mt-0.5 block text-xs leading-4 text-neutral-500">Restore-safe case export for backup and transfer.</span>
                  </button>

                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Reports & Handoff
                  </div>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("generate-report"); setShowExportMenu(false); }}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-neutral-800">Open Reports</span>
                    <span className="mt-0.5 block text-xs leading-4 text-neutral-500">Create human-readable reports and case handoff packs.</span>
                  </button>

                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    AI / GPT Exports
                  </div>
                  <button
                    type="button"
                    onClick={() => { openAiWorkspace(activeAiTool || "missing-function-summaries"); setShowExportMenu(false); }}
                    className="block min-h-11 w-full rounded-lg border border-lime-200 bg-lime-50/70 px-3 py-2 text-left transition-colors hover:bg-lime-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-neutral-900">Open AI Workspace</span>
                    <span className="mt-0.5 block text-xs leading-4 text-lime-800">Recommended GPT export is now available in AI Workspace.</span>
                  </button>
                  <button
                    onClick={() => { onExportSnapshot(selectedCase.id, "detailed"); setShowExportMenu(false); }}
                    className="mt-1 block min-h-11 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-neutral-700">AI Reasoning Snapshot JSON</span>
                    <span className="mt-0.5 block text-xs leading-4 text-neutral-500">Secondary direct download for the same whole-case GPT snapshot.</span>
                  </button>
                  <div className="mt-1 rounded-lg px-3 py-2 text-left">
                    <div className="text-sm font-semibold leading-snug text-neutral-700">Reasoning Snapshot Upload</div>
                    <p className="mt-0.5 text-xs leading-4 text-neutral-500">Remote upload action for configured deployments.</p>
                    {ENABLE_SUPABASE_REMOTE ? (
                      <button
                        onClick={() => { onSendReasoningSnapshotToSupabase(); setShowExportMenu(false); }}
                        disabled={syncStatus === "syncing"}
                        className="mt-2 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        Send Reasoning Snapshot
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="mt-2 cursor-not-allowed rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-bold text-neutral-400"
                      >
                        Upload disabled until secure auth is configured.
                      </button>
                    )}
                  </div>

                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Advanced / Technical
                  </div>
                  <button
                    onClick={() => { onCopyLinkMapExport?.(selectedCase.id); setShowExportMenu(false); }}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-neutral-700">Copy Link Map JSON</span>
                    <span className="mt-0.5 block text-xs leading-4 text-neutral-500">Technical structure/debug export of case relationships.</span>
                  </button>
                  <button
                    onClick={() => { handleDownloadGptProtocolPackJson(); setShowExportMenu(false); }}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-neutral-700">Download GPT Protocol Pack JSON</span>
                    <span className="mt-0.5 block text-xs leading-4 text-neutral-500">Custom GPT reference instructions, not case data.</span>
                  </button>
                  <button
                    onClick={() => { handleDownloadGptProtocolPackMarkdown(); setShowExportMenu(false); }}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-neutral-700">Download GPT Protocol Pack Markdown</span>
                    <span className="mt-0.5 block text-xs leading-4 text-neutral-500">Readable custom GPT reference, not case data.</span>
                  </button>
                  <button
                    onClick={() => { openSequenceGroupAuditExport(); setShowExportMenu(false); }}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-neutral-700">Open Issue Audit</span>
                    <span className="mt-0.5 block text-xs leading-4 text-neutral-500">Issue/sequence review export tools for focused chain audits.</span>
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
          <div className="case-toolbar-group">
            <div className="case-toolbar-label">Analysis</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openSequenceGroupManager}
                className="case-file-issue-manager case-toolbar-critical flex min-h-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors"
              >
                Issue Manager
              </button>
              <button
                type="button"
                onClick={() => openAiWorkspace(activeAiTool || "missing-function-summaries")}
                className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
              >
                <Briefcase className="h-3.5 w-3.5" />
                AI Workspace
              </button>
          {onOpenGptDeltaModal && (
            <button
              onClick={onOpenGptDeltaModal}
              className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
            >
              <FileText className="h-3.5 w-3.5" />
              GPT Update
            </button>
          )}
            </div>
          </div>
          </div>
          <div className="flex flex-col items-start lg:items-end">
            {syncMessage && (
              <span className={`text-[10px] font-bold uppercase tracking-tight text-center ${syncStatus === 'error' ? 'text-red-500' : 'text-lime-600'}`}>{syncMessage}</span>
            )}
            {supabaseReasoningExportMessage && (
              <span className={`text-[10px] font-bold uppercase tracking-tight text-center ${supabaseReasoningExportStatus === 'error' ? 'text-red-500' : 'text-lime-600'}`}>{supabaseReasoningExportMessage}</span>
            )}
          </div>
        </div>
      </div>
      </div>

      <ActionSummaryPanel
        updatedAt={actionSummary.updatedAt}
        currentFocus={currentFocus}
        nextActions={activeNextActions}
        completedNextActions={completedNextActions}
        importantReminders={importantReminders}
        criticalDeadlines={criticalDeadlines}
        strategyFocus={strategyFocus}
        quickActionInput={quickActionInput}
        onEdit={openActionSummaryEdit}
        onCopy={copyActionSummaryToClipboard}
        onToggleNextActionCompleted={handleToggleNextActionCompleted}
        onMoveNextAction={handleMoveNextAction}
        onRemoveNextAction={handleRemoveNextAction}
        onQuickActionInputChange={setQuickActionInput}
        onQuickActionKeyDown={handleQuickActionKeyDown}
        onAddQuickAction={addQuickAction}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className={`${reviewQueueSection ? "lg:col-span-8" : "lg:col-span-12"} space-y-6`}>
          <div className="case-workspace-tabs border-b border-neutral-200 bg-white print:hidden dark:border-neutral-700 dark:bg-neutral-950">
            {(() => {
              const workspaceTabs = orderedCaseWorkspaceTabs;

              return (
                <>
                  <label className="case-file-mobile-navigation block pb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 md:hidden">
                    Workspace View
                    <select
                      value={isCaseRecordsWorkspace ? "records" : activeTab}
                      onChange={(event) => setActiveTab(event.target.value)}
                      className="mt-2 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      {workspaceTabs.map((tab) => (
                        <option key={tab.id} value={tab.id}>{tab.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="case-file-mobile-navigation-actions flex justify-end pb-3 md:hidden">
                    <button type="button" onClick={resetCaseNavigation} className="case-file-navigation-reset">Reset order</button>
                  </div>
                  <nav className="case-file-navigation hidden md:block" aria-label="Case file sections">
                    <div className="case-file-navigation-controls">
                      <p id="case-navigation-reorder-help">Drag sections to reorder them. With a section focused, press Alt + Left or Right Arrow to move it.</p>
                      <button type="button" onClick={resetCaseNavigation} className="case-file-navigation-reset">Reset order</button>
                    </div>
                    <p className="sr-only" role="status" aria-live="polite">{caseNavigationAnnouncement}</p>
                    <div className="case-file-navigation-grid grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-6">
                    {workspaceTabs.map((tab) => {
                      const isActive = tab.id === "records" ? isCaseRecordsWorkspace : activeTab === tab.id;
                      const TabIcon = tab.icon;
                      return (
                        <div
                          key={tab.id}
                          className={`case-file-navigation-cell ${caseNavigationDropTarget === tab.id ? "is-drop-target " : ""}${draggedCaseNavigationId === tab.id ? "is-dragging" : ""}`}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (draggedCaseNavigationId && draggedCaseNavigationId !== tab.id) setCaseNavigationDropTarget(tab.id);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const draggedId = event.dataTransfer.getData("text/plain") || draggedCaseNavigationId;
                            if (draggedId && draggedId !== tab.id) {
                              const currentOrder = workspaceTabs.map((item) => item.id);
                              const fromIndex = currentOrder.indexOf(draggedId);
                              const targetIndex = currentOrder.indexOf(tab.id);
                              const nextOrder = [...currentOrder];
                              nextOrder.splice(fromIndex, 1);
                              nextOrder.splice(fromIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, draggedId);
                              const draggedTab = workspaceTabs.find((item) => item.id === draggedId);
                              updateCaseNavigationOrder(nextOrder, `${draggedTab?.label || "Section"} moved before ${tab.label}.`);
                            }
                            clearCaseNavigationDrag();
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            onKeyDown={(event) => handleCaseNavigationReorderKeyDown(event, tab)}
                            aria-describedby="case-navigation-reorder-help"
                            aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                            aria-current={isActive ? "page" : undefined}
                            className={`case-file-navigation-item relative inline-flex min-h-10 min-w-0 w-full items-center justify-center gap-1.5 rounded-lg border py-2 pl-5 pr-2 text-center text-xs font-semibold leading-tight transition-colors duration-200 focus:outline-none focus-visible:z-10 ${
                              isActive
                                ? "is-active text-neutral-950 dark:text-neutral-100"
                                : tab.secondary
                                  ? "is-secondary text-neutral-500 dark:text-neutral-400"
                                  : "text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            {TabIcon && <TabIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                            <span>{tab.label}</span>
                            {isActive && <span className="case-workspace-tab-indicator absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-lime-500" />}
                          </button>
                          <button
                            type="button"
                            draggable
                            aria-label={`Reorder ${tab.label}`}
                            aria-describedby="case-navigation-reorder-help"
                            aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                            className="case-file-navigation-grip"
                            onKeyDown={(event) => handleCaseNavigationReorderKeyDown(event, tab)}
                            onDragStart={(event) => {
                              setDraggedCaseNavigationId(tab.id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", tab.id);
                            }}
                            onDragEnd={clearCaseNavigationDrag}
                          >
                            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                    </div>
                  </nav>
                </>
              );
            })()}
          </div>

          <div className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 sm:p-5">
            {/* Tab content logic... */}
            {activeTab === "overview" && (
              <>
                <CaseBriefingDashboard
                  model={caseBriefingModel}
                  onOpenIssue={openSequenceGroupManager}
                onOpenItem={openBriefingItem}
                getItemLaunch={(item) => getOverviewRecordLaunch(item, selectedCase)}
                  onOpenTab={setActiveTab}
                  onAddIncident={() => openRecordModal("incidents")}
                  onAddEvidence={() => openRecordModal("evidence")}
                  onAddDocument={() => openDocumentModal()}
                  onOpenFullBriefing={() => document.getElementById("case-action-summary")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                />
                {overviewWatchItem !== undefined && (
                  <WatchEditor
                    item={overviewWatchItem}
                    caseItem={selectedCase}
                    onClose={() => setOverviewWatchItem(undefined)}
                    onSave={saveOverviewWatchItem}
                  />
                )}
              </>
            )}

            {activeTab === "overview-placeholder-disabled" && (
              <div className="space-y-6">
                <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Case Header</div>
                      <h3 className="mt-1 text-2xl font-semibold text-neutral-950">{selectedCase.name}</h3>
                      <p className="mt-1 text-sm text-neutral-600">Category: {selectedCase.category || "Uncategorised"}</p>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:min-w-96">
                      <div className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Created</div>
                        <div className="mt-1 font-medium text-neutral-800">{selectedCase.createdAt || "Not recorded"}</div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Last Updated</div>
                        <div className="mt-1 font-medium text-neutral-800">{selectedCase.updatedAt || "Not recorded"}</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Investigation Progress</div>
                    <div className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                      Progress card placeholder.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Case Health</div>
                    <div className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                      Case health placeholder.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Current Phase</div>
                    <div className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                      Current phase placeholder.
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Recommended Next Action</div>
                    <div className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                      <div className="space-y-3">
                        <p>{overviewRecommendedAction.message}</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab(overviewRecommendedAction.tabId)}
                          className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30"
                        >
                          {overviewRecommendedAction.buttonLabel}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      {overviewAttentionIssues.length > 0 ? "⚠ Needs Attention" : "✅ Investigation looks healthy."}
                    </div>
                    <div className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                      {overviewAttentionIssues.length > 0 ? (
                        <div className="space-y-3">
                          <p>The following issues may reduce the quality or completeness of this investigation.</p>
                          <div className="space-y-2">
                            {overviewAttentionIssues.map((issue) => (
                              <button
                                key={issue.key}
                                type="button"
                                onClick={() => setActiveTab(issue.tabId)}
                                className="block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-sm text-neutral-700"
                              >
                                • {issue.message(issue.count)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p>No obvious investigation gaps were detected.</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Quick Actions</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab("parties")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Add Party</button>
                    <button onClick={() => openRecordModal("incidents")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Add Incident</button>
                    <button onClick={() => openRecordModal("evidence")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Add Evidence</button>
                    <button onClick={() => openDocumentModal()} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Add Document</button>
                    <button onClick={() => openLedgerModal()} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Add Ledger</button>
                    <button onClick={() => setActiveTab("generate-report")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Generate Report</button>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Case Summary</div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {overviewSummaryItems.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setActiveTab(item.tabId)}
                        className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{item.label}</div>
                        <div className="mt-2 text-sm font-medium text-neutral-600">{item.count}</div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Recent Activity</div>
                    <div className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
                      Recent activity placeholder.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Reports</div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Case Report</button>
                      <button type="button" className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Evidence Pack</button>
                      <button type="button" className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30">Document Pack</button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "overview-legacy" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Case Tools</h3>
                      <p className="mt-1 text-sm text-neutral-600">Manage case structure and issue threads without changing record content.</p>
                    </div>
                    <button
                      type="button"
                      onClick={openSequenceGroupManager}
                      className="w-fit rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30"
                    >
                      Open Issue Manager
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Case Position</h3>
                      <p className="mt-1 text-sm text-neutral-500">Practical view of structure, strength, and weak points.</p>
                      {issueFixFeedback && (
                        <p className="mt-2 text-xs font-medium text-lime-700">{issueFixFeedback}</p>
                      )}
                    </div>
                    <div className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${positionStyle}`}>
                      {casePosition}
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className={`rounded-xl border p-3 ${positionStyle}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">Case Position</div>
                      <div className="mt-1 text-sm font-semibold">{casePosition}</div>
                    </div>
                    <div className={`rounded-xl border p-3 ${strengthStyle}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">Case Strength</div>
                      <div className="mt-1 text-sm font-semibold">{caseStrength}</div>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Health Check</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">{readinessLabel}</div>
                    </div>
                  </div>

                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Key Weak Points
                    </div>
                    {displayedWeakPoints.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-amber-950">
                        {displayedWeakPoints.map((item) => (
                          <li key={item.category} className="break-words">
                            - {item.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-amber-900/70">No major weak points flagged.</p>
                    )}
                  </div>

                  {criticalBlockers.length > 0 && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                        Critical Blockers
                      </div>
                      <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                        {criticalBlockers.map((item, idx) => (
                          <li key={idx} className="break-words">
                            - {item.title || item.detail || "Issue"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {health && (
                    <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
                      Existing health check: {readinessLabel} · {health.totalIssues || 0} blocker{health.totalIssues === 1 ? "" : "s"} · issue pressure {issuesLabel}
                    </div>
                  )}

                  <div className="mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <button
                      type="button"
                      onClick={() => toggleGroup("Operational Integrity")}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-neutral-50"
                    >
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Operational Integrity</div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">
                          Export freshness: {exportFreshness.status} · open loops: {openOperationalLoopIssueCount} issue{openOperationalLoopIssueCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          exportFreshness.status === "critical"
                            ? "bg-red-100 text-red-700"
                            : exportFreshness.status === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-lime-100 text-lime-700"
                        }`}>
                          {exportFreshness.status}
                        </span>
                        {expandedGroups["Operational Integrity"] ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronRight className="h-4 w-4 text-neutral-400" />}
                      </div>
                    </button>
                    {expandedGroups["Operational Integrity"] && (
                      <div className="space-y-3 border-t border-neutral-100 p-3 text-xs text-neutral-700">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                            Generated: <span className="font-semibold">{exportFreshness.stats.generatedAt || "Unknown"}</span>
                          </div>
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                            Case updated: <span className="font-semibold">{exportFreshness.stats.caseUpdatedAt || "Unknown"}</span>
                          </div>
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                            Newest record: <span className="font-semibold">{exportFreshness.stats.newestRecordUpdatedAt || "Unknown"}</span>
                          </div>
                        </div>

                        {exportFreshnessIssueCount === 0 ? (
                          <p className="text-neutral-500">Reasoning export metadata appears current against the loaded case timestamps.</p>
                        ) : (
                          <div className="space-y-2">
                            {exportFreshness.issues.map((issue, index) => (
                              <div key={`${issue.code}-${index}`} className={`rounded-lg border p-2 ${
                                issue.severity === "critical"
                                  ? "border-red-100 bg-red-50/70"
                                  : "border-amber-100 bg-amber-50/70"
                              }`}>
                                <div className={`font-semibold ${issue.severity === "critical" ? "text-red-800" : "text-amber-900"}`}>
                                  {issue.code}
                                </div>
                                <div className={issue.severity === "critical" ? "text-red-700" : "text-amber-800"}>
                                  {issue.message}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Open Operational Loops</div>
                              <div className="mt-1 text-sm font-semibold text-neutral-900">
                                {openOperationalLoops.status} · {openOperationalLoopIssueCount} issue{openOperationalLoopIssueCount === 1 ? "" : "s"}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-600 sm:grid-cols-5">
                              <div>Strategy: <span className="font-semibold">{openOperationalLoops.stats.staleStrategyItemCount}</span></div>
                              <div>Incidents: <span className="font-semibold">{openOperationalLoops.stats.weakIncidentCount}</span></div>
                              <div>Threads: <span className="font-semibold">{openOperationalLoops.stats.dormantThreadCount}</span></div>
                              <div>Actions: <span className="font-semibold">{openOperationalLoops.issues.filter((issue) => issue.code === "STALE_ACTION_SUMMARY").length}</span></div>
                              <div>To Watch: <span className="font-semibold">{openOperationalLoops.stats.overdueWatchReviews + openOperationalLoops.stats.staleWatchItems + openOperationalLoops.stats.escalatedWatchItemsWithoutOutcome}</span></div>
                            </div>
                          </div>
                        </div>

                        {openOperationalLoopIssueCount === 0 ? (
                          <p className="text-neutral-500">No stale strategy items, weak incidents, dormant threads, or action summary drift detected.</p>
                        ) : (
                          <div className="space-y-2">
                            {openOperationalLoops.issues.map((issue, index) => (
                              <div key={`${issue.code}-${index}`} className="rounded-lg border border-amber-100 bg-amber-50/70 p-2">
                                <div className="font-semibold text-amber-900">{issue.code}</div>
                                <div className="text-amber-800">{issue.message}</div>
                                {issue.details?.sequenceGroup && (
                                  <div className="mt-1 text-[10px] font-medium text-amber-700">Thread: {issue.details.sequenceGroup}</div>
                                )}
                                {Number.isFinite(issue.details?.daysStale) && (
                                  <div className="mt-1 text-[10px] font-medium text-amber-700">Days stale: {issue.details.daysStale}</div>
                                )}
                                {Number.isFinite(issue.details?.daysInactive) && (
                                  <div className="mt-1 text-[10px] font-medium text-amber-700">Days inactive: {issue.details.daysInactive}</div>
                                )}
                                {issue.navigationTarget?.tab && <button type="button" onClick={() => setActiveTab(issue.navigationTarget.tab)} className="mt-2 rounded border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold text-amber-900">Open {issue.recordType === "watchItems" ? "To Watch" : "Strategy"}</button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <button
                      type="button"
                      onClick={() => toggleGroup("Attachment Integrity")}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-neutral-50"
                    >
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Attachment Integrity</div>
                        <div className="mt-1 text-sm font-semibold text-neutral-900">
                          {attachmentIntegrityIssueCount === 0 ? "No attachment integrity issues detected" : `${attachmentIntegrityIssueCount} issue${attachmentIntegrityIssueCount === 1 ? "" : "s"} detected`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                          {attachmentIntegrityIssueCount}
                        </span>
                        {expandedGroups["Attachment Integrity"] ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronRight className="h-4 w-4 text-neutral-400" />}
                      </div>
                    </button>
                    {expandedGroups["Attachment Integrity"] && (
                      <div className="space-y-3 border-t border-neutral-100 p-3 text-xs text-neutral-700">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                            Missing references: <span className="font-semibold">{attachmentIntegrity.orphanedRecordReferences.length}</span>
                          </div>
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                            Orphan images: <span className="font-semibold">{attachmentIntegrity.orphanedImages.length}</span>
                          </div>
                          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                            Metadata mismatches: <span className="font-semibold">{attachmentIntegrity.metadataMismatches.length}</span>
                          </div>
                        </div>

                        {attachmentIntegrityIssueCount === 0 ? (
                          <p className="text-neutral-500">Attachment references match the loaded image-store diagnostics data.</p>
                        ) : (
                          <div className="space-y-2">
                            {attachmentIntegrity.orphanedRecordReferences.slice(0, 8).map((item) => (
                              <div key={`missing-${item.caseId}-${item.recordId}-${item.imageId}`} className="rounded-lg border border-amber-100 bg-amber-50/60 p-2">
                                <div className="font-semibold text-amber-900">{item.recordTitle || item.recordId}</div>
                                <div className="mt-1 text-amber-800">{item.details}</div>
                                <div className="mt-1 break-all font-mono text-[10px] text-amber-700">case {item.caseId} - record {item.recordId} - image {item.imageId}</div>
                              </div>
                            ))}
                            {attachmentIntegrity.orphanedImages.slice(0, 8).map((item) => (
                              <div key={`orphan-${item.imageId}`} className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                                <div className="font-semibold text-neutral-800">{item.filename || item.imageId}</div>
                                <div className="mt-1 text-neutral-600">{item.details}</div>
                                <div className="mt-1 break-all font-mono text-[10px] text-neutral-500">image {item.imageId}</div>
                              </div>
                            ))}
                            {attachmentIntegrity.metadataMismatches.slice(0, 8).map((item) => (
                              <div key={`mismatch-${item.caseId}-${item.recordId}-${item.imageId}`} className="rounded-lg border border-blue-100 bg-blue-50/60 p-2">
                                <div className="font-semibold text-blue-950">{item.recordTitle || item.recordId}</div>
                                <div className="mt-1 text-blue-900">{item.details}</div>
                                <ul className="mt-1 space-y-0.5 text-blue-800">
                                  {item.mismatches.map((mismatch) => (
                                    <li key={`${item.imageId}-${mismatch.field}`}>
                                      - {mismatch.field}: record "{String(mismatch.recordValue)}", image "{String(mismatch.imageValue)}"
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {health?.issues.length > 0 && (
                    <div className="space-y-2">
                      {health.issues.map((group) => (
                        <div key={group.category} className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/70">
                          <button onClick={() => toggleGroup(group.category)} className="flex w-full items-center justify-between p-3 transition-colors hover:bg-neutral-50">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-neutral-700">{group.category}</span>
                              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">{group.items.length}</span>
                            </div>
                            {expandedGroups[group.category] ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronRight className="h-4 w-4 text-neutral-400" />}
                          </button>
                          {expandedGroups[group.category] && (
                            <div className="space-y-2 border-t border-neutral-100 px-3 pb-3 pt-2">
                              {group.items.map((item, idx) => (
                                <div key={idx} className={`rounded-lg border px-2 py-2 text-xs last:mb-0 ${
                                  item.severity === "advisory"
                                    ? "border-neutral-100 bg-white/50 text-neutral-500"
                                    : "border-neutral-200 bg-white text-neutral-700"
                                }`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={item.severity === "advisory" ? "font-medium text-neutral-600" : "font-semibold text-neutral-800"}>{item.title}</span>
                                          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                            item.severity === "advisory"
                                              ? "border-neutral-200 bg-neutral-50 text-neutral-400"
                                              : "border-amber-200 bg-amber-50 text-amber-700"
                                          }`}>
                                            {item.severity === "advisory" ? "Advisory" : "Blocking"}
                                          </span>
                                        </div>
                                        {item.date && <span className="font-medium text-neutral-400">{item.date}</span>}
                                      </div>
                                      <div className={item.severity === "advisory" ? "mt-1 text-neutral-400" : "mt-1 text-neutral-600"}>{item.detail}</div>
                                    </div>
                                    <button
                                      onClick={() => handleOpenIssue(item)}
                                      className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                                    >
                                      Open
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
            
            {activeTab === "evidence" && (
              <div className="case-file-evidence space-y-6">
                <section className="case-file-evidence-header rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Evidence Command Centre</div>
                      <h3 className="mt-1 text-xl font-semibold text-neutral-950">Evidence Summary</h3>
                    </div>
                    <div className="text-xs font-medium text-neutral-500">
                      {filteredEvidence.length} shown of {allEvidence.length}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    {evidenceSummaryCards.map((card) => (
                      <div key={card.label} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{card.label}</div>
                        <div className="mt-2 text-2xl font-semibold text-neutral-900">{card.value}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="case-file-evidence-operations grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Needs Attention</div>
                    <div className="mt-3 space-y-2">
                      {evidenceAttentionIssues.length > 0 ? (
                        evidenceAttentionIssues.map((issue) => (
                          <button
                            key={issue.key}
                            type="button"
                            onClick={() => applyEvidenceFilter(issue.filter)}
                            className="block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50"
                          >
                            {issue.text}
                          </button>
                        ))
                      ) : (
                        <div className="rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-sm font-medium text-lime-800">
                          ✓ Evidence collection appears complete.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Quick Actions</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openRecordModal("evidence")}
                        className="case-file-evidence-primary-action"
                      >
                        New Evidence
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          evidenceSearchInputRef.current?.focus();
                          scrollToEvidenceList();
                        }}
                        className="case-file-evidence-quick-action"
                      >
                        Search Evidence
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (evidenceAttentionIssues[0]) {
                            applyEvidenceFilter(evidenceAttentionIssues[0].filter);
                          } else {
                            scrollToEvidenceList();
                          }
                        }}
                        className="case-file-evidence-quick-action"
                      >
                        Review Needs Attention
                      </button>
                      <button
                        type="button"
                        onClick={() => applyEvidenceFilter("unlinked")}
                        className="case-file-evidence-quick-action"
                      >
                        Show Unlinked
                      </button>
                      <button
                        type="button"
                        onClick={() => applyEvidenceFilter("missing-summary")}
                        className="case-file-evidence-quick-action"
                      >
                        Show Missing Summaries
                      </button>
                    </div>
                  </div>
                </section>

                <section className="case-file-evidence-controls rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Filters</div>
                    <div className="text-xs font-medium text-neutral-500">
                      {filteredEvidence.length} matching evidence item{filteredEvidence.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="evidence-search">
                        Search Evidence
                      </label>
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                        <input
                          id="evidence-search"
                          ref={evidenceSearchInputRef}
                          type="search"
                          value={evidenceSearch}
                          onChange={(event) => setEvidenceSearch(event.target.value)}
                          placeholder="Search evidence, summaries, tags, linked incidents, parties, or Issue"
                          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Issue
                        <select
                          value={evidenceSequenceGroupFilter}
                          onChange={(event) => setEvidenceSequenceGroupFilter(event.target.value)}
                          className="case-file-evidence-select mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 outline-none transition-colors sm:w-60"
                        >
                          <option value={TIMELINE_ALL_ISSUES_FILTER}>All Issues</option>
                          <option value={TIMELINE_UNASSIGNED_ISSUES_FILTER}>Evidence without an Issue</option>
                          {timelineIssueOptions.map((issue) => (
                            <option key={issue.id} value={issue.id}>
                              {issue.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Filter
                        <select
                          value={evidenceFilter}
                          onChange={(event) => setEvidenceFilter(event.target.value)}
                          className="case-file-evidence-select mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 outline-none transition-colors sm:w-60"
                        >
                          <option value="all">All evidence</option>
                          <option value="needs_review">Needs review</option>
                          <option value="incomplete">Incomplete</option>
                          <option value="verified">Verified</option>
                          <option value="unlinked">Unlinked from incidents</option>
                          <option value="missing-parties">Without parties</option>
                          <option value="missing-summary">Missing function summary</option>
                          <option value="missing-attachments">No attachment or availability</option>
                        </select>
                      </label>
                      {(evidenceSearch || evidenceFilter !== "all" || evidenceSequenceGroupFilter !== "all") && (
                        <button
                          type="button"
                          onClick={() => {
                            setEvidenceSearch("");
                            setEvidenceFilter("all");
                            setEvidenceSequenceGroupFilter(TIMELINE_ALL_ISSUES_FILTER);
                          }}
                          className="case-file-evidence-clear rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {evidenceQuickFilterChips.map((chip) => {
                      const selected = evidenceQuickFilter === chip.id;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => setEvidenceQuickFilter(chip.id)}
                          aria-pressed={selected}
                          className={`case-file-evidence-filter min-h-8 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            selected
                              ? "border-lime-500 bg-lime-50 text-lime-800"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-lime-300 hover:bg-lime-50"
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section id="evidence-list" className="case-file-evidence-list space-y-8 scroll-mt-24" aria-live="polite">
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Needs Review</h3>
                      {renderListBlock(
                        needsReviewEvidence,
                        allEvidence.length === 0 ? "No evidence yet. Add your first evidence item to support the case." : "No evidence needing review.",
                        "evidence"
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Incomplete</h3>
                      {renderListBlock(incompleteEvidence, "No incomplete evidence.", "evidence")}
                    </div>

                    <div className="space-y-4">
                      <button
                        onClick={() => setShowVerifiedEvidence((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-100"
                      >
                        <span className="text-sm font-semibold text-neutral-900">
                          Verified ({verifiedEvidence.length})
                        </span>
                        <span className="text-xs font-bold text-neutral-500">
                          {showVerifiedEvidence ? "Hide" : "Show"}
                        </span>
                      </button>

                      {showVerifiedEvidence && renderListBlock(verifiedEvidence, "No verified evidence yet.", "evidence")}
                    </div>
                  </section>
              </div>
            )}
            {activeTab === "incidents" && (
              <div className="case-file-incidents space-y-6">
                <section className="case-file-incidents-header rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Case records</div>
                      <h3 className="mt-1 text-xl font-semibold text-neutral-950">Incidents</h3>
                      <p className="mt-1 text-sm text-neutral-600">Record what happened, organise it by Issue, and connect supporting material.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-neutral-500">{filteredIncidents.length} shown of {allIncidents.length}</span>
                      <button type="button" onClick={() => openRecordModal("incidents")} className="case-file-incidents-primary-action">+ New Incident</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    {incidentSummaryCards.map((card) => (
                      <div key={card.label} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{card.label}</div>
                        <div className="mt-2 text-2xl font-semibold text-neutral-900">{card.value}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="case-file-incidents-operations grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Needs Attention</div>
                    <div className="mt-3 space-y-2">
                      {incidentAttentionIssues.length > 0 ? (
                        incidentAttentionIssues.map((issue) => (
                          <button
                            key={issue.key}
                            type="button"
                            onClick={() => applyIncidentAttentionFilter(issue.filter)}
                            className="block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50"
                          >
                            {issue.text}
                          </button>
                        ))
                      ) : (
                        <div className="rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-sm font-medium text-lime-800">
                          ✅ All incidents appear complete.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Quick Actions</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          incidentSearchInputRef.current?.focus();
                          scrollToIncidentList();
                        }}
                        className="min-h-9 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
                      >
                        Search Incidents
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (incidentAttentionIssues[0]) {
                            applyIncidentAttentionFilter(incidentAttentionIssues[0].filter);
                          } else {
                            scrollToIncidentList();
                          }
                        }}
                        className="min-h-9 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
                      >
                        Review Needs Attention
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIncidentSequenceGroupFilter("__ungrouped__");
                          scrollToIncidentList();
                        }}
                        className="min-h-9 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
                      >
                        Show Ungrouped
                      </button>
                      <button
                        type="button"
                        onClick={openSequenceGroupManager}
                        className="min-h-9 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-lime-300 hover:bg-lime-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
                      >
                        Issues
                      </button>
                    </div>
                  </div>
                </section>

                <section className="case-file-incidents-controls rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Filters</div>
                    <div className="text-xs font-medium text-neutral-500">
                      {filteredIncidents.length} matching incident{filteredIncidents.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="incident-search">
                        Search Incidents
                      </label>
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                        <input
                          id="incident-search"
                          ref={incidentSearchInputRef}
                          type="search"
                          value={incidentSearch}
                          onChange={(event) => setIncidentSearch(event.target.value)}
                          placeholder="Search incidents, tags, linked parties, evidence, documents, or Issue"
                          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Issue
                        <select
                          value={incidentSequenceGroupFilter}
                          onChange={(event) => setIncidentSequenceGroupFilter(event.target.value)}
                          className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 outline-none transition-colors focus:border-lime-500 sm:w-60"
                        >
                          <option value={TIMELINE_ALL_ISSUES_FILTER}>All Issues</option>
                          <option value={TIMELINE_UNASSIGNED_ISSUES_FILTER}>Incidents without an Issue</option>
                          {timelineIssueOptions.map((issue) => (
                            <option key={issue.id} value={issue.id}>
                              {issue.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Filter
                        <select
                          value={incidentFilter}
                          onChange={(event) => setIncidentFilter(event.target.value)}
                          className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 outline-none transition-colors focus:border-lime-500 sm:w-56"
                        >
                          <option value="all">All incidents</option>
                          <option value="needs-attention">Needs attention</option>
                          <option value="missing-evidence">Without evidence</option>
                          <option value="missing-parties">Without parties</option>
                          <option value="missing-documents">Without documents</option>
                          <option value="ready-review">Ready for review</option>
                          <option value="recent">Recent</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Sort
                        <select
                          value={incidentSort}
                          onChange={(event) => setIncidentSort(event.target.value)}
                          className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 outline-none transition-colors focus:border-lime-500 sm:w-52"
                        >
                          <option value="newest-first">Newest First</option>
                          <option value="oldest-first">Oldest First</option>
                          <option value="most-evidence">Most Evidence</option>
                          <option value="least-evidence">Least Evidence</option>
                          <option value="ready-review">Ready for Review</option>
                          <option value="needs-attention">Needs Attention</option>
                        </select>
                      </label>
                      {(incidentSearch || incidentFilter !== "all" || incidentSequenceGroupFilter !== "all") && (
                        <button
                          type="button"
                          onClick={() => {
                            setIncidentSearch("");
                            setIncidentFilter("all");
                            setIncidentSequenceGroupFilter(TIMELINE_ALL_ISSUES_FILTER);
                          }}
                          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <section id="incident-list" className="space-y-4 scroll-mt-24">
                  <div className="flex flex-wrap gap-2">
                    {incidentQuickFilterChips.map((chip) => {
                      const selected = activeQuickIncidentFilter === chip.id || (chip.id === "all" && activeQuickIncidentFilter === "all");
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => applyIncidentQuickFilter(chip.id)}
                          className={`min-h-8 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1 ${
                            selected
                              ? "border-lime-500 bg-lime-50 text-lime-800"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-lime-300 hover:bg-lime-50"
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Incident List</h3>
                    <span className="text-xs font-medium text-neutral-500">
                      {filteredIncidents.length} incident{filteredIncidents.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {renderListBlock(
                    sortedFilteredIncidents,
                    allIncidents.length === 0
                      ? "No incidents yet. Add your first incident to start the case timeline."
                      : "No incidents match the current filters.",
                    "incidents",
                    { preserveOrder: true }
                  )}
                </section>
              </div>
            )}
            {activeTab === "strategy" && (
              <StrategyWorkspace
                caseItem={selectedCase}
                strategies={selectedCase.strategy || []}
                onAddStrategy={() => openRecordModal("strategy")}
                onUpdateCase={onUpdateCase}
                renderStrategyCard={(strategy) => renderRecordCard(strategy, "strategy")}
              />
            )}
            {activeTab === "watch" && (
              <WatchWorkspace caseItem={selectedCase} onUpdateCase={onUpdateCase} />
            )}
            {activeTab === "parties" && (
              <PartiesTab
                parties={selectedCase.parties || []}
                onSaveParty={saveParty}
                onDeleteParty={deleteParty}
              />
            )}
            {activeTab === "generate-report" && (
              <div className="case-file-reports space-y-5">
                <div className="case-file-reports-header rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="case-file-reports-eyebrow">Case reporting</p>
                      <h3 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Reports Centre</h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                        Prepare a source-grounded report, review its scope, then export or print a copy. ProveIt remains the authoritative case record.
                      </p>
                    </div>
                  </div>
                </div>

                <ReportCentreControls
                  reportType={reportCentreType}
                  scopeType={normalisedReportCentreScopeType}
                  issues={reportCentreIssues}
                  selectedIssueId={reportCentreIssueSelection.requestedIssueId}
                  externalDraftingScopeType={externalDraftingScopeType}
                  externalDraftingIssueAvailable={Boolean(externalDraftingScope.scope)}
                  activeDestination={reportCentreDestination}
                  onFamilyChange={handleReportCentreFamilyChange}
                  onOpenSavedReports={handleOpenSavedReports}
                  onReportTypeChange={handleReportCentreTypeChange}
                  onScopeTypeChange={handleReportCentreScopeChange}
                  onIssueChange={handleReportCentreIssueChange}
                  onExternalDraftingScopeChange={handleExternalDraftingScopeChange}
                  onCopyExternalDraftingJson={handleCopyExternalDraftingJson}
                  onCopyExternalDraftingMarkdown={handleCopyExternalDraftingMarkdown}
                  onCopyExternalDraftingSpecialistPrompt={handleCopyExternalDraftingSpecialistPrompt}
                  onPrint={handleReportCentrePrint}
                  onCopyMarkdown={handleCopyReportCentreMarkdown}
                  onDownloadMarkdown={() => handleDownloadReportCentreOutput("markdown")}
                  onDownloadJson={() => handleDownloadReportCentreOutput("json")}
                  onOpenSequenceGroupAudit={openSequenceGroupAuditExport}
                  onOpenAdvancedReports={() => document.getElementById("case-documentation")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                />

                {reportCentreDestination === "saved" ? (
                  <section className="case-file-reports-review space-y-4" aria-labelledby="saved-reports-heading">
                    <div className="case-file-reports-section-heading">
                      <p className="case-file-reports-eyebrow">Saved Reports</p>
                      <h4 id="saved-reports-heading">Executive Report Drafts</h4>
                    </div>
                    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 print:hidden dark:border-neutral-700 dark:bg-neutral-900">
                      <p className="text-sm text-neutral-600 dark:text-neutral-300">Saved Drafts are immutable, unapproved historical snapshots. Only Executive Report Drafts can currently be saved.</p>
                      {savedExecutiveDrafts.length ? <ul className="mt-4 space-y-2" aria-label="Saved Executive Report Drafts">
                        {savedExecutiveDrafts.map((draft) => {
                          const document = draft.revision.content.reportDocument;
                          const scope = document.source?.scope?.type === "sequenceGroup"
                            ? `${document.source?.scope?.issueReference || "Issue"} — ${document.source?.scope?.issueName || document.source?.scope?.sequenceGroupName || "Historical Issue"}`
                            : "Whole case";
                          return <li key={draft.revision.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-950 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{draft.manifest.title}</p><p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{scope} · Revision {draft.revision.versionNumber} · Draft · {draft.freshness} source · {new Date(draft.revision.createdAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setSavedExecutiveRevisionId(draft.revision.id); setExecutiveRevisionTargetReportId(""); setExecutiveDraftFeedback(""); setReportCentreType("executive"); setReportCentreDestination("reports"); }} className="case-file-reports-utility-action">Open snapshot</button><button type="button" onClick={() => handleCreateExecutiveRevision(draft)} className="case-file-reports-utility-action">New revision</button></div></li>;
                        })}
                      </ul> : <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">No Executive Report Drafts have been saved for this case.</p>}
                      <div className="mt-4"><button type="button" onClick={() => { setSavedExecutiveRevisionId(""); setExecutiveRevisionTargetReportId(""); setExecutiveDraftFeedback(""); setReportCentreType("executive"); setReportCentreDestination("reports"); }} className="case-file-reports-utility-action">Open live Executive Report</button></div>
                      {executiveDraftFeedback ? <p className="mt-3 text-sm font-medium" role="status">{executiveDraftFeedback}</p> : null}
                    </section>
                  </section>
                ) : (
                <section className="case-file-reports-review space-y-4" aria-labelledby="report-review-heading">
                  <div className="case-file-reports-section-heading">
                    <p className="case-file-reports-eyebrow">Review</p>
                    <h4 id="report-review-heading">Review the selected report</h4>
                  </div>
                  <ReportContextHeader
                    definition={getReportDefinition(reportCentreType)}
                    presentationLabel={REPORT_CENTRE_PRESENTATION[reportCentreType]?.label}
                    scopeLabel={renderedReportCentreScopeLabel}
                    countLabel={reportCentreCountLabel}
                    reportDocument={reportCentreActiveDocument}
                    snapshotFreshness={savedExecutiveDraft ? savedExecutiveDrafts.find((draft) => draft.revision.id === savedExecutiveDraft.revision.id)?.freshness || "unknown" : ""}
                  />
                  <ReportCentrePreviewSummary
                    reportType={reportCentreType}
                    scopeType={normalisedReportCentreScopeType}
                    scopeLabel={renderedReportCentreScopeLabel}
                  />
                  <div className="case-file-reports-document-layout">
                  <section className="case-file-reports-actions-toolbar print:hidden" aria-labelledby="report-export-heading">
                    <div className="min-w-0">
                      <p className="case-file-reports-eyebrow">Document actions</p>
                      <h5 id="report-export-heading" className="mt-1 text-base font-bold">{savedExecutiveDraft ? "Saved snapshot" : "Live preview"}</h5>
                    </div>
                    <ReportOutputActions
                      reportType={reportCentreType}
                      markdownAvailable={Boolean(reportCentreMarkdown)}
                      documentOutputAvailable={Boolean(reportCentreActiveDocument)}
                      disabled={!savedExecutiveDraft && normalisedReportCentreScopeType === "sequenceGroup" && !selectedReportCentreIssue}
                      feedback={reportCentreOutputFeedback}
                      primaryAction={reportCentreType === "executive" && !savedExecutiveDraft ? { label: savingExecutiveDraft ? "Saving Draft…" : executiveRevisionTargetReportId ? "Save new Draft revision" : "Save Draft", onClick: handleSaveExecutiveDraft, disabled: savingExecutiveDraft || (normalisedReportCentreScopeType === "sequenceGroup" && !selectedReportCentreIssue) } : null}
                      onCopyMarkdown={handleCopyReportCentreMarkdown}
                      onDownloadMarkdown={() => handleDownloadReportCentreOutput("markdown")}
                      onDownloadJson={() => handleDownloadReportCentreOutput("json")}
                      onPrint={handleReportCentrePrint}
                    />
                  </section>
                  <section className="case-file-reports-document-preview" aria-label="Selected report preview">

                  {savedExecutiveDraft ? <div className="rounded-lg border border-teal-700/40 bg-teal-950/20 px-3 py-2 text-sm print:hidden" role="status">Viewing an immutable saved Draft snapshot · source freshness: {savedExecutiveDrafts.find((draft) => draft.revision.id === savedExecutiveDraft.revision.id)?.freshness || "unknown"}. This content is not regenerated. <button type="button" onClick={() => { setSavedExecutiveRevisionId(""); setReportCentreDestination("saved"); }} className="ml-2 font-bold underline">Return to Saved Reports</button></div> : null}

                  {normalisedReportCentreScopeType === "sequenceGroup" && reportCentreActiveDocument && !["caseAudit", "investigation", "executive"].includes(reportCentreType) && reportCentreCountLabel.startsWith("0 ") ? (
                    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">No matching records appear in this {getReportDefinition(reportCentreType).label}.</p>
                      <p className="mt-1">The Issue exists, but contains no {reportCentreType === "incidentSchedule" ? "directly assigned incidents" : reportCentreType === "chronologyReport" ? "directly assigned records for its chronology" : `directly assigned or permitted linked ${reportCentreType === "evidence" ? "evidence records" : reportCentreType === "document" ? "documents" : "ledger entries"}`}. Check the Issue assignment and selected scope.</p>
                    </div>
                  ) : null}

                  {normalisedReportCentreScopeType === "sequenceGroup" && reportCentreType === "caseAudit" && reportCentreCaseAuditDocument?.summary?.scopedRecordCount === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">This Issue contains no directly assigned records to audit.</p>
                      <p className="mt-1">{reportCentreCaseAuditDocument?.source?.scope?.isValid ? "The selected Issue exists as metadata or is currently empty." : "The selected Issue could not be resolved from the current case structure."}</p>
                    </div>
                  ) : null}

                  {normalisedReportCentreScopeType === "sequenceGroup" && !selectedReportCentreIssue && !savedExecutiveDraft ? (
                    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{reportCentreIssueSelection.requestedIssueId ? "The selected Issue is no longer available." : `No Issue is selected for ${getReportDefinition(reportCentreType).label}.`}</p>
                      <p className="mt-1">Select an existing Issue to build the scoped preview. ProveIt has not substituted a different Issue.</p>
                    </div>
                  ) : (
                    <>
                      {reportCentreType === "executive" && <ExecutiveReportArticle reportDocument={reportCentreActiveDocument} />}
                      {reportCentreType === "management" && <ManagementReportArticle reportDocument={reportCentreManagementDocument} />}
                      {reportCentreType === "investigation" && <InvestigationReportArticle reportDocument={reportCentreInvestigationDocument} />}
                      {reportCentreType === "evidence" && (
                        <EvidencePackReportArticle
                          report={reportCentreEvidencePackReport}
                          className="case-file-report-article px-6 py-7 print:px-0 print:py-0"
                        />
                      )}
                      {reportCentreType === "document" && (
                        <DocumentPackReportArticle
                          report={reportCentreDocumentPackReport}
                          className="case-file-report-article px-6 py-7 print:px-0 print:py-0"
                        />
                      )}
                      {reportCentreType === "ledger" && (
                        <LedgerPackReportArticle
                          report={reportCentreLedgerPackReport}
                          className="case-file-report-article px-6 py-7 print:px-0 print:py-0"
                        />
                      )}
                      {reportCentreType === "incidentSchedule" && <IncidentScheduleReportArticle reportDocument={reportCentreIncidentDocument} />}
                      {reportCentreType === "chronologyReport" && <ChronologyReportArticle reportDocument={reportCentreChronologyDocument} />}
                      {reportCentreType === "caseAudit" && <CaseAuditReportArticle reportDocument={reportCentreCaseAuditDocument} />}
                      {reportCentreType === "client" && (
                        <div className="case-file-report-client space-y-5">
                          <ol aria-label="Client Report authoring stages" className="grid gap-2 text-xs font-semibold print:hidden sm:grid-cols-3 lg:grid-cols-6">
                            {["1. Prepare source", "2. Generate draft", "3. Paste and validate", "4. Review", "5. Preview", "6. Export"].map((stage) => <li key={stage} className="rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">{stage}</li>)}
                          </ol>
                          <div className="flex flex-col items-start gap-2 print:hidden">
                            <div className="flex flex-wrap justify-start gap-2">
                              <button
                                type="button"
                                onClick={() => copyGeneratedReportPrompt("en")}
                                className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors hover:bg-lime-400/30"
                              >
                                Copy GPT Prompt (EN)
                              </button>
                              <button
                                type="button"
                                onClick={() => copyGeneratedReportPrompt("de")}
                                className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors hover:bg-lime-400/30"
                              >
                                Copy GPT Prompt (DE)
                              </button>
                            </div>
                            {reportPromptFeedback ? (
                              <p className="text-xs font-medium text-neutral-500">{reportPromptFeedback}</p>
                            ) : null}
                          </div>
                          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden">
                            <div className="flex flex-col gap-3 border-b border-neutral-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Paste GPT-Generated Report Output</h4>
                                <p className="mt-1 text-sm text-neutral-600">
                                  Paste the GPT-generated {activeGeneratedReportLanguage.toUpperCase()} report for the selected report version. Do not paste the prompt itself. The pasted text should begin with `# REPORT_TITLE` and the report title section.
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-neutral-500">Report version</span>
                                <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                                  {REPORT_DISPLAY_LANGUAGES.map((language) => (
                                    <button
                                      key={language}
                                      type="button"
                                      onClick={() => handleGeneratedReportLanguageChange(language)}
                                      className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                                        activeGeneratedReportLanguage === language
                                          ? "bg-lime-500 text-white shadow-sm"
                                          : "text-neutral-600 hover:bg-white"
                                      }`}
                                    >
                                      {language}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <textarea
                              value={generatedReportDraft}
                              onChange={(event) => setGeneratedReportDraft(event.target.value)}
                              rows={18}
                              className="mt-4 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm leading-6 text-neutral-800 outline-none transition-colors focus:border-lime-500 focus:bg-white"
                              placeholder={`# REPORT_TITLE\nClient Report\n\n# YOUR_SITUATION\n...`}
                            />
                            {generatedReportLooksLikePrompt && (
                              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                                This looks like the GPT prompt, not the generated report output. Paste the report that GPT returned, starting with `# REPORT_TITLE`.
                              </div>
                            )}
                            {(generatedReportValidation.errors.length > 0 || generatedReportValidation.warnings.length > 0) && generatedReportDraft.trim() ? (
                              <div role="alert" className="mt-4 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                                {[...generatedReportValidation.errors, ...generatedReportValidation.warnings].map((item) => <p key={`${item.code}:${item.message}`}><strong>{item.severity === "warning" ? "Warning" : "Validation"}:</strong> {item.message}</p>)}
                              </div>
                            ) : null}
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs text-neutral-500">
                                The parser reads only the known ProveIt Report Format v1 sections and ignores everything else.
                              </p>
                              <button
                                type="button"
                                onClick={handleRenderGeneratedReport}
                                disabled={!generatedReportValidation.valid}
                                className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors hover:bg-lime-400/30"
                              >
                                Save & Render {activeGeneratedReportLanguage.toUpperCase()} Report
                              </button>
                            </div>
                          </section>

                          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-3 border-b border-neutral-100 pb-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
                              <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Rendered Report</h4>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-neutral-500">Report version</span>
                                <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                                  {REPORT_DISPLAY_LANGUAGES.map((language) => (
                                    <button
                                      key={language}
                                      type="button"
                                      onClick={() => handleGeneratedReportLanguageChange(language)}
                                      className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                                        activeGeneratedReportLanguage === language
                                          ? "bg-lime-500 text-white shadow-sm"
                                          : "text-neutral-600 hover:bg-white"
                                      }`}
                                    >
                                      {language}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {!reportCentreClientDocument ? (
                              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                                No validated Client Report draft is available. Prepare the source, copy the prompt, paste the generated response, and resolve validation errors before preview or export.
                              </div>
                            ) : (
                              <ClientReportArticle reportDocument={reportCentreClientDocument} />
                            )}
                          </section>
                        </div>
                      )}
                      {reportCentreType === "action" && <ActionPlanReportArticle reportDocument={reportCentreActionDocument} />}
                    </>
                  )}
                  </section>
                  </div>
                </section>
                )}

                <details id="case-documentation" className="case-file-reports-documentation scroll-mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden dark:border-neutral-700 dark:bg-neutral-900">
                  <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 dark:text-neutral-400">
                    Case Documentation &amp; Specialist Formats
                  </summary>
                  <div className="mt-5 space-y-5">
                    <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      Prepare deterministic case documentation here. Previews contain record summaries and references; they do not embed original attachments. Printing or downloading does not approve or permanently save a report.
                    </p>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExecutiveSummaryReportOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {executiveSummaryReportOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Executive Summary
                    </span>
                  </button>

                  {executiveSummaryReportOpen && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 print:hidden">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-600">GPT Narrative Polish</h4>
                            <p className="mt-1 text-sm text-neutral-600">
                              Optional wording pass only. The deterministic report remains the source of truth.
                            </p>
                            <p className="mt-1 text-xs font-semibold text-amber-700">Review before sharing.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleCopyExecutiveSummaryPolishPrompt}
                              className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30"
                            >
                              Copy narrative polish prompt
                            </button>
                            <button
                              type="button"
                              onClick={handleClearExecutiveSummaryPolish}
                              disabled={!executiveSummaryPolishDraft.trim()}
                              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Clear polish
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                          {executiveSummaryPolishDraft.trim() ? (
                            <span className="rounded-full border border-lime-200 bg-lime-50 px-2 py-1 text-lime-800">
                              Using polished narrative. Missing sections will use deterministic fallback.
                            </span>
                          ) : (
                            <span className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-neutral-500">
                              Using deterministic version
                            </span>
                          )}
                          {executiveSummaryPolishFeedback && (
                            <span className="text-lime-700">{executiveSummaryPolishFeedback}</span>
                          )}
                        </div>
                        <textarea
                          value={executiveSummaryPolishDraft}
                          onChange={(event) => {
                            setExecutiveSummaryPolishDraft(event.target.value);
                            setExecutiveSummaryPolishFeedback(event.target.value.trim() ? "Showing polished narrative preview. Review before sharing." : "");
                          }}
                          placeholder={"Paste polished markdown here. Expected headings:\n## Executive Summary\n## Management Question\n## Key Findings\n## Risk Snapshot\n## Recommended Actions\n## Supporting Appendix Summary\n## Short Chronology Preview"}
                          className="mt-4 min-h-36 w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs outline-none focus:border-lime-500"
                        />
                      </div>
                      {executiveSummaryReport ? (
                        <ExecutiveSummaryReportArticle
                          report={executiveSummaryReport}
                          polishedMarkdown={executiveSummaryPolishDraft}
                          className="mx-auto max-w-5xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm"
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                          Select a case to preview the executive summary.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setCaseBundleReportOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {caseBundleReportOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Case Bundle
                    </span>
                  </button>

                  {caseBundleReportOpen && (
                    <div className="mt-4 space-y-5">
                      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 print:hidden lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="case-bundle-scope">
                            Scope
                          </label>
                          <select
                            id="case-bundle-scope"
                            value={caseBundleScopeType}
                            onChange={(event) => setCaseBundleScopeType(event.target.value)}
                            className="mt-2 w-full min-w-44 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                          >
                            <option value="case">Whole case</option>
                            <option value="sequenceGroup">Issue</option>
                          </select>
                        </div>
                        {caseBundleScopeType === "sequenceGroup" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="case-bundle-sequence-group">
                              Issue
                            </label>
                            {reportCentreIssues.length > 0 ? <>
                              <select
                                id="case-bundle-sequence-group"
                                value={caseBundleIssueId}
                                onChange={(event) => setCaseBundleIssueId(event.target.value)}
                                className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                              >
                                <option value="">Select an Issue</option>
                                {reportCentreIssues.map((issue) => (
                                  <option key={issue.id} value={issue.id}>{issue.label}</option>
                                ))}
                              </select>
                              {caseBundleIssueSelection.requestedIssueId && !selectedCaseBundleIssue ? (
                                <p className="mt-2 text-sm text-amber-700" role="status">Issue no longer available. Choose another Issue.</p>
                              ) : null}</> : (
                              <p className="mt-2 text-sm text-neutral-600">No Issues exist in this case yet.</p>
                            )}
                          </div>
                        )}
                        <div className="flex max-w-xl flex-wrap gap-2">
                          {[
                            ["threadIssue", "Thread / Issue"],
                            ["evidencePack", "Evidence"],
                            ["documentPack", "Documents"],
                            ["ledgerPack", "Ledger"],
                            ["strategyActions", "Strategy / Actions"],
                            ["diagnosticsSummary", "Diagnostics"],
                          ].map(([key, label]) => (
                            <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">
                              <input
                                type="checkbox"
                                checked={caseBundleSections[key]}
                                onChange={() => toggleCaseBundleSection(key)}
                                className="h-3.5 w-3.5 accent-lime-500"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={caseBundleScopeType === "sequenceGroup" && !selectedCaseBundleIssue}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
                        >
                          Print / Save PDF
                        </button>
                      </div>
                      {caseBundleReport ? (
                        <CaseBundleReportArticle
                          report={caseBundleReport}
                          className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm"
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                          Select a case to preview the case bundle.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setThreadIssueReportOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {threadIssueReportOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Thread / Issue Report
                    </span>
                  </button>

                  {threadIssueReportOpen && (
                    <div className="mt-4 space-y-5">
                      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 print:hidden sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="thread-issue-report-sequence-group">
                            Issue
                          </label>
                          {reportCentreIssues.length > 0 ? <>
                            <select
                              id="thread-issue-report-sequence-group"
                              value={threadIssueReportIssueId}
                              onChange={(event) => setThreadIssueReportIssueId(event.target.value)}
                              className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                            >
                              <option value="">Select an Issue</option>
                              {reportCentreIssues.map((issue) => (
                                <option key={issue.id} value={issue.id}>{issue.label}</option>
                              ))}
                            </select>
                            {threadIssueReportIssueSelection.requestedIssueId && !selectedThreadIssueReportIssue ? (
                              <p className="mt-2 text-sm text-amber-700" role="status">Issue no longer available. Choose another Issue.</p>
                            ) : null}</> : (
                            <p className="mt-2 text-sm text-neutral-600">
                              No Issues exist in this case yet.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            ["diagnostics", "Diagnostics"],
                            ["documents", "Documents"],
                            ["ledger", "Ledger"],
                            ["strategy", "Strategy / Actions"],
                          ].map(([key, label]) => (
                            <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">
                              <input
                                type="checkbox"
                                checked={threadIssueReportVisibility[key]}
                                onChange={() => toggleThreadIssueReportSection(key)}
                                className="h-3.5 w-3.5 accent-lime-500"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={!selectedThreadIssueReportIssue}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
                        >
                          Print / Save PDF
                        </button>
                      </div>
                      {threadIssueReport ? (
                        <ThreadIssueReportArticle
                          report={threadIssueReport}
                          visibility={threadIssueReportVisibility}
                          className="mx-auto max-w-5xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm"
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                          Select a case and Issue to preview the thread report.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setLedgerPackReportOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {ledgerPackReportOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Ledger Pack
                    </span>
                  </button>

                  {ledgerPackReportOpen && (
                    <div className="mt-4 space-y-5">
                      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 print:hidden lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="ledger-pack-scope">
                            Scope
                          </label>
                          <select
                            id="ledger-pack-scope"
                            value={ledgerPackScopeType}
                            onChange={(event) => setLedgerPackScopeType(event.target.value)}
                            className="mt-2 w-full min-w-44 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                          >
                            <option value="case">Whole case</option>
                            <option value="sequenceGroup">Issue</option>
                          </select>
                        </div>
                        {ledgerPackScopeType === "sequenceGroup" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="ledger-pack-sequence-group">
                              Issue
                            </label>
                            {reportCentreIssues.length > 0 ? <>
                              <select
                                id="ledger-pack-sequence-group"
                                value={ledgerPackIssueId}
                                onChange={(event) => setLedgerPackIssueId(event.target.value)}
                                className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                              >
                                <option value="">Select an Issue</option>
                                {reportCentreIssues.map((issue) => (
                                  <option key={issue.id} value={issue.id}>{issue.label}</option>
                                ))}
                              </select>
                              {ledgerPackIssueSelection.requestedIssueId && !selectedLedgerPackIssue ? (
                                <p className="mt-2 text-sm text-amber-700" role="status">Issue no longer available. Choose another Issue.</p>
                              ) : null}</> : (
                              <p className="mt-2 text-sm text-neutral-600">No Issues exist in this case yet.</p>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={ledgerPackScopeType === "sequenceGroup" && !selectedLedgerPackIssue}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
                        >
                          Print / Save PDF
                        </button>
                      </div>
                      {ledgerPackReport ? (
                        <LedgerPackReportArticle
                          report={ledgerPackReport}
                          className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm"
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                          Select a case to preview the ledger pack.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setDocumentPackReportOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {documentPackReportOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Document Pack
                    </span>
                  </button>

                  {documentPackReportOpen && (
                    <div className="mt-4 space-y-5">
                      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 print:hidden lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="document-pack-scope">
                            Scope
                          </label>
                          <select
                            id="document-pack-scope"
                            value={documentPackScopeType}
                            onChange={(event) => setDocumentPackScopeType(event.target.value)}
                            className="mt-2 w-full min-w-44 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                          >
                            <option value="case">Whole case</option>
                            <option value="sequenceGroup">Issue</option>
                          </select>
                        </div>
                        {documentPackScopeType === "sequenceGroup" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="document-pack-sequence-group">
                              Issue
                            </label>
                            {reportCentreIssues.length > 0 ? <>
                              <select
                                id="document-pack-sequence-group"
                                value={documentPackIssueId}
                                onChange={(event) => setDocumentPackIssueId(event.target.value)}
                                className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                              >
                                <option value="">Select an Issue</option>
                                {reportCentreIssues.map((issue) => (
                                  <option key={issue.id} value={issue.id}>{issue.label}</option>
                                ))}
                              </select>
                              {documentPackIssueSelection.requestedIssueId && !selectedDocumentPackIssue ? (
                                <p className="mt-2 text-sm text-amber-700" role="status">Issue no longer available. Choose another Issue.</p>
                              ) : null}</> : (
                              <p className="mt-2 text-sm text-neutral-600">No Issues exist in this case yet.</p>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={documentPackScopeType === "sequenceGroup" && !selectedDocumentPackIssue}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
                        >
                          Print / Save PDF
                        </button>
                      </div>
                      {documentPackReport ? (
                        <DocumentPackReportArticle
                          report={documentPackReport}
                          className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm"
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                          Select a case to preview the document pack.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setEvidencePackReportOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {evidencePackReportOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Evidence Pack
                    </span>
                  </button>

                  {evidencePackReportOpen && (
                    <div className="mt-4 space-y-5">
                      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 print:hidden lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="evidence-pack-scope">
                            Scope
                          </label>
                          <select
                            id="evidence-pack-scope"
                            value={evidencePackScopeType}
                            onChange={(event) => setEvidencePackScopeType(event.target.value)}
                            className="mt-2 w-full min-w-44 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                          >
                            <option value="case">Whole case</option>
                            <option value="sequenceGroup">Issue</option>
                          </select>
                        </div>
                        {evidencePackScopeType === "sequenceGroup" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="evidence-pack-sequence-group">
                              Issue
                            </label>
                            {reportCentreIssues.length > 0 ? <>
                              <select
                                id="evidence-pack-sequence-group"
                                value={evidencePackIssueId}
                                onChange={(event) => setEvidencePackIssueId(event.target.value)}
                                className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                              >
                                <option value="">Select an Issue</option>
                                {reportCentreIssues.map((issue) => (
                                  <option key={issue.id} value={issue.id}>{issue.label}</option>
                                ))}
                              </select>
                              {evidencePackIssueSelection.requestedIssueId && !selectedEvidencePackIssue ? (
                                <p className="mt-2 text-sm text-amber-700" role="status">Issue no longer available. Choose another Issue.</p>
                              ) : null}</> : (
                              <p className="mt-2 text-sm text-neutral-600">No Issues exist in this case yet.</p>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={evidencePackScopeType === "sequenceGroup" && !selectedEvidencePackIssue}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
                        >
                          Print / Save PDF
                        </button>
                      </div>
                      {evidencePackReport ? (
                        <EvidencePackReportArticle
                          report={evidencePackReport}
                          className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm"
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                          Select a case to preview the evidence pack.
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setClientReportGeneratorOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {clientReportGeneratorOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Client Report
                    </span>
                  </button>

                  {clientReportGeneratorOpen && (
                    <div className="mt-4 space-y-5">
                      <div className="flex flex-col items-start gap-2 print:hidden">
                        <div className="flex flex-wrap justify-start gap-2">
                          <button
                            type="button"
                            onClick={() => copyGeneratedReportPrompt("en")}
                            className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                          >
                            Copy GPT Prompt (EN)
                          </button>
                          <button
                            type="button"
                            onClick={() => copyGeneratedReportPrompt("de")}
                            className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                          >
                            Copy GPT Prompt (DE)
                          </button>
                        </div>
                        {reportPromptFeedback ? (
                          <p className="text-xs font-medium text-neutral-500">{reportPromptFeedback}</p>
                        ) : null}
                      </div>
                      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Paste GPT-Generated Report Output</h4>
                            <p className="mt-1 text-sm text-neutral-600">
                              Paste the GPT-generated {activeGeneratedReportLanguage.toUpperCase()} report for the selected report version. Do not paste the prompt itself. The pasted text should begin with `# REPORT_TITLE` and the report title section.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 print:hidden">
                            <span className="text-xs font-semibold text-neutral-500">Report version</span>
                            <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                              {REPORT_DISPLAY_LANGUAGES.map((language) => (
                                <button
                                  key={language}
                                  type="button"
                                  onClick={() => handleGeneratedReportLanguageChange(language)}
                                  className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                                    activeGeneratedReportLanguage === language
                                      ? "bg-lime-500 text-white shadow-sm"
                                      : "text-neutral-600 hover:bg-white"
                                  }`}
                                >
                                  {language}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <textarea
                          value={generatedReportDraft}
                          onChange={(event) => setGeneratedReportDraft(event.target.value)}
                          rows={18}
                          className="mt-4 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm leading-6 text-neutral-800 outline-none transition-colors focus:border-lime-500 focus:bg-white"
                          placeholder={`# REPORT_TITLE\nClient Report\n\n# YOUR_SITUATION\n...`}
                        />
                        {generatedReportLooksLikePrompt && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                            This looks like the GPT prompt, not the generated report output. Paste the report that GPT returned, starting with `# REPORT_TITLE`.
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-neutral-500">
                            The parser reads only the known ProveIt Report Format v1 sections and ignores everything else.
                          </p>
                          <button
                            type="button"
                            onClick={handleRenderGeneratedReport}
                            className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                          >
                            Save & Render {activeGeneratedReportLanguage.toUpperCase()} Report
                          </button>
                        </div>
                      </section>

                      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-neutral-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Rendered Report</h4>
                          <div className="flex items-center gap-2 print:hidden">
                            <span className="text-xs font-semibold text-neutral-500">Report version</span>
                            <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                              {REPORT_DISPLAY_LANGUAGES.map((language) => (
                                <button
                                  key={language}
                                  type="button"
                                  onClick={() => handleGeneratedReportLanguageChange(language)}
                                  className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                                    activeGeneratedReportLanguage === language
                                      ? "bg-lime-500 text-white shadow-sm"
                                      : "text-neutral-600 hover:bg-white"
                                  }`}
                                >
                                  {language}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {!generatedReportHasVisibleContent ? (
                          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                            No report content is rendered yet. Paste a ProveIt Report Format v1 response and use Render Report.
                          </div>
                        ) : (
                          <GeneratedClientReportArticle
                            className="mt-4 mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm"
                            displayLanguage={reportDisplayLanguage}
                            headerLogo={proveItHeaderLogo}
                            parsedReport={parsedGeneratedReport}
                            reportCoverSubtitle={reportCoverSubtitle}
                            reportHeaderMeta={reportHeaderMeta}
                            selectedCase={selectedCase}
                          />
                        )}
                      </section>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden">
                  <button
                    type="button"
                    onClick={() => setCaseStructureReportOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {caseStructureReportOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Case Structure Export
                    </span>
                  </button>
                  {caseStructureReportOpen && (
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateCaseStructureReport}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                        >
                          Generate Case Structure Export
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyCaseStructureReport}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                        >
                          Copy Case Structure Export
                        </button>
                      </div>
                      {caseStructureReportFeedback ? (
                        <p className="text-xs font-medium text-neutral-500">{caseStructureReportFeedback}</p>
                      ) : null}
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                        {caseStructureReportText ? (
                          <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-neutral-800">
                            {caseStructureReportText}
                          </pre>
                        ) : (
                          <p className="text-sm text-neutral-600">
                            Generate a deterministic structure report from the current case link map.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                  </div>
                </details>
              </div>
            )}

            {activeTab === "ledger" && (
              <section aria-labelledby="legacy-ledger-heading" className="mb-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 id="legacy-ledger-heading" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Ledger</h3><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">This existing workspace remains available for saved links and legacy navigation.</p></div>
                  <button type="button" onClick={() => setActiveTab("records")} className="rounded-lg border border-lime-500 bg-white px-3 py-1.5 text-sm font-bold text-neutral-800 hover:bg-lime-50 dark:bg-neutral-950 dark:text-neutral-100">Back to Case Records</button>
                </div>
              </section>
            )}

            {activeTab === "ledger" && (
              <LedgerTab
                ledgerEntries={selectedCase?.ledger || []}
                ledgerFilter={ledgerFilter}
                onChangeFilter={setLedgerFilter}
                onOpenLedgerModal={openLedgerModal}
                onDuplicateLedgerEntry={duplicateLedgerEntry}
                onDeleteLedgerEntry={deleteLedgerEntry}
                getLinkedRecordMeta={(recordId) => getRecordDisplayMeta(selectedCase, recordId)}
                onOpenLinkedRecord={openLinkedRecord}
                parties={selectedCase?.parties || []}
              />
            )}

            {activeTab === "documents" && (
              <div className="space-y-6">
                <DocumentsTab
                  documents={(selectedCase?.documents || []).filter((doc) => !isTrackingRecord(doc))}
                  expandedDocuments={expandedDocuments}
                  imageCache={imageCache}
                  onAddDocument={() => openDocumentModal()}
                  onOpenDocument={(doc) => openDocumentModal(doc, doc.id)}
                  onConvertDocument={(doc) => openRecordConversion("documents", doc)}
                  onDeleteDocument={(doc) => deleteDocumentEntry(doc.id)}
                  onToggleDocumentExpanded={toggleDocumentExpanded}
                  onPreviewFile={onPreviewFile}
                  getLinkedRecordMeta={(recordId) => getRecordDisplayMeta(selectedCase, recordId)}
                  onOpenLinkedRecord={openLinkedRecord}
                  parties={selectedCase?.parties || []}
                />
                {parsedTrackingRecords.length > 0 && (
                  <section className="hidden">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900">Tracking Records</h3>
                        <p className="mt-1 text-xs text-blue-800">
                          Structured trackers parsed from document text. Payment rows are previewed separately from normal documents.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                        {parsedTrackingRecords.length} tracking record{parsedTrackingRecords.length === 1 ? "" : "s"} · {derivedTrackingLedger.length} generated ledger entr{derivedTrackingLedger.length === 1 ? "y" : "ies"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {parsedTrackingRecords.map((record) => {
                        const tableRows = record.table || [];
                        const tableHeaders = getRecordTableHeaders(tableRows);
                        const previewRows = tableRows.slice(0, 5);
                        const usedByIncidents = getIncidentsUsingRecord(selectedCase, record.id);
                        const basedOnEvidence = getBasedOnEvidenceForTrackingRecord(record);

                        return (
                        <div key={record.id} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-semibold text-neutral-900">{record.title}</span>
                                <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                  {getRecordTypeLabel(record.meta.type)}
                                </span>
                                {record.meta.status && (
                                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRecordStatusClasses(record.meta.status)}`}>
                                    {record.meta.status}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 text-xs text-neutral-600">
                                <div><span className="font-medium text-neutral-800">Subject:</span> {record.meta.subject || "—"}</div>
                                <div><span className="font-medium text-neutral-800">Period:</span> {record.meta.period || "—"}</div>
                                <div><span className="font-medium text-neutral-800">Rows:</span> {tableRows.length}</div>
                                <div><span className="font-medium text-neutral-800">File links:</span> {record.fileLinks.length}</div>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                              <button 
                                onClick={() => setActiveLedgerRecord(record)}
                                className="rounded-lg border border-blue-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-blue-50 transition-colors"
                              >
                                View Payments
                              </button>
                              <button 
                              onClick={() => openDocumentModal(record.rawDocument, record.rawDocument.id, "record")}
                                className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                              >
                                Open / Edit
                              </button>
                              <button 
                                onClick={() => deleteDocumentEntry(record.rawDocument.id)}
                                className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {record.summary && (
                            <p className="mt-3 border-l-2 border-blue-100 pl-3 text-sm text-neutral-700 line-clamp-3">{record.summary}</p>
                          )}

                          {basedOnEvidence.length > 0 && (
                            <div className="mt-1 border-t border-neutral-100 pt-1">
                              {renderCompactLinkRow("Based on Evidence", basedOnEvidence, (evidenceItem) => (
                                <LinkedChip
                                  key={evidenceItem.id}
                                  onClick={() => openLinkedRecord(evidenceItem.id)}
                                  titleText={evidenceItem.title || "Untitled evidence"}
                                  variant="evidence"
                                  className="flex items-center gap-1 text-left transition-colors"
                                  leading={<span className="font-bold uppercase opacity-50">Evidence</span>}
                                >
                                  {evidenceItem.title || "Untitled evidence"}
                                </LinkedChip>
                              ))}
                            </div>
                          )}

                          {usedByIncidents.length > 0 && (
                            <div className="mt-1 border-t border-neutral-100 pt-1">
                              {renderCompactLinkRow("Used By", usedByIncidents, (incident) => (
                                <LinkedChip
                                  key={incident.id}
                                  onClick={() => openLinkedRecord(incident.id)}
                                  titleText={incident.title || "Untitled incident"}
                                  variant="incident"
                                  className="flex items-center gap-1 text-left transition-colors"
                                  leading={<span className="font-bold uppercase opacity-50">Incident</span>}
                                >
                                  {incident.title || "Untitled incident"}
                                </LinkedChip>
                              ))}
                            </div>
                          )}

                          {previewRows.length > 0 ? (
                            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
                              <table className="min-w-full border-collapse text-left text-xs">
                                <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                  <tr>
                                    {tableHeaders.map((header) => (
                                      <th key={header} className="border-b border-neutral-200 px-3 py-2 whitespace-nowrap">
                                        {formatRecordTableHeader(header)}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 bg-white">
                                  {previewRows.map((row, index) => (
                                    <tr key={`${record.id}-row-${index}`} className="align-top">
                                      {tableHeaders.map((header) => {
                                        const value = row[header] || "";
                                        const isStatus = header.toLowerCase() === "status";
                                        const isDifference = header.toLowerCase() === "difference";
                                        return (
                                          <td key={header} className="px-3 py-2 text-neutral-700">
                                            {isStatus && value ? (
                                              <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRecordStatusClasses(value)}`}>
                                                {value}
                                              </span>
                                            ) : (
                                              <span className={isDifference ? `font-semibold ${getDifferenceClasses(value)}` : ""}>
                                                {value || "—"}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {tableRows.length > previewRows.length && (
                                <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                  {tableRows.length - previewRows.length} more row{tableRows.length - previewRows.length === 1 ? "" : "s"}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                              No table rows parsed yet.
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section className="hidden">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setShowStructuredRecords((value) => !value)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span className="mt-0.5 w-3 text-xs text-blue-700">
                        {showStructuredRecords ? "▼" : "▶"}
                      </span>
                      <span>
                        <span className="block text-sm font-bold uppercase tracking-wider text-blue-900">
                          Structured Records (Temporary)
                        </span>
                        <span className="mt-1 block text-xs text-blue-800">
                          Structured trackers and generated payment previews. These are not primary source-material documents.
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                        {parsedTrackingRecords.length} record{parsedTrackingRecords.length === 1 ? "" : "s"}
                      </span>
                      <button
                        onClick={() => openDocumentModal({ title: "New Tracking Record" }, null, "record")}
                        className="rounded-lg border border-blue-400 bg-white px-3 py-1 text-xs font-bold text-neutral-900 shadow-sm hover:bg-blue-50 transition-all active:scale-95"
                      >
                        Add Tracking Record
                      </button>
                    </div>
                  </div>

                  {showStructuredRecords && (
                    <div className="mt-4 space-y-3">
                      {parsedTrackingRecords.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 p-4 text-sm text-blue-800">
                          No temporary structured records yet.
                        </div>
                      ) : (
                        parsedTrackingRecords.map((record) => (
                          <div key={record.id} className="rounded-xl border border-blue-100 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-neutral-900">{record.title}</span>
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                    {record.meta.type || "unknown"}
                                  </span>
                                  {record.meta.status && (
                                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                                      {record.meta.status}
                                    </span>
                                  )}
                                  {renderSequenceGroupChip(record.rawDocument?.sequenceGroup)}
                                </div>

                                <div className="mt-2 grid gap-1 text-xs text-neutral-600 sm:grid-cols-2">
                                  <div><span className="font-medium text-neutral-800">Subject:</span> {record.meta.subject || "—"}</div>
                                  <div><span className="font-medium text-neutral-800">Period:</span> {record.meta.period || "—"}</div>
                                  <div><span className="font-medium text-neutral-800">Rows:</span> {record.table.length}</div>
                                  <div><span className="font-medium text-neutral-800">File links:</span> {record.fileLinks.length}</div>
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                <button
                                  onClick={() => setActiveLedgerRecord(record)}
                                  className="rounded-lg border border-blue-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-blue-50 transition-colors"
                                >
                                  View Payments
                                </button>
                                <button
                                  onClick={() => openDocumentModal(record.rawDocument, record.rawDocument.id, "record")}
                                  className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                                >
                                  Open / Edit
                                </button>
                                <button
                                  onClick={() => deleteDocumentEntry(record.rawDocument.id)}
                                  className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {record.summary && (
                              <p className="mt-2 text-xs text-neutral-700 line-clamp-3">{record.summary}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === "records" && (
              <RecordsTab
                caseItem={selectedCase}
                trackingRecords={parsedTrackingRecords}
                generatedLedgerEntries={derivedTrackingLedger}
                onAddRecord={() => openDocumentModal({ title: "New Tracking Record" }, null, "record")}
                onViewPayments={setActiveLedgerRecord}
                onOpenRecord={(record) => openDocumentModal(record.rawDocument, record.rawDocument.id, "record")}
                onConvertRecord={(record) => openRecordConversion("documents", record.rawDocument)}
                onDeleteRecord={(record) => deleteDocumentEntry(record.rawDocument.id)}
                onSaveTrackingRecordTable={saveTrackingRecordTable}
                getUsedByIncidents={(recordId) => getIncidentsUsingRecord(selectedCase, recordId)}
                getBasedOnEvidence={getBasedOnEvidenceForTrackingRecord}
                onOpenLinkedRecord={openLinkedRecord}
              />
            )}

            {activeTab === "ideas" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Ideas</h3>
                  <button
                    onClick={() =>
                    onUpdateCase({
                      ...selectedCase,
                      ideas: [
                        ...(selectedCase.ideas || []),
                        { id: Date.now().toString(), title: "New idea", description: "", status: "raw" }
                      ]
                    })
                    }
                    className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-medium text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                  >
                    + Idea
                  </button>
                </div>

                {ideas.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                    No ideas yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ideas.map((idea) => (
                      <div key={idea.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                        <input
                          value={idea.title}
                          onChange={(e) => {
                            const updatedIdeas = ideas.map((item) =>
                              item.id === idea.id ? { ...item, title: e.target.value } : item
                            );
                            setIdeas(updatedIdeas);
                            onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
                          }}
                          className="w-full font-bold text-neutral-900 bg-transparent border-none focus:ring-0 p-0"
                        />
                        <textarea
                          value={idea.description}
                          onChange={(e) => {
                            const updatedIdeas = ideas.map((item) =>
                              item.id === idea.id ? { ...item, description: e.target.value } : item
                            );
                            setIdeas(updatedIdeas);
                            onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
                          }}
                          className="w-full text-sm text-neutral-600 bg-transparent border-none focus:ring-0 p-0 resize-none"
                          placeholder="Add a description..."
                          rows={2}
                        />
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-[10px] font-bold uppercase text-neutral-400">Status: {idea.status}</div>
                          <button
                            onClick={() => {
                              const updatedIdeas = ideas.filter((item) => item.id !== idea.id);
                              setIdeas(updatedIdeas);
                              onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
                            }}
                            className="text-[10px] font-bold uppercase text-red-500 hover:text-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "ai-workspace" && (
              <AiWorkspaceTab
                workspaceSections={aiWorkspaceSections}
                activeTaskId={activeAiTask}
                activeTask={activeAiTaskOption}
                activeToolNeedsIssue={activeAiToolNeedsSequenceGroup}
                activeTaskActionKind={activeAiTaskActionKind}
                activeTaskToolId={activeAiTaskToolId}
                activeTaskPurpose={activeAiTaskPurpose}
                activeTaskBestGpt={activeAiTaskBestGpt}
                activeTaskContains={activeAiTaskContains}
                activeTaskDoesNotInclude={activeAiTaskDoesNotInclude}
                activeTaskSafety={activeAiTaskSafety}
                activeTaskWorkflow={activeAiTaskWorkflow}
                activeRecommendedGpt={activeAiRecommendedGpt}
                activeAlsoSuitableGpts={activeAiAlsoSuitableGpts}
                activeExampleQuestions={activeAiExampleQuestions}
                caseQualityReviewModes={CASE_QUALITY_REVIEW_MODES}
                selectedCaseQualityReviewModeId={selectedCaseQualityReviewMode.id}
                issueReviewModes={ISSUE_REVIEW_MODES}
                selectedIssueReviewModeId={selectedIssueReviewMode.id}
                issueOptions={timelineIssueOptions}
                issueSelection={aiToolsSequenceGroup}
                caseName={selectedCase.name}
                caseId={selectedCase.id}
                caseRevision={selectedCase.revision}
                caseSliceRecordIdsText={caseSliceRecordIdsText}
                feedback={aiToolsFeedback}
                onSelectTask={selectAiWorkspaceTask}
                onCaseQualityReviewModeChange={selectCaseQualityReviewMode}
                onIssueReviewModeChange={selectIssueReviewMode}
                onIssueSelectionChange={(value) => { setAiToolsSequenceGroup(value); setAiToolsFeedback(""); }}
                onCaseSliceRecordIdsChange={(value) => { setCaseSliceRecordIdsText(value); setAiToolsFeedback(""); }}
                onCopyRecommendedGptJson={handleCopyRecommendedGptJson}
                onDownloadSplitReasoningPackage={handleDownloadSplitReasoningPackage}
                onDownloadCurrentCase={handleDownloadAiWorkspaceSnapshot}
                onCopyToolJson={handleCopyAiToolJson}
                onCopyToolMarkdown={handleCopyAiToolMarkdown}
                onCopyLinkMap={onCopyLinkMapExport}
                onDownloadProtocolJson={handleDownloadGptProtocolPackJson}
                onDownloadProtocolMarkdown={handleDownloadGptProtocolPackMarkdown}
                onOpenGptUpdate={onOpenGptDeltaModal}
              />
            )}

            {activeTab === "timeline" && (
              <div className="case-file-timeline space-y-4">
                <section className="case-file-timeline-header rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" aria-labelledby="case-timeline-heading">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="case-file-timeline-eyebrow">Case chronology</p>
                      <h3 id="case-timeline-heading" className="case-file-timeline-heading">Timeline</h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        Incidents, evidence, documents, payments, and strategy in one chronological view.
                      </p>
                    </div>
                    <div className="case-file-timeline-total text-xs font-medium text-neutral-500">
                      {timelineItems.length} item{timelineItems.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="case-file-timeline-filters mt-4" role="group" aria-label="Timeline filters">
                    <div className="case-file-timeline-filter-types">
                      {timelineFilterOptions.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => setTimelineView(filter.id)}
                          aria-pressed={timelineView === filter.id}
                          className={`case-file-timeline-filter ${timelineView === filter.id ? "is-selected" : ""}`}
                        >
                          {filter.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setTimelineMilestonesOnly((value) => !value)}
                        aria-pressed={timelineMilestonesOnly}
                        className={`case-file-timeline-filter ${timelineMilestonesOnly ? "is-selected" : ""}`}
                      >
                        Milestones only
                      </button>
                    </div>
                    <div className="case-file-timeline-issue-filter">
                      <select
                        aria-label="Filter timeline by Issue"
                        value={timelineSequenceGroupFilter}
                        onChange={(event) => setTimelineSequenceGroupFilter(event.target.value)}
                        className="case-file-timeline-issue-select"
                      >
                        <option value={TIMELINE_ALL_ISSUES_FILTER}>All Issues</option>
                        <option value={TIMELINE_UNASSIGNED_ISSUES_FILTER}>Records without an Issue</option>
                        {timelineIssueOptions.map((issue) => (
                          <option key={issue.id} value={issue.id}>
                            {issue.label}
                          </option>
                        ))}
                      </select>
                      {timelineSequenceGroupFilter !== TIMELINE_ALL_ISSUES_FILTER && (
                        <button
                          type="button"
                          onClick={() => setTimelineSequenceGroupFilter(TIMELINE_ALL_ISSUES_FILTER)}
                          className="case-file-timeline-clear"
                        >
                          Clear Issue
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {(() => {
                  const filteredTimelineItems = timelineItems.filter((item) => {
                    if (timelineMilestonesOnly && item.isMilestone !== true) return false;
                    if (!isTimelineItemInIssueFilter(selectedCase, item, timelineSequenceGroupFilter)) return false;
                    if (timelineView === "all") return true;
                    if (timelineView === "payment") return item.recordType === "ledger";
                    return item.recordType === timelineView;
                  });

                  if (filteredTimelineItems.length === 0) {
                    return <div className="case-file-timeline-empty rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">No timeline records match this view.</div>;
                  }

                  const timelineGroups = [];
                  filteredTimelineItems.forEach((item) => {
                    const dateLabel = item.date || "No date";
                    const lastGroup = timelineGroups[timelineGroups.length - 1];
                    if (lastGroup?.date === dateLabel) {
                      lastGroup.items.push(item);
                    } else {
                      timelineGroups.push({ date: dateLabel, items: [item] });
                    }
                  });

                  const labelMap = {
                    incident: "Incident",
                    evidence: "Evidence",
                    document: "Document",
                    ledger: "Payment",
                    strategy: "Strategy",
                  };
                  const detailLabelMap = {
                    communication: "Communication",
                    payment: "Payment",
                  };

                  return (
                    <div className="case-file-timeline-results space-y-4" aria-live="polite" aria-atomic="true">
                      <p className="sr-only" role="status">
                        {filteredTimelineItems.length} timeline item{filteredTimelineItems.length === 1 ? "" : "s"} shown.
                      </p>
                      {timelineGroups.map((group) => (
                        <section key={group.date} className="case-file-timeline-date-group space-y-2" aria-label={`${group.date}, ${group.items.length} item${group.items.length === 1 ? "" : "s"}`}>
                          <div className="case-file-timeline-date-heading flex items-center justify-between gap-3 border-b border-neutral-200 pb-1">
                            <h4>{group.date}</h4>
                            <span>
                              {group.items.length} item{group.items.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          {group.items.map((item) => {
                            const isTimelineMilestone =
                              (item.recordType === "incident" || item.recordType === "evidence") && item.isMilestone === true;
                            const itemKey = `${item.recordType}-${item.id}`;
                            const detailsId = `timeline-details-${itemKey}`;
                            const isExpanded = expandedTimelineItems.has(itemKey);
                            const hasFullSummary = item.fullSummary && item.fullSummary !== item.summary;
                            const timelineIssueNavigationTarget = resolveTimelineIssueNavigationTarget(selectedCase, item.source);
                            return (
                              <article
                                key={itemKey}
                                className={`case-file-timeline-event ${isTimelineMilestone ? "is-milestone" : ""}`}
                              >
                                <div className="case-file-timeline-event-date">
                                  {item.date || "No date"}
                                </div>
                                <div className="case-file-timeline-event-content min-w-0">
                                  <div className="case-file-timeline-event-meta">
                                    <span className={`case-file-timeline-type type-${item.recordType}`}>
                                      {labelMap[item.recordType] || item.recordType}
                                    </span>
                                    {detailLabelMap[item.typeDetail] && detailLabelMap[item.typeDetail] !== labelMap[item.recordType] && (
                                      <span className="case-file-timeline-detail">
                                        {detailLabelMap[item.typeDetail]}
                                      </span>
                                    )}
                                    {renderSequenceGroupChip(item.source?.sequenceGroup, {
                                      navigationIssue: timelineIssueNavigationTarget,
                                      onOpenIssue: openSequenceGroupManager,
                                    })}
                                    {isTimelineMilestone && <span className="case-file-timeline-milestone">Milestone</span>}
                                  </div>
                                  <h5 className="case-file-timeline-event-title">{item.title}</h5>
                                  {item.summary ? (
                                    <p className="case-file-timeline-event-summary">{item.summary}</p>
                                  ) : (
                                    <p className="case-file-timeline-event-summary is-empty">No summary yet.</p>
                                  )}
                                  <div className="case-file-timeline-event-actions">
                                    {hasFullSummary && (
                                      <button
                                        type="button"
                                        className="case-file-timeline-disclosure"
                                        aria-expanded={isExpanded}
                                        aria-controls={detailsId}
                                        onClick={() => setExpandedTimelineItems((current) => {
                                          const next = new Set(current);
                                          if (next.has(itemKey)) next.delete(itemKey);
                                          else next.add(itemKey);
                                          return next;
                                        })}
                                      >
                                        {isExpanded ? "Hide full summary" : "Read full summary"}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="case-file-timeline-open-record"
                                      onClick={() => openLinkedRecord(item.id, item.recordType)}
                                      aria-label={`Open ${labelMap[item.recordType] || item.recordType}: ${item.title}`}
                                    >
                                      Open record
                                    </button>
                                  </div>
                                  {hasFullSummary && isExpanded && (
                                    <div id={detailsId} className="case-file-timeline-full-summary">
                                      <span>Full summary</span>
                                      <p>{item.fullSummary}</p>
                                    </div>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </section>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "generate-report" && (
              <section id="internal-case-summary" className="case-file-reports-documentation print-pack-shell space-y-4 text-neutral-800 print:bg-white print:text-black" aria-labelledby="internal-case-summary-heading">
                <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
                  <div>
                    <p className="case-file-reports-eyebrow">Case documentation</p>
                    <h4 id="internal-case-summary-heading" className="mt-1 text-lg font-bold text-neutral-900">Internal Case Summary</h4>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">A derived internal summary of narrative chains, supporting record summaries, gaps, actions, and deadlines. Original attachments are not embedded.</p>
                  </div>
                  <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
                    {[
                      { id: "internal", label: "Internal Case Summary", available: true },
                      { id: "lawyer", label: "Legacy Specialist Format", available: true },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        disabled={!mode.available}
                        aria-disabled={!mode.available}
                        aria-pressed={reportMode === mode.id}
                        onClick={() => mode.available && setReportMode(mode.id)}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                          reportMode === mode.id
                            ? "bg-lime-500 text-white shadow-sm"
                            : "text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
                  >
                    Print / Save PDF
                  </button>
                </div>
                {reportMode === "internal" && (
                <article className="print-pack-article mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
                <header className="print-pack-header break-inside-avoid pb-7 print:pb-6">
                  <div className="flex flex-col gap-5 border-b border-neutral-200 pb-6 sm:flex-row sm:items-center print:pb-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-lime-500 text-white shadow-lg shadow-lime-100 print:h-14 print:w-14 print:rounded-xl print:shadow-none">
                      <ShieldCheck className="h-9 w-9 print:h-8 print:w-8" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-lime-700">Internal Case Summary</div>
                      <h1 className="mt-2 break-words text-3xl font-bold leading-tight text-neutral-950 print:text-2xl">
                        {selectedCase.name || "Untitled Case"}
                      </h1>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">{packExecutiveSummary}</p>
                    </div>
                  </div>
                </header>
                <section className="print-pack-major break-inside-avoid py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Matter Summary</h4>
                  </div>
                  {selectedCase?.caseState?.currentSituation && (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{selectedCase.caseState.currentSituation}</p>
                  )}
                  {!selectedCase?.caseState?.currentSituation && (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{packExecutiveSummary}</p>
                  )}
                  {selectedCase?.caseState?.mainProblem && (
                    <p className="mt-2 text-sm leading-6 text-neutral-700">
                      <span className="font-semibold text-neutral-800">Main issue: </span>
                      {selectedCase.caseState.mainProblem}
                    </p>
                  )}
                </section>

                <section className="print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Core Position</h4>
                  </div>
                  {reportComposer.corePosition.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                      No core position statements are available yet. Add stronger linked evidence and records to the main incident chains.
                    </div>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {reportComposer.corePosition.map((statement) => (
                        <li key={statement} className="rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm leading-6 text-lime-950">
                          {statement}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Key Chains</h4>
                  </div>
                  {reportComposer.keyChains.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                      No key chains are available yet.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-6">
                      {reportComposer.keyChains.map((section, index) => (
                        <section
                          key={`${section.incident.id}-${section.date}-${index}`}
                          className="print-pack-narrative-section break-inside-avoid rounded-2xl border border-neutral-200 bg-neutral-50 p-5"
                        >
                          <div className="border-b border-neutral-200 pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                {section.date || "Undated incident"}
                              </div>
                              <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                Score {section.score}
                              </span>
                            </div>
                            <h5 className="mt-1 text-xl font-semibold text-neutral-950">
                              {section.incident.title || "Untitled incident"}
                            </h5>
                          </div>

                          {section.incident.description ? (
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                              {section.incident.description}
                            </p>
                          ) : (
                            <p className="mt-4 text-sm italic text-neutral-500">
                              No incident description recorded.
                            </p>
                          )}

                          <div className="print-pack-support-grid mt-5 grid gap-4 lg:grid-cols-2">
                            <section className="rounded-xl border border-neutral-200 bg-white p-4">
                              <h6 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Supporting Evidence</h6>
                              {section.supportingEvidence.length > 0 ? (
                                <div className="mt-3 space-y-3">
                                  {section.supportingEvidence.slice(0, 3).map((item) => (
                                    <div key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-neutral-900">{item.title || "Untitled evidence"}</span>
                                        {item.evidenceRole && (
                                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                            {item.evidenceRole.replaceAll("_", " ")}
                                          </span>
                                        )}
                                      </div>
                                      {item.functionSummary ? (
                                        <p className="mt-2 text-sm leading-6 text-neutral-700">{item.functionSummary}</p>
                                      ) : (
                                        <p className="mt-2 text-sm italic text-neutral-500">No function summary recorded.</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm italic text-neutral-500">No supporting evidence linked to this incident.</p>
                              )}
                            </section>

                            <section className="rounded-xl border border-neutral-200 bg-white p-4">
                              <h6 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Supporting Records</h6>
                              {section.supportingRecords.length > 0 ? (
                                <div className="mt-3 space-y-3">
                                  {section.supportingRecords.slice(0, 2).map((item) => (
                                    <div key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-neutral-900">{item.title || "Untitled record"}</span>
                                        {item.recordType && (
                                          <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                            {item.recordType}
                                          </span>
                                        )}
                                      </div>
                                      {item.summary ? (
                                        <p className="mt-2 text-sm leading-6 text-neutral-700">{item.summary}</p>
                                      ) : (
                                        <p className="mt-2 text-sm italic text-neutral-500">No summary recorded.</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm italic text-neutral-500">No supporting records linked to this incident.</p>
                              )}
                            </section>
                          </div>

                          {section.establishes.length > 0 && (
                            <section className="mt-5 rounded-xl border border-lime-200 bg-lime-50 p-4">
                              <h6 className="text-xs font-bold uppercase tracking-wider text-lime-800">Establishes</h6>
                              <ul className="mt-3 space-y-2 text-sm leading-6 text-lime-950">
                                {section.establishes.map((statement) => (
                                  <li key={statement}>- {statement}</li>
                                ))}
                              </ul>
                            </section>
                          )}
                        </section>
                      ))}
                    </div>
                  )}
                </section>
                {reportComposer.supportingContext.length > 0 && (
                  <section className="print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                    <div className="border-b border-neutral-100 pb-3">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Supporting Context</h4>
                    </div>
                    <div className="mt-4 space-y-3">
                      {reportComposer.supportingContext.map((section, index) => (
                        <div key={`${section.incident.id}-${index}`} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold text-neutral-900">{section.incident.title || "Untitled incident"}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                              {section.date || "Undated"} · score {section.score}
                            </div>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-neutral-700">
                            {safeText(section.incident.description).trim() || "No incident description recorded."}
                          </p>
                          <div className="mt-2 text-xs text-neutral-500">
                            {(section.supportingEvidence || []).length} evidence · {(section.supportingRecords || []).length} records · {(section.establishes || []).length} establishes
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <section className="print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Gaps / Weak Points</h4>
                  </div>
                  {reportGapItems.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-sm leading-6 text-neutral-700">
                      {reportGapItems.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-neutral-500">No major weak points are currently flagged.</p>
                  )}
                </section>
                {packAppendixItems.length > 0 && (
                  <section className="print-pack-major print-pack-appendix break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                    <div className="border-b border-neutral-100 pb-3">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Next Steps</h4>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {packAppendixItems.map((item, index) => (
                        <div key={`${item.kind}-${index}`} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{item.kind}</div>
                          <p className="mt-2 text-sm leading-6 text-neutral-700">{item.text}</p>
                        </div>
                      ))}
                    </div>
                    {criticalDeadlines.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Critical Deadlines</div>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-950">
                          {criticalDeadlines.map((item, idx) => (
                            <li key={idx}>- {typeof item === "string" ? item : item?.title || item?.label || item?.date || "Deadline"}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )}
                </article>
                )}
                {reportMode === "lawyer" && (
                  <article className="print-pack-article mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
                    <header className="print-pack-header break-inside-avoid border-b border-neutral-200 pb-6 print:pb-5">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-lime-700">Lawyer Pack</div>
                      <h1 className="mt-2 text-3xl font-bold leading-tight text-neutral-950 print:text-2xl">
                        {selectedCase.name || "Untitled Case"}
                      </h1>
                    </header>
                    <section className="print-pack-major break-inside-avoid py-6 print:py-5">
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                        Lawyer Pack coming later
                      </div>
                    </section>
                  </article>
                )}
              </section>
            )}
          </div>
        </div>
        {reviewQueueSection && (
          <aside className="lg:col-span-4 space-y-6 print:hidden">
            {reviewQueueSection}
          </aside>
        )}
      </div>

      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
          className="proveit-back-to-top fixed bottom-20 right-4 z-20 print:hidden sm:bottom-[5.25rem] sm:right-6"
        >
          <ArrowUp className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      )}

      <FloatingWorkspaceMenu
        visible={showFloatingWorkspaceMenu}
        open={workspaceActionMenuOpen}
        toolActions={floatingToolActions}
        onClose={closeWorkspaceActionMenu}
        onOpenAiWorkspace={() => openAiWorkspace(activeAiTool || "ai-workspace-snapshot")}
        onBackToTop={handleWorkspaceBackToTop}
        onToggleOpen={() => setWorkspaceActionMenuOpen((open) => !open)}
      />

      {sequenceGroupAuditExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 print:hidden">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Issue Audit Exports</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Download the selected audit, a consolidated audit overview, or the complete case arranged by Issue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSequenceGroupAuditExportOpen(false)}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-5">
              {sequenceGroupAuditFeedback && (
                <div className="rounded-md border border-lime-200 bg-lime-50 p-3 text-sm font-medium text-lime-800">
                  {sequenceGroupAuditFeedback}
                </div>
              )}

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Case</span>
                <select
                  value={selectedCase?.id || ""}
                  disabled
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-600"
                >
                  <option value={selectedCase?.id || ""}>
                    {selectedCase?.name || selectedCase?.id || "Selected case"}
                  </option>
                </select>
              </label>

              <fieldset>
                <legend className="text-xs font-bold uppercase tracking-wider text-neutral-500">Export scope</legend>
                <div className="mt-2 space-y-2">
                  {[
                    ["selected", "Export Selected Issue", "Current Issue only."],
                    ["all", "Export All Issue Audits", "Consolidated overview of every Issue."],
                    ["full", "Export Full Case by Issues", "Complete case content arranged by Issue, including ungrouped records."],
                  ].map(([value, label, description]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={sequenceGroupAuditScope === value}
                      onClick={() => {
                        setSequenceGroupAuditScope(value);
                        if (value !== "selected" && sequenceGroupAuditFormat === "pdf") setSequenceGroupAuditFormat("markdown");
                        setSequenceGroupAuditFeedback("");
                      }}
                      className={`block w-full rounded-lg border px-3 py-2 text-left ${
                        sequenceGroupAuditScope === value
                          ? "border-lime-500 bg-lime-50"
                          : "border-neutral-200 bg-white hover:bg-neutral-50"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-neutral-900">{label}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {sequenceGroupAuditScope === "selected" && timelineIssueOptions.length === 0 && legacySequenceGroupAuditOptions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
                  No Issues exist in this case. Assign records to an Issue before creating this audit export.
                </div>
              ) : (
                <>
                  {sequenceGroupAuditScope === "selected" && (
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Issue</span>
                      <select
                        value={sequenceGroupAuditIssueId || (sequenceGroupAuditLegacyName ? `legacy:${sequenceGroupAuditLegacyName}` : "")}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value.startsWith("legacy:")) {
                            setSequenceGroupAuditIssueId("");
                            setSequenceGroupAuditLegacyName(value.slice("legacy:".length));
                          } else {
                            setSequenceGroupAuditIssueId(value);
                            setSequenceGroupAuditLegacyName("");
                          }
                          setSequenceGroupAuditFeedback("");
                        }}
                        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                      >
                        <option value="">Select an Issue</option>
                        {sequenceGroupAuditIssueId && !sequenceGroupAuditSelection.scope && (
                          <option value={sequenceGroupAuditIssueId}>Unavailable Issue</option>
                        )}
                        {timelineIssueOptions.map((issue) => (
                          <option key={issue.id} value={issue.id}>{issue.label}</option>
                        ))}
                        {legacySequenceGroupAuditOptions.map((name) => (
                          <option key={`legacy:${name}`} value={`legacy:${name}`}>Legacy Issue — {name}</option>
                        ))}
                      </select>
                      {sequenceGroupAuditSelection.error ? (
                        <span role="alert" className="mt-2 block text-xs font-semibold text-red-700">{sequenceGroupAuditSelection.error}</span>
                      ) : sequenceGroupAuditSelection.scope?.kind === "legacy" ? (
                        <span className="mt-2 block text-xs text-neutral-500">Legacy name-only Issue selection. It is available only because the name resolves uniquely.</span>
                      ) : null}
                    </label>
                  )}

                  <fieldset>
                    <legend className="text-xs font-bold uppercase tracking-wider text-neutral-500">Output format</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {[
                        ["json", "JSON"],
                        ["markdown", "Markdown"],
                        ...(sequenceGroupAuditScope === "selected" ? [["pdf", "PDF / print"]] : []),
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setSequenceGroupAuditFormat(value);
                            setSequenceGroupAuditFeedback("");
                          }}
                          className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                            sequenceGroupAuditFormat === value
                              ? "border-lime-400 bg-lime-400/30 text-neutral-950"
                              : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
                    JSON is complete, non-importable, and metadata-only for attachments. It does not include image binaries or modify the case.
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 p-5">
              <button
                type="button"
                onClick={() => setSequenceGroupAuditExportOpen(false)}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunSequenceGroupAuditExport}
                disabled={sequenceGroupAuditScope === "selected" && !sequenceGroupAuditSelection.scope}
                className="rounded-md border border-lime-500 bg-lime-400/20 px-3 py-2 text-sm font-bold text-neutral-900 hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sequenceGroupAuditFormat === "pdf" ? "Print / Save PDF" : "Download"}
              </button>
            </div>
          </div>
        </div>
      )}

      {incidentDateRepairOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 print:hidden">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Incident Date Repair Tool</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Dry-run scan for historical incidents where date and eventDate differ. Repair only selected incidents.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIncidentDateRepairOpen(false)}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {incidentDateRepairFeedback && (
                <div className="mb-4 rounded-md border border-lime-200 bg-lime-50 p-3 text-sm font-medium text-lime-800">
                  {incidentDateRepairFeedback}
                </div>
              )}

              <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Dry-run report</div>
                <div className="mt-1 text-2xl font-semibold text-neutral-950">
                  {incidentDateMismatchReport.length} affected incident{incidentDateMismatchReport.length === 1 ? "" : "s"}
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  No changes are made until you select incident rows and click repair.
                </p>
              </div>

              {incidentDateMismatchReport.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
                  No incident date mismatches found in this case.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                  <table className="min-w-full divide-y divide-neutral-200 text-sm">
                    <thead className="bg-neutral-50 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      <tr>
                        <th className="px-3 py-2">Repair</th>
                        <th className="px-3 py-2">Incident ID</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Event date</th>
                        <th className="px-3 py-2">Issue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 bg-white">
                      {incidentDateMismatchReport.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={incidentDateRepairSelectedIds.includes(item.id)}
                              onChange={() => toggleIncidentDateRepairSelection(item.id)}
                              className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-neutral-600">{item.id}</td>
                          <td className="max-w-xs px-3 py-2 font-medium text-neutral-900">
                            <span className="line-clamp-2">{item.title || "Untitled incident"}</span>
                          </td>
                          <td className="px-3 py-2 text-neutral-700">{item.date}</td>
                          <td className="px-3 py-2 text-red-700">{item.eventDate}</td>
                          <td className="px-3 py-2 text-neutral-600">{item.sequenceGroup || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllIncidentDateRepairs}
                  disabled={incidentDateMismatchReport.length === 0}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearIncidentDateRepairSelection}
                  disabled={incidentDateRepairSelectedIds.length === 0}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIncidentDateRepairOpen(false)}
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRepairSelectedIncidentDates}
                  disabled={incidentDateRepairSelectedIds.length === 0}
                  className="rounded-md border border-lime-500 bg-lime-400/20 px-3 py-2 text-sm font-bold text-neutral-900 hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Repair selected ({incidentDateRepairSelectedIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sequenceGroupManagerOpen && (
        <SequenceGroupManager
          highlightedRecordKey={highlightedSequenceRecordKey}
          onApplyDelta={handleApplySequenceGroupDelta}
          onClearRecord={handleClearSequenceRecord}
          onClose={() => setSequenceGroupManagerOpen(false)}
          onCopyChainCompletionPackJson={(issueSelection) => handleCopyAiToolJson("chain-completion-pack", issueSelection)}
          onCopyChainCompletionPackMarkdown={(issueSelection) => handleCopyAiToolMarkdown("chain-completion-pack", issueSelection)}
          onCopyFullChainGptPackJson={(issueSelection) => handleCopyAiToolJson("full-chain-gpt-pack", issueSelection)}
          onCopyFullChainGptPackMarkdown={(issueSelection) => handleCopyAiToolMarkdown("full-chain-gpt-pack", issueSelection)}
          onCopyReviewPackage={handleCopySequenceGroupReviewPackage}
          onDownloadGroupIndexJson={handleDownloadSequenceGroupsIndexJson}
          onDownloadGroupIndexMarkdown={handleDownloadSequenceGroupsIndexMarkdown}
          onCreateGroup={handleCreateManagedSequenceGroup}
          onDeleteGroup={handleDeleteManagedSequenceGroup}
          onMergeGroup={handleMergeSequenceGroup}
          onManageGroupOperation={handleManagedSequenceGroupOperation}
          onMoveRecordToExisting={handleMoveSequenceRecordToExisting}
          onMoveRecordToNew={handleMoveSequenceRecordToNew}
          onOpenRecordEdit={handleOpenSequenceRecordEdit}
          onOpenAuditExport={openSequenceGroupAuditExportFromManager}
          onRelationshipNodeSelect={handleSelectSequenceRelationshipNode}
          onRemoveGroup={handleRemoveSequenceGroup}
          onRenameGroup={handleRenameSequenceGroup}
          onTimelineItemSelect={handleSelectSequenceTimelineItem}
          onUpdateGroup={handleUpdateManagedSequenceGroup}
          onValidateDelta={handleValidateSequenceGroupDelta}
          search={sequenceGroupSearch}
          selectedCase={selectedCase}
          selectedIssueId={selectedSequenceGroupId}
          selectedGroupName={selectedSequenceGroupName}
          sequenceGroupDetails={sequenceGroupDetails}
          sequenceGroupFeedback={sequenceGroupFeedback}
          sequenceGroupDeltaDraft={sequenceGroupDeltaDraft}
          sequenceGroupDeltaResult={sequenceGroupDeltaResult}
          sequenceMoveInputs={sequenceMoveInputs}
          sequenceNewGroupInputs={sequenceNewGroupInputs}
          sequenceRelationshipFilter={sequenceRelationshipFilter}
          sequenceRenameInputs={sequenceRenameInputs}
          sequenceTimelineSort={sequenceTimelineSort}
          setSearch={setSequenceGroupSearch}
          setSelectedGroupName={(groupName) => setSequenceGroupSelection({ groupName })}
          setSequenceGroupDeltaDraft={setSequenceGroupDeltaDraft}
          setSequenceGroupDeltaResult={setSequenceGroupDeltaResult}
          setSequenceGroupFeedback={setSequenceGroupFeedback}
          setSequenceMoveInputs={setSequenceMoveInputs}
          setSequenceNewGroupInputs={setSequenceNewGroupInputs}
          setSequenceRelationshipFilter={setSequenceRelationshipFilter}
          setSequenceRenameInputs={setSequenceRenameInputs}
          setSequenceTimelineSort={setSequenceTimelineSort}
        />
      )}
      {recordConversion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 print:hidden">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Convert Record Type</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Preview preserved fields and dropped type-specific fields before applying.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordConversion(null)}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Convert to</span>
                <select
                  value={recordConversion.targetType}
                  onChange={(event) => setRecordConversion((current) => ({ ...current, targetType: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                >
                  {recordConversionOptions.map((type) => (
                    <option key={type} value={type} disabled={type === recordConversion.sourceType}>
                      {RECORD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>

              {recordConversionPreview ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm text-lime-950">
                    <div className="font-semibold">
                      {recordConversionPreview.title || "Untitled record"}
                    </div>
                    <div className="mt-1">
                      {recordConversionPreview.fromLabel} to {recordConversionPreview.toLabel}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Preserved where possible</h4>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                        {recordConversionPreview.preservedFields.map((field) => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                    </section>

                    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">Dropped fields</h4>
                      {recordConversionPreview.droppedFields.length === 0 ? (
                        <p className="mt-3 text-sm text-amber-800">No type-specific fields are expected to be dropped.</p>
                      ) : (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
                          {recordConversionPreview.droppedFields.map((field) => (
                            <li key={field}>{field}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Audit log entry</h4>
                    <p className="mt-2 text-sm text-neutral-700">
                      Record converted from {recordConversionPreview.fromLabel} to {recordConversionPreview.toLabel}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
                  Select a different target type to preview this conversion.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 p-5">
              <button
                type="button"
                onClick={() => setRecordConversion(null)}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyRecordConversion}
                disabled={!recordConversionPreview}
                className="rounded-md border border-lime-500 bg-lime-400/20 px-3 py-2 text-sm font-bold text-neutral-900 hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply conversion
              </button>
            </div>
          </div>
        </div>
      )}
      <ActionSummaryModal
        key={`${selectedCase?.id || "case"}:${actionSummaryEditOpen ? "open" : "closed"}`}
        open={actionSummaryEditOpen}
        form={actionSummaryForm}
        onChangeField={(field, value) => setActionSummaryForm((f) => ({ ...f, [field]: value }))}
        onCancel={() => setActionSummaryEditOpen(false)}
        onSave={saveActionSummary}
      />

      <ActiveLedgerRecordModal
        record={activeLedgerRecord}
        entries={activeLedgerRecord ? generateLedgerEntries([activeLedgerRecord]) : []}
        onClose={() => setActiveLedgerRecord(null)}
      />
    </div>
  );
}

