export default function ActiveLedgerRecordModal({ record, entries, onClose }) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Ledger — {record.title}
          </h3>
          <button
            onClick={onClose}
            className="text-xs text-neutral-500"
          >
            Close
          </button>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
            >
              <div>
                <div className="font-medium">{entry.date}</div>
                <div className="text-neutral-500">{entry.direction}</div>
              </div>

              <div className="text-right">
                <div className="font-semibold">€{entry.amount}</div>
                <div className="text-[10px] uppercase text-neutral-500">
                  {entry.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
