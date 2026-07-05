import test from "node:test";
import assert from "node:assert/strict";

import { AI_TOOL_OPTIONS, AI_WORKSPACE_SECTIONS } from "./aiToolsConfig.js";

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

test("AI Workspace groups tasks into the requested command sections", () => {
  assert.deepEqual(
    AI_WORKSPACE_SECTIONS.map((section) => section.title),
    [
      "Whole Case",
      "Investigation Quality",
      "Report Writing",
      "Issue Review",
      "Advanced AI Tools",
    ]
  );

  const availableToolIds = new Set(AI_TOOL_OPTIONS.map((tool) => tool.id));
  for (const section of AI_WORKSPACE_SECTIONS) {
    assert.ok(section.description);
    assert.ok(section.icon);
    assert.ok(section.tasks.length > 0);
    section.tasks
      .filter((task) => task.toolId)
      .forEach((task) => assert.equal(availableToolIds.has(task.toolId), true));
  }
});
