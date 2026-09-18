import assert from "node:assert/strict";
import test from "node:test";
import { buildStrategyContextPayload, getStrategyContextFilename, serializeStrategyContext, STRATEGY_CONTEXT_CONTRACT } from "./strategyContextExport.js";

function fixture() {
  return {
    id: "case-1", revision: 7, name: "Housing / Case", status: "open", privacyLock: { pin: "1234" }, backupState: { secret: true },
    goals: [{ id: "goal-1", title: "Secure repairs", description: "Get repairs", successCriteria: ["Written plan"], status: "active", priority: "high", issueIds: ["issue-1"], reviewDate: "2026-10-01", createdAt: "2026-01-01", updatedAt: "2026-01-02" }],
    issues: [{ id: "issue-1", reference: "ISS-009", name: "Repairs", status: "open", priority: "high" }], parties: [{ id: "party-1", name: "Tenant" }],
    incidents: [{ id: "inc-1", title: "Leak", eventDate: "2026-02-01", sequenceGroupId: "issue-1", attachments: [{ dataUrl: "secret-bytes", storage: { imageId: "image-1" } }] }], evidence: [{ id: "ev-1", title: "Photo", sequenceGroupId: "issue-1", attachments: [{ backupDataUrl: "more-secret" }] }],
    strategy: [{ id: "str-1", title: "Escalate", goalIds: ["goal-1"], sequenceGroupId: "issue-1", linkedRecordIds: ["inc-1"], ownerPartyId: "party-1", objective: "Obtain repairs" }, { id: "str-2", title: "Unrelated", goalIds: ["goal-other"], linkedRecordIds: ["missing"] }, { id: "str-legacy", title: "Legacy unlinked" }],
    documents: [], ledger: [], tasks: [], watchItems: [], actionSummary: {},
  };
}

test("Strategy Context requires a focused Goal and exports only its canonical linked data", () => {
  assert.throws(() => buildStrategyContextPayload(fixture(), ""), /focused Goal/);
  const payload = buildStrategyContextPayload(fixture(), "goal-1", { exportedAt: "2026-09-18T12:00:00.000Z" });
  assert.equal(payload.contract, STRATEGY_CONTEXT_CONTRACT); assert.equal(payload.contractVersion, "1.0"); assert.equal(payload.baseRevision, 7); assert.equal(payload.focusedGoal.id, "goal-1"); assert.deepEqual(payload.focusedGoal.issueIds, ["issue-1"]);
  assert.deepEqual(payload.linkedStrategies.map((item) => item.id), ["str-1"]); assert.deepEqual(payload.relatedIssues.map((item) => [item.id, item.reference]), [["issue-1", "ISS-009"]]); assert.deepEqual(payload.relevantContext.records.incidents.map((item) => item.id), ["inc-1"]); assert.deepEqual(payload.relevantContext.chronology.map((item) => item.id), ["inc-1", "ev-1", "str-1"]);
});

test("Strategy Context is safe, non-mutating, and its serialized form is the shared clipboard/download payload", () => {
  const source = fixture(); const before = structuredClone(source); const payload = buildStrategyContextPayload(source, "goal-1", { exportedAt: "2026-09-18T12:00:00.000Z" }); const serialized = serializeStrategyContext(payload);
  assert.deepEqual(source, before);
  for (const forbidden of ["1234", "privacyLock", "backupState", "secret-bytes", "more-secret", "image-1", "dataUrl", "backupDataUrl"]) assert.equal(serialized.includes(forbidden), false, forbidden);
  assert.equal(Object.hasOwn(payload.relevantContext.records.incidents[0].attachments[0], "storage"), false);
  assert.equal(JSON.parse(serialized).focusedGoal.id, "goal-1"); assert.equal(getStrategyContextFilename(source, payload.focusedGoal), "proveit-strategy-context-housing-case-goal-1.json");
});

test("legacy cases without Goals fail safely and never fall back to a whole-case export", () => { assert.throws(() => buildStrategyContextPayload({ id: "legacy", name: "Legacy", strategy: [{ id: "s1" }] }, "goal-1"), /focused Goal is not available/); });
