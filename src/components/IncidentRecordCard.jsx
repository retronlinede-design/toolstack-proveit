import { ChevronDown, Tags } from "lucide-react";
import { useState } from "react";

import { getIncidentLinkGroups } from "../domain/caseDomain.js";
import { getEvidenceDisplayMeta, getRecordDisplayMeta } from "../domain/linkingResolvers.js";
import { getIssueDisplayLabel, resolveCaseIssue } from "../domain/issueDomain.js";
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

function titleCase(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.replaceAll("_", " ") : fallback;
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
  const [expanded, setExpanded] = useState(isTimeline);
  const milestone = Boolean(item.isMilestone || isMilestone);
  const isNew = item.edited !== true;
  const sequenceGroup = typeof item.sequenceGroup === "string" ? item.sequenceGroup.trim() : "";
  const issue = resolveCaseIssue(selectedCase, { issueId: item.sequenceGroupId, issueName: sequenceGroup });
  const issueLabel = issue ? getIssueDisplayLabel(issue) : sequenceGroup;
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
  const relationshipCount = new Set([
    ...(Array.isArray(item.linkedPartyIds) ? item.linkedPartyIds : []),
    ...(Array.isArray(item.linkedEvidenceIds) ? item.linkedEvidenceIds : []),
    ...(Array.isArray(item.linkedRecordIds) ? item.linkedRecordIds : []),
    ...incidentLinks.causes.map(({ incident }) => incident.id),
    ...incidentLinks.outcomes.map(({ incident }) => incident.id),
    ...incidentLinks.related.map(({ incident }) => incident.id),
  ]).size;
  const incidentTitle = item.title || "Untitled incident";
  const descriptionPreview = item.description && item.description.length > 220 ? `${item.description.slice(0, 220)}…` : item.description;
  const detailId = `incident-details-${item.id}`;

  return (
    <RecordCardShell
      id={`record-${item.id}`}
      title={incidentTitle}
      variant={milestone ? "milestone" : isNew ? "new" : "default"}
      expanded={expanded}
      className="case-file-incident-card"
      badges={<>
        {milestone && <RecordBadge variant="milestone" className="uppercase tracking-wider">Milestone</RecordBadge>}
        {isActionItem && <RecordBadge variant="status-warning" className="uppercase tracking-wider">Action Required</RecordBadge>}
        {showTypeBadge && <RecordBadge variant="type" className="uppercase tracking-wider">Incident</RecordBadge>}
        {isNew && <RecordBadge variant="new" className="uppercase tracking-wider">New</RecordBadge>}
        {issueLabel && <RecordLinksRow groups={[{ key: "sequence-group", items: [{ key: "sequence", label: issueLabel, icon: <Tags />, variant: "sequence" }] }]} />}
        <RecordBadge variant="status-neutral">Status: {titleCase(item.status, "open")}</RecordBadge>
        <RecordBadge variant={item.evidenceStatus === "documented" ? "verification-verified" : item.evidenceStatus === "needs_evidence" ? "verification-partial" : "verification-unverified"}>Evidence: {titleCase(item.evidenceStatus, "needs evidence")}</RecordBadge>
      </>}
      actions={<RecordActions className="case-file-incident-actions grid grid-cols-2 gap-1 sm:min-w-44" actions={[
        { key: "open", label: "Open", "aria-label": `Open ${incidentTitle}`, variant: "primary", onClick: () => openEditRecordModal("incidents", item) },
        { key: "convert", label: "Convert", "aria-label": `Convert ${incidentTitle}`, variant: "secondary", onClick: () => onConvertRecord?.("incidents", item) },
        { key: "delete", label: "Delete", "aria-label": `Delete ${incidentTitle}`, variant: "danger", onClick: () => deleteRecord("incidents", item.id) },
      ]} />}
      metadata={<RecordMetadataRow items={[
        { key: "incident-date", label: "Date", value: item.eventDate || item.date },
        { key: "logged-date", label: "Logged", value: formatLoggedAt(item.createdAt) },
        { key: "relationship-count", label: "Relationships", value: `${relationshipCount}` },
      ]} />}
      links={<RecordLinksRow groups={[{ key: "linked-parties", label: "Linked Parties", items: partyItems }]} />}
    >
      <div id={detailId} className="space-y-3">
        {item.description && <p className={`case-file-incident-description text-sm ${isTimeline ? "line-clamp-2" : ""}`}>{expanded || isTimeline ? item.description : descriptionPreview}</p>}
        {expanded && item.notes && <p className="case-file-incident-notes text-sm italic">{item.notes}</p>}
        {expanded && <>
          <RecordLinksRow groups={[{ key: "attachment-preview", render: <AttachmentPreview attachments={item.attachments || []} imageCache={imageCache} onPreview={onPreviewFile} /> }]} />
          <RecordLinksRow aria-label="Incident relationships" groups={relationshipGroups} />
        </>}
      </div>
      <button type="button" className="case-file-incident-disclosure" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded((current) => !current)}><ChevronDown className={expanded ? "is-expanded" : ""} aria-hidden="true" />{expanded ? "Hide details" : "Show details"}</button>
    </RecordCardShell>
  );
}
