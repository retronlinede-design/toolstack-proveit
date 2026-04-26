import AttachmentPreview from "./AttachmentPreview";
import { getLinkChipClasses } from "./linkChipStyles";
import LinkedChip from "./LinkedChip";
import { getIncidentLinkGroups } from "../domain/caseDomain.js";
import { getEvidenceDisplayMeta, getIncidentDisplayMeta, getRecordDisplayMeta } from "../domain/linkingResolvers.js";
import { Tags } from "lucide-react";

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

export default function RecordCard({
  item,
  recordType,
  selectedCase,
  imageCache,
  onPreviewFile,
  onViewRecord,
  openEditRecordModal,
  deleteRecord,
  openLinkedRecord,
  openRecordModal,
  showTypeBadge = false,
  isTimeline = false,
  isMilestone = false,
  isActionItem = false,
}) {
  const isEvidence = recordType === "evidence";
  const isIncident = recordType === "incidents";
  const isSupportedMilestoneType = isIncident || isEvidence;
  const isRecordMilestone = isSupportedMilestoneType && (!!item.isMilestone || !!isMilestone);
  const incidentLinkGroups = recordType === "incidents" ? getIncidentLinkGroups(selectedCase, item.id) : null;
  const canCreateTask = ["evidence", "incidents", "strategy"].includes(recordType);
  const sequenceGroup = typeof item.sequenceGroup === "string" ? item.sequenceGroup.trim() : "";
  const isNewRecord =
    (recordType === "evidence" || recordType === "incidents") &&
    item.edited !== true;

  const badgeColors = {
    evidence: "bg-purple-50 text-purple-700 border-purple-200",
    incidents: "bg-amber-50 text-amber-700 border-amber-200",
    strategy: "bg-blue-50 text-blue-700 border-blue-200",
  };

  const renderCompactChipRow = (label, items, renderChip) => {
    if (!items || items.length === 0) return null;
    const renderedChips = items.map(renderChip).filter(Boolean);
    const visibleChips = renderedChips.slice(0, 4);
    const remainingCount = renderedChips.length - visibleChips.length;
    const missingCount = items.length - renderedChips.length;

    if (renderedChips.length === 0 && missingCount === 0) return null;

    return (
      <div className="mt-1 flex items-start gap-2">
        <div className="w-24 shrink-0 pt-0.5 text-[11px] text-neutral-500">{label}</div>
        <div className="flex flex-wrap gap-1">
          {visibleChips}
          {remainingCount > 0 && (
            <span className={getLinkChipClasses("neutral")}>
              +{remainingCount}
            </span>
          )}
          {missingCount > 0 && (
            <span className={getLinkChipClasses("neutral", "cursor-default opacity-70")}>
              {missingCount} missing link{missingCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderIncidentLinkSection = (title, links, { indicator, badge, badgeClass }) => {
    if (!links || links.length === 0) return null;

    return renderCompactChipRow(title, links, ({ ref, incident }) => (
      <LinkedChip
        key={`${title}-${incident.id}-${ref.type}`}
        onClick={() => openLinkedRecord?.(incident.id)}
        titleText={incident.title || "Untitled incident"}
        variant="incident"
        className="flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 active:scale-[0.99]"
        leading={
          <>
            <span className="shrink-0 text-[10px] font-bold text-neutral-400">{indicator}</span>
            <span className={`shrink-0 rounded-sm border px-1 py-0 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
              {badge}
            </span>
          </>
        }
      >
        {incident.title || "Untitled incident"}
      </LinkedChip>
    ));
  };

  const renderSequenceGroupChip = () => {
    if (!sequenceGroup) return null;

    return (
      <span className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
        <Tags className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
        <span className="truncate">{sequenceGroup}</span>
      </span>
    );
  };

  return (
    <div key={item.id} id={`record-${item.id}`} className={`relative rounded-2xl border p-4 ${
      isRecordMilestone
        ? "border-amber-300 border-l-4 bg-amber-50/50 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]"
        : isNewRecord
          ? "border-lime-400 bg-lime-50/40 shadow-[0_0_0_1px_rgba(163,230,53,0.35)]"
          : "border-neutral-200 bg-neutral-50"
    }`}>
      {/* Action Grid */}
      <div className="absolute top-3 right-3 grid grid-cols-2 gap-1 z-10">
        <button
          onClick={() => openEditRecordModal(recordType, item)}
          className="px-2 py-1 text-[10px] font-semibold rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 whitespace-nowrap text-center transition-all active:scale-95"
        >
          Open
        </button>

        <div />
        <div />
        <button
          onClick={() => deleteRecord(recordType, item.id)}
          className="px-2 py-1 text-[10px] font-semibold rounded-md bg-white hover:bg-red-50 text-red-600 border border-neutral-200 hover:border-red-200 whitespace-nowrap text-center transition-all active:scale-95"
        >
          Delete
        </button>
      </div>

      <div className="flex items-start justify-between gap-3 pr-24">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            {isEvidence && (
              <div className="flex items-center gap-2 mb-1">
                <div className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-neutral-200 text-neutral-700">
                  Evidence
                </div>
                {item.status && (
                  <div className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    item.status === 'verified' ? 'bg-lime-100 text-lime-700' :
                    item.status === 'incomplete' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {item.status === 'needs_review' ? 'Needs Review' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </div>
                )}
                {item.importance === "critical" ? (
                  <div className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-lime-100 text-lime-700">
                    Strong Evidence
                  </div>
                ) : item.tags?.length > 0 ? (
                  <div className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600">
                    Supporting Evidence
                  </div>
                ) : null}
              </div>
            )}
            {isRecordMilestone && (
              <div className="mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                  Milestone
                </span>
              </div>
            )}
            {isActionItem && (
              <div className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 ${isRecordMilestone ? "ml-1" : ""}`}>
                Action Required
              </div>
            )}
            <div className="flex items-center gap-2">
              {showTypeBadge && (
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${badgeColors[recordType]}`}>
                  {recordType === "evidence" ? "Evidence" : recordType === "incidents" ? "Incident" : recordType === "strategy" ? "Strategy" : "Record"}
                </span>
              )}
              <div className="font-semibold text-neutral-900">{item.title}</div>
              {isNewRecord && (
                <span className="px-1.5 py-0.5 rounded border border-lime-300 bg-lime-100 text-[9px] font-bold uppercase tracking-wider text-lime-700">
                  New
                </span>
              )}
              {!isEvidence && renderSequenceGroupChip()}
            </div>

            {isEvidence && (item.description || item.notes) && (
              <div className="mt-1 text-xs text-neutral-600 truncate max-w-[400px]">
                What this shows: {item.description || item.notes}
              </div>
            )}

            {isEvidence && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-block rounded border border-lime-200 bg-lime-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-lime-700">
                    {EVIDENCE_ROLE_LABELS[item.evidenceRole] || EVIDENCE_ROLE_LABELS.OTHER}
                  </span>
                  {renderSequenceGroupChip()}
                </div>
                {item.functionSummary && (
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                    <span className="font-semibold text-neutral-900">Function:</span> {item.functionSummary}
                  </div>
                )}
              </div>
            )}

            {isEvidence && item.attachments?.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {item.attachments.map((att, i) => {
                    const type = att.type || att.mimeType || "";
                    let label = "File";
                    if (type.startsWith("image/")) label = "Image";
                    else if (type === "application/pdf") label = "PDF";
                    return (
                      <span key={i} className="inline-block rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                        {label}
                      </span>
                    );
                  })}
                </div>
                <AttachmentPreview
                  attachments={item.attachments}
                  imageCache={imageCache}
                  onPreview={onPreviewFile}
                />
              </div>
            )}

            <div className="mt-2 space-y-1 text-xs text-neutral-500">
              {isEvidence && (
                <div className="flex gap-2 mb-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    item.availability?.physical?.hasOriginal
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-neutral-100 border-neutral-200 text-neutral-400"
                  }`}>
                    PHYSICAL
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    item.availability?.digital?.hasDigital
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : "bg-neutral-100 border-neutral-200 text-neutral-400"
                  }`}>
                    DIGITAL {item.attachments?.length > 0 && `(${item.attachments.length})`}
                  </span>
                </div>
              )}
              <div>
                <span className="font-medium text-neutral-700">Date:</span> {item.eventDate || item.date}
              </div>
              <div>
                <span className="font-medium text-neutral-700">Logged:</span>{" "}
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }) +
                    " at " +
                    new Date(item.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Unknown"}
              </div>
            </div>
            {!isEvidence && recordType !== "incidents" && Array.isArray(item.linkedRecordIds) && item.linkedRecordIds.length > 0 && (
              renderCompactChipRow("Linked Records", item.linkedRecordIds, (linkedId) => {
                const linkedItem = getRecordDisplayMeta(selectedCase, linkedId);
                if (!linkedItem) return null;

                return (
                  <LinkedChip
                    key={linkedId}
                    onClick={() => openLinkedRecord?.(linkedId)}
                    titleText={linkedItem.title || "Untitled record"}
                    variant="record"
                    className="flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 active:scale-[0.99]"
                    leading={<span className="shrink-0 font-bold uppercase opacity-50">{linkedItem.typeLabel}</span>}
                  >
                    {linkedItem.title || "Untitled record"}
                  </LinkedChip>
                );
              })
            )}
            {isEvidence && Array.isArray(item.linkedIncidentIds) && item.linkedIncidentIds.length > 0 && (
              renderCompactChipRow("Linked Incidents", item.linkedIncidentIds, (linkedId) => {
                const linkedItem = getIncidentDisplayMeta(selectedCase, linkedId);
                if (!linkedItem) return null;

                return (
                  <LinkedChip
                    key={linkedId}
                    onClick={() => openLinkedRecord?.(linkedId)}
                    titleText={linkedItem.title || "Untitled incident"}
                    variant="incident"
                    className="flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 active:scale-[0.99]"
                    leading={<span className="shrink-0 font-bold uppercase opacity-50">{linkedItem.typeLabel}</span>}
                  >
                    {linkedItem.title || "Untitled incident"}
                  </LinkedChip>
                );
              })
            )}
          </div>
        </div>

      </div>

      {!isEvidence && item.description ? (
        <p className={`mt-3 text-sm text-neutral-700 ${isTimeline ? "line-clamp-2" : ""}`}>
          {isTimeline && item.description.length > 160 
            ? item.description.substring(0, 160) + "..." 
            : item.description}
        </p>
      ) : null}
      {!isEvidence && item.notes ? (
        <p className={`mt-2 text-sm text-neutral-500 italic ${isTimeline ? "line-clamp-1" : ""}`}>
          {isTimeline && item.notes.length > 100 
            ? item.notes.substring(0, 100) + "..." 
            : item.notes}
        </p>
      ) : null}

      {!isEvidence && (
        <AttachmentPreview
          attachments={item.attachments || []}
          imageCache={imageCache}
          onPreview={onPreviewFile}
        />
      )}

      {recordType === "incidents" && item.linkedEvidenceIds && item.linkedEvidenceIds.length > 0 && (
        renderCompactChipRow("Linked Evidence", item.linkedEvidenceIds, (evidenceId) => {
          const evidenceMeta = getEvidenceDisplayMeta(selectedCase, evidenceId);
          const evidenceItem = evidenceMeta?.record;
          if (!evidenceItem) return null;

          return (
            <LinkedChip
              key={evidenceId}
              onClick={() => openEditRecordModal("evidence", evidenceItem)}
              titleText={evidenceItem.title || "Untitled Evidence"}
              variant="evidence"
              className="flex items-center gap-1 text-left transition-colors"
              leading={<span className="shrink-0 font-bold uppercase opacity-50">Evidence</span>}
            >
              {evidenceItem.title || "Untitled Evidence"}
            </LinkedChip>
          );
        })
      )}
      {recordType === "incidents" && renderIncidentLinkSection("Caused by", incidentLinkGroups.causes, {
        indicator: "←",
        badge: "CAUSED BY",
        badgeClass: "border-red-200 bg-red-50 text-red-700",
      })}
      {recordType === "incidents" && Array.isArray(item.linkedRecordIds) && item.linkedRecordIds.length > 0 && (
        renderCompactChipRow("Supporting Records", item.linkedRecordIds, (recordId) => {
          const linkedRecord = getRecordDisplayMeta(selectedCase, recordId);
          if (!linkedRecord) return null;

          return (
            <LinkedChip
              key={recordId}
              onClick={() => openLinkedRecord?.(recordId)}
              titleText={linkedRecord.title || "Untitled record"}
              variant="record"
              className="flex items-center gap-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 active:scale-[0.99]"
              leading={<span className="shrink-0 font-bold uppercase opacity-50">{linkedRecord.typeLabel}</span>}
            >
              {linkedRecord.title || "Untitled record"}
            </LinkedChip>
          );
        })
      )}
      {recordType === "incidents" && renderIncidentLinkSection("Outcomes", incidentLinkGroups.outcomes, {
        indicator: "→",
        badge: "OUTCOME",
        badgeClass: "border-red-200 bg-red-50 text-red-700",
      })}
      {recordType === "incidents" && renderIncidentLinkSection("Related", incidentLinkGroups.related, {
        indicator: "↔",
        badge: "RELATED",
        badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
      })}
    </div>
  );
}
