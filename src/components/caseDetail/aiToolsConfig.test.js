import test from "node:test";
import assert from "node:assert/strict";

import { AI_TOOL_OPTIONS } from "./aiToolsConfig.js";

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
      "Case Slice Pack",
    ]
  );
});
