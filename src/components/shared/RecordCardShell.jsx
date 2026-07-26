const VARIANT_CLASSES = {
  default: "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
  milestone: "border-amber-300 border-l-4 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/25",
  new: "border-lime-400 bg-lime-50/40 dark:border-lime-700 dark:bg-lime-950/20",
};
const DEFAULT_VARIANT = "default";

export default function RecordCardShell({
  title,
  subtitle,
  leading,
  badges,
  actions,
  metadata,
  links,
  footer,
  selected = false,
  expanded = false,
  headingLevel = 3,
  variant = DEFAULT_VARIANT,
  className = "",
  children,
  ...articleProps
}) {
  const Heading = headingLevel === 4 ? "h4" : "h3";
  const resolvedVariant = Object.hasOwn(VARIANT_CLASSES, variant) ? variant : DEFAULT_VARIANT;
  return (
    <article
      {...articleProps}
      data-record-card-shell="true"
      data-record-card-variant={resolvedVariant}
      data-selected={selected ? "true" : "false"}
      className={`relative min-w-0 rounded-xl border p-4 shadow-sm transition-[border-color,box-shadow,background-color] duration-150 hover:border-neutral-300 hover:shadow-md dark:hover:border-neutral-600 ${selected ? "border-[#7a263a] ring-2 ring-[#7a263a]/20 dark:border-[#d17a91] dark:ring-[#d17a91]/25" : VARIANT_CLASSES[resolvedVariant]} ${className}`.trim()}
    >
      {selected && <span className="absolute inset-y-3 left-0 w-1 rounded-r bg-[#7a263a] dark:bg-[#d17a91]" aria-hidden="true" />}
      {selected && <span className="sr-only">Selected record</span>}
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {leading && <div className="shrink-0">{leading}</div>}
          <div className="min-w-0 flex-1">
            <Heading className="min-w-0 break-words text-lg font-semibold leading-snug text-neutral-950 dark:text-neutral-100">{title}</Heading>
            {subtitle && <div className="mt-1 min-w-0 break-words text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</div>}
            {badges && <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">{badges}</div>}
          </div>
        </div>
        {actions && <div className="min-w-0 shrink-0 sm:max-w-[55%]">{actions}</div>}
      </header>
      {metadata && <div className="mt-3 min-w-0">{metadata}</div>}
      {links && <div className="mt-3 min-w-0">{links}</div>}
      {children && <div className={`min-w-0 ${expanded ? "mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700" : "mt-4"}`}>{children}</div>}
      {footer && <footer className="mt-4 min-w-0 border-t border-neutral-200 pt-3 dark:border-neutral-700">{footer}</footer>}
    </article>
  );
}

export { DEFAULT_VARIANT, VARIANT_CLASSES };
