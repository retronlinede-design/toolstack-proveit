import { useState } from "react";
import "./ManagementReportArticle.css";
import {
  ReportDocumentAppendix, ReportDocumentFooter, ReportDocumentHeader,
  ReportDocumentSection, ReportDocumentShell, ReportDocumentStatistics,
} from "./document/index.js";

function getSection(document, id) { return (document?.sections || []).find((item) => item.id === id) || {}; }
function display(value, fallback = "Not recorded") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function human(value) { return display(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function shortFingerprint(value) { const fingerprint = String(value || ""); return fingerprint ? `${fingerprint.slice(0, 12)}${fingerprint.length > 12 ? "…" : ""}` : "Unavailable"; }
function stableItemKey(item, index) { return item?.id ? `id:${item.id}` : item?.recordType && item?.recordId ? `record:${item.recordType}:${item.recordId}` : item?.sourceId ? `source:${item.sourceId}` : item?.code ? `code:${item.code}:${index}` : `position:${index}`; }
function uniqueByStableIdentity(items = []) { const seen = new Set(); return items.filter((item, index) => { const key = stableItemKey(item, index); if (seen.has(key)) return false; seen.add(key); return true; }); }
function Empty({ children }) { return <p className="management-report-empty">{children}</p>; }

function resolveReference(item, recordIndex) {
  const recordId = item?.recordId || item?.sourceId;
  const record = recordId ? recordIndex.get(recordId) : null;
  if (record) return { key: `record:${record.recordType}:${record.recordId}`, label: `${human(record.recordType)} · ${record.title}`, detail: record.recordId };
  if (item?.issueLabel) return { key: `issue:${item.issueLabel}`, label: `Issue · ${item.issueLabel}`, detail: "" };
  if (item?.source || item?.code) return { key: `source:${item.source || item.code}`, label: item.source || item.code, detail: "" };
  return null;
}

function FindingList({ items = [], recordIndex, empty = "No recorded matters require attention in this section." }) {
  return items.length ? <ul className="management-report-list">{items.map((item, index) => { const reference = resolveReference(item, recordIndex); return <li key={stableItemKey(item, index)} className="management-report-entry"><p className="management-report-entry-title">{item.message || item.decision || item.action || item.title}</p>{reference ? <p className="management-report-reference"><strong>Supporting reference</strong> {reference.label}{reference.detail ? ` · ${reference.detail}` : ""}{item.dueDate ? ` · Due ${item.dueDate}` : ""}</p> : item.dueDate ? <p className="management-report-reference"><strong>Due</strong> {item.dueDate}</p> : null}</li>; })}</ul> : <Empty>{empty}</Empty>;
}

function CurrentPositions({ items = [] }) {
  if (!items.length) return null;
  return <div className="management-report-positions">{items.map((issue) => <section key={issue.id} className="management-report-position" aria-labelledby={`management-position-${issue.id}`}><h3 id={`management-position-${issue.id}`}>{issue.displayLabel}</h3><p>{issue.currentPosition || issue.purpose || "No current position is recorded."}</p><dl><div><dt>Status</dt><dd>{human(issue.status)}</dd></div><div><dt>Priority</dt><dd>{human(issue.priority)}</dd></div>{issue.reviewDate ? <div><dt>Review date</dt><dd>{issue.reviewDate}</dd></div> : null}</dl></section>)}</div>;
}

function IssueRows({ items = [] }) {
  if (!items.length) return <Empty>No Issues are recorded for management review.</Empty>;
  return <div className="management-report-issues">{items.map((issue) => <section key={issue.id} aria-labelledby={`management-${issue.id}-heading`} className="management-report-issue"><div className="management-report-issue-heading"><div><h3 id={`management-${issue.id}-heading`}>{issue.displayLabel}</h3><p>{issue.purpose || "No Issue purpose is recorded."}</p></div><div className="management-report-badges"><span>Priority: {human(issue.priority)}</span><span>Status: {human(issue.status)}</span></div></div>{issue.currentPosition ? <div className="management-report-current-position"><h4>Recorded current position</h4><p>{issue.currentPosition}</p></div> : null}<dl className="management-report-issue-facts"><div><dt>Owner</dt><dd>{issue.owner}</dd></div><div><dt>Review date</dt><dd>{display(issue.reviewDate)}</dd></div><div><dt>Latest activity</dt><dd>{display(issue.latestActivity)}</dd></div><div><dt>Outstanding findings</dt><dd>{issue.outstandingFindingCount}</dd></div></dl></section>)}</div>;
}

function AppendixContent({ appendix }) {
  if (appendix.type === "issue-summary") return <IssueRows items={appendix.items} />;
  if (appendix.type === "chronology") return <div className="management-report-chronology">{appendix.groups.map((group) => <section key={group.id}><h3>{group.label}</h3><ol>{(group.entries || []).map((entry) => <li key={`${entry.recordType}:${entry.recordId}`}><strong>{entry.date || human(entry.dateStatus)}</strong> — {entry.title} <span>({human(entry.recordType)})</span></li>)}</ol></section>)}</div>;
  if (appendix.type === "strategy") return <FindingList items={appendix.items.map((item) => ({ ...item, message: item.title, source: [item.issueLabel, item.status, item.reviewDate && `Review ${item.reviewDate}`].filter(Boolean).join(" · ") }))} recordIndex={new Map()} />;
  if (appendix.type === "reference-index") return <div className="management-report-reference-index"><table><caption>Technical record identifiers are secondary references.</caption><thead><tr><th scope="col">Type</th><th scope="col">Title</th><th scope="col">Reference</th></tr></thead><tbody>{appendix.items.map((item) => <tr key={`${item.recordType}:${item.recordId}`}><td>{human(item.recordType)}</td><td>{item.title}</td><td>{item.recordId}</td></tr>)}</tbody></table></div>;
  return <FindingList items={appendix.items || []} recordIndex={new Map()} />;
}

function SupportingReferences({ items, recordIndex }) {
  const references = [...new Map(items.map((item) => resolveReference(item, recordIndex)).filter(Boolean).map((reference) => [reference.key, reference])).values()];
  if (!references.length) return null;
  return <ReportDocumentSection id="supporting-references" title="Supporting References" className="management-report-section"><p className="management-report-section-intro">These compact references identify material cited in the management briefing. The detailed record index remains available in the optional appendices.</p><ul className="management-report-supporting-references">{references.map((reference) => <li key={reference.key}>{reference.label}{reference.detail ? <span> · {reference.detail}</span> : null}</li>)}</ul></ReportDocumentSection>;
}

function AiDraftReferences({ references = [] }) {
  if (!references.length) return <p className="management-report-reference">No source references were supplied for this AI-authored item.</p>;
  return <ul className="management-report-supporting-references">{references.map((reference) => <li key={`${reference.recordType}:${reference.recordId}:${reference.technicalSourceId}:${reference.scopeRelation}`}><strong>{human(reference.scopeRelation)}</strong> · {human(reference.recordType)} · {reference.recordId} · {reference.technicalSourceId}{reference.issueId ? ` · Issue ${reference.issueId}` : ""}</li>)}</ul>;
}

function AiDraftClaim({ claim }) {
  return <article className="management-report-entry"><p className="management-report-entry-title"><span className="management-ai-draft-classification">{human(claim.classification)}</span> {claim.text}</p><AiDraftReferences references={claim.sourceReferences} /></article>;
}

function managementAiLifecycleLabel(status) {
  if (status === "approved") return "Approved historical snapshot";
  if (status === "in_review") return "In human review";
  return "AI Draft — not approved";
}

function ManagementAiDraftPreviewArticle({ reportDocument }) {
  const preview = reportDocument.aiDraftPreview;
  const scope = reportDocument.source?.scope || {};
  const lifecycle = reportDocument.historicalLifecycle || null;
  const lifecycleLabel = managementAiLifecycleLabel(lifecycle?.status);
  const freshness = preview.freshness === "current" ? "Current source Brief" : preview.freshness === "stale" ? "Historical Brief — stale against current case" : "Historical Brief — source freshness unknown";
  return <ReportDocumentShell
    aria-label="Management AI Draft preview"
    data-report-document="management-ai-draft-preview"
    className="proveit-management-report proveit-management-ai-draft-preview"
    header={<ReportDocumentHeader className="management-report-header" title="Management Report" subtitle="AI-authored draft preview — human review required" caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} issueReference={scope.issueReference} issueName={scope.issueName} generatedAt={reportDocument.report?.generatedAt} documentStatus={lifecycleLabel} confidentiality={reportDocument.presentation?.confidentiality} />}
    footer={<ReportDocumentFooter className="management-report-footer" reportTitle="Management Report — AI Draft preview" caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} issueReference={scope.issueReference} sourceRevision={preview.sourceFingerprint} documentStatus={lifecycleLabel} />}
  >
    <ReportDocumentSection id="ai-draft-status" title="Preview status" className="management-report-section management-report-summary"><p>This is a presentation-only preview of validated AI-authored narrative. Structural validation and source references do not establish that claims are true, verified, approved, or ready to share.</p><p className="management-report-limitation"><strong>Source status:</strong> {freshness}. The ordinary live Management Report has not been replaced.</p></ReportDocumentSection>
    {preview.sections.map((section) => <ReportDocumentSection key={section.id} id={`ai-draft-${section.id}`} title={section.heading} className="management-report-section"><p>{section.narrative}</p>{section.claims.length ? <div className="management-report-list">{section.claims.map((claim) => <AiDraftClaim key={claim.id} claim={claim} />)}</div> : <Empty>No individual claims were assigned to this AI-authored section.</Empty>}</ReportDocumentSection>)}
    <ReportDocumentSection id="ai-draft-unresolved" title="Unresolved Questions and Evidence Gaps" className="management-report-section"><h3>Unresolved questions</h3><FindingList items={preview.unresolvedQuestions.map((item) => ({ ...item, message: item.text }))} recordIndex={new Map()} empty="No unresolved questions were supplied." /><h3 className="mt-6">Evidence gaps</h3><FindingList items={preview.evidenceGaps.map((item) => ({ ...item, message: item.text }))} recordIndex={new Map()} empty="No evidence gaps were supplied." /></ReportDocumentSection>
    <ReportDocumentSection id="ai-draft-recommendations" title="Recommended Actions" description="AI-generated recommendations require human review before use." className="management-report-section"><FindingList items={preview.recommendations.map((item) => ({ ...item, message: item.text }))} recordIndex={new Map()} empty="No recommendations were supplied." /></ReportDocumentSection>
    <ReportDocumentSection id="ai-draft-source-notes" title="Source Notes and Human Review" className="management-report-section management-report-control"><p>Canonical record IDs and supplied source references are retained for review. A reference identifies recorded material; it is not proof of the associated AI-authored statement.</p><ValidationList title="Validation warnings" entries={preview.warnings} /><ValidationList title="Human-review requirements" entries={preview.reviewReasons.map((message) => ({ code: "REVIEW_REQUIRED", message }))} /><dl><div><dt>Scope</dt><dd>{reportDocument.presentation?.scope || "Whole case"}</dd></div><div><dt>Source revision</dt><dd>{preview.sourceRevision || "Unknown"}</dd></div><div><dt>Source fingerprint</dt><dd>{shortFingerprint(preview.sourceFingerprint)}</dd></div>{lifecycle ? <><div><dt>Lifecycle</dt><dd>{lifecycleLabel}</dd></div>{lifecycle.review?.reviewedBy ? <div><dt>Reviewed by</dt><dd>{lifecycle.review.reviewedBy}</dd></div> : null}{lifecycle.review?.approvedBy ? <div><dt>Approved by</dt><dd>{lifecycle.review.approvedBy}</dd></div> : null}</> : null}</dl></ReportDocumentSection>
  </ReportDocumentShell>;
}

function ValidationList({ title, entries = [] }) {
  if (!entries.length) return null;
  return <section className="mt-4"><h3>{title}</h3><ul className="management-report-list">{entries.map((entry, index) => <li className="management-report-entry" key={`${entry.code || title}-${index}`}>{entry.code ? <strong>{entry.code}: </strong> : null}{entry.message || entry}</li>)}</ul></section>;
}

export default function ManagementReportArticle({ reportDocument }) {
  const [showDetails, setShowDetails] = useState(false);
  if (!reportDocument) return <div className="rounded-xl border border-dashed border-neutral-300 p-5 dark:border-neutral-700"><Empty>No Management Report document is available.</Empty></div>;
  if (reportDocument.kind === "management-ai-draft-preview") return <ManagementAiDraftPreviewArticle reportDocument={reportDocument} />;
  const presentation = reportDocument.presentation || {};
  const executive = getSection(reportDocument, "executive-summary"); const current = getSection(reportDocument, "current-position"); const snapshot = getSection(reportDocument, "management-snapshot"); const issues = getSection(reportDocument, "major-issues"); const risks = getSection(reportDocument, "current-risks"); const progress = getSection(reportDocument, "progress"); const outstanding = getSection(reportDocument, "outstanding-matters"); const decisions = getSection(reportDocument, "management-decisions"); const actions = getSection(reportDocument, "next-actions");
  const referenceAppendix = (reportDocument.appendices || []).find((appendix) => appendix.type === "reference-index");
  const recordIndex = new Map((referenceAppendix?.items || []).map((item) => [item.recordId, item]));
  const attention = uniqueByStableIdentity([...(risks.items || []), ...(outstanding.groups || []).flatMap((group) => group.items || [])]);
  const actionAndDecisions = uniqueByStableIdentity([...(decisions.items || []), ...(actions.groups || []).flatMap((group) => group.items || [])]);
  const mainReferences = [...attention, ...actionAndDecisions];
  const compactStatistics = [
    ["activeIssues", "Active Issues"], ["outstandingReviews", "Outstanding Reviews"], ["auditFindings", "Audit Findings"], ["openIncidents", "Open Incidents"],
  ].map(([key, label]) => ({ key, label, value: snapshot.metadata?.[key] ?? 0 }));
  const sourceRevision = reportDocument.source?.sourceRevision?.fingerprint || "";
  return <ReportDocumentShell
    aria-label="Management Report"
    data-report-document="management"
    className="proveit-management-report"
    header={<ReportDocumentHeader className="management-report-header" title="Management Report" subtitle="Current case briefing" caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} generatedAt={reportDocument.report?.generatedAt} version={presentation.version} documentStatus={presentation.documentStatus} confidentiality={presentation.confidentiality} preparedBy={presentation.preparedBy} approvedBy={presentation.approvedBy} />}
    footer={<ReportDocumentFooter className="management-report-footer" reportTitle="Management Report" caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} version={presentation.version} documentStatus={presentation.documentStatus} confidentiality={presentation.confidentiality} />}
  >
    <ReportDocumentSection id="executive-summary" title="Management Overview" className="management-report-section management-report-summary"><p>{executive.text}</p><ReportDocumentStatistics className="management-report-statistics" columns={2} items={compactStatistics} /><p className="management-report-limitation">This is a concise management briefing of structured case information. It does not replace the complete Investigation Report.</p></ReportDocumentSection>
    {current.items?.length ? <ReportDocumentSection id="current-position" title="Current Position" description="Current-position text is user-authored Issue metadata, not an automated conclusion." className="management-report-section"><p className="management-report-case-status"><strong>Case status</strong> {human(current.metadata?.caseStatus)}</p><CurrentPositions items={current.items} /></ReportDocumentSection> : null}
    {attention.length ? <ReportDocumentSection id="matters-requiring-attention" title="Matters Requiring Attention" description="Recorded structural risks and outstanding matters are shown once each." className="management-report-section"><FindingList items={attention} recordIndex={recordIndex} /></ReportDocumentSection> : null}
    {actionAndDecisions.length ? <ReportDocumentSection id="outstanding-actions-and-decisions" title="Outstanding Actions and Decisions" description="Recorded decisions and follow-up actions are combined to avoid duplicate review entries." className="management-report-section"><FindingList items={actionAndDecisions} recordIndex={recordIndex} /></ReportDocumentSection> : null}
    <SupportingReferences items={mainReferences} recordIndex={recordIndex} />
    <section className="management-report-details print:hidden" aria-label="Detailed appendices">
      <button type="button" className="management-report-details-toggle" aria-expanded={showDetails} aria-controls="management-report-detailed-appendices" onClick={() => setShowDetails((visible) => !visible)}>{showDetails ? "Hide detailed appendices" : "Show detailed appendices for review or print"}</button>
      <p>Detailed registers are excluded from the default briefing printout. Open them, then use Print / Save PDF, to include them.</p>
    </section>
    {showDetails ? <section id="management-report-detailed-appendices" className="management-report-detailed-appendices" aria-label="Detailed management appendices">
      <section className="management-report-detailed-block"><h2>Detailed Management Metrics</h2><ReportDocumentStatistics className="management-report-statistics" columns={3} items={Object.entries(snapshot.metadata || {}).map(([key, value]) => ({ key, label: human(key.replace(/([A-Z])/g, " $1")), value }))} /></section>
      {issues.items?.length ? <section className="management-report-detailed-block"><h2>Complete Issue Register</h2><IssueRows items={issues.items} /></section> : null}
      {progress.items?.length ? <section className="management-report-detailed-block"><h2>Recent Recorded Activity</h2><p className="management-report-limitation">{progress.metadata?.limitation}</p><p className="management-report-period">{progress.metadata?.period}</p><FindingList items={(progress.items || []).map((item) => ({ ...item, message: `${human(item.type)}: ${item.title}`, source: item.loggedDate ? `Logged ${item.loggedDate}` : "Logged date unavailable" }))} recordIndex={recordIndex} /></section> : null}
      {(reportDocument.appendices || []).map((appendix) => <ReportDocumentAppendix key={appendix.id} className="management-report-appendix" id={appendix.id} label={appendix.label} title={appendix.title}><AppendixContent appendix={appendix} /></ReportDocumentAppendix>)}
    </section> : null}
    <ReportDocumentSection id="source-notes" title="Source Notes and Document Control" className="management-report-section management-report-control"><p>References identify the recorded source material used in this briefing. They do not independently establish an assertion, and original attachment contents are not reproduced.</p><dl><div><dt>Scope</dt><dd>{presentation.scope || "Whole case"}</dd></div><div><dt>Document status</dt><dd>{presentation.documentStatus || "Draft"}</dd></div><div><dt>Generated</dt><dd>{reportDocument.report?.generatedAt || "Not recorded"}</dd></div><div><dt>Source revision</dt><dd title={sourceRevision}>{shortFingerprint(sourceRevision)}</dd></div></dl>{(reportDocument.notices || []).map((notice) => <p key={notice.code} className="management-report-notice"><strong>{notice.code.replaceAll("_", " ")}:</strong> {notice.message}</p>)}</ReportDocumentSection>
  </ReportDocumentShell>;
}
