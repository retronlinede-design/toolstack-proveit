import { Tags } from "lucide-react";
import { getLinkChipClasses } from "../linkChipStyles";
import LinkedChip from "../LinkedChip";
import {
  formatRecordTableHeader,
  getDifferenceClasses,
  getRecordStatusClasses,
  getRecordTableHeaders,
  getRecordTypeLabel,
} from "./trackingRecordHelpers";

function renderCompactLinkRow(label, items, renderChip) {
  if (!items || items.length === 0) return null;
  const renderedChips = items.map(renderChip).filter(Boolean);
  const visibleChips = renderedChips.slice(0, 4);
  const remainingCount = renderedChips.length - visibleChips.length;
  const missingCount = items.length - renderedChips.length;

  if (renderedChips.length === 0 && missingCount === 0) return null;

  return (
    <div className="mt-1 flex items-start gap-2">
      <div className="w-24 shrink-0 pt-0.5 text-[11px] text-neutral-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {visibleChips}
        {remainingCount > 0 && (
          <span className={getLinkChipClasses("neutral")}>
            +{remainingCount}
          </span>
        )}
        {missingCount > 0 && (
          <span className={getLinkChipClasses("neutral", "cursor-default opacity-70")}>
            {missingCount} missing link{missingCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function renderSequenceGroupChip(value) {
  const sequenceGroup = typeof value === "string" ? value.trim() : "";
  if (!sequenceGroup) return null;

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
      <Tags className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
      <span className="truncate">{sequenceGroup}</span>
    </span>
  );
}

export default function RecordsTab({
  trackingRecords,
  generatedLedgerEntries,
  onAddRecord,
  onViewPayments,
  onOpenRecord,
  onDeleteRecord,
  getUsedByIncidents,
  getBasedOnEvidence,
  onOpenLinkedRecord,
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Records</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Table-based tracking records live here. Source documents stay in Documents.
          </p>
        </div>
        <button
          onClick={onAddRecord}
          className="rounded-lg border border-blue-400 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-blue-50 transition-all active:scale-95"
        >
          Add Record
        </button>
      </div>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900">Tracking Records</h3>
            <p className="mt-1 text-xs text-blue-800">
              Structured tables parsed from tracking-record text. Generated payment previews are temporary and do not update the Ledger yet.
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
            {trackingRecords.length} tracking record{trackingRecords.length === 1 ? "" : "s"} Â· {generatedLedgerEntries.length} generated payment preview{generatedLedgerEntries.length === 1 ? "" : "s"}
          </span>
        </div>

        {trackingRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 p-5 text-sm text-blue-800">
            No tracking records yet.
          </div>
        ) : (
          <div className="space-y-3">
            {trackingRecords.map((record) => {
              const tableRows = record.table || [];
              const tableHeaders = getRecordTableHeaders(tableRows);
              const previewRows = tableRows.slice(0, 5);
              const usedByIncidents = getUsedByIncidents(record.id);
              const basedOnEvidence = getBasedOnEvidence(record);

              return (
              <div key={record.id} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-neutral-900">{record.title}</span>
                      <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                        {getRecordTypeLabel(record.meta.type)}
                      </span>
                      {record.meta.status && (
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRecordStatusClasses(record.meta.status)}`}>
                          {record.meta.status}
                        </span>
                      )}
                      {renderSequenceGroupChip(record.rawDocument?.sequenceGroup)}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                      <span><span className="font-medium text-neutral-800">Purpose:</span> {record.meta.subject || "â€”"}</span>
                      {record.meta.period && <span><span className="font-medium text-neutral-800">Period:</span> {record.meta.period}</span>}
                      <span>{tableRows.length} row{tableRows.length === 1 ? "" : "s"}</span>
                      {record.fileLinks.length > 0 && <span>{record.fileLinks.length} file link{record.fileLinks.length === 1 ? "" : "s"}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => onViewPayments(record)}
                      className="rounded-lg border border-blue-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-blue-50 transition-colors"
                    >
                      View Payments
                    </button>
                    <button
                      onClick={() => onOpenRecord(record)}
                      className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                    >
                      Open / Edit
                    </button>
                    <button
                      onClick={() => onDeleteRecord(record)}
                      className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {record.summary && (
                  <p className="mt-3 border-l-2 border-blue-100 pl-3 text-sm text-neutral-700 line-clamp-3">{record.summary}</p>
                )}

                {basedOnEvidence.length > 0 && (
                  <div className="mt-1 border-t border-neutral-100 pt-1">
                    {renderCompactLinkRow("Based on Evidence", basedOnEvidence, (evidenceItem) => (
                      <LinkedChip
                        key={evidenceItem.id}
                        onClick={() => onOpenLinkedRecord(evidenceItem.id)}
                        titleText={evidenceItem.title || "Untitled evidence"}
                        variant="evidence"
                        className="flex items-center gap-1 text-left transition-colors"
                        leading={<span className="font-bold uppercase opacity-50">Evidence</span>}
                      >
                        {evidenceItem.title || "Untitled evidence"}
                      </LinkedChip>
                    ))}
                  </div>
                )}

                {usedByIncidents.length > 0 && (
                  <div className="mt-1 border-t border-neutral-100 pt-1">
                    {renderCompactLinkRow("Used By", usedByIncidents, (incident) => (
                      <LinkedChip
                        key={incident.id}
                        onClick={() => onOpenLinkedRecord(incident.id)}
                        titleText={incident.title || "Untitled incident"}
                        variant="incident"
                        className="flex items-center gap-1 text-left transition-colors"
                        leading={<span className="font-bold uppercase opacity-50">Incident</span>}
                      >
                        {incident.title || "Untitled incident"}
                      </LinkedChip>
                    ))}
                  </div>
                )}

                {previewRows.length > 0 ? (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
                    <table className="min-w-full border-collapse text-left text-xs">
                      <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        <tr>
                          {tableHeaders.map((header) => (
                            <th key={header} className="border-b border-neutral-200 px-3 py-2 whitespace-nowrap">
                              {formatRecordTableHeader(header)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 bg-white">
                        {previewRows.map((row, index) => (
                          <tr key={`${record.id}-row-${index}`} className="align-top">
                            {tableHeaders.map((header) => {
                              const value = row[header] || "";
                              const isStatus = header.toLowerCase() === "status";
                              const isDifference = header.toLowerCase() === "difference";
                              return (
                                <td key={header} className="px-3 py-2 text-neutral-700">
                                  {isStatus && value ? (
                                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRecordStatusClasses(value)}`}>
                                      {value}
                                    </span>
                                  ) : (
                                    <span className={isDifference ? `font-semibold ${getDifferenceClasses(value)}` : ""}>
                                      {value || "â€”"}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {tableRows.length > previewRows.length && (
                      <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        {tableRows.length - previewRows.length} more row{tableRows.length - previewRows.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                    No table rows parsed yet.
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
