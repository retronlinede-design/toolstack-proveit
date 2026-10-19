const VARIANT_CLASSES = {
  primary: "border-[#0f766e] bg-[#0f766e] text-white hover:border-[#115e59] hover:bg-[#115e59]",
  secondary: "border-[#475569] bg-[#172554] text-white hover:border-[#475569] hover:bg-[#1e3a5f]",
  neutral: "border-[#475569] bg-[#0f1f35] text-[#e2e8f0] hover:border-[#64748b] hover:bg-[#172554]",
  danger: "border-[#7f1d1d] bg-[#7f1d1d] text-white hover:border-[#991b1b] hover:bg-[#991b1b]",
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
            className={`inline-flex h-11 max-w-full items-center justify-center gap-1.5 whitespace-normal rounded-lg border px-3 text-sm font-semibold leading-4 transition-colors duration-150 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f] sm:h-9 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[resolvedVariant]}`}
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
