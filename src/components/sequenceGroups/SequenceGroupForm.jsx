import { useState } from "react";

import RecordActions from "../shared/RecordActions.jsx";
import { normalizeSequenceGroupInput, validateSequenceGroupInput } from "./sequenceGroupManagement.js";

export default function SequenceGroupForm({
  mode = "create",
  initialValue = null,
  existingNames = [],
  onSave,
  onCancel,
}) {
  const initial = normalizeSequenceGroupInput(initialValue || {});
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const title = mode === "edit" ? "Edit Sequence Group" : "New Sequence Group";

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
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <div>
          <h3 id="sequence-group-form-title" className="text-lg font-semibold text-neutral-950 dark:text-neutral-100">{title}</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Name and describe this record sequence. Assigned records remain unchanged unless the group is renamed.</p>
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
            { key: "save", label: mode === "edit" ? "Save Changes" : "Create Sequence Group", variant: "primary", onClick: handleSubmit },
          ]}
        />
      </form>
    </div>
  );
}
