import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  filterStrategies,
  getStrategySummary,
  groupStrategiesBySequenceGroup,
  sortStrategies,
} from "./strategyWorkspaceHelpers.js";
import GoalWorkspace from "./GoalWorkspace.jsx";
import { getStrategiesForGoal } from "./strategyGoalHelpers.js";
import { downloadJson } from "../../browser/downloadJson.js";
import { buildStrategyContextPayload, getStrategyContextFilename, serializeStrategyContext } from "../../export/strategyContextExport.js";
import { applyStrategyDelta, describeStrategyDeltaProposal, parseStrategyDeltaText, validateStrategyDelta } from "../../domain/strategyDelta.js";
import StrategyDeltaModal from "./StrategyDeltaModal.jsx";

export default function StrategyWorkspace({ caseItem, strategies = [], onAddStrategy, onUpdateCase, renderStrategyCard }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [strategyTypeFilter, setStrategyTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [reviewStateFilter, setReviewStateFilter] = useState("all");
  const [sortMode, setSortMode] = useState("newest");
  const [focusedGoalId, setFocusedGoalId] = useState("");
  const [strategyContextFeedback, setStrategyContextFeedback] = useState("");
  const [strategyDeltaOpen, setStrategyDeltaOpen] = useState(false);
  const [strategyDeltaText, setStrategyDeltaText] = useState("");
  const [strategyDeltaError, setStrategyDeltaError] = useState("");
  const [strategyDeltaValidation, setStrategyDeltaValidation] = useState(null);
  const [selectedDeltaIndexes, setSelectedDeltaIndexes] = useState([]);
  const [staleDeltaConfirmed, setStaleDeltaConfirmed] = useState(false);
  const goals = Array.isArray(caseItem?.goals) ? caseItem.goals : [];
  const focusedGoal = goals.find((goal) => goal.id === focusedGoalId) || null;
  const focusedStrategies = useMemo(() => getStrategiesForGoal(strategies, focusedGoalId), [focusedGoalId, strategies]);
  const summary = useMemo(() => getStrategySummary(strategies), [strategies]);
  const visibleStrategies = useMemo(() => {
    const filtered = filterStrategies(strategies, search, statusFilter, {
      strategyType: strategyTypeFilter,
      priority: priorityFilter,
      reviewState: reviewStateFilter,
    });
    return sortStrategies(filtered, sortMode);
  }, [priorityFilter, reviewStateFilter, search, sortMode, statusFilter, strategies, strategyTypeFilter]);
  const sequenceGroups = useMemo(
    () => sortMode === "sequence-group" ? groupStrategiesBySequenceGroup(visibleStrategies) : [],
    [sortMode, visibleStrategies]
  );
  const summaryCards = [
    ["Total Strategies", summary.total],
    ["Active / Open", summary.active],
    ["Archived", summary.archived],
    ["Unlinked", summary.unlinked],
    ["Updated in 14 Days", summary.recentlyUpdated],
    ["Critical Priority", summary.criticalPriority],
    ["High Priority", summary.highPriority],
    ["Due for Review", summary.dueForReview],
    ["Overdue Reviews", summary.overdueReview],
    ["Open Next Steps", summary.openNextSteps],
  ];
  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setStrategyTypeFilter("all");
    setPriorityFilter("all");
    setReviewStateFilter("all");
  };
  const buildFocusedStrategyContext = () => focusedGoal ? buildStrategyContextPayload(caseItem, focusedGoal.id) : null;
  const copyStrategyContext = async () => {
    const payload = buildFocusedStrategyContext();
    if (!payload) return;
    try { await navigator.clipboard.writeText(serializeStrategyContext(payload)); setStrategyContextFeedback("Strategy Context JSON copied."); }
    catch (error) { console.error("Could not copy Strategy Context JSON", error); setStrategyContextFeedback("Could not copy Strategy Context JSON."); }
  };
  const downloadStrategyContext = () => {
    const payload = buildFocusedStrategyContext();
    if (!payload) return;
    downloadJson(payload, getStrategyContextFilename(caseItem, focusedGoal), { space: 2 });
    setStrategyContextFeedback("Strategy Context JSON downloaded.");
  };
  const resetStrategyDelta = () => {
    setStrategyDeltaOpen(false); setStrategyDeltaText(""); setStrategyDeltaError(""); setStrategyDeltaValidation(null); setSelectedDeltaIndexes([]); setStaleDeltaConfirmed(false);
  };
  const validatePastedStrategyDelta = () => {
    setStrategyDeltaError(""); setStrategyDeltaValidation(null); setSelectedDeltaIndexes([]); setStaleDeltaConfirmed(false);
    const parsed = parseStrategyDeltaText(strategyDeltaText);
    if (!parsed.ok) { setStrategyDeltaError(parsed.reason); return; }
    const result = validateStrategyDelta(caseItem, parsed.payload);
    if (!result.ok) { setStrategyDeltaError(result.reason || "Strategy Delta validation failed."); return; }
    if (!focusedGoal || result.goal.id !== focusedGoal.id) { setStrategyDeltaError("Strategy Delta goalId must match the currently focused Goal."); return; }
    const planned = result.planned.map((proposal) => ({ ...proposal, preview: describeStrategyDeltaProposal(proposal, caseItem) }));
    setStrategyDeltaValidation({ ...result, planned }); setSelectedDeltaIndexes(planned.map((proposal) => proposal.index));
  };
  const applySelectedStrategyDelta = async () => {
    if (!strategyDeltaValidation || (strategyDeltaValidation.stale && !staleDeltaConfirmed)) return;
    const result = applyStrategyDelta(caseItem, strategyDeltaValidation, selectedDeltaIndexes);
    if (!result.ok) { setStrategyDeltaError(result.reason || "Could not apply selected Strategy proposals."); return; }
    if (await onUpdateCase(result.caseData)) resetStrategyDelta();
    else setStrategyDeltaError("Could not save the selected Strategy proposals.");
  };
  const toggleDeltaProposal = (index, checked) => setSelectedDeltaIndexes((current) => checked ? [...new Set([...current, index])] : current.filter((item) => item !== index));

  return (
    <div className="space-y-6">
      <GoalWorkspace caseItem={caseItem} onUpdateCase={onUpdateCase} focusedGoalId={focusedGoalId} onFocusGoal={setFocusedGoalId} />
      <section className="rounded-2xl border border-lime-200 bg-lime-50/40 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="text-[10px] font-bold uppercase tracking-wider text-lime-800">Current Strategy</div><h2 className="mt-1 text-xl font-semibold text-neutral-950">{focusedGoal ? focusedGoal.title || "Untitled Goal" : "Select a Goal"}</h2><p className="mt-1 text-sm text-neutral-700">{focusedGoal ? "Strategies linked to this Goal." : "Choose Focus on a Goal above to review its linked Strategies."}</p></div>
          {focusedGoal && <span className="rounded-full border border-lime-300 bg-white px-3 py-1 text-xs font-semibold text-lime-900">{focusedStrategies.length} linked</span>}
        </div>
        {focusedGoal && (focusedStrategies.length > 0 ? <div className="mt-4 space-y-4">{focusedStrategies.map((strategy) => <div key={strategy.id}>{renderStrategyCard(strategy)}</div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-lime-300 bg-white/70 p-4 text-sm text-neutral-700">No Strategies are linked to this Goal yet. Open a Strategy record to link it to this Goal.</div>)}
        <div className="mt-4 rounded-xl border border-lime-200 bg-white/80 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-lime-800">Work with AI</div>
          <p className="mt-1 text-xs text-neutral-600">Create a focused, read-only Strategy Context package for external strategic analysis.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!focusedGoal} onClick={copyStrategyContext} className="rounded-lg border border-lime-500 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-lime-50 disabled:cursor-not-allowed disabled:opacity-50">Copy Strategy Context</button>
            <button type="button" disabled={!focusedGoal} onClick={downloadStrategyContext} className="rounded-lg border border-lime-500 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-lime-50 disabled:cursor-not-allowed disabled:opacity-50">Download Strategy Context JSON</button>
            <button type="button" disabled={!focusedGoal} onClick={() => { setStrategyDeltaOpen(true); setStrategyDeltaError(""); setStrategyDeltaValidation(null); }} className="rounded-lg border border-lime-500 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-lime-50 disabled:cursor-not-allowed disabled:opacity-50">Update from AI</button>
          </div>
          {!focusedGoal && <p className="mt-2 text-xs text-neutral-500">Focus a Goal above to create its Strategy Context. ProveIt will not export the whole case from here.</p>}
          {strategyContextFeedback && <p className="mt-2 text-xs font-medium text-lime-900" role="status">{strategyContextFeedback}</p>}
        </div>
      </section>
      {strategyDeltaOpen && <StrategyDeltaModal text={strategyDeltaText} error={strategyDeltaError} validation={strategyDeltaValidation} selectedIndexes={selectedDeltaIndexes} staleConfirmed={staleDeltaConfirmed} onChangeText={(value) => { setStrategyDeltaText(value); setStrategyDeltaError(""); setStrategyDeltaValidation(null); setSelectedDeltaIndexes([]); setStaleDeltaConfirmed(false); }} onValidate={validatePastedStrategyDelta} onToggleProposal={toggleDeltaProposal} onStaleConfirm={setStaleDeltaConfirmed} onApply={applySelectedStrategyDelta} onClose={resetStrategyDelta} />}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Strategy Records & History</div>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950">All Strategy Records</h2>
            <p className="mt-1 text-sm text-neutral-600">Review all considered approaches, positions, risks, planned responses, and linked context.</p>
          </div>
          <button
            type="button"
            onClick={onAddStrategy}
            className="rounded-xl border border-lime-500 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-lime-50"
          >
            Add Strategy
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {summaryCards.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {strategies.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <h3 className="text-lg font-semibold text-neutral-900">No strategies yet.</h3>
          <button
            type="button"
            onClick={onAddStrategy}
            className="mt-4 rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-lime-700"
          >
            Create Strategy
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
              <label className="min-w-0 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Search
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search strategies"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-800 outline-none"
                  />
                </div>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Strategy Type
                <select value={strategyTypeFilter} onChange={(event) => setStrategyTypeFilter(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
                  <option value="all">All Types</option>
                  <option value="objective">Objective</option><option value="argument">Argument</option><option value="action">Action</option><option value="risk">Risk</option><option value="decision">Decision</option><option value="question">Question</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Priority
                <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Review State
                <select value={reviewStateFilter} onChange={(event) => setReviewStateFilter(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
                  <option value="all">All</option>
                  <option value="overdue">Overdue</option>
                  <option value="due-soon">Due Soon</option>
                  <option value="no-review-date">No Review Date</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="unlinked">Unlinked</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Sort
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="recently-updated">Recently Updated</option>
                  <option value="priority">Priority</option>
                  <option value="review-date">Review Date</option>
                  <option value="sequence-group">Issue</option>
                </select>
              </label>
            </div>
            <div className="mt-3 text-xs font-medium text-neutral-500">
              {visibleStrategies.length} of {strategies.length} strategies shown
            </div>
          </section>

          {visibleStrategies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
              <p>No strategies match the current search and filters.</p>
              <button type="button" onClick={resetFilters} className="mt-3 rounded-xl border border-lime-500 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-lime-50">
                Reset Filters
              </button>
            </div>
          ) : sortMode === "sequence-group" ? (
            <div className="space-y-8">
              {sequenceGroups.map((group) => (
                <section key={group.name} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-neutral-200" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500">{group.name}</h3>
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">{group.items.length}</span>
                    <div className="h-px flex-1 bg-neutral-200" />
                  </div>
                  <div className="space-y-4">
                    {group.items.map((strategy) => <div key={strategy.id}>{renderStrategyCard(strategy)}</div>)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleStrategies.map((strategy) => <div key={strategy.id}>{renderStrategyCard(strategy)}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
