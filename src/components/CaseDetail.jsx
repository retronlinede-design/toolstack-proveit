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
  onExportFullBackup,
  onViewRecord,
  onPreviewFile,
  openLedgerModal,
  deleteLedgerEntry,
  duplicateLedgerEntry,
  openDocumentModal,
  deleteDocumentEntry,
  syncStatus = "idle",
  syncMessage = "",
  fullCaseExportStatus = "idle",
  fullCaseExportMessage = "",
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timelineView, setTimelineView] = useState("core");
  const [timelineTagFilter, setTimelineTagFilter] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const [expandedDocuments, setExpandedDocuments] = useState({});
  const [collapsedLedgerGroups, setCollapsedLedgerGroups] = useState({});
   const [actionSummaryEditOpen, setActionSummaryEditOpen] = useState(false);
  const [actionSummaryForm, setActionSummaryForm] = useState({
    currentFocus: "",
    nextActions: "",
    importantReminders: "",
    strategyFocus: "",
  });

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleDocumentExpanded = (id) => {
    setExpandedDocuments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleLedgerGroup = (batchLabel) => {
    setCollapsedLedgerGroups(prev => ({
      ...prev,
      [batchLabel]: !prev[batchLabel],
    }));
  };

  const toggleGroup = (cat) => setExpandedGroups((prev) => ({ ...prev, [cat]: !prev[cat] }));

  function openActionSummaryEdit() {
    const s = selectedCase?.actionSummary || {};
    setActionSummaryForm({
      currentFocus: s.currentFocus || "",
      nextActions: (s.nextActions || []).join("\n"),
      importantReminders: (s.importantReminders || []).join("\n"),
      strategyFocus: (s.strategyFocus || []).join("\n"),
    });
    setActionSummaryEditOpen(true);
  }

  function saveActionSummary() {
    if (!selectedCase) return;

    const updated = {
      ...selectedCase,
      actionSummary: {
        currentFocus: actionSummaryForm.currentFocus,
        nextActions: actionSummaryForm.nextActions.split("\n").filter(Boolean),
        importantReminders: actionSummaryForm.importantReminders.split("\n").filter(Boolean),
        strategyFocus: actionSummaryForm.strategyFocus.split("\n").filter(Boolean),
        updatedAt: new Date().toISOString(),
      },
    };

    onUpdateCase(updated); // This already correctly calls the prop
    setActionSummaryEditOpen(false);
  }

  const health = selectedCase ? getCaseHealthReport(selectedCase) : null;

  const actionSummary = selectedCase?.actionSummary || {};
  const {
    currentFocus,
    nextActions = [],
    importantReminders = [],
    strategyFocus = [],
  } = actionSummary;

  const overviewStrategies = [...(selectedCase?.strategy || [])]
    .sort((a, b) => new Date(b.eventDate || b.date || 0) - new Date(a.eventDate || a.date || 0))
    .slice(0, 5);

  const scrollTopTabLabelMap = {
    overview: "Home",
    evidence: "Ev",
    incidents: "Inc",
    tasks: "Task",
    strategy: "Str",
    ledger: "Led",
    documents: "Doc",
  };

  const scrollTopLabel = scrollTopTabLabelMap[activeTab] || "Top";

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

  const timelineViewLabelMap = {
    core: "Core",
    master: "Master",
    incidents: "Incidents",
    evidence: "Evidence",
    milestones: "Milestones",
  };

  const timelineViewDescriptionMap = {
    core: "Key case chronology using incidents and evidence only.",
    master: "Complete chronological stream of all timeline-relevant records.",
    incidents: "Incident records only.",
    evidence: "Evidence records only.",
    milestones: "Critical turning points and major events.",
  };

  const timelineEmptyMessageMap = {
    core: "No incident or evidence records yet.",
    master: "No timeline records yet.",
    incidents: "No incidents recorded yet.",
    evidence: "No evidence records yet.",
    milestones: "No milestone items yet.",
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

  const sortLedgerEntries = (entries = []) => {
    return [...entries].sort((a, b) => {
      const aPayment = a.paymentDate || "";
      const bPayment = b.paymentDate || "";
      if (aPayment !== bPayment) return bPayment.localeCompare(aPayment);

      const aDue = a.dueDate || "";
      const bDue = b.dueDate || "";
      if (aDue !== bDue) return bDue.localeCompare(aDue);

      const aPeriod = a.period || "";
      const bPeriod = b.period || "";
      if (aPeriod !== bPeriod) return bPeriod.localeCompare(aPeriod);

      const aCreated = a.createdAt || "";
      const bCreated = b.createdAt || "";
      if (aCreated !== bCreated) return bCreated.localeCompare(aCreated);

      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  };

  const filterLedgerEntries = (entries = [], filter = "all") => {
    if (filter === "all") return entries;
    return entries.filter(item => item.category === filter);
  };

  const groupLedgerEntriesByBatch = (ledger = []) => {
    const groupedLedger = Object.values(
      ledger.reduce((acc, item) => {
        const key = item.batchLabel || "Ungrouped";
        if (!acc[key]) {
          acc[key] = {
            batchLabel: key,
            items: []
          };
        }
        acc[key].items.push(item);
        return acc;
      }, {})
    );

    groupedLedger.sort((a, b) => {
      if (a.batchLabel === "Ungrouped") return 1;
      if (b.batchLabel === "Ungrouped") return -1;
      return a.batchLabel.localeCompare(b.batchLabel);
    });

    groupedLedger.forEach(group => {
      group.items.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    return groupedLedger;
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

  const allTasks = selectedCase?.tasks || [];
  const openTasks = allTasks.filter((t) => t.status?.toLowerCase() !== "done");
  const doneTasks = allTasks.filter((t) => t.status?.toLowerCase() === "done");
  const nextTask = openTasks[0] || null;

  const allTimelineTags = Array.from(
    new Set(timelineItems.flatMap((item) => item.tags || []))
  ).sort();

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

      {/* Action Summary Panel */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">Action Summary</h3>
        <button
          onClick={openActionSummaryEdit}
          className="text-xs font-bold text-lime-600 hover:underline"
        >
          Edit
        </button>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">Current Focus</div>
            <p className="text-sm font-medium text-neutral-800">
              {currentFocus || "No current focus set."}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">Do Next</div>
            {nextActions.length > 0 ? (
              <ul className="space-y-1 list-disc list-inside marker:text-lime-500">
                {nextActions.map((action, i) => (
                  <li key={i} className="text-xs text-neutral-700">{action}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-500 italic">No next actions defined.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">Important Reminders</div>
            {importantReminders.length > 0 ? (
              <ul className="space-y-1 list-disc list-inside marker:text-amber-500">
                {importantReminders.map((reminder, i) => (
                  <li key={i} className="text-xs text-neutral-700">{reminder}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-500 italic">No reminders.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-tight text-neutral-400">Strategy Focus</div>
            <div className="flex flex-wrap gap-1.5">
              {strategyFocus.length > 0 ? strategyFocus.map((strat, i) => (
                <span key={i} className="px-2 py-0.5 rounded-lg bg-lime-50 border border-lime-100 text-[10px] font-bold text-lime-700">
                  {strat}
                </span>
              )) : <p className="text-xs text-neutral-500 italic">No strategy focus defined.</p>}
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

            {/* Strategy Overview Section */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Strategies</h3>
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                    {selectedCase.strategy?.length || 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openRecordModal("strategy")}
                    className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                  >
                    + Add Strategy
                  </button>
                  <button 
                    onClick={() => setActiveTab("strategy")}
                    className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                  >
                    View All
                  </button>
                </div>
              </div>

              {overviewStrategies.length === 0 ? (
                <p className="text-sm italic text-neutral-500">No strategy records yet.</p>
              ) : (
                <div className="space-y-2">
                  {overviewStrategies.map((item) => (
                    <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-neutral-800 truncate">{item.title}</span>
                            <span className="shrink-0 text-[10px] font-medium text-neutral-400">{item.eventDate || item.date}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{item.description || item.notes || "No description provided."}</div>
                        </div>
                        <button onClick={() => openEditRecordModal("strategy", item)} className="shrink-0 rounded-lg border border-lime-500 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors">Open</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
          <div className="space-y-8">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Open</div>
                <div className="mt-1 text-lg font-semibold text-neutral-900">{openTasks.length}</div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Completed</div>
                <div className="mt-1 text-lg font-semibold text-neutral-900">{doneTasks.length}</div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Next Action</div>
                <div className="mt-1 text-sm font-medium text-neutral-900 truncate">
                  {nextTask ? nextTask.title : "No open tasks"}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Action Now</h3>
              {renderListBlock(openTasks, "No open tasks remaining.", "tasks")}
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setShowCompletedTasks((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-100"
              >
                <span className="text-sm font-semibold text-neutral-900">
                  Completed ({doneTasks.length})
                </span>
                <span className="text-xs font-bold text-neutral-500">
                  {showCompletedTasks ? "Hide" : "Show"}
                </span>
              </button>

              {showCompletedTasks && renderListBlock(doneTasks, "No completed tasks yet.", "tasks")}
            </div>
          </div>
        )}
        {activeTab === "strategy" && renderListBlock(selectedCase.strategy, "No strategy notes yet. Add strategy to track approach and planning.", "strategy")}

        {activeTab === "ledger" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">Ledger</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openLedgerModal({ category: "rent" })}
                    className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                  >
                    + Rent
                  </button>
                  <button 
                    onClick={() => openLedgerModal({ category: "utility" })}
                    className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                  >
                    + Utility
                  </button>
                  <button 
                    onClick={() => openLedgerModal({ category: "installment" })}
                    className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                  >
                    + Installment
                  </button>
                </div>
              </div>
              <button
                onClick={() => openLedgerModal()}
                className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
              >
                + Add Entry
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2">
              {["all", "rent", "installment", "deposit", "furniture", "repair", "utility", "legal", "other"].map((f) => (
                <button
                  key={f}
                  onClick={() => setLedgerFilter(f)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all whitespace-nowrap ${
                    ledgerFilter === f
                      ? "bg-lime-500 border-lime-600 text-white shadow-sm"
                      : "bg-white border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {(() => {
              const ledger = sortLedgerEntries(selectedCase?.ledger || []);
              const filteredLedger = filterLedgerEntries(ledger, ledgerFilter);
              const groupedLedger = groupLedgerEntriesByBatch(filteredLedger);

              if ((selectedCase?.ledger || []).length === 0) {
                return (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                    No ledger entries yet.
                  </div>
                );
              }

              if (filteredLedger.length === 0) {
                return (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                    No ledger entries match this filter.
                  </div>
                );
              }

              return (
                <div className="space-y-8">
                  {groupedLedger.map((group) => {
                    const isCollapsed = collapsedLedgerGroups[group.batchLabel];
                    return (
                      <div key={group.batchLabel} className="space-y-3 border-b border-neutral-100 pb-3 last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => toggleLedgerGroup(group.batchLabel)}
                            className="flex items-center gap-2 px-1 py-1 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                          >
                            <span className="text-[10px] text-neutral-400 w-3">
                              {isCollapsed ? "▶" : "▼"}
                            </span>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                              {group.batchLabel === "Ungrouped" ? "Ungrouped Entries" : group.batchLabel}
                            </h4>
                            <span className="text-[10px] font-medium text-neutral-400">{group.items.length} entries</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openLedgerModal({
                                batchLabel: group.batchLabel
                              });
                            }}
                            className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                          >
                            Add to Group
                          </button>
                        </div>
                        {!isCollapsed && (
                          <div className="space-y-3">
                            {group.items.map((item) => {
                          const statusBadgeColor = (status) => {
                            switch (status) {
                              case "paid": return "bg-lime-100 text-lime-700 border-lime-300";
                              case "part-paid": return "bg-amber-100 text-amber-700 border-amber-300";
                              case "unpaid": return "bg-red-100 text-red-700 border-red-300";
                              case "disputed": return "bg-orange-100 text-orange-700 border-orange-300";
                              case "refunded": return "bg-blue-100 text-blue-700 border-blue-300";
                              default: return "bg-neutral-100 text-neutral-700 border-neutral-300";
                            }
                          };

                          const proofStatusBadgeColor = (proofStatus) => {
                            switch (proofStatus) {
                              case "confirmed": return "bg-lime-100 text-lime-700 border-lime-300";
                              case "partial": return "bg-amber-100 text-amber-700 border-amber-300";
                              default: return "bg-red-100 text-red-700 border-red-300";
                            }
                          };

                          return (
                            <div key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-neutral-800">{item.label || "Untitled Ledger Entry"}</h4>
                                <div className="flex items-center gap-3">
                                  {item.batchLabel && (
                                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[9px] font-bold uppercase tracking-tight text-neutral-500">
                                      {item.batchLabel}
                                    </span>
                                  )}
                                  <span className="text-xs text-neutral-500">{item.category || "N/A"}</span>
                                  <button 
                                    onClick={() => openLedgerModal(item, item.id)}
                                    className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => duplicateLedgerEntry(item)}
                                    className="rounded-lg border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                                  >
                                    Duplicate
                                  </button>
                                  <button 
                                    onClick={() => deleteLedgerEntry(item.id)}
                                    className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <div className="text-sm text-neutral-600 mb-2">Period: {item.period || "N/A"}</div>

                              <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                                <div>Expected: {item.expectedAmount} {item.currency}</div>
                                <div>Paid: {item.paidAmount} {item.currency}</div>
                                <div>Difference: {item.differenceAmount} {item.currency}</div>
                              </div>

                              <div className="flex items-center justify-between text-xs">
                                <div className="flex gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusBadgeColor(item.status)}`}>
                                    {item.status || "N/A"}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${proofStatusBadgeColor(item.proofStatus)}`}>
                                    {item.proofStatus || "N/A"}
                                  </span>
                                </div>
                                <div className="text-neutral-500">
                                  {item.paymentDate ? `Paid: ${item.paymentDate}` : item.dueDate ? `Due: ${item.dueDate}` : "No Date"}
                                </div>
                              </div>

                              {item.counterparty && <div className="text-xs text-neutral-500 mt-2">Counterparty: {item.counterparty}</div>}
                              {item.notes && <p className="text-xs text-neutral-500 mt-2 line-clamp-2">{item.notes}</p>}

                              {item.linkedRecordIds && item.linkedRecordIds.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-neutral-100">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Linked Records</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.linkedRecordIds.map((rid) => {
                                      const found = findRecordById(rid);
                                      if (!found) return null;
                                      return (
                                        <button
                                          key={rid}
                                          onClick={() => openLinkedRecord(rid)}
                                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-[10px] font-medium text-neutral-700 shadow-sm hover:border-lime-500 hover:text-lime-600 transition-all text-left"
                                        >
                                          <span className="opacity-50 font-bold uppercase">{found.type === 'evidence' ? 'Evidence' : found.type.slice(0, -1)}</span>
                                          <span className="truncate max-w-[120px]">{found.record.title}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Documents</h3>
              <button
                onClick={() => openDocumentModal()}
                className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
              >
                + Add Document
              </button>
            </div>
            {(() => {
              const documents = selectedCase?.documents || [];
              if (documents.length === 0) {
                return (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                    No documents yet.
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-neutral-900 truncate">{doc.title || "Untitled Document"}</h4>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                            <span className="text-neutral-600">{doc.documentDate || "No date"}</span>
                            <span className="px-1.5 py-0.5 rounded border border-neutral-200 bg-neutral-100">{doc.category || "other"}</span>
                            {doc.source && <span>Source: {doc.source}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openDocumentModal(doc, doc.id)}
                              className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => deleteDocumentEntry(doc.id)}
                              className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                          {doc.textContent && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                              Has Text
                            </span>
                          )}
                        </div>
                      </div>
                      {doc.summary && (
                        <p className="mt-3 text-sm text-neutral-600 line-clamp-2 italic border-l-2 border-neutral-200 pl-3">
                          {doc.summary}
                        </p>
                      )}

                      {doc.textContent && doc.textContent.trim() && (
                        <div className="mt-4 pt-4 border-t border-neutral-100">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Text Content</div>
                          <div className="text-sm text-neutral-700 whitespace-pre-wrap">
                            {expandedDocuments[doc.id] 
                              ? doc.textContent 
                              : doc.textContent.slice(0, 280) + (doc.textContent.length > 280 ? "..." : "")}
                          </div>
                          {doc.textContent.length > 280 && (
                            <button
                              onClick={() => toggleDocumentExpanded(doc.id)}
                              className="mt-2 text-xs font-bold text-lime-600 hover:text-lime-700 transition-colors"
                            >
                              {expandedDocuments[doc.id] ? "Show less" : "Show more"}
                            </button>
                          )}
                        </div>
                      )}

                      {doc.attachments && doc.attachments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-neutral-100">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Attachments</div>
                          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                            <AttachmentPreview 
                              attachments={doc.attachments || []}
                              imageCache={imageCache}
                              onPreview={onPreviewFile}
                            />
                          </div>
                        </div>
                      )}

                      {doc.linkedRecordIds && doc.linkedRecordIds.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-neutral-100">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Linked Records</div>
                          <div className="flex flex-wrap gap-1.5">
                            {doc.linkedRecordIds.map((rid) => {
                              const found = findRecordById(rid);
                              if (!found) return null;
                              return (
                                <button
                                  key={rid}
                                  onClick={() => openLinkedRecord(rid)}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-[10px] font-medium text-neutral-700 shadow-sm hover:border-lime-500 hover:text-lime-600 transition-all text-left"
                                >
                                  <span className="opacity-50 font-bold uppercase">{found.type === 'evidence' ? 'Evidence' : found.type.slice(0, -1)}</span>
                                  <span className="truncate max-w-[120px]">{found.record.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

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
            {/* Timeline Filter Controls */}
            <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto">
              {["core", "master", "incidents", "evidence", "milestones"].map((f) => (
                <button
                  key={f}
                  onClick={() => setTimelineView(f)}
                  className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all ${
                    timelineView === f
                      ? "bg-lime-500 border-lime-600 text-white shadow-md"
                      : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300"
                  }`}
                >
                  {timelineViewLabelMap[f] || f}
                </button>
              ))}
            </div>

            <div className="mt-2 text-xs text-neutral-500">
              {timelineViewDescriptionMap[timelineView] || ""}
            </div>

            {allTimelineTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {allTimelineTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTimelineTagFilter(timelineTagFilter === tag ? null : tag)}
                    className={`px-2 py-1 rounded-full text-xs font-bold transition-all ${
                      timelineTagFilter === tag
                        ? "bg-lime-500 text-white shadow-sm"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {(() => {
              let filteredTimelineItems = timelineItems.filter((item) => {
                if (timelineView === "core") {
                  return item._kind === "Incident" || item._kind === "Evidence";
                }
                if (timelineView === "master") {
                  return true;
                }
                if (timelineView === "incidents") {
                  return item._kind === "Incident";
                }
                if (timelineView === "evidence") {
                  return item._kind === "Evidence";
                }
                if (timelineView === "milestones") {
                  return item.importance === "critical" || item.isMilestone === true;
                }
                return true;
              });

              if (timelineTagFilter) {
                filteredTimelineItems = filteredTimelineItems.filter(
                  (item) => Array.isArray(item.tags) && item.tags.includes(timelineTagFilter)
                );
              }

              if (filteredTimelineItems.length === 0) {
                return (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
                    {timelineTagFilter 
                      ? `No items match the selected tag: ${timelineTagFilter}`
                      : (timelineEmptyMessageMap[timelineView] || "No timeline records yet.")}
                  </div>
                );
              }

                const groups = [];
                let lastDate = null;
                filteredTimelineItems.forEach(item => {
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
                            isMilestone={item.importance === "critical"}
                            isActionItem={
                              Array.isArray(item.tags) &&
                              (
                                item.tags.includes("action") ||
                                item.tags.includes("follow-up") ||
                                item.tags.includes("pending")
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
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

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 left-6 z-50 h-12 w-12 rounded-full bg-lime-600 text-white shadow-lg hover:bg-lime-700 transition-all active:scale-95 flex items-center justify-center text-[10px] font-bold leading-none text-center"
        >
          {scrollTopLabel}
        </button>
      )}

      {actionSummaryEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-semibold">Edit Action Summary</h3>

            <textarea
              placeholder="Current Focus"
              value={actionSummaryForm.currentFocus}
              onChange={(e) => setActionSummaryForm(f => ({ ...f, currentFocus: e.target.value }))}
              className="w-full border p-2 rounded"
            />

            <textarea
              placeholder="Next Actions (one per line)"
              value={actionSummaryForm.nextActions}
              onChange={(e) => setActionSummaryForm(f => ({ ...f, nextActions: e.target.value }))}
              className="w-full border p-2 rounded"
            />

            <textarea
              placeholder="Important Reminders"
              value={actionSummaryForm.importantReminders}
              onChange={(e) => setActionSummaryForm(f => ({ ...f, importantReminders: e.target.value }))}
              className="w-full border p-2 rounded"
            />

            <textarea
              placeholder="Strategy Focus"
              value={actionSummaryForm.strategyFocus}
              onChange={(e) => setActionSummaryForm(f => ({ ...f, strategyFocus: e.target.value }))}
              className="w-full border p-2 rounded"
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setActionSummaryEditOpen(false)} className="px-3 py-1 border rounded">
                Cancel
              </button>
              <button onClick={saveActionSummary} className="px-3 py-1 bg-lime-600 text-white rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
                          