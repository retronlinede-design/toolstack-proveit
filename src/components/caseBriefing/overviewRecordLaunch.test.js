import assert from "node:assert/strict";
import test from "node:test";

import { getOverviewRecordLaunch } from "./overviewRecordLaunch.js";

const records = {
  incidents: [{ id: "incident-1" }], evidence: [{ id: "evidence-1" }], documents: [{ id: "document-1" }],
  ledger: [{ id: "ledger-1" }], strategy: [{ id: "strategy-1" }], watchItems: [{ id: "watch-1" }],
};

test("routes Next Actions by stable source type and source ID", () => {
  assert.equal(getOverviewRecordLaunch({ sourceType: "strategy", sourceRecordId: "strategy-1" }, records).targetType, "strategy");
  assert.equal(getOverviewRecordLaunch({ sourceType: "watch", sourceRecordId: "watch-1" }, records).targetType, "watch");
  assert.deepEqual(getOverviewRecordLaunch({ sourceType: "case_briefing" }, records), { handled: true, targetType: "case_briefing", targetId: "actionSummary" });
  assert.deepEqual(getOverviewRecordLaunch({ sourceType: "issue_review", issueId: "issue-1", issueName: "Issue" }, records), { handled: true, targetType: "issue", targetId: "issue-1", targetName: "Issue" });
});

test("routes attention and activity records through the same modal boundary", () => {
  for (const [recordType, targetType] of [["incidents", "incidents"], ["evidence", "evidence"], ["documents", "document"], ["ledger", "ledger"], ["strategy", "strategy"], ["watchItems", "watch"]]) {
    const collection = recordType;
    const record = records[collection][0];
    const launch = getOverviewRecordLaunch({ recordType, record }, records);
    assert.equal(launch.handled, true);
    assert.equal(launch.targetType, targetType);
    assert.equal(launch.targetId, record.id);
  }
});

test("diagnostic corrections resolve affected records by ID rather than visible text", () => {
  const launch = getOverviewRecordLaunch({ sourceType: "diagnostic", affectedRecordType: "incidents", affectedRecordId: "incident-1", title: "Unrelated visible text" }, records);
  assert.equal(launch.targetId, "incident-1");
  assert.equal(launch.record, records.incidents[0]);
});

test("unsupported and stale sources return an explicit non-navigation result", () => {
  for (const item of [{ sourceType: "legacy_task", title: "Legacy" }, { sourceType: "strategy", sourceRecordId: "missing" }, null]) {
    assert.deepEqual(getOverviewRecordLaunch(item, records), { handled: false, reason: "No direct record available" });
  }
});
