import test from "node:test";
import assert from "node:assert/strict";
import { mergeCase } from "./caseDomain.js";
import { normalizeStoredCase } from "./caseNormalization.js";
import { mergeImportedCases } from "./caseImport.js";
import { restoreFullBackupCase } from "../backup/fullBackup.js";
import { createRestoreSession } from "../backup/restoreSession.js";
import { saveCaseToDb, addImageToDb } from "../storage.js";

const time = "2026-09-01T00:00:00.000Z";
function localCase() {
  return normalizeStoredCase({
    id: "case", name: "Current case", category: "housing", status: "closed", folderId: "folder",
    notes: "Case notes", description: "Case description", tags: ["local"], createdAt: time, updatedAt: time,
    generatedReportText: "Legacy report", generatedReportVersions: { en: "English", de: "Deutsch" }, activeGeneratedReportLanguage: "de",
    actionSummary: { currentFocus: "Focus", nextActions: ["Action"], importantReminders: ["Reminder"] },
    issues: [{ id: "issue-nine", reference: "ISS-009", name: "Heating", status: "resolved", priority: "high", purpose: "Resolution", createdAt: time, updatedAt: time },
      { id: "issue-only", reference: "ISS-012", name: "Metadata only", status: "monitoring", priority: "normal" }],
    nextIssueReferenceNumber: 41, retiredIssueReferences: ["ISS-040"], retiredIssues: [{ id: "retired", reference: "ISS-040", deletedAt: time }],
    evidence: [{ id: "e", title: "Evidence", description: "Rich", notes: "Record notes", edited: true, isMilestone: true,
      attachments: [{ id: "att", storage: { type: "indexeddb", imageId: "local-image" } }], linkedRecordIds: ["d"], tags: ["record-tag"],
      sequenceGroupId: "issue-nine", sequenceGroup: "Heating", createdAt: time, updatedAt: time,
      availability: { physical: { hasOriginal: true, location: "Cabinet", notes: "Original" }, digital: { hasDigital: true, files: [] } } },
      { id: "local-only", title: "Keep", createdAt: time, updatedAt: time }],
    incidents: [{ id: "i", description: "Incident details", createdAt: time, updatedAt: time }],
    tasks: [{ id: "t", notes: "Task details", createdAt: time, updatedAt: time }],
    strategy: [{ id: "s", objective: "Objective", ownerPartyId: "p", nextSteps: ["Next"], createdAt: time, updatedAt: time }],
    watchItems: [{ id: "w", watchFor: "Risk", observations: [{ id: "o", date: "2026-09-01", text: "Observed", createdAt: time }], createdAt: time, updatedAt: time }],
    parties: [{ id: "p", displayName: "Owner", roles: ["witness"], contact: { email: "synthetic@example.invalid", phone: "123" }, createdAt: time, updatedAt: time }],
    documents: [{ id: "d", textContent: "Document text", attachments: [{ id: "doc-att" }], createdAt: time, updatedAt: time }],
    ledger: [{ id: "l", expectedAmount: 100, paidAmount: 50, currency: "USD", createdAt: time, updatedAt: time }],
  });
}

test("AUDIT-003: sparse same-ID records preserve omitted fields across all eight collections", () => {
  const local = localCase();
  const incoming = { id: "case", evidence: [{ id: "e", title: "Incoming" }], incidents: [{ id: "i" }], tasks: [{ id: "t" }], strategy: [{ id: "s" }], watchItems: [{ id: "w" }], parties: [{ id: "p" }], documents: [{ id: "d" }], ledger: [{ id: "l" }] };
  const merged = mergeCase(local, incoming);
  assert.deepEqual(merged.evidence.find((item) => item.id === "e"), { ...local.evidence[0], title: "Incoming" });
  for (const key of ["incidents", "tasks", "strategy", "watchItems", "parties", "documents", "ledger"]) assert.deepEqual(merged[key], local[key], key);
});

test("AUDIT-003: nested present fields win without clearing omitted siblings", () => {
  const merged = mergeCase(localCase(), {
    id: "case", actionSummary: { currentFocus: "", nextActions: [] },
    parties: [{ id: "p", contact: { email: "" } }],
    evidence: [{ id: "e", availability: { physical: { hasOriginal: false } } }],
  });
  assert.equal(merged.actionSummary.currentFocus, "");
  assert.deepEqual(merged.actionSummary.nextActions, []);
  assert.deepEqual(merged.actionSummary.importantReminders, ["Reminder"]);
  assert.deepEqual(merged.parties[0].contact, { ...localCase().parties[0].contact, email: "" });
  assert.deepEqual(merged.evidence[0].availability.physical, { hasOriginal: false, location: "Cabinet", notes: "Original" });
});

test("AUDIT-003: explicit report-language clear survives normalization and reload", () => {
  const merged = mergeImportedCases([localCase()], [{ id: "case", generatedReportVersions: { en: "" } }]).mergedCases[0];
  const reloaded = normalizeStoredCase(JSON.parse(JSON.stringify(merged)));
  assert.deepEqual(reloaded.generatedReportVersions, { en: "", de: "Deutsch" });
  assert.equal(reloaded.generatedReportText, "Legacy report");
});

test("AUDIT-003: explicit null clears a valid nullable field, omission retains it", () => {
  const local = { ...localCase(), privacyLock: { pin: "1234", enabledAt: time, updatedAt: time } };
  assert.deepEqual(mergeCase(local, { id: "case" }).privacyLock, local.privacyLock);
  assert.equal(mergeCase(local, { id: "case", privacyLock: null }).privacyLock, null);
});

test("AUDIT-003: local-only records survive, imported-only records/cases are added", () => {
  const result = mergeImportedCases([localCase(), { id: "local-case", name: "Keep case" }], [
    { id: "case", evidence: [{ id: "e", title: "Incoming" }, { id: "new", title: "New record" }] },
    { id: "new-case", name: "New case" },
  ]);
  assert.deepEqual(result.mergedCases.map((item) => item.id), ["case", "local-case", "new-case"]);
  assert.deepEqual(new Set(result.mergedCases[0].evidence.map((item) => item.id)), new Set(["e", "local-only", "new"]));
  assert.equal(result.mergedCases[0].evidence.find((item) => item.id === "e").title, "Incoming");
  assert.equal(result.mergedCases[2].name, "New case");
});

test("AUDIT-003: empty entity collections import no deletions; empty member arrays clear", () => {
  const local = localCase();
  const result = mergeImportedCases([local], [{ id: "case", evidence: [], issues: [], tags: [], retiredIssueReferences: [], retiredIssues: [] }]).mergedCases[0];
  assert.deepEqual(result.evidence, local.evidence);
  assert.deepEqual(result.issues, local.issues);
  assert.deepEqual(result.tags, []);
  assert.deepEqual(result.retiredIssueReferences, []);
  assert.deepEqual(result.retiredIssues, []);
  assert.equal(result.nextIssueReferenceNumber, 41);
});

test("AUDIT-003: partial Issue updates preserve stable identity, metadata-only Issues and omitted history", () => {
  const local = localCase();
  const result = mergeImportedCases([local], [{ id: "case", issues: [{ id: "issue-nine", currentPosition: "Imported position" }] }]).mergedCases[0];
  assert.deepEqual(result.issues[0], { ...local.issues[0], currentPosition: "Imported position" });
  assert.deepEqual(result.issues[1], local.issues[1]);
  for (const key of ["issueSchemaVersion", "nextIssueReferenceNumber", "retiredIssueReferences", "retiredIssues"]) assert.deepEqual(result[key], local[key]);
  assert.deepEqual(result.evidence, local.evidence);
});

test("AUDIT-003: imported timestamps do not select winners and missing timestamps stay local", () => {
  const local = localCase();
  const older = "2020-01-01T00:00:00.000Z";
  const merged = mergeCase(local, { id: "case", name: "Older incoming wins", updatedAt: older, createdAt: older, evidence: [{ id: "e", title: "Older title", updatedAt: older }] });
  assert.equal(merged.name, "Older incoming wins");
  assert.equal(merged.updatedAt, older); assert.equal(merged.createdAt, older);
  assert.equal(merged.evidence.find((item) => item.id === "e").title, "Older title");
  assert.equal(mergeCase(local, { id: "case", name: "No date" }).updatedAt, time);
});

test("AUDIT-003: sparse imports cannot regress a persisted case revision", () => {
  const local = { ...localCase(), revision: 12 };
  const merged = mergeImportedCases([local], [{ id: "case", revision: 3, evidence: [{ id: "e", title: "Imported" }] }]).mergedCases[0];
  assert.equal(merged.revision, 12);
});

async function restoreMergeReload(payload, local = localCase()) {
  const parsed = JSON.parse(JSON.stringify(payload));
  const images = new Map([["local-image", { id: "local-image", dataUrl: "ORIGINAL" }]]);
  const cases = new Map([[local.id, structuredClone(local)]]);
  const deleted = [];
  let next = 0;
  const db = {
    async add(store, item) { assert.equal(store, "images"); assert.ok(!images.has(item.id)); images.set(item.id, structuredClone(item)); },
    async get(store, id) { assert.equal(store, "cases"); return structuredClone(cases.get(id)); },
    async put(store, item) { assert.equal(store, "cases"); cases.set(item.id, structuredClone(item)); },
  };
  const deps = { addImage: (item) => addImageToDb(db, item), generateId: () => `fresh-${++next}`, deleteImages: async (ids) => { for (const id of ids) { deleted.push(id); images.delete(id); } } };
  const session = createRestoreSession(deps, parsed.data.cases);
  try {
    const restored = await Promise.all(parsed.data.cases.map((item) => restoreFullBackupCase(item, { ...deps, restoreSession: session })));
    const { mergedCases } = mergeImportedCases([...cases.values()], restored, parsed.appData?.sequenceGroupMeta || {});
    for (const item of mergedCases) { await saveCaseToDb(db, item); session.commit(item); }
  } finally { await session.cleanup(); }
  return { reloaded: normalizeStoredCase(await db.get("cases", local.id)), images, deleted };
}

for (const exportType of ["FULL_BACKUP_CASE", "FULL_BACKUP_ALL"]) {
  test(`AUDIT-003: ${exportType} sparse restore crosses shared merge/save/reload boundary`, async () => {
    const local = localCase();
    const payload = { exportType, contractVersion: "2.0", data: { cases: [{ id: "case", evidence: [{ id: "e", title: "Restored title" }] }] } };
    const original = structuredClone(payload);
    const result = await restoreMergeReload(payload, local);
    const expected = structuredClone(local);
    expected.evidence.find((item) => item.id === "e").title = "Restored title";
    expected.revision = 1;
    assert.deepEqual(result.reloaded, expected);
    assert.deepEqual([...result.images.keys()], ["local-image"]);
    assert.deepEqual(result.deleted, []);
    assert.deepEqual(payload, original);
  });
}

test("AUDIT-003: older envelope missing newer fields preserves planning, Watch, Parties and Issues", async () => {
  const local = localCase();
  const { reloaded } = await restoreMergeReload({ version: "2.1-full-backup", data: { cases: [{ id: "case", notes: "Legacy import", strategy: [{ id: "s", title: "Legacy strategy" }] }] } }, local);
  assert.equal(reloaded.notes, "Legacy import");
  assert.deepEqual(reloaded.strategy[0], { ...local.strategy[0], title: "Legacy strategy" });
  for (const key of ["watchItems", "parties", "issues", "retiredIssues", "retiredIssueReferences", "nextIssueReferenceNumber", "generatedReportVersions"]) assert.deepEqual(reloaded[key], local[key]);
});

test("AUDIT-003: remapped imported bytes win while omitted record metadata and ORIGINAL bytes survive", async () => {
  const payload = { exportType: "FULL_BACKUP_CASE", data: { cases: [{ id: "case", evidence: [{ id: "e", attachments: [{ id: "att", storage: { imageId: "local-image" }, backupDataUrl: "IMPORTED" }] }] }] } };
  const result = await restoreMergeReload(payload);
  const record = result.reloaded.evidence.find((item) => item.id === "e");
  assert.equal(record.description, "Rich");
  assert.equal(record.sequenceGroupId, "issue-nine");
  assert.equal(record.attachments[0].storage.imageId, "fresh-1");
  assert.equal(result.images.get("local-image").dataUrl, "ORIGINAL");
  assert.equal(result.images.get("fresh-1").dataUrl, "IMPORTED");
  assert.deepEqual(result.deleted, []);
});

test("AUDIT-003: omitted case metadata, reports and Issue history survive sparse import", () => {
  const local = localCase();
  assert.deepEqual(mergeCase(local, { id: "case" }), local);
});

test("AUDIT-003: explicit empty strings, null, false, zero and arrays win where valid", () => {
  const merged = mergeCase(localCase(), {
    id: "case", notes: "", description: "", tags: [], folderId: null, privacyLock: null,
    evidence: [{ id: "e", description: "", edited: false, isMilestone: false, attachments: [], linkedRecordIds: [], tags: [], sequenceGroupId: "", sequenceGroup: "" }],
    ledger: [{ id: "l", expectedAmount: 0, paidAmount: 0 }],
  });
  assert.equal(merged.notes, ""); assert.equal(merged.description, ""); assert.equal(merged.folderId, null); assert.equal(merged.privacyLock, null); assert.deepEqual(merged.tags, []);
  const evidence = merged.evidence.find((item) => item.id === "e");
  for (const key of ["description", "sequenceGroupId", "sequenceGroup"]) assert.equal(evidence[key], "");
  for (const key of ["edited", "isMilestone"]) assert.equal(evidence[key], false);
  for (const key of ["attachments", "linkedRecordIds", "tags"]) assert.deepEqual(evidence[key], []);
  assert.equal(merged.ledger[0].expectedAmount, 0); assert.equal(merged.ledger[0].paidAmount, 0);
});
