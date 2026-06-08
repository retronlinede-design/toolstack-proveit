import { useEffect, useState } from "react";
import { Tags } from "lucide-react";
import {
  getCaseSequenceGroupRelationshipMap,
  getCaseSequenceGroupTimeline,
} from "../../domain/caseDomain.js";
import {
  SEQUENCE_GROUP_TYPE_LABELS,
  SEQUENCE_RELATIONSHIP_FILTER_LABELS,
  getRelationshipRelationLabel,
  getRelationshipWarningLabel,
  getSequenceRecordKey,
  getTimelineTypeClasses,
  safeSequenceText,
  sequenceRecordMatchesSearch,
} from "./sequenceGroupUiHelpers.js";
import {
  clearSequenceGroupDescription,
  getSequenceGroupDescription,
  saveSequenceGroupDescription,
} from "../../sequenceGroupMeta.js";

function SequenceGroupChip({ value }) {
  const sequenceGroup = typeof value === "string" ? value.trim() : "";
  if (!sequenceGroup) return null;

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
      <Tags className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
      <span className="truncate">{sequenceGroup}</span>
    </span>
  );
}

function SequenceGroupDeltaPreview({ result }) {
  if (!result) return null;

  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-2">
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Validation</div>
        {result.errors.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
            {result.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        )}
        {result.warnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
            {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
        {result.ok && result.warnings.length === 0 && (
          <p className="mt-2 text-sm font-medium text-lime-700">No validation errors.</p>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Preview</div>
        {(() => {
          const preview = result.preview || {};
          const totalPreviewCount = Object.values(preview).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
          if (totalPreviewCount === 0) {
            return <p className="mt-2 text-sm text-neutral-500">No changes to preview.</p>;
          }
          return (
            <div className="mt-2 space-y-3 text-sm text-neutral-700">
              {preview.moveRecords?.length > 0 && (
                <div>
                  <div className="font-semibold text-neutral-900">Records to move</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {preview.moveRecords.map((item) => (
                      <li key={`move-${item.recordType}-${item.recordId}`}>{item.title}: {item.fromGroup || "Ungrouped"} to {item.targetGroup}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.renameGroups?.length > 0 && (
                <div>
                  <div className="font-semibold text-neutral-900">Groups to rename</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {preview.renameGroups.map((item) => (
                      <li key={`rename-${item.fromGroup}`}>{item.fromGroup} to {item.toGroup} ({item.affectedCount} records)</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.mergeGroups?.length > 0 && (
                <div>
                  <div className="font-semibold text-neutral-900">Groups to merge</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {preview.mergeGroups.map((item) => (
                      <li key={`merge-${item.fromGroup}`}>{item.fromGroup} into {item.toGroup} ({item.affectedCount} records)</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.clearRecords?.length > 0 && (
                <div>
                  <div className="font-semibold text-neutral-900">Records to clear</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {preview.clearRecords.map((item) => (
                      <li key={`clear-${item.recordType}-${item.recordId}`}>{item.title}: clear {item.fromGroup || "Ungrouped"}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function SequenceGroupManager({
  highlightedRecordKey,
  onApplyDelta,
  onClearRecord,
  onClose,
  onCopyChainCompletionPackJson,
  onCopyChainCompletionPackMarkdown,
  onCopyFullChainGptPackJson,
  onCopyFullChainGptPackMarkdown,
  onCopyReviewPackage,
  onDownloadGroupIndexJson,
  onDownloadGroupIndexMarkdown,
  onMergeGroup,
  onMoveRecordToExisting,
  onMoveRecordToNew,
  onOpenAuditExport,
  onOpenRecordEdit,
  onRelationshipNodeSelect,
  onRemoveGroup,
  onRenameGroup,
  onTimelineItemSelect,
  onValidateDelta,
  search,
  selectedCase,
  selectedGroupName,
  sequenceGroupDetails,
  sequenceGroupFeedback,
  sequenceGroupDeltaDraft,
  sequenceGroupDeltaResult,
  sequenceMoveInputs,
  sequenceNewGroupInputs,
  sequenceRelationshipFilter,
  sequenceRenameInputs,
  sequenceTimelineSort,
  setSearch,
  setSelectedGroupName,
  setSequenceGroupDeltaDraft,
  setSequenceGroupDeltaResult,
  setSequenceGroupFeedback,
  setSequenceMoveInputs,
  setSequenceNewGroupInputs,
  setSequenceRelationshipFilter,
  setSequenceRenameInputs,
  setSequenceTimelineSort,
}) {
  const [sequenceDescriptionDraft, setSequenceDescriptionDraft] = useState("");
  const activeDescriptionGroupName = selectedGroupName || sequenceGroupDetails?.groups?.[0]?.name || "";

  useEffect(() => {
    if (!selectedCase?.id || !activeDescriptionGroupName) {
      setSequenceDescriptionDraft("");
      return;
    }
    setSequenceDescriptionDraft(getSequenceGroupDescription(selectedCase.id, activeDescriptionGroupName));
  }, [selectedCase?.id, activeDescriptionGroupName]);

  if (!selectedCase) return null;

  const normalizedSearch = safeSequenceText(search).trim().toLowerCase();
  const selectedGroup = sequenceGroupDetails.groups.find((group) => group.name === selectedGroupName) || sequenceGroupDetails.groups[0] || null;
  const activeGroupName = selectedGroup?.name || "";
  const selectedGroupTimeline = activeGroupName
    ? getCaseSequenceGroupTimeline(selectedCase, activeGroupName, { sortDirection: sequenceTimelineSort })
    : { datedGroups: [], undatedItems: [], items: [] };
  const selectedGroupRelationshipMap = activeGroupName
    ? getCaseSequenceGroupRelationshipMap(selectedCase, activeGroupName)
    : { nodes: [], edges: [], weakNodes: [], isolatedNodes: [], proofChains: [] };
  const groupOptions = sequenceGroupDetails.groups.map((group) => group.name);
  const relationshipNodeById = new Map(selectedGroupRelationshipMap.nodes.map((node) => [node.id, node]));
  const relationshipWeakNodeIds = new Set(selectedGroupRelationshipMap.weakNodes.map((node) => node.id));
  const relationshipVisibleNodes = selectedGroupRelationshipMap.nodes.filter((node) => {
    if (sequenceRelationshipFilter === "weak") return relationshipWeakNodeIds.has(node.id);
    if (sequenceRelationshipFilter === "proof") return node.recordType === "incidents" || node.recordType === "evidence";
    return true;
  });
  const relationshipVisibleNodeIds = new Set(relationshipVisibleNodes.map((node) => node.id));
  const relationshipVisibleEdges = selectedGroupRelationshipMap.edges.filter((edge) =>
    relationshipVisibleNodeIds.has(edge.fromId) && relationshipVisibleNodeIds.has(edge.toId)
  );
  const ungroupedCount = Object.values(sequenceGroupDetails.ungroupedRecords)
    .reduce((sum, records) => sum + records.length, 0);
  const selectedGroupSummaryCards = selectedGroup ? [
    ["Incidents", selectedGroup.counts.incidents],
    ["Assigned Evidence", selectedGroup.counts.evidence],
    ["Linked Evidence", selectedGroup.counts.evidence],
    ["Documents", selectedGroup.counts.documents],
    ["Weak / Unlinked Records", selectedGroupRelationshipMap.weakNodes.length],
  ] : [];
  const saveSelectedGroupDescription = () => {
    if (!activeGroupName) return;
    saveSequenceGroupDescription(selectedCase.id, activeGroupName, sequenceDescriptionDraft);
    setSequenceGroupFeedback(`Saved description for "${activeGroupName}".`);
  };

  const clearSelectedGroupDescription = () => {
    if (!activeGroupName) return;
    clearSequenceGroupDescription(selectedCase.id, activeGroupName);
    setSequenceDescriptionDraft("");
    setSequenceGroupFeedback(`Cleared description for "${activeGroupName}".`);
  };

  const renderRecordActions = (record, includeRemove = true) => {
    const key = getSequenceRecordKey(record);
    const existingOptions = groupOptions.filter((name) => name !== record.sequenceGroup);
    return (
      <details className="mt-3 border-t border-neutral-100 pt-3">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-800">
          Move
        </summary>
        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <select
            value={sequenceMoveInputs[key] || ""}
            onChange={(event) => setSequenceMoveInputs((prev) => ({ ...prev, [key]: event.target.value }))}
            className="min-w-0 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 outline-none focus:border-lime-500"
          >
            <option value="">Move to existing group</option>
            {existingOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onMoveRecordToExisting(record)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
          >
            Move to group
          </button>
          <input
            value={sequenceNewGroupInputs[key] || ""}
            onChange={(event) => setSequenceNewGroupInputs((prev) => ({ ...prev, [key]: event.target.value }))}
            placeholder="New group"
            className="min-w-0 rounded-md border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-lime-500"
          />
          <button
            type="button"
            onClick={() => onMoveRecordToNew(record)}
            className="rounded-md border border-lime-500 bg-white px-2 py-1.5 text-xs font-bold text-neutral-800 hover:bg-lime-400/30"
          >
            Move to new group
          </button>
          {includeRemove && (
            <button
              type="button"
              onClick={() => onClearRecord(record)}
              className="rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>
      </details>
    );
  };

  const renderRecordCard = (record, includeRemove = true) => (
    <div
      key={`${record.recordType}-${record.id}`}
      id={`sequence-record-${record.recordType}-${record.id}`}
      className={`rounded-lg border bg-white p-3 transition-colors ${
        highlightedRecordKey === `${record.recordType}:${record.id}`
          ? "border-lime-400 ring-2 ring-lime-200"
          : "border-neutral-200"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="min-w-0 truncate text-sm font-semibold text-neutral-950">{record.title}</h5>
            {record.status && (
              <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {record.status}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-medium text-neutral-500">
            <span>{record.date || "No date"}</span>
            <span>{record.linkedRecordCount} linked</span>
          </div>
          {record.summary ? (
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-neutral-700">{record.summary}</p>
          ) : (
            <p className="mt-2 text-sm italic text-neutral-400">No summary recorded.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenRecordEdit?.(record)}
          className="shrink-0 rounded-md border border-lime-500 bg-white px-2 py-1.5 text-xs font-bold text-neutral-800 hover:bg-lime-400/30"
        >
          Open / Edit
        </button>
      </div>
      {renderRecordActions(record, includeRemove)}
    </div>
  );

  const renderTimelineItem = (item) => (
    <button
      key={`${item.recordType}-${item.id}`}
      type="button"
      onClick={() => onTimelineItemSelect(item)}
      className={`relative w-full rounded-lg border bg-white p-3 text-left transition-colors hover:border-lime-300 ${
        highlightedRecordKey === `${item.recordType}:${item.id}`
          ? "border-lime-400 ring-2 ring-lime-200"
          : "border-neutral-200"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTimelineTypeClasses(item.recordType)}`}>
              {item.recordType}
            </span>
            {item.isMilestone && (
              <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Milestone
              </span>
            )}
            {item.missingDate && (
              <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                Missing date
              </span>
            )}
            {item.status && (
              <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {item.status}
              </span>
            )}
          </div>
          <div className="mt-2 text-sm font-semibold text-neutral-950">{item.title}</div>
          {item.summary ? (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-700">{item.summary}</p>
          ) : (
            <p className="mt-1 text-sm italic text-neutral-400">No summary recorded.</p>
          )}
        </div>
        <div className="shrink-0 text-xs font-semibold text-neutral-500">
          {item.linkedRecordCount} linked
        </div>
      </div>
    </button>
  );

  const renderRelationshipNode = (node) => (
    <button
      key={`${node.recordType}-${node.id}`}
      type="button"
      onClick={() => onRelationshipNodeSelect(node)}
      className={`w-full rounded-lg border bg-white p-3 text-left transition-colors hover:border-lime-300 ${
        highlightedRecordKey === `${node.recordType}:${node.id}`
          ? "border-lime-400 ring-2 ring-lime-200"
          : "border-neutral-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTimelineTypeClasses(node.recordType)}`}>
          {node.recordType}
        </span>
        {node.isMilestone && (
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Milestone
          </span>
        )}
        {node.status && (
          <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            {node.status}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-neutral-950">{node.title}</div>
      <div className="mt-1 text-xs font-medium text-neutral-500">{node.date || "No date"}</div>
      {node.warningFlags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {node.warningFlags.map((flag) => (
            <span key={flag} className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
              {getRelationshipWarningLabel(flag)}
            </span>
          ))}
        </div>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 print:hidden">
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Sequence Group Manager</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Review, rename, merge, move, and assign records across incidents, evidence, documents, and strategy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        <div id="sequence-group-manager-scroll" className="flex-1 overflow-y-auto p-5">
          {sequenceGroupFeedback && (
            <div className="mb-4 rounded-md border border-lime-200 bg-lime-50 p-3 text-sm font-medium text-lime-800">
              {sequenceGroupFeedback}
            </div>
          )}

          <div className="mb-5 rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm leading-6 text-lime-950">
            A sequence group is a label applied to records. Renaming a group changes that label on all matching records. Removing a group label does not delete records.
          </div>

          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Sequence Groups Index Report</h4>
              <p className="mt-1 text-xs text-neutral-500">Export a compact overview of all sequence groups before choosing a chain to audit.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onDownloadGroupIndexJson}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Download Group Index JSON
              </button>
              <button
                type="button"
                onClick={onDownloadGroupIndexMarkdown}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Download Group Index Markdown
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
            <aside className="space-y-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search records"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-lime-500"
              />
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">Groups</div>
                {sequenceGroupDetails.groups.length === 0 ? (
                  <p className="text-sm text-neutral-500">No sequence groups are used in this case.</p>
                ) : (
                  <div className="space-y-2">
                    {sequenceGroupDetails.groups.map((group) => (
                      <div
                        key={group.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedGroupName(group.name)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedGroupName(group.name);
                          }
                        }}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          group.name === activeGroupName
                            ? "border-lime-400 bg-white shadow-sm"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-neutral-950">{group.name}</div>
                            <div className="mt-1 text-xs text-neutral-500">{group.totalCount} record{group.totalCount === 1 ? "" : "s"}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {group.warnings.noIncidents && (
                              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">No incidents</span>
                            )}
                            {group.warnings.incidentsWithoutEvidence && (
                              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">No evidence</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          <span>Incidents {group.counts.incidents}</span>
                          <span>Evidence {group.counts.evidence}</span>
                          <span>Docs {group.counts.documents}</span>
                          <span>Strategy {group.counts.strategy}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenAuditExport?.(group.name);
                            }}
                            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50"
                          >
                            Audit Chain
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onCopyChainCompletionPackMarkdown?.(group.name);
                            }}
                            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50"
                          >
                            Chain Completion Pack
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onCopyChainCompletionPackJson?.(group.name);
                            }}
                            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50"
                          >
                            Export Chain Pack
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onCopyFullChainGptPackMarkdown?.(group.name);
                            }}
                            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50"
                          >
                            Full Chain GPT Pack
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onCopyFullChainGptPackJson?.(group.name);
                            }}
                            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50"
                          >
                            Export Full Chain
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            <div className="space-y-5">
              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                {selectedGroup ? (
                  <>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <SequenceGroupChip value={selectedGroup.name} />
                          <span className="text-sm font-semibold text-neutral-900">{selectedGroup.totalCount} records</span>
                          {selectedGroup.warnings.noIncidents && <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">No incidents</span>}
                          {selectedGroup.warnings.incidentsWithoutEvidence && <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Incidents but no evidence</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600">
                          <span>Incidents: {selectedGroup.counts.incidents}</span>
                          <span>Evidence: {selectedGroup.counts.evidence}</span>
                          <span>Documents: {selectedGroup.counts.documents}</span>
                          <span>Strategy: {selectedGroup.counts.strategy}</span>
                        </div>
                      </div>

                      <div className="grid gap-2 lg:grid-cols-[auto_auto_auto_auto_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto]">
                        <button
                          type="button"
                          onClick={() => onOpenAuditExport?.(selectedGroup.name)}
                          className="rounded-md border border-lime-500 bg-lime-400/20 px-3 py-2 text-sm font-bold text-neutral-900 hover:bg-lime-400/30"
                        >
                          Audit Chain
                        </button>
                        <button
                          type="button"
                          onClick={() => onCopyChainCompletionPackMarkdown?.(selectedGroup.name)}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Chain Completion Pack
                        </button>
                        <button
                          type="button"
                          onClick={() => onCopyChainCompletionPackJson?.(selectedGroup.name)}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Export Chain Pack
                        </button>
                        <button
                          type="button"
                          onClick={() => onCopyFullChainGptPackMarkdown?.(selectedGroup.name)}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Full Chain GPT Pack
                        </button>
                        <button
                          type="button"
                          onClick={() => onCopyFullChainGptPackJson?.(selectedGroup.name)}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Export Full Chain
                        </button>
                        <input
                          value={sequenceRenameInputs[selectedGroup.name] || ""}
                          onChange={(event) => {
                            setSequenceRenameInputs((prev) => ({ ...prev, [selectedGroup.name]: event.target.value }));
                            setSequenceGroupFeedback("");
                          }}
                          placeholder="Rename selected group"
                          className="min-w-0 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-lime-500"
                        />
                        <button
                          type="button"
                          onClick={() => onRenameGroup(selectedGroup.name)}
                          className="rounded-md border border-lime-500 bg-white px-3 py-2 text-sm font-bold text-neutral-900 hover:bg-lime-400/30"
                        >
                          Rename
                        </button>
                        <select
                          value={sequenceMoveInputs[`merge:${selectedGroup.name}`] || ""}
                          onChange={(event) => setSequenceMoveInputs((prev) => ({ ...prev, [`merge:${selectedGroup.name}`]: event.target.value }))}
                          className="min-w-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 outline-none focus:border-lime-500"
                        >
                          <option value="">Merge into...</option>
                          {groupOptions.filter((name) => name !== selectedGroup.name).map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onMergeGroup(selectedGroup.name)}
                          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                        >
                          Merge
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveGroup(selectedGroup)}
                          className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                        >
                          Remove group label from all records
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {selectedGroupSummaryCards.map(([label, count]) => (
                        <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
                          <div className="mt-1 text-2xl font-semibold text-neutral-950">{count}</div>
                        </div>
                      ))}
                    </div>

                    <section className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Sequence description</span>
                        <textarea
                          value={sequenceDescriptionDraft}
                          onChange={(event) => {
                            setSequenceDescriptionDraft(event.target.value);
                            setSequenceGroupFeedback("");
                          }}
                          rows={3}
                          className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-6 text-neutral-800 outline-none focus:border-lime-500"
                          placeholder="Briefly summarize what this thread is about."
                        />
                      </label>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-neutral-500">Use this to summarize what this thread is about.</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveSelectedGroupDescription}
                            className="rounded-md border border-lime-500 bg-white px-3 py-2 text-sm font-bold text-neutral-900 hover:bg-lime-400/30"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={clearSelectedGroupDescription}
                            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Timeline</h4>
                          <p className="mt-1 text-xs text-neutral-500">
                            Chronological view for records in this sequence group.
                          </p>
                        </div>
                        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-1">
                          <button
                            type="button"
                            onClick={() => setSequenceTimelineSort("asc")}
                            className={`rounded px-3 py-1.5 text-xs font-bold ${
                              sequenceTimelineSort === "asc"
                                ? "bg-lime-400/30 text-neutral-900"
                                : "text-neutral-500 hover:bg-neutral-50"
                            }`}
                          >
                            Oldest first
                          </button>
                          <button
                            type="button"
                            onClick={() => setSequenceTimelineSort("desc")}
                            className={`rounded px-3 py-1.5 text-xs font-bold ${
                              sequenceTimelineSort === "desc"
                                ? "bg-lime-400/30 text-neutral-900"
                                : "text-neutral-500 hover:bg-neutral-50"
                            }`}
                          >
                            Newest first
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-4 border-l-2 border-neutral-200 pl-4">
                        {selectedGroupTimeline.datedGroups.length === 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            This group has no dated records. Check the undated records below or add dates to build a usable sequence.
                          </div>
                        )}
                        {selectedGroupTimeline.datedGroups.map((dateGroup) => (
                          <div key={dateGroup.date} className="relative">
                            <div className="absolute -left-[1.45rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-neutral-400" />
                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">{dateGroup.date}</div>
                            <div className="space-y-2">
                              {dateGroup.items.map(renderTimelineItem)}
                            </div>
                          </div>
                        ))}
                        {selectedGroupTimeline.undatedItems.length > 0 && (
                          <div className="relative">
                            <div className="absolute -left-[1.45rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-amber-400" />
                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">Undated records</div>
                            <div className="space-y-2">
                              {selectedGroupTimeline.undatedItems.map(renderTimelineItem)}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Links and Evidence</h4>
                          <p className="mt-1 text-xs text-neutral-500">
                            Proof chains and record links inside this sequence group.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(SEQUENCE_RELATIONSHIP_FILTER_LABELS).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setSequenceRelationshipFilter(value)}
                              className={`rounded-md border px-3 py-1.5 text-xs font-bold ${
                                sequenceRelationshipFilter === value
                                  ? "border-lime-400 bg-lime-400/30 text-neutral-900"
                                  : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                        <div className="space-y-4">
                          <div className="grid gap-3 lg:grid-cols-2">
                            {Object.entries(SEQUENCE_GROUP_TYPE_LABELS).map(([recordType, label]) => {
                              const nodes = relationshipVisibleNodes.filter((node) => node.recordType === recordType);
                              return (
                                <section key={recordType} className="rounded-lg border border-neutral-200 bg-white p-3">
                                  <div className="mb-3 flex items-center justify-between gap-2">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</h5>
                                    <span className="text-xs font-semibold text-neutral-500">{nodes.length}</span>
                                  </div>
                                  <div className="space-y-2">
                                    {nodes.length === 0 ? (
                                      <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">No matching records.</p>
                                    ) : nodes.map(renderRelationshipNode)}
                                  </div>
                                </section>
                              );
                            })}
                          </div>
                        </div>

                        <aside className="space-y-3">
                          <section className="rounded-lg border border-neutral-200 bg-white p-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Proof Chains</div>
                            <div className="mt-2 space-y-2">
                              {selectedGroupRelationshipMap.proofChains.length === 0 ? (
                                <p className="text-sm text-neutral-500">No incident-evidence proof chains found in this group.</p>
                              ) : selectedGroupRelationshipMap.proofChains.map((chain) => (
                                <div key={`${chain.incidentId}-${chain.evidenceId}`} className="rounded-lg border border-lime-200 bg-lime-50 p-2 text-sm text-lime-900">
                                  <span className="font-semibold">{chain.incidentTitle}</span>
                                  <span className="px-2 text-lime-700">to</span>
                                  <span className="font-semibold">{chain.evidenceTitle}</span>
                                </div>
                              ))}
                            </div>
                          </section>

                          <section className="rounded-lg border border-neutral-200 bg-white p-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Linked Records</div>
                            <div className="mt-2 space-y-2">
                              {relationshipVisibleEdges.length === 0 ? (
                                <p className="text-sm text-neutral-500">No visible links for this filter.</p>
                              ) : relationshipVisibleEdges.map((edge) => {
                                const fromNode = relationshipNodeById.get(edge.fromId);
                                const toNode = relationshipNodeById.get(edge.toId);
                                return (
                                  <div key={`${edge.fromId}-${edge.toId}-${edge.relationType}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-700">
                                    <div className="font-semibold text-neutral-900">{fromNode?.title || edge.fromId}</div>
                                    <div className="py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{getRelationshipRelationLabel(edge.relationType)}</div>
                                    <div className="font-semibold text-neutral-900">{toNode?.title || edge.toId}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>

                          {selectedGroupRelationshipMap.weakNodes.length > 0 && (
                            <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Diagnostics Hints</div>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                                {selectedGroupRelationshipMap.weakNodes.map((node) => (
                                  <li key={`${node.recordType}-${node.id}`}>
                                    {node.title}: {node.warningFlags.map(getRelationshipWarningLabel).join(", ")}
                                  </li>
                                ))}
                              </ul>
                            </section>
                          )}
                        </aside>
                      </div>
                    </section>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      {Object.entries(SEQUENCE_GROUP_TYPE_LABELS).map(([recordType, label]) => {
                        const records = (selectedGroup.records[recordType] || []).filter((record) => sequenceRecordMatchesSearch(record, normalizedSearch));
                        return (
                          <section key={recordType} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</h4>
                              <span className="text-xs font-semibold text-neutral-500">{records.length}</span>
                            </div>
                            <div className="space-y-2">
                              {records.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-neutral-200 bg-white p-3 text-sm text-neutral-500">
                                  {(selectedGroup.records[recordType] || []).length === 0 ? "No records in this group." : "No matching records for this search."}
                                </p>
                              ) : records.map((record) => renderRecordCard(record, true))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
                    Select a group to review its records and links, or create a group by moving an ungrouped record.
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Ungrouped Records</h4>
                    <p className="mt-1 text-xs text-neutral-500">{ungroupedCount} record{ungroupedCount === 1 ? "" : "s"} without a sequenceGroup.</p>
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {ungroupedCount === 0 && (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500 xl:col-span-2">
                      No ungrouped records. Every supported record already has a sequence group label.
                    </div>
                  )}
                  {Object.entries(SEQUENCE_GROUP_TYPE_LABELS).map(([recordType, label]) => {
                    const records = (sequenceGroupDetails.ungroupedRecords[recordType] || []).filter((record) => sequenceRecordMatchesSearch(record, normalizedSearch));
                    return (
                      <section key={recordType} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</h5>
                          <span className="text-xs font-semibold text-neutral-500">{records.length}</span>
                        </div>
                        <div className="space-y-2">
                          {records.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-neutral-200 bg-white p-3 text-sm text-neutral-500">
                              {(sequenceGroupDetails.ungroupedRecords[recordType] || []).length === 0 ? "No ungrouped records." : "No matching ungrouped records for this search."}
                            </p>
                          ) : records.map((record) => renderRecordCard(record, false))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </section>

              <details className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider text-neutral-600 hover:text-neutral-900">
                  Advanced / AI Cleanup
                </summary>
                <div className="mt-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="max-w-3xl text-xs leading-5 text-neutral-500">
                        Copy a compact review package for GPT, then paste sequence-group-delta-1.0 suggestions here. This can only move, rename, merge, or clear sequence groups.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onCopyReviewPackage}
                      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                    >
                      Copy AI group review package
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                    <textarea
                      value={sequenceGroupDeltaDraft}
                      onChange={(event) => {
                        setSequenceGroupDeltaDraft(event.target.value);
                        setSequenceGroupDeltaResult(null);
                      }}
                      placeholder='Paste sequence-group-delta-1.0 JSON here'
                      className="min-h-28 w-full rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs outline-none focus:border-lime-500"
                    />
                    <button
                      type="button"
                      onClick={onValidateDelta}
                      className="h-fit rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                    >
                      Validate
                    </button>
                    <button
                      type="button"
                      onClick={onApplyDelta}
                      disabled={!sequenceGroupDeltaDraft.trim()}
                      className="h-fit rounded-md border border-lime-500 bg-lime-400/20 px-3 py-2 text-sm font-bold text-neutral-900 hover:bg-lime-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Apply AI group suggestions
                    </button>
                  </div>

                  <SequenceGroupDeltaPreview result={sequenceGroupDeltaResult} />
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
