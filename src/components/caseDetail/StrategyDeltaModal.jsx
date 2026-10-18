import { useRef } from "react";
import DialogShell from "../shared/DialogShell.jsx";

export default function StrategyDeltaModal({
  text,
  error,
  validation,
  selectedIndexes,
  staleConfirmed,
  onChangeText,
  onValidate,
  onToggleProposal,
  onStaleConfirm,
  onApply,
  onClose,
}) {
  const inputRef = useRef(null);
  const proposals = validation?.planned || [];

  return (
    <DialogShell
      title="Update Strategy from AI"
      description="Paste a Strategy Delta, review each proposal, and apply only the selected low-risk Strategy changes."
      width="wide"
      onRequestClose={onClose}
      dismissOnBackdrop={false}
      initialFocusRef={inputRef}
      className="proveit-strategy-delta-dialog"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="proveit-strategy-delta-secondary-action">
            Cancel
          </button>
          <button type="button" onClick={onValidate} className="proveit-strategy-delta-secondary-action">
            Validate
          </button>
          <button
            type="button"
            disabled={!validation || selectedIndexes.length === 0 || (validation.stale && !staleConfirmed)}
            onClick={onApply}
            className="proveit-strategy-delta-primary-action"
          >
            Apply selected ({selectedIndexes.length})
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="proveit-strategy-delta-notice rounded-lg border p-3 text-xs leading-5">
          ProveIt remains authoritative. This workflow cannot delete records, alter Goals, change Strategy status
          or decision status, or modify non-Strategy case data.
        </div>

        <label className="block" htmlFor="strategy-delta-input">
          <span className="mb-2 block text-sm font-semibold">Strategy Delta JSON</span>
          <textarea
            ref={inputRef}
            id="strategy-delta-input"
            value={text}
            onChange={(event) => onChangeText(event.target.value)}
            placeholder='{"contract":"proveit-strategy-delta","version":"1.0",...}'
            className="proveit-strategy-delta-input min-h-48 w-full rounded-lg border p-3 font-mono text-sm"
          />
        </label>

        {error && (
          <div className="proveit-strategy-delta-error rounded-lg border p-3 text-sm font-medium" role="alert">
            {error}
          </div>
        )}

        {validation?.stale && (
          <div className="proveit-strategy-delta-warning rounded-lg border p-3 text-sm leading-6">
            <strong>Stale AI context.</strong> This case is now revision {validation.currentRevision}, while the AI
            used revision {validation.baseRevision}. Review the proposals carefully; ProveIt will not merge conflicts
            automatically.
            <label className="mt-3 flex items-start gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={staleConfirmed}
                onChange={(event) => onStaleConfirm(event.target.checked)}
              />
              I understand this stale-context warning and still want to apply selected proposals.
            </label>
          </div>
        )}

        {validation && (
          <section
            className="proveit-strategy-delta-review space-y-3 rounded-lg border p-4"
            aria-labelledby="strategy-delta-review-heading"
          >
            <h3 id="strategy-delta-review-heading" className="font-semibold">
              Proposal review
            </h3>
            {proposals.map((proposal) => (
              <label
                key={proposal.index}
                className="proveit-strategy-delta-proposal block rounded-lg border p-3"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIndexes.includes(proposal.index)}
                    onChange={(event) => onToggleProposal(proposal.index, event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{proposal.preview.title}</div>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <span className="proveit-strategy-delta-label font-bold uppercase">Current</span>
                        <p className="proveit-strategy-delta-before mt-1 whitespace-pre-wrap">
                          {proposal.preview.before || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="proveit-strategy-delta-label font-bold uppercase">Proposed</span>
                        <p className="proveit-strategy-delta-after mt-1 whitespace-pre-wrap">
                          {proposal.preview.after || "—"}
                        </p>
                      </div>
                    </div>
                    {proposal.preview.reason && (
                      <p className="proveit-strategy-delta-before mt-2 text-xs">
                        <strong>Reason:</strong> {proposal.preview.reason}
                      </p>
                    )}
                    {proposal.preview.detail && (
                      <p className="proveit-strategy-delta-before mt-2 text-xs">
                        New Strategy fields: {Object.keys(proposal.preview.detail).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </section>
        )}
      </div>
    </DialogShell>
  );
}
