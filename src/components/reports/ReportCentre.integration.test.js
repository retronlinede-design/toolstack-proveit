import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const componentUrl = new URL("./ReportCentreControls.jsx", import.meta.url);
const caseDetailSource = await readFile(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const scopeUrl = new URL("../../report/reportScopes.js", import.meta.url).href;
const configUrl = new URL("./reportCentreConfig.js", import.meta.url);
const configSource = (await readFile(configUrl, "utf8"))
  .replace('from "../../report/reportScopes.js"', `from "${scopeUrl}"`);
const importableConfigUrl = `data:text/javascript;base64,${Buffer.from(configSource).toString("base64")}`;
const transformed = await transformWithOxc(await readFile(componentUrl, "utf8"), componentUrl.pathname);
const runtimeUrl = import.meta.resolve("react/jsx-runtime");
const importableCode = transformed.code
  .replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`)
  .replaceAll('from "../../report/reportScopes.js"', `from "${scopeUrl}"`)
  .replaceAll('from "./reportCentreConfig.js"', `from "${importableConfigUrl}"`);
const module = await import(`data:text/javascript;base64,${Buffer.from(importableCode).toString("base64")}`);
const configModule = await import(importableConfigUrl);
const {
  default: ReportCentreControls,
  ReportCentrePreviewSummary,
} = module;
const { REPORT_CENTRE_TYPES } = configModule;

const noOp = () => {};

function renderControls(overrides = {}) {
  return renderToStaticMarkup(React.createElement(ReportCentreControls, {
    reportType: "management",
    scopeType: "case",
    sequenceGroups: ["Alpha", "Beta"],
    selectedSequenceGroup: "Alpha",
    markdownAvailable: false,
    onReportTypeChange: noOp,
    onScopeTypeChange: noOp,
    onSequenceGroupChange: noOp,
    onPrint: noOp,
    onCopyMarkdown: noOp,
    onOpenSequenceGroupAudit: noOp,
    ...overrides,
  }));
}

function renderPreview(reportType, scopeType, scopeLabel) {
  return renderToStaticMarkup(React.createElement(ReportCentrePreviewSummary, {
    reportType,
    scopeType,
    scopeLabel,
  }));
}

test("active Report Centre controls render every primary report selector", () => {
  const html = renderControls();
  for (const definition of REPORT_CENTRE_TYPES) assert.match(html, new RegExp(definition.label));
  assert.match(html, /Report Type/);
  assert.match(html, /Output/);
});

test("changing report type changes the rendered preview description", () => {
  const evidence = renderPreview("evidence", "case", "Whole case");
  const action = renderPreview("action", "sequenceGroup", "sequenceGroup: Alpha");

  assert.match(evidence, /existing Evidence Pack builder/);
  assert.doesNotMatch(evidence, /structured case and sequence-group assignments/);
  assert.match(action, /structured case and sequence-group assignments/);
  assert.match(action, /Scope: sequenceGroup: Alpha/);
});

test("Management and Client reports are rendered as whole-case only", () => {
  for (const reportType of ["management", "client"]) {
    const html = renderControls({ reportType, scopeType: "sequenceGroup" });
    assert.match(html, /Whole Case/);
    assert.doesNotMatch(html, />Sequence Group</);
    assert.match(html, /aria-pressed="true" disabled=""/);
    assert.match(html, /currently uses the complete case/);
  }
  assert.match(renderPreview("management", "case", "Whole case"), /timeline is currently limited to five entries/);
});

test("sequence-group-capable reports render honest scope controls and labels", () => {
  const html = renderControls({ reportType: "evidence", scopeType: "sequenceGroup" });
  assert.match(html, /Whole Case/);
  assert.match(html, /Sequence Group/);
  assert.match(html, /id="report-centre-sequence-group"/);
  assert.match(html, /<option value="Alpha" selected="">Alpha<\/option>/);

  const preview = renderPreview("evidence", "sequenceGroup", "sequenceGroup: Alpha");
  assert.match(preview, /Scope: sequenceGroup: Alpha/);
});

test("empty sequence group collections render a useful empty state", () => {
  const html = renderControls({
    reportType: "action",
    scopeType: "sequenceGroup",
    sequenceGroups: [],
    selectedSequenceGroup: "",
  });
  assert.match(html, /No sequence groups exist in this case yet/);
  assert.match(html, /Print \/ Save PDF/);
  assert.match(html, /disabled=""/);
});

test("Copy Markdown is available only for reports with real Markdown output", () => {
  assert.match(renderControls({ reportType: "action", markdownAvailable: true }), /Copy Markdown/);
  assert.doesNotMatch(renderControls({ reportType: "management", markdownAvailable: false }), />Copy Markdown</);
  assert.doesNotMatch(renderControls({ reportType: "evidence", markdownAvailable: false }), />Copy Markdown</);
});

test("bounded whole-case investigation output is explicit", () => {
  const wholeCase = renderPreview("investigation", "case", "Whole case");
  const group = renderPreview("investigation", "sequenceGroup", "sequenceGroup: Alpha");
  assert.match(wholeCase, /Bounded investigation overview/);
  assert.match(wholeCase, /complete incident schedule/);
  assert.match(wholeCase, /12 evidence records and 12 documents/);
  assert.match(group, /Focused Thread \/ Issue Report/);
});

test("optional control values do not prevent the Report Centre from rendering", () => {
  assert.doesNotThrow(() => renderControls({ sequenceGroups: undefined, selectedSequenceGroup: undefined }));
});

test("the active CaseDetail Report Centre uses the rendered control boundary", () => {
  assert.match(caseDetailSource, /<ReportCentreControls/);
  assert.match(caseDetailSource, /<ReportCentrePreviewSummary/);
});

test("Internal Report and Lawyer Pack cannot be selected as working destinations", () => {
  assert.match(caseDetailSource, /Internal Report — Unavailable/);
  assert.match(caseDetailSource, /id: "lawyer", label: "Lawyer Pack — Unavailable", available: false/);
  assert.match(caseDetailSource, /disabled={!mode\.available}/);
  assert.match(caseDetailSource, /This future destination is not selectable/);
});
