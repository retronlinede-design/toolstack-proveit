const VARIANT_CLASSES = {
  type: "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200",
  "status-neutral": "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200",
  "status-positive": "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  "status-warning": "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  "status-critical": "border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200",
  "verification-verified": "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  "verification-partial": "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  "verification-unverified": "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200",
  "priority-low": "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  "priority-medium": "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  "priority-high": "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  "priority-critical": "border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200",
  milestone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  new: "border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-700 dark:bg-lime-950/60 dark:text-lime-200",
  restricted: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
};

const DEFAULT_VARIANT = "status-neutral";

export default function RecordBadge({
  variant = DEFAULT_VARIANT,
  className = "",
  leading,
  accessibleLabel,
  children,
  ...spanProps
}) {
  const resolvedVariant = Object.hasOwn(VARIANT_CLASSES, variant) ? variant : DEFAULT_VARIANT;

  return (
    <span
      {...spanProps}
      aria-label={accessibleLabel || spanProps["aria-label"]}
      data-record-badge-variant={resolvedVariant}
      className={`inline-flex max-w-full items-center gap-1.5 whitespace-normal rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-4 [overflow-wrap:anywhere] ${VARIANT_CLASSES[resolvedVariant]} ${className}`.trim()}
    >
      {leading && <span className="inline-flex shrink-0 items-center" aria-hidden="true">{leading}</span>}
      {children}
    </span>
  );
}

export { DEFAULT_VARIANT, VARIANT_CLASSES };
