import { useMemo, useState } from "react";
import StringListEditor from "../StringListEditor.jsx";
import LinkedPartiesSelector from "./LinkedPartiesSelector.jsx";
import { cleanupDeletedRecordLinks, generateId, normalizeRecord, normalizeWatchItem, WATCH_CATEGORIES, WATCH_PRIORITIES, WATCH_STATUSES } from "../../domain/caseDomain.js";
import { filterAndSortWatchItems, getWatchReviewState, isWatchItemUnlinked, prepareWatchItemForm } from "./watchWorkspaceHelpers.js";
import WatchItemCard from "./WatchItemCard.jsx";

const titleCase = (value) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const emptyFilters = { search: "", status: "all", category: "all", priority: "all", reviewState: "all", sort: "newest" };
const textFields = [["watchFor","What to Watch For"],["rationale","Why It Matters"],["latestObservation","Latest Observation"],["nextCheck","Next Check"],["outcome","Outcome"]];

function WatchEditor({ item, caseItem, onClose, onSave }) {
  const [form, setForm] = useState(() => prepareWatchItemForm(item));
  const records = ["incidents", "evidence", "documents", "ledger", "strategy"].flatMap((type) => (caseItem[type] || []).map((record) => ({ ...record, recordType: type })));
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const addObservation = () => set("observations", [...form.observations, { id: `watch-observation-${generateId()}`, date: form.date, text: "", createdAt: new Date().toISOString() }]);
  const save = () => {
    if (!form.title.trim()) return;
    onSave(normalizeWatchItem({ ...form, eventDate: form.date, updatedAt: new Date().toISOString(), observations: form.observations.filter((o) => o.text.trim()) }));
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" aria-label="Watch item editor" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><div><h2 className="text-xl font-semibold">{item ? "Edit Watch Item" : "Add Watch Item"}</h2><p className="text-sm text-neutral-500">Record an uncertain or developing matter without treating it as a confirmed incident.</p></div><button onClick={onClose} className="rounded-md border px-3 py-2">Close</button></div>
    <div className="space-y-6 p-5"><section className="grid gap-4 md:grid-cols-2"><label className="md:col-span-2 text-sm font-semibold">Title *<input autoFocus value={form.title} onChange={(e)=>set("title",e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>{[["status",WATCH_STATUSES],["category",["",...WATCH_CATEGORIES]],["priority",["",...WATCH_PRIORITIES]]].map(([field,options])=><label key={field} className="text-sm font-semibold capitalize">{field}<select value={form[field]} onChange={(e)=>set(field,e.target.value)} className="mt-1 w-full rounded-lg border p-2">{options.map((x)=><option key={x} value={x}>{x ? titleCase(x) : "None"}</option>)}</select></label>)}{[["date","Date"],["reviewDate","Review Date"],["sequenceGroup","Sequence Group"]].map(([field,label])=><label key={field} className="text-sm font-semibold">{label}<input type={field.includes("Date") || field === "date" ? "date" : "text"} value={form[field]} onChange={(e)=>set(field,e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>)}</section>
      <section className="grid gap-4 md:grid-cols-2">{textFields.map(([field,label])=><label key={field} className="text-sm font-semibold">{label}<textarea value={form[field]} onChange={(e)=>set(field,e.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-2" /></label>)}<div className="md:col-span-2"><StringListEditor label="Trigger Conditions" items={form.triggerConditions} onChange={(v)=>set("triggerConditions",v)} idPrefix="watch-trigger" /></div><div className="md:col-span-2"><StringListEditor label="Tags" items={form.tags} onChange={(v)=>set("tags",v)} idPrefix="watch-tags" /></div></section>
      <section className="grid gap-4 md:grid-cols-2"><LinkedPartiesSelector parties={caseItem.parties || []} linkedPartyIds={form.linkedPartyIds} onChange={(v)=>set("linkedPartyIds",v)} /><div><div className="text-xs font-bold uppercase text-neutral-400">Linked Records</div><div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border p-2">{records.map((record)=><label key={record.id} className="flex gap-2 text-sm"><input type="checkbox" checked={form.linkedRecordIds.includes(record.id)} onChange={(e)=>set("linkedRecordIds",e.target.checked?[...new Set([...form.linkedRecordIds,record.id])]:form.linkedRecordIds.filter((id)=>id!==record.id))}/><span>{record.title || record.label || record.id} <small className="text-neutral-400">({record.recordType})</small></span></label>)}</div></div></section>
      <section><div className="flex items-center justify-between"><h3 className="font-semibold">Observation History</h3><button onClick={addObservation} className="rounded-md border border-lime-500 px-3 py-1.5 text-sm font-semibold">Add dated observation</button></div><div className="mt-3 space-y-3">{form.observations.map((observation,index)=><div key={observation.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[10rem_1fr_auto]"><input type="date" value={observation.date} onChange={(e)=>set("observations",form.observations.map((o,i)=>i===index?{...o,date:e.target.value}:o))} className="rounded-md border p-2"/><textarea aria-label={`Observation ${index+1}`} value={observation.text} onChange={(e)=>set("observations",form.observations.map((o,i)=>i===index?{...o,text:e.target.value}:o))} className="rounded-md border p-2"/><button onClick={()=>set("observations",form.observations.filter((_,i)=>i!==index))} className="text-sm text-red-700">Remove</button></div>)}</div></section>
      {form.attachments.length > 0 && <section><h3 className="font-semibold">Attachments</h3><ul className="mt-2 text-sm">{form.attachments.map((a)=><li key={a.id || a.name}>{a.name || "Attachment"}</li>)}</ul></section>}
    </div><div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-4"><button onClick={onClose} className="rounded-md border px-4 py-2">Cancel</button><button disabled={!form.title.trim()} onClick={save} className="rounded-md bg-lime-500 px-4 py-2 font-semibold disabled:opacity-50">Save Watch Item</button></div>
  </div></div>;
}

export default function WatchWorkspace({ caseItem, onUpdateCase }) {
  const [filters, setFilters] = useState(emptyFilters); const [editing, setEditing] = useState(undefined);
  const items = useMemo(() => caseItem.watchItems || [], [caseItem.watchItems]); const today = new Date().toISOString().slice(0,10);
  const visible = useMemo(()=>filterAndSortWatchItems(items,filters,today),[items,filters,today]);
  const metrics = { total: items.length, watching: items.filter(i=>i.status==="watching").length, urgent: items.filter(i=>["high","critical"].includes(i.priority)).length, due: items.filter(i=>getWatchReviewState(i,today)==="due").length, overdue: items.filter(i=>getWatchReviewState(i,today)==="overdue").length, unlinked: items.filter(isWatchItemUnlinked).length };
  const save = (item) => { const exists=items.some(i=>i.id===item.id); onUpdateCase({...caseItem,watchItems:exists?items.map(i=>i.id===item.id?item:i):[item,...items],updatedAt:new Date().toISOString()}); setEditing(undefined); };
  const remove = (item) => { if (window.confirm(`Delete watch item “${item.title}”?`)) onUpdateCase(cleanupDeletedRecordLinks({...caseItem,watchItems:items.filter(i=>i.id!==item.id),updatedAt:new Date().toISOString()},"watchItems",item.id)); };
  const convert = (item,type) => { const now=new Date().toISOString(); const id=generateId(); const generated=normalizeRecord(type==="incidents"?{id,title:item.title,date:item.date,eventDate:item.date,description:item.latestObservation,notes:"Created from a developing watch item; review the date and description before treating it as confirmed.",linkedRecordIds:[item.id],source:"watch-conversion"}:{id,title:item.title,date:item.date,eventDate:item.date,objective:item.watchFor,rationale:item.rationale,risks:item.triggerConditions.map(text=>({text})),linkedRecordIds:[item.id],source:"watch-conversion"},type); onUpdateCase({...caseItem,[type]:[...(caseItem[type]||[]),generated],watchItems:items.map(i=>i.id===item.id?{...i,status:"escalated",linkedRecordIds:[...new Set([...i.linkedRecordIds,id])],updatedAt:now}:i),updatedAt:now}); };
  const changed=Object.entries(filters).some(([k,v])=>v!==emptyFilters[k]);
  const metricLabels = { total: "Total Items", watching: "Watching", urgent: "High / Critical", due: "Due", overdue: "Overdue", unlinked: "Unlinked" };
  const filterOptions = [["status",["all",...WATCH_STATUSES]],["category",["all",...WATCH_CATEGORIES]],["priority",["all",...WATCH_PRIORITIES]],["reviewState",["all","due","overdue","scheduled","unscheduled"]],["sort",["newest","oldest","updated","priority","review","sequence"]]];

  return <div className="space-y-6" data-watch-workspace="true">
    <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Monitoring Workspace</div>
          <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-neutral-100">To Watch</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Uncertain and developing matters that need observation.</p>
        </div>
        <button type="button" onClick={()=>setEditing(null)} className="rounded-xl border border-lime-500 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-lime-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a263a] dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-lime-950/30">Add Watch Item</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Object.entries(metrics).map(([key,value])=><div key={key} className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800"><div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{metricLabels[key]}</div><div className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{value}</div></div>)}
      </div>
    </section>

    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
        <label className="min-w-0 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Search
          <input type="search" aria-label="Search watch items" placeholder="Search watch items" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} className="mt-2 block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-[#7a263a] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"/>
        </label>
        {filterOptions.map(([field,options])=><label key={field} className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{titleCase(field)}<select aria-label={field} value={filters[field]} onChange={e=>setFilters({...filters,[field]:e.target.value})} className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">{options.map(x=><option key={x} value={x}>{titleCase(x)}</option>)}</select></label>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><span>{visible.length} of {items.length} watch items shown</span>{changed && <button type="button" onClick={()=>setFilters(emptyFilters)} className="font-semibold text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white">Reset Filters</button>}</div>
    </section>

    {items.length===0?<div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900"><p className="text-neutral-700 dark:text-neutral-300">No items are currently being watched.</p><button type="button" onClick={()=>setEditing(null)} className="mt-3 font-semibold text-lime-700 dark:text-lime-400">Add Watch Item</button></div>:visible.length===0?<div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900"><p className="text-neutral-700 dark:text-neutral-300">No watch items match the current filters.</p><button type="button" onClick={()=>setFilters(emptyFilters)} className="mt-3 font-semibold text-lime-700 dark:text-lime-400">Reset Filters</button></div>:<div className="space-y-4" data-watch-card-list="true">{visible.map(item=><WatchItemCard key={item.id} item={item} caseItem={caseItem} onEdit={setEditing} onDelete={remove} onConvert={convert}/>)}</div>}
    {editing!==undefined&&<WatchEditor item={editing} caseItem={caseItem} onClose={()=>setEditing(undefined)} onSave={save}/>}
  </div>;
}
