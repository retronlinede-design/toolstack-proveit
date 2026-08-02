import { useState } from "react";

import RecordActions from "../shared/RecordActions.jsx";
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="sequence-group-form-title">
      <form onSubmit={handleSubmit} className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <div>
          <h3 id="sequence-group-form-title" className="text-lg font-semibold text-neutral-950 dark:text-neutral-100">{title}</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Create a flat Issue. Its permanent internal ID and human reference are assigned automatically.</p>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Name</span>
          <input
            autoFocus
            value={form.name}
            onChange={(event) => {
              setForm((current) => ({ ...current, name: event.target.value }));
              if (error) setError("");
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "sequence-group-name-error" : undefined}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#7a263a] focus:ring-2 focus:ring-[#7a263a]/25 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-[#a94b63] dark:focus:ring-[#a94b63]/30"
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
            className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#7a263a] focus:ring-2 focus:ring-[#7a263a]/25 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-[#a94b63] dark:focus:ring-[#a94b63]/30"
          />
        </label>

        <RecordActions
          className="mt-5 flex flex-col-reverse gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end dark:border-neutral-800"
          actions={[
            { key: "cancel", label: "Cancel", onClick: onCancel },
            { key: "save", label: mode === "edit" ? "Save Changes" : "Create Issue", variant: "primary", onClick: handleSubmit },
          ]}
        />
      </form>
    </div>
  );
}
