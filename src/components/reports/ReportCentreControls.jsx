import { getSupportedReportScopes, normaliseReportScope } from "../../report/reportScopes.js";
import { getReportCentreFamily, getReportCentrePreviewDescription, REPORT_CENTRE_FAMILIES, REPORT_CENTRE_PRESENTATION, REPORT_CENTRE_TYPES } from "./reportCentreConfig.js";

const SCOPE_LABELS = { case: "Whole Case", sequenceGroup: "Issue" };
const PURPOSES = {
  executive: "Concise, source-grounded briefing of the selected Issue or whole case.",
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

function ReportChoice({ reportType, selected, onSelect }) {
  const definition = REPORT_CENTRE_TYPES.find(({ value }) => value === reportType);
  const presentation = REPORT_CENTRE_PRESENTATION[reportType] || {};
  const descriptionId = `report-choice-${reportType}-purpose`;
  return (
    <button type="button" aria-pressed={selected} aria-describedby={descriptionId} onClick={() => onSelect(reportType)} className={`case-file-reports-choice ${selected ? "is-selected" : ""}`}>
      <span className="case-file-reports-choice-title">{presentation.label || definition.label}</span>
      <span id={descriptionId} className="case-file-reports-choice-description">{PURPOSES[reportType] || definition.description}</span>
    </button>
  );
}

function UtilityCard({ title, purpose, audience, status, scope, outputs, actionLabel, onAction, actions = [] }) {
  const utilityActions = actions.length ? actions : onAction ? [{ label: actionLabel, onClick: onAction }] : [];
  return <article className="case-file-reports-utility rounded-xl border p-4"><h5 className="text-base font-bold">{title}</h5><p className="mt-2 text-sm leading-5">{purpose}</p><dl className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs"><div><dt className="font-bold">Audience</dt><dd className="mt-0.5">{audience}</dd></div><div><dt className="font-bold">Status</dt><dd className="mt-0.5">{status}</dd></div><div><dt className="font-bold">Scope</dt><dd className="mt-0.5">{scope}</dd></div><div><dt className="font-bold">Outputs</dt><dd className="mt-0.5">{outputs}</dd></div></dl>{utilityActions.length ? <div className="case-file-reports-utility-actions mt-4">{utilityActions.map((action) => <button key={action.label} type="button" onClick={action.onClick} disabled={action.disabled} className="case-file-reports-utility-action">{action.label}</button>)}</div> : null}</article>;
}

export function ReportCentrePreviewSummary({ reportType, scopeType, scopeLabel }) { return <div className="case-file-reports-preview-summary flex flex-col gap-2 border-b pb-4 print:hidden sm:flex-row sm:items-end sm:justify-between"><div><h4 className="text-sm font-bold uppercase tracking-wider">Preview and export</h4><p className="mt-1 text-sm">{getReportCentrePreviewDescription(reportType, scopeType)}</p></div><div className="case-file-reports-scope-label rounded-lg border px-3 py-2 text-xs font-semibold">Scope: {scopeLabel}</div></div>; }

export default function ReportCentreControls({ reportType, scopeType, issues = [], selectedIssueId = "", externalDraftingScopeType = "case", externalDraftingIssueAvailable = false, activeDestination = "reports", onFamilyChange, onOpenSavedReports, onReportTypeChange, onScopeTypeChange, onIssueChange, onExternalDraftingScopeChange, onCopyExternalDraftingJson, onCopyExternalDraftingMarkdown, onCopyExternalDraftingSpecialistPrompt, onOpenSequenceGroupAudit, onOpenAdvancedReports }) {
  const supportedScopes = getSupportedReportScopes(reportType);
  const activeScope = normaliseReportScope(reportType, scopeType);
  const hasOneScope = supportedScopes.length === 1;
  const activeFamily = getReportCentreFamily(reportType);
  return <section aria-labelledby="report-workspace-heading" className="case-file-reports-controls space-y-5 rounded-2xl border p-4 shadow-sm print:hidden sm:p-6">
    <div><p className="case-file-reports-eyebrow">Report workspace</p><h3 id="report-workspace-heading" className="mt-1 text-xl font-bold">Choose a report purpose</h3><p className="mt-1 max-w-3xl text-sm leading-6">Reports are derived from the case record. They are not independently verified or approved.</p></div>
    <nav aria-label="Report families" className="case-file-reports-family-nav">
      {REPORT_CENTRE_FAMILIES.map((family) => <button key={family.id} type="button" aria-pressed={activeDestination === "reports" && activeFamily.id === family.id} onClick={() => onFamilyChange?.(family.id)} className="case-file-reports-family-button">{family.label}</button>)}
      <button type="button" aria-pressed={activeDestination === "saved"} onClick={onOpenSavedReports} className="case-file-reports-family-button">Saved Reports</button>
    </nav>
    {activeDestination === "reports" ? <>
      <section className="case-file-reports-selector" aria-labelledby="report-family-heading">
        <div><p className="case-file-reports-eyebrow">{activeFamily.label}</p><h4 id="report-family-heading" className="mt-1 text-base font-bold">{activeFamily.description}</h4></div>
        <div className="case-file-reports-choice-list" aria-label={`${activeFamily.label} report choices`}>{activeFamily.reports.map((value) => <ReportChoice key={value} reportType={value} selected={reportType === value} onSelect={onReportTypeChange} />)}</div>
      </section>
      <section className="case-file-reports-configure rounded-xl border p-4 sm:p-5" aria-labelledby="prepare-report-heading"><p className="case-file-reports-eyebrow">Selected report</p><h4 id="prepare-report-heading" className="mt-1 text-lg font-bold">{REPORT_CENTRE_PRESENTATION[reportType]?.label || REPORT_CENTRE_TYPES.find((item) => item.value === reportType)?.label}</h4><p className="mt-1 text-sm">{getReportCentrePreviewDescription(reportType, activeScope)}</p><div className={`mt-4 grid gap-2 ${hasOneScope ? "grid-cols-1" : "grid-cols-2"}`}>{supportedScopes.map((value) => <button key={value} type="button" aria-pressed={activeScope === value} disabled={hasOneScope} onClick={() => onScopeTypeChange(value)} className={`case-file-reports-scope-button ${activeScope === value ? "is-selected" : ""}`}>{SCOPE_LABELS[value]}</button>)}</div>{hasOneScope ? <p className="mt-2 text-xs font-semibold">This report is available for the whole case only.</p> : null}{activeScope === "sequenceGroup" ? <div className="mt-3"><label className="case-file-reports-field-label" htmlFor="report-centre-issue">Issue</label>{issues.length ? <select id="report-centre-issue" value={selectedIssueId} onChange={(event) => onIssueChange(event.target.value)} className="case-file-reports-select mt-2 w-full rounded-lg border px-3 py-2 text-sm font-medium"><option value="">Select an Issue</option>{issues.map((issue) => <option key={issue.id} value={issue.id}>{issue.label}</option>)}</select> : <p className="mt-2 text-sm">No Issues exist in this case yet. Create an Issue and assign records before generating an Issue-scoped report.</p>}</div> : null}</section>
    </> : null}
    <details className="case-file-reports-specialist"><summary><span><span className="case-file-reports-eyebrow">Advanced</span><strong>Legacy documentation and utilities</strong></span><span className="case-file-reports-specialist-hint">Optional</span></summary><div className="mt-4"><p className="text-sm">Existing specialist formats and bounded handoff tools remain available here.</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><UtilityCard title="External Drafting Handoff" purpose="Prepares existing, bounded case material for an external AI drafting service. It does not generate an AI-written report inside ProveIt." audience="External drafting service" status="Read-only handoff" scope={externalDraftingScopeType === "sequenceGroup" ? "Selected Issue" : "Entire Case"} outputs="JSON / Markdown / Specialist prompt" actions={[{ label: "Copy JSON Pack", onClick: onCopyExternalDraftingJson, disabled: externalDraftingScopeType === "sequenceGroup" && !externalDraftingIssueAvailable }, { label: "Copy Markdown Prompt", onClick: onCopyExternalDraftingMarkdown, disabled: externalDraftingScopeType === "sequenceGroup" && !externalDraftingIssueAvailable }, { label: "Copy Specialist Review Prompt", onClick: onCopyExternalDraftingSpecialistPrompt, disabled: externalDraftingScopeType === "sequenceGroup" && !externalDraftingIssueAvailable }]} /><UtilityCard title="Issue Audit" purpose="Audits one Issue or all Issues using the existing Issue audit workflow." audience="Internal" status="Diagnostic" scope="Issue / All Issues" outputs="Existing audit outputs" actionLabel="Open Issue Audit" onAction={onOpenSequenceGroupAudit} /><UtilityCard title="Case Documentation" purpose="Prepare the configurable Case Bundle, Internal Case Summary, and retained specialist formats." audience="Internal / External" status="Derived previews" scope="Whole case / Issue where supported" outputs="Print" actionLabel="Open Case Documentation" onAction={onOpenAdvancedReports} /></div><section className="case-file-reports-external-scope mt-4 rounded-xl border p-4" aria-labelledby="external-drafting-scope-heading"><h5 id="external-drafting-scope-heading" className="text-sm font-bold">External Drafting Handoff scope</h5><p className="mt-1 text-sm">Choose the existing case-wide context or one canonical Issue. The same Issue selector is used for report scope and handoffs.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" aria-pressed={externalDraftingScopeType === "case"} onClick={() => onExternalDraftingScopeChange?.("case")} className={`case-file-reports-scope-button ${externalDraftingScopeType === "case" ? "is-selected" : ""}`}>Entire Case</button><button type="button" aria-pressed={externalDraftingScopeType === "sequenceGroup"} onClick={() => onExternalDraftingScopeChange?.("sequenceGroup")} className={`case-file-reports-scope-button ${externalDraftingScopeType === "sequenceGroup" ? "is-selected" : ""}`}>Selected Issue</button></div>{externalDraftingScopeType === "sequenceGroup" ? <div className="mt-3"><label className="case-file-reports-field-label" htmlFor="external-drafting-issue">Issue</label>{issues.length ? <select id="external-drafting-issue" value={selectedIssueId} onChange={(event) => onIssueChange(event.target.value)} className="case-file-reports-select mt-2 w-full rounded-lg border px-3 py-2 text-sm font-medium"><option value="">Select an Issue</option>{issues.map((issue) => <option key={issue.id} value={issue.id}>{issue.label}</option>)}</select> : <p className="mt-2 text-sm">No Issues exist in this case yet. Use Entire Case or create an Issue before preparing a scoped handoff.</p>}{!externalDraftingIssueAvailable && selectedIssueId ? <p className="mt-2 text-sm" role="status">The selected Issue is no longer available. ProveIt has not substituted another Issue.</p> : null}</div> : null}</section></div></details>
  </section>;
}
