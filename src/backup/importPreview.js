import { preflightBackupPayload } from "./importPreflight.js";
import { mergeImportedCases } from "../domain/caseImport.js";

const RECORD_COLLECTIONS = [
  "incidents",
  "evidence",
  "documents",
  "ledger",
  "strategy",
  "watchItems",
  "tasks",
  "parties",
  "issues",
];

const ATTACHMENT_COLLECTIONS = ["evidence", "incidents", "documents", "strategy", "watchItems", "tasks"];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value) {
  let hash = 0x811c9dc5;
  for (const character of stableStringify(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sortedSnapshotCollection(values) {
  return [...(Array.isArray(values) ? values : [])].sort((left, right) => String(left?.id || "").localeCompare(String(right?.id || "")));
}

function snapshotPart(values) {
  const normalized = sortedSnapshotCollection(values);
  return { count: normalized.length, fingerprint: fingerprint(normalized) };
}

function normalizeSnapshot(snapshot = {}) {
  return {
    cases: Array.isArray(snapshot.cases) ? snapshot.cases : [],
    folders: Array.isArray(snapshot.folders) ? snapshot.folders : [],
    quickCaptures: Array.isArray(snapshot.quickCaptures) ? snapshot.quickCaptures : [],
  };
}

export function createImportPreviewBaseline(snapshot = {}) {
  const state = normalizeSnapshot(snapshot);
  return {
    algorithm: "fnv1a32-stable-json-v1",
    cases: snapshotPart(state.cases),
    folders: snapshotPart(state.folders),
    quickCaptures: snapshotPart(state.quickCaptures),
  };
}

export function matchesImportPreviewBaseline(baseline, snapshot = {}) {
  if (!baseline || baseline.algorithm !== "fnv1a32-stable-json-v1") return false;
  const current = createImportPreviewBaseline(snapshot);
  return ["cases", "folders", "quickCaptures"].every((key) => baseline[key]?.count === current[key].count && baseline[key]?.fingerprint === current[key].fingerprint);
}

function formatSummary(payload, preflight) {
  if (!preflight.ok) return { importable: false, label: "Unsupported or invalid backup" };
  if (preflight.exportType === "FULL_BACKUP_ALL") return { importable: true, label: "Full App Backup v2.0", exportType: preflight.exportType, contractVersion: "2.0", legacy: false };
  if (preflight.exportType === "FULL_BACKUP_CASE") return { importable: true, label: "Full Case Backup v2.0", exportType: preflight.exportType, contractVersion: "2.0", legacy: false };
  if (payload?.version === "2.1-full-backup") return { importable: true, label: "Legacy Full Backup v2.1", exportType: null, contractVersion: null, legacy: true };
  return { importable: true, label: "Legacy or unversioned backup", exportType: null, contractVersion: null, legacy: true };
}

function emptyRecordCounts() {
  return Object.fromEntries(RECORD_COLLECTIONS.map((collection) => [collection, { additions: 0, matching: 0 }]));
}

function countRecords(incomingCases, currentById) {
  const counts = emptyRecordCounts();
  for (const incomingCase of incomingCases) {
    const current = currentById.get(String(incomingCase.id));
    for (const collection of RECORD_COLLECTIONS) {
      for (const record of Array.isArray(incomingCase[collection]) ? incomingCase[collection] : []) {
        const existing = Array.isArray(current?.[collection]) && current[collection].some((item) => String(item?.id) === String(record?.id));
        counts[collection][existing ? "matching" : "additions"] += 1;
      }
    }
  }
  return counts;
}

function countReplacementSignals(current, incoming) {
  let sparseFields = 0;
  let explicitEmptyValues = 0;
  const visited = new WeakSet();
  const inspectEmpties = (value, key = "") => {
    if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      if (key !== "id") explicitEmptyValues += 1;
    }
    if (!isObject(value) && !Array.isArray(value)) return;
    if (visited.has(value)) return;
    visited.add(value);
    for (const [childKey, childValue] of Object.entries(value)) inspectEmpties(childValue, childKey);
  };
  const compare = (existing, supplied) => {
    if (!isObject(existing) || !isObject(supplied)) return;
    for (const key of Object.keys(existing)) {
      if (key !== "id" && !Object.hasOwn(supplied, key)) sparseFields += 1;
    }
  };
  for (const incomingCase of incoming) {
    const existingCase = current.get(String(incomingCase.id));
    if (!existingCase) continue;
    compare(existingCase, incomingCase);
    inspectEmpties(incomingCase);
    for (const collection of RECORD_COLLECTIONS) {
      const existingRecords = new Map((existingCase[collection] || []).map((record) => [String(record?.id), record]));
      for (const record of incomingCase[collection] || []) compare(existingRecords.get(String(record?.id)), record);
    }
  }
  return { sparseFields, explicitEmptyValues };
}

function attachmentSummary(payload, data, includeQuickCaptures) {
  let referenceCount = 0;
  let embeddedPayloadReferenceCount = 0;
  const inspect = (attachment) => {
    if (!isObject(attachment)) return;
    referenceCount += 1;
    if (typeof attachment.backupDataUrl === "string" && attachment.backupDataUrl) embeddedPayloadReferenceCount += 1;
  };
  const inspectRecord = (record) => {
    for (const attachment of record?.attachments || []) inspect(attachment);
    for (const attachment of record?.availability?.digital?.files || []) inspect(attachment);
  };
  for (const caseItem of data.cases || []) {
    for (const collection of ATTACHMENT_COLLECTIONS) for (const record of caseItem[collection] || []) inspectRecord(record);
  }
  if (includeQuickCaptures) for (const capture of data.quickCaptures || []) for (const attachment of capture.attachments || []) inspect(attachment);

  const declared = isObject(payload?.binaryData) ? payload.binaryData : (isObject(data?.binaryData) ? data.binaryData : null);
  return {
    declared: declared ? {
      expected: Number.isFinite(declared.expected) ? declared.expected : null,
      included: Number.isFinite(declared.included) ? declared.included : null,
      missing: Number.isFinite(declared.missing) ? declared.missing : null,
      failed: Number.isFinite(declared.failed) ? declared.failed : null,
      complete: typeof declared.complete === "boolean" ? declared.complete : null,
    } : null,
    referenceCount,
    embeddedPayloadReferenceCount,
    restorationGuaranteed: false,
  };
}

function folderSummary(payload, data, currentFolders) {
  const candidates = [
    [payload?.appData?.folders, "payload-app-data"],
    [data?.appData?.folders, "data-app-data"],
    [data?.folders, "data"],
  ];
  const [folders, source] = candidates.find(([value]) => Array.isArray(value)) || [[], "none"];
  return { currentCount: currentFolders.length, suppliedCount: folders.length, source };
}

function sequenceMetadataSummary(payload, data) {
  const metadata = payload?.appData?.sequenceGroupMeta || data?.appData?.sequenceGroupMeta || data?.sequenceGroupMeta;
  return { present: isObject(metadata), entryCount: isObject(metadata) ? Object.keys(metadata).length : 0 };
}

function warningsFor({ payload, preflight, replacementSignals, attachments, quickCaptures }) {
  const warnings = ["Supplied fields replace matching values; explicit empty values can replace current values where merge semantics apply."];
  if (replacementSignals.sparseFields) warnings.push(`Sparse patches omit ${replacementSignals.sparseFields} existing field${replacementSignals.sparseFields === 1 ? "" : "s"}; omitted fields are retained by the existing merge rules.`);
  if (replacementSignals.explicitEmptyValues) warnings.push(`${replacementSignals.explicitEmptyValues} explicit empty value${replacementSignals.explicitEmptyValues === 1 ? " is" : "s are"} supplied and may replace matching values.`);
  if (attachments.declared && (attachments.declared.complete === false || (attachments.declared.missing || 0) > 0 || (attachments.declared.failed || 0) > 0)) warnings.push("The backup declares incomplete or missing attachment binaries. Declared completeness does not guarantee restoration success.");
  if (preflight.isFullBackup && !attachments.declared) warnings.push("This full backup does not declare attachment completeness; attachment restoration cannot be confirmed from this preview.");
  if (quickCaptures.skippedBecauseCaseBackup) warnings.push("Quick captures in a selected-case backup are not imported by the existing restore workflow.");
  if (formatSummary(payload, preflight).legacy) warnings.push("Legacy backup compatibility applies; review the import carefully before confirmation.");
  return warnings;
}

export function buildImportPreview(payload, snapshot = {}) {
  const state = normalizeSnapshot(snapshot);
  const baseline = createImportPreviewBaseline(state);
  const currentCaseIds = state.cases.map((caseItem) => caseItem?.id).filter(Boolean);
  const preflight = preflightBackupPayload(payload, { existingCaseIds: currentCaseIds });
  const format = formatSummary(payload, preflight);
  if (!preflight.ok) {
    return { ok: false, validation: { ok: false, reason: preflight.reason }, format, baseline, warnings: [preflight.reason] };
  }

  const data = preflight.data;
  const currentCases = jsonClone(state.cases);
  const incomingCases = jsonClone(data.cases);
  const currentById = new Map(currentCases.map((caseItem) => [String(caseItem.id), caseItem]));
  const { normalizedCases } = mergeImportedCases(currentCases, incomingCases, jsonClone(data?.appData?.sequenceGroupMeta || payload?.appData?.sequenceGroupMeta || {}));
  const mergedById = new Map(normalizedCases.map((caseItem) => [String(caseItem.id), caseItem]));
  const incomingIds = new Set(incomingCases.map((caseItem) => String(caseItem.id)));
  const matching = incomingCases.filter((caseItem) => currentById.has(String(caseItem.id)));
  const changedExisting = matching.filter((caseItem) => stableStringify(currentById.get(String(caseItem.id))) !== stableStringify(mergedById.get(String(caseItem.id))));
  const quickCaptures = {
    currentCount: state.quickCaptures.length,
    suppliedCount: Array.isArray(data.quickCaptures) ? data.quickCaptures.length : 0,
    willImport: preflight.shouldImportQuickCaptures,
    skippedBecauseCaseBackup: !preflight.shouldImportQuickCaptures && Array.isArray(data.quickCaptures) && data.quickCaptures.length > 0,
  };
  const attachments = attachmentSummary(payload, data, preflight.shouldImportQuickCaptures);
  const replacementSignals = countReplacementSignals(currentById, incomingCases);

  return {
    ok: true,
    validation: { ok: true },
    format,
    baseline,
    cases: {
      incomingCount: incomingCases.length,
      newCount: incomingCases.length - matching.length,
      matchingCount: matching.length,
      untouchedCount: state.cases.filter((caseItem) => !incomingIds.has(String(caseItem.id))).length,
      changedExistingCount: changedExisting.length,
    },
    records: countRecords(incomingCases, currentById),
    attachments,
    folders: folderSummary(payload, data, state.folders),
    quickCaptures,
    sequenceMetadata: sequenceMetadataSummary(payload, data),
    warnings: warningsFor({ payload, preflight, replacementSignals, attachments, quickCaptures }),
  };
}
