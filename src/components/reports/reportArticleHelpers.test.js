import test from "node:test";
import assert from "node:assert/strict";
import {
  formatLedgerAmount,
  formatReportDate,
  formatReportMoney,
  getLinkedListLabel,
} from "./reportArticleHelpers.js";

test("report article helpers preserve report date and money fallbacks", () => {
  assert.equal(formatReportDate("2026-05-10"), "2026-05-10");
  assert.equal(formatReportDate(""), "No date");
  assert.equal(formatReportDate(null), "No date");
  assert.equal(formatReportMoney(25), "25");
  assert.equal(formatReportMoney("25.00"), "25.00");
  assert.equal(formatReportMoney(""), "-");
  assert.equal(formatReportMoney(undefined), "-");
});

test("ledger amount appends currency only when an amount exists", () => {
  assert.equal(formatLedgerAmount(100, "EUR"), "100 EUR");
  assert.equal(formatLedgerAmount("", "EUR"), "-");
});

test("linked list labels support strings and record-like objects", () => {
  assert.equal(getLinkedListLabel("Incident A"), "Incident A");
  assert.equal(getLinkedListLabel({ title: "Evidence A", id: "ev-1" }), "Evidence A");
  assert.equal(getLinkedListLabel({ id: "doc-1" }), "doc-1");
  assert.equal(getLinkedListLabel({}), "");
});
