import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const issueManager = readFileSync(new URL("./components/sequenceGroups/SequenceGroupManager.jsx", import.meta.url), "utf8");
const issueForm = readFileSync(new URL("./components/sequenceGroups/SequenceGroupForm.jsx", import.meta.url), "utf8");
const dialogShell = readFileSync(new URL("./components/shared/DialogShell.jsx", import.meta.url), "utf8");
const caseDetail = readFileSync(new URL("./components/CaseDetail.jsx", import.meta.url), "utf8");
const modalSources = [
  app,
  issueManager,
  issueForm,
  dialogShell,
  caseDetail,
  readFileSync(new URL("./components/FilePreviewModal.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/gpt/GptDeltaModal.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/caseDetail/ActionSummaryModal.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/caseDetail/ActiveLedgerRecordModal.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/caseDetail/PartiesTab.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/caseDetail/RecordsTab.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/caseDetail/StrategyDeltaModal.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/caseDetail/WatchWorkspace.jsx", import.meta.url), "utf8"),
  readFileSync(new URL("./components/sequenceGroups/SequenceGroupManagementModal.jsx", import.meta.url), "utf8"),
];

test("navigation remains below the shared application dialog floor", () => {
  assert.match(css, /--pi-z-dialog-min: 40/);
  assert.match(css, /z-index: calc\(var\(--pi-z-dialog-min\) - 10\)/);
  assert.match(css, /z-index: calc\(var\(--pi-z-dialog-min\) - 11\)/);
});

test("modal families remain viewport-fixed above the navigation layer", () => {
  for (const source of modalSources) {
    const viewportOverlays = source.split("\n").filter((line) => line.includes("fixed inset-0"));
    assert.ok(viewportOverlays.length > 0);
    for (const overlay of viewportOverlays) {
      assert.match(overlay, /z-(?:[4-9][0-9]|\[(?:[4-9][0-9]|[1-9][0-9]{2})\])/);
    }
  }
});

test("the dashboard content area does not create a fixed-position containing block", () => {
  assert.match(css, /\.proveit-main \{ min-height: 100vh; padding-left: 17rem; \}/);
});
