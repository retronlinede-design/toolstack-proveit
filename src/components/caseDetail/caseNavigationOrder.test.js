import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE_NAVIGATION_ORDER_STORAGE_KEY,
  moveCaseNavigationItem,
  normaliseCaseNavigationOrder,
  readCaseNavigationOrder,
  resetCaseNavigationOrder,
  saveCaseNavigationOrder,
} from "./caseNavigationOrder.js";

const canonicalIds = ["overview", "parties", "incidents", "evidence", "watch", "documents", "records", "timeline", "generate-report", "strategy", "narrative", "pack"];

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("normaliseCaseNavigationOrder keeps a valid preference and appends newly introduced tabs", () => {
  assert.deepEqual(
    normaliseCaseNavigationOrder(["strategy", "overview"], canonicalIds),
    ["strategy", "overview", "parties", "incidents", "evidence", "watch", "documents", "records", "timeline", "generate-report", "narrative", "pack"],
  );
});

test("normaliseCaseNavigationOrder safely removes duplicates, stale ids, and malformed preferences", () => {
  assert.deepEqual(normaliseCaseNavigationOrder(["strategy", "strategy", "removed", 42], canonicalIds), ["strategy", ...canonicalIds.filter((id) => id !== "strategy")]);
  assert.deepEqual(normaliseCaseNavigationOrder("not-an-array", canonicalIds), canonicalIds);
});

test("navigation preferences persist and reset without touching case data", () => {
  const storage = createStorage();
  saveCaseNavigationOrder(["documents", "overview"], storage);
  assert.equal(storage.getItem(CASE_NAVIGATION_ORDER_STORAGE_KEY), '["documents","overview"]');
  assert.deepEqual(readCaseNavigationOrder(storage), ["documents", "overview"]);
  resetCaseNavigationOrder(storage);
  assert.equal(storage.getItem(CASE_NAVIGATION_ORDER_STORAGE_KEY), null);
});

test("malformed stored navigation preferences and unavailable storage fail safely", () => {
  const storage = createStorage({ [CASE_NAVIGATION_ORDER_STORAGE_KEY]: "{" });
  assert.deepEqual(readCaseNavigationOrder(storage), []);
  assert.deepEqual(readCaseNavigationOrder({ getItem() { throw new Error("blocked"); } }), []);
});

test("moveCaseNavigationItem reorders only adjacent valid positions", () => {
  assert.deepEqual(moveCaseNavigationItem(["overview", "parties", "incidents"], "parties", -1), ["parties", "overview", "incidents"]);
  assert.deepEqual(moveCaseNavigationItem(["overview", "parties", "incidents"], "parties", 1), ["overview", "incidents", "parties"]);
  const order = ["overview", "parties"];
  assert.equal(moveCaseNavigationItem(order, "overview", -1), order);
});
