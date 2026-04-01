import { useMemo, useState, useEffect } from "react";
import { getAllCases, saveCase, deleteCase, saveImage, getImagesByEvidence } from "./storage";
import AttachmentPreview from "./components/AttachmentPreview";
import RecordModal from "./components/RecordModal";
import CaseDetail from "./components/CaseDetail";
import FilePreviewModal from "./components/FilePreviewModal";
import { ShieldCheck } from "lucide-react";
const SUPABASE_SYNC_URL = "https://aftbtklrlkccngjiaacv.supabase.co/functions/v1/proveit-upsert-case";
const SUPABASE_SYNC_API_KEY = "proveit-live-read-123456";

/**
 * Safe UUID fallback for insecure contexts or older browsers.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const EMPTY_RECORD_FORM = {
  title: "",
  date: "",
  description: "",
  notes: "",
  attachments: [],
  linkedRecordIds: [],
  linkedIncidentIds: [], // Added for evidence
  linkedEvidenceIds: [], // Added for incidents
  importance: "unreviewed",
  relevance: "medium",
  status: "needs_review",
  usedIn: [],
  reviewNotes: "",
  sourceType: "other",
  capturedAt: "",
  availability: {
    physical: { hasOriginal: false, location: "", notes: "" },
    digital: { hasDigital: false, files: [] }
  },
  createFollowUpTask: false,
  followUpTaskTitle: "",
};

const EMPTY_CAPTURE_FORM = {
  caseId: "",
  title: "",
  date: "",
  note: "",
  attachments: [],
};

async function fileToSerializable(file) {
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
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: generateId(),
        name: file.name,
        type: file.type || "application/octet-stream",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        kind: (file.type || "").startsWith("image/") ? "image" : isEml ? "document" : "other",
        createdAt: new Date().toISOString(),
        dataUrl: reader.result,
        emailMeta,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const normalizeCategory = (value) => {
  const val = (value || "").toLowerCase().trim();
  return val || "general";
};

const normalizeCaseStatus = (value) => {
  const val = (value || "").toLowerCase().trim();
  if (["open", "closed", "archived"].includes(val)) return val;
  return "open";
};

const normalizeRecordStatus = (value, recordType) => {
  const val = (value || "").toLowerCase().trim();
  const type = (recordType || "").toLowerCase().trim();
  if (type === "tasks") {
    return val === "done" ? "done" : "open";
  }
  return val === "archived" ? "archived" : "open";
};

const normalizeQuickCaptureStatus = (value) => {
  const val = (value || "").toLowerCase().trim();
  if (["unreviewed", "converted", "archived"].includes(val)) return val;
  return "unreviewed";
};

/**
 * Validates and normalizes a date string to YYYY-MM-DD.
 */
function getSafeDate(val) {
  if (!val || typeof val !== 'string') return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Determines if a record type is timeline-capable (incident, evidence, strategy/note).
 */
function isTimelineCapable(recordType) {
  const type = (recordType || "").toLowerCase();
  return ["evidence", "incidents", "strategy"].includes(type);
}

/**
 * Normalizes timeline-specific fields with priority-based fallback logic.
 */
function normalizeTimelineFields(item) {
  const createdAt = item?.createdAt || new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  // Priority: 1. eventDate, 2. date, 3. incidentDate, 4. createdAt part, 5. today
  const eventDate = getSafeDate(item?.eventDate) ||
                    getSafeDate(item?.date) ||
                    getSafeDate(item?.incidentDate) ||
                    (item?.createdAt ? item.createdAt.split('T')[0] : today);

  return {
    eventDate,
    createdAt,
    updatedAt: item?.updatedAt || createdAt
  };
}

/**
 * TASK 1: Shared sorting helper for timeline-capable items.
 * Sorts ascending by: eventDate, createdAt, then id.
 */
function sortTimelineItems(items) {
  return [...items].sort((a, b) => {
    const dateA = a.eventDate || "";
    const dateB = b.eventDate || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const createdA = a.createdAt || "";
    const createdB = b.createdAt || "";
    if (createdA !== createdB) return createdA.localeCompare(createdB);

    return (a.id || "").localeCompare(b.id || "");
  });
}

function normalizeRecord(item, recordType) {
  const base = {
    id: item?.id || generateId(),
    type: recordType || item?.type || "unknown",
    title: item?.title || "",
    date: item?.date || new Date().toISOString().slice(0, 10),
    description: item?.description || "",
    notes: item?.notes || "",
    attachments: Array.isArray(item?.attachments) ? item.attachments : [],
    tags: Array.isArray(item?.tags) ? item.tags : [],
    linkedRecordIds: Array.isArray(item?.linkedRecordIds) ? item.linkedRecordIds : [],
    linkedIncidentIds: Array.isArray(item?.linkedIncidentIds) ? item.linkedIncidentIds : [], // For evidence
    linkedEvidenceIds: Array.isArray(item?.linkedEvidenceIds) ? item.linkedEvidenceIds : [], // For incidents
    status: normalizeRecordStatus(item?.status, recordType),
    source: item?.source || "manual",
    edited: !!item?.edited,
  };

  if (recordType === "evidence") {
    const avail = item?.availability || {};
    return {
      ...base,
      sourceType: item?.sourceType || "other",
      capturedAt: item?.capturedAt || item?.date || base.date,
      importance: item?.importance || "unreviewed",
      relevance: item?.relevance || "medium",
      status: ["verified", "needs_review", "incomplete"].includes(item?.status) ? item.status : "needs_review",
      usedIn: Array.isArray(item?.usedIn) ? item.usedIn : [],
      reviewNotes: item?.reviewNotes || "",
      // linkedIncidentIds is now handled in base, no need to re-add here
      availability: { 
        physical: {
          hasOriginal: !!avail.physical?.hasOriginal,
          location: avail.physical?.location || "",
          notes: avail.physical?.notes || "",
        },
        digital: {
          hasDigital: !!avail.digital?.hasDigital || base.attachments.length > 0,
          files: Array.isArray(avail.digital?.files) ? avail.digital?.files : base.attachments,
        }
      }
    };
  }

  if (isTimelineCapable(recordType)) {
    const timelineData = normalizeTimelineFields(item);
    return { ...base, ...timelineData };
  }

  return {
    ...base,
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
  };
}

function normalizeCase(caseItem) {
  const evidence = Array.isArray(caseItem?.evidence) ? caseItem.evidence.map(r => normalizeRecord(r, "evidence")) : [];
  const incidents = Array.isArray(caseItem?.incidents) ? caseItem.incidents.map(r => normalizeRecord(r, "incidents")) : [];
  const tasks = Array.isArray(caseItem?.tasks) ? caseItem.tasks.map(r => normalizeRecord(r, "tasks")) : [];
  const strategy = Array.isArray(caseItem?.strategy) ? caseItem.strategy.map(r => normalizeRecord(r, "strategy")) : [];

  return {
    id: caseItem?.id || generateId(),
    name: caseItem?.name || "Imported Case",
    category: normalizeCategory(caseItem?.category),
    status: normalizeCaseStatus(caseItem?.status),
    notes: caseItem?.notes || "",
    description: caseItem?.description || "",
    tags: Array.isArray(caseItem?.tags) ? caseItem.tags : [],
    createdAt: caseItem?.createdAt || new Date().toISOString(),
    updatedAt: caseItem?.updatedAt || new Date().toISOString(),
    evidence: sortTimelineItems(evidence),
    incidents: sortTimelineItems(incidents),
    tasks: tasks,
    strategy: sortTimelineItems(strategy),
  };
}

function mergeRecords(existingRecords = [], incomingRecords = [], recordType) {
  const recordMap = new Map(existingRecords.map(r => [r.id, r]));
  for (const incomingRecord of incomingRecords) {
    if (recordMap.has(incomingRecord.id)) {
      const existingRecord = recordMap.get(incomingRecord.id);
      recordMap.set(incomingRecord.id, normalizeRecord({ ...existingRecord, ...incomingRecord }, recordType));
    } else {
      recordMap.set(incomingRecord.id, normalizeRecord(incomingRecord, recordType));
    }
  }
  const merged = Array.from(recordMap.values());
  return isTimelineCapable(recordType) ? sortTimelineItems(merged) : merged;
}

function mergeCase(existingCase, incomingCase) {
  const nExisting = normalizeCase(existingCase);
  const nIncoming = normalizeCase(incomingCase);

  return {
    ...nExisting,
    ...nIncoming,
    name: nIncoming.name || nExisting.name || "Imported Case",
    category: normalizeCategory(nIncoming.category || nExisting.category),
    status: normalizeCaseStatus(nIncoming.status || nExisting.status),
    notes: nIncoming.notes || nExisting.notes || "",
    description: nIncoming.description || nExisting.description || "",
    tags: Array.from(new Set([...nExisting.tags, ...nIncoming.tags])),
    createdAt: nExisting.createdAt || nIncoming.createdAt || new Date().toISOString(),
    updatedAt: nIncoming.updatedAt || nExisting.updatedAt || new Date().toISOString(),
    evidence: mergeRecords(nExisting.evidence, nIncoming.evidence, "evidence"),
    incidents: mergeRecords(nExisting.incidents, nIncoming.incidents, "incidents"),
    tasks: mergeRecords(nExisting.tasks, nIncoming.tasks, "tasks"),
    strategy: mergeRecords(nExisting.strategy, nIncoming.strategy, "strategy"),
  };
}

/**
 * Syncs bi-directional links between Incidents and Evidence items.
 */
function syncCaseLinks(caseData, record, type) {
  const updatedCase = { ...caseData };
  if (!record.id) return updatedCase;

  if (type === "incidents") {
    updatedCase.evidence = sortTimelineItems((updatedCase.evidence || []).map(ev => {
      const shouldBeLinked = (record.linkedEvidenceIds || []).includes(ev.id);
      const isCurrentlyLinked = (ev.linkedIncidentIds || []).includes(record.id);

      if (shouldBeLinked && !isCurrentlyLinked) {
        return { ...ev, linkedIncidentIds: [...(ev.linkedIncidentIds || []), record.id], updatedAt: new Date().toISOString() };
      } else if (!shouldBeLinked && isCurrentlyLinked) {
        return { ...ev, linkedIncidentIds: (ev.linkedIncidentIds || []).filter(id => id !== record.id), updatedAt: new Date().toISOString() };
      }
      return ev;
    }));
  } else if (type === "evidence") {
    updatedCase.incidents = sortTimelineItems((updatedCase.incidents || []).map(inc => {
      const shouldBeLinked = (record.linkedIncidentIds || []).includes(inc.id);
      const isCurrentlyLinked = (inc.linkedEvidenceIds || []).includes(record.id);

      if (shouldBeLinked && !isCurrentlyLinked) {
        return { ...inc, linkedEvidenceIds: [...(inc.linkedEvidenceIds || []), record.id], updatedAt: new Date().toISOString() };
      } else if (!shouldBeLinked && isCurrentlyLinked) {
        return { ...inc, linkedEvidenceIds: (inc.linkedEvidenceIds || []).filter(id => id !== record.id), updatedAt: new Date().toISOString() };
      }
      return inc;
    }));
  }
  return updatedCase;
}

async function syncCaseToSupabase(caseItem) {
  const payload = {
    id: caseItem.id,
    name: caseItem.name || "",
    type: caseItem.category || "general",
    status: caseItem.status || "open",
    priority: caseItem.priority || "medium",
    snapshot: {
      case: {
        id: caseItem.id,
        name: caseItem.name || "",
        type: caseItem.category || "general",
        status: caseItem.status || "open",
        priority: caseItem.priority || "medium",
      },
      summary: {
        oneParagraph: caseItem.description || caseItem.notes || "Snapshot",
      },
      keyFacts: (caseItem.incidents || [])
        .slice(0, 6)
        .map((item) => item.title)
        .filter(Boolean),
      recentIncidents: (caseItem.incidents || [])
        .slice()
        .sort((a, b) => new Date(b.date || b.eventDate || 0) - new Date(a.date || a.eventDate || 0))
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          title: item.title || "",
          date: item.date || item.eventDate || "",
          description: item.description || "",
          status: item.status || "open",
        })),
      openTasks: (caseItem.tasks || [])
        .filter((task) => task.status !== "done")
        .slice(0, 10)
        .map((task) => ({
          id: task.id,
          title: task.title || "",
          description: task.description || "",
          status: task.status || "open",
          priority: task.priority || "medium",
        })),
      strategy: (caseItem.strategy || [])
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          title: item.title || "",
          description: item.description || "",
          status: item.status || "open",
        })),
      evidenceSummary: (caseItem.evidence || [])
        .slice(0, 12)
        .map((item) => ({
          id: item.id,
          title: item.title || "",
          description: item.description || "",
          notes: item.notes || "",
          status: item.status || "",
          sourceType: item.sourceType || "",
          importance: item.importance || "",
          relevance: item.relevance || "",
          attachmentCount: Array.isArray(item.attachments) ? item.attachments.length : 0,
          digitalFileCount: Array.isArray(item?.availability?.digital?.files)
            ? item.availability.digital.files.length
            : 0,
        })),
    },
  };

  const response = await fetch(SUPABASE_SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": SUPABASE_SYNC_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const returnedData = await response.json();
  if (!response.ok) {
    throw new Error(`Sync to Supabase failed: ${response.status} ${response.statusText}`);
  }

  console.log("sync success", returnedData);
  return returnedData;
}

async function exportFullCaseToSupabase(caseItem) {
  try {
    const lightCaseItem = {
  ...caseItem,
  attachments: [],
  files: [],
  emails: [],
  evidence: Array.isArray(caseItem.evidence)
    ? caseItem.evidence.map((e) => ({
        ...e,
        attachments: [], // 🔴 THIS is the key fix
      }))
    : [],
};

    console.log("Full export sizes", {
      original: JSON.stringify(caseItem).length,
      light: JSON.stringify(lightCaseItem).length,
    });

    const response = await fetch(
      "https://aftbtklrlkccngjiaacv.supabase.co/functions/v1/export-full-case",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer sb_publishable_jVKAQYEpeh1G5MY1yRvPJA_iYUUCPFy",
          "apikey": "sb_publishable_jVKAQYEpeh1G5MY1yRvPJA_iYUUCPFy",
          "x-api-key": SUPABASE_SYNC_API_KEY,
        },
        body: JSON.stringify({
          case_id: caseItem.id,
          exported_at: new Date().toISOString(),
          case_json: lightCaseItem,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Full case export failed: ${response.status}`);
    }

    console.log("full case export success", data);
    return data;

  } catch (err) {
    console.error("Full case export failed", err);
    throw err;
  }
}

export default function ProveItApp() {
  const STORAGE_KEY = "toolstack.proveit.v1";
  
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [editingCase, setEditingCase] = useState(null);
  const [imageCache, setImageCache] = useState({});
  const [previewFile, setPreviewFile] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);

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
      return saved || "overview";
    } catch {
      return "overview";
    }
  });
  const [assignRecordType, setAssignRecordType] = useState(null);
  const [recordType, setRecordType] = useState(null);
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD_FORM);
  const [editingRecord, setEditingRecord] = useState(null);
  const [parentRecordForNewChild, setParentRecordForNewChild] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle, syncing, success, error
  const [syncMessage, setSyncMessage] = useState("");

  const [fullCaseExportStatus, setFullCaseExportStatus] = useState("idle"); // idle, exporting, success, error
  const [fullCaseExportMessage, setFullCaseExportMessage] = useState("");

  const handleExportFullCase = async () => {
    if (!selectedCase) return;
    setFullCaseExportStatus("exporting");
    setFullCaseExportMessage("Preparing full case export...");
    try {
      await exportFullCaseToSupabase(selectedCase);
      setFullCaseExportStatus("success");
      setFullCaseExportMessage("Full case exported successfully");
    } catch (error) {
      console.error("Full case export failed", error);
      setFullCaseExportStatus("error");
      setFullCaseExportMessage(error.message || "Export failed");
    }
  };

  const handleSyncToSupabase = async () => {
    if (!selectedCase) return;
    setSyncStatus("syncing");
    setSyncMessage("Connecting to Supabase...");
    try {
      await syncCaseToSupabase(selectedCase);
      setSyncStatus("success");
      setSyncMessage("Case synced successfully");
    } catch (error) {
      console.error("Sync failed", error);
      setSyncStatus("error");
      setSyncMessage(error.message || "Sync failed");
    }
  };

  useEffect(() => {
    setSyncStatus("idle");
    setSyncMessage("");
    setFullCaseExportStatus("idle");
    setFullCaseExportMessage("");
  }, [selectedCaseId]);

  const [quickCaptures, setQuickCaptures] = useState(() => {
    try {
      const saved = localStorage.getItem("toolstack.proveit.v1.captures");
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed.map((item) => ({
        ...item,
        source: item.source || "manual",
        status: normalizeQuickCaptureStatus(item.status),
        convertedTo: item.convertedTo || null,
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  });
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const reviewQueue = quickCaptures.filter((item) => item.status === "unreviewed");
  const [captureForm, setCaptureForm] = useState(EMPTY_CAPTURE_FORM);
  const [form, setForm] = useState({ name: "", category: "general", customCategory: "", notes: "", description: "" });

  const quickActions = [
    { label: "Quick Capture" },
    { label: "Export" },
    { label: "Import" },
    { label: "Add Task" },
    { label: "Add Strategy" },
  ];

  const setupSteps = [
    { step: "1", title: "Create your first case", text: "Start with one case file using a generic template or create your own custom case from scratch." },
    { step: "2", title: "Add core records", text: "Add your first evidence, incident, task, or strategy note. Upload a phone photo, PDF, screenshot, or document." },
    { step: "3", title: "Use Quick Capture daily", text: "When something happens, save it fast. Review and classify it later." },
    { step: "4", title: "Build your case pack", text: "Mark important evidence and incidents for the printable Pack view." },
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
    { id: "tasks", label: "Tasks" },
    { id: "strategy", label: "Strategy" },
    { id: "timeline", label: "Timeline" },
    { id: "pack", label: "Pack" },
  ];

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  );

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
      const newCache = {};
      
      if (selectedCase) {
        const allRecords = [
          ...(selectedCase.evidence || []),
          ...(selectedCase.incidents || []),
          ...(selectedCase.tasks || []),
          ...(selectedCase.strategy || []),
        ];
        for (const record of allRecords) {
          try {
            const images = await getImagesByEvidence(record.id);
            if (images && images.length > 0) {
              images.forEach(img => { newCache[img.id] = img; });
            }
          } catch (error) {
            console.error("Failed to load images for record", record.id, error);
          }
        }
      }

      for (const capture of reviewQueue) {
        try {
          const images = await getImagesByEvidence(capture.id);
          if (images && images.length > 0) {
            images.forEach(img => { newCache[img.id] = img; });
          }
        } catch (error) {
          console.error("Failed to load images for capture", capture.id, error);
        }
      }

      setImageCache((prev) => ({ ...prev, ...newCache }));
    }

    loadAllImages();
  }, [selectedCaseId, selectedCase, reviewQueue.length]);

  useEffect(() => {
    localStorage.setItem("toolstack.proveit.v1.captures", JSON.stringify(quickCaptures));
  }, [quickCaptures]);

  useEffect(() => {
    localStorage.setItem("toolstack.proveit.v1.selectedCase", JSON.stringify(selectedCaseId));
  }, [selectedCaseId]);

  useEffect(() => {
    localStorage.setItem("toolstack.proveit.v1.activeTab", activeTab);
  }, [activeTab]);

  const exportData = () => {
    try {
      const payload = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        app: "proveit",
        storageKey: "toolstack.proveit.v1",
        data: {
          cases,
          quickCaptures,
          selectedCaseId,
          activeTab,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proveit-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const exportSelectedCase = () => {
    if (!selectedCase) return;

    try {
      const payload = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        app: "proveit",
        storageKey: "toolstack.proveit.v1",
        data: {
          cases: [selectedCase],
          quickCaptures: [],
          selectedCaseId: selectedCase.id,
          activeTab: "overview",
        },
      };
      const safeName = selectedCase.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const dateStr = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proveit-case-${safeName}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export case failed", error);
    }
  };

  const exportCaseSnapshot = (caseId, mode = "compact") => {
    const c = cases.find((item) => item.id === caseId);
    if (!c) return;

    const limits = mode === "compact" ? { timeline: 5, facts: 8, tasks: 8 } : { timeline: 12, facts: 12, tasks: 12 };

    const mapImportance = (val) => {
      const v = String(val || "").toLowerCase();
      if (v === "critical") return "high";
      if (v === "strong") return "medium";
      return "low";
    };

    const timeline = sortTimelineItems([...c.incidents, ...c.evidence])
      .reverse()
      .slice(0, limits.timeline)
      .map(t => ({
        date: t.eventDate || t.date,
        title: t.title,
        description: t.description ? t.description.substring(0, 300) : ""
      }));

    const openTasks = (c.tasks || [])
      .filter(t => t.status !== "done")
      .slice(0, limits.tasks)
      .map(t => ({
        title: t.title,
        status: t.status,
        priority: "medium"
      }));

    const activeIssues = [...c.incidents, ...c.evidence]
      .filter(i => (i.status !== "verified" && i.status !== "archived") || i.importance === "critical")
      .slice(0, limits.facts)
      .map(i => ({
        id: i.id,
        title: i.title,
        status: i.status,
        importance: mapImportance(i.importance),
        summary: (i.description || i.notes || "").substring(0, 200)
      }));

    const snapshot = {
      format: "proveit-chatgpt-case-snapshot",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      case: {
        id: c.id,
        name: c.name,
        type: c.category,
        status: c.status,
        priority: "medium",
        lastUpdated: c.updatedAt || c.createdAt
      },
      summary: {
        oneParagraph: (c.description || c.notes || "Active case file management.").substring(0, 500),
        currentPosition: [
          `Case involves ${c.incidents.length} documented incidents.`,
          `Current collection includes ${c.evidence.length} evidence items.`,
          `${openTasks.length} tasks currently pending action.`
        ]
      },
      keyFacts: c.strategy.length > 0 ? c.strategy.slice(0, limits.facts).map(s => s.title) : c.incidents.slice(0, limits.facts).map(i => i.title),
      activeIssues,
      recentTimeline: timeline,
      openTasks,
      strategy: {
        current: c.strategy.map(s => s.title).slice(0, 5),
        nextMoves: openTasks.map(t => t.title).slice(0, 3)
      },
      evidenceSummary: c.evidence.map(e => e.title),
      importantPeople: [],
      openQuestions: []
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.name}-chatgpt-snapshot-${mode}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parsed?.data || parsed;

      if (!imported || !Array.isArray(imported.cases) || !Array.isArray(imported.quickCaptures)) {
        alert("Invalid import file.");
        event.target.value = "";
        return;
      }

      const normalizedCases = (imported.cases || []).map(normalizeCase);
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

      for (const caseItem of mergedCases) {
        await saveCase(caseItem);
      }

      setCases(mergedCases);
      setQuickCaptures((imported.quickCaptures || []).map(q => ({
        ...q,
        source: q.source || "manual",
        updatedAt: q.updatedAt || q.createdAt || new Date().toISOString(),
        status: normalizeQuickCaptureStatus(q.status),
        convertedTo: q.convertedTo || null,
        attachments: Array.isArray(q.attachments) ? q.attachments : [],
      })));
      setSelectedCaseId(imported.selectedCaseId ?? null);
      setActiveTab(imported.activeTab || "overview");
    } catch (error) {
      console.error("Import failed", error);
      alert("Could not import this file.");
    }

    event.target.value = "";
  };

  const createDefaultCase = async () => {
    const newCase = {
      id: generateId(),
      name: `New Case ${cases.length + 1}`,
      category: "general",
      status: "open",
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
      }
    } else {
      const newCase = {
        id: generateId(),
        name: form.name || `New Case ${cases.length + 1}`,
        category: normalizeCategory(form.category === "custom" ? form.customCategory : form.category),
        status: "open",
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
      }
    }
  };

  const handleDeleteCase = async (caseId) => {
    if (window.confirm("Delete this case and all linked evidence?")) {
      try {
        await deleteCase(caseId);
        setCases((prev) => prev.filter((c) => c.id !== caseId));
        if (selectedCaseId === caseId) {
          setSelectedCaseId(null);
        }
      } catch (error) {
        console.error("Failed to delete case", error);
      }
    }
  };

  const deleteRecord = async (recordType, recordId) => {
    if (!selectedCase) return;

    if (window.confirm("Delete this record permanently?")) {
      const updatedCase = {
        ...selectedCase,
        [recordType]: selectedCase[recordType].filter((r) => r.id !== recordId),
        updatedAt: new Date().toISOString(),
      };

      setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updatedCase : c)));
      try {
        await saveCase(updatedCase);
      } catch (error) {
        console.error("Failed to save updated case", error);
      }
    }
  };

  const openStarterCase = (starter) => {
    // Redirect starter cases to use handleAddCase directly for now
    createDefaultCase();
  };

  const openCase = (caseId) => {
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
    setRecordType(type);
    setEditingRecord(null);
    setRecordForm({ 
      ...EMPTY_RECORD_FORM, 
      date: new Date().toISOString().slice(0, 10),
      capturedAt: new Date().toISOString().slice(0, 10),
      ...initialFormState
    });
  };

  const openEditRecordModal = (type, item) => {
  setRecordForm({
    ...EMPTY_RECORD_FORM,
    ...item,
    attachments: (item.attachments?.length ? item.attachments : null) || (item.files?.length ? item.files : null) || (type === "evidence" ? item.availability?.digital?.files : []) || [],
    files: (item.files?.length ? item.files : null) || (type === "evidence" ? item.availability?.digital?.files : []) || [],
  });
  setRecordType(type);
  setEditingRecord(item);
  };

  const closeRecordModal = () => {
    setRecordType(null);
    setEditingRecord(null);
    setRecordForm(EMPTY_RECORD_FORM);
    setParentRecordForNewChild(null);
  };

  const openQuickCapture = () => {
    setCaptureForm({
      caseId: selectedCase ? String(selectedCase.id) : cases[0] ? String(cases[0].id) : "",
      title: "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
      attachments: [],
    });
    setShowQuickCapture(true);
  };

  const closeQuickCapture = () => {
    setShowQuickCapture(false);
    setCaptureForm(EMPTY_CAPTURE_FORM);
  };

  const handleRecordFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    const serializable = await Promise.all(files.map(fileToSerializable));
    setRecordForm((prev) => {
      const updatedAttachments = [...prev.attachments, ...serializable];
      const newState = { ...prev, attachments: updatedAttachments };

      if (recordType === "evidence") {
        newState.availability = {
          ...(prev.availability || EMPTY_RECORD_FORM.availability),
          digital: {
            ...(prev.availability?.digital || EMPTY_RECORD_FORM.availability.digital),
            hasDigital: true,
            files: updatedAttachments
          }
        };
      }
      return newState;
    });
    event.target.value = "";
  };

  const handleCaptureFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    const serializable = await Promise.all(files.map(fileToSerializable));
    setCaptureForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...serializable] }));
    event.target.value = "";
  };

  const removeRecordAttachment = (attachmentId) => {
    setRecordForm((prev) => {
      const updatedAttachments = prev.attachments.filter((file) => file.id !== attachmentId);
      
      if (recordType === "evidence" && updatedAttachments.length === 0 && prev.availability?.digital?.hasDigital) {
        if (!window.confirm("Removing the last file. Mark digital copy as unavailable?")) {
          return prev;
        }
      }

      const newState = { ...prev, attachments: updatedAttachments };

      if (recordType === "evidence") {
        newState.availability = {
          ...(prev.availability || EMPTY_RECORD_FORM.availability),
          digital: {
            ...(prev.availability?.digital || EMPTY_RECORD_FORM.availability.digital),
            files: updatedAttachments,
            hasDigital: updatedAttachments.length > 0
          }
        };
      }
      return newState;
    });
  };

  const removeCaptureAttachment = (attachmentId) => {
    setCaptureForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((file) => file.id !== attachmentId),
    }));
  };

  const removeEvidenceFile = (attachmentId) => {
    const currentFiles = recordForm.attachments.filter(a => a.id !== attachmentId);
    const existingFilesCount = (editingRecord?.availability?.digital?.files?.length || 0);
    if (currentFiles.length === 0 && existingFilesCount === 0 && recordForm.availability.digital.hasDigital) {
      if (!window.confirm("Removing the last file. Mark digital copy as unavailable?")) return;
      setRecordForm(prev => ({ ...prev, availability: { ...prev.availability, digital: { ...prev.digital, hasDigital: false } } }));
    }
    removeRecordAttachment(attachmentId);
  };

  const toggleTaskStatus = async (taskId) => {
    if (!selectedCase) return;

    const updatedTasks = (selectedCase.tasks || []).map((task) => {
      if (task.id === taskId) {
        return {
          ...task,
          status: task.status === "done" ? "open" : "done",
          updatedAt: new Date().toISOString(),
          edited: true,
        };
      }
      return task;
    });

    const updatedCase = {
      ...selectedCase,
      tasks: updatedTasks,
      updatedAt: new Date().toISOString(),
    };

    setCases((prev) =>
      prev.map((c) =>
        c.id === selectedCase.id ? updatedCase : c
      )
    );

    try {
      await saveCase(updatedCase);
    } catch (error) {
      console.error("Failed to save updated case", error);
    }
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

    setCases(prev => prev.map(c => c.id === selectedCase.id ? updatedCase : c));
    try {
      await saveCase(updatedCase);
      openEditRecordModal("incidents", updatedIncident);
    } catch (error) {
      console.error("Failed to unlink evidence", error);
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

  const saveRecord = async () => {
    if (!selectedCase || !recordType || !recordForm.title.trim()) return;
    
    let updatedCase;

    if (editingRecord) {
      let updatedAttachments = recordForm.attachments;
      let updatedAvailability = { ...recordForm.availability };

      // If not evidence, we still use external storage logic for now
      // But for evidence, we embed the serializable files
      if (recordType !== "evidence") {
        const newAttachmentObjects = [];
        for (const att of recordForm.attachments) {
          if (att.storageRef) {
            newAttachmentObjects.push(att);
            continue;
          }
          const imageId = generateId();
          await saveImage({
            id: imageId,
            evidenceId: editingRecord.id,
            caseId: selectedCase.id,
            fileName: att.name,
            mimeType: att.type,
            blob: att.file || att,
            createdAt: new Date().toISOString(),
          });
          newAttachmentObjects.push({ ...att, storageRef: imageId });
        }
        updatedAttachments = newAttachmentObjects;
      } else {
        updatedAvailability.digital.files = updatedAttachments;
        updatedAvailability.digital.hasDigital = updatedAttachments.length > 0;
      }

      const updatedRecord = normalizeRecord({
        ...editingRecord,
        title: recordForm.title.trim(),
        date: recordForm.date || new Date().toISOString().slice(0, 10),
        description: recordForm.description.trim(),
        notes: recordForm.notes.trim(),
        sourceType: recordForm.sourceType,
        capturedAt: recordForm.capturedAt,
        availability: updatedAvailability,
        attachments: updatedAttachments,
        importance: recordForm.importance,
        relevance: recordForm.relevance,
        status: recordForm.status,
        usedIn: recordForm.usedIn,
        reviewNotes: recordForm.reviewNotes,
        linkedIncidentIds: recordForm.linkedIncidentIds, // Explicitly pass from form
        linkedEvidenceIds: recordForm.linkedEvidenceIds, // Explicitly pass from form
        updatedAt: new Date().toISOString(),
        edited: true,
      }, recordType);

      const updatedList = selectedCase[recordType].map((rec) =>
        rec.id === editingRecord.id ? updatedRecord : rec
      );

      updatedCase = {
        ...selectedCase,
        [recordType]: isTimelineCapable(recordType) ? sortTimelineItems(updatedList) : updatedList,
        updatedAt: new Date().toISOString(),
      };

      updatedCase = syncCaseLinks(updatedCase, updatedRecord, recordType);

      // Prompt to close linked tasks when evidence is saved (Edit mode)
      if (recordType === "evidence") {
        const linkedIds = updatedRecord.linkedRecordIds || [];
        const openTasks = (updatedCase.tasks || []).filter(t => linkedIds.includes(t.id) && t.status === "open");
        if (openTasks.length > 0) {
          if (window.confirm("Mark linked follow-up task as done?")) {
            updatedCase.tasks = updatedCase.tasks.map(t => 
              linkedIds.includes(t.id) && t.status === "open"
                ? { ...t, status: "done", updatedAt: new Date().toISOString(), edited: true }
                : t
            );
          }
        }
      }
    } else {
      const newRecordId = generateId();
      let attachmentObjects = recordForm.attachments;
      let availability = { ...recordForm.availability };

      // Follow-up task logic for new records
      const followUpTaskId = generateId();
      const needsFollowUp = (recordType === "incidents" || recordType === "evidence") && recordForm.createFollowUpTask;

      if (recordType !== "evidence") {
        const savedObjects = [];
        for (const att of recordForm.attachments) {
          const imageId = generateId();
          await saveImage({
            id: imageId,
            evidenceId: newRecordId,
            caseId: selectedCase.id,
            fileName: att.name,
            mimeType: att.type,
            blob: att.file || att,
            createdAt: new Date().toISOString(),
          });
          savedObjects.push({ ...att, storageRef: imageId });
        }
        attachmentObjects = savedObjects;
      } else {
        availability.digital.files = attachmentObjects;
        availability.digital.hasDigital = attachmentObjects.length > 0;
      }

      const newRecord = normalizeRecord({
        id: newRecordId,
        title: recordForm.title.trim(),
        date: recordForm.date || new Date().toISOString().slice(0, 10),
        description: recordForm.description.trim(),
        notes: recordForm.notes.trim(),
        sourceType: recordForm.sourceType,
        capturedAt: recordForm.capturedAt,
        availability: availability,
        attachments: attachmentObjects,
        importance: recordForm.importance,
        relevance: recordForm.relevance,
        status: recordForm.status,
        usedIn: recordForm.usedIn,
        reviewNotes: recordForm.reviewNotes,
        linkedIncidentIds: recordForm.linkedIncidentIds,
        linkedEvidenceIds: recordForm.linkedEvidenceIds,
        linkedRecordIds: Array.from(new Set([
          ...(recordForm.linkedRecordIds || []),
          ...(needsFollowUp ? [followUpTaskId] : [])
        ])),
        createdAt: new Date().toISOString(),
      }, recordType);

      let updatedTasks = selectedCase.tasks || [];
      if (needsFollowUp) {
        const followUpTask = normalizeRecord({
          id: followUpTaskId,
          type: "tasks",
          title: recordForm.followUpTaskTitle?.trim() || `Follow up: ${recordForm.title.trim()}`,
          date: recordForm.date || new Date().toISOString().slice(0, 10),
          description: `Follow-up task created from ${recordType === "incidents" ? "incident" : "evidence"} record.`,
          status: "open",
          linkedRecordIds: Array.from(new Set([...(recordForm.linkedRecordIds?.filter(id => id.startsWith('task')) || []), newRecordId])),
          source: "manual",
          createdAt: new Date().toISOString(),
        }, "tasks");
        updatedTasks = [followUpTask, ...updatedTasks];
      }

      const updatedList = [newRecord, ...selectedCase[recordType]];

      updatedCase = {
        ...selectedCase,
        [recordType]: isTimelineCapable(recordType) ? sortTimelineItems(updatedList) : updatedList,
        updatedAt: new Date().toISOString(),
      };

      // Only update the tasks list if a follow-up task was requested and we aren't 
      // already saving a task (to avoid overwriting the new task list).
      if (needsFollowUp && recordType !== "tasks") {
        updatedCase.tasks = updatedTasks;
      }

      updatedCase = syncCaseLinks(updatedCase, newRecord, recordType);

      // Prompt to close linked tasks when evidence is added (New record mode)
      if (recordType === "evidence") {
        const linkedIds = newRecord.linkedRecordIds || [];
        // Exclude the follow-up task created in this same step if any
        const openTasks = (updatedCase.tasks || []).filter(t => 
          linkedIds.includes(t.id) && t.status === "open" && t.id !== (needsFollowUp ? followUpTaskId : null)
        );
        if (openTasks.length > 0) {
          if (window.confirm("Mark linked follow-up task as done?")) {
            updatedCase.tasks = updatedCase.tasks.map(t => 
              linkedIds.includes(t.id) && t.status === "open" && t.id !== (needsFollowUp ? followUpTaskId : null)
                ? { ...t, status: "done", updatedAt: new Date().toISOString(), edited: true }
                : t
            );
          }
        }
      }
    }

    setCases((prev) =>
      prev.map((c) =>
        c.id === selectedCase.id ? updatedCase : c
      )
    );

    try {
      await saveCase(updatedCase);
    } catch (error) {
      console.error("Failed to save updated case", error);
    }

    // If we were creating evidence from an incident, prepare to return to the incident view
    const isEvidenceFromIncident = recordType === "evidence" && parentRecordForNewChild;
    const parentToReopen = isEvidenceFromIncident ? updatedCase.incidents.find(inc => inc.id === parentRecordForNewChild.id) : null;

    if (recordType === "evidence") setActiveTab("evidence");
    if (recordType === "incidents") setActiveTab("incidents");
    if (recordType === "tasks") setActiveTab("tasks");
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

    const newCaptureId = crypto.randomUUID();
    const newCapture = {
      id: newCaptureId,
      caseId: selectedCaptureCase.id,
      caseName: selectedCaptureCase.name,
      title: captureForm.title.trim(),
      date: captureForm.date || new Date().toISOString().slice(0, 10),
      note: captureForm.note.trim(),
      attachments: captureForm.attachments,
      status: "unreviewed",
      convertedTo: null,
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setQuickCaptures((prev) => [newCapture, ...prev]);
    closeQuickCapture();
  };

  const convertCapture = async (captureId, targetType) => {
    const capture = quickCaptures.find((item) => item.id === captureId);
    if (!capture) return;

    const newRecordId = crypto.randomUUID();

    const newRecord = normalizeRecord({
      id: newRecordId,
      title: capture.title,
      date: capture.date,
      description: capture.note,
      notes: `Converted from Quick Capture on ${new Date().toLocaleDateString()}`,
      attachments: capture.attachments || [],
      createdAt: new Date().toISOString(),
    }, targetType);

    const caseToUpdate = cases.find(c => c.id === capture.caseId);
    
    if (caseToUpdate) {
      const updatedList = [newRecord, ...caseToUpdate[targetType]];
      
      const updatedCase = {
        ...caseToUpdate,
        [targetType]: isTimelineCapable(targetType) ? sortTimelineItems(updatedList) : updatedList,
        updatedAt: new Date().toISOString(),
      };

      setCases((prev) =>
        prev.map((c) =>
          c.id === capture.caseId ? updatedCase : c
        )
      );

      try {
        await saveCase(updatedCase);
      } catch (error) {
        console.error("Failed to save case after conversion", error);
      }
    }

    setQuickCaptures((prev) =>
      prev.map((item) =>
        item.id === captureId ? { ...item, status: "converted", convertedTo: targetType, updatedAt: new Date().toISOString() } : item
      )
    );
  };

  const archiveCapture = (captureId) => {
    setQuickCaptures((prev) =>
      prev.map((item) => (item.id === captureId ? { ...item, status: "archived", updatedAt: new Date().toISOString() } : item))
    );
  };

  const renderEmptyState = () => (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="lg:col-span-8 space-y-6">
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
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Your Cases</h2>
          <button onClick={openCreateCaseModal} className="inline-flex items-center px-3 py-1.5 text-sm rounded-md whitespace-nowrap border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">
            + Create Case
          </button>
        </div>
        {cases.map((c) => (
          <div key={c.id} onClick={() => openCase(c.id)} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm cursor-pointer hover:border-neutral-300">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-neutral-600">{c.category}</div>
              <div className="mt-2 flex gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-1">{c.evidence?.length || 0} Evidence</span>
                <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-1">{c.incidents?.length || 0} Incidents</span>
                <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-1">{c.tasks?.length || 0} Tasks</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); openCase(c.id); }} className="rounded-xl border border-lime-500 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Open
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteCase(c.id); }} 
                className="rounded-xl border border-lime-500 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
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
              attachments={(item.attachments || []).map(att => att.file || imageCache[att.storageRef]).filter(Boolean)} 
              onPreview={setPreviewFile}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => convertCapture(item.id, "evidence")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Save as Evidence</button>
              <button onClick={() => convertCapture(item.id, "incidents")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Save as Incident</button>
              <button onClick={() => convertCapture(item.id, "tasks")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Save as Task</button>
              <button onClick={() => convertCapture(item.id, "strategy")} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Save as Strategy</button>
              <button onClick={() => archiveCapture(item.id)} className="rounded-xl border border-lime-500 bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Archive</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="relative mb-6 flex flex-col gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-500 text-white shadow-lg shadow-lime-100">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-4xl font-bold tracking-tight text-neutral-900">ProveIt</h1>
                  <span className="rounded-lg bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">v1.0</span>
                </div>
                <p className="text-sm font-medium text-neutral-500">Advanced Evidence Management & Case Engine</p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end">
              <div className="inline-flex items-center gap-2 rounded-full bg-lime-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-lime-700 border border-lime-100">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-500"></span>
                </span>
                Local Storage Active
              </div>
              <p className="mt-1 text-[10px] text-neutral-400">Secure • Browser Only • Offline First</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap border-t border-neutral-100 pt-6">
            {quickActions.map((a) => {
              const isQuick = a.label === "Quick Capture";
              const isExport = a.label === "Export";
              const isImport = a.label === "Import";
              const isTask = a.label === "Add Task";
              const isStrategy = a.label === "Add Strategy";

              if (isImport) {
                return (
                  <label key={a.label} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95 cursor-pointer">
                    {a.label} 
                    <input type="file" accept="application/json,.json" className="hidden" onChange={importData} />
                  </label>
                );
              }

              return (
                <button
                  key={a.label}
                  onClick={
                    isQuick ? openQuickCapture : 
                    isExport ? exportData : 
                    isTask ? () => setAssignRecordType("tasks") :
                    isStrategy ? () => setAssignRecordType("strategy") : undefined
                  }
                  className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </header>

        {loadingCases ? (
          <div className="p-8 text-center text-neutral-500">Loading cases...</div>
        ) : cases.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <CaseDetail
                selectedCase={selectedCase}
                reviewQueue={reviewQueue}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                tabs={tabs}
                imageCache={imageCache}
                setSelectedCaseId={setSelectedCaseId}
                openRecordModal={openRecordModal}
                renderCaseList={renderCaseList}
                openEditRecordModal={openEditRecordModal}
                toggleTaskStatus={toggleTaskStatus}
                openEditCaseModal={openEditCaseModal}
                deleteRecord={deleteRecord}
                exportSelectedCase={exportSelectedCase}
                onExportSnapshot={exportCaseSnapshot}
                onSyncToSupabase={handleSyncToSupabase}
                onExportFullCase={handleExportFullCase}
                syncStatus={syncStatus}
                syncMessage={syncMessage}
                fullCaseExportStatus={fullCaseExportStatus}
                fullCaseExportMessage={fullCaseExportMessage}
                onViewRecord={setViewingRecord}
                onPreviewFile={setPreviewFile}
              />
            </div>
            <aside className="lg:col-span-4 space-y-6">
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
            </aside>
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
          />
        )}

        {assignRecordType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-semibold capitalize">Assign {assignRecordType.slice(0, -1)}</h2>
              <p className="mb-4 text-sm text-neutral-600">Select a case file to add this {assignRecordType.slice(0, -1)} to:</p>
              
              <div className="max-h-60 overflow-y-auto space-y-2 mb-4 pr-1">
                {cases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCaseId(c.id);
                      openRecordModal(assignRecordType);
                      setAssignRecordType(null);
                    }}
                    className="w-full text-left rounded-xl border border-neutral-200 p-3 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{c.category}</div>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setAssignRecordType(null);
                    openCreateCaseModal();
                  }}
                  className="w-full text-left rounded-xl border border-dashed border-lime-500 p-3 hover:bg-lime-50 transition-colors text-lime-700 font-medium"
                >
                  + Create New Case
                </button>
              </div>

              <button onClick={() => setAssignRecordType(null)} className="w-full rounded-xl bg-neutral-100 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200">
                Cancel
              </button>
            </div>
          </div>
        )}

        {showQuickCapture && (
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

        <button onClick={openQuickCapture} className="fixed bottom-6 right-6 rounded-full border border-lime-500 bg-white px-5 py-3 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
          + Quick Capture
        </button>

        {previewFile && (
          <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
        )}
      </div>
    </div>
    );
}