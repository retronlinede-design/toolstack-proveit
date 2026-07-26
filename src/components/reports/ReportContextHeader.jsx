const COMPLETENESS = {
  complete: { label: "Complete report", description: "Contains all records included by this report type and selected scope." },
  bounded: { label: "Bounded overview", description: "Some sections use preview limits and do not form a complete case schedule." },
  summary: { label: "Summary report", description: "Designed for concise communication rather than exhaustive record listing." },
};

const OUTPUT_LABELS = { preview: "Preview", markdown: "Markdown", json: "JSON", print: "print" };
const RECORD_LABELS = { incident: "Incidents", evidence: "Evidence records", document: "Documents", ledger: "Ledger entries", strategy: "Strategy records", watch: "To Watch records", party: "Parties" };

function formatGenerated(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(date);
}

export default function ReportContextHeader({ definition, scopeLabel, countLabel = "", reportDocument = null }) {
  const completeness = COMPLETENESS[definition?.completeness] || COMPLETENESS.summary;
  const outputs = (definition?.supportedOutputs || []).map((item) => OUTPUT_LABELS[item]).filter(Boolean);
  const includes = (definition?.recordTypes || []).map((item) => RECORD_LABELS[item] || item).join(", ");
  const fingerprint = reportDocument?.source?.sourceRevision?.fingerprint || "";
  const generatedAt = reportDocument?.report?.generatedAt || "";
  return (
    <section aria-labelledby="selected-report-title" className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Selected report</p>
          <h4 id="selected-report-title" className="mt-1 text-xl font-bold text-neutral-950 dark:text-neutral-50">{definition?.label || "Report"}</h4>
          <p className="mt-1 text-sm font-semibold text-neutral-700 dark:text-neutral-200">{[completeness.label, scopeLabel, countLabel].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{completeness.description}</p>
        </div>
        {reportDocument ? (
          <div className="shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
            <div title={fingerprint}><span className="font-semibold">Source revision:</span> {fingerprint ? fingerprint.slice(0, 8) : "Unavailable"}</div>
            <div><span className="font-semibold">Generated:</span> {formatGenerated(generatedAt) || "Unavailable"}</div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600 sm:grid-cols-2 dark:border-neutral-800 dark:text-neutral-300">
        <div><span className="font-semibold text-neutral-800 dark:text-neutral-100">Includes:</span> {includes || "Report-specific case information"}</div>
        <div><span className="font-semibold text-neutral-800 dark:text-neutral-100">Available outputs:</span> {outputs.join(", ") || "Preview"}</div>
      </div>
    </section>
  );
}
