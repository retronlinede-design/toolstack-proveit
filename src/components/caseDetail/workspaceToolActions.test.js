import test from "node:test";
import assert from "node:assert/strict";

import { buildFloatingToolActions } from "./workspaceToolActions.js";

test("floating workspace menu exposes one AI Tools action instead of individual packs", () => {
  const calls = [];
  const actions = buildFloatingToolActions({
    handleWorkspaceOpenSequenceGroups: () => calls.push("groups"),
    handleWorkspaceOpenSequenceGroupAuditExport: () => calls.push("audit"),
    handleWorkspaceOpenIncidentDateRepairTool: () => calls.push("date"),
    openAiTools: () => calls.push("ai-tools"),
  });
  const labels = actions.map((action) => action.label);

  assert.equal(labels.filter((label) => label === "AI Tools").length, 1);
  assert.equal(labels.includes("Missing Function Summaries"), false);
  assert.equal(labels.includes("Ungrouped Incidents Audit"), false);
  assert.equal(labels.includes("Ungrouped Evidence Audit"), false);
  assert.equal(labels.includes("Weak Links Audit"), false);
  assert.equal(labels.includes("Chain Completion Pack"), false);
  assert.equal(labels.includes("Full Chain GPT Pack"), false);
  assert.equal(labels.includes("Case Slice Pack"), false);

  actions.find((action) => action.label === "AI Tools").onClick();
  assert.deepEqual(calls, ["ai-tools"]);
});
