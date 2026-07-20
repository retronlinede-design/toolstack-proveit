import assert from "node:assert/strict";
import test from "node:test";

import {
  filterStrategies,
  getStrategySummary,
  getStrategyReviewState,
  groupStrategiesBySequenceGroup,
  resolveStrategyOwner,
  sortStrategies,
} from "./strategyWorkspaceHelpers.js";

const strategies = [
  { id: "active", title: "Active response", eventDate: "2026-07-20", status: "open", updatedAt: "2026-07-19T10:00:00.000Z", linkedRecordIds: ["inc-1"], sequenceGroup: "Response" },
  { id: "archived", title: "Archived option", eventDate: "2026-06-01", status: "archived", updatedAt: "2026-06-02T10:00:00.000Z", linkedRecordIds: [] },
  { id: "unlinked", title: "Inspection plan", description: "Arrange inspection", eventDate: "2026-07-10", status: "open", updatedAt: "invalid", linkedRecordIds: [] },
];

test("strategy summary reports active archived unlinked and recently updated counts", () => {
  const summary = getStrategySummary(strategies, Date.parse("2026-07-20T10:00:00.000Z"));

  assert.deepEqual(summary, {
    total: 3, active: 2, archived: 1, unlinked: 2, recentlyUpdated: 1,
    criticalPriority: 0, highPriority: 0, dueForReview: 0, overdueReview: 0, openNextSteps: 0,
  });
});

test("strategy filters combine status and text search", () => {
  assert.deepEqual(filterStrategies(strategies, "inspection", "active").map((item) => item.id), ["unlinked"]);
  assert.deepEqual(filterStrategies(strategies, "", "archived").map((item) => item.id), ["archived"]);
  assert.deepEqual(filterStrategies(strategies, "", "unlinked").map((item) => item.id), ["archived", "unlinked"]);
});

test("strategy sorts do not mutate input and keep invalid dates at the bottom", () => {
  const source = [strategies[1], strategies[0], { id: "missing", title: "Missing date" }];
  const newest = sortStrategies(source, "newest");
  const oldest = sortStrategies(source, "oldest");

  assert.deepEqual(newest.map((item) => item.id), ["active", "archived", "missing"]);
  assert.deepEqual(oldest.map((item) => item.id), ["archived", "active", "missing"]);
  assert.deepEqual(source.map((item) => item.id), ["archived", "active", "missing"]);
});

test("sequence-group mode groups named strategies and labels blank groups Ungrouped", () => {
  const sorted = sortStrategies(strategies, "sequence-group");
  const groups = groupStrategiesBySequenceGroup(sorted);

  assert.deepEqual(groups.map((group) => group.name), ["Response", "Ungrouped"]);
  assert.deepEqual(groups[1].items.map((item) => item.id), ["unlinked", "archived"]);
});

test("strategy summary counts priorities, review states, and open next steps", () => {
  const structured = [
    { id: "critical", priority: "critical", reviewDate: "2026-07-19", status: "open", nextSteps: ["Act"] },
    { id: "high", priority: "high", reviewDate: "2026-07-20", status: "open", nextSteps: ["  ", "Review"] },
    { id: "future", priority: "high", reviewDate: "2026-08-10", status: "archived", nextSteps: ["Ignored"] },
    { id: "invalid", priority: "urgent", reviewDate: "2026-02-30", status: "open", nextSteps: [] },
  ];

  const summary = getStrategySummary(structured, Date.parse("2026-07-20T10:00:00.000Z"));
  assert.equal(summary.criticalPriority, 1);
  assert.equal(summary.highPriority, 2);
  assert.equal(summary.overdueReview, 1);
  assert.equal(summary.dueForReview, 1);
  assert.equal(summary.openNextSteps, 2);
});

test("review classification uses strict calendar dates without timezone shifts", () => {
  assert.equal(getStrategyReviewState({ reviewDate: "2026-07-19" }, "2026-07-20"), "overdue");
  assert.equal(getStrategyReviewState({ reviewDate: "2026-07-20" }, "2026-07-20"), "due-soon");
  assert.equal(getStrategyReviewState({ reviewDate: "2026-08-03" }, "2026-07-20"), "due-soon");
  assert.equal(getStrategyReviewState({ reviewDate: "2026-08-04" }, "2026-07-20"), "scheduled");
  assert.equal(getStrategyReviewState({ reviewDate: "2026-02-30" }, "2026-07-20"), "no-review-date");
  assert.equal(getStrategyReviewState({ reviewDate: "07/20/2026" }, "2026-07-20"), "no-review-date");
});

test("structured filters compose with search and status filters", () => {
  const structured = [
    { id: "match", title: "Response plan", status: "open", strategyType: "action", priority: "critical", reviewDate: "2026-07-21" },
    { id: "wrong-status", title: "Response archive", status: "archived", strategyType: "action", priority: "critical", reviewDate: "2026-07-21" },
    { id: "wrong-priority", title: "Response backup", status: "open", strategyType: "action", priority: "low", reviewDate: "2026-07-21" },
    { id: "legacy", title: "Legacy response", status: "open" },
  ];
  const filtered = filterStrategies(structured, "response", "active", {
    strategyType: "action", priority: "critical", reviewState: "due-soon", today: "2026-07-20",
  });

  assert.deepEqual(filtered.map((item) => item.id), ["match"]);
  assert.deepEqual(filterStrategies(structured, "legacy", "all").map((item) => item.id), ["legacy"]);
  assert.deepEqual(filterStrategies(structured, "", "all", { reviewState: "no-review-date", today: "2026-07-20" }).map((item) => item.id), ["legacy"]);
});

test("priority and review-date sorts use deterministic fallbacks and place unknown values last", () => {
  const source = [
    { id: "empty", priority: "", reviewDate: "", eventDate: "2026-07-20" },
    { id: "low", priority: "low", reviewDate: "2026-08-01", eventDate: "2026-07-15" },
    { id: "critical", priority: "critical", reviewDate: "2026-07-22", eventDate: "2026-07-10" },
    { id: "high", priority: "high", reviewDate: "invalid", eventDate: "2026-07-21" },
    { id: "medium", priority: "medium", reviewDate: "2026-07-22", eventDate: "2026-07-20" },
  ];

  assert.deepEqual(sortStrategies(source, "priority").map((item) => item.id), ["critical", "high", "medium", "low", "empty"]);
  assert.deepEqual(sortStrategies(source, "review-date").map((item) => item.id), ["medium", "critical", "low", "high", "empty"]);
  assert.deepEqual(source.map((item) => item.id), ["empty", "low", "critical", "high", "medium"]);
});

test("owner resolution returns names and handles missing parties without mutation", () => {
  const strategy = { id: "str-1", ownerPartyId: "party-1" };
  assert.deepEqual(resolveStrategyOwner(strategy, [{ id: "party-1", displayName: "Alex Smith" }]), { id: "party-1", name: "Alex Smith", missing: false });
  assert.deepEqual(resolveStrategyOwner({ ownerPartyId: "deleted" }, []), { id: "deleted", name: "Unknown owner", missing: true });
  assert.equal(resolveStrategyOwner({}, []), null);
  assert.deepEqual(strategy, { id: "str-1", ownerPartyId: "party-1" });
});
