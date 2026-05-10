import { formatReportDate } from "./reportArticleHelpers.js";
import { GlanceGrid, ReportLinkedList } from "./ReportArticleShared.jsx";

export default function EvidencePackReportArticle({ report, className = "" }) {
  if (!report) return null;

  const glanceItems = [
    ["Evidence", report.atAGlance.evidenceCount],
    ["Linked", report.atAGlance.linkedEvidenceCount],
    ["Unlinked", report.atAGlance.unlinkedEvidenceCount],
    ["Incidents Supported", report.atAGlance.incidentsSupportedCount],
    ["With Attachments", report.atAGlance.evidenceWithAttachmentsCount],
    ["Missing Summary", report.atAGlance.evidenceMissingFunctionSummaryCount],
  ];

  return (
    <article className={className}>
      <header className="border-b border-neutral-200 pb-6 print:pb-5">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">EVIDENCE PACK REPORT</div>
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
            <div><span className="font-semibold text-neutral-900">Evidence included:</span> {report.includedEvidenceCount}</div>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">At a Glance</h2>
        <GlanceGrid items={glanceItems} columnsClass="sm:grid-cols-3 lg:grid-cols-6" />
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Evidence Matrix</h2>
        {report.evidenceMatrix.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No evidence is included in this scope.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[900px] rounded-lg border border-neutral-200">
              <div className="grid grid-cols-[1.1fr_1.35fr_1fr_1fr_0.8fr_0.9fr] border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500 print:bg-white">
                <div className="p-3">Evidence</div>
                <div className="p-3">What it proves</div>
                <div className="p-3">Linked incidents</div>
                <div className="p-3">Linked records</div>
                <div className="p-3">Attachments</div>
                <div className="p-3">Status / role</div>
              </div>
              {report.evidenceMatrix.map((evidence) => (
                <div key={evidence.id} className="grid break-inside-avoid grid-cols-[1.1fr_1.35fr_1fr_1fr_0.8fr_0.9fr] border-b border-neutral-100 text-sm last:border-b-0 print:break-inside-avoid">
                  <div className="p-3">
                    <div className="font-semibold text-neutral-950">{evidence.title}</div>
                    <div className="mt-1 text-xs text-neutral-500">{formatReportDate(evidence.capturedAt || evidence.date)}</div>
                  </div>
                  <div className="p-3 leading-6 text-neutral-700">
                    {evidence.functionSummary || <span className="text-amber-700">Missing functionSummary</span>}
                    {evidence.reviewNotes ? <div className="mt-2 text-xs text-neutral-500">Review: {evidence.reviewNotes}</div> : null}
                  </div>
                  <div className="p-3 leading-6 text-neutral-700"><ReportLinkedList items={evidence.linkedIncidents} /></div>
                  <div className="p-3 leading-6 text-neutral-700"><ReportLinkedList items={evidence.linkedRecords} /></div>
                  <div className="p-3 leading-6 text-neutral-700">{evidence.attachmentCount} {evidence.attachmentNames.length ? evidence.attachmentNames.join(", ") : ""}</div>
                  <div className="p-3 leading-6 text-neutral-700">{evidence.status || "-"} / {evidence.evidenceRole || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Supported Incidents</h2>
        <div className="mt-4 space-y-3">
          {report.supportedIncidents.length === 0 ? <p className="text-sm text-neutral-600">No incidents are supported by evidence in this scope.</p> : report.supportedIncidents.map((incident) => (
            <div key={incident.id} className="break-inside-avoid rounded-lg border border-neutral-200 p-4 print:break-inside-avoid">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-neutral-950">{incident.title}</h3>
                <span className="text-xs font-semibold text-neutral-500">Evidence status: {incident.evidenceStatus || "-"}</span>
              </div>
              <p className="mt-3 text-sm text-neutral-700"><span className="font-semibold">Linked evidence:</span> <ReportLinkedList items={incident.linkedEvidence} /></p>
              <p className={`mt-2 text-sm font-semibold ${incident.remainsUnsupported ? "text-amber-700" : "text-lime-700"}`}>
                {incident.remainsUnsupported ? "Still needs support or verification" : "Supported by linked evidence"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Unlinked / Weak Evidence</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <WeakList title="Not linked to incidents" items={report.unlinkedWeakEvidence.unlinkedEvidence} />
          <WeakList title="Missing functionSummary" items={report.unlinkedWeakEvidence.evidenceMissingFunctionSummary} />
          <WeakList title="No attachments" items={report.unlinkedWeakEvidence.evidenceWithoutAttachments} />
        </div>
      </section>

      <section className="py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Diagnostics</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Unused evidence: <span className="font-semibold">{report.diagnostics.unusedEvidence.length}</span></div>
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Weak evidence links: <span className="font-semibold">{report.diagnostics.weaklyLinkedEvidence.length}</span></div>
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Broken links: <span className="font-semibold">{report.diagnostics.brokenLinks.length}</span></div>
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Unsupported incidents: <span className="font-semibold">{report.diagnostics.unsupportedIncidents.length}</span></div>
        </div>
      </section>
    </article>
  );
}

function WeakList({ title, items = [] }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
      {items.length === 0 ? <p className="mt-2 text-sm text-neutral-600">None.</p> : (
        <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
          {items.map((item) => <li key={item.id}>- {item.title}</li>)}
        </ul>
      )}
    </div>
  );
}
