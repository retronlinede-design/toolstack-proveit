import { CalendarDays, Clock3, Paperclip, Tags } from "lucide-react";

import { getRecordDisplayMeta } from "../domain/linkingResolvers.js";
import AttachmentPreview from "./AttachmentPreview";
import LinkedChip from "./LinkedChip";

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

  return (
    <article id={`record-${item.id}`} className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-neutral-50/80 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 sm:pr-3">
            <div className="flex flex-wrap items-center gap-2">
              {status && (
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  item.status === "archived"
                    ? "border-neutral-300 bg-neutral-100 text-neutral-600"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }`}>
                  {status}
                </span>
              )}
              {eventDate && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                  <CalendarDays className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                  {eventDate}
                </span>
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

          <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:grid-cols-2">
            <button
              onClick={() => openEditRecordModal("strategy", item)}
              className="rounded-md border border-neutral-200 bg-neutral-100 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 transition-all hover:bg-neutral-200 active:scale-95"
            >
              Open
            </button>
            <button
              onClick={() => onConvertRecord?.("strategy", item)}
              className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-blue-700 transition-all hover:border-blue-200 hover:bg-blue-50 active:scale-95"
            >
              Convert
            </button>
            <button
              onClick={() => deleteRecord("strategy", item.id)}
              className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-red-600 transition-all hover:border-red-200 hover:bg-red-50 active:scale-95 sm:col-start-2"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {item?.description && (
          <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Objective</div>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-neutral-800">{item.description}</p>
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
          <div className="flex items-center gap-1.5 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            <Clock3 className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
            Last updated {updatedAt}
          </div>
        )}
      </div>
    </article>
  );
}
