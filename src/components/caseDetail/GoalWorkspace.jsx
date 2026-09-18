import { useState } from "react";
import StringListEditor from "../StringListEditor.jsx";
import RecordBadge from "../shared/RecordBadge.jsx";
import { getIssueDisplayLabel } from "../../domain/issueDomain.js";
import { GOAL_PRIORITIES, GOAL_STATUSES } from "../../domain/goalDomain.js";
import { getVisibleGoals, prepareGoalDraft, saveGoalToCase, toggleGoalIssueId } from "./goalWorkspaceHelpers.js";

const label = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const statusVariant = (status) => status === "achieved" ? "status-positive" : status === "active" ? "status-warning" : "status-neutral";

export default function GoalWorkspace({ caseItem, onUpdateCase, focusedGoalId = "", onFocusGoal }) {
  const goals = Array.isArray(caseItem?.goals) ? caseItem.goals : [];
  const issues = Array.isArray(caseItem?.issues) ? caseItem.issues : [];
  const [view, setView] = useState("active");
  const [localFocusedGoalId, setLocalFocusedGoalId] = useState("");
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [draft, setDraft] = useState(null);
  const visibleGoals = getVisibleGoals(goals, view);
  const activeFocusedGoalId = onFocusGoal ? focusedGoalId : localFocusedGoalId;
  const focusedGoal = goals.find((goal) => goal.id === activeFocusedGoalId) || null;
  const focusGoal = (goalId) => {
    if (onFocusGoal) onFocusGoal(goalId);
    else setLocalFocusedGoalId(goalId);
  };

  const beginCreate = () => {
    setEditingGoalId("");
    setDraft(prepareGoalDraft());
  };
  const beginEdit = (goal) => {
    setEditingGoalId(goal.id);
    setDraft(prepareGoalDraft(goal));
  };
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const save = async () => {
    if (!draft?.title.trim()) return;
    const result = saveGoalToCase(caseItem, draft, editingGoalId || "");
    if (await onUpdateCase(result.caseData)) {
      focusGoal(result.goal.id);
      setDraft(null);
      setEditingGoalId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Goals</div>
          <h2 className="mt-1 text-xl font-semibold text-neutral-950">Desired outcomes</h2>
          <p className="mt-1 text-sm text-neutral-600">Keep the intended result clear before choosing or reviewing Strategy.</p>
        </div>
        <button type="button" onClick={beginCreate} className="rounded-xl border border-lime-500 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-lime-50">Add Goal</button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold text-neutral-600">Show
          <select value={view} onChange={(event) => setView(event.target.value)} className="ml-2 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm">
            <option value="active">Active Goals</option>
            <option value="all">All Goals</option>
          </select>
        </label>
        <span className="text-xs text-neutral-500">{visibleGoals.length} shown · {goals.length} total</span>
      </div>

      {focusedGoal && <div className="mt-4 rounded-xl border border-lime-300 bg-lime-50 px-3 py-2 text-sm text-lime-950">Current Goal focus: <strong>{focusedGoal.title || "Untitled Goal"}</strong></div>}

      {draft && (
        <div className="mt-4 space-y-4 rounded-2xl border border-lime-300 bg-lime-50/50 p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-neutral-900">{editingGoalId ? "Edit Goal" : "New Goal"}</h3><button type="button" onClick={() => { setDraft(null); setEditingGoalId(null); }} className="text-xs font-semibold text-neutral-600 hover:text-neutral-950">Cancel</button></div>
          <div><label className="text-xs font-semibold text-neutral-600">Title</label><input autoFocus value={draft.title} onChange={(event) => update("title", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm" /></div>
          <div><label className="text-xs font-semibold text-neutral-600">Description / context</label><textarea value={draft.description} onChange={(event) => update("description", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm" rows={3} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-neutral-600">Status<select value={draft.status} onChange={(event) => update("status", event.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm">{GOAL_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label className="text-xs font-semibold text-neutral-600">Priority<select value={draft.priority} onChange={(event) => update("priority", event.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm">{GOAL_PRIORITIES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label className="text-xs font-semibold text-neutral-600">Review date<input type="date" value={draft.reviewDate} onChange={(event) => update("reviewDate", event.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm" /></label>
          </div>
          <StringListEditor idPrefix="goal-success-criterion" label="Success criteria" items={draft.successCriteria} onChange={(items) => update("successCriteria", items)} />
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">Linked Issues</label>
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2">
              {issues.map((issue) => <label key={issue.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-neutral-50"><input type="checkbox" checked={draft.issueIds.includes(issue.id)} onChange={(event) => update("issueIds", toggleGoalIssueId(draft.issueIds, issue.id, event.target.checked))} className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500" /><span className="text-sm text-neutral-800">{getIssueDisplayLabel(issue)}</span></label>)}
              {issues.length === 0 && <p className="p-2 text-xs italic text-neutral-500">No Issues are available to link.</p>}
            </div>
          </div>
          <button type="button" disabled={!draft.title.trim()} onClick={save} className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-50">Save Goal</button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {visibleGoals.map((goal) => (
          <article key={goal.id} className={`rounded-xl border p-3 ${goal.id === activeFocusedGoalId ? "border-lime-400 bg-lime-50/50" : "border-neutral-200 bg-neutral-50"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-neutral-900">{goal.title || "Untitled Goal"}</h3><RecordBadge variant={statusVariant(goal.status)}>{label(goal.status)}</RecordBadge><RecordBadge variant={`priority-${goal.priority}`}>Priority: {label(goal.priority)}</RecordBadge></div>{goal.description && <p className="mt-2 text-sm text-neutral-700">{goal.description}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => focusGoal(goal.id)} className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Focus</button><button type="button" onClick={() => beginEdit(goal)} className="rounded-lg border border-lime-500 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-lime-50">Edit</button></div></div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">{goal.reviewDate && <span>Review: {goal.reviewDate}</span>}{goal.successCriteria?.length > 0 && <span>Success criteria: {goal.successCriteria.length}</span>}{goal.issueIds?.map((id) => { const issue = issues.find((item) => item.id === id); return <RecordBadge key={id} variant="type">{issue ? getIssueDisplayLabel(issue) : "Unresolved Issue"}</RecordBadge>; })}</div>
          </article>
        ))}
        {visibleGoals.length === 0 && <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">{goals.length ? "No active Goals. Use All Goals to review achieved, abandoned, or archived outcomes." : "No Goals yet. Add the outcome you want this case to achieve."}</div>}
      </div>
    </section>
  );
}
