import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const runtimeUrl = import.meta.resolve("react/jsx-runtime"); const helperUrl = new URL("./reportArticleHelpers.js", import.meta.url).href; const data = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function jsx(url, replacements = []) { const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname); let code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${runtimeUrl}"`); replacements.forEach(([from, to]) => { code = code.replaceAll(from, to); }); return data(code); }
const shared = await jsx(new URL("./ReportArticleShared.jsx", import.meta.url), [['from "./reportArticleHelpers.js"', `from "${helperUrl}"`]]);
const article = await jsx(new URL("./DocumentPackReportArticle.jsx", import.meta.url), [['from "./reportArticleHelpers.js"', `from "${helperUrl}"`], ['from "./ReportArticleShared.jsx"', `from "${shared}"`]]);
const { default: Article } = await import(article);

function report(rows = []) { return { title: "Document Pack: Whole Case", sourceCaseId: "c", generatedAt: "2026-07-26", audience: "general", scopeLabel: "Whole case", includedDocumentCount: rows.length, caseOverview: { name: "Case" }, atAGlance: { documentCount: rows.length, linkedDocumentCount: 0, unlinkedDocumentCount: rows.length, linkedIncidentCount: 0, linkedEvidenceCount: 0, documentWithAttachmentsCount: 0, documentWithTextCount: 0, documentMissingSummaryCount: 0 }, documentMatrix: rows, supportSummary: { linkedIncidents: [], linkedEvidence: [] }, unlinkedWeakDocuments: { unlinkedDocuments: rows, documentsMissingSummary: [], documentsWithoutAttachments: rows, documentsWithoutText: rows }, diagnostics: { orphanDocuments: [], weaklyLinkedDocuments: [], brokenLinks: [] } }; }
test("Document Pack renderer remains visually and print compatible", () => { const html = renderToStaticMarkup(React.createElement(Article, { report: report([{ id: "d", title: "Contract", documentDate: "2026-01-01", category: "contract", linkedRecords: [], attachmentNames: ["a.pdf"], attachmentCount: 1, textExcerpt: "Text", summary: "Summary" }]), className: "print:max-w-none" })); for (const text of ["DOCUMENT PACK REPORT", "Document Matrix", "Linked Incident / Evidence Support", "Unlinked / Weak Documents", "Contract", "a.pdf"]) assert.match(html, new RegExp(text)); assert.match(html, /print:max-w-none/); });
test("Document Pack renderer retains its empty state", () => assert.match(renderToStaticMarkup(React.createElement(Article, { report: report() })), /No documents are included in this scope/));
