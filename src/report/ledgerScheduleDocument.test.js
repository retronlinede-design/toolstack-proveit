import assert from "node:assert/strict";
import test from "node:test";
import { getReportDefinition } from "./reportDefinitions.js";
import { buildCaseReportModel } from "./reportModel.js";
import { buildLedgerScheduleDocument, projectLedgerDocumentToLegacyViewModel } from "./ledgerScheduleDocument.js";

test("Ledger Schedule keeps currencies separate and preserves legacy projection", () => {
  const model = buildCaseReportModel({ id: "c", name: "Case", ledger: [{ id: "e", label: "Euro", amount: "10", currency: "EUR" }, { id: "u", label: "Dollar", amount: "20", currency: "USD" }] });
  const document = buildLedgerScheduleDocument(model, getReportDefinition("ledger"));
  assert.deepEqual(document.summary.currencies, ["EUR", "USD"]);
  assert.equal(document.summary.totalsByCurrency.length, 2);
  assert.match(document.notices.find((item) => item.code === "NO_CURRENCY_CONVERSION").message, /not converted or combined/);
  assert.equal(projectLedgerDocumentToLegacyViewModel(document).atAGlance.totalAmount, 30);
});

test("Ledger Schedule excludes status notes from document totals without deleting entries", () => {
  const model = buildCaseReportModel({ id: "c", ledger: [{ id: "n", label: "Note", amount: 10, isStatusNote: true }] });
  const document = buildLedgerScheduleDocument(model, getReportDefinition("ledger"));
  assert.equal(document.summary.excludedStatusNoteCount, 1);
  assert.equal(document.sections.find((item) => item.id === "ledger-schedule").rows.length, 1);
});
