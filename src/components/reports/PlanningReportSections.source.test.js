import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/reports/PlanningReportSections.jsx", "utf8");
const executive = readFileSync("src/components/reports/ExecutiveSummaryReportArticle.jsx", "utf8");
const bundle = readFileSync("src/components/reports/CaseBundleReportArticle.jsx", "utf8");
const thread = readFileSync("src/components/reports/ThreadIssueReportArticle.jsx", "utf8");

test("planning report sections label structured strategy fields and omit them conditionally", () => {
  assert.match(source, /Objective/);
  assert.match(source, /Desired outcome/);
  assert.match(source, /Analysis \/ reasoning/);
  assert.match(source, /Risks/);
  assert.match(source, /Assumptions/);
  assert.match(source, /Next steps/);
  assert.match(source, /item\.objective &&/);
});

test("watch report rendering explicitly preserves monitored and unconfirmed status", () => {
  assert.match(source, /Monitored concern/);
  assert.match(source, /Monitoring status/);
  assert.match(source, /Unconfirmed observation/);
  assert.match(source, /Trigger for review/);
  assert.doesNotMatch(source, /recordLabel.*Incident/);
  assert.doesNotMatch(source, /recordLabel.*Evidence/);
});

test("executive, bundle, and thread print articles consume report-safe planning projections", () => {
  assert.match(executive, /priorityStrategies/);
  assert.match(executive, /priorityWatchItems/);
  assert.match(bundle, /closedWatchItems/);
  assert.match(bundle, /showHistory/);
  assert.match(thread, /report\.strategies/);
  assert.match(thread, /report\.watchItems/);
});
