export default function RecordModal({
  recordType,
  selectedCase,
  recordForm,
  setRecordForm,
  handleRecordFiles,
  removeRecordAttachment,
  saveRecord,
  closeRecordModal,
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold capitalize">Add {recordType.slice(0, -1)}</h2>
        <p className="mb-4 text-sm text-neutral-600">Case: {selectedCase.name}</p>
        <input
          placeholder="Title"
          value={recordForm.title}
          onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
        />
        <input
          type="date"
          value={recordForm.date}
          onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
        />
        <textarea
          placeholder="Description"
          value={recordForm.description}
          onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
          rows={4}
        />
        <textarea
          placeholder="Notes"
          value={recordForm.notes}
          onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
          className="mb-3 w-full rounded-xl border border-neutral-300 p-3"
          rows={3}
        />

        <label className="mb-3 block cursor-pointer rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
          Upload attachments (images, PDFs, documents)
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleRecordFiles}
            accept="image/*,application/pdf,.pdf,.doc,.docx,.txt"
          />
        </label>

        {recordForm.attachments.length > 0 && (
          <div className="mb-4 space-y-2">
            {recordForm.attachments.map((file) => (
              <div key={file.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                <span className="truncate pr-3">{file.name}</span>
                <button
                  onClick={() => removeRecordAttachment(file.id)}
                  className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-xs text-neutral-700 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={saveRecord} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
            Save
          </button>
          <button onClick={closeRecordModal} className="flex-1 rounded-xl border border-lime-500 bg-white py-2 font-medium text-neutral-800 shadow-[0_2px_4px_rgba(60,60,60,0.2)] hover:bg-lime-400/30 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
