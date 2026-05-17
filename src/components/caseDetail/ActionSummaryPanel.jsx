import { useState } from "react";
import { X } from "lucide-react";

export default function ActionSummaryPanel({
  updatedAt,
  currentFocus,
  nextActions,
  importantReminders,
  criticalDeadlines,
  quickActionInput,
  onEdit,
  onCopy,
  onMoveNextAction,
  onRemoveNextAction,
  onQuickActionInputChange,
  onQuickActionKeyDown,
  onAddQuickAction,
}) {
  const [completedActions, setCompletedActions] = useState(() => new Set());

  const toggleCompletedAction = (key) => {
    setCompletedActions((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="mb-6 w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:hidden">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Action Summary</h3>
          <p className="text-sm text-neutral-600">Live case briefing for focus, actions, reminders, and deadlines.</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
            Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "Never"}
          </div>
          <div className="flex gap-4">
            <button onClick={onEdit} className="text-xs font-bold text-lime-700 hover:underline">
              Edit
            </button>
            <button onClick={onCopy} className="text-xs font-bold text-neutral-500 hover:text-neutral-700 transition-colors">
              Copy summary
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-12">
        <div className="rounded-xl border border-lime-200 bg-lime-50 p-4 lg:col-span-8">
          <div className="text-[10px] font-bold uppercase tracking-wider text-lime-700">Current Focus</div>
          <div className="mt-2 text-lg font-semibold leading-snug text-neutral-900">{currentFocus || "No current focus set."}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 lg:col-span-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-lime-700">Top Next Action</div>
          <div className="mt-1 truncate text-sm font-semibold text-neutral-900">{nextActions[0] || "No next action"}</div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 lg:col-span-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Remaining Actions</div>
          <div className="mt-1 text-sm font-semibold text-neutral-900">{Math.max(nextActions.length - 1, 0)}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="lg:col-span-5 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Current Focus</h4>
          <p className="text-base font-semibold leading-relaxed text-neutral-900">
            {currentFocus || "No current focus set."}
          </p>
        </section>

        <section className="lg:col-span-7 space-y-3 rounded-lg border border-lime-200 bg-lime-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">Next Actions</h4>
            {nextActions[0] && (
              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-bold uppercase text-lime-700 border border-lime-200">
                Priority
              </span>
            )}
          </div>
          {nextActions.length > 0 ? (
            <ul className="space-y-2">
              {nextActions.map((action, i) => {
                const completionKey = `${i}:${action}`;
                const isCompleted = completedActions.has(completionKey);

                return (
                <li key={i} className={`flex items-start justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm ${isCompleted ? "opacity-60" : ""} ${i === 0 ? "border-lime-300 font-semibold text-neutral-900 shadow-sm" : "border-neutral-200 text-neutral-700"}`}>
                  <span className="flex min-w-0 items-start gap-2 break-words">
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      onChange={() => toggleCompletedAction(completionKey)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
                      aria-label={`Mark action ${i + 1} complete`}
                    />
                    <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-lime-100 text-lime-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {i + 1}
                    </span>
                    <span className={isCompleted ? "line-through" : ""}>
                      {i === 0 && <span className="mr-2 text-[10px] font-bold uppercase text-lime-700">Top</span>}
                      {action}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onMoveNextAction(i, i - 1)}
                      disabled={i === 0}
                      className="rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-[10px] font-bold text-neutral-500 transition-all hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move up"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveNextAction(i, i + 1)}
                      disabled={i === nextActions.length - 1}
                      className="rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-[10px] font-bold text-neutral-500 transition-all hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move down"
                    >
                      Down
                    </button>
                    <button
                      onClick={() => onRemoveNextAction(i)}
                      className="rounded-md border border-neutral-200 bg-white p-1 text-neutral-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-neutral-600 italic">List the next steps to move this case forward.</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add next action and press Enter"
              value={quickActionInput}
              onChange={(e) => onQuickActionInputChange(e.target.value)}
              onKeyDown={onQuickActionKeyDown}
              className="min-w-0 flex-1 border-b border-lime-200 bg-transparent py-1 text-xs transition-colors focus:border-lime-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={onAddQuickAction}
              className="rounded-md border border-lime-500 bg-white px-3 py-1 text-xs font-bold text-neutral-800 shadow-sm hover:bg-lime-100"
            >
              Add
            </button>
          </div>
        </section>

        <section className="lg:col-span-6 space-y-2 border-t border-neutral-200 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Important Reminders</h4>
          {importantReminders.length > 0 ? (
            <ul className="space-y-1.5">
              {importantReminders.map((reminder, i) => (
                <li key={i} className="text-sm text-neutral-700">- {reminder}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 italic">Add anything that must not be forgotten.</p>
          )}
        </section>

        <section className="lg:col-span-6 space-y-2 border-t border-neutral-200 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Critical Deadlines</h4>
          {criticalDeadlines.length > 0 ? (
            <ul className="space-y-1.5">
              {criticalDeadlines.map((deadline, i) => (
                <li key={i} className="text-sm text-neutral-700">- {deadline}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 italic">No critical deadlines set.</p>
          )}
        </section>
      </div>
    </div>
  );
}
