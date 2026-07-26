import { Tags } from "lucide-react";

import { getIncidentDisplayMeta } from "../domain/linkingResolvers.js";
import AttachmentPreview from "./AttachmentPreview.jsx";
import RecordActions from "./shared/RecordActions.jsx";
import RecordBadge from "./shared/RecordBadge.jsx";
import RecordCardShell from "./shared/RecordCardShell.jsx";
import RecordLinksRow from "./shared/RecordLinksRow.jsx";
import RecordMetadataRow from "./shared/RecordMetadataRow.jsx";

const EVIDENCE_ROLE_LABELS = {
  ANCHOR_EVIDENCE: "Anchor Evidence",
  SUPPORTING_EVIDENCE: "Supporting Evidence",
  TIMELINE_EVIDENCE: "Timeline Evidence",
  MEDICAL_EVIDENCE: "Medical Evidence",
  COMMUNICATION_EVIDENCE: "Communication Evidence",
  OPERATIONAL_EVIDENCE: "Operational Evidence",
  CORROBORATING_EVIDENCE: "Corroborating Evidence",
  OTHER: "Other",
};

const EVIDENCE_TYPE_LABELS = {
  documented: "Documented",
  witnessed: "Witness",
  observed: "Observed",
  verbal: "Verbal",
  derived: "Derived",
};

function isTrackingRecordDocument(document) {
  return typeof document?.textContent === "string" && document.textContent.includes("[TRACK RECORD]");
}

function formatLoggedAt(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " at " + new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getStatusLabel(status) {
  if (status === "needs_review") return "Needs Review";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "";
}

function getStatusVariant(status) {
  if (status === "verified") return "verification-verified";
  if (status === "incomplete") return "verification-unverified";
  return "verification-partial";
}

function buildCompactItems(references, resolve, buildItem, missingNoun = "link") {
  const ids = Array.isArray(references) ? references : [];
  const resolved = ids.map((id) => ({ id, value: resolve(id) })).filter((entry) => entry.value);
  const items = resolved.slice(0, 4).map(({ id, value }) => buildItem(id, value));
  if (resolved.length > 4) items.push({ key: "remaining", label: `+${resolved.length - 4}`, variant: "neutral" });
  const missingCount = ids.length - resolved.length;
  if (missingCount > 0) items.push({
    key: "missing",
    label: missingNoun === "party" ? `${missingCount} missing part${missingCount === 1 ? "y" : "ies"}` : `${missingCount} missing link${missingCount === 1 ? "" : "s"}`,
    variant: "missing",
    title: missingNoun === "party" ? "Related parties that could not be resolved" : "Linked records that could not be resolved",
  });
  return items;
}

export default function EvidenceRecordCard({
  item,
  selectedCase,
  imageCache,
  onPreviewFile,
  openEditRecordModal,
  onConvertRecord,
  deleteRecord,
  openLinkedRecord,
  showTypeBadge = false,
  isMilestone = false,
  isActionItem = false,
}) {
  const milestone = Boolean(item.isMilestone || isMilestone);
  const isNew = item.edited !== true;
  const sequenceGroup = typeof item.sequenceGroup === "string" ? item.sequenceGroup.trim() : "";
  const trackingRecords = (selectedCase?.documents || []).filter((document) => isTrackingRecordDocument(document) && Array.isArray(document.basedOnEvidenceIds) && document.basedOnEvidenceIds.includes(item.id));
  const partyById = new Map((selectedCase?.parties || []).map((party) => [party.id, party]));
  const partyItems = buildCompactItems(item.linkedPartyIds, (id) => partyById.get(id), (_id, party) => ({ key: party.id, label: `Party · ${party.displayName || "Untitled Party"}`, title: party.displayName || "Untitled Party", variant: "party" }), "party");
  const incidentItems = buildCompactItems(item.linkedIncidentIds, (id) => getIncidentDisplayMeta(selectedCase, id), (id, incident) => ({ key: id, label: `${incident.typeLabel} · ${incident.title || "Untitled incident"}`, title: incident.title || "Untitled incident", variant: "linked", onClick: () => openLinkedRecord?.(id) }));
  const trackingItems = trackingRecords.slice(0, 4).map((record) => ({ key: record.id, label: `Tracking Record · ${record.title || "Untitled Tracking Record"}`, title: record.title || "Untitled Tracking Record", variant: "linked", onClick: () => openLinkedRecord?.(record.id) }));
  if (trackingRecords.length > 4) trackingItems.push({ key: "remaining", label: `+${trackingRecords.length - 4}`, variant: "neutral" });
  const attachmentItems = (item.attachments || []).map((attachment, index) => {
    const type = attachment.type || attachment.mimeType || "";
    const label = type.startsWith("image/") ? "Image" : type === "application/pdf" ? "PDF" : "File";
    return { key: attachment.id || `${label}-${index}`, label, variant: "attachment" };
  });

  return <RecordCardShell
    id={`record-${item.id}`}
    title={item.title}
    subtitle={(item.description || item.notes) && <span className="block max-w-[400px] truncate">What this shows: {item.description || item.notes}</span>}
    variant={milestone ? "milestone" : isNew ? "new" : "default"}
    expanded
    badges={<>
      <RecordBadge variant="type" className="uppercase tracking-wider">Evidence</RecordBadge>
      {item.status && <RecordBadge variant={getStatusVariant(item.status)} className="uppercase tracking-wider">{getStatusLabel(item.status)}</RecordBadge>}
      {item.importance === "critical" ? <RecordBadge variant="status-positive" className="uppercase tracking-wider">Strong Evidence</RecordBadge> : item.tags?.length > 0 ? <RecordBadge variant="status-neutral" className="uppercase tracking-wider">Supporting Evidence</RecordBadge> : null}
      {milestone && <RecordBadge variant="milestone" className="uppercase tracking-wider">Milestone</RecordBadge>}
      {isActionItem && <RecordBadge variant="status-warning" className="uppercase tracking-wider">Action Required</RecordBadge>}
      {showTypeBadge && <RecordBadge variant="type" className="uppercase tracking-wider">Evidence</RecordBadge>}
      {isNew && <RecordBadge variant="new" className="uppercase tracking-wider">New</RecordBadge>}
      <RecordBadge variant="type" className="uppercase tracking-wider">{EVIDENCE_TYPE_LABELS[item.evidenceType] || EVIDENCE_TYPE_LABELS.observed}</RecordBadge>
      <RecordBadge variant="type" className="uppercase tracking-wider">{EVIDENCE_ROLE_LABELS[item.evidenceRole] || EVIDENCE_ROLE_LABELS.OTHER}</RecordBadge>
      {sequenceGroup && <RecordLinksRow groups={[{ key: "sequence-group", items: [{ key: "sequence", label: sequenceGroup, icon: <Tags />, variant: "sequence" }] }]} />}
    </>}
    actions={<RecordActions className="grid grid-cols-2 gap-1 sm:min-w-44" actions={[
      { key: "open", label: "Open", variant: "primary", onClick: () => openEditRecordModal("evidence", item) },
      { key: "convert", label: "Convert", variant: "secondary", onClick: () => onConvertRecord?.("evidence", item) },
      { key: "delete", label: "Delete", variant: "danger", onClick: () => deleteRecord("evidence", item.id) },
    ]} />}
    metadata={<RecordMetadataRow items={[
      { key: "availability", render: <span className="flex flex-wrap gap-1.5"><RecordBadge variant={item.availability?.physical?.hasOriginal ? "status-warning" : "status-neutral"}>PHYSICAL</RecordBadge><RecordBadge variant={item.availability?.digital?.hasDigital ? "verification-partial" : "status-neutral"}>DIGITAL {item.attachments?.length > 0 && `(${item.attachments.length})`}</RecordBadge></span> },
      { key: "evidence-date", label: "Date", value: item.eventDate || item.date },
      { key: "logged-date", label: "Logged", value: formatLoggedAt(item.createdAt) },
    ]} />}
    links={<RecordLinksRow aria-label="Evidence relationships" groups={[
      { key: "linked-parties", label: "Linked Parties", items: partyItems },
      { key: "linked-incidents", label: "Linked Incidents", items: incidentItems },
      { key: "tracking-records", label: "Used by Tracking Records", items: trackingItems },
    ]} />}
  >
    <div className="space-y-3">
      {item.functionSummary && <p className="border-l-2 border-neutral-200 pl-3 text-sm text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"><span className="font-semibold text-neutral-900 dark:text-neutral-100">Function:</span> {item.functionSummary}</p>}
      {attachmentItems.length > 0 && <RecordLinksRow groups={[{ key: "attachment-types", label: "Attachments", items: attachmentItems }]} />}
      {item.attachments?.length > 0 && <RecordLinksRow groups={[{ key: "attachment-preview", render: <AttachmentPreview attachments={item.attachments} imageCache={imageCache} onPreview={onPreviewFile} /> }]} />}
    </div>
  </RecordCardShell>;
}
