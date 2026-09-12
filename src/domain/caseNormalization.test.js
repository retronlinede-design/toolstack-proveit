import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStoredCase } from "./caseNormalization.js";
import { normalizeCase, mergeCase } from "./caseDomain.js";
import { allocateNextIssueReference, normalizeCaseIssues, ISSUE_RECORD_COLLECTIONS } from "./issueDomain.js";
import { saveCaseToDb } from "../storage.js";
import { buildFullBackupAllPayload, restoreFullBackupCase } from "../backup/fullBackup.js";
import { ingestGptDelta } from "../gpt/gptDelta.js";

const timestamp = "2026-09-01T12:00:00.000Z";
function richCase() {
  const issue = {
    id: "issue-stable-nine", reference: "ISS-009", name: "Heating", description: "Repair confirmed",
    purpose: "Establish resolution", status: "resolved", priority: "high", ownerPartyId: "party-owner",
    reviewDate: "2026-09-20", currentPosition: "Monitor completed repair", createdAt: timestamp,
    updatedAt: "2026-09-10T15:00:00.000Z",
    historicalContext: { source: "Synthetic prior format", notes: ["Keep stored extension metadata"] },
  };
  return {
    id: "case-audit-001", name: "Synthetic Issue lifecycle", createdAt: timestamp, updatedAt: timestamp,
    parties: [{ id: "party-owner", name: "Synthetic owner" }],
    issues: [issue, { ...issue, id: "issue-metadata-only", reference: "ISS-012", name: "No members", status: "monitoring" }],
    issueSchemaVersion: 1, nextIssueReferenceNumber: 41,
    retiredIssueReferences: ["ISS-020", "ISS-030"],
    retiredIssues: [{ id: "issue-retired", reference: "ISS-030", name: "Historical name", deletedAt: timestamp, mergedIntoIssueId: issue.id, historicalNote: "Preserve original history" }],
    ...Object.fromEntries(ISSUE_RECORD_COLLECTIONS.map((collection) => [collection, [{
      id: `${collection}-member`, title: "Member", date: "2026-09-01", createdAt: timestamp, updatedAt: timestamp,
      sequenceGroupId: issue.id, sequenceGroup: issue.name, attachments: [],
    }]])),
  };
}

// Structured clones emulate the IndexedDB value boundary without opening real storage.
function memoryDb(initial) {
  const cases = new Map(initial.map((item) => [item.id, structuredClone(item)]));
  return {
    async get(store, id) { assert.equal(store, "cases"); return structuredClone(cases.get(id)); },
    async getAll(store) { assert.equal(store, "cases"); return structuredClone([...cases.values()]); },
    async put(store, item) { assert.equal(store, "cases"); cases.set(item.id, structuredClone(item)); return item.id; },
  };
}

async function startupSaveReload(input, options = {}) {
  const db = memoryDb([input]);
  for (const stored of await db.getAll("cases")) {
    await saveCaseToDb(db, normalizeStoredCase(stored, options));
  }
  const persisted = await db.get("cases", input.id);
  const reloaded = normalizeStoredCase(persisted, options);
  await saveCaseToDb(db, reloaded);
  return db.get("cases", input.id);
}

function assertIssueState(actual, expected) {
  for (const key of ["issues", "issueSchemaVersion", "nextIssueReferenceNumber", "retiredIssueReferences", "retiredIssues"]) {
    assert.deepEqual(actual[key], expected[key], key);
  }
  for (const collection of ISSUE_RECORD_COLLECTIONS) {
    assert.equal(actual[collection][0].sequenceGroupId, expected[collection][0].sequenceGroupId, collection);
    assert.equal(actual[collection][0].sequenceGroup, expected[collection][0].sequenceGroup, collection);
  }
}

test("AUDIT-001: rich resolved ISS-009 survives startup normalization, persistence and reload", async () => {
  const raw = richCase();
  const before = structuredClone(raw);
  const reloaded = await startupSaveReload(raw, { sequenceGroupMeta: { Heating: { description: "Stale legacy description" } } });
  assertIssueState(reloaded, raw);
  assert.equal(reloaded.issues[0].reference, "ISS-009");
  assert.equal(reloaded.issues[0].status, "resolved");
  assert.deepEqual(raw, before, "normalization does not mutate source data");
});

test("AUDIT-001: metadata-only Issue and historical payload survive without any members", async () => {
  const raw = richCase();
  for (const collection of ISSUE_RECORD_COLLECTIONS) raw[collection] = [];
  const reloaded = await startupSaveReload(raw);
  assert.deepEqual(reloaded.issues, raw.issues);
  assert.deepEqual(reloaded.retiredIssues, raw.retiredIssues);
  assert.equal(allocateNextIssueReference(reloaded).reference, "ISS-041");
});

test("AUDIT-001: general normalization preserves all seven membership collections before Issue derivation", () => {
  const raw = richCase();
  assertIssueState(normalizeCase(raw), raw);
});

test("AUDIT-001: canonical membership wins over stale legacy name without allocating a phantom Issue", async () => {
  const raw = richCase();
  raw.incidents[0].sequenceGroup = "Old heating name";
  const reloaded = await startupSaveReload(raw);
  assert.deepEqual(reloaded.issues, raw.issues);
  assert.equal(reloaded.incidents[0].sequenceGroupId, raw.issues[0].id);
  assert.equal(reloaded.incidents[0].sequenceGroup, "Heating");
  assert.equal(reloaded.nextIssueReferenceNumber, 41);
});

test("AUDIT-001: legacy-only membership migrates once and retired history sets allocation floor", async () => {
  const raw = richCase();
  raw.nextIssueReferenceNumber = 2;
  raw.retiredIssueReferences = [];
  raw.retiredIssues[0].reference = "ISS-050";
  delete raw.incidents[0].sequenceGroupId;
  raw.incidents[0].sequenceGroup = "Legacy extra";
  const reloaded = await startupSaveReload(raw);
  assert.deepEqual(reloaded.issues.slice(0, 2), raw.issues);
  assert.equal(reloaded.issues[2].reference, "ISS-051");
  assert.equal(reloaded.incidents[0].sequenceGroupId, reloaded.issues[2].id);
  assert.equal(reloaded.nextIssueReferenceNumber, 52);
  assert.deepEqual(reloaded.retiredIssues, raw.retiredIssues);
});

test("AUDIT-001: incomplete historical Issue identity is retained for existing conflict handling", async () => {
  const raw = richCase();
  delete raw.issues[0].reference;
  raw.issues[0].historicalMetadata = { source: "unknown historical format" };
  const reloaded = await startupSaveReload(raw);
  assertIssueState(reloaded, raw);
  assert.ok(normalizeCaseIssues(reloaded).conflicts.length > 0);
});

test("AUDIT-001: canonical-only and legacy-only members resolve to the same existing Issue", async () => {
  const raw = richCase();
  delete raw.incidents[0].sequenceGroup;
  delete raw.evidence[0].sequenceGroupId;
  const reloaded = await startupSaveReload(raw);
  assertIssueState(reloaded, richCase());
});

test("AUDIT-001: retired-reference list independently prevents reuse with a stale counter", async () => {
  const raw = richCase();
  raw.nextIssueReferenceNumber = 1;
  raw.retiredIssues = [];
  raw.retiredIssueReferences = ["ISS-070"];
  const reloaded = await startupSaveReload(raw);
  assert.equal(reloaded.nextIssueReferenceNumber, 71);
  assert.equal(allocateNextIssueReference(reloaded).reference, "ISS-071");
  assert.deepEqual(reloaded.retiredIssueReferences, raw.retiredIssueReferences);
});

test("AUDIT-001: legacy metadata-only group migrates deterministically and survives reload", async () => {
  const raw = { id: "legacy-case", createdAt: timestamp, incidents: [{ id: "legacy-member", sequenceGroup: "Legacy" }] };
  const options = { sequenceGroupMeta: { "Metadata only": { description: "Historical description", updatedAt: timestamp } } };
  const reloaded = await startupSaveReload(raw, options);
  assert.equal(reloaded.issues.length, 2);
  assert.equal(reloaded.issues.find((issue) => issue.name === "Metadata only").description, "Historical description");
  assert.deepEqual(await startupSaveReload(reloaded, options), reloaded);
});

test("AUDIT-001: incomplete optional Issue fields retain supported defaults without replacing identity", async () => {
  const raw = richCase();
  raw.issues[0] = { id: "issue-stable-nine", reference: "ISS-009", name: "Heating", historicalContext: { preserved: true } };
  const reloaded = await startupSaveReload(raw);
  assert.equal(reloaded.issues[0].id, "issue-stable-nine");
  assert.equal(reloaded.issues[0].reference, "ISS-009");
  assert.equal(reloaded.issues[0].status, "open");
  assert.equal(reloaded.issues[0].priority, "normal");
  assert.deepEqual(reloaded.issues[0].historicalContext, { preserved: true });
});

test("AUDIT-001: full backup JSON, restore, import normalization, same-case merge and reload retain Issues", async () => {
  const raw = richCase();
  // No binaries: isolates Issue normalization from AUDIT-002/006 attachment behavior.
  const payload = JSON.parse(JSON.stringify(await buildFullBackupAllPayload({ cases: [raw] })));
  const restored = await restoreFullBackupCase(payload.data.cases[0]);
  const imported = normalizeStoredCase(restored);
  assertIssueState(await startupSaveReload(imported), raw);
  // Identical complete inputs deliberately avoid AUDIT-003 sparse/conflicting merge policy.
  const merged = normalizeCaseIssues(mergeCase(raw, imported)).caseData;
  assertIssueState(await startupSaveReload(merged), raw);
});

test("AUDIT-001: valid GPT v3 Strategy/Watch updates preserve unrelated Issues through save/reload", async () => {
  const raw = richCase();
  const result = ingestGptDelta(raw, {
    app: "proveit", contractVersion: "gpt-delta-3.0", target: { caseId: raw.id },
    operations: { patch: {
      strategy: [{ id: "strategy-member", patch: { title: "Updated strategy" } }],
      watchItems: [{ id: "watchItems-member", patch: { title: "Updated concern" } }],
    } },
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.case.strategy[0].title, "Updated strategy");
  assert.equal(result.case.watchItems[0].title, "Updated concern");
  assertIssueState(result.case, raw);
  assertIssueState(await startupSaveReload(result.case), raw);
});
