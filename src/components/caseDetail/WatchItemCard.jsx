import { getRecordDisplayMeta } from "../../domain/linkingResolvers.js";
import RecordActions from "../shared/RecordActions.jsx";
import RecordBadge from "../shared/RecordBadge.jsx";
import RecordMetadataRow from "../shared/RecordMetadataRow.jsx";

const label = (value) => String(value || "").replaceAll("_", " ");

function getWatchStatusBadgeVariant(status) {
  if (status === "resolved") return "status-positive";
  if (status === "escalated") return "status-warning";
  return "status-neutral";
}

function getWatchPriorityBadgeVariant(priority) {
  switch (priority) {
    case "critical": return "priority-critical";
    case "high": return "priority-high";
    case "medium": return "priority-medium";
    default: return "priority-low";
  }
}

function Section({ title, children, tone = "neutral" }) {
  return children ? <div className={`rounded-lg border p-3 ${tone === "trigger" ? "border-amber-200 bg-amber-50" : tone === "latest" ? "border-sky-200 bg-sky-50" : "border-neutral-200 bg-neutral-50"}`}><div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{title}</div><div className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{children}</div></div> : null;
}

export default function WatchItemCard({ item, caseItem, onEdit, onDelete, onConvert }) {
  const parties = (item.linkedPartyIds || []).map((id) => (caseItem.parties || []).find((party) => party.id === id)).filter(Boolean);
  const links = (item.linkedRecordIds || []).map((id) => getRecordDisplayMeta(caseItem, id)).filter(Boolean);
  return <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-neutral-950">{item.title || "Untitled watch item"}</h3><div className="mt-2 flex flex-wrap gap-2 text-xs">{item.status && <RecordBadge variant={getWatchStatusBadgeVariant(item.status)} className="capitalize">{label(item.status)}</RecordBadge>}{item.category && <RecordBadge variant="type" className="capitalize">{label(item.category)}</RecordBadge>}{item.priority && <RecordBadge variant={getWatchPriorityBadgeVariant(item.priority)} className="capitalize">{label(item.priority)}</RecordBadge>}</div></div><RecordActions className="flex flex-wrap gap-2" actions={[{ key: "edit", label: "Edit", onClick: () => onEdit(item) }, { key: "escalate", label: "Escalate to Incident", variant: "secondary", onClick: () => onConvert(item, "incidents") }, { key: "convert", label: "Convert to Strategy", variant: "secondary", onClick: () => onConvert(item, "strategy") }, { key: "delete", label: "Delete", variant: "danger", onClick: () => onDelete(item) }]} /></div>
    <div className="mt-4 grid gap-3 md:grid-cols-3"><Section title="What is being monitored">{item.watchFor}</Section><Section title="Escalation triggers" tone="trigger">{item.triggerConditions?.length ? item.triggerConditions.map((x) => `• ${x}`).join("\n") : ""}</Section><Section title="Latest development" tone="latest">{item.latestObservation}</Section></div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Section title="Why it matters">{item.rationale}</Section><Section title="Next check">{item.nextCheck}</Section><Section title="Outcome">{item.outcome}</Section></div>
    <RecordMetadataRow className="mt-4" items={[
      { key: "date-added", label: "Date added", value: item.date },
      { key: "review-date", label: "Review date", value: item.reviewDate },
      { key: "sequence-group", label: "Sequence group", value: item.sequenceGroup },
      { key: "last-updated", label: "Last updated", value: item.updatedAt },
      { key: "observations", label: "Observations", value: item.observations?.length || 0, hidden: !item.observations?.length },
      { key: "linked-records", label: "Linked records", value: `${links.length}${item.linkedRecordIds?.length > links.length ? ` (${item.linkedRecordIds.length - links.length} missing)` : ""}` },
      { key: "related-people", label: "Related people", value: parties.map((p) => p.displayName || p.legalName).join(", ") },
      { key: "tags", label: "Tags", value: item.tags?.join(", ") },
      { key: "attachments", label: "Attachments", value: item.attachments?.length || 0, hidden: !item.attachments?.length },
    ]} />
  </article>;
}
