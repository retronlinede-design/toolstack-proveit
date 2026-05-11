import test from "node:test";
import assert from "node:assert/strict";
import { cleanGptPreviewText } from "./gptDeltaModalHelpers.js";

test("cleanGptPreviewText normalizes common mojibake in preview text", () => {
  assert.equal(cleanGptPreviewText("A Ã¢â‚¬â€œ B"), "A - B");
  assert.equal(cleanGptPreviewText("ItÃ¢â‚¬â„¢s"), "It's");
  assert.equal(cleanGptPreviewText("Ã¢â‚¬Å“quotedÃ¢â‚¬Â"), "\"quoted\"");
});

test("cleanGptPreviewText handles empty values safely", () => {
  assert.equal(cleanGptPreviewText(null), "");
  assert.equal(cleanGptPreviewText(undefined), "");
});
