import JSZip from "jszip";

export const SPLIT_REASONING_PACKAGE_VERSION = "1.0";
export const DEFAULT_JSON_TARGET_BYTES = 2 * 1024 * 1024;

const BINARY_KEYS = new Set(["dataurl", "backupdataurl", "blob", "arraybuffer", "binary", "binarydata", "rawbinary", "imagedata", "imagepayload", "indexeddbimagepayload", "fullbackup", "fullbackuppayload"]);
const COLLECTIONS = [
  ["party", "parties"], ["incident", "incidents"], ["evidence", "evidence"],
  ["document", "documents"], ["strategy", "strategy"], ["watch", "watchItems"],
  ["ledger", "ledger"], ["task", "tasks"],
];

const isBinaryValue = (value) =>
  (typeof Blob !== "undefined" && value instanceof Blob) ||
  (typeof ArrayBuffer !== "undefined" && (value instanceof ArrayBuffer || ArrayBuffer.isView(value)));

export function sanitizeSplitReasoningValue(value, seen = new WeakSet()) {
  if (value == null || typeof value !== "object") return value;
  if (isBinaryValue(value)) return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => sanitizeSplitReasoningValue(item, seen)).filter((item) => item !== undefined);
    seen.delete(value);
    return result;
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (BINARY_KEYS.has(key.toLowerCase()) || isBinaryValue(item)) continue;
    const sanitized = sanitizeSplitReasoningValue(item, seen);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  seen.delete(value);
  return result;
}

export function serializeSplitReasoningJson(payload) {
  return JSON.stringify(payload, null, 2);
}

export function utf8ByteSize(value) {
  const text = typeof value === "string" ? value : serializeSplitReasoningJson(value);
  return new TextEncoder().encode(text).byteLength;
}

const records = (caseItem, key) => Array.isArray(caseItem?.[key]) ? caseItem[key] : [];
const recordDate = (record) => record?.eventDate || record?.date || record?.documentDate || record?.paymentDate || record?.capturedAt || record?.reviewDate || record?.createdAt || "";
const recordTitle = (record, fallback) => record?.title || record?.name || record?.label || record?.objective || fallback;
const contextText = (record) => String(record?.summary || record?.description || record?.functionSummary || record?.notes || record?.watchFor || record?.rationale || "").slice(0, 300);
const deterministicRecords = (items) => items.map((item) => sanitizeSplitReasoningValue(item)).sort((a, b) => String(recordDate(a)).localeCompare(String(recordDate(b))) || String(a?.id || "").localeCompare(String(b?.id || "")));

function buildRecordIndex(caseItem) {
  const index = new Map();
  for (const [type, key] of COLLECTIONS) for (const record of records(caseItem, key)) if (record?.id) index.set(String(record.id), type);
  return index;
}

function relationshipType(field) {
  return ({ linkedEvidenceIds: "linked_evidence", linkedIncidentIds: "linked_incident", linkedPartyIds: "linked_party", basedOnEvidenceIds: "based_on_evidence", ownerPartyId: "strategy_owner" })[field] || "linked_record";
}

function inferTargetType(field, id, index) {
  if (field === "linkedEvidenceIds" || field === "basedOnEvidenceIds") return "evidence";
  if (field === "linkedIncidentIds") return "incident";
  if (field === "linkedPartyIds" || field === "ownerPartyId") return "party";
  return index.get(String(id)) || "unknown";
}

function buildRelationships(caseItem) {
  const index = buildRecordIndex(caseItem);
  const relationships = [];
  const warnings = [];
  const linkFields = ["linkedRecordIds", "linkedEvidenceIds", "linkedIncidentIds", "linkedPartyIds", "basedOnEvidenceIds", "ownerPartyId"];
  for (const [sourceType, key] of COLLECTIONS) for (const record of records(caseItem, key)) {
    for (const field of linkFields) {
      const values = field === "ownerPartyId" ? (record?.[field] ? [record[field]] : []) : (Array.isArray(record?.[field]) ? record[field] : []);
      for (const targetId of values) {
        const targetType = inferTargetType(field, targetId, index);
        const relation = { sourceType, sourceId: record.id, targetType, targetId, relationshipType: relationshipType(field) };
        relationships.push(relation);
        if (!index.has(String(targetId))) warnings.push({ ...relation, warning: "Referenced target was not found in this case." });
      }
    }
    for (const ref of Array.isArray(record?.linkedIncidentRefs) ? record.linkedIncidentRefs : []) {
      const targetId = ref?.incidentId || ref?.id;
      if (!targetId) continue;
      const relation = { sourceType, sourceId: record.id, targetType: "incident", targetId, relationshipType: ref?.relationshipType || ref?.type || "related_incident" };
      relationships.push(relation);
      if (!index.has(String(targetId))) warnings.push({ ...relation, warning: "Referenced target was not found in this case." });
    }
    if (record?.sequenceGroup) relationships.push({ sourceType, sourceId: record.id, targetType: "sequence_group", targetId: record.sequenceGroup, relationshipType: "sequence_group_membership" });
  }
  return { relationships: relationships.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), missingTargetWarnings: warnings };
}

function buildChronology(caseItem) {
  return COLLECTIONS.flatMap(([sourceType, key]) => records(caseItem, key).map((record) => ({
    sourceType, sourceId: record.id, date: recordDate(record), title: recordTitle(record, `Untitled ${sourceType}`), shortContext: contextText(record),
    ...(record.archived !== undefined ? { archived: !!record.archived } : {}),
    ...(record.status ? { status: record.status } : {}),
    ...(record.isMilestone !== undefined ? { isMilestone: !!record.isMilestone } : {}),
  }))).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.sourceType.localeCompare(b.sourceType) || String(a.sourceId).localeCompare(String(b.sourceId)));
}

export function projectSplitReasoningSections(caseItem, { exportedAt = new Date().toISOString(), sequenceGroupMeta = null } = {}) {
  if (!caseItem) throw new Error("caseItem is required for the split reasoning package");
  const actionSummary = sanitizeSplitReasoningValue(caseItem.actionSummary || {});
  const statusTotals = {};
  for (const [, key] of COLLECTIONS) for (const item of records(caseItem, key)) {
    const status = item?.status || "unspecified";
    statusTotals[status] = (statusTotals[status] || 0) + 1;
  }
  const metadata = sanitizeSplitReasoningValue(Object.fromEntries(Object.entries(caseItem).filter(([key]) => !COLLECTIONS.some(([, collection]) => collection === key) && !["actionSummary", "auditLog"].includes(key))));
  const sequenceNames = [...new Set(COLLECTIONS.flatMap(([, key]) => records(caseItem, key).map((item) => item?.sequenceGroup)).filter(Boolean))].sort();
  return {
    summary: { packageFormat: "ProveIt Reasoning Package — Split Case Files", packageVersion: SPLIT_REASONING_PACKAGE_VERSION, exportedAt, caseMetadata: metadata, caseDescription: caseItem.description || "", currentFocus: actionSummary.currentFocus, actionSummary, nextActions: actionSummary.nextActions, reminders: actionSummary.importantReminders, deadlines: actionSummary.criticalDeadlines, currentStrategicFocus: actionSummary.strategyFocus, statusTotals },
    parties: { parties: deterministicRecords(records(caseItem, "parties")) },
    incidents: { incidents: deterministicRecords(records(caseItem, "incidents")) },
    evidence: { evidence: deterministicRecords(records(caseItem, "evidence")) },
    documents: { documents: deterministicRecords(records(caseItem, "documents")) },
    strategy: { strategy: deterministicRecords(records(caseItem, "strategy")) },
    watch: { factualStatus: "monitoring_or_unconfirmed_context_not_established_fact", watchItems: deterministicRecords(records(caseItem, "watchItems")) },
    chronology: { chronology: buildChronology(caseItem) },
    relationships: buildRelationships(caseItem),
    ledger: { ledger: deterministicRecords(records(caseItem, "ledger")) },
    sequenceGroups: { sequenceGroups: sequenceNames.map((id) => ({ id })), ...(sequenceGroupMeta ? { metadata: sanitizeSplitReasoningValue(sequenceGroupMeta) } : {}) },
  };
}

const SECTION_FILES = [
  ["summary", "01-case-summary", null], ["parties", "02-parties", "parties"], ["incidents", "03-incidents", "incidents"],
  ["evidence", "04-evidence", "evidence"], ["documents", "05-documents", "documents"], ["strategy", "06-strategy", "strategy"],
  ["watch", "07-to-watch", "watchItems"], ["chronology", "08-chronology", "chronology"], ["relationships", "09-relationships", "relationships"],
  ["ledger", "10-ledger", "ledger"], ["sequenceGroups", "11-sequence-groups", "sequenceGroups"],
];

export function splitSectionPayload(baseName, payload, recordKey, targetBytes = DEFAULT_JSON_TARGET_BYTES) {
  const whole = serializeSplitReasoningJson(payload);
  if (!recordKey || utf8ByteSize(whole) <= targetBytes) return [{ filename: `${baseName}.json`, payload, oversizedRecordWarning: false }];
  const source = payload[recordKey] || [];
  const shared = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== recordKey));
  const parts = [];
  let current = [];
  for (const record of source) {
    const candidate = { ...shared, part: parts.length + 1, [recordKey]: [...current, record] };
    if (current.length && utf8ByteSize(candidate) > targetBytes) { parts.push(current); current = [record]; } else current.push(record);
  }
  if (current.length || !parts.length) parts.push(current);
  return parts.map((partRecords, index) => {
    const partPayload = { ...shared, part: index + 1, partCount: parts.length, [recordKey]: partRecords };
    return { filename: `${baseName}-part-${String(index + 1).padStart(2, "0")}.json`, payload: partPayload, oversizedRecordWarning: partRecords.length === 1 && utf8ByteSize(partPayload) > targetBytes };
  });
}

export function buildSplitReasoningPackageFiles(caseItem, options = {}) {
  const targetBytes = options.targetBytes || DEFAULT_JSON_TARGET_BYTES;
  const exportedAt = options.exportedAt || new Date().toISOString();
  const sections = projectSplitReasoningSections(caseItem, { ...options, exportedAt });
  const entries = SECTION_FILES.flatMap(([key, base, recordKey]) => splitSectionPayload(base, sections[key], recordKey, targetBytes));
  const counts = Object.fromEntries(SECTION_FILES.map(([key, , recordKey]) => [key, recordKey ? (sections[key][recordKey] || []).length : 1]));
  const inventory = entries.map((entry) => ({ filename: entry.filename, byteSize: utf8ByteSize(entry.payload), ...(entry.payload.partCount ? { part: entry.payload.part, partCount: entry.payload.partCount } : {}), ...(entry.oversizedRecordWarning ? { warning: "One complete record exceeds the target size and occupies this file alone." } : {}) }));
  const readme = {
    packageFormat: "ProveIt Reasoning Package — Split Case Files", packageVersion: SPLIT_REASONING_PACKAGE_VERSION,
    caseId: caseItem.id, caseTitle: caseItem.name || caseItem.title || "", exportedAt,
    instructions: ["All JSON files in this ZIP form one complete case and must be considered together.", "Do not treat the case as complete until every listed file has been supplied."],
    exclusions: ["Attachment binaries are excluded.", "This package is context only and is not an importable ProveIt backup."],
    orderedFiles: ["00-READ-ME.json", ...inventory.map((item) => item.filename)], recordCounts: counts, files: inventory,
  };
  return [{ filename: "00-READ-ME.json", payload: readme }, ...entries].map((entry) => ({ ...entry, json: serializeSplitReasoningJson(entry.payload), byteSize: utf8ByteSize(entry.payload) }));
}

export async function generateSplitReasoningPackageZip(caseItem, options = {}) {
  const files = buildSplitReasoningPackageFiles(caseItem, options);
  const zip = new JSZip();
  for (const file of files) zip.file(file.filename, file.json);
  const type = options.outputType || (typeof Blob === "undefined" ? "uint8array" : "blob");
  return { files, data: await zip.generateAsync({ type, compression: "DEFLATE", compressionOptions: { level: 6 } }) };
}

export async function downloadSplitReasoningPackage(caseItem, options = {}) {
  const result = await generateSplitReasoningPackageZip(caseItem, { ...options, outputType: "blob" });
  const url = URL.createObjectURL(result.data);
  const anchor = document.createElement("a");
  const safeName = String(caseItem.name || caseItem.title || caseItem.id || "case").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "case";
  anchor.href = url; anchor.download = `proveit-reasoning-package-${safeName}.zip`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  return result;
}
