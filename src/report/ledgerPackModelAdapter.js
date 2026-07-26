import { LEDGER_PACK_REPORT } from "./reportBuilder.js";
import { getLegacyLinkedRecords, getModelPackRecords, getModelRecordById } from "./reportModelPackUtils.js";

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function shortText(value, limit = 600) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function direction(record) {
  const value = [record.details.type, record.details.category, record.details.subType, record.title].join(" ").toLowerCase();
  if (["income", "credit", "received", "refund", "reimbursement"].some((word) => value.includes(word))) return "credit";
  if (["expense", "debit", "paid", "rent", "utility", "repair", "legal", "cost", "fee", "bill"].some((word) => value.includes(word))) return "debit";
  return "neutral";
}

function buildEntry(record, recordById) {
  const linkedRecords = getLegacyLinkedRecords(record, recordById, ["linkedRecordIds"]);
  const expectedAmount = numberOrNull(record.details.expectedAmount);
  const paidAmount = numberOrNull(record.details.paidAmount);
  const amount = expectedAmount ?? paidAmount ?? numberOrNull(record.details.amount);
  const proofType = record.details.proofType || "";
  const proofStatus = record.details.proofStatus || "";
  const hasProof = Boolean(proofType || (proofStatus && !["missing", "none", "no_proof", "unverified"].includes(proofStatus.toLowerCase())) || linkedRecords.some((item) => ["evidence", "document"].includes(item.recordType)));
  return {
    id: record.id, title: record.title, description: shortText(record.notes || record.details.counterparty || record.details.category || record.details.period),
    date: record.details.paymentDate || record.details.dueDate || record.details.period || record.details.createdAt || record.canonicalDate || "",
    amount, expectedAmount, paidAmount, currency: record.details.currency || "", type: record.details.type || record.details.category || "",
    subType: record.details.subType || "", method: record.details.method || "", reference: record.details.reference || "", proofType, proofStatus,
    batchLabel: record.details.batchLabel || "", sequenceGroup: record.sequenceGroup || "", direction: direction(record), hasProof, linkedRecords,
    linkedIncidents: linkedRecords.filter((item) => item.recordType === "incident"), linkedEvidence: linkedRecords.filter((item) => item.recordType === "evidence"),
    linkedDocuments: linkedRecords.filter((item) => item.recordType === "document"), linkedStrategy: linkedRecords.filter((item) => item.recordType === "strategy"),
  };
}

const sum = (entries, predicate = () => true) => entries.reduce((total, entry) => total + (predicate(entry) && entry.amount !== null ? entry.amount : 0), 0);

export function buildLedgerPackReportFromModel(model, options = {}) {
  const records = getModelPackRecords(model, "ledger");
  const recordById = getModelRecordById(model);
  const ledgerMatrix = records.map((record) => buildEntry(record, recordById));
  const entriesWithMissingProof = ledgerMatrix.filter((entry) => !entry.hasProof);
  const linked = ledgerMatrix.filter((entry) => entry.linkedRecords.length > 0);
  const unlinked = ledgerMatrix.filter((entry) => entry.linkedRecords.length === 0);
  const diagnostics = model?.diagnostics?.case || {};
  const ids = new Set(records.map((record) => record.id));
  const packDiagnostics = {
    weaklyLinkedLedger: (diagnostics.integrity?.weaklyLinkedRecords || []).filter((item) => item.type === "ledger" && ids.has(item.id)),
    orphanLedger: (diagnostics.integrity?.orphanRecords || []).filter((item) => item.type === "ledger" && ids.has(item.id)),
    brokenLinks: (diagnostics.integrity?.brokenLinks || []).filter((item) => ids.has(item.sourceId) || ids.has(item.targetId)),
    warnings: diagnostics.warnings || [], suggestions: diagnostics.suggestions || [],
  };
  const scopeType = model?.scope?.type === "sequenceGroup" ? "sequenceGroup" : "case";
  const sequenceGroup = scopeType === "sequenceGroup" ? model?.scope?.sequenceGroupName || "" : "";
  return {
    reportType: LEDGER_PACK_REPORT, title: scopeType === "sequenceGroup" ? `Ledger Pack: ${sequenceGroup || "Unselected sequenceGroup"}` : "Ledger Pack: Whole Case",
    audience: "general", scopeType, sequenceGroup, scopeLabel: scopeType === "sequenceGroup" ? `sequenceGroup: ${sequenceGroup || "-"}` : "Whole case",
    sourceCaseId: model?.sourceCase?.id || "", generatedAt: options.generatedAt || model?.generatedAt || new Date().toISOString(),
    includedLedgerCount: records.length, includedLedgerIds: records.map((record) => record.id),
    caseOverview: { name: model?.sourceCase?.name || "", category: model?.sourceCase?.category || "", status: model?.sourceCase?.status || "" },
    atAGlance: { totalEntryCount: records.length, totalAmount: sum(ledgerMatrix), creditTotal: sum(ledgerMatrix, (entry) => entry.direction === "credit"), debitTotal: sum(ledgerMatrix, (entry) => entry.direction === "debit"), entriesWithProofCount: ledgerMatrix.length - entriesWithMissingProof.length, entriesWithoutProofCount: entriesWithMissingProof.length, linkedEntryCount: linked.length, unlinkedEntryCount: unlinked.length },
    ledgerMatrix, proofSummary: { entriesLinkedToProofRecords: ledgerMatrix.filter((entry) => entry.linkedEvidence.length || entry.linkedDocuments.length), entriesWithMissingProof },
    unlinkedWeakLedger: { unlinkedLedgerEntries: unlinked, weaklyLinkedLedger: packDiagnostics.weaklyLinkedLedger, entriesWithMissingProof }, diagnostics: packDiagnostics,
  };
}
