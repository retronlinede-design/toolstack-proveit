import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TRACKING_RECORD_TABLE_TEXT } from "./trackingRecordFormat.js";
import { parseTrackingRecordTable, removeTrackingRecordTableRow, serializeTrackingRecordTable } from "./trackingRecordTable.js";

test("parses the shared default table as an editable zero-row model", () => {
  const model = parseTrackingRecordTable(DEFAULT_TRACKING_RECORD_TABLE_TEXT);

  assert.equal(model.status, "ok");
  assert.deepEqual(model.headers, ["Period/Date", "Expected", "Actual", "Difference", "Unit", "Status", "Notes"]);
  assert.deepEqual(model.rows, []);
});

test("preserves source header order, empty middle and final cells, and arbitrary headers", () => {
  const source = [
    "  | Zeta | Custom Header | Alpha |",
    "| --- | --- | --- |",
    "|  first  |  |  final  |",
    "| second | value |  |",
  ].join("\n");

  const model = parseTrackingRecordTable(source);

  assert.equal(model.status, "ok");
  assert.deepEqual(model.headers, ["Zeta", "Custom Header", "Alpha"]);
  assert.deepEqual(model.rows, [["first", "", "final"], ["second", "value", ""]]);
});

test("round-trips supported tables without mutating the source or semantic cell values", () => {
  const source = [
    "| Date | Amount | Notes |",
    "| ---- | ------ | ----- |",
    "| 2026-01-01 | 100 | Paid |",
    "| 2026-02-01 |  |  |",
  ].join("\n");
  const original = source.slice();

  const first = parseTrackingRecordTable(source);
  const serialized = serializeTrackingRecordTable(first);
  const second = parseTrackingRecordTable(serialized);

  assert.equal(source, original);
  assert.equal(first.status, "ok");
  assert.equal(second.status, "ok");
  assert.deepEqual(second.headers, first.headers);
  assert.deepEqual(second.rows, first.rows);
});

test("rejects structurally unsafe tables without producing a partial editable model", () => {
  const cases = [
    ["column mismatch", "| A | B |\n| --- | --- |\n| one |", "column_count_mismatch"],
    ["malformed separator", "| A | B |\n| nope | --- |\n| one | two |", "malformed_separator"],
    ["escaped pipe", "| A | B |\n| --- | --- |\n| one \\| two | value |", "escaped_pipe_unsupported"],
    ["unescaped pipe", "| A | B |\n| --- | --- |\n| one | two | three |", "column_count_mismatch"],
    ["unwrapped newline", "| A | B |\n| --- | --- |\n| one | two |\ncontinued", "invalid_row_or_newline_in_cell"],
    ["section marker", "| A | B |\n| --- | --- |\n| --- NOTES --- | value |", "section_marker_in_cell"],
  ];

  for (const [, source, reason] of cases) {
    const model = parseTrackingRecordTable(source);
    assert.equal(model.status, "unavailable");
    assert.equal(model.reason, reason);
    assert.deepEqual(model.headers, []);
    assert.deepEqual(model.rows, []);
  }
});

test("serializer validates row shape and unsafe cells instead of emitting malformed output", () => {
  assert.throws(
    () => serializeTrackingRecordTable({ headers: ["A", "B"], rows: [["only one"]] }),
    /column_count_mismatch/,
  );
  assert.throws(
    () => serializeTrackingRecordTable({ headers: ["A"], rows: [["one|two"]] }),
    /pipe_in_cell/,
  );
  assert.throws(
    () => serializeTrackingRecordTable({ headers: ["A"], rows: [["line one\nline two"]] }),
    /newline_in_cell/,
  );
});
test("removes only the chosen first, middle, or final row while preserving a serializable table", () => {
  const model = {
    headers: ["Period", "Value"],
    rows: [["first", "1"], ["middle", "2"], ["last", "3"]],
  };

  assert.deepEqual(removeTrackingRecordTableRow(model, 0).rows, [["middle", "2"], ["last", "3"]]);
  assert.deepEqual(removeTrackingRecordTableRow(model, 1).rows, [["first", "1"], ["last", "3"]]);
  assert.deepEqual(removeTrackingRecordTableRow(model, 2).rows, [["first", "1"], ["middle", "2"]]);
  assert.deepEqual(model.rows, [["first", "1"], ["middle", "2"], ["last", "3"]]);

  const finalRowDeleted = removeTrackingRecordTableRow({ headers: ["Period"], rows: [["January"]] }, 0);
  assert.deepEqual(finalRowDeleted, { headers: ["Period"], rows: [] });
  assert.deepEqual(parseTrackingRecordTable(serializeTrackingRecordTable(finalRowDeleted)), {
    status: "ok",
    reason: null,
    headers: ["Period"],
    rows: [],
  });
});

test("row removal rejects invalid indexes without changing the original model", () => {
  const model = { headers: ["A"], rows: [["one"]] };
  assert.throws(() => removeTrackingRecordTableRow(model, 1), /invalid_row_index/);
  assert.deepEqual(model, { headers: ["A"], rows: [["one"]] });
});