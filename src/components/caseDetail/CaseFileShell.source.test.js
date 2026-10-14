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

test("case file navigation is a labelled responsive grid with a mobile select fallback", () => {
  assert.match(caseDetail, /className="case-file-navigation hidden md:block" aria-label="Case file sections"/);
  assert.match(caseDetail, /case-file-navigation-grid grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-6/);
  assert.match(caseDetail, /case-file-mobile-navigation/);
  assert.match(caseDetail, /case-file-navigation-item/);
  assert.match(caseDetail, /case-file-navigation-grip/);
  assert.match(caseDetail, /GripVertical/);
  const navigationButton = caseDetail.match(/<button[\s\S]*?className=\{`case-file-navigation-item[\s\S]*?<\/button>/)?.[0] || "";
  assert.match(navigationButton, /onClick=\{\(\) => setActiveTab\(tab\.id\)\}/);
  assert.doesNotMatch(navigationButton, /draggable/);
  assert.match(caseDetail, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(caseDetail, /className="case-file-navigation-grip"[\s\S]*?onDragStart/);
  assert.match(caseDetail, /<button[\s\S]*?draggable[\s\S]*?className="case-file-navigation-grip"/);
  assert.match(caseDetail, /onDragEnd=\{clearCaseNavigationDrag\}/);
  assert.match(caseDetail, /onDrop/);
  assert.match(caseDetail, /event\.key === "Escape"/);
  assert.match(caseDetail, /aria-keyshortcuts="Alt\+ArrowLeft Alt\+ArrowRight"/);
  assert.match(caseDetail, /case-file-navigation-reset/);
  assert.doesNotMatch(caseDetail, /hidden grid-cols-12 md:grid/);
  assert.doesNotMatch(caseDetail, /case-file-navigation-list/);
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
  assert.match(styles, /\.proveit-dark-shell \.case-file-navigation-grid \{/);
  assert.match(styles, /\.proveit-dark-shell \.case-file-navigation-cell\.is-drop-target \.case-file-navigation-item/);
  assert.match(styles, /\.proveit-dark-shell \.case-file-navigation-item \{[\s\S]*?cursor: pointer/);
  assert.match(styles, /\.proveit-dark-shell \.case-file-navigation-grip \{[\s\S]*?cursor: grab/);
  assert.match(styles, /case-file-navigation-cell\.is-dragging \.case-file-navigation-grip \{ cursor: grabbing/);
  assert.doesNotMatch(styles, /\.case-file-navigation-list/);
});
