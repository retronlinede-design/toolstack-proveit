import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync(new URL("./ActionSummaryModal.jsx", import.meta.url), "utf8");
const caseDetail = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("Action Summary editor uses the shared dialog and has an explicit accessible editing scope", () => {
  assert.match(modal, /import DialogShell/);
  assert.match(modal, /<DialogShell/);
  assert.match(modal, /title="Edit Action Summary"/);
  assert.match(modal, /dismissOnBackdrop=\{false\}/);
  assert.match(modal, /initialFocusRef=\{nextActionsRef\}/);
  assert.match(modal, /className="proveit-action-summary-dialog"/);
  assert.match(css, /\.proveit-action-summary-dialog/);
});

test("Action Summary editor protects dirty drafts while allowing clean and reverted drafts to close", () => {
  assert.match(modal, /function actionSummaryDraftFingerprint/);
  assert.match(modal, /initialFingerprintRef\.current !== actionSummaryDraftFingerprint\(form\)/);
  assert.match(modal, /setDiscardPromptOpen\(true\)/);
  assert.match(modal, /Keep editing/);
  assert.match(modal, /Discard changes/);
  assert.match(modal, /onRequestClose=\{requestClose\}/);
});

test("Action Summary editor retains drafts after save failures and closes only after confirmed persistence", () => {
  assert.match(modal, /const saved = await onSave\?\.\(\)/);
  assert.match(modal, /if \(saved\) \{/);
  assert.match(modal, /initialFingerprintRef\.current = actionSummaryDraftFingerprint\(form\)/);
  assert.match(modal, /The Action Summary could not be saved/);
  assert.match(modal, /statusMessage=\{saveError\}/);
  assert.match(caseDetail, /return onUpdateCase\(\{/);
  assert.match(caseDetail, /return updateActionSummary\(formToActionSummary\(actionSummaryForm, rawActionSummary\)\)/);
});

test("Action Summary session baselines reset for each editor opening without changing its form conversion", () => {
  assert.match(caseDetail, /key=\{`\$\{selectedCase\?\.id \|\| "case"\}:\$\{actionSummaryEditOpen \? "open" : "closed"\}`\}/);
  assert.match(caseDetail, /formToActionSummary\(actionSummaryForm, rawActionSummary\)/);
  assert.match(caseDetail, /applyActionSummaryPatch\(rawActionSummary, patch\)/);
});
