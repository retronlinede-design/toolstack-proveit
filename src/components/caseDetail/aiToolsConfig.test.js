import test from "node:test";
import assert from "node:assert/strict";

import { AI_TASK_GUIDANCE, AI_TOOL_OPTIONS, AI_WORKSPACE_SECTIONS, CASE_QUALITY_REVIEW_MODES, ISSUE_REVIEW_MODES } from "./aiToolsConfig.js";

test("AI Tools modal selector still lists all GPT work packs", () => {
  assert.deepEqual(
    AI_TOOL_OPTIONS.map((tool) => tool.title),
    [
      "Missing Function Summaries",
      "Ungrouped Incidents Audit",
      "Ungrouped Evidence Audit",
      "Weak Links Audit",
      "Chain Completion Pack",
      "Full Chain GPT Pack",
      "Management Report Builder Pack",
      "Case Slice Pack",
    ]
  );
});

test("AI Workspace groups the retained tasks into the simplified workspace sections", () => {
  assert.deepEqual(
    AI_WORKSPACE_SECTIONS.map((section) => section.title),
    [
      "Share Case Context",
      "Investigation Review",
      "Advanced Tools",
    ]
  );

  const availableToolIds = new Set(AI_TOOL_OPTIONS.map((tool) => tool.id));
  const tasks = AI_WORKSPACE_SECTIONS.flatMap((section) => section.groups?.flatMap((group) => group.tasks) || section.tasks || []);
  assert.equal(tasks.length, 8);
  assert.deepEqual(
    tasks.map((task) => task.id),
    [
      "download-ai-workspace-snapshot",
      "download-split-reasoning-package",
      "issue-review",
      "case-quality-review",
      "advanced-reasoning-snapshot",
      "review-selected-records",
      "advanced-link-map",
      "advanced-gpt-protocol-pack",
    ]
  );
  assert.equal(tasks.some((task) => task.id === "review-entire-investigation"), false);
  assert.equal(tasks.some((task) => task.id === "advanced-gpt-update"), false);
  assert.equal(tasks.some((task) => task.id === "prepare-management-report"), false);
  assert.equal(tasks.some((task) => task.id === "specialist-review-prompt"), false);
  assert.equal(tasks.some((task) => task.id === "improve-report-narrative"), false);
  for (const legacyTaskId of ["find-investigation-gaps", "improve-evidence-summaries", "review-ungrouped-incidents", "review-ungrouped-evidence", "review-investigation-thread", "complete-investigation-thread", "advanced-sequence-group-audit"]) assert.equal(tasks.some((task) => task.id === legacyTaskId), false);
  assert.equal(AI_WORKSPACE_SECTIONS.find((section) => section.id === "advanced-ai-tools")?.collapsedByDefault, true);
  for (const section of AI_WORKSPACE_SECTIONS) {
    assert.ok(section.description);
    assert.ok(section.icon);
    const sectionTasks = section.groups?.flatMap((group) => group.tasks) || section.tasks || [];
    assert.ok(sectionTasks.length > 0);
    sectionTasks
      .filter((task) => task.toolId)
      .forEach((task) => assert.equal(availableToolIds.has(task.toolId), true));
    sectionTasks.forEach((task) => {
      const guidance = AI_TASK_GUIDANCE[task.id];
      assert.ok(guidance);
      assert.ok(guidance.workflow.length > 0);
      assert.ok(guidance.recommendedGpt);
      assert.ok(guidance.exampleQuestions.length >= 4);
    });
  }
});

test("Case Quality Review retains each existing audit builder as a selectable mode", () => {
  assert.deepEqual(
    CASE_QUALITY_REVIEW_MODES.map(({ id, legacyTaskId, toolId }) => ({ id, legacyTaskId, toolId })),
    [
      { id: "investigation-gaps", legacyTaskId: "find-investigation-gaps", toolId: "weak-links-audit" },
      { id: "evidence-summaries", legacyTaskId: "improve-evidence-summaries", toolId: "missing-function-summaries" },
      { id: "ungrouped-incidents", legacyTaskId: "review-ungrouped-incidents", toolId: "ungrouped-incidents-audit" },
      { id: "ungrouped-evidence", legacyTaskId: "review-ungrouped-evidence", toolId: "ungrouped-evidence-audit" },
    ]
  );
  assert.ok(AI_TASK_GUIDANCE["case-quality-review"]);
});

test("Issue Review retains both existing Issue handoff builders as selectable modes", () => {
  assert.deepEqual(
    ISSUE_REVIEW_MODES.map(({ id, legacyTaskId, toolId }) => ({ id, legacyTaskId, toolId })),
    [
      { id: "full-review", legacyTaskId: "review-investigation-thread", toolId: "full-chain-gpt-pack" },
      { id: "completion-gaps", legacyTaskId: "complete-investigation-thread", toolId: "chain-completion-pack" },
    ]
  );
  assert.ok(AI_TASK_GUIDANCE["issue-review"]);
});
