const freshnessLabel = { current: "Current", stale: "Stale", unknown: "Unknown" };

export default function AiBriefPanel({ brief, freshness = "unknown", feedback = "", onCopy, onDownload }) {
  if (!brief) return null;
  const includedSources = brief.technicalSources.filter((source) => source.included);
  const unresolvedCount = brief.diagnostics?.unresolvedReferences?.length || 0;
  const isCurrent = freshness === "current";
  return (
    <section className="rounded-xl border border-teal-700/40 bg-teal-950/10 p-4 print:hidden" aria-labelledby="ai-brief-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="case-file-reports-eyebrow">External drafting source package</p>
          <h5 id="ai-brief-heading" className="mt-1 text-base font-bold">AI Brief prepared</h5>
          <p className="mt-1 text-sm">{brief.requestedReportFamily} · {brief.scope.label || "Whole case"} · {brief.recordReferences.length} record references</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-xs font-bold ${isCurrent ? "border-teal-600/60 text-teal-700 dark:text-teal-300" : "border-amber-600/60 text-amber-700 dark:text-amber-300"}`}>Source: {freshnessLabel[freshness] || "Unknown"}</span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="font-bold">Source revision</dt><dd>{brief.source.caseRevision || "Unknown"}</dd></div><div><dt className="font-bold">Source fingerprint</dt><dd className="break-all">{brief.source.sourceFingerprint || "Unknown"}</dd></div><div><dt className="font-bold">Technical sources</dt><dd>{includedSources.map((source) => source.label).join(", ") || "None"}</dd></div><div><dt className="font-bold">Unresolved references</dt><dd>{unresolvedCount}</dd></div></dl>
      <p className="mt-3 text-xs leading-5">Attachment binaries and data URLs are excluded. This package is read-only source material; it does not contact an external AI service or create a report revision.</p>
      {!isCurrent ? <p className="mt-2 text-sm font-semibold" role="status">This prepared brief is {freshnessLabel[freshness].toLowerCase()}. Regenerate it before treating it as current case context.</p> : null}
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onCopy} className="case-file-reports-utility-action">Copy AI Brief JSON</button><button type="button" onClick={onDownload} className="case-file-reports-utility-action">Download AI Brief JSON</button></div>
      <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Inspect AI Brief JSON</summary><pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-100">{JSON.stringify(brief, null, 2)}</pre></details>
      {feedback ? <p className="mt-3 text-sm font-medium" role="status" aria-live="polite">{feedback}</p> : null}
    </section>
  );
}
