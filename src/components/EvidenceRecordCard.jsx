import { ChevronDown, Tags } from "lucide-react";
import { useState } from "react";

import { getIncidentDisplayMeta } from "../domain/linkingResolvers.js";
import { getIssueDisplayLabel, resolveCaseIssue } from "../domain/issueDomain.js";
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
  const [expanded, setExpanded] = useState(false);
  const milestone = Boolean(item.isMilestone || isMilestone);
  const isNew = item.edited !== true;
  const sequenceGroup = typeof item.sequenceGroup === "string" ? item.sequenceGroup.trim() : "";
  const issue = resolveCaseIssue(selectedCase, { issueId: item.sequenceGroupId, issueName: sequenceGroup });
  const issueLabel = issue ? getIssueDisplayLabel(issue) : sequenceGroup;
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
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  const localAttachmentCount = attachments.filter((attachment) => attachment?.storage?.type === "indexeddb").length;
  const declaredDigital = Boolean(item.availability?.digital?.hasDigital || item.availability?.digital?.files?.length);
  const declaredPhysical = Boolean(item.availability?.physical?.hasOriginal);
  const externalLocationCount = (Array.isArray(item.locations) ? item.locations : []).filter((location) => location?.type !== "physical").length;
  const physicalLocationCount = (Array.isArray(item.locations) ? item.locations : []).filter((location) => location?.type === "physical").length;
  const description = item.functionSummary || item.description || item.notes || "No summary recorded.";
  const descriptionPreview = description.length > 240 ? `${description.slice(0, 240)}…` : description;
  const detailId = `evidence-details-${item.id}`;
  const locationItems = (Array.isArray(item.locations) ? item.locations : []).map((location, index) => {
    const kind = location?.type === "physical" ? "Physical" : "External";
    const label = location?.label || location?.reference || "Location reference";
    const detail = [location?.reference, location?.coverage].filter(Boolean).join(" · ");
    return { key: `location-${index}`, label: `${kind} · ${label}`, title: detail || "Advisory evidence location", variant: "neutral" };
  });

  return <RecordCardShell
    id={`record-${item.id}`}
    title={item.title}
    subtitle={<span className="case-file-evidence-preview">{descriptionPreview}</span>}
    variant={milestone ? "milestone" : isNew ? "new" : "default"}
    expanded={expanded}
    className="case-file-evidence-card"
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
      {issueLabel && <RecordLinksRow groups={[{ key: "sequence-group", items: [{ key: "sequence", label: issueLabel, icon: <Tags />, variant: "sequence" }] }]} />}
    </>}
    actions={<RecordActions className="grid grid-cols-2 gap-1 sm:min-w-44" actions={[
      { key: "open", label: "Open", variant: "primary", onClick: () => openEditRecordModal("evidence", item) },
      { key: "convert", label: "Convert", variant: "secondary", onClick: () => onConvertRecord?.("evidence", item) },
      { key: "delete", label: "Delete", variant: "danger", onClick: () => deleteRecord("evidence", item.id) },
    ]} />}
    metadata={<RecordMetadataRow items={[
      { key: "availability", render: <span className="case-file-evidence-availability flex flex-wrap gap-1.5"><RecordBadge variant={localAttachmentCount ? "verification-partial" : "status-neutral"}>LOCAL ATTACHMENT RECORDS: {localAttachmentCount}</RecordBadge><RecordBadge variant={declaredDigital ? "verification-partial" : "status-neutral"}>DECLARED DIGITAL: {declaredDigital ? "YES" : "NO"}</RecordBadge><RecordBadge variant={declaredPhysical ? "status-warning" : "status-neutral"}>PHYSICAL: {declaredPhysical ? "DECLARED" : "NOT DECLARED"}</RecordBadge></span> },
      { key: "evidence-date", label: "Date", value: item.eventDate || item.date },
      { key: "logged-date", label: "Logged", value: formatLoggedAt(item.createdAt) },
      { key: "incident-count", label: "Linked incidents", value: `${Array.isArray(item.linkedIncidentIds) ? item.linkedIncidentIds.length : 0}` },
      { key: "location-count", label: "Advisory locations", value: `${externalLocationCount + physicalLocationCount}` },
    ]} />}
    links={<RecordLinksRow aria-label="Evidence relationships" groups={[
      { key: "linked-parties", label: "Linked Parties", items: partyItems },
      { key: "linked-incidents", label: "Linked Incidents", items: incidentItems },
      { key: "tracking-records", label: "Used by Tracking Records", items: trackingItems },
    ]} />}
  >
    <div id={detailId} className="case-file-evidence-details space-y-3">
      {expanded && <>
        <section aria-label="Evidence description and notes" className="space-y-2">
          {item.description && <p><span className="font-semibold">Description:</span> {item.description}</p>}
          {item.functionSummary && <p><span className="font-semibold">Function summary:</span> {item.functionSummary}</p>}
          {item.notes && <p><span className="font-semibold">Notes:</span> {item.notes}</p>}
        </section>
        <RecordMetadataRow items={[
          { key: "source", label: "Source", value: item.source || "Not recorded" },
          { key: "provenance", label: "Provenance", value: item.sourceType || "Not recorded" },
          { key: "evidence-type", label: "Evidence type", value: EVIDENCE_TYPE_LABELS[item.evidenceType] || EVIDENCE_TYPE_LABELS.observed },
          { key: "role", label: "Role", value: EVIDENCE_ROLE_LABELS[item.evidenceRole] || EVIDENCE_ROLE_LABELS.OTHER },
          { key: "importance", label: "Importance", value: item.importance || "Not recorded" },
          { key: "relevance", label: "Relevance", value: item.relevance || "Not recorded" },
          { key: "review-notes", label: "Review notes", value: item.reviewNotes || "None recorded" },
        ]} />
        <section className="case-file-evidence-availability-notes" aria-label="Evidence availability">
          <p><strong>Stored attachment:</strong> {localAttachmentCount ? `${localAttachmentCount} local attachment record${localAttachmentCount === 1 ? "" : "s"} reference IndexedDB storage; preview checks file data when opened.` : "No local attachment record."}</p>
          <p><strong>Declared digital availability:</strong> {declaredDigital ? "Recorded as available digitally; this is a declaration and does not verify a locally stored file." : "Not declared."}</p>
          <p><strong>Physical evidence:</strong> {declaredPhysical ? `${item.availability?.physical?.location || "Original/copy declared; no physical location recorded."}` : "No original or copy declared."}</p>
          <p><strong>Advisory external locations:</strong> {externalLocationCount ? `${externalLocationCount} recorded reference${externalLocationCount === 1 ? "" : "s"}; ProveIt does not open or verify these locations.` : "None recorded."}</p>
        </section>
        {locationItems.length > 0 && <RecordLinksRow groups={[{ key: "evidence-locations", label: "Recorded locations", items: locationItems }]} />}
        {attachmentItems.length > 0 && <RecordLinksRow groups={[{ key: "attachment-types", label: "Attachment metadata", items: attachmentItems }]} />}
        {attachments.length > 0 && <RecordLinksRow groups={[{ key: "attachment-preview", render: <AttachmentPreview attachments={attachments} imageCache={imageCache} onPreview={onPreviewFile} /> }]} />}
      </>}
    </div>
    <button type="button" className="case-file-evidence-disclosure" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded((current) => !current)}><ChevronDown className={expanded ? "is-expanded" : ""} aria-hidden="true" />{expanded ? "Hide evidence details" : "Show evidence details"}</button>
  </RecordCardShell>;
}
