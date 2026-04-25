import test from "node:test";
import assert from "node:assert/strict";

import { getReportHeadingLabel } from "./reportHeadingLabels.js";

test("getReportHeadingLabel returns English labels", () => {
  assert.equal(getReportHeadingLabel("AT_A_GLANCE", "en"), "At A Glance");
});

test("getReportHeadingLabel returns German labels", () => {
  assert.equal(getReportHeadingLabel("AT_A_GLANCE", "de"), "Auf einen Blick");
});

test("getReportHeadingLabel falls back to English for unknown languages", () => {
  assert.equal(getReportHeadingLabel("KEY_FACTS", "fr"), "Key Facts");
});

test("getReportHeadingLabel falls back to the key for unknown labels", () => {
  assert.equal(getReportHeadingLabel("UNKNOWN_HEADING", "de"), "UNKNOWN_HEADING");
});
