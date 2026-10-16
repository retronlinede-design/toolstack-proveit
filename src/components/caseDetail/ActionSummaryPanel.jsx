import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { getActionText } from "./actionSummaryHelpers";

export default function ActionSummaryPanel({
  updatedAt,
  currentFocus,
  nextActions = [],
  completedNextActions = [],
  importantReminders,
  criticalDeadlines,
  strategyFocus = [],
  quickActionInput,
  onEdit,
  onCopy,
  onToggleNextActionCompleted,
  onMoveNextAction,
  onRemoveNextAction,
  onQuickActionInputChange,
  onQuickActionKeyDown,
  onAddQuickAction,
}) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const activeActionCount = nextActions.length;
  const topNextAction = getActionText(nextActions[0]) || "No active actions.";
  const indicatorItems = [
    ["Active Actions", activeActionCount],
    ["Completed Actions", completedNextActions.length],
    ["Reminders", importantReminders.length],
    ["Deadlines", criticalDeadlines.length],
  ];
  const announce = (message) => setFeedback(message);

  return (
    <section id="case-action-summary" className="case-file-action-summary mb-6 w-full scroll-mt-4 print:hidden" aria-labelledby="case-briefing-title">
      <p className="sr-only" role="status" aria-live="polite">{feedback}</p>
      <header className="case-file-action-summary-header">
        <div className="case-file-action-summary-title">
          <p>Case-wide operational summary</p>
          <h3 id="case-briefing-title">Case Briefing</h3>
          <span>Manually maintained focus, actions, reminders, and deadlines.</span>
        </div>
        <div className="case-file-action-summary-actions">
          <span className="case-file-action-summary-updated">Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "Never"}</span>
          <button type="button" onClick={() => { onEdit(); announce("Case Briefing editor opened."); }} className="case-file-action-summary-control">Edit</button>
          <button type="button" onClick={() => { onCopy(); announce("Case Briefing copied to the clipboard."); }} className="case-file-action-summary-control">Copy</button>
          <button
            type="button"
            onClick={() => setExpanded((value) => { const next = !value; announce(next ? "Case Briefing expanded." : "Case Briefing collapsed."); return next; })}
            aria-expanded={expanded}
            aria-controls="case-briefing-details"
            className="case-file-action-summary-control is-disclosure"
          >
            {expanded ? "Collapse Briefing" : "Expand Briefing"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </header>

      {!expanded ? (
        <div className="case-file-action-summary-compact">
          <div className="case-file-action-summary-focus">
            <span>Current Focus</span>
            <strong>{currentFocus || "No current focus has been set."}</strong>
          </div>
          <div className="case-file-action-summary-top-action">
            <span>Top Next Action</span>
            <p title={topNextAction}>{topNextAction}</p>
          </div>
          <div className="case-file-action-summary-indicators" aria-label="Case briefing indicators">
            {indicatorItems.map(([label, count]) => <span key={label}><strong>{count}</strong> {label}</span>)}
          </div>
        </div>
      ) : (
        <div id="case-briefing-details" className="case-file-action-summary-details">
          <section className="case-file-action-summary-focus-card">
            <h4>Current Focus</h4>
            <p>{currentFocus || "No current focus set."}</p>
            <div>
              <h4>Strategy Focus</h4>
              {strategyFocus.length > 0 ? <ul>{strategyFocus.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="is-empty">No strategy focus set.</p>}
            </div>
          </section>

          <section className="case-file-action-summary-work">
            <div className="case-file-action-summary-section-heading">
              <h4>Next Actions</h4>
              {activeActionCount > 0 && <span>{activeActionCount} active</span>}
            </div>
            {activeActionCount > 0 ? (
              <ul className="case-file-action-summary-action-list">
                {nextActions.map((action, i) => {
                  const actionText = getActionText(action);
                  return (
                    <li key={`${actionText}-${i}`}>
                      <label>
                        <input type="checkbox" checked={false} onChange={() => { onToggleNextActionCompleted(action, true); announce(`Action ${i + 1} marked complete.`); }} aria-label={`Mark action ${i + 1} complete: ${actionText}`} />
                        <span className="case-file-action-summary-action-number">{i + 1}</span>
                        <span>{i === 0 && <em>Top</em>}{actionText}</span>
                      </label>
                      <div className="case-file-action-summary-row-actions">
                        <button type="button" onClick={() => { onMoveNextAction(i, i - 1); announce(`Action ${i + 1} moved up.`); }} disabled={i === 0} aria-label={`Move action ${i + 1}: ${actionText} up`}>Up</button>
                        <button type="button" onClick={() => { onMoveNextAction(i, i + 1); announce(`Action ${i + 1} moved down.`); }} disabled={i === activeActionCount - 1} aria-label={`Move action ${i + 1}: ${actionText} down`}>Down</button>
                        <button type="button" onClick={() => { onRemoveNextAction(i); announce(`Action ${i + 1} removed.`); }} aria-label={`Remove action ${i + 1}: ${actionText}`} title="Remove action"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="case-file-action-summary-empty">List the next steps to move this case forward.</p>}
            <div className="case-file-action-summary-quick-add">
              <input type="text" placeholder="Add next action and press Enter" value={quickActionInput} onChange={(event) => onQuickActionInputChange(event.target.value)} onKeyDown={(event) => { onQuickActionKeyDown(event); if (event.key === "Enter" && quickActionInput.trim()) announce("Next action added."); }} aria-label="Add next action" />
              <button type="button" onClick={() => { if (!quickActionInput.trim()) return; onAddQuickAction(); announce("Next action added."); }}>Add</button>
            </div>
            {completedNextActions.length > 0 && (
              <details className="case-file-action-summary-completed">
                <summary>Completed Actions ({completedNextActions.length})</summary>
                <ul>{completedNextActions.map((action, i) => {
                  const actionText = getActionText(action);
                  const completedDate = action.completedAt ? new Date(action.completedAt).toLocaleString() : "";
                  return <li key={`${actionText}-completed-${i}`}><label><input type="checkbox" checked onChange={() => { onToggleNextActionCompleted(action, false); announce(`Action ${i + 1} reactivated.`); }} aria-label={`Mark completed action ${i + 1} active: ${actionText}`} /><span>{actionText}</span></label>{completedDate && <time>{completedDate}</time>}</li>;
                })}</ul>
              </details>
            )}
          </section>

          <section className="case-file-action-summary-notes">
            <div><h4>Important Reminders</h4>{importantReminders.length > 0 ? <ul>{importantReminders.map((reminder, i) => <li key={i}>{reminder}</li>)}</ul> : <p className="is-empty">Add anything that must not be forgotten.</p>}</div>
            <div><h4>Critical Deadlines</h4>{criticalDeadlines.length > 0 ? <ul>{criticalDeadlines.map((deadline, i) => <li key={i}>{deadline}</li>)}</ul> : <p className="is-empty">No critical deadlines set.</p>}</div>
          </section>
        </div>
      )}
    </section>
  );
}
