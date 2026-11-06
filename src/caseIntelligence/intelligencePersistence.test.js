import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCase } from "../domain/caseDomain.js";
import { CaseRevisionConflictError, saveCaseToDb, saveCasesAndImagesToDb } from "../storage.js";
import {
  calculateIntelligenceMessageChecksum,
  calculateIntelligenceRevisionChecksum,
  createEmptyIntelligenceLibrary,
} from "./intelligenceLibrary.js";

const TIME = "2026-11-06T12:00:00.000Z";
const SOURCE = { caseRevision: 2, sourceFingerprint: "context-fingerprint", scope: { type: "case" } };
const CITATION = { recordType: "evidence", recordId: "evidence-1", scopeRelation: "direct", capturedAt: TIME, availability: "available" };

function caseItem(overrides = {}) {
  return {
    id: "case-1", revision: 2, name: "Synthetic Case", description: "Original", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [], tasks: [], goals: [],
    ...overrides,
  };
}

async function validLibrary(caseId = "case-1") {
  const library = createEmptyIntelligenceLibrary(caseId);
  library.conversations.conversation = { id: "conversation", caseId, title: "Synthetic", createdAt: TIME, updatedAt: TIME, activeSessionId: "session", sessionIds: ["session"], status: "active" };
  library.sessions.session = { id: "session", caseId, conversationId: "conversation", startedAt: TIME, endedAt: null, messageIds: ["message"], source: SOURCE };
  const message = { id: "message", caseId, conversationId: "conversation", sessionId: "session", sequence: 1, role: "user", createdAt: TIME, status: "complete", content: { text: "Recorded question", errorCode: null, errorMessage: null }, source: SOURCE, citations: [CITATION], provider: null, contentChecksum: "" };
  message.contentChecksum = await calculateIntelligenceMessageChecksum(message);
  library.messages.message = message;
  library.intelligenceItems.item = { id: "item", caseId, type: "hypothesis", createdAt: TIME, currentRevisionId: "item-revision", revisionIds: ["item-revision"], status: "under_review" };
  const itemRevision = { entityType: "item", id: "item-revision", entityId: "item", caseId, versionNumber: 1, parentRevisionId: null, createdAt: TIME, author: { kind: "user", label: "Reviewer" }, content: { statement: "A user note", uncertainty: "high", confidence: 0.3 }, source: SOURCE, citations: [CITATION], review: { status: "unreviewed", by: null, at: null }, contentChecksum: "" };
  itemRevision.contentChecksum = await calculateIntelligenceRevisionChecksum(itemRevision);
  library.intelligenceItemRevisions[itemRevision.id] = itemRevision;
  return library;
}

function fakeDb(cases = []) {
  const stores = { cases: new Map(cases.map((item) => [item.id, structuredClone(item)])), images: new Map() };
  return {
    stores,
    async get(storeName, id) { return stores[storeName].get(id); },
    async getAll(storeName) { return [...stores[storeName].values()]; },
    async put(storeName, item) { stores[storeName].set(item.id, structuredClone(item)); return item.id; },
    async delete(storeName, id) { stores[storeName].delete(id); },
  };
}

test("normalization leaves legacy cases absent and preserves valid, malformed, and future intelligence libraries verbatim", async () => {
  const legacy = normalizeCase(caseItem());
  assert.equal(Object.hasOwn(legacy, "intelligenceLibrary"), false);

  const valid = await validLibrary();
  assert.deepEqual(normalizeCase(caseItem({ intelligenceLibrary: valid })).intelligenceLibrary, valid);
  const future = { schemaVersion: 2, caseId: "case-1", opaque: { preserve: true } };
  assert.deepEqual(normalizeCase(caseItem({ intelligenceLibrary: future })).intelligenceLibrary, future);
  const malformed = { schemaVersion: 1, conversations: "not-a-map" };
  assert.deepEqual(normalizeCase(caseItem({ intelligenceLibrary: malformed })).intelligenceLibrary, malformed);
});

test("ordinary saves preserve a valid intelligence library and remain compatible with a report library", async () => {
  const library = await validLibrary();
  const existing = caseItem({ intelligenceLibrary: library, reportLibrary: { schemaVersion: 1, reports: {}, revisions: {} } });
  const db = fakeDb([existing]);
  const candidate = { ...caseItem({ reportLibrary: existing.reportLibrary }), description: "Unrelated update" };

  await saveCaseToDb(db, candidate);
  assert.equal(db.stores.cases.get("case-1").description, "Unrelated update");
  assert.deepEqual(db.stores.cases.get("case-1").intelligenceLibrary, library);
  assert.deepEqual(db.stores.cases.get("case-1").reportLibrary, existing.reportLibrary);
});

test("new or replacement intelligence histories require an explicit controlled-write adapter", async () => {
  const library = await validLibrary();
  const db = fakeDb();
  const candidate = caseItem({ intelligenceLibrary: library });
  const libraryBeforeSave = structuredClone(candidate.intelligenceLibrary);
  await assert.rejects(saveCaseToDb(db, candidate), /controlled write adapter/i);
  assert.equal(db.stores.cases.has("case-1"), false);
  await saveCaseToDb(db, candidate, { allowIntelligenceLibraryWrite: true });
  assert.deepEqual(db.stores.cases.get("case-1").intelligenceLibrary, library);
  assert.deepEqual(candidate.intelligenceLibrary, libraryBeforeSave);
});

test("malformed, tampered, and cross-case libraries fail before any write and do not mutate the rejected input", async () => {
  const existing = caseItem();
  const db = fakeDb([existing]);
  const tampered = caseItem({ description: "Should not persist", intelligenceLibrary: await validLibrary() });
  tampered.intelligenceLibrary.messages.message.content.text = "Tampered";
  const beforeTampered = structuredClone(tampered);
  await assert.rejects(saveCaseToDb(db, tampered), /intelligence library is invalid/i);
  assert.deepEqual(tampered, beforeTampered);
  assert.equal(db.stores.cases.get("case-1").description, "Original");

  const crossCase = caseItem({ intelligenceLibrary: await validLibrary("other-case") });
  await assert.rejects(saveCaseToDb(db, crossCase), /intelligence library is invalid/i);
  const malformed = caseItem({ intelligenceLibrary: { schemaVersion: 1, caseId: "case-1" } });
  await assert.rejects(saveCaseToDb(db, malformed), /intelligence library is invalid/i);
  assert.equal(db.stores.cases.get("case-1").intelligenceLibrary, undefined);
});

test("future libraries remain preserved but cannot be introduced or changed", async () => {
  const future = { schemaVersion: 2, caseId: "case-1", opaque: { preserve: true } };
  const db = fakeDb([caseItem({ intelligenceLibrary: future })]);
  await saveCaseToDb(db, caseItem({ description: "Safe unrelated update" }));
  assert.deepEqual(db.stores.cases.get("case-1").intelligenceLibrary, future);

  await assert.rejects(
    saveCaseToDb(db, caseItem({ revision: 3, intelligenceLibrary: { ...future, opaque: { preserve: false } } })),
    /Unsupported or malformed intelligence library cannot be changed/i,
  );
  const emptyDb = fakeDb();
  await assert.rejects(saveCaseToDb(emptyDb, caseItem({ intelligenceLibrary: future })), /Unsupported intelligence library cannot be introduced/i);
  await assert.rejects(
    saveCasesAndImagesToDb({ transaction() { throw new Error("must not write"); } }, [caseItem({ intelligenceLibrary: future })]),
    /controlled write adapter/i,
  );
});

test("revision conflicts protect newer intelligence history and batch saves reject invalid intelligence before opening a write transaction", async () => {
  const library = await validLibrary();
  const existing = caseItem({ intelligenceLibrary: library });
  const db = fakeDb([existing]);
  const fresh = { ...structuredClone(existing), description: "Fresh writer" };
  await saveCaseToDb(db, fresh);
  const stale = { ...structuredClone(existing), description: "Stale writer" };
  await assert.rejects(saveCaseToDb(db, stale), CaseRevisionConflictError);
  assert.equal(db.stores.cases.get("case-1").description, "Fresh writer");
  assert.deepEqual(db.stores.cases.get("case-1").intelligenceLibrary, library);

  let transactionOpened = false;
  const invalidBatch = caseItem({ intelligenceLibrary: structuredClone(library) });
  invalidBatch.intelligenceLibrary.messages.message.content.text = "Tampered";
  await assert.rejects(
    saveCasesAndImagesToDb({ transaction() { transactionOpened = true; throw new Error("must not write"); } }, [invalidBatch], [], { allowIntelligenceLibraryWrite: true }),
    /intelligence library is invalid/i,
  );
  assert.equal(transactionOpened, false);
});
