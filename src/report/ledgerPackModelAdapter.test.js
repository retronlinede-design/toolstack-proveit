import assert from "node:assert/strict";
import test from "node:test";
import { buildLedgerPackReport } from "./reportBuilder.js";
import { buildCaseReportModel } from "./reportModel.js";
import { buildLedgerPackReportFromModel } from "./ledgerPackModelAdapter.js";

const fixture = { id: "c1", name: "Case", incidents: [{ id: "i1", title: "Payment", eventDate: "2026-01-01", sequenceGroup: "Money", linkedRecordIds: ["l1"] }], evidence: [{ id: "e1", title: "Receipt" }], ledger: [{ id: "l1", label: "Invoice", paymentDate: "2026-01-02", expectedAmount: "120", paidAmount: "100", currency: "EUR", type: "expense", subType: "fee", method: "bank", reference: "R-1", proofType: "receipt", proofStatus: "verified", batchLabel: "B", sequenceGroup: "Money", linkedRecordIds: ["i1", "e1"] }] };

test("Ledger Pack model adapter preserves legacy whole-case facts and totals", () => {
  const generatedAt = "2026-07-26T00:00:00.000Z";
  const legacy = buildLedgerPackReport(fixture, { scopeType: "case" }, { generatedAt });
  const adapted = buildLedgerPackReportFromModel(buildCaseReportModel(fixture, { generatedAt }), { generatedAt });
  assert.deepEqual(adapted, legacy);
});

test("Ledger Pack adapter preserves linked sequence-group context", () => {
  const model = buildCaseReportModel(fixture, { scope: "sequenceGroup", sequenceGroupName: "Money" });
  assert.deepEqual(buildLedgerPackReportFromModel(model).includedLedgerIds, ["l1"]);
});
