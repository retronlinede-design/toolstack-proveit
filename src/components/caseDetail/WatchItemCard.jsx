import { getRecordDisplayMeta } from "../../domain/linkingResolvers.js";

const label = (value) => String(value || "").replaceAll("_", " ");

function Section({ title, children, tone = "neutral" }) {
  return children ? <div className={`rounded-lg border p-3 ${tone === "trigger" ? "border-amber-200 bg-amber-50" : tone === "latest" ? "border-sky-200 bg-sky-50" : "border-neutral-200 bg-neutral-50"}`}><div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{title}</div><div className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{children}</div></div> : null;
}

export default function WatchItemCard({ item, caseItem, onEdit, onDelete, onConvert }) {
  const parties = (item.linkedPartyIds || []).map((id) => (caseItem.parties || []).find((party) => party.id === id)).filter(Boolean);
  const links = (item.linkedRecordIds || []).map((id) => getRecordDisplayMeta(caseItem, id)).filter(Boolean);
  return <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-neutral-950">{item.title || "Untitled watch item"}</h3><div className="mt-2 flex flex-wrap gap-2 text-xs">{[item.status, item.category, item.priority].filter(Boolean).map((value) => <span key={value} className="rounded-full bg-neutral-100 px-2 py-1 font-semibold capitalize">{label(value)}</span>)}</div></div><div className="flex flex-wrap gap-2"><button onClick={() => onEdit(item)} className="rounded-md border px-3 py-1.5 text-sm font-semibold">Edit</button><button onClick={() => onConvert(item, "incidents")} className="rounded-md border border-amber-300 px-3 py-1.5 text-sm font-semibold">Escalate to Incident</button><button onClick={() => onConvert(item, "strategy")} className="rounded-md border border-sky-300 px-3 py-1.5 text-sm font-semibold">Convert to Strategy</button><button onClick={() => onDelete(item)} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700">Delete</button></div></div>
    <div className="mt-4 grid gap-3 md:grid-cols-3"><Section title="What is being monitored">{item.watchFor}</Section><Section title="Escalation triggers" tone="trigger">{item.triggerConditions?.length ? item.triggerConditions.map((x) => `• ${x}`).join("\n") : ""}</Section><Section title="Latest development" tone="latest">{item.latestObservation}</Section></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Section title="Why it matters">{item.rationale}</Section><Section title="Next check">{item.nextCheck}</Section><Section title="Outcome">{item.outcome}</Section></div>
    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">{[["Date added", item.date],["Review date", item.reviewDate],["Sequence group", item.sequenceGroup],["Last updated", item.updatedAt],["Observations", item.observations?.length || 0],["Linked records", `${links.length}${item.linkedRecordIds?.length > links.length ? ` (${item.linkedRecordIds.length - links.length} missing)` : ""}`],["Related people", parties.map((p) => p.displayName || p.legalName).join(", ")],["Tags", item.tags?.join(", ")],["Attachments", item.attachments?.length || 0]].filter(([,v]) => v !== "" && v !== 0).map(([k,v]) => <div key={k}><dt className="text-[10px] font-bold uppercase text-neutral-400">{k}</dt><dd className="mt-0.5 text-neutral-700">{v}</dd></div>)}</dl>
  </article>;
}
