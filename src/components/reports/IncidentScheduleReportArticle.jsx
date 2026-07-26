import { getReportDocumentSection } from "../../report/reportDocument.js";

const TYPE_LABELS = { evidence: "Evidence", document: "Documents", strategy: "Strategy", watch: "To Watch", ledger: "Ledger" };
function display(value, fallback = "Not recorded") { return value == null || value === "" ? fallback : String(value); }
function list(items = []) { return items.length ? items.map((item) => `${item.id} — ${item.title}`).join("; ") : "None"; }

export default function IncidentScheduleReportArticle({ reportDocument, className = "" }) {
  const rows = getReportDocumentSection(reportDocument, "incident-schedule")?.rows || [];
  const coverage = getReportDocumentSection(reportDocument, "evidence-coverage")?.rows || [];
  const findings = getReportDocumentSection(reportDocument, "incident-quality-findings")?.items || [];
  const unresolved = getReportDocumentSection(reportDocument, "unresolved-references")?.items || [];
  const notices = reportDocument?.notices || [];
  const summary = reportDocument?.summary || {};
  return (
    <article className={className} data-report-document="incidentSchedule">
      <header className="border-b border-neutral-200 pb-5 dark:border-neutral-700">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Complete factual report</p>
        <h2 className="mt-1 text-2xl font-bold text-neutral-950 dark:text-neutral-50">{reportDocument?.report?.title || "Incident Schedule"}</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{summary.scopeLabel || "Whole case"} · Source revision {reportDocument?.source?.sourceRevision?.fingerprint || "unavailable"}</p>
      </header>
      <section aria-labelledby="incident-summary-heading" className="mt-6">
        <h3 id="incident-summary-heading" className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Summary</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Incidents", summary.scopedIncidentCount], ["With evidence", summary.incidentsWithLinkedEvidence], ["Without evidence", summary.incidentsWithoutLinkedEvidence], ["Unresolved references", summary.incidentsWithUnresolvedReferences]].map(([label, value]) => <div key={label} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"><dt className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{label}</dt><dd className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">{value || 0}</dd></div>)}
        </dl>
      </section>
      <section aria-labelledby="incident-table-heading" className="mt-7">
        <h3 id="incident-table-heading" className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Incident Schedule</h3>
        {!rows.length ? <p className="mt-3 rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">No incidents are included in this report scope.</p> : (
          <div className="mt-3 overflow-x-auto"><table className="min-w-[1000px] w-full border-collapse text-left text-sm"><thead><tr className="border-b border-neutral-300 dark:border-neutral-700">{["ID", "Incident", "Date", "Status", "Sequence Group", "Parties", ...Object.values(TYPE_LABELS), "Attachments"].map((heading) => <th key={heading} scope="col" className="px-2 py-2 font-bold text-neutral-700 dark:text-neutral-200">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.incidentId} className="border-b border-neutral-200 align-top dark:border-neutral-800"><td className="px-2 py-3 font-mono text-xs">{display(row.incidentId)}</td><td className="px-2 py-3"><strong>{display(row.title)}</strong><p className="mt-1 max-w-sm whitespace-normal text-neutral-600 dark:text-neutral-300">{display(row.description)}</p>{row.archived ? <span className="mt-1 inline-block font-semibold">Archived</span> : null}</td><td className="px-2 py-3">{display(row.canonicalDate, row.dateStatus === "malformed" ? "Malformed date" : "Missing date")}</td><td className="px-2 py-3">{display(row.status)}</td><td className="px-2 py-3">{display(row.sequenceGroup, "Ungrouped")}</td><td className="px-2 py-3">{row.resolvedParties?.length ? row.resolvedParties.map((party) => `${party.name}${party.role ? ` (${party.role})` : ""}`).join(", ") : "None"}</td><td className="px-2 py-3">{list(row.linkedEvidence)}</td><td className="px-2 py-3">{list(row.linkedDocuments)}</td><td className="px-2 py-3">{list(row.linkedStrategies)}</td><td className="px-2 py-3">{list(row.linkedWatch)}</td><td className="px-2 py-3">{list(row.linkedLedger)}</td><td className="px-2 py-3">{row.attachmentCount || 0}</td></tr>)}</tbody></table></div>
        )}
      </section>
      <section aria-labelledby="coverage-heading" className="mt-7"><h3 id="coverage-heading" className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Evidence Coverage</h3><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Coverage describes structured associations; it does not determine whether an incident is proven.</p><ul className="mt-3 space-y-2">{coverage.map((item) => <li key={item.incidentId} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700"><strong>{item.incidentId} — {item.incidentTitle}</strong><span className="ml-2">{item.coverageStatus} · {item.supportingEvidenceCount} evidence record(s)</span></li>)}</ul></section>
      <section aria-labelledby="findings-heading" className="mt-7"><h3 id="findings-heading" className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Weak or Incomplete Incidents</h3>{findings.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{findings.map((item, index) => <li key={`${item.code}-${item.recordId}-${index}`}><strong>{item.code}</strong> · {item.recordId}: {item.message}</li>)}</ul> : <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">No report-specific quality findings.</p>}</section>
      {unresolved.length ? <section aria-labelledby="incident-unresolved-heading" className="mt-7"><h3 id="incident-unresolved-heading" className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Unresolved References</h3><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{unresolved.map((item, index) => <li key={`${item.sourceRecordId}-${item.targetId}-${index}`}>{item.message} Technical reference: {item.targetId}</li>)}</ul></section> : null}
      <section aria-labelledby="incident-notices-heading" className="mt-7 border-t border-neutral-200 pt-5 dark:border-neutral-700"><h3 id="incident-notices-heading" className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Notices</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-300">{notices.map((notice) => <li key={notice.code}>{notice.message}</li>)}</ul></section>
    </article>
  );
}
