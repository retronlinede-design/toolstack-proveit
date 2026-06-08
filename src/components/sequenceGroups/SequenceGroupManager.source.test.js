import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./SequenceGroupManager.jsx", import.meta.url), "utf8");

test("SequenceGroupManager keeps grouped sections and required actions available", () => {
  for (const label of [
    "Overview",
    "Records",
    "Diagnostics",
    "AI Tools",
    "Exports",
    "Edit",
    "Open",
    "More",
    "Full Chain GPT Pack",
    "Chain Completion Pack",
    "Audit Chain",
    "Export Full Chain JSON",
    "Export Chain JSON",
    "Rename",
    "Merge",
    "Clear group label",
  ]) {
    assert.equal(source.includes(label), true, `${label} should remain visible in the manager UI`);
  }
});
