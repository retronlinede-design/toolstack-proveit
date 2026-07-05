import { useState, useEffect, useMemo, useRef } from "react";
import { AlertCircle, Briefcase, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Download, FileText, Network, Search, ShieldCheck, Tags } from "lucide-react";
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
  mergeCaseSequenceGroups,
  moveRecordToSequenceGroup,
  removeCaseSequenceGroup,
  renameCaseSequenceGroup,
} from "../domain/caseDomain.js";
import { getRecordDisplayMeta, resolveRecordById } from "../domain/linkingResolvers.js";
import { buildNarrativeSections } from "../lib/narrativeBuilder.js";
import { PROVEIT_REPORT_PROMPT_V1, parseProveItReportV1 } from "../lib/proveitReportFormat.js";
import { DEFAULT_REPORT_DISPLAY_LANGUAGE, REPORT_DISPLAY_LANGUAGES, getReportHeadingLabel } from "../lib/reportHeadingLabels.js";
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
  exportGptProtocolPackJson,
  exportGptProtocolPackMarkdown,
} from "../export/gptProtocolPack.js";
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
import { getLinkChipClasses } from "./linkChipStyles";
import LinkedChip from "./LinkedChip";
import RecordCard from "./RecordCard";
import CaseBundleReportArticle from "./reports/CaseBundleReportArticle";
import DocumentPackReportArticle from "./reports/DocumentPackReportArticle";
import EvidencePackReportArticle from "./reports/EvidencePackReportArticle";
import ExecutiveSummaryReportArticle from "./reports/ExecutiveSummaryReportArticle";
import GeneratedClientReportArticle from "./reports/GeneratedClientReportArticle";
import LedgerPackReportArticle from "./reports/LedgerPackReportArticle";
import ThreadIssueReportArticle from "./reports/ThreadIssueReportArticle";
import SequenceGroupManager from "./sequenceGroups/SequenceGroupManager";
import {
  actionSummaryToForm,
  applyActionSummaryPatch,
  emptyActionSummaryForm,
  formToActionSummary,
  normalizeActionSummary,
} from "./caseDetail/actionSummaryHelpers";
import ActionSummaryModal from "./caseDetail/ActionSummaryModal";
import ActionSummaryPanel from "./caseDetail/ActionSummaryPanel";
import ActiveLedgerRecordModal from "./caseDetail/ActiveLedgerRecordModal";
import DocumentsTab from "./caseDetail/DocumentsTab";
import FloatingWorkspaceMenu from "./caseDetail/FloatingWorkspaceMenu";
import LedgerTab from "./caseDetail/LedgerTab";
import PartiesTab from "./caseDetail/PartiesTab";
import RecordsTab from "./caseDetail/RecordsTab";
import { AI_TOOL_OPTIONS, AI_WORKSPACE_SECTIONS } from "./caseDetail/aiToolsConfig.js";
import { sortChronological } from "./caseDetail/ledgerViewHelpers";
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
  mergeSequenceGroupMeta,
  readSequenceGroupMetaStore,
  renameSequenceGroupMeta,
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

function renderSequenceGroupChip(value) {
  const sequenceGroup = typeof value === "string" ? value.trim() : "";
  if (!sequenceGroup) return null;

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

const MANAGEMENT_REPORT_BUILDER_WHOLE_CASE = "__whole_case__";

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
  reviewQueueSection,
  syncStatus = "idle",
  syncMessage = "",
  supabaseReasoningExportStatus = "idle",
  supabaseReasoningExportMessage = "",
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [ideas, setIdeas] = useState([]);
  const [workspaceActionMenuOpen, setWorkspaceActionMenuOpen] = useState(false);
  const [aiToolsOpen, setAiToolsOpen] = useState(false);
  const [activeAiTool, setActiveAiTool] = useState("missing-function-summaries");
  const [aiToolsSequenceGroup, setAiToolsSequenceGroup] = useState("");
  const [aiToolsFeedback, setAiToolsFeedback] = useState("");
  const [caseSliceRecordIdsText, setCaseSliceRecordIdsText] = useState("");
  const aiToolsModalRef = useRef(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timelineView, setTimelineView] = useState("all");
  const [timelineMilestonesOnly, setTimelineMilestonesOnly] = useState(false);
  const [timelineSequenceGroupFilter, setTimelineSequenceGroupFilter] = useState("all");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const [expandedDocuments, setExpandedDocuments] = useState({});
  const [collapsedLedgerGroups, setCollapsedLedgerGroups] = useState({});
  const [showVerifiedEvidence, setShowVerifiedEvidence] = useState(false);
  const [activeLedgerRecord, setActiveLedgerRecord] = useState(null);
  const [showStructuredRecords, setShowStructuredRecords] = useState(false);
  const [actionSummaryEditOpen, setActionSummaryEditOpen] = useState(false);
  const [quickActionInput, setQuickActionInput] = useState("");
  const [actionSummaryForm, setActionSummaryForm] = useState(emptyActionSummaryForm);
  const [reportMode, setReportMode] = useState("internal");
  const [reportDisplayLanguage, setReportDisplayLanguage] = useState(DEFAULT_REPORT_DISPLAY_LANGUAGE);
  const [generatedReportDraft, setGeneratedReportDraft] = useState("");
  const [renderedReportText, setRenderedReportText] = useState("");
  const [reportPromptFeedback, setReportPromptFeedback] = useState("");
  const [reportCentreScopeType, setReportCentreScopeType] = useState("case");
  const [reportCentreSequenceGroup, setReportCentreSequenceGroup] = useState("");
  const [reportCentreType, setReportCentreType] = useState("management");
  const [caseStructureReportOpen, setCaseStructureReportOpen] = useState(false);
  const [clientReportGeneratorOpen, setClientReportGeneratorOpen] = useState(false);
  const [threadIssueReportOpen, setThreadIssueReportOpen] = useState(false);
  const [threadIssueReportSequenceGroup, setThreadIssueReportSequenceGroup] = useState("");
  const [threadIssueReportVisibility, setThreadIssueReportVisibility] = useState({
    diagnostics: true,
    documents: true,
    ledger: true,
    strategy: true,
  });
  const [evidencePackReportOpen, setEvidencePackReportOpen] = useState(false);
  const [evidencePackScopeType, setEvidencePackScopeType] = useState("case");
  const [evidencePackSequenceGroup, setEvidencePackSequenceGroup] = useState("");
  const [documentPackReportOpen, setDocumentPackReportOpen] = useState(false);
  const [documentPackScopeType, setDocumentPackScopeType] = useState("case");
  const [documentPackSequenceGroup, setDocumentPackSequenceGroup] = useState("");
  const [ledgerPackReportOpen, setLedgerPackReportOpen] = useState(false);
  const [ledgerPackScopeType, setLedgerPackScopeType] = useState("case");
  const [ledgerPackSequenceGroup, setLedgerPackSequenceGroup] = useState("");
  const [caseBundleReportOpen, setCaseBundleReportOpen] = useState(false);
  const [executiveSummaryReportOpen, setExecutiveSummaryReportOpen] = useState(true);
  const [executiveSummaryPolishDraft, setExecutiveSummaryPolishDraft] = useState("");
  const [executiveSummaryPolishFeedback, setExecutiveSummaryPolishFeedback] = useState("");
  const [caseBundleScopeType, setCaseBundleScopeType] = useState("case");
  const [caseBundleSequenceGroup, setCaseBundleSequenceGroup] = useState("");
  const [caseBundleSections, setCaseBundleSections] = useState({
    threadIssue: true,
    evidencePack: true,
    documentPack: true,
    ledgerPack: true,
    strategyActions: true,
    diagnosticsSummary: true,
  });
  const [internalReportGeneratorOpen, setInternalReportGeneratorOpen] = useState(false);
  const [caseStructureReportText, setCaseStructureReportText] = useState("");
  const [caseStructureReportFeedback, setCaseStructureReportFeedback] = useState("");
  const [sequenceGroupManagerOpen, setSequenceGroupManagerOpen] = useState(false);
  const [sequenceRenameInputs, setSequenceRenameInputs] = useState({});
  const [sequenceGroupFeedback, setSequenceGroupFeedback] = useState("");
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
  const [sequenceGroupAuditGroup, setSequenceGroupAuditGroup] = useState("");
  const [sequenceGroupAuditFormat, setSequenceGroupAuditFormat] = useState("json");
  const [sequenceGroupAuditFeedback, setSequenceGroupAuditFeedback] = useState("");
  const [incidentDateRepairOpen, setIncidentDateRepairOpen] = useState(false);
  const [incidentDateRepairSelectedIds, setIncidentDateRepairSelectedIds] = useState([]);
  const [incidentDateRepairFeedback, setIncidentDateRepairFeedback] = useState("");
  const [recordConversion, setRecordConversion] = useState(null);
  const activeGeneratedReportLanguage = normalizeReportLanguage(selectedCase?.activeGeneratedReportLanguage);
  const sequenceGroups = useMemo(() => getCaseSequenceGroups(selectedCase), [selectedCase]);
  const sequenceGroupDetails = useMemo(() => getCaseSequenceGroupDetails(selectedCase), [selectedCase]);
  const threadIssueReportSequenceOptions = useMemo(() => sequenceGroups.map((group) => group.name), [sequenceGroups]);
  const selectedSequenceGroupAuditGroup = useMemo(() => {
    const options = sequenceGroups.map((group) => group.name);
    if (options.includes(sequenceGroupAuditGroup)) return sequenceGroupAuditGroup;
    return options[0] || "";
  }, [sequenceGroups, sequenceGroupAuditGroup]);
  const incidentDateMismatchReport = useMemo(
    () => scanIncidentDateMismatches(selectedCase),
    [selectedCase]
  );
  const selectedReportCentreSequenceGroup = useMemo(() => {
    if (threadIssueReportSequenceOptions.includes(reportCentreSequenceGroup)) {
      return reportCentreSequenceGroup;
    }
    return threadIssueReportSequenceOptions[0] || "";
  }, [reportCentreSequenceGroup, threadIssueReportSequenceOptions]);
  const selectedThreadIssueReportSequenceGroup = useMemo(() => {
    if (threadIssueReportSequenceOptions.includes(threadIssueReportSequenceGroup)) {
      return threadIssueReportSequenceGroup;
    }
    return threadIssueReportSequenceOptions[0] || "";
  }, [threadIssueReportSequenceGroup, threadIssueReportSequenceOptions]);
  const threadIssueReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildThreadIssueReport(selectedCase, selectedThreadIssueReportSequenceGroup);
  }, [selectedCase, selectedThreadIssueReportSequenceGroup]);
  const selectedEvidencePackSequenceGroup = useMemo(() => {
    if (threadIssueReportSequenceOptions.includes(evidencePackSequenceGroup)) {
      return evidencePackSequenceGroup;
    }
    return threadIssueReportSequenceOptions[0] || "";
  }, [evidencePackSequenceGroup, threadIssueReportSequenceOptions]);
  const evidencePackReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildEvidencePackReport(selectedCase, {
      scopeType: evidencePackScopeType,
      sequenceGroup: selectedEvidencePackSequenceGroup,
    });
  }, [selectedCase, evidencePackScopeType, selectedEvidencePackSequenceGroup]);
  const selectedDocumentPackSequenceGroup = useMemo(() => {
    if (threadIssueReportSequenceOptions.includes(documentPackSequenceGroup)) {
      return documentPackSequenceGroup;
    }
    return threadIssueReportSequenceOptions[0] || "";
  }, [documentPackSequenceGroup, threadIssueReportSequenceOptions]);
  const documentPackReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildDocumentPackReport(selectedCase, {
      scopeType: documentPackScopeType,
      sequenceGroup: selectedDocumentPackSequenceGroup,
    });
  }, [selectedCase, documentPackScopeType, selectedDocumentPackSequenceGroup]);
  const selectedLedgerPackSequenceGroup = useMemo(() => {
    if (threadIssueReportSequenceOptions.includes(ledgerPackSequenceGroup)) {
      return ledgerPackSequenceGroup;
    }
    return threadIssueReportSequenceOptions[0] || "";
  }, [ledgerPackSequenceGroup, threadIssueReportSequenceOptions]);
  const ledgerPackReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildLedgerPackReport(selectedCase, {
      scopeType: ledgerPackScopeType,
      sequenceGroup: selectedLedgerPackSequenceGroup,
    });
  }, [selectedCase, ledgerPackScopeType, selectedLedgerPackSequenceGroup]);
  const selectedCaseBundleSequenceGroup = useMemo(() => {
    if (threadIssueReportSequenceOptions.includes(caseBundleSequenceGroup)) {
      return caseBundleSequenceGroup;
    }
    return threadIssueReportSequenceOptions[0] || "";
  }, [caseBundleSequenceGroup, threadIssueReportSequenceOptions]);
  const caseBundleReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildCaseBundleReport(selectedCase, {
      scopeType: caseBundleScopeType,
      sequenceGroup: selectedCaseBundleSequenceGroup,
    }, {
      sections: caseBundleSections,
    });
  }, [selectedCase, caseBundleScopeType, selectedCaseBundleSequenceGroup, caseBundleSections]);
  const executiveSummaryReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildExecutiveSummaryReport(selectedCase);
  }, [selectedCase]);
  const reportCentreScope = useMemo(() => ({
    scopeType: reportCentreScopeType,
    sequenceGroup: reportCentreScopeType === "sequenceGroup" ? selectedReportCentreSequenceGroup : "",
  }), [reportCentreScopeType, selectedReportCentreSequenceGroup]);
  const reportCentreEvidencePackReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildEvidencePackReport(selectedCase, reportCentreScope);
  }, [selectedCase, reportCentreScope]);
  const reportCentreDocumentPackReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildDocumentPackReport(selectedCase, reportCentreScope);
  }, [selectedCase, reportCentreScope]);
  const reportCentreLedgerPackReport = useMemo(() => {
    if (!selectedCase) return null;
    return buildLedgerPackReport(selectedCase, reportCentreScope);
  }, [selectedCase, reportCentreScope]);
  const reportCentreInvestigationReport = useMemo(() => {
    if (!selectedCase) return null;
    if (reportCentreScope.scopeType === "sequenceGroup") {
      return buildThreadIssueReport(selectedCase, reportCentreScope.sequenceGroup);
    }
    return buildCaseBundleReport(selectedCase, { scopeType: "case" }, {
      sections: {
        threadIssue: false,
        evidencePack: true,
        documentPack: true,
        ledgerPack: true,
        strategyActions: true,
        diagnosticsSummary: true,
      },
    });
  }, [selectedCase, reportCentreScope]);
  const reportCentreActionPlan = useMemo(() => {
    if (!selectedCase) return null;
    const diagnostics = analyzeCaseDiagnostics(selectedCase);
    const normalizedActionSummary = normalizeActionSummary(selectedCase.actionSummary || {});
    const scopeLabel = reportCentreScope.scopeType === "sequenceGroup"
      ? `sequenceGroup: ${reportCentreScope.sequenceGroup || "-"}`
      : "Whole case";
    const weakRecords = diagnostics.integrity?.weaklyLinkedRecords || [];
    const orphanRecords = diagnostics.integrity?.orphanRecords || [];
    const unsupportedIncidents = diagnostics.evidenceCoverage?.incidentsNeedingEvidence || [];
    const chronologyGaps = diagnostics.chronology?.missingDateRecords || [];
    const strategyRecords = (selectedCase.strategy || [])
      .filter((item) => item?.id && !["done", "closed", "archived"].includes(item.status));
    const openTasks = (selectedCase.tasks || [])
      .filter((item) => item?.id && !["done", "closed", "archived"].includes(item.status));
    const sequenceGroup = reportCentreScope.sequenceGroup;
    const mentionsScope = (value) => (
      reportCentreScope.scopeType !== "sequenceGroup" ||
      safeText(value).toLowerCase().includes(sequenceGroup.toLowerCase())
    );

    return {
      title: reportCentreScope.scopeType === "sequenceGroup"
        ? `Action Plan: ${sequenceGroup || "Unselected sequenceGroup"}`
        : "Action Plan: Whole Case",
      sourceCaseId: selectedCase.id || "",
      generatedAt: new Date().toISOString(),
      scopeLabel,
      caseOverview: {
        name: selectedCase.name || "",
        category: selectedCase.category || "",
        status: selectedCase.status || "",
      },
      currentFocus: normalizedActionSummary.currentFocus || "",
      nextActions: normalizedActionSummary.nextActions.filter(mentionsScope),
      importantReminders: normalizedActionSummary.importantReminders.filter(mentionsScope),
      strategyFocus: normalizedActionSummary.strategyFocus.filter(mentionsScope),
      criticalDeadlines: normalizedActionSummary.criticalDeadlines.filter(mentionsScope),
      openStrategyRecords: strategyRecords.filter((item) => mentionsScope(`${item.title} ${item.description} ${item.notes} ${item.sequenceGroup}`)),
      openTasks: openTasks.filter((item) => mentionsScope(`${item.title} ${item.description} ${item.notes} ${item.sequenceGroup}`)),
      risks: [
        ...unsupportedIncidents.map((item) => ({ id: `unsupported-${item.id}`, label: "Unsupported incident", text: item.title })),
        ...weakRecords.slice(0, 8).map((item) => ({ id: `weak-${item.type}-${item.id}`, label: "Weak link", text: item.title })),
        ...orphanRecords.slice(0, 8).map((item) => ({ id: `orphan-${item.type}-${item.id}`, label: "Unlinked record", text: item.title })),
        ...chronologyGaps.slice(0, 8).map((item) => ({ id: `date-${item.type}-${item.id}`, label: "Chronology gap", text: item.title })),
      ],
      recommendedFixes: [
        ...(unsupportedIncidents.length > 0 ? ["Link evidence to unsupported incidents before escalation."] : []),
        ...(weakRecords.length > 0 || orphanRecords.length > 0 ? ["Review weak or unlinked records and connect them to the relevant incidents, evidence, documents, or ledger entries."] : []),
        ...(chronologyGaps.length > 0 ? ["Add missing dates or ordering information to strengthen chronology."] : []),
        ...(normalizedActionSummary.nextActions.length === 0 ? ["Add explicit next actions to the case action summary."] : []),
      ],
      counts: {
        nextActions: normalizedActionSummary.nextActions.length,
        reminders: normalizedActionSummary.importantReminders.length,
        deadlines: normalizedActionSummary.criticalDeadlines.length,
        openStrategy: strategyRecords.length,
        openTasks: openTasks.length,
        risks: unsupportedIncidents.length + weakRecords.length + orphanRecords.length + chronologyGaps.length,
      },
    };
  }, [selectedCase, reportCentreScope]);

  useEffect(() => {
    if (!aiToolsOpen) return undefined;

    const previouslyFocusedElement = document.activeElement;
    const focusableSelector = [
      "button:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    function getFocusableElements() {
      return Array.from(aiToolsModalRef.current?.querySelectorAll(focusableSelector) || [])
        .filter((element) => element.offsetParent !== null || element === document.activeElement);
    }

    function handleAiToolsKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setAiToolsOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        aiToolsModalRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    const focusTimer = window.setTimeout(() => {
      const focusableElements = getFocusableElements();
      (focusableElements[0] || aiToolsModalRef.current)?.focus();
    }, 0);

    document.addEventListener("keydown", handleAiToolsKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleAiToolsKeyDown);
      if (previouslyFocusedElement?.focus) previouslyFocusedElement.focus();
    };
  }, [aiToolsOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextText = getGeneratedReportTextForLanguage(selectedCase, activeGeneratedReportLanguage);
      setReportDisplayLanguage(activeGeneratedReportLanguage);
      setGeneratedReportDraft(nextText);
      setRenderedReportText(nextText);
      setReportPromptFeedback("");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    selectedCase,
    activeGeneratedReportLanguage,
  ]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (activeTab !== "generate-report") return;
    const timeout = window.setTimeout(() => {
      setClientReportGeneratorOpen(false);
      setInternalReportGeneratorOpen(false);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleDocumentExpanded = (id) => {
    setExpandedDocuments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleLedgerGroup = (batchLabel) => {
    setCollapsedLedgerGroups(prev => ({
      ...prev,
      [batchLabel]: !prev[batchLabel],
    }));
  };

  const toggleGroup = (cat) => setExpandedGroups((prev) => ({ ...prev, [cat]: !prev[cat] }));

  function openActionSummaryEdit() {
    setActionSummaryForm(actionSummaryToForm(selectedCase?.actionSummary || {}));
    setActionSummaryEditOpen(true);
  }

  function updateActionSummary(nextActionSummary) {
    if (!selectedCase) return;

    onUpdateCase({
      ...selectedCase,
      actionSummary: nextActionSummary,
    });
  }

  function applyActionSummaryUpdate(patch) {
    updateActionSummary(applyActionSummaryPatch(rawActionSummary, patch));
  }

  function saveActionSummary() {
    if (!selectedCase) return;

    updateActionSummary(formToActionSummary(actionSummaryForm));
    setActionSummaryEditOpen(false);
  }

  function openSequenceGroupManager() {
    setSequenceRenameInputs({});
    setSequenceMoveInputs({});
    setSequenceNewGroupInputs({});
    setSequenceGroupDeltaDraft("");
    setSequenceGroupDeltaResult(null);
    setSequenceTimelineSort("asc");
    setHighlightedSequenceRecordKey("");
    setSequenceRelationshipFilter("all");
    setSequenceGroupSearch("");
    setSelectedSequenceGroupName(sequenceGroups[0]?.name || "");
    setSequenceGroupFeedback("");
    setSequenceGroupManagerOpen(true);
  }

  function openSequenceGroupAuditExport(preferredGroup = "") {
    const requestedGroup = safeText(preferredGroup).trim();
    const nextGroup = sequenceGroups.some((group) => group.name === requestedGroup)
      ? requestedGroup
      : sequenceGroups[0]?.name || "";
    setSequenceGroupAuditGroup(nextGroup);
    setSequenceGroupAuditFormat("json");
    setSequenceGroupAuditFeedback("");
    setSequenceGroupAuditExportOpen(true);
  }

  function openSequenceGroupAuditExportFromManager(groupName) {
    setSequenceGroupManagerOpen(false);
    openSequenceGroupAuditExport(groupName);
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
      setSequenceGroupFeedback("Sequence Groups Index JSON downloaded.");
    } catch (error) {
      console.error("Failed to export sequence groups index JSON", error);
      setSequenceGroupFeedback("Could not create the Sequence Groups Index JSON.");
    }
  }

  function handleDownloadSequenceGroupsIndexMarkdown() {
    if (!selectedCase) return;

    try {
      const markdown = exportSequenceGroupsIndexMarkdown(selectedCase, {
        sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
      });
      downloadTextFile(markdown, getSequenceGroupsIndexFilename("md"), "text/markdown");
      setSequenceGroupFeedback("Sequence Groups Index Markdown downloaded.");
    } catch (error) {
      console.error("Failed to export sequence groups index Markdown", error);
      setSequenceGroupFeedback("Could not create the Sequence Groups Index Markdown.");
    }
  }

  function handleRunSequenceGroupAuditExport() {
    if (!selectedCase) return;
    if (!selectedSequenceGroupAuditGroup) {
      setSequenceGroupAuditFeedback("No sequence groups exist for this case.");
      return;
    }

    try {
      if (sequenceGroupAuditFormat === "json") {
        const payload = exportSequenceGroupAuditJson(selectedCase, selectedSequenceGroupAuditGroup, {
          sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
        });
        downloadTextFile(JSON.stringify(payload, null, 2), getAuditExportFilename("json"), "application/json");
      } else if (sequenceGroupAuditFormat === "markdown") {
        const markdown = exportSequenceGroupAuditMarkdown(selectedCase, selectedSequenceGroupAuditGroup, {
          sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
        });
        downloadTextFile(markdown, getAuditExportFilename("md"), "text/markdown");
      } else if (sequenceGroupAuditFormat === "pdf") {
        const opened = printSequenceGroupAuditPdf(selectedCase, selectedSequenceGroupAuditGroup, {
          sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
        });
        if (!opened) {
          setSequenceGroupAuditFeedback("Could not open the print view. Check popup settings and try JSON or Markdown.");
          return;
        }
      }

      setSequenceGroupAuditFeedback("Sequence Group Audit Pack created.");
    } catch (error) {
      console.error("Failed to export sequence group audit", error);
      setSequenceGroupAuditFeedback("Could not create the Sequence Group Audit Pack.");
    }
  }

  const getSequenceRecordKey = (record) => `${record.recordType}:${record.id}`;

  function handleRenameSequenceGroup(groupName) {
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

    const updatedCase = renameCaseSequenceGroup(selectedCase, groupName, nextName);
    renameSequenceGroupMeta(selectedCase.id, groupName, nextName);
    onUpdateCase(updatedCase);
    setSequenceRenameInputs((prev) => ({ ...prev, [groupName]: "" }));
    setSelectedSequenceGroupName(nextName);
    setSequenceGroupFeedback(`Renamed "${groupName}" to "${nextName}".`);
  }

  function handleMergeSequenceGroup(fromGroup) {
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

    mergeSequenceGroupMeta(selectedCase.id, fromGroup, targetGroup);
    onUpdateCase(mergeCaseSequenceGroups(selectedCase, fromGroup, targetGroup));
    setSelectedSequenceGroupName(targetGroup);
    setSequenceGroupFeedback(`Merged "${fromGroup}" into "${targetGroup}".`);
  }

  function handleRemoveSequenceGroup(group) {
    if (!selectedCase || !group) return;

    const confirmed = window.confirm(`Remove "${group.name}" from ${group.totalCount} record${group.totalCount === 1 ? "" : "s"}?`);
    if (!confirmed) return;

    onUpdateCase(removeCaseSequenceGroup(selectedCase, group.name));
    setSelectedSequenceGroupName(sequenceGroups.find((item) => item.name !== group.name)?.name || "");
    setSequenceGroupFeedback(`Removed "${group.name}" from ${group.totalCount} record${group.totalCount === 1 ? "" : "s"}.`);
  }

  function handleMoveSequenceRecord(record, targetGroup) {
    if (!selectedCase || !record) return;
    const nextGroup = safeText(targetGroup).trim();
    if (!nextGroup) {
      setSequenceGroupFeedback("Choose or enter a sequence group before moving the record.");
      return;
    }

    onUpdateCase(moveRecordToSequenceGroup(selectedCase, record.recordType, record.id, nextGroup));
    setSelectedSequenceGroupName(nextGroup);
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

  function handleClearSequenceRecord(record) {
    if (!selectedCase || !record) return;
    onUpdateCase(clearRecordSequenceGroup(selectedCase, record.recordType, record.id));
    setSequenceGroupFeedback(`Removed "${record.title}" from its sequence group.`);
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

  function handleWorkspaceAddRecord(recordType) {
    openRecordModal(recordType);
    closeWorkspaceActionMenu();
  }

  function handleWorkspaceAddDocument() {
    openDocumentModal();
    closeWorkspaceActionMenu();
  }

  function handleWorkspaceAddLedgerEntry() {
    openLedgerModal();
    closeWorkspaceActionMenu();
  }

  function handleWorkspaceAddIdea() {
    if (!selectedCase) return;
    const newIdea = { id: Date.now().toString(), title: "New idea", description: "", status: "raw" };
    const updatedIdeas = [...(selectedCase.ideas || []), newIdea];
    setIdeas(updatedIdeas);
    onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
    closeWorkspaceActionMenu();
  }

  function handleWorkspaceNavigate(tabId) {
    setActiveTab(tabId);
    closeWorkspaceActionMenu();
  }

  function handleWorkspaceOpenSequenceGroups() {
    openSequenceGroupManager();
    closeWorkspaceActionMenu();
  }

  function restoreSequenceGroupManagerAfterEdit(context, { feedback, highlightedKey } = {}) {
    if (!context) return;
    setSelectedSequenceGroupName(context.selectedGroupName);
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
    const managerContext = {
      selectedGroupName: selectedSequenceGroupName,
      search: sequenceGroupSearch,
      relationshipFilter: sequenceRelationshipFilter,
      timelineSort: sequenceTimelineSort,
      highlightedRecordKey: key,
      scrollTop: scrollContainer?.scrollTop || 0,
    };
    setHighlightedSequenceRecordKey(key);
    setSequenceGroupManagerOpen(false);
    openSequenceManagerRecordEdit(record.recordType, record, {
      activeGroupName: selectedSequenceGroupName,
      onSaved: ({ recordId, recordType, previousSequenceGroup, nextSequenceGroup }) => {
        const savedKey = `${recordType}:${recordId}`;
        const previousGroup = safeText(previousSequenceGroup).trim();
        const nextGroup = safeText(nextSequenceGroup).trim();
        let feedback = "Record saved. Returned to sequence group.";
        if (previousGroup && nextGroup && previousGroup !== nextGroup) {
          feedback = "Record moved to another sequence group.";
        } else if (previousGroup && !nextGroup) {
          feedback = "Record removed from this sequence group.";
        }
        restoreSequenceGroupManagerAfterEdit(managerContext, { feedback, highlightedKey: savedKey });
      },
      onCancel: () => {
        restoreSequenceGroupManagerAfterEdit(managerContext, {
          feedback: "Returned to sequence group.",
          highlightedKey: key,
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

  function openAiTool(toolId) {
    const nextGroup = selectedSequenceGroupName || sequenceGroups[0]?.name || "";
    setActiveAiTool(toolId);
    setAiToolsSequenceGroup(toolId === "management-report-builder-pack" ? MANAGEMENT_REPORT_BUILDER_WHOLE_CASE : nextGroup);
    setAiToolsFeedback("");
    setAiToolsOpen(true);
    closeWorkspaceActionMenu();
  }

  function buildAiToolJson(toolId, groupName = aiToolsSequenceGroup) {
    if (!selectedCase) return null;
    if (toolId === "case-slice-pack") return buildCaseSlicePack(selectedCase, parseCaseSliceRecordIds(caseSliceRecordIdsText));
    if (toolId === "missing-function-summaries") return buildMissingFunctionSummaryPack(selectedCase);
    if (toolId === "ungrouped-evidence-audit") return buildUngroupedEvidenceAuditPack(selectedCase);
    if (toolId === "ungrouped-incidents-audit") return buildUngroupedIncidentsAuditPack(selectedCase);
    if (toolId === "chain-completion-pack") return buildChainCompletionPack(selectedCase, groupName || sequenceGroups[0]?.name || "");
    if (toolId === "full-chain-gpt-pack") return buildFullChainGptPack(selectedCase, groupName || sequenceGroups[0]?.name || "", {
      sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
    });
    if (toolId === "management-report-builder-pack") {
      const selectedGroup = groupName === MANAGEMENT_REPORT_BUILDER_WHOLE_CASE ? "" : groupName;
      return buildManagementReportBuilderPack(selectedCase, selectedGroup);
    }
    if (toolId === "weak-links-audit") return buildWeakLinksAuditPack(selectedCase);
    return null;
  }

  function buildAiToolMarkdown(toolId, groupName = aiToolsSequenceGroup) {
    if (!selectedCase) return "";
    if (toolId === "case-slice-pack") return buildCaseSliceMarkdownPrompt(selectedCase, parseCaseSliceRecordIds(caseSliceRecordIdsText));
    if (toolId === "missing-function-summaries") return buildMissingFunctionSummaryMarkdownPrompt(selectedCase);
    if (toolId === "ungrouped-evidence-audit") return buildUngroupedEvidenceAuditMarkdownPrompt(selectedCase);
    if (toolId === "ungrouped-incidents-audit") return buildUngroupedIncidentsAuditMarkdownPrompt(selectedCase);
    if (toolId === "chain-completion-pack") return buildChainCompletionMarkdownPrompt(selectedCase, groupName || sequenceGroups[0]?.name || "");
    if (toolId === "full-chain-gpt-pack") return buildFullChainGptMarkdownPrompt(selectedCase, groupName || sequenceGroups[0]?.name || "", {
      sequenceGroupMeta: getSequenceGroupMetaForCase(selectedCase.id, readSequenceGroupMetaStore()),
    });
    if (toolId === "management-report-builder-pack") {
      const selectedGroup = groupName === MANAGEMENT_REPORT_BUILDER_WHOLE_CASE ? "" : groupName;
      return buildManagementReportBuilderMarkdownPrompt(selectedCase, selectedGroup);
    }
    if (toolId === "weak-links-audit") return buildWeakLinksAuditMarkdownPrompt(selectedCase);
    return "";
  }

  function buildAiToolSpecialistPrompt(toolId, groupName = aiToolsSequenceGroup) {
    if (!selectedCase) return "";
    if (toolId === "management-report-builder-pack") {
      const selectedGroup = groupName === MANAGEMENT_REPORT_BUILDER_WHOLE_CASE ? "" : groupName;
      return buildManagementReportBuilderSpecialistPrompt(selectedCase, selectedGroup);
    }
    return "";
  }

  async function handleCopyAiToolJson(toolId = activeAiTool, groupName = aiToolsSequenceGroup) {
    if (!selectedCase) return;
    try {
      const payload = buildAiToolJson(toolId, groupName);
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

  async function handleCopyAiToolMarkdown(toolId = activeAiTool, groupName = aiToolsSequenceGroup) {
    if (!selectedCase) return;
    try {
      const markdown = buildAiToolMarkdown(toolId, groupName);
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

  async function handleCopyAiToolSpecialistPrompt(toolId = activeAiTool, groupName = aiToolsSequenceGroup) {
    if (!selectedCase) return;
    try {
      const prompt = buildAiToolSpecialistPrompt(toolId, groupName);
      if (!prompt) return;
      await copySequenceGroupText(prompt);
      setAiToolsFeedback("AI specialist prompt copied.");
      setSequenceGroupFeedback("AI specialist prompt copied.");
    } catch (error) {
      console.error("Failed to copy AI specialist prompt", error);
      setAiToolsFeedback(error.message || "Could not copy AI specialist prompt.");
      setSequenceGroupFeedback("Could not copy AI specialist prompt.");
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

  function handleApplySequenceGroupDelta() {
    if (!selectedCase) return;
    const validation = ingestSequenceGroupDelta(sequenceGroupDeltaDraft, selectedCase);
    setSequenceGroupDeltaResult(validation);

    if (!validation.ok) {
      setSequenceGroupFeedback("AI group suggestions need fixes before they can be applied.");
      return;
    }

    const previewCount = Object.values(validation.preview || {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
    const confirmed = window.confirm(`Apply ${previewCount} AI sequence group change${previewCount === 1 ? "" : "s"}?`);
    if (!confirmed) return;

    const result = ingestSequenceGroupDelta(sequenceGroupDeltaDraft, selectedCase, { apply: true });
    onUpdateCase(result.updatedCase);
    setSequenceGroupDeltaDraft("");
    setSequenceGroupDeltaResult(null);
    setSequenceGroupFeedback(`Applied ${previewCount} AI sequence group change${previewCount === 1 ? "" : "s"}.`);
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
    nextActions = [],
    importantReminders = [],
    strategyFocus = [],
    criticalDeadlines = [],
  } = actionSummary;

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
      nextActions: [...nextActions, val],
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
    applyActionSummaryUpdate({
      nextActions: nextActions.filter((_, i) => i !== index),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleMoveNextAction = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= nextActions.length || fromIndex === toIndex) return;

    const reordered = [...nextActions];
    const [item] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item);

    applyActionSummaryUpdate({
      nextActions: reordered,
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
    ...(nextActions || []).map((item) => ({ kind: "Next step", text: item })),
    ...(importantReminders || []).map((item) => ({ kind: "Reminder", text: item })),
  ];

  const scrollTopTabLabelMap = {
    overview: "Home",
    evidence: "Ev",
    incidents: "Inc",
    strategy: "Str",
    ledger: "Led",
    documents: "Doc",
  };

  const scrollTopLabel = scrollTopTabLabelMap[activeTab] || "Top";

  const handleOpenIssue = (issue) => {
    if (issue.tab) setActiveTab(issue.tab);
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

  const openLinkedRecord = (recordId) => {
    const found = resolveRecordById(selectedCase, recordId);
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
      deleteRecord={deleteRecord}
      openLinkedRecord={openLinkedRecord}
      openRecordModal={openRecordModal}
    />
  );
};

  const renderListBlock = (items, emptyText, recordType) => {
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
    const sorted = sortChronological(items);
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
  const needsReviewEvidence = allEvidence.filter(item => item.status === "needs_review");
  const incompleteEvidence = allEvidence.filter(item => item.status === "incomplete");
  const verifiedEvidence = allEvidence.filter(item => item.status === "verified");

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
  const generatedReportExists = Boolean(
    safeText(selectedCase?.generatedReportText).trim() ||
    safeText(selectedCase?.generatedReportVersions?.en).trim() ||
    safeText(selectedCase?.generatedReportVersions?.de).trim()
  );
  const overviewChecklistItems = [
    {
      label: "Parties",
      tabId: "parties",
      complete: (selectedCase?.parties || []).length > 0,
      detail: "At least one party has been added.",
    },
    {
      label: "Incidents",
      tabId: "incidents",
      complete: (selectedCase?.incidents || []).length > 0,
      detail: "At least one incident has been recorded.",
    },
    {
      label: "Evidence",
      tabId: "evidence",
      complete: (selectedCase?.evidence || []).length > 0,
      detail: "At least one evidence record exists.",
    },
    {
      label: "Documents",
      tabId: "documents",
      complete: (selectedCase?.documents || []).length > 0,
      detail: "At least one document exists.",
    },
    {
      label: "Timeline",
      tabId: "timeline",
      complete: timelineItems.length > 0,
      detail: "At least one timeline item exists.",
    },
    {
      label: "Reports",
      tabId: "generate-report",
      complete: generatedReportExists,
      detail: "A generated report has been saved.",
    },
  ].map((item) => ({
    ...item,
    status: item.complete ? "complete" : "not-started",
  }));
  const overviewSummaryItems = [
    { label: "Parties", tabId: "parties", count: (selectedCase?.parties || []).length },
    { label: "Incidents", tabId: "incidents", count: (selectedCase?.incidents || []).length },
    { label: "Evidence", tabId: "evidence", count: (selectedCase?.evidence || []).length },
    { label: "Documents", tabId: "documents", count: (selectedCase?.documents || []).length },
    { label: "Records", tabId: "records", count: (selectedCase?.records || []).length },
    { label: "Ledger", tabId: "ledger", count: (selectedCase?.ledger || []).length },
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
  const clientTopicGroups = useMemo(() => {
    const groups = [];
    const indexByLabel = new Map();

    for (const section of clientChainSections) {
      const label = safeText(section.trackLabel).trim() || "Other important issue";
      if (!indexByLabel.has(label)) {
        indexByLabel.set(label, groups.length);
        groups.push({ label, sections: [section] });
      } else {
        groups[indexByLabel.get(label)].sections.push(section);
      }
    }

    return groups;
  }, [clientChainSections]);
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

    return `[REPORT INSTRUCTIONS]
${PROVEIT_REPORT_PROMPT_V1}

[PROVEIT DATA NOTES]
CASE_REASONING_EXPORT is the AI-facing, non-importable reasoning snapshot. It contains incidents, evidence, documents, ledger, strategy, actionSummary, chronology, milestones, links, and resolvedLinks.
Incidents are timeline anchors. Evidence proves or supports incidents. Documents are source or working documents. Ledger entries are measurable financial, time, or compliance records. Strategy records are analysis and planning notes. actionSummary is the active operational summary.
functionSummary says what evidence proves. evidenceRole says how evidence functions in the case. evidenceStatus on incidents describes proof coverage or gaps. sequenceGroup can connect incidents, evidence, documents, and strategy into one issue or thread.
GPT delta import contract:
- gpt-delta-1.0 supports only operations.patch.actionSummary and operations.patch.strategy. It does not support create operations or incidents, evidence, documents, or ledger patches.
- gpt-delta-2.0 supports operations.create.incidents, operations.create.evidence, operations.create.documents, operations.create.ledger, and operations.patch.incidents, operations.patch.evidence, operations.patch.documents, operations.patch.ledger, operations.patch.strategy.
- gpt-delta-2.0 does not support operations.patch.actionSummary or operations.create.strategy. Use gpt-delta-1.0 for actionSummary patches and patch existing strategy records instead of creating strategy records.
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
  ]);
  const reportCentreMarkdown = useMemo(() => {
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
  }, [reportCentreActionPlan, reportCentreType]);

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
    setRenderedReportText(nextText);

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
      updatedAt: new Date().toISOString(),
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
  const reportHeadingLabel = (key) => getReportHeadingLabel(key, reportDisplayLanguage);
  const reportHeaderMeta = `Case: ${selectedCase?.id || "-"} - ${reportDisplayDate}`;
  const reportCoverSubtitle = [selectedCase?.category, selectedCase?.status]
    .map((item) => safeText(item).trim())
    .filter(Boolean)
    .join(" - ");
  const reportCentreScopeLabel = reportCentreScope.scopeType === "sequenceGroup"
    ? `sequenceGroup: ${selectedReportCentreSequenceGroup || "-"}`
    : "Whole case";
  const handleCopyReportCentreMarkdown = async () => {
    if (!reportCentreMarkdown) return;
    await copySequenceGroupText(reportCentreMarkdown);
  };
  const renderActionPlanList = (items = [], renderItem = (item) => item, emptyText = "None recorded.") => (
    items.length === 0 ? (
      <p className="mt-3 text-sm text-neutral-500">{emptyText}</p>
    ) : (
      <ul className="mt-4 space-y-2 text-sm leading-6 text-neutral-700">
        {items.map((item, index) => (
          <li key={item?.id || `${renderItem(item)}-${index}`} className="break-inside-avoid rounded-lg border border-neutral-200 bg-white p-3 print:break-inside-avoid">
            {renderItem(item)}
          </li>
        ))}
      </ul>
    )
  );
  const renderActionPlanReport = (report) => {
    if (!report) return null;
    const generatedDate = report.generatedAt ? new Date(report.generatedAt).toLocaleDateString("de-DE") : reportDisplayDate;
    return (
      <article className="mx-auto max-w-5xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
        <header className="border-b border-neutral-200 pb-6 print:pb-5">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">ACTION PLAN</div>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-neutral-950 print:text-[22pt]">{report.title}</h1>
              <div className="mt-3 grid gap-1 text-sm text-neutral-600">
                <div><span className="font-semibold text-neutral-950">Case:</span> {report.caseOverview.name || report.sourceCaseId || "Untitled Case"}</div>
                <div><span className="font-semibold text-neutral-950">Scope:</span> {report.scopeLabel}</div>
                <div><span className="font-semibold text-neutral-950">Generated:</span> {generatedDate}</div>
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 print:bg-white">
              <div><span className="font-semibold text-neutral-900">Confidentiality:</span> Local-first case report</div>
              <div><span className="font-semibold text-neutral-900">Open risks:</span> {report.counts.risks}</div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-neutral-500">
            This report is generated from the local ProveIt case file. Review before sharing with management, HR, legal reviewers, or third parties.
          </p>
        </header>

        <section className="border-b border-neutral-200 py-6 print:py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Current Focus</h2>
          <p className="mt-3 rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm leading-6 text-lime-950">
            {report.currentFocus || "No current focus recorded."}
          </p>
        </section>

        <section className="border-b border-neutral-200 py-6 print:py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Next Actions</h2>
          {renderActionPlanList(report.nextActions)}
        </section>

        <section className="grid gap-6 border-b border-neutral-200 py-6 print:py-5 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Critical Deadlines</h2>
            {renderActionPlanList(report.criticalDeadlines)}
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Strategy Focus</h2>
            {renderActionPlanList(report.strategyFocus)}
          </div>
        </section>

        <section className="grid gap-6 border-b border-neutral-200 py-6 print:py-5 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Open Strategy Records</h2>
            {renderActionPlanList(report.openStrategyRecords, (item) => item.title || item.id)}
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Open Tasks</h2>
            {renderActionPlanList(report.openTasks, (item) => item.title || item.id)}
          </div>
        </section>

        <section className="border-b border-neutral-200 py-6 print:py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Risks And Gaps</h2>
          {renderActionPlanList(report.risks, (item) => (
            <>
              <span className="font-semibold text-neutral-950">{item.label}: </span>
              {item.text || "Untitled item"}
            </>
          ), "No major risks are flagged by diagnostics.")}
        </section>

        <section className="py-6 print:py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Recommended Fixes</h2>
          {renderActionPlanList(report.recommendedFixes, (item) => item, "No generated fixes are needed from current diagnostics.")}
        </section>
      </article>
    );
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
    aiToolsOpen,
    incidentDateRepairOpen,
    activeLedgerRecord,
  });
  const floatingAddActions = [
    { label: "Add Incident", onClick: () => handleWorkspaceAddRecord("incidents") },
    { label: "Add Evidence", onClick: () => handleWorkspaceAddRecord("evidence") },
    { label: "Add Document", onClick: handleWorkspaceAddDocument },
    { label: "Add Ledger Entry", onClick: handleWorkspaceAddLedgerEntry },
    { label: "Add Strategy", onClick: () => handleWorkspaceAddRecord("strategy") },
    { label: "Add Idea", onClick: handleWorkspaceAddIdea },
  ];
  const floatingNavigationActions = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Timeline" },
    { id: "documents", label: "Documents" },
    { id: "ledger", label: "Ledger" },
    { id: "generate-report", label: "Reports" },
  ];
  const floatingToolActions = buildFloatingToolActions({
    handleWorkspaceOpenSequenceGroups,
    handleWorkspaceOpenSequenceGroupAuditExport,
    handleWorkspaceOpenIncidentDateRepairTool,
  });
  const aiToolOptions = AI_TOOL_OPTIONS;
  const aiWorkspaceSections = AI_WORKSPACE_SECTIONS;
  const aiToolById = new Map(aiToolOptions.map((tool) => [tool.id, tool]));
  const activeAiToolOption = aiToolOptions.find((tool) => tool.id === activeAiTool) || aiToolOptions[0];
  const activeAiToolNeedsSequenceGroup = activeAiTool === "chain-completion-pack" || activeAiTool === "full-chain-gpt-pack";
  const activeAiToolUsesReportBuilderScope = activeAiTool === "management-report-builder-pack";
  const aiWorkspaceIconMap = { Briefcase, Download, FileText, Network, Search };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button onClick={() => setSelectedCaseId(null)} className="mb-3 text-sm font-medium text-neutral-500 underline-offset-4 hover:underline">
            ← Back to Cases
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{selectedCase.name}</h2>
            <button onClick={() => openEditCaseModal(selectedCase)} className="text-sm font-medium text-lime-600 hover:text-lime-700">
              Edit
            </button>
            <button
              onClick={() => onOpenPinManager?.(selectedCase)}
              className="text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              {isPinLocked ? "Manage PIN" : "Set PIN"}
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-600">Category: {selectedCase.category}</p>
          <p className="mt-1 text-xs font-medium text-neutral-500">
            {isPinLocked ? "Privacy lock: PIN enabled" : "Privacy lock: off"}
          </p>
          {selectedCase.notes ? <p className="mt-3 max-w-2xl text-sm text-neutral-700">{selectedCase.notes}</p> : null}
        </div>
        <div className="flex gap-2 flex-wrap items-start">
          {onOpenGptDeltaModal && (
            <button
              onClick={onOpenGptDeltaModal}
              className="px-3 py-1.5 text-sm rounded-md whitespace-nowrap border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
            >
              GPT Update
            </button>
          )}

          <div className="relative flex-1 min-w-max">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full px-3 py-1.5 text-sm rounded-md whitespace-nowrap border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95 flex items-center justify-center gap-1"
            >
              Export <ChevronDown className={`h-4 w-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in duration-100">
                  <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Backup
                  </div>
                  <button 
                    onClick={() => { exportSelectedCase(); setShowExportMenu(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Download Full Case Backup
                  </button>
                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    GPT
                  </div>
                  <button 
                    onClick={() => { onExportSnapshot(selectedCase.id, "detailed"); setShowExportMenu(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Download Reasoning Snapshot JSON
                  </button>
                  <button
                    onClick={() => { onCopyLinkMapExport?.(selectedCase.id); setShowExportMenu(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Copy Link Map JSON
                  </button>
                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Data / AI Reference
                  </div>
                  <button
                    onClick={() => { handleDownloadGptProtocolPackJson(); setShowExportMenu(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Download GPT Protocol Pack JSON
                  </button>
                  <button
                    onClick={() => { handleDownloadGptProtocolPackMarkdown(); setShowExportMenu(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Download GPT Protocol Pack Markdown
                  </button>
                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Audit
                  </div>
                  <button
                    onClick={() => { openSequenceGroupAuditExport(); setShowExportMenu(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Open Sequence Group Audit
                  </button>
                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Reasoning Snapshot Upload
                  </div>
                  {ENABLE_SUPABASE_REMOTE ? (
                    <button
                      onClick={() => { onSendReasoningSnapshotToSupabase(); setShowExportMenu(false); }}
                      disabled={syncStatus === "syncing"}
                      className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Send Reasoning Snapshot
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex min-h-11 w-full cursor-not-allowed items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-400"
                    >
                      Reasoning Snapshot Upload disabled until secure auth is configured. Not a full backup; attachment binaries are not included.
                    </button>
                  )}
                </div>
              </>
            )}
            
            <div className="mt-1 flex flex-col items-center">
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
        nextActions={nextActions}
        importantReminders={importantReminders}
        criticalDeadlines={criticalDeadlines}
        quickActionInput={quickActionInput}
        onEdit={openActionSummaryEdit}
        onCopy={copyActionSummaryToClipboard}
        onMoveNextAction={handleMoveNextAction}
        onRemoveNextAction={handleRemoveNextAction}
        onQuickActionInputChange={setQuickActionInput}
        onQuickActionKeyDown={handleQuickActionKeyDown}
        onAddQuickAction={addQuickAction}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className={`${reviewQueueSection ? "lg:col-span-8" : "lg:col-span-12"} space-y-6`}>
          <div className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm print:hidden">
            <div className="flex flex-wrap gap-2">
              {tabs
                .flatMap((tab) => tab.id === "documents" ? [tab, { id: "records", label: "Records" }] : [tab])
                .map((tab) => {
                  const label = tab.id === "generate-report" ? "Reports" : tab.label;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-2xl border border-lime-500 px-4 py-2 text-sm font-medium shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors ${
                        activeTab === tab.id ? "bg-lime-400/30 text-neutral-900" : "bg-white text-neutral-700 hover:bg-lime-400/30"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="w-full rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            {/* Tab content logic... */}
            {activeTab === "overview" && (
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
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Investigation Checklist</div>
                  <div className="grid gap-2">
                    {overviewChecklistItems.map((item) => {
                      const statusText = item.status === "complete"
                        ? "✔ Complete"
                        : item.status === "started"
                          ? "⚠ Started but incomplete"
                          : "✖ Not started";
                      const statusClass = item.status === "complete"
                        ? "border-lime-200 bg-lime-50 text-lime-800"
                        : item.status === "started"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-neutral-200 bg-neutral-50 text-neutral-600";
                      const StatusIcon = item.status === "complete"
                        ? CheckCircle2
                        : item.status === "started"
                          ? AlertTriangle
                          : AlertCircle;

                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setActiveTab(item.tabId)}
                          className={`flex w-full flex-col gap-2 rounded-xl border px-3 py-3 text-left transition-colors hover:bg-white sm:flex-row sm:items-center sm:justify-between ${statusClass}`}
                        >
                          <span className="flex min-w-0 items-start gap-3">
                            <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-neutral-900">{item.label}</span>
                              <span className="block text-xs text-neutral-500">{item.detail}</span>
                            </span>
                          </span>
                          <span className="shrink-0 rounded-lg border border-current bg-white/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                            {statusText}
                          </span>
                        </button>
                      );
                    })}
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
                      Open Sequence Group Manager
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
                            <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-600 sm:grid-cols-4">
                              <div>Strategy: <span className="font-semibold">{openOperationalLoops.stats.staleStrategyItemCount}</span></div>
                              <div>Incidents: <span className="font-semibold">{openOperationalLoops.stats.weakIncidentCount}</span></div>
                              <div>Threads: <span className="font-semibold">{openOperationalLoops.stats.dormantThreadCount}</span></div>
                              <div>Actions: <span className="font-semibold">{openOperationalLoops.issues.filter((issue) => issue.code === "STALE_ACTION_SUMMARY").length}</span></div>
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
              <div className="space-y-6">
                <div className="space-y-8">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Needs Review</div>
                        <div className="mt-1 text-lg font-semibold text-neutral-900">{needsReviewEvidence.length}</div>
                      </div>

                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Incomplete</div>
                        <div className="mt-1 text-lg font-semibold text-neutral-900">{incompleteEvidence.length}</div>
                      </div>

                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Verified</div>
                        <div className="mt-1 text-lg font-semibold text-neutral-900">{verifiedEvidence.length}</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Needs Review</h3>
                      {renderListBlock(needsReviewEvidence, "No evidence needing review.", "evidence")}
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
                  </div>
              </div>
            )}
            {activeTab === "incidents" && renderListBlock(selectedCase.incidents, "No incidents yet. Add your first incident to start the case timeline.", "incidents")}
            {activeTab === "strategy" && renderListBlock(selectedCase.strategy, "No strategy notes yet. Add strategy to track approach and planning.", "strategy")}
            {activeTab === "parties" && (
              <PartiesTab
                parties={selectedCase.parties || []}
                onSaveParty={saveParty}
                onDeleteParty={deleteParty}
              />
            )}
            {activeTab === "narrative" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">Narrative</h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        Generated live from the current case state using incidents, linked evidence, and linked records.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("narrative")}
                      className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                    >
                      Refresh Narrative
                    </button>
                  </div>
                </div>

                {narrativeSections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                    No narrative output yet. Narrative sections are built from incidents and become stronger when linked evidence and records are attached.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {narrativeSections.map((section, index) => (
                      <article key={`${section.incident.id}-${section.date}-${index}`} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                              {section.date || "Undated incident"}
                            </div>
                            <h4 className="mt-1 text-lg font-semibold text-neutral-900">
                              {section.incident.title || "Untitled incident"}
                            </h4>
                          </div>
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
                            Incident anchor
                          </span>
                        </div>

                        {section.incident.description ? (
                          <p className="mt-4 text-sm leading-6 text-neutral-700">{section.incident.description}</p>
                        ) : (
                          <p className="mt-4 text-sm italic text-neutral-500">No incident description recorded.</p>
                        )}

                        {section.incident.notes ? (
                          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Incident Notes</div>
                            <p className="mt-1 text-sm text-neutral-700">{section.incident.notes}</p>
                          </div>
                        ) : null}

                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                          <section className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                            <div>
                              <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Supporting Evidence</h5>
                              <p className="mt-1 text-sm text-neutral-600">Evidence linked to this incident anchor.</p>
                            </div>
                            {section.supportingEvidence.length > 0 ? (
                              <div className="space-y-3">
                                {section.supportingEvidence.map((item) => (
                                  <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-neutral-900">{item.title || "Untitled evidence"}</span>
                                      {item.evidenceRole && (
                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                          {item.evidenceRole.replaceAll("_", " ")}
                                        </span>
                                      )}
                                      {item.sequenceGroup && (
                                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                          {item.sequenceGroup}
                                        </span>
                                      )}
                                    </div>
                                    {item.functionSummary ? (
                                      <p className="mt-2 text-sm text-neutral-700">{item.functionSummary}</p>
                                    ) : (
                                      <p className="mt-2 text-sm italic text-neutral-500">No function summary recorded.</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm italic text-neutral-500">No supporting evidence linked to this incident.</p>
                            )}
                          </section>

                          <section className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                            <div>
                              <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Supporting Records</h5>
                              <p className="mt-1 text-sm text-neutral-600">Documents or records linked to this incident anchor.</p>
                            </div>
                            {section.supportingRecords.length > 0 ? (
                              <div className="space-y-3">
                                {section.supportingRecords.map((item) => (
                                  <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-neutral-900">{item.title || "Untitled record"}</span>
                                      {item.recordType && (
                                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                          {item.recordType}
                                        </span>
                                      )}
                                    </div>
                                    {item.summary ? (
                                      <p className="mt-2 text-sm text-neutral-700">{item.summary}</p>
                                    ) : (
                                      <p className="mt-2 text-sm italic text-neutral-500">No summary recorded.</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm italic text-neutral-500">No supporting records linked to this incident.</p>
                            )}
                          </section>
                        </div>

                        <section className="mt-5 rounded-xl border border-lime-200 bg-lime-50 p-4">
                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-lime-800">Establishes</h5>
                            <p className="mt-1 text-sm text-lime-900">Conservative statements drawn from existing evidence summaries only.</p>
                          </div>
                          {section.establishes.length > 0 ? (
                            <ul className="mt-3 space-y-2 text-sm text-lime-950">
                              {section.establishes.map((statement) => (
                                <li key={statement}>- {statement}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm italic text-lime-900/70">No derived narrative statements yet.</p>
                          )}
                        </section>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "generate-report" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">Report Centre</h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        Generate professional case reports for management, legal review, evidence review, or action planning.
                      </p>
                    </div>
                  </div>
                </div>

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden">
                  <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr_0.7fr]">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Scope</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {[
                          ["case", "Whole Case"],
                          ["sequenceGroup", "Sequence Group"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setReportCentreScopeType(value)}
                            className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                              reportCentreScopeType === value
                                ? "border-lime-400 bg-lime-400/30 text-neutral-950"
                                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {reportCentreScopeType === "sequenceGroup" && (
                        <div className="mt-3">
                          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="report-centre-sequence-group">
                            sequenceGroup
                          </label>
                          {threadIssueReportSequenceOptions.length > 0 ? (
                            <select
                              id="report-centre-sequence-group"
                              value={selectedReportCentreSequenceGroup}
                              onChange={(event) => setReportCentreSequenceGroup(event.target.value)}
                              className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                            >
                              {threadIssueReportSequenceOptions.map((groupName) => (
                                <option key={groupName} value={groupName}>{groupName}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="mt-2 text-sm text-neutral-600">No sequence groups exist in this case yet.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Report Type</h4>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {[
                          ["management", "Management Report", "Concise professional report for managers, HR, and executives."],
                          ["investigation", "Investigation Report", "Detailed factual report for legal, specialist, or internal review."],
                          ["evidence", "Evidence Pack", "Evidence matrix and supporting material."],
                          ["document", "Document Pack", "Source document matrix, linked records, and attachment metadata."],
                          ["ledger", "Ledger Pack", "Financial, payment, and measurable record review."],
                          ["client", "Client Report", "GPT-assisted client-facing report drafting and rendering."],
                          ["action", "Action Plan", "Outstanding issues, next steps, risks, and recommendations."],
                        ].map(([value, label, description]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setReportCentreType(value)}
                            className={`rounded-lg border p-3 text-left ${
                              reportCentreType === value
                                ? "border-lime-400 bg-lime-400/20 text-neutral-950"
                                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                            }`}
                          >
                            <div className="text-sm font-bold">{label}</div>
                            <div className="mt-1 text-xs leading-5 text-neutral-500">{description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Output</h4>
                      <div className="mt-2 grid gap-2">
                        <div className="rounded-lg border border-lime-300 bg-lime-50 px-3 py-2 text-sm font-bold text-lime-900">
                          Preview
                        </div>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={reportCentreScopeType === "sequenceGroup" && !selectedReportCentreSequenceGroup}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-bold text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
                        >
                          Print / Save PDF
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyReportCentreMarkdown}
                          disabled={!reportCentreMarkdown}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400"
                        >
                          Copy Markdown
                        </button>
                        <button
                          type="button"
                          onClick={openSequenceGroupAuditExport}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700 transition-colors hover:bg-neutral-50"
                        >
                          Open Sequence Group Audit
                        </button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-neutral-500">
                        JSON is reserved for sequence group audit exports. DOCX and encrypted reports are not enabled in Phase 1.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex flex-col gap-2 border-b border-neutral-200 pb-3 print:hidden sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Preview</h4>
                      <p className="mt-1 text-sm text-neutral-600">
                        {reportCentreType === "management" && "Manager-ready report focused on findings, risks, awareness items, outstanding issues, and actions."}
                        {reportCentreType === "investigation" && (reportCentreScopeType === "sequenceGroup"
                          ? "Uses the existing Thread / Issue Report builder for the selected sequence group."
                          : "Uses the existing Case Bundle builder for whole-case investigation scope.")}
                        {reportCentreType === "evidence" && "Uses the existing Evidence Pack builder."}
                        {reportCentreType === "document" && "Uses the existing Document Pack builder."}
                        {reportCentreType === "ledger" && "Uses the existing Ledger Pack builder."}
                        {reportCentreType === "client" && "Uses the existing GPT-generated Client Report workflow and renderer."}
                        {reportCentreType === "action" && "Uses a deterministic Phase 1 action-plan placeholder from action summary and diagnostics."}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-600">
                      Scope: {reportCentreScopeLabel}
                    </div>
                  </div>

                  {reportCentreScopeType === "sequenceGroup" && !selectedReportCentreSequenceGroup ? (
                    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                      Assign records to a sequenceGroup before previewing a sequence group report.
                    </div>
                  ) : (
                    <>
                      {reportCentreType === "management" && (
                        <ExecutiveSummaryReportArticle
                          report={executiveSummaryReport}
                          polishedMarkdown={executiveSummaryPolishDraft}
                          className="mx-auto max-w-5xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
                        />
                      )}
                      {reportCentreType === "investigation" && reportCentreScopeType === "sequenceGroup" && (
                        <ThreadIssueReportArticle
                          report={reportCentreInvestigationReport}
                          visibility={threadIssueReportVisibility}
                          className="mx-auto max-w-5xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
                        />
                      )}
                      {reportCentreType === "investigation" && reportCentreScopeType === "case" && (
                        <CaseBundleReportArticle
                          report={reportCentreInvestigationReport}
                          className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
                        />
                      )}
                      {reportCentreType === "evidence" && (
                        <EvidencePackReportArticle
                          report={reportCentreEvidencePackReport}
                          className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
                        />
                      )}
                      {reportCentreType === "document" && (
                        <DocumentPackReportArticle
                          report={reportCentreDocumentPackReport}
                          className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
                        />
                      )}
                      {reportCentreType === "ledger" && (
                        <LedgerPackReportArticle
                          report={reportCentreLedgerPackReport}
                          className="mx-auto max-w-6xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
                        />
                      )}
                      {reportCentreType === "client" && (
                        <div className="mx-auto max-w-5xl space-y-5">
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
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs text-neutral-500">
                                The parser reads only the known ProveIt Report Format v1 sections and ignores everything else.
                              </p>
                              <button
                                type="button"
                                onClick={handleRenderGeneratedReport}
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

                            {!generatedReportHasVisibleContent ? (
                              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                                No report content is rendered yet. Paste a ProveIt Report Format v1 response and use Render Report.
                              </div>
                            ) : (
                              <GeneratedClientReportArticle
                                className="mt-4 mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
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
                      {reportCentreType === "action" && renderActionPlanReport(reportCentreActionPlan)}
                    </>
                  )}
                </section>

                <details className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden">
                  <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider text-neutral-500">
                    Advanced Reports
                  </summary>
                  <div className="mt-5 space-y-5">

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
                            <option value="sequenceGroup">sequenceGroup</option>
                          </select>
                        </div>
                        {caseBundleScopeType === "sequenceGroup" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="case-bundle-sequence-group">
                              sequenceGroup
                            </label>
                            {threadIssueReportSequenceOptions.length > 0 ? (
                              <select
                                id="case-bundle-sequence-group"
                                value={selectedCaseBundleSequenceGroup}
                                onChange={(event) => setCaseBundleSequenceGroup(event.target.value)}
                                className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                              >
                                {threadIssueReportSequenceOptions.map((groupName) => (
                                  <option key={groupName} value={groupName}>{groupName}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="mt-2 text-sm text-neutral-600">No sequence groups exist in this case yet.</p>
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
                          disabled={caseBundleScopeType === "sequenceGroup" && !selectedCaseBundleSequenceGroup}
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
                            sequenceGroup
                          </label>
                          {threadIssueReportSequenceOptions.length > 0 ? (
                            <select
                              id="thread-issue-report-sequence-group"
                              value={selectedThreadIssueReportSequenceGroup}
                              onChange={(event) => setThreadIssueReportSequenceGroup(event.target.value)}
                              className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                            >
                              {threadIssueReportSequenceOptions.map((groupName) => (
                                <option key={groupName} value={groupName}>{groupName}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="mt-2 text-sm text-neutral-600">
                              No sequence groups exist in this case yet.
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
                          disabled={!selectedThreadIssueReportSequenceGroup}
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
                          Select a case and sequenceGroup to preview the thread report.
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
                            <option value="sequenceGroup">sequenceGroup</option>
                          </select>
                        </div>
                        {ledgerPackScopeType === "sequenceGroup" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="ledger-pack-sequence-group">
                              sequenceGroup
                            </label>
                            {threadIssueReportSequenceOptions.length > 0 ? (
                              <select
                                id="ledger-pack-sequence-group"
                                value={selectedLedgerPackSequenceGroup}
                                onChange={(event) => setLedgerPackSequenceGroup(event.target.value)}
                                className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                              >
                                {threadIssueReportSequenceOptions.map((groupName) => (
                                  <option key={groupName} value={groupName}>{groupName}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="mt-2 text-sm text-neutral-600">No sequence groups exist in this case yet.</p>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={ledgerPackScopeType === "sequenceGroup" && !selectedLedgerPackSequenceGroup}
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
                            <option value="sequenceGroup">sequenceGroup</option>
                          </select>
                        </div>
                        {documentPackScopeType === "sequenceGroup" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="document-pack-sequence-group">
                              sequenceGroup
                            </label>
                            {threadIssueReportSequenceOptions.length > 0 ? (
                              <select
                                id="document-pack-sequence-group"
                                value={selectedDocumentPackSequenceGroup}
                                onChange={(event) => setDocumentPackSequenceGroup(event.target.value)}
                                className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                              >
                                {threadIssueReportSequenceOptions.map((groupName) => (
                                  <option key={groupName} value={groupName}>{groupName}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="mt-2 text-sm text-neutral-600">No sequence groups exist in this case yet.</p>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={documentPackScopeType === "sequenceGroup" && !selectedDocumentPackSequenceGroup}
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
                            <option value="sequenceGroup">sequenceGroup</option>
                          </select>
                        </div>
                        {evidencePackScopeType === "sequenceGroup" && (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="evidence-pack-sequence-group">
                              sequenceGroup
                            </label>
                            {threadIssueReportSequenceOptions.length > 0 ? (
                              <select
                                id="evidence-pack-sequence-group"
                                value={selectedEvidencePackSequenceGroup}
                                onChange={(event) => setEvidencePackSequenceGroup(event.target.value)}
                                className="mt-2 w-full min-w-60 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                              >
                                {threadIssueReportSequenceOptions.map((groupName) => (
                                  <option key={groupName} value={groupName}>{groupName}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="mt-2 text-sm text-neutral-600">No sequence groups exist in this case yet.</p>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          disabled={evidencePackScopeType === "sequenceGroup" && !selectedEvidencePackSequenceGroup}
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

                <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden">
                  <button
                    type="button"
                    onClick={() => setInternalReportGeneratorOpen((open) => !open)}
                    className="flex items-center gap-2 text-left"
                  >
                    {internalReportGeneratorOpen ? (
                      <ChevronDown className="h-4 w-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                      Internal Report (Coming Soon)
                    </span>
                  </button>
                  {internalReportGeneratorOpen && (
                    <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                      Internal report output is available in the Print Pack internal view.
                    </div>
                  )}
                </section>
                  </div>
                </details>
              </div>
            )}

            {activeTab === "ledger" && (
              <LedgerTab
                ledgerEntries={selectedCase?.ledger || []}
                ledgerFilter={ledgerFilter}
                collapsedLedgerGroups={collapsedLedgerGroups}
                onChangeFilter={setLedgerFilter}
                onToggleGroup={toggleLedgerGroup}
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
                        onClick={() => openDocumentModal({
                          title: "New Tracking Record",
                          textContent: `[TRACK RECORD]

    meta:
    type:
    subject:
    period:
    status:

    --- TABLE ---

    | Date       | Amount € | Direction | Status    | Notes |
    |------------|----------|-----------|-----------|-------|

    --- SUMMARY (GPT READY) ---



    --- FILE LINKS ---



    --- NOTES ---


    `
                        })}
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
                onAddRecord={() => openDocumentModal({
                  title: "New Tracking Record",
                  textContent: `[TRACK RECORD]

    meta:
    type:
    subject:
    period:
    status:

    --- TABLE ---

    | Date       | Amount € | Direction | Status    | Notes |
    |------------|----------|-----------|-----------|-------|

    --- SUMMARY (GPT READY) ---



    --- FILE LINKS ---



    --- NOTES ---


    `
                }, null, "record")}
                onViewPayments={setActiveLedgerRecord}
                onOpenRecord={(record) => openDocumentModal(record.rawDocument, record.rawDocument.id, "record")}
                onConvertRecord={(record) => openRecordConversion("documents", record.rawDocument)}
                onDeleteRecord={(record) => deleteDocumentEntry(record.rawDocument.id)}
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

            {activeTab === "timeline" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Case Timeline</h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        Incidents, evidence, documents, payments, and strategy in one chronological view.
                      </p>
                    </div>
                    <div className="text-xs font-medium text-neutral-500">
                      {timelineItems.length} item{timelineItems.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {timelineFilterOptions.map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => setTimelineView(filter.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          timelineView === filter.id
                            ? "border-lime-500 bg-lime-50 text-lime-800"
                            : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTimelineMilestonesOnly((value) => !value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        timelineMilestonesOnly
                          ? "border-amber-400 bg-amber-50 text-amber-800"
                          : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      Milestones only
                    </button>
                    {sequenceGroups.length > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value={timelineSequenceGroupFilter}
                          onChange={(event) => setTimelineSequenceGroupFilter(event.target.value)}
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 outline-none transition-colors hover:bg-neutral-50 focus:border-lime-500"
                        >
                          <option value="all">All sequence groups</option>
                          {sequenceGroups.map((group) => (
                            <option key={group.name} value={group.name}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                        {timelineSequenceGroupFilter !== "all" && (
                          <button
                            type="button"
                            onClick={() => setTimelineSequenceGroupFilter("all")}
                            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-50"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  const filteredTimelineItems = timelineItems.filter((item) => {
                    if (timelineMilestonesOnly && item.isMilestone !== true) return false;
                    if (
                      timelineSequenceGroupFilter !== "all" &&
                      String(item.source?.sequenceGroup || "").trim() !== timelineSequenceGroupFilter
                    ) return false;
                    if (timelineView === "all") return true;
                    if (timelineView === "payment") return item.recordType === "ledger";
                    return item.recordType === timelineView;
                  });

                  if (filteredTimelineItems.length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                        No timeline records match this view.
                      </div>
                    );
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

                  const badgeClassMap = {
                    incident: "border-red-200 bg-red-50 text-red-700",
                    evidence: "border-lime-200 bg-lime-50 text-lime-700",
                    document: "border-sky-200 bg-sky-50 text-sky-700",
                    ledger: "border-amber-200 bg-amber-50 text-amber-700",
                    strategy: "border-neutral-300 bg-neutral-100 text-neutral-700",
                  };
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
                    <div className="space-y-4">
                      {timelineGroups.map((group) => (
                        <section key={group.date} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{group.date}</h4>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                              {group.items.length} item{group.items.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          {group.items.map((item) => {
                            const isTimelineMilestone =
                              (item.recordType === "incident" || item.recordType === "evidence") && item.isMilestone === true;
                            return (
                              <div
                                key={`${item.recordType}-${item.id}`}
                                className={`grid gap-3 rounded-xl border p-3 shadow-sm sm:grid-cols-[7.5rem_1fr] ${
                                  isTimelineMilestone
                                    ? "border-amber-300 border-l-4 bg-amber-50/50 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]"
                                    : "border-neutral-200 bg-white"
                                }`}
                              >
                                <div className="text-xs font-semibold text-neutral-500">
                                  {item.date || "No date"}
                                </div>
                                <div className="min-w-0">
                                  {isTimelineMilestone && (
                                    <div className="mb-2">
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                                        Milestone
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClassMap[item.recordType] || "border-neutral-200 bg-neutral-50 text-neutral-600"}`}>
                                      {labelMap[item.recordType] || item.recordType}
                                    </span>
                                    {detailLabelMap[item.typeDetail] && detailLabelMap[item.typeDetail] !== labelMap[item.recordType] && (
                                      <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                        {detailLabelMap[item.typeDetail]}
                                      </span>
                                    )}
                                    {renderSequenceGroupChip(item.source?.sequenceGroup)}
                                    <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                                      {item.title}
                                    </h4>
                                  </div>
                                  {item.summary ? (
                                    <p className="mt-1 text-sm leading-5 text-neutral-600">{item.summary}</p>
                                  ) : (
                                    <p className="mt-1 text-sm text-neutral-400">No summary yet.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </section>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "pack" && (
              <div className="print-pack-shell space-y-4 text-neutral-800 print:bg-white print:text-black">
                <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
                  <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
                    {[
                      { id: "internal", label: "Internal View" },
                      { id: "client", label: "Client Report" },
                      { id: "lawyer", label: "Lawyer Pack" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setReportMode(mode.id)}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                          reportMode === mode.id
                            ? "bg-lime-500 text-white shadow-sm"
                            : "text-neutral-600 hover:bg-neutral-50"
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
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-lime-700">Case Report</div>
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
                {reportMode === "client" && generatedReportHasVisibleContent && (
                  <GeneratedClientReportArticle
                    className="print-pack-article mx-auto max-w-4xl rounded-xl border border-neutral-200 bg-white px-7 py-8 shadow-sm shadow-neutral-100 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none"
                    displayLanguage={reportDisplayLanguage}
                    headerLogo={proveItHeaderLogo}
                    parsedReport={parsedGeneratedReport}
                    reportCoverSubtitle={reportCoverSubtitle}
                    reportHeaderMeta={reportHeaderMeta}
                    selectedCase={selectedCase}
                    variant="pack"
                  />
                )}
                {reportMode === "client" && !generatedReportHasVisibleContent && (
                  <article className="print-pack-article mx-auto max-w-4xl rounded-xl border border-neutral-200 bg-white px-6 py-7 shadow-sm shadow-neutral-100 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
                    <div className="proveit-print-cover proveit-print-cover-break print:block hidden">
                      <div className="proveit-print-cover-brand">
                        <img src={proveItHeaderLogo} alt="ProveIt" />
                        <div>
                          <div className="text-sm font-bold uppercase tracking-[0.18em] text-neutral-900">ProveIt</div>
                          <div className="mt-1 text-[9pt] font-medium text-neutral-500">Evidence Management & Case Engine</div>
                        </div>
                      </div>
                      <div className="proveit-print-cover-title">
                        <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">CLIENT REPORT</div>
                        <h1 className="mt-5 text-4xl font-bold leading-tight text-neutral-950 print:text-[26pt]">Client Report</h1>
                        <p className="mt-5 text-lg font-semibold text-neutral-800 print:text-[15pt]">
                          {selectedCase?.name || selectedCase?.id || "Untitled Case"}
                        </p>
                        <p className="mt-3 text-sm font-medium text-neutral-500 print:text-[11pt]">{reportHeaderMeta}</p>
                        {reportCoverSubtitle && (
                          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 print:text-[9pt]">
                            {reportCoverSubtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <header className="proveit-print-body-header print-pack-header break-inside-avoid border-b border-neutral-200 pb-6 print:hidden">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">CLIENT REPORT</div>
                      <div className="mt-2 flex items-center justify-between gap-4 print:mt-4">
                        <h1 className="min-w-0 break-words text-3xl font-bold leading-tight text-neutral-950 print:text-[22pt]">
                          {selectedCase.name || "Untitled Case"}
                        </h1>
                        <div className="shrink-0 whitespace-nowrap text-right text-base font-medium text-neutral-500 print:mt-2 print:text-[11pt]">
                          {reportHeaderMeta}
                        </div>
                      </div>
                    </header>
                    <section className="print-pack-major break-inside-avoid py-6 print:py-5">
                      <div className="border-b border-neutral-100 pb-3">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">{reportHeadingLabel("YOUR_SITUATION")}</h4>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                        {clientSummary}
                      </p>
                    </section>

                    {clientConcernTracks.length > 0 && (
                      <section className="print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                        <div className="border-b border-neutral-100 pb-3">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">{reportHeadingLabel("MAIN_AREAS_OF_CONCERN")}</h4>
                        </div>
                        <ul className="mt-4 space-y-3">
                          {clientConcernTracks.map((track) => (
                            <li key={track} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
                              {track}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {clientGlobalConclusions.length > 0 && (
                      <section className="print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                        <div className="border-b border-neutral-100 pb-3">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">{reportHeadingLabel("WHAT_THIS_REPORT_SHOWS")}</h4>
                        </div>
                        <ul className="mt-4 space-y-3">
                          {clientGlobalConclusions.slice(0, 5).map((statement) => (
                            <li key={statement} className="rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm leading-6 text-lime-950">
                              {statement}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <section className="print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                      <div className="border-b border-neutral-100 pb-3">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Key Issues By Topic</h4>
                      </div>
                      {clientTopicGroups.length > 0 ? (
                        <div className="mt-4 space-y-5">
                          {clientTopicGroups.map((group) => (
                            <section key={group.label} className="space-y-4">
                              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                                <h5 className="text-sm font-semibold uppercase tracking-wider text-neutral-600">{group.label}</h5>
                              </div>
                              {group.sections.map((section, index) => (
                                <section
                                  key={`${group.label}-${section.incident.id}-${index}`}
                                  className="print-pack-issue-section print-pack-narrative-section break-inside-avoid rounded-lg border border-l-4 border-neutral-200 border-l-lime-500 bg-white p-5"
                                >
                                  <div className="border-b border-neutral-100 pb-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{reportHeadingLabel("ISSUE")}</div>
                                    <h5 className="mt-2 break-words text-xl font-semibold leading-tight text-neutral-950">
                                      {section.incident.title || "Untitled incident"}
                                    </h5>
                                    {section.date && (
                                      <p className="mt-2 text-sm text-neutral-500">{section.date}</p>
                                    )}
                                  </div>

                                  <div className="mt-4">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{reportHeadingLabel("WHAT_HAPPENED")}</div>
                                    <p className="mt-2 text-sm leading-6 text-neutral-700">
                                      {section.shortWhatHappened || "There is not yet a clear written summary of what happened here."}
                                    </p>
                                  </div>

                                  <div className="print-pack-support-grid mt-5 grid gap-4 lg:grid-cols-2">
                                    <section className="proveit-print-avoid-break rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
                                      <h6 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{reportHeadingLabel("KEY_PROOF")}</h6>
                                      {section.keyProof.length > 0 ? (
                                        <div className="mt-3 space-y-3">
                                          {section.keyProof.map((item) => (
                                            <div key={item.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                                              <div className="font-semibold text-neutral-900">{item.title || "Untitled document"}</div>
                                              <p className="mt-2 text-sm leading-6 text-neutral-700">
                                                {item.summary || "There is not yet a clear explanation of why this matters."}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-sm italic text-neutral-500">There is not yet enough supporting material shown for this issue.</p>
                                      )}
                                    </section>

                                    {section.supportingRecords.length > 0 && (
                                      <section className="proveit-print-avoid-break rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
                                        <h6 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Supporting document</h6>
                                        <div className="mt-3 space-y-3">
                                          {section.supportingRecords.slice(0, 1).map((item) => (
                                            <div key={item.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                                              <div className="font-semibold text-neutral-900">{item.title || "Untitled record"}</div>
                                              <p className="mt-2 text-sm leading-6 text-neutral-700">
                                                {safeText(item.summary).trim() || "There is not yet a clear summary of this document."}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </section>
                                    )}
                                  </div>

                                  {section.chainConclusions.length > 0 && (
                                    <section className="proveit-print-avoid-break mt-5 rounded-lg border border-lime-200 bg-lime-50/70 p-4">
                                      <h6 className="text-xs font-bold uppercase tracking-wider text-lime-800">{reportHeadingLabel("WHAT_THIS_MEANS")}</h6>
                                      <ul className="mt-3 space-y-2 text-sm leading-6 text-lime-950">
                                        {section.chainConclusions.slice(0, 3).map((statement) => (
                                          <li key={statement}>- {statement}</li>
                                        ))}
                                      </ul>
                                    </section>
                                  )}
                                </section>
                              ))}
                            </section>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-neutral-500">
                          The main issues are not yet clear enough to present here.
                        </p>
                      )}
                    </section>

                    {clientMetricItems.length > 0 && (
                      <section className="proveit-print-section proveit-print-section-break print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                        <div className="border-b border-neutral-100 pb-3">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">{reportHeadingLabel("KEY_FACTS")}</h4>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {clientMetricItems.map((item) => (
                            <div key={item.label} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{item.label}</div>
                              <div className="mt-2 text-lg font-semibold text-neutral-950">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="print-pack-major break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                      <div className="border-b border-neutral-100 pb-3">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">{reportHeadingLabel("RECOMMENDED_NEXT_STEPS")}</h4>
                      </div>
                      {clientNextSteps.length > 0 ? (
                        <ul className="mt-4 space-y-3">
                          {clientNextSteps.map((item) => (
                            <li key={item} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-4 text-sm text-neutral-500">
                          There are no clear next steps to show here yet.
                        </p>
                      )}
                    </section>
                    <footer className="proveit-print-footer">
                      {reportHeaderMeta}
                    </footer>
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
              </div>
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
          onClick={scrollToTop}
          className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-lime-600 text-[10px] font-bold leading-none text-center text-white shadow-lg transition-all active:scale-95 hover:bg-lime-700 print:hidden"
        >
          {scrollTopLabel}
        </button>
      )}

      {aiToolsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/30 p-2 print:hidden sm:p-4">
          <div
            ref={aiToolsModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-tools-modal-title"
            tabIndex={-1}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-100 bg-white p-4 sm:p-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">AI command center</div>
                <h3 id="ai-tools-modal-title" className="mt-1 text-lg font-semibold text-neutral-900">AI Workspace</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Choose focused, non-importable GPT work packs, specialist workflows, and sequence-chain AI handoffs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiToolsOpen(false)}
                className="sticky top-0 shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain md:grid-cols-[21rem_1fr]">
              <aside className="border-b border-neutral-100 bg-neutral-50/60 p-3 md:border-b-0 md:border-r">
                <div className="space-y-3">
                  {aiWorkspaceSections.map((section) => {
                    const SectionIcon = aiWorkspaceIconMap[section.icon] || FileText;
                    return (
                      <section key={section.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="flex items-start gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                            <SectionIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">{section.title}</h4>
                            <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">{section.description}</p>
                          </div>
                        </div>
                        <div className="mt-2 grid gap-1.5">
                          {section.toolIds.map((toolId) => {
                            const tool = aiToolById.get(toolId);
                            if (!tool) return null;
                            return (
                              <button
                                key={`${section.id}-${tool.id}`}
                                type="button"
                                onClick={() => {
                                  setActiveAiTool(tool.id);
                                  if (tool.id === "management-report-builder-pack") {
                                    setAiToolsSequenceGroup(MANAGEMENT_REPORT_BUILDER_WHOLE_CASE);
                                  } else if ((tool.id === "chain-completion-pack" || tool.id === "full-chain-gpt-pack") && !aiToolsSequenceGroup) {
                                    setAiToolsSequenceGroup(selectedSequenceGroupName || sequenceGroups[0]?.name || "");
                                  }
                                  setAiToolsFeedback("");
                                }}
                                className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                                  activeAiTool === tool.id
                                    ? "border-sky-400 bg-sky-50 text-neutral-950"
                                    : "border-neutral-200 bg-white text-neutral-700 hover:border-sky-200 hover:bg-sky-50/60"
                                }`}
                              >
                                <div className="text-xs font-bold">{tool.title}</div>
                                <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-neutral-500">{tool.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </aside>

              <section className="space-y-4 p-4 sm:p-5">
                {aiToolsFeedback && (
                  <div className="rounded-md border border-lime-200 bg-lime-50 p-3 text-sm font-medium text-lime-800">
                    {aiToolsFeedback}
                  </div>
                )}

                <div>
                  <h4 className="text-base font-semibold text-neutral-950">{activeAiToolOption.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">{activeAiToolOption.description}</p>
                </div>

                {(activeAiToolNeedsSequenceGroup || activeAiToolUsesReportBuilderScope) && (
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      {activeAiToolUsesReportBuilderScope ? "Scope" : "Sequence group"}
                    </span>
                    <select
                      value={aiToolsSequenceGroup}
                      onChange={(event) => {
                        setAiToolsSequenceGroup(event.target.value);
                        setAiToolsFeedback("");
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                    >
                      {activeAiToolUsesReportBuilderScope && (
                        <option value={MANAGEMENT_REPORT_BUILDER_WHOLE_CASE}>Whole Case</option>
                      )}
                      {sequenceGroups.length === 0 && !activeAiToolUsesReportBuilderScope ? (
                        <option value="">No sequence groups available</option>
                      ) : sequenceGroups.map((group) => (
                        <option key={group.name} value={group.name}>
                          {group.name} ({group.totalCount} records)
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {activeAiTool === "case-slice-pack" && (
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Selected record IDs</span>
                    <textarea
                      value={caseSliceRecordIdsText}
                      onChange={(event) => {
                        setCaseSliceRecordIdsText(event.target.value);
                        setAiToolsFeedback("");
                      }}
                      rows={8}
                      placeholder={'{"incidents":["inc-1"],"evidence":["ev-1"],"documents":["doc-1"],"strategy":[],"ledger":[]}\n\nor\nincidents: inc-1, inc-2\nevidence: ev-1'}
                      className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs leading-5 text-neutral-800 outline-none focus:border-lime-500"
                    />
                    <p className="mt-2 text-xs leading-5 text-neutral-500">
                      Use JSON arrays or one line per type: incidents, evidence, documents, strategy, ledger.
                    </p>
                  </label>
                )}

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
                  <div className="font-semibold text-neutral-900">Pack rules</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Non-importable JSON with no attachment payloads or binaries.</li>
                    <li>Record IDs are preserved so GPT recommendations map back to ProveIt.</li>
                    <li>Document excerpts are bounded and labeled as untrusted source material.</li>
                    <li>Prompts explicitly say: Do not invent facts. Do not generate deltas.</li>
                  </ul>
                </div>

              </section>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 border-t border-neutral-100 bg-white p-4 sm:px-5">
              <button
                type="button"
                disabled={activeAiToolNeedsSequenceGroup && !aiToolsSequenceGroup}
                onClick={() => handleCopyAiToolJson()}
                className="rounded-md border border-lime-500 bg-white px-3 py-2 text-sm font-bold text-neutral-900 hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-white"
              >
                Copy JSON
              </button>
              <button
                type="button"
                disabled={activeAiToolNeedsSequenceGroup && !aiToolsSequenceGroup}
                onClick={() => handleCopyAiToolMarkdown()}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400"
              >
                Copy Markdown Prompt
              </button>
              {activeAiToolUsesReportBuilderScope && (
                <button
                  type="button"
                  onClick={() => handleCopyAiToolSpecialistPrompt()}
                  className="rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-bold text-sky-800 hover:bg-sky-50"
                >
                  Copy Specialist Prompt
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <FloatingWorkspaceMenu
        visible={showFloatingWorkspaceMenu}
        open={workspaceActionMenuOpen}
        activeTab={activeTab}
        addActions={floatingAddActions}
        navigationActions={floatingNavigationActions}
        toolActions={floatingToolActions}
        onClose={closeWorkspaceActionMenu}
        onNavigate={handleWorkspaceNavigate}
        onOpenAiWorkspace={() => openAiTool(activeAiTool || "management-report-builder-pack")}
        onBackToTop={handleWorkspaceBackToTop}
        onToggleOpen={() => setWorkspaceActionMenuOpen((open) => !open)}
      />

      {sequenceGroupAuditExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 print:hidden">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Sequence Group Audit Pack</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Export one sequence group with linked evidence, document metadata, external linked incidents, diagnostics, and a GPT audit prompt.
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

              {sequenceGroups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
                  No sequence groups exist in this case. Assign records to a sequenceGroup before creating this audit export.
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Sequence group</span>
                    <select
                      value={selectedSequenceGroupAuditGroup}
                      onChange={(event) => {
                        setSequenceGroupAuditGroup(event.target.value);
                        setSequenceGroupAuditFeedback("");
                      }}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500"
                    >
                      {sequenceGroups.map((group) => (
                        <option key={group.name} value={group.name}>
                          {group.name} ({group.totalCount} records)
                        </option>
                      ))}
                    </select>
                  </label>

                  <fieldset>
                    <legend className="text-xs font-bold uppercase tracking-wider text-neutral-500">Output format</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {[
                        ["json", "JSON"],
                        ["markdown", "Markdown"],
                        ["pdf", "PDF / print"],
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
                disabled={sequenceGroups.length === 0}
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
                        <th className="px-3 py-2">Sequence group</th>
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
          onCopyChainCompletionPackJson={(groupName) => handleCopyAiToolJson("chain-completion-pack", groupName)}
          onCopyChainCompletionPackMarkdown={(groupName) => handleCopyAiToolMarkdown("chain-completion-pack", groupName)}
          onCopyFullChainGptPackJson={(groupName) => handleCopyAiToolJson("full-chain-gpt-pack", groupName)}
          onCopyFullChainGptPackMarkdown={(groupName) => handleCopyAiToolMarkdown("full-chain-gpt-pack", groupName)}
          onCopyReviewPackage={handleCopySequenceGroupReviewPackage}
          onDownloadGroupIndexJson={handleDownloadSequenceGroupsIndexJson}
          onDownloadGroupIndexMarkdown={handleDownloadSequenceGroupsIndexMarkdown}
          onMergeGroup={handleMergeSequenceGroup}
          onMoveRecordToExisting={handleMoveSequenceRecordToExisting}
          onMoveRecordToNew={handleMoveSequenceRecordToNew}
          onOpenRecordEdit={handleOpenSequenceRecordEdit}
          onOpenAuditExport={openSequenceGroupAuditExportFromManager}
          onRelationshipNodeSelect={handleSelectSequenceRelationshipNode}
          onRemoveGroup={handleRemoveSequenceGroup}
          onRenameGroup={handleRenameSequenceGroup}
          onTimelineItemSelect={handleSelectSequenceTimelineItem}
          onValidateDelta={handleValidateSequenceGroupDelta}
          search={sequenceGroupSearch}
          selectedCase={selectedCase}
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
          setSelectedGroupName={setSelectedSequenceGroupName}
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

