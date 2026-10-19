import { useRef, useState } from "react";

import DialogShell from "../shared/DialogShell.jsx";
import { normalizeSequenceGroupInput, validateSequenceGroupInput } from "./sequenceGroupManagement.js";

export default function SequenceGroupForm({
  mode = "create",
  initialValue = null,
  existingNames = [],
  parties = [],
  onSave,
  onCancel,
}) {
  const initial = normalizeSequenceGroupInput(initialValue || {});
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const initialFormFingerprintRef = useRef(JSON.stringify(initial));
  const nameInputRef = useRef(null);
  const title = mode === "edit" ? "Edit Issue" : "New Issue";

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = validateSequenceGroupInput(form, existingNames, mode === "edit" ? initial.name : "");
    if (result.error) {
      setError(result.error);
      return;
    }
    setError("");
    onSave(result.value);
  };

  const requestClose = () => {
    if (initialFormFingerprintRef.current !== JSON.stringify(form)) {
      setDiscardPromptOpen(true);
      return;
    }
    onCancel();
  };

  const footer = discardPromptOpen ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <p className="text-sm text-amber-100">Discard unsaved changes? This Issue has not been saved.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setDiscardPromptOpen(false)} className="proveit-record-secondary-action">Keep editing</button>
        <button type="button" onClick={onCancel} className="proveit-record-danger-action">Discard changes</button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={requestClose} className="proveit-record-secondary-action">Cancel</button>
      <button type="button" onClick={handleSubmit} className="proveit-record-primary-action">{mode === "edit" ? "Save changes" : "Create Issue"}</button>
    </div>
  );

  return (
    <DialogShell
      title={title}
      description="Create a flat Issue. Its permanent internal ID and human reference are assigned automatically."
      width="compact"
      onRequestClose={requestClose}
      dismissOnBackdrop={false}
      initialFocusRef={nameInputRef}
      footer={footer}
      className="proveit-issue-form-dialog"
    >
      <form onSubmit={handleSubmit} className="space-y-4">

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Name</span>
          <input
            ref={nameInputRef}
            value={form.name}
            onChange={(event) => {
              setForm((current) => ({ ...current, name: event.target.value }));
              if (error) setError("");
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "sequence-group-name-error" : undefined}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#2dd4bf]/25 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-[#2dd4bf] dark:focus:ring-[#2dd4bf]/30"
          />
          {error && <span id="sequence-group-name-error" className="mt-1 block text-sm font-medium text-red-700 dark:text-red-300">{error}</span>}
        </label>

        <label className="mt-4 block"><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Purpose</span><textarea value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-600 dark:bg-neutral-800" /></label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Status</span><select aria-label="Issue status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800">{[["open","Open"],["monitoring","Monitoring"],["waiting_response","Waiting for Response"],["escalated","Escalated"],["resolved","Resolved"],["archived","Archived"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Priority</span><select aria-label="Issue priority" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800">{["low","normal","high","critical"].map((value) => <option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label><label><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Owner</span><select aria-label="Issue owner" value={form.ownerPartyId} onChange={(event) => setForm((current) => ({ ...current, ownerPartyId: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800"><option value="">No owner</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.displayName || party.legalName || party.name || party.id}</option>)}</select></label><label><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Review date</span><input type="date" value={form.reviewDate} onChange={(event) => setForm((current) => ({ ...current, reviewDate: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800" /></label></div>
        <label className="mt-4 block"><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Current position</span><textarea value={form.currentPosition} onChange={(event) => setForm((current) => ({ ...current, currentPosition: event.target.value }))} rows={4} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-3 dark:border-neutral-600 dark:bg-neutral-800" /></label>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={5}
            className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#2dd4bf]/25 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-[#2dd4bf] dark:focus:ring-[#2dd4bf]/30"
          />
        </label>

      </form>
    </DialogShell>
  );
}
