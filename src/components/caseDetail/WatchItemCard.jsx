import { getRecordDisplayMeta } from "../../domain/linkingResolvers.js";
import RecordActions from "../shared/RecordActions.jsx";
import RecordBadge from "../shared/RecordBadge.jsx";
import RecordMetadataRow from "../shared/RecordMetadataRow.jsx";
import RecordLinksRow from "../shared/RecordLinksRow.jsx";
import RecordCardShell from "../shared/RecordCardShell.jsx";

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

function Section({ title, children, tone = "neutral", className = "" }) {
  if (!children) return null;
  const toneClasses = tone === "trigger"
    ? "border-l-2 border-amber-400 bg-amber-50/60 pl-3 dark:border-amber-600 dark:bg-amber-950/20"
    : tone === "latest"
      ? "border-l-2 border-sky-400 bg-sky-50/60 pl-3 dark:border-sky-600 dark:bg-sky-950/20"
      : "";
  const titleClasses = tone === "trigger"
    ? "text-amber-800 dark:text-amber-300"
    : tone === "latest"
      ? "text-sky-800 dark:text-sky-300"
      : "text-neutral-500 dark:text-neutral-400";
  const contentClasses = tone === "latest"
    ? "text-base font-medium leading-6 text-neutral-900 dark:text-neutral-100"
    : "text-sm leading-5 text-neutral-700 dark:text-neutral-300";

  return <section className={`min-w-0 rounded-r-md py-1.5 ${toneClasses} ${className}`.trim()}>
    <h4 className={`text-[11px] font-semibold uppercase tracking-wide ${titleClasses}`}>{title}</h4>
    <div className={`mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] ${contentClasses}`}>{children}</div>
  </section>;
}

export default function WatchItemCard({ item, caseItem, onEdit, onDelete, onConvert }) {
  const parties = (item.linkedPartyIds || []).map((id) => (caseItem.parties || []).find((party) => party.id === id)).filter(Boolean);
  const links = (item.linkedRecordIds || []).map((id) => getRecordDisplayMeta(caseItem, id)).filter(Boolean);

  return <RecordCardShell
    title={item.title || "Untitled watch item"}
    badges={<>{item.status && <RecordBadge variant={getWatchStatusBadgeVariant(item.status)} className="capitalize">{label(item.status)}</RecordBadge>}{item.category && <RecordBadge variant="type" className="capitalize">{label(item.category)}</RecordBadge>}{item.priority && <RecordBadge variant={getWatchPriorityBadgeVariant(item.priority)} className="capitalize">{label(item.priority)}</RecordBadge>}</>}
    actions={<RecordActions className="flex flex-wrap gap-1.5 sm:justify-end" actions={[{ key: "edit", label: "Edit", onClick: () => onEdit(item) }, { key: "escalate", label: "Escalate to Incident", variant: "secondary", onClick: () => onConvert(item, "incidents") }, { key: "convert", label: "Convert to Strategy", variant: "secondary", onClick: () => onConvert(item, "strategy") }, { key: "delete", label: "Delete", variant: "danger", onClick: () => onDelete(item) }]} />}
    metadata={<RecordMetadataRow items={[
      { key: "date-added", label: "Date added", value: item.date },
      { key: "review-date", label: "Review date", value: item.reviewDate },
      { key: "last-updated", label: "Last updated", value: item.updatedAt },
      { key: "observations", label: "Observations", value: item.observations?.length || 0, hidden: !item.observations?.length },
      { key: "tags", label: "Tags", value: item.tags?.join(", ") },
    ]} />}
    links={<RecordLinksRow aria-label="Watch item relationships" groups={[
      { key: "sequence-group", label: "Sequence group", items: [{ key: "sequence", label: item.sequenceGroup, variant: "sequence", hidden: !item.sequenceGroup }] },
      { key: "linked-records", label: "Linked records", items: [
        { key: "resolved-links", label: `${links.length} linked record${links.length === 1 ? "" : "s"}`, variant: "linked" },
        { key: "missing-links", label: `${(item.linkedRecordIds?.length || 0) - links.length} missing link${(item.linkedRecordIds?.length || 0) - links.length === 1 ? "" : "s"}`, variant: "missing", title: "Linked records that could not be resolved", hidden: !item.linkedRecordIds || item.linkedRecordIds.length === links.length },
      ] },
      { key: "related-people", label: "Related people", items: parties.map((party) => ({ key: party.id, label: party.displayName || party.legalName, variant: "party" })) },
      { key: "attachments", label: "Attachments", items: [{ key: "attachment-count", label: `${item.attachments?.length || 0} attachment${item.attachments?.length === 1 ? "" : "s"}`, variant: "attachment", hidden: !item.attachments?.length }] },
    ]} />}
  >
    <div className="grid min-w-0 gap-x-5 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
      <Section title="What is being monitored">{item.watchFor}</Section>
      <Section title="Escalation triggers" tone="trigger">{item.triggerConditions?.length ? item.triggerConditions.map((entry) => `• ${entry}`).join("\n") : ""}</Section>
      <Section title="Latest development" tone="latest" className="md:col-span-2 xl:col-span-1">{item.latestObservation}</Section>
    </div>
    <div className="mt-3 grid min-w-0 gap-x-5 gap-y-3 border-t border-neutral-100 pt-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800">
      <Section title="Why it matters">{item.rationale}</Section>
      <Section title="Next check">{item.nextCheck}</Section>
      <Section title="Outcome">{item.outcome}</Section>
    </div>
  </RecordCardShell>;
}
