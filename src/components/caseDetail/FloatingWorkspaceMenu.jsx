import { ChevronDown } from "lucide-react";

export default function FloatingWorkspaceMenu({
  visible,
  open,
  activeTab,
  addActions,
  navigationActions,
  toolActions,
  onClose,
  onNavigate,
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
          <div className="relative z-10 mb-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <div className="border-b border-neutral-100 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Add records</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {addActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm font-semibold text-neutral-800 hover:border-lime-300 hover:bg-lime-400/20"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Navigate</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {navigationActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onNavigate(action.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                      activeTab === action.id
                        ? "border-lime-400 bg-lime-400/30 text-neutral-950"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-lime-300 hover:bg-lime-400/20"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onBackToTop}
                  className="col-span-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm font-semibold text-neutral-700 hover:border-lime-300 hover:bg-lime-400/20"
                >
                  Back to top
                </button>
              </div>
            </div>

            <div className="border-t border-neutral-100 p-3">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Tools</div>
              <div className="mt-2 grid gap-2">
                {toolActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm font-semibold text-neutral-700 hover:border-lime-300 hover:bg-lime-400/20"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="relative z-10 ml-auto flex min-h-12 items-center gap-3 rounded-full border-2 border-lime-500 bg-white px-4 py-3 text-sm font-bold text-neutral-950 shadow-xl transition-all hover:bg-lime-400/30 active:scale-95"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-400 text-lg leading-none text-neutral-950">+</span>
        <span>Workspace</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}
