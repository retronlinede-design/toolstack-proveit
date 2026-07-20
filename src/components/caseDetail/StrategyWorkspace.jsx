import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  filterStrategies,
  getStrategySummary,
  groupStrategiesBySequenceGroup,
  sortStrategies,
} from "./strategyWorkspaceHelpers.js";

export default function StrategyWorkspace({ strategies = [], onAddStrategy, renderStrategyCard }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState("newest");
  const summary = useMemo(() => getStrategySummary(strategies), [strategies]);
  const visibleStrategies = useMemo(() => {
    const filtered = filterStrategies(strategies, search, statusFilter);
    return sortStrategies(filtered, sortMode);
  }, [search, sortMode, statusFilter, strategies]);
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
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Strategy Workspace</div>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950">Strategy Summary</h2>
            <p className="mt-1 text-sm text-neutral-600">Review active approaches, linked context, and recent movement.</p>
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
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_13rem] lg:items-end">
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
                  <option value="sequence-group">Sequence Group</option>
                </select>
              </label>
            </div>
            <div className="mt-3 text-xs font-medium text-neutral-500">
              {visibleStrategies.length} of {strategies.length} strategies shown
            </div>
          </section>

          {visibleStrategies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
              No strategies match the current search and filter.
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
