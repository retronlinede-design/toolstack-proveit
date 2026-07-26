import assert from "node:assert/strict";
import test from "node:test";

import { buildActionPlanReport } from "./actionPlanReport.js";

function buildCase() {
  return {
    id: "case-1",
    name: "Scope test",
    actionSummary: {
      currentFocus: "Whole-case focus",
      nextActions: [
        { text: "Structured Alpha action", sequenceGroup: "Alpha: Review", completed: false },
        "Mention Alpha: Review in unrelated prose",
      ],
      importantReminders: ["Whole-case reminder"],
      criticalDeadlines: [],
      strategyFocus: [],
    },
    incidents: [
      { id: "incident-a", title: "Alpha incident", sequenceGroup: "ALPHA: REVIEW", eventDate: "2026-01-01" },
      { id: "incident-b", title: "Mentions Alpha: Review but belongs elsewhere", sequenceGroup: "Beta" },
    ],
    evidence: [],
    documents: [],
    strategy: [
      { id: "strategy-a", title: "Alpha strategy", sequenceGroup: "Alpha: Review", status: "active" },
      { id: "strategy-b", title: "Alpha: Review words only", sequenceGroup: "Beta", status: "active" },
    ],
    watchItems: [
      { id: "watch-a", title: "Alpha watch", sequenceGroup: "Alpha: Review", status: "active" },
      { id: "watch-b", title: "Alpha: Review words only", sequenceGroup: "Beta", status: "active" },
    ],
    tasks: [
      { id: "task-a", title: "Alpha task", sequenceGroup: "Alpha: Review", status: "open" },
      { id: "task-b", title: "Alpha: Review words only", sequenceGroup: "Beta", status: "open" },
    ],
    ledger: [],
  };
}

test("whole-case Action Plan preserves current whole-case content", () => {
  const report = buildActionPlanReport(buildCase(), { scope: "case", generatedAt: "2026-01-01T00:00:00.000Z" });

  assert.equal(report.scopeLabel, "Whole case");
  assert.equal(report.currentFocus, "Whole-case focus");
  assert.deepEqual(report.nextActions, ["Structured Alpha action", "Mention Alpha: Review in unrelated prose"]);
  assert.equal(report.openStrategyRecords.length, 2);
  assert.equal(report.watchItems.length, 2);
  assert.equal(report.openTasks.length, 2);
});

test("sequence group Action Plan uses structured membership instead of matching text", () => {
  const report = buildActionPlanReport(buildCase(), {
    scope: "sequenceGroup",
    sequenceGroupName: "alpha: review",
  });

  assert.deepEqual(report.nextActions, ["Structured Alpha action"]);
  assert.deepEqual(report.openStrategyRecords.map((item) => item.id), ["strategy-a"]);
  assert.deepEqual(report.watchItems.map((item) => item.id), ["watch-a"]);
  assert.deepEqual(report.openTasks.map((item) => item.id), ["task-a"]);
  assert.equal(report.counts.openStrategy, 1);
  assert.equal(report.counts.openTasks, 1);
  assert.equal(report.currentFocus, "");
});

test("punctuation and casing in sequence group labels resolve safely", () => {
  const report = buildActionPlanReport(buildCase(), {
    scopeType: "sequenceGroup",
    sequenceGroup: "  alpha: review  ",
  });

  assert.equal(report.openStrategyRecords[0].title, "Alpha strategy");
  assert.equal(report.isEmptyScope, false);
});

test("empty, metadata-only, and missing groups return a clear empty scope", () => {
  for (const sequenceGroupName of ["Metadata Only", "Missing Group", ""]) {
    const report = buildActionPlanReport(buildCase(), { scope: "sequenceGroup", sequenceGroupName });
    assert.equal(report.isEmptyScope, true);
    assert.equal(report.openStrategyRecords.length, 0);
    assert.equal(report.watchItems.length, 0);
    assert.equal(report.openTasks.length, 0);
  }
});

test("malformed optional fields do not crash Action Plan assembly", () => {
  const report = buildActionPlanReport({ id: "case-empty", actionSummary: { nextActions: null }, strategy: null }, {
    scope: "sequenceGroup",
    sequenceGroupName: "Group (A)",
  });

  assert.equal(report.isEmptyScope, true);
  assert.equal(report.counts.nextActions, 0);
  assert.deepEqual(report.risks, []);
});
