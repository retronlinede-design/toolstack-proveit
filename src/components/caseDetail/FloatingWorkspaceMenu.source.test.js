import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/FloatingWorkspaceMenu.jsx", "utf8");

test("floating Tools menu contains only the retained application tools", () => {
  assert.match(source, /onOpenAiWorkspace/);
  assert.match(source, />AI Workspace</);
  assert.match(source, /onClick=\{onOpenAiWorkspace\}/);
  assert.match(source, />Tools</);
  assert.match(source, />Back to Top</);
  assert.doesNotMatch(source, /Add records/);
  assert.doesNotMatch(source, /navigationActions/);
  assert.doesNotMatch(source, /addActions/);
});
