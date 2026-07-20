import assert from "node:assert/strict";
import test from "node:test";

import {
  filterStrategies,
  getStrategySummary,
  groupStrategiesBySequenceGroup,
  sortStrategies,
} from "./strategyWorkspaceHelpers.js";

const strategies = [
  { id: "active", title: "Active response", eventDate: "2026-07-20", status: "open", updatedAt: "2026-07-19T10:00:00.000Z", linkedRecordIds: ["inc-1"], sequenceGroup: "Response" },
  { id: "archived", title: "Archived option", eventDate: "2026-06-01", status: "archived", updatedAt: "2026-06-02T10:00:00.000Z", linkedRecordIds: [] },
  { id: "unlinked", title: "Inspection plan", description: "Arrange inspection", eventDate: "2026-07-10", status: "open", updatedAt: "invalid", linkedRecordIds: [] },
];

test("strategy summary reports active archived unlinked and recently updated counts", () => {
  const summary = getStrategySummary(strategies, Date.parse("2026-07-20T10:00:00.000Z"));

  assert.deepEqual(summary, { total: 3, active: 2, archived: 1, unlinked: 2, recentlyUpdated: 1 });
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
