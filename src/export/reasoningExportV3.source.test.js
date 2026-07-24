import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/App.jsx", "utf8");

test("export UI exposes v3 explicitly while retaining the existing reasoning export", () => {
  assert.match(source, />\s*Reasoning Export\s*</);
  assert.match(source, /Reasoning Export v3 — Structured Strategy and To Watch/);
  assert.match(source, /buildCaseReasoningExportPayload\(c, mode\)/);
  assert.match(source, /buildCaseReasoningExportV3Payload\(c\)/);
});
