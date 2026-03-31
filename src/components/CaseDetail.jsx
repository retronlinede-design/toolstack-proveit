import { useState } from "react";
import AttachmentPreview from "./AttachmentPreview";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { isTimelineCapable, getCaseHealthReport } from "../lib/caseHealth";

export default function CaseDetail({
  selectedCase,
  reviewQueue,
  activeTab,
  setActiveTab,
  tabs,
  imageCache,
  setSelectedCaseId,
  openRecordModal,
  renderCaseList,
  openEditRecordModal,
  toggleTaskStatus,
  openEditCaseModal,
  deleteRecord,
  exportSelectedCase,
  onExportSnapshot,
  onSyncToSupabase,
  onViewRecord,
  onPreviewFile,
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const toggleGroup = (cat) => setExpandedGroups((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const health = selectedCase ? getCaseHealthReport(selectedCase) : null;

  const nextAction = (selectedCase?.tasks || []).find(t => t.status?.toLowerCase() !== "done");
  const handleOpenNextAction = () => {
    if (!nextAction) return;
    setActiveTab("tasks");
    setTimeout(() => {
      const el = document.getElementById(`record-${nextAction.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleOpenIssue = (issue) => {
    if (issue.tab) setActiveTab(issue.tab);
    if (issue.record && issue.type) {
      openEditRecordModal(issue.type, issue.record);
      setTimeout(() => {
        const el = document.getElementById(`record-${issue.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  };

  // Helper to find a record by ID across all record types in the current case
  const findRecordById = (recordId) => {
    const recordTypes = ['evidence', 'incidents', 'tasks', 'strategy'];
    for (const type of recordTypes) {
      const record = selectedCase[type]?.find(r => r.id === recordId);
      if (record) {
        // For timeline items, ensure eventDate is present for sorting consistency
        const recordToReturn = isTimelineCapable(type) ? { ...record, eventDate: record.eventDate || record.date } : record;
        return { record: recordToReturn, type };
      }
    }
    return null;
  };

  const statusConfig = {
    Healthy: { color: "text-lime-600 bg-lime-50 border-lime-200", icon: CheckCircle2 },
    "Needs review": { color: "text-amber-600 bg-amber-50 border-amber-200", icon: AlertTriangle },
    "High risk": { color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
  };

  if (!selectedCase) return renderCaseList();

  const sortChronological = (items) => {
    return [...items].sort((a, b) => {
      const dateA = a.eventDate || a.date || "";
      const dateB = b.eventDate || b.date || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const createdA = a.createdAt || "";
      const createdB = b.createdAt || "";
      if (createdA !== createdB) return createdA.localeCompare(createdB);

      // Tie-breaker for same date/timestamp items
      const idA = String(a.id || "");
      const idB = String(b.id || "");
      return idA.localeCompare(idB);
    });
  };

  const renderRecordCard = (item, recordType) => {
    const isTask = recordType === 'tasks';
    const isDone = isTask && item.status?.toLowerCase() === 'done';

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
              <div className="font-semibold text-neutral-900">{item.title}</div>
              <div className="mt-2 space-y-1 text-xs text-neutral-500">
                <div><span className="font-medium text-neutral-700">Incident Date:</span> {item.eventDate || item.date}</div>
                <div>
                  <span className="font-medium text-neutral-700">Logged:</span> {item.createdAt 
                    ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + 
                      new Date(item.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                    : 'Unknown'}
                </div>
              </div>
                {item.linkedRecordIds && Array.isArray(item.linkedRecordIds) && item.linkedRecordIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="font-bold uppercase tracking-tight text-neutral-500">Linked:</span>
                    <div className="flex flex-wrap gap-1">
                      {item.linkedRecordIds.map(linkedId => (
                        <span key={linkedId} className="px-1.5 py-0.5 rounded border border-neutral-300 bg-neutral-100 font-mono text-neutral-700 shadow-sm">
                          {linkedId.substring(0, 8)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
          {recordType === 'evidence' && (
            <div className="mt-2 flex gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.availability?.physical?.hasOriginal ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-neutral-100 border-neutral-200 text-neutral-400'}`}>
                PHYSICAL
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.availability?.digital?.hasDigital ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-neutral-100 border-neutral-200 text-neutral-400'}`}>
                DIGITAL {item.attachments?.length > 0 && `(${item.attachments.length})`}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            {recordType === 'evidence' && (
              <button
                onClick={() => onViewRecord(item)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.1)] hover:bg-neutral-50 transition-colors"
              >
                View
              </button>
            )}
            <button
              onClick={() => {
                if (recordType === 'evidence') console.log("EDIT EVIDENCE", item);
                openEditRecordModal(recordType, item);
              }}
              className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
            >
              Edit
            </button>
            <button onClick={() => deleteRecord(recordType, item.id)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-red-600 shadow-[0_2px_4px_rgba(60,60,60,0.1)] hover:bg-red-50 hover:border-red-200 transition-colors">Delete</button>
          </div>
        </div>
        {item.description ? <p className="mt-3 text-sm text-neutral-700">{item.description}</p> : null}
        {item.notes ? <p className="mt-2 text-sm text-neutral-500">{item.notes}</p> : null}
        <AttachmentPreview 
          attachments={item.attachments || []}
          imageCache={imageCache}
          onPreview={onPreviewFile}
        />

        {recordType === 'incidents' && item.linkedEvidenceIds && item.linkedEvidenceIds.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Linked Evidence</h4>
            <div className="space-y-2">
              {item.linkedEvidenceIds.map(evidenceId => {
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
                          <button onClick={() => onPreviewFile(evidenceItem.attachments[0])} className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors">Preview</button>
                        )}
                        <button onClick={() => openEditRecordModal("evidence", evidenceItem)} className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors">Open</button>
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
  };

  const renderListBlock = (items, emptyText, recordType) => {
    if (!items || !items.length) {
      return (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          {emptyText}
        </div>
      );
    }

    if (!isTimelineCapable(recordType)) {
      return (
        <div className="space-y-3">
          {items.map((item) => renderRecordCard(item, recordType))}
        </div>
      );
    }

    // Chronological grouping logic (like in Timeline tab)
    const sorted = sortChronological(items);
    const groups = [];
    let lastDate = null;
    sorted.forEach(item => {
      const d = item.eventDate || item.date || "Unknown Date";
      if (d !== lastDate) {
        groups.push({ date: d, items: [item] });
        lastDate = d;
      } else {
        groups[groups.length - 1].items.push(item);
      }
    });

    return (
      <div className="space-y-8">
        {groups.map(group => (
          <div key={group.date} className="space-y-4">
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="mx-4 flex-shrink text-xs font-bold uppercase tracking-widest text-neutral-400">
                {group.date}
              </span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>
            <div className="space-y-3">
              {group.items.map(item => renderRecordCard(item, recordType))}
            </div>
          </div>
        ))}
      </div>
    );
  };


  const caseInboxCount = reviewQueue.filter((item) => item.caseId === selectedCase.id).length;
  const timelineItems = sortChronological([
    ...selectedCase.evidence.map((item) => ({ ...item, _kind: "Evidence" })),
    ...selectedCase.incidents.map((item) => ({ ...item, _kind: "Incident" })),
    ...selectedCase.tasks.map((item) => ({ ...item, _kind: "Task" })),
    ...selectedCase.strategy.map((item) => ({ ...item, _kind: "Strategy" })),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button onClick={() => setSelectedCaseId(null)} className="mb-3 text-sm font-medium text-neutral-500 underline-offset-4 hover:underline">
            ← Back to Cases
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{selectedCase.name}</h2>
            <button onClick={() => openEditCaseModal(selectedCase)} className="text-sm font-medium text-lime-600 hover:text-lime-700">
              Edit
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-600">Category: {selectedCase.category}</p>
          {selectedCase.notes ? <p className="mt-3 max-w-2xl text-sm text-neutral-700">{selectedCase.notes}</p> : null}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => openRecordModal("evidence")} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">+ Evidence</button>
          <button onClick={() => openRecordModal("incidents")} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">+ Incident</button>
          <button onClick={() => openRecordModal("tasks")} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">+ Task</button>
          <button onClick={() => openRecordModal("strategy")} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">+ Strategy</button>
          <button onClick={exportSelectedCase} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">Export Case</button>
          <button onClick={() => onExportSnapshot(selectedCase.id, "compact")} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">Export Snapshot (Compact)</button>
          <button onClick={() => onExportSnapshot(selectedCase.id, "detailed")} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">Export Snapshot (Detailed)</button>
          <button onClick={onSyncToSupabase} className="flex-1 min-w-max px-3 py-1.5 text-sm rounded-md whitespace-nowrap text-center border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95">Sync to Supabase</button>
        </div>
      </div>

      {/* Next Action Panel */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-3">Next Action</h3>
        {nextAction ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-lime-100 bg-lime-50/30 p-4">
            <div className="min-w-0">
              <div className="font-semibold text-neutral-900 truncate">{nextAction.title}</div>
              <div className="text-xs text-neutral-500 mt-1">{nextAction.date || "No date set"}</div>
            </div>
            <button 
              onClick={handleOpenNextAction}
              className="flex-shrink-0 rounded-xl border border-lime-500 bg-white px-4 py-2 text-xs font-bold text-neutral-800 shadow-sm hover:bg-lime-400/30 transition-all active:scale-95"
            >
              Open Task
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 p-4 text-center">
            <p className="text-sm text-neutral-500 italic">No open tasks</p>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl border border-lime-500 px-4 py-2 text-sm font-medium shadow-[0_2px_4px_rgba(60,60,60,0.2)] transition-colors ${
                  activeTab === tab.id ? "bg-lime-400/30 text-neutral-900" : "bg-white text-neutral-700 hover:bg-lime-400/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Case Health Card */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Case Health</h3>
                  {health && (
                    <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${statusConfig[health.status].color}`}>
                      {(() => {
                        const Icon = statusConfig[health.status].icon;
                        return <Icon className="h-3 w-3" />;
                      })()}
                      {health.status}
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium text-neutral-500">
                  {health?.totalIssues} issue{health?.totalIssues !== 1 ? "s" : ""} found
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                {health &&
                  Object.entries(health.totals).map(([label, count]) => (
                    <div key={label} className="rounded-xl border border-neutral-200 bg-white p-2 text-center">
                      <div className="text-xl font-bold text-neutral-800">{count}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
                    </div>
                  ))}
              </div>

              {health?.issues.length > 0 && (
                <div className="space-y-2">
                  {health.issues.map((group) => (
                    <div key={group.category} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                      <button onClick={() => toggleGroup(group.category)} className="flex w-full items-center justify-between p-3 transition-colors hover:bg-neutral-50">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-700">{group.category}</span>
                          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">{group.items.length}</span>
                        </div>
                        {expandedGroups[group.category] ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronRight className="h-4 w-4 text-neutral-400" />}
                      </button>
                      {expandedGroups[group.category] && (
                        <div className="space-y-2 border-t border-neutral-100 px-3 pb-3 pt-2">
                          {group.items.map((item, idx) => (
                            <div key={idx} className="border-b border-neutral-50 pb-2 text-xs last:border-0 last:pb-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-start justify-between">
                                    <span className="font-semibold text-neutral-800">{item.title}</span>
                                    {item.date && <span className="font-medium text-neutral-400">{item.date}</span>}
                                  </div>
                                  <div className="mt-0.5 text-neutral-500">{item.detail}</div>
                                </div>
                                <button
                                  onClick={() => handleOpenIssue(item)}
                                  className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                                >
                                  Open
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold">Case Overview</h3>
              <p className="mt-1 text-sm text-neutral-600">Use this case view to organize evidence, incidents, tasks, and strategy in one place.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-2xl font-semibold">{selectedCase.evidence.length}</div><div className="text-sm text-neutral-600">Evidence</div></div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-2xl font-semibold">{selectedCase.incidents.length}</div><div className="text-sm text-neutral-600">Incidents</div></div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-2xl font-semibold">{selectedCase.tasks.length}</div><div className="text-sm text-neutral-600">Tasks</div></div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-2xl font-semibold">{selectedCase.strategy.length}</div><div className="text-sm text-neutral-600">Strategy</div></div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-2xl font-semibold">{caseInboxCount}</div><div className="text-sm text-neutral-600">Inbox</div></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold">Suggested next step</div>
                <p className="mt-2 text-sm text-neutral-600">Use Quick Capture when something happens fast, then review and convert it into evidence, incidents, tasks, or strategy.</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="font-semibold">Pack readiness</div>
                <p className="mt-2 text-sm text-neutral-600">Later, this case will generate a clean evidence and incident pack for print/export.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "evidence" && renderListBlock(selectedCase.evidence, "No evidence yet. Add your first evidence item for this case.", "evidence")}
        {activeTab === "incidents" && renderListBlock(selectedCase.incidents, "No incidents yet. Add your first incident to start the case timeline.", "incidents")}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCompletedTasks}
                  onChange={(e) => setShowCompletedTasks(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                />
                <span className="text-sm font-medium text-neutral-600">Show completed tasks</span>
              </label>
            </div>
            {renderListBlock(
              (() => {
                const tasks = selectedCase.tasks || [];
                const filtered = showCompletedTasks 
                  ? tasks 
                  : tasks.filter(t => t.status?.toLowerCase() !== "done");
                // Sort so completed tasks are always at the bottom when visible
                return [...filtered].sort((a, b) => {
                  if (a.status === b.status) return 0;
                  return a.status?.toLowerCase() === 'done' ? 1 : -1;
                });
              })(),
              "No open tasks. Use '+ Task' to add a new one or check 'Show completed' to see past work.",
              "tasks"
            )}
          </div>
        )}
        {activeTab === "strategy" && renderListBlock(selectedCase.strategy, "No strategy notes yet. Add strategy to track approach and planning.", "strategy")}

        {activeTab === "timeline" && (
          <div className="space-y-8">
            {timelineItems.length ? (
              (() => {
                // TASK 1: Group timeline items by eventDate
                const groups = [];
                let lastDate = null;
                timelineItems.forEach(item => {
                  const d = item.eventDate || item.date || "Unknown Date";
                  if (d !== lastDate) {
                    groups.push({ date: d, items: [item] });
                    lastDate = d;
                  } else {
                    groups[groups.length - 1].items.push(item);
                  }
                });

                return groups.map(group => (
                  <div key={group.date} className="space-y-4">
                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-neutral-200"></div>
                      <span className="mx-4 flex-shrink text-xs font-bold uppercase tracking-widest text-neutral-400">
                        {group.date}
                      </span>
                      <div className="flex-grow border-t border-neutral-200"></div>
                    </div>
                    <div className="space-y-3">
                      {group.items.map(item => {
                        const isDoneTask = item._kind === 'Task' && item.status === 'done';
                        return (
                          <div key={`${item._kind}-${item.id}`} id={`record-${item.id}`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className={isDoneTask ? 'line-through opacity-60' : ''}>
                                <div className="font-semibold text-neutral-900">{item.title}</div>
                                {/* TASK 2: Show both Incident Date and Logged date */}
                                <div className="mt-2 space-y-1 text-xs text-neutral-500">
                                  <div><span className="font-medium text-neutral-700">Incident Date:</span> {item.eventDate || item.date}</div>
                                  <div>
                                    <span className="font-medium text-neutral-700">Logged:</span> {item.createdAt 
                                      ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + 
                                        new Date(item.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                      : 'Unknown'}
                                  </div>
                                </div>
                                {item.linkedRecordIds && Array.isArray(item.linkedRecordIds) && item.linkedRecordIds.length > 0 && (
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                                    <span className="font-bold uppercase tracking-tight text-neutral-500">Linked:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {item.linkedRecordIds.map(linkedId => (
                                        <span key={linkedId} className="px-1.5 py-0.5 rounded border border-neutral-300 bg-neutral-100 font-mono text-neutral-700 shadow-sm">
                                          {linkedId.substring(0, 8)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700">{item._kind}</span>
                                <button
                                  onClick={() => {
                                    let recordType = item._kind.toLowerCase();
                                    if (recordType === 'incident' || recordType === 'task') {
                                        recordType += 's';
                                    }
                                    if (recordType === 'evidence') console.log("EDIT EVIDENCE", item);
                                    openEditRecordModal(recordType, item);
                                  }}
                                  className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                                >Edit</button>
                                <button
                                  onClick={() => {
                                    let recordType = item._kind.toLowerCase();
                                    if (recordType === 'incident' || recordType === 'task') {
                                        recordType += 's';
                                    }
                                    deleteRecord(recordType, item.id);
                                  }} className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-red-600 shadow-[0_2px_4px_rgba(60,60,60,0.1)] hover:bg-red-50 hover:border-red-200 transition-colors">Delete</button>
                              </div>
                            </div>
                            {item.description ? <p className="mt-3 text-sm text-neutral-700">{item.description}</p> : null}
                            {item.notes ? <p className="mt-2 text-sm text-neutral-500">{item.notes}</p> : null}
                            <AttachmentPreview 
                              attachments={item.attachments || []}
                              imageCache={imageCache}
                              onPreview={onPreviewFile}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                No timeline entries yet. Add records to see the chronology of the case.
              </div>
            )}
          </div>
        )}

        {activeTab === "pack" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pack Preview</h3>
            <p className="text-sm text-neutral-600">V1 pack will include evidence and incidents only. Tasks are intentionally excluded from the print pack.</p>
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
              Pack preview placeholder. Later this view will assemble the selected evidence and incidents into a clean printable case file.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
