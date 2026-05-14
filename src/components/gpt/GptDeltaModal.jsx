import { cleanGptPreviewText } from "./gptDeltaModalHelpers.js";

export default function GptDeltaModal({
  applying,
  backupPromptOpen,
  error,
  onApply,
  onCancel,
  onCancelBackupPrompt,
  onChangeText,
  onCreateBackupThenApply,
  onValidate,
  preview,
  text,
  validatedCase,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="text-xl font-semibold text-neutral-900">GPT Update</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Paste a ProveIt GPT delta, validate it, then review the supported changes before applying.
            gpt-delta-1.0 supports only actionSummary and strategy patches. gpt-delta-2.0 supports incident, evidence, document, and ledger creates, plus incident, evidence, document, ledger, and strategy patches.
            Use sequence-group-delta-1.0 for sequence group cleanup.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Do not include attachments, binary payloads, files, dataUrl, backupDataUrl, delete operations, schema changes, unsupported fields, guessed IDs, or partial array append instructions.
            If a record already exists, patch it instead of creating a new one. Duplicate-risk warnings are shown before apply.
            Enums: importance = unreviewed/critical/strong/supporting/weak; evidence relevance = high/medium/low.
          </div>
          <textarea
            value={text}
            onChange={onChangeText}
            placeholder='{"app":"proveit","contractVersion":"gpt-delta-1.0","target":{"caseId":"..."},"operations":{"patch":{}}}'
            className="min-h-52 w-full rounded-lg border border-neutral-300 p-3 font-mono text-sm text-neutral-800 outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-100"
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {backupPromptOpen && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="font-semibold">No recent full backup detected within the last 2 hours. Create a backup before applying GPT updates?</div>
              <p className="mt-1 text-xs leading-5">
                This creates a FULL_BACKUP_ALL download first, then applies the already validated GPT delta.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onCreateBackupThenApply}
                  disabled={applying}
                  className="rounded-md border border-amber-700 bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Create backup now &rarr; Apply delta
                </button>
                <button
                  type="button"
                  onClick={onCancelBackupPrompt}
                  disabled={applying}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              <h3 className="font-semibold text-neutral-900">Preview</h3>
              {preview.warnings?.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
                  <div className="mb-1 font-bold uppercase tracking-wide">Warnings</div>
                  <ul className="space-y-1">
                    {preview.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>- {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Case</span>
                  <span>{preview.caseName}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Case ID</span>
                  <span className="break-all font-mono text-xs">{preview.caseId}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Contract</span>
                  <span>{preview.contractVersion}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Supported Sections</span>
                  <span>{preview.supportedSections.join(", ")}</span>
                </div>
              </div>

              {preview.actionSummaryFields.length > 0 && (
                <div className="mt-4">
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Action Summary Fields
                  </span>
                  <span>{preview.actionSummaryFields.join(", ")}</span>
                </div>
              )}

              {preview.actionSummaryChanges?.length > 0 && (
                <div className="mt-4">
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Action Summary Changes
                  </span>
                  <div className="mt-2 space-y-2">
                    {preview.actionSummaryChanges.map((change) => (
                      <div key={change.field} className="rounded-md bg-white p-2">
                        <div className="text-xs font-bold text-neutral-800">{change.field}</div>
                        <div className="mt-1 grid gap-2 sm:grid-cols-2">
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-neutral-400">Before</span>
                            <pre className="whitespace-pre-wrap break-words font-sans text-xs text-neutral-600">{cleanGptPreviewText(change.before) || "-"}</pre>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase text-neutral-400">After</span>
                            <pre className="whitespace-pre-wrap break-words font-sans text-xs text-neutral-900">{cleanGptPreviewText(change.after) || "-"}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.strategyItems.length > 0 && (
                <div className="mt-4">
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Strategy Records Patched
                  </span>
                  <p>{preview.strategyItems.length} record(s)</p>
                  <ul className="mt-2 space-y-1">
                    {preview.strategyItems.map((item) => (
                      <li key={item.id} className="rounded-md bg-white px-2 py-1">
                        <span className="font-medium">{item.title}</span>
                        <span className="ml-2 break-all font-mono text-xs text-neutral-500">{item.id}</span>
                        {item.changes?.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {item.changes.map((change) => (
                              <div key={`${item.id}-${change.field}`} className="rounded border border-neutral-100 bg-neutral-50 p-2">
                                <div className="text-xs font-bold text-neutral-800">{change.field}</div>
                                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <span className="block text-[10px] font-bold uppercase text-neutral-400">Before</span>
                                    <pre className="whitespace-pre-wrap break-words font-sans text-xs text-neutral-600">{cleanGptPreviewText(change.before) || "-"}</pre>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold uppercase text-neutral-400">After</span>
                                    <pre className="whitespace-pre-wrap break-words font-sans text-xs text-neutral-900">{cleanGptPreviewText(change.after) || "-"}</pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.patchedRecords?.length > 0 && (
                <div className="mt-4">
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Records To Patch
                  </span>
                  <ul className="mt-2 space-y-2">
                    {preview.patchedRecords.map((item) => (
                      <li key={`${item.section}-${item.id}`} className="rounded-md bg-white p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-500">{item.recordType}</span>
                          <span className="font-medium">{item.title}</span>
                          <span className="break-all font-mono text-xs text-neutral-500">{item.id}</span>
                        </div>
                        {item.changes?.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {item.changes.map((change) => (
                              <div key={`${item.section}-${item.id}-${change.field}`} className="rounded border border-neutral-100 bg-neutral-50 p-2">
                                <div className="text-xs font-bold text-neutral-800">{change.field}</div>
                                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <span className="block text-[10px] font-bold uppercase text-neutral-400">Before</span>
                                    <pre className="whitespace-pre-wrap break-words font-sans text-xs text-neutral-600">{cleanGptPreviewText(change.before) || "-"}</pre>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] font-bold uppercase text-neutral-400">After</span>
                                    <pre className="whitespace-pre-wrap break-words font-sans text-xs text-neutral-900">{cleanGptPreviewText(change.after) || "-"}</pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.createdRecords?.length > 0 && (
                <div className="mt-4">
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Records To Create
                  </span>
                  <ul className="mt-2 space-y-2">
                    {preview.createdRecords.map((item) => (
                      <li key={item.id} className="rounded-md bg-white p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-500">{item.recordType}</span>
                          <span className="font-medium">{item.title}</span>
                          <span className="break-all font-mono text-xs text-neutral-500">{item.id}</span>
                        </div>
                        {item.tempId && (
                          <div className="mt-1 text-xs text-neutral-500">
                            tempId <span className="font-mono">{item.tempId}</span>
                          </div>
                        )}
                        {item.links && Object.keys(item.links).length > 0 && (
                          <div className="mt-2 text-xs text-neutral-600">
                            <span className="font-semibold text-neutral-800">Links:</span>{" "}
                            {Object.entries(item.links).map(([field, value]) => (
                              <span key={`${item.id}-${field}`} className="mr-2">
                                {field}: <span className="font-mono">{Array.isArray(value) ? value.map((link) => typeof link === "object" ? JSON.stringify(link) : link).join(", ") : String(value)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.tempIdMappings?.length > 0 && (
                <div className="mt-4">
                  <span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Temp ID Mapping
                  </span>
                  <ul className="mt-2 space-y-1">
                    {preview.tempIdMappings.map((item) => (
                      <li key={item.tempId} className="rounded-md bg-white px-2 py-1 font-mono text-xs">
                        {item.tempId} -&gt; {item.finalId}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
                gpt-delta-2.0 does not support actionSummary patches or strategy creates. Patch IDs must be existing record IDs; create links may use tempId values that are declared in the same delta.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 p-5">
          <button
            onClick={onCancel}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={onValidate}
            className="rounded-md border border-lime-500 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-lime-400/30"
          >
            Validate
          </button>
          <button
            onClick={onApply}
            disabled={!validatedCase || applying}
            className="rounded-md border border-lime-600 bg-lime-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-lime-600 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            {applying ? "Applying..." : "Apply Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
