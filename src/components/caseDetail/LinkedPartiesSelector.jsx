export default function LinkedPartiesSelector({
  parties = [],
  linkedPartyIds = [],
  onChange,
}) {
  const selectedIds = Array.isArray(linkedPartyIds) ? linkedPartyIds : [];

  const toggleParty = (partyId, checked) => {
    const nextIds = checked
      ? Array.from(new Set([...selectedIds, partyId]))
      : selectedIds.filter((id) => id !== partyId);
    onChange?.(nextIds);
  };

  return (
    <div className="pt-2">
      <label className="text-xs font-bold uppercase text-neutral-400 block mb-2">Linked Parties</label>
      <div className="max-h-40 overflow-y-auto space-y-2 pr-1 border border-neutral-200 rounded-xl p-2 bg-neutral-50/50">
        {parties.map((party) => (
          <label key={party.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white border border-transparent hover:border-neutral-200 transition-all cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.includes(party.id)}
              onChange={(event) => toggleParty(party.id, event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-lime-600 focus:ring-lime-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-neutral-800 truncate">{party.displayName || "Untitled Party"}</span>
                <span className="text-[9px] font-bold uppercase text-neutral-400 bg-neutral-100 px-1 rounded">{party.entityType || "party"}</span>
              </div>
              {party.organisationName && (
                <div className="text-[10px] text-neutral-500 truncate">{party.organisationName}</div>
              )}
            </div>
          </label>
        ))}
        {parties.length === 0 && (
          <p className="py-2 text-center text-[10px] italic text-neutral-400">No parties available.</p>
        )}
      </div>
    </div>
  );
}
