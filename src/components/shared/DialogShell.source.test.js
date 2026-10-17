import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./DialogShell.jsx", import.meta.url), "utf8");

test("DialogShell supplies a labelled modal layer and standard sizing variants", () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby=\{titleId\}/);
  assert.match(source, /compact: "max-w-lg"/);
  assert.match(source, /workspace: "max-w-6xl"/);
  assert.match(source, /layer = "default"/);
  assert.match(source, /layer === "nested" \? "z-\[70\]" : layer === "manager" \? "z-\[50\]" : "z-\[60\]"/);
  assert.match(source, /suspendFocusManagement = false/);
  assert.match(source, /z-\[60\]/);
});

test("DialogShell traps and restores focus with explicit dismissal policies", () => {
  assert.match(source, /event\.key === "Escape" && dismissOnEscape/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /previousFocusRef\.current\?\.focus\?\.\(\)/);
  assert.match(source, /dismissOnBackdrop && event\.target === event\.currentTarget/);
});

test("DialogShell can yield focus and Escape ownership to a nested dialog", () => {
  assert.match(source, /if \(suspendFocusManagement\) return undefined/);
  assert.match(source, /focusManagementSuspendedRef\.current = suspendFocusManagement/);
  assert.match(source, /if \(!focusManagementSuspendedRef\.current\) previousFocusRef\.current\?\.focus\?\.\(\)/);
});
