import { useState, useEffect } from "react";
import AttachmentPreview from "./AttachmentPreview";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { isTimelineCapable, getCaseHealthReport } from "../lib/caseHealth";
import RecordCard from "./RecordCard";

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
  onUpdateCase,
  onExportSnapshot,
  onSyncToSupabase,
  onExportFullCase,
  onViewRecord,
  onPreviewFile,
  syncStatus = "idle",
  syncMessage = "",
  fullCaseExportStatus = "idle",
  fullCaseExportMessage = "",
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [taskFilter, setTaskFilter] = useState("open"); // "open", "done", "all"
  const [ideas, setIdeas] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState("all");
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

  const openLinkedRecord = (recordId) => {
    const found = findRecordById(recordId);
    if (!found) return;

    const { record, type } = found;
    setActiveTab(type);
    openEditRecordModal(type, record);
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
  return (
    <RecordCard
      item={item}
      recordType={recordType}
      selectedCase={selectedCase}
      imageCache={imageCache}
      onPreviewFile={onPreviewFile}
      onViewRecord={onViewRecord}
      openEditRecordModal={openEditRecordModal}
      deleteRecord={deleteRecord}
      toggleTaskStatus={toggleTaskStatus}
      openLinkedRecord={openLinkedRecord}
      openRecordModal={openRecordModal}
    />
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

  const milestones = timelineItems.filter(item => item.importance === "critical");

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
        <div className="flex gap-2 flex-wrap items-start">
          <div className="relative flex-1 min-w-max">
            <button 
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full px-3 py-1.5 text-sm rounded-md whitespace-nowrap border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95 flex items-center justify-center gap-1"
            >
              + Add <ChevronDown className={`h-4 w-4 transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                <div className="absolute left-0 mt-2 w-48 rounded-xl border border-neutral-200 bg-white shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                  <button 
                    onClick={() => { openRecordModal("incidents"); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Incident
                  </button>
                  <button 
                    onClick={() => { openRecordModal("evidence"); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Evidence
                  </button>
                  <button 
                    onClick={() => { openRecordModal("tasks"); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Task
                  </button>
                  <button 
                    onClick={() => { openRecordModal("strategy"); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Strategy
                  </button>
                  <button 
                    onClick={() => {
                      const newIdea = { id: Date.now().toString(), title: "New idea", description: "", status: "raw" };
                      const updatedIdeas = [...(selectedCase.ideas || []), newIdea];
                      setIdeas(updatedIdeas);
                      onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
                      setShowAddMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 text-neutral-700 font-medium border-t border-neutral-50 transition-colors"
                  >
                    Idea
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="relative flex-1 min-w-max">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full px-3 py-1.5 text-sm rounded-md whitespace-nowrap border-2 border-lime-500 bg-white font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95 flex items-center justify-center gap-1"
            >
              Export <ChevronDown className={`h-4 w-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-200 bg-white shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                  <button 
                    onClick={() => { exportSelectedCase(); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Backup Case (JSON)
                  </button>
                  <button 
                    onClick={() => { onExportSnapshot(selectedCase.id, "compact"); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700 font-medium border-t border-neutral-50 transition-colors"
                  >
                    Export Snapshot (Compact)
                  </button>
                  <button 
                    onClick={() => { onExportSnapshot(selectedCase.id, "detailed"); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                  >
                    Export Snapshot (Detailed)
                  </button>
                  <button 
                    onClick={() => { onExportFullCase(); setShowExportMenu(false); }}
                    disabled={fullCaseExportStatus === "exporting"}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700 font-medium border-t border-neutral-50 transition-colors disabled:opacity-50"
                  >
                    Export Reasoning Case
                  </button>
                  <button 
                    onClick={() => { onSyncToSupabase(); setShowExportMenu(false); }}
                    disabled={syncStatus === "syncing"}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 text-neutral-700 font-medium transition-colors disabled:opacity-50"
                  >
                    Sync Snapshot
                  </button>
                </div>
              </>
            )}
            
            <div className="mt-1 flex flex-col items-center">
              {syncMessage && (
                <span className={`text-[10px] font-bold uppercase tracking-tight text-center ${syncStatus === 'error' ? 'text-red-500' : 'text-lime-600'}`}>{syncMessage}</span>
              )}
              {fullCaseExportMessage && (
                <span className={`text-[10px] font-bold uppercase tracking-tight text-center ${fullCaseExportStatus === 'error' ? 'text-red-500' : 'text-lime-600'}`}>{fullCaseExportMessage}</span>
              )}
            </div>
          </div>
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
            <div className="flex gap-2 mb-2">
              {["open", "done", "all"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={`px-3 py-1 text-sm rounded-md border ${
                    taskFilter === filter
                      ? "bg-lime-400/30 border-lime-500"
                      : "bg-white border-neutral-300"
                  }`}
                >
                  {filter === "open" ? "Open" : filter === "done" ? "Done" : "All"}
                </button>
              ))}
            </div>

            {renderListBlock(
              (() => {
                const tasks = selectedCase.tasks || [];
                if (taskFilter === "open") return tasks.filter((t) => t.status?.toLowerCase() !== "done");
                if (taskFilter === "done") return tasks.filter((t) => t.status?.toLowerCase() === "done");
                return tasks;
              })(),
              "No tasks found.",
              "tasks"
            )}
          </div>
        )}
        {activeTab === "strategy" && renderListBlock(selectedCase.strategy, "No strategy notes yet. Add strategy to track approach and planning.", "strategy")}

        {activeTab === "ideas" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Ideas</h3>
              <button
                onClick={() =>
                onUpdateCase({
                  ...selectedCase,
                  ideas: [
                    ...(selectedCase.ideas || []),
                    { id: Date.now().toString(), title: "New idea", description: "", status: "raw" }
                  ]
                })
                }
                className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-medium text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
              >
                + Idea
              </button>
            </div>

            {ideas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                No ideas yet.
              </div>
            ) : (
              <div className="space-y-3">
                {ideas.map((idea) => (
                  <div key={idea.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <input
                      value={idea.title}
                      onChange={(e) => {
                        const updatedIdeas = ideas.map((item) =>
                          item.id === idea.id ? { ...item, title: e.target.value } : item
                        );
                        setIdeas(updatedIdeas);
                        onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
                      }}
                      className="w-full font-bold text-neutral-900 bg-transparent border-none focus:ring-0 p-0"
                    />
                    <textarea
                      value={idea.description}
                      onChange={(e) => {
                        const updatedIdeas = ideas.map((item) =>
                          item.id === idea.id ? { ...item, description: e.target.value } : item
                        );
                        setIdeas(updatedIdeas);
                        onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
                      }}
                      className="w-full text-sm text-neutral-600 bg-transparent border-none focus:ring-0 p-0 resize-none"
                      placeholder="Add a description..."
                      rows={2}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-[10px] font-bold uppercase text-neutral-400">Status: {idea.status}</div>
                      <button
                        onClick={() => {
                          const updatedIdeas = ideas.filter((item) => item.id !== idea.id);
                          setIdeas(updatedIdeas);
                          onUpdateCase({ ...selectedCase, ideas: updatedIdeas });
                        }}
                        className="text-[10px] font-bold uppercase text-red-500 hover:text-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-6">
            {/* Milestones Layer */}
            {milestones.length > 0 && (
              <div className="mb-8 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-lime-500 animate-pulse"></span>
                  Key Milestones
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {milestones.map((m) => (
                    <div key={`milestone-${m.id}`} className="group relative p-4 rounded-2xl border-2 border-lime-500 bg-white shadow-[0_4px_12px_rgba(132,204,22,0.1)] transition-all hover:shadow-[0_4px_20px_rgba(132,204,22,0.2)]">
                      <div className="text-[10px] font-bold text-lime-600 uppercase tracking-widest mb-1">{m.eventDate || m.date}</div>
                      <div className="font-bold text-neutral-900 leading-tight mb-2 text-lg">{m.title}</div>
                      {m.description && <p className="text-xs text-neutral-600 line-clamp-2 italic mb-3">"{m.description}"</p>}
                      <button 
                        onClick={() => openLinkedRecord(m.id)}
                        className="text-[10px] font-extrabold uppercase tracking-tighter text-neutral-400 group-hover:text-lime-600 transition-colors flex items-center gap-1"
                      >
                        View Origin Record <span>→</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Filter Controls */}
            <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto">
              {["all", "incidents", "evidence", "strategy", "tasks"].map((f) => (
                <button
                  key={f}
                  onClick={() => setTimelineFilter(f)}
                  className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all ${
                    timelineFilter === f
                      ? "bg-lime-500 border-lime-600 text-white shadow-md"
                      : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {timelineItems.filter(item => {
              if (timelineFilter === "all") return true;
              const filterMap = {
                incidents: "Incident",
                evidence: "Evidence",
                tasks: "Task",
                strategy: "Strategy"
              };
              return item._kind === filterMap[timelineFilter];
            }).length ? (
              (() => {
                const filtered = timelineItems.filter(item => {
                  if (timelineFilter === "all") return true;
                  const filterMap = { incidents: "Incident", evidence: "Evidence", tasks: "Task", strategy: "Strategy" };
                  return item._kind === filterMap[timelineFilter];
                });

                const groups = [];
                let lastDate = null;
                filtered.forEach(item => {
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
                      {group.items.map((item) => {
                        const kindToTypeMap = {
                          Evidence: "evidence",
                          Incident: "incidents",
                          Task: "tasks",
                          Strategy: "strategy",
                        };
                        const recordType = kindToTypeMap[item._kind] || "evidence";

                        return (
                          <RecordCard
                            key={`${item._kind}-${item.id}`}
                            item={item}
                            recordType={recordType}
                            selectedCase={selectedCase}
                            imageCache={imageCache}
                            onPreviewFile={onPreviewFile}
                            onViewRecord={onViewRecord}
                            openEditRecordModal={openEditRecordModal}
                            deleteRecord={deleteRecord}
                            toggleTaskStatus={toggleTaskStatus}
                            openLinkedRecord={openLinkedRecord}
                            openRecordModal={openRecordModal}
                            showTypeBadge={true}
                            isTimeline={true}
                          />
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
  );}
