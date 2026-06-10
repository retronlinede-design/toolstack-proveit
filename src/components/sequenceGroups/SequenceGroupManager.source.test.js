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
    "Copy Full Chain Markdown",
    "Copy Chain Completion Markdown",
    "Open Chain Audit",
    "Copy Full Chain JSON",
    "Copy Chain Completion JSON",
    "Download Group Index JSON",
    "Download Group Index Markdown",
    "Rename",
    "Merge",
    "Clear group label",
  ]) {
    assert.equal(source.includes(label), true, `${label} should remain visible in the manager UI`);
  }
});
