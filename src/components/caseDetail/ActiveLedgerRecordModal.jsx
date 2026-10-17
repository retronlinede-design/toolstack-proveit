import { useEffect, useRef } from "react";

export default function ActiveLedgerRecordModal({ record, entries, onClose }) {
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!record) return undefined;
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [record, onClose]);

  if (!record) return null;

  return <div className="case-file-derived-payment-modal fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" role="presentation">
    <section className="case-file-derived-payment-dialog w-full max-w-lg rounded-2xl border p-4 shadow-2xl sm:p-5" role="dialog" aria-modal="true" aria-labelledby="derived-payment-preview-title" aria-describedby="derived-payment-preview-description">
      <header className="flex items-start justify-between gap-4 border-b pb-3">
        <div className="min-w-0"><p className="case-file-derived-payment-eyebrow">Derived Payment Preview</p><h3 id="derived-payment-preview-title" className="mt-1 text-base font-semibold">{record.title}</h3><p id="derived-payment-preview-description" className="mt-1 text-sm">Not Canonical Ledger Entries — calculated from this tracking record only. These values do not create or modify Ledger records.</p></div>
        <button ref={closeButtonRef} type="button" onClick={onClose} className="case-file-derived-payment-close">Close</button>
      </header>
      <div className="mt-4 max-h-[min(55vh,28rem)] space-y-2 overflow-y-auto pr-1">
        {entries.length === 0 ? <p className="case-file-derived-payment-empty">No payment rows in this record meet the existing preview criteria.</p> : entries.map((entry) => <div key={entry.id} className="case-file-derived-payment-entry flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs"><div className="min-w-0"><div className="font-medium">{entry.date}</div><div className="mt-0.5 capitalize">{entry.direction}</div></div><div className="shrink-0 text-right"><div className="font-semibold">€{entry.amount}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">{entry.status}</div></div></div>)}
      </div>
    </section>
  </div>;
}
