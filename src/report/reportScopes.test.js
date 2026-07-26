import assert from "node:assert/strict";
import test from "node:test";

import {
  getSupportedReportScopes,
  normalizeReportScope,
  normaliseReportScope,
  reportSupportsScope,
} from "./reportScopes.js";

test("whole-case-only reports reject sequence group scope", () => {
  assert.deepEqual(getSupportedReportScopes("management"), ["case"]);
  assert.deepEqual(getSupportedReportScopes("client"), ["case"]);
  assert.equal(reportSupportsScope("management", "sequenceGroup"), false);
  assert.equal(normaliseReportScope("client", "sequenceGroup"), "case");
});

test("current scoped report types support whole case and sequence groups", () => {
  for (const reportType of ["investigation", "evidence", "document", "ledger", "action"]) {
    assert.deepEqual(getSupportedReportScopes(reportType), ["case", "sequenceGroup"]);
    assert.equal(reportSupportsScope(reportType, "sequenceGroup"), true);
    assert.equal(normalizeReportScope(reportType, "sequenceGroup"), "sequenceGroup");
  }
});

test("unknown report types safely fall back to whole-case scope", () => {
  assert.deepEqual(getSupportedReportScopes("future-report"), ["case"]);
  assert.equal(normaliseReportScope("future-report", "sequenceGroup"), "case");
});
