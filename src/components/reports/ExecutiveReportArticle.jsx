import "./ExecutiveReportArticle.css";
import {
  ReportDocumentFooter, ReportDocumentHeader, ReportDocumentSection, ReportDocumentShell,
} from "./document/index.js";

function section(document, id) { return (document?.sections || []).find((item) => item.id === id) || {}; }
function display(value, fallback = "Not recorded") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function shortFingerprint(value) { const fingerprint = String(value || ""); return fingerprint ? `${fingerprint.slice(0, 12)}${fingerprint.length > 12 ? "…" : ""}` : "Unavailable"; }

function Reference({ sourceReference }) {
  return sourceReference ? <p className="executive-report-reference"><strong>Source record</strong> {sourceReference.label}</p> : null;
}

function RecordList({ items = [], empty }) {
  return items.length ? <ul className="executive-report-list">{items.map((item) => <li key={item.id} className="executive-report-entry"><p className="executive-report-entry-title">{item.title || item.text}</p>{item.summary || item.functionSummary ? <p className="executive-report-entry-summary">{item.summary || item.functionSummary}</p> : null}<p className="executive-report-classification">{item.classification}</p><Reference sourceReference={item.sourceReference} /></li>)}</ul> : <p className="executive-report-empty">{empty}</p>;
}

export default function ExecutiveReportArticle({ reportDocument }) {
  if (!reportDocument) return null;
  const presentation = reportDocument.presentation || {}; const summary = reportDocument.summary || {}; const issue = summary.issue;
  const overview = section(reportDocument, "issue-overview"); const findings = section(reportDocument, "key-findings"); const interpretations = section(reportDocument, "recorded-interpretations"); const evidence = section(reportDocument, "supporting-evidence"); const unresolved = section(reportDocument, "contradictions-and-questions"); const actions = section(reportDocument, "recommended-next-steps");
  const sourceRevision = reportDocument.source?.sourceRevision?.fingerprint || "";
  return <ReportDocumentShell
    data-report-document="executive"
    className="proveit-executive-report"
    header={<ReportDocumentHeader className="executive-report-header" title="Executive Report" subtitle={issue?.displayLabel || summary.scopeLabel} caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} issueReference={issue?.reference} issueName={issue?.name} generatedAt={reportDocument.report?.generatedAt} version={presentation.version} documentStatus={presentation.documentStatus} confidentiality={presentation.confidentiality} preparedBy={presentation.preparedBy} approvedBy={presentation.approvedBy} />}
    footer={<ReportDocumentFooter className="executive-report-footer" reportTitle="Executive Report" caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} issueReference={issue?.reference} version={presentation.version} documentStatus={presentation.documentStatus} confidentiality={presentation.confidentiality} />}
  >
    <ReportDocumentSection id="issue-overview" title="Executive Summary" className="executive-report-section executive-report-summary"><p>{overview.text}</p>{issue ? <dl className="executive-report-issue-facts"><div><dt>Issue</dt><dd>{issue.displayLabel}</dd></div><div><dt>Status</dt><dd>{display(issue.status)}</dd></div><div><dt>Priority</dt><dd>{display(issue.priority)}</dd></div><div><dt>Purpose</dt><dd>{display(issue.purpose)}</dd></div></dl> : null}{interpretations.items?.length ? <section className="executive-report-current-position" aria-labelledby="executive-current-position-heading"><h3 id="executive-current-position-heading">Recorded current position</h3><RecordList items={interpretations.items} empty="No user-authored current position is recorded." /></section> : null}</ReportDocumentSection>
    <ReportDocumentSection id="key-findings" title="Key Findings" description="Recorded material only. An Incident is not independently established merely because it appears in this report." className="executive-report-section"><RecordList items={findings.items || []} empty="No directly scoped Incident or Document records are available." /></ReportDocumentSection>
    <ReportDocumentSection id="supporting-evidence" title="Supporting Evidence" description={evidence.metadata?.selectionNote} className="executive-report-section"><RecordList items={evidence.items || []} empty="No directly scoped Evidence records are available." /></ReportDocumentSection>
    <ReportDocumentSection id="contradictions-and-questions" title="Unresolved Matters" className="executive-report-section"><p className="executive-report-limitation">{unresolved.metadata?.contradictionNote}</p>{(unresolved.groups || []).map((group) => <section key={group.id} className="executive-report-unresolved-group"><h3>{group.label}</h3><RecordList items={group.items || []} empty={group.id === "contradictions" ? "No structured contradiction records are available." : "None recorded."} /></section>)}</ReportDocumentSection>
    <ReportDocumentSection id="recommended-next-steps" title="Recorded Next Actions" description={actions.metadata?.limitation} className="executive-report-section"><RecordList items={actions.items || []} empty="No structured next steps or review dates are recorded." /></ReportDocumentSection>
    <ReportDocumentSection id="source-notes" title="Source Notes and Document Control" className="executive-report-section executive-report-control"><p>Each source record above identifies material represented in this summary. A record reference does not independently prove an assertion, and original attachment contents are not reproduced.</p><dl><div><dt>Scope</dt><dd>{presentation.scope || summary.scopeLabel || "Not recorded"}</dd></div><div><dt>Document status</dt><dd>{presentation.documentStatus || "Draft"}</dd></div><div><dt>Generated</dt><dd>{reportDocument.report?.generatedAt || "Not recorded"}</dd></div><div><dt>Source revision</dt><dd title={sourceRevision}>{shortFingerprint(sourceRevision)}</dd></div></dl>{(reportDocument.notices || []).map((notice) => <p key={notice.code} className="executive-report-notice"><strong>{notice.code.replaceAll("_", " ")}:</strong> {notice.message}</p>)}</ReportDocumentSection>
  </ReportDocumentShell>;
}
