export default function StringListEditor({ label, items = [], onChange, idPrefix }) {
  const values = Array.isArray(items) ? items : [];

  const updateItem = (index, value) => {
    onChange(values.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const removeItem = (index) => {
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-neutral-600">{label}</label>
        <button type="button" onClick={() => onChange([...values, ""])} className="rounded-lg border border-lime-500 bg-white px-2 py-1 text-xs font-medium text-neutral-700 shadow-sm hover:bg-lime-50">
          Add item
        </button>
      </div>
      {values.length > 0 ? (
        <div className="mt-2 space-y-2">
          {values.map((item, index) => (
            <div key={`${idPrefix}-${index}`} className="flex items-start gap-2">
              <textarea aria-label={`${label} item ${index + 1}`} value={typeof item === "string" ? item : ""} onChange={(event) => updateItem(index, event.target.value)} className="min-h-10 flex-1 rounded-lg border border-neutral-300 p-2 text-sm" rows={2} />
              <button type="button" onClick={() => removeItem(index)} aria-label={`Remove ${label} item ${index + 1}`} className="rounded-lg border border-red-300 bg-white px-2 py-2 text-xs font-medium text-red-700 hover:bg-red-50">
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-neutral-400">No items added.</p>
      )}
    </div>
  );
}
