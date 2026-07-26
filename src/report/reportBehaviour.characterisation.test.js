import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCaseBundleReport,
  buildDocumentPackReport,
  buildEvidencePackReport,
  buildExecutiveSummaryReport,
} from "./reportBuilder.js";

function buildCharacterisationCase() {
  return {
    id: "case-characterisation",
    name: "Current report policy",
    incidents: Array.from({ length: 7 }, (_, index) => ({
      id: `incident-${index + 1}`,
      title: `Incident ${index + 1}`,
      eventDate: `2026-01-${String(index + 1).padStart(2, "0")}`,
    })),
    evidence: Array.from({ length: 13 }, (_, index) => ({
      id: `evidence-${index + 1}`,
      title: `Evidence ${index + 1}`,
      status: index === 12 ? "archived" : "active",
      functionSummary: `Summary ${index + 1}`,
    })),
    documents: Array.from({ length: 13 }, (_, index) => ({
      id: `document-${index + 1}`,
      title: `Document ${index + 1}`,
      status: index === 12 ? "archived" : "active",
      summary: `Document summary ${index + 1}`,
    })),
    strategy: [{ id: "strategy-archived", title: "Archived strategy", status: "archived" }],
    watchItems: [
      { id: "watch-current", title: "Current watch", status: "watching" },
      { id: "watch-archived", title: "Archived watch", status: "archived" },
    ],
    ledger: [],
  };
}

test("limits the current case bundle evidence preview to 12 records", () => {
  const report = buildCaseBundleReport(buildCharacterisationCase(), { scopeType: "case" });
  assert.equal(report.sections.evidencePack.evidenceMatrix.length, 13);
});

test("limits the current case bundle document preview to 12 records", () => {
  const report = buildCaseBundleReport(buildCharacterisationCase(), { scopeType: "case" });
  assert.equal(report.sections.documentPack.documentMatrix.length, 13);
});

test("the current Case Bundle article applies the characterised 12-record preview limits", async () => {
  const source = await readFile(new URL("../components/reports/CaseBundleReportArticle.jsx", import.meta.url), "utf8");
  assert.match(source, /evidenceMatrix\.slice\(0, 12\)/);
  assert.match(source, /documentMatrix\.slice\(0, 12\)/);
});

test("bounds the current Management Report timeline to five entries", () => {
  const report = buildExecutiveSummaryReport(buildCharacterisationCase());
  assert.equal(report.keyTimeline.length, 5);
});

test("currently includes archived evidence and documents in their pack builders", () => {
  const caseData = buildCharacterisationCase();
  assert.equal(buildEvidencePackReport(caseData).evidenceMatrix.some((item) => item.id === "evidence-13"), true);
  assert.equal(buildDocumentPackReport(caseData).documentMatrix.some((item) => item.id === "document-13"), true);
});

test("currently includes archived strategy and separates archived Watch items", () => {
  const report = buildCaseBundleReport(buildCharacterisationCase(), { scopeType: "case" });
  assert.deepEqual(report.sections.strategyActions.strategyRecords.map((item) => item.id), ["strategy-archived"]);
  assert.deepEqual(report.sections.strategyActions.watchItems.map((item) => item.id), ["watch-current"]);
  assert.deepEqual(report.sections.strategyActions.closedWatchItems.map((item) => item.id), ["watch-archived"]);
});
