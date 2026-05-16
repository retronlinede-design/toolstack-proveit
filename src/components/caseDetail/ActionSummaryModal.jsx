export default function ActionSummaryModal({
  open,
  form,
  onChangeField,
  onCancel,
  onSave,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-neutral-100 p-5">
          <h3 className="text-lg font-semibold text-neutral-900">Edit Action Summary</h3>
          <p className="mt-1 text-xs text-neutral-500">Keep the next actions short. Put one item on each line.</p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="rounded-lg border border-lime-200 bg-lime-50 p-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600">
              Next Actions
            </label>
            <textarea
              placeholder={"Call housing office\nSend evidence pack\nCheck reply deadline"}
              value={form.nextActions}
              onChange={(e) => onChangeField("nextActions", e.target.value)}
              className="min-h-36 w-full rounded-lg border border-lime-200 bg-white p-3 text-sm outline-none focus:border-lime-600"
            />
          </section>

          <section className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Current Focus
            </label>
            <textarea
              placeholder="What matters most right now?"
              value={form.currentFocus}
              onChange={(e) => onChangeField("currentFocus", e.target.value)}
              className="min-h-24 w-full rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-lime-600"
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Important Reminders
              </label>
              <textarea
                placeholder={"One reminder per line\nKey facts\nConstraints"}
                value={form.importantReminders}
                onChange={(e) => onChangeField("importantReminders", e.target.value)}
                className="min-h-32 w-full rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-lime-600"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Critical Deadlines
              </div>
              <div className="min-h-32 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-500">
                GPT updates may include criticalDeadlines in actionSummary. Manual deadline editing is not wired in this panel yet.
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 p-5">
          <button onClick={onCancel} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
            Cancel
          </button>
          <button onClick={onSave} className="rounded-lg bg-lime-600 px-4 py-2 text-sm font-bold text-white hover:bg-lime-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
