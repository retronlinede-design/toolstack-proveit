import assert from "node:assert/strict";
import test from "node:test";

import { buildGoalsStrategyExport, getGoalsStrategyExportFilename, GOALS_STRATEGY_EXPORT_CONTRACT } from "./goalsStrategyExport.js";

function fixture() {
  return {
    id: "case-1", name: "Housing / Case", status: "open", revision: 7,
    goals: [{ id: "goal-1", title: "Secure repairs", description: "Get repairs", successCriteria: ["Written plan"], status: "active", priority: "high", issueIds: ["issue-1"], reviewDate: "2026-10-01", createdAt: "2026-01-01", updatedAt: "2026-01-02", private: "no" }],
    strategy: [
      { id: "str-1", type: "strategy", title: "Escalate", status: "open", source: "manual", goalIds: ["goal-1"], sequenceGroupId: "issue-1", sequenceGroup: "Repairs", linkedRecordIds: ["inc-1"], linkedEvidenceIds: ["ev-1"], linkedPartyIds: ["party-1"], strategySchemaVersion: 3, objective: "Obtain repairs", rationale: "Notice failed", desiredOutcome: "Written plan", priority: "high", reviewDate: "2026-10-01", decisionStatus: "", ownerPartyId: "party-1", assumptions: ["Landlord responds"], risks: ["Delay"], nextSteps: ["Send notice"], createdAt: "2026-01-01", updatedAt: "2026-01-02", attachments: [{ dataUrl: "secret-bytes", storage: { imageId: "image-1" } }], privateCopy: { pin: "1234" } },
      { id: "str-archived", title: "Archived", status: "archived", goalIds: [], attachments: [{ backupDataUrl: "more-secret" }] },
      { id: "str-legacy", title: "Legacy unlinked" },
    ],
    evidence: [{ id: "ev-1", attachment: "private" }], incidents: [{ id: "inc-1" }], parties: [{ id: "party-1" }],
    actionSummary: { private: "do-not-export" }, privacyLock: { pin: "4567" }, backupState: { secret: true },
  };
}

test("Goals & Strategy export includes every canonical Goal and Strategy record with their stored links", () => {
  const payload = buildGoalsStrategyExport(fixture(), { exportedAt: "2026-09-18T12:00:00.000Z" });
  assert.equal(payload.contract, GOALS_STRATEGY_EXPORT_CONTRACT); assert.equal(payload.version, "1.0");
  assert.equal(payload.baseRevision, 7); assert.deepEqual(payload.case, { id: "case-1", name: "Housing / Case", status: "open" });
  assert.deepEqual(payload.goals.map((goal) => [goal.id, goal.issueIds]), [["goal-1", ["issue-1"]]]);
  assert.deepEqual(payload.strategy.map((strategy) => strategy.id), ["str-1", "str-archived", "str-legacy"]);
  assert.deepEqual(payload.strategy[0].goalIds, ["goal-1"]); assert.deepEqual(payload.strategy[0].linkedRecordIds, ["inc-1"]);
  assert.deepEqual(payload.strategy[0].linkedEvidenceIds, ["ev-1"]); assert.equal(payload.strategy[1].status, "archived");
});

test("Goals & Strategy export is allowlisted, excludes private/binary data, and never mutates the case", () => {
  const source = fixture(); const before = structuredClone(source); const payload = buildGoalsStrategyExport(source, { exportedAt: "2026-09-18T12:00:00.000Z" }); const serialized = JSON.stringify(payload);
  assert.deepEqual(source, before);
  for (const forbidden of ["secret-bytes", "more-secret", "image-1", "dataUrl", "backupDataUrl", "privateCopy", "1234", "4567", "backupState", "actionSummary", "evidence", "incidents", "parties"]) assert.equal(serialized.includes(forbidden), false, forbidden);
  assert.equal(Object.hasOwn(payload.strategy[0], "attachments"), false);
  assert.equal(Object.hasOwn(payload.goals[0], "private"), false);
  assert.equal(getGoalsStrategyExportFilename(source), "housing-case-goals-strategy.json");
});

test("legacy cases without Goals safely export all Strategy records", () => {
  const payload = buildGoalsStrategyExport({ id: "legacy", name: "Legacy", strategy: [{ id: "str-1", title: "Still available" }] }, { exportedAt: "2026-09-18T12:00:00.000Z" });
  assert.deepEqual(payload.goals, []); assert.deepEqual(payload.strategy.map((strategy) => strategy.id), ["str-1"]);
});
