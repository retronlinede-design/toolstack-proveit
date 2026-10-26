import { reportSupportsOutput } from "../../report/reportScopes.js";

const buttonClass = "case-file-reports-output-action rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";

export default function ReportOutputActions({ reportType, markdownAvailable = false, documentOutputAvailable = false, disabled = false, feedback = "", primaryAction = null, secondaryAction = null, onCopyMarkdown, onDownloadMarkdown, onDownloadJson, onPrint }) {
  const markdown = reportSupportsOutput(reportType, "markdown");
  const json = reportSupportsOutput(reportType, "json");
  return (
    <div className="case-file-reports-output-actions">
      <div aria-label="Report output actions" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {primaryAction ? <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled} className={`${buttonClass} is-primary`}>{primaryAction.label}</button> : null}
        {secondaryAction ? <button type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled} className={buttonClass}>{secondaryAction.label}</button> : null}
        {markdown && markdownAvailable ? <button type="button" onClick={onCopyMarkdown} disabled={disabled} className={buttonClass}>Copy Markdown</button> : null}
        {markdown && documentOutputAvailable ? <button type="button" onClick={onDownloadMarkdown} disabled={disabled} className={buttonClass}>Download Markdown</button> : null}
        {json && documentOutputAvailable ? <button type="button" onClick={onDownloadJson} disabled={disabled} className={buttonClass}>Download JSON</button> : null}
        {reportSupportsOutput(reportType, "print") ? <button type="button" onClick={onPrint} disabled={disabled} className={`${buttonClass} is-print`}>Print / Save PDF</button> : null}
      </div>
      {feedback ? <p role="status" aria-live="polite" className="mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">{feedback}</p> : null}
    </div>
  );
}
