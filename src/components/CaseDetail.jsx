import { useState, useEffect, useMemo } from "react";
import AttachmentPreview from "./AttachmentPreview";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck, X } from "lucide-react";
import { isTimelineCapable, getCaseHealthReport } from "../lib/caseHealth";
import { getIncidentsUsingRecord } from "../domain/caseDomain.js";
import { getRecordDisplayMeta, resolveRecordById } from "../domain/linkingResolvers.js";
import RecordCard from "./RecordCard";

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
  onSendReasoningSnapshotToSupabase,
  onSendReasoningExportToSupabase,
  onExportFullBackup,
  onOpenGptDeltaModal,
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
  const [selectedPackType, setSelectedPackType] = useState("general");

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const packDateValue = (item) => item?.eventDate || item?.date || item?.capturedAt || item?.documentDate || item?.createdAt || "";
  const packText = (value, fallback = "") => (typeof value === "string" && value.trim()) ? value.trim() : fallback;
  const packSummaryText = (item, max = 260) => {
    const text = packText(item?.description) || packText(item?.notes) || packText(item?.summary);
    return text.length > max ? `${text.slice(0, max)}...` : text;
  };
  const sortPackRecent = (items = []) => [...items].sort((a, b) => String(packDateValue(b)).localeCompare(String(packDateValue(a))));
  const packIncidents = sortPackRecent(selectedCase?.incidents || []).slice(0, 8);
  const packEvidence = sortPackRecent(selectedCase?.evidence || []).slice(0, 8);
  const packDocuments = sortPackRecent(selectedCase?.documents || []).slice(0, 8);
  const packStrategy = sortPackRecent(selectedCase?.strategy || []).slice(0, 5);
  const packExecutiveSummary = (
    packText(currentFocus) ||
    packText(selectedCase?.caseState?.currentSituation) ||
    packText(selectedCase?.caseState?.mainProblem) ||
    packText(selectedCase?.notes) ||
    packText(selectedCase?.description) ||
    "No executive summary available."
  );
  const isEscalationPack = selectedPackType === "escalation";

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
    if (issue.record && issue.type) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button onClick={() => setSelectedCaseId(null)} className="mb-3 text-sm font-medium text-neutral-500 underline-offset-4 hover:underline">
            ← Back to Cases
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{selectedCase.name}</h2>
            <button onClick={() => openEditCaseModal(selectedCase)} className="text-sm font-medium text-lime-600 hover:text-lime-700">
              Edit
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-600">Category: {selectedCase.category}</p>
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
      <div className="mb-6 w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
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
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm">
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
                                    <div className="mt-3 pt-3 border-t border-neutral-100">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Linked Records</div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {item.linkedRecordIds.map((rid) => {
                                          const linkedRecord = getRecordDisplayMeta(selectedCase, rid);
                                          if (!linkedRecord) return null;
                                          return (
                                            <button
                                              key={rid}
                                              onClick={() => openLinkedRecord(rid)}
                                              className="flex max-w-full items-start gap-2 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-left text-[10px] font-medium text-neutral-700 shadow-sm transition-all hover:border-lime-500 hover:text-lime-600"
                                            >
                                              <span className="shrink-0 font-bold uppercase opacity-50">{linkedRecord.typeLabel}</span>
                                              <span className="min-w-0">
                                                <span className="block max-w-[160px] truncate">{linkedRecord.title}</span>
                                                {linkedRecord.summary && (
                                                  <span className="block max-w-[220px] truncate text-neutral-400">{linkedRecord.summary}</span>
                                                )}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
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
                            <div className="mt-3 border-t border-neutral-100 pt-3">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Used By Incidents</div>
                              <div className="flex flex-wrap gap-1.5">
                                {usedByIncidents.map((incident) => (
                                  <button
                                    key={incident.id}
                                    onClick={() => openLinkedRecord(incident.id)}
                                    className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-left text-[10px] font-medium text-neutral-700 shadow-sm transition-all hover:border-lime-500 hover:text-lime-600"
                                  >
                                    <span className="font-bold uppercase opacity-50">Incident</span>
                                    <span className="max-w-[120px] truncate">{incident.title || "Untitled incident"}</span>
                                    {(incident.eventDate || incident.date || incident.status) && (
                                      <span className="text-neutral-400">
                                        {[incident.eventDate || incident.date, incident.status].filter(Boolean).join(" · ")}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
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
                            <div className="mt-3 pt-3 border-t border-neutral-100">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Supports / Linked To</div>
                              <div className="flex flex-wrap gap-1.5">
                                {doc.linkedRecordIds.map((rid) => {
                                  const linkedRecord = getRecordDisplayMeta(selectedCase, rid);
                                  if (!linkedRecord) return null;
                                  return (
                                    <button
                                      key={rid}
                                      onClick={() => openLinkedRecord(rid)}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-[10px] font-medium text-neutral-700 shadow-sm hover:border-lime-500 hover:text-lime-600 transition-all text-left"
                                    >
                                      <span className="opacity-50 font-bold uppercase">{linkedRecord.typeLabel}</span>
                                      <span className="truncate max-w-[120px]">{linkedRecord.title}</span>
                                    </button>
                                  );
                                })}
                              </div>
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
                            <div className="mt-3 border-t border-neutral-100 pt-3">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Used By Incidents</div>
                              <div className="flex flex-wrap gap-1.5">
                                {usedByIncidents.map((incident) => (
                                  <button
                                    key={incident.id}
                                    onClick={() => openLinkedRecord(incident.id)}
                                    className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-left text-[10px] font-medium text-neutral-700 shadow-sm transition-all hover:border-lime-500 hover:text-lime-600"
                                  >
                                    <span className="font-bold uppercase opacity-50">Incident</span>
                                    <span className="max-w-[120px] truncate">{incident.title || "Untitled incident"}</span>
                                    {(incident.eventDate || incident.date || incident.status) && (
                                      <span className="text-neutral-400">
                                        {[incident.eventDate || incident.date, incident.status].filter(Boolean).join(" Â· ")}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
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
                      {filteredTimelineItems.map((item) => (
                        <div
                          key={`${item.recordType}-${item.id}`}
                          className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:grid-cols-[7.5rem_1fr]"
                        >
                          <div className="text-xs font-semibold text-neutral-500">
                            {item.date || "No date"}
                          </div>
                          <div className="min-w-0">
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
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "pack" && (
              <div className="space-y-4 text-neutral-800 print:bg-white print:text-black">
                <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
                  <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
                    {[
                      { id: "general", label: "General" },
                      { id: "escalation", label: "Escalation" },
                    ].map((packType) => (
                      <button
                        key={packType.id}
                        type="button"
                        onClick={() => setSelectedPackType(packType.id)}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                          selectedPackType === packType.id
                            ? "bg-lime-500 text-white shadow-sm"
                            : "text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {packType.label}
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
                <article className="mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white px-6 py-7 shadow-sm print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
                <header className="break-inside-avoid pb-7 print:pb-6">
                  <div className="flex flex-col gap-5 border-b border-neutral-200 pb-6 sm:flex-row sm:items-center print:pb-5">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-lime-500 text-white shadow-lg shadow-lime-100 print:h-14 print:w-14 print:rounded-xl print:shadow-none">
                      <ShieldCheck className="h-9 w-9 print:h-8 print:w-8" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-lime-700">ProveIt Case Pack</div>
                      <h1 className="mt-2 break-words text-3xl font-bold leading-tight text-neutral-950 print:text-2xl">
                        {selectedCase.name || "Untitled Case"}
                      </h1>
                      <p className="mt-2 text-sm text-neutral-500">
                        {selectedCase.category || "Uncategorized"} · {selectedCase.status || "No status"} · Updated {selectedCase.updatedAt || "unknown"}
                      </p>
                    </div>
                  </div>
                </header>
                <section className="break-inside-avoid py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Executive Summary</h4>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{packExecutiveSummary}</p>
                  {selectedCase?.caseState?.currentSituation && (
                    <p className="mt-3 text-sm leading-6 text-neutral-700">{selectedCase.caseState.currentSituation}</p>
                  )}
                  {selectedCase?.caseState?.mainProblem && (
                    <p className="mt-2 text-sm leading-6 text-neutral-700">
                      <span className="font-semibold text-neutral-800">Main problem: </span>
                      {selectedCase.caseState.mainProblem}
                    </p>
                  )}
                </section>

                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Key Deadlines & Actions</h4>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Critical Deadlines</h5>
                      {criticalDeadlines.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                          {criticalDeadlines.map((item, idx) => (
                            <li key={idx}>- {typeof item === "string" ? item : item?.title || item?.label || item?.date || "Deadline"}</li>
                          ))}
                        </ul>
                      ) : <p className="mt-2 text-sm text-neutral-500">None listed.</p>}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Next Actions</h5>
                      {nextActions.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                          {nextActions.map((item, idx) => <li key={idx}>- {item}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-sm text-neutral-500">None listed.</p>}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Important Reminders</h5>
                      {importantReminders.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                          {importantReminders.map((item, idx) => <li key={idx}>- {item}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-sm text-neutral-500">None listed.</p>}
                    </div>
                  </div>
                </section>

                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Main Issues / Incidents</h4>
                  </div>
                  {packIncidents.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {packIncidents.map((item) => (
                        <div key={item.id || item.title} className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                          <div className="font-semibold leading-snug text-neutral-900">{item.title || "Untitled incident"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                            <span>{item.eventDate || item.date || "No date"}</span>
                            {item.status && <span>Status: {item.status}</span>}
                            {item.importance && <span>Importance: {item.importance}</span>}
                          </div>
                          {packSummaryText(item) && <p className="mt-2 text-sm leading-6 text-neutral-700">{packSummaryText(item)}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-neutral-500">No incidents listed.</p>}
                </section>

                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Evidence Summary</h4>
                  </div>
                  {packEvidence.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {packEvidence.map((item) => (
                        <div key={item.id || item.title} className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                          <div className="font-semibold leading-snug text-neutral-900">{item.title || "Untitled evidence"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                            <span>{item.eventDate || item.date || item.capturedAt || "No date"}</span>
                            {item.sourceType && <span>Source: {item.sourceType}</span>}
                            {item.status && <span>Status: {item.status}</span>}
                            {item.importance && <span>Importance: {item.importance}</span>}
                            {item.relevance && <span>Relevance: {item.relevance}</span>}
                            {Array.isArray(item.attachments) && item.attachments.length > 0 && <span>Attachments: {item.attachments.length}</span>}
                          </div>
                          {packSummaryText(item) && <p className="mt-2 text-sm leading-6 text-neutral-700">{packSummaryText(item)}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-neutral-500">No evidence listed.</p>}
                </section>

                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Documents Summary</h4>
                  </div>
                  {packDocuments.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {packDocuments.map((item) => (
                        <div key={item.id || item.title} className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                          <div className="font-semibold leading-snug text-neutral-900">{item.title || "Untitled document"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                            <span>{item.documentDate || "No date"}</span>
                            {item.category && <span>Category: {item.category}</span>}
                            {item.source && <span>Source: {item.source}</span>}
                            <span>Attachments: {Array.isArray(item.attachments) ? item.attachments.length : 0}</span>
                          </div>
                          {packText(item.summary) && <p className="mt-2 text-sm leading-6 text-neutral-700">{item.summary}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-neutral-500">No documents listed.</p>}
                </section>

                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Strategy / Position</h4>
                  </div>
                  {strategyFocus.length > 0 && (
                    <ul className="mt-4 space-y-1 text-sm text-neutral-700">
                      {strategyFocus.map((item, idx) => <li key={idx}>- {item}</li>)}
                    </ul>
                  )}
                  {packStrategy.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {packStrategy.map((item) => (
                        <div key={item.id || item.title} className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                            <span>{item.eventDate || item.date || "No date"}</span>
                            {item.status && <span>Status: {item.status}</span>}
                          </div>
                          <div className="mt-1 font-semibold text-neutral-900">{item.title || "Untitled strategy"}</div>
                          {packSummaryText(item) && <p className="mt-1 text-sm text-neutral-700">{packSummaryText(item)}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-neutral-500">No strategy records listed.</p>}
                </section>
                </article>
              </div>
            )}
          </div>
        </div>
        <aside className={`lg:col-span-4 space-y-6 print:hidden ${activeTab === "pack" && isEscalationPack ? "hidden" : ""}`}>
          {reviewQueueSection}
        </aside>
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 left-6 z-50 h-12 w-12 rounded-full bg-lime-600 text-white shadow-lg hover:bg-lime-700 transition-all active:scale-95 flex items-center justify-center text-[10px] font-bold leading-none text-center"
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
