const today = () => new Date().toISOString().slice(0, 10);

function dateLabel(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

function titleCase(value, fallback) {
  const text = String(value || "").trim();
  return text ? text.replaceAll("_", " ") : fallback;
}

function reviewLabel(issue) {
  if (!issue.reviewDate) return "No review date";
  return issue.reviewDate < today() ? `Review overdue · ${dateLabel(issue.reviewDate)}` : `Review ${dateLabel(issue.reviewDate)}`;
}

function OverviewSection({ title, description, children, className = "" }) {
  return (
    <section className={`case-file-overview-section ${className}`}>
      <div className="case-file-overview-section-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function IssueCard({ issue, onOpenIssue }) {
  const recordCounts = Object.entries(issue.counts || {});
  const issueName = issue.displayLabel || issue.name;
  const attentionLabel = issue.warningCount
    ? `Requires attention: ${issue.warningCount} finding${issue.warningCount === 1 ? "" : "s"}.`
    : "No linked findings requiring attention.";
  const accessibleSummary = [
    `Open Issue Manager for ${issueName}.`,
    `Status: ${titleCase(issue.status, "unavailable")}.`,
    `Priority: ${titleCase(issue.priority, "not set")}.`,
    issue.owner ? `Owner: ${issue.owner}.` : "No owner recorded.",
    reviewLabel(issue),
    `${issue.directRecordCount} direct record${issue.directRecordCount === 1 ? "" : "s"}.`,
    attentionLabel,
  ].join(" ");

  return (
    <li>
      <button type="button" onClick={() => onOpenIssue?.(issue.id || issue.name)} className="case-file-overview-issue-card" aria-label={accessibleSummary}>
        <span className="case-file-overview-issue-card-topline">
          <span className="case-file-overview-issue-name">{issueName}</span>
          <span className="case-file-overview-open-label" aria-hidden="true">Open Issue Manager</span>
        </span>
        <span className="case-file-overview-badges" aria-hidden="true">
          <span className="case-file-overview-badge">Status: {titleCase(issue.status, "unavailable")}</span>
          <span className="case-file-overview-badge">Priority: {titleCase(issue.priority, "not set")}</span>
          {issue.warningCount > 0 && <span className="case-file-overview-badge is-attention">Attention: {issue.warningCount}</span>}
        </span>
        {issue.currentPosition && <span className="case-file-overview-issue-position">{issue.currentPosition}</span>}
        {(issue.purpose || issue.description) && (
          <span className="case-file-overview-issue-context">
            {issue.purpose && <span><strong>Purpose:</strong> {issue.purpose}</span>}
            {issue.description && <span>{issue.description}</span>}
          </span>
        )}
        <span className="case-file-overview-issue-meta">
          {issue.owner && <span>Owner: {issue.owner}</span>}
          <span className={issue.reviewDate && issue.reviewDate < today() ? "is-overdue" : ""}>{reviewLabel(issue)}</span>
          {issue.latestActivity && <span>Latest activity {dateLabel(issue.latestActivity)}</span>}
        </span>
        <span className="case-file-overview-counts">
          <span>{issue.directRecordCount} direct record{issue.directRecordCount === 1 ? "" : "s"}</span>
          {recordCounts.map(([name, count]) => <span key={name}>{count} {name}</span>)}
        </span>
        {issue.warningCount > 0 && <span className="case-file-overview-attention-text">{attentionLabel}</span>}
      </button>
    </li>
  );
}

export default function CaseBriefingDashboard({ model, onOpenIssue, onOpenItem, getItemLaunch, onOpenTab, onAddIncident, onAddEvidence, onAddDocument, onOpenFullBriefing }) {
  const { snapshot, currentFocus, issues, attentionItems, immediateActions = model.nextActions || [], scheduledReviews = model.nextActions || [], recentActivity } = model;
  const act = (item) => item ? onOpenItem?.(item) : undefined;
  const launchFor = (item) => getItemLaunch?.(item) || { handled: false, reason: "No direct record available" };
  const directAction = (item, label = "Open") => launchFor(item).handled
    ? <button type="button" className="case-file-overview-button is-compact" onClick={() => act(item)}>{label}</button>
    : <span className="case-file-overview-unavailable">No direct record available</span>;
  const visibleImmediateActions = immediateActions.slice(0, 5);
  const visibleScheduledReviews = scheduledReviews.slice(0, 5);

  return (
    <main className="case-file-overview space-y-5" aria-labelledby="case-briefing-heading">
      <section className="case-file-overview-position" aria-labelledby="case-briefing-heading">
        <div className="case-file-overview-position-header">
          <div className="case-file-overview-position-copy">
            <p className="case-file-overview-eyebrow">Overview</p>
            <h1 id="case-briefing-heading">Case Briefing</h1>
            <p>A factual daily view of this case, its Issues, and recorded next steps.</p>
          </div>
          <button type="button" className="case-file-overview-button" onClick={() => onOpenIssue?.("")}>Open Issue Manager</button>
        </div>
        <div className="case-file-overview-focus">
          <span>Current position</span>
          <strong>{currentFocus.text || "No current focus is recorded in the Action Summary."}</strong>
        </div>
      </section>

      <details className="case-file-overview-guide">
        <summary>Where does this belong?</summary>
        <dl>
          <div><dt>Incident vs Evidence</dt><dd>Incident is what happened; Evidence is material supporting, challenging, or contextualising it.</dd></div>
          <div><dt>Document vs Evidence</dt><dd>Document is the original source or correspondence; Evidence is the assessed significance of source material.</dd></div>
          <div><dt>Strategy vs Action</dt><dd>Strategy is the considered position and approach; an Action is executable work that should happen now.</dd></div>
          <div><dt>To Watch vs Incident</dt><dd>To Watch is an uncertain development or trigger being monitored; an Incident is something that has happened.</dd></div>
        </dl>
      </details>

      {model.isEmptyCase && (
        <section className="case-file-overview-empty-state" aria-labelledby="overview-empty-case-title">
          <h2 id="overview-empty-case-title">Start building this case</h2>
          <p>Add the people involved, record the first Incident, and attach any supporting material.</p>
          <div><button type="button" className="case-file-overview-button" onClick={() => onOpenTab?.("parties")}>Add Party</button><button type="button" className="case-file-overview-button" onClick={onAddIncident}>Add Incident</button><button type="button" className="case-file-overview-button" onClick={onAddEvidence}>Add Evidence</button><button type="button" className="case-file-overview-button" onClick={onAddDocument}>Add Document</button></div>
        </section>
      )}

      <OverviewSection title="Active Issues" description="Issues organise related Incidents, Evidence, and other case records.">
        {issues.length ? <ul className="case-file-overview-issue-grid" aria-label="Active Issues">{issues.map((issue) => <IssueCard key={issue.id || issue.name} issue={issue} onOpenIssue={onOpenIssue} />)}</ul> : <div className="case-file-overview-empty-list"><p>No active Issues are recorded.</p><button type="button" className="case-file-overview-button is-compact" onClick={() => onOpenIssue?.("")}>Open Issue Manager</button></div>}
      </OverviewSection>

      <div className="case-file-overview-operational-grid">
        <OverviewSection title="Immediate Work">
          {immediateActions.length ? <ul className="case-file-overview-list">{visibleImmediateActions.map((item) => <li key={item.id}><div><h3>{item.title}</h3><p>{item.dueDate ? `Due ${dateLabel(item.dueDate)}` : "No due date recorded"}</p></div>{directAction(item, "Edit Action Summary")}</li>)}</ul> : <p className="case-file-overview-empty-list">No active Action Summary items are recorded.</p>}
          <button type="button" className="case-file-overview-button is-compact" onClick={onOpenFullBriefing}>Edit Action Summary</button>
        </OverviewSection>
        <OverviewSection title="Scheduled Reviews">
          {scheduledReviews.length ? <ul className="case-file-overview-list">{visibleScheduledReviews.map((item) => <li key={item.id}><div><h3>{item.title}</h3><p className={item.dueState === "overdue" ? "is-overdue" : ""}>{item.dueState === "overdue" ? `Overdue · ${dateLabel(item.dueDate)}` : item.dueState === "today" ? "Due today" : `Due ${dateLabel(item.dueDate)}`}</p></div>{directAction(item)}</li>)}</ul> : <p className="case-file-overview-empty-list">No dated reviews are recorded.</p>}
        </OverviewSection>
      </div>

      <div className="case-file-overview-support-grid">
        <OverviewSection title="Risks & Gaps" description={`${snapshot.findingCount} deterministic case-quality finding${snapshot.findingCount === 1 ? "" : "s"}; showing up to 7.`}>
          {attentionItems.length ? <ul className="case-file-overview-list">{attentionItems.map((item) => <li key={item.id}><div><span className="case-file-overview-finding-label">{item.severity} · {item.recordType}</span><h3>{item.title}</h3><p>{item.reason}</p></div>{directAction(item)}</li>)}</ul> : <p className="case-file-overview-empty-list">No high-priority case-quality findings are currently detected.</p>}
        </OverviewSection>
        <OverviewSection title="Recent Changes">
          {recentActivity.length ? <ul className="case-file-overview-list">{recentActivity.map((item) => <li key={`${item.recordType}:${item.id}`}><div><span className="case-file-overview-finding-label">{item.typeLabel}</span><h3>{item.title}</h3><p>{item.changeType} {dateLabel(item.timestamp)}{item.issue ? ` · Issue: ${item.issue}` : ""}</p></div>{directAction(item)}</li>)}</ul> : <p className="case-file-overview-empty-list">No changed or created records are available.</p>}
        </OverviewSection>
      </div>

      <details className="case-file-overview-snapshot">
        <summary>Case Snapshot</summary>
        <div className="case-file-overview-snapshot-summary">{snapshot.name} · {snapshot.category} · {snapshot.status} · {snapshot.folder}</div>
        <dl>{[["Active records", snapshot.activeRecordCount], ["Archived", snapshot.archivedRecordCount], ["Issues", snapshot.issueCount], ["Findings", snapshot.findingCount], ["Parties", snapshot.partyCount], ["Record scope", "Excludes Parties"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </details>
    </main>
  );
}
