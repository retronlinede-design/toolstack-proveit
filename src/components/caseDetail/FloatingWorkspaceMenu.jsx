import { ArrowUp, Bot, CalendarClock, ChevronDown, ListTree, ScanSearch, Wrench } from "lucide-react";

const toolIcons = {
  "Open Sequence Group Manager": ListTree,
  "Open Sequence Group Audit": ScanSearch,
  "Incident Date Repair Tool": CalendarClock,
};

export default function FloatingWorkspaceMenu({
  visible,
  open,
  toolActions,
  onClose,
  onOpenAiWorkspace,
  onBackToTop,
  onToggleOpen,
}) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-4 z-30 w-[calc(100vw-2rem)] max-w-sm print:hidden sm:bottom-6 sm:right-6 sm:w-80">
      {open && (
        <>
          <button
            type="button"
            aria-label="Close workspace action menu"
            className="fixed inset-0 z-0 cursor-default"
            onClick={onClose}
          />
          <div className="relative z-10 mb-2 overflow-hidden rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
            <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">AI</div>
            <button
              type="button"
              onClick={onOpenAiWorkspace}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
            >
              <Bot className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
              <span>AI Workspace</span>
            </button>

            <div className="my-1 border-t border-neutral-100" />
            <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Investigation</div>
            <div className="grid gap-0.5">
              {toolActions.map((action) => {
                const ToolIcon = toolIcons[action.label] || Wrench;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
                  >
                    <ToolIcon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="my-1 border-t border-neutral-100" />
            <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Navigation</div>
            <button
              type="button"
              onClick={onBackToTop}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1"
            >
              <ArrowUp className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
              <span>Back to Top</span>
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="relative z-10 ml-auto flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-800 shadow-md transition-all hover:border-lime-300 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 active:scale-95"
      >
        <Wrench className="h-4 w-4" aria-hidden="true" />
        <span>Tools</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}
