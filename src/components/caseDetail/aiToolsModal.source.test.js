import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/CaseDetail.jsx", "utf8");

test("AI Tools modal is viewport constrained with visible header and footer actions", () => {
  assert.match(source, /max-h-\[90vh\]/);
  assert.match(source, /flex max-h-\[90vh\] w-full max-w-4xl flex-col overflow-hidden/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="ai-tools-modal-title"/);
  assert.match(source, /grid min-h-0 flex-1 overflow-y-auto/);
  assert.match(source, /sticky top-0 shrink-0 rounded-md/);
  assert.match(source, /flex shrink-0 flex-wrap gap-2 border-t/);
});

test("AI Tools modal supports Escape close and focus containment", () => {
  assert.match(source, /function handleAiToolsKeyDown/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /setAiToolsOpen\(false\)/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /firstElement\.focus\(\)/);
  assert.match(source, /lastElement\.focus\(\)/);
  assert.match(source, /previouslyFocusedElement\.focus/);
});
