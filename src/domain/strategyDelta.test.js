import assert from "node:assert/strict";
import test from "node:test";
import { applyStrategyDelta, parseStrategyDeltaText, STRATEGY_DELTA_CONTRACT, validateStrategyDelta } from "./strategyDelta.js";

function fixture() { return { id: "case-1", revision: 4, name: "Case", goals: [{ id: "goal-1", title: "Goal" }], strategy: [{ id: "strategy-1", title: "Existing", goalIds: ["goal-1"], rationale: "Before", desiredOutcome: "Old", objective: "Old objective", assumptions: ["Known"], risks: [], nextSteps: [], status: "open", decisionStatus: "proposed", createdAt: "2026-01-01" }], evidence: [{ id: "e-1", title: "Unrelated" }] }; }
function payload(proposals = [{ type: "update-strategy-rationale", strategyId: "strategy-1", value: "After", reason: "Evidence supports it" }]) { return { contract: STRATEGY_DELTA_CONTRACT, version: "1.0", caseId: "case-1", baseRevision: 4, goalId: "goal-1", proposals }; }

test("Strategy Delta validates the allowlisted contract and preserves stale context as a warning", () => {
  const valid = validateStrategyDelta(fixture(), payload()); assert.equal(valid.ok, true); assert.equal(valid.stale, false);
  assert.equal(validateStrategyDelta(fixture(), { ...payload(), contract: "wrong" }).ok, false); assert.equal(validateStrategyDelta(fixture(), { ...payload(), version: "2.0" }).ok, false); assert.equal(validateStrategyDelta(fixture(), { ...payload(), caseId: "wrong" }).ok, false); assert.equal(validateStrategyDelta(fixture(), { ...payload(), goalId: "missing" }).ok, false);
  assert.equal(validateStrategyDelta(fixture(), payload([{ type: "update-strategy-rationale", strategyId: "missing", value: "After" }])).ok, false);
  assert.equal(validateStrategyDelta(fixture(), payload([{ type: "update-strategy-rationale", strategyId: "strategy-1", value: "One" }, { type: "update-strategy-rationale", strategyId: "strategy-1", value: "Two" }])).ok, false);
  assert.equal(validateStrategyDelta(fixture(), payload([{ type: "update-strategy-rationale", strategyId: "strategy-1", value: "After", extra: true }])).ok, false);
  assert.equal(validateStrategyDelta(fixture(), payload([{ type: "delete-strategy", strategyId: "strategy-1" }])).ok, false);
  const stale = validateStrategyDelta({ ...fixture(), revision: 5 }, payload()); assert.equal(stale.ok, true); assert.equal(stale.stale, true);
});

test("Strategy Delta applies only accepted low-risk Strategy content proposals without mutating unrelated case data", () => {
  const source = fixture(); const before = structuredClone(source); const validation = validateStrategyDelta(source, payload([
    { type: "update-strategy-rationale", strategyId: "strategy-1", value: "After" },
    { type: "add-strategy-assumption", strategyId: "strategy-1", value: "New assumption" },
    { type: "add-strategy-risk", strategyId: "strategy-1", value: "New risk" },
    { type: "add-strategy-next-step", strategyId: "strategy-1", value: "Write letter" },
  ]));
  const result = applyStrategyDelta(source, validation, [0, 1, 2, 3], "2026-09-18T12:00:00.000Z"); assert.equal(result.ok, true); assert.deepEqual(source, before);
  const updated = result.caseData.strategy[0]; assert.equal(updated.rationale, "After"); assert.deepEqual(updated.assumptions, ["Known", "New assumption"]); assert.deepEqual(updated.risks, ["New risk"]); assert.deepEqual(updated.nextSteps, ["Write letter"]); assert.deepEqual(result.caseData.evidence, before.evidence); assert.equal(updated.status, "open"); assert.equal(updated.decisionStatus, "proposed");
  const rejected = applyStrategyDelta(source, validation, [0], "2026-09-18T12:00:00.000Z"); assert.deepEqual(rejected.caseData.strategy[0].assumptions, ["Known"]);
});

test("Strategy Delta creates a new Goal-linked Strategy with a generated ID and rejects malformed payloads without mutation", () => {
  const source = fixture(); const validation = validateStrategyDelta(source, payload([{ type: "create-strategy", reason: "Alternative", strategy: { title: "New approach", objective: "Resolve", assumptions: ["Reply"] } }])); const result = applyStrategyDelta(source, validation, [0], "2026-09-18T12:00:00.000Z");
  assert.equal(result.ok, true); const created = result.caseData.strategy[1]; assert.notEqual(created.id, ""); assert.deepEqual(created.goalIds, ["goal-1"]); assert.equal(created.source, "ai-strategy-delta-1.0");
  assert.equal(validateStrategyDelta(source, payload([{ type: "create-strategy", strategy: { title: "No", status: "archived" } }])).ok, false);
  assert.equal(parseStrategyDeltaText("not-json").ok, false);
  assert.deepEqual(source, fixture());
});
