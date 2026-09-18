import test from "node:test";
import assert from "node:assert/strict";
import { getStrategiesForGoal } from "./strategyGoalHelpers.js";

const strategies = [
  { id: "strategy-a", goalIds: ["goal-a"], title: "A" },
  { id: "strategy-b", goalIds: ["goal-b", "goal-a"], title: "B" },
  { id: "strategy-c", title: "Legacy unlinked" },
];

test("Current Strategy selects only records linked to the focused canonical Goal ID", () => {
  assert.deepEqual(getStrategiesForGoal(strategies, "goal-a").map((strategy) => strategy.id), ["strategy-a", "strategy-b"]);
  assert.deepEqual(getStrategiesForGoal(strategies, "goal-b").map((strategy) => strategy.id), ["strategy-b"]);
  assert.deepEqual(getStrategiesForGoal(strategies, ""), []);
});
