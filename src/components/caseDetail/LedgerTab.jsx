import { getLinkChipClasses } from "../linkChipStyles";
import LinkedChip from "../LinkedChip";
import {
  filterLedgerEntries,
  groupLedgerEntriesByBatch,
  sortLedgerEntries,
} from "./ledgerViewHelpers";

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

function statusBadgeColor(status) {
  switch (status) {
    case "paid": return "bg-lime-100 text-lime-700 border-lime-300";
    case "part-paid": return "bg-amber-100 text-amber-700 border-amber-300";
    case "unpaid": return "bg-red-100 text-red-700 border-red-300";
    case "disputed": return "bg-orange-100 text-orange-700 border-orange-300";
    case "refunded": return "bg-blue-100 text-blue-700 border-blue-300";
    default: return "bg-neutral-100 text-neutral-700 border-neutral-300";
  }
}

function proofStatusBadgeColor(proofStatus) {
  switch (proofStatus) {
    case "confirmed": return "bg-lime-100 text-lime-700 border-lime-300";
    case "partial": return "bg-amber-100 text-amber-700 border-amber-300";
    default: return "bg-red-100 text-red-700 border-red-300";
  }
}

export default function LedgerTab({
  ledgerEntries,
  ledgerFilter,
  collapsedLedgerGroups,
  onChangeFilter,
  onToggleGroup,
  onOpenLedgerModal,
  onDuplicateLedgerEntry,
  onDeleteLedgerEntry,
  getLinkedRecordMeta,
  onOpenLinkedRecord,
}) {
  const safeLedgerEntries = ledgerEntries || [];
  const ledger = sortLedgerEntries(safeLedgerEntries);
  const filteredLedger = filterLedgerEntries(ledger, ledgerFilter);
  const groupedLedger = groupLedgerEntriesByBatch(filteredLedger);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Ledger</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => onOpenLedgerModal({ category: "rent" })}
              className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
            >
              + Rent
            </button>
            <button 
              onClick={() => onOpenLedgerModal({ category: "utility" })}
              className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
            >
              + Utility
            </button>
            <button 
              onClick={() => onOpenLedgerModal({ category: "installment" })}
              className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
            >
              + Installment
            </button>
          </div>
        </div>
        <button
          onClick={() => onOpenLedgerModal()}
          className="rounded-lg border border-lime-500 bg-white px-3 py-1 text-sm font-bold text-neutral-900 shadow-md hover:bg-lime-400/30 transition-all active:scale-95"
        >
          + Add Entry
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2">
        {["all", "rent", "installment", "deposit", "furniture", "repair", "utility", "legal", "other"].map((f) => (
          <button
            key={f}
            onClick={() => onChangeFilter(f)}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all whitespace-nowrap ${
              ledgerFilter === f
                ? "bg-lime-500 border-lime-600 text-white shadow-sm"
                : "bg-white border-neutral-300 text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {safeLedgerEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          No ledger entries yet.
        </div>
      ) : filteredLedger.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-600">
          No ledger entries match this filter.
        </div>
      ) : (
        <div className="space-y-8">
          {groupedLedger.map((group) => {
            const isCollapsed = collapsedLedgerGroups[group.batchLabel];
            return (
              <div key={group.batchLabel} className="space-y-3 border-b border-neutral-100 pb-3 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => onToggleGroup(group.batchLabel)}
                    className="flex items-center gap-2 px-1 py-1 rounded-lg text-left hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-[10px] text-neutral-400 w-3">
                      {isCollapsed ? "â–¶" : "â–¼"}
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      {group.batchLabel === "Ungrouped" ? "Ungrouped Entries" : group.batchLabel}
                    </h4>
                    <span className="text-[10px] font-medium text-neutral-400">{group.items.length} entries</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLedgerModal({
                        batchLabel: group.batchLabel
                      });
                    }}
                    className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                  >
                    Add to Group
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-neutral-800">{item.label || "Untitled Ledger Entry"}</h4>
                          <div className="flex items-center gap-3">
                            {item.batchLabel && (
                              <span className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[9px] font-bold uppercase tracking-tight text-neutral-500">
                                {item.batchLabel}
                              </span>
                            )}
                            <span className="text-xs text-neutral-500">{item.category || "N/A"}</span>
                            <button 
                              onClick={() => onOpenLedgerModal(item, item.id)}
                              className="rounded-lg border border-lime-500 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-lime-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => onDuplicateLedgerEntry(item)}
                              className="rounded-lg border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
                            >
                              Duplicate
                            </button>
                            <button 
                              onClick={() => onDeleteLedgerEntry(item.id)}
                              className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-neutral-600 mb-2">Period: {item.period || "N/A"}</div>

                        <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                          <div>Expected: {item.expectedAmount} {item.currency}</div>
                          <div>Paid: {item.paidAmount} {item.currency}</div>
                          <div>Difference: {item.differenceAmount} {item.currency}</div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusBadgeColor(item.status)}`}>
                              {item.status || "N/A"}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${proofStatusBadgeColor(item.proofStatus)}`}>
                              {item.proofStatus || "N/A"}
                            </span>
                          </div>
                          <div className="text-neutral-500">
                            {item.paymentDate ? `Paid: ${item.paymentDate}` : item.dueDate ? `Due: ${item.dueDate}` : "No Date"}
                          </div>
                        </div>

                        {item.counterparty && <div className="text-xs text-neutral-500 mt-2">Counterparty: {item.counterparty}</div>}
                        {item.notes && <p className="text-xs text-neutral-500 mt-2 line-clamp-2">{item.notes}</p>}

                        {item.linkedRecordIds && item.linkedRecordIds.length > 0 && (
                          <div className="mt-1 border-t border-neutral-100 pt-1">
                            {renderCompactLinkRow("Supporting Links", item.linkedRecordIds, (rid) => {
                              const linkedRecord = getLinkedRecordMeta(rid);
                              if (!linkedRecord) return null;
                              return (
                                <LinkedChip
                                  key={rid}
                                  onClick={() => onOpenLinkedRecord(rid)}
                                  titleText={linkedRecord.title || "Untitled record"}
                                  variant="record"
                                  className="flex items-center gap-1 text-left transition-colors"
                                  leading={<span className="shrink-0 font-bold uppercase opacity-50">{linkedRecord.typeLabel}</span>}
                                >
                                  {linkedRecord.title || "Untitled record"}
                                </LinkedChip>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
