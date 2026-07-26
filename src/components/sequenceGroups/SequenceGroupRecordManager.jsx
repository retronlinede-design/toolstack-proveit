import { useMemo, useState } from "react";
import RecordActions from "../shared/RecordActions.jsx";
import RecordBadge from "../shared/RecordBadge.jsx";
import SequenceGroupOperationSummary from "./SequenceGroupOperationSummary.jsx";
import { validateSequenceGroupInput } from "./sequenceGroupManagement.js";
import { filterSequenceGroupRecords, getSequenceGroupRecordKey as recordKey, selectVisibleSequenceGroupRecords, toggleSequenceGroupRecordSelection } from "./sequenceGroupRecordSelection.js";

const TYPE_LABELS = { incidents: "Incident", evidence: "Evidence", documents: "Document", strategy: "Strategy", watchItems: "To Watch" };

export default function SequenceGroupRecordManager({ group, groups, onOpenRecord, onOperation }) {
  const records = useMemo(() => Object.entries(group.records || {}).flatMap(([recordType, items]) => (items || []).map((item, index) => ({ ...item, recordType, position: index + 1 }))), [group]);
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [destination, setDestination] = useState("");
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const otherGroups = groups.filter((item) => item.name !== group.name);
  const statuses = [...new Set(records.map((record) => record.status).filter(Boolean))].sort();
  const visible = filterSequenceGroupRecords(records, { search, type, status, missingOnly, selectedOnly }, selected);
  const refs = records.filter((record) => selected.has(recordKey(record))).map((record) => ({ recordType: record.recordType, recordId: record.id }));
  const toggle = (key) => setSelected((current) => toggleSequenceGroupRecordSelection(current, key));
  const selectVisible = () => setSelected((current) => selectVisibleSequenceGroupRecords(current, visible));
  const destinationGroup = otherGroups.find((item) => item.name === destination);

  const moveExisting = async () => {
    if (!destination || refs.length === 0) return setError("Select records and a destination group.");
    if (await onOperation({ type: "move-records", sourceGroup: group.name, destinationGroup: destination, recordRefs: refs })) { setSelected(new Set()); setError(""); }
  };
  const split = async () => {
    const validation = validateSequenceGroupInput(newGroup, groups.map((item) => item.name));
    if (validation.error) return setError(validation.error);
    if (refs.length === 0) return setError("Select at least one record to split.");
    if (await onOperation({ type: "split-records", sourceGroup: group.name, destinationGroup: validation.value.name, destinationDescription: validation.value.description, recordRefs: refs })) { setSelected(new Set()); setNewGroup({ name: "", description: "" }); setError(""); }
  };
  const remove = async () => {
    if (refs.length === 0) return setError("Select at least one record to remove.");
    if (await onOperation({ type: "remove-records", sourceGroup: group.name, recordRefs: refs })) { setSelected(new Set()); setError(""); }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <input aria-label="Search group records" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or summary" className="min-w-52 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800" />
      <select aria-label="Filter by record type" value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"><option value="all">All types</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"><option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Missing date</label>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selectedOnly} onChange={(e) => setSelectedOnly(e.target.checked)} /> Selected only</label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong>{selected.size} of {records.length} records selected</strong><RecordActions actions={[{ key: "select-visible", label: `Select all visible (${visible.length})`, onClick: selectVisible, disabled: visible.length === 0 }, { key: "clear", label: "Clear selection", onClick: () => setSelected(new Set()), disabled: selected.size === 0 }]} /></div>
    <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
      {visible.map((record) => <div key={recordKey(record)} className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto] ${selected.has(recordKey(record)) ? "border-[#7a263a] bg-[#7a263a]/5 dark:border-[#a94b63]" : "border-neutral-200 dark:border-neutral-700"}`}>
        <input type="checkbox" aria-label={`Select ${record.title}`} checked={selected.has(recordKey(record))} onChange={() => toggle(recordKey(record))} className="mt-1 h-5 w-5" />
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><RecordBadge variant="type">{TYPE_LABELS[record.recordType]}</RecordBadge>{record.status && <RecordBadge variant="status-neutral">{record.status}</RecordBadge>}<span className="text-xs text-neutral-500">Position {record.position}</span></div><div className="mt-1 font-semibold text-neutral-900 dark:text-neutral-100">{record.title}</div><div className="text-xs text-neutral-500 dark:text-neutral-400">{record.date || "Missing date"}</div>{record.summary && <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">{record.summary}</p>}</div>
        <RecordActions actions={[{ key: "open", label: "Open / Edit", onClick: () => onOpenRecord(record) }]} />
      </div>)}
      {visible.length === 0 && <p className="rounded-lg border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-500 dark:border-neutral-700">{records.length === 0 ? "This sequence group currently contains no records." : "No records match these filters."}</p>}
    </div>
    {selected.size > 0 && <div className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
      <SequenceGroupOperationSummary operation="Manage selected records" source={group.name} destination={destination} affected={selected.size} remaining={records.length - selected.size} resulting={destinationGroup ? destinationGroup.totalCount + selected.size : undefined} />
      <div className="flex flex-wrap gap-2"><select aria-label="Destination group" value={destination} onChange={(e) => setDestination(e.target.value)} className="min-h-11 flex-1 rounded-lg border border-neutral-300 bg-white px-3 dark:border-neutral-600 dark:bg-neutral-800"><option value="">Choose another group</option>{otherGroups.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.totalCount})</option>)}</select><RecordActions actions={[{ key: "move", label: "Move to Group", variant: "primary", onClick: moveExisting, disabled: !destination }]} /></div>
      <div className="grid gap-2 sm:grid-cols-2"><input aria-label="New group name" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="New group name" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" /><input aria-label="New group description" value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} placeholder="Description (optional)" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800" /></div>
      <RecordActions actions={[{ key: "split", label: "Split Selected Records into New Group", variant: "secondary", onClick: split }, { key: "remove", label: "Remove from Group", variant: "danger", onClick: remove }]} />
      {error && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
    </div>}
  </div>;
}
