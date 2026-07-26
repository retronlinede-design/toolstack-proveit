import { CalendarDays, Clock3, Paperclip, Tags } from "lucide-react";

import { getRecordDisplayMeta } from "../domain/linkingResolvers.js";
import AttachmentPreview from "./AttachmentPreview";
import LinkedChip from "./LinkedChip";
import { resolveStrategyOwner } from "./caseDetail/strategyWorkspaceHelpers.js";
import RecordActions from "./shared/RecordActions.jsx";
import RecordBadge from "./shared/RecordBadge.jsx";
import RecordMetadataRow from "./shared/RecordMetadataRow.jsx";

function getPriorityBadgeVariant(priority) {
  switch (priority) {
    case "critical": return "priority-critical";
    case "high": return "priority-high";
    case "medium": return "priority-medium";
    default: return "priority-low";
  }
}

function getStrategyStatusBadgeVariant(status) {
  if (["open", "active", "completed", "approved"].includes(status)) return "status-positive";
  if (["pending", "planned", "in_review", "needs_review"].includes(status)) return "status-warning";
  if (["blocked", "rejected", "failed"].includes(status)) return "status-critical";
  return "status-neutral";
}

function getDecisionStatusBadgeVariant(status) {
  if (["approved", "accepted", "decided", "completed"].includes(status)) return "status-positive";
  if (["proposed", "pending", "under_review", "provisional"].includes(status)) return "status-warning";
  if (["rejected", "blocked"].includes(status)) return "status-critical";
  return "status-neutral";
}

function formatStatus(value) {
  return typeof value === "string" && value.trim()
    ? value.trim().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : "";
}

function formatTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function getLinkedRecords(item, selectedCase) {
  const linkedIds = new Set([
    ...(Array.isArray(item?.linkedRecordIds) ? item.linkedRecordIds : []),
    ...(Array.isArray(item?.linkedIncidentIds) ? item.linkedIncidentIds : []),
    ...(Array.isArray(item?.linkedEvidenceIds) ? item.linkedEvidenceIds : []),
  ]);

  return [...linkedIds]
    .map((id) => getRecordDisplayMeta(selectedCase, id))
    .filter(Boolean);
}

function getStringItems(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function StrategyList({ title, items, tone = "neutral" }) {
  const values = getStringItems(items);
  if (values.length === 0) return null;
  const tones = {
    next: "border-lime-200 bg-lime-50/60 text-lime-800",
    risk: "border-amber-200 bg-amber-50/70 text-amber-900",
    neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
  };

  return (
    <details className={`rounded-xl border p-3 ${tones[tone] || tones.neutral}`} open={values.length <= 2}>
      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider">{title} ({values.length})</summary>
      <ul className="mt-2 space-y-1.5 border-t border-current/10 pt-2 text-sm leading-5">
        {values.slice(0, 5).map((value, index) => <li key={`${title}-${index}`} className="break-words">• {value}</li>)}
        {values.length > 5 && <li className="text-xs font-semibold opacity-70">+{values.length - 5} more</li>}
      </ul>
    </details>
  );
}

export default function StrategyRecordCard({
  item,
  selectedCase,
  imageCache,
  onPreviewFile,
  openEditRecordModal,
  onConvertRecord,
  deleteRecord,
  openLinkedRecord,
}) {
  const linkedRecords = getLinkedRecords(item, selectedCase);
  const linkedCounts = linkedRecords.reduce((counts, record) => {
    if (record.recordType === "incident") counts.incidents += 1;
    if (record.recordType === "evidence") counts.evidence += 1;
    if (record.recordType === "document") counts.documents += 1;
    if (record.recordType === "ledger") counts.ledger += 1;
    return counts;
  }, { incidents: 0, evidence: 0, documents: 0, ledger: 0 });
  const countBadges = [
    ["Incidents", linkedCounts.incidents],
    ["Evidence", linkedCounts.evidence],
    ["Documents", linkedCounts.documents],
    ["Ledger", linkedCounts.ledger],
  ].filter(([, count]) => count > 0);
  const status = formatStatus(item?.status);
  const eventDate = item?.eventDate || item?.date || "";
  const sequenceGroup = typeof item?.sequenceGroup === "string" ? item.sequenceGroup.trim() : "";
  const updatedAt = formatTimestamp(item?.updatedAt);
  const attachmentCount = Array.isArray(item?.attachments) ? item.attachments.length : 0;
  const strategyType = formatStatus(item?.strategyType);
  const priority = formatStatus(item?.priority);
  const decisionStatus = formatStatus(item?.decisionStatus);
  const owner = resolveStrategyOwner(item, selectedCase?.parties || []);
  const reviewDate = typeof item?.reviewDate === "string" ? item.reviewDate.trim() : "";
  const hasObjective = hasText(item?.objective);
  const hasDesiredOutcome = hasText(item?.desiredOutcome);
  const hasRationale = hasText(item?.rationale);

  return (
    <article id={`record-${item.id}`} className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-neutral-50/80 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 sm:pr-3">
            <div className="flex flex-wrap items-center gap-2">
              {strategyType && <RecordBadge variant="type" className="uppercase tracking-wider">{strategyType}</RecordBadge>}
              {priority && <RecordBadge variant={getPriorityBadgeVariant(item.priority)} className="uppercase tracking-wider">{priority} priority</RecordBadge>}
              {status && (
                <RecordBadge variant={getStrategyStatusBadgeVariant(item.status)} className="uppercase tracking-wider">
                  {status}
                </RecordBadge>
              )}
              {decisionStatus && <RecordBadge variant={getDecisionStatusBadgeVariant(item.decisionStatus)} className="uppercase tracking-wider">{decisionStatus}</RecordBadge>}
              {eventDate && (
                <RecordMetadataRow items={[{ key: "event-date", value: eventDate, icon: <CalendarDays className="h-3.5 w-3.5" />, emphasis: true }]} />
              )}
              {sequenceGroup && (
                <span className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  <Tags className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
                  <span className="truncate">{sequenceGroup}</span>
                </span>
              )}
            </div>
            <h3 className="mt-3 break-words text-lg font-semibold leading-snug text-neutral-950 sm:text-xl">
              {item?.title || "Untitled Strategy"}
            </h3>
          </div>

          <RecordActions
            className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-2"
            actions={[
              { key: "open", label: "Open", variant: "primary", onClick: () => openEditRecordModal("strategy", item) },
              { key: "convert", label: "Convert", variant: "secondary", onClick: () => onConvertRecord?.("strategy", item) },
              { key: "delete", label: "Delete", variant: "danger", onClick: () => deleteRecord("strategy", item.id) },
            ]}
          />
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {hasObjective && (
          <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Objective</div>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-neutral-900">{item.objective}</p>
          </section>
        )}

        {hasDesiredOutcome && (
          <section className="rounded-xl border border-lime-100 bg-lime-50/50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-lime-700">Desired Outcome</div>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-neutral-800">{item.desiredOutcome}</p>
          </section>
        )}

        {hasRationale && (
          <section>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Rationale</div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{item.rationale}</p>
          </section>
        )}

        {(getStringItems(item?.nextSteps).length > 0 || getStringItems(item?.risks).length > 0 || getStringItems(item?.assumptions).length > 0) && (
          <div className="grid gap-3 lg:grid-cols-3">
            <StrategyList title="Next Steps" items={item.nextSteps} tone="next" />
            <StrategyList title="Risks" items={item.risks} tone="risk" />
            <StrategyList title="Assumptions" items={item.assumptions} />
          </div>
        )}

        {(owner || reviewDate) && (
          <RecordMetadataRow
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/60"
            items={[
              { key: "owner", label: "Owner", value: owner?.name },
              { key: "review-date", label: "Review", value: reviewDate },
            ]}
          />
        )}

        {item?.description && (
          <section className={hasObjective ? "rounded-xl border border-neutral-200 bg-neutral-50 p-4" : "rounded-xl border border-blue-100 bg-blue-50/60 p-4"}>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${hasObjective ? "text-neutral-500" : "text-blue-700"}`}>{hasObjective ? "Additional Context" : "Objective"}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-800">{item.description}</p>
          </section>
        )}

        {(countBadges.length > 0 || attachmentCount > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {countBadges.map(([label, count]) => (
              <span key={label} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                {label} {count}
              </span>
            ))}
            {attachmentCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                <Paperclip className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}

        {linkedRecords.length > 0 && (
          <details className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-700">
              View linked records ({linkedRecords.length})
            </summary>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {linkedRecords.map((record) => (
                <LinkedChip
                  key={record.id}
                  onClick={() => openLinkedRecord?.(record.id)}
                  titleText={record.title || "Untitled record"}
                  variant="record"
                  leading={<span className="font-bold uppercase opacity-50">{record.typeLabel}</span>}
                >
                  {record.title || "Untitled record"}
                </LinkedChip>
              ))}
            </div>
          </details>
        )}

        {item?.notes && (
          <details className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-600">Notes</summary>
            <p className="mt-3 whitespace-pre-wrap border-t border-neutral-200 pt-3 text-sm italic leading-6 text-neutral-600">{item.notes}</p>
          </details>
        )}

        {attachmentCount > 0 && (
          <AttachmentPreview
            attachments={item.attachments}
            imageCache={imageCache}
            onPreview={onPreviewFile}
          />
        )}

        {updatedAt && (
          <RecordMetadataRow className="border-t border-neutral-100 pt-3 dark:border-neutral-800" items={[{ key: "last-updated", label: "Last updated", value: updatedAt, icon: <Clock3 className="h-3.5 w-3.5" /> }]} />
        )}
      </div>
    </article>
  );
}
