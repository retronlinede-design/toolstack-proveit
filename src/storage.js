// ProveIt storage architecture
// - cases store is the single source of truth for all case records
// - images store is used only for attachment/file binary storage
// - evidence store is legacy/transitional and is not the canonical source
// - all live case updates must end in saveCase(updatedCase)

import { STORE_NAMES } from "./dbConstants.js";
import { getCaseRevision, INITIAL_CASE_REVISION } from "./domain/caseRevision.js";

export const CORE_CASE_ARRAY_FIELDS = ["incidents", "evidence", "documents", "ledger", "strategy", "watchItems", "tasks", "goals"];
export const EMERGENCY_BACKUP_PREFIX = "toolstack.proveit.v1.emergencyBackup.";

export class CaseRevisionConflictError extends Error {
  constructor({ caseId, expectedRevision, actualRevision, operation }) {
    super(`Case save conflict: case ${caseId} is at revision ${actualRevision}, but this change was based on revision ${expectedRevision}. Refresh the case and try again.`);
    this.name = "CaseRevisionConflictError";
    this.code = "CASE_REVISION_CONFLICT";
    this.caseId = caseId;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
    this.operation = operation;
  }
}

function prepareCommittedCase(existingCase, caseItem, options = {}) {
  const operation = options.operation || "saveCase";
  const expectedRevision = getCaseRevision(caseItem);
  const actualRevision = getCaseRevision(existingCase);

  if (actualRevision != null && expectedRevision !== actualRevision) {
    throw new CaseRevisionConflictError({ caseId: caseItem.id, expectedRevision, actualRevision, operation });
  }

  const beforeCounts = getCaseCoreCounts(existingCase);
  const afterCounts = getCaseCoreCounts(caseItem);
  const suspiciousShrink = hasSuspiciousCoreArrayShrink(existingCase, caseItem);
  logDestructiveOperation(operation, { caseId: caseItem?.id || "", beforeCounts, afterCounts, suspiciousShrink, override: options.allowSuspiciousOverwrite === true });

  if (suspiciousShrink) {
    writeEmergencyBackupSnapshot({
      operation: `${operation}:${options.allowSuspiciousOverwrite === true ? "allowed" : "blocked"}-suspicious-overwrite`,
      cases: existingCase ? [existingCase] : [], caseId: caseItem.id, beforeCounts, afterCounts,
    });
    if (options.allowSuspiciousOverwrite !== true) {
      const error = new Error("Blocked suspicious ProveIt case overwrite: incoming case would erase non-empty core data arrays.");
      console.warn("[ProveIt persistence] blocked suspicious case overwrite", { operation, caseId: caseItem.id, beforeCounts, afterCounts, stack: getStackTrace() });
      throw error;
    }
  }

  const previousImageIds = collectEmbeddedCaseImageIds(existingCase);
  const committedImageIds = collectEmbeddedCaseImageIds(caseItem);
  return {
    committedCase: { ...caseItem, revision: getCommittedCaseRevision(existingCase, caseItem) },
    candidateImageIds: [...previousImageIds].filter((imageId) => !committedImageIds.has(imageId)),
  };
}

async function deleteUnreferencedImageCandidates(caseStore, imageStore, candidateImageIds) {
  if (!imageStore || candidateImageIds.size === 0) return;
  const referencedImageIds = new Set();
  const persistedCases = await caseStore.getAll();
  for (const persistedCase of persistedCases) {
    for (const imageId of collectEmbeddedCaseImageIds(persistedCase)) referencedImageIds.add(imageId);
  }
  for (const imageId of candidateImageIds) {
    if (!referencedImageIds.has(imageId)) await imageStore.delete(imageId);
  }
}

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

function stableCaseValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableCaseValue);
  return Object.fromEntries(Object.keys(value).sort().filter((key) => key !== "revision").map((key) => [key, stableCaseValue(value[key])]));
}

function hasMaterialCaseChange(existingCase, incomingCase) {
  return JSON.stringify(stableCaseValue(existingCase)) !== JSON.stringify(stableCaseValue(incomingCase));
}

export function getCommittedCaseRevision(existingCase, incomingCase) {
  const existingRevision = getCaseRevision(existingCase);
  if (existingRevision == null) return getCaseRevision(incomingCase) || INITIAL_CASE_REVISION;
  return existingRevision + (hasMaterialCaseChange(existingCase, incomingCase) ? 1 : 0);
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

export async function getAllCases() {
  const db = await getDb();
  return db.getAll(STORE_NAMES.cases);
}

export async function saveCaseToDb(db, caseItem, options = {}) {
  const save = async (caseStore, imageStore) => {
    const existingCase = caseItem?.id ? await caseStore.get(caseItem.id) : null;
    const { committedCase, candidateImageIds } = prepareCommittedCase(existingCase, caseItem, options);
    await caseStore.put(committedCase);
    await deleteUnreferencedImageCandidates(caseStore, imageStore, new Set(candidateImageIds));
    return committedCase;
  };

  let committedCase;
  if (typeof db.transaction === "function") {
    const tx = db.transaction([STORE_NAMES.cases, STORE_NAMES.images], "readwrite");
    try {
      committedCase = await save(
        tx.objectStore(STORE_NAMES.cases),
        tx.objectStore(STORE_NAMES.images)
      );
      await tx.done;
    } catch (error) {
      // A thrown application-level error after put() does not necessarily abort
      // an IndexedDB transaction. Abort explicitly so the case and binaries
      // always commit or roll back together.
      try { tx.abort(); } catch { /* already completed or aborted */ }
      try { await tx.done; } catch { /* preserve the originating error */ }
      throw error;
    }
  } else {
    // Test doubles retain the same conflict contract; production IndexedDB uses
    // the readwrite transaction above to make the read/check/put atomic.
    committedCase = await save(
      {
        get: (id) => db.get(STORE_NAMES.cases, id),
        getAll: () => db.getAll(STORE_NAMES.cases),
        put: (item) => db.put(STORE_NAMES.cases, item),
      },
      { delete: (id) => db.delete(STORE_NAMES.images, id) }
    );
  }
  // Callers hold the canonical in-memory instance and use it immediately after
  // persistence. Reflect the committed revision without adding another save path.
  Object.assign(caseItem, committedCase);
  return caseItem.id;
}

export async function saveCase(caseItem, options = {}) {
  const db = await getDb();
  return saveCaseToDb(db, caseItem, options);
}

// Full-backup restore uses this boundary after all parsing, attachment remapping,
// and merge preparation has finished. Do not await unrelated work inside the
// transaction: every request below targets the active cases/images transaction.
export async function saveCasesAndImagesToDb(db, caseItems = [], imageItems = [], options = {}) {
  const cases = Array.isArray(caseItems) ? caseItems : [];
  const images = Array.isArray(imageItems) ? imageItems : [];
  const ids = cases.map((caseItem) => caseItem?.id).filter(Boolean);
  if (ids.length !== cases.length || new Set(ids).size !== ids.length) {
    throw new Error("Atomic restore requires each case to have a unique id.");
  }
  if (typeof db.transaction !== "function") {
    throw new Error("Atomic restore requires IndexedDB transaction support.");
  }

  const tx = db.transaction([STORE_NAMES.cases, STORE_NAMES.images], "readwrite");
  try {
    const caseStore = tx.objectStore(STORE_NAMES.cases);
    const imageStore = tx.objectStore(STORE_NAMES.images);
    const existingCases = await Promise.all(cases.map((caseItem) => caseStore.get(caseItem.id)));
    const prepared = cases.map((caseItem, index) => prepareCommittedCase(existingCases[index], caseItem, options));

    // Insert-only attachment writes preserve collision safety. Any failure aborts
    // this transaction before a restored case can become visible.
    for (const imageItem of images) await imageStore.add(imageItem);
    for (const item of prepared) await caseStore.put(item.committedCase);

    const candidateImageIds = new Set(prepared.flatMap((item) => item.candidateImageIds));
    await deleteUnreferencedImageCandidates(caseStore, imageStore, candidateImageIds);
    await tx.done;

    prepared.forEach((item, index) => Object.assign(cases[index], item.committedCase));
    return cases.map((caseItem) => caseItem.id);
  } catch (error) {
    try { tx.abort(); } catch { /* already completed or aborted */ }
    try { await tx.done; } catch { /* preserve the originating error */ }
    throw error;
  }
}

export async function saveCasesAndImages(caseItems = [], imageItems = [], options = {}) {
  return saveCasesAndImagesToDb(await getDb(), caseItems, imageItems, options);
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

  for (const recordType of ["evidence", "incidents", "tasks", "strategy", "watchItems"]) {
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

// Restore must use insert-only semantics, including on an unexpected ID collision.
export async function addImageToDb(db, imageItem) {
  return db.add(STORE_NAMES.images, imageItem);
}

export async function addImage(imageItem) {
  return addImageToDb(await getDb(), imageItem);
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
