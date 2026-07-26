const BINARY_ATTACHMENT_KEYS = new Set([
  "blob", "file", "data", "dataUrl", "backupDataUrl", "base64", "binary", "buffer", "bytes", "content",
]);

const LINK_FIELDS = [
  "linkedRecordIds", "linkedIncidentIds", "linkedEvidenceIds", "linkedDocumentIds",
  "linkedStrategyIds", "linkedWatchItemIds", "basedOnEvidenceIds", "supportingRecordIds",
];

const PARTY_FIELDS = ["linkedPartyIds", "partyIds", "relatedPartyIds"];

const DATE_FIELDS = {
  incident: ["eventDate", "date", "createdAt"],
  evidence: ["eventDate", "date", "capturedAt", "createdAt"],
  document: ["eventDate", "documentDate", "date", "createdAt"],
  ledger: ["eventDate", "date", "paymentDate", "period", "createdAt"],
  strategy: ["eventDate", "date", "reviewDate", "createdAt"],
  watch: ["eventDate", "date", "reviewDate", "createdAt"],
};

const DETAIL_FIELDS = {
  incident: ["category", "incidentType", "type", "description", "functionSummary", "importance", "evidenceStatus", "outcome", "location", "source", "referenceNumber", "isMilestone", "verificationStatus", "verificationNotes"],
  evidence: ["evidenceType", "evidenceRole", "proofStatus", "functionSummary", "source", "capturedAt", "verificationStatus", "verificationNotes", "chainOfCustody", "acquisitionNotes", "authenticityNotes"],
  document: ["category", "documentType", "source", "author", "summary", "textContent", "functionSummary", "documentDate", "date", "createdAt", "updatedAt"],
  ledger: ["amount", "expectedAmount", "paidAmount", "currency", "type", "category", "subType", "description", "counterparty", "paymentDate", "dueDate", "period", "createdAt", "method", "reference", "proofType", "proofStatus", "batchLabel", "statusNote", "isStatusNote"],
  strategy: ["objective", "rationale", "desiredOutcome", "strategyType", "priority", "decisionStatus", "reviewDate", "assumptions", "risks", "nextSteps", "ownerPartyId"],
  watch: ["category", "priority", "watchFor", "rationale", "triggerConditions", "latestObservation", "nextCheck", "outcome", "reviewDate", "observations"],
};

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function copySerializable(value, seen = new WeakSet()) {
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value !== "object" || seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => copySerializable(item, seen)).filter((item) => item !== undefined);
    seen.delete(value);
    return result;
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (BINARY_ATTACHMENT_KEYS.has(key) || typeof item === "function") continue;
    const copied = copySerializable(item, seen);
    if (copied !== undefined) result[key] = copied;
  }
  seen.delete(value);
  return result;
}

export function getReportRecordTitle(record = {}, type = "record") {
  return text(record.title) || text(record.name) || text(record.label) || text(record.id) || `Untitled ${type}`;
}

export function normaliseReportDate(value) {
  const raw = text(value);
  if (!raw) return { value: "", status: "missing", sortValue: "" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    return valid ? { value: raw, status: "valid", sortValue: raw } : { value: raw, status: "malformed", sortValue: "" };
  }
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp)
    ? { value: raw, status: "malformed", sortValue: "" }
    : { value: raw, status: "valid", sortValue: new Date(timestamp).toISOString() };
}

export function getReportRecordDate(record = {}, type = "record") {
  const field = (DATE_FIELDS[type] || ["eventDate", "date", "createdAt"])
    .find((key) => text(record[key]));
  return normaliseReportDate(field ? record[field] : "");
}

export function projectAttachmentMetadata(attachment = {}) {
  if (!attachment || typeof attachment !== "object") return null;
  const projected = {
    id: text(attachment.id),
    filename: text(attachment.name) || text(attachment.filename),
    mimeType: text(attachment.type) || text(attachment.mimeType),
    sizeBytes: typeof attachment.size === "number" ? attachment.size : typeof attachment.sizeBytes === "number" ? attachment.sizeBytes : null,
    source: text(attachment.source),
    createdAt: text(attachment.createdAt),
  };
  return Object.values(projected).some((value) => value !== "" && value !== null) ? projected : null;
}

function projectDetails(record, type) {
  const details = {};
  for (const key of DETAIL_FIELDS[type] || []) {
    if (record[key] === undefined) continue;
    const value = copySerializable(record[key]);
    if (value !== undefined) details[key] = value;
  }
  return details;
}

export function projectReportRecord(record = {}, type = "record", context = {}) {
  const date = getReportRecordDate(record, type);
  const partyIds = uniqueStrings(PARTY_FIELDS.flatMap((field) => Array.isArray(record[field]) ? record[field] : []));
  if (typeof record.ownerPartyId === "string" && record.ownerPartyId.trim()) partyIds.push(record.ownerPartyId.trim());
  const linkedRecordIds = uniqueStrings([
    ...LINK_FIELDS.flatMap((field) => Array.isArray(record[field]) ? record[field] : []),
    ...(Array.isArray(record.linkedIncidentRefs) ? record.linkedIncidentRefs.map((ref) => ref?.incidentId) : []),
  ]);
  const linkReferences = [];
  for (const field of LINK_FIELDS) {
    for (const targetId of uniqueStrings(Array.isArray(record[field]) ? record[field] : [])) {
      linkReferences.push({ targetId, referenceType: field });
    }
  }
  for (const targetId of uniqueStrings(Array.isArray(record.linkedIncidentRefs) ? record.linkedIncidentRefs.map((ref) => ref?.incidentId) : [])) {
    linkReferences.push({ targetId, referenceType: "linkedIncidentRefs" });
  }
  const attachmentMetadata = (Array.isArray(record.attachments) ? record.attachments : [])
    .map(projectAttachmentMetadata)
    .filter(Boolean);
  const status = text(record.status) || text(record.proofStatus);

  return {
    id: text(record.id),
    type,
    title: getReportRecordTitle(record, type),
    eventDate: text(record.eventDate) || text(record.documentDate) || text(record.date),
    loggedDate: text(record.createdAt) || text(record.capturedAt),
    canonicalDate: date.value,
    dateStatus: date.status,
    summary: text(record.summary) || text(record.functionSummary) || text(record.description) || text(record.objective) || text(record.watchFor),
    notes: text(record.notes) || text(record.reviewNotes),
    status,
    archived: record.archived === true || status.toLowerCase() === "archived",
    sequenceGroup: text(record.sequenceGroup),
    partyIds: uniqueStrings(partyIds),
    resolvedParties: [],
    linkedRecordIds,
    linkReferences,
    links: [],
    attachmentMetadata,
    sourceIndex: Number.isInteger(context.sourceIndex) ? context.sourceIndex : 0,
    details: projectDetails(record, type),
  };
}

export function compareReportChronology(a, b) {
  const rank = { valid: 0, malformed: 1, missing: 2 };
  const statusDifference = (rank[a.dateStatus] ?? 2) - (rank[b.dateStatus] ?? 2);
  if (statusDifference) return statusDifference;
  if (a.dateStatus === "valid") {
    const dateDifference = String(a.canonicalDate).localeCompare(String(b.canonicalDate));
    if (dateDifference) return dateDifference;
  }
  return String(a.title).localeCompare(String(b.title))
    || String(a.type).localeCompare(String(b.type))
    || String(a.id).localeCompare(String(b.id))
    || (a.sourceIndex || 0) - (b.sourceIndex || 0);
}
