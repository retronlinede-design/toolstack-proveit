import { useMemo, useState, useEffect } from "react";
import { getAllCases, saveCase, deleteCase, saveImage, getImagesByEvidence } from "./storage";
import AttachmentPreview from "./components/AttachmentPreview";
import RecordModal from "./components/RecordModal";
import CaseDetail from "./components/CaseDetail";
import { CircleHelp } from "lucide-react";

const EMPTY_RECORD_FORM = {
  title: "",
  date: "",
  description: "",
  notes: "",
  attachments: [],
};

const EMPTY_CAPTURE_FORM = {
  caseId: "",
  title: "",
  date: "",
  note: "",
  attachments: [],
};

async function fileToAttachment(file) {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    kind: (file.type || "").startsWith("image/") ? "image" : "other",
    source: "upload",
    url: "",
    storageRef: "",
    note: "",
    createdAt: new Date().toISOString(),
    file: file,
  };
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
    id: item?.id || crypto.randomUUID(),
    type: recordType || item?.type || "unknown",
    title: item?.title || "",
    date: item?.date || new Date().toISOString().slice(0, 10),
    description: item?.description || "",
    notes: item?.notes || "",
    attachments: Array.isArray(item?.attachments) ? item.attachments : [],
    tags: Array.isArray(item?.tags) ? item.tags : [],
    linkedRecordIds: Array.isArray(item?.linkedRecordIds) ? item.linkedRecordIds : [],
    status: normalizeRecordStatus(item?.status, recordType),
    source: item?.source || "manual",
    edited: !!item?.edited,
  };

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
    id: caseItem?.id || crypto.randomUUID(),
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

export default function ProveItApp() {
  const STORAGE_KEY = "toolstack.proveit.v1";
  
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [editingCase, setEditingCase] = useState(null);
  const [imageCache, setImageCache] = useState({});

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
      id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
      category: ["general", "personal", "work", "housing", "legal"].includes(caseItem.category.toLowerCase()) ? caseItem.category.toLowerCase() : "custom",
      customCategory: ["general", "personal", "work", "housing", "legal"].includes(caseItem.category.toLowerCase()) ? "" : caseItem.category,
      notes: caseItem.notes,
      description: caseItem.description || "",
    });
    setShowCreate(true);
  };

  const openRecordModal = (type) => {
    setRecordType(type);
    setEditingRecord(null);
    setRecordForm({ ...EMPTY_RECORD_FORM, date: new Date().toISOString().slice(0, 10) });
  };

  const openEditRecordModal = (type, item) => {
    setRecordType(type);
    setEditingRecord(item);
    setRecordForm({
      title: item.title || "",
      date: item.date || new Date().toISOString().slice(0, 10),
      description: item.description || "",
      notes: item.notes || "",
      attachments: [],
    });
  };

  const closeRecordModal = () => {
    setRecordType(null);
    setEditingRecord(null);
    setRecordForm(EMPTY_RECORD_FORM);
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
    const attachments = await Promise.all(files.map(fileToAttachment));
    setRecordForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...attachments] }));
    event.target.value = "";
  };

  const handleCaptureFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    const attachments = await Promise.all(files.map(fileToAttachment));
    setCaptureForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...attachments] }));
    event.target.value = "";
  };

  const removeRecordAttachment = (attachmentId) => {
    setRecordForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((file) => file.id !== attachmentId),
    }));
  };

  const removeCaptureAttachment = (attachmentId) => {
    setCaptureForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((file) => file.id !== attachmentId),
    }));
  };

  const toggleTaskStatus = async (taskId) => {
    if (!selectedCase) return;

    const updatedTasks = selectedCase.tasks.map((task) => {
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

  const saveRecord = async () => {
    if (!selectedCase || !recordType || !recordForm.title.trim()) return;
    
    let updatedCase;

    if (editingRecord) {
      const newAttachmentObjects = [];

      for (const att of recordForm.attachments) {
        const imageId = crypto.randomUUID();
        await saveImage({
          id: imageId,
          evidenceId: editingRecord.id,
          caseId: selectedCase.id,
          fileName: att.name,
          mimeType: att.type,
          blob: att.file || att,
          createdAt: new Date().toISOString(),
        });
        newAttachmentObjects.push({
          id: crypto.randomUUID(),
          name: att.name,
          type: att.type,
          size: att.size,
          kind: (att.type || "").startsWith("image/") ? "image" : "other",
          source: "upload",
          url: "",
          storageRef: imageId,
          note: "",
          createdAt: new Date().toISOString()
        });
      }

      const updatedRecord = normalizeRecord({
        ...editingRecord,
        title: recordForm.title.trim(),
        date: recordForm.date || new Date().toISOString().slice(0, 10),
        description: recordForm.description.trim(),
        notes: recordForm.notes.trim(),
        attachments: [...(editingRecord.attachments || []), ...newAttachmentObjects],
        updatedAt: new Date().toISOString(),
        edited: true,
      });
      
      const updatedList = selectedCase[recordType].map((rec) =>
        rec.id === editingRecord.id ? updatedRecord : rec
      );

      updatedCase = {
        ...selectedCase,
        [recordType]: isTimelineCapable(recordType) ? sortTimelineItems(updatedList) : updatedList,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const newRecordId = crypto.randomUUID();
      const attachmentObjects = [];

      for (const att of recordForm.attachments) {
        const imageId = crypto.randomUUID();
        await saveImage({
          id: imageId,
          evidenceId: newRecordId,
          caseId: selectedCase.id,
          fileName: att.name,
          mimeType: att.type,
          blob: att.file || att,
          createdAt: new Date().toISOString(),
        });
        attachmentObjects.push({
          id: crypto.randomUUID(),
          name: att.name,
          type: att.type,
          size: att.size,
          kind: (att.type || "").startsWith("image/") ? "image" : "other",
          source: "upload",
          url: "",
          storageRef: imageId,
          note: "",
          createdAt: new Date().toISOString()
        });
      }

      const newRecord = normalizeRecord({
        id: newRecordId,
        title: recordForm.title.trim(),
        date: recordForm.date || new Date().toISOString().slice(0, 10),
        description: recordForm.description.trim(),
        notes: recordForm.notes.trim(),
        attachments: attachmentObjects,
        createdAt: new Date().toISOString(),
      });
      
      const updatedList = [newRecord, ...selectedCase[recordType]];

      updatedCase = {
        ...selectedCase,
        [recordType]: isTimelineCapable(recordType) ? sortTimelineItems(updatedList) : updatedList,
        updatedAt: new Date().toISOString(),
      };
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

    if (recordType === "evidence") setActiveTab("evidence");
    if (recordType === "incidents") setActiveTab("incidents");
    if (recordType === "tasks") setActiveTab("tasks");
    if (recordType === "strategy") setActiveTab("strategy");

    closeRecordModal();
  };

  const saveQuickCapture = async () => {
    if (!captureForm.caseId || !captureForm.title.trim()) return;

    const selectedCaptureCase = cases.find((c) => String(c.id) === String(captureForm.caseId));
    if (!selectedCaptureCase) return;

    const newCaptureId = crypto.randomUUID();
    const attachmentObjects = [];

    for (const file of captureForm.attachments) {
      const imageId = crypto.randomUUID();
      await saveImage({
        id: imageId,
        evidenceId: newCaptureId,
        caseId: selectedCaptureCase.id,
        fileName: file.name,
        mimeType: file.type,
        blob: file.file || file,
        createdAt: new Date().toISOString(),
      });
      attachmentObjects.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        kind: (file.type || "").startsWith("image/") ? "image" : "other",
        source: "upload",
        url: "",
        storageRef: imageId,
        note: "",
        createdAt: new Date().toISOString()
      });
    }

    const newCapture = {
      id: newCaptureId,
      caseId: selectedCaptureCase.id,
      caseName: selectedCaptureCase.name,
      title: captureForm.title.trim(),
      date: captureForm.date || new Date().toISOString().slice(0, 10),
      note: captureForm.note.trim(),
      attachments: attachmentObjects,
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
    });

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
          <button onClick={openCreateCaseModal} className="rounded-2xl border border-lime-500 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
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
            <AttachmentPreview attachments={(item.attachments || []).map(att => att.file || imageCache[att.storageRef]).filter(Boolean)} />
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
        <header className="relative mb-6 flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <button className="absolute right-6 top-6 text-neutral-400 hover:text-neutral-600 transition-colors" aria-label="Help">
            <CircleHelp className="h-6 w-6" />
          </button>
          <div>
            <p className="text-sm text-neutral-500">ToolStack • Case Engine</p>
            <h1 className="text-3xl font-semibold">ProveIt</h1>
            <p className="mt-1 text-xs text-neutral-500">Autosaved locally in this browser (no account, no cloud). Use Export regularly for backup.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {quickActions.map((a) => {
              const isQuick = a.label === "Quick Capture";
              const isExport = a.label === "Export";
              const isImport = a.label === "Import";
              const isTask = a.label === "Add Task";
              const isStrategy = a.label === "Add Strategy";

              if (isImport) {
                return (
                  <label key={a.label} className="rounded-2xl border border-lime-500 bg-white px-3 py-2 text-center text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors cursor-pointer">
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
                  className="rounded-2xl border border-lime-500 bg-white px-3 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
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
                <input type="file" multiple className="hidden" onChange={handleCaptureFiles} accept="image/*,application/pdf,.pdf,.doc,.docx,.txt" />
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

        <button onClick={openQuickCapture} className="fixed bottom-6 right-6 rounded-full border border-lime-500 bg-white px-5 py-3 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
          + Quick Capture
        </button>
      </div>
    </div>
  );
}
