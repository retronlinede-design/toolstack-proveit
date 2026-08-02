import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";

const url = new URL("./ReportOutputActions.jsx", import.meta.url);
const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname);
const code = transformed.code
  .replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`)
  .replaceAll('from "../../report/reportScopes.js"', `from "${new URL("../../report/reportScopes.js", import.meta.url).href}"`);
const { default: ReportOutputActions } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("migrated packs render ordered shared outputs and live feedback", () => {
  const html = renderToStaticMarkup(React.createElement(ReportOutputActions, { reportType: "document", markdownAvailable: true, documentOutputAvailable: true, feedback: "Document Pack JSON downloaded." }));
  const labels = ["Copy Markdown", "Download Markdown", "Download JSON", "Print / Save PDF"];
  labels.forEach((label) => assert.match(html, new RegExp(label)));
  assert.ok(labels.map((label) => html.indexOf(label)).every((position, index, positions) => index === 0 || position > positions[index - 1]));
  assert.match(html, /role="status"/); assert.match(html, /aria-live="polite"/);
});

test("Management and Action shared outputs use native semantics", () => {
  const management = renderToStaticMarkup(React.createElement(ReportOutputActions, { reportType: "management", markdownAvailable: true, documentOutputAvailable: true, disabled: true }));
  assert.match(management, /Copy Markdown|Download Markdown/); assert.match(management, /Download JSON/); assert.match(management, /Print \/ Save PDF/); assert.match(management, /disabled=""/);
  const action = renderToStaticMarkup(React.createElement(ReportOutputActions, { reportType: "action", markdownAvailable: true, documentOutputAvailable: true }));
  assert.match(action, /Copy Markdown/); assert.match(action, /Download Markdown/); assert.match(action, /Download JSON/); assert.match(action, /Print \/ Save PDF/);
});
