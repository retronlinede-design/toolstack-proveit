// ProveIt storage architecture
// - cases store is the single source of truth for all case records
// - images store is used only for attachment/file binary storage
// - evidence store is legacy/transitional and is not the canonical source
// - all live case updates must end in saveCase(updatedCase)


import { dbPromise } from "./db";

export async function getAllCases() {
  const db = await dbPromise;
  return db.getAll("cases");
}

export async function saveCase(caseItem) {
  const db = await dbPromise;
  return db.put("cases", caseItem);
}

export async function deleteCase(caseId) {
  const db = await dbPromise;

  const evidenceItems = await db.getAllFromIndex("evidence", "caseId", caseId);
  for (const item of evidenceItems) {
    const images = await db.getAllFromIndex("images", "evidenceId", item.id);
    for (const img of images) {
      await db.delete("images", img.id);
    }
    await db.delete("evidence", item.id);
  }

  await db.delete("cases", caseId);
}

// Legacy/transitional helpers.
// These are not the canonical case record path.
// Embedded case records in the cases store are the source of truth.

export async function getEvidenceByCase(caseId) {
  const db = await dbPromise;
  return db.getAllFromIndex("evidence", "caseId", caseId);
}

export async function saveEvidence(evidenceItem) {
  const db = await dbPromise;
  return db.put("evidence", evidenceItem);
}

export async function deleteEvidence(evidenceId) {
  const db = await dbPromise;

  const images = await db.getAllFromIndex("images", "evidenceId", evidenceId);
  for (const img of images) {
    await db.delete("images", img.id);
  }

  await db.delete("evidence", evidenceId);
}

export async function getImagesByEvidence(evidenceId) {
  const db = await dbPromise;
  return db.getAllFromIndex("images", "evidenceId", evidenceId);
}

export async function saveImage(imageItem) {
  const db = await dbPromise;
  return db.put("images", imageItem);
}

export async function deleteImage(imageId) {
  const db = await dbPromise;
  return db.delete("images", imageId);
}

export async function getImageById(id) {
  const db = await dbPromise;
  return db.get("images", id);
}
