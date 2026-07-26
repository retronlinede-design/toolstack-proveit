import test from "node:test";
import assert from "node:assert/strict";
import { filterSequenceGroupRecords, getSequenceGroupRecordKey, selectVisibleSequenceGroupRecords, toggleSequenceGroupRecordSelection } from "./sequenceGroupRecordSelection.js";

const records = [
  { id: "1", recordType: "incidents", title: "Notice sent", summary: "First event", status: "open", date: "2026-01-01" },
  { id: "2", recordType: "evidence", title: "Email", summary: "Missing date proof", status: "verified", date: "" },
  { id: "3", recordType: "watchItems", title: "Review", summary: "Monitor", status: "open", date: "2026-02-01" },
];
const all = { search: "", type: "all", status: "all", missingOnly: false, selectedOnly: false };

test("supports one, multiple, select visible, and clear selection", () => {
  let selected = toggleSequenceGroupRecordSelection(new Set(), getSequenceGroupRecordKey(records[0]));
  assert.equal(selected.size, 1);
  selected = toggleSequenceGroupRecordSelection(selected, getSequenceGroupRecordKey(records[1]));
  assert.equal(selected.size, 2);
  selected = selectVisibleSequenceGroupRecords(selected, records);
  assert.equal(selected.size, 3);
  selected = new Set();
  assert.equal(selected.size, 0);
});

test("filters title, summary, type, status, missing date, and selected only", () => {
  assert.deepEqual(filterSequenceGroupRecords(records, { ...all, search: "proof" }).map((r) => r.id), ["2"]);
  assert.deepEqual(filterSequenceGroupRecords(records, { ...all, type: "watchItems" }).map((r) => r.id), ["3"]);
  assert.deepEqual(filterSequenceGroupRecords(records, { ...all, status: "open" }).map((r) => r.id), ["1", "3"]);
  assert.deepEqual(filterSequenceGroupRecords(records, { ...all, missingOnly: true }).map((r) => r.id), ["2"]);
  const selected = new Set([getSequenceGroupRecordKey(records[0])]);
  assert.deepEqual(filterSequenceGroupRecords(records, { ...all, selectedOnly: true }, selected).map((r) => r.id), ["1"]);
});

test("selection remains stable when filters change", () => {
  const selected = selectVisibleSequenceGroupRecords(new Set(), records.slice(0, 2));
  filterSequenceGroupRecords(records, { ...all, type: "watchItems" }, selected);
  assert.deepEqual([...selected].sort(), ["evidence:2", "incidents:1"]);
});
