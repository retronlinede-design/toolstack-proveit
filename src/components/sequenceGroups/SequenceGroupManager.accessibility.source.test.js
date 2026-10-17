import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manager = readFileSync(new URL("./SequenceGroupManager.jsx", import.meta.url), "utf8");
const form = readFileSync(new URL("./SequenceGroupForm.jsx", import.meta.url), "utf8");
const detailsForm = readFileSync(new URL("./SequenceGroupDetailsForm.jsx", import.meta.url), "utf8");
const managementModal = readFileSync(new URL("./SequenceGroupManagementModal.jsx", import.meta.url), "utf8");

test("Issue Manager delegates labelled dialog semantics, keyboard dismissal, focus trapping, and restoration", () => {
  assert.match(manager, /<DialogShell/);
  assert.match(manager, /title="Issue Manager"/);
  assert.match(manager, /layer="manager"/);
  assert.match(manager, /onRequestClose=\{requestClose\}/);
  assert.match(manager, /suspendFocusManagement=\{Boolean\(groupForm\)\}/);
  assert.match(manager, /dismissOnBackdrop=\{false\}/);
  assert.doesNotMatch(manager, /document\.addEventListener\("keydown"/);
});

test("Issue Manager announces feedback and exposes section state without incomplete tab semantics", () => {
  assert.match(manager, /statusMessage=\{sequenceGroupFeedback\}/);
  assert.match(manager, /aria-pressed=\{selectedSection === section\}/);
  assert.match(manager, /aria-label=\{`Show Issue \$\{section\}`\}/);
  assert.doesNotMatch(manager, /role="tablist"/);
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
