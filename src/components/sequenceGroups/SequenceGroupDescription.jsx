import { useId, useState } from "react";

const COLLAPSED_LENGTH = 280;

export default function SequenceGroupDescription({ description = "" }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const value = typeof description === "string" ? description.trim() : "";
  if (!value) return <p className="text-sm italic text-neutral-500 dark:text-neutral-400">No description added</p>;

  const isLong = value.length > COLLAPSED_LENGTH;
  const visibleValue = isLong && !expanded ? `${value.slice(0, COLLAPSED_LENGTH).trimEnd()}…` : value;
  return (
    <div>
      <p id={contentId} className="whitespace-pre-wrap text-sm leading-6 text-neutral-700 dark:text-neutral-300">{visibleValue}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="mt-2 text-xs font-semibold text-[#7a263a] hover:text-[#681f31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a263a] focus-visible:ring-offset-2 dark:text-[#e5a5b5] dark:hover:text-[#f0becb]"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
