import assert from "node:assert/strict";
import test from "node:test";
import {
  preflightBackupPayload,
  validateBackupIntelligenceLibraryIntegrity,
} from "../backup/importPreflight.js";
import {
  buildFullBackupAllPayload,
  buildFullBackupCasePayload,
  restoreFullBackupCase,
} from "../backup/fullBackup.js";
import { mergeImportedCasesWithIntelligence } from "../domain/caseImport.js";
import { saveCasesAndImagesToDb } from "../storage.js";
import {
  calculateIntelligenceMessageChecksum,
  calculateIntelligenceRevisionChecksum,
  createEmptyIntelligenceLibrary,
} from "./intelligenceLibrary.js";

const TIME = "2026-11-06T12:00:00.000Z";
const SOURCE = { caseRevision: 2, sourceFingerprint: "context-fingerprint", scope: { type: "case" } };
const CITATION = { recordType: "evidence", recordId: "evidence-1", scopeRelation: "direct", capturedAt: TIME, availability: "available" };

function caseItem(overrides = {}) {
  return { id: "case-1", revision: 2, name: "Synthetic Case", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [], tasks: [], parties: [], issues: [], ...overrides };
}

async function library(caseId = "case-1") {
  const value = createEmptyIntelligenceLibrary(caseId);
  value.conversations.conversation = { id: "conversation", caseId, title: "Synthetic", createdAt: TIME, updatedAt: TIME, activeSessionId: "session", sessionIds: ["session"], status: "active" };
  value.sessions.session = { id: "session", caseId, conversationId: "conversation", startedAt: TIME, endedAt: null, messageIds: ["message"], source: SOURCE };
  const message = { id: "message", caseId, conversationId: "conversation", sessionId: "session", sequence: 1, role: "user", createdAt: TIME, status: "complete", content: { text: "Recorded question", errorCode: null, errorMessage: null }, source: SOURCE, citations: [CITATION], provider: null, contentChecksum: "" };
  message.contentChecksum = await calculateIntelligenceMessageChecksum(message);
  value.messages.message = message;
  value.intelligenceItems.item = { id: "item", caseId, type: "hypothesis", createdAt: TIME, currentRevisionId: "item-revision", revisionIds: ["item-revision"], status: "under_review" };
  const revision = { entityType: "item", id: "item-revision", entityId: "item", caseId, versionNumber: 1, parentRevisionId: null, createdAt: TIME, author: { kind: "user", label: "Reviewer" }, content: { statement: "A user note", uncertainty: "high", confidence: 0.3 }, source: SOURCE, citations: [CITATION], review: { status: "unreviewed", by: null, at: null }, contentChecksum: "" };
  revision.contentChecksum = await calculateIntelligenceRevisionChecksum(revision);
  value.intelligenceItemRevisions[revision.id] = revision;
  return value;
}

function payload(cases) {
  return { app: "proveit", contractVersion: "2.0", exportType: "FULL_BACKUP_CASE", data: { cases } };
}

test("full and selected-case backups retain valid intelligence history without attachment binary coupling", async () => {
  const intelligenceLibrary = await library();
  const sourceCase = caseItem({ intelligenceLibrary, evidence: [{ id: "evidence-1", attachments: [{ id: "att-1", storage: { imageId: "binary-1" } }] }] });
  const deps = { getImageById: async () => ({ dataUrl: "data:image/png;base64,AA==" }) };
  const full = await buildFullBackupAllPayload({ cases: [sourceCase] }, deps);
  const selected = await buildFullBackupCasePayload({ caseItem: sourceCase }, deps);
  assert.deepEqual(full.data.cases[0].intelligenceLibrary, intelligenceLibrary);
  assert.deepEqual(selected.data.cases[0].intelligenceLibrary, intelligenceLibrary);
  assert.equal(Object.hasOwn(full.data.cases[0].intelligenceLibrary, "backupDataUrl"), false);
  assert.equal(selected.data.cases[0].evidence[0].attachments[0].backupDataUrl, "data:image/png;base64,AA==");
  assert.deepEqual((await restoreFullBackupCase(selected.data.cases[0], { addImage: async () => {}, generateId: () => "binary-1" })).intelligenceLibrary, intelligenceLibrary);
});

test("backup preflight rejects unsupported, cross-case, incomplete, unsafe, and checksum-tampered intelligence histories", async () => {
  const valid = await library();
  const input = payload([caseItem({ intelligenceLibrary: valid })]);
  assert.equal(preflightBackupPayload(input).ok, true);
  assert.equal((await validateBackupIntelligenceLibraryIntegrity(input.data)).ok, true);

  const future = structuredClone(input);
  future.data.cases[0].intelligenceLibrary.schemaVersion = 2;
  assert.match(preflightBackupPayload(future).reason, /unsupported future schema/i);
  const crossCase = structuredClone(input);
  crossCase.data.cases[0].intelligenceLibrary.messages.message.caseId = "other-case";
  assert.match(preflightBackupPayload(crossCase).reason, /intelligenceLibrary is invalid/i);
  const incomplete = structuredClone(input);
  delete incomplete.data.cases[0].intelligenceLibrary.intelligenceItemRevisions["item-revision"];
  assert.match(preflightBackupPayload(incomplete).reason, /intelligenceLibrary is invalid/i);
  const unsafe = structuredClone(input);
  unsafe.data.cases[0].intelligenceLibrary.messages.message.content.dataUrl = "data:text/plain;base64,AA==";
  assert.match(preflightBackupPayload(unsafe).reason, /intelligenceLibrary is invalid/i);
  const tampered = structuredClone(input);
  tampered.data.cases[0].intelligenceLibrary.messages.message.content.text = "Changed";
  assert.equal(preflightBackupPayload(tampered).ok, true);
  assert.equal((await validateBackupIntelligenceLibraryIntegrity(tampered.data)).ok, false);
});

test("restore-only merge preserves legacy omissions, accepts new valid histories, deduplicates identical records, and rejects conflicts", async () => {
  const valid = await library();
  const local = caseItem({ intelligenceLibrary: valid });
  const preserved = await mergeImportedCasesWithIntelligence([local], [caseItem({ notes: "Legacy backup omission" })]);
  assert.deepEqual(preserved.mergedCases[0].intelligenceLibrary, valid);

  const added = await mergeImportedCasesWithIntelligence([], [caseItem({ intelligenceLibrary: valid })]);
  assert.deepEqual(added.mergedCases[0].intelligenceLibrary, valid);
  const identical = await mergeImportedCasesWithIntelligence([local], [caseItem({ intelligenceLibrary: structuredClone(valid) })]);
  assert.deepEqual(identical.mergedCases[0].intelligenceLibrary, valid);

  const conflict = structuredClone(valid);
  conflict.messages.message.content.text = "Different immutable content";
  conflict.messages.message.contentChecksum = await calculateIntelligenceMessageChecksum(conflict.messages.message);
  await assert.rejects(
    mergeImportedCasesWithIntelligence([local], [caseItem({ intelligenceLibrary: conflict })]),
    /conflicts/i,
  );
});

test("the storage restore gate requires explicit controlled-write permission and rejects invalid histories before transactions", async () => {
  const valid = await library();
  let opened = false;
  const db = { transaction() { opened = true; throw new Error("must not write"); } };
  await assert.rejects(saveCasesAndImagesToDb(db, [caseItem({ intelligenceLibrary: valid })]), /controlled write adapter/i);
  assert.equal(opened, false);

  const tampered = structuredClone(valid);
  tampered.messages.message.content.text = "Tampered";
  await assert.rejects(
    saveCasesAndImagesToDb(db, [caseItem({ intelligenceLibrary: tampered })], [], { allowIntelligenceLibraryWrite: true }),
    /intelligence library is invalid/i,
  );
  assert.equal(opened, false);
});
