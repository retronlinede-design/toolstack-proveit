import { getLinkChipClasses } from "./linkChipStyles";

export default function LinkedChip({
  variant = "neutral",
  titleText,
  onClick,
  className = "",
  type = "button",
  leading,
  children,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={titleText}
      className={getLinkChipClasses(
        variant,
        `cursor-pointer transition-[colors,box-shadow,transform] hover:shadow-sm hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1 active:translate-y-0 ${className}`,
      )}
    >
      {leading}
      <span className="truncate max-w-[180px]">{children}</span>
    </button>
  );
}
