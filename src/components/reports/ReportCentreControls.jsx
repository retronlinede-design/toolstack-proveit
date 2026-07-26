import { getSupportedReportScopes, normaliseReportScope } from "../../report/reportScopes.js";
import { getReportCentrePreviewDescription, REPORT_CENTRE_TYPES } from "./reportCentreConfig.js";
import ReportOutputActions from "./ReportOutputActions.jsx";

const SCOPE_LABELS = {
  case: "Whole Case",
  sequenceGroup: "Sequence Group",
};

export function ReportCentrePreviewSummary({ reportType, scopeType, scopeLabel }) {
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 pb-3 print:hidden sm:flex-row sm:items-end sm:justify-between dark:border-neutral-700">
      <div>
        <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Preview</h4>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          {getReportCentrePreviewDescription(reportType, scopeType)}
        </p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        Scope: {scopeLabel}
      </div>
    </div>
  );
}

export default function ReportCentreControls({
  reportType,
  scopeType,
  sequenceGroups = [],
  selectedSequenceGroup = "",
  markdownAvailable = false,
  documentOutputAvailable = false,
  outputFeedback = "",
  onReportTypeChange,
  onScopeTypeChange,
  onSequenceGroupChange,
  onPrint,
  onCopyMarkdown,
  onDownloadMarkdown,
  onDownloadJson,
  onOpenSequenceGroupAudit,
}) {
  const supportedScopes = getSupportedReportScopes(reportType);
  const activeScope = normaliseReportScope(reportType, scopeType);
  const hasOneScope = supportedScopes.length === 1;
  const reportUnavailable = activeScope === "sequenceGroup" && !selectedSequenceGroup;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden dark:border-neutral-700 dark:bg-neutral-900">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr_0.7fr]">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Scope</h4>
          <div className={`mt-2 grid gap-2 ${hasOneScope ? "grid-cols-1" : "grid-cols-2"}`}>
            {supportedScopes.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={activeScope === value}
                disabled={hasOneScope}
                onClick={() => onScopeTypeChange(value)}
                className={`rounded-lg border px-3 py-2 text-sm font-bold disabled:cursor-default ${
                  activeScope === value
                    ? "border-lime-400 bg-lime-400/30 text-neutral-950 dark:text-neutral-50"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {SCOPE_LABELS[value]}
              </button>
            ))}
          </div>
          {hasOneScope && (
            <p className="mt-2 inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
              Whole case only
            </p>
          )}
          {activeScope === "sequenceGroup" && (
            <div className="mt-3">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400" htmlFor="report-centre-sequence-group">
                Sequence Group
              </label>
              {sequenceGroups.length > 0 ? (
                <select
                  id="report-centre-sequence-group"
                  value={selectedSequenceGroup}
                  onChange={(event) => onSequenceGroupChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus:border-lime-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {sequenceGroups.map((groupName) => (
                    <option key={groupName} value={groupName}>{groupName}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">No sequence groups exist in this case yet.</p>
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Report Type</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {REPORT_CENTRE_TYPES.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                aria-pressed={reportType === value}
                onClick={() => onReportTypeChange(value)}
                className={`rounded-lg border p-3 text-left ${
                  reportType === value
                    ? "border-lime-400 bg-lime-400/20 text-neutral-950 dark:text-neutral-50"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-sm font-bold"><span>{label}</span>{reportType === value ? <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-lime-900 dark:bg-lime-950 dark:text-lime-200">Selected</span> : null}</div>
                <div className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Output</h4>
          <div className="mt-2 grid gap-2">
            <div className="rounded-lg border border-lime-300 bg-lime-50 px-3 py-2 text-sm font-bold text-lime-900 dark:border-lime-700 dark:bg-lime-950/30 dark:text-lime-200">
              Preview
            </div>
            <ReportOutputActions reportType={reportType} markdownAvailable={markdownAvailable} documentOutputAvailable={documentOutputAvailable} disabled={reportUnavailable} feedback={outputFeedback} onCopyMarkdown={onCopyMarkdown} onDownloadMarkdown={onDownloadMarkdown} onDownloadJson={onDownloadJson} onPrint={onPrint} />
            <button
              type="button"
              onClick={onOpenSequenceGroupAudit}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Open Sequence Group Audit
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Evidence, Document, and Ledger packs support shared Markdown and JSON outputs. Action Plan retains its existing Markdown copy.
          </p>
        </div>
      </div>
    </section>
  );
}
