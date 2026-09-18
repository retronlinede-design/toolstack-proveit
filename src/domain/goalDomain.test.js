import test from "node:test";
import assert from "node:assert/strict";
import { mergeCase, normalizeCase, normalizeRecord } from "./caseDomain.js";
import { normalizeStoredCase } from "./caseNormalization.js";
import { mergeImportedCases } from "./caseImport.js";
import { deleteCaseIssue, mergeCaseIssues } from "./issueDomain.js";
import { hasSuspiciousCoreArrayShrink, saveCaseToDb } from "../storage.js";

const time = "2026-09-18T12:00:00.000Z";

function goal(overrides = {}) {
  return {
    id: "goal-housing", title: "Secure habitable housing", description: "Obtain repairs or a lawful alternative",
    successCriteria: ["Heating restored", "Written confirmation"], status: "active", priority: "high",
    issueIds: ["issue-heating"], reviewDate: "2026-10-01", createdAt: time, updatedAt: time, ...overrides,
  };
}

function caseWithGoals(overrides = {}) {
  return {
    id: "case-goals", name: "Goals fixture", createdAt: time, updatedAt: time,
    issues: [
      { id: "issue-heating", reference: "ISS-009", name: "Heating", status: "resolved", priority: "high", createdAt: time, updatedAt: time },
      { id: "issue-rent", reference: "ISS-010", name: "Rent", status: "open", priority: "normal", createdAt: time, updatedAt: time },
    ],
    nextIssueReferenceNumber: 11,
    goals: [goal()],
    strategy: [{ id: "strategy-1", title: "Repair plan", strategyType: "action", goalIds: ["goal-housing"], createdAt: time, updatedAt: time }],
    ...overrides,
  };
}

function memoryDb(initial) {
  const cases = new Map(initial.map((item) => [item.id, structuredClone(item)]));
  return {
    async get(store, id) { assert.equal(store, "cases"); return structuredClone(cases.get(id)); },
    async put(store, item) { assert.equal(store, "cases"); cases.set(item.id, structuredClone(item)); return item.id; },
  };
}

test("Goals: a legacy case without goals loads without materializing an empty collection or revising", async () => {
  const legacy = normalizeStoredCase({ id: "legacy-goals", name: "Legacy", createdAt: time, updatedAt: time });
  legacy.revision = 4;
  assert.equal(Object.hasOwn(legacy, "goals"), false);
  const normalized = normalizeStoredCase(legacy);
  assert.equal(Object.hasOwn(normalized, "goals"), false);
  const db = memoryDb([legacy]);
  await saveCaseToDb(db, normalized);
  assert.equal((await db.get("cases", legacy.id)).revision, 4);
});

test("Goals: canonical Goal fields and Issue IDs survive stored-case normalization", () => {
  const normalized = normalizeStoredCase(caseWithGoals());
  assert.deepEqual(normalized.goals, [goal()]);
  assert.deepEqual(normalized.strategy[0].goalIds, ["goal-housing"]);
});

test("Goals: legacy Strategy records remain valid and linked Strategies retain canonical Goal IDs", () => {
  const legacy = normalizeRecord({ id: "strategy-old", strategyType: "objective", createdAt: time, updatedAt: time }, "strategy");
  assert.deepEqual(legacy.goalIds || [], []);
  assert.equal(Object.hasOwn(legacy, "goalIds"), false);
  const linked = normalizeRecord({ ...legacy, goalIds: ["goal-housing", " goal-housing ", "goal-rent"] }, "strategy");
  assert.deepEqual(linked.goalIds, ["goal-housing", "goal-rent"]);
  assert.equal(linked.strategyType, "objective");
  assert.equal(linked.status, "open");
});

test("Goals: Issue merge remaps and Issue deletion removes only canonical Goal Issue IDs", () => {
  const source = normalizeStoredCase(caseWithGoals({ goals: [goal({ issueIds: ["issue-heating", "issue-rent"] })] }));
  const merged = mergeCaseIssues(source, "issue-heating", "issue-rent", { now: time });
  assert.equal(merged.success, true);
  assert.deepEqual(merged.caseData.goals[0].issueIds, ["issue-rent"]);
  const deleted = deleteCaseIssue(merged.caseData, "issue-rent", { now: time });
  assert.equal(deleted.success, true);
  assert.deepEqual(deleted.caseData.goals[0].issueIds, []);
});

test("Goals: same-ID imports merge present Goal fields, preserve local Goals, and retain Strategy links", () => {
  const local = normalizeStoredCase(caseWithGoals());
  const incoming = {
    id: local.id,
    goals: [{ id: "goal-housing", title: "Secure safe housing" }, goal({ id: "goal-new", title: "Recover costs", issueIds: ["issue-rent"] })],
    strategy: [{ id: "strategy-1", goalIds: ["goal-housing", "goal-new"] }],
  };
  const merged = mergeImportedCases([local], [incoming]).mergedCases[0];
  assert.deepEqual(merged.goals.find((item) => item.id === "goal-housing"), { ...goal(), title: "Secure safe housing" });
  assert.equal(merged.goals.find((item) => item.id === "goal-new").title, "Recover costs");
  assert.deepEqual(merged.strategy[0].goalIds, ["goal-housing", "goal-new"]);
  assert.deepEqual(mergeCase(local, { id: local.id }).goals, local.goals);
  assert.deepEqual(mergeCase(local, { id: local.id, goals: [] }).goals, local.goals);
});

test("Goals: storage protects a non-empty Goals collection against an empty whole-case overwrite", () => {
  const existing = normalizeCase(caseWithGoals());
  assert.equal(hasSuspiciousCoreArrayShrink(existing, { ...existing, goals: [] }), true);
});
