import { useState, useEffect, useMemo } from "react";
import AttachmentPreview from "./AttachmentPreview";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck, X } from "lucide-react";
import { isTimelineCapable, getCaseHealthReport } from "../lib/caseHealth";
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

function normalizeGptActionSummaryDelta(payload = {}) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Payload must be an object." };
  }

  if (payload.app !== "proveit" || payload.contractVersion !== "gpt-delta-1.0") {
    return { ok: false, reason: "Unsupported GPT delta contract." };
  }

  const caseId = payload.target?.caseId;
  if (!caseId || typeof caseId !== "string") {
    return { ok: false, reason: "GPT delta target.caseId is required." };
  }

  const actionSummaryPatch = payload.operations?.patch?.actionSummary;
  if (!actionSummaryPatch || typeof actionSummaryPatch !== "object" || Array.isArray(actionSummaryPatch)) {
    return { ok: false, reason: "GPT delta actionSummary patch is required." };
  }

  const patchableFields = [
    "currentFocus",
    "nextActions",
    "importantReminders",
    "strategyFocus",
    "criticalDeadlines",
  ];

  const patch = patchableFields.reduce((normalized, field) => {
    if (Object.prototype.hasOwnProperty.call(actionSummaryPatch, field)) {
      normalized[field] = actionSummaryPatch[field];
    }
    return normalized;
  }, {});

  if (Object.keys(patch).length === 0) {
    return { ok: false, reason: "GPT delta actionSummary patch has no supported fields." };
  }

  return { ok: true, caseId, patch };
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
  onSyncToSupabase,
  onExportFullCase,
  onExportFullBackup,
  onOpenGptDeltaModal,
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
  fullCaseExportStatus = "idle",
  fullCaseExportMessage = "",
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [ideas, setIdeas] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timelineView, setTimelineView] = useState("core");
  const [timelineTagFilter, setTimelineTagFilter] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const [expandedDocuments, setExpandedDocuments] = useState({});
  const [collapsedLedgerGroups, setCollapsedLedgerGroups] = useState({});
  const [showVerifiedEvidence, setShowVerifiedEvidence] = useState(false);
  const [activeLedgerRecord, setActiveLedgerRecord] = useState(null);
  const [evidenceView, setEvidenceView] = useState("workflow");
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
    const normalized = value.replace("€", "").replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function generateLedgerEntries(trackingRecords) {
    const entries = [];

    trackingRecords.forEach(record => {
      if (record.meta.type !== "payment_tracker") return;

      record.table.forEach((row, index) => {
        const date = row["Date"] || "";
        const amount = parseAmount(row["Amount €"]);
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

  // eslint-disable-next-line no-unused-vars
  function ingestGptActionSummaryDelta(payload) {
    const normalized = normalizeGptActionSummaryDelta(payload);
    if (!normalized.ok) {
      return normalized;
    }

    if (String(normalized.caseId) !== String(selectedCase?.id || "")) {
      return { ok: false, reason: "GPT delta target case does not match the selected case." };
    }

    applyActionSummaryUpdate({
      ...normalized.patch,
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  }

  function saveActionSummary() {
    if (!selectedCase) return;

    updateActionSummary(formToActionSummary(actionSummaryForm));
    setActionSummaryEditOpen(false);
  }

  const health = selectedCase ? getCaseHealthReport(selectedCase) : null;
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

  const overviewStrategies = [...(selectedCase?.strategy || [])]
    .sort((a, b) => new Date(b.eventDate || b.date || 0) - new Date(a.eventDate || a.date || 0))
    .slice(0, 5);
  const toLocalDateKey = (value) => {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const getRecordMatchReason = (record, dateFields = []) => {
    for (const field of dateFields) {
      const dateKey = toLocalDateKey(record?.[field]);
      if (dateKey === todayKey) return "Dated today";
    }
    if (toLocalDateKey(record?.createdAt) === todayKey) return "Created today";
    if (toLocalDateKey(record?.updatedAt) === todayKey) return "Updated today";
    return null;
  };
  const getRecordTitle = (record, fallback) => {
    if (typeof record?.title === "string" && record.title.trim()) return record.title.trim();
    if (typeof record?.label === "string" && record.label.trim()) return record.label.trim();
    return fallback;
  };
  const todayKey = toLocalDateKey(new Date());
  const todayIncidents = (selectedCase?.incidents || [])
    .map((record) => ({
      record,
      title: getRecordTitle(record, "Untitled incident"),
      reason: getRecordMatchReason(record, ["eventDate", "date"]),
    }))
    .filter((item) => item.reason);
  const todayEvidence = (selectedCase?.evidence || [])
    .map((record) => ({
      record,
      title: getRecordTitle(record, "Untitled evidence"),
      reason: getRecordMatchReason(record, ["eventDate", "date", "capturedAt"]),
    }))
    .filter((item) => item.reason);
  const todayTasks = (selectedCase?.tasks || [])
    .map((record) => ({
      record,
      title: getRecordTitle(record, "Untitled task"),
      reason: getRecordMatchReason(record, ["date", "dueDate"]),
    }))
    .filter((item) => item.reason);
  const todayDocuments = (selectedCase?.documents || [])
    .map((record) => ({
      record,
      title: getRecordTitle(record, "Untitled document"),
      reason: getRecordMatchReason(record, ["documentDate"]),
    }))
    .filter((item) => item.reason);
  const hasTodayActivity = todayIncidents.length > 0 || todayEvidence.length > 0 || todayTasks.length > 0 || todayDocuments.length > 0;
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
  const packGaps = (health?.issues || [])
    .flatMap((group) => group.items.map((item) => ({ category: group.category, item })))
    .slice(0, 8);
  const topBlockers = (health?.issues || [])
    .flatMap((group) =>
      (group.items || []).map((item) => ({
        category: group.category,
        title: item.title || "",
        detail: item.detail || "",
      }))
    )
    .slice(0, 3);
  const packTimeline = sortPackRecent([
    ...(selectedCase?.incidents || []).map((item) => ({ ...item, _kind: "Incident" })),
    ...(selectedCase?.evidence || []).map((item) => ({ ...item, _kind: "Evidence" })),
    ...(selectedCase?.strategy || []).map((item) => ({ ...item, _kind: "Strategy" })),
    ...(selectedCase?.tasks || []).map((item) => ({ ...item, _kind: "Task" })),
  ]).slice(0, 15);
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
      openEditRecordModal(issue.type, issue.record);
      setTimeout(() => {
        const el = document.getElementById(`record-${issue.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  };

  // Helper to find a record by ID across all record types in the current case
  const findRecordById = (recordId) => {
    const recordTypes = ['evidence', 'incidents', 'strategy', 'documents'];
    for (const type of recordTypes) {
      const record = selectedCase[type]?.find(r => r.id === recordId);
      if (record) {
        // For timeline items, ensure eventDate is present for sorting consistency
        const recordToReturn = isTimelineCapable(type) ? { ...record, eventDate: record.eventDate || record.date } : record;
        return { record: recordToReturn, type };
      }
    }
    return null;
  };

  const openLinkedRecord = (recordId) => {
    const found = findRecordById(recordId);
    if (!found) return;

    if (found.type === 'documents') {
      openDocumentModal(found.record, found.record.id);
      return;
    }

    const { record, type } = found;
    setActiveTab(type);
    openEditRecordModal(type, record);
  };

  const statusConfig = {
    Healthy: { color: "text-lime-600 bg-lime-50 border-lime-200", icon: CheckCircle2 },
    "Needs review": { color: "text-amber-600 bg-amber-50 border-amber-200", icon: AlertTriangle },
    "High risk": { color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
  };

  const timelineViewLabelMap = {
    core: "Core",
    master: "Master",
    incidents: "Incidents",
    evidence: "Evidence",
    milestones: "Milestones",
  };

  const timelineViewDescriptionMap = {
    core: "Key case chronology using incidents and evidence only.",
    master: "Complete chronological stream of all timeline-relevant records.",
    incidents: "Incident records only.",
    evidence: "Evidence records only.",
    milestones: "Critical turning points and major events.",
  };

  const timelineEmptyMessageMap = {
    core: "No incident or evidence records yet.",
    master: "No timeline records yet.",
    incidents: "No incidents recorded yet.",
    evidence: "No evidence records yet.",
    milestones: "No milestone items yet.",
  };

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

  const evidenceTimelineItems = sortChronological(
    (selectedCase?.evidence || []).map((item) => ({
      ...item,
      _kind: "Evidence",
    }))
  );

  const timelineItems = sortChronological([
    ...selectedCase.evidence.map((item) => ({ ...item, _kind: "Evidence" })),
    ...selectedCase.incidents.map((item) => ({ ...item, _kind: "Incident" })),
    ...selectedCase.strategy.map((item) => ({ ...item, _kind: "Strategy" })),
  ]);

  const milestones = timelineItems.filter(item => item.importance === "critical");

  const allTimelineTags = Array.from(
    new Set(timelineItems.flatMap((item) => item.tags || []))
  ).sort();

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
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-200 bg-white shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                  <button 
                    onClick={() => { exportSelectedCase(); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Full Case Backup
                  </button>
                  <button 
                    onClick={() => { onExportSnapshot(selectedCase.id, "detailed"); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700 font-medium border-t border-neutral-50 transition-colors"
                  >
                    Reasoning Export
                  </button>
                  <button 
                    onClick={() => { onSyncToSupabase(); setShowExportMenu(false); }}
                    disabled={syncStatus === "syncing"}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors disabled:opacity-50"
                  >
                    Sync to Supabase
                  </button>
                </div>
              </>
            )}
            
            <div className="mt-1 flex flex-col items-center">
              {syncMessage && (
                <span className={`text-[10px] font-bold uppercase tracking-tight text-center ${syncStatus === 'error' ? 'text-red-500' : 'text-lime-600'}`}>{syncMessage}</span>
              )}
              {fullCaseExportMessage && (
                <span className={`text-[10px] font-bold uppercase tracking-tight text-center ${fullCaseExportStatus === 'error' ? 'text-red-500' : 'text-lime-600'}`}>{fullCaseExportMessage}</span>
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
              {tabs.map((tab) => (
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
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <h3 className="text-lg font-semibold text-neutral-900">Today</h3>
                    <div className="text-xs font-semibold text-neutral-500">
                      {todayIncidents.length} incidents · {todayEvidence.length} evidence
                      {todayTasks.length > 0 ? ` · ${todayTasks.length} tasks` : ""}
                      {todayDocuments.length > 0 ? ` · ${todayDocuments.length} documents` : ""}
                    </div>
                  </div>

                  {hasTodayActivity ? (
                    <div className={`grid gap-3 ${todayTasks.length > 0 || todayDocuments.length > 0 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                      {todayIncidents.length > 0 && (
                        <section className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 shadow-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">Incidents</h4>
                          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                            {todayIncidents.slice(0, 3).map((item) => (
                              <li key={item.record.id || item.title} className="break-words">
                                - {item.title} · {item.reason}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {todayEvidence.length > 0 && (
                        <section className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 shadow-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">Evidence</h4>
                          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                            {todayEvidence.slice(0, 3).map((item) => (
                              <li key={item.record.id || item.title} className="break-words">
                                - {item.title} · {item.reason}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {todayTasks.length > 0 && (
                        <section className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 shadow-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">Tasks</h4>
                          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                            {todayTasks.slice(0, 3).map((item) => (
                              <li key={item.record.id || item.title} className="break-words">
                                - {item.title} · {item.reason}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {todayDocuments.length > 0 && (
                        <section className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 shadow-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">Documents</h4>
                          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                            {todayDocuments.slice(0, 3).map((item) => (
                              <li key={item.record.id || item.title} className="break-words">
                                - {item.title} · {item.reason}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">No activity logged today.</p>
                  )}
                </div>

                {/* Case Readiness Card */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Case Readiness</h3>
                      <p className="mt-1 text-sm text-neutral-500">Quick check of case completeness and cleanup needs</p>
                    </div>
                    {health && (
                      <div className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusConfig[health.status].color}`}>
                        {readinessLabel}
                      </div>
                    )}
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-lime-100 bg-lime-50/30 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-lime-700/80">Completeness</div>
                      <div className="mt-1 flex items-center justify-between text-sm font-semibold text-neutral-900">
                        <span>{completenessLabel}</span>
                        <span className="text-xs text-neutral-500">{completenessPercent}%</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80">Issues</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">
                        {health?.totalIssues || 0} · {issuesLabel}
                      </div>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Readiness</div>
                      <div className="mt-1 text-sm font-semibold text-neutral-900">{readinessLabel}</div>
                    </div>
                  </div>

                  {criticalBlockers.length > 0 && (
                    <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
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
                                <div key={idx} className="border-b border-neutral-50 pb-2 text-xs last:border-0 last:pb-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between">
                                        <span className="font-semibold text-neutral-800">{item.title}</span>
                                        {item.date && <span className="font-medium text-neutral-400">{item.date}</span>}
                                      </div>
                                      <div className="mt-0.5 text-neutral-500">{item.detail}</div>
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

                {/* Strategy Overview Section */}
                <div className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-neutral-800">Strategies</h3>
                      <span className="rounded-md bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                        {selectedCase.strategy?.length || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openRecordModal("strategy")}
                        className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                      >
                        + Add Strategy
                      </button>
                      <button 
                        onClick={() => setActiveTab("strategy")}
                        className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                      >
                        View All
                      </button>
                    </div>
                  </div>

                  {overviewStrategies.length === 0 ? (
                    <p className="text-sm italic text-neutral-500">No strategy records yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {overviewStrategies.map((item) => (
                        <div key={item.id} className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-neutral-800 truncate">{item.title}</span>
                                <span className="shrink-0 text-[10px] font-medium text-neutral-400">{item.eventDate || item.date}</span>
                              </div>
                              <div className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{item.description || item.notes || "No description provided."}</div>
                            </div>
                            <button onClick={() => openEditRecordModal("strategy", item)} className="shrink-0 rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors">Open</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="font-semibold">Suggested next step</div>
                    <p className="mt-2 text-sm text-neutral-600">Use Quick Capture when something happens fast, then review and convert it into evidence, incidents, tasks, or strategy.</p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="font-semibold">Pack readiness</div>
                    <p className="mt-2 text-sm text-neutral-600">Later, this case will generate a clean evidence and incident pack for print/export.</p>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === "evidence" && (
              <div className="space-y-6">
                <div className="flex gap-2">
                  {["workflow", "timeline"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setEvidenceView(v)}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all ${
                        evidenceView === v
                          ? "bg-lime-500 border-lime-600 text-white shadow-sm"
                          : "bg-white border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                {evidenceView === "workflow" && (
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
                )}

                {evidenceView === "timeline" && renderListBlock(evidenceTimelineItems, "No evidence records yet.", "evidence")}
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
                                          const found = findRecordById(rid);
                                          if (!found) return null;
                                          return (
                                            <button
                                              key={rid}
                                              onClick={() => openLinkedRecord(rid)}
                                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-[10px] font-medium text-neutral-700 shadow-sm hover:border-lime-500 hover:text-lime-600 transition-all text-left"
                                            >
                                              <span className="opacity-50 font-bold uppercase">{found.type === 'evidence' ? 'Evidence' : found.type.slice(0, -1)}</span>
                                              <span className="truncate max-w-[120px]">{found.record.title}</span>
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Documents</h3>
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
                    className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
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

                {parsedTrackingRecords.length > 0 && (
                  <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-blue-900">Tracking Records</h3>
                      <span className="text-xs text-blue-700">
                        {parsedTrackingRecords.length} tracking record{parsedTrackingRecords.length === 1 ? "" : "s"} · {derivedTrackingLedger.length} generated ledger entr{derivedTrackingLedger.length === 1 ? "y" : "ies"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {parsedTrackingRecords.map((record) => (
                        <div key={record.id} className="rounded-xl border border-blue-100 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
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

                              <div className="mt-2 text-xs text-neutral-600">
                                <div><span className="font-medium text-neutral-800">Subject:</span> {record.meta.subject || "—"}</div>
                                <div><span className="font-medium text-neutral-800">Period:</span> {record.meta.period || "—"}</div>
                                <div><span className="font-medium text-neutral-800">Rows:</span> {record.table.length}</div>
                                <div><span className="font-medium text-neutral-800">File links:</span> {record.fileLinks.length}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button 
                                onClick={() => setActiveLedgerRecord(record)}
                                className="rounded-lg border border-blue-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-blue-50 transition-colors"
                              >
                                View Payments
                              </button>
                              <button 
                                onClick={() => openDocumentModal(record.rawDocument, record.rawDocument.id)}
                                className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                              >
                                View
                              </button>
                              <button 
                                onClick={() => openDocumentModal(record.rawDocument, record.rawDocument.id)}
                                className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                              >
                                Edit
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
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mt-6">Other Documents</h3>

                {(() => {
                  const otherDocuments = (selectedCase?.documents || []).filter(doc => !isTrackingRecord(doc));

                  if (otherDocuments.length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                        No other documents yet.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {otherDocuments.map((doc) => (
                        <div key={doc.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-neutral-900 truncate">{doc.title || "Untitled Document"}</h4>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                <span className="text-neutral-600">{doc.documentDate || "No date"}</span>
                                <span className="px-1.5 py-0.5 rounded border border-neutral-200 bg-neutral-100">{doc.category || "other"}</span>
                                {doc.source && <span>Source: {doc.source}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => openDocumentModal(doc, doc.id)}
                                  className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
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
                              {doc.textContent && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                                  Has Text
                                </span>
                              )}
                            </div>
                          </div>
                          {doc.summary && (
                            <p className="mt-3 text-sm text-neutral-600 line-clamp-2 italic border-l-2 border-neutral-200 pl-3">
                              {doc.summary}
                            </p>
                          )}

                          {doc.textContent && doc.textContent.trim() && (
                            <div className="mt-4 pt-4 border-t border-neutral-100">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Text Content</div>
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
                              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Attachments</div>
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
                              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Linked Records</div>
                              <div className="flex flex-wrap gap-1.5">
                                {doc.linkedRecordIds.map((rid) => {
                                  const found = findRecordById(rid);
                                  if (!found) return null;
                                  return (
                                    <button
                                      key={rid}
                                      onClick={() => openLinkedRecord(rid)}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-[10px] font-medium text-neutral-700 shadow-sm hover:border-lime-500 hover:text-lime-600 transition-all text-left"
                                    >
                                      <span className="opacity-50 font-bold uppercase">{found.type === 'evidence' ? 'Evidence' : found.type.slice(0, -1)}</span>
                                      <span className="truncate max-w-[120px]">{found.record.title}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
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
              <div className="space-y-6">
                {/* Timeline Filter Controls */}
                <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto">
                  {["core", "master", "incidents", "evidence", "milestones"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setTimelineView(f)}
                      className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all ${
                        timelineView === f
                          ? "bg-lime-500 border-lime-600 text-white shadow-md"
                          : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300"
                      }`}
                    >
                      {timelineViewLabelMap[f] || f}
                    </button>
                  ))}
                </div>

                <div className="mt-2 text-xs text-neutral-500">
                  {timelineViewDescriptionMap[timelineView] || ""}
                </div>

                {allTimelineTags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {allTimelineTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setTimelineTagFilter(timelineTagFilter === tag ? null : tag)}
                        className={`px-2 py-1 rounded-full text-xs font-bold transition-all ${
                          timelineTagFilter === tag
                            ? "bg-lime-500 text-white shadow-sm"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {(() => {
                  let filteredTimelineItems = timelineItems.filter((item) => {
                    if (timelineView === "core") {
                      return item._kind === "Incident" || item._kind === "Evidence";
                    }
                    if (timelineView === "master") {
                      return true;
                    }
                    if (timelineView === "incidents") {
                      return item._kind === "Incident";
                    }
                    if (timelineView === "evidence") {
                      return item._kind === "Evidence";
                    }
                    if (timelineView === "milestones") {
                      return item.importance === "critical" || item.isMilestone === true;
                    }
                    return true;
                  });

                  if (timelineTagFilter) {
                    filteredTimelineItems = filteredTimelineItems.filter(
                      (item) => Array.isArray(item.tags) && item.tags.includes(timelineTagFilter)
                    );
                  }

                  if (filteredTimelineItems.length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                        {timelineTagFilter 
                          ? `No items match the selected tag: ${timelineTagFilter}`
                          : (timelineEmptyMessageMap[timelineView] || "No timeline records yet.")}
                      </div>
                    );
                  }

                    const groups = [];
                    let lastDate = null;
                    filteredTimelineItems.forEach(item => {
                      const d = item.eventDate || item.date || "Unknown Date";
                      if (d !== lastDate) {
                        groups.push({ date: d, items: [item] });
                        lastDate = d;
                      } else {
                        groups[groups.length - 1].items.push(item);
                      }
                    });

                    return groups.map(group => (
                      <div key={group.date} className="space-y-4">
                        <div className="relative flex items-center py-2">
                          <div className="flex-grow border-t border-neutral-200"></div>
                          <span className="mx-4 flex-shrink text-xs font-bold uppercase tracking-widest text-neutral-400">
                            {group.date}
                          </span>
                          <div className="flex-grow border-t border-neutral-200"></div>
                        </div>
                        <div className="space-y-3">
                          {group.items.map((item) => {
                            const kindToTypeMap = {
                              Evidence: "evidence",
                              Incident: "incidents",
                              Strategy: "strategy",
                            };
                            const recordType = kindToTypeMap[item._kind] || "evidence";

                            return (
                              <RecordCard
                                key={`${item._kind}-${item.id}`}
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
                                showTypeBadge={true}
                                isTimeline={true}
                                isMilestone={item.importance === "critical"}
                                isActionItem={
                                  Array.isArray(item.tags) &&
                                  (
                                    item.tags.includes("action") ||
                                    item.tags.includes("follow-up") ||
                                    item.tags.includes("pending")
                                  )
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    ));
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

                {!isEscalationPack && (
                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Top Blockers</h4>
                  </div>
                  {topBlockers.length > 0 ? (
                    <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
                      {topBlockers.map((item, idx) => (
                        <li key={idx} className="flex flex-col gap-0.5 border-b border-neutral-100 pb-2 last:border-0 last:pb-0 sm:flex-row sm:gap-2">
                          <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-neutral-500">{item.category}</span>
                          <span className="text-neutral-800">
                            {item.title || item.detail || "Issue"}
                            {item.title && item.detail ? <span className="text-neutral-500"> · {item.detail}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-neutral-500">No major blockers identified.</p>}
                </section>
                )}

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

                {isEscalationPack && (
                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Top Blockers</h4>
                  </div>
                  {topBlockers.length > 0 ? (
                    <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
                      {topBlockers.map((item, idx) => (
                        <li key={idx} className="flex flex-col gap-0.5 border-b border-neutral-100 pb-2 last:border-0 last:pb-0 sm:flex-row sm:gap-2">
                          <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-neutral-500">{item.category}</span>
                          <span className="text-neutral-800">
                            {item.title || item.detail || "Issue"}
                            {item.title && item.detail ? <span className="text-neutral-500"> · {item.detail}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-neutral-500">No major blockers identified.</p>}
                </section>
                )}

                {!isEscalationPack && (
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
                )}

                {!isEscalationPack && (
                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Open Questions / Gaps</h4>
                  </div>
                  {packGaps.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                      {packGaps.map(({ category, item }, idx) => (
                        <li key={idx}>
                          <span className="font-semibold text-neutral-900">{category}: </span>
                          {item.detail || item.title || "Issue"}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-neutral-500">No open gaps listed.</p>}
                </section>
                )}

                {!isEscalationPack && (
                <section className="break-inside-avoid border-t border-neutral-200 py-6 print:py-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Recent Timeline</h4>
                  </div>
                  {packTimeline.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {packTimeline.map((item) => (
                        <div key={`${item._kind}-${item.id || item.title}`} className="flex flex-col gap-1 border-b border-neutral-100 pb-2 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3">
                          <span className="shrink-0 text-xs font-medium text-neutral-500">{packDateValue(item) || "No date"}</span>
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{item._kind}</span>
                            <span className="ml-2 font-semibold text-neutral-900">{item.title || "Untitled"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-sm text-neutral-500">No timeline items listed.</p>}
                </section>
                )}
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
