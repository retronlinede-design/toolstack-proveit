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
  assert.match(source, /layer === "nested" \? "z-\[70\]" : "z-\[60\]"/);
  assert.match(source, /z-\[60\]/);
});

test("DialogShell traps and restores focus with explicit dismissal policies", () => {
  assert.match(source, /event\.key === "Escape" && dismissOnEscape/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /previousFocusRef\.current\?\.focus\?\.\(\)/);
  assert.match(source, /dismissOnBackdrop && event\.target === event\.currentTarget/);
});
