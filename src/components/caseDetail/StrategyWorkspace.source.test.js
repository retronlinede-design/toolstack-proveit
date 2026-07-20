import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./StrategyWorkspace.jsx", import.meta.url), "utf8");

test("strategy workspace exposes structured filters, sorts, summary metrics, and filtered empty reset", () => {
  assert.match(source, /Critical Priority/);
  assert.match(source, /High Priority/);
  assert.match(source, /Due for Review/);
  assert.match(source, /Overdue Reviews/);
  assert.match(source, /Open Next Steps/);
  assert.match(source, /Strategy Type/);
  assert.match(source, /Review State/);
  assert.match(source, /value="priority">Priority/);
  assert.match(source, /value="review-date">Review Date/);
  assert.match(source, /Reset Filters/);
  assert.match(source, /No strategies yet\./);
  assert.match(source, /groupStrategiesBySequenceGroup/);
});
