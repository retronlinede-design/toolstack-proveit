import { useMemo, useRef, useState, useEffect } from "react";
import { getAllCases, saveCase, deleteCase, saveImage, getImageById, collectEmbeddedCaseImageIds, deleteImages } from "./storage";
import AttachmentPreview from "./components/AttachmentPreview";
import RecordModal from "./components/RecordModal";
import CaseDetail from "./components/CaseDetail";
import FilePreviewModal from "./components/FilePreviewModal";
import GptDeltaModal from "./components/gpt/GptDeltaModal";
import {
  buildFullBackupAllPayload,
  buildFullBackupCasePayload,
  restoreFullBackupCase,
  restoreFullBackupQuickCapture,
} from "./backup/fullBackup";
import { downloadJson } from "./browser/downloadJson";
import {
  buildCaseReasoningExportPayload,
} from "./export/caseExport";
import { buildCaseLinkMapExportPayload } from "./export/linkMapExport";
import {
  buildGptDeltaPreview,
  ingestGptDelta,
  prepareGptDeltaPayloadForSelectedCase,
} from "./gpt/gptDelta";
import {
  convertQuickCaptureToRecord,
  deleteDocumentEntryFromCase,
  deleteLedgerEntryFromCase,
  deleteRecordFromCase,
  generateId,
  mergeCase,
  normalizeCase,
  normalizeCategory,
  syncCaseLinks,
  upsertDocumentEntryInCase,
  upsertLedgerEntryInCase,
  upsertRecordInCase,
} from "./domain/caseDomain";
import {
  archiveQuickCapture,
  createQuickCaptureFromForm,
  markQuickCaptureConverted,
  normalizeQuickCapture,
} from "./domain/quickCaptureDomain";
import { getFileSizeWarning } from "./lib/fileSecurity.js";
import { removeRecordAttachmentFromForm } from "./domain/recordFormDomain";
import { Database, Download, FileJson, Folder, FolderOpen, Lock, Plus, Settings, Trash2, Upload, X } from "lucide-react";
import { getStorageDiagnostics } from "./storageDiagnostics";
import { readRescueSnapshot, writeRescueSnapshot } from "./rescueSnapshot";
import {
  createAppLockConfig,
  createDisabledAppLockConfig,
  isValidAppPin,
  readAppLockConfig,
  sanitizeAppPinInput,
  verifyAppPin,
  writeAppLockConfig,
} from "./appLock";
import proveItLogo from "./assets/proveit-logo.png";

const lastUsedGroupByType = {};
const SHOW_REVIEW_QUEUE = false;
const CREATE_NEW_SEQUENCE_GROUP_OPTION = "__create_new_sequence_group__";
const LAST_FULL_BACKUP_ALL_AT_KEY = "toolstack.proveit.v1.lastFullBackupAt";
const LAST_BACKUP_META_KEY = "toolstack.proveit.v1.lastBackupMeta";
const CASE_FOLDERS_STORAGE_KEY = "toolstack.proveit.v1.folders";
const APP_LOCK_SESSION_UNLOCK_KEY = "toolstack.proveit.v1.appLock.sessionUnlocked";
const FULL_BACKUP_ALL_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RISKY_ACTION_BACKUP_MESSAGE = "Before applying changes, download a Full App Backup. ProveIt stores data locally in this browser, and browser storage can be lost.";
const EMPTY_DB_WARNING_MESSAGE = "No cases found in this browser storage. If this is unexpected, stop and check Storage Diagnostics before importing or creating new data.";

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function parseBackupTimestamp(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function readLastBackupMeta() {
  try {
    const saved = localStorage.getItem(LAST_BACKUP_META_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readAppLockSessionUnlock() {
  try {
    return sessionStorage.getItem(APP_LOCK_SESSION_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

function writeAppLockSessionUnlock(enabled) {
  try {
    if (enabled) {
      sessionStorage.setItem(APP_LOCK_SESSION_UNLOCK_KEY, "true");
    } else {
      sessionStorage.removeItem(APP_LOCK_SESSION_UNLOCK_KEY);
    }
  } catch {
    // Session unlock is convenience-only. If sessionStorage is unavailable, keep normal App Lock behavior.
  }
}

function hasRecentFullBackupAll(timestamp) {
  const parsedTimestamp = parseBackupTimestamp(timestamp);
  const ageMs = Date.now() - parsedTimestamp;
  return parsedTimestamp > 0 && ageMs >= 0 && ageMs <= FULL_BACKUP_ALL_RECENT_WINDOW_MS;
}

function hasRecentFullBackupMeta(meta) {
  return meta?.exportType === "FULL_BACKUP_ALL" && hasRecentFullBackupAll(meta.timestamp);
}

function getBackupStatus(meta) {
  if (!meta || meta.exportType !== "FULL_BACKUP_ALL" || !meta.timestamp) {
    return {
      label: "Backup none recorded",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (hasRecentFullBackupMeta(meta)) {
    return {
      label: "Full backup within 24h",
      className: "border-lime-200 bg-lime-50 text-lime-700",
    };
  }

  return {
    label: "Full backup older than 24h",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  };
}

function formatBackupMetaTimestamp(meta) {
  const timestamp = meta?.exportType === "FULL_BACKUP_ALL" ? meta.timestamp : "";
  const parsedTimestamp = parseBackupTimestamp(timestamp);
  if (!parsedTimestamp) return "No full app backup recorded";
  return new Date(parsedTimestamp).toLocaleString();
}

function getCompactBackupStatus(meta) {
  if (!meta || meta.exportType !== "FULL_BACKUP_ALL" || !meta.timestamp) {
    return {
      label: "Backup: None",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  const parsedTimestamp = parseBackupTimestamp(meta.timestamp);
  if (!parsedTimestamp) {
    return {
      label: "Backup: None",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  const ageMs = Math.max(0, Date.now() - parsedTimestamp);
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const label = ageDays === 0 ? "Backup: Today" : `Backup: ${ageDays}d old`;

  return {
    label,
    className: hasRecentFullBackupMeta(meta)
      ? "border-lime-200 bg-lime-50 text-lime-700"
      : "border-amber-200 bg-amber-50 text-amber-800",
  };
}

function isTrackingRecordDocument(doc) {
  return typeof doc?.textContent === "string" && doc.textContent.includes("[TRACK RECORD]");
}

function normalizeCaseFolder(folder) {
  if (!folder || typeof folder !== "object") return null;
  const name = safeText(folder.name).trim();
  if (!name) return null;
  const now = new Date().toISOString();
  return {
    id: safeText(folder.id).trim() || generateId(),
    name,
    description: safeText(folder.description).trim(),
    color: safeText(folder.color).trim(),
    createdAt: safeText(folder.createdAt).trim() || now,
    updatedAt: safeText(folder.updatedAt).trim() || safeText(folder.createdAt).trim() || now,
  };
}

function getShortFolderId(folderId) {
  return safeText(folderId).trim().slice(0, 8) || "unknown";
}

function makeUniqueFolderNames(folders) {
  const usedNames = new Set();

  return folders.map((folder) => {
    const baseName = safeText(folder.name).trim() || `Recovered Folder ${getShortFolderId(folder.id)}`;
    let name = baseName;
    const normalizedBaseName = baseName.toLowerCase();

    if (usedNames.has(normalizedBaseName)) {
      name = `${baseName} (${getShortFolderId(folder.id)})`;
    }

    let normalizedName = name.toLowerCase();
    let suffix = 2;
    while (usedNames.has(normalizedName)) {
      name = `${baseName} (${getShortFolderId(folder.id)}-${suffix})`;
      normalizedName = name.toLowerCase();
      suffix += 1;
    }

    usedNames.add(normalizedName);
    return { ...folder, name };
  });
}

function getImportedFolderSource(parsed, imported) {
  const candidates = [
    parsed?.appData?.folders,
    imported?.appData?.folders,
    imported?.folders,
  ];
  const folderSource = candidates.find((candidate) => Array.isArray(candidate));

  return {
    hasFolderData: Array.isArray(folderSource),
    folders: Array.isArray(folderSource) ? folderSource.map(normalizeCaseFolder).filter(Boolean) : [],
  };
}

function mergeImportedCaseFolders(localFolders, importedFolders, importedCases) {
  const folderMap = new Map();

  for (const folder of localFolders || []) {
    const normalized = normalizeCaseFolder(folder);
    if (normalized) folderMap.set(normalized.id, normalized);
  }

  for (const folder of importedFolders || []) {
    const normalized = normalizeCaseFolder(folder);
    if (normalized) folderMap.set(normalized.id, normalized);
  }

  const now = new Date().toISOString();
  const referencedFolderIds = new Set(
    (importedCases || [])
      .map((caseItem) => typeof caseItem?.folderId === "string" ? caseItem.folderId.trim() : "")
      .filter(Boolean)
  );

  for (const folderId of referencedFolderIds) {
    if (folderMap.has(folderId)) continue;
    folderMap.set(folderId, {
      id: folderId,
      name: `Recovered Folder ${getShortFolderId(folderId)}`,
      description: "",
      color: "",
      createdAt: now,
      updatedAt: now,
    });
  }

  return makeUniqueFolderNames(Array.from(folderMap.values()));
}

function getFullBackupPayloadCounts(payload) {
  const imported = payload?.data || payload;
  const folders = getImportedFolderSource(payload, imported).folders;
  return {
    caseCount: Array.isArray(imported?.cases) ? imported.cases.length : 0,
    quickCaptureCount: Array.isArray(imported?.quickCaptures) ? imported.quickCaptures.length : 0,
    folderCount: folders.length,
  };
}

function readCaseFolders() {
  try {
    const saved = localStorage.getItem(CASE_FOLDERS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeCaseFolder).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const EVIDENCE_TYPE_LABELS = {
  documented: "Documented",
  witnessed: "Witness Statement",
  observed: "Observation",
  verbal: "Verbal / Meeting",
  derived: "Derived / Calculated",
};

const EMPTY_RECORD_FORM = {
  title: "",
  date: "",
  description: "",
  notes: "",
  attachments: [],
  linkedRecordIds: [],
  linkedIncidentIds: [], // Added for evidence
  linkedEvidenceIds: [], // Added for incidents
  evidenceStatus: "needs_evidence",
  linkedIncidentRefs: [],
  isMilestone: false,
  importance: "unreviewed",
  relevance: "medium",
  status: "needs_review",
  usedIn: [],
  reviewNotes: "",
  evidenceRole: "OTHER",
  evidenceType: "",
  sequenceGroup: "",
  functionSummary: "",
  sourceType: "other",
  capturedAt: "",
  availability: {
    physical: { hasOriginal: false, location: "", notes: "" },
    digital: { hasDigital: false, files: [] }
  },
  createFollowUpTask: false,
  followUpTaskTitle: "",
};

const EMPTY_LEDGER_FORM = {
  id: "",
  category: "other",
  subType: "",
  label: "",
  period: "",
  expectedAmount: "",
  paidAmount: "",
  currency: "EUR",
  dueDate: "",
  paymentDate: "",
  status: "planned",
  method: "bank_transfer",
  reference: "",
  counterparty: "",
  proofType: "other",
  proofStatus: "missing",
  notes: "",
  batchLabel: "",
  groupMode: "none",
  linkedRecordIds: [],
};

const EMPTY_CAPTURE_FORM = {
  caseId: "",
  title: "",
  date: "",
  note: "",
  attachments: [],
};

const EMPTY_DOCUMENT_FORM = {
  id: "",
  title: "",
  category: "other",
  documentDate: "",
  source: "",
  summary: "",
  textContent: "",
  attachments: [],
  linkedRecordIds: [],
  basedOnEvidenceIds: [],
  sequenceGroup: "",
};

const DOCUMENT_GPT_SUMMARY_PROMPT = `Read this uploaded document and produce ProveIt-ready source text.

Requirements:
- Max about 1000 characters
- Keep names, dates, amounts, duties, deadlines, and key clauses
- Use bullets or very short sections
- Do not be vague
- Focus on facts that matter for CASE_REASONING_EXPORT
- Documents are source or working documents. Identify which incidents, evidence, ledger entries, or strategy threads they may support.
- If a sequence/thread is clear, suggest a short sequenceGroup label.

Structure:
- Document type
- Date
- Parties / sender
- Key facts
- Key clause(s)
- Links or sequenceGroup to consider
- Why it matters`;

const RECORD_GPT_PROMPT = `Convert the information I gave you into a ProveIt tracking record.

Requirements:
- Return ONLY the tracking record
- Do NOT add explanation outside the format
- Keep it clean, structured, and updateable
- Use consistent units (EUR for money, hours for time)
- Keep rows chronological
- Tracking records become documents in ProveIt. They summarize measurable financial, time, compliance, or custom records for CASE_REASONING_EXPORT.
- If source evidence is known, mention it in the summary so it can be linked in ProveIt.

Use this format:

[TRACK RECORD]

meta:
type: <payment_tracker / work_time / compliance / custom>
subject: <what this tracks>
period:
status:

Title:
<short clear title>

Record Type:
<Financial / Work Time / Compliance / Custom>

Purpose:
<what this tracks and why>

--- TABLE ---
| Period/Date | Expected | Actual | Difference | Unit | Status | Notes |
|-------------|----------|--------|------------|------|--------|-------|
| ...         | ...      | ...    | ...        | ...  | ...    | ...   |

--- SUMMARY (GPT READY) ---
<short explanation of totals, patterns, and key issues>`;

const RECORD_TYPE_OPTIONS = [
  { value: "financial", label: "Financial", metaType: "payment_tracker" },
  { value: "work_time", label: "Work Time", metaType: "work_time" },
  { value: "compliance", label: "Compliance", metaType: "compliance" },
  { value: "custom", label: "Custom", metaType: "custom" },
];

const EMPTY_PIN_FORM = {
  currentPin: "",
  newPin: "",
  confirmPin: "",
  confirmRemoval: false,
};

const EMPTY_APP_LOCK_FORM = {
  currentPin: "",
  newPin: "",
  confirmPin: "",
  confirmDisable: false,
};

function sanitizePinInput(value = "") {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function isValidCasePin(pin = "") {
  return /^\d{4,6}$/.test(String(pin || ""));
}

function isCasePinLocked(caseItem) {
  return isValidCasePin(caseItem?.privacyLock?.pin);
}

function getRecordMetaType(recordType = "financial") {
  return RECORD_TYPE_OPTIONS.find((option) => option.value === recordType)?.metaType || "custom";
}

function getRecordTypeFromMeta(metaType = "") {
  return RECORD_TYPE_OPTIONS.find((option) => option.metaType === metaType)?.value || "custom";
}

function getTrackingSection(text = "", startMarker, endMarker = null) {
  if (!text || !startMarker) return "";
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const rest = text.slice(from);
  if (!endMarker) return rest.trim();
  const end = rest.indexOf(endMarker);
  return end === -1 ? rest.trim() : rest.slice(0, end).trim();
}

function getTrackingMetaValue(text = "", key = "") {
  const metaText = getTrackingSection(text, "meta:", "--- TABLE ---");
  const line = metaText
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

function getRecordFormType(form = {}) {
  if (RECORD_TYPE_OPTIONS.some((option) => option.value === form.category)) return form.category;
  return getRecordTypeFromMeta(getTrackingMetaValue(form.textContent, "type"));
}

function getRecordFormPurpose(form = {}) {
  return form.source || getTrackingMetaValue(form.textContent, "subject");
}

function getRecordTableText(form = {}) {
  const tableText = getTrackingSection(form.textContent, "--- TABLE ---", "--- SUMMARY (GPT READY) ---");
  return tableText;
}

function getRecordNotes(form = {}) {
  return form.summary || getTrackingSection(form.textContent, "--- NOTES ---");
}

function buildTrackingRecordText({ recordType = "financial", purpose = "", tableText = "", notes = "" } = {}) {
  return `[TRACK RECORD]

meta:
type: ${getRecordMetaType(recordType)}
subject: ${purpose}
period:
status:

--- TABLE ---

${tableText || getRecordTableText({})}

--- SUMMARY (GPT READY) ---

${notes || ""}

--- FILE LINKS ---



--- NOTES ---

${notes || ""}
`;
}

async function fileToSerializable(file, recordId) {
  const isEml = file.type === "message/rfc822" || file.name.toLowerCase().endsWith(".eml");
  let emailMeta = null;

  if (isEml) {
    try {
      const text = await file.text();
      emailMeta = {
        subject: (text.match(/^Subject:\s*(.*)$/im)?.[1] || "").trim(),
        from: (text.match(/^From:\s*(.*)$/im)?.[1] || "").trim(),
        to: (text.match(/^To:\s*(.*)$/im)?.[1] || "").trim(),
        date: (text.match(/^Date:\s*(.*)$/im)?.[1] || "").trim(),
      };
    } catch (e) {
      console.error("Failed to extract EML metadata", e);
    }
  }

  return new Promise((resolve, reject) => {
    const imageId = generateId();
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await saveImage({
          id: imageId,
          evidenceId: recordId,
          dataUrl: reader.result,
          createdAt: new Date().toISOString(),
        });
        resolve({
          id: generateId(),
          name: file.name,
          type: file.type || "application/octet-stream",
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          kind: (file.type || "").startsWith("image/") ? "image" : isEml ? "document" : "other",
          createdAt: new Date().toISOString(),
          emailMeta,
          storage: {
            type: "indexeddb",
            imageId
          }
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getNewImageIdsForCaseUpdate(previousCase, nextCase) {
  const previousIds = collectEmbeddedCaseImageIds(previousCase);
  const nextIds = collectEmbeddedCaseImageIds(nextCase);
  return [...nextIds].filter((imageId) => !previousIds.has(imageId));
}

export default function ProveItApp() {
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [caseSort, setCaseSort] = useState("updated");
  const [caseFolders, setCaseFolders] = useState(() => readCaseFolders());
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState("");
  const [editingCase, setEditingCase] = useState(null);
  const [imageCache, setImageCache] = useState({});
  const [attachmentDiagnosticImages, setAttachmentDiagnosticImages] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [unlockedCaseIds, setUnlockedCaseIds] = useState([]);
  const [pinManagerState, setPinManagerState] = useState({ open: false, caseId: null, mode: "set" });
  const [pinForm, setPinForm] = useState(EMPTY_PIN_FORM);
  const [pinModalError, setPinModalError] = useState("");
  const [lockPromptPin, setLockPromptPin] = useState("");
  const [lockPromptError, setLockPromptError] = useState("");
  const [appLockState, setAppLockState] = useState(() => readAppLockConfig());
  const [appUnlocked, setAppUnlocked] = useState(() => {
    const initialAppLockState = readAppLockConfig();
    return !initialAppLockState.enabled || (!initialAppLockState.corrupt && readAppLockSessionUnlock());
  });
  const [appUnlockPin, setAppUnlockPin] = useState("");
  const [appUnlockError, setAppUnlockError] = useState("");
  const [appLockMode, setAppLockMode] = useState("set");
  const [appLockForm, setAppLockForm] = useState(EMPTY_APP_LOCK_FORM);
  const [appLockFormError, setAppLockFormError] = useState("");
  const [appLockSaving, setAppLockSaving] = useState(false);
  const [appLockSessionUnlocked, setAppLockSessionUnlocked] = useState(() => readAppLockSessionUnlock());
  const [appLockSessionUnlockEligible, setAppLockSessionUnlockEligible] = useState(() => readAppLockSessionUnlock());

  const [showCreate, setShowCreate] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(() => {
    try {
      const saved = localStorage.getItem("toolstack.proveit.v1.selectedCase");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem("toolstack.proveit.v1.activeTab");
      return (saved && saved !== "tasks") ? saved : "overview";
    } catch {
      return "overview";
    }
  });
  const [recordType, setRecordType] = useState(null);
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD_FORM);
  const [editingRecord, setEditingRecord] = useState(null);
  const [recordFocusField, setRecordFocusField] = useState(null);
  const [recordFocusHint, setRecordFocusHint] = useState("");
  const [recordOpenedFromIssue, setRecordOpenedFromIssue] = useState(false);
  const [recordIssueFeedback, setRecordIssueFeedback] = useState("");
  const [parentRecordForNewChild, setParentRecordForNewChild] = useState(null);
  const [showGptDeltaModal, setShowGptDeltaModal] = useState(false);
  const [gptDeltaText, setGptDeltaText] = useState("");
  const [gptDeltaError, setGptDeltaError] = useState("");
  const [gptDeltaPreview, setGptDeltaPreview] = useState(null);
  const [gptDeltaValidatedCase, setGptDeltaValidatedCase] = useState(null);
  const [gptDeltaApplying, setGptDeltaApplying] = useState(false);
  const [gptDeltaBackupPromptOpen, setGptDeltaBackupPromptOpen] = useState(false);
  const [lastBackupMeta, setLastBackupMeta] = useState(() => readLastBackupMeta());
  const [riskyActionGuardOpen, setRiskyActionGuardOpen] = useState(false);
  const riskyActionGuardResolverRef = useRef(null);

  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerForm, setLedgerForm] = useState(EMPTY_LEDGER_FORM);
  const [editingLedgerId, setEditingLedgerId] = useState(null);

  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState(EMPTY_DOCUMENT_FORM);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [documentSequenceGroupMode, setDocumentSequenceGroupMode] = useState("");
  const [documentPromptCopied, setDocumentPromptCopied] = useState(false);
  const [recordPromptCopied, setRecordPromptCopied] = useState(false);
  const [documentModalMode, setDocumentModalMode] = useState("document");
  const [appNotice, setAppNotice] = useState(null);
  const [storageDiagnosticsOpen, setStorageDiagnosticsOpen] = useState(false);
  const [storageDiagnostics, setStorageDiagnostics] = useState(null);
  const [storageDiagnosticsError, setStorageDiagnosticsError] = useState("");
  const [storageDiagnosticsLoading, setStorageDiagnosticsLoading] = useState(false);
  const [emptyDbWarning, setEmptyDbWarning] = useState("");
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rescueSnapshot, setRescueSnapshot] = useState(() => readRescueSnapshot());
  const [rescueSnapshotRecoveryIgnored, setRescueSnapshotRecoveryIgnored] = useState(false);
  const rescueSnapshotTimerRef = useRef(null);

  const showAppNotice = (tone, message) => {
    if (!message) return;
    setAppNotice({ tone, message, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
  };

  const showFileSizeWarnings = (files) => {
    const warnings = Array.from(files || []).map(getFileSizeWarning).filter(Boolean);
    if (warnings.length > 0) {
      showAppNotice("warning", warnings[0]);
    }
  };

  const refreshBackupMeta = () => {
    const meta = readLastBackupMeta();
    setLastBackupMeta(meta);
    return meta;
  };

  const refreshRescueSnapshot = () => {
    const rescue = readRescueSnapshot();
    setRescueSnapshot(rescue);
    return rescue;
  };

  const updateRescueSnapshot = async ({
    cases: snapshotCases,
    folders: snapshotFolders,
    quickCaptures: snapshotQuickCaptures,
  } = {}) => {
    const sourceCases = Array.isArray(snapshotCases) ? snapshotCases : await getAllCases();
    if (sourceCases.length === 0) return null;

    const diagnostics = await getStorageDiagnostics();
    const snapshot = writeRescueSnapshot({
      cases: sourceCases,
      folders: Array.isArray(snapshotFolders) ? snapshotFolders : readCaseFolders(),
      quickCaptures: Array.isArray(snapshotQuickCaptures) ? snapshotQuickCaptures : quickCaptures,
      imageCount: diagnostics.recordCounts?.images ?? 0,
    });
    refreshRescueSnapshot();
    return snapshot;
  };

  const refreshAppLockState = () => {
    const nextState = readAppLockConfig();
    setAppLockState(nextState);
    return nextState;
  };

  const resetAppLockForm = () => {
    setAppLockForm(EMPTY_APP_LOCK_FORM);
    setAppLockFormError("");
    setAppLockSaving(false);
  };

  const handleUnlockApp = async (event) => {
    event.preventDefault();
    const pin = sanitizeAppPinInput(appUnlockPin);
    if (!isValidAppPin(pin)) {
      setAppUnlockError("Enter your 4 to 8 digit app PIN.");
      return;
    }

    try {
      const latestState = refreshAppLockState();
      if (!latestState.enabled || latestState.corrupt) {
        setAppUnlockError("App lock settings are unavailable.");
        return;
      }
      const verified = await verifyAppPin(pin, latestState.config);
      if (!verified) {
        setAppUnlockError("Wrong PIN. Check the digits and try again.");
        return;
      }
      setAppUnlocked(true);
      setAppLockSessionUnlockEligible(true);
      setAppUnlockPin("");
      setAppUnlockError("");
    } catch (error) {
      console.error("App unlock failed", error);
      setAppUnlockError("Could not verify the app PIN.");
    }
  };

  const lockApp = () => {
    writeAppLockSessionUnlock(false);
    setAppUnlocked(false);
    setAppLockSessionUnlocked(false);
    setAppLockSessionUnlockEligible(false);
    setAppUnlockPin("");
    setAppUnlockError("");
    setExportImportOpen(false);
    setSettingsOpen(false);
    setStorageDiagnosticsOpen(false);
    setSelectedCaseId(null);
  };

  const handleSaveAppLock = async () => {
    const currentPin = sanitizeAppPinInput(appLockForm.currentPin);
    const newPin = sanitizeAppPinInput(appLockForm.newPin);
    const confirmPin = sanitizeAppPinInput(appLockForm.confirmPin);
    const latestState = refreshAppLockState();
    const effectiveMode = latestState.enabled ? appLockMode : "set";

    setAppLockSaving(true);
    setAppLockFormError("");

    try {
      if (effectiveMode === "set") {
        if (!isValidAppPin(newPin)) {
          setAppLockFormError("PIN must be numeric and 4 to 8 digits.");
          return;
        }
        if (newPin !== confirmPin) {
          setAppLockFormError("PIN confirmation does not match.");
          return;
        }
        const config = await createAppLockConfig(newPin, latestState.config);
        writeAppLockConfig(config);
        setAppLockState({ enabled: true, corrupt: false, config });
        setAppUnlocked(true);
        resetAppLockForm();
        showAppNotice("success", "App Lock enabled.");
        return;
      }

      if (effectiveMode === "change") {
        if (!latestState.enabled || latestState.corrupt) {
          setAppLockFormError("App Lock is not available to change.");
          return;
        }
        if (!(await verifyAppPin(currentPin, latestState.config))) {
          setAppLockFormError("Current PIN is incorrect.");
          return;
        }
        if (!isValidAppPin(newPin)) {
          setAppLockFormError("New PIN must be numeric and 4 to 8 digits.");
          return;
        }
        if (newPin !== confirmPin) {
          setAppLockFormError("New PIN confirmation does not match.");
          return;
        }
        const config = await createAppLockConfig(newPin, latestState.config);
        writeAppLockConfig(config);
        setAppLockState({ enabled: true, corrupt: false, config });
        setAppUnlocked(true);
        resetAppLockForm();
        showAppNotice("success", "App Lock PIN changed.");
        return;
      }

      if (effectiveMode === "disable") {
        if (!latestState.enabled || latestState.corrupt) {
          setAppLockFormError("App Lock is not available to disable.");
          return;
        }
        if (!(await verifyAppPin(currentPin, latestState.config))) {
          setAppLockFormError("Current PIN is incorrect.");
          return;
        }
        if (!appLockForm.confirmDisable) {
          setAppLockFormError("Confirm that you want to disable App Lock.");
          return;
        }
        const config = createDisabledAppLockConfig(latestState.config);
        writeAppLockConfig(config);
        writeAppLockSessionUnlock(false);
        setAppLockState({ enabled: false, corrupt: false, config });
        setAppUnlocked(true);
        setAppLockSessionUnlocked(false);
        setAppLockSessionUnlockEligible(false);
        resetAppLockForm();
        setAppLockMode("set");
        showAppNotice("warning", "App Lock disabled.");
      }
    } catch (error) {
      console.error("Could not save App Lock settings", error);
      setAppLockFormError(error.message || "Could not save App Lock settings.");
    } finally {
      setAppLockSaving(false);
    }
  };

  const resetCorruptAppLock = () => {
    const confirmed = window.confirm("Reset corrupted App Lock settings? This does not delete cases or attachments.");
    if (!confirmed) return;
    const config = createDisabledAppLockConfig();
    try {
      writeAppLockConfig(config);
      writeAppLockSessionUnlock(false);
      setAppLockState({ enabled: false, corrupt: false, config });
      setAppUnlocked(true);
      setAppLockSessionUnlocked(false);
      setAppLockSessionUnlockEligible(false);
      setAppUnlockPin("");
      setAppUnlockError("");
      resetAppLockForm();
      showAppNotice("warning", "Corrupted App Lock settings were reset. Case data was not deleted.");
    } catch (error) {
      console.error("Could not reset App Lock settings", error);
      showAppNotice("error", "Could not reset App Lock settings.");
    }
  };

  const handleAppLockSessionUnlockToggle = (enabled) => {
    writeAppLockSessionUnlock(enabled);
    setAppLockSessionUnlocked(enabled);
  };

  const closeRiskyActionGuard = (shouldContinue) => {
    setRiskyActionGuardOpen(false);
    const resolve = riskyActionGuardResolverRef.current;
    riskyActionGuardResolverRef.current = null;
    if (resolve) resolve(shouldContinue);
  };

  const requireRecentFullBackup = () => {
    if (hasRecentFullBackupMeta(refreshBackupMeta())) return Promise.resolve(true);

    return new Promise((resolve) => {
      riskyActionGuardResolverRef.current = resolve;
      setRiskyActionGuardOpen(true);
    });
  };

  const handleRiskyActionDownloadBackup = async () => {
    const backupCreated = await handleFullBackup();
    if (backupCreated) {
      closeRiskyActionGuard(true);
    }
  };

  const handleStorageDiagnostics = async () => {
    const nextOpen = !storageDiagnosticsOpen;
    setStorageDiagnosticsOpen(nextOpen);
    if (!nextOpen) return;

    refreshRescueSnapshot();
    setStorageDiagnosticsLoading(true);
    setStorageDiagnosticsError("");
    try {
      setStorageDiagnostics(await getStorageDiagnostics());
    } catch (error) {
      console.error("Storage diagnostics failed", error);
      setStorageDiagnostics(null);
      setStorageDiagnosticsError(error.message || "Could not read storage diagnostics.");
    } finally {
      setStorageDiagnosticsLoading(false);
    }
  };

  useEffect(() => {
    if (!appNotice) return;
    const timeout = window.setTimeout(() => setAppNotice(null), appNotice.tone === "error" ? 8000 : 6000);
    return () => window.clearTimeout(timeout);
  }, [appNotice]);

  useEffect(() => {
    let cancelled = false;

    async function checkEmptyStorage() {
      try {
        const diagnostics = await getStorageDiagnostics();
        if (!cancelled) {
          setStorageDiagnostics(diagnostics);
          refreshRescueSnapshot();
          if (diagnostics.recordCounts?.cases === 0) {
            setEmptyDbWarning(EMPTY_DB_WARNING_MESSAGE);
          }
        }
      } catch (error) {
        console.error("Startup storage diagnostics failed", error);
      }
    }

    checkEmptyStorage();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFullBackup = async () => {
    try {
      const allCases = await getAllCases();
      const foldersForBackup = readCaseFolders();
      const payload = await buildFullBackupAllPayload({
        cases: allCases,
        quickCaptures,
        folders: foldersForBackup,
        selectedCaseId,
        activeTab,
      }, { getImageById });

      downloadJson(
        payload,
        `proveit-full-backup-all-${new Date()
          .toISOString()
          .slice(0, 10)}.json`
      );
      await updateRescueSnapshot({
        cases: allCases,
        folders: foldersForBackup,
        quickCaptures,
      });

      const backupTimestamp = new Date().toISOString();
      const backupMeta = {
        exportType: "FULL_BACKUP_ALL",
        timestamp: backupTimestamp,
        caseCount: allCases.length,
        quickCaptureCount: quickCaptures.length,
        folderCount: foldersForBackup.length,
      };
      try {
        localStorage.setItem(LAST_FULL_BACKUP_ALL_AT_KEY, backupTimestamp);
        localStorage.setItem(LAST_BACKUP_META_KEY, JSON.stringify(backupMeta));
      } catch {
        // If localStorage is unavailable, keep the timestamp in state for this session only.
      }
      setLastBackupMeta(backupMeta);
      refreshRescueSnapshot();
      return true;
    } catch (err) {
      console.error("FULL BACKUP failed", err);
      showAppNotice("error", "Full backup failed.");
      alert("Full backup failed");
      return false;
    }
  };

  const handleUpdateCase = async (updatedCase) => {
    try {
      await saveCase(updatedCase);
      setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
      return true;
    } catch (error) {
      console.error("Failed to update case", error);
      showAppNotice("error", error.message || "Could not save case changes.");
      return false;
    }
  };

  const resetPinModalState = () => {
    setPinForm(EMPTY_PIN_FORM);
    setPinModalError("");
  };

  const closePinManager = () => {
    setPinManagerState({ open: false, caseId: null, mode: "set" });
    resetPinModalState();
  };

  const openPinManager = (caseItem, mode = null) => {
    if (!caseItem) return;
    setPinManagerState({
      open: true,
      caseId: caseItem.id,
      mode: mode || (isCasePinLocked(caseItem) ? "change" : "set"),
    });
    resetPinModalState();
  };

  const closeLockPrompt = () => {
    setLockPromptPin("");
    setLockPromptError("");
    setSelectedCaseId(null);
  };

  const unlockCaseWithPin = (caseItem, pin) => {
    if (!caseItem || !isCasePinLocked(caseItem)) return false;
    if (String(caseItem.privacyLock.pin) !== String(pin)) return false;

    setUnlockedCaseIds((prev) => (prev.includes(caseItem.id) ? prev : [...prev, caseItem.id]));
    setLockPromptPin("");
    setLockPromptError("");
    return true;
  };

  const handleUnlockSelectedCase = (event) => {
    event.preventDefault();
    if (!selectedCase || !selectedCaseLocked) return;

    const candidatePin = sanitizePinInput(lockPromptPin);
    if (!candidatePin) {
      setLockPromptError("Enter the case PIN to continue.");
      return;
    }

    if (!unlockCaseWithPin(selectedCase, candidatePin)) {
      setLockPromptError("Wrong PIN. Check the digits and try again.");
    }
  };

  const handleSavePinFlow = async () => {
    if (!pinManagerCase) return;

    if (pinManagerState.mode === "set") {
      const newPin = sanitizePinInput(pinForm.newPin);
      const confirmPin = sanitizePinInput(pinForm.confirmPin);

      if (!isValidCasePin(newPin)) {
        setPinModalError("PIN must be numeric and 4 to 6 digits.");
        return;
      }

      if (newPin !== confirmPin) {
        setPinModalError("PIN confirmation does not match.");
        return;
      }

      const updatedCase = {
        ...pinManagerCase,
        privacyLock: {
          pin: newPin,
          enabledAt: pinManagerCase.privacyLock?.enabledAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };

      const saved = await handleUpdateCase(updatedCase);
      if (!saved) {
        setPinModalError("Could not save the new PIN.");
        return;
      }
      setUnlockedCaseIds((prev) => (prev.includes(updatedCase.id) ? prev : [...prev, updatedCase.id]));
      closePinManager();
      return;
    }

    if (pinManagerState.mode === "change") {
      const currentPin = sanitizePinInput(pinForm.currentPin);
      const newPin = sanitizePinInput(pinForm.newPin);
      const confirmPin = sanitizePinInput(pinForm.confirmPin);

      if (currentPin !== pinManagerCase?.privacyLock?.pin) {
        setPinModalError("Current PIN is incorrect.");
        return;
      }

      if (!isValidCasePin(newPin)) {
        setPinModalError("New PIN must be numeric and 4 to 6 digits.");
        return;
      }

      if (newPin !== confirmPin) {
        setPinModalError("New PIN confirmation does not match.");
        return;
      }

      const updatedCase = {
        ...pinManagerCase,
        privacyLock: {
          pin: newPin,
          enabledAt: pinManagerCase.privacyLock?.enabledAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };

      const saved = await handleUpdateCase(updatedCase);
      if (!saved) {
        setPinModalError("Could not save the new PIN.");
        return;
      }
      setUnlockedCaseIds((prev) => (prev.includes(updatedCase.id) ? prev : [...prev, updatedCase.id]));
      closePinManager();
      return;
    }

    if (pinManagerState.mode === "remove") {
      const currentPin = sanitizePinInput(pinForm.currentPin);

      if (currentPin !== pinManagerCase?.privacyLock?.pin) {
        setPinModalError("Current PIN is incorrect.");
        return;
      }

      if (!pinForm.confirmRemoval) {
        setPinModalError("Confirm PIN removal to continue.");
        return;
      }

      const updatedCase = {
        ...pinManagerCase,
        privacyLock: null,
        updatedAt: new Date().toISOString(),
      };

      const saved = await handleUpdateCase(updatedCase);
      if (!saved) {
        setPinModalError("Could not remove the PIN.");
        return;
      }
      setUnlockedCaseIds((prev) => prev.filter((id) => id !== updatedCase.id));
      closePinManager();
    }
  };

  const reconcileUnlockedCaseIds = (nextCases, previousCases = cases) => {
    const previousLockByCaseId = new Map(
      (previousCases || []).map((caseItem) => [caseItem.id, caseItem?.privacyLock?.pin || ""])
    );

    setUnlockedCaseIds((prev) =>
      prev.filter((caseId) => {
        const nextCase = (nextCases || []).find((caseItem) => caseItem.id === caseId);
        if (!nextCase) return false;

        const previousPin = previousLockByCaseId.get(caseId) || "";
        const nextPin = nextCase?.privacyLock?.pin || "";

        if (!nextPin) return false;
        if (previousPin !== nextPin) return false;
        return true;
      })
    );
  };

  const resetGptDeltaModal = () => {
    setShowGptDeltaModal(false);
    setGptDeltaText("");
    setGptDeltaError("");
    setGptDeltaPreview(null);
    setGptDeltaValidatedCase(null);
    setGptDeltaApplying(false);
    setGptDeltaBackupPromptOpen(false);
  };

  const openGptDeltaModal = () => {
    setGptDeltaText("");
    setGptDeltaError("");
    setGptDeltaPreview(null);
    setGptDeltaValidatedCase(null);
    setGptDeltaApplying(false);
    setGptDeltaBackupPromptOpen(false);
    setShowGptDeltaModal(true);
  };

  const handleGptDeltaTextChange = (event) => {
    setGptDeltaText(event.target.value);
    setGptDeltaError("");
    setGptDeltaPreview(null);
    setGptDeltaValidatedCase(null);
    setGptDeltaBackupPromptOpen(false);
  };

  const handleValidateGptDelta = () => {
    setGptDeltaError("");
    setGptDeltaPreview(null);
    setGptDeltaValidatedCase(null);
    setGptDeltaBackupPromptOpen(false);

    if (!selectedCase) {
      setGptDeltaError("Select a case before applying a GPT update.");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(gptDeltaText);
    } catch {
      setGptDeltaError("Invalid JSON.");
      return;
    }

    const payloadForValidation = prepareGptDeltaPayloadForSelectedCase(payload, selectedCase.id);
    const result = ingestGptDelta(selectedCase, payloadForValidation);
    if (!result.ok) {
      setGptDeltaError(result.reason || "GPT update validation failed.");
      return;
    }

    setGptDeltaValidatedCase(result.case);
    setGptDeltaPreview(buildGptDeltaPreview(payloadForValidation, selectedCase, result.case, result));
  };

  const applyValidatedGptDelta = async () => {
    try {
      await saveCase(gptDeltaValidatedCase);
      setCases((prev) => prev.map((c) => (c.id === gptDeltaValidatedCase.id ? gptDeltaValidatedCase : c)));
      resetGptDeltaModal();
    } catch (error) {
      console.error("Failed to apply GPT update", error);
      setGptDeltaError(error.message || "Failed to apply GPT update.");
      setGptDeltaApplying(false);
    }
  };

  const handleApplyGptDelta = async () => {
    if (!gptDeltaValidatedCase) return;

    setGptDeltaError("");

    if (!(await requireRecentFullBackup())) {
      return;
    }

    setGptDeltaApplying(true);
    await applyValidatedGptDelta();
  };

  const handleCreateBackupThenApplyGptDelta = async () => {
    if (!gptDeltaValidatedCase) return;

    setGptDeltaBackupPromptOpen(false);
    setGptDeltaApplying(true);
    const backupCreated = await handleFullBackup();
    if (!backupCreated) {
      setGptDeltaError("Create a full backup before applying this GPT delta.");
      setGptDeltaApplying(false);
      return;
    }

    await applyValidatedGptDelta();
  };

  const handleApplyGptDeltaWithoutBackup = async () => {
    if (!gptDeltaValidatedCase) return;

    setGptDeltaBackupPromptOpen(false);
    setGptDeltaApplying(true);
    await applyValidatedGptDelta();
  };

  const handleCancelGptDeltaBackupPrompt = () => {
    setGptDeltaBackupPromptOpen(false);
    setGptDeltaApplying(false);
  };


  const openLedgerModal = (preset = {}, ledgerId = null) => {
    const existingGroups = Array.from(new Set((selectedCase?.ledger || [])
      .map(item => item.batchLabel)
      .filter(label => label && label.trim() !== "")));

    const defaultGroups = {
      rent: "Rent",
      utility: "Utilities",
      furniture: "Furniture",
      installment: "Installments",
      repair: "Repairs",
      legal: "Legal",
      deposit: "Deposit"
    };

    let batchLabel = preset.batchLabel || "";
    if (preset.category && !batchLabel) {
      batchLabel = lastUsedGroupByType[preset.category] || defaultGroups[preset.category] || "";
    }

    let groupMode = "none";
    if (batchLabel) {
      if (existingGroups.includes(batchLabel)) {
        groupMode = batchLabel;
      } else {
        groupMode = "__new__";
      }
    }

    setLedgerForm({ 
      ...EMPTY_LEDGER_FORM, 
      ...preset, 
      batchLabel,
      groupMode 
    });
    setEditingLedgerId(ledgerId);
    setLedgerModalOpen(true);
  };

  const duplicateLedgerEntry = (entry) => {
    if (!entry) return;

    const duplicated = {
      ...entry,
      id: "",
      label: entry.label ? `${entry.label} (Copy)` : "Copied Entry",
      edited: false,
      createdAt: "",
      updatedAt: "",
    };

    setEditingLedgerId(null);
    setLedgerForm({
      ...EMPTY_LEDGER_FORM,
      ...duplicated,
    });
    setLedgerModalOpen(true);
  };

  async function deleteDocumentEntry(entryId) {
    if (!selectedCaseId || !entryId) return;

    const confirmed = window.confirm("Delete this document?");
    if (!confirmed) return;

    const targetCase = cases.find(c => c.id === selectedCaseId);
    if (!targetCase) return;

    const updatedCase = deleteDocumentEntryFromCase(targetCase, entryId);
    try {
      await saveCase(updatedCase);
      setCases(prev => prev.map(c => (c.id === updatedCase.id ? updatedCase : c)));
    } catch (error) {
      console.error("Failed to delete document entry", error);
      showAppNotice("error", error.message || "Could not delete this document.");
    }
  }

  async function deleteLedgerEntry(entryId) {
    if (!selectedCaseId || !entryId) return;

    const confirmed = window.confirm("Delete this ledger entry?");
    if (!confirmed) return;

    const targetCase = cases.find(c => c.id === selectedCaseId);
    if (!targetCase) return;

    const updatedCase = deleteLedgerEntryFromCase(targetCase, entryId);
    try {
      await saveCase(updatedCase);
      setCases(prev => prev.map(c => (c.id === updatedCase.id ? updatedCase : c)));
    } catch (error) {
      console.error("Failed to delete ledger entry", error);
      showAppNotice("error", error.message || "Could not delete this ledger entry.");
    }
  }

  const openDocumentModal = (preset = {}, documentId = null, mode = "document") => {
    const nextForm = { ...EMPTY_DOCUMENT_FORM, ...preset };
    if (mode === "record") {
      if (!documentId) {
        nextForm.textContent = "";
      }
      const recordType = getRecordFormType(nextForm);
      const purpose = getRecordFormPurpose(nextForm);
      const notes = getRecordNotes(nextForm);
      nextForm.category = recordType;
      nextForm.source = purpose;
      nextForm.summary = notes;
      if (documentId) {
        nextForm.textContent = buildTrackingRecordText({
          recordType,
          purpose,
          tableText: getRecordTableText(nextForm),
          notes,
        });
      }
    }
    setDocumentForm(nextForm);
    setEditingDocumentId(documentId);
    setDocumentModalMode(mode);
    setDocumentModalOpen(true);
  };

  const closeDocumentModal = () => {
    setDocumentModalOpen(false);
    setDocumentForm(EMPTY_DOCUMENT_FORM);
    setEditingDocumentId(null);
    setDocumentSequenceGroupMode("");
    setDocumentPromptCopied(false);
    setRecordPromptCopied(false);
    setDocumentModalMode("document");
  };

  const updateRecordDocumentForm = (patch) => {
    setDocumentForm((prev) => {
      const next = { ...prev, ...patch };
      const recordType = patch.recordType || getRecordFormType(next);
      const purpose = patch.purpose ?? getRecordFormPurpose(next);
      const tableText = patch.tableText ?? getRecordTableText(next);
      const notes = patch.notes ?? getRecordNotes(next);
      return {
        ...next,
        category: recordType,
        source: purpose,
        summary: notes,
        textContent: buildTrackingRecordText({ recordType, purpose, tableText, notes }),
      };
    });
  };

  const copyDocumentGptPrompt = async () => {
    try {
      await navigator.clipboard.writeText(DOCUMENT_GPT_SUMMARY_PROMPT);
      setDocumentPromptCopied(true);
      window.setTimeout(() => setDocumentPromptCopied(false), 1800);
    } catch (error) {
      console.error("Failed to copy GPT prompt", error);
      showAppNotice("error", "Could not copy the document GPT prompt.");
    }
  };

  const copyRecordGptPrompt = async () => {
    try {
      await navigator.clipboard.writeText(RECORD_GPT_PROMPT);
      setRecordPromptCopied(true);
      window.setTimeout(() => setRecordPromptCopied(false), 1800);
    } catch (error) {
      console.error("Failed to copy record prompt", error);
      showAppNotice("error", "Could not copy the record GPT prompt.");
    }
  };

  const saveDocumentEntry = async () => {
    if (!selectedCaseId || !documentForm.title.trim()) return;

    const currentCase = cases.find(c => c.id === selectedCaseId);
    if (!currentCase) return;

    const updatedCase = upsertDocumentEntryInCase(currentCase, documentForm, editingDocumentId);
    const newImageIds = getNewImageIdsForCaseUpdate(currentCase, updatedCase);

    try {
      await saveCase(updatedCase);
      setCases((prev) => prev.map((c) => (c.id === currentCase.id ? updatedCase : c)));
    } catch (error) {
      console.error("Failed to save document entry", error);
      if (newImageIds.length > 0) {
        await deleteImages(newImageIds);
      }
      showAppNotice("error", error.message || "Could not save this document.");
      return;
    }

    closeDocumentModal();
  };

  const handleDocumentFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    showFileSizeWarnings(files);

    const documentId = documentForm.id || generateId();

    const serializable = await Promise.all(
      files.map((file) => fileToSerializable(file, documentId))
    );

    setDocumentForm((prev) => ({
      ...prev,
      id: prev.id || documentId,
      attachments: [...(prev.attachments || []), ...serializable],
    }));

    event.target.value = "";
  };

  const removeDocumentAttachment = (attachmentId) => {
    setDocumentForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((file) => file.id !== attachmentId),
    }));
  };



  const closeLedgerModal = () => {
    setLedgerModalOpen(false);
    setLedgerForm(EMPTY_LEDGER_FORM);
    setEditingLedgerId(null);
  };

  const saveLedgerEntry = async () => {
    if (!selectedCaseId || !ledgerForm.label.trim()) return;

    if (ledgerForm.category && ledgerForm.batchLabel) {
      lastUsedGroupByType[ledgerForm.category] = ledgerForm.batchLabel;
    }

    const currentCase = cases.find(c => c.id === selectedCaseId);
    if (!currentCase) return;

    const updatedCase = upsertLedgerEntryInCase(currentCase, ledgerForm, editingLedgerId);

    try {
      await saveCase(updatedCase);
      setCases((prev) => prev.map((c) => (c.id === currentCase.id ? updatedCase : c)));
    } catch (error) {
      console.error("Failed to save ledger entry", error);
      showAppNotice("error", error.message || "Could not save this ledger entry.");
      return;
    }

    closeLedgerModal();
  };

  const relatedTrackingRecordsForViewing = viewingRecord ? (selectedCase?.documents || []).filter((doc) =>
    isTrackingRecordDocument(doc) &&
    Array.isArray(doc.basedOnEvidenceIds) &&
    doc.basedOnEvidenceIds.includes(viewingRecord.id)
  ) : [];

  const [quickCaptures, setQuickCaptures] = useState(() => {
    try {
      const saved = localStorage.getItem("toolstack.proveit.v1.captures");
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed.map((item) => normalizeQuickCapture(item));
    } catch {
      return [];
    }
  });
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const reviewQueue = quickCaptures.filter((item) => item.status === "unreviewed");
  const [captureForm, setCaptureForm] = useState(EMPTY_CAPTURE_FORM);
  const [form, setForm] = useState({ name: "", category: "general", customCategory: "", notes: "", description: "" });

  const setupSteps = [
    { step: "1", title: "Create your first case", text: "Start with one case file using a generic template or create your own custom case from scratch." },
    { step: "2", title: "Add core records", text: "Add your first evidence, incident, or strategy note. Upload a phone photo, PDF, screenshot, or document." },
    { step: "3", title: "Build the timeline", text: "Add dated incidents, evidence, documents, and records so the case story is easy to follow." },
    { step: "4", title: "Prepare your print pack", text: "Use the Print Pack view when you need a printable case summary or want to save it as PDF." },
  ];

  const starterCases = [
  { name: "General Case", hint: "A flexible starting point for any issue, dispute, or project", category: "general", prefillName: "My Case" },
  { name: "Personal Matter", hint: "For personal admin, documents, appointments, or private issues", category: "personal", prefillName: "Personal Matter" },
  { name: "Work Matter", hint: "For workplace incidents, overtime, schedules, or HR-related issues", category: "work", prefillName: "Work Matter" },
  { name: "Property / Housing", hint: "For housing, landlord, rent, damage, or maintenance issues", category: "housing", prefillName: "Property / Housing Matter" },
  { name: "Create Your Own", hint: "Start with a blank custom case name and category", category: "custom", prefillName: "" },
];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "evidence", label: "Evidence" },
    { id: "incidents", label: "Incidents" },
    { id: "strategy", label: "Strategy" },
    { id: "ledger", label: "Ledger" },
    { id: "documents", label: "Documents" },
    { id: "narrative", label: "Narrative" },
    { id: "timeline", label: "Timeline" },
    { id: "generate-report", label: "Generate Report" },
    { id: "pack", label: "Print Pack" },
  ];

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  );

  const existingDocumentSequenceGroups = useMemo(() => {
    const normalizedCurrentValue = safeText(documentForm.sequenceGroup).trim().toLowerCase();
    const activeSequenceRecords = [
      ...(Array.isArray(selectedCase?.evidence) ? selectedCase.evidence : []),
      ...(Array.isArray(selectedCase?.incidents) ? selectedCase.incidents : []),
      ...(Array.isArray(selectedCase?.documents) ? selectedCase.documents : []),
      ...(Array.isArray(selectedCase?.strategy) ? selectedCase.strategy : []),
    ];
    const sorted = activeSequenceRecords
      .filter((item) => item?.id !== documentForm.id)
      .map((item) => safeText(item?.sequenceGroup).trim())
      .filter((value) => value && value.toLowerCase() !== normalizedCurrentValue)
      .sort((a, b) => a.localeCompare(b));

    const seen = new Set();
    return sorted.filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [documentForm.id, documentForm.sequenceGroup, selectedCase]);

  useEffect(() => {
    if (!documentModalOpen) return;

    const currentValue = safeText(documentForm.sequenceGroup).trim();
    if (!currentValue) {
      setDocumentSequenceGroupMode("");
      return;
    }

    if (existingDocumentSequenceGroups.includes(currentValue)) {
      setDocumentSequenceGroupMode(currentValue);
      return;
    }

    setDocumentSequenceGroupMode(CREATE_NEW_SEQUENCE_GROUP_OPTION);
  }, [documentForm.sequenceGroup, documentModalOpen, existingDocumentSequenceGroups]);

  const renderDocumentSequenceGroupField = () => (
    <div>
      <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Sequence Group</label>
      <p className="mb-2 text-xs text-neutral-500">Use this to group related items that belong to the same chain, timeline, or document sequence.</p>
      <select
        value={documentSequenceGroupMode}
        onChange={(e) => {
          const nextValue = e.target.value;
          setDocumentSequenceGroupMode(nextValue);
          if (nextValue === "") {
            setDocumentForm((prev) => ({ ...prev, sequenceGroup: "" }));
            return;
          }
          if (nextValue === CREATE_NEW_SEQUENCE_GROUP_OPTION) {
            if (existingDocumentSequenceGroups.includes(safeText(documentForm.sequenceGroup).trim())) {
              setDocumentForm((prev) => ({ ...prev, sequenceGroup: "" }));
            }
            return;
          }
          setDocumentForm((prev) => ({ ...prev, sequenceGroup: nextValue }));
        }}
        className="w-full rounded-xl border border-neutral-300 p-3 bg-white"
      >
        <option value="">Select existing group or create new</option>
        {existingDocumentSequenceGroups.map((group) => (
          <option key={group} value={group}>
            {group}
          </option>
        ))}
        <option value={CREATE_NEW_SEQUENCE_GROUP_OPTION}>Create new sequence group</option>
      </select>
      {documentSequenceGroupMode === CREATE_NEW_SEQUENCE_GROUP_OPTION && (
        <input
          value={documentForm.sequenceGroup || ""}
          onChange={(e) => setDocumentForm((prev) => ({ ...prev, sequenceGroup: e.target.value }))}
          placeholder="e.g. Repair timeline, Notice sequence, Payment chain"
          className="mt-2 w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
        />
      )}
      {safeText(documentForm.sequenceGroup).trim() && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
          <span className="min-w-0 truncate text-xs text-neutral-500">
            Current group: {safeText(documentForm.sequenceGroup).trim()}
          </span>
          <button
            type="button"
            onClick={() => {
              setDocumentSequenceGroupMode("");
              setDocumentForm((prev) => ({ ...prev, sequenceGroup: "" }));
            }}
            className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
          >
            Clear group
          </button>
        </div>
      )}
    </div>
  );

  const pinManagerCase = useMemo(
    () => cases.find((c) => c.id === pinManagerState.caseId) || null,
    [cases, pinManagerState.caseId]
  );
  const selectedCaseLocked = selectedCase ? isCasePinLocked(selectedCase) : false;
  const selectedCaseUnlocked = selectedCase ? unlockedCaseIds.includes(selectedCase.id) : false;
  const selectedCaseRequiresPin = !!selectedCase && selectedCaseLocked && !selectedCaseUnlocked;

  const normalizeSearchText = (value) => String(value || "").trim().toLowerCase();

  const getCaseLastUpdated = (caseItem) => caseItem?.updatedAt || caseItem?.createdAt || "";

  const formatCaseLastUpdated = (caseItem) => {
    const timestamp = getCaseLastUpdated(caseItem);
    if (!timestamp) return "Unknown";

    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return "Unknown";

    return parsed.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCaseStatusClasses = (status = "") => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "archived" || normalized === "done") return "border-neutral-200 bg-neutral-100 text-neutral-600";
    if (normalized === "needs_review") return "border-amber-200 bg-amber-50 text-amber-700";
    if (normalized === "open") return "border-lime-200 bg-lime-50 text-lime-700";
    return "border-blue-200 bg-blue-50 text-blue-700";
  };

  const getCaseCreatedLabel = (caseItem) => {
    const timestamp = caseItem?.createdAt || "";
    if (!timestamp) return "";

    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return "";

    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCaseStatus = (status = "") =>
    String(status || "open")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const getCountLabel = (count, singular, plural = `${singular}s`) =>
    `${count} ${count === 1 ? singular : plural}`;

  const getOpenTaskCount = (caseItem) =>
    (caseItem?.tasks || []).filter((task) => !["done", "completed", "closed", "archived"].includes(String(task?.status || "").toLowerCase())).length;

  const getCaseListMetadata = (caseItem) => [
    getCountLabel(caseItem?.incidents?.length || 0, "incident"),
    getCountLabel(caseItem?.evidence?.length || 0, "evidence", "evidence"),
    getCountLabel(caseItem?.documents?.length || 0, "document"),
    getCountLabel(caseItem?.ledger?.length || 0, "ledger", "ledger"),
    getCountLabel(getOpenTaskCount(caseItem), "open task"),
  ];

  const getCaseFallbackFocus = (caseItem) => {
    const description = String(caseItem?.description || "").trim();
    const notes = String(caseItem?.notes || "").trim();
    const summarySource = description || notes;
    if (summarySource) {
      return summarySource.length > 140 ? `${summarySource.slice(0, 137)}...` : summarySource;
    }

    const counts = [
      `${caseItem?.incidents?.length || 0} incidents`,
      `${caseItem?.evidence?.length || 0} evidence`,
      `${caseItem?.documents?.length || 0} documents`,
    ];
    return `Resume ${caseItem?.category || "case"} work. ${counts.join(" · ")}.`;
  };

  const caseListItems = useMemo(() => {
    const query = normalizeSearchText(caseSearchQuery);
    const filteredCases = cases.filter((caseItem) => {
      if (!activeFolderId) return false;
      if (activeFolderId === "unfiled" && caseItem?.folderId) return false;
      if (activeFolderId !== "all" && activeFolderId !== "unfiled" && caseItem?.folderId !== activeFolderId) return false;
      if (!query) return true;
      return [caseItem?.name, caseItem?.category]
        .map(normalizeSearchText)
        .some((value) => value.includes(query));
    });

    const sortedCases = [...filteredCases].sort((a, b) => {
      if (caseSort === "name") {
        return String(a?.name || "").localeCompare(String(b?.name || ""));
      }
      if (caseSort === "status") {
        const statusCompare = String(a?.status || "").localeCompare(String(b?.status || ""));
        if (statusCompare !== 0) return statusCompare;
      }

      const dateA = new Date(getCaseLastUpdated(a) || 0).getTime();
      const dateB = new Date(getCaseLastUpdated(b) || 0).getTime();
      return dateB - dateA;
    });

    return sortedCases;
  }, [cases, caseSearchQuery, caseSort, activeFolderId]);

  const getFolderCaseCount = (folderId) => {
    if (folderId === "all") return cases.length;
    if (folderId === "unfiled") return cases.filter((caseItem) => !caseItem?.folderId).length;
    return cases.filter((caseItem) => caseItem?.folderId === folderId).length;
  };

  const getCaseFolder = (caseItem) =>
    caseFolders.find((folder) => folder.id === caseItem?.folderId) || null;

  const getCaseFolderName = (caseItem) => getCaseFolder(caseItem)?.name || "Inbox";

  const activeFolderName = !activeFolderId
    ? "Folders"
    : activeFolderId === "unfiled"
    ? "Inbox"
    : caseFolders.find((folder) => folder.id === activeFolderId)?.name || "Folder";

  const createFolder = () => {
    const name = folderNameInput.trim();
    if (!name) return;
    const now = new Date().toISOString();
    setCaseFolders((prev) => [
      ...prev,
      {
        id: generateId(),
        name,
        description: "",
        color: "",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    setFolderNameInput("");
  };

  const updateFolder = (folderId, patch = {}) => {
    setCaseFolders((prev) =>
      prev.map((item) =>
        item.id === folderId
          ? {
              ...item,
              ...patch,
              name: Object.prototype.hasOwnProperty.call(patch, "name") ? safeText(patch.name).trim() : item.name,
              description: Object.prototype.hasOwnProperty.call(patch, "description") ? safeText(patch.description) : item.description,
              color: Object.prototype.hasOwnProperty.call(patch, "color") ? safeText(patch.color) : item.color,
              updatedAt: new Date().toISOString(),
            }
        : item
      )
    );
  };

  const deleteFolder = async (folderId) => {
    const folder = caseFolders.find((item) => item.id === folderId);
    if (!folder) return;
    const affectedCases = cases.filter((caseItem) => caseItem.folderId === folderId);
    if (!window.confirm(`Delete folder "${folder.name}"? ${affectedCases.length} case(s) will move to Unfiled.`)) return;

    const updatedCases = cases.map((caseItem) => caseItem.folderId === folderId
      ? { ...caseItem, folderId: null, updatedAt: new Date().toISOString() }
      : caseItem
    );

    try {
      for (const caseItem of updatedCases.filter((item) => item.folderId === null && cases.find((c) => c.id === item.id)?.folderId === folderId)) {
        await saveCase(caseItem);
      }
      setCases(updatedCases);
      setCaseFolders((prev) => prev.filter((item) => item.id !== folderId));
      if (activeFolderId === folderId) setActiveFolderId(null);
    } catch (error) {
      console.error("Failed to delete folder", error);
      showAppNotice("error", error.message || "Could not delete this folder.");
    }
  };

  const moveCaseToFolder = async (caseItem, folderId) => {
    if (!caseItem) return;
    const normalizedFolderId = folderId === "unfiled" ? null : folderId;
    const updatedCase = {
      ...caseItem,
      folderId: normalizedFolderId,
      updatedAt: new Date().toISOString(),
    };
    await handleUpdateCase(updatedCase);
  };

  const toggleFolderView = (folderId) => {
    setActiveFolderId((currentFolderId) => currentFolderId === folderId ? null : folderId);
  };

  const mostRecentlyUpdatedCaseId = useMemo(() => {
    if (cases.length === 0) return null;
    return [...cases]
      .sort((a, b) => new Date(getCaseLastUpdated(b) || 0) - new Date(getCaseLastUpdated(a) || 0))[0]?.id || null;
  }, [cases]);

  // Load cases from IndexedDB
  useEffect(() => {
    let mounted = true;
    
    async function loadCases() {
      try {
        const loadedCases = await getAllCases();
        if (mounted) {
          // Sort newest first using updatedAt or createdAt
          loadedCases.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt || 0);
            const dateB = new Date(b.updatedAt || b.createdAt || 0);
            return dateB - dateA;
          });
          const normalized = loadedCases.map(normalizeCase);
          setCases(normalized);
        }
      } catch (error) {
        console.error("Failed to load cases", error);
        if (mounted) {
          showAppNotice("error", "Could not load saved cases.");
        }
      } finally {
        if (mounted) {
          setLoadingCases(false);
        }
      }
    }

    loadCases();

    return () => {
      mounted = false;
    };
  }, []);

  // Load images when a case is selected
  useEffect(() => {
    async function loadAllImages() {
      if (!selectedCase || selectedCaseRequiresPin) return;

      const newCache = {};
      const imageIds = new Set();

      const allRecords = [
        ...(selectedCase.evidence || []),
        ...(selectedCase.incidents || []),
        ...(selectedCase.strategy || []),
      ];

      for (const record of allRecords) {
        for (const att of record.attachments || []) {
          if (att.storage?.imageId) imageIds.add(att.storage.imageId);
        }
      }

      for (const doc of selectedCase?.documents || []) {
        for (const att of doc.attachments || []) {
          if (att.storage?.imageId) imageIds.add(att.storage.imageId);
        }
      }

      for (const capture of reviewQueue) {
        for (const att of capture.attachments || []) {
          if (att.storage?.imageId) imageIds.add(att.storage.imageId);
        }
      }

      for (const id of imageIds) {
        try {
          const img = await getImageById(id);
          if (img) newCache[id] = img;
        } catch (error) {
          console.error("Failed to load image", id, error);
        }
      }

      setImageCache((prev) => ({ ...prev, ...newCache }));
    }

    loadAllImages();
  }, [selectedCase, selectedCaseRequiresPin, reviewQueue]);

  useEffect(() => {
    let cancelled = false;

    async function loadAttachmentDiagnosticImages() {
      try {
        const { dbPromise } = await import("./db");
        const db = await dbPromise;
        const images = await db.getAll("images");
        if (!cancelled) setAttachmentDiagnosticImages(images || []);
      } catch (error) {
        console.error("Failed to load attachment diagnostics images", error);
        if (!cancelled) setAttachmentDiagnosticImages([]);
      }
    }

    loadAttachmentDiagnosticImages();
    return () => {
      cancelled = true;
    };
  }, [cases, selectedCaseId, imageCache]);

  useEffect(() => {
    localStorage.setItem("toolstack.proveit.v1.captures", JSON.stringify(quickCaptures));
  }, [quickCaptures]);

  useEffect(() => {
    localStorage.setItem(CASE_FOLDERS_STORAGE_KEY, JSON.stringify(caseFolders));
  }, [caseFolders]);

  useEffect(() => {
    if (loadingCases || cases.length === 0) return;
    if (rescueSnapshotTimerRef.current) {
      window.clearTimeout(rescueSnapshotTimerRef.current);
    }

    rescueSnapshotTimerRef.current = window.setTimeout(() => {
      updateRescueSnapshot({ cases, folders: caseFolders, quickCaptures }).catch((error) => {
        console.warn("Could not update Rescue Snapshot", error);
      });
    }, 1200);

    return () => {
      if (rescueSnapshotTimerRef.current) {
        window.clearTimeout(rescueSnapshotTimerRef.current);
      }
    };
  }, [cases, caseFolders, quickCaptures, loadingCases]);

  useEffect(() => {
    localStorage.setItem("toolstack.proveit.v1.selectedCase", JSON.stringify(selectedCaseId));
  }, [selectedCaseId]);

  useEffect(() => {
    localStorage.setItem("toolstack.proveit.v1.activeTab", activeTab);
  }, [activeTab]);

  const exportSelectedCaseBackup = async () => {
    if (!selectedCase) return;

    try {
      const payload = await buildFullBackupCasePayload({
        caseItem: selectedCase,
        selectedCaseId: selectedCase.id,
        activeTab,
      }, { getImageById });
      const safeName = selectedCase.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadJson(payload, `proveit-full-backup-case-${safeName}-${dateStr}.json`, { space: 2 });
    } catch (error) {
      console.error("Export case failed", error);
      showAppNotice("error", "Could not export this case backup.");
    }
  };

  const exportCaseReasoningExport = (caseId, mode = "compact") => {
    const c = cases.find((item) => item.id === caseId);
    if (!c) return;

    const payload = buildCaseReasoningExportPayload(c, mode);

    const safeName = c.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    downloadJson(payload, `proveit-case-reasoning-export-${safeName}-${mode}.json`, { space: 2 });
  };

  const toggleDocumentBasedOnEvidence = (evidenceId) => {
    setDocumentForm((prev) => {
      const currentIds = Array.isArray(prev.basedOnEvidenceIds) ? prev.basedOnEvidenceIds : [];
      return {
        ...prev,
        basedOnEvidenceIds: currentIds.includes(evidenceId)
          ? currentIds.filter((id) => id !== evidenceId)
          : [...currentIds, evidenceId],
      };
    });
  };

  const handleCopyLinkMapExport = async (caseId) => {
    const c = cases.find((item) => item.id === caseId);
    if (!c) {
      showAppNotice("error", "Could not find the selected case.");
      return;
    }

    try {
      const payload = buildCaseLinkMapExportPayload(c);
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showAppNotice("success", "Link Map JSON copied.");
    } catch (error) {
      console.error("Could not copy link map export", error);
      showAppNotice("error", "Could not copy Link Map JSON.");
    }
  };

  const restoreBackupPayload = async (parsed, { source = "file" } = {}) => {
    const imported = parsed?.data || parsed;
    const exportType = parsed?.exportType;

    if (exportType === "CASE_REASONING_EXPORT" || parsed?.importable === false) {
      throw new Error("This is a reasoning export and not an importable backup.");
    }

    if (exportType && !["FULL_BACKUP_ALL", "FULL_BACKUP_CASE"].includes(exportType)) {
      throw new Error("Unsupported ProveIt export type.");
    }

    if (!imported || !Array.isArray(imported.cases)) {
      throw new Error("Invalid import file.");
    }

    if (exportType === "FULL_BACKUP_CASE" && imported.cases.length !== 1) {
      throw new Error("Invalid full case backup. Expected exactly one case.");
    }

    const isFullBackup =
      exportType === "FULL_BACKUP_ALL" ||
      exportType === "FULL_BACKUP_CASE" ||
      parsed?.type === "FULL_BACKUP" ||
      parsed?.includesBinaryData === true ||
      parsed?.version === "2.1-full-backup";
    const shouldImportQuickCaptures = exportType !== "FULL_BACKUP_CASE";
    const restoreStats = { failedAttachments: [] };

    let incomingCases = imported.cases || [];
    const hasIncomingQuickCaptures = Array.isArray(imported.quickCaptures);
    let incomingQuickCaptures = hasIncomingQuickCaptures ? imported.quickCaptures : [];
    const { hasFolderData: hasIncomingFolderData, folders: incomingFolders } =
      getImportedFolderSource(parsed, imported);

    if (isFullBackup) {
      incomingCases = await Promise.all(incomingCases.map((caseItem) =>
        restoreFullBackupCase(caseItem, { saveImage, generateId, restoreStats })
      ));
      if (shouldImportQuickCaptures) {
        incomingQuickCaptures = await Promise.all(incomingQuickCaptures.map((capture) =>
          restoreFullBackupQuickCapture(capture, { saveImage, generateId, restoreStats })
        ));
      }
    }

    const normalizedCases = incomingCases.map(normalizeCase);
    const currentCases = await getAllCases();
    const caseMap = new Map(currentCases.map(c => [c.id, c]));

    for (const importedCase of normalizedCases) {
      if (caseMap.has(importedCase.id)) {
        const existingCase = caseMap.get(importedCase.id);
        const mergedCase = mergeCase(existingCase, importedCase);
        caseMap.set(mergedCase.id, mergedCase);
      } else {
        caseMap.set(importedCase.id, importedCase);
      }
    }

    const mergedCases = Array.from(caseMap.values());
    const importSuccesses = [];
    const importFailures = [];

    for (const caseItem of mergedCases) {
      try {
        await saveCase(caseItem);
        importSuccesses.push(caseItem.name || caseItem.id || "Untitled case");
      } catch (error) {
        console.error("Failed to save imported case", caseItem?.id, error);
        importFailures.push({
          id: caseItem.id,
          name: caseItem.name || caseItem.id || "Untitled case",
          message: error.message || "Unknown save error",
        });
        const restoredImageIds = restoreStats.restoredImageIdsByCase?.[caseItem.id] || [];
        if (restoredImageIds.length > 0) {
          await deleteImages(restoredImageIds);
        }
      }
    }

    const persistedCases = (await getAllCases()).map(normalizeCase);
    reconcileUnlockedCaseIds(persistedCases, currentCases);
    setCases(persistedCases);
    if (importFailures.length === 0 && hasIncomingQuickCaptures && shouldImportQuickCaptures) {
      setQuickCaptures((prev) => {
        const captureMap = new Map(prev.map(q => [q.id, q]));
        for (const q of incomingQuickCaptures) {
          captureMap.set(q.id, normalizeQuickCapture(q, { normalizeAttachments: true }));
        }
        return Array.from(captureMap.values());
      });
    }
    if (importFailures.length === 0) {
      if (shouldImportQuickCaptures && (hasIncomingFolderData || normalizedCases.some((caseItem) => caseItem?.folderId))) {
        const mergedFolders = mergeImportedCaseFolders(caseFolders, incomingFolders, normalizedCases);
        setCaseFolders(mergedFolders);
        try {
          localStorage.setItem(CASE_FOLDERS_STORAGE_KEY, JSON.stringify(mergedFolders));
        } catch {
          // State still updates the folder dashboard when localStorage is unavailable.
        }
      }
      setSelectedCaseId(imported.selectedCaseId ?? null);
      setActiveTab(imported.activeTab || "overview");

      if (exportType === "FULL_BACKUP_ALL") {
        const counts = getFullBackupPayloadCounts(parsed);
        const backupTimestamp = new Date().toISOString();
        const backupMeta = {
          exportType: "FULL_BACKUP_ALL",
          timestamp: backupTimestamp,
          caseCount: counts.caseCount,
          quickCaptureCount: counts.quickCaptureCount,
          folderCount: counts.folderCount,
        };
        try {
          localStorage.setItem(LAST_FULL_BACKUP_ALL_AT_KEY, backupTimestamp);
          localStorage.setItem(LAST_BACKUP_META_KEY, JSON.stringify(backupMeta));
        } catch {
          // Import should still complete if localStorage metadata cannot be written.
        }
        await updateRescueSnapshot({
          cases: persistedCases,
          folders: readCaseFolders(),
          quickCaptures: incomingQuickCaptures,
        });
        setLastBackupMeta(backupMeta);
        refreshRescueSnapshot();
      }
      if (exportType !== "FULL_BACKUP_ALL") {
        await updateRescueSnapshot({
          cases: persistedCases,
          folders: readCaseFolders(),
          quickCaptures,
        });
      }
      setEmptyDbWarning("");
      setStorageDiagnostics(await getStorageDiagnostics());
    }

    return {
      source,
      importSuccesses,
      importFailures,
      restoreStats,
    };
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!(await requireRecentFullBackup())) {
      event.target.value = "";
      return;
    }
    const importSizeWarning = getFileSizeWarning(file);
    if (importSizeWarning) {
      showAppNotice("warning", importSizeWarning);
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await restoreBackupPayload(parsed, { source: "file" });

      if (result.restoreStats.failedAttachments.length > 0) {
        showAppNotice(
          "warning",
          `Import completed, but ${result.restoreStats.failedAttachments.length} attachment(s) could not be restored.`
        );
      }
      if (result.importFailures.length > 0) {
        const failedNames = result.importFailures.map((item) => item.name).slice(0, 3).join(", ");
        const remainingCount = result.importFailures.length - Math.min(result.importFailures.length, 3);
        showAppNotice(
          "warning",
          `Import partially completed. Imported ${result.importSuccesses.length} case(s); failed ${result.importFailures.length}: ${failedNames}${remainingCount > 0 ? ` +${remainingCount} more` : ""}.`
        );
      } else {
        showAppNotice("success", `Import completed for ${result.importSuccesses.length} case(s).`);
      }
    } catch (error) {
      console.error("Import failed", error);
      showAppNotice("error", error.message || "Could not import this file.");
      alert("Could not import this file.");
    }

    event.target.value = "";
  };

  const restoreRescueSnapshot = async () => {
    const rescue = readRescueSnapshot();
    setRescueSnapshot(rescue);

    if (rescue.corrupt || !rescue.available || !rescue.snapshot?.data) {
      showAppNotice("error", "Rescue Snapshot unavailable/corrupt");
      return;
    }

    try {
      const snapshotCases = rescue.snapshot.data.cases.map(normalizeCase);
      for (const caseItem of snapshotCases) {
        await saveCase(caseItem);
      }

      const snapshotFolders = Array.isArray(rescue.snapshot.data.folders)
        ? rescue.snapshot.data.folders.map(normalizeCaseFolder).filter(Boolean)
        : [];
      setCaseFolders(snapshotFolders);
      try {
        localStorage.setItem(CASE_FOLDERS_STORAGE_KEY, JSON.stringify(snapshotFolders));
      } catch {
        // State still updates the folder dashboard when localStorage is unavailable.
      }

      if (Array.isArray(rescue.snapshot.data.quickCaptures) && rescue.snapshot.data.quickCaptures.length > 0) {
        setQuickCaptures(rescue.snapshot.data.quickCaptures.map((capture) =>
          normalizeQuickCapture(capture, { normalizeAttachments: true })
        ));
      }

      const persistedCases = (await getAllCases()).map(normalizeCase);
      setCases(persistedCases);
      setSelectedCaseId(null);
      setActiveTab("overview");
      setEmptyDbWarning("");
      setRescueSnapshotRecoveryIgnored(false);
      setStorageDiagnostics(await getStorageDiagnostics());
      refreshRescueSnapshot();
      showAppNotice("warning", `Rescue Snapshot restored ${snapshotCases.length} case structure(s). Images and attachments require a Full App Backup.`);
    } catch (error) {
      console.error("Rescue Snapshot restore failed", error);
      showAppNotice("error", error.message || "Could not restore Rescue Snapshot.");
    }
  };

  const createDefaultCase = async () => {
    const newCase = {
      id: generateId(),
      name: `New Case ${cases.length + 1}`,
      category: "general",
      status: "open",
      folderId: null,
      notes: "",
      description: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: [],
      incidents: [],
      tasks: [],
      strategy: [],
    };

    try {
      await saveCase(newCase);
      setCases((prev) => [newCase, ...prev]);
      setSelectedCaseId(newCase.id);
      setActiveTab("overview");
      setShowCreate(false);
    } catch (error) {
      console.error("Failed to save case", error);
      showAppNotice("error", error.message || "Could not create this case.");
    }
  };

  const handleSaveCase = async () => {
    if (editingCase) {
      const updatedCase = {
        ...editingCase,
        name: form.name || "Untitled Case",
        category: normalizeCategory(form.category === "custom" ? form.customCategory : form.category),
        notes: form.notes,
        description: form.description,
        updatedAt: new Date().toISOString(),
      };

      try {
        await saveCase(updatedCase);
        setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
        setShowCreate(false);
        setEditingCase(null);
        setForm({ name: "", category: "general", customCategory: "", notes: "", description: "" });
      } catch (error) {
        console.error("Failed to update case", error);
        showAppNotice("error", error.message || "Could not update this case.");
      }
    } else {
      const newCase = {
        id: generateId(),
        name: form.name || `New Case ${cases.length + 1}`,
        category: normalizeCategory(form.category === "custom" ? form.customCategory : form.category),
        status: "open",
        folderId: null,
        notes: form.notes,
        description: form.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        evidence: [],
        incidents: [],
        tasks: [],
        strategy: [],
      };

      try {
        await saveCase(newCase);
        setCases((prev) => [newCase, ...prev]);
        setSelectedCaseId(newCase.id);
        setActiveTab("overview");
        setShowCreate(false);
        setForm({ name: "", category: "general", customCategory: "", notes: "", description: "" });
      } catch (error) {
        console.error("Failed to save case", error);
        showAppNotice("error", error.message || "Could not create this case.");
      }
    }
  };

  const handleDeleteCase = async (caseId) => {
    if (window.confirm("Delete this case and all linked evidence?")) {
      try {
        await deleteCase(caseId);
        setCases((prev) => prev.filter((c) => c.id !== caseId));
        setUnlockedCaseIds((prev) => prev.filter((id) => id !== caseId));
        if (selectedCaseId === caseId) {
          setSelectedCaseId(null);
        }
      } catch (error) {
        console.error("Failed to delete case", error);
        showAppNotice("error", error.message || "Could not delete this case.");
      }
    }
  };

  const deleteRecord = async (recordType, recordId) => {
    if (!selectedCase) return;

    if (window.confirm("Delete this record permanently?")) {
      const updatedCase = deleteRecordFromCase(selectedCase, recordType, recordId);

      try {
        await saveCase(updatedCase);
        setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updatedCase : c)));
      } catch (error) {
        console.error("Failed to save updated case", error);
        showAppNotice("error", error.message || "Could not delete this record.");
      }
    }
  };

  const openCase = (caseId) => {
    setLockPromptPin("");
    setLockPromptError("");
    setSelectedCaseId(caseId);
    setActiveTab("overview");
  };

  const openCreateCaseModal = () => {
    setEditingCase(null);
    setForm({ name: "", category: "general", customCategory: "", notes: "", description: "" });
    setShowCreate(true);
  };

  const openEditCaseModal = (caseItem) => {
    setEditingCase(caseItem);
    setForm({
      name: caseItem.name,
      category: ["general", "personal", "work", "housing", "legal"].includes((caseItem.category || "").toLowerCase()) ? (caseItem.category || "").toLowerCase() : "custom",
      customCategory: ["general", "personal", "work", "housing", "legal"].includes((caseItem.category || "").toLowerCase()) ? "" : caseItem.category,
      notes: caseItem.notes,
      description: caseItem.description || "",
    });
    setShowCreate(true);
  };

  const openRecordModal = (type, initialFormState = {}) => {
    const initialLinkedEvidenceIds = Array.isArray(initialFormState.linkedEvidenceIds) ? initialFormState.linkedEvidenceIds : [];
    setRecordType(type);
    setEditingRecord(null);
    setRecordForm({ 
      ...EMPTY_RECORD_FORM, 
      date: new Date().toISOString().slice(0, 10),
      capturedAt: new Date().toISOString().slice(0, 10),
      evidenceStatus: type === "incidents" && initialLinkedEvidenceIds.length > 0 ? "documented" : EMPTY_RECORD_FORM.evidenceStatus,
      ...initialFormState
    });
  };

  const openEditRecordModal = (type, item, options = {}) => {
    const currentRecord = item?.id && Array.isArray(selectedCase?.[type])
      ? selectedCase[type].find((record) => record.id === item.id) || item
      : item;

    setRecordForm({
      ...EMPTY_RECORD_FORM,
      ...currentRecord,
      attachments: (currentRecord?.attachments?.length ? currentRecord.attachments : null) || (currentRecord?.files?.length ? currentRecord.files : null) || (type === "evidence" ? currentRecord?.availability?.digital?.files : []) || [],
      files: (currentRecord?.files?.length ? currentRecord.files : null) || (type === "evidence" ? currentRecord?.availability?.digital?.files : []) || [],
    });
    setRecordFocusField(options.focusField || null);
    setRecordFocusHint(options.focusHint || "");
    setRecordOpenedFromIssue(!!options.fromIssue);
    setRecordType(type);
    setEditingRecord(currentRecord);
  };

  const closeRecordModal = () => {
    setRecordType(null);
    setEditingRecord(null);
    setRecordFocusField(null);
    setRecordFocusHint("");
    setRecordOpenedFromIssue(false);
    setRecordForm(EMPTY_RECORD_FORM);
    setParentRecordForNewChild(null);
  };

  const closeQuickCapture = () => {
    setShowQuickCapture(false);
    setCaptureForm(EMPTY_CAPTURE_FORM);
  };

const handleRecordFiles = async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  showFileSizeWarnings(files);

  const targetRecordId = editingRecord?.id || recordForm.id || generateId();

  const serializable = await Promise.all(
    files.map((file) => fileToSerializable(file, targetRecordId))
  );

  setRecordForm((prev) => {
    const updatedAttachments = [...(prev.attachments || []), ...serializable];

    const newState = {
      ...prev,
      id: prev.id || targetRecordId,
      attachments: updatedAttachments,
    };

    if (recordType === "evidence") {
      newState.availability = {
        ...(prev.availability || EMPTY_RECORD_FORM.availability),
        digital: {
          ...(prev.availability?.digital || EMPTY_RECORD_FORM.availability.digital),
          hasDigital: updatedAttachments.length > 0,
          files: updatedAttachments,
        },
      };
      if (!prev.evidenceType) {
        newState.evidenceType = "documented";
      }
    }

    return newState;
  });

  event.target.value = "";
};

  const handleCaptureFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    showFileSizeWarnings(files);
    const targetCaptureId = captureForm.id || generateId();
    const serializable = await Promise.all(files.map(file => fileToSerializable(file, targetCaptureId)));
    setCaptureForm(prev => ({ 
      ...prev, 
      id: prev.id || targetCaptureId, 
      attachments: [...prev.attachments, ...serializable] 
    }));
    event.target.value = "";
  };

  const removeRecordAttachment = (attachmentId) => {
    setRecordForm((prev) => {
      const updatedAttachments = prev.attachments.filter((file) => file.id !== attachmentId);
      let allowLastEvidenceAttachmentRemoval = true;
      
      if (recordType === "evidence" && updatedAttachments.length === 0 && prev.availability?.digital?.hasDigital) {
        if (!window.confirm("Removing the last file. Mark digital copy as unavailable?")) {
          allowLastEvidenceAttachmentRemoval = false;
        }
      }

      return removeRecordAttachmentFromForm(prev, recordType, attachmentId, {
        allowLastEvidenceAttachmentRemoval,
        emptyAvailability: EMPTY_RECORD_FORM.availability,
      });
    });
  };

  const removeCaptureAttachment = (attachmentId) => {
    setCaptureForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((file) => file.id !== attachmentId),
    }));
  };

  const handleUnlinkEvidenceFromIncident = async (incidentId, evidenceIdToUnlink) => {
    if (!selectedCase) return;
    const incident = selectedCase.incidents.find(i => i.id === incidentId);
    if (!incident) return;

    const updatedIncident = {
      ...incident,
      linkedEvidenceIds: (incident.linkedEvidenceIds || []).filter(id => id !== evidenceIdToUnlink),
      updatedAt: new Date().toISOString(),
      edited: true
    };

    let updatedCase = {
      ...selectedCase,
      incidents: selectedCase.incidents.map(i => i.id === incidentId ? updatedIncident : i),
      updatedAt: new Date().toISOString()
    };

    updatedCase = syncCaseLinks(updatedCase, updatedIncident, "incidents");

    try {
      await saveCase(updatedCase);
      setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCase : c));
      openEditRecordModal("incidents", updatedIncident);
    } catch (error) {
      console.error("Failed to unlink evidence", error);
      showAppNotice("error", error.message || "Could not unlink this evidence item.");
    }
  };

  const handleCreateEvidenceFromIncident = (incident) => {
    setParentRecordForNewChild(incident);
    openRecordModal("evidence", {
      linkedIncidentIds: [incident.id],
      date: new Date().toISOString().slice(0, 10),
      capturedAt: new Date().toISOString().slice(0, 10)
    });
  };

  const saveRecord = async (payload = recordForm) => {
    if (!selectedCase || !recordType || !payload.title.trim()) return;
    
    let updatedCase;
    const shouldShowIssueFeedback = recordOpenedFromIssue;
    const normalizedPayload = {
      ...payload,
      isMilestone: !!payload.isMilestone,
    };

    const currentEditingRecord = editingRecord?.id && Array.isArray(selectedCase?.[recordType])
      ? selectedCase[recordType].find((record) => record.id === editingRecord.id) || editingRecord
      : editingRecord;
    const payloadForUpsert = currentEditingRecord
      ? { ...currentEditingRecord, ...normalizedPayload }
      : normalizedPayload;

    updatedCase = upsertRecordInCase(selectedCase, recordType, payloadForUpsert, currentEditingRecord);
    const newImageIds = getNewImageIdsForCaseUpdate(selectedCase, updatedCase);

    try {
      await saveCase(updatedCase);
      setCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id ? updatedCase : c
        )
      );
      if (shouldShowIssueFeedback) {
        setRecordIssueFeedback("Issue fix saved");
        setTimeout(() => setRecordIssueFeedback(""), 1800);
      }
    } catch (error) {
      console.error("Failed to save updated case", error);
      if (newImageIds.length > 0) {
        await deleteImages(newImageIds);
      }
      showAppNotice("error", error.message || "Could not save this record.");
      return;
    }

    // If we were creating evidence from an incident, prepare to return to the incident view
    const isEvidenceFromIncident = recordType === "evidence" && parentRecordForNewChild;
    const parentToReopen = isEvidenceFromIncident ? updatedCase.incidents.find(inc => inc.id === parentRecordForNewChild.id) : null;

    if (recordType === "evidence") setActiveTab("evidence");
    if (recordType === "incidents") setActiveTab("incidents");
    if (recordType === "strategy") setActiveTab("strategy");

    closeRecordModal();

    // Re-open parent incident modal if applicable
    if (parentToReopen) {
      setTimeout(() => openEditRecordModal("incidents", parentToReopen), 50);
    }
  };

  const saveQuickCapture = async () => {
    if (!captureForm.caseId || !captureForm.title.trim()) return;

    const selectedCaptureCase = cases.find((c) => String(c.id) === String(captureForm.caseId));
    if (!selectedCaptureCase) return;

    const newCapture = createQuickCaptureFromForm(captureForm, selectedCaptureCase);

    setQuickCaptures((prev) => [newCapture, ...prev]);
    closeQuickCapture();
  };

  const convertCapture = async (captureId, targetType) => {
    const capture = quickCaptures.find((item) => item.id === captureId);
    if (!capture) return;

    const caseToUpdate = cases.find(c => c.id === capture.caseId);
    if (!caseToUpdate) {
      showAppNotice("error", "Could not find the case for this quick capture.");
      return;
    }
    let updatedCapture = markQuickCaptureConverted(capture, targetType);
    
    const result = convertQuickCaptureToRecord(caseToUpdate, capture, targetType);
    const updatedCase = result.case;
    updatedCapture = result.capture;

    try {
      await saveCase(updatedCase);
      setCases((prev) =>
        prev.map((c) =>
          c.id === capture.caseId ? updatedCase : c
        )
      );
      setQuickCaptures((prev) =>
        prev.map((item) =>
          item.id === captureId ? updatedCapture : item
        )
      );
    } catch (error) {
      console.error("Failed to save case after conversion", error);
      showAppNotice("error", error.message || "Could not convert this quick capture.");
    }
  };

  const archiveCapture = (captureId) => {
    setQuickCaptures((prev) =>
      prev.map((item) => (item.id === captureId ? archiveQuickCapture(item) : item))
    );
  };

  const folderTiles = caseFolders.map((folder) => ({
    ...folder,
    count: getFolderCaseCount(folder.id),
  }));

  const renderFolderTiles = () => (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Case Folders</h2>
          <p className="mt-1 text-sm text-neutral-700">
            {activeFolderName} | {getFolderCaseCount(activeFolderId)} case{getFolderCaseCount(activeFolderId) === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Folder privacy controls will apply per folder. Inbox is not password protected.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFolderModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100"
        >
          <Settings className="h-4 w-4" />
          Manage Folders
        </button>
      </div>

      <button
        type="button"
        onClick={() => toggleFolderView("unfiled")}
        className={`mt-4 flex w-full max-w-xl items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
          activeFolderId === "unfiled"
            ? "border-lime-500 bg-lime-50 shadow-[0_0_0_1px_rgba(132,204,22,0.2)]"
            : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white"
        }`}
      >
        <FolderOpen className={`h-6 w-6 shrink-0 ${activeFolderId === "unfiled" ? "text-lime-700" : "text-neutral-500"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-neutral-900">Inbox</span>
            <span className="text-xs font-semibold text-neutral-500">
              {getFolderCaseCount("unfiled")} case{getFolderCaseCount("unfiled") === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">New cases start here</p>
        </div>
      </button>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-neutral-900">Folders</h3>
        {caseFolders.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
            Create folders to organize your cases. New cases remain in Inbox until assigned.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folderTiles.map((folder) => {
          const isActive = activeFolderId === folder.id;
          const FolderIcon = isActive ? FolderOpen : Folder;
          return (
          <button
            key={folder.id}
            type="button"
            onClick={() => toggleFolderView(folder.id)}
            className={`min-w-0 rounded-xl border p-3 text-left transition-colors ${
              isActive
                ? "border-lime-500 bg-lime-50 shadow-[0_0_0_1px_rgba(132,204,22,0.25)]"
                : "border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white"
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <FolderIcon
                className={`mt-0.5 h-8 w-8 shrink-0 ${isActive ? "text-lime-700" : "text-neutral-500"}`}
                style={folder.color ? { color: folder.color } : undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-neutral-900">{folder.name}</div>
                <div className="mt-0.5 text-xs font-semibold text-neutral-500">
                  {folder.count} case{folder.count === 1 ? "" : "s"}
                </div>
                {folder.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{folder.description}</p>
                ) : null}
              </div>
            </div>
          </button>
          );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const renderEmptyState = () => (
    <div className="space-y-6">
      {renderFolderTiles()}
      <div className="grid gap-6 lg:grid-cols-12">
      <section className="space-y-6 lg:col-span-8">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Getting Started</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {setupSteps.map((s) => (
              <div key={s.step} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold">{s.title}</div>
                <p className="mt-1 text-sm text-neutral-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Choose Your First Case</h2>
          <p className="mb-4 text-sm text-neutral-600">Users can start from a generic template, rename it, keep it as-is, or create a completely custom case name and category.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {starterCases.map((c) => (
              <div key={c.name} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold">{c.name}</div>
                <p className="mt-1 text-sm text-neutral-600">{c.hint}</p>
                <button onClick={() => createDefaultCase()} className="mt-3 w-full rounded-xl bg-neutral-700 py-2 text-white">
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="lg:col-span-4">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Empty State</h2>
          <p className="mt-2 text-sm text-neutral-600">Create your first case to begin.</p>
        </div>
      </aside>
      </div>
    </div>
  );

  const renderCaseList = () => {
    if (loadingCases) {
      return <div className="p-4 text-center text-neutral-500">Loading cases...</div>;
    }

    if (cases.length === 0) {
      return <div className="p-4 text-center text-neutral-500">No cases yet. Create your first case.</div>;
    }

    return (
      <div className="grid gap-4">
        {renderFolderTiles()}
        {!activeFolderId ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
            Select a folder to view its cases.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">{activeFolderName}</h2>
                <p className="mt-1 text-sm text-neutral-500">Jump straight back into the right case.</p>
              </div>
              <div className="text-sm text-neutral-500">
                Showing {caseListItems.length}
              </div>
            </div>
            {caseListItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
            No cases in this folder.
          </div>
        ) : (
          caseListItems.map((c) => {
            const isMostRecent = c.id === mostRecentlyUpdatedCaseId;
            const caseIsLocked = isCasePinLocked(c);
            const focusText = caseIsLocked
              ? "Unlock to view this case."
              : String(c.actionSummary?.currentFocus || "").trim() || getCaseFallbackFocus(c);
            const primaryActionLabel = caseIsLocked ? "Unlock" : (c.id === selectedCaseId || isMostRecent ? "Continue" : "Open");
            const caseMetadata = getCaseListMetadata(c);
            const createdLabel = getCaseCreatedLabel(c);

            return (
              <div
                key={c.id}
                onClick={() => openCase(c.id)}
                className={`flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm cursor-pointer transition-colors hover:border-neutral-300 lg:flex-row lg:items-start lg:justify-between ${
                  isMostRecent
                    ? "border-lime-300 bg-lime-50/30 shadow-[0_0_0_1px_rgba(163,230,53,0.35)]"
                    : "border-neutral-200"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 break-words text-lg font-bold leading-snug text-neutral-900">{caseIsLocked ? "Locked Case" : c.name}</div>
                    {!caseIsLocked && isMostRecent && (
                      <span className="rounded-full border border-lime-300 bg-lime-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-700">
                        Most Recent
                      </span>
                    )}
                    {caseIsLocked && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        PIN Locked
                      </span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getCaseStatusClasses(c.status)}`}>
                      {formatCaseStatus(c.status)}
                    </span>
                  </div>
                  {!caseIsLocked && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                      <span>{c.category || "Uncategorized"}</span>
                      <span>Updated {formatCaseLastUpdated(c)}</span>
                      {createdLabel ? <span>Created {createdLabel}</span> : null}
                    </div>
                  )}
                  {!caseIsLocked && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                        Folder: {getCaseFolderName(c)}
                      </span>
                      {caseMetadata.map((item) => (
                        <span key={item} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      {caseIsLocked ? "Privacy" : "Current Focus"}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-neutral-700">
                      {focusText}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 self-start lg:max-w-xs lg:justify-end">
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex min-w-[9rem] items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-600"
                  >
                    Move
                    <select
                      value={c.folderId || "unfiled"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        moveCaseToFolder(c, e.target.value);
                      }}
                      className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-neutral-800 outline-none"
                    >
                      <option value="unfiled">Inbox</option>
                      {caseFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.name}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={(e) => { e.stopPropagation(); openCase(c.id); }}
                    className="rounded-xl border border-lime-500 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                  >
                    {primaryActionLabel}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteCase(c.id); }} 
                    className="rounded-xl border border-lime-500 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
          </>
        )}
      </div>
    );
  };

  const renderReviewQueue = () => {
    if (!reviewQueue.length) {
      return (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          No quick captures waiting for review. Use Quick Capture when something happens fast, then sort it later here.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {reviewQueue.map((item) => (
          <div key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="font-semibold">{item.title}</div>
                <div className="mt-1 text-sm text-neutral-600">{item.caseName} • {item.date}</div>
                {item.note ? <p className="mt-3 text-sm text-neutral-700">{item.note}</p> : null}
              </div>
              <span className="rounded-full border border-lime-300 bg-lime-50 px-3 py-1 text-xs font-medium text-neutral-700">
                Unreviewed
              </span>
            </div>
            <AttachmentPreview 
              attachments={item.attachments || []}
              imageCache={imageCache}
              onPreview={setPreviewFile}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => convertCapture(item.id, "evidence")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Save as Evidence</button>
              <button onClick={() => convertCapture(item.id, "incidents")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Save as Incident</button>
              <button onClick={() => convertCapture(item.id, "strategy")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Save as Strategy</button>
              <button onClick={() => archiveCapture(item.id)} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Archive</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const backupStatus = getBackupStatus(lastBackupMeta);
  const compactBackupStatus = getCompactBackupStatus(lastBackupMeta);
  const backupTimestampLabel = formatBackupMetaTimestamp(lastBackupMeta);
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocalhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|$)/i.test(currentOrigin);
  const appLockCorrupt = Boolean(appLockState.corrupt);
  const appLockEnabled = Boolean(appLockState.enabled && !appLockCorrupt);
  const appLocked = appLockEnabled && !appUnlocked;
  const appLockStatusLabel = appLockCorrupt ? "Corrupted" : appLockEnabled ? "Enabled" : "Disabled";
  const diagnosticCaseCount = storageDiagnostics?.recordCounts?.cases;
  const backupNeedsAttention = !hasRecentFullBackupMeta(lastBackupMeta);
  const onCaseListPage = !selectedCase && !selectedCaseRequiresPin;
  const rescueSnapshotCanRestore = Boolean(rescueSnapshot?.available && rescueSnapshot.caseCount > 0 && !rescueSnapshot.corrupt);
  const rescueSnapshotCorrupt = Boolean(rescueSnapshot?.corrupt);
  const showRescueSnapshotRecovery = onCaseListPage && !rescueSnapshotRecoveryIgnored && diagnosticCaseCount === 0 && rescueSnapshotCanRestore;
  const showRecoveryPanel = onCaseListPage && (showRescueSnapshotRecovery || backupNeedsAttention || diagnosticCaseCount === 0 || !!emptyDbWarning);
  const recoveryMessage = showRescueSnapshotRecovery
    ? "IndexedDB is empty, but a Rescue Snapshot exists."
    : diagnosticCaseCount === 0 || emptyDbWarning
    ? (emptyDbWarning || EMPTY_DB_WARNING_MESSAGE)
    : "Full app backup is missing or older than 24 hours. Download a fresh backup before import, restore, or larger edits.";
  const rescueSnapshotStatusLabel = rescueSnapshotCorrupt
    ? "Rescue Snapshot unavailable/corrupt"
    : rescueSnapshotCanRestore
      ? `Available: ${rescueSnapshot.caseCount} case${rescueSnapshot.caseCount === 1 ? "" : "s"}, ${rescueSnapshot.folderCount || 0} folder${(rescueSnapshot.folderCount || 0) === 1 ? "" : "s"}, ${rescueSnapshot.imageCount || 0} image${(rescueSnapshot.imageCount || 0) === 1 ? "" : "s"}`
      : "No Rescue Snapshot available";
  const rescueSnapshotTimestampLabel = rescueSnapshot?.timestamp
    ? new Date(rescueSnapshot.timestamp).toLocaleString()
    : "";

  if (appLockCorrupt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4 text-neutral-100">
        <div className="w-full max-w-md rounded-2xl border border-red-300/40 bg-white p-6 text-neutral-900 shadow-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">App Lock Warning</div>
          <h1 className="mt-2 text-2xl font-semibold">App lock settings are corrupted</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-700">
            ProveIt cannot verify the saved App Lock settings. Resetting App Lock does not delete cases, folders, images, or backups.
          </p>
          <p className="mt-3 text-sm leading-6 text-neutral-700">
            App Lock is a privacy screen. It does not encrypt stored data.
          </p>
          <button
            type="button"
            onClick={resetCorruptAppLock}
            className="mt-5 w-full rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            Reset App Lock Settings
          </button>
        </div>
      </div>
    );
  }

  if (appLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4 text-neutral-100">
        <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-white p-6 text-neutral-900 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-lime-500 bg-lime-50 text-neutral-900">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-lime-700">App Lock</div>
              <h1 className="text-xl font-semibold">ProveIt is locked</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-neutral-700">
            Enter your App Lock PIN to view cases, folders, diagnostics, and backups.
          </p>
          <form onSubmit={handleUnlockApp} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">App PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={appUnlockPin}
                onChange={(event) => {
                  setAppUnlockPin(sanitizeAppPinInput(event.target.value));
                  setAppUnlockError("");
                }}
                placeholder="Enter 4 to 8 digits"
                className="w-full rounded-xl border border-neutral-300 p-3 outline-none transition-colors focus:border-lime-500"
              />
            </label>
            {appUnlockError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                {appUnlockError}
              </div>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-lg border border-lime-600 bg-lime-500 px-3 py-2 text-sm font-bold text-white hover:bg-lime-600"
            >
              Unlock App
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-neutral-500">
            App Lock is a privacy screen. It does not encrypt stored data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      {appNotice ? (
        <div className="fixed right-4 top-4 z-[120] max-w-md">
          <div
            className={`rounded-2xl border px-4 py-3 shadow-lg ${
              appNotice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : appNotice.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-lime-200 bg-lime-50 text-lime-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 text-sm font-medium leading-6">{appNotice.message}</div>
              <button
                type="button"
                onClick={() => setAppNotice(null)}
                className="rounded-lg border border-current/15 px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {riskyActionGuardOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900">Full App Backup Recommended</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{RISKY_ACTION_BACKUP_MESSAGE}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleRiskyActionDownloadBackup}
                className="rounded-md border border-lime-600 bg-lime-500 px-3 py-2 text-sm font-semibold text-white hover:bg-lime-600"
              >
                Download Full Backup
              </button>
              <button
                type="button"
                onClick={() => closeRiskyActionGuard(true)}
                className="rounded-md border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50"
              >
                Continue Anyway
              </button>
              <button
                type="button"
                onClick={() => closeRiskyActionGuard(false)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {exportImportOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Export & Import</h2>
                <p className="mt-1 text-sm text-neutral-500">Back up, export, or import local browser data.</p>
              </div>
              <button
                type="button"
                onClick={() => setExportImportOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                aria-label="Close Export and Import"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Backups</h3>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      Full app backups are importable and include all cases, quick captures, and stored attachment data.
                    </p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${backupStatus.className}`}>
                    {backupStatus.label}
                  </span>
                </div>
                <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
                  <div>Last backup: <span className="font-semibold text-neutral-800">{backupTimestampLabel}</span></div>
                  {lastBackupMeta?.exportType === "FULL_BACKUP_ALL" ? (
                    <div className="mt-1">
                      Cases: {lastBackupMeta.caseCount ?? 0} | Quick captures: {lastBackupMeta.quickCaptureCount ?? 0} | Folders: {lastBackupMeta.folderCount ?? 0}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleFullBackup}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-lime-400/20"
                  >
                    <Download className="h-4 w-4" />
                    Full App Backup
                  </button>
                  {selectedCase ? (
                    <button
                      type="button"
                      onClick={exportSelectedCaseBackup}
                      disabled={selectedCaseRequiresPin}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                    >
                      <Download className="h-4 w-4" />
                      Selected Case Backup
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">AI / Reasoning</h3>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      Reasoning exports are for AI review and are not backups. They are not importable and do not preserve attachment payloads.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    Not a backup
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => selectedCase && exportCaseReasoningExport(selectedCase.id)}
                  disabled={!selectedCase || selectedCaseRequiresPin}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 sm:w-auto"
                >
                  <FileJson className="h-4 w-4" />
                  Reasoning Export
                </button>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <h3 className="text-sm font-bold text-neutral-900">Import</h3>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Import changes local browser data. Download a Full App Backup before importing.
                </p>
                <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-lime-400/20 sm:w-auto">
                  <Upload className="h-4 w-4" />
                  Import Backup JSON
                  <input type="file" accept="application/json,.json" className="hidden" onChange={importData} />
                </label>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Recovery</h3>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      Rescue Snapshot restores case structure only. Images/attachments require a Full App Backup.
                    </p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    rescueSnapshotCorrupt
                      ? "border-red-200 bg-red-50 text-red-700"
                      : rescueSnapshotCanRestore
                        ? "border-lime-200 bg-lime-50 text-lime-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600"
                  }`}>
                    {rescueSnapshotCorrupt ? "Unavailable" : rescueSnapshotCanRestore ? "Available" : "None"}
                  </span>
                </div>
                <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
                  <div>{rescueSnapshotStatusLabel}</div>
                  {rescueSnapshotTimestampLabel ? (
                    <div>Snapshot timestamp: <span className="font-semibold text-neutral-800">{rescueSnapshotTimestampLabel}</span></div>
                  ) : null}
                </div>
                {rescueSnapshotCanRestore ? (
                  <button
                    type="button"
                    onClick={restoreRescueSnapshot}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-lime-400/20 sm:w-auto"
                  >
                    <Upload className="h-4 w-4" />
                    Restore Case Structure from Rescue Snapshot
                  </button>
                ) : null}
              </section>

            </div>
          </div>
        </div>
      ) : null}
      {settingsOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Settings</h2>
                <p className="mt-1 text-sm text-neutral-500">Manage privacy, data tools, diagnostics, and app details.</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                aria-label="Close Settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Security & Privacy</h3>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      App Lock is a privacy screen. It does not encrypt stored browser data.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      Full backups remain plaintext unless exported with encryption in a future version.
                    </p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    appLockCorrupt
                      ? "border-red-200 bg-red-50 text-red-700"
                      : appLockEnabled
                        ? "border-lime-200 bg-lime-50 text-lime-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600"
                  }`}>
                    App Lock: {appLockStatusLabel}
                  </span>
                </div>

                {appLockEnabled ? (
                  <button
                    type="button"
                    onClick={lockApp}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-100 sm:w-auto"
                  >
                    <Lock className="h-4 w-4" />
                    Lock App
                  </button>
                ) : null}

                {appLockEnabled ? (
                  <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    <label className={`flex items-start gap-2 text-sm font-semibold ${
                      appLockSessionUnlockEligible ? "text-neutral-800" : "text-neutral-400"
                    }`}>
                      <input
                        type="checkbox"
                        checked={appLockSessionUnlocked}
                        disabled={!appLockSessionUnlockEligible}
                        onChange={(event) => handleAppLockSessionUnlockToggle(event.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        Keep unlocked during this browser session
                        {isLocalhostOrigin ? (
                          <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            Development convenience
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <p className="mt-2 text-xs leading-5 text-neutral-600">
                      This is for development/convenience only. Closing the browser or pressing Lock App will lock ProveIt again.
                    </p>
                    {!appLockSessionUnlockEligible ? (
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        Unlock with your PIN first to use this option. It reduces privacy during the current browser session.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        When enabled, refresh keeps ProveIt unlocked in this tab/session. This reduces privacy during the current browser session.
                      </p>
                    )}
                  </div>
                ) : null}

                {appLockCorrupt ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
                    App Lock settings are corrupted. Resetting App Lock does not delete cases or attachments.
                    <button
                      type="button"
                      onClick={resetCorruptAppLock}
                      className="mt-3 block rounded-md border border-red-600 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                    >
                      Reset App Lock Settings
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {appLockEnabled ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAppLockMode("change");
                            resetAppLockForm();
                          }}
                          className={`rounded-md border px-3 py-2 text-xs font-bold ${
                            appLockMode === "change"
                              ? "border-lime-600 bg-lime-50 text-neutral-900"
                              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          Change PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAppLockMode("disable");
                            resetAppLockForm();
                          }}
                          className={`rounded-md border px-3 py-2 text-xs font-bold ${
                            appLockMode === "disable"
                              ? "border-red-500 bg-red-50 text-red-800"
                              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          Disable App Lock
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-neutral-600">Set a 4 to 8 digit PIN to enable App Lock.</div>
                    )}

                    {(appLockEnabled && appLockMode === "disable") ? (
                      <div className="grid gap-3">
                        <label>
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Current PIN</span>
                          <input
                            type="password"
                            inputMode="numeric"
                            value={appLockForm.currentPin}
                            onChange={(event) => {
                              setAppLockForm((prev) => ({ ...prev, currentPin: sanitizeAppPinInput(event.target.value) }));
                              setAppLockFormError("");
                            }}
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-lime-500"
                          />
                        </label>
                        <label className="flex items-start gap-2 text-xs font-medium leading-5 text-neutral-700">
                          <input
                            type="checkbox"
                            checked={appLockForm.confirmDisable}
                            onChange={(event) => setAppLockForm((prev) => ({ ...prev, confirmDisable: event.target.checked }))}
                            className="mt-1"
                          />
                          <span>Disable the app-wide privacy screen. This does not change per-case PIN locks.</span>
                        </label>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-3">
                        {appLockEnabled ? (
                          <label>
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Current PIN</span>
                            <input
                              type="password"
                              inputMode="numeric"
                              value={appLockForm.currentPin}
                              onChange={(event) => {
                                setAppLockForm((prev) => ({ ...prev, currentPin: sanitizeAppPinInput(event.target.value) }));
                                setAppLockFormError("");
                              }}
                              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-lime-500"
                            />
                          </label>
                        ) : null}
                        <label>
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">PIN</span>
                          <input
                            type="password"
                            inputMode="numeric"
                            value={appLockForm.newPin}
                            onChange={(event) => {
                              setAppLockForm((prev) => ({ ...prev, newPin: sanitizeAppPinInput(event.target.value) }));
                              setAppLockFormError("");
                            }}
                            placeholder="4 to 8 digits"
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-lime-500"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Confirm PIN</span>
                          <input
                            type="password"
                            inputMode="numeric"
                            value={appLockForm.confirmPin}
                            onChange={(event) => {
                              setAppLockForm((prev) => ({ ...prev, confirmPin: sanitizeAppPinInput(event.target.value) }));
                              setAppLockFormError("");
                            }}
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-lime-500"
                          />
                        </label>
                      </div>
                    )}

                    {appLockFormError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                        {appLockFormError}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSaveAppLock}
                      disabled={appLockSaving}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-lime-400/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 sm:w-auto"
                    >
                      <Lock className="h-4 w-4" />
                      {appLockEnabled ? (appLockMode === "disable" ? "Disable App Lock" : "Change PIN") : "Enable App Lock"}
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <h3 className="text-sm font-bold text-neutral-900">Data & Backups</h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Full App Backup remains the complete backup path for cases, folders, quick captures, images, and attachments.
                </p>
                <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                  <div>Last backup: <span className="font-semibold text-neutral-800">{backupTimestampLabel}</span></div>
                  {lastBackupMeta?.exportType === "FULL_BACKUP_ALL" ? (
                    <div className="mt-1">
                      Cases: {lastBackupMeta.caseCount ?? 0} | Quick captures: {lastBackupMeta.quickCaptureCount ?? 0} | Folders: {lastBackupMeta.folderCount ?? 0}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setExportImportOpen(true);
                  }}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-100 sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Open Export / Import
                </button>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <h3 className="text-sm font-bold text-neutral-900">Storage Diagnostics</h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Open the existing read-only diagnostics panel for IndexedDB and localStorage status.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    if (!storageDiagnosticsOpen) handleStorageDiagnostics();
                  }}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-100 sm:w-auto"
                >
                  <Database className="h-4 w-4" />
                  Open Storage Diagnostics
                </button>
              </section>

              <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <h3 className="text-sm font-bold text-neutral-900">App Info</h3>
                <p className="mt-1 text-xs leading-5 text-neutral-600">
                  ProveIt is local-first. Data is stored in this browser profile for the current origin.
                </p>
                <div className="mt-3 break-all rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
                  Current origin: <span className="font-mono text-neutral-800">{currentOrigin || "Unknown"}</span>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {folderModalOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Manage Folders</h2>
                <p className="mt-1 text-sm text-neutral-500">Create folders and organize cases without changing case contents.</p>
              </div>
              <button
                type="button"
                onClick={() => setFolderModalOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                aria-label="Close folder manager"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <h3 className="text-sm font-bold text-neutral-900">Create Folder</h3>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={folderNameInput}
                    onChange={(event) => setFolderNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") createFolder();
                    }}
                    placeholder="Folder name"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition-colors focus:border-lime-500"
                  />
                  <button
                    type="button"
                    onClick={createFolder}
                    className="w-full rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-bold text-neutral-900 shadow-sm transition-colors hover:bg-lime-400/20 sm:w-auto"
                  >
                    Create
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-900">Folders</h3>
                {caseFolders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
                    No custom folders yet.
                  </div>
                ) : (
                  caseFolders.map((folder) => (
                    <div key={folder.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_auto] md:items-end">
                        <label className="min-w-0">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Name</span>
                          <input
                            type="text"
                            value={folder.name}
                            onChange={(event) => updateFolder(folder.id, { name: event.target.value })}
                            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition-colors focus:border-lime-500"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Color</span>
                          <input
                            type="color"
                            value={/^#[0-9a-f]{6}$/i.test(folder.color || "") ? folder.color : "#737373"}
                            onChange={(event) => updateFolder(folder.id, { color: event.target.value })}
                            className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => deleteFolder(folder.id)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 shadow-sm transition-colors hover:bg-red-50 md:w-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                      <label className="mt-3 block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Description</span>
                        <textarea
                          value={folder.description || ""}
                          onChange={(event) => updateFolder(folder.id, { description: event.target.value })}
                          rows={2}
                          placeholder="Optional short description"
                          className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition-colors focus:border-lime-500"
                        />
                      </label>
                      <div className="mt-2 text-xs text-neutral-500">
                        {getFolderCaseCount(folder.id)} case{getFolderCaseCount(folder.id) === 1 ? "" : "s"} assigned
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="proveit-app-header relative mb-3 flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="sr-only">ProveIt</h1>
              <img
                src={proveItLogo}
                alt="ProveIt"
                className="block h-auto max-h-[5.25rem] w-auto max-w-[min(82vw,33rem)] object-contain sm:max-h-[7.5rem] sm:max-w-[42rem]"
              />
            </div>

            <div className="flex flex-col gap-2 sm:items-end print:hidden">
              <div className="flex max-w-full flex-wrap gap-2 sm:justify-end">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${compactBackupStatus.className}`}>
                  {compactBackupStatus.label}
                </span>
                {lastBackupMeta?.exportType === "FULL_BACKUP_ALL" ? (
                  <span className="inline-flex max-w-full items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
                    <span className="truncate">Last: {backupTimestampLabel}</span>
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[10px] text-neutral-400">Secure • Browser Only • Offline First</p>

            </div>
          </div>
        </header>

        {onCaseListPage ? (
          <section className="mb-6 rounded-xl border border-lime-500 bg-lime-50 p-3 shadow-[0_0_0_1px_rgba(132,204,22,0.25)] print:hidden">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button
                type="button"
                onClick={openCreateCaseModal}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-bold text-neutral-900 shadow-sm transition-colors hover:bg-lime-400/20 active:scale-95 sm:w-auto"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>New Case</span>
              </button>
              <button
                type="button"
                onClick={() => setExportImportOpen(true)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100 active:scale-95 sm:flex-none"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>Export / Import</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-100 active:scale-95 sm:flex-none"
              >
                <Settings className="h-3.5 w-3.5 shrink-0" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={handleStorageDiagnostics}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100 active:scale-95 sm:flex-none"
              >
                <Database className="h-3.5 w-3.5 shrink-0" />
                <span>Diagnostics</span>
              </button>
              {appLockEnabled ? (
                <button
                  type="button"
                  onClick={lockApp}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100 active:scale-95 sm:flex-none"
                >
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>Lock App</span>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {showRecoveryPanel ? (
          <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold leading-6 print:hidden ${
            showRescueSnapshotRecovery || diagnosticCaseCount === 0 || emptyDbWarning
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}>
            <div>{recoveryMessage}</div>
            {showRescueSnapshotRecovery ? (
              <div className="mt-1 text-xs font-medium text-red-700">
                Rescue Snapshot restores case structure only. Images/attachments require a Full App Backup.
              </div>
            ) : null}
            {showRescueSnapshotRecovery ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={restoreRescueSnapshot}
                  className="rounded-md border border-red-700 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                >
                  Restore Case Structure from Rescue Snapshot
                </button>
                <button
                  type="button"
                  onClick={() => setExportImportOpen(true)}
                  className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                >
                  Import Backup File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmptyDbWarning("");
                    setRescueSnapshotRecoveryIgnored(true);
                  }}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                >
                  Ignore
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {storageDiagnosticsOpen ? (
          <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-sm print:hidden">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">Storage Diagnostics</h2>
                <p className="mt-1 text-xs text-neutral-500">Read-only browser storage snapshot.</p>
              </div>
              <button
                type="button"
                onClick={handleStorageDiagnostics}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                Refresh
              </button>
            </div>
            {storageDiagnosticsLoading ? (
              <div className="mt-3 text-xs text-neutral-500">Reading storage...</div>
            ) : storageDiagnosticsError ? (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                {storageDiagnosticsError}
              </div>
            ) : storageDiagnostics ? (
              <pre className="mt-3 overflow-x-auto rounded-md bg-neutral-950 p-3 text-xs leading-5 text-neutral-100">
                {JSON.stringify(storageDiagnostics, null, 2)}
              </pre>
            ) : null}
          </section>
        ) : null}

        {loadingCases ? (
          <div className="p-8 text-center text-neutral-500">Loading cases...</div>
        ) : cases.length === 0 ? (
          renderEmptyState()
        ) : selectedCaseRequiresPin ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Privacy Lock</div>
                <h2 className="mt-1 text-2xl font-semibold text-neutral-900">{selectedCase.name}</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  This case is PIN locked. Enter the case PIN to continue.
                </p>
              </div>
              <button
                onClick={closeLockPrompt}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleUnlockSelectedCase} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">Case PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={lockPromptPin}
                  onChange={(e) => {
                    setLockPromptPin(sanitizePinInput(e.target.value));
                    setLockPromptError("");
                  }}
                  placeholder="Enter 4 to 6 digits"
                  className="w-full rounded-xl border border-neutral-300 p-3 outline-none transition-colors focus:border-lime-500"
                />
                <p className="mt-2 text-xs text-neutral-500">Numeric only. Press Enter to submit.</p>
              </div>

              {lockPromptError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {lockPromptError}
                </div>
              ) : null}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">Forgot PIN?</div>
                <p className="mt-1">
                  V1 has no in-app recovery and no reset shortcut. If the PIN is forgotten, recovery may not be possible.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                >
                  Unlock Case
                </button>
                <button
                  type="button"
                  onClick={closeLockPrompt}
                  className="flex-1 rounded-xl border border-neutral-300 bg-white py-2 font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : selectedCase ? (
          <CaseDetail
            selectedCase={selectedCase}
            reviewQueue={reviewQueue}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={tabs}
            imageCache={imageCache}
            attachmentImages={attachmentDiagnosticImages}
            attachmentDiagnosticCases={cases}
            setSelectedCaseId={setSelectedCaseId}
            openRecordModal={openRecordModal}
            renderCaseList={renderCaseList}
            openEditRecordModal={openEditRecordModal}
            openEditCaseModal={openEditCaseModal}
            onUpdateCase={handleUpdateCase}
            deleteRecord={deleteRecord}
            exportSelectedCase={exportSelectedCaseBackup}
            onExportSnapshot={exportCaseReasoningExport}
            onCopyLinkMapExport={handleCopyLinkMapExport}
            onExportFullBackup={handleFullBackup}
            onOpenGptDeltaModal={openGptDeltaModal}
            onOpenPinManager={openPinManager}
            isPinLocked={selectedCaseLocked}
            issueFixFeedback={recordIssueFeedback}
            onViewRecord={setViewingRecord}
            onPreviewFile={setPreviewFile}
            openLedgerModal={openLedgerModal}
            deleteLedgerEntry={deleteLedgerEntry}
            duplicateLedgerEntry={duplicateLedgerEntry}
            openDocumentModal={openDocumentModal}
            deleteDocumentEntry={deleteDocumentEntry}
            reviewQueueSection={SHOW_REVIEW_QUEUE ? (
              <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Review Queue</h2>
                    <p className="mt-1 text-sm text-neutral-600">Quick captures waiting to be classified.</p>
                  </div>
                  <span className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
                    {reviewQueue.length} Open
                  </span>
                </div>
                {renderReviewQueue()}
              </div>
            ) : null}
          />
        ) : (
          renderCaseList()
        )}

        {showGptDeltaModal && (
          <GptDeltaModal
            applying={gptDeltaApplying}
            backupPromptOpen={gptDeltaBackupPromptOpen}
            error={gptDeltaError}
            onApply={handleApplyGptDelta}
            onCancel={resetGptDeltaModal}
            onCancelBackupPrompt={handleCancelGptDeltaBackupPrompt}
            onChangeText={handleGptDeltaTextChange}
            onCreateBackupThenApply={handleCreateBackupThenApplyGptDelta}
            onApplyWithoutBackup={handleApplyGptDeltaWithoutBackup}
            onValidate={handleValidateGptDelta}
            preview={gptDeltaPreview}
            text={gptDeltaText}
            validatedCase={gptDeltaValidatedCase}
          />
        )}
        {pinManagerState.open && pinManagerCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Privacy Lock</div>
                  <h2 className="mt-1 text-xl font-semibold text-neutral-900">
                    {pinManagerState.mode === "set" ? "Set PIN" : pinManagerState.mode === "change" ? "Change PIN" : "Remove PIN"}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">{pinManagerCase.name}</p>
                </div>
                <button
                  onClick={closePinManager}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Close
                </button>
              </div>

              {isCasePinLocked(pinManagerCase) && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPinManagerState((prev) => ({ ...prev, mode: "change" }));
                      resetPinModalState();
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      pinManagerState.mode === "change"
                        ? "border-lime-500 bg-lime-50 text-lime-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    Change PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPinManagerState((prev) => ({ ...prev, mode: "remove" }));
                      resetPinModalState();
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      pinManagerState.mode === "remove"
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    Remove PIN
                  </button>
                </div>
              )}

              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSavePinFlow();
                }}
              >
                {pinManagerState.mode === "set" && (
                  <>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="font-semibold">Before you enable this lock</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>This is a privacy lock, not encryption.</li>
                        <li>If the PIN is forgotten, recovery may not be possible.</li>
                        <li>Export a backup before enabling the lock.</li>
                      </ul>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">New PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoFocus
                        value={pinForm.newPin}
                        onChange={(e) => {
                          setPinForm((prev) => ({ ...prev, newPin: sanitizePinInput(e.target.value) }));
                          setPinModalError("");
                        }}
                        placeholder="4 to 6 digits"
                        className="w-full rounded-xl border border-neutral-300 p-3 outline-none transition-colors focus:border-lime-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">Confirm PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.confirmPin}
                        onChange={(e) => {
                          setPinForm((prev) => ({ ...prev, confirmPin: sanitizePinInput(e.target.value) }));
                          setPinModalError("");
                        }}
                        placeholder="Re-enter PIN"
                        className="w-full rounded-xl border border-neutral-300 p-3 outline-none transition-colors focus:border-lime-500"
                      />
                    </div>
                  </>
                )}

                {pinManagerState.mode === "change" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">Current PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoFocus
                        value={pinForm.currentPin}
                        onChange={(e) => {
                          setPinForm((prev) => ({ ...prev, currentPin: sanitizePinInput(e.target.value) }));
                          setPinModalError("");
                        }}
                        placeholder="Current PIN"
                        className="w-full rounded-xl border border-neutral-300 p-3 outline-none transition-colors focus:border-lime-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">New PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.newPin}
                        onChange={(e) => {
                          setPinForm((prev) => ({ ...prev, newPin: sanitizePinInput(e.target.value) }));
                          setPinModalError("");
                        }}
                        placeholder="4 to 6 digits"
                        className="w-full rounded-xl border border-neutral-300 p-3 outline-none transition-colors focus:border-lime-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">Confirm New PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.confirmPin}
                        onChange={(e) => {
                          setPinForm((prev) => ({ ...prev, confirmPin: sanitizePinInput(e.target.value) }));
                          setPinModalError("");
                        }}
                        placeholder="Re-enter new PIN"
                        className="w-full rounded-xl border border-neutral-300 p-3 outline-none transition-colors focus:border-lime-500"
                      />
                    </div>
                  </>
                )}

                {pinManagerState.mode === "remove" && (
                  <>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                      Removing the PIN will stop prompting before this case opens on this device.
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">Current PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoFocus
                        value={pinForm.currentPin}
                        onChange={(e) => {
                          setPinForm((prev) => ({ ...prev, currentPin: sanitizePinInput(e.target.value) }));
                          setPinModalError("");
                        }}
                        placeholder="Current PIN"
                        className="w-full rounded-xl border border-neutral-300 p-3 outline-none transition-colors focus:border-lime-500"
                      />
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={pinForm.confirmRemoval}
                        onChange={(e) => {
                          setPinForm((prev) => ({ ...prev, confirmRemoval: e.target.checked }));
                          setPinModalError("");
                        }}
                        className="mt-1"
                      />
                      <span>I confirm that I want to remove the PIN from this case.</span>
                    </label>
                  </>
                )}

                {pinModalError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {pinModalError}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="font-semibold">Forgot PIN behavior in V1</div>
                  <p className="mt-1">
                    There is no in-app recovery and no insecure reset shortcut. If the PIN is forgotten, recovery may not be possible.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                  >
                    {pinManagerState.mode === "set" ? "Enable PIN" : pinManagerState.mode === "change" ? "Save New PIN" : "Remove PIN"}
                  </button>
                  <button
                    type="button"
                    onClick={closePinManager}
                    className="flex-1 rounded-xl border border-neutral-300 bg-white py-2 font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-semibold">{editingCase ? "Edit Case" : "Create Case"}</h2>
              <p className="mb-4 text-sm text-neutral-600">Give the case any name that makes sense for the user. Generic templates are only starting points and can be kept, renamed, or ignored entirely.</p>
              <input placeholder="Case Name (custom for this user)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mb-3 w-full rounded-xl border border-neutral-300 p-3" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mb-3 w-full rounded-xl border border-neutral-300 p-3" rows={2} />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mb-3 w-full rounded-xl border border-neutral-300 p-3">
                <option value="general">General</option>
                <option value="personal">Personal</option>
                <option value="work">Work</option>
                <option value="housing">Property / Housing</option>
                <option value="legal">Legal</option>
                <option value="custom">Custom Category</option>
              </select>
              {form.category === "custom" && (
                <input
                  placeholder="Custom Category (e.g. Business, Family, Medical, Education)"
                  value={form.customCategory}
                  onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                  className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
                />
              )}
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mb-4 w-full rounded-xl border border-neutral-300 p-3" rows={4} />
              <div className="flex gap-2">
                <button onClick={handleSaveCase} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">{editingCase ? "Save" : "Create"}</button>
                <button onClick={() => setShowCreate(false)} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {recordType && selectedCase && (
          <RecordModal
            recordType={recordType}
            selectedCase={selectedCase}
            recordForm={recordForm}
            setRecordForm={setRecordForm}
            handleRecordFiles={handleRecordFiles}
            removeRecordAttachment={removeRecordAttachment}
            saveRecord={saveRecord}
            closeRecordModal={closeRecordModal}
            focusField={recordFocusField}
            focusHint={recordFocusHint}
            onPreviewFile={setPreviewFile}
            openEditRecordModal={openEditRecordModal}
            openDocumentModal={openDocumentModal}
            onCreateEvidenceFromIncident={handleCreateEvidenceFromIncident}
            onUnlinkEvidenceFromIncident={handleUnlinkEvidenceFromIncident}
          />
        )}

        {SHOW_REVIEW_QUEUE && showQuickCapture && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-semibold">Quick Capture</h2>
              <p className="mb-4 text-sm text-neutral-600">Capture something fast now. Review and classify it later from the Review Queue.</p>
              <select value={captureForm.caseId} onChange={(e) => setCaptureForm({ ...captureForm, caseId: e.target.value })} className="mb-3 w-full rounded-xl border border-neutral-300 p-3">
                <option value="">Select Case</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="Title" value={captureForm.title} onChange={(e) => setCaptureForm({ ...captureForm, title: e.target.value })} className="mb-3 w-full rounded-xl border border-neutral-300 p-3" />
              <input type="date" value={captureForm.date} onChange={(e) => setCaptureForm({ ...captureForm, date: e.target.value })} className="mb-3 w-full rounded-xl border border-neutral-300 p-3" />
              <textarea placeholder="Quick note" value={captureForm.note} onChange={(e) => setCaptureForm({ ...captureForm, note: e.target.value })} className="mb-3 w-full rounded-xl border border-neutral-300 p-3" rows={4} />

              <label className="mb-3 block cursor-pointer rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
                Add phone photos, screenshots, PDFs, or documents
                <input type="file" multiple className="hidden" onChange={handleCaptureFiles} accept="image/*,application/pdf,.pdf,.doc,.docx,.txt,.eml,message/rfc822" />
              </label>

              {captureForm.attachments.length > 0 && (
                <div className="mb-4 space-y-2">
                  {captureForm.attachments.map((file) => (
                    <div key={file.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                      <span className="truncate pr-3">{file.name}</span>
                      <button onClick={() => removeCaptureAttachment(file.id)} className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-xs text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Remove</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={saveQuickCapture} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Save to Review Queue</button>
                <button onClick={closeQuickCapture} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {ledgerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl flex flex-col max-h-[90vh]">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">{editingLedgerId ? "Edit Ledger Entry" : "Add Ledger Entry"}</h2>
                <p className="text-sm text-neutral-600">{editingLedgerId ? "Update payment or cost details." : "Enter payment or expected cost details."}</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Label</label>
                  <input
                    type="text"
                    value={ledgerForm.label}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, label: e.target.value })}
                    placeholder="e.g. Monthly Rent Payment"
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Group</label>
                  <select
                    value={ledgerForm.groupMode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      let newBatchLabel = ledgerForm.batchLabel;
                      if (mode === "none") newBatchLabel = "";
                      else if (mode !== "__new__") newBatchLabel = mode;
                      
                      setLedgerForm({ 
                        ...ledgerForm, 
                        groupMode: mode,
                        batchLabel: newBatchLabel
                      });
                    }}
                    className="w-full rounded-xl border border-neutral-300 p-3 bg-white focus:border-lime-500 outline-none"
                  >
                    <option value="none">No Group</option>
                    {Array.from(new Set((selectedCase?.ledger || [])
                      .map(item => item.batchLabel)
                      .filter(label => label && label.trim() !== "")))
                      .map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))
                    }
                    <option value="__new__">Create New Group</option>
                  </select>
                </div>

                {ledgerForm.groupMode === "__new__" && (
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">New Group Name</label>
                    <input
                      type="text"
                      value={ledgerForm.batchLabel}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, batchLabel: e.target.value })}
                      placeholder="e.g. Q1 Expenses"
                      className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Type</label>
                    <select
                      value={ledgerForm.category}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, category: e.target.value })}
                      className="w-full rounded-xl border border-neutral-300 p-3 bg-white"
                    >
                      <option value="rent">Rent</option>
                      <option value="installment">Installment</option>
                      <option value="deposit">Deposit</option>
                      <option value="furniture">Furniture</option>
                      <option value="repair">Repair</option>
                      <option value="utility">Utility</option>
                      <option value="legal">Legal</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Period</label>
                    <input
                      type="text"
                      value={ledgerForm.period}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, period: e.target.value })}
                      placeholder="e.g. Jan 2024"
                      className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Expected Amount</label>
                    <input
                      type="number"
                      value={ledgerForm.expectedAmount}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, expectedAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Paid Amount</label>
                    <input
                      type="number"
                      value={ledgerForm.paidAmount}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, paidAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={ledgerForm.paymentDate}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, paymentDate: e.target.value })}
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Status</label>
                    <select
                      value={ledgerForm.status}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, status: e.target.value })}
                      className="w-full rounded-xl border border-neutral-300 p-3 bg-white"
                    >
                      <option value="planned">Planned</option>
                      <option value="paid">Paid</option>
                      <option value="part-paid">Part Paid</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="disputed">Disputed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Proof Status</label>
                    <select
                      value={ledgerForm.proofStatus}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, proofStatus: e.target.value })}
                      className="w-full rounded-xl border border-neutral-300 p-3 bg-white"
                    >
                      <option value="missing">Missing</option>
                      <option value="partial">Partial</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Notes</label>
                  <textarea
                    value={ledgerForm.notes}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, notes: e.target.value })}
                    placeholder="Additional details..."
                    rows={3}
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                <div className="pt-2">
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">Linked Records</label>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 border border-neutral-200 rounded-xl p-2 bg-neutral-50/50">
                    {[
                      ...(selectedCase?.evidence || []).map(r => ({ ...r, _type: 'evidence', _label: 'Evidence' })),
                      ...(selectedCase?.incidents || []).map(r => ({ ...r, _type: 'incidents', _label: 'Incident' })),
                      ...(selectedCase?.strategy || []).map(r => ({ ...r, _type: 'strategy', _label: 'Strategy' })),
                    ].map(rec => (
                      <label key={rec.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white border border-transparent hover:border-neutral-200 transition-all cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={(ledgerForm.linkedRecordIds || []).includes(rec.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setLedgerForm(prev => ({
                              ...prev,
                              linkedRecordIds: checked 
                                ? [...(prev.linkedRecordIds || []), rec.id]
                                : (prev.linkedRecordIds || []).filter(id => id !== rec.id)
                            }));
                          }}
                          className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-neutral-800 truncate">{rec.title}</span>
                            <span className="text-[9px] font-bold uppercase text-neutral-400 bg-neutral-100 px-1 rounded">{rec._label}</span>
                          </div>
                          {(rec.eventDate || rec.date) && (
                            <div className="text-[10px] text-neutral-500">{rec.eventDate || rec.date}</div>
                          )}
                        </div>
                      </label>
                    ))}
                    {(!selectedCase?.evidence?.length && !selectedCase?.incidents?.length && !selectedCase?.strategy?.length) && (
                      <p className="text-[10px] text-neutral-400 italic text-center py-2">No records available to link.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3 pt-4 border-t border-neutral-100">
                <button
                  onClick={saveLedgerEntry}
                  className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
                >
                  Save Entry
                </button>
                <button
                  onClick={closeLedgerModal}
                  className="flex-1 rounded-xl bg-neutral-100 py-2 font-bold text-neutral-600 hover:bg-neutral-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {documentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl flex flex-col max-h-[90vh]">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  {documentModalMode === "record"
                    ? editingDocumentId ? "Edit Record" : "Add Record"
                    : editingDocumentId ? "Edit Document" : "Add Document"}
                </h2>
                <p className="text-sm text-neutral-600">
                  {documentModalMode === "record"
                    ? "Create a table-based tracking record."
                    : editingDocumentId ? "Update details for this document record." : "Enter details for a new document record."}
                </p>
              </div>

              {documentModalMode === "record" ? (
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Title</label>
                  <input
                    type="text"
                    value={documentForm.title}
                    onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                    placeholder="Record title"
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                {renderDocumentSequenceGroupField()}

                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Record Type</label>
                  <select
                    value={getRecordFormType(documentForm)}
                    onChange={(e) => updateRecordDocumentForm({ recordType: e.target.value })}
                    className="w-full rounded-xl border border-neutral-300 p-3 bg-white"
                  >
                    {RECORD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Purpose / What This Tracks</label>
                  <input
                    type="text"
                    value={getRecordFormPurpose(documentForm)}
                    onChange={(e) => updateRecordDocumentForm({ purpose: e.target.value })}
                    placeholder="e.g. Rent payments, work hours, compliance checks"
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                <div>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-bold uppercase text-neutral-400">Table / Structured Record Text</label>
                    <div className="flex items-center gap-2">
                      {recordPromptCopied && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-lime-700">Copied</span>
                      )}
                      <button
                        type="button"
                        onClick={copyRecordGptPrompt}
                        className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
                      >
                        Copy Record Prompt
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={getRecordTableText(documentForm)}
                    onChange={(e) => updateRecordDocumentForm({ tableText: e.target.value })}
                    placeholder="Paste or write the table rows here..."
                    rows={12}
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Notes / Summary</label>
                  <textarea
                    value={getRecordNotes(documentForm)}
                    onChange={(e) => updateRecordDocumentForm({ notes: e.target.value })}
                    placeholder="Optional notes about what this record means..."
                    rows={3}
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                <div className="pt-2">
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Based on Evidence</label>
                  <p className="mb-3 text-xs text-neutral-500">Select evidence items used to calculate or create this tracking record.</p>
                  <div className="max-h-44 overflow-y-auto space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/50 p-2 pr-1">
                    {(selectedCase?.evidence || []).map((evidenceItem) => (
                      <label key={evidenceItem.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 transition-all hover:border-neutral-200 hover:bg-white">
                        <input
                          type="checkbox"
                          checked={(documentForm.basedOnEvidenceIds || []).includes(evidenceItem.id)}
                          onChange={() => toggleDocumentBasedOnEvidence(evidenceItem.id)}
                          className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-medium text-neutral-800">{evidenceItem.title || "Untitled Evidence"}</span>
                            <span className="rounded bg-neutral-100 px-1 text-[9px] font-bold uppercase text-neutral-400">Evidence</span>
                          </div>
                          {(evidenceItem.eventDate || evidenceItem.date || evidenceItem.capturedAt) && (
                            <div className="text-[10px] text-neutral-500">{evidenceItem.eventDate || evidenceItem.date || evidenceItem.capturedAt}</div>
                          )}
                        </div>
                      </label>
                    ))}
                    {!(selectedCase?.evidence || []).length && (
                      <p className="py-2 text-center text-[10px] italic text-neutral-400">No evidence available.</p>
                    )}
                  </div>
                </div>
              </div>
              ) : (
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Title</label>
                  <input
                    type="text"
                    value={documentForm.title}
                    onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                    placeholder="Document Title"
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                {renderDocumentSequenceGroupField()}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Category</label>
                    <select
                      value={documentForm.category}
                      onChange={(e) => setDocumentForm({ ...documentForm, category: e.target.value })}
                      className="w-full rounded-xl border border-neutral-300 p-3 bg-white"
                    >
                      <option value="legal">Legal</option>
                      <option value="medical">Medical</option>
                      <option value="financial">Financial</option>
                      <option value="correspondence">Correspondence</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Document Date</label>
                    <input
                      type="date"
                      value={documentForm.documentDate}
                      onChange={(e) => setDocumentForm({ ...documentForm, documentDate: e.target.value })}
                      className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Source</label>
                  <input
                    type="text"
                    value={documentForm.source}
                    onChange={(e) => setDocumentForm({ ...documentForm, source: e.target.value })}
                    placeholder="e.g. Email from HR, Mail from Landlord"
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Summary</label>
                  <textarea
                    value={documentForm.summary}
                    onChange={(e) => setDocumentForm({ ...documentForm, summary: e.target.value })}
                    placeholder="Briefly describe what this document is about..."
                    rows={2}
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none"
                  />
                </div>

                <div>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-bold uppercase text-neutral-400">Text Content</label>
                    <div className="flex items-center gap-2">
                      {documentPromptCopied && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-lime-700">Copied</span>
                      )}
                      <button
                        type="button"
                        onClick={copyDocumentGptPrompt}
                        className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
                      >
                        Copy GPT Prompt
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={documentForm.textContent}
                    onChange={(e) => setDocumentForm({ ...documentForm, textContent: e.target.value })}
                    placeholder="Full text content or OCR result..."
                    rows={8}
                    className="w-full rounded-xl border border-neutral-300 p-3 focus:border-lime-500 outline-none font-mono text-sm"
                  />
                </div>

                <div className="pt-2">
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Attachments</label>
                  <p className="text-[10px] text-neutral-500 mb-3">Upload supporting files for this document.</p>
                  
                  <input
                    type="file"
                    id="document-attachments-input"
                    multiple
                    onChange={handleDocumentFiles}
                    className="hidden"
                  />
                  
                  <button
                    type="button"
                    onClick={() => document.getElementById('document-attachments-input').click()}
                    className="mb-3 rounded-xl border border-lime-500 bg-white px-4 py-2 text-xs font-bold text-neutral-800 shadow-sm hover:bg-lime-50 transition-all active:scale-95"
                  >
                    Attach Document
                  </button>

                  {documentForm.attachments?.length > 0 ? (
                    <div className="space-y-2">
                      {documentForm.attachments.map((att) => (
                        <div key={att.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                          <div className="flex-1 min-w-0 text-left">
                            <div className="truncate font-medium text-neutral-800">{att.name}</div>
                            <div className="text-[9px] font-bold uppercase text-neutral-400">{att.type || att.mimeType || "file"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDocumentAttachment(att.id)}
                            className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-red-600 shadow-sm hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-neutral-400 italic">No attachments added yet.</p>
                  )}
                </div>

                <div className="pt-2">
                  <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">Linked Records</label>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 border border-neutral-200 rounded-xl p-2 bg-neutral-50/50">
                    {[
                      ...(selectedCase?.evidence || []).map(r => ({ ...r, _type: 'evidence', _label: 'Evidence' })),
                      ...(selectedCase?.incidents || []).map(r => ({ ...r, _type: 'incidents', _label: 'Incident' })),
                      ...(selectedCase?.strategy || []).map(r => ({ ...r, _type: 'strategy', _label: 'Strategy' })),
                    ].map(rec => (
                      <label key={rec.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white border border-transparent hover:border-neutral-200 transition-all cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={(documentForm.linkedRecordIds || []).includes(rec.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setDocumentForm(prev => ({
                              ...prev,
                              linkedRecordIds: checked 
                                ? [...(prev.linkedRecordIds || []), rec.id]
                                : (prev.linkedRecordIds || []).filter(id => id !== rec.id)
                            }));
                          }}
                          className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-neutral-800 truncate">{rec.title}</span>
                            <span className="text-[9px] font-bold uppercase text-neutral-400 bg-neutral-100 px-1 rounded">{rec._label}</span>
                          </div>
                          {(rec.eventDate || rec.date) && (
                            <div className="text-[10px] text-neutral-500">{rec.eventDate || rec.date}</div>
                          )}
                        </div>
                      </label>
                    ))}
                    {(!selectedCase?.evidence?.length && !selectedCase?.incidents?.length && !selectedCase?.strategy?.length) && (
                      <p className="text-[10px] text-neutral-400 italic text-center py-2">No records available to link.</p>
                    )}
                  </div>
                </div>
              </div>
              )}

              <div className="mt-6 flex gap-3 pt-4 border-t border-neutral-100">
                <button
                  onClick={saveDocumentEntry}
                  className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
                >
                  {documentModalMode === "record" ? "Save Record" : "Save Document"}
                </button>
                <button
                  onClick={closeDocumentModal}
                  className="flex-1 rounded-xl bg-neutral-100 py-2 font-bold text-neutral-600 hover:bg-neutral-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {viewingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewingRecord(null)}>
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-neutral-100 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">Evidence Details</h2>
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    <span>ID: {viewingRecord.id?.substring(0, 8)}</span>
                    <span className="px-2 py-0.5 rounded border border-neutral-200 bg-neutral-50 text-neutral-600">
                      {viewingRecord.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <button onClick={() => setViewingRecord(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">✕</button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-neutral-900">{viewingRecord.title}</h3>
                  <p className="text-sm text-neutral-500">{viewingRecord.date}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Importance</span>
                    <div className="text-sm font-semibold capitalize">{viewingRecord.importance}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Relevance</span>
                    <div className="text-sm font-semibold capitalize">{viewingRecord.relevance}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Evidence Type</span>
                    <div className="text-sm font-semibold">{EVIDENCE_TYPE_LABELS[viewingRecord.evidenceType] || EVIDENCE_TYPE_LABELS.observed}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Source Type</span>
                    <div className="text-sm capitalize">{viewingRecord.sourceType}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Captured At</span>
                    <div className="text-sm">{viewingRecord.capturedAt || viewingRecord.date}</div>
                  </div>
                </div>

                {viewingRecord.description && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Description</span>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{viewingRecord.description}</p>
                  </div>
                )}

                {viewingRecord.notes && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Internal Notes</span>
                    <p className="text-sm text-neutral-500 bg-neutral-50 p-3 rounded-xl border border-neutral-100 italic">{viewingRecord.notes}</p>
                  </div>
                )}

                {relatedTrackingRecordsForViewing.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-neutral-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Used by Tracking Records</span>
                    <div className="space-y-2">
                      {relatedTrackingRecordsForViewing.map((record) => (
                        <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-neutral-800">{record.title || "Untitled Tracking Record"}</div>
                            <div className="text-[10px] font-bold uppercase text-neutral-400">Tracking Record</div>
                          </div>
                          <button
                            onClick={() => {
                              setViewingRecord(null);
                              window.setTimeout(() => {
                                openDocumentModal(record, record.id, "record");
                              }, 50);
                            }}
                            className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                          >
                            Open
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingRecord.tags?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Tags</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {viewingRecord.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-neutral-100 text-[10px] font-medium text-neutral-600 border border-neutral-200">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                <AttachmentPreview 
                  attachments={viewingRecord.attachments || []}
                  imageCache={imageCache}
                  onPreview={setPreviewFile}
                />
              </div>

              <div className="p-6 border-t border-neutral-100">
                <button onClick={() => setViewingRecord(null)} className="w-full rounded-xl bg-neutral-900 py-2 font-medium text-white shadow-sm hover:bg-neutral-800 transition-colors">Close</button>
              </div>
            </div>
          </div>
        )}

        {previewFile && (
          <FilePreviewModal
            file={previewFile}
            imageCache={imageCache}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </div>
    </div>
    );
}
