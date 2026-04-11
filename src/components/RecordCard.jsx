import AttachmentPreview from "./AttachmentPreview";

export default function RecordCard({
  item,
  recordType,
  selectedCase,
  imageCache,
  onPreviewFile,
  onViewRecord,
  openEditRecordModal,
  deleteRecord,
  toggleTaskStatus,
  openLinkedRecord,
  openRecordModal,
  showTypeBadge = false,
  isTimeline = false,
  isMilestone = false,
  isActionItem = false,
}) {
  const isEvidence = recordType === "evidence";
  const canCreateTask = ["evidence", "incidents", "strategy"].includes(recordType);
  const isNewRecord =
    (recordType === "evidence" || recordType === "incidents") &&
    item.edited !== true;

  const badgeColors = {
    evidence: "bg-purple-50 text-purple-700 border-purple-200",
    incidents: "bg-amber-50 text-amber-700 border-amber-200",
    strategy: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div key={item.id} id={`record-${item.id}`} className={`relative rounded-2xl border p-4 ${
      isNewRecord
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
            {isMilestone && (
              <div className="mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-lime-100 text-lime-700">
                Milestone
              </div>
            )}
            {isActionItem && (
              <div className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 ${isMilestone ? "ml-1" : ""}`}>
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
            </div>

            {isEvidence && (item.description || item.notes) && (
              <div className="mt-1 text-xs text-neutral-600 truncate max-w-[400px]">
                What this shows: {item.description || item.notes}
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
            {(() => {
              const allLinkIds = Array.from(new Set([...(item.linkedIncidentIds || []), ...(item.linkedRecordIds || [])]));
              if (allLinkIds.length === 0) return null;
              return (
                <div className="mt-2 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-tight text-neutral-500">{isEvidence ? "Linked To" : "Linked:"}</div>
                  <div className="flex flex-wrap gap-1">
                    {allLinkIds.map(linkedId => (
                      <button
                        key={linkedId}
                        onClick={() => openLinkedRecord?.(linkedId)}
                        className="px-1.5 py-0.5 rounded border border-neutral-300 bg-neutral-50 text-neutral-600 shadow-sm hover:bg-white hover:border-lime-500 hover:text-lime-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 active:scale-95 transition-all cursor-pointer truncate max-w-[150px]"
                      >
                        {([...selectedCase.evidence, ...selectedCase.incidents, ...selectedCase.strategy].find(r => r.id === linkedId)?.title) || "Unknown Record"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
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
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Linked Evidence</h4>
          <div className="space-y-2">
            {item.linkedEvidenceIds.map((evidenceId) => {
              const evidenceItem = selectedCase?.evidence?.find((e) => e.id === evidenceId);
              if (!evidenceItem) return null;

              return (
                <div key={evidenceId} className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-neutral-800 truncate">
                      {evidenceItem.title || "Untitled Evidence"}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          evidenceItem.importance === "critical"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : evidenceItem.importance === "strong"
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-neutral-100 border-neutral-200 text-neutral-500"
                        }`}
                      >
                        {evidenceItem.importance?.toUpperCase()}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          evidenceItem.status === "verified"
                            ? "bg-lime-50 border-lime-200 text-lime-700"
                            : evidenceItem.status === "incomplete"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-neutral-100 border-neutral-200 text-neutral-500"
                        }`}
                      >
                        {evidenceItem.status?.replace("_", " ").toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      {evidenceItem.attachments?.[0]?.mimeType?.startsWith("image/") && "Image"}
                      {evidenceItem.attachments?.[0]?.mimeType === "application/pdf" && "PDF"}
                      {evidenceItem.attachments?.[0] &&
                        !evidenceItem.attachments?.[0]?.mimeType?.startsWith("image/") &&
                        evidenceItem.attachments?.[0]?.mimeType !== "application/pdf" &&
                        "File"}
                      {!evidenceItem.attachments?.[0] && "No Digital File"}
                    </span>
                    <div className="flex gap-2">
                      {evidenceItem.attachments?.[0] && onPreviewFile && (
                        <button
                          onClick={() => onPreviewFile(evidenceItem.attachments[0])}
                          className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors whitespace-nowrap"
                        >
                          Preview
                        </button>
                      )}
                      <button
                        onClick={() => openEditRecordModal("evidence", evidenceItem)}
                        className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors whitespace-nowrap"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}