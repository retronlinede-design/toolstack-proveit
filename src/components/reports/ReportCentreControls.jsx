import { getSupportedReportScopes, normaliseReportScope } from "../../report/reportScopes.js";
import { getReportCentrePreviewDescription, REPORT_CENTRE_TYPES } from "./reportCentreConfig.js";
import ReportOutputActions from "./ReportOutputActions.jsx";

const SCOPE_LABELS = { case: "Whole Case", sequenceGroup: "Issue" };
const AUDIENCE_LABELS = { management: "Manager", investigation: "Investigator", client: "Client", internal: "Internal" };
const COMPLETENESS_LABELS = { complete: "Complete", bounded: "Bounded", summary: "Summary" };
const OUTPUT_LABELS = { preview: "Preview", markdown: "Markdown", json: "JSON", print: "Print" };
const REPORT_CATEGORIES = [
  { id: "case", title: "Case Reports", description: "Reports that communicate the overall case position to a clear audience.", reports: ["management", "investigation", "client"] },
  { id: "schedules", title: "Schedules & Evidence", description: "Detailed factual schedules, chronology, and supporting material.", reports: ["incidentSchedule", "chronologyReport", "evidence", "document", "ledger"] },
  { id: "audit-actions", title: "Audit & Actions", description: "Internal case-quality checks, focused Issue review, and operational next steps.", reports: ["caseAudit", "action"] },
];
const PURPOSES = {
  management: "Summarises findings, risks, awareness items, and actions for management.",
  investigation: "Explains the investigation for the whole case or a selected Issue.",
  client: "Creates a client-facing report through the existing assisted workflow.",
  incidentSchedule: "Lists Incidents with their recorded supporting context.",
  chronologyReport: "Presents the canonical record chronology in date order.",
  evidence: "Provides the structured Evidence schedule and its links.",
  document: "Provides the structured Document schedule and attachment metadata.",
  ledger: "Provides the structured financial and measurable-record schedule.",
  caseAudit: "Reviews recorded case structure, relationships, and data quality.",
  action: "Summarises recorded actions, risks, and next steps.",
};

function formatList(values, labels) { return values.map((value) => labels[value] || value).join(" / "); }

function ReportCard({ reportType, selected, onSelect }) {
  const definition = REPORT_CENTRE_TYPES.find(({ value }) => value === reportType);
  const descriptionId = `report-card-${reportType}-purpose`;
  return (
    <button type="button" aria-pressed={selected} aria-describedby={descriptionId} onClick={() => onSelect(reportType)} className={`case-file-reports-card group min-w-0 rounded-xl border p-4 text-left transition focus-visible:outline-none ${selected ? "is-selected" : ""}`}>
      <div className="flex items-start justify-between gap-3"><span className="text-base font-bold leading-6">{definition.label}</span>{selected ? <span className="case-file-reports-selected shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider">Selected</span> : null}</div>
      <p id={descriptionId} className="mt-2 text-sm leading-5 text-neutral-600 dark:text-neutral-300">{PURPOSES[reportType] || definition.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
        <div><dt className="font-bold text-neutral-500 dark:text-neutral-400">Audience</dt><dd className="mt-0.5 text-neutral-800 dark:text-neutral-200">{reportType === "investigation" ? "Investigator / adviser / manager" : AUDIENCE_LABELS[definition.audience] || definition.audience}</dd></div>
        <div><dt className="font-bold text-neutral-500 dark:text-neutral-400">Completeness</dt><dd className="mt-0.5 text-neutral-800 dark:text-neutral-200">{COMPLETENESS_LABELS[definition.completeness] || definition.completeness}</dd></div>
        <div><dt className="font-bold text-neutral-500 dark:text-neutral-400">Scope</dt><dd className="mt-0.5 text-neutral-800 dark:text-neutral-200">{formatList(definition.supportedScopes, SCOPE_LABELS)}</dd></div>
        <div><dt className="font-bold text-neutral-500 dark:text-neutral-400">Outputs</dt><dd className="mt-0.5 text-neutral-800 dark:text-neutral-200">{formatList(definition.supportedOutputs, OUTPUT_LABELS)}</dd></div>
      </dl>
    </button>
  );
}

function UtilityCard({ title, purpose, audience, status, scope, outputs, actionLabel, onAction }) {
  return <article className="case-file-reports-utility rounded-xl border p-4"><h5 className="text-base font-bold">{title}</h5><p className="mt-2 text-sm leading-5">{purpose}</p><dl className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs"><div><dt className="font-bold">Audience</dt><dd className="mt-0.5">{audience}</dd></div><div><dt className="font-bold">Status</dt><dd className="mt-0.5">{status}</dd></div><div><dt className="font-bold">Scope</dt><dd className="mt-0.5">{scope}</dd></div><div><dt className="font-bold">Outputs</dt><dd className="mt-0.5">{outputs}</dd></div></dl>{onAction ? <button type="button" onClick={onAction} className="case-file-reports-utility-action mt-4">{actionLabel}</button> : null}</article>;
}

export function ReportCentrePreviewSummary({ reportType, scopeType, scopeLabel }) { return <div className="case-file-reports-preview-summary flex flex-col gap-2 border-b pb-4 print:hidden sm:flex-row sm:items-end sm:justify-between"><div><h4 className="text-sm font-bold uppercase tracking-wider">Selected preview</h4><p className="mt-1 text-sm">{getReportCentrePreviewDescription(reportType, scopeType)}</p></div><div className="case-file-reports-scope-label rounded-lg border px-3 py-2 text-xs font-semibold">Scope: {scopeLabel}</div></div>; }

export default function ReportCentreControls({ reportType, scopeType, sequenceGroups = [], selectedSequenceGroup = "", markdownAvailable = false, documentOutputAvailable = false, outputFeedback = "", onReportTypeChange, onScopeTypeChange, onSequenceGroupChange, onPrint, onCopyMarkdown, onDownloadMarkdown, onDownloadJson, onOpenSequenceGroupAudit, onOpenAdvancedReports }) {
  const supportedScopes = getSupportedReportScopes(reportType);
  const activeScope = normaliseReportScope(reportType, scopeType);
  const hasOneScope = supportedScopes.length === 1;
  const reportUnavailable = activeScope === "sequenceGroup" && !selectedSequenceGroup;
  return <section aria-labelledby="choose-report-heading" className="case-file-reports-controls space-y-7 rounded-2xl border p-4 shadow-sm print:hidden sm:p-6">
    <div><p className="case-file-reports-eyebrow">Prepare · Create · Review · Export</p><h3 id="choose-report-heading" className="mt-1 text-xl font-bold">Choose a report</h3><p className="mt-1 max-w-3xl text-sm leading-6">Choose the audience and purpose first. The selected report remains a derived view of the case; downloading or printing it does not approve or replace the case record.</p></div>
    <section className="case-file-reports-configure rounded-xl border p-4 sm:p-5" aria-labelledby="prepare-report-heading"><div className="grid gap-6 lg:grid-cols-2"><div><p className="case-file-reports-eyebrow">Prepare</p><h4 id="prepare-report-heading" className="mt-1 text-lg font-bold">Set the report scope</h4><p className="mt-1 text-sm">Use the whole case or an existing Issue where this report supports it.</p><div className={`mt-4 grid gap-2 ${hasOneScope ? "grid-cols-1" : "grid-cols-2"}`}>{supportedScopes.map((value) => <button key={value} type="button" aria-pressed={activeScope === value} disabled={hasOneScope} onClick={() => onScopeTypeChange(value)} className={`case-file-reports-scope-button rounded-lg border px-3 py-2 text-sm font-bold ${activeScope === value ? "is-selected" : ""}`}>{SCOPE_LABELS[value]}</button>)}</div>{hasOneScope ? <p className="mt-2 text-xs font-semibold">This report is available for the whole case only.</p> : null}{activeScope === "sequenceGroup" ? <div className="mt-3"><label className="case-file-reports-field-label" htmlFor="report-centre-sequence-group">Issue</label>{sequenceGroups.length ? <select id="report-centre-sequence-group" value={selectedSequenceGroup} onChange={(event) => onSequenceGroupChange(event.target.value)} className="case-file-reports-select mt-2 w-full rounded-lg border px-3 py-2 text-sm font-medium">{sequenceGroups.map((groupName) => <option key={groupName} value={groupName}>{groupName}</option>)}</select> : <p className="mt-2 text-sm">No Issues exist in this case yet. Create an Issue and assign records before generating an Issue-scoped report.</p>}</div> : null}</div><div><p className="case-file-reports-eyebrow">Export</p><h4 className="mt-1 text-lg font-bold">Share a reviewed copy</h4><p className="mt-1 text-sm">Review the preview and source revision below before copying, downloading, or printing.</p><div className="mt-4"><ReportOutputActions reportType={reportType} markdownAvailable={markdownAvailable} documentOutputAvailable={documentOutputAvailable} disabled={reportUnavailable} feedback={outputFeedback} onCopyMarkdown={onCopyMarkdown} onDownloadMarkdown={onDownloadMarkdown} onDownloadJson={onDownloadJson} onPrint={onPrint} /></div></div></div></section>
    <div className="space-y-7"><div><p className="case-file-reports-eyebrow">Create</p><h4 className="mt-1 text-lg font-bold">Select a report type</h4><p className="mt-1 text-sm">Each report describes its audience, completeness, scope, and available outputs before you select it.</p></div>{REPORT_CATEGORIES.map((category) => <section key={category.id} aria-labelledby={`report-category-${category.id}`}><h5 id={`report-category-${category.id}`} className="text-base font-bold">{category.title}</h5><p className="mt-1 text-sm">{category.description}</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{category.reports.map((value) => <ReportCard key={value} reportType={value} selected={reportType === value} onSelect={onReportTypeChange} />)}{category.id === "audit-actions" ? <UtilityCard title="Issue Audit" purpose="Audits one Issue or all Issues using the existing Issue audit workflow." audience="Internal" status="Internal" scope="Issue / All Issues" outputs="Existing audit outputs" actionLabel="Open Issue Audit" onAction={onOpenSequenceGroupAudit} /> : null}</div></section>)}</div>
    <details className="case-file-reports-specialist"><summary><span><span className="case-file-reports-eyebrow">Case documentation</span><strong>Case Bundle and specialist formats</strong></span><span className="case-file-reports-specialist-hint">Optional</span></summary><div className="mt-4 grid gap-3 md:grid-cols-2"><UtilityCard title="Case documentation" purpose="Prepare the configurable Case Bundle, Internal Case Summary, and retained specialist formats in Reports Centre." audience="Internal / External" status="Derived previews" scope="Whole case / Issue where supported" outputs="Print" actionLabel="Open case documentation" onAction={onOpenAdvancedReports} /></div></details>
  </section>;
}
