import test from "node:test";
import assert from "node:assert/strict";
import { resolveSelectedTrackingRecordId } from "./recordsWorkspaceHelpers.js";

const records = [{ id: "record-a" }, { id: "record-b" }];

test("selects the first available tracking record when no local selection exists", () => {
  assert.equal(resolveSelectedTrackingRecordId(records), "record-a");
});

test("keeps a valid local selected record without mutating the records", () => {
  const before = structuredClone(records);
  assert.equal(resolveSelectedTrackingRecordId(records, "record-b"), "record-b");
  assert.deepEqual(records, before);
});

test("falls back safely when a selected tracking record was removed", () => {
  assert.equal(resolveSelectedTrackingRecordId([{ id: "record-b" }], "record-a"), "record-b");
  assert.equal(resolveSelectedTrackingRecordId([], "record-a"), "");
});