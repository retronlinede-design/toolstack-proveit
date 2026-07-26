import { useState } from "react";
import RecordActions from "../shared/RecordActions.jsx";
import RecordBadge from "../shared/RecordBadge.jsx";
import { normalizeSequenceGroupInput, validateSequenceGroupInput } from "./sequenceGroupManagement.js";

export default function SequenceGroupDetailsForm({ group, description, existingNames, summary, onSave }) {
  const [form, setForm] = useState(() => normalizeSequenceGroupInput({ name: group.name, description }));
  const [error, setError] = useState("");

  const submit = async (event) => {
    event?.preventDefault?.();
    const result = validateSequenceGroupInput(form, existingNames, group.name);
    if (result.error) return setError(result.error);
    setError("");
    await onSave(result.value);
  };

  return <form onSubmit={submit} className="space-y-5">
    <div className="flex flex-wrap gap-2">
      <RecordBadge variant="status-neutral">{summary.total} records</RecordBadge>
      <RecordBadge variant={summary.missingDates ? "status-warning" : "status-positive"}>{summary.missingDates ? `${summary.missingDates} missing dates` : "All dates present"}</RecordBadge>
      <RecordBadge variant="status-neutral">{summary.dateRange}</RecordBadge>
      <RecordBadge variant="status-neutral">{summary.status}</RecordBadge>
    </div>
    <div className="grid gap-2 sm:grid-cols-5">{Object.entries(summary.counts).map(([label, count]) => <div key={label} className="rounded-lg border border-neutral-200 p-2 text-center dark:border-neutral-700"><div className="text-lg font-semibold">{count}</div><div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div></div>)}</div>
    <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Group name</span><input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "manage-group-name-error" : undefined} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7a263a]/30 dark:border-neutral-600 dark:bg-neutral-800" />{error && <span id="manage-group-name-error" className="mt-1 block text-sm font-medium text-red-700 dark:text-red-300">{error}</span>}</label>
    <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Description</span><textarea rows={7} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7a263a]/30 dark:border-neutral-600 dark:bg-neutral-800" /></label>
    <RecordActions className="flex justify-end" actions={[{ key: "save-details", label: "Save Details", variant: "primary", onClick: submit }]} />
  </form>;
}
