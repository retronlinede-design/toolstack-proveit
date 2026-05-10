import { formatLedgerAmount, formatReportDate } from "./reportArticleHelpers.js";
import { GlanceGrid, ReportLinkedList } from "./ReportArticleShared.jsx";

function WeakLedgerList({ title, items }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
      {items.length === 0 ? <p className="mt-2 text-sm text-neutral-600">None.</p> : (
        <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
          {items.map((entry) => <li key={entry.id}>- {entry.title}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function LedgerPackReportArticle({ report, className = "" }) {
  if (!report) return null;

  const glanceItems = [
    ["Entries", report.atAGlance.totalEntryCount],
    ["Total", report.atAGlance.totalAmount],
    ["Credits", report.atAGlance.creditTotal],
    ["Debits", report.atAGlance.debitTotal],
    ["With Proof", report.atAGlance.entriesWithProofCount],
    ["Missing Proof", report.atAGlance.entriesWithoutProofCount],
    ["Linked", report.atAGlance.linkedEntryCount],
    ["Unlinked", report.atAGlance.unlinkedEntryCount],
  ];

  return (
    <article className={className}>
      <header className="border-b border-neutral-200 pb-6 print:pb-5">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">LEDGER PACK REPORT</div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-neutral-950 print:text-[22pt]">{report.title}</h1>
            <div className="mt-3 grid gap-1 text-sm text-neutral-600">
              <div><span className="font-semibold text-neutral-950">Case:</span> {report.caseOverview.name || report.sourceCaseId || "Untitled Case"}</div>
              <div><span className="font-semibold text-neutral-950">Scope:</span> {report.scopeLabel}</div>
              <div><span className="font-semibold text-neutral-950">Generated:</span> {formatReportDate(report.generatedAt)}</div>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 print:bg-white">
            <div><span className="font-semibold text-neutral-900">Audience:</span> {report.audience}</div>
            <div><span className="font-semibold text-neutral-900">Ledger entries included:</span> {report.includedLedgerCount}</div>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">At a Glance</h2>
        <GlanceGrid items={glanceItems} columnsClass="sm:grid-cols-4 lg:grid-cols-8" />
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Ledger Matrix</h2>
        {report.ledgerMatrix.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No ledger entries are included in this scope.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[1120px] rounded-lg border border-neutral-200">
              <div className="grid grid-cols-[0.8fr_1.1fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_1.3fr] border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500 print:bg-white">
                <div className="p-3">Date</div>
                <div className="p-3">Entry</div>
                <div className="p-3">Amount</div>
                <div className="p-3">Type</div>
                <div className="p-3">Method</div>
                <div className="p-3">Reference</div>
                <div className="p-3">Proof</div>
                <div className="p-3">Batch</div>
                <div className="p-3">sequenceGroup</div>
                <div className="p-3">Linked records</div>
              </div>
              {report.ledgerMatrix.map((entry) => (
                <div key={entry.id} className="grid break-inside-avoid grid-cols-[0.8fr_1.1fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_1.3fr] border-b border-neutral-100 text-sm last:border-b-0 print:break-inside-avoid">
                  <div className="p-3 leading-6 text-neutral-700">{formatReportDate(entry.date)}</div>
                  <div className="p-3">
                    <div className="font-semibold text-neutral-950">{entry.title}</div>
                    {entry.description ? <div className="mt-1 text-xs leading-5 text-neutral-500">{entry.description}</div> : null}
                  </div>
                  <div className="p-3 leading-6 text-neutral-700">{formatLedgerAmount(entry.amount, entry.currency)}</div>
                  <div className="p-3 leading-6 text-neutral-700">{[entry.type, entry.subType].filter(Boolean).join(" / ") || "-"}</div>
                  <div className="p-3 leading-6 text-neutral-700">{entry.method || "-"}</div>
                  <div className="p-3 leading-6 text-neutral-700">{entry.reference || "-"}</div>
                  <div className="p-3 leading-6 text-neutral-700">{entry.proofType || entry.proofStatus || (entry.hasProof ? "Linked proof" : "-")}</div>
                  <div className="p-3 leading-6 text-neutral-700">{entry.batchLabel || "-"}</div>
                  <div className="p-3 leading-6 text-neutral-700">{entry.sequenceGroup || "-"}</div>
                  <div className="p-3 leading-6 text-neutral-700"><ReportLinkedList items={entry.linkedRecords} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Proof / Support Summary</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-4">
            <h3 className="text-sm font-semibold text-neutral-950">Entries linked to evidence/documents</h3>
            {report.proofSummary.entriesLinkedToProofRecords.length === 0 ? <p className="mt-2 text-sm text-neutral-600">None.</p> : (
              <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
                {report.proofSummary.entriesLinkedToProofRecords.map((entry) => (
                  <li key={entry.id}>- {entry.title}: <ReportLinkedList items={[...entry.linkedEvidence, ...entry.linkedDocuments]} /></li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <h3 className="text-sm font-semibold text-neutral-950">Entries with missing proof</h3>
            {report.proofSummary.entriesWithMissingProof.length === 0 ? <p className="mt-2 text-sm text-neutral-600">None.</p> : (
              <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
                {report.proofSummary.entriesWithMissingProof.map((entry) => <li key={entry.id}>- {entry.title}</li>)}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Unlinked / Weak Ledger Entries</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <WeakLedgerList title="Unlinked" items={report.unlinkedWeakLedger.unlinkedLedgerEntries} />
          <WeakLedgerList title="Weak links" items={report.unlinkedWeakLedger.weaklyLinkedLedger} />
          <WeakLedgerList title="Missing proof" items={report.unlinkedWeakLedger.entriesWithMissingProof} />
        </div>
      </section>

      <section className="py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Diagnostics</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Orphan ledger: <span className="font-semibold">{report.diagnostics.orphanLedger.length}</span></div>
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Weak ledger: <span className="font-semibold">{report.diagnostics.weaklyLinkedLedger.length}</span></div>
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Broken links: <span className="font-semibold">{report.diagnostics.brokenLinks.length}</span></div>
        </div>
      </section>
    </article>
  );
}
