import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";
import { buildCaseReportModel } from "../../report/reportModel.js";
import { getReportDefinition } from "../../report/reportDefinitions.js";
import { buildIncidentScheduleDocument } from "../../report/incidentScheduleDocument.js";

const url = new URL("./IncidentScheduleReportArticle.jsx", import.meta.url); const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname); const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`).replaceAll('from "../../report/reportDocument.js"', `from "${new URL("../../report/reportDocument.js", import.meta.url).href}"`); const Article = (await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)).default;
function render(caseData) { const model = buildCaseReportModel(caseData); const document = buildIncidentScheduleDocument(model, getReportDefinition("incidentSchedule")); return renderToStaticMarkup(React.createElement(Article, { reportDocument: document, className: "print:shadow-none dark:bg-neutral-900" })); }

test("renders semantic incident schedule coverage findings and provenance", () => { const html = render({ id: "c", incidents: [{ id: "i1", title: "Incident", eventDate: "bad", linkedEvidenceIds: ["e1"], archived: true }], evidence: [{ id: "e1", title: "Evidence" }] }); assert.match(html, /<article/); assert.match(html, /<table/); assert.match(html, /Evidence Coverage/); assert.match(html, /Weak or Incomplete Incidents/); assert.match(html, /malformed event or canonical date/); assert.match(html, /Archived/); assert.match(html, /Source revision/); assert.match(html, /print:shadow-none/); });
test("renders a useful empty incident state", () => { assert.match(render({ id: "empty" }), /No incidents are included in this report scope/); });
