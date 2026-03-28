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