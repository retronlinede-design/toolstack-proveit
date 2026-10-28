const freshnessLabel = { current: "Current", stale: "Stale", unknown: "Unknown" };

function ValidationList({ title, entries, tone = "text-neutral-700 dark:text-neutral-200" }) {
  if (!entries?.length) return null;
  return <section className={`mt-3 text-sm ${tone}`}><h6 className="font-bold">{title}</h6><ul className="mt-1 list-disc space-y-1 pl-5">{entries.map((entry, index) => <li key={`${entry.code || title}-${index}`}><strong>{entry.code || "Review"}</strong>: {entry.message || entry}</li>)}</ul></section>;
}

export default function AiBriefPanel({ brief, freshness = "unknown", feedback = "", onCopy, onDownload, onCopyDraftingRequest, draftText = "", onDraftTextChange, onValidateDraft, draftValidation = null, draftFeedback = "", onPreviewManagementDraft, managementPreviewAvailable = false }) {
  if (!brief) return null;
  const includedSources = brief.technicalSources.filter((source) => source.included);
  const unresolvedCount = brief.diagnostics?.unresolvedReferences?.length || 0;
  const isCurrent = freshness === "current";
  const normalisedDraft = draftValidation?.normalisedDraft;
  const classifications = [...new Set((normalisedDraft?.claims || []).map((claim) => claim.classification))];
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
      {!isCurrent ? <p className="mt-2 text-sm font-semibold" role="status">This prepared brief is {freshnessLabel[freshness].toLowerCase()}. Regenerate it before treating it as current case context or copying a new drafting request. Historical draft validation remains available against this exact Brief.</p> : null}
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onCopy} className="case-file-reports-utility-action">Copy AI Brief JSON</button><button type="button" onClick={onDownload} className="case-file-reports-utility-action">Download AI Brief JSON</button><button type="button" onClick={onCopyDraftingRequest} disabled={!isCurrent} className="case-file-reports-utility-action">Copy Drafting Request</button></div>
      <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Inspect AI Brief JSON</summary><pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-100">{JSON.stringify(brief, null, 2)}</pre></details>
      {feedback ? <p className="mt-3 text-sm font-medium" role="status" aria-live="polite">{feedback}</p> : null}
      <section className="mt-5 border-t border-teal-700/30 pt-4" aria-labelledby="ai-draft-validation-heading">
        <p className="case-file-reports-eyebrow">AI Draft validation</p>
        <h6 id="ai-draft-validation-heading" className="mt-1 text-base font-bold">Paste and validate AI Draft JSON</h6>
        <p className="mt-1 text-sm">Validation checks this pasted, untrusted draft against the exact prepared Brief. It checks structure and traceability, not factual truth or approval.</p>
        <label className="mt-3 block text-sm font-semibold" htmlFor="ai-draft-json">AI Draft JSON<textarea id="ai-draft-json" value={draftText} onChange={(event) => onDraftTextChange?.(event.target.value)} className="mt-1 block min-h-44 w-full rounded-lg border border-slate-400 bg-white p-3 font-mono text-xs text-slate-950 dark:bg-slate-950 dark:text-slate-100" spellCheck="false" placeholder="Paste one proveit.ai-draft v1 JSON object." /></label>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onValidateDraft} disabled={!draftText.trim()} className="case-file-reports-utility-action">Validate AI Draft</button>{brief.requestedReportFamily === "management" ? <button type="button" onClick={onPreviewManagementDraft} disabled={!managementPreviewAvailable} className="case-file-reports-utility-action">Preview Management Draft</button> : null}</div>
        {draftFeedback ? <p className="mt-3 text-sm font-medium" role="status" aria-live="polite">{draftFeedback}</p> : null}
        {draftValidation ? <section className={`mt-3 rounded-lg border p-3 text-sm ${draftValidation.valid ? "border-teal-700/40 bg-teal-950/10" : "border-amber-700/40 bg-amber-950/10"}`} aria-label="AI Draft validation result">
          <p className="font-bold">{draftValidation.valid ? (isCurrent ? "Structurally valid against the current-source AI Brief" : `Structurally valid against the historical AI Brief; source is ${freshnessLabel[freshness].toLowerCase()}`) : "AI Draft validation failed"}</p>
          <p className="mt-1 text-xs">A valid result confirms structural and source-reference integrity only. It does not establish that narrative claims are true, verified, or approved.</p>
          {!isCurrent && draftValidation.valid ? <p className="mt-2 font-semibold" role="status">This draft is not ready for approval because its source Brief is not current.</p> : null}
          {brief.requestedReportFamily === "management" && draftValidation.valid ? <p className="mt-2 text-xs">The preview is local only. It is not saved, approved, printed, or exported, and never replaces the live Management Report.</p> : null}
          <ValidationList title="Binding and reference errors" entries={draftValidation.errors} tone="text-red-800 dark:text-red-200" />
          <ValidationList title="Human-review warnings" entries={draftValidation.warnings} tone="text-amber-800 dark:text-amber-200" />
          {draftValidation.reviewReasons?.length ? <section className="mt-3"><h6 className="font-bold">Human review required</h6><ul className="mt-1 list-disc space-y-1 pl-5 text-xs">{draftValidation.reviewReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section> : null}
          {normalisedDraft ? <><p className="mt-3 text-xs"><strong>Claim classifications:</strong> {classifications.join(", ") || "None"} · <strong>Source references:</strong> {(normalisedDraft.claims || []).reduce((total, claim) => total + (claim.sourceReferences?.length || 0), 0)} · <strong>Unresolved questions:</strong> {normalisedDraft.unresolvedQuestions?.length || 0} · <strong>Evidence gaps:</strong> {normalisedDraft.evidenceGaps?.length || 0}</p><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Inspect validated draft structure</summary><pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-100">{JSON.stringify(normalisedDraft, null, 2)}</pre></details></> : null}
        </section> : null}
      </section>
    </section>
  );
}
