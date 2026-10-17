import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";

const WIDTH_CLASSES = {
  compact: "max-w-lg",
  standard: "max-w-2xl",
  wide: "max-w-4xl",
  workspace: "max-w-6xl",
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Presentation-only frame; callers retain form state and dismissal policy. */
export default function DialogShell({
  title,
  description = "",
  children,
  footer = null,
  width = "standard",
  onRequestClose,
  dismissOnEscape = true,
  dismissOnBackdrop = false,
  initialFocusRef = null,
  statusMessage = "",
  className = "",
  layer = "default",
  suspendFocusManagement = false,
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const requestCloseRef = useRef(onRequestClose);
  const focusManagementSuspendedRef = useRef(suspendFocusManagement);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    requestCloseRef.current = onRequestClose;
  }, [onRequestClose]);

  // A parent dialog can yield keyboard ownership to a child dialog without
  // restoring focus outside the active dialog stack.
  useLayoutEffect(() => {
    focusManagementSuspendedRef.current = suspendFocusManagement;
  }, [suspendFocusManagement]);

  useEffect(() => {
    if (suspendFocusManagement) return undefined;
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const animationFrame = requestAnimationFrame(() => {
      const preferred = initialFocusRef?.current;
      const fallback = dialog?.querySelector(FOCUSABLE_SELECTOR);
      (preferred || fallback || dialog)?.focus?.();
    });
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && dismissOnEscape) {
        event.preventDefault();
        requestCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (!focusManagementSuspendedRef.current) previousFocusRef.current?.focus?.();
    };
  }, [dismissOnEscape, initialFocusRef, suspendFocusManagement]);

  const handleBackdropMouseDown = (event) => {
    if (dismissOnBackdrop && event.target === event.currentTarget) requestCloseRef.current?.();
  };

  return (
    <div className={`proveit-dialog-overlay fixed inset-0 ${layer === "nested" ? "z-[70]" : layer === "manager" ? "z-[50]" : "z-[60]"} flex items-center justify-center bg-slate-950/70 p-2 sm:p-4`} onMouseDown={handleBackdropMouseDown}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={`proveit-dialog-shell flex max-h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl outline-none sm:max-h-[calc(100vh-2rem)] ${WIDTH_CLASSES[width] || WIDTH_CLASSES.standard} ${className}`}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-700/80 bg-slate-900/90 px-4 py-3 sm:px-5">
          <div className="min-w-0"><h2 id={titleId} className="text-base font-semibold tracking-tight text-slate-50 sm:text-lg">{title}</h2>{description ? <p id={descriptionId} className="mt-1 text-sm leading-5 text-slate-300">{description}</p> : null}</div>
          <button type="button" onClick={() => requestCloseRef.current?.()} className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" aria-label={`Close ${title}`}><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="proveit-dialog-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {statusMessage ? <p className="mb-3 rounded-lg border border-teal-800/80 bg-teal-950/60 px-3 py-2 text-sm text-teal-100" role="status" aria-live="polite">{statusMessage}</p> : null}
          {children}
        </div>
        {footer ? <footer className="proveit-dialog-footer shrink-0 border-t border-slate-700/80 bg-slate-950/95 px-4 py-3 sm:px-5">{footer}</footer> : null}
      </section>
    </div>
  );
}
