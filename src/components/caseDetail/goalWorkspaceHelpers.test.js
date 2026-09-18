import test from "node:test";
import assert from "node:assert/strict";
import { getVisibleGoals, prepareGoalDraft, saveGoalToCase, toggleGoalIssueId } from "./goalWorkspaceHelpers.js";

const time = "2026-09-18T12:00:00.000Z";
const existingGoal = {
  id: "goal-1", title: "Restore heating", description: "Secure a working heating system",
  successCriteria: ["Heating works"], status: "active", priority: "high", issueIds: ["issue-1"],
  reviewDate: "2026-10-01", createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z",
};

test("Goal workspace: active view renders active Goals while completed Goals remain available", () => {
  const goals = [existingGoal, { ...existingGoal, id: "goal-2", title: "Old goal", status: "achieved" }];
  assert.deepEqual(getVisibleGoals(goals).map((goal) => goal.id), ["goal-1"]);
  assert.deepEqual(getVisibleGoals(goals, "all").map((goal) => goal.id), ["goal-1", "goal-2"]);
  assert.deepEqual(getVisibleGoals(undefined), []);
});

test("Goal workspace: a Goal can be created for a legacy case without Goals", () => {
  const result = saveGoalToCase({ id: "case", strategy: [{ id: "strategy" }] }, {
    title: "Obtain a response", status: "active", priority: "medium", issueIds: ["issue-1"], successCriteria: ["Written response"],
  }, "", time);
  assert.equal(result.caseData.goals.length, 1);
  assert.equal(result.goal.title, "Obtain a response");
  assert.deepEqual(result.goal.issueIds, ["issue-1"]);
  assert.deepEqual(result.caseData.strategy, [{ id: "strategy" }]);
});

test("Goal workspace: editing preserves canonical fields while persisting status and Issue IDs", () => {
  const draft = { ...prepareGoalDraft(existingGoal), title: "Restore heating promptly", status: "achieved", issueIds: ["issue-2", "issue-2"] };
  const result = saveGoalToCase({ id: "case", goals: [existingGoal] }, draft, "goal-1", time);
  assert.equal(result.goal.title, "Restore heating promptly");
  assert.equal(result.goal.status, "achieved");
  assert.deepEqual(result.goal.issueIds, ["issue-2"]);
  assert.deepEqual(result.goal.successCriteria, ["Heating works"]);
  assert.equal(result.goal.createdAt, existingGoal.createdAt);
  assert.equal(result.goal.updatedAt, time);
});

test("Goal workspace: Issue selection stores canonical IDs only", () => {
  assert.deepEqual(toggleGoalIssueId(["issue-1"], "issue-2", true), ["issue-1", "issue-2"]);
  assert.deepEqual(toggleGoalIssueId(["issue-1", "issue-2"], "issue-1", false), ["issue-2"]);
});
