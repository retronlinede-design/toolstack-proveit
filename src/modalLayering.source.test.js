import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const issueManager = readFileSync(new URL("./components/sequenceGroups/SequenceGroupManager.jsx", import.meta.url), "utf8");
const dialogShell = readFileSync(new URL("./components/shared/DialogShell.jsx", import.meta.url), "utf8");
const caseDetail = readFileSync(new URL("./components/CaseDetail.jsx", import.meta.url), "utf8");
const actionSummaryModal = readFileSync(new URL("./components/caseDetail/ActionSummaryModal.jsx", import.meta.url), "utf8");
const strategyDeltaModal = readFileSync(new URL("./components/caseDetail/StrategyDeltaModal.jsx", import.meta.url), "utf8");
const gptDeltaModal = readFileSync(new URL("./components/gpt/GptDeltaModal.jsx", import.meta.url), "utf8");
const modalSources = [
  app,
  dialogShell,
  caseDetail,
  readFileSync(new URL("./components/FilePreviewModal.jsx", import.meta.url), "utf8"),
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

test("Issue Manager delegates its viewport layer to DialogShell below its child dialogs", () => {
  assert.match(issueManager, /<DialogShell/);
  assert.match(issueManager, /layer="manager"/);
  assert.match(dialogShell, /layer === "manager" \? "z-\[50\]"/);
  assert.match(dialogShell, /layer === "nested" \? "z-\[70\]"/);
});

test("priority dialogs can remain above utility overlays", () => {
  assert.match(dialogShell, /layer === "priority" \? "z-\[130\]"/);
  assert.match(dialogShell, /layer === "utility" \? "z-\[125\]"/);
  assert.match(app, /proveit-app-notification fixed right-3 top-3 z-\[120\]/);
});

test("Party Create/Edit delegates its viewport layer to DialogShell", () => {
  const parties = readFileSync(new URL("./components/caseDetail/PartiesTab.jsx", import.meta.url), "utf8");
  assert.match(parties, /<DialogShell/);
  assert.match(parties, /dismissOnBackdrop=\{false\}/);
  assert.match(dialogShell, /z-\[60\]/);
});

test("Action Summary delegates its viewport layer to DialogShell", () => {
  assert.match(actionSummaryModal, /<DialogShell/);
  assert.match(actionSummaryModal, /dismissOnBackdrop=\{false\}/);
  assert.match(actionSummaryModal, /className="proveit-action-summary-dialog"/);
});

test("To Watch editor delegates its viewport layer to DialogShell", () => {
  const watch = readFileSync(new URL("./components/caseDetail/WatchWorkspace.jsx", import.meta.url), "utf8");
  assert.match(watch, /<DialogShell/);
  assert.match(watch, /dismissOnBackdrop=\{false\}/);
  assert.match(watch, /className="proveit-watch-dialog"/);
});

test("tracking-row editor delegates its viewport layer to DialogShell", () => {
  const records = readFileSync(new URL("./components/caseDetail/RecordsTab.jsx", import.meta.url), "utf8");
  assert.match(records, /<DialogShell/);
  assert.match(records, /dismissOnBackdrop=\{false\}/);
  assert.match(records, /className="case-file-records-entry-dialog"/);
});

test("derived-payment preview delegates its viewport layer to DialogShell", () => {
  const derivedPaymentPreview = readFileSync(new URL("./components/caseDetail/ActiveLedgerRecordModal.jsx", import.meta.url), "utf8");
  assert.match(derivedPaymentPreview, /<DialogShell/);
  assert.match(derivedPaymentPreview, /dismissOnBackdrop=\{false\}/);
  assert.match(derivedPaymentPreview, /className="case-file-derived-payment-dialog"/);
});

test("Strategy Delta delegates dialog behavior and styling to DialogShell", () => {
  assert.match(strategyDeltaModal, /import DialogShell/);
  assert.match(strategyDeltaModal, /<DialogShell/);
  assert.match(strategyDeltaModal, /width="wide"/);
  assert.match(strategyDeltaModal, /onRequestClose={onClose}/);
  assert.match(strategyDeltaModal, /dismissOnBackdrop={false}/);
  assert.match(strategyDeltaModal, /initialFocusRef={inputRef}/);
  assert.match(strategyDeltaModal, /className="proveit-strategy-delta-dialog"/);
  assert.match(strategyDeltaModal, /role="alert"/);
  assert.match(css, /\.proveit-strategy-delta-dialog/);
});

test("GPT Delta delegates its extensive review workflow to DialogShell", () => {
  assert.match(gptDeltaModal, /import DialogShell/);
  assert.match(gptDeltaModal, /<DialogShell/);
  assert.match(gptDeltaModal, /width="wide"/);
  assert.match(gptDeltaModal, /onRequestClose={onCancel}/);
  assert.match(gptDeltaModal, /dismissOnBackdrop={false}/);
  assert.match(gptDeltaModal, /initialFocusRef={inputRef}/);
  assert.match(gptDeltaModal, /className="proveit-gpt-delta-dialog"/);
  assert.match(gptDeltaModal, /role="alert"/);
  assert.match(gptDeltaModal, /Records To Patch/);
  assert.match(gptDeltaModal, /Records To Create/);
  assert.match(gptDeltaModal, /onCreateBackupThenApply/);
  assert.match(css, /\.proveit-gpt-delta-dialog/);
});

test("Full App Backup recommendation delegates its high-priority layer to DialogShell", () => {
  assert.match(app, /title="Full App Backup Recommended"/);
  assert.match(app, /layer="priority"/);
  assert.match(app, /dismissOnBackdrop=\{false\}/);
  assert.match(app, /initialFocusRef=\{riskyActionBackupButtonRef\}/);
  assert.match(app, /className="proveit-backup-recommendation-dialog"/);
  assert.match(css, /\.proveit-backup-recommendation-dialog/);
});

test("Export and Import delegates its utility layer to DialogShell below the backup guard", () => {
  assert.match(app, /title="Export & Import"/);
  assert.match(app, /layer="utility"/);
  assert.match(app, /dismissOnBackdrop=\{false\}/);
  assert.match(app, /initialFocusRef=\{exportImportBackupButtonRef\}/);
  assert.match(app, /className="proveit-utility-dialog proveit-export-import-dialog"/);
  assert.match(css, /\.proveit-utility-dialog/);
});

test("Settings delegates its utility layer to DialogShell below the backup guard", () => {
  assert.match(app, /title="Settings"/);
  assert.match(app, /layer="utility"/);
  assert.match(app, /dismissOnBackdrop=\{false\}/);
  assert.match(app, /initialFocusRef=\{settingsLockButtonRef\}/);
  assert.match(app, /className="proveit-utility-dialog proveit-settings-dialog"/);
  assert.match(css, /\.proveit-utility-dialog/);
});

test("Settings and Export / Import share semantic utility-dialog action styling", () => {
  assert.match(app, /proveit-utility-dialog proveit-settings-dialog/);
  assert.match(app, /proveit-utility-dialog proveit-export-import-dialog/);
  assert.match(css, /\.proveit-utility-dialog \.proveit-modal-action-primary \{ border-color: #0f766e; background: #0f766e;/);
  assert.match(css, /\.proveit-utility-dialog \.proveit-modal-action-secondary \{ border-color: #475569; background: #172554;/);
  assert.match(css, /\.proveit-utility-dialog \.proveit-modal-action-danger \{ border-color: #7f1d1d; background: #7f1d1d;/);
  assert.match(css, /\.proveit-utility-dialog :is\(input, select, button, label\.cursor-pointer\):focus-visible/);
  assert.doesNotMatch(css, /\.proveit-settings-dialog button \{/);
});

test("Manage Folders delegates its utility layer to DialogShell below the backup guard", () => {
  assert.match(app, /title="Manage Folders"/);
  assert.match(app, /layer="utility"/);
  assert.match(app, /dismissOnBackdrop=\{false\}/);
  assert.match(app, /initialFocusRef=\{folderNameInputRef\}/);
  assert.match(app, /className="proveit-folder-manager-dialog"/);
  assert.match(css, /\.proveit-folder-manager-dialog/);
});

test("the dashboard content area does not create a fixed-position containing block", () => {
  assert.match(css, /\.proveit-main \{ min-height: 100vh; padding-left: 17rem; \}/);
});
