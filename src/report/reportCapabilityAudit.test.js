import assert from "node:assert/strict";
import test from "node:test";
import { auditReportCapabilities } from "./reportCapabilityAudit.js";
import { REPORT_DEFINITIONS } from "./reportDefinitions.js";

const active = { id: "evidence", status: "active", supportedScopes: ["case"], supportedOutputs: ["preview", "markdown", "json"], completeness: "complete" };

test("capability audit characterises aligned rendered capabilities", () => {
  const result = auditReportCapabilities({ definitions: { evidence: active }, centreConfig: [{ value: "evidence", supportedScopes: ["case"] }], runtimeDocuments: { evidence: {} }, renderedActions: { evidence: ["preview", "markdown", "json"] }, previewRenderers: { evidence: true } });
  assert.equal(result.valid, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.reports[0].completeness, "complete");
});

test("capability audit reports planned visibility unsupported scope output and missing renderer", () => {
  const result = auditReportCapabilities({ definitions: { evidence: { ...active, status: "planned" } }, centreConfig: [{ value: "evidence", supportedScopes: ["sequenceGroup"] }], renderedActions: { evidence: ["print"] } });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /planned but visible/);
  assert.match(result.errors.join(" "), /unsupported scope/);
  assert.match(result.errors.join(" "), /unsupported output/);
});

test("capability audit warns when declared structured outputs lack documents or actions", () => {
  const result = auditReportCapabilities({ definitions: { evidence: active }, centreConfig: [{ value: "evidence" }], renderedActions: { evidence: [] }, previewRenderers: { evidence: true } });
  assert.match(result.warnings.join(" "), /declares markdown/);
  assert.match(result.warnings.join(" "), /no runtime report document/);
});

test("active Report Centre capability matrix has no declared-to-rendered mismatch", () => {
  const ids = ["management", "investigation", "incidentSchedule", "chronologyReport", "evidence", "document", "ledger", "client", "action"];
  const renderedActions = Object.fromEntries(ids.map((id) => [id, REPORT_DEFINITIONS[id].supportedOutputs]));
  const result = auditReportCapabilities({
    definitions: REPORT_DEFINITIONS,
    centreConfig: ids.map((value) => ({ value, supportedScopes: REPORT_DEFINITIONS[value].supportedScopes })),
    runtimeDocuments: { evidence: {}, document: {}, ledger: {}, incidentSchedule: {}, chronologyReport: {}, action: { legacyMarkdown: true } },
    renderedActions,
    previewRenderers: Object.fromEntries(ids.map((id) => [id, true])),
    runtimeFormatters: { evidence: ["markdown", "json"], document: ["markdown", "json"], ledger: ["markdown", "json"], incidentSchedule: ["markdown", "json"], chronologyReport: ["markdown", "json"], action: ["markdown"] },
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.reports.map((item) => item.id), ids);
});

test("capability audit identifies a missing schedule formatter", () => {
  const definition = REPORT_DEFINITIONS.incidentSchedule;
  const result = auditReportCapabilities({ definitions: { incidentSchedule: definition }, centreConfig: [{ value: "incidentSchedule", supportedScopes: definition.supportedScopes }], runtimeDocuments: { incidentSchedule: {} }, renderedActions: { incidentSchedule: definition.supportedOutputs }, previewRenderers: { incidentSchedule: true }, runtimeFormatters: { incidentSchedule: ["json"] } });
  assert.match(result.warnings.join(" "), /no registered runtime formatter/);
});
