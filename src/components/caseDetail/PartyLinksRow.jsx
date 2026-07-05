import { getLinkChipClasses } from "../linkChipStyles";

export default function PartyLinksRow({
  label = "Linked Parties",
  linkedPartyIds = [],
  parties = [],
}) {
  if (!Array.isArray(linkedPartyIds) || linkedPartyIds.length === 0) return null;

  const partyById = new Map(parties.map((party) => [party.id, party]));
  const renderedChips = linkedPartyIds
    .map((partyId) => partyById.get(partyId))
    .filter(Boolean)
    .map((party) => (
      <span key={party.id} title={party.displayName || "Untitled Party"} className={getLinkChipClasses("neutral", "inline-flex items-center gap-1 cursor-default")}>
        <span className="font-bold uppercase opacity-50">Party</span>
        <span className="truncate max-w-[180px]">{party.displayName || "Untitled Party"}</span>
      </span>
    ));

  const visibleChips = renderedChips.slice(0, 4);
  const remainingCount = renderedChips.length - visibleChips.length;
  const missingCount = linkedPartyIds.length - renderedChips.length;

  if (renderedChips.length === 0 && missingCount === 0) return null;

  return (
    <div className="mt-1 flex items-start gap-2">
      <div className="w-24 shrink-0 pt-0.5 text-[11px] text-neutral-500">{label}</div>
      <div className="flex flex-wrap gap-1">
        {visibleChips}
        {remainingCount > 0 && (
          <span className={getLinkChipClasses("neutral")}>+{remainingCount}</span>
        )}
        {missingCount > 0 && (
          <span className={getLinkChipClasses("neutral", "cursor-default opacity-70")}>
            {missingCount} missing part{missingCount === 1 ? "y" : "ies"}
          </span>
        )}
      </div>
    </div>
  );
}
