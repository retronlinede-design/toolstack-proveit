// ProveIt storage architecture
// - cases store is the single source of truth for all case records
// - images store is used only for attachment/file binary storage
// - evidence store is legacy/transitional and is not the canonical source
// - all live case updates must end in saveCase(updatedCase)

import { STORE_NAMES } from "./dbConstants.js";

export const CORE_CASE_ARRAY_FIELDS = ["incidents", "evidence", "documents", "ledger", "strategy"];
export const EMERGENCY_BACKUP_PREFIX = "toolstack.proveit.v1.emergencyBackup.";

async function getDb() {
  const { dbPromise } = await import("./db.js");
  return dbPromise;
}

export function getCaseCoreCounts(caseItem = {}) {
  return CORE_CASE_ARRAY_FIELDS.reduce((counts, field) => {
    counts[field] = Array.isArray(caseItem?.[field]) ? caseItem[field].length : 0;
    return counts;
  }, {});
}

export function hasSuspiciousCoreArrayShrink(existingCase, incomingCase) {
  if (!existingCase || !incomingCase?.id) return false;
  return CORE_CASE_ARRAY_FIELDS.some((field) => {
    const existingCount = Array.isArray(existingCase?.[field]) ? existingCase[field].length : 0;
    if (existingCount === 0) return false;
    const incomingCount = Array.isArray(incomingCase?.[field]) ? incomingCase[field].length : 0;
    return incomingCount === 0;
  });
}

function getStackTrace() {
  try {
    return new Error().stack || "";
  } catch {
    return "";
  }
}

function logDestructiveOperation(operation, details = {}) {
  console.warn("[ProveIt persistence]", {
    operation,
    ...details,
    stack: getStackTrace(),
  });
}

export function writeEmergencyBackupSnapshot({
  operation = "unknown",
  cases = [],
  beforeCounts = null,
  afterCounts = null,
  caseId = "",
} = {}) {
  const sourceCases = Array.isArray(cases) ? cases : [];
  if (sourceCases.length === 0) return null;

  const timestamp = new Date().toISOString();
  const snapshot = {
    type: "PROVEIT_EMERGENCY_BACKUP",
    operation,
    timestamp,
    caseId,
    caseCount: sourceCases.length,
    beforeCounts,
    afterCounts,
    cases: sourceCases,
  };

  try {
    const key = `${EMERGENCY_BACKUP_PREFIX}${timestamp}.${operation}`;
    localStorage.setItem(key, JSON.stringify(snapshot));
    return { key, snapshot };
  } catch (error) {
    console.warn("[ProveIt persistence] emergency backup failed", {
      operation,
      caseId,
      error,
      stack: getStackTrace(),
    });
    return null;
  }
}

export async function createEmergencyBackupFromDb(operation, { caseId = "", beforeCounts = null, afterCounts = null } = {}) {
  try {
    const cases = await getAllCases();
    return writeEmergencyBackupSnapshot({ operation, cases, caseId, beforeCounts, afterCounts });
  } catch (error) {
    console.warn("[ProveIt persistence] could not read cases for emergency backup", {
      operation,
      caseId,
      error,
      stack: getStackTrace(),
    });
    return null;
  }
}

async function createEmergencyBackupFromOpenDb(db, operation, { caseId = "", beforeCounts = null, afterCounts = null } = {}) {
  try {
    const cases = await db.getAll(STORE_NAMES.cases);
    return writeEmergencyBackupSnapshot({ operation, cases, caseId, beforeCounts, afterCounts });
  } catch (error) {
    console.warn("[ProveIt persistence] could not read cases for emergency backup", {
      operation,
      caseId,
      error,
      stack: getStackTrace(),
    });
    return null;
  }
}

export async function getAllCases() {
  const db = await getDb();
  return db.getAll(STORE_NAMES.cases);
}

export async function saveCaseToDb(db, caseItem, options = {}) {
  const operation = options.operation || "saveCase";
  const existingCase = caseItem?.id ? await db.get(STORE_NAMES.cases, caseItem.id) : null;
  const beforeCounts = getCaseCoreCounts(existingCase);
  const afterCounts = getCaseCoreCounts(caseItem);
  const suspiciousShrink = hasSuspiciousCoreArrayShrink(existingCase, caseItem);

  logDestructiveOperation(operation, {
    caseId: caseItem?.id || "",
    beforeCounts,
    afterCounts,
    suspiciousShrink,
    override: options.allowSuspiciousOverwrite === true,
  });

  if (suspiciousShrink && options.allowSuspiciousOverwrite !== true) {
    await createEmergencyBackupFromOpenDb(db, `${operation}:blocked-suspicious-overwrite`, {
      caseId: caseItem.id,
      beforeCounts,
      afterCounts,
    });
    const error = new Error("Blocked suspicious ProveIt case overwrite: incoming case would erase non-empty core data arrays.");
    console.warn("[ProveIt persistence] blocked suspicious case overwrite", {
      operation,
      caseId: caseItem.id,
      beforeCounts,
      afterCounts,
      stack: getStackTrace(),
    });
    throw error;
  }

  if (suspiciousShrink) {
    await createEmergencyBackupFromOpenDb(db, `${operation}:allowed-suspicious-overwrite`, {
      caseId: caseItem.id,
      beforeCounts,
      afterCounts,
    });
  }

  return db.put(STORE_NAMES.cases, caseItem);
}

export async function saveCase(caseItem, options = {}) {
  const db = await getDb();
  return saveCaseToDb(db, caseItem, options);
}

function collectAttachmentImageIds(attachments, imageIds) {
  if (!Array.isArray(attachments)) return;

  for (const attachment of attachments) {
    const imageId = attachment?.storage?.imageId;
    if (imageId) imageIds.add(imageId);
  }
}

export function collectEmbeddedCaseImageIds(caseItem) {
  const imageIds = new Set();
  if (!caseItem || typeof caseItem !== "object") return imageIds;

  for (const recordType of ["evidence", "incidents", "tasks", "strategy"]) {
    const records = Array.isArray(caseItem[recordType]) ? caseItem[recordType] : [];
    for (const record of records) {
      collectAttachmentImageIds(record?.attachments, imageIds);

      if (recordType === "evidence") {
        collectAttachmentImageIds(record?.availability?.digital?.files, imageIds);
      }
    }
  }

  const documents = Array.isArray(caseItem.documents) ? caseItem.documents : [];
  for (const document of documents) {
    collectAttachmentImageIds(document?.attachments, imageIds);
  }

  return imageIds;
}

export async function deleteCaseFromDb(db, caseId) {
  const caseItem = await db.get(STORE_NAMES.cases, caseId);
  const candidateImageIds = collectEmbeddedCaseImageIds(caseItem);
  const deletedImageIds = new Set();

  const evidenceItems = await db.getAllFromIndex(STORE_NAMES.evidence, "caseId", caseId);
  for (const item of evidenceItems) {
    const images = await db.getAllFromIndex(STORE_NAMES.images, "evidenceId", item.id);
    for (const img of images) {
      await db.delete(STORE_NAMES.images, img.id);
      deletedImageIds.add(img.id);
    }
    await db.delete(STORE_NAMES.evidence, item.id);
  }

  await db.delete(STORE_NAMES.cases, caseId);

  if (candidateImageIds.size === 0) return;

  const remainingReferencedImageIds = new Set();
  const remainingCases = await db.getAll(STORE_NAMES.cases);
  for (const remainingCase of remainingCases) {
    for (const imageId of collectEmbeddedCaseImageIds(remainingCase)) {
      remainingReferencedImageIds.add(imageId);
    }
  }

  for (const imageId of candidateImageIds) {
    if (deletedImageIds.has(imageId)) continue;
    if (remainingReferencedImageIds.has(imageId)) continue;
    await db.delete(STORE_NAMES.images, imageId);
  }
}

export async function deleteCase(caseId) {
  await createEmergencyBackupFromDb("deleteCase:before", { caseId });
  logDestructiveOperation("deleteCase", { caseId });
  const db = await getDb();
  return deleteCaseFromDb(db, caseId);
}

// Legacy/transitional helpers.
// These are not the canonical case record path.
// Embedded case records in the cases store are the source of truth.

export async function getEvidenceByCase(caseId) {
  const db = await getDb();
  return db.getAllFromIndex(STORE_NAMES.evidence, "caseId", caseId);
}

export async function saveEvidence(evidenceItem) {
  const db = await getDb();
  return db.put(STORE_NAMES.evidence, evidenceItem);
}

export async function deleteEvidence(evidenceId) {
  const db = await getDb();

  const images = await db.getAllFromIndex(STORE_NAMES.images, "evidenceId", evidenceId);
  for (const img of images) {
    await db.delete(STORE_NAMES.images, img.id);
  }

  await db.delete(STORE_NAMES.evidence, evidenceId);
}

export async function getImagesByEvidence(evidenceId) {
  const db = await getDb();
  return db.getAllFromIndex(STORE_NAMES.images, "evidenceId", evidenceId);
}

export async function saveImage(imageItem) {
  const db = await getDb();
  return db.put(STORE_NAMES.images, imageItem);
}

export async function deleteImage(imageId) {
  const db = await getDb();
  return db.delete(STORE_NAMES.images, imageId);
}

export async function deleteImages(imageIds = []) {
  const uniqueImageIds = [...new Set((imageIds || []).filter(Boolean))];
  for (const imageId of uniqueImageIds) {
    await deleteImage(imageId);
  }
}

export async function getImageById(id) {
  const db = await getDb();
  return db.get(STORE_NAMES.images, id);
}
