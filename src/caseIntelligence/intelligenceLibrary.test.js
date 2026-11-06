import assert from "node:assert/strict";
import test from "node:test";
import {
  INTELLIGENCE_LIBRARY_WARNING_BYTES,
  INTELLIGENCE_MAX_CITATIONS,
  INTELLIGENCE_MAX_MESSAGE_BYTES,
  INTELLIGENCE_MAX_MESSAGES_PER_SESSION,
  INTELLIGENCE_MAX_STATEMENT_BYTES,
  IntelligenceLibraryConflictError,
  buildIntelligenceMessageChecksumPayload,
  buildIntelligenceRevisionChecksumPayload,
  calculateIntelligenceMessageChecksum,
  calculateIntelligenceRevisionChecksum,
  classifyIntelligenceLibrary,
  createEmptyIntelligenceLibrary,
  measureIntelligenceLibrary,
  mergeIntelligenceLibraries,
  validateIntelligenceLibraryIntegrity,
} from "./intelligenceLibrary.js";

const TIME = "2026-11-06T12:00:00.000Z";
const SOURCE = { caseRevision: 3, sourceFingerprint: "context-fingerprint", scope: { type: "issue", issueId: "issue-1" } };
const CITATION = { recordType: "evidence", recordId: "evidence-1", scopeRelation: "direct", issueId: "issue-1", capturedLabel: "Evidence", capturedAt: TIME, availability: "available" };

async function populatedLibrary() {
  const library = createEmptyIntelligenceLibrary("case-1");
  library.conversations["conversation-1"] = { id: "conversation-1", caseId: "case-1", title: "Manual case review", createdAt: TIME, updatedAt: TIME, activeSessionId: "session-1", sessionIds: ["session-1"], status: "active" };
  library.sessions["session-1"] = { id: "session-1", caseId: "case-1", conversationId: "conversation-1", startedAt: TIME, endedAt: null, messageIds: ["message-1"], source: SOURCE };
  const message = { id: "message-1", caseId: "case-1", conversationId: "conversation-1", sessionId: "session-1", sequence: 1, role: "user", createdAt: TIME, status: "complete", content: { text: "Recorded user question", errorCode: null, errorMessage: null }, source: SOURCE, citations: [CITATION], provider: null, contentChecksum: "" };
  message.contentChecksum = await calculateIntelligenceMessageChecksum(message);
  library.messages[message.id] = message;

  library.intelligenceItems["item-1"] = { id: "item-1", caseId: "case-1", type: "hypothesis", createdAt: TIME, currentRevisionId: "item-revision-1", revisionIds: ["item-revision-1"], status: "under_review" };
  const itemRevision = { entityType: "item", id: "item-revision-1", entityId: "item-1", caseId: "case-1", versionNumber: 1, parentRevisionId: null, createdAt: TIME, author: { kind: "user", label: "Synthetic Reviewer" }, content: { statement: "Manual hypothesis", uncertainty: "high", confidence: 0.3 }, source: SOURCE, citations: [CITATION], review: { status: "unreviewed", by: null, at: null }, contentChecksum: "" };
  itemRevision.contentChecksum = await calculateIntelligenceRevisionChecksum(itemRevision);
  library.intelligenceItemRevisions[itemRevision.id] = itemRevision;

  library.decisions["decision-1"] = { id: "decision-1", caseId: "case-1", type: "rejected_hypothesis", createdAt: TIME, currentRevisionId: "decision-revision-1", revisionIds: ["decision-revision-1"] };
  const decisionRevision = { entityType: "decision", id: "decision-revision-1", entityId: "decision-1", caseId: "case-1", versionNumber: 1, parentRevisionId: null, createdAt: TIME, author: { kind: "user", label: "Synthetic Reviewer" }, content: { statement: "The user rejected the hypothesis.", uncertainty: "unknown", confidence: null }, source: SOURCE, citations: [CITATION], review: { status: "confirmed", by: "Synthetic Reviewer", at: TIME }, contentChecksum: "" };
  decisionRevision.contentChecksum = await calculateIntelligenceRevisionChecksum(decisionRevision);
  library.decisionRevisions[decisionRevision.id] = decisionRevision;
  return library;
}

test("validates a populated, case-owned library with manual notes, decisions, and immutable checksums", async () => {
  const library = await populatedLibrary();
  assert.deepEqual(classifyIntelligenceLibrary(library, { caseId: "case-1" }), { kind: "supported", valid: true, errors: [] });
  assert.deepEqual(await validateIntelligenceLibraryIntegrity(library, { caseId: "case-1" }), { kind: "supported", valid: true, errors: [] });
  assert.equal(buildIntelligenceMessageChecksumPayload(library.messages["message-1"]).type, "message");
  assert.equal(buildIntelligenceRevisionChecksumPayload(library.intelligenceItemRevisions["item-revision-1"]).type, "item");
});

test("distinguishes absent, future, foreign, malformed, and tampered libraries without repair", async () => {
  assert.deepEqual(classifyIntelligenceLibrary(undefined, { caseId: "case-1" }), { kind: "absent", valid: true, errors: [] });
  assert.equal(classifyIntelligenceLibrary({ schemaVersion: 2 }, { caseId: "case-1" }).kind, "unsupported");
  const library = await populatedLibrary();
  assert.equal(classifyIntelligenceLibrary(library, { caseId: "other" }).valid, false);
  const tampered = structuredClone(library);
  tampered.messages["message-1"].content.text = "Changed";
  assert.equal((await validateIntelligenceLibraryIntegrity(tampered, { caseId: "case-1" })).valid, false);
  const foreign = structuredClone(library);
  foreign.messages["message-1"].caseId = "other";
  assert.equal(classifyIntelligenceLibrary(foreign, { caseId: "case-1" }).valid, false);
});

test("rejects graph, ordering, parent-chain, pointer, citation and binary failures", async () => {
  const library = await populatedLibrary();
  const invalid = structuredClone(library);
  invalid.sessions["session-1"].messageIds = ["message-1", "message-1"];
  assert.equal(classifyIntelligenceLibrary(invalid, { caseId: "case-1" }).valid, false);

  const missingParent = structuredClone(library);
  missingParent.intelligenceItemRevisions["item-revision-1"].parentRevisionId = "missing";
  assert.equal(classifyIntelligenceLibrary(missingParent, { caseId: "case-1" }).valid, false);

  const badPointer = structuredClone(library);
  badPointer.intelligenceItems["item-1"].currentRevisionId = "missing";
  assert.equal(classifyIntelligenceLibrary(badPointer, { caseId: "case-1" }).valid, false);

  const binary = structuredClone(library);
  binary.messages["message-1"].content.dataUrl = "data:text/plain;base64,secret";
  assert.equal(classifyIntelligenceLibrary(binary, { caseId: "case-1" }).valid, false);

  const polluted = structuredClone(library);
  Object.defineProperty(polluted.messages["message-1"].content, "__proto__", { value: { polluted: true }, enumerable: true });
  assert.equal(classifyIntelligenceLibrary(polluted, { caseId: "case-1" }).valid, false);
});

test("merges only complete identical or append-only histories and rejects immutable conflicts", async () => {
  const local = await populatedLibrary();
  const identical = structuredClone(local);
  const merged = await mergeIntelligenceLibraries(local, identical, { caseId: "case-1" });
  assert.deepEqual(merged, local);
  assert.notEqual(merged, local);

  const appended = structuredClone(local);
  const message = {
    ...appended.messages["message-1"],
    id: "message-2",
    sequence: 2,
    content: { text: "A later immutable message", errorCode: null, errorMessage: null },
    contentChecksum: "",
  };
  message.contentChecksum = await calculateIntelligenceMessageChecksum(message);
  appended.messages[message.id] = message;
  appended.sessions["session-1"].messageIds.push(message.id);
  const appendedMerged = await mergeIntelligenceLibraries(local, appended, { caseId: "case-1" });
  assert.deepEqual(appendedMerged.sessions["session-1"].messageIds, ["message-1", "message-2"]);
  assert.equal(appendedMerged.messages["message-2"].content.text, "A later immutable message");

  const conflict = structuredClone(local);
  conflict.messages["message-1"].content.text = "A different immutable message.";
  conflict.messages["message-1"].contentChecksum = await calculateIntelligenceMessageChecksum(conflict.messages["message-1"]);
  await assert.rejects(mergeIntelligenceLibraries(local, conflict, { caseId: "case-1" }), IntelligenceLibraryConflictError);

  const incomplete = structuredClone(local);
  delete incomplete.intelligenceItemRevisions["item-revision-1"];
  await assert.rejects(mergeIntelligenceLibraries(local, incomplete, { caseId: "case-1" }), IntelligenceLibraryConflictError);
});

test("enforces text, citation, and session limits without truncating input", async () => {
  const library = await populatedLibrary();
  const tooLarge = structuredClone(library);
  tooLarge.messages["message-1"].content.text = "x".repeat(INTELLIGENCE_MAX_MESSAGE_BYTES + 1);
  assert.equal(classifyIntelligenceLibrary(tooLarge, { caseId: "case-1" }).valid, false);
  const statement = structuredClone(library);
  statement.intelligenceItemRevisions["item-revision-1"].content.statement = "x".repeat(INTELLIGENCE_MAX_STATEMENT_BYTES + 1);
  assert.equal(classifyIntelligenceLibrary(statement, { caseId: "case-1" }).valid, false);
  const citations = structuredClone(library);
  citations.messages["message-1"].citations = Array.from({ length: INTELLIGENCE_MAX_CITATIONS + 1 }, (_, index) => ({ ...CITATION, recordId: `record-${index}` }));
  assert.equal(classifyIntelligenceLibrary(citations, { caseId: "case-1" }).valid, false);
  const session = structuredClone(library);
  session.sessions["session-1"].messageIds = Array.from({ length: INTELLIGENCE_MAX_MESSAGES_PER_SESSION + 1 }, (_, index) => `message-${index}`);
  assert.equal(classifyIntelligenceLibrary(session, { caseId: "case-1" }).valid, false);
});

test("reports the provisional size warning without an arbitrary hard limit and makes no network or storage calls", async () => {
  const library = await populatedLibrary();
  assert.equal(measureIntelligenceLibrary(library).warning, false);
  const large = structuredClone(library);
  large.messages["message-1"].content.text = "x".repeat(INTELLIGENCE_LIBRARY_WARNING_BYTES + 1);
  assert.equal(measureIntelligenceLibrary(large).warning, true);
  const before = structuredClone(library);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("network must not be called"); };
  try {
    await validateIntelligenceLibraryIntegrity(library, { caseId: "case-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(library, before);
});
