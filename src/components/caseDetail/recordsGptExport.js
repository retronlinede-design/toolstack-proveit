import { buildExportPrivacyMetadata, EXPORT_PRIVACY_PROFILES } from "../../export/exportPrivacy.js";

const BINARY_FIELD_NAMES = new Set([
  "arrayBuffer",
  "attachment",
  "attachments",
  "backupDataUrl",
  "base64",
  "binary",
  "blob",
  "bytes",
  "dataUrl",
  "file",
  "files",
  "image",
  "images",
  "thumbnailDataUrl",
]);

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function sanitizeText(value) {
  return safeText(value).replace(/data:[^\s"'<>)]*/gi, "[removed data URL]");
}

function stripUnsafeFields(value) {
  if (Array.isArray(value)) return value.map(stripUnsafeFields);
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? sanitizeText(value) : value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !BINARY_FIELD_NAMES.has(key))
      .map(([key, childValue]) => [key, stripUnsafeFields(childValue)])
  );
}

function caseEnvelope(caseItem = {}) {
  return {
    id: caseItem?.id || "",
    name: caseItem?.name || "",
    category: caseItem?.category || "",
    status: caseItem?.status || "",
  };
}

function linkedIdsFromRecords(records = []) {
  return records.map((record) => record?.id).filter(Boolean);
}

export function buildTrackingRecordGptRecord(record = {}, context = {}) {
  const rawDocument = record.rawDocument || {};
  return {
    id: record.id || rawDocument.id || "",
    title: record.title || rawDocument.title || "Untitled Tracking Record",
    recordType: "trackingRecord",
    sourceDocumentId: rawDocument.id || record.id || "",
    category: rawDocument.category || record.category || "",
    source: rawDocument.source || record.source || "",
    purpose: record.meta?.subject || "",
    status: record.meta?.status || "",
    period: record.meta?.period || "",
    trackingType: record.meta?.type || "",
    sequenceGroup: rawDocument.sequenceGroup || "",
    documentDate: rawDocument.documentDate || "",
    createdAt: rawDocument.createdAt || "",
    updatedAt: rawDocument.updatedAt || "",
    textContent: sanitizeText(rawDocument.textContent || ""),
    table: stripUnsafeFields(record.table || []),
    summary: sanitizeText(record.summary || ""),
    notes: sanitizeText(record.notes || rawDocument.notes || ""),
    linkedRecordIds: list(rawDocument.linkedRecordIds),
    linkedIncidentIds: [
      ...list(rawDocument.linkedIncidentIds),
      ...linkedIdsFromRecords(context.usedByIncidents),
    ].filter((id, index, ids) => ids.indexOf(id) === index),
    linkedEvidenceIds: [
      ...list(rawDocument.linkedEvidenceIds),
      ...list(rawDocument.basedOnEvidenceIds),
      ...linkedIdsFromRecords(context.basedOnEvidence),
    ].filter((id, index, ids) => ids.indexOf(id) === index),
    linkedDocumentIds: list(rawDocument.linkedDocumentIds),
    basedOnEvidenceIds: list(rawDocument.basedOnEvidenceIds),
  };
}

export function buildTrackingRecordGptExport(caseItem = {}, record = {}, context = {}) {
  return {
    app: "proveit",
    exportType: "GPT_RECORD_EXPORT",
    exportMetadata: buildExportPrivacyMetadata(EXPORT_PRIVACY_PROFILES.GPT_AUDIT_PACK, {
      exportType: "GPT_RECORD_EXPORT",
      label: "GPT Audit Pack",
    }),
    importable: false,
    includesBinaryData: false,
    case: caseEnvelope(caseItem),
    instructions: [
      "Use only supplied record data.",
      "Do not invent facts.",
      "Do not generate ProveIt deltas.",
      "Use record IDs in recommendations.",
      "Treat this as record data, not proof unless linked evidence is supplied.",
    ],
    record: buildTrackingRecordGptRecord(record, context),
  };
}

export function buildAllTrackingRecordsGptExport(caseItem = {}, records = [], contextByRecordId = {}) {
  return {
    app: "proveit",
    exportType: "GPT_RECORDS_EXPORT",
    exportMetadata: buildExportPrivacyMetadata(EXPORT_PRIVACY_PROFILES.GPT_AUDIT_PACK, {
      exportType: "GPT_RECORDS_EXPORT",
      label: "GPT Audit Pack",
    }),
    importable: false,
    includesBinaryData: false,
    case: caseEnvelope(caseItem),
    instructions: [
      "Use only supplied record data.",
      "Do not invent facts.",
      "Do not generate ProveIt deltas.",
      "Use record IDs in recommendations.",
      "Treat this as record data, not proof unless linked evidence is supplied.",
    ],
    records: records.map((record) => buildTrackingRecordGptRecord(record, contextByRecordId[record.id] || {})),
  };
}
