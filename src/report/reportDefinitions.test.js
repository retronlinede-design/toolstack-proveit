import assert from "node:assert/strict";
import test from "node:test";

import {
  getActiveReportDefinitions,
  getReportDefinition,
  normaliseReportScopeFromDefinition,
  REPORT_DEFINITIONS,
  reportDefinitionSupportsScope,
  reportSupportsOutput,
} from "./reportDefinitions.js";
import { getSupportedReportScopes, normaliseReportScope } from "./reportScopes.js";

test("all report definitions have unique stable IDs and explicit policies", () => {
  const definitions = Object.values(REPORT_DEFINITIONS);
  assert.equal(new Set(definitions.map((item) => item.id)).size, definitions.length);
  for (const definition of definitions) {
    assert.ok(["complete", "bounded", "summary"].includes(definition.completeness));
    assert.ok(["active", "planned"].includes(definition.status));
    assert.equal(typeof definition.aiPolicy, "string");
    assert.ok(definition.supportedScopes.length > 0);
    assert.ok(Array.isArray(definition.supportedOutputs));
  }
});

test("active definitions preserve Report Centre scope behaviour", () => {
  assert.deepEqual(getActiveReportDefinitions().map((item) => item.id), ["management", "investigation", "evidence", "document", "ledger", "client", "action"]);
  assert.deepEqual(getSupportedReportScopes("management"), ["case"]);
  assert.deepEqual(getSupportedReportScopes("client"), ["case"]);
  for (const id of ["investigation", "evidence", "document", "ledger", "action"]) {
    assert.deepEqual(getSupportedReportScopes(id), ["case", "sequenceGroup"]);
  }
});

test("definitions are the authoritative scope source with safe unknown fallback", () => {
  assert.equal(reportDefinitionSupportsScope("evidence", "sequenceGroup"), true);
  assert.equal(normaliseReportScopeFromDefinition("management", "sequenceGroup"), "case");
  assert.equal(normaliseReportScope("unknown", "sequenceGroup"), "case");
  assert.deepEqual(getReportDefinition("unknown").supportedScopes, ["case"]);
});

test("Evidence Pack declares complete shared outputs without AI content", () => {
  const evidence = getReportDefinition("evidence");
  assert.equal(evidence.completeness, "complete");
  assert.equal(evidence.includeArchived, true);
  assert.equal(evidence.aiPolicy, "none");
  for (const output of ["preview", "print", "markdown", "json"]) assert.equal(reportSupportsOutput("evidence", output), true);
});

test("Document and Ledger packs declare complete shared outputs without AI content", () => {
  for (const id of ["document", "ledger"]) {
    const definition = getReportDefinition(id);
    assert.equal(definition.completeness, "complete");
    assert.equal(definition.aiPolicy, "none");
    for (const output of ["preview", "print", "markdown", "json"]) assert.equal(reportSupportsOutput(id, output), true);
  }
});

test("Investigation remains bounded and planned reports cannot enter active selectors", () => {
  assert.equal(getReportDefinition("investigation").completeness, "bounded");
  for (const id of ["caseAudit", "incidentSchedule", "chronology"]) {
    assert.equal(getReportDefinition(id).status, "planned");
    assert.equal(getActiveReportDefinitions().some((item) => item.id === id), false);
  }
});
