/** Presentation-only tab: CaseDetail retains all state, exports, and persistence. */
export default function AiWorkspaceTab({
  workspaceSections, activeTaskId, activeTask, activeToolNeedsIssue,
  activeTaskActionKind, activeTaskToolId, activeTaskPurpose, activeTaskBestGpt, activeTaskContains,
  activeTaskDoesNotInclude, activeTaskSafety, activeTaskWorkflow, activeRecommendedGpt,
  activeAlsoSuitableGpts, activeExampleQuestions, issueOptions, issueSelection,
  caseQualityReviewModes = [], selectedCaseQualityReviewModeId, onCaseQualityReviewModeChange,
  issueReviewModes = [], selectedIssueReviewModeId, onIssueReviewModeChange,
  caseName, caseId, caseRevision, caseSliceRecordIdsText, feedback, onSelectTask, onIssueSelectionChange,
  onCaseSliceRecordIdsChange, onCopyRecommendedGptJson, onDownloadSplitReasoningPackage,
  onDownloadCurrentCase, onCopyToolJson, onCopyToolMarkdown, onCopyLinkMap, onDownloadProtocolJson, onDownloadProtocolMarkdown,
  onOpenGptUpdate,
}) {
  const selectedIssue = issueOptions.find((issue) => issue.id === issueSelection);
  const hasScopeControl = activeToolNeedsIssue;
  const activeScopeLabel = activeToolNeedsIssue && selectedIssue ? selectedIssue.label : "Entire Case";
  const disabledForMissingIssue = activeToolNeedsIssue && !selectedIssue;
  const issueScopeNotice = activeToolNeedsIssue && !selectedIssue
    ? (issueSelection ? "Issue no longer available. Choose another Issue." : "Choose an Issue before creating an Issue-scoped handoff.")
    : "";
  const selectedCaseQualityReviewMode = caseQualityReviewModes.find((mode) => mode.id === selectedCaseQualityReviewModeId) || caseQualityReviewModes[0];
  const selectedIssueReviewMode = issueReviewModes.find((mode) => mode.id === selectedIssueReviewModeId) || issueReviewModes[0];
  const sectionById = new Map(workspaceSections.map((section) => [section.id, section]));
  const investigationGroups = sectionById.get("investigation-review")?.groups || [];
  const navigationGroups = [
    { id: "case-context", label: "Case Context", tasks: sectionById.get("share-case-context")?.tasks || [] },
    { id: "issue-review", label: "Issue Review", tasks: investigationGroups.find((group) => group.id === "issue-review")?.tasks || [] },
    { id: "case-quality", label: "Case Quality", tasks: investigationGroups.find((group) => group.id === "case-quality-review")?.tasks || [] },
    { id: "advanced", label: "Advanced", tasks: sectionById.get("advanced-ai-tools")?.groups?.flatMap((group) => group.tasks || []) || [], advanced: true },
  ];

  return (
    <section className="case-file-ai-workspace" aria-labelledby="ai-workspace-heading">
      <header data-ai-workspace-header>
        <div className="min-w-0">
          <div data-ai-workspace-eyebrow>Case-specific AI workspace</div>
          <h2 id="ai-workspace-heading">AI Workspace</h2>
          <p>Prepare bounded external AI handoffs and reviewed updates. ProveIt does not run an embedded AI conversation here yet.</p>
        </div>
        <dl data-ai-workspace-header-context>
          <div><dt>Case</dt><dd>{caseName || "Unnamed case"}</dd></div>
          <div><dt>Case ID</dt><dd>{caseId || "Unavailable"}</dd></div>
          <div><dt>Revision</dt><dd>{caseRevision ?? "Unavailable"}</dd></div>
          <div><dt>Scope</dt><dd>{activeScopeLabel}</dd></div>
        </dl>
      </header>

      <nav data-ai-workspace-tool-navigation aria-label="AI Workspace tools">
        {navigationGroups.map((group) => {
          const groupIsActive = group.tasks.some((task) => task.id === activeTaskId);
          const taskButtons = <div data-ai-workspace-tool-list>{group.tasks.map((task) => <button key={task.id} type="button" data-ai-workspace-task aria-pressed={activeTaskId === task.id} onClick={() => onSelectTask(task)}><span>{task.title}</span><small>{task.technicalTool}</small></button>)}</div>;
          return group.advanced
            ? <details key={group.id} data-ai-workspace-advanced open={groupIsActive}><summary>{group.label}</summary>{taskButtons}</details>
            : <section key={group.id} data-ai-workspace-tool-category data-active={groupIsActive ? "true" : "false"}><h3>{group.label}</h3>{taskButtons}</section>;
        })}
      </nav>

      {onOpenGptUpdate && <section data-ai-workspace-reviewed-updates>
        <div><div className="case-file-ai-workspace-label">Reviewed updates</div><p>Validate and review a GPT Delta before it can change canonical case data.</p></div>
        <Action kind="reviewed-update" onClick={onOpenGptUpdate}>Open GPT Update</Action>
      </section>}

      <main data-ai-workspace-primary>
        {feedback && <div data-ai-workspace-feedback role="status" aria-live="polite">{feedback}</div>}
        <section data-ai-workspace-details aria-labelledby="ai-workspace-selected-tool-heading">
          <div data-ai-workspace-selected-tool-header>
            <div><div className="case-file-ai-workspace-label">Selected tool</div><h3 id="ai-workspace-selected-tool-heading">{activeTask.title}</h3><p>{activeTaskPurpose}</p></div>
            <span data-ai-workspace-safety>{activeTaskSafety.join(" · ")}</span>
          </div>

          {hasScopeControl && <label className="case-file-ai-workspace-field"><span>Issue scope</span>
            <select value={issueSelection} onChange={(event) => onIssueSelectionChange(event.target.value)}>
              {issueOptions.length === 0 ? <option value="">No Issues available</option> : issueOptions.map((issue) => <option key={issue.id} value={issue.id}>{issue.label}</option>)}
            </select>
            <small>The selected Issue uses its stable reference and current name. Whole-case tools retain this choice without using it.</small>
          </label>}

          {activeTaskToolId === "case-slice-pack" && <label className="case-file-ai-workspace-field"><span>Selected record IDs</span>
            <textarea value={caseSliceRecordIdsText} onChange={(event) => onCaseSliceRecordIdsChange(event.target.value)} rows={8} placeholder={'{"incidents":["inc-1"],"evidence":["ev-1"],"documents":["doc-1"],"strategy":[],"ledger":[]}\n\nor\nincidents: inc-1, inc-2\nevidence: ev-1'} />
            <small>Use JSON arrays or one line per type: incidents, evidence, documents, strategy, ledger.</small>
          </label>}

          {issueScopeNotice && <p data-ai-workspace-scope-warning role="status">{issueScopeNotice}</p>}

          {activeTaskActionKind === "case-quality-review" && selectedCaseQualityReviewMode && <ReviewModeSection type="quality" title="Quality check" heading="Choose a focused check" modes={caseQualityReviewModes} selectedMode={selectedCaseQualityReviewMode} onChange={onCaseQualityReviewModeChange} label="Case Quality Review checks" />}
          {activeTaskActionKind === "issue-review" && selectedIssueReviewMode && <ReviewModeSection type="issue-review" title="Issue review" heading="Choose a focused review" modes={issueReviewModes} selectedMode={selectedIssueReviewMode} onChange={onIssueReviewModeChange} label="Issue Review modes" />}

          <div data-ai-workspace-actions aria-label="Selected tool actions">
            {activeTaskActionKind === "reasoning-snapshot" && <Action kind="copy" onClick={onCopyRecommendedGptJson}>Copy Recommended GPT JSON</Action>}
            {activeTaskActionKind === "split-reasoning-package" && <Action kind="download" onClick={onDownloadSplitReasoningPackage}>Download ZIP</Action>}
            {activeTaskActionKind === "ai-workspace-snapshot" && <Action kind="download" onClick={onDownloadCurrentCase}>Download CURRENT_CASE.json</Action>}
            {activeTaskActionKind === "ai-tool" && <><Action kind="copy" disabled={disabledForMissingIssue} onClick={() => onCopyToolJson(activeTaskToolId)}>Copy JSON</Action><Action kind="copy" disabled={disabledForMissingIssue} onClick={() => onCopyToolMarkdown(activeTaskToolId)}>Copy Markdown Prompt</Action></>}
            {activeTaskActionKind === "case-quality-review" && <><Action kind="copy" onClick={() => onCopyToolJson(selectedCaseQualityReviewMode.toolId)}>Copy JSON</Action><Action kind="copy" onClick={() => onCopyToolMarkdown(selectedCaseQualityReviewMode.toolId)}>Copy Markdown Prompt</Action></>}
            {activeTaskActionKind === "issue-review" && <><Action kind="copy" disabled={disabledForMissingIssue} onClick={() => onCopyToolJson(selectedIssueReviewMode.toolId)}>Copy JSON</Action><Action kind="copy" disabled={disabledForMissingIssue} onClick={() => onCopyToolMarkdown(selectedIssueReviewMode.toolId)}>Copy Markdown Prompt</Action></>}
            {activeTaskActionKind === "link-map" && <Action kind="copy" onClick={() => onCopyLinkMap?.(caseId)}>Copy Link Map JSON</Action>}
            {activeTaskActionKind === "protocol-pack" && <><Action kind="download" onClick={onDownloadProtocolJson}>Download JSON</Action><Action kind="download" onClick={onDownloadProtocolMarkdown}>Download Markdown</Action></>}
          </div>

          <details data-ai-workspace-task-details>
            <summary>Task details and guidance</summary>
            <div className="case-file-ai-workspace-detail-grid">
              <Metadata label="Technical tool"><p>{activeTask.technicalTool}</p></Metadata>
              <Metadata label="Use this when"><p>{activeTask.useThisWhen}</p></Metadata>
              <Metadata label="Best suited to"><Chips items={activeTaskBestGpt} /></Metadata>
              <Metadata label="Contains"><Chips items={activeTaskContains} /></Metadata>
              <Metadata label="Does not include"><Chips items={activeTaskDoesNotInclude} /></Metadata>
            </div>
            {activeTaskWorkflow.length > 0 && <Metadata label="Workflow"><ol>{activeTaskWorkflow.map((step) => <li key={step}>{step}</li>)}</ol></Metadata>}
            <Metadata label="Recommended assistant"><p>{activeRecommendedGpt}</p>{activeAlsoSuitableGpts.length > 0 && <Chips items={activeAlsoSuitableGpts} />}</Metadata>
            {activeExampleQuestions.length > 0 && <Metadata label="Example questions"><ul>{activeExampleQuestions.map((question) => <li key={question}>{question}</li>)}</ul></Metadata>}
          </details>
        </section>
      </main>
    </section>
  );
}

function ReviewModeSection({ type, title, heading, modes, selectedMode, onChange, label }) {
  return <section data-ai-workspace-review={type} aria-labelledby={`${type}-review-heading`}>
    <div className="case-file-ai-workspace-label">{title}</div>
    <h4 id={`${type}-review-heading`}>{heading}</h4>
    <div role="group" aria-label={label} data-ai-workspace-review-modes={type}>{modes.map((mode) => <button key={mode.id} type="button" aria-pressed={selectedMode.id === mode.id} onClick={() => onChange?.(mode.id)}>{mode.label}</button>)}</div>
    <p data-ai-workspace-review-description>{selectedMode.description}</p>
    <p data-ai-workspace-review-notice>Copy actions prepare this bounded material for external AI review. They do not run embedded AI analysis or change case data.</p>
  </section>;
}

function Metadata({ label, children }) { return <section><h4>{label}</h4>{children}</section>; }
function Chips({ items }) { return <div className="case-file-ai-workspace-chips">{items.map((item) => <span key={item}>{item}</span>)}</div>; }
function Action({ children, kind, ...props }) { return <button type="button" data-ai-workspace-action={kind} {...props}>{children}</button>; }
