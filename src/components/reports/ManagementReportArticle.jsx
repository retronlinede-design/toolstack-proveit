import "./ManagementReportArticle.css";
import {
  ReportDocumentAppendix, ReportDocumentFooter, ReportDocumentHeader,
  ReportDocumentSection, ReportDocumentShell, ReportDocumentStatistics,
} from "./document/index.js";

function getSection(document, id) { return (document?.sections || []).find((item) => item.id === id) || {}; }
function display(value, fallback = "Not recorded") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function human(value) { return display(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function shortFingerprint(value) { const fingerprint = String(value || ""); return fingerprint ? `${fingerprint.slice(0, 12)}${fingerprint.length > 12 ? "…" : ""}` : "Unavailable"; }
function Empty({ children }) { return <p className="management-report-empty">{children}</p>; }

function FindingList({ items = [], empty = "No deterministic items are recorded in this section." }) {
  return items.length ? <ul className="management-report-list">{items.map((item, index) => <li key={item.id || `${item.code || "item"}-${index}`} className="management-report-entry"><p className="management-report-entry-title">{item.message || item.decision || item.action || item.title}</p>{item.source || item.code || item.dueDate ? <p className="management-report-reference"><strong>Recorded source</strong> {[item.source || item.code, item.dueDate && `Due ${item.dueDate}`].filter(Boolean).join(" · ")}</p> : null}</li>)}</ul> : <Empty>{empty}</Empty>;
}

function IssueRows({ items = [] }) {
  if (!items.length) return <Empty>No Issues are recorded for management review.</Empty>;
  return <div className="management-report-issues">{items.map((issue) => <section key={issue.id} aria-labelledby={`management-${issue.id}-heading`} className="management-report-issue"><div className="management-report-issue-heading"><div><h3 id={`management-${issue.id}-heading`}>{issue.displayLabel}</h3><p>{issue.purpose || "No Issue purpose is recorded."}</p></div><div className="management-report-badges"><span>Priority: {human(issue.priority)}</span><span>Status: {human(issue.status)}</span></div></div>{issue.currentPosition ? <div className="management-report-current-position"><h4>Recorded current position</h4><p>{issue.currentPosition}</p></div> : null}<dl className="management-report-issue-facts"><div><dt>Owner</dt><dd>{issue.owner}</dd></div><div><dt>Review date</dt><dd>{display(issue.reviewDate)}</dd></div><div><dt>Latest activity</dt><dd>{display(issue.latestActivity)}</dd></div><div><dt>Outstanding findings</dt><dd>{issue.outstandingFindingCount}</dd></div></dl></section>)}</div>;
}

function AppendixContent({ appendix }) {
  if (appendix.type === "issue-summary") return <IssueRows items={appendix.items} />;
  if (appendix.type === "chronology") return <div className="management-report-chronology">{appendix.groups.map((group) => <section key={group.id}><h3>{group.label}</h3><ol>{(group.entries || []).map((entry) => <li key={`${entry.recordType}:${entry.recordId}`}><strong>{entry.date || human(entry.dateStatus)}</strong> — {entry.title} <span>({human(entry.recordType)})</span></li>)}</ol></section>)}</div>;
  if (appendix.type === "strategy") return <FindingList items={appendix.items.map((item) => ({ ...item, message: item.title, source: [item.issueLabel, item.status, item.reviewDate && `Review ${item.reviewDate}`].filter(Boolean).join(" · ") }))} />;
  if (appendix.type === "reference-index") return <div className="management-report-reference-index"><table><caption>Technical record identifiers are secondary references.</caption><thead><tr><th scope="col">Type</th><th scope="col">Title</th><th scope="col">Reference</th></tr></thead><tbody>{appendix.items.map((item) => <tr key={`${item.recordType}:${item.recordId}`}><td>{human(item.recordType)}</td><td>{item.title}</td><td>{item.recordId}</td></tr>)}</tbody></table></div>;
  return <FindingList items={appendix.items || []} />;
}

export default function ManagementReportArticle({ reportDocument }) {
  if (!reportDocument) return <div className="rounded-xl border border-dashed border-neutral-300 p-5 dark:border-neutral-700"><Empty>No Management Report document is available.</Empty></div>;
  const presentation = reportDocument.presentation || {};
  const executive = getSection(reportDocument, "executive-summary"); const current = getSection(reportDocument, "current-position"); const snapshot = getSection(reportDocument, "management-snapshot"); const issues = getSection(reportDocument, "major-issues"); const risks = getSection(reportDocument, "current-risks"); const progress = getSection(reportDocument, "progress"); const outstanding = getSection(reportDocument, "outstanding-matters"); const decisions = getSection(reportDocument, "management-decisions"); const actions = getSection(reportDocument, "next-actions");
  const sourceRevision = reportDocument.source?.sourceRevision?.fingerprint || "";
  return <ReportDocumentShell
    aria-label="Management Report"
    data-report-document="management"
    className="proveit-management-report"
    header={<ReportDocumentHeader className="management-report-header" title="Management Report" subtitle="Current case briefing" caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} generatedAt={reportDocument.report?.generatedAt} version={presentation.version} documentStatus={presentation.documentStatus} confidentiality={presentation.confidentiality} preparedBy={presentation.preparedBy} approvedBy={presentation.approvedBy} />}
    footer={<ReportDocumentFooter className="management-report-footer" reportTitle="Management Report" caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} version={presentation.version} documentStatus={presentation.documentStatus} confidentiality={presentation.confidentiality} />}
  >
    <ReportDocumentSection id="executive-summary" title="Management Overview" className="management-report-section management-report-summary"><p>{executive.text}</p><p className="management-report-limitation">This is a concise management briefing of structured case information. It does not replace the complete Investigation Report.</p></ReportDocumentSection>
    <ReportDocumentSection id="current-position" title="Current Position and Outstanding Issues" description="Current-position text is user-authored Issue metadata, not an automated conclusion." className="management-report-section"><p className="management-report-case-status"><strong>Case status</strong> {human(current.metadata?.caseStatus)}</p><IssueRows items={current.items || []} /></ReportDocumentSection>
    <ReportDocumentSection id="management-snapshot" title="Management Snapshot" className="management-report-section"><ReportDocumentStatistics className="management-report-statistics" columns={3} items={Object.entries(snapshot.metadata || {}).map(([key, value]) => ({ key, label: human(key.replace(/([A-Z])/g, " $1")), value }))} /></ReportDocumentSection>
    <ReportDocumentSection id="major-issues" title="Key Recorded Matters" description="Issues are ordered by recorded priority, review date, and human reference." className="management-report-section"><IssueRows items={issues.items || []} /></ReportDocumentSection>
    <ReportDocumentSection id="current-risks" title="Current Risks" description="Deterministic structural risks only; no legal or operational conclusions are inferred." className="management-report-section"><FindingList items={risks.items || []} empty="No critical or warning-level structural risks are currently detected. This does not establish factual or legal completeness." /></ReportDocumentSection>
    <ReportDocumentSection id="progress" title="Progress Since Previous Review" className="management-report-section"><p className="management-report-limitation">{progress.metadata?.limitation}</p><p className="management-report-period">{progress.metadata?.period}</p><FindingList items={(progress.items || []).map((item) => ({ ...item, message: `${human(item.type)}: ${item.title}`, source: item.loggedDate ? `Logged ${item.loggedDate}` : "Logged date unavailable" }))} empty="No records with logged dates in the recent activity window were identified." /></ReportDocumentSection>
    <ReportDocumentSection id="outstanding-matters" title="Outstanding Matters" className="management-report-section">{(outstanding.groups || []).map((group) => <section key={group.id} className="management-report-group" aria-labelledby={`outstanding-${group.id}`}><h3 id={`outstanding-${group.id}`}>{group.label}</h3><FindingList items={group.items || []} empty={`No ${group.label.toLowerCase()} matters are deterministically identified.`} /></section>)}</ReportDocumentSection>
    <ReportDocumentSection id="management-decisions" title="Management Decisions Required" className="management-report-section"><FindingList items={decisions.items || []} empty="No structured management decision requirement is currently recorded. This does not mean that no decision is needed." /></ReportDocumentSection>
    <ReportDocumentSection id="next-actions" title="Recorded Actions and Follow-up" className="management-report-section">{(actions.groups || []).map((group) => <section key={group.id} className="management-report-group" aria-labelledby={`actions-${group.id}`}><h3 id={`actions-${group.id}`}>{group.label}</h3><FindingList items={group.items || []} empty={`No ${group.label.toLowerCase()} actions are recorded.`} /></section>)}</ReportDocumentSection>
    {(reportDocument.appendices || []).map((appendix) => <ReportDocumentAppendix key={appendix.id} className="management-report-appendix" id={appendix.id} label={appendix.label} title={appendix.title}><AppendixContent appendix={appendix} /></ReportDocumentAppendix>)}
    <ReportDocumentSection id="source-notes" title="Source Notes and Document Control" className="management-report-section management-report-control"><p>References identify the recorded source material used in this briefing. They do not independently establish an assertion, and original attachment contents are not reproduced.</p><dl><div><dt>Scope</dt><dd>{presentation.scope || "Whole case"}</dd></div><div><dt>Document status</dt><dd>{presentation.documentStatus || "Draft"}</dd></div><div><dt>Generated</dt><dd>{reportDocument.report?.generatedAt || "Not recorded"}</dd></div><div><dt>Source revision</dt><dd title={sourceRevision}>{shortFingerprint(sourceRevision)}</dd></div></dl>{(reportDocument.notices || []).map((notice) => <p key={notice.code} className="management-report-notice"><strong>{notice.code.replaceAll("_", " ")}:</strong> {notice.message}</p>)}</ReportDocumentSection>
  </ReportDocumentShell>;
}
