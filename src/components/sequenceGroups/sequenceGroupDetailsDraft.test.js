import assert from "node:assert/strict";
import test from "node:test";
import { createSequenceGroupDetailsBaseline, getSequenceGroupDetailsDiscardRequest, hasSequenceGroupDetailsChanges } from "./sequenceGroupDetailsDraft.js";

const initial = { name: "Issue", description: "Original", status: "open" };

test("Details draft baseline distinguishes unchanged, changed, and reverted values", () => {
  const baseline = createSequenceGroupDetailsBaseline(initial);
  assert.equal(hasSequenceGroupDetailsChanges(baseline, initial), false);
  assert.equal(hasSequenceGroupDetailsChanges(baseline, { ...initial, description: "Edited" }), true);
  assert.equal(hasSequenceGroupDetailsChanges(baseline, { ...initial, description: "Original" }), false);
});

test("Details tab switching preserves editing until an explicit discard", () => {
  assert.equal(getSequenceGroupDetailsDiscardRequest({ detailsDirty: true, currentSection: "details", nextSection: "records" }).section, "records");
  assert.equal(getSequenceGroupDetailsDiscardRequest({ detailsDirty: false, currentSection: "details", nextSection: "records" }), null);
  assert.equal(getSequenceGroupDetailsDiscardRequest({ detailsDirty: true, currentSection: "details", nextSection: "details" }), null);
});

test("Close and Escape share the same dirty-details discard request", () => {
  assert.deepEqual(getSequenceGroupDetailsDiscardRequest({ detailsDirty: true, currentSection: "details", closing: true }), { type: "close" });
  assert.equal(getSequenceGroupDetailsDiscardRequest({ detailsDirty: false, currentSection: "details", closing: true }), null);
});
