import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const caseDetail = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const caseBriefingDashboard = readFileSync(new URL("../caseBriefing/CaseBriefingDashboard.jsx", import.meta.url), "utf8");
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
  assert.match(caseDetail, /aria-label="Filter timeline by Issue"/);
});

test("live overview provides compact record-choice guidance", () => {
  assert.match(caseBriefingDashboard, /Where does this belong\?/);
  assert.match(caseBriefingDashboard, /Incident is what happened; Evidence is material supporting, challenging, or contextualising it\./);
  assert.match(caseBriefingDashboard, /Document is the original source or correspondence; Evidence is the assessed significance of source material\./);
  assert.match(caseBriefingDashboard, /Strategy is the considered position and approach; an Action is executable work that should happen now\./);
  assert.match(caseBriefingDashboard, /To Watch is an uncertain development or trigger being monitored; an Incident is something that has happened\./);
  assert.doesNotMatch(caseDetail, /Where does this belong\?/);
});

test("incident and evidence search icons are decorative", () => {
  const searchIcons = caseDetail.match(/<Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" \/>/g) || [];
  assert.ok(searchIcons.length >= 2);
});

test("active Ledger and Records UI contains no known malformed display characters", () => {
  assert.doesNotMatch(ledger, /â–¶|â–¼|Â|�/);
  assert.match(ledger, /Date \/ Period/);
  assert.doesNotMatch(records, /Â·|â€”|�/);
  assert.match(records, / · /);
  assert.match(records, /"—"/);
});
