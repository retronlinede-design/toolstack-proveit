import { useState, useEffect, useRef } from "react";

export default function RecordModal({
  recordType,
  selectedCase,
  recordForm,
  setRecordForm,
  handleRecordFiles,
  removeRecordAttachment,
  saveRecord,
  closeRecordModal,
  onPreviewFile,
  openEditRecordModal,
  onCreateEvidenceFromIncident,
  onUnlinkEvidenceFromIncident,
}) {
  const [isLinking, setIsLinking] = useState(false);
  const [tempSelection, setTempSelection] = useState([]);

  // Follow-up task helper logic for new records
  const lastAutoTitle = useRef("");
  const prevAttachmentsLength = useRef(recordForm.attachments?.length || 0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Only apply automation for NEW incidents and evidence
    if (recordForm.id || (recordType !== "incidents" && recordType !== "evidence")) return;

    const currentLen = recordForm.attachments?.length || 0;
    const prevLen = prevAttachmentsLength.current;
    prevAttachmentsLength.current = currentLen;

    const getTargetDefault = (type, title) => {
      const t = title?.trim();
      if (type === "incidents") {
        return t ? `Digitise / upload supporting evidence for: ${t}` : "Digitise / upload supporting evidence";
      }
      return t ? `Upload or confirm existing evidence for: ${t}` : "Upload or confirm existing evidence";
    };

    const currentDefault = getTargetDefault(recordType, recordForm.title);
    const updates = {};

    // Auto-toggle checkbox based on attachment transitions (Req 2, 4, 5)
    if (currentLen === 0) {
      if (prevLen > 0 || isInitialMount.current) {
        updates.createFollowUpTask = true;
      }
    } else if (currentLen > 0 && prevLen === 0) {
      updates.createFollowUpTask = false;
    }

    // Auto-prefill / Update title (Req 3, 5)
    // Only update if field is empty or still matches the last auto-generated string
    const isTitleEmpty = !recordForm.followUpTaskTitle;
    const matchesLastAuto = recordForm.followUpTaskTitle === lastAutoTitle.current;

    if (isTitleEmpty || matchesLastAuto) {
      if (recordForm.followUpTaskTitle !== currentDefault) {
        updates.followUpTaskTitle = currentDefault;
        lastAutoTitle.current = currentDefault;
      }
    }

    if (Object.keys(updates).length > 0) {
      setRecordForm(prev => ({ ...prev, ...updates }));
    }
    isInitialMount.current = false;
  }, [recordForm.attachments?.length, recordForm.title, recordForm.followUpTaskTitle, recordType, recordForm.id, setRecordForm]);

  const toggleEvidenceLink = (id) => {
    setTempSelection(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirmLinks = () => {
    const targetField = recordType === "tasks" ? "linkedRecordIds" : "linkedEvidenceIds";
    setRecordForm({
      ...recordForm,
      [targetField]: Array.from(new Set([...(recordForm[targetField] || []), ...tempSelection]))
    });
    setIsLinking(false);
    setTempSelection([]);
  };

  const isEdit = !!recordForm.id;
  const typeLabelMap = {
    tasks: "Task",
    evidence: "Evidence",
    incidents: "Incident",
    strategy: "Strategy",
  };

  const getRecordDetails = (id) => {
    const all = [
      ...selectedCase.evidence,
      ...selectedCase.incidents,
      ...selectedCase.strategy,
      ...(selectedCase.tasks || []),
    ];
    const found = all.find((r) => r.id === id);
    if (!found) return null;
    return { 
      title: found.title || "Untitled", 
      type: found.type, 
      typeLabel: typeLabelMap[found.type] || "Record", 
      raw: found 
    };
  };

  const typeLabel = typeLabelMap[recordType] || recordType;

  const relatedTasks = (selectedCase?.tasks || []).filter(t => 
    t.linkedRecordIds?.includes(recordForm.id)
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-6 pb-0">
          <h2 className="text-xl font-semibold">
            {isLinking ? (recordType === "tasks" ? "Link Related Records" : "Link Existing Evidence") : `${isEdit ? "Edit" : "Add"} ${typeLabel}`}
          </h2>
          <p className="mb-4 text-sm text-neutral-600">Case: {selectedCase.name}</p>
        </div>

        <div className="p-6 pt-0 overflow-y-auto flex-1">
        {isLinking ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 mb-4">
              {recordType === "tasks" ? "Select records from this case to link to this task." : "Select evidence items from this case to link to this incident."}
            </p>
            <div className="space-y-2">
              {(() => {
                const candidates = recordType === "tasks" 
                  ? [
                      ...selectedCase.incidents.map(i => ({...i, _type: 'Incident'})), 
                      ...selectedCase.evidence.map(e => ({...e, _type: 'Evidence'})), 
                      ...selectedCase.strategy.map(s => ({...s, _type: 'Strategy'}))
                    ]
                  : selectedCase.evidence;

                if (candidates.length === 0) return <p className="text-sm text-neutral-500 italic py-4 text-center">No records available to link.</p>;

                return candidates.map(rec => {
                  if (rec.id === recordForm.id) return null;
                  const isAlreadyLinked = recordType === "tasks" 
                    ? recordForm.linkedRecordIds?.includes(rec.id)
                    : recordForm.linkedEvidenceIds?.includes(rec.id);
                  
                  return (
                    <label key={rec.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${isAlreadyLinked ? 'bg-neutral-50 border-neutral-100 opacity-60' : 'bg-white border-neutral-200 hover:border-lime-300 hover:bg-lime-50/30'}`}>
                      <div className="flex items-center gap-3 truncate">
                        <input 
                          type="checkbox"
                          checked={isAlreadyLinked || tempSelection.includes(rec.id)}
                          disabled={isAlreadyLinked}
                          onChange={() => toggleEvidenceLink(rec.id)}
                          className="h-5 w-5 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                        />
                        <div className="truncate">
                          <span className="truncate text-sm font-medium text-neutral-800">{rec.title || "Untitled"}</span>
                          {rec._type && <span className="ml-2 text-[9px] px-1 rounded bg-neutral-100 text-neutral-400 font-bold uppercase">{rec._type}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">{rec.date || rec.eventDate}</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>
        ) : (
          <>
        {recordType === "tasks" && recordForm.linkedRecordIds?.length > 0 && (
          <div className="mb-4 p-3 rounded-2xl bg-neutral-50 border border-neutral-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
              {recordForm.linkedRecordIds.length === 1 
                ? `Origin: ${getRecordDetails(recordForm.linkedRecordIds[0])?.typeLabel}` 
                : `Related: ${recordForm.linkedRecordIds.length} records`}
            </div>
            <div className="flex flex-wrap gap-2">
              {recordForm.linkedRecordIds.map((rid) => {
                const details = getRecordDetails(rid);
                if (!details) return null;
                return (
                  <button
                    key={rid}
                    onClick={() => openEditRecordModal(details.type, details.raw)}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:border-lime-500 hover:text-lime-600 transition-all text-left"
                  >
                    <span className="opacity-50 text-[9px] font-bold uppercase">[{details.typeLabel}]</span>
                    <span className="truncate max-w-[180px]">{details.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {recordType === "tasks" && (
          <div className="mb-4 space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Manage Related Records</h3>
              <button 
                onClick={() => setIsLinking(true)}
                className="text-[10px] font-bold uppercase text-lime-600 hover:text-lime-700"
              >
                Bulk Link
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {(recordForm.linkedRecordIds || []).map((rid) => {
                const details = getRecordDetails(rid);
                if (!details) return null;
                return (
                  <div key={rid} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-neutral-200 bg-white text-[11px] font-medium text-neutral-700 shadow-sm">
                    <span className="opacity-50 text-[9px] font-bold uppercase">{details.typeLabel}</span>
                    <span className="truncate max-w-[120px]">{details.title}</span>
                    <button 
                      onClick={() => setRecordForm({ ...recordForm, linkedRecordIds: recordForm.linkedRecordIds.filter(id => id !== rid) })}
                      className="ml-1 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <select 
              className="w-full rounded-xl border border-neutral-300 p-2 text-xs bg-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500 outline-none cursor-pointer"
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !recordForm.linkedRecordIds?.includes(val)) {
                  setRecordForm(prev => ({
                    ...prev,
                    linkedRecordIds: [...(prev.linkedRecordIds || []), val]
                  }));
                }
              }}
            >
              <option value="" disabled>+ Link record by title...</option>
              {[
                ...selectedCase.incidents.map(i => ({...i, _type: 'Incident'})), 
                ...selectedCase.evidence.map(e => ({...e, _type: 'Evidence'})), 
                ...selectedCase.strategy.map(s => ({...s, _type: 'Strategy'}))
              ].filter(r => r.id !== recordForm.id).map(r => (
                <option key={r.id} value={r.id} disabled={recordForm.linkedRecordIds?.includes(r.id)}>
                  {r.title || "Untitled"} ({r._type})
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          placeholder="Title"
          value={recordForm.title}
          onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
        />
        <input
          type="date"
          value={recordForm.date}
          onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
        />
        <textarea
          placeholder="Description"
          value={recordForm.description}
          onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
          rows={4}
        />
        <textarea
          placeholder="Notes"
          value={recordForm.notes}
          onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
          rows={3}
        />

        {recordType !== "tasks" && isEdit && relatedTasks.length > 0 && (
          <div className="mb-4 space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Related Tasks</h3>
            <div className="space-y-2">
              {relatedTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 bg-white">
                  <div className="truncate">
                    <div className="text-sm font-medium text-neutral-800 truncate">{task.title || "Untitled Task"}</div>
                    <div className="text-[10px] text-neutral-400 font-bold uppercase">Status: {task.status || "Open"}</div>
                  </div>
                  <button
                    onClick={() => {
                      // Switching to task edit modal
                      openEditRecordModal("tasks", task);
                    }}
                    className="flex-shrink-0 rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Follow-up task helper for new incidents and evidence */}
        {(recordType === "incidents" || recordType === "evidence") && !recordForm.id && (
          <div className="mb-4 space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="createFollowUpTask"
                checked={recordForm.createFollowUpTask || false}
                onChange={(e) => setRecordForm({ ...recordForm, createFollowUpTask: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
              />
              <label htmlFor="createFollowUpTask" className="text-sm font-medium text-neutral-700">
                Create follow-up task
              </label>
            </div>
            {recordForm.createFollowUpTask && (
              <input
                placeholder="Task title (optional, defaults to record title)"
                value={recordForm.followUpTaskTitle || ""}
                onChange={(e) => setRecordForm({ ...recordForm, followUpTaskTitle: e.target.value })}
                className="w-full rounded-xl border border-neutral-300 p-3 text-sm shadow-sm"
              />
            )}
          </div>
        )}

        {recordType === "evidence" && (
          <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Evidence Assessment</h3>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-600">Importance</label>
                <select 
                  value={recordForm.importance} 
                  onChange={(e) => setRecordForm({...recordForm, importance: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-xs"
                >
                  <option value="unreviewed">Unreviewed</option>
                  <option value="critical">Critical</option>
                  <option value="strong">Strong</option>
                  <option value="supporting">Supporting</option>
                  <option value="weak">Weak</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600">Relevance</label>
                <select 
                  value={recordForm.relevance} 
                  onChange={(e) => setRecordForm({...recordForm, relevance: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-xs"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600">Status</label>
                <select 
                  value={recordForm.status} 
                  onChange={(e) => setRecordForm({...recordForm, status: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-xs"
                >
                  <option value="needs_review">Needs Review</option>
                  <option value="verified">Verified</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-600">Used In (Comma separated)</label>
              <input 
                placeholder="e.g. Complaint, Hearing, Timeline"
                value={recordForm.usedIn?.join(", ") || ""}
                onChange={(e) => setRecordForm({
                  ...recordForm, 
                  usedIn: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-600">Review Notes</label>
              <textarea 
                placeholder="Internal assessment notes..."
                value={recordForm.reviewNotes}
                onChange={(e) => setRecordForm({...recordForm, reviewNotes: e.target.value})}
                className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                rows={2}
              />
            </div>
          </div>
        )}

        {recordType === "evidence" && (
          <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Evidence Availability</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-neutral-600">Source Type</label>
                <select 
                  value={recordForm.sourceType} 
                  onChange={(e) => setRecordForm({...recordForm, sourceType: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-600">Captured At</label>
                <input 
                  type="date" 
                  value={recordForm.capturedAt} 
                  onChange={(e) => setRecordForm({...recordForm, capturedAt: e.target.value})}
                  className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-neutral-200 pt-3">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="hasOriginal"
                  checked={recordForm.availability?.physical?.hasOriginal}
                  onChange={(e) => setRecordForm({
                    ...recordForm, 
                    availability: {
                      ...(recordForm.availability || {}), 
                      physical: { ...(recordForm.availability?.physical || {}), hasOriginal: e.target.checked }
                    }
                  })}
                />
                <label htmlFor="hasOriginal" className="text-sm font-medium">Physical original available</label>
              </div>
              {recordForm.availability?.physical?.hasOriginal && (
                <div className="ml-6 space-y-2">
                  <input 
                    placeholder="Physical Location (Cabinet A, Box 2...)" 
                    value={recordForm.availability.physical.location}
                    onChange={(e) => setRecordForm({
                      ...recordForm,
                      availability: { 
                        ...(recordForm.availability || {}), 
                        physical: { ...(recordForm.availability?.physical || {}), location: e.target.value }
                      }
                    })}
                    className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
                  />
                  <textarea 
                    placeholder="Physical notes..." 
                    value={recordForm.availability.physical.notes}
                    onChange={(e) => setRecordForm({
                      ...recordForm,
                      availability: { 
                        ...(recordForm.availability || {}), 
                        physical: { ...(recordForm.availability?.physical || {}), notes: e.target.value }
                      }
                    })}
                    className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
                    rows={1}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-neutral-200 pt-3">
              <input 
                type="checkbox" 
                id="hasDigital"
                checked={recordForm.availability?.digital?.hasDigital}
                onChange={(e) => setRecordForm({
                  ...recordForm,
                  availability: {
                    ...(recordForm.availability || {}),
                    digital: { ...(recordForm.availability?.digital || {}), hasDigital: e.target.checked }
                  }
                })}
              />
              <label htmlFor="hasDigital" className="text-sm font-medium">Digital copy available</label>
            </div>
          </div>
        )}

        {recordType === "incidents" ? (
          <div className="space-y-4">
          <div className="mb-4 space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Linked Evidence</h3>
            {recordForm.linkedEvidenceIds && recordForm.linkedEvidenceIds.length > 0 ? (
              <div className="space-y-2">
                {recordForm.linkedEvidenceIds.map((evidenceId) => {
                  const evidenceItem = selectedCase.evidence.find(e => e.id === evidenceId);
                  if (!evidenceItem) return null;
                  return (
                    <div key={evidenceId} className="rounded-xl border border-neutral-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-neutral-800 truncate">{evidenceItem.title || "Untitled Evidence"}</span>
                        <div className="flex flex-wrap gap-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            evidenceItem.importance === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                            evidenceItem.importance === 'strong' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            'bg-neutral-100 border-neutral-200 text-neutral-500'
                          }`}>
                            {evidenceItem.importance?.toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            evidenceItem.status === 'verified' ? 'bg-lime-50 border-lime-200 text-lime-700' :
                            evidenceItem.status === 'incomplete' ? 'bg-red-50 border-red-200 text-red-700' :
                            'bg-neutral-100 border-neutral-200 text-neutral-500'
                          }`}>
                            {evidenceItem.status?.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          {evidenceItem.attachments?.[0]?.mimeType?.startsWith('image/') && 'Image'}
                          {evidenceItem.attachments?.[0]?.mimeType === 'application/pdf' && 'PDF'}
                          {evidenceItem.attachments?.[0] && !evidenceItem.attachments?.[0]?.mimeType?.startsWith('image/') && evidenceItem.attachments?.[0]?.mimeType !== 'application/pdf' && 'File'}
                          {!evidenceItem.attachments?.[0] && 'No Digital File'}
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
                          {openEditRecordModal && (
                            <button
                              onClick={() => openEditRecordModal("evidence", evidenceItem)}
                              className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                            >
                              Open
                            </button>
                          )}
                          <button
                            onClick={() => onUnlinkEvidenceFromIncident(recordForm.id, evidenceItem.id)}
                            className="rounded-lg border border-red-300 bg-white px-2 py-1 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                          >
                            Unlink
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">No evidence linked yet.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setIsLinking(true)} className="rounded-xl border border-lime-500 bg-white py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Link Existing
              </button>
              <button onClick={() => onCreateEvidenceFromIncident(recordForm)} className="rounded-xl border border-lime-500 bg-white py-2 text-xs font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                + Create New
              </button>
            </div>
          </div>
          <div className="mb-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500 italic">
            Files are stored in Evidence items and linked to incidents.
          </div>
          </div>
        ) : (
          <>
            <label className="mb-3 block cursor-pointer rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
              Upload attachments (images, PDFs, documents)
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleRecordFiles}
                accept="image/*,application/pdf,.pdf,.doc,.docx,.txt,.eml,message/rfc822"
              />
            </label>

            {recordForm.attachments.length > 0 && (
              <div className="mb-4 space-y-2">
                {recordForm.attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                    <span className="truncate pr-3">{file.name}</span>
                    <button
                      onClick={() => removeRecordAttachment(file.id)}
                      className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-xs text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        </>
        )}
        </div>

        <div className="p-6 pt-4 border-t border-neutral-100 flex gap-2">
          {isLinking ? (
            <>
              <button onClick={handleConfirmLinks} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Link Selected ({tempSelection.length})
              </button>
              <button onClick={() => setIsLinking(false)} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Back
              </button>
            </>
          ) : (
            <>
              <button onClick={saveRecord} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                {isEdit ? "Save Changes" : "Create"}
              </button>
              <button onClick={closeRecordModal} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
