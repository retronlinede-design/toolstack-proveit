import { formatReportDate, formatReportMoney } from "./reportArticleHelpers.js";
import { GlanceGrid, ReportLinkedList, ReportTypeBadge } from "./ReportArticleShared.jsx";

function ChronologyItem({ item }) {
  return (
    <div key={`${item.recordType}-${item.id}`} className="break-inside-avoid rounded-lg border border-neutral-200 bg-white p-3 print:break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2">
        <ReportTypeBadge recordType={item.recordType} />
        <div className="text-sm font-semibold text-neutral-950">{item.title}</div>
      </div>
      {item.summary ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-700">{item.summary}</p> : null}
    </div>
  );
}

export default function ThreadIssueReportArticle({
  report,
  className = "",
  visibility = { diagnostics: true, documents: true, ledger: true, strategy: true },
}) {
  if (!report) return null;

  const summaryItems = [
    ["Incidents", report.atAGlance?.incidentCount ?? report.threadSummary.incidentCount],
    ["Evidence", report.atAGlance?.evidenceCount ?? report.threadSummary.evidenceCount],
    ["Documents", report.atAGlance?.documentCount ?? report.threadSummary.documentCount],
    ["Ledger", report.atAGlance?.ledgerCount ?? report.threadSummary.ledgerCount],
    ["Unsupported", report.atAGlance?.openUnsupportedIncidentCount ?? report.diagnostics.unsupportedIncidents.length],
    ["Warnings", report.atAGlance?.keyDiagnosticWarningCount ?? report.diagnostics.warnings.length],
  ];
  const diagnosticCards = [
    ["Unsupported incidents", report.diagnostics.unsupportedIncidents.length],
    ["Unused evidence", report.diagnostics.unusedEvidence.length],
    ["Weak links", report.diagnostics.weaklyLinkedRecords.length],
    ["Broken links", report.diagnostics.brokenLinks.length],
    ["Warnings", report.diagnostics.warnings.length],
    ["Suggestions", report.diagnostics.suggestions.length],
  ];
  const diagnosticItems = [
    ...(report.diagnostics?.warnings || []).map((item) => ({ tone: "Warning", ...item })),
    ...(report.diagnostics?.suggestions || []).map((item) => ({ tone: "Suggestion", ...item })),
    ...(report.diagnostics?.brokenLinks || []).map((item) => ({
      tone: "Broken link",
      id: item.edgeId || `${item.sourceId}-${item.targetId}`,
      message: `${item.sourceTitle || item.sourceId} links to missing ${item.targetId}.`,
    })),
  ].slice(0, 12);

  return (
    <article className={className}>
      <header className="border-b border-neutral-200 pb-6 print:pb-5">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">THREAD / ISSUE REPORT</div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-neutral-950 print:text-[22pt]">{report.title}</h1>
            <div className="mt-3 grid gap-1 text-sm text-neutral-600">
              <div><span className="font-semibold text-neutral-950">Case:</span> {report.caseOverview.name || report.sourceCaseId || "Untitled Case"}</div>
              <div><span className="font-semibold text-neutral-950">sequenceGroup:</span> {report.sequenceGroup || "-"}</div>
              <div><span className="font-semibold text-neutral-950">Generated:</span> {formatReportDate(report.generatedAt)}</div>
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 print:bg-white">
            <div><span className="font-semibold text-neutral-900">Audience:</span> {report.audience}</div>
            <div><span className="font-semibold text-neutral-900">Scope:</span> {report.scopeSummary || report.scopeType}</div>
            <div><span className="font-semibold text-neutral-900">Included records:</span> {report.includedRecordIds.length}</div>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Case Overview</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Name</div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">{report.caseOverview.name || "-"}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Category</div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">{report.caseOverview.category || "-"}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Status</div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">{report.caseOverview.status || "-"}</div>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">At a Glance</h2>
        <GlanceGrid items={summaryItems} columnsClass="sm:grid-cols-3 lg:grid-cols-6" />
      </section>

      {visibility.diagnostics && (
        <section className="border-b border-neutral-200 py-6 print:py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Diagnostics</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {diagnosticCards.map(([label, count]) => (
              <div key={label} className="rounded-lg border border-neutral-200 p-3 text-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{label}</div>
                <div className="mt-1 text-xl font-bold text-neutral-950">{count}</div>
              </div>
            ))}
          </div>
          {diagnosticItems.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm leading-6 text-neutral-700">
              {diagnosticItems.map((item, index) => (
                <li key={`${item.id || item.tone}-${index}`}>- <span className="font-semibold">{item.tone}:</span> {item.message}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-neutral-600">No diagnostics warnings for this thread.</p>
          )}
        </section>
      )}

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Thread Chronology</h2>
        {report.chronology.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No dated records are available for this sequence group.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {(report.chronologyGroups || []).map((group) => (
              <div key={group.date} className="break-inside-avoid print:break-inside-avoid">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">{formatReportDate(group.date)}</div>
                <div className="space-y-2">
                  {group.items.map((item) => <ChronologyItem key={`${item.recordType}-${item.id}`} item={item} />)}
                </div>
              </div>
            ))}
            {(report.undatedChronology || []).length > 0 && (
              <div className="break-inside-avoid print:break-inside-avoid">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">Undated Records</div>
                <div className="space-y-2">
                  {report.undatedChronology.map((item) => <ChronologyItem key={`${item.recordType}-${item.id}`} item={item} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Incidents</h2>
        <div className="mt-4 space-y-3">
          {report.incidents.length === 0 ? <p className="text-sm text-neutral-600">No incidents included.</p> : report.incidents.map((incident) => (
            <div key={incident.id} className="break-inside-avoid rounded-lg border border-neutral-200 p-4 print:break-inside-avoid">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-neutral-950">{incident.title}</h3>
                <span className="text-xs font-semibold text-neutral-500">{formatReportDate(incident.eventDate || incident.date)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
                <span className="rounded border border-neutral-200 px-2 py-1">Status: {incident.status || "-"}</span>
                <span className="rounded border border-neutral-200 px-2 py-1">Evidence: {incident.evidenceStatus || "-"}</span>
                <span className="rounded border border-neutral-200 px-2 py-1">Milestone: {incident.isMilestone ? "Yes" : "No"}</span>
                <span className="rounded border border-neutral-200 px-2 py-1">sequenceGroup: {incident.sequenceGroup || "-"}</span>
              </div>
              {incident.summary ? <p className="mt-3 text-sm leading-6 text-neutral-700">{incident.summary}</p> : null}
              <div className="mt-3 rounded-lg border border-lime-100 bg-lime-50 p-3 text-sm text-lime-950 print:bg-white">
                <span className="font-semibold">Linked evidence:</span> <ReportLinkedList items={incident.linkedEvidenceTitles} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-neutral-200 py-6 print:py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Evidence Matrix</h2>
        {report.evidenceMatrix.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">No evidence included.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[760px] rounded-lg border border-neutral-200">
              <div className="grid grid-cols-[1.1fr_1.4fr_1fr_0.8fr_0.9fr] border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500 print:bg-white">
                <div className="p-3">Evidence</div>
                <div className="p-3">What it proves</div>
                <div className="p-3">Linked incidents</div>
                <div className="p-3">Attachments</div>
                <div className="p-3">Status / role</div>
              </div>
              {report.evidenceMatrix.map((evidence) => (
                <div key={evidence.id} className="grid break-inside-avoid grid-cols-[1.1fr_1.4fr_1fr_0.8fr_0.9fr] border-b border-neutral-100 text-sm last:border-b-0 print:break-inside-avoid">
                  <div className="p-3">
                    <div className="font-semibold text-neutral-950">{evidence.title}</div>
                    <div className="mt-1 text-xs text-neutral-500">{formatReportDate(evidence.capturedAt || evidence.date)}</div>
                  </div>
                  <div className="p-3 leading-6 text-neutral-700">{evidence.functionSummary || "-"}</div>
                  <div className="p-3 leading-6 text-neutral-700"><ReportLinkedList items={evidence.linkedIncidentTitles} /></div>
                  <div className="p-3 leading-6 text-neutral-700">{evidence.attachmentCount} {evidence.attachmentNames.length ? evidence.attachmentNames.join(", ") : ""}</div>
                  <div className="p-3 leading-6 text-neutral-700">{evidence.status || "-"} / {evidence.evidenceRole || "-"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {visibility.documents && (
        <section className="border-b border-neutral-200 py-6 print:py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Documents</h2>
          <div className="mt-4 space-y-3">
            {report.documents.length === 0 ? <p className="text-sm text-neutral-600">No documents included.</p> : report.documents.map((document) => (
              <div key={document.id} className="break-inside-avoid rounded-lg border border-neutral-200 p-4 print:break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-neutral-950">{document.title}</h3>
                  <span className="text-xs font-semibold text-neutral-500">{formatReportDate(document.documentDate)}</span>
                </div>
                <div className="mt-2 text-xs text-neutral-500">Category: {document.category || "-"}</div>
                {document.summary ? <p className="mt-3 text-sm leading-6 text-neutral-700">{document.summary}</p> : null}
                <p className="mt-3 text-sm text-neutral-600">Linked records: <ReportLinkedList items={document.linkedRecords} /></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {visibility.ledger && report.ledger.length > 0 && (
        <section className="border-b border-neutral-200 py-6 print:py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Ledger</h2>
          <div className="mt-4 space-y-3">
            {report.ledger.map((entry) => (
              <div key={entry.id} className="break-inside-avoid rounded-lg border border-neutral-200 p-4 print:break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-neutral-950">{entry.label}</h3>
                  <span className="text-xs font-semibold text-neutral-500">{entry.period || "-"}</span>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-neutral-700 sm:grid-cols-4">
                  <div>Expected: {formatReportMoney(entry.expectedAmount)}</div>
                  <div>Paid: {formatReportMoney(entry.paidAmount)}</div>
                  <div>Difference: {formatReportMoney(entry.differenceAmount)}</div>
                  <div>Status: {entry.status || "-"}</div>
                </div>
                <p className="mt-3 text-sm text-neutral-600">Linked records: <ReportLinkedList items={entry.linkedRecords} /></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {visibility.strategy && (
        <section className="py-6 print:py-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Open Questions / Next Actions</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Open Questions</h3>
              {report.openQuestions.length === 0 ? <p className="mt-2 text-sm text-neutral-600">No open questions derived.</p> : (
                <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
                  {report.openQuestions.map((item) => <li key={item.id}>- {item.title}</li>)}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Next Actions</h3>
              {report.nextActions.length === 0 ? <p className="mt-2 text-sm text-neutral-600">No next actions derived.</p> : (
                <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
                  {report.nextActions.map((item, index) => <li key={`${item.source}-${item.id || index}`}>- {item.text}</li>)}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
