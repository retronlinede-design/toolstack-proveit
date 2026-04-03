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
}) {
  const isTask = recordType === "tasks";
  const isDone = isTask && item.status?.toLowerCase() === "done";
  const canCreateTask = ["evidence", "incidents", "strategy"].includes(recordType);

  const badgeColors = {
    evidence: "bg-purple-50 text-purple-700 border-purple-200",
    incidents: "bg-amber-50 text-amber-700 border-amber-200",
    strategy: "bg-blue-50 text-blue-700 border-blue-200",
    tasks: "bg-lime-50 text-lime-700 border-lime-200",
  };

  const relatedTasks = (selectedCase?.tasks || []).filter(t => 
    t.linkedRecordIds?.includes(item.id)
  );

  return (
    <div key={item.id} id={`record-${item.id}`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {isTask && (
            <input
              type="checkbox"
              checked={isDone}
              onChange={() => toggleTaskStatus(item.id)}
              className="h-5 w-5 cursor-pointer rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
            />
          )}
          <div className={isDone ? "line-through opacity-60" : ""}>
            <div className="flex items-center gap-2">
              {showTypeBadge && (
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${badgeColors[recordType]}`}>
                  {recordType === "evidence" ? "Evidence" : recordType.slice(0, -1)}
                </span>
              )}
              <div className="font-semibold text-neutral-900">{item.title}</div>
            </div>
            <div className="mt-2 space-y-1 text-xs text-neutral-500">
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

            {item.linkedRecordIds &&
              Array.isArray(item.linkedRecordIds) &&
              item.linkedRecordIds.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="font-bold uppercase tracking-tight text-neutral-500">Linked:</span>
                  <div className="flex flex-wrap gap-1">
                    {item.linkedRecordIds.map((linkedId) => (
                      <button
                        key={linkedId}
                        onClick={() => openLinkedRecord?.(linkedId)}
                        className="px-1.5 py-0.5 rounded border border-neutral-300 bg-neutral-50 text-neutral-600 shadow-sm hover:bg-white hover:border-lime-500 hover:text-lime-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 active:scale-95 transition-all cursor-pointer truncate max-w-[150px]"
                      >
                        {(() => {
                          const all = [...selectedCase.evidence, ...selectedCase.incidents, ...selectedCase.strategy, ...selectedCase.tasks];
                          const found = all.find(r => r.id === linkedId);
                          return found?.title || linkedId.substring(0, 8);
                        })()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>

        {recordType === "evidence" && (
          <div className="flex flex-col items-end gap-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                item.availability?.physical?.hasOriginal
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-neutral-100 border-neutral-200 text-neutral-400"
              }`}
            >
              PHYSICAL
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                item.availability?.digital?.hasDigital
                  ? "bg-purple-50 border-purple-200 text-purple-700"
                  : "bg-neutral-100 border-neutral-200 text-neutral-400"
              }`}
            >
              DIGITAL {item.attachments?.length > 0 && `(${item.attachments.length})`}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          {recordType === "evidence" && (
            <button
              onClick={() => {
                const firstAttachment = item.attachments?.[0];

                if (firstAttachment && onPreviewFile) {
                  onPreviewFile(firstAttachment);
                } else {
                  onViewRecord?.(item);
                }
              }}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.1)] hover:bg-neutral-50 transition-colors"
            >
              View
            </button>
          )}
          {canCreateTask && (
            <button
              onClick={() => openRecordModal("tasks", {
                title: `Follow up: ${item.title}`,
                linkedRecordIds: [item.id]
              })}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.1)] hover:bg-neutral-50 transition-colors"
            >
              + Task
            </button>
          )}
          <button
            onClick={() => openEditRecordModal(recordType, item)}
            className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
          >
            Open
          </button>
          <button
            onClick={() => deleteRecord(recordType, item.id)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-red-600 shadow-[0_2px_4px_rgba(60,60,60,0.1)] hover:bg-red-50 hover:border-red-200 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {item.description ? (
        <p className={`mt-3 text-sm text-neutral-700 ${isTimeline ? "line-clamp-2" : ""}`}>
          {isTimeline && item.description.length > 160 
            ? item.description.substring(0, 160) + "..." 
            : item.description}
        </p>
      ) : null}
      {item.notes ? (
        <p className={`mt-2 text-sm text-neutral-500 italic ${isTimeline ? "line-clamp-1" : ""}`}>
          {isTimeline && item.notes.length > 100 
            ? item.notes.substring(0, 100) + "..." 
            : item.notes}
        </p>
      ) : null}

      <AttachmentPreview
        attachments={item.attachments || []}
        imageCache={imageCache}
        onPreview={onPreviewFile}
      />

      {recordType !== "tasks" && relatedTasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Related Tasks</h4>
          <div className="space-y-2">
            {relatedTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col truncate">
                    <span className="font-semibold text-neutral-800 truncate">
                      {task.title || "Untitled Task"}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">
                      Status: {task.status || "Open"}
                    </span>
                  </div>
                  <button
                    onClick={() => openEditRecordModal("tasks", task)}
                    className="flex-shrink-0 rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                          className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                        >
                          Preview
                        </button>
                      )}
                      <button
                        onClick={() => openEditRecordModal("evidence", evidenceItem)}
                        className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
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