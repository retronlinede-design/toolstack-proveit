import { buildLedgerPackReportFromModel } from "./ledgerPackModelAdapter.js";
import { createReportDocument, getReportDocumentSection } from "./reportDocument.js";

function totalsByCurrency(rows) {
  const totals = {};
  rows.forEach((row) => {
    const currency = row.currency || "Unspecified";
    if (!totals[currency]) totals[currency] = { currency, total: 0, credit: 0, debit: 0, disputed: 0, pending: 0, waived: 0, unclassified: 0 };
    if (row.amount === null) return;
    totals[currency].total += row.amount;
    if (row.direction === "credit") totals[currency].credit += row.amount;
    else if (row.direction === "debit") totals[currency].debit += row.amount;
    else totals[currency].unclassified += row.amount;
    const status = String(row.status || row.proofStatus || "").toLowerCase();
    if (status.includes("disput")) totals[currency].disputed += row.amount;
    if (status.includes("pending")) totals[currency].pending += row.amount;
    if (status.includes("waiv")) totals[currency].waived += row.amount;
  });
  return Object.values(totals);
}

export function buildLedgerScheduleDocument(reportModel, definition, options = {}) {
  const model = reportModel && typeof reportModel === "object" ? reportModel : {};
  const legacy = buildLedgerPackReportFromModel(model, options);
  const byId = new Map((model.records?.all || []).map((record) => [record.id, record]));
  const rows = legacy.ledgerMatrix.map((item) => { const record = byId.get(item.id) || {}; const status = record.status || item.proofStatus || ""; return { ledgerId: item.id, ...item, status, dateStatus: record.dateStatus || "missing", archived: record.archived === true, statusNoteExcluded: record.details?.isStatusNote === true || String(record.details?.statusNote || "").toLowerCase() === "true", notes: record.notes || "", linkedRecordReferences: record.links || [] }; });
  const monetaryRows = rows.filter((row) => !row.statusNoteExcluded && row.amount !== null);
  const excludedRows = rows.filter((row) => row.statusNoteExcluded);
  const currencies = [...new Set(monetaryRows.map((row) => row.currency || "Unspecified"))];
  const unresolved = (model.unresolvedReferences || []).filter((item) => legacy.includedLedgerIds.includes(item.sourceRecordId));
  const currencyTotals = totalsByCurrency(monetaryRows);
  const notices = [
    { code: "ARCHIVED_POLICY", severity: "info", message: definition?.includeArchived === false ? "Archived ledger entries are excluded." : "Archived ledger entries are included when present in the selected scope." },
    { code: "NO_CURRENCY_CONVERSION", severity: currencies.length > 1 ? "warning" : "info", message: currencies.length > 1 ? "Multiple currencies are present. Totals are reported separately and are not converted or combined." : "Stored monetary values are reported without currency conversion." },
  ];
  if (unresolved.length) notices.push({ code: "UNRESOLVED_REFERENCES", severity: "warning", message: `${unresolved.length} unresolved reference(s) affect this ledger schedule.` });
  const weak = { ...legacy.unlinkedWeakLedger, missingAmount: rows.filter((row) => row.amount === null), missingCurrency: rows.filter((row) => row.amount !== null && !row.currency), missingStatus: rows.filter((row) => !row.status), malformedDate: rows.filter((row) => row.dateStatus === "malformed") };
  return createReportDocument({ definition, model, generatedAt: options.generatedAt, title: legacy.title, notices,
    summary: { caseOverview: legacy.caseOverview, scopeLabel: legacy.scopeLabel, includedLedgerCount: legacy.includedLedgerCount, includedLedgerIds: legacy.includedLedgerIds, archivedPolicy: definition?.includeArchived === false ? "excluded" : "included", atAGlance: legacy.atAGlance, monetaryEntryCount: monetaryRows.length, excludedStatusNoteCount: excludedRows.length, currencies, totalsByCurrency: currencyTotals, unresolvedReferenceCount: unresolved.length },
    sections: [
      { id: "case-overview", heading: "Case Details", type: "summary", metadata: legacy.caseOverview },
      { id: "ledger-summary", heading: "Ledger Summary", type: "metrics", items: currencyTotals },
      { id: "ledger-schedule", heading: "Ledger Schedule", type: "table", rows },
      { id: "totals-exclusions", heading: "Totals and Exclusions", type: "summary", items: currencyTotals, metadata: { excludedStatusNotes: excludedRows } },
      { id: "proof-support", heading: "Proof and Support", type: "record-list", metadata: legacy.proofSummary },
      { id: "weak-incomplete-ledger", heading: "Weak or Incomplete Ledger Entries", type: "diagnostics", diagnostics: weak },
      { id: "diagnostics", heading: "Diagnostics", type: "diagnostics", diagnostics: legacy.diagnostics },
      { id: "unresolved-references", heading: "Unresolved References", type: "diagnostics", items: unresolved },
      { id: "notices", heading: "Notices", type: "narrative", items: notices },
    ] });
}

export function projectLedgerDocumentToLegacyViewModel(document) {
  const summary = document?.summary || {}; const scope = document?.source?.scope || {};
  return { reportType: "LEDGER_PACK_REPORT", title: document?.report?.title || "Ledger Pack: Whole Case", audience: "general", scopeType: scope.type === "sequenceGroup" ? "sequenceGroup" : "case", sequenceGroup: scope.type === "sequenceGroup" ? scope.sequenceGroupName || "" : "", scopeLabel: summary.scopeLabel || "Whole case", sourceCaseId: document?.source?.caseId || "", generatedAt: document?.report?.generatedAt || "", includedLedgerCount: summary.includedLedgerCount || 0, includedLedgerIds: summary.includedLedgerIds || [], caseOverview: summary.caseOverview || {}, atAGlance: summary.atAGlance || {}, ledgerMatrix: getReportDocumentSection(document, "ledger-schedule")?.rows || [], proofSummary: getReportDocumentSection(document, "proof-support")?.metadata || {}, unlinkedWeakLedger: getReportDocumentSection(document, "weak-incomplete-ledger")?.diagnostics || {}, diagnostics: getReportDocumentSection(document, "diagnostics")?.diagnostics || {} };
}
