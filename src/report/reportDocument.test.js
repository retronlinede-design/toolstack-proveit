import assert from "node:assert/strict";
import test from "node:test";
import React from "react";

import { getReportDefinition } from "./reportDefinitions.js";
import {
  createReportDocument,
  getReportDocumentSection,
  validateReportDocument,
} from "./reportDocument.js";

const model = {
  generatedAt: "2026-07-26T00:00:00.000Z",
  sourceCase: { id: "case-1", name: "Case" },
  sourceRevision: { caseUpdatedAt: "2026-07-20", recordCount: 1, fingerprint: "fnv1a-123" },
  scope: { type: "case", sequenceGroupName: null, isValid: true },
};

test("shared report documents have a stable versioned serialisable structure", () => {
  const inputSections = [{ id: "summary", heading: "Summary", type: "summary", items: [] }];
  const document = createReportDocument({ definition: getReportDefinition("evidence"), model, generatedAt: model.generatedAt, sections: inputSections });
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.report.id, "evidence");
  assert.equal(document.report.generatedAt, model.generatedAt);
  assert.equal(document.source.sourceRevision.fingerprint, "fnv1a-123");
  assert.equal(getReportDocumentSection(document, "summary").heading, "Summary");
  assert.doesNotThrow(() => JSON.stringify(document));
  assert.deepEqual(inputSections, [{ id: "summary", heading: "Summary", type: "summary", items: [] }]);
});

test("bounded definitions automatically create an explicit completeness notice", () => {
  const document = createReportDocument({
    definition: { ...getReportDefinition("investigation"), completeness: "bounded" },
    model,
    generatedAt: model.generatedAt,
  });
  assert.equal(document.notices[0].code, "BOUNDED_REPORT");
  assert.match(document.notices[0].message, /bounded overview/);
});

test("validator accepts empty sections and safe empty case IDs", () => {
  const document = createReportDocument({
    definition: getReportDefinition("evidence"),
    model: { ...model, sourceCase: { id: "", name: "" } },
    generatedAt: model.generatedAt,
    sections: [{ id: "empty", heading: "Empty", type: "record-list", items: [] }],
  });
  assert.deepEqual(validateReportDocument(document), { valid: true, errors: [] });
});

test("validator reports malformed documents without throwing", () => {
  const malformed = { schemaVersion: 9, report: {}, source: { scope: { type: "bad" } }, sections: [{ id: "same" }, { id: "same" }] };
  const result = validateReportDocument(malformed);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("schema version")));
  assert.ok(result.errors.some((error) => error.includes("Duplicate report section")));
});

test("validator rejects functions JSX-like values binary fields data URLs and cycles", () => {
  const document = createReportDocument({ definition: getReportDefinition("evidence"), model, generatedAt: model.generatedAt });
  document.sections = [{ id: "unsafe", render() {}, element: React.createElement("span"), attachment: { dataUrl: "data:image/png;base64,abc", blob: {} } }];
  document.summary.self = document.summary;
  const result = validateReportDocument(document);
  assert.equal(result.valid, false);
  for (const phrase of ["function", "JSX-like", "forbidden binary field", "data URL", "circular reference"]) {
    assert.ok(result.errors.some((error) => error.includes(phrase)), phrase);
  }
});
