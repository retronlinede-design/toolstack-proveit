import assert from "node:assert/strict";
import test from "node:test";

import { getOverviewRecordLaunch } from "./overviewRecordLaunch.js";

test("Overview record launches resolve directly to existing modal families", () => {
  const record = { id: "record-1" };
  assert.deepEqual(getOverviewRecordLaunch({ recordType: "incidents", record }), { kind: "record", editorType: "incidents", record });
  assert.deepEqual(getOverviewRecordLaunch({ recordType: "evidence", record }), { kind: "record", editorType: "evidence", record });
  assert.deepEqual(getOverviewRecordLaunch({ recordType: "strategy", record }), { kind: "record", editorType: "strategy", record });
  assert.deepEqual(getOverviewRecordLaunch({ recordType: "documents", record }), { kind: "document", record });
  assert.deepEqual(getOverviewRecordLaunch({ recordType: "ledger", record }), { kind: "ledger", record });
  assert.deepEqual(getOverviewRecordLaunch({ recordType: "watchItems", record }), { kind: "watch", record });
});

test("Overview launch resolution never returns workspace navigation", () => {
  for (const recordType of ["incidents", "evidence", "strategy", "documents", "ledger", "watchItems"]) {
    const launch = getOverviewRecordLaunch({ recordType, record: { id: recordType } });
    assert.equal(Object.hasOwn(launch, "tab"), false);
  }
  assert.equal(getOverviewRecordLaunch({ recordType: "case" }), null);
});
