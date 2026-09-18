import assert from "node:assert/strict";
import test from "node:test";

import { filterStrategies } from "./strategyWorkspaceHelpers.js";
import { DEFAULT_STRATEGY_LIST_FILTERS, getStrategySummaryShortcutFilters, isStrategySummaryShortcutActive } from "./strategySummaryShortcuts.js";

const strategies = [
  { id: "open-high", status: "open", priority: "high", reviewDate: "2026-07-21", linkedRecordIds: ["inc-1"] },
  { id: "archived", status: "archived", priority: "critical", reviewDate: "2026-07-19", linkedRecordIds: [] },
  { id: "unlinked", status: "open", priority: "low", reviewDate: "", linkedRecordIds: [] },
];

function filteredIds(shortcut) {
  const filters = getStrategySummaryShortcutFilters(shortcut);
  return filterStrategies(strategies, filters.search, filters.statusFilter, {
    strategyType: filters.strategyTypeFilter,
    priority: filters.priorityFilter,
    reviewState: filters.reviewStateFilter,
    today: "2026-07-20",
  }).map((strategy) => strategy.id);
}

test("summary shortcuts reuse the existing Strategy filter values and predicates", () => {
  assert.deepEqual(filteredIds("all"), ["open-high", "archived", "unlinked"]);
  assert.deepEqual(filteredIds("active"), ["open-high", "unlinked"]);
  assert.deepEqual(filteredIds("archived"), ["archived"]);
  assert.deepEqual(filteredIds("unlinked"), ["archived", "unlinked"]);
  assert.deepEqual(filteredIds("high"), ["open-high"]);
  assert.deepEqual(filteredIds("critical"), ["archived"]);
  assert.deepEqual(filteredIds("dueSoon"), ["open-high"]);
  assert.deepEqual(filteredIds("overdue"), ["archived"]);
});

test("summary shortcut selection is derived solely from the visible filter state", () => {
  assert.equal(isStrategySummaryShortcutActive("all", DEFAULT_STRATEGY_LIST_FILTERS), true);
  assert.equal(isStrategySummaryShortcutActive("archived", { ...DEFAULT_STRATEGY_LIST_FILTERS, statusFilter: "archived" }), true);
  assert.equal(isStrategySummaryShortcutActive("archived", { ...DEFAULT_STRATEGY_LIST_FILTERS, statusFilter: "archived", priorityFilter: "high" }), false);
  assert.equal(isStrategySummaryShortcutActive("unknown", DEFAULT_STRATEGY_LIST_FILTERS), false);
  assert.equal(getStrategySummaryShortcutFilters("unknown"), null);
});
