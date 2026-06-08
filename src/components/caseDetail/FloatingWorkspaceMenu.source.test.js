import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/caseDetail/FloatingWorkspaceMenu.jsx", "utf8");

test("floating workspace controls expose a dedicated AI Workspace button above Workspace", () => {
  assert.match(source, /onOpenAiWorkspace/);
  assert.match(source, /AI Workspace/);
  assert.match(source, /onClick=\{onOpenAiWorkspace\}/);
  assert.match(source, /mb-2 ml-auto/);
});
