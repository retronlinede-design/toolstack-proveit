import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const caseDetail = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const ledger = readFileSync(new URL("./LedgerTab.jsx", import.meta.url), "utf8");
const records = readFileSync(new URL("./RecordsTab.jsx", import.meta.url), "utf8");

test("the common workspace frame is responsive and explicitly dark compatible", () => {
  assert.match(caseDetail, /case-workspace-tabs[^\n]+dark:border-neutral-700 dark:bg-neutral-950/);
  assert.match(caseDetail, /w-full min-w-0 rounded-2xl[^\n]+dark:border-neutral-700 dark:bg-neutral-950 sm:p-5/);
  assert.match(caseDetail, /Workspace View[\s\S]*dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100/);
});

test("timeline filters expose state and an accessible selector name", () => {
  assert.match(caseDetail, /aria-pressed=\{timelineView === filter\.id\}/);
  assert.match(caseDetail, /aria-pressed=\{timelineMilestonesOnly\}/);
  assert.match(caseDetail, /aria-label="Filter timeline by sequence group"/);
});

test("incident and evidence search icons are decorative", () => {
  const searchIcons = caseDetail.match(/<Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" \/>/g) || [];
  assert.ok(searchIcons.length >= 2);
});

test("active Ledger and Records UI contains no known malformed display characters", () => {
  assert.doesNotMatch(ledger, /â–¶|â–¼|Â|�/);
  assert.match(ledger, /"▶" : "▼"/);
  assert.doesNotMatch(records, /Â·|â€”|�/);
  assert.match(records, / · /);
  assert.match(records, /"—"/);
});
