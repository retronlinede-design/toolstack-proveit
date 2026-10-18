import { useRef, useState } from "react";
import DialogShell from "../shared/DialogShell.jsx";

function actionSummaryDraftFingerprint(form) {
  return JSON.stringify(form);
}

export default function ActionSummaryModal({
  open,
  form,
  onChangeField,
  onCancel,
  onSave,
}) {
  const initialFingerprintRef = useRef(actionSummaryDraftFingerprint(form));
  const nextActionsRef = useRef(null);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (!open) return null;

  const requestClose = () => {
    if (saving) return;
    if (initialFingerprintRef.current !== actionSummaryDraftFingerprint(form)) {
      setDiscardPromptOpen(true);
      return;
    }
    onCancel();
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await onSave?.();
      if (saved) {
        initialFingerprintRef.current = actionSummaryDraftFingerprint(form);
        onCancel();
        return;
      }
      setSaveError("The Action Summary could not be saved. Your changes are still available to review.");
    } catch (error) {
      setSaveError(error?.message || "The Action Summary could not be saved. Your changes are still available to review.");
    } finally {
      setSaving(false);
    }
  };

  const footer = discardPromptOpen ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <p className="text-sm text-amber-100">Discard unsaved Action Summary changes?</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setDiscardPromptOpen(false)} className="proveit-record-secondary-action">Keep editing</button>
        <button type="button" onClick={onCancel} className="proveit-record-danger-action">Discard changes</button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={requestClose} disabled={saving} className="proveit-record-secondary-action">Cancel</button>
      <button type="button" onClick={save} disabled={saving} className="proveit-record-primary-action">{saving ? "Saving…" : "Save"}</button>
    </div>
  );

  return (
    <DialogShell
      title="Edit Action Summary"
      description="Keep this as the short, immediate list of executable work. Put one item on each line."
      width="standard"
      onRequestClose={requestClose}
      dismissOnBackdrop={false}
      initialFocusRef={nextActionsRef}
      statusMessage={saveError}
      footer={footer}
      className="proveit-action-summary-dialog"
    >
      <div className="space-y-5">
        <section className="proveit-action-summary-primary-section rounded-lg border p-4">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Next Actions
            <textarea
              ref={nextActionsRef}
              placeholder={"Call housing office\nSend evidence pack\nCheck reply deadline"}
              value={form.nextActions}
              onChange={(event) => onChangeField("nextActions", event.target.value)}
              className="mt-2 min-h-36 w-full rounded-lg border p-3 text-sm"
            />
          </label>
        </section>

        <section className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider">
            Current Focus
            <textarea
              placeholder="What matters most right now?"
              value={form.currentFocus}
              onChange={(event) => onChangeField("currentFocus", event.target.value)}
              className="mt-2 min-h-24 w-full rounded-lg border p-3 text-sm"
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider">
              Important Reminders
              <textarea
                placeholder={"One reminder per line\nKey facts\nConstraints"}
                value={form.importantReminders}
                onChange={(event) => onChangeField("importantReminders", event.target.value)}
                className="mt-2 min-h-32 w-full rounded-lg border p-3 text-sm"
              />
            </label>
          </div>

          <div className="proveit-action-summary-deferred space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider">Critical Deadlines</div>
            <div className="min-h-32 rounded-lg border border-dashed p-3 text-sm">
              GPT updates may include criticalDeadlines in actionSummary. Manual deadline editing is not wired in this panel yet.
            </div>
          </div>
        </section>
      </div>
    </DialogShell>
  );
}
