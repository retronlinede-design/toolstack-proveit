import { useState, useEffect, useMemo } from "react";
import AttachmentPreview from "./AttachmentPreview";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck, Tags, X } from "lucide-react";
import proveItHeaderLogo from "../assets/proveitheader.png";
import { isTimelineCapable, getCaseHealthReport } from "../lib/caseHealth";
import { getIncidentsUsingRecord } from "../domain/caseDomain.js";
import { getRecordDisplayMeta, resolveRecordById } from "../domain/linkingResolvers.js";
import { buildNarrativeSections } from "../lib/narrativeBuilder.js";
import { PROVEIT_REPORT_PROMPT_V1, parseProveItReportV1 } from "../lib/proveitReportFormat.js";
import { DEFAULT_REPORT_DISPLAY_LANGUAGE, REPORT_DISPLAY_LANGUAGES, getReportHeadingLabel } from "../lib/reportHeadingLabels.js";
import { buildCaseLinkMapExportPayload } from "../export/linkMapExport.js";
import { getLinkChipClasses } from "./linkChipStyles";
import LinkedChip from "./LinkedChip";
import RecordCard from "./RecordCard";

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

const emptyActionSummaryForm = {
  currentFocus: "",
  nextActions: "",
  importantReminders: "",
  strategyFocus: "",
};

const emptyActionSummary = {
  currentFocus: "",
  nextActions: [],
  importantReminders: [],
  strategyFocus: [],
  criticalDeadlines: [],
};

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

function safeTextList(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
}

function normalizeActionSummary(actionSummary = {}) {
  return {
    ...emptyActionSummary,
    ...actionSummary,
    currentFocus: safeText(actionSummary.currentFocus),
    nextActions: safeTextList(actionSummary.nextActions),
    importantReminders: safeTextList(actionSummary.importantReminders),
    strategyFocus: safeTextList(actionSummary.strategyFocus),
    criticalDeadlines: safeTextList(actionSummary.criticalDeadlines),
  };
}

function applyActionSummaryPatch(currentActionSummary = {}, patch = {}) {
  const nextActionSummary = { ...currentActionSummary };
  const patchableFields = [
    "currentFocus",
    "nextActions",
    "importantReminders",
    "strategyFocus",
    "criticalDeadlines",
    "updatedAt",
  ];

  patchableFields.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      nextActionSummary[field] = patch[field];
    }
  });

  const normalized = normalizeActionSummary(nextActionSummary);
  const patchedActionSummary = {
    ...nextActionSummary,
    currentFocus: normalized.currentFocus,
    nextActions: normalized.nextActions,
    importantReminders: normalized.importantReminders,
    strategyFocus: normalized.strategyFocus,
  };

  if (Object.prototype.hasOwnProperty.call(nextActionSummary, "criticalDeadlines")) {
    patchedActionSummary.criticalDeadlines = normalized.criticalDeadlines;
  }

  if (Object.prototype.hasOwnProperty.call(nextActionSummary, "updatedAt")) {
    patchedActionSummary.updatedAt = safeText(nextActionSummary.updatedAt);
  }

  return patchedActionSummary;
}

function actionSummaryToForm(actionSummary = {}) {
  const normalized = normalizeActionSummary(actionSummary);

  return {
    currentFocus: normalized.currentFocus,
    nextActions: normalized.nextActions.join("\n"),
    importantReminders: normalized.importantReminders.join("\n"),
    strategyFocus: normalized.strategyFocus.join("\n"),
  };
}

function formToActionSummary(form) {
  return {
    currentFocus: safeText(form.currentFocus),
    nextActions: safeText(form.nextActions).split("\n").filter(Boolean),
    importantReminders: safeText(form.importantReminders).split("\n").filter(Boolean),
    strategyFocus: safeText(form.strategyFocus).split("\n").filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
}

export default function CaseDetail({
  selectedCase,
  reviewQueue,
  activeTab,
  setActiveTab,
  tabs,
  imageCache,
  setSelectedCaseId,
  openRecordModal,
  renderCaseList,
  openEditRecordModal,
  openEditCaseModal,
  deleteRecord,
  exportSelectedCase,
  onUpdateCase,
  onExportSnapshot,
  onCopyLinkMapExport,
  onSendReasoningSnapshotToSupabase,
  onSendReasoningExportToSupabase,
  onExportFullBackup,
  onOpenGptDeltaModal,
  onOpenPinManager,
  isPinLocked = false,
  issueFixFeedback = "",
  onViewRecord,
  onPreviewFile,
  openLedgerModal,
  deleteLedgerEntry,
  duplicateLedgerEntry,
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timelineView, setTimelineView] = useState("all");
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
  const [caseStructureReportOpen, setCaseStructureReportOpen] = useState(false);
  const [clientReportGeneratorOpen, setClientReportGeneratorOpen] = useState(false);
  const [internalReportGeneratorOpen, setInternalReportGeneratorOpen] = useState(false);
  const [caseStructureReportText, setCaseStructureReportText] = useState("");
  const [caseStructureReportFeedback, setCaseStructureReportFeedback] = useState("");
  const activeGeneratedReportLanguage = normalizeReportLanguage(selectedCase?.activeGeneratedReportLanguage);

  useEffect(() => {
    const nextText = getGeneratedReportTextForLanguage(selectedCase, activeGeneratedReportLanguage);
    setReportDisplayLanguage(activeGeneratedReportLanguage);
    setGeneratedReportDraft(nextText);
    setRenderedReportText(nextText);
    setReportPromptFeedback("");
  }, [
    selectedCase?.id,
    selectedCase?.generatedReportText,
    selectedCase?.generatedReportVersions,
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
    setClientReportGeneratorOpen(false);
    setInternalReportGeneratorOpen(false);
    setCaseStructureReportOpen(false);
  }, [activeTab]);

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

  function isTrackingRecord(doc) {
    return typeof doc?.textContent === "string" && doc.textContent.includes("[TRACK RECORD]");
  }

  function getDocumentTextStatus(doc) {
    const text = typeof doc?.textContent === "string" ? doc.textContent.trim() : "";
    const attachmentCount = Array.isArray(doc?.attachments) ? doc.attachments.length : 0;
    const charCount = text.length;
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

    if (charCount > 1000) {
      return {
        label: "Partial Text",
        detail: "Long text is captured; review the important parts.",
        tone: "amber",
        charCount,
        wordCount,
      };
    }

    if (charCount >= 80) {
      return {
        label: "GPT Ready",
        detail: "Usable text is captured for reasoning.",
        tone: "green",
        charCount,
        wordCount,
      };
    }

    if (attachmentCount > 0 && charCount === 0) {
      return {
        label: "No Usable Text",
        detail: "Only attachments are present.",
        tone: "red",
        charCount,
        wordCount,
      };
    }

    if (charCount > 0) {
      return {
        label: "Partial Text",
        detail: "Some text is captured, but it may be thin.",
        tone: "amber",
        charCount,
        wordCount,
      };
    }

    return {
      label: "No Usable Text",
      detail: "No document text is captured.",
      tone: "red",
      charCount,
      wordCount,
    };
  }

  function getDocumentStatusClasses(tone) {
    if (tone === "green") return "border-lime-200 bg-lime-50 text-lime-700";
    if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-red-200 bg-red-50 text-red-700";
  }

  function getSection(text, startMarker, endMarker = null) {
    if (!text || !startMarker) return "";
    const start = text.indexOf(startMarker);
    if (start === -1) return "";

    const from = start + startMarker.length;
    const rest = text.slice(from);

    if (!endMarker) return rest.trim();

    const end = rest.indexOf(endMarker);
    if (end === -1) return rest.trim();

    return rest.slice(0, end).trim();
  }

  function parseMetaBlock(metaText) {
    const meta = {
      type: "",
      subject: "",
      period: "",
      status: "",
    };

    if (!metaText) return meta;

    metaText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(line => {
        const idx = line.indexOf(":");
        if (idx === -1) return;

        const key = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();

        if (key in meta) {
          meta[key] = value;
        }
      });

    return meta;
  }

  function parseTrackTable(tableText) {
    if (!tableText) return [];

    const lines = tableText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("|") && line.endsWith("|"));

    if (lines.length < 3) return [];

    const headers = lines[0]
      .split("|")
      .map(cell => cell.trim())
      .filter(Boolean);

    const separator = lines[1];
    const dataLines = lines.slice(2);

    if (!separator.includes("---")) return [];

    return dataLines
      .map(line => line.split("|").map(cell => cell.trim()).filter(Boolean))
      .filter(cells => cells.length === headers.length)
      .map(cells => {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = cells[index] ?? "";
        });
        return row;
      });
  }

  function getRecordTypeLabel(metaType = "") {
    const value = String(metaType || "").toLowerCase();
    if (value === "payment_tracker") return "Financial";
    if (value === "work_time") return "Work Time";
    if (value === "compliance") return "Compliance";
    if (value === "custom") return "Custom";
    return metaType || "Unknown";
  }

  function legacyEuroSymbol() {
    return String.fromCharCode(0x00e2, 0x201a, 0x00ac);
  }

  function formatRecordTableHeader(header = "") {
    return String(header || "").replaceAll(legacyEuroSymbol(), "€");
  }

  function getRecordTableHeaders(rows = []) {
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
    const preferred = ["Period/Date", "Date", "Expected", "Amount €", "Actual", "Difference", "Unit", "Direction", "Status", "Notes"];
    return headers.sort((a, b) => {
      const aIndex = preferred.indexOf(a);
      const bIndex = preferred.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      }
      return a.localeCompare(b);
    });
  }

  function getRecordStatusClasses(status = "") {
    const value = String(status || "").toLowerCase();
    if (["paid", "confirmed", "complete", "completed", "compliant", "ok", "done"].includes(value)) {
      return "border-lime-200 bg-lime-50 text-lime-700";
    }
    if (["pending", "partial", "part-paid", "disputed", "review", "in_progress"].includes(value)) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    if (["unpaid", "missing", "late", "failed", "violation", "not_paid", "noncompliant"].includes(value)) {
      return "border-red-200 bg-red-50 text-red-700";
    }
    return "border-neutral-200 bg-neutral-50 text-neutral-600";
  }

  function getDifferenceClasses(value = "") {
    const normalized = String(value || "").replace("€", "").replace(legacyEuroSymbol(), "").replace(",", ".").trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      if (parsed > 0) return "text-lime-700";
      if (parsed < 0) return "text-red-700";
    }
    if (/owed|missing|short|late|unpaid|negative|under/i.test(String(value))) return "text-red-700";
    return "text-neutral-700";
  }

  function parseFileLinks(sectionText) {
    if (!sectionText) return [];
    return sectionText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("-"))
      .map(line => line.replace(/^-+\s*/, "").trim())
      .filter(Boolean);
  }

  function parseTrackingRecord(doc) {
    const text = doc?.textContent || "";

    const metaText = getSection(text, "meta:", "--- TABLE ---");
    const tableText = getSection(text, "--- TABLE ---", "--- SUMMARY (GPT READY) ---");
    const summaryText = getSection(text, "--- SUMMARY (GPT READY) ---", "--- FILE LINKS ---");
    const fileLinksText = getSection(text, "--- FILE LINKS ---", "--- NOTES ---");
    const notesText = getSection(text, "--- NOTES ---");

    const meta = parseMetaBlock(metaText);
    const table = parseTrackTable(tableText);
    const fileLinks = parseFileLinks(fileLinksText);

    return {
      id: doc.id,
      title: doc.title || "Untitled Tracking Record",
      category: doc.category || "other",
      documentDate: doc.documentDate || "",
      source: doc.source || "",
      meta,
      table,
      summary: summaryText || "",
      fileLinks,
      notes: notesText || "",
      rawDocument: doc,
    };
  }

  function mapDirectionToLedger(direction) {
    if (direction === "paid") return "outgoing";
    if (direction === "received") return "incoming";
    return null;
  }

  function parseAmount(value) {
    if (typeof value !== "string") return 0;
    const normalized = value.replace("€", "").replace(legacyEuroSymbol(), "").replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function generateLedgerEntries(trackingRecords) {
    const entries = [];

    trackingRecords.forEach(record => {
      if (record.meta.type !== "payment_tracker") return;

      record.table.forEach((row, index) => {
        const date = row["Date"] || "";
        const amount = parseAmount(row["Amount €"] ?? row[`Amount ${legacyEuroSymbol()}`]);
        const directionRaw = (row["Direction"] || "").trim().toLowerCase();
        const status = (row["Status"] || "").trim().toLowerCase();
        const note = row["Notes"] || "";
        const direction = mapDirectionToLedger(directionRaw);

        if (!direction) return;
        if (!amount || amount <= 0) return;
        if (status === "waived") return;

        entries.push({
          id: `${record.id}__derived__${index}`,
          date,
          subject: record.meta.subject || record.title || "unknown_subject",
          amount,
          direction,
          status: status || "confirmed",
          note,
          sourceTrackingRecordId: record.id,
          sourceTrackingRecordTitle: record.title,
        });
      });
    });

    return entries.sort((a, b) => {
      const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  }

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

  const health = selectedCase ? getCaseHealthReport(selectedCase) : null;
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
  const completenessPercent =
    ((health?.totals.incidents || 0) > 0 ? 30 : 0) +
    ((health?.totals.evidence || 0) > 0 ? 30 : 0) +
    ((selectedCase?.documents || []).length > 0 ? 25 : 0) +
    ((health?.totals.strategy || 0) > 0 ? 15 : 0);
  const completenessLabel =
    completenessPercent >= 80
      ? "Strong"
      : completenessPercent >= 50
        ? "Usable"
        : "Thin";
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

  const handleQuickActionKeyDown = (e) => {
    if (e.key === 'Enter') {
      const val = quickActionInput.trim();
      if (!val) return;

      applyActionSummaryUpdate({
        nextActions: [...nextActions, val],
        updatedAt: new Date().toISOString(),
      });
      setQuickActionInput("");
    }
  };

  const handleRemoveNextAction = (index) => {
    applyActionSummaryUpdate({
      nextActions: nextActions.filter((_, i) => i !== index),
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
      const editableRecordTypes = new Set(["incidents", "evidence", "strategy", "tasks"]);
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
      task: "tasks",
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

  const statusConfig = {
    Healthy: { color: "text-lime-600 bg-lime-50 border-lime-200", icon: CheckCircle2 },
    "Needs review": { color: "text-amber-600 bg-amber-50 border-amber-200", icon: AlertTriangle },
    "High risk": { color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
  };

  const timelineFilterOptions = [
    { id: "all", label: "All" },
    { id: "incident", label: "Incidents" },
    { id: "evidence", label: "Evidence" },
    { id: "document", label: "Documents" },
    { id: "payment", label: "Payments" },
    { id: "task", label: "Tasks" },
    { id: "strategy", label: "Strategy" },
  ];

  const trackingDocuments = useMemo(() => {
    return (selectedCase?.documents || []).filter(isTrackingRecord);
  }, [selectedCase?.documents]);

  const parsedTrackingRecords = useMemo(() => {
    return trackingDocuments.map(parseTrackingRecord);
  }, [trackingDocuments]);

  const derivedTrackingLedger = useMemo(() => {
    return generateLedgerEntries(parsedTrackingRecords);
  }, [parsedTrackingRecords]);

  const { totalOutgoing, totalIncoming } = useMemo(() => {
    let totalOutgoing = 0;
    let totalIncoming = 0;

    derivedTrackingLedger.forEach(entry => {
      if (entry.status === "disputed" || entry.status === "pending") return;
      if (entry.direction === "outgoing") totalOutgoing += entry.amount;
      if (entry.direction === "incoming") totalIncoming += entry.amount;
    });

    return { totalOutgoing, totalIncoming };
  }, [derivedTrackingLedger]);
  const statusNotes = useMemo(() => {
  const notes = [];

  parsedTrackingRecords.forEach(record => {
    if (record.meta.type !== "payment_tracker") return;

    record.table.forEach((row, index) => {
      const status = (row["Status"] || "").trim().toLowerCase();
      const directionRaw = (row["Direction"] || "").trim().toLowerCase();

      if (
        status === "waived" ||
        status === "disputed" ||
        status === "pending" ||
        directionRaw === "not_paid"
      ) {
        notes.push({
          id: `${record.id}__status__${index}`,
          subject: record.meta.subject || record.title || "unknown_subject",
          date: row["Date"] || "",
          status: status || directionRaw,
          note: row["Notes"] || "",
        });
      }
    });
  });

  return notes;
}, [parsedTrackingRecords]);


  if (!selectedCase) return renderCaseList();

  const sortChronological = (items) => {
    return [...items].sort((a, b) => {
      const dateA = a.eventDate || a.date || "";
      const dateB = b.eventDate || b.date || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const createdA = a.createdAt || "";
      const createdB = b.createdAt || "";
      if (createdA !== createdB) return createdA.localeCompare(createdB);

      // Tie-breaker for same date/timestamp items
      const idA = String(a.id || "");
      const idB = String(b.id || "");
      return idA.localeCompare(idB);
    });
  };

  const sortLedgerEntries = (entries = []) => {
    return [...entries].sort((a, b) => {
      const aPayment = a.paymentDate || "";
      const bPayment = b.paymentDate || "";
      if (aPayment !== bPayment) return bPayment.localeCompare(aPayment);

      const aDue = a.dueDate || "";
      const bDue = b.dueDate || "";
      if (aDue !== bDue) return bDue.localeCompare(aDue);

      const aPeriod = a.period || "";
      const bPeriod = b.period || "";
      if (aPeriod !== bPeriod) return bPeriod.localeCompare(aPeriod);

      const aCreated = a.createdAt || "";
      const bCreated = b.createdAt || "";
      if (aCreated !== bCreated) return bCreated.localeCompare(aCreated);

      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  };

  const filterLedgerEntries = (entries = [], filter = "all") => {
    if (filter === "all") return entries;
    return entries.filter(item => item.category === filter);
  };

  const groupLedgerEntriesByBatch = (ledger = []) => {
    const groupedLedger = Object.values(
      ledger.reduce((acc, item) => {
        const key = item.batchLabel || "Ungrouped";
        if (!acc[key]) {
          acc[key] = {
            batchLabel: key,
            items: []
          };
        }
        acc[key].items.push(item);
        return acc;
      }, {})
    );

    groupedLedger.sort((a, b) => {
      if (a.batchLabel === "Ungrouped") return 1;
      if (b.batchLabel === "Ungrouped") return -1;
      return a.batchLabel.localeCompare(b.batchLabel);
    });

    groupedLedger.forEach(group => {
      group.items.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    return groupedLedger;
  };

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


  const caseInboxCount = reviewQueue.filter((item) => item.caseId === selectedCase.id).length;
  const allEvidence = selectedCase?.evidence || [];
  const needsReviewEvidence = allEvidence.filter(item => item.status === "needs_review");
  const incompleteEvidence = allEvidence.filter(item => item.status === "incomplete");
  const verifiedEvidence = allEvidence.filter(item => item.status === "verified");

  const truncateTimelineText = (value, max = 180) => {
    const text = safeText(value).trim();
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max).trim()}...` : text;
  };

  const getTimelineTypeDetail = (recordType, item) => {
    const text = `${safeText(item?.title)} ${safeText(item?.description)} ${safeText(item?.summary)} ${safeText(item?.notes)} ${safeText(item?.category)}`.toLowerCase();
    if (recordType === "ledger") return "payment";
    if (["email", "whatsapp", "message", "letter", "reply", "notice", "sms"].some((word) => text.includes(word))) {
      return "communication";
    }
    return recordType;
  };

  const getTimelineDate = (recordType, item) => {
    if (recordType === "document") return item.documentDate || item.date || item.createdAt || "";
    if (recordType === "ledger") return item.paymentDate || item.dueDate || item.period || item.createdAt || "";
    if (recordType === "task") return item.dueDate || item.date || item.createdAt || "";
    return item.eventDate || item.date || item.capturedAt || item.createdAt || "";
  };

  const getTimelineTitle = (recordType, item) => {
    if (recordType === "ledger") return item.label || item.category || "Untitled ledger entry";
    if (recordType === "document") return item.title || "Untitled document";
    if (recordType === "task") return item.title || "Untitled task";
    if (recordType === "strategy") return item.title || "Untitled strategy";
    if (recordType === "incident") return item.title || "Untitled incident";
    return item.title || "Untitled evidence";
  };

  const getTimelineSummary = (recordType, item) => {
    if (recordType === "ledger") {
      const amounts = [
        item.expectedAmount !== undefined && item.expectedAmount !== "" ? `Expected ${item.expectedAmount} ${item.currency || ""}`.trim() : "",
        item.paidAmount !== undefined && item.paidAmount !== "" ? `Paid ${item.paidAmount} ${item.currency || ""}`.trim() : "",
        item.differenceAmount ? `Difference ${item.differenceAmount} ${item.currency || ""}`.trim() : "",
      ].filter(Boolean).join(" · ");
      return truncateTimelineText([amounts, item.status, item.proofStatus, item.notes].filter(Boolean).join(" · "));
    }
    if (recordType === "document") return truncateTimelineText(item.summary || item.textContent || item.notes);
    if (recordType === "task") return truncateTimelineText([item.status, item.description || item.notes].filter(Boolean).join(" · "));
    if (recordType === "evidence") return truncateTimelineText(item.functionSummary || item.description || item.notes || item.reviewNotes);
    return truncateTimelineText(item.summary || item.description || item.notes);
  };

  const toTimelineItems = (items, recordType) => (items || []).map((item) => ({
    id: item.id || `${recordType}-${getTimelineTitle(recordType, item)}`,
    recordType,
    typeDetail: getTimelineTypeDetail(recordType, item),
    date: getTimelineDate(recordType, item),
    title: getTimelineTitle(recordType, item),
    summary: getTimelineSummary(recordType, item),
    isMilestone: (recordType === "incident" || recordType === "evidence") ? !!item?.isMilestone : false,
    source: item,
  }));

  const timelineItems = [
    ...toTimelineItems(selectedCase?.incidents, "incident"),
    ...toTimelineItems(selectedCase?.evidence, "evidence"),
    ...toTimelineItems(selectedCase?.documents, "document"),
    ...toTimelineItems(selectedCase?.ledger, "ledger"),
    ...toTimelineItems(selectedCase?.tasks, "task"),
    ...toTimelineItems(selectedCase?.strategy, "strategy"),
  ].sort((a, b) => {
    if (!a.date && b.date) return 1;
    if (a.date && !b.date) return -1;
    if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
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
  const clientMetricItems = useMemo(() => {
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
  }, [clientSelectedChains, derivedTrackingLedger.length, selectedCase?.category, totalIncoming, totalOutgoing]);
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
      .map(({ originalIndex, ...item }) => item);
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
      console.log("STATIC PROMPT IS GENERIC", PROVEIT_REPORT_PROMPT_V1);
      console.log("REPORT PROMPT", PROVEIT_REPORT_PROMPT_V1);
      console.log("milestoneTimeline exists", Array.isArray(generatedReportMilestoneTimeline));
      console.log("milestoneTimeline length", generatedReportMilestoneTimeline?.length || 0);
      console.log("milestoneTimeline payload", generatedReportMilestoneTimeline);
      console.log("ORDERED ISSUES", generatedReportOrderedIssues.orderedIssues.map((i) => ({ title: i?.incident?.title, date: i?.date })));
      console.log("MATCHED ISSUE MILESTONES", generatedReportOrderedIssues.matchResults);
      console.log("ISSUE TITLE ALIGNMENT", generatedReportOrderedIssues.orderedIssues.map((x) => ({ original: x.originalIssueTitle, final: x.finalIssueTitle, matchedMilestone: x.matchedMilestoneTitle })));
      console.log("COPIED REPORT PACKAGE", promptToCopy);
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
    const payload = buildCaseLinkMapExportPayload(caseItem);
    const validEdges = payload.edges.filter((edge) => edge.status === "resolved");
    const linkCounts = new Map(payload.nodes.map((node) => [node.id, 0]));

    validEdges.forEach((edge) => {
      linkCounts.set(edge.sourceId, (linkCounts.get(edge.sourceId) || 0) + 1);
      linkCounts.set(edge.targetId, (linkCounts.get(edge.targetId) || 0) + 1);
    });

    const formatNode = (node) => `- ${node.title || node.id || "Untitled record"} [${node.type || "record"}]`;
    const formatNodeList = (nodes) => nodes.length > 0 ? nodes.map(formatNode).join("\n") : "- None";
    const totalRecords = payload.nodes.length;
    const totalLinks = validEdges.length;
    const averageLinks = totalRecords > 0 ? (totalLinks / totalRecords).toFixed(2) : "0.00";
    const nodeCounts = payload.summary.nodeCountsByType || {};
    const documentCount = (nodeCounts.document || 0) + (nodeCounts.tracking_record || 0);
    const nodesByLinkCount = payload.nodes.map((node) => ({
      ...node,
      linkCount: linkCounts.get(node.id) || 0,
    }));

    const unlinkedRecords = nodesByLinkCount.filter((node) => node.linkCount === 0);
    const weakRecords = nodesByLinkCount.filter((node) => node.linkCount === 1);
    const highlyConnectedRecords = nodesByLinkCount.filter((node) => node.linkCount >= 5);
    const incidentNodes = payload.nodes.filter((node) => node.type === "incident");
    const evidenceNodes = payload.nodes.filter((node) => node.type === "evidence");
    const incidentEvidenceCounts = new Map(incidentNodes.map((node) => [node.id, 0]));
    const evidenceLinkedToIncidentIds = new Set();

    validEdges.forEach((edge) => {
      const incidentToEvidence = edge.sourceType === "incident" && edge.targetType === "evidence";
      const evidenceToIncident = edge.sourceType === "evidence" && edge.targetType === "incident";

      if (incidentToEvidence && incidentEvidenceCounts.has(edge.sourceId)) {
        incidentEvidenceCounts.set(edge.sourceId, incidentEvidenceCounts.get(edge.sourceId) + 1);
        evidenceLinkedToIncidentIds.add(edge.targetId);
      }
      if (evidenceToIncident && incidentEvidenceCounts.has(edge.targetId)) {
        incidentEvidenceCounts.set(edge.targetId, incidentEvidenceCounts.get(edge.targetId) + 1);
        evidenceLinkedToIncidentIds.add(edge.sourceId);
      }
    });

    const incidentsWithoutEvidence = incidentNodes.filter((node) => incidentEvidenceCounts.get(node.id) === 0);
    const incidentsWithEvidence = incidentNodes.filter((node) => incidentEvidenceCounts.get(node.id) > 0);
    const unusedEvidence = evidenceNodes.filter((node) => !evidenceLinkedToIncidentIds.has(node.id));
    const formatTitleList = (nodes) =>
      nodes.length > 0 ? nodes.map((node) => `- ${node.title || node.id || "Untitled record"}`).join("\n") : "- None";
    const formatIncidentEvidenceCountList = (nodes) =>
      nodes.length > 0
        ? nodes.map((node) => `- ${node.title || node.id || "Untitled record"} — ${incidentEvidenceCounts.get(node.id) || 0}`).join("\n")
        : "- None";
    const sequenceRecords = [
      ...(caseItem?.incidents || []).map((record) => ({ ...record, sequenceType: "incident" })),
      ...(caseItem?.evidence || []).map((record) => ({ ...record, sequenceType: "evidence" })),
      ...(caseItem?.documents || []).map((record) => ({ ...record, sequenceType: "document" })),
      ...(caseItem?.strategy || []).map((record) => ({ ...record, sequenceType: "strategy" })),
      ...(caseItem?.tasks || []).map((record) => ({ ...record, sequenceType: "task" })),
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
- Tasks: ${nodeCounts.task || 0}

## LINK INTEGRITY

Unlinked Records (0 links):
${formatNodeList(unlinkedRecords)}

Weak Records (1 link):
${formatNodeList(weakRecords)}

Highly Connected Records (5+ links):
${formatNodeList(highlyConnectedRecords)}

## EVIDENCE COVERAGE

Incidents without Evidence:
${formatTitleList(incidentsWithoutEvidence)}

Incidents with Evidence Count:
${formatIncidentEvidenceCountList(incidentsWithEvidence)}

Unused Evidence (not linked to incidents):
${formatTitleList(unusedEvidence)}

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
    console.log("RAW REPORT RESPONSE", nextText);
    console.log("RAW REPORT CONTAINS MILESTONE_TIMELINE", /#\s*MILESTONE_TIMELINE\b/i.test(nextText));
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
  const parseMilestoneTimelineEntry = (value) => {
    const text = safeText(value).replace(/\s+/g, " ").trim();
    if (!text) return { date: "", title: "", note: "" };

    const separators = [" – ", " — ", " - "];
    for (const separator of separators) {
      const separatorIndex = text.indexOf(separator);
      if (separatorIndex > 0) {
        const candidateDate = text.slice(0, separatorIndex).trim();
        const remainder = text.slice(separatorIndex + separator.length).trim();
        if (candidateDate && remainder) {
          const colonIndex = remainder.indexOf(":");
          if (colonIndex > 0) {
            return {
              date: candidateDate,
              title: remainder.slice(0, colonIndex).trim() || remainder,
              note: remainder.slice(colonIndex + 1).trim(),
            };
          }
          return {
            date: candidateDate,
            title: remainder,
            note: "",
          };
        }
      }
    }

    const colonIndex = text.indexOf(":");
    if (colonIndex > 0) {
      return {
        date: "",
        title: text.slice(0, colonIndex).trim() || text,
        note: text.slice(colonIndex + 1).trim(),
      };
    }

    return { date: "", title: text, note: "" };
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
  const renderGeneratedReportArticle = (className = "", variant = "default") => {
    const isPackVariant = variant === "pack";
    const displayLanguage = reportDisplayLanguage;
    const headingLabel = (key) => getReportHeadingLabel(key, displayLanguage);

    return (
    <article className={className}>
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
      <header className={`proveit-print-body-header print-pack-header border-b border-neutral-200 print:hidden ${isPackVariant ? "pb-7" : "pb-6"}`}>
        <div className="min-w-0">
          <div className={`font-bold uppercase tracking-[0.18em] text-neutral-500 ${isPackVariant ? "text-[11px]" : "text-xs"}`}>
            CLIENT REPORT
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 print:mt-4">
            <h1 className={`min-w-0 break-words font-bold leading-tight text-neutral-950 print:text-[22pt] ${isPackVariant ? "text-4xl" : "text-3xl"}`}>
              {parsedGeneratedReport.reportTitle || headingLabel("REPORT_TITLE")}
            </h1>
            <div className="shrink-0 whitespace-nowrap text-right text-base font-medium text-neutral-500 print:mt-2 print:text-[11pt]">
              {reportHeaderMeta}
            </div>
          </div>
        </div>
      </header>

      {parsedGeneratedReport.atAGlance?.length > 0 && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6 first:pt-7" : "py-6"} first:border-t-0 first:pt-6`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("AT_A_GLANCE")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedGeneratedReport.atAGlance.map((item) => (
              <li key={item} className={`text-neutral-700 marker:text-neutral-400 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsedGeneratedReport.yourSituation && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("YOUR_SITUATION")}</h4>
          </div>
          <p className={`whitespace-pre-wrap text-neutral-700 ${isPackVariant ? "mt-5 text-[15px] leading-7" : "mt-4 text-sm leading-6"}`}>
            {parsedGeneratedReport.yourSituation}
          </p>
        </section>
      )}

      {parsedGeneratedReport.mainAreasOfConcern.length > 0 && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("MAIN_AREAS_OF_CONCERN")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedGeneratedReport.mainAreasOfConcern.map((item) => (
              <li key={item} className={`text-neutral-700 marker:text-neutral-400 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsedGeneratedReport.whatThisReportShows.length > 0 && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("WHAT_THIS_REPORT_SHOWS")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedGeneratedReport.whatThisReportShows.map((item) => (
              <li key={item} className={`text-lime-950 marker:text-lime-700 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsedGeneratedReport.milestoneTimeline?.length > 0 && (
        <section className={`proveit-print-section proveit-print-section-break border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("MILESTONE_TIMELINE")}</h4>
          </div>
          <div className={`relative ${isPackVariant ? "mt-5 space-y-3.5" : "mt-4 space-y-3.5"}`}>
            {parsedGeneratedReport.milestoneTimeline.map((item, index) => {
              const timelineItem = parseMilestoneTimelineEntry(item);
              return (
                <div
                  key={`${item}-${index}`}
                  className={`proveit-print-avoid-break print-pack-timeline-entry grid grid-cols-[1.25rem_1fr] gap-3 break-inside-avoid ${isPackVariant ? "items-start" : "items-start"}`}
                >
                  <div className="flex h-full flex-col items-center">
                    <span className={`mt-1 block h-2.5 w-2.5 rounded-full border border-amber-300 bg-white`}></span>
                    {index < parsedGeneratedReport.milestoneTimeline.length - 1 && (
                      <span className={`mt-2 w-px flex-1 bg-amber-200/70`}></span>
                    )}
                  </div>
                  <div className={`rounded-lg border border-amber-100 bg-white ${isPackVariant ? "px-4 py-3.5" : "px-3.5 py-3"}`}>
                    {timelineItem.date && (
                      <div className={`text-neutral-500 ${isPackVariant ? "text-xs" : "text-[11px]"} font-semibold uppercase tracking-[0.08em]`}>
                        {timelineItem.date}
                      </div>
                    )}
                    <div className={`text-neutral-950 ${isPackVariant ? "mt-1 text-[15px] leading-6" : "mt-1 text-sm leading-6"} font-semibold`}>
                      {timelineItem.title || item}
                    </div>
                    {timelineItem.note && (
                      <p className={`text-neutral-700 ${isPackVariant ? "mt-1.5 text-[15px] leading-7" : "mt-1 text-sm leading-6"}`}>
                        {timelineItem.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {parsedGeneratedReport.issues.length > 0 && (
        <section className={`proveit-print-section proveit-print-section-break border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>Issue Sections</h4>
          </div>
          <div className={`${isPackVariant ? "mt-6 space-y-6" : "mt-4 space-y-5"}`}>
            {parsedGeneratedReport.issues.map((issue, index) => (
              <section
                key={`${issue.title || "issue"}-${index}`}
                className={`proveit-print-issue print-pack-issue-section break-inside-avoid rounded-lg border border-l-4 border-neutral-200 border-l-lime-500 bg-white ${isPackVariant ? "p-6 shadow-sm shadow-neutral-100" : "p-5"}`}
              >
                <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-4" : "pb-3"}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{headingLabel("ISSUE")}</div>
                  <h5 className={`mt-2 break-words font-semibold leading-tight text-neutral-950 ${isPackVariant ? "text-2xl" : "text-xl"}`}>
                    {issue.title || "Untitled issue"}
                  </h5>
                </div>

                {issue.whatHappened && (
                  <div className={isPackVariant ? "mt-5" : "mt-4"}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{headingLabel("WHAT_HAPPENED")}</div>
                    <p className={`mt-2 text-neutral-700 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>{issue.whatHappened}</p>
                  </div>
                )}

                {issue.keyProof.length > 0 && (
                  <div className={`proveit-print-avoid-break rounded-lg border border-neutral-200 bg-neutral-50/60 ${isPackVariant ? "mt-6 p-5" : "mt-5 p-4"}`}>
                    <h6 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{headingLabel("KEY_PROOF")}</h6>
                    <ul className={`list-disc pl-5 text-neutral-700 ${isPackVariant ? "mt-4 space-y-2.5 text-[15px] leading-7" : "mt-3 space-y-2 text-sm leading-6"}`}>
                      {issue.keyProof.map((item) => (
                        <li key={item} className="marker:text-neutral-400">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {issue.whatThisMeans.length > 0 && (
                  <div className={`proveit-print-avoid-break rounded-lg border border-lime-200 bg-lime-50/70 ${isPackVariant ? "mt-6 p-5" : "mt-5 p-4"}`}>
                    <h6 className="text-xs font-bold uppercase tracking-wider text-lime-800">{headingLabel("WHAT_THIS_MEANS")}</h6>
                    <ul className={`list-disc pl-5 text-lime-950 ${isPackVariant ? "mt-4 space-y-2.5 text-[15px] leading-7" : "mt-3 space-y-2 text-sm leading-6"}`}>
                      {issue.whatThisMeans.map((item) => (
                        <li key={item} className="marker:text-lime-700">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      )}

      {parsedGeneratedReport.keyFacts.length > 0 && (
        <section className={`proveit-print-section proveit-print-section-break border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("KEY_FACTS")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedGeneratedReport.keyFacts.map((item) => (
              <li key={item} className={`text-neutral-700 marker:text-neutral-400 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsedGeneratedReport.currentPosition && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("CURRENT_POSITION")}</h4>
          </div>
          <p className={`whitespace-pre-wrap text-neutral-700 ${isPackVariant ? "mt-5 text-[15px] leading-7" : "mt-4 text-sm leading-6"}`}>
            {parsedGeneratedReport.currentPosition}
          </p>
        </section>
      )}

      {parsedGeneratedReport.recommendedNextSteps.length > 0 && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("RECOMMENDED_NEXT_STEPS")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedGeneratedReport.recommendedNextSteps.map((item) => (
              <li key={item} className={`text-neutral-700 marker:text-neutral-400 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="proveit-print-footer">
        {reportHeaderMeta}
      </footer>
    </article>
  );
  };

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
          <div className="relative flex-1 min-w-max">
            <button 
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full px-3 py-1.5 text-sm rounded-md whitespace-nowrap border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95 flex items-center justify-center gap-1"
            >
              + Add <ChevronDown className={`h-4 w-4 transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                <div className="absolute left-0 mt-2 w-48 rounded-xl border border-neutral-200 bg-white shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                  <button 
                    onClick={() => { openRecordModal("incidents"); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Incident
                  </button>
                  <button 
                    onClick={() => { openRecordModal("evidence"); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Evidence
                  </button>
                  <button 
                    onClick={() => { openRecordModal("strategy"); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Strategy
                  </button>
                  <button 
                    onClick={() => {
                      const newIdea = { id: Date.now().toString(), title: "New idea", description: "", status: "raw" };
                      const updatedIdeas = [...(selectedCase.ideas || []), newIdea];
                      setIdeas(updatedIdeas);
                      onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
                      setShowAddMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium border-t border-neutral-50 transition-colors"
                  >
                    Idea
                  </button>
                </div>
              </>
            )}
          </div>

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
                    Full Case Backup (Importable)
                  </button>
                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    GPT
                  </div>
                  <button 
                    onClick={() => { onExportSnapshot(selectedCase.id, "detailed"); setShowExportMenu(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    GPT Reasoning Export (Not Backup)
                  </button>
                  <button
                    onClick={() => { onCopyLinkMapExport?.(selectedCase.id); setShowExportMenu(false); }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Copy Link Map JSON
                  </button>
                  <div className="mt-2 border-t border-neutral-100 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Supabase
                  </div>
                  <button 
                    onClick={() => { onSendReasoningSnapshotToSupabase(); setShowExportMenu(false); }}
                    disabled={syncStatus === "syncing"}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium leading-snug text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Send Reasoning Snapshot to Supabase
                  </button>
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

      {/* Action Summary Panel */}
      <div className="mb-6 w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Action Summary</h3>
            <p className="text-sm text-neutral-600">Live case briefing for focus, actions, reminders, and deadlines.</p>
            <p className="text-xs text-neutral-500">
              Last updated: {actionSummary.updatedAt ? new Date(actionSummary.updatedAt).toLocaleString() : "Never"}
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={openActionSummaryEdit} className="text-xs font-bold text-lime-700 hover:underline">
              Edit
            </button>
            <button onClick={copyActionSummaryToClipboard} className="text-xs font-bold text-neutral-500 hover:text-neutral-700 transition-colors">
              Copy summary
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Current Focus</div>
            <div className="mt-1 truncate text-sm font-semibold text-neutral-900">{currentFocus || "Not set"}</div>
          </div>
          <div className="rounded-lg border border-lime-200 bg-lime-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-lime-700">Top Next Action</div>
            <div className="mt-1 truncate text-sm font-semibold text-neutral-900">{nextActions[0] || "No next action"}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Remaining Actions</div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">{Math.max(nextActions.length - 1, 0)}</div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          <section className="lg:col-span-5 space-y-2 border-l-4 border-lime-400 pl-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Current Focus</h4>
            <p className="text-base font-semibold text-neutral-900">
              {currentFocus || "No current focus set."}
            </p>
          </section>

          <section className="lg:col-span-7 space-y-3 rounded-lg border border-lime-200 bg-lime-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">Next Actions</h4>
              {nextActions[0] && (
                <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold uppercase text-lime-700 border border-lime-200">
                  Priority
                </span>
              )}
            </div>
            {nextActions.length > 0 ? (
              <ul className="space-y-2">
                {nextActions.map((action, i) => (
                  <li key={i} className={`group flex items-start justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm ${i === 0 ? "border-lime-300 font-semibold text-neutral-900 shadow-sm" : "border-neutral-200 text-neutral-700"}`}>
                    <span className="min-w-0 break-words">
                      {i === 0 && <span className="mr-2 text-[10px] font-bold uppercase text-lime-700">Top</span>}
                      {action}
                    </span>
                    <button
                      onClick={() => handleRemoveNextAction(i)}
                      className="shrink-0 rounded-md p-0.5 text-neutral-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-600 italic">List the next steps to move this case forward.</p>
            )}
            <input
              type="text"
              placeholder="Add next action and press Enter"
              value={quickActionInput}
              onChange={(e) => setQuickActionInput(e.target.value)}
              onKeyDown={handleQuickActionKeyDown}
              className="w-full border-b border-lime-200 bg-transparent py-1 text-xs transition-colors focus:border-lime-600 focus:outline-none"
            />
          </section>

          <section className="lg:col-span-6 space-y-2 border-t border-neutral-200 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Important Reminders</h4>
            {importantReminders.length > 0 ? (
              <ul className="space-y-1.5">
                {importantReminders.map((reminder, i) => (
                  <li key={i} className="text-sm text-neutral-700">- {reminder}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500 italic">Add anything that must not be forgotten.</p>
            )}
          </section>

          <section className="lg:col-span-6 space-y-2 border-t border-neutral-200 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Critical Deadlines</h4>
            <p className="text-sm text-neutral-500 italic">No critical deadlines set.</p>
          </section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className={`${reviewQueueSection ? "lg:col-span-8" : "lg:col-span-12"} space-y-6`}>
          <div className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm print:hidden">
            <div className="flex flex-wrap gap-2">
              {tabs
                .flatMap((tab) => tab.id === "documents" ? [tab, { id: "records", label: "Records" }] : [tab])
                .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                    className={`rounded-2xl border border-lime-500 px-4 py-2 text-sm font-medium shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors ${
                      activeTab === tab.id ? "bg-lime-400/30 text-neutral-900" : "bg-white text-neutral-700 hover:bg-lime-400/30"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            {/* Tab content logic... */}
            {activeTab === "overview" && (
              <div className="space-y-5">
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
                      <h3 className="text-lg font-semibold text-neutral-900">Generate Report</h3>
                      <p className="mt-1 text-sm text-neutral-600">
                        Copy the strict ProveIt Assistant prompt, paste the structured result here, and render it as a formatted report view.
                      </p>
                    </div>
                  </div>
                </div>

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
                          renderGeneratedReportArticle("mt-4 mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm")
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
                      Case Structure Report
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
                          Generate Case Structure Report
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyCaseStructureReport}
                          className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                        >
                          Copy Case Structure Report
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
            )}

            {activeTab === "ledger" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">Ledger</h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => openLedgerModal({ category: "rent" })}
                        className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                      >
                        + Rent
                      </button>
                      <button 
                        onClick={() => openLedgerModal({ category: "utility" })}
                        className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                      >
                        + Utility
                      </button>
                      <button 
                        onClick={() => openLedgerModal({ category: "installment" })}
                        className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                      >
                        + Installment
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => openLedgerModal()}
                    className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
                  >
                    + Add Entry
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2">
                  {["all", "rent", "installment", "deposit", "furniture", "repair", "utility", "legal", "other"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setLedgerFilter(f)}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all whitespace-nowrap ${
                        ledgerFilter === f
                          ? "bg-lime-500 border-lime-600 text-white shadow-sm"
                          : "bg-white border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {(() => {
                  const ledger = sortLedgerEntries(selectedCase?.ledger || []);
                  const filteredLedger = filterLedgerEntries(ledger, ledgerFilter);
                  const groupedLedger = groupLedgerEntriesByBatch(filteredLedger);

                  if ((selectedCase?.ledger || []).length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                        No ledger entries yet.
                      </div>
                    );
                  }

                  if (filteredLedger.length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                        No ledger entries match this filter.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-8">
                      {groupedLedger.map((group) => {
                        const isCollapsed = collapsedLedgerGroups[group.batchLabel];
                        return (
                          <div key={group.batchLabel} className="space-y-3 border-b border-neutral-100 pb-3 last:border-b-0">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => toggleLedgerGroup(group.batchLabel)}
                                className="flex items-center gap-2 px-1 py-1 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                              >
                                <span className="text-[10px] text-neutral-400 w-3">
                                  {isCollapsed ? "▶" : "▼"}
                                </span>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                                  {group.batchLabel === "Ungrouped" ? "Ungrouped Entries" : group.batchLabel}
                                </h4>
                                <span className="text-[10px] font-medium text-neutral-400">{group.items.length} entries</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLedgerModal({
                                    batchLabel: group.batchLabel
                                  });
                                }}
                                className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                              >
                                Add to Group
                              </button>
                            </div>
                            {!isCollapsed && (
                              <div className="space-y-3">
                                {group.items.map((item) => {
                              const statusBadgeColor = (status) => {
                                switch (status) {
                                  case "paid": return "bg-lime-100 text-lime-700 border-lime-300";
                                  case "part-paid": return "bg-amber-100 text-amber-700 border-amber-300";
                                  case "unpaid": return "bg-red-100 text-red-700 border-red-300";
                                  case "disputed": return "bg-orange-100 text-orange-700 border-orange-300";
                                  case "refunded": return "bg-blue-100 text-blue-700 border-blue-300";
                                  default: return "bg-neutral-100 text-neutral-700 border-neutral-300";
                                }
                              };

                              const proofStatusBadgeColor = (proofStatus) => {
                                switch (proofStatus) {
                                  case "confirmed": return "bg-lime-100 text-lime-700 border-lime-300";
                                  case "partial": return "bg-amber-100 text-amber-700 border-amber-300";
                                  default: return "bg-red-100 text-red-700 border-red-300";
                                }
                              };

                              return (
                                <div key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-neutral-800">{item.label || "Untitled Ledger Entry"}</h4>
                                    <div className="flex items-center gap-3">
                                      {item.batchLabel && (
                                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[9px] font-bold uppercase tracking-tight text-neutral-500">
                                          {item.batchLabel}
                                        </span>
                                      )}
                                      <span className="text-xs text-neutral-500">{item.category || "N/A"}</span>
                                      <button 
                                        onClick={() => openLedgerModal(item, item.id)}
                                        className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                                      >
                                        Edit
                                      </button>
                                      <button 
                                        onClick={() => duplicateLedgerEntry(item)}
                                        className="rounded-lg border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                                      >
                                        Duplicate
                                      </button>
                                      <button 
                                        onClick={() => deleteLedgerEntry(item.id)}
                                        className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-sm text-neutral-600 mb-2">Period: {item.period || "N/A"}</div>

                                  <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                                    <div>Expected: {item.expectedAmount} {item.currency}</div>
                                    <div>Paid: {item.paidAmount} {item.currency}</div>
                                    <div>Difference: {item.differenceAmount} {item.currency}</div>
                                  </div>

                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex gap-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusBadgeColor(item.status)}`}>
                                        {item.status || "N/A"}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${proofStatusBadgeColor(item.proofStatus)}`}>
                                        {item.proofStatus || "N/A"}
                                      </span>
                                    </div>
                                    <div className="text-neutral-500">
                                      {item.paymentDate ? `Paid: ${item.paymentDate}` : item.dueDate ? `Due: ${item.dueDate}` : "No Date"}
                                    </div>
                                  </div>

                                  {item.counterparty && <div className="text-xs text-neutral-500 mt-2">Counterparty: {item.counterparty}</div>}
                                  {item.notes && <p className="text-xs text-neutral-500 mt-2 line-clamp-2">{item.notes}</p>}

                                  {item.linkedRecordIds && item.linkedRecordIds.length > 0 && (
                                    <div className="mt-1 border-t border-neutral-100 pt-1">
                                      {renderCompactLinkRow("Supporting Links", item.linkedRecordIds, (rid) => {
                                        const linkedRecord = getRecordDisplayMeta(selectedCase, rid);
                                        if (!linkedRecord) return null;
                                        return (
                                          <LinkedChip
                                            key={rid}
                                            onClick={() => openLinkedRecord(rid)}
                                            titleText={linkedRecord.title || "Untitled record"}
                                            variant="record"
                                            className="flex items-center gap-1 text-left transition-colors"
                                            leading={<span className="shrink-0 font-bold uppercase opacity-50">{linkedRecord.typeLabel}</span>}
                                          >
                                            {linkedRecord.title || "Untitled record"}
                                          </LinkedChip>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "documents" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Documents (Source Material)</h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Primary source documents first. GPT reasoning depends on captured text, not just attached files.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                      className="hidden"
                    >
                      Add Tracking Record
                    </button>
                    <button
                      onClick={() => openDocumentModal()}
                      className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
                    >
                      + Add Document
                    </button>
                  </div>
                </div>

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

                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Documents (Source Material)</h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      Add source letters, PDFs, emails, notices, screenshots, and written evidence here.
                    </p>
                  </div>

                  {(() => {
                    const otherDocuments = (selectedCase?.documents || []).filter(doc => !isTrackingRecord(doc));

                    if (otherDocuments.length === 0) {
                      return (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                          No normal documents yet.
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-3">
                        {otherDocuments.map((doc) => {
                          const textStatus = getDocumentTextStatus(doc);
                          const attachmentCount = Array.isArray(doc.attachments) ? doc.attachments.length : 0;
                          const linkedCount = Array.isArray(doc.linkedRecordIds) ? doc.linkedRecordIds.length : 0;

                          return (
                          <div key={doc.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="min-w-0 flex-1 truncate font-semibold text-neutral-900">{doc.title || "Untitled Document"}</h4>
                                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getDocumentStatusClasses(textStatus.tone)}`}>
                                    {textStatus.label}
                                  </span>
                                  {renderSequenceGroupChip(doc.sequenceGroup)}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                  <span className="text-neutral-600">{doc.documentDate || "No date"}</span>
                                  <span className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5">{doc.category || "other"}</span>
                                  {doc.source && <span>Source: {doc.source}</span>}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button 
                                  onClick={() => openDocumentModal(doc, doc.id)}
                                  className="rounded-lg border border-lime-500 bg-lime-50 px-2 py-0.5 text-[10px] font-bold text-lime-800 shadow-sm hover:bg-lime-100 transition-colors"
                                >
                                  Open Document
                                </button>
                                <button
                                  onClick={() => openDocumentModal(doc, doc.id)}
                                  className="rounded-lg border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                                >
                                  Edit
                                </button>
                                <button 
                                  onClick={() => deleteDocumentEntry(doc.id)}
                                  className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <div className="hidden">
                                {textStatus.label}
                              </div>
                              <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600">
                                <div>
                                  {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"} · {linkedCount} linked record{linkedCount === 1 ? "" : "s"}
                                </div>
                                <div className="hidden">
                                  {attachmentCount > 0 && textStatus.charCount === 0 ? "Attachments need captured text for reasoning." : "Links and files support the document context."}
                                </div>
                              </div>
                            </div>

                            {doc.summary && (
                              <p className="mt-3 border-l-2 border-neutral-200 pl-3 text-sm italic text-neutral-600 line-clamp-2">
                                {doc.summary}
                              </p>
                            )}

                          {doc.textContent && doc.textContent.trim() && (
                            <div className="mt-4 pt-4 border-t border-neutral-100">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Short Preview</div>
                              <div className="text-sm text-neutral-700 whitespace-pre-wrap">
                                {expandedDocuments[doc.id] 
                                  ? doc.textContent 
                                  : doc.textContent.slice(0, 280) + (doc.textContent.length > 280 ? "..." : "")}
                              </div>
                              {doc.textContent.length > 280 && (
                                <button
                                  onClick={() => toggleDocumentExpanded(doc.id)}
                                  className="mt-2 text-xs font-bold text-lime-600 hover:text-lime-700 transition-colors"
                                >
                                  {expandedDocuments[doc.id] ? "Show less" : "Show more"}
                                </button>
                              )}
                            </div>
                          )}

                          {doc.attachments && doc.attachments.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-neutral-100">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Attachments</div>
                              </div>
                              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                                <AttachmentPreview 
                                  attachments={doc.attachments || []}
                                  imageCache={imageCache}
                                  onPreview={onPreviewFile}
                                />
                              </div>
                            </div>
                          )}

                          {doc.linkedRecordIds && doc.linkedRecordIds.length > 0 && (
                            <div className="mt-1 border-t border-neutral-100 pt-1">
                              {renderCompactLinkRow("Linked Case Items", doc.linkedRecordIds, (rid) => {
                                const linkedRecord = getRecordDisplayMeta(selectedCase, rid);
                                if (!linkedRecord) return null;
                                return (
                                  <LinkedChip
                                    key={rid}
                                    onClick={() => openLinkedRecord(rid)}
                                    titleText={linkedRecord.title || "Untitled record"}
                                    variant="record"
                                    className="flex items-center gap-1 text-left transition-colors"
                                    leading={<span className="opacity-50 font-bold uppercase">{linkedRecord.typeLabel}</span>}
                                  >
                                    {linkedRecord.title || "Untitled record"}
                                  </LinkedChip>
                                );
                              })}
                            </div>
                          )}
                        </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </section>

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
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Records</h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      Table-based tracking records live here. Source documents stay in Documents.
                    </p>
                  </div>
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
                    }, null, "record")}
                    className="rounded-lg border border-blue-400 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-blue-50 transition-all active:scale-95"
                  >
                    Add Record
                  </button>
                </div>

                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900">Tracking Records</h3>
                      <p className="mt-1 text-xs text-blue-800">
                        Structured tables parsed from tracking-record text. Generated payment previews are temporary and do not update the Ledger yet.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                      {parsedTrackingRecords.length} tracking record{parsedTrackingRecords.length === 1 ? "" : "s"} · {derivedTrackingLedger.length} generated payment preview{derivedTrackingLedger.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {parsedTrackingRecords.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 p-5 text-sm text-blue-800">
                      No tracking records yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {parsedTrackingRecords.map((record) => {
                        const tableRows = record.table || [];
                        const tableHeaders = getRecordTableHeaders(tableRows);
                        const previewRows = tableRows.slice(0, 5);
                        const usedByIncidents = getIncidentsUsingRecord(selectedCase, record.id);

                        return (
                        <div key={record.id} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
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
                                {renderSequenceGroupChip(record.rawDocument?.sequenceGroup)}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                                <span><span className="font-medium text-neutral-800">Purpose:</span> {record.meta.subject || "—"}</span>
                                {record.meta.period && <span><span className="font-medium text-neutral-800">Period:</span> {record.meta.period}</span>}
                                <span>{tableRows.length} row{tableRows.length === 1 ? "" : "s"}</span>
                                {record.fileLinks.length > 0 && <span>{record.fileLinks.length} file link{record.fileLinks.length === 1 ? "" : "s"}</span>}
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
                  )}
                </section>
              </div>
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
                        Incidents, evidence, documents, payments, tasks, and strategy in one chronological view.
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
                  </div>
                </div>

                {(() => {
                  const filteredTimelineItems = timelineItems.filter((item) => {
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

                  const badgeClassMap = {
                    incident: "border-red-200 bg-red-50 text-red-700",
                    evidence: "border-lime-200 bg-lime-50 text-lime-700",
                    document: "border-sky-200 bg-sky-50 text-sky-700",
                    ledger: "border-amber-200 bg-amber-50 text-amber-700",
                    task: "border-violet-200 bg-violet-50 text-violet-700",
                    strategy: "border-neutral-300 bg-neutral-100 text-neutral-700",
                  };
                  const labelMap = {
                    incident: "Incident",
                    evidence: "Evidence",
                    document: "Document",
                    ledger: "Payment",
                    task: "Task",
                    strategy: "Strategy",
                  };
                  const detailLabelMap = {
                    communication: "Communication",
                    payment: "Payment",
                  };

                  return (
                    <div className="space-y-2">
                      {filteredTimelineItems.map((item) => {
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
                  renderGeneratedReportArticle(
                    "print-pack-article mx-auto max-w-4xl rounded-xl border border-neutral-200 bg-white px-7 py-8 shadow-sm shadow-neutral-100 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none",
                    "pack"
                  )
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

      {actionSummaryEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="border-b border-neutral-100 p-5">
              <h3 className="text-lg font-semibold text-neutral-900">Edit Action Summary</h3>
              <p className="mt-1 text-xs text-neutral-500">Keep the next actions short. Put one item on each line.</p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section className="rounded-lg border border-lime-200 bg-lime-50 p-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600">
                  Next Actions
                </label>
                <textarea
                  placeholder={"Call housing office\nSend evidence pack\nCheck reply deadline"}
                  value={actionSummaryForm.nextActions}
                  onChange={(e) => setActionSummaryForm(f => ({ ...f, nextActions: e.target.value }))}
                  className="min-h-36 w-full rounded-lg border border-lime-200 bg-white p-3 text-sm outline-none focus:border-lime-600"
                />
              </section>

              <section className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Current Focus
                </label>
                <textarea
                  placeholder="What matters most right now?"
                  value={actionSummaryForm.currentFocus}
                  onChange={(e) => setActionSummaryForm(f => ({ ...f, currentFocus: e.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-lime-600"
                />
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Important Reminders
                  </label>
                  <textarea
                    placeholder={"One reminder per line\nKey facts\nConstraints"}
                    value={actionSummaryForm.importantReminders}
                    onChange={(e) => setActionSummaryForm(f => ({ ...f, importantReminders: e.target.value }))}
                    className="min-h-32 w-full rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-lime-600"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Critical Deadlines
                  </div>
                  <div className="min-h-32 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-500">
                    No dedicated deadline field yet. Keep deadline notes in Important Reminders until deadline storage is added.
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 p-5">
              <button onClick={() => setActionSummaryEditOpen(false)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                Cancel
              </button>
              <button onClick={saveActionSummary} className="rounded-lg bg-lime-600 px-4 py-2 text-sm font-bold text-white hover:bg-lime-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {activeLedgerRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Ledger — {activeLedgerRecord.title}
              </h3>
              <button
                onClick={() => setActiveLedgerRecord(null)}
                className="text-xs text-neutral-500"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {generateLedgerEntries([activeLedgerRecord]).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-medium">{entry.date}</div>
                    <div className="text-neutral-500">{entry.direction}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold">€{entry.amount}</div>
                    <div className="text-[10px] uppercase text-neutral-500">
                      {entry.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

