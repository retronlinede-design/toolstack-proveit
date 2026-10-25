import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { buildExecutiveReportDocument } from "../../report/executiveReportDocument.js";
import { getReportDefinition } from "../../report/reportDefinitions.js";
import { buildCaseReportModel } from "../../report/reportModel.js";

const runtimeUrl = import.meta.resolve("react/jsx-runtime");
const foundationUrl = new URL("./document/ReportDocumentFoundation.jsx", import.meta.url);
const stylesUrl = new URL("./document/reportDocumentStyles.js", import.meta.url).href;
const foundationTransformed = await transformWithOxc(await readFile(foundationUrl, "utf8"), foundationUrl.pathname);
const foundationCode = foundationTransformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`).replaceAll('from "./reportDocumentStyles.js"', `from "${stylesUrl}"`);
const foundationImportUrl = `data:text/javascript;base64,${Buffer.from(foundationCode).toString("base64")}`;
const articleUrl = new URL("./ExecutiveReportArticle.jsx", import.meta.url);
const articleTransformed = await transformWithOxc(await readFile(articleUrl, "utf8"), articleUrl.pathname);
const articleCode = articleTransformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`).replaceAll('import "./ExecutiveReportArticle.css";', "").replaceAll('from "./document/index.js"', `from "${foundationImportUrl}"`);
const { default: ExecutiveReportArticle } = await import(`data:text/javascript;base64,${Buffer.from(articleCode).toString("base64")}`);

test("renders the professional Executive Report with source references and compact document control", () => {
  const source = { id: "case", name: "Case", issues: [{ id: "issue", reference: "ISS-001", name: "Heating", status: "open", priority: "high", currentPosition: "A response is outstanding.", createdAt: "2026-01-01", updatedAt: "2026-01-02" }], incidents: [{ id: "inc", title: "Heating stopped", eventDate: "2026-01-01", sequenceGroupId: "issue", sequenceGroup: "Heating" }], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] };
  const model = buildCaseReportModel(source, { scope: "sequenceGroup", issueId: "issue", generatedAt: "2026-10-18T12:00:00Z", includeDiagnostics: true });
  const document = buildExecutiveReportDocument(model, getReportDefinition("executive"), { generatedAt: model.generatedAt });
  const html = renderToStaticMarkup(React.createElement(ExecutiveReportArticle, { reportDocument: document }));
  for (const label of ["Executive Report", "Executive Summary", "Key Findings", "Recorded current position", "Supporting Evidence", "Unresolved Matters", "Recorded Next Actions", "Source Notes and Document Control"]) assert.match(html, new RegExp(label));
  assert.match(html, /Source record/); assert.match(html, /Incident: inc — Heating stopped/); assert.match(html, /does not infer contradictions/); assert.match(html, /proveit-executive-report/); assert.doesNotMatch(html, /legal conclusion/i);
  assert.doesNotMatch(html, /<h2[^>]*>Document control<\/h2>/i);
});

test("uses a named A4 Executive Report print contract without simulated page numbering", async () => {
  const css = await readFile(new URL("./ExecutiveReportArticle.css", import.meta.url), "utf8");

  assert.match(css, /@page executive-report/);
  assert.match(css, /size: A4 portrait/);
  assert.match(css, /page: executive-report/);
  assert.match(css, /break-after: avoid/);
  assert.match(css, /page-break-inside: avoid/);
  assert.doesNotMatch(css, /counter\(page\)|Page \d+/i);
});
