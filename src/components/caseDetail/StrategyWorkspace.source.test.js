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
  assert.match(source, /Current Strategy/);
  assert.match(source, /All Strategy Records/);
  assert.match(source, /getStrategiesForGoal/);
  assert.match(source, /Work with AI/);
  assert.match(source, /Copy Strategy Context/);
  assert.match(source, /Download Strategy Context JSON/);
  assert.match(source, /Download Goals &amp; Strategy JSON/);
  assert.match(source, /buildStrategyContextPayload/);
  assert.match(source, /buildGoalsStrategyExport/);
  assert.match(source, /serializeStrategyContext/);
  assert.match(source, /Update from AI/);
  assert.match(source, /validateStrategyDelta/);
  assert.match(source, /applyStrategyDelta/);
  assert.match(source, /StrategyDeltaModal/);
  assert.match(source, /copyStrategyContext[\s\S]*buildFocusedStrategyContext/);
  assert.match(source, /downloadStrategyContext[\s\S]*buildFocusedStrategyContext/);
  assert.match(source, /downloadGoalsStrategyExport[\s\S]*buildGoalsStrategyExport/);
});
