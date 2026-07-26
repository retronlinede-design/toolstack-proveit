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
const article = await jsx(new URL("./LedgerPackReportArticle.jsx", import.meta.url), [['from "./reportArticleHelpers.js"', `from "${helperUrl}"`], ['from "./ReportArticleShared.jsx"', `from "${shared}"`]]);
const { default: Article } = await import(article);

function report(rows = []) { return { title: "Ledger Pack: Whole Case", sourceCaseId: "c", generatedAt: "2026-07-26", audience: "general", scopeLabel: "Whole case", includedLedgerCount: rows.length, caseOverview: { name: "Case" }, atAGlance: { totalEntryCount: rows.length, totalAmount: 10, creditTotal: 0, debitTotal: 10, entriesWithProofCount: 0, entriesWithoutProofCount: rows.length, linkedEntryCount: 0, unlinkedEntryCount: rows.length }, ledgerMatrix: rows, proofSummary: { entriesLinkedToProofRecords: [], entriesWithMissingProof: rows }, unlinkedWeakLedger: { unlinkedLedgerEntries: rows, weaklyLinkedLedger: [], entriesWithMissingProof: rows }, diagnostics: { orphanLedger: [], weaklyLinkedLedger: [], brokenLinks: [] } }; }
test("Ledger Pack renderer remains visually and print compatible", () => { const html = renderToStaticMarkup(React.createElement(Article, { report: report([{ id: "l", title: "Invoice", date: "2026-01-01", amount: 10, currency: "EUR", linkedRecords: [], linkedEvidence: [], linkedDocuments: [] }]), className: "print:max-w-none" })); for (const text of ["LEDGER PACK REPORT", "Ledger Matrix", "Proof / Support Summary", "Unlinked / Weak Ledger Entries", "Invoice", "EUR"]) assert.match(html, new RegExp(text)); assert.match(html, /print:max-w-none/); });
test("Ledger Pack renderer retains its empty state", () => assert.match(renderToStaticMarkup(React.createElement(Article, { report: report() })), /No ledger entries are included in this scope/));
