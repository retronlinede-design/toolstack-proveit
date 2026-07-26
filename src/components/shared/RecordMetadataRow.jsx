const ROW_CLASSES = "flex min-w-0 flex-wrap items-start gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300";
const ITEM_CLASSES = "flex min-w-0 max-w-full items-start gap-1.5 [overflow-wrap:anywhere]";
const LABEL_CLASSES = "shrink-0 font-semibold text-neutral-800 dark:text-neutral-100";
const VALUE_CLASSES = "min-w-0 whitespace-normal text-neutral-600 [overflow-wrap:anywhere] dark:text-neutral-300";

function isEmptyMetadataValue(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function renderValue(value) {
  if (typeof value === "boolean") return String(value);
  return value;
}

export default function RecordMetadataRow({ items = [], className = "", ...containerProps }) {
  const visibleItems = items.filter((item) => item && !item.hidden && (
    item.render != null || !isEmptyMetadataValue(item.value)
  ));
  if (visibleItems.length === 0) return null;

  return (
    <dl {...containerProps} className={`${ROW_CLASSES} ${className}`.trim()}>
      {visibleItems.map((item) => (
        <div
          key={item.key}
          title={item.title}
          className={`${ITEM_CLASSES} ${item.emphasis ? "font-medium text-neutral-800 dark:text-neutral-100" : ""} ${item.className || ""}`.trim()}
          data-record-metadata-item={item.key}
        >
          {item.icon && <span className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-500" aria-hidden="true">{item.icon}</span>}
          {item.label && <dt className={LABEL_CLASSES}>{item.label}:</dt>}
          <dd className={`${VALUE_CLASSES} ${item.valueClassName || ""}`.trim()}>
            {item.render != null ? item.render : renderValue(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
