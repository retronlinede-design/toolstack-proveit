/**
 * Safe UUID fallback for insecure contexts or older browsers.
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const normalizeCategory = (value) => {
  const val = (value || "").toLowerCase().trim();
  return val || "general";
};

export const normalizeCaseStatus = (value) => {
  const val = (value || "").toLowerCase().trim();
  if (["open", "closed", "archived"].includes(val)) return val;
  return "open";
};

export const normalizeRecordStatus = (value) => {
  const val = (value || "").toLowerCase().trim();
  return val === "archived" ? "archived" : "open";
};

export const normalizeQuickCaptureStatus = (value) => {
  const val = (value || "").toLowerCase().trim();
  if (["unreviewed", "converted", "archived"].includes(val)) return val;
  return "unreviewed";
};

export const normalizeCaseName = (value) => {
  if (typeof value !== "string") return "Imported Case";
  const trimmed = value.trim();
  return trimmed || "Imported Case";
};

export const normalizeGeneratedReportText = (value) => {
  if (typeof value !== "string") return "";
  return value;
};

export const normalizeGeneratedReportVersions = (value, legacyGeneratedReportText = "") => {
  const legacyText = normalizeGeneratedReportText(legacyGeneratedReportText);
  const versions = {
    en: normalizeGeneratedReportText(value?.en),
    de: normalizeGeneratedReportText(value?.de),
  };

  if (!versions.en && legacyText) {
    versions.en = legacyText;
  }

  return versions;
};

export const normalizeActiveGeneratedReportLanguage = (value) => {
  return value === "de" ? "de" : "en";
};

export function normalizeCasePrivacyLock(value) {
  const pin = typeof value?.pin === "string" ? value.pin.trim() : "";
  if (!/^\d{4,6}$/.test(pin)) return null;

  return {
    pin,
    enabledAt: value?.enabledAt || "",
    updatedAt: value?.updatedAt || value?.enabledAt || "",
  };
}

/**
 * Validates and normalizes a date string to YYYY-MM-DD.
 */
export function getSafeDate(val) {
  if (!val || typeof val !== 'string') return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Determines if a record type is timeline-capable (incident, evidence, strategy/note).
 */
export function isTimelineCapable(recordType) {
  const type = (recordType || "").toLowerCase();
  return ["evidence", "incidents", "strategy"].includes(type);
}

export const INCIDENT_LINK_TYPES = ["CAUSES", "RELATED_TO"];

export const EVIDENCE_ROLES = [
  "ANCHOR_EVIDENCE",
  "SUPPORTING_EVIDENCE",
  "TIMELINE_EVIDENCE",
  "MEDICAL_EVIDENCE",
  "COMMUNICATION_EVIDENCE",
  "OPERATIONAL_EVIDENCE",
  "CORROBORATING_EVIDENCE",
  "OTHER",
];

export const INCIDENT_EVIDENCE_STATUSES = [
  "documented",
  "witnessed",
  "contextual",
  "unverified",
  "needs_evidence",
];

export const EVIDENCE_TYPES = [
  "documented",
  "witnessed",
  "observed",
  "verbal",
  "derived",
];

export function normalizeEvidenceRole(value) {
  return EVIDENCE_ROLES.includes(value) ? value : "OTHER";
}

export function normalizeEvidenceType(value, attachments = []) {
  if (EVIDENCE_TYPES.includes(value)) return value;
  return Array.isArray(attachments) && attachments.length > 0 ? "documented" : "observed";
}

export function normalizeIncidentEvidenceStatus(value, linkedEvidenceIds = []) {
  if (INCIDENT_EVIDENCE_STATUSES.includes(value)) return value;
  return normalizeLinkedRecordIds(linkedEvidenceIds).length > 0 ? "documented" : "needs_evidence";
}

export function normalizeIncidentLinkRef(ref) {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return null;
  if (typeof ref.incidentId !== "string") return null;

  const incidentId = ref.incidentId.trim();
  if (!incidentId || !INCIDENT_LINK_TYPES.includes(ref.type)) return null;

  return {
    incidentId,
    type: ref.type,
  };
}

export function normalizeIncidentLinkRefs(refs, currentIncidentId = null) {
  if (!Array.isArray(refs)) return [];

  const seenIncidentIds = new Set();
  return refs.reduce((normalized, ref) => {
    const normalizedRef = normalizeIncidentLinkRef(ref);
    if (!normalizedRef) return normalized;
    if (currentIncidentId && normalizedRef.incidentId === currentIncidentId) return normalized;
    if (seenIncidentIds.has(normalizedRef.incidentId)) return normalized;

    seenIncidentIds.add(normalizedRef.incidentId);
    normalized.push(normalizedRef);
    return normalized;
  }, []);
}

export function normalizeLinkedRecordIds(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  return value.reduce((ids, item) => {
    if (typeof item !== "string") return ids;
    const id = item.trim();
    if (!id || seen.has(id)) return ids;
    seen.add(id);
    ids.push(id);
    return ids;
  }, []);
}

function isTrackingRecordDocument(item) {
  return typeof item?.textContent === "string" && item.textContent.includes("[TRACK RECORD]");
}

function normalizeSequenceGroup(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalizes timeline-specific fields with priority-based fallback logic.
 */
export function normalizeTimelineFields(item) {
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
export function sortTimelineItems(items) {
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

export function normalizeLedgerEntry(item) {
  const expectedAmount = Number(item?.expectedAmount || 0);
  const paidAmount = Number(item?.paidAmount || 0);

  const validLedgerCategories = [
    "rent",
    "installment",
    "deposit",
    "furniture",
    "repair",
    "utility",
    "legal",
    "other"
  ];

  return {
    id: item?.id || generateId(),
    category: validLedgerCategories.includes(item?.category)
      ? item.category
      : "other",
    subType: item?.subType || "",
    label: item?.label || "",
    period: item?.period || "",
    expectedAmount,
    paidAmount,
    differenceAmount: expectedAmount - paidAmount,
    currency: item?.currency || "EUR",
    dueDate: item?.dueDate || "",
    paymentDate: item?.paymentDate || "",
    status: ["planned", "paid", "part-paid", "unpaid", "disputed", "refunded"].includes(item?.status)
      ? item.status
      : "planned",
    method: item?.method || "bank_transfer",
    reference: item?.reference || "",
    counterparty: item?.counterparty || "",
    proofType: item?.proofType || "other",
    proofStatus: ["missing", "partial", "confirmed"].includes(item?.proofStatus)
      ? item.proofStatus
      : "missing",
    notes: item?.notes || "",
    batchLabel: item?.batchLabel || "",
    linkedRecordIds: normalizeLinkedRecordIds(item?.linkedRecordIds),
    edited: !!item?.edited,
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
  };
}

export function normalizeActionSummary(summary) {
  return {
    currentFocus: summary?.currentFocus || "",
    nextActions: Array.isArray(summary?.nextActions) ? summary.nextActions : [],
    importantReminders: Array.isArray(summary?.importantReminders) ? summary.importantReminders : [],
    strategyFocus: Array.isArray(summary?.strategyFocus) ? summary.strategyFocus : [],
    criticalDeadlines: Array.isArray(summary?.criticalDeadlines) ? summary.criticalDeadlines : [],
    updatedAt: summary?.updatedAt || "",
  };
}

export function normalizeDocumentEntry(item) {
  const normalized = {
    id: item?.id || generateId(),
    title: item?.title || "",
    category: item?.category || "other",
    documentDate: item?.documentDate || "",
    source: item?.source || "",
    summary: item?.summary || "",
    textContent: item?.textContent || "",
    attachments: Array.isArray(item?.attachments) ? item.attachments : [],
    linkedRecordIds: normalizeLinkedRecordIds(item?.linkedRecordIds),
    sequenceGroup: normalizeSequenceGroup(item?.sequenceGroup),
    edited: !!item?.edited,
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
  };

  if (isTrackingRecordDocument(normalized)) {
    normalized.basedOnEvidenceIds = normalizeLinkedRecordIds(item?.basedOnEvidenceIds);
  }

  return normalized;
}

export function normalizeRecord(item, recordType) {
  const base = {
    id: item?.id || generateId(),
    type: recordType || item?.type || "unknown",
    title: item?.title || "",
    date: item?.date || new Date().toISOString().slice(0, 10),
    description: item?.description || "",
    notes: item?.notes || "",
    attachments: Array.isArray(item?.attachments) ? item.attachments : [],
    tags: Array.isArray(item?.tags) ? item.tags : [],
    linkedRecordIds: normalizeLinkedRecordIds(item?.linkedRecordIds),
    linkedIncidentIds: normalizeLinkedRecordIds(item?.linkedIncidentIds), // For evidence
    linkedEvidenceIds: normalizeLinkedRecordIds(item?.linkedEvidenceIds), // For incidents
    status: normalizeRecordStatus(item?.status, recordType),
    source: item?.source || "manual",
    edited: !!item?.edited,
  };

  if (recordType === "evidence") {
    const avail = item?.availability || {};
    const timelineData = normalizeTimelineFields(item);
    return {
      ...base,
      ...timelineData,
      isMilestone: !!item?.isMilestone,
      sourceType: item?.sourceType || "other",
      capturedAt: item?.capturedAt || item?.date || base.date,
      importance: item?.importance || "unreviewed",
      relevance: item?.relevance || "medium",
      status: ["verified", "needs_review", "incomplete"].includes(item?.status) ? item.status : "needs_review",
      usedIn: Array.isArray(item?.usedIn) ? item.usedIn : [],
      reviewNotes: item?.reviewNotes || "",
      evidenceRole: normalizeEvidenceRole(item?.evidenceRole),
      evidenceType: normalizeEvidenceType(item?.evidenceType, base.attachments),
      sequenceGroup: normalizeSequenceGroup(item?.sequenceGroup),
      functionSummary: typeof item?.functionSummary === "string" ? item.functionSummary.trim() : "",
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

  if (recordType === "incidents") {
    const timelineData = normalizeTimelineFields(item);
    return {
      ...base,
      ...timelineData,
      isMilestone: !!item?.isMilestone,
      evidenceStatus: normalizeIncidentEvidenceStatus(item?.evidenceStatus, base.linkedEvidenceIds),
      sequenceGroup: normalizeSequenceGroup(item?.sequenceGroup),
      linkedIncidentRefs: normalizeIncidentLinkRefs(item?.linkedIncidentRefs, base.id),
    };
  }

  if (isTimelineCapable(recordType)) {
    const timelineData = normalizeTimelineFields(item);
    return { ...base, ...timelineData, sequenceGroup: normalizeSequenceGroup(item?.sequenceGroup) };
  }

  return {
    ...base,
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
  };
}

const STRUCTURED_PATCH_RECORD_TYPES = ["incidents", "strategy"];

export function isStructuredPatchRecordType(recordType) {
  return STRUCTURED_PATCH_RECORD_TYPES.includes(recordType);
}

export function normalizeRecordPatch(recordType, patch = {}) {
  if (!isStructuredPatchRecordType(recordType) || !patch || typeof patch !== "object") {
    return {};
  }

  const textFields = ["title", "date", "description", "notes", "status", "source", "eventDate", "createdAt", "updatedAt"];
  const listFields = ["attachments", "tags", "linkedRecordIds"];
  const patchableFields = recordType === "incidents"
    ? [...textFields, ...listFields, "linkedEvidenceIds", "edited", "isMilestone"]
    : [...textFields, ...listFields, "edited"];

  return patchableFields.reduce((normalized, field) => {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) return normalized;

    if (listFields.includes(field) || field === "linkedEvidenceIds") {
      normalized[field] = field === "attachments" || field === "tags"
        ? (Array.isArray(patch[field]) ? patch[field] : [])
        : normalizeLinkedRecordIds(patch[field]);
      return normalized;
    }

    if (field === "edited") {
      normalized[field] = !!patch[field];
      return normalized;
    }

    if (field === "isMilestone") {
      normalized[field] = !!patch[field];
      return normalized;
    }

    normalized[field] = typeof patch[field] === "string" ? patch[field] : "";
    return normalized;
  }, {});
}

export function applyRecordPatch(record, recordType, patch = {}) {
  if (!record || !isStructuredPatchRecordType(recordType)) return record;

  const normalizedPatch = normalizeRecordPatch(recordType, patch);
  const patchedRecord = normalizeRecord({
    ...record,
    ...normalizedPatch,
    id: record.id,
    type: record.type || recordType,
  }, recordType);

  return {
    ...patchedRecord,
    id: record.id,
    type: record.type || recordType,
  };
}

export function applyRecordPatchToCase(caseItem, recordType, recordId, patch = {}) {
  if (!caseItem || !isStructuredPatchRecordType(recordType) || !recordId) return caseItem;

  const records = Array.isArray(caseItem[recordType]) ? caseItem[recordType] : [];
  let patchedRecord = null;
  const updatedRecords = records.map((record) => {
    if (record.id !== recordId) return record;
    patchedRecord = applyRecordPatch(record, recordType, patch);
    return patchedRecord;
  });

  if (!patchedRecord) return caseItem;

  let updatedCase = {
    ...caseItem,
    [recordType]: isTimelineCapable(recordType) ? sortTimelineItems(updatedRecords) : updatedRecords,
    updatedAt: new Date().toISOString(),
  };

  if (recordType === "incidents") {
    updatedCase = syncCaseLinks(updatedCase, patchedRecord, recordType);
  }

  return updatedCase;
}

const SEQUENCE_GROUP_RECORD_TYPES = ["incidents", "evidence", "documents", "strategy"];

function getSequenceGroupValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getCaseSequenceGroups(caseItem) {
  const groups = new Map();

  SEQUENCE_GROUP_RECORD_TYPES.forEach((recordType) => {
    const records = Array.isArray(caseItem?.[recordType]) ? caseItem[recordType] : [];
    records.forEach((record) => {
      const name = getSequenceGroupValue(record?.sequenceGroup);
      if (!name) return;

      const current = groups.get(name) || {
        name,
        totalCount: 0,
        counts: {
          incidents: 0,
          evidence: 0,
          documents: 0,
          strategy: 0,
        },
      };

      current.totalCount += 1;
      current.counts[recordType] += 1;
      groups.set(name, current);
    });
  });

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getSequenceGroupRecordTitle(record = {}, recordType = "record") {
  if (recordType === "documents") return record.title || record.name || record.id || "Untitled document";
  return record.title || record.label || record.id || `Untitled ${recordType}`;
}

function getSequenceGroupRecordDate(record = {}) {
  return record.eventDate || record.date || record.documentDate || record.capturedAt || record.createdAt || "";
}

function getSequenceGroupRecordSummary(record = {}) {
  const value = record.summary || record.description || record.functionSummary || record.notes || record.reviewNotes || record.source || "";
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 220) : "";
}

function getSequenceGroupLinkedCount(record = {}) {
  const linkedIds = [
    ...(Array.isArray(record.linkedRecordIds) ? record.linkedRecordIds : []),
    ...(Array.isArray(record.linkedEvidenceIds) ? record.linkedEvidenceIds : []),
    ...(Array.isArray(record.linkedIncidentIds) ? record.linkedIncidentIds : []),
    ...(Array.isArray(record.basedOnEvidenceIds) ? record.basedOnEvidenceIds : []),
    ...(Array.isArray(record.linkedIncidentRefs) ? record.linkedIncidentRefs.map((ref) => ref?.incidentId).filter(Boolean) : []),
  ];
  return new Set(linkedIds.filter(Boolean)).size;
}

function buildSequenceGroupRecord(record, recordType) {
  return {
    id: record.id || "",
    recordType,
    title: getSequenceGroupRecordTitle(record, recordType),
    date: getSequenceGroupRecordDate(record),
    status: record.status || record.proofStatus || "",
    summary: getSequenceGroupRecordSummary(record),
    sequenceGroup: getSequenceGroupValue(record.sequenceGroup),
    linkedRecordCount: getSequenceGroupLinkedCount(record),
  };
}

export function getCaseSequenceGroupDetails(caseItem) {
  const groups = new Map();
  const ungroupedRecords = {
    incidents: [],
    evidence: [],
    documents: [],
    strategy: [],
  };

  SEQUENCE_GROUP_RECORD_TYPES.forEach((recordType) => {
    const records = Array.isArray(caseItem?.[recordType]) ? caseItem[recordType] : [];
    records.forEach((record) => {
      if (!record?.id) return;
      const groupName = getSequenceGroupValue(record.sequenceGroup);
      const item = buildSequenceGroupRecord(record, recordType);
      if (!groupName) {
        ungroupedRecords[recordType].push(item);
        return;
      }
      if (!groups.has(groupName)) {
        groups.set(groupName, {
          name: groupName,
          totalCount: 0,
          counts: { incidents: 0, evidence: 0, documents: 0, strategy: 0 },
          records: { incidents: [], evidence: [], documents: [], strategy: [] },
          warnings: { noIncidents: false, incidentsWithoutEvidence: false },
        });
      }
      const group = groups.get(groupName);
      group.totalCount += 1;
      group.counts[recordType] += 1;
      group.records[recordType].push(item);
    });
  });

  const sortedGroups = [...groups.values()]
    .map((group) => ({
      ...group,
      warnings: {
        noIncidents: group.counts.incidents === 0,
        incidentsWithoutEvidence: group.counts.incidents > 0 && group.counts.evidence === 0,
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    groups: sortedGroups,
    ungroupedRecords,
  };
}

function updateRecordSequenceGroup(caseItem, recordType, recordId, targetGroup) {
  if (!caseItem || !SEQUENCE_GROUP_RECORD_TYPES.includes(recordType) || !recordId) return caseItem;
  const nextGroup = targetGroup == null ? "" : getSequenceGroupValue(targetGroup);
  const records = Array.isArray(caseItem?.[recordType]) ? caseItem[recordType] : [];
  const updatedAt = new Date().toISOString();
  let changed = false;
  const updatedRecords = records.map((record) => {
    if (record.id !== recordId) return record;
    if (getSequenceGroupValue(record.sequenceGroup) === nextGroup) return record;
    changed = true;
    return {
      ...record,
      sequenceGroup: nextGroup,
      updatedAt,
    };
  });

  if (!changed) return caseItem;

  return {
    ...caseItem,
    [recordType]: isTimelineCapable(recordType) ? sortTimelineItems(updatedRecords) : updatedRecords,
    updatedAt,
  };
}

export function moveRecordToSequenceGroup(caseItem, recordType, recordId, targetGroup) {
  const nextGroup = getSequenceGroupValue(targetGroup);
  if (!nextGroup) return caseItem;
  return updateRecordSequenceGroup(caseItem, recordType, recordId, nextGroup);
}

export function clearRecordSequenceGroup(caseItem, recordType, recordId) {
  return updateRecordSequenceGroup(caseItem, recordType, recordId, "");
}

export function mergeCaseSequenceGroups(caseItem, fromGroup, toGroup) {
  const sourceGroup = getSequenceGroupValue(fromGroup);
  const targetGroup = getSequenceGroupValue(toGroup);
  if (!sourceGroup || !targetGroup || sourceGroup === targetGroup) return caseItem;
  return updateCaseSequenceGroup(caseItem, sourceGroup, targetGroup);
}

function updateCaseSequenceGroup(caseItem, fromGroup, toGroup) {
  const sourceGroup = getSequenceGroupValue(fromGroup);
  if (!caseItem || !sourceGroup) return caseItem;

  const nextGroup = toGroup == null ? "" : getSequenceGroupValue(toGroup);
  const updatedAt = new Date().toISOString();
  let changed = false;
  const updatedCase = { ...caseItem };

  SEQUENCE_GROUP_RECORD_TYPES.forEach((recordType) => {
    const records = Array.isArray(caseItem?.[recordType]) ? caseItem[recordType] : [];
    updatedCase[recordType] = records.map((record) => {
      if (getSequenceGroupValue(record?.sequenceGroup) !== sourceGroup) return record;
      changed = true;
      return {
        ...record,
        sequenceGroup: nextGroup,
        updatedAt,
      };
    });
  });

  if (!changed) return caseItem;

  return {
    ...updatedCase,
    updatedAt,
  };
}

export function renameCaseSequenceGroup(caseItem, fromGroup, toGroup) {
  const nextGroup = getSequenceGroupValue(toGroup);
  if (!nextGroup) return caseItem;
  return updateCaseSequenceGroup(caseItem, fromGroup, nextGroup);
}

export function removeCaseSequenceGroup(caseItem, groupName) {
  return updateCaseSequenceGroup(caseItem, groupName, "");
}

export function normalizeCase(caseItem) {
  const evidence = Array.isArray(caseItem?.evidence) ? caseItem.evidence.map(r => normalizeRecord(r, "evidence")) : [];
  const incidents = Array.isArray(caseItem?.incidents) ? caseItem.incidents.map(r => normalizeRecord(r, "incidents")) : [];
  const tasks = Array.isArray(caseItem?.tasks) ? caseItem.tasks.map(r => normalizeRecord(r, "tasks")) : [];
  const strategy = Array.isArray(caseItem?.strategy) ? caseItem.strategy.map(r => normalizeRecord(r, "strategy")) : [];
  const ledger = Array.isArray(caseItem?.ledger) ? caseItem.ledger.map(normalizeLedgerEntry) : [];
  const documents = Array.isArray(caseItem?.documents) ? caseItem.documents.map(normalizeDocumentEntry) : [];
  const actionSummary = normalizeActionSummary(caseItem?.actionSummary || {});
  const privacyLock = normalizeCasePrivacyLock(caseItem?.privacyLock);
  const generatedReportText = normalizeGeneratedReportText(caseItem?.generatedReportText);

  return {
    id: caseItem?.id || generateId(),
    name: normalizeCaseName(caseItem?.name),
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
    ledger: ledger,
    documents: documents,
    actionSummary,
    privacyLock,
    generatedReportText,
    generatedReportVersions: normalizeGeneratedReportVersions(caseItem?.generatedReportVersions, generatedReportText),
    activeGeneratedReportLanguage: normalizeActiveGeneratedReportLanguage(caseItem?.activeGeneratedReportLanguage),
  };
}

/**
 * Syncs bi-directional links between Incidents and Evidence items.
 */
export function syncCaseLinks(caseData, record, type) {
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

export function removeIncidentRefsToIncident(caseItem, deletedIncidentId) {
  return {
    ...caseItem,
    incidents: (caseItem.incidents || []).map((incident) => {
      const refs = Array.isArray(incident.linkedIncidentRefs) ? incident.linkedIncidentRefs : [];
      const updatedRefs = refs.filter((ref) => ref?.incidentId !== deletedIncidentId);

      if (updatedRefs.length !== refs.length) {
        return {
          ...incident,
          linkedIncidentRefs: updatedRefs,
          updatedAt: new Date().toISOString(),
        };
      }

      return incident;
    }),
  };
}

export function getIncidentLinkGroups(caseItem, incidentId) {
  const incidents = Array.isArray(caseItem?.incidents) ? caseItem.incidents : [];
  const incidentMap = new Map(incidents.map((incident) => [incident.id, incident]));
  const currentIncident = incidentMap.get(incidentId);

  if (!currentIncident) {
    return {
      outcomes: [],
      causes: [],
      related: [],
    };
  }

  const outcomes = [];
  const causes = [];
  const related = [];
  const relatedIncidentIds = new Set();

  for (const ref of currentIncident.linkedIncidentRefs || []) {
    if (ref?.type === "CAUSES") {
      const incident = incidentMap.get(ref.incidentId);
      if (incident) outcomes.push({ ref, incident });
    } else if (ref?.type === "RELATED_TO") {
      const incident = incidentMap.get(ref.incidentId);
      if (incident && !relatedIncidentIds.has(incident.id)) {
        relatedIncidentIds.add(incident.id);
        related.push({ ref, incident });
      }
    }
  }

  for (const incident of incidents) {
    if (incident.id === incidentId) continue;

    for (const ref of incident.linkedIncidentRefs || []) {
      if (ref?.incidentId !== incidentId) continue;

      if (ref.type === "CAUSES") {
        causes.push({ ref, incident });
      } else if (ref.type === "RELATED_TO" && !relatedIncidentIds.has(incident.id)) {
        relatedIncidentIds.add(incident.id);
        related.push({ ref, incident });
      }
    }
  }

  return {
    outcomes,
    causes,
    related,
  };
}

export function linkRecordToIncident(caseItem, incidentId, recordId) {
  if (!caseItem || !incidentId || !recordId) return caseItem;

  const incidents = Array.isArray(caseItem.incidents) ? caseItem.incidents : [];
  let changed = false;
  const updatedIncidents = incidents.map((incident) => {
    if (incident.id !== incidentId) return incident;

    const linkedRecordIds = normalizeLinkedRecordIds([...(incident.linkedRecordIds || []), recordId]);
    if (linkedRecordIds.length === normalizeLinkedRecordIds(incident.linkedRecordIds).length) return incident;

    changed = true;
    return {
      ...incident,
      linkedRecordIds,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!changed) return caseItem;

  return {
    ...caseItem,
    incidents: sortTimelineItems(updatedIncidents),
    updatedAt: new Date().toISOString(),
  };
}

export function unlinkRecordFromIncident(caseItem, incidentId, recordId) {
  if (!caseItem || !incidentId || !recordId) return caseItem;

  const incidents = Array.isArray(caseItem.incidents) ? caseItem.incidents : [];
  let changed = false;
  const updatedIncidents = incidents.map((incident) => {
    if (incident.id !== incidentId) return incident;

    const currentIds = normalizeLinkedRecordIds(incident.linkedRecordIds);
    const linkedRecordIds = currentIds.filter((id) => id !== recordId);
    if (linkedRecordIds.length === currentIds.length) return incident;

    changed = true;
    return {
      ...incident,
      linkedRecordIds,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!changed) return caseItem;

  return {
    ...caseItem,
    incidents: sortTimelineItems(updatedIncidents),
    updatedAt: new Date().toISOString(),
  };
}

export function getIncidentsUsingRecord(caseItem, recordId) {
  if (!caseItem || !recordId) return [];
  const incidents = Array.isArray(caseItem.incidents) ? caseItem.incidents : [];
  return sortTimelineItems(
    incidents.filter((incident) => normalizeLinkedRecordIds(incident.linkedRecordIds).includes(recordId))
  );
}

function removeDeletedIdFromArray(value, deletedId) {
  if (!Array.isArray(value)) return { value, changed: false };
  const nextValue = value.filter((id) => id !== deletedId);
  return {
    value: nextValue,
    changed: nextValue.length !== value.length,
  };
}

function removeDeletedIncidentRefs(value, deletedId) {
  if (!Array.isArray(value)) return { value, changed: false };
  const nextValue = value.filter((ref) => ref?.incidentId !== deletedId);
  return {
    value: nextValue,
    changed: nextValue.length !== value.length,
  };
}

function cleanupLinkedFields(item, deletedId, updatedAt) {
  if (!item || !deletedId) return item;

  let changed = false;
  const nextItem = { ...item };
  const arrayFields = ["linkedRecordIds", "linkedEvidenceIds", "linkedIncidentIds", "basedOnEvidenceIds"];

  arrayFields.forEach((field) => {
    const result = removeDeletedIdFromArray(nextItem[field], deletedId);
    if (result.changed) {
      nextItem[field] = result.value;
      changed = true;
    }
  });

  const incidentRefsResult = removeDeletedIncidentRefs(nextItem.linkedIncidentRefs, deletedId);
  if (incidentRefsResult.changed) {
    nextItem.linkedIncidentRefs = incidentRefsResult.value;
    changed = true;
  }

  return changed ? { ...nextItem, updatedAt } : item;
}

export function cleanupDeletedRecordLinks(caseItem, deletedType, deletedId) {
  if (!caseItem || !deletedId) return caseItem;

  const updatedAt = new Date().toISOString();
  const cleanupCollection = (items = [], { timeline = false } = {}) => {
    let changed = false;
    const cleanedItems = items.map((item) => cleanupLinkedFields(item, deletedId, updatedAt));
    cleanedItems.forEach((item, index) => {
      if (item !== items[index]) changed = true;
    });
    if (!changed) return items;
    return timeline ? sortTimelineItems(cleanedItems) : cleanedItems;
  };

  return {
    ...caseItem,
    evidence: cleanupCollection(caseItem.evidence || [], { timeline: true }),
    incidents: cleanupCollection(caseItem.incidents || [], { timeline: true }),
    tasks: cleanupCollection(caseItem.tasks || []),
    strategy: cleanupCollection(caseItem.strategy || [], { timeline: true }),
    documents: cleanupCollection(caseItem.documents || []),
    ledger: cleanupCollection(caseItem.ledger || []),
    updatedAt: caseItem.updatedAt,
  };
}

export function deleteRecordFromCase(caseItem, recordType, recordId) {
  let updatedCase = {
    ...caseItem,
    [recordType]: caseItem[recordType].filter((r) => r.id !== recordId),
    updatedAt: new Date().toISOString(),
  };

  return cleanupDeletedRecordLinks(updatedCase, recordType, recordId);
}

export function deleteLedgerEntryFromCase(caseItem, entryId) {
  const updatedCase = {
    ...caseItem,
    ledger: (caseItem.ledger || []).filter(item => item.id !== entryId),
    updatedAt: new Date().toISOString(),
  };

  return cleanupDeletedRecordLinks(updatedCase, "ledger", entryId);
}

export function deleteDocumentEntryFromCase(caseItem, entryId) {
  const updatedCase = {
    ...caseItem,
    documents: (caseItem.documents || []).filter(item => item.id !== entryId),
    updatedAt: new Date().toISOString(),
  };

  return cleanupDeletedRecordLinks(updatedCase, "document", entryId);
}

export function upsertLedgerEntryInCase(caseItem, ledgerInput, editingLedgerId = null) {
  let updatedLedger;
  if (editingLedgerId) {
    updatedLedger = (caseItem.ledger || []).map(entry => {
      if (entry.id === editingLedgerId) {
        return normalizeLedgerEntry({
          ...entry,
          ...ledgerInput,
          id: entry.id,
          edited: true,
          updatedAt: new Date().toISOString(),
        });
      }
      return entry;
    });
  } else {
    const newEntry = normalizeLedgerEntry({
      ...ledgerInput,
      id: ledgerInput?.id || generateId(),
      edited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    updatedLedger = [...(caseItem.ledger || []), newEntry];
  }

  const updatedCase = {
    ...caseItem,
    ledger: updatedLedger,
    updatedAt: new Date().toISOString(),
  };

  return updatedCase;
}

export function upsertDocumentEntryInCase(caseItem, documentInput, editingDocumentId = null) {
  let updatedDocuments;
  if (editingDocumentId) {
    updatedDocuments = (caseItem.documents || []).map(doc => {
      if (doc.id === editingDocumentId) {
        return normalizeDocumentEntry({
          ...doc,
          ...documentInput,
          id: doc.id,
          edited: true,
          updatedAt: new Date().toISOString(),
        });
      }
      return doc;
    });
  } else {
    const newEntry = normalizeDocumentEntry({
      ...documentInput,
      id: documentInput?.id || generateId(),
      edited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    updatedDocuments = [...(caseItem.documents || []), newEntry];
  }

  const updatedCase = {
    ...caseItem,
    documents: updatedDocuments,
    updatedAt: new Date().toISOString(),
  };

  return updatedCase;
}

export function upsertRecordInCase(caseItem, recordType, recordInput, editingRecord = null) {
  let updatedCase;

  if (editingRecord) {
    // Attachments are already serialized via fileToSerializable
    let updatedAttachments = recordInput.attachments;
    let updatedAvailability = { ...recordInput.availability };

    if (recordType === "evidence") {
      updatedAvailability.digital.files = updatedAttachments;
      updatedAvailability.digital.hasDigital = updatedAttachments.length > 0;
    }

    const updatedRecord = normalizeRecord({
      ...editingRecord,
      ...recordInput,
      title: recordInput.title.trim(),
      date: recordInput.date || new Date().toISOString().slice(0, 10),
      description: recordInput.description.trim(),
      notes: recordInput.notes.trim(),
      sourceType: recordInput.sourceType,
      capturedAt: recordInput.capturedAt,
      availability: updatedAvailability,
      attachments: updatedAttachments,
      importance: recordInput.importance,
      relevance: recordInput.relevance,
      status: recordInput.status,
      usedIn: recordInput.usedIn,
      reviewNotes: recordInput.reviewNotes,
      evidenceRole: recordInput.evidenceRole,
      evidenceType: recordInput.evidenceType,
      sequenceGroup: recordInput.sequenceGroup,
      functionSummary: recordInput.functionSummary,
      linkedIncidentIds: recordInput.linkedIncidentIds,
      linkedEvidenceIds: recordInput.linkedEvidenceIds,
      evidenceStatus: recordInput.evidenceStatus,
      linkedIncidentRefs: recordInput.linkedIncidentRefs,
      linkedRecordIds: recordInput.linkedRecordIds || editingRecord.linkedRecordIds || [],
      isMilestone: !!recordInput.isMilestone,
      updatedAt: new Date().toISOString(),
      edited: true,
    }, recordType);

    const updatedList = caseItem[recordType].map((rec) =>
      rec.id === editingRecord.id ? updatedRecord : rec
    );

    updatedCase = {
      ...caseItem,
      [recordType]: isTimelineCapable(recordType) ? sortTimelineItems(updatedList) : updatedList,
      updatedAt: new Date().toISOString(),
    };

    updatedCase = syncCaseLinks(updatedCase, updatedRecord, recordType);

    if (recordType === "evidence") {
      // logic removed
    }
  } else {
    const newRecordId = recordInput.id || generateId();
    // Attachments are already serialized via fileToSerializable
    let attachmentObjects = recordInput.attachments;
    let availability = { ...recordInput.availability };

    if (recordType === "evidence") {
      availability.digital.files = attachmentObjects;
      availability.digital.hasDigital = attachmentObjects.length > 0;
    }

    const newRecord = normalizeRecord({
      ...recordInput,
      id: newRecordId,
      title: recordInput.title.trim(),
      date: recordInput.date || new Date().toISOString().slice(0, 10),
      description: recordInput.description.trim(),
      notes: recordInput.notes.trim(),
      sourceType: recordInput.sourceType,
      capturedAt: recordInput.capturedAt,
      availability: availability,
      attachments: attachmentObjects,
      importance: recordInput.importance,
      relevance: recordInput.relevance,
      status: recordInput.status,
      usedIn: recordInput.usedIn,
      reviewNotes: recordInput.reviewNotes,
      evidenceRole: recordInput.evidenceRole,
      evidenceType: recordInput.evidenceType,
      sequenceGroup: recordInput.sequenceGroup,
      functionSummary: recordInput.functionSummary,
      linkedIncidentIds: recordInput.linkedIncidentIds,
      linkedEvidenceIds: recordInput.linkedEvidenceIds,
      evidenceStatus: recordInput.evidenceStatus,
      linkedIncidentRefs: recordInput.linkedIncidentRefs,
      linkedRecordIds: recordInput.linkedRecordIds || [],
      isMilestone: !!recordInput.isMilestone,
      createdAt: new Date().toISOString(),
    }, recordType);

    const updatedList = [newRecord, ...caseItem[recordType]];

    updatedCase = {
      ...caseItem,
      [recordType]: isTimelineCapable(recordType) ? sortTimelineItems(updatedList) : updatedList,
      updatedAt: new Date().toISOString(),
    };

    updatedCase = syncCaseLinks(updatedCase, newRecord, recordType);

    if (recordType === "evidence") {
      // logic removed
    }
  }

  return updatedCase;
}

export function convertQuickCaptureToRecord(caseItem, capture, targetType) {
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

  const updatedList = [newRecord, ...caseItem[targetType]];

  const updatedCase = {
    ...caseItem,
    [targetType]: isTimelineCapable(targetType) ? sortTimelineItems(updatedList) : updatedList,
    updatedAt: new Date().toISOString(),
  };

  const updatedCapture = { ...capture, status: "converted", convertedTo: targetType, updatedAt: new Date().toISOString() };

  return { case: updatedCase, record: newRecord, capture: updatedCapture };
}

export function mergeRecords(existingRecords = [], incomingRecords = [], recordType) {
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

export function mergeDocumentEntries(existingEntries = [], incomingEntries = []) {
  const entryMap = new Map(existingEntries.map(e => [e.id, e]));
  for (const incoming of incomingEntries) {
    if (entryMap.has(incoming.id)) {
      const existing = entryMap.get(incoming.id);
      entryMap.set(incoming.id, normalizeDocumentEntry({ ...existing, ...incoming }));
    } else {
      entryMap.set(incoming.id, normalizeDocumentEntry(incoming));
    }
  }
  return Array.from(entryMap.values());
}

export function mergeLedgerEntries(existingEntries = [], incomingEntries = []) {
  const entryMap = new Map(existingEntries.map(e => [e.id, e]));
  for (const incoming of incomingEntries) {
    if (entryMap.has(incoming.id)) {
      const existing = entryMap.get(incoming.id);
      entryMap.set(incoming.id, normalizeLedgerEntry({ ...existing, ...incoming }));
    } else {
      entryMap.set(incoming.id, normalizeLedgerEntry(incoming));
    }
  }
  return Array.from(entryMap.values());
}

export function mergeCase(existingCase, incomingCase) {
  const nExisting = normalizeCase(existingCase);
  const nIncoming = normalizeCase(incomingCase);
  const hasIncomingGeneratedReportText = Object.prototype.hasOwnProperty.call(incomingCase || {}, "generatedReportText");
  const hasIncomingGeneratedReportVersions = Object.prototype.hasOwnProperty.call(incomingCase || {}, "generatedReportVersions");
  const hasIncomingActiveGeneratedReportLanguage = Object.prototype.hasOwnProperty.call(incomingCase || {}, "activeGeneratedReportLanguage");
  const generatedReportVersions = hasIncomingGeneratedReportVersions
    ? {
        en: nIncoming.generatedReportVersions.en || nExisting.generatedReportVersions.en,
        de: nIncoming.generatedReportVersions.de || nExisting.generatedReportVersions.de,
      }
    : nExisting.generatedReportVersions;

  return {
    ...nExisting,
    ...nIncoming,
    name: normalizeCaseName(
      (typeof incomingCase?.name === "string" && incomingCase.name.trim())
        ? incomingCase.name
        : existingCase?.name
    ),
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
    ledger: mergeLedgerEntries(nExisting.ledger, nIncoming.ledger),
    documents: mergeDocumentEntries(nExisting.documents, nIncoming.documents),
    actionSummary: normalizeActionSummary(
      incomingCase?.actionSummary && (
        incomingCase.actionSummary.currentFocus ||
        (incomingCase.actionSummary.nextActions || []).length ||
        (incomingCase.actionSummary.importantReminders || []).length ||
        (incomingCase.actionSummary.strategyFocus || []).length ||
        incomingCase.actionSummary.updatedAt
      )
        ? incomingCase.actionSummary
        : existingCase?.actionSummary
    ),
    privacyLock: normalizeCasePrivacyLock(incomingCase?.privacyLock) || normalizeCasePrivacyLock(existingCase?.privacyLock),
    generatedReportText: hasIncomingGeneratedReportText
      ? normalizeGeneratedReportText(incomingCase?.generatedReportText)
      : normalizeGeneratedReportText(existingCase?.generatedReportText),
    generatedReportVersions,
    activeGeneratedReportLanguage: hasIncomingActiveGeneratedReportLanguage
      ? normalizeActiveGeneratedReportLanguage(incomingCase?.activeGeneratedReportLanguage)
      : normalizeActiveGeneratedReportLanguage(existingCase?.activeGeneratedReportLanguage),
  };
}
