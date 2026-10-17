import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manager = readFileSync(new URL("./SequenceGroupManager.jsx", import.meta.url), "utf8");
const form = readFileSync(new URL("./SequenceGroupForm.jsx", import.meta.url), "utf8");
const detailsForm = readFileSync(new URL("./SequenceGroupDetailsForm.jsx", import.meta.url), "utf8");
const managementModal = readFileSync(new URL("./SequenceGroupManagementModal.jsx", import.meta.url), "utf8");

test("Issue Manager has labelled modal semantics, keyboard dismissal, focus trapping, and restoration", () => {
  assert.match(manager, /role="dialog" aria-modal="true" aria-labelledby="sequence-group-manager-title"/);
  assert.match(manager, /id="sequence-group-manager-title"/);
  assert.match(manager, /event\.key === "Escape"\) return onClose\(\)/);
  assert.match(manager, /event\.key !== "Tab"/);
  assert.match(manager, /previousFocus\?\.focus\?\.\(\)/);
});

test("Issue create form delegates accessible dialog behavior to DialogShell and guards edits", () => {
  assert.match(form, /<DialogShell/);
  assert.match(form, /onRequestClose=\{requestClose\}/);
  assert.match(form, /dismissOnBackdrop=\{false\}/);
  assert.match(form, /initialFocusRef=\{nameInputRef\}/);
  assert.match(form, /Discard unsaved changes\?/);
  assert.match(form, /onClick=\{handleSubmit\}/);
});

test("Issue Detail uses the nested dialog layer with guarded details dismissal", () => {
  assert.match(managementModal, /<DialogShell/);
  assert.match(managementModal, /layer="nested"/);
  assert.match(managementModal, /dismissOnBackdrop=\{false\}/);
  assert.match(managementModal, /initialFocusRef=\{section === "details" \? detailsNameInputRef : null\}/);
  assert.match(managementModal, /Discard unsaved Issue Details changes\?/);
  assert.match(managementModal, /getSequenceGroupDetailsDiscardRequest\(\{ detailsDirty, currentSection: section, nextSection \}\)/);
  assert.match(managementModal, /form="sequence-group-details-form"/);
  assert.match(detailsForm, /hasSequenceGroupDetailsChanges\(baselineRef\.current, form\)/);
  assert.match(detailsForm, /ref=\{initialFocusRef\}/);
  assert.match(detailsForm, /if \(saved\)/);
});
