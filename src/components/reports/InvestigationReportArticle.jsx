import { useState } from "react";
import "./InvestigationReportArticle.css";
import { ReportDocumentAppendix, ReportDocumentFooter, ReportDocumentHeader, ReportDocumentSection, ReportDocumentShell } from "./document/index.js";

const TYPE_LABELS = { incident: "Incident", evidence: "Evidence", document: "Document", ledger: "Ledger", strategy: "Strategy", watch: "To Watch" };
function getSection(document, id) { return (document?.sections || []).find((item) => item.id === id) || {}; }
function display(value, fallback = "Not recorded") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function humanStatus(value) { return String(value || "Not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function shortFingerprint(value) { const fingerprint = String(value || ""); return fingerprint ? `${fingerprint.slice(0, 12)}${fingerprint.length > 12 ? "…" : ""}` : "Unavailable"; }
function stableKey(item, index) { return item?.id ? `id:${item.id}` : item?.sourceReference?.recordId ? `record:${item.sourceReference.recordType}:${item.sourceReference.recordId}` : item?.recordId ? `record:${item.recordType || "record"}:${item.recordId}` : item?.code ? `code:${item.code}` : `position:${index}`; }
function uniqueByStableIdentity(items = []) { const seen = new Set(); return items.filter((item, index) => { const key = stableKey(item, index); if (seen.has(key)) return false; seen.add(key); return true; }); }

function SourceReference({ reference }) {
  if (!reference) return null;
  const relation = reference.scopeRelation === "direct" ? "Direct Issue record" : reference.scopeRelation === "linked-context" ? "Additional linked context" : reference.scopeRelation === "unavailable" ? "Unavailable source" : "Outside declared scope";
  return <p className="investigation-report-reference"><strong>Record reference</strong> {reference.label} <span>· {relation}</span></p>;
}

function Chronology({ groups = [], limit = null }) {
  const entries = groups.flatMap((group) => group.entries || []);
  const visible = limit === null ? entries : entries.slice(0, limit);
  if (!visible.length) return <p className="investigation-report-empty">No dated investigation records are available in this scope.</p>;
  return <ol className="investigation-report-chronology">{visible.map((entry) => <li key={`${entry.recordType}:${entry.recordId}`}><time>{entry.dateStatus === "valid" ? entry.date : entry.dateStatus === "malformed" ? `Malformed date: ${entry.originalDate || entry.date || "unknown"}` : "Missing date"}</time><p className="investigation-report-entry-title">{TYPE_LABELS[entry.recordType] || entry.recordType}: {entry.title}</p>{entry.summary ? <p className="investigation-report-entry-summary">{entry.summary}</p> : null}{entry.resolvedPartyNames?.length ? <p className="investigation-report-entry-meta">People: {entry.resolvedPartyNames.join(", ")}</p> : null}<SourceReference reference={entry.sourceReference} /></li>)}</ol>;
}

function RecordedMatters({ evidence = [], documents = [] }) {
  const items = [...evidence.map((item) => ({ ...item, kind: "Evidence", detail: item.verificationState ? `Verification: ${item.verificationState}` : "Verification not recorded" })), ...documents.map((item) => ({ ...item, kind: "Document", detail: item.category || "Category not recorded" }))];
  if (!items.length) return <p className="investigation-report-empty">No Evidence or Documents are recorded in this scope. This absence does not determine the merits of the investigation.</p>;
  return <ul className="investigation-report-list">{items.map((item) => <li key={`${item.kind}:${item.id}`} className="investigation-report-entry"><p className="investigation-report-entry-title">{item.kind}: {item.title}</p>{item.functionSummary || item.summary ? <p className="investigation-report-entry-summary">{item.functionSummary || item.summary}</p> : null}<p className="investigation-report-entry-meta">{item.detail}</p><SourceReference reference={item.sourceReference} /></li>)}</ul>;
}

function Findings({ groups = [] }) {
  const seen = new Set();
  const visible = groups.map((group) => {
    const uniqueItems = uniqueByStableIdentity(group.items || []);
    const items = uniqueItems.filter((item, index) => {
      const key = stableKey(item, index);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ...group, items };
  }).filter((group) => group.items.length);
  if (!visible.length) return <p className="investigation-report-empty">No unresolved structural matters are recorded by the current deterministic checks.</p>;
  return <div className="investigation-report-groups">{visible.map((group) => <section key={group.id}><h3>{group.label}</h3><ul className="investigation-report-list">{group.items.map((item, index) => <li key={stableKey(item, index)} className="investigation-report-entry"><p className="investigation-report-entry-title">{item.message || item.text || item.title}</p><SourceReference reference={item.sourceReference} /></li>)}</ul></section>)}</div>;
}

function Actions({ items = [] }) {
  if (!items.length) return <p className="investigation-report-empty">No structured next actions or review dates are recorded in this scope.</p>;
  return <ul className="investigation-report-list">{uniqueByStableIdentity(items).map((action, index) => <li key={stableKey(action, index)} className="investigation-report-entry"><p className="investigation-report-entry-title">{action.action}</p><p className="investigation-report-entry-meta">Source: {action.sourceType} — {action.sourceTitle}{action.owner ? ` · Owner: ${action.owner}` : ""}{action.dueDate ? ` · Due: ${action.dueDate}` : ""}{action.status ? ` · Status: ${action.status}` : ""}</p></li>)}</ul>;
}

function AppendixTable({ appendix }) {
  const rows = appendix.rows || [];
  if (!rows.length) return <p>No records are included.</p>;
  if (appendix.type === "incident-schedule") return <table className="proveit-report-wide-table"><caption className="sr-only">Complete Incident Schedule</caption><thead><tr>{["Incident", "Date", "Status", "Issue", "Evidence"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.incidentId}><td><strong>{row.title}</strong><br /><span>{row.incidentId}</span></td><td>{display(row.canonicalDate, row.dateStatus)}</td><td>{display(row.status)}</td><td>{display(row.sequenceGroup, "Ungrouped")}</td><td>{row.linkedEvidence?.map((item) => item.title).join(", ") || "None"}</td></tr>)}</tbody></table>;
  const idKey = appendix.type === "evidence-schedule" ? "evidenceId" : appendix.type === "document-schedule" ? "documentId" : "ledgerId";
  return <table className="proveit-report-wide-table"><caption className="sr-only">{appendix.title}</caption><thead><tr>{["Record", "Date", "Status", "Details"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row[idKey] || index}><td><strong>{row.title}</strong><br /><span>{row[idKey]}</span></td><td>{display(row.date || row.documentDate)}</td><td>{display(row.status || row.verificationState || row.proofStatus)}</td><td>{display(row.functionSummary || row.summary || row.notes || row.amount)}</td></tr>)}</tbody></table>;
}

function DetailAppendix({ appendix }) {
  if (appendix.type === "chronology") return <Chronology groups={appendix.groups || []} />;
  if (appendix.rows) return <AppendixTable appendix={appendix} />;
  return <ul className="investigation-report-list">{(appendix.items || []).map((item, index) => <li key={stableKey(item, index)} className="investigation-report-entry">{item.message || `${TYPE_LABELS[item.recordType] || item.recordType}: ${item.title} (${item.recordId}; ${item.scopeRelation || item.code || "reference"})`}</li>)}</ul>;
}

function SupportingReferences({ groups = [], visibleReferences = [] }) {
  const allowed = new Set(visibleReferences.filter(Boolean).map((reference) => `${reference.recordType}:${reference.recordId}`));
  const relevant = groups.map((group) => ({ ...group, items: (group.items || []).filter((item) => item.scopeRelation === "unavailable" || allowed.has(`${item.recordType || item.sourceReference?.recordType}:${item.recordId || item.sourceReference?.recordId}`)) })).filter((group) => group.items.length);
  if (!relevant.length) return <p className="investigation-report-empty">No additional supporting references are displayed in this concise briefing.</p>;
  return <><p className="investigation-report-limitation">Record references identify structured ProveIt records. They do not independently prove an assertion or reproduce original attachments.</p><div className="investigation-report-groups">{relevant.map((group) => <section key={group.id}><h3>{group.label}</h3><ul className="investigation-report-references">{group.items.map((item, index) => <li key={stableKey(item, index)}>{item.sourceReference?.label || item.label}<span>{item.scopeRelation === "direct" ? "Direct Issue record" : item.scopeRelation === "linked-context" ? "Additional linked context" : item.targetLabel || "Unavailable source"}</span></li>)}</ul></section>)}</div></>;
}

export default function InvestigationReportArticle({ reportDocument, className = "" }) {
  const [showDetails, setShowDetails] = useState(false);
  if (!reportDocument) return null;
  const summary = reportDocument.summary || {}; const presentation = reportDocument.presentation || {}; const issue = summary.issue;
  const overview = getSection(reportDocument, "executive-summary"); const current = getSection(reportDocument, "current-position").metadata || {}; const chronology = getSection(reportDocument, "narrative-chronology"); const evidence = getSection(reportDocument, "evidence-overview"); const documents = getSection(reportDocument, "supporting-documents"); const outstanding = getSection(reportDocument, "outstanding-matters"); const actions = getSection(reportDocument, "next-actions"); const sourceRegister = getSection(reportDocument, "source-register");
  const conciseEvidence = (evidence.items || []).slice(0, 3); const conciseDocuments = (documents.items || []).slice(0, 3); const conciseChronology = (chronology.groups || []).flatMap((group) => group.entries || []).slice(0, 6); const visibleReferences = [...conciseChronology.map((entry) => entry.sourceReference), ...conciseEvidence.map((item) => item.sourceReference), ...conciseDocuments.map((item) => item.sourceReference)]; const sourceRevision = reportDocument.source?.sourceRevision?.fingerprint || "";
  const headerProps = { title: "Investigation Report", subtitle: issue ? issue.displayLabel : summary.scopeLabel, caseName: reportDocument.source?.caseName, caseReference: reportDocument.source?.caseId, issueReference: issue?.reference, issueName: issue?.name, generatedAt: reportDocument.report?.generatedAt, preparedBy: presentation.preparedBy, approvedBy: presentation.approvedBy, version: presentation.version, documentStatus: presentation.documentStatus, confidentiality: presentation.confidentiality };
  return <ReportDocumentShell className={`proveit-investigation-report ${className}`.trim()} data-report-document="investigation" header={<ReportDocumentHeader className="investigation-report-header" {...headerProps} />} footer={<ReportDocumentFooter className="investigation-report-footer" reportTitle="Investigation Report" caseName={reportDocument.source?.caseName} caseReference={reportDocument.source?.caseId} issueReference={issue?.reference} version={presentation.version} documentStatus={presentation.documentStatus} confidentiality={presentation.confidentiality} />}>
    <ReportDocumentSection id="investigation-overview" title="Investigation Overview" className="investigation-report-section investigation-report-summary"><p>{overview.text}</p><p className="investigation-report-limitation">This report presents structured records and relationships. It does not determine legal merit or whether an allegation is proven.</p></ReportDocumentSection>
    <ReportDocumentSection id="scope-and-questions" title="Scope and Questions Under Examination" className="investigation-report-section"><p className="investigation-report-section-intro">The declared scope is {presentation.scope || summary.scopeLabel || "not recorded"}. Direct Issue records and additional linked context remain distinct.</p>{issue ? <dl className="investigation-report-facts"><div><dt>Issue</dt><dd>{issue.displayLabel}</dd></div><div><dt>Status</dt><dd>{humanStatus(current.status)}</dd></div><div><dt>Priority</dt><dd>{humanStatus(current.priority)}</dd></div><div><dt>Purpose</dt><dd>{display(current.purpose)}</dd></div></dl> : <p className="investigation-report-empty">No structured whole-case question or current focus is projected into this report.</p>}{issue && current.currentPosition ? <section className="investigation-report-current-position"><h3>Recorded current position</h3><p>{current.currentPosition}</p></section> : issue ? <p className="investigation-report-empty">No user-authored current position is recorded for this Issue.</p> : null}</ReportDocumentSection>
    <ReportDocumentSection id="relevant-chronology" title="Relevant Chronology" description="A concise record-led chronology. The complete technical chronology is available in the detailed appendices." className="investigation-report-section"><Chronology groups={[{ id: "concise-chronology", entries: conciseChronology }]} /></ReportDocumentSection>
    <ReportDocumentSection id="evidence-and-recorded-matters" title="Evidence and Recorded Matters" description="Recorded material only. A linked record or evidence association is not independently proof of an assertion." className="investigation-report-section"><RecordedMatters evidence={conciseEvidence} documents={conciseDocuments} /></ReportDocumentSection>
    <ReportDocumentSection id="inconsistencies-and-unresolved-matters" title="Inconsistencies and Unresolved Matters" description="These are structured data-quality and reference matters, not findings on credibility or legal merit." className="investigation-report-section"><Findings groups={outstanding.groups || []} /></ReportDocumentSection>
    <ReportDocumentSection id="outstanding-investigative-actions" title="Outstanding Investigative Actions" description="Existing structured actions and review dates only; no new recommendation is generated." className="investigation-report-section"><Actions items={actions.items || []} /></ReportDocumentSection>
    <ReportDocumentSection id="supporting-references" title="Supporting References" className="investigation-report-section"><SupportingReferences groups={sourceRegister.groups || []} visibleReferences={visibleReferences} /></ReportDocumentSection>
    <section className="investigation-report-details print:hidden" aria-label="Detailed investigation appendices"><button type="button" className="investigation-report-details-toggle" aria-expanded={showDetails} aria-controls="investigation-report-detailed-appendices" onClick={() => setShowDetails((visible) => !visible)}>{showDetails ? "Hide detailed appendices" : "Show detailed appendices for review or print"}</button><p>Detailed schedules are excluded from the default briefing printout. Open them, then use Print / Save PDF, to include them.</p></section>
    {showDetails ? <section id="investigation-report-detailed-appendices" className="investigation-report-detailed-appendices" aria-label="Detailed investigation appendices">{(reportDocument.appendices || []).map((appendix) => <ReportDocumentAppendix key={appendix.id} className="investigation-report-appendix" id={appendix.id} label={appendix.label} title={appendix.title} description={appendix.type === "reference-index" ? "Technical identifiers are secondary references for traceability." : `Complete structured ${appendix.title.toLowerCase()} for the declared scope.`}><DetailAppendix appendix={appendix} /></ReportDocumentAppendix>)}</section> : null}
    <ReportDocumentSection id="source-notes" title="Source Notes and Document Control" className="investigation-report-section investigation-report-control"><p>References identify recorded source material used in this briefing. They do not independently establish an assertion, and original attachment contents are not reproduced.</p><dl><div><dt>Scope</dt><dd>{presentation.scope || summary.scopeLabel || "Not recorded"}</dd></div><div><dt>Document status</dt><dd>{presentation.documentStatus || "Draft"}</dd></div><div><dt>Generated</dt><dd>{reportDocument.report?.generatedAt || "Not recorded"}</dd></div><div><dt>Source revision</dt><dd title={sourceRevision}>{shortFingerprint(sourceRevision)}</dd></div></dl>{(reportDocument.notices || []).map((notice) => <p key={notice.code} className="investigation-report-notice"><strong>{notice.code.replaceAll("_", " ")}:</strong> {notice.message}</p>)}</ReportDocumentSection>
  </ReportDocumentShell>;
}
