import { formatReportDate } from "./reportArticleHelpers.js";
import { GlanceGrid, ReportLinkedList } from "./ReportArticleShared.jsx";

function WeakDocumentList({ title, items }) {
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

export default function DocumentPackReportArticle({ report, className = "" }) {
  if (!report) return null;

  const glanceItems = [
    ["Documents", report.atAGlance.documentCount],
    ["Linked", report.atAGlance.linkedDocumentCount],
    ["Unlinked", report.atAGlance.unlinkedDocumentCount],
    ["Linked Incidents", report.atAGlance.linkedIncidentCount],
    ["Linked Evidence", report.atAGlance.linkedEvidenceCount],
    ["With Attachments", report.atAGlance.documentWithAttachmentsCount],
    ["With Text", report.atAGlance.documentWithTextCount],
    ["Missing Summary", report.atAGlance.documentMissingSummaryCount],
  ];

  return (
    <article className={className}>
      <header className="border-b border-neutral-200 pb-6 print:pb-5">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">DOCUMENT PACK REPORT</div>
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
            <div><span className="font-semibold text-neutral-900">Documents included:</span> {report.includedDocumentCount}</div>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">At a Glance</h2>
        <GlanceGrid items={glanceItems} columnsClass="sm:grid-cols-4 lg:grid-cols-8" />
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Document Matrix</h2>
        {report.documentMatrix.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No documents are included in this scope.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[1040px] rounded-lg border border-neutral-200">
              <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr_1.3fr_0.9fr_1.4fr_1fr] border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500 print:bg-white">
                <div className="p-3">Document</div>
                <div className="p-3">Dates</div>
                <div className="p-3">sequenceGroup</div>
                <div className="p-3">Linked records</div>
                <div className="p-3">Attachments</div>
                <div className="p-3">Text excerpt</div>
                <div className="p-3">Summary / notes</div>
              </div>
              {report.documentMatrix.map((document) => (
                <div key={document.id} className="grid break-inside-avoid grid-cols-[1.1fr_0.9fr_0.9fr_1.3fr_0.9fr_1.4fr_1fr] border-b border-neutral-100 text-sm last:border-b-0 print:break-inside-avoid">
                  <div className="p-3">
                    <div className="font-semibold text-neutral-950">{document.title}</div>
                    <div className="mt-1 text-xs text-neutral-500">{document.category || "-"}</div>
                  </div>
                  <div className="p-3 leading-6 text-neutral-700">
                    <div>Doc: {formatReportDate(document.documentDate || document.date)}</div>
                    <div>Created: {formatReportDate(document.createdAt)}</div>
                    <div>Updated: {formatReportDate(document.updatedAt)}</div>
                  </div>
                  <div className="p-3 leading-6 text-neutral-700">{document.sequenceGroup || "-"}</div>
                  <div className="p-3 leading-6 text-neutral-700"><ReportLinkedList items={document.linkedRecords} /></div>
                  <div className="p-3 leading-6 text-neutral-700">{document.attachmentCount} {document.attachmentNames.length ? document.attachmentNames.join(", ") : ""}</div>
                  <div className="p-3 leading-6 text-neutral-700">{document.textExcerpt || "-"}</div>
                  <div className="p-3 leading-6 text-neutral-700">{document.summary || document.notes || document.functionSummary || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Linked Incident / Evidence Support</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-4">
            <h3 className="text-sm font-semibold text-neutral-950">Incidents linked by documents</h3>
            {report.supportSummary.linkedIncidents.length === 0 ? <p className="mt-2 text-sm text-neutral-600">None.</p> : (
              <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
                {report.supportSummary.linkedIncidents.map((incident) => (
                  <li key={incident.id}>- {incident.title}: <ReportLinkedList items={incident.documents} /></li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <h3 className="text-sm font-semibold text-neutral-950">Evidence linked by documents</h3>
            {report.supportSummary.linkedEvidence.length === 0 ? <p className="mt-2 text-sm text-neutral-600">None.</p> : (
              <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
                {report.supportSummary.linkedEvidence.map((evidence) => (
                  <li key={evidence.id}>- {evidence.title}: <ReportLinkedList items={evidence.documents} /></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Unlinked / Weak Documents</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <WeakDocumentList title="Unlinked" items={report.unlinkedWeakDocuments.unlinkedDocuments} />
          <WeakDocumentList title="Missing summary" items={report.unlinkedWeakDocuments.documentsMissingSummary} />
          <WeakDocumentList title="No attachments" items={report.unlinkedWeakDocuments.documentsWithoutAttachments} />
          <WeakDocumentList title="No text" items={report.unlinkedWeakDocuments.documentsWithoutText} />
        </div>
      </section>

      <section className="py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Diagnostics</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Orphan documents: <span className="font-semibold">{report.diagnostics.orphanDocuments.length}</span></div>
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Weak documents: <span className="font-semibold">{report.diagnostics.weaklyLinkedDocuments.length}</span></div>
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">Broken links: <span className="font-semibold">{report.diagnostics.brokenLinks.length}</span></div>
        </div>
      </section>
    </article>
  );
}
