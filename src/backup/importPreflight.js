const CASE_COLLECTIONS = ["incidents", "evidence", "documents", "ledger", "strategy", "watchItems", "tasks", "parties", "issues"];
const SUPPORTED_EXPORT_TYPES = new Set(["FULL_BACKUP_ALL", "FULL_BACKUP_CASE"]);
const SUPPORTED_CONTRACT_VERSION = "2.0";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function invalid(message) {
  return { ok: false, reason: message };
}

function validateCaseShape(caseItem, index, existingCaseIds) {
  const label = `cases[${index}]`;
  if (!isObject(caseItem)) return `${label} must be an object.`;
  if (!text(caseItem.id)) return `${label}.id is required.`;
  if (!existingCaseIds.has(text(caseItem.id)) && !text(caseItem.name) && !text(caseItem.title)) return `${label} must include a name or title when creating a case.`;
  for (const collection of CASE_COLLECTIONS) {
    if (!Object.hasOwn(caseItem, collection)) continue;
    if (!Array.isArray(caseItem[collection])) return `${label}.${collection} must be an array when supplied.`;
    for (const [recordIndex, record] of caseItem[collection].entries()) {
      if (!isObject(record) || !text(record.id)) return `${label}.${collection}[${recordIndex}].id is required.`;
    }
  }
  return "";
}

export function preflightBackupPayload(payload, { existingCaseIds = [] } = {}) {
  if (!isObject(payload)) return invalid("Invalid import file: expected a JSON object.");
  if (payload.exportType === "CASE_REASONING_EXPORT" || payload.importable === false) return invalid("This is a reasoning export and not an importable backup.");

  const exportType = text(payload.exportType);
  const app = text(payload.app);
  const contractVersion = text(payload.contractVersion);
  const legacyVersion = text(payload.version);
  if (app && app !== "proveit") return invalid("Unsupported import app.");
  if (exportType) {
    if (!SUPPORTED_EXPORT_TYPES.has(exportType)) return invalid("Unsupported ProveIt export type.");
    if (app !== "proveit" || contractVersion !== SUPPORTED_CONTRACT_VERSION) return invalid(`Unsupported ProveIt backup contract version: ${contractVersion || "missing"}.`);
  } else if (app || contractVersion) {
    return invalid("Unsupported or incomplete ProveIt backup envelope.");
  } else {
    if (legacyVersion && legacyVersion !== "2.1-full-backup") return invalid(`Unsupported legacy backup version: ${legacyVersion}.`);
    if (payload.type && payload.type !== "FULL_BACKUP") return invalid(`Unsupported legacy backup type: ${text(payload.type) || "invalid"}.`);
  }

  const data = Object.hasOwn(payload, "data") ? payload.data : payload;
  if (!isObject(data) || !Array.isArray(data.cases)) return invalid("Invalid import file: data.cases must be an array.");
  if (exportType === "FULL_BACKUP_CASE" && data.cases.length !== 1) return invalid("Invalid full case backup. Expected exactly one case.");
  if (Object.hasOwn(data, "quickCaptures") && !Array.isArray(data.quickCaptures)) return invalid("Invalid import file: data.quickCaptures must be an array when supplied.");
  if (Object.hasOwn(data, "folders") && !Array.isArray(data.folders)) return invalid("Invalid import file: data.folders must be an array when supplied.");

  const existing = new Set(existingCaseIds.map(String));
  const caseIds = new Set();
  for (const [index, caseItem] of data.cases.entries()) {
    const error = validateCaseShape(caseItem, index, existing);
    if (error) return invalid(`Invalid import file: ${error}`);
    const id = text(caseItem.id);
    if (caseIds.has(id)) return invalid(`Invalid import file: duplicate case id ${id}.`);
    caseIds.add(id);
  }

  const isFullBackup = Boolean(exportType) || legacyVersion === "2.1-full-backup" || payload.includesBinaryData === true;
  return { ok: true, data, exportType: exportType || null, isFullBackup, shouldImportQuickCaptures: exportType !== "FULL_BACKUP_CASE" };
}

export function validateStoredCaseForNormalization(caseItem) {
  if (!isObject(caseItem) || !text(caseItem.id)) return invalid("Stored case is missing an id.");
  if (!text(caseItem.name) && !text(caseItem.title)) return invalid(`Stored case ${caseItem.id} is missing a name or title.`);
  const shapeError = validateCaseShape(caseItem, 0, new Set([text(caseItem.id)]));
  if (shapeError) return invalid(`Stored case ${caseItem.id} is malformed: ${shapeError}`);
  return { ok: true };
}
