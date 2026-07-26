const VARIANT_CLASSES = {
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700",
  linked: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/60",
  attachment: "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800",
  party: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-900/60",
  sequence: "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/60",
  missing: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/60",
};
const DEFAULT_VARIANT = "neutral";
const ITEM_CLASSES = "inline-flex min-w-0 max-w-full items-center gap-1.5 whitespace-normal rounded-md border px-2 py-1.5 text-xs font-medium leading-4 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a263a] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-[#d17a91] dark:focus-visible:ring-offset-neutral-950";

function RelationshipItem({ item, groupItemClassName = "" }) {
  if (!item || item.hidden) return null;
  if (item.render != null) return item.render;
  const variant = Object.hasOwn(VARIANT_CLASSES, item.variant) ? item.variant : DEFAULT_VARIANT;
  const className = `${ITEM_CLASSES} ${VARIANT_CLASSES[variant]} ${groupItemClassName} ${item.className || ""}`.trim();
  const content = <>{item.icon && <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{item.icon}</span>}<span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>{item.count != null && <span className="font-semibold">{item.count}</span>}</>;
  const common = { title: item.title, className, "data-record-link-variant": variant };
  if (item.href && !item.disabled) return <a {...common} href={item.href} onClick={item.onClick}>{content}</a>;
  if (item.onClick) return <button {...common} type="button" onClick={item.onClick} disabled={Boolean(item.disabled)}>{content}</button>;
  return <span {...common} aria-disabled={item.disabled || undefined}>{content}</span>;
}

function RelationshipGroup({ group }) {
  if (!group || group.hidden) return null;
  if (group.render != null) return <div className={group.className || ""} data-record-links-group={group.key}>{group.render}</div>;
  const items = (Array.isArray(group.items) ? group.items : []).filter((item) => item && !item.hidden);
  if (items.length === 0 && !group.emptyLabel) return null;
  const stacked = group.layout === "stacked";
  return <section className={`${stacked ? "block" : "flex flex-wrap items-start"} min-w-0 gap-x-3 gap-y-2 ${group.className || ""}`.trim()} data-record-links-group={group.key}>
    {(group.label || group.icon) && <div className="flex min-h-7 shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">{group.icon && <span className="inline-flex h-4 w-4 items-center justify-center text-neutral-400 dark:text-neutral-500" aria-hidden="true">{group.icon}</span>}{group.label && <span>{group.label}</span>}</div>}
    <div className={`flex min-w-0 flex-1 flex-wrap gap-1.5 ${stacked && (group.label || group.icon) ? "mt-1.5" : ""}`.trim()}>
      {items.length ? items.map((item) => <RelationshipItem key={item.key} item={item} groupItemClassName={group.itemClassName} />) : <span className="text-xs text-neutral-500 dark:text-neutral-400">{group.emptyLabel}</span>}
    </div>
  </section>;
}

export default function RecordLinksRow({ groups = [], className = "", ...containerProps }) {
  const visibleGroups = groups.filter((group) => group && !group.hidden && (group.render != null || (Array.isArray(group.items) && group.items.some((item) => item && !item.hidden)) || group.emptyLabel));
  if (visibleGroups.length === 0) return null;
  return <div {...containerProps} className={`flex min-w-0 flex-col gap-2 ${className}`.trim()}>{visibleGroups.map((group) => <RelationshipGroup key={group.key} group={group} />)}</div>;
}

export { DEFAULT_VARIANT, VARIANT_CLASSES };
