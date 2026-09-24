import { useState } from "react";
import { Tags } from "lucide-react";
import { getLinkChipClasses } from "../linkChipStyles";
import LinkedChip from "../LinkedChip";
import PartyLinksRow from "./PartyLinksRow";
import {
  formatRecordTableHeader,
  getDifferenceClasses,
  getRecordStatusClasses,
  getRecordTableHeaders,
  getRecordTypeLabel,
} from "./trackingRecordHelpers";
import { getTrackingRecordTableText } from "../../domain/trackingRecordFormat.js";
import { parseTrackingRecordTable, removeTrackingRecordTableRow, serializeTrackingRecordTable } from "../../domain/trackingRecordTable.js";
import {
  buildAllTrackingRecordsGptExport,
  buildTrackingRecordGptExport,
} from "./recordsGptExport";
import { resolveSelectedTrackingRecordId } from "./recordsWorkspaceHelpers";

function renderCompactLinkRow(label, items, renderChip) {
  if (!items || items.length === 0) return null;
  const renderedChips = items.map(renderChip).filter(Boolean);
  const visibleChips = renderedChips.slice(0, 4);
  const remainingCount = renderedChips.length - visibleChips.length;
  const missingCount = items.length - renderedChips.length;

  if (renderedChips.length === 0 && missingCount === 0) return null;

  return (
    <div className="mt-3 flex items-start gap-2 border-t border-neutral-100 pt-3">
      <div className="w-28 shrink-0 pt-0.5 text-[11px] text-neutral-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {visibleChips}
        {remainingCount > 0 && <span className={getLinkChipClasses("neutral")}>+{remainingCount}</span>}
        {missingCount > 0 && (
          <span className={getLinkChipClasses("neutral", "cursor-default opacity-70")}>
            {missingCount} missing link{missingCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function renderIssueChip(value) {
  const issueName = typeof value === "string" ? value.trim() : "";
  if (!issueName) return null;

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
      <Tags className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
      <span className="truncate">{issueName}</span>
    </span>
  );
}

function RecordTable({ record, structuredTable, onEditRow, onDeleteRow }) {
  const usesStructuredRows = structuredTable?.status === "ok";
  const tableHeaders = usesStructuredRows ? structuredTable.headers : getRecordTableHeaders(record.table || []);
  const tableRows = usesStructuredRows ? structuredTable.rows : (record.table || []);

  if (tableRows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
        No rows yet. Add an entry to begin tracking data.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          <tr>
            {tableHeaders.map((header, index) => (
              <th key={`${header}-${index}`} className="border-b border-neutral-200 px-3 py-2 whitespace-nowrap">
                {formatRecordTableHeader(header)}
              </th>
            ))}
            {usesStructuredRows && <th className="border-b border-neutral-200 px-3 py-2 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {tableRows.map((row, rowIndex) => (
            <tr key={`${record.id}-row-${rowIndex}`} className="align-top">
              {tableHeaders.map((header, columnIndex) => {
                const value = usesStructuredRows ? row[columnIndex] : (row[header] ?? "");
                const isStatus = header.toLowerCase() === "status";
                const isDifference = header.toLowerCase() === "difference";
                return (
                  <td key={`${header}-${columnIndex}`} className="px-3 py-2 text-neutral-700">
                    {isStatus && value ? (
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRecordStatusClasses(value)}`}>
                        {value}
                      </span>
                    ) : (
                      <span className={`break-words ${isDifference ? `font-semibold ${getDifferenceClasses(value)}` : ""}`}>
                        {value || "—"}
                      </span>
                    )}
                  </td>
                );
              })}
              {usesStructuredRows && (
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1"><button type="button" onClick={() => onEditRow(rowIndex)} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[10px] font-bold text-neutral-700 hover:bg-neutral-50">Edit</button><button type="button" onClick={() => onDeleteRow(rowIndex)} className="rounded-md border border-red-300 bg-white px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50">Delete</button></div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RecordsTab({
  caseItem,
  trackingRecords,
  generatedLedgerEntries,
  onAddRecord,
  onViewPayments,
  onOpenRecord,
  onConvertRecord,
  onDeleteRecord,
  onSaveTrackingRecordTable,
  getUsedByIncidents,
  getBasedOnEvidence,
  onOpenLinkedRecord,
}) {
  const [requestedSelectedRecordId, setRequestedSelectedRecordId] = useState("");
  const [gptCopyFeedback, setGptCopyFeedback] = useState("");
  const [entryEditor, setEntryEditor] = useState(null);
  const [entryError, setEntryError] = useState("");
  const [entrySaving, setEntrySaving] = useState(false);
  const [tableActionError, setTableActionError] = useState("");
  const selectedRecordId = resolveSelectedTrackingRecordId(trackingRecords, requestedSelectedRecordId);
  const selectedRecord = trackingRecords.find((record) => record.id === selectedRecordId) || null;
  const structuredTable = selectedRecord
    ? parseTrackingRecordTable(getTrackingRecordTableText(selectedRecord.rawDocument?.textContent || ""))
    : null;

  async function copyText(text) {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  async function handleCopyRecordGptData(record, context) {
    const payload = buildTrackingRecordGptExport(caseItem, record, context);
    await copyText(JSON.stringify(payload, null, 2));
    setGptCopyFeedback(`Copied GPT data for "${record.title}".`);
  }

  async function handleCopyAllRecordsGptData() {
    const contextByRecordId = Object.fromEntries(trackingRecords.map((record) => [
      record.id,
      { usedByIncidents: getUsedByIncidents(record.id), basedOnEvidence: getBasedOnEvidence(record) },
    ]));
    const payload = buildAllTrackingRecordsGptExport(caseItem, trackingRecords, contextByRecordId);
    await copyText(JSON.stringify(payload, null, 2));
    setGptCopyFeedback(`Copied ${trackingRecords.length} tracking record${trackingRecords.length === 1 ? "" : "s"} for GPT.`);
  }

  function openEntryEditor(mode, rowIndex = null) {
    if (structuredTable?.status !== "ok") return;
    setEntryError("");
    setEntryEditor({
      mode,
      rowIndex,
      headers: structuredTable.headers,
      values: mode === "edit" ? [...structuredTable.rows[rowIndex]] : structuredTable.headers.map(() => ""),
    });
  }

  function updateEntryValue(index, value) {
    setEntryEditor((current) => ({
      ...current,
      values: current.values.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  }

  async function saveEntry() {
    if (!selectedRecord || !entryEditor || structuredTable?.status !== "ok") return;

    const rows = structuredTable.rows.map((row) => [...row]);
    if (entryEditor.mode === "edit") rows[entryEditor.rowIndex] = [...entryEditor.values];
    else rows.push([...entryEditor.values]);

    let tableText;
    try {
      tableText = serializeTrackingRecordTable({ headers: structuredTable.headers, rows });
    } catch (error) {
      setEntryError(error.message || "This entry cannot be saved safely.");
      return;
    }

    setEntrySaving(true);
    setEntryError("");
    const saved = await onSaveTrackingRecordTable?.(selectedRecord.rawDocument.id, tableText);
    setEntrySaving(false);
    if (!saved) {
      setEntryError("The tracking record could not be saved. No table changes were applied.");
      return;
    }
    setEntryEditor(null);
  }

  async function deleteEntry(rowIndex) {
    if (!selectedRecord || structuredTable?.status !== "ok") return;

    const row = structuredTable.rows[rowIndex];
    if (!row) return;
    const context = structuredTable.headers
      .slice(0, 3)
      .map((header, index) => `${header}: ${row[index] || "—"}`)
      .join(" · ");
    if (!window.confirm(`Delete this entry?\n${context}`)) return;

    let tableText;
    try {
      const remaining = removeTrackingRecordTableRow(structuredTable, rowIndex);
      tableText = serializeTrackingRecordTable(remaining);
    } catch (error) {
      setTableActionError(error.message || "This entry cannot be deleted safely.");
      return;
    }

    setEntryEditor(null);
    setTableActionError("");
    const saved = await onSaveTrackingRecordTable?.(selectedRecord.rawDocument.id, tableText);
    if (!saved) {
      setTableActionError("The tracking record could not be saved. No table changes were applied.");
    }
  }
  const selectedTableRows = structuredTable?.status === "ok" ? structuredTable.rows : (selectedRecord?.table || []);
  const selectedUsedByIncidents = selectedRecord ? getUsedByIncidents(selectedRecord.id) : [];
  const selectedBasedOnEvidence = selectedRecord ? getBasedOnEvidence(selectedRecord) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Records</h3>
          <p className="mt-1 text-sm text-neutral-500">Select a record · review its table and links. Source documents stay in Documents.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleCopyAllRecordsGptData} disabled={trackingRecords.length === 0} className="rounded-lg border border-blue-300 bg-white px-3 py-1 text-sm font-bold text-blue-800 shadow-sm transition-all hover:bg-blue-50 active:scale-95 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-white">Copy All Records GPT JSON</button>
          <button onClick={onAddRecord} className="rounded-lg border border-blue-400 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md transition-all hover:bg-blue-50 active:scale-95">Add Record</button>
        </div>
      </div>

      {gptCopyFeedback && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">{gptCopyFeedback}</div>}

      {trackingRecords.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-6 text-center">
          <h4 className="text-base font-semibold text-blue-950">No Case Records yet</h4>
          <p className="mx-auto mt-2 max-w-md text-sm text-blue-800">Create a tracking record to keep a table of the facts you want to monitor.</p>
          <button onClick={onAddRecord} className="mt-4 rounded-lg border border-blue-400 bg-white px-3 py-1.5 text-sm font-bold text-neutral-900 shadow-sm hover:bg-blue-50">Add Record</button>
        </section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2fr)]">
          <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 px-1"><h4 className="text-sm font-bold uppercase tracking-wider text-blue-900">Tracking Records</h4><span className="rounded-md border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-bold text-blue-700">{trackingRecords.length}</span></div>
            <div className="space-y-1">
              {trackingRecords.map((record) => {
                const isSelected = record.id === selectedRecordId;
                return <button key={record.id} type="button" onClick={() => setRequestedSelectedRecordId(record.id)} aria-pressed={isSelected} className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 ${isSelected ? "border-lime-500 bg-white shadow-sm" : "border-transparent hover:border-blue-200 hover:bg-white/70"}`}><div className="flex items-start justify-between gap-2"><span className="min-w-0 truncate text-sm font-semibold text-neutral-900">{record.title}</span><span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">{getRecordTypeLabel(record.meta.type)}</span></div><div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">{record.meta.status && <span className={getRecordStatusClasses(record.meta.status)}>{record.meta.status}</span>}{record.meta.period && <span>{record.meta.period}</span>}{renderIssueChip(record.rawDocument?.sequenceGroup)}</div></button>;
              })}
            </div>
          </aside>

          {selectedRecord && (
            <article className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
              <header className="flex flex-col gap-3 border-b border-neutral-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-lg font-semibold text-neutral-900">{selectedRecord.title}</h4><span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">{getRecordTypeLabel(selectedRecord.meta.type)}</span>{selectedRecord.meta.status && <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getRecordStatusClasses(selectedRecord.meta.status)}`}>{selectedRecord.meta.status}</span>}{renderIssueChip(selectedRecord.rawDocument?.sequenceGroup)}</div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">{selectedRecord.meta.period && <span><span className="font-medium text-neutral-800">Period:</span> {selectedRecord.meta.period}</span>}<span>{selectedTableRows.length} row{selectedTableRows.length === 1 ? "" : "s"}</span>{selectedRecord.fileLinks.length > 0 && <span>{selectedRecord.fileLinks.length} file link{selectedRecord.fileLinks.length === 1 ? "" : "s"}</span>}</div></div>
                <div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" onClick={() => onOpenRecord(selectedRecord)} className="rounded-lg border border-lime-500 bg-white px-2.5 py-1 text-xs font-bold text-neutral-800 shadow-sm hover:bg-lime-50">Open / Edit</button><button type="button" onClick={() => onConvertRecord?.(selectedRecord)} className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50">Convert</button><button type="button" onClick={() => onDeleteRecord(selectedRecord)} className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-bold text-red-700 shadow-sm hover:bg-red-50">Delete</button><button type="button" onClick={() => onViewPayments(selectedRecord)} className="rounded-lg border border-blue-500 bg-white px-2.5 py-1 text-xs font-bold text-neutral-700 shadow-sm hover:bg-blue-50">View Payments</button><button type="button" onClick={() => handleCopyRecordGptData(selectedRecord, { usedByIncidents: selectedUsedByIncidents, basedOnEvidence: selectedBasedOnEvidence })} className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50">Copy Record GPT JSON</button></div>
              </header>

              <section className="mt-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Tracking Table</h5>{structuredTable?.status === "ok" && <button type="button" onClick={() => openEntryEditor("add")} className="rounded-lg border border-lime-500 bg-white px-2.5 py-1 text-xs font-bold text-neutral-800 shadow-sm hover:bg-lime-50">Add Entry</button>}</div>
                {structuredTable?.status === "unavailable" && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Structured editing is unavailable for this legacy/custom table. Use Edit → Advanced / Raw Tracking Table.</p>}
                <RecordTable record={selectedRecord} structuredTable={structuredTable} onEditRow={(rowIndex) => openEntryEditor("edit", rowIndex)} onDeleteRow={deleteEntry} />
                {tableActionError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{tableActionError}</p>}
              </section>

              <section className="mt-5">
                {selectedRecord.meta.subject && <p className="border-l-2 border-blue-100 pl-3 text-sm text-neutral-700"><span className="font-medium text-neutral-800">Purpose:</span> {selectedRecord.meta.subject}</p>}
                {selectedRecord.summary && <p className="mt-3 border-l-2 border-blue-100 pl-3 text-sm text-neutral-700">{selectedRecord.summary}</p>}
                <PartyLinksRow linkedPartyIds={selectedRecord.rawDocument?.linkedPartyIds} parties={caseItem?.parties || []} />
                {renderCompactLinkRow("Based on Evidence", selectedBasedOnEvidence, (evidenceItem) => <LinkedChip key={evidenceItem.id} onClick={() => onOpenLinkedRecord(evidenceItem.id)} titleText={evidenceItem.title || "Untitled evidence"} variant="evidence" className="flex items-center gap-1 text-left transition-colors" leading={<span className="font-bold uppercase opacity-50">Evidence</span>}>{evidenceItem.title || "Untitled evidence"}</LinkedChip>)}
                {renderCompactLinkRow("Used By", selectedUsedByIncidents, (incident) => <LinkedChip key={incident.id} onClick={() => onOpenLinkedRecord(incident.id)} titleText={incident.title || "Untitled incident"} variant="incident" className="flex items-center gap-1 text-left transition-colors" leading={<span className="font-bold uppercase opacity-50">Incident</span>}>{incident.title || "Untitled incident"}</LinkedChip>)}
              </section>
            </article>
          )}
        </section>
      )}

      {entryEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={entryEditor.mode === "edit" ? "Edit Entry" : "Add Entry"}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold">{entryEditor.mode === "edit" ? "Edit Entry" : "Add Entry"}</h4>
            <p className="mt-1 text-sm text-neutral-600">Enter values for this record’s existing table columns.</p>
            <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {entryEditor.headers.map((header, index) => <div key={`${header}-${index}`}><label className="mb-1 block text-xs font-bold uppercase text-neutral-500">{formatRecordTableHeader(header)}</label><input type="text" value={entryEditor.values[index]} onChange={(event) => updateEntryValue(index, event.target.value)} className="w-full rounded-xl border border-neutral-300 p-3 outline-none focus:border-lime-500" /></div>)}
            </div>
            {entryError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{entryError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEntryEditor(null)} disabled={entrySaving} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50">Cancel</button><button type="button" onClick={saveEntry} disabled={entrySaving} className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-bold text-neutral-800 hover:bg-lime-50 disabled:cursor-not-allowed">{entrySaving ? "Saving…" : "Save Entry"}</button></div>
          </div>
        </div>
      )}

      {generatedLedgerEntries.length > 0 && <p className="text-xs text-neutral-500">{generatedLedgerEntries.length} generated payment preview{generatedLedgerEntries.length === 1 ? "" : "s"}; these do not update the Ledger.</p>}
    </div>
  );
}