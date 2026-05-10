import { getLinkedListLabel } from "./reportArticleHelpers.js";

export function ReportLinkedList({ items = [] }) {
  if (!items.length) return <span className="text-neutral-400">None linked</span>;

  return items.map((item, index) => (
    <span key={`${getLinkedListLabel(item)}-${index}`}>
      {index > 0 ? ", " : ""}
      {getLinkedListLabel(item)}
    </span>
  ));
}

export function ReportTypeBadge({ recordType }) {
  return (
    <span className="inline-flex rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 print:bg-white">
      {recordType}
    </span>
  );
}

export function GlanceGrid({ items = [], columnsClass = "sm:grid-cols-3 lg:grid-cols-6" }) {
  return (
    <div className={`mt-4 grid gap-3 ${columnsClass}`}>
      {items.map(([label, count]) => (
        <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center print:bg-white">
          <div className="text-2xl font-bold text-neutral-950">{count}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
        </div>
      ))}
    </div>
  );
}
