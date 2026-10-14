import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const caseDetail = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("case file navigation preserves every canonical visible tab identifier", () => {
  for (const id of ["overview", "parties", "incidents", "evidence", "watch", "documents", "ledger", "timeline", "generate-report", "strategy", "narrative", "pack"]) {
    assert.match(app, new RegExp(`id: "${id}"`));
  }
  assert.match(caseDetail, /\{ id: "records", label: "Case Records" \}/);
  assert.match(caseDetail, /tab\.id === "ledger" \? \[\] : \[tab\]/);
});

test("case file navigation is a labelled, horizontally scrollable navigation with a mobile select fallback", () => {
  assert.match(caseDetail, /className="case-file-navigation hidden md:block" aria-label="Case file sections"/);
  assert.match(caseDetail, /case-file-navigation-list flex min-w-max items-stretch gap-1 overflow-x-auto/);
  assert.match(caseDetail, /case-file-mobile-navigation/);
  assert.match(caseDetail, /case-file-navigation-item/);
  assert.match(caseDetail, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.doesNotMatch(caseDetail, /hidden grid-cols-12 md:grid/);
});

test("Open Reports uses the canonical report tab id", () => {
  assert.match(caseDetail, /onClick=\{\(\) => \{ setActiveTab\("generate-report"\); setShowExportMenu\(false\); \}\}/);
  assert.doesNotMatch(caseDetail, /setActiveTab\("reports"\)/);
});

test("case file dark styling stays inside the dedicated case-file scope", () => {
  assert.match(caseDetail, /className="case-file space-y-6"/);
  assert.match(styles, /\.proveit-dark-shell \.case-file \{/);
  assert.match(styles, /\.proveit-dark-shell \.case-file-header \{/);
  assert.match(styles, /\.proveit-dark-shell \.case-file-navigation-item\.is-active \{/);
  assert.match(styles, /\.case-file-navigation-list \{ scrollbar-color:/);
});
