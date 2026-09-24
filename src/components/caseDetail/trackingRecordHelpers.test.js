import test from "node:test";
import assert from "node:assert/strict";
import { generateLedgerEntries } from "./trackingRecordHelpers.js";

test("payment preview IDs are transient values derived from the current row index", () => {
  const records = [{
    id: "record-1",
    title: "Payments",
    meta: { type: "payment_tracker", subject: "Rent" },
    table: [
      { Date: "2026-01-01", "Amount €": "100", Direction: "paid", Status: "confirmed", Notes: "first" },
      { Date: "2026-02-01", "Amount €": "200", Direction: "paid", Status: "confirmed", Notes: "second" },
    ],
  }];

  const preview = generateLedgerEntries(records);

  assert.deepEqual(preview.map((entry) => entry.id).sort(), ["record-1__derived__0", "record-1__derived__1"]);
  assert.deepEqual(preview.map((entry) => entry.sourceTrackingRecordId), ["record-1", "record-1"]);
  assert.equal(Object.hasOwn(preview[0], "rowId"), false);
});