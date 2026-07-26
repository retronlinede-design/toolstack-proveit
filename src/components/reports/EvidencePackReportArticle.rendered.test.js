import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const runtimeUrl = import.meta.resolve("react/jsx-runtime");
const helperUrl = new URL("./reportArticleHelpers.js", import.meta.url).href;
const toDataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;

async function transformJsx(url, replacements = []) {
  const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname);
  let code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`);
  for (const [from, to] of replacements) code = code.replaceAll(from, to);
  return toDataUrl(code);
}

const sharedUrl = await transformJsx(new URL("./ReportArticleShared.jsx", import.meta.url), [
  ['from "./reportArticleHelpers.js"', `from "${helperUrl}"`],
]);
const articleUrl = await transformJsx(new URL("./EvidencePackReportArticle.jsx", import.meta.url), [
  ['from "./reportArticleHelpers.js"', `from "${helperUrl}"`],
  ['from "./ReportArticleShared.jsx"', `from "${sharedUrl}"`],
]);
const { default: EvidencePackReportArticle } = await import(articleUrl);

function report(evidenceMatrix = []) {
  return {
    title: "Evidence Pack: Whole Case", sourceCaseId: "case-1", generatedAt: "2026-07-26T00:00:00.000Z", audience: "general",
    scopeLabel: "Whole case", includedEvidenceCount: evidenceMatrix.length, caseOverview: { name: "Rendered case" },
    atAGlance: { evidenceCount: evidenceMatrix.length, linkedEvidenceCount: 0, unlinkedEvidenceCount: evidenceMatrix.length, incidentsSupportedCount: 0, evidenceWithAttachmentsCount: 0, evidenceMissingFunctionSummaryCount: 0 },
    evidenceMatrix, supportedIncidents: [],
    unlinkedWeakEvidence: { unlinkedEvidence: evidenceMatrix, evidenceMissingFunctionSummary: [], evidenceWithoutAttachments: evidenceMatrix },
    diagnostics: { unusedEvidence: [], weaklyLinkedEvidence: [], brokenLinks: [], unsupportedIncidents: [] },
  };
}

test("existing Evidence Pack renderer remains visually structured and print compatible", () => {
  const html = renderToStaticMarkup(React.createElement(EvidencePackReportArticle, {
    report: report([{ id: "e1", title: "Photo", date: "2026-01-01", capturedAt: "", status: "available", evidenceRole: "proof", functionSummary: "Shows damage", linkedIncidents: [], linkedRecords: [], attachmentNames: ["photo.jpg"], attachmentCount: 1, reviewNotes: "" }]),
    className: "print:max-w-none",
  }));
  for (const label of ["EVIDENCE PACK REPORT", "At a Glance", "Evidence Matrix", "Supported Incidents", "Unlinked / Weak Evidence", "Diagnostics", "Photo", "photo.jpg"]) assert.match(html, new RegExp(label));
  assert.match(html, /print:max-w-none/);
});

test("existing Evidence Pack empty state remains useful", () => {
  const html = renderToStaticMarkup(React.createElement(EvidencePackReportArticle, { report: report() }));
  assert.match(html, /No evidence is included in this scope/);
  assert.match(html, /No incidents are supported by evidence in this scope/);
});
