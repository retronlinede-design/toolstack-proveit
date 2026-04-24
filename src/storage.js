// ProveIt storage architecture
// - cases store is the single source of truth for all case records
// - images store is used only for attachment/file binary storage
// - evidence store is legacy/transitional and is not the canonical source
// - all live case updates must end in saveCase(updatedCase)

async function getDb() {
  const { dbPromise } = await import("./db.js");
  return dbPromise;
}

export async function getAllCases() {
  const db = await getDb();
  return db.getAll("cases");
}

export async function saveCase(caseItem) {
  const db = await getDb();
  return db.put("cases", caseItem);
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
  const caseItem = await db.get("cases", caseId);
  const candidateImageIds = collectEmbeddedCaseImageIds(caseItem);
  const deletedImageIds = new Set();

  const evidenceItems = await db.getAllFromIndex("evidence", "caseId", caseId);
  for (const item of evidenceItems) {
    const images = await db.getAllFromIndex("images", "evidenceId", item.id);
    for (const img of images) {
      await db.delete("images", img.id);
      deletedImageIds.add(img.id);
    }
    await db.delete("evidence", item.id);
  }

  await db.delete("cases", caseId);

  if (candidateImageIds.size === 0) return;

  const remainingReferencedImageIds = new Set();
  const remainingCases = await db.getAll("cases");
  for (const remainingCase of remainingCases) {
    for (const imageId of collectEmbeddedCaseImageIds(remainingCase)) {
      remainingReferencedImageIds.add(imageId);
    }
  }

  for (const imageId of candidateImageIds) {
    if (deletedImageIds.has(imageId)) continue;
    if (remainingReferencedImageIds.has(imageId)) continue;
    await db.delete("images", imageId);
  }
}

export async function deleteCase(caseId) {
  const db = await getDb();
  return deleteCaseFromDb(db, caseId);
}

// Legacy/transitional helpers.
// These are not the canonical case record path.
// Embedded case records in the cases store are the source of truth.

export async function getEvidenceByCase(caseId) {
  const db = await getDb();
  return db.getAllFromIndex("evidence", "caseId", caseId);
}

export async function saveEvidence(evidenceItem) {
  const db = await getDb();
  return db.put("evidence", evidenceItem);
}

export async function deleteEvidence(evidenceId) {
  const db = await getDb();

  const images = await db.getAllFromIndex("images", "evidenceId", evidenceId);
  for (const img of images) {
    await db.delete("images", img.id);
  }

  await db.delete("evidence", evidenceId);
}

export async function getImagesByEvidence(evidenceId) {
  const db = await getDb();
  return db.getAllFromIndex("images", "evidenceId", evidenceId);
}

export async function saveImage(imageItem) {
  const db = await getDb();
  return db.put("images", imageItem);
}

export async function deleteImage(imageId) {
  const db = await getDb();
  return db.delete("images", imageId);
}

export async function deleteImages(imageIds = []) {
  const uniqueImageIds = [...new Set((imageIds || []).filter(Boolean))];
  for (const imageId of uniqueImageIds) {
    await deleteImage(imageId);
  }
}

export async function getImageById(id) {
  const db = await getDb();
  return db.get("images", id);
}
