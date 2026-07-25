const VARIANT_CLASSES = {
  primary: "border-[#7a263a] bg-[#7a263a] text-white hover:border-[#681f31] hover:bg-[#681f31] dark:border-[#a94b63] dark:bg-[#a94b63] dark:text-white dark:hover:border-[#bd5d75] dark:hover:bg-[#bd5d75]",
  secondary: "border-[#7a263a]/35 bg-white text-[#7a263a] hover:border-[#7a263a]/55 hover:bg-[#7a263a]/5 dark:border-[#a94b63]/60 dark:bg-neutral-900 dark:text-[#e5a5b5] dark:hover:border-[#bd5d75] dark:hover:bg-[#a94b63]/15",
  neutral: "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-800",
  danger: "border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 dark:border-red-800 dark:bg-neutral-900 dark:text-red-300 dark:hover:border-red-700 dark:hover:bg-red-950/50",
};

const DEFAULT_VARIANT = "neutral";

export default function RecordActions({ actions = [], className = "", ...containerProps }) {
  const visibleActions = actions.filter((action) => action && !action.hidden);
  const containerClassName = className || "flex flex-wrap items-center gap-2";

  return (
    <div {...containerProps} className={containerClassName}>
      {visibleActions.map((action) => {
        const resolvedVariant = Object.hasOwn(VARIANT_CLASSES, action.variant)
          ? action.variant
          : DEFAULT_VARIANT;

        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={Boolean(action.disabled)}
            title={action.title}
            aria-label={action["aria-label"]}
            data-record-action-variant={resolvedVariant}
            className={`inline-flex h-11 max-w-full items-center justify-center gap-1.5 whitespace-normal rounded-lg border px-3 text-sm font-semibold leading-4 transition-colors duration-150 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a263a] focus-visible:ring-offset-2 dark:focus-visible:ring-[#d17a91] dark:focus-visible:ring-offset-neutral-950 sm:h-9 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[resolvedVariant]}`}
          >
            {action.icon && <span className="inline-flex shrink-0 items-center" aria-hidden="true">{action.icon}</span>}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { DEFAULT_VARIANT, VARIANT_CLASSES };
