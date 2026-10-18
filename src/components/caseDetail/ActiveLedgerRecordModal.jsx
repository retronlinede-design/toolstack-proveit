import DialogShell from "../shared/DialogShell.jsx";

export default function ActiveLedgerRecordModal({ record, entries, onClose }) {
  if (!record) return null;

  return <DialogShell
    title="Derived Payment Preview"
    description={record.title}
    width="compact"
    onRequestClose={onClose}
    dismissOnBackdrop={false}
    className="case-file-derived-payment-dialog"
  >
    <p className="case-file-derived-payment-eyebrow">Derived Payment Preview</p>
    <p className="mt-1 text-sm">Not Canonical Ledger Entries — calculated from this tracking record only. These values do not create or modify Ledger records.</p>
    <div className="mt-4 space-y-2">
      {entries.length === 0 ? <p className="case-file-derived-payment-empty">No payment rows in this record meet the existing preview criteria.</p> : entries.map((entry) => <div key={entry.id} className="case-file-derived-payment-entry flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs"><div className="min-w-0"><div className="font-medium">{entry.date}</div><div className="mt-0.5 capitalize">{entry.direction}</div></div><div className="shrink-0 text-right"><div className="font-semibold">€{entry.amount}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">{entry.status}</div></div></div>)}
    </div>
  </DialogShell>;
}
