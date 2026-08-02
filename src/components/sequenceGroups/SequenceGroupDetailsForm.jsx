import { useState } from "react";
import RecordActions from "../shared/RecordActions.jsx";
import RecordBadge from "../shared/RecordBadge.jsx";
import { normalizeSequenceGroupInput, validateSequenceGroupInput } from "./sequenceGroupManagement.js";

export default function SequenceGroupDetailsForm({ group, issue, parties = [], description, existingNames, summary, onSave }) {
  const [form, setForm] = useState(() => normalizeSequenceGroupInput({ ...issue, name: group.name, description: issue?.description || description }));
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
    {issue?.reference && <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800"><div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Reference</div><div className="mt-1 font-semibold">{issue.reference}</div><p className="mt-1 text-xs text-neutral-500">Permanent and read-only. Internal ID: <span className="break-all font-mono">{issue.id}</span></p></div>}
    <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Issue name</span><input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "manage-group-name-error" : undefined} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7a263a]/30 dark:border-neutral-600 dark:bg-neutral-800" />{error && <span id="manage-group-name-error" className="mt-1 block text-sm font-medium text-red-700 dark:text-red-300">{error}</span>}</label>
    <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Purpose</span><textarea rows={3} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800" /></label>
    <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Description</span><textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7a263a]/30 dark:border-neutral-600 dark:bg-neutral-800" /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Status</span><select aria-label="Issue status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800">{[["open","Open"],["monitoring","Monitoring"],["waiting_response","Waiting for Response"],["escalated","Escalated"],["resolved","Resolved"],["archived","Archived"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Priority</span><select aria-label="Issue priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800">{["low","normal","high","critical"].map((value) => <option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label><label><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Owner</span><select aria-label="Issue owner" value={form.ownerPartyId} onChange={(e) => setForm({ ...form, ownerPartyId: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800"><option value="">No owner</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.displayName || party.legalName || party.name || party.id}</option>)}</select></label><label><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Review date</span><input type="date" value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800" /></label></div>
    <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Current position</span><textarea rows={5} value={form.currentPosition} onChange={(e) => setForm({ ...form, currentPosition: e.target.value })} className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800" /><span className="mt-1 block text-xs text-neutral-500">User-authored context; it is not automatically verified.</span></label>
    <RecordActions className="flex justify-end" actions={[{ key: "save-details", label: "Save Details", variant: "primary", onClick: submit }]} />
  </form>;
}
