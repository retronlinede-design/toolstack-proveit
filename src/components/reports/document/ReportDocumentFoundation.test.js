import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const componentUrl = new URL("./ReportDocumentFoundation.jsx", import.meta.url);
const stylesUrl = new URL("./reportDocumentStyles.js", import.meta.url).href;
const transformed = await transformWithOxc(await readFile(componentUrl, "utf8"), componentUrl.pathname);
const code = transformed.code
  .replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`)
  .replaceAll('from "./reportDocumentStyles.js"', `from "${stylesUrl}"`);
const foundation = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const {
  ReportDocumentAppendix, ReportDocumentCallout, ReportDocumentControl,
  ReportDocumentFooter, ReportDocumentFoundationDemo, ReportDocumentHeader,
  ReportDocumentSection, ReportDocumentShell, ReportDocumentStatistics,
} = foundation;

const render = (component, props = {}, ...children) => renderToStaticMarkup(React.createElement(component, props, ...children));

test("shell renders a semantic ordered document and forwards article attributes", () => {
  const html = render(ReportDocumentShell, { "data-report": "demo", className: "custom-shell", header: React.createElement("header", null, "Header"), documentControl: React.createElement("section", null, "Control"), footer: React.createElement("footer", null, "Footer") }, React.createElement("main", null, "Body"));
  assert.match(html, /^<article/); assert.match(html, /data-report="demo"/); assert.match(html, /custom-shell/);
  assert.ok(html.indexOf("Header") < html.indexOf("Control")); assert.ok(html.indexOf("Control") < html.indexOf("Body")); assert.ok(html.indexOf("Body") < html.indexOf("Footer"));
  const absent = render(ReportDocumentShell, {}, React.createElement("p", null, "Body only")); assert.doesNotMatch(absent, /<header|<footer/);
});

test("header exposes human identity and suppresses absent optional metadata", () => {
  const html = render(ReportDocumentHeader, { title: "Investigation Report", subtitle: "A long professional subtitle", caseName: "Very long case name that must wrap", caseReference: "CASE-1", issueReference: "ISS-003", issueName: "Heating Failure", generatedAt: "2026-08-02T10:30:00Z", preparedBy: "Rory", approvedBy: "Reviewer", version: "2", documentStatus: "Final", confidentiality: "Confidential" });
  assert.match(html, /<h1/); assert.match(html, /ISS-003 — Heating Failure/); assert.match(html, /Status: Final/); assert.match(html, /Confidentiality: Confidential/); assert.match(html, /Prepared by/); assert.match(html, /Approved by/); assert.match(html, /break-words/); assert.doesNotMatch(html, /issue_[a-f0-9-]{20,}/i);
  const minimal = render(ReportDocumentHeader, { title: "Report", documentStatus: "Draft" }); assert.match(minimal, /Status: Draft/); assert.doesNotMatch(minimal, /Prepared by|Approved by|Case reference/);
});

test("document control renders every supplied field, full revision, and hides absent fields", () => {
  const revision = "sha256:1234567890abcdefghijklmnopqrstuvwxyz";
  const html = render(ReportDocumentControl, { purpose: "Explain the Issue", audience: "Investigator", scope: "ISS-003", reportingPeriod: "2026", exclusions: "Binary files", completeness: "Complete", generatedAt: "2026-08-02", sourceRevision: revision, preparedBy: "Owner", approvedBy: "Reviewer", version: "1", documentStatus: "Draft", confidentiality: "Restricted", aiAssistance: "Wording assistance" });
  for (const label of ["Purpose", "Intended audience", "Scope", "Reporting period", "Exclusions / limitations", "Completeness", "Generated", "Source revision", "Prepared by", "Approved by", "Version", "Document status", "Confidentiality", "AI assistance"]) assert.match(html, new RegExp(label));
  assert.match(html, new RegExp(revision)); assert.match(html, /select-text/); assert.match(html, /break-words/);
  assert.doesNotMatch(render(ReportDocumentControl, { purpose: "Only purpose" }), /Approved by|AI assistance/);
  assert.equal(render(ReportDocumentControl), "");
});

test("section supports heading levels descriptions and print break controls", () => {
  const html = render(ReportDocumentSection, { id: "position", title: "Current Position", description: "Authored context", headingLevel: 3, breakBefore: true, avoidBreakInside: true }, React.createElement("p", null, "Content"));
  assert.match(html, /<h3 id="position-heading"/); assert.match(html, /Authored context/); assert.match(html, /break-before-page/); assert.match(html, /break-inside-avoid/);
  assert.equal(render(ReportDocumentSection, { title: "Empty" }), "");
});

test("statistics retain zero values, notes, stable keys, and responsive wrapping", () => {
  const html = render(ReportDocumentStatistics, { columns: 4, items: [{ key: "zero", label: "Incidents", value: 0, note: "Directly assigned" }, { key: "two", label: "Evidence", value: 2 }] });
  assert.match(html, /<dl/); assert.match(html, />0</); assert.match(html, /Directly assigned/); assert.match(html, /sm:grid-cols-2/); assert.match(html, /lg:grid-cols-4/); assert.doesNotMatch(html, /overflow-x/);
});

test("callouts render every visible meaning and use a safe fallback", () => {
  for (const [variant, label] of [["information", "Information"], ["warning", "Warning"], ["limitation", "Limitation"], ["recommendation", "Recommendation"], ["quality", "Quality note"], ["confidentiality", "Confidentiality"], ["unknown", "Information"]]) {
    const html = render(ReportDocumentCallout, { variant, title: "Title" }, "Multiline\ncontent"); assert.match(html, new RegExp(label)); assert.match(html, /print:bg-white/); assert.match(html, /dark:/); assert.match(html, /whitespace-pre-wrap/);
  }
});

test("appendix has stable identity, visible label, child content, and print break", () => {
  const html = render(ReportDocumentAppendix, { id: "appendix-a", label: "Appendix A", title: "Evidence Schedule", description: "Complete register" }, React.createElement("p", null, "Rows"));
  assert.match(html, /id="appendix-a"/); assert.match(html, /Appendix A/); assert.match(html, /Evidence Schedule/); assert.match(html, /break-before-page/); assert.match(html, /Rows/);
});

test("footer uses compact human references and never fakes page numbering", () => {
  const html = render(ReportDocumentFooter, { reportTitle: "Investigation Report", caseName: "Case", issueReference: "ISS-003", sourceRevision: "full-revision", version: "1", documentStatus: "Final", confidentiality: "Confidential", generatedAt: "2026-08-02" });
  assert.match(html, /ProveIt/); assert.match(html, /ISS-003/); assert.match(html, /full-revision/); assert.match(html, /Status: Final/); assert.doesNotMatch(html, /Page \d+|Page .* of/);
  assert.doesNotMatch(render(ReportDocumentFooter, { reportTitle: "Report" }), /Source revision|Version|Status:/);
});

test("demo composes the complete foundation without entering production navigation", () => {
  const draft = render(ReportDocumentFoundationDemo, { documentStatus: "Draft" });
  const final = render(ReportDocumentFoundationDemo, { documentStatus: "Final", omitOptionalMetadata: true });
  for (const value of ["Document control", "Current Position", "Reference Table", "Appendix A", "AI assistance", "Status: Draft"]) assert.match(draft, new RegExp(value));
  assert.match(final, /Status: Final/); assert.doesNotMatch(final, /Approved by/);
  const headings = [...draft.matchAll(/<h([1-6])[^>]*>/g)].map((match) => Number(match[1])); assert.equal(headings[0], 1); assert.ok(headings.every((level, index) => index === 0 || level <= headings[index - 1] + 1));
  assert.match(draft, /dark:/); assert.match(draft, /print:/); assert.doesNotMatch(draft, /overflow-x-auto|whitespace-nowrap/);
});
