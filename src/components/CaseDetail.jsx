import AttachmentPreview from "./AttachmentPreview";

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
}) {
  if (!selectedCase) return renderCaseList();

  const renderListBlock = (items, emptyText, recordType) => {
    if (!items.length) {
      return (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          {emptyText}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item) => {
          const isTask = recordType === 'tasks';
          const isDone = isTask && item.status === 'done';
          return (
            <div key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
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
                  <div className={isDone ? 'line-through opacity-60' : ''}>
                    <div className="font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm text-neutral-600">{item.date}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditRecordModal(recordType, item)}
                    className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                  >
                    Edit
                  </button>
                  <button onClick={() => deleteRecord(recordType, item.id)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-red-600 shadow-[0_2px_4px_rgba(60,60,60,0.1)] hover:bg-red-50 hover:border-red-200 transition-colors">Delete</button>
                </div>
              </div>
              {item.description ? <p className="mt-3 text-sm text-neutral-700">{item.description}</p> : null}
              {item.notes ? <p className="mt-2 text-sm text-neutral-500">{item.notes}</p> : null}
              <AttachmentPreview attachments={(item.attachments || []).map(att => att.file || imageCache[att.storageRef]).filter(Boolean)} />
            </div>
          );
        })}
      </div>
    );
  };

  const caseInboxCount = reviewQueue.filter((item) => item.caseId === selectedCase.id).length;
  const timelineItems = [
    ...selectedCase.evidence.map((item) => ({ ...item, _kind: "Evidence" })),
    ...selectedCase.incidents.map((item) => ({ ...item, _kind: "Incident" })),
    ...selectedCase.tasks.map((item) => ({ ...item, _kind: "Task" })),
    ...selectedCase.strategy.map((item) => ({ ...item, _kind: "Strategy" })),
  ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

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
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openRecordModal("evidence")} className="rounded-2xl border border-lime-500 bg-white px-6 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">+ Evidence</button>
          <button onClick={() => openRecordModal("incidents")} className="rounded-2xl border border-lime-500 bg-white px-6 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">+ Incident</button>
          <button onClick={() => openRecordModal("tasks")} className="rounded-2xl border border-lime-500 bg-white px-6 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">+ Task</button>
          <button onClick={() => openRecordModal("strategy")} className="rounded-2xl border border-lime-500 bg-white px-6 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">+ Strategy</button>
          <button onClick={exportSelectedCase} className="rounded-2xl border border-lime-500 bg-white px-6 py-2 text-sm font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">Export Case</button>
        </div>
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
        {activeTab === "tasks" && renderListBlock(selectedCase.tasks, "No tasks yet. Add tasks to track what needs to be done next.", "tasks")}
        {activeTab === "strategy" && renderListBlock(selectedCase.strategy, "No strategy notes yet. Add strategy to track approach and planning.", "strategy")}

        {activeTab === "timeline" && (
          <div className="space-y-3">
            {timelineItems.length ? timelineItems.map((item) => {
              const isDoneTask = item._kind === 'Task' && item.status === 'done';
              return (
              <div key={`${item._kind}-${item.id}`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={isDoneTask ? 'line-through opacity-60' : ''}>
                    <div className="font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm text-neutral-600">{item.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700">{item._kind}</span>
                    <button
                      onClick={() => {
                        let recordType = item._kind.toLowerCase();
                        if (recordType === 'incident' || recordType === 'task') {
                            recordType += 's';
                        }
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
                <AttachmentPreview attachments={(item.attachments || []).map(att => att.file || imageCache[att.storageRef]).filter(Boolean)} />
              </div>
            )}) : (
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
