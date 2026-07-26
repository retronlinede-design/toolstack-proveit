import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { buildCaseReportModel } from "../../report/reportModel.js";
import { getReportDefinition } from "../../report/reportDefinitions.js";
import { buildChronologyReportDocument } from "../../report/chronologyReportDocument.js";

const url = new URL("./ChronologyReportArticle.jsx", import.meta.url); const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname); const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`).replaceAll('from "../../report/reportDocument.js"', `from "${new URL("../../report/reportDocument.js", import.meta.url).href}"`); const Article = (await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)).default;
function render(caseData) { const model = buildCaseReportModel(caseData); const document = buildChronologyReportDocument(model, getReportDefinition("chronologyReport")); return renderToStaticMarkup(React.createElement(Article, { reportDocument: document, className: "print:shadow-none dark:bg-neutral-900" })); }

test("renders chronology groups all record totals malformed dates and provenance", () => { const html = render({ id: "c", incidents: [{ id: "i", title: "Incident", eventDate: "2026-07-01" }], watchItems: [{ id: "w", title: "Watch", reviewDate: "bad" }] }); assert.match(html, /Chronology Report/); assert.match(html, /Record Type Totals/); assert.match(html, /July 2026/); assert.match(html, /Malformed Dates/); assert.match(html, /To Watch/); assert.match(html, /Source revision/); assert.match(html, /print:shadow-none/); });
test("renders a useful empty chronology state", () => { assert.match(render({ id: "empty" }), /No records are included in this chronology scope/); });
