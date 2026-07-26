import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";

const url = new URL("./ReportContextHeader.jsx", import.meta.url);
const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname);
const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`);
const { default: ReportContextHeader } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("context header renders selected report completeness scope count capabilities and provenance", () => {
  const html = renderToStaticMarkup(React.createElement(ReportContextHeader, { definition: { label: "Evidence Pack", completeness: "complete", supportedOutputs: ["preview", "print", "markdown", "json"], recordTypes: ["evidence", "incident"] }, scopeLabel: "Sequence Group: Alpha", countLabel: "6 evidence records", reportDocument: { source: { sourceRevision: { fingerprint: "a12bc34defgh" } }, report: { generatedAt: "2026-07-26T16:42:00Z" } } }));
  for (const value of ["Selected report", "Evidence Pack", "Complete report", "Sequence Group: Alpha", "6 evidence records", "a12bc34d", "Evidence records", "Markdown", "JSON"]) assert.match(html, new RegExp(value));
  assert.match(html, /title="a12bc34defgh"/);
});

test("context header exposes bounded and summary explanations without fabricated provenance", () => {
  const bounded = renderToStaticMarkup(React.createElement(ReportContextHeader, { definition: { label: "Investigation Report", completeness: "bounded", supportedOutputs: ["preview", "print"] }, scopeLabel: "Whole case" }));
  assert.match(bounded, /Bounded overview/); assert.match(bounded, /preview limits/); assert.doesNotMatch(bounded, /Source revision/);
  const summary = renderToStaticMarkup(React.createElement(ReportContextHeader, { definition: { label: "Management Report", completeness: "summary" }, scopeLabel: "Whole case only" }));
  assert.match(summary, /Summary report/);
});
