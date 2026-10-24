import { Briefcase, Download, FileText, Network, Search } from "lucide-react";

const ICONS = { Briefcase, Download, FileText, Network, Search };

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
  // A retained Issue selection is useful when returning to an Issue tool, but
  // must never make a whole-case handoff appear to be Issue-scoped.
  const activeScopeLabel = activeToolNeedsIssue && selectedIssue ? selectedIssue.label : "Entire Case";
  const disabledForMissingIssue = activeToolNeedsIssue && !selectedIssue;
  const issueScopeNotice = activeToolNeedsIssue && !selectedIssue
    ? (issueSelection ? "Issue no longer available. Choose another Issue." : "Choose an Issue before creating an Issue-scoped handoff.")
    : "";
  const selectedCaseQualityReviewMode = caseQualityReviewModes.find((mode) => mode.id === selectedCaseQualityReviewModeId) || caseQualityReviewModes[0];
  const selectedIssueReviewMode = issueReviewModes.find((mode) => mode.id === selectedIssueReviewModeId) || issueReviewModes[0];

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
          <div><dt>Revision</dt><dd>{caseRevision ?? "Unavailable"}</dd></div>
          <div><dt>Scope</dt><dd>{activeScopeLabel}</dd></div>
        </dl>
      </header>

      <div className="case-file-ai-workspace-layout">
        <main data-ai-workspace-primary>
          {feedback && <div data-ai-workspace-feedback role="status" aria-live="polite">{feedback}</div>}
          <section data-ai-workspace-details aria-labelledby="ai-workspace-selected-tool-heading">
            <div data-ai-workspace-selected-tool-header>
              <div><div className="case-file-ai-workspace-label">Selected tool</div><h3 id="ai-workspace-selected-tool-heading">{activeTask.title}</h3><p>{activeTaskPurpose}</p></div>
              <span data-ai-workspace-safety>{activeTaskSafety.join(" · ")}</span>
            </div>

            {activeTaskToolId === "case-slice-pack" && (
              <label className="case-file-ai-workspace-field"><span>Selected record IDs</span>
                <textarea value={caseSliceRecordIdsText} onChange={(event) => onCaseSliceRecordIdsChange(event.target.value)} rows={8} placeholder={'{"incidents":["inc-1"],"evidence":["ev-1"],"documents":["doc-1"],"strategy":[],"ledger":[]}\n\nor\nincidents: inc-1, inc-2\nevidence: ev-1'} />
                <small>Use JSON arrays or one line per type: incidents, evidence, documents, strategy, ledger.</small>
              </label>
            )}

            {issueScopeNotice && <p data-ai-workspace-scope-warning role="status">{issueScopeNotice}</p>}

            {activeTaskActionKind === "case-quality-review" && selectedCaseQualityReviewMode && (
              <section data-ai-workspace-quality-review aria-labelledby="case-quality-review-heading">
                <div className="case-file-ai-workspace-label">Quality check</div>
                <h4 id="case-quality-review-heading">Choose a focused check</h4>
                <div role="group" aria-label="Case Quality Review checks" data-ai-workspace-quality-modes>
                  {caseQualityReviewModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={selectedCaseQualityReviewMode.id === mode.id}
                      onClick={() => onCaseQualityReviewModeChange?.(mode.id)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <p data-ai-workspace-quality-description>{selectedCaseQualityReviewMode.description}</p>
                <p data-ai-workspace-quality-notice>Copy actions prepare this bounded material for external AI review. They do not run embedded AI analysis or change case data.</p>
              </section>
            )}

            {activeTaskActionKind === "issue-review" && selectedIssueReviewMode && (
              <section data-ai-workspace-issue-review aria-labelledby="issue-review-heading">
                <div className="case-file-ai-workspace-label">Issue review</div>
                <h4 id="issue-review-heading">Choose a focused review</h4>
                <div role="group" aria-label="Issue Review modes" data-ai-workspace-issue-review-modes>
                  {issueReviewModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={selectedIssueReviewMode.id === mode.id}
                      onClick={() => onIssueReviewModeChange?.(mode.id)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <p data-ai-workspace-issue-review-description>{selectedIssueReviewMode.description}</p>
                <p data-ai-workspace-issue-review-notice>Copy actions prepare this bounded material for external AI review. They do not run embedded AI analysis or change case data.</p>
              </section>
            )}

            <div data-ai-workspace-actions aria-label="Selected tool actions">
              {activeTaskActionKind === "reasoning-snapshot" && <Action kind="copy" onClick={onCopyRecommendedGptJson}>Copy Recommended GPT JSON</Action>}
              {activeTaskActionKind === "split-reasoning-package" && <Action kind="download" onClick={onDownloadSplitReasoningPackage}>Download ZIP</Action>}
              {activeTaskActionKind === "ai-workspace-snapshot" && <Action kind="download" onClick={onDownloadCurrentCase}>Download CURRENT_CASE.json</Action>}
              {activeTaskActionKind === "ai-tool" && <><Action kind="copy" disabled={disabledForMissingIssue} onClick={() => onCopyToolJson(activeTaskToolId)}>Copy JSON</Action><Action kind="copy" disabled={disabledForMissingIssue} onClick={() => onCopyToolMarkdown(activeTaskToolId)}>Copy Markdown Prompt</Action></>}
              {activeTaskActionKind === "case-quality-review" && <><Action kind="copy" onClick={() => onCopyToolJson(selectedCaseQualityReviewMode.toolId)}>Copy JSON</Action><Action kind="copy" onClick={() => onCopyToolMarkdown(selectedCaseQualityReviewMode.toolId)}>Copy Markdown Prompt</Action></>}
              {activeTaskActionKind === "issue-review" && <><Action kind="copy" disabled={disabledForMissingIssue} onClick={() => onCopyToolJson(selectedIssueReviewMode.toolId)}>Copy JSON</Action><Action kind="copy" disabled={disabledForMissingIssue} onClick={() => onCopyToolMarkdown(selectedIssueReviewMode.toolId)}>Copy Markdown Prompt</Action></>}
              {activeTaskActionKind === "link-map" && <Action kind="copy" onClick={() => onCopyLinkMap?.(caseId)}>Copy Link Map JSON</Action>}
              {activeTaskActionKind === "protocol-pack" && <><Action kind="download" onClick={onDownloadProtocolJson}>Download JSON</Action><Action kind="download" onClick={onDownloadProtocolMarkdown}>Download Markdown</Action></>}
              {activeTaskActionKind === "gpt-update" && onOpenGptUpdate && <Action kind="reviewed-update" onClick={onOpenGptUpdate}>Open GPT Update</Action>}
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

        <aside data-ai-workspace-rail aria-label="AI Workspace context and tools">
          <section data-ai-workspace-context>
            <div className="case-file-ai-workspace-label">Case context</div>
            <dl><div><dt>Case identifier</dt><dd>{caseId || "Unavailable"}</dd></div><div><dt>Active scope</dt><dd>{activeScopeLabel}</dd></div></dl>
            {hasScopeControl && (
              <label className="case-file-ai-workspace-field"><span>Issue scope</span>
                <select value={issueSelection} onChange={(event) => onIssueSelectionChange(event.target.value)}>
                  {issueOptions.length === 0 ? <option value="">No Issues available</option> : issueOptions.map((issue) => <option key={issue.id} value={issue.id}>{issue.label}</option>)}
                </select>
              </label>
            )}
            <p data-ai-workspace-limits>Exports contain only the bounded data defined by each tool. They do not include original attachment binaries and are not importable backups.</p>
          </section>

          <section data-ai-workspace-navigation>
            <div className="case-file-ai-workspace-label">Handoffs &amp; exports</div>
            <nav aria-label="AI handoff tools" className="space-y-3">
              {workspaceSections.map((section) => {
                const SectionIcon = ICONS[section.icon] || FileText;
                const groups = section.groups || [{ id: section.id, title: "", description: "", tasks: section.tasks || [] }];
                const taskGroups = <div className="mt-2 space-y-3">{groups.map((group) => <div key={group.id} data-ai-workspace-task-group>
                  {group.title && <><h4>{group.title}</h4><p>{group.description}</p></>}
                  <div className="mt-2 grid gap-1.5">{(group.tasks || []).map((task) => <button key={`${section.id}-${group.id}-${task.id}`} type="button" data-ai-workspace-task aria-pressed={activeTaskId === task.id} onClick={() => onSelectTask(task)}><span>{task.title}</span><small>{task.technicalTool}</small></button>)}</div>
                </div>)}</div>;
                const heading = <div className="flex items-start gap-2"><span><SectionIcon className="h-4 w-4" aria-hidden="true" /></span><div className="min-w-0"><h3>{section.title}</h3><p>{section.description}</p></div></div>;
                return section.collapsedByDefault
                  ? <details key={section.id} data-ai-workspace-section data-ai-workspace-advanced><summary>{heading}</summary>{taskGroups}</details>
                  : <section key={section.id} data-ai-workspace-section>{heading}{taskGroups}</section>;
              })}
            </nav>
          </section>

          {onOpenGptUpdate && <section data-ai-workspace-reviewed-updates>
            <div className="case-file-ai-workspace-label">Reviewed updates</div>
            <p>Validate and review a GPT Delta before it can change canonical case data.</p>
            <Action kind="reviewed-update" onClick={onOpenGptUpdate}>Open GPT Update</Action>
          </section>}
        </aside>
      </div>
    </section>
  );
}

function Metadata({ label, children }) { return <section><h4>{label}</h4>{children}</section>; }
function Chips({ items }) { return <div className="case-file-ai-workspace-chips">{items.map((item) => <span key={item}>{item}</span>)}</div>; }
function Action({ children, kind, ...props }) { return <button type="button" data-ai-workspace-action={kind} {...props}>{children}</button>; }
