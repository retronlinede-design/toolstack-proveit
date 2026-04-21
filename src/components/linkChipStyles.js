const LINK_CHIP_BASE =
  "rounded-md border px-2 py-0.5 text-xs truncate max-w-[180px]";

const LINK_CHIP_VARIANTS = {
  evidence: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
  incident: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  record: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
};

export function getLinkChipClasses(variant = "neutral", extraClasses = "") {
  const variantClasses = LINK_CHIP_VARIANTS[variant] || LINK_CHIP_VARIANTS.neutral;
  return `${LINK_CHIP_BASE} ${variantClasses} ${extraClasses}`.trim();
}
