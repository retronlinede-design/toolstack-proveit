import { Tags } from "lucide-react";

import { getIncidentLinkGroups } from "../domain/caseDomain.js";
import { getEvidenceDisplayMeta, getRecordDisplayMeta } from "../domain/linkingResolvers.js";
import AttachmentPreview from "./AttachmentPreview.jsx";
import RecordActions from "./shared/RecordActions.jsx";
import RecordBadge from "./shared/RecordBadge.jsx";
import RecordCardShell from "./shared/RecordCardShell.jsx";
import RecordLinksRow from "./shared/RecordLinksRow.jsx";
import RecordMetadataRow from "./shared/RecordMetadataRow.jsx";

function formatLoggedAt(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " at " + new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function buildCompactItems(ids, resolve, buildItem) {
  const references = Array.isArray(ids) ? ids : [];
  const resolved = references.map((id) => ({ id, value: resolve(id) })).filter((entry) => entry.value);
  const items = resolved.slice(0, 4).map(({ id, value }) => buildItem(id, value));
  if (resolved.length > 4) items.push({ key: "remaining", label: `+${resolved.length - 4}`, variant: "neutral" });
  const missingCount = references.length - resolved.length;
  if (missingCount > 0) items.push({ key: "missing", label: `${missingCount} missing link${missingCount === 1 ? "" : "s"}`, variant: "missing", title: "Linked records that could not be resolved" });
  return items;
}

function buildIncidentRelationshipItems(title, links, indicator, badge, onOpen) {
  return (links || []).slice(0, 4).map(({ ref, incident }) => ({
    key: `${title}-${incident.id}-${ref.type}`,
    label: `${indicator} ${badge} · ${incident.title || "Untitled incident"}`,
    title: incident.title || "Untitled incident",
    variant: badge === "RELATED" ? "linked" : "warning",
    onClick: () => onOpen?.(incident.id),
  })).concat((links || []).length > 4 ? [{ key: `${title}-remaining`, label: `+${links.length - 4}`, variant: "neutral" }] : []);
}

export default function IncidentRecordCard({
  item,
  selectedCase,
  imageCache,
  onPreviewFile,
  openEditRecordModal,
  onConvertRecord,
  deleteRecord,
  openLinkedRecord,
  showTypeBadge = false,
  isTimeline = false,
  isMilestone = false,
  isActionItem = false,
}) {
  const milestone = Boolean(item.isMilestone || isMilestone);
  const isNew = item.edited !== true;
  const sequenceGroup = typeof item.sequenceGroup === "string" ? item.sequenceGroup.trim() : "";
  const incidentLinks = getIncidentLinkGroups(selectedCase, item.id);
  const partyById = new Map((selectedCase?.parties || []).map((party) => [party.id, party]));
  const partyItems = buildCompactItems(item.linkedPartyIds, (id) => partyById.get(id), (_id, party) => ({ key: party.id, label: `Party · ${party.displayName || "Untitled Party"}`, title: party.displayName || "Untitled Party", variant: "party" }));
  const evidenceItems = buildCompactItems(item.linkedEvidenceIds, (id) => getEvidenceDisplayMeta(selectedCase, id)?.record, (id, evidence) => ({ key: id, label: `Evidence · ${evidence.title || "Untitled Evidence"}`, title: evidence.title || "Untitled Evidence", variant: "linked", onClick: () => openEditRecordModal("evidence", evidence) }));
  const supportingItems = buildCompactItems(item.linkedRecordIds, (id) => getRecordDisplayMeta(selectedCase, id), (id, record) => ({ key: id, label: `${record.typeLabel} · ${record.title || "Untitled record"}`, title: record.title || "Untitled record", variant: "linked", onClick: () => openLinkedRecord?.(id) }));
  const relationshipGroups = [
    { key: "linked-evidence", label: "Linked Evidence", items: evidenceItems },
    { key: "caused-by", label: "Caused by", items: buildIncidentRelationshipItems("Caused by", incidentLinks.causes, "←", "CAUSED BY", openLinkedRecord) },
    { key: "supporting-records", label: "Supporting Records", items: supportingItems },
    { key: "outcomes", label: "Outcomes", items: buildIncidentRelationshipItems("Outcomes", incidentLinks.outcomes, "→", "OUTCOME", openLinkedRecord) },
    { key: "related", label: "Related", items: buildIncidentRelationshipItems("Related", incidentLinks.related, "↔", "RELATED", openLinkedRecord) },
  ];

  return (
    <RecordCardShell
      id={`record-${item.id}`}
      title={item.title}
      variant={milestone ? "milestone" : isNew ? "new" : "default"}
      expanded
      badges={<>
        {milestone && <RecordBadge variant="milestone" className="uppercase tracking-wider">Milestone</RecordBadge>}
        {isActionItem && <RecordBadge variant="status-warning" className="uppercase tracking-wider">Action Required</RecordBadge>}
        {showTypeBadge && <RecordBadge variant="type" className="uppercase tracking-wider">Incident</RecordBadge>}
        {isNew && <RecordBadge variant="new" className="uppercase tracking-wider">New</RecordBadge>}
        {sequenceGroup && <RecordLinksRow groups={[{ key: "sequence-group", items: [{ key: "sequence", label: sequenceGroup, icon: <Tags />, variant: "sequence" }] }]} />}
      </>}
      actions={<RecordActions className="grid grid-cols-2 gap-1 sm:min-w-44" actions={[
        { key: "open", label: "Open", variant: "primary", onClick: () => openEditRecordModal("incidents", item) },
        { key: "convert", label: "Convert", variant: "secondary", onClick: () => onConvertRecord?.("incidents", item) },
        { key: "delete", label: "Delete", variant: "danger", onClick: () => deleteRecord("incidents", item.id) },
      ]} />}
      metadata={<RecordMetadataRow items={[
        { key: "incident-date", label: "Date", value: item.eventDate || item.date },
        { key: "logged-date", label: "Logged", value: formatLoggedAt(item.createdAt) },
      ]} />}
      links={<RecordLinksRow groups={[{ key: "linked-parties", label: "Linked Parties", items: partyItems }]} />}
    >
      <div className="space-y-3">
        {item.description && <p className={`text-sm text-neutral-700 dark:text-neutral-300 ${isTimeline ? "line-clamp-2" : ""}`}>{isTimeline && item.description.length > 160 ? `${item.description.substring(0, 160)}...` : item.description}</p>}
        {item.notes && <p className={`text-sm italic text-neutral-500 dark:text-neutral-400 ${isTimeline ? "line-clamp-1" : ""}`}>{isTimeline && item.notes.length > 100 ? `${item.notes.substring(0, 100)}...` : item.notes}</p>}
        <RecordLinksRow groups={[{ key: "attachment-preview", render: <AttachmentPreview attachments={item.attachments || []} imageCache={imageCache} onPreview={onPreviewFile} /> }]} />
        <RecordLinksRow aria-label="Incident relationships" groups={relationshipGroups} />
      </div>
    </RecordCardShell>
  );
}
