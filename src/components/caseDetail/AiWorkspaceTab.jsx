import { Briefcase, Download, FileText, Network, Search } from "lucide-react";

const ICONS = { Briefcase, Download, FileText, Network, Search };

/**
 * Presentation-only case tab for the existing deterministic AI handoff tools.
 * Case state, exports, persistence, and GPT update handling remain in CaseDetail.
 */
export default function AiWorkspaceTab({
  workspaceSections,
  activeTaskId,
  activeTask,
  activeToolNeedsIssue,
  activeToolUsesWholeCaseScope,
  activeTaskActionKind,
  activeTaskToolId,
  activeTaskPurpose,
  activeTaskBestGpt,
  activeTaskContains,
  activeTaskDoesNotInclude,
  activeTaskSafety,
  activeTaskWorkflow,
  activeRecommendedGpt,
  activeAlsoSuitableGpts,
  activeExampleQuestions,
  recommendedContent,
  issueOptions,
  issueSelection,
  wholeCaseScopeValue,
  caseSliceRecordIdsText,
  feedback,
  selectedCaseId,
  onSelectTask,
  onIssueSelectionChange,
  onCaseSliceRecordIdsChange,
  onCopyRecommendedGptJson,
  onDownloadSplitReasoningPackage,
  onDownloadCurrentCase,
  onCopyToolJson,
  onCopyToolMarkdown,
  onCopySpecialistPrompt,
  onCopyNarrativePolishPrompt,
  onCopyLinkMap,
  onDownloadProtocolJson,
  onDownloadProtocolMarkdown,
  onOpenGptUpdate,
  onOpenIssueAudit,
}) {
  const disabledForMissingIssue = activeToolNeedsIssue && !issueSelection;

  return (
    <section className="case-file-ai-workspace" aria-labelledby="ai-workspace-heading">
      <header data-ai-workspace-header className="border-b p-4 sm:p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em]">AI command center</div>
        <h2 id="ai-workspace-heading" className="mt-1 text-xl font-semibold">AI Workspace</h2>
        <p className="mt-1 text-sm">
          Choose focused, non-importable GPT work packs, specialist workflows, and Issue-centred AI handoffs.
        </p>
      </header>

      <div className="grid min-h-0 md:grid-cols-[21rem_1fr]">
        <aside data-ai-workspace-navigation className="max-h-72 overflow-y-auto overscroll-contain border-b p-3 md:max-h-none md:border-b-0 md:border-r">
          <div className="space-y-3">
            {workspaceSections.map((section) => {
              const SectionIcon = ICONS[section.icon] || FileText;
              return (
                <section key={section.id} data-ai-workspace-section className="rounded-xl border p-3">
                  <div className="flex items-start gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"><SectionIcon className="h-4 w-4" aria-hidden="true" /></span>
                    <div className="min-w-0"><h3 className="text-xs font-bold uppercase tracking-wider">{section.title}</h3><p className="mt-0.5 text-[11px] leading-4">{section.description}</p></div>
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    {(section.tasks || []).map((task) => (
                      <button key={`${section.id}-${task.id}`} type="button" data-ai-workspace-task aria-current={activeTaskId === task.id ? "page" : undefined} onClick={() => onSelectTask(task)} className="rounded-lg border px-2.5 py-2 text-left transition-colors">
                        <div className="text-xs font-bold">{task.title}</div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4">Uses: {task.technicalTool}</p>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </aside>

        <section data-ai-workspace-details className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {feedback && <div data-ai-workspace-feedback role="status" aria-live="polite" className="rounded-md border p-3 text-sm font-medium">{feedback}</div>}
          <section className="rounded-xl border p-4 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em]">Selected Task</div>
            <h3 className="mt-1 text-2xl font-semibold">{activeTask.title}</h3>
            <div data-ai-workspace-metadata className="mt-4 rounded-xl border p-3 text-xs leading-5">
              <Metadata label="Technical Tool"><p className="mt-1 text-sm font-semibold">{activeTask.technicalTool}</p></Metadata>
              <Metadata label="Purpose"><p className="mt-1">{activeTaskPurpose}</p></Metadata>
              <Metadata label="Use This When"><p className="mt-1">{activeTask.useThisWhen}</p></Metadata>
              <Metadata label="Best GPT"><Chips items={activeTaskBestGpt} /></Metadata>
              <Metadata label="Contains"><Chips items={activeTaskContains} /></Metadata>
              <Metadata label="Does Not Include"><Chips items={activeTaskDoesNotInclude} /></Metadata>
              <Metadata label="Safety"><Chips items={activeTaskSafety} /></Metadata>
            </div>

            {(activeToolNeedsIssue || activeToolUsesWholeCaseScope) && (
              <label className="mt-4 block"><span className="text-xs font-bold uppercase tracking-wider">{activeToolUsesWholeCaseScope ? "Scope" : "Issue"}</span>
                <select value={issueSelection} onChange={(event) => onIssueSelectionChange(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-medium">
                  {activeToolUsesWholeCaseScope && <option value={wholeCaseScopeValue}>Whole Case</option>}
                  {issueOptions.length === 0 && !activeToolUsesWholeCaseScope ? <option value="">No Issues available</option> : issueOptions.map((issue) => <option key={issue.id} value={issue.id}>{issue.label}</option>)}
                </select>
              </label>
            )}

            {activeTaskToolId === "case-slice-pack" && (
              <label className="mt-4 block"><span className="text-xs font-bold uppercase tracking-wider">Selected record IDs</span>
                <textarea value={caseSliceRecordIdsText} onChange={(event) => onCaseSliceRecordIdsChange(event.target.value)} rows={8} placeholder={'{"incidents":["inc-1"],"evidence":["ev-1"],"documents":["doc-1"],"strategy":[],"ledger":[]}\n\nor\nincidents: inc-1, inc-2\nevidence: ev-1'} className="mt-1 w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs leading-5" />
                <p className="mt-2 text-xs leading-5">Use JSON arrays or one line per type: incidents, evidence, documents, strategy, ledger.</p>
              </label>
            )}

            <div data-ai-workspace-guidance className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border p-4"><div className="text-xs font-bold uppercase tracking-wider">Workflow</div><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6">{activeTaskWorkflow.map((step) => <li key={step}>{step}</li>)}</ol></div>
              <div className="rounded-xl border p-4"><div className="text-xs font-bold uppercase tracking-wider">Recommended GPT</div><p className="mt-2 text-sm font-semibold">{activeRecommendedGpt}</p>{activeAlsoSuitableGpts.length > 0 && <Metadata label="Also suitable for"><Chips items={activeAlsoSuitableGpts} /></Metadata>}{recommendedContent}</div>
            </div>
            <div className="mt-4 rounded-xl border p-4"><div className="text-xs font-bold uppercase tracking-wider">Example Questions</div><ul className="mt-2 grid gap-2 text-sm leading-6 sm:grid-cols-2">{activeExampleQuestions.map((question) => <li key={question} className="rounded-lg border px-3 py-2">{question}</li>)}</ul></div>
            <div className="mt-4 text-xs leading-5">This task uses {activeTask.technicalTool}.</div>
            <div data-ai-workspace-actions className="ai-workspace-actions sticky bottom-0 z-10 mt-3 flex flex-wrap gap-2">
              {activeTaskActionKind === "reasoning-snapshot" && <Action onClick={onCopyRecommendedGptJson}>Copy Recommended GPT JSON</Action>}
              {activeTaskActionKind === "split-reasoning-package" && <Action onClick={onDownloadSplitReasoningPackage}>Download ZIP</Action>}
              {activeTaskActionKind === "ai-workspace-snapshot" && <Action onClick={onDownloadCurrentCase}>Download CURRENT_CASE.json</Action>}
              {activeTaskActionKind === "ai-tool" && <><Action disabled={disabledForMissingIssue} onClick={() => onCopyToolJson(activeTaskToolId)}>Copy JSON</Action><Action disabled={disabledForMissingIssue} onClick={() => onCopyToolMarkdown(activeTaskToolId)}>Copy Markdown Prompt</Action></>}
              {activeTaskActionKind === "specialist-prompt" && <Action onClick={() => onCopySpecialistPrompt(activeTaskToolId)}>Copy Specialist Prompt</Action>}
              {activeTaskActionKind === "narrative-polish" && <Action onClick={onCopyNarrativePolishPrompt}>Copy Narrative Polish Prompt</Action>}
              {activeTaskActionKind === "link-map" && <Action onClick={() => onCopyLinkMap?.(selectedCaseId)}>Copy Link Map JSON</Action>}
              {activeTaskActionKind === "protocol-pack" && <><Action onClick={onDownloadProtocolJson}>Download JSON</Action><Action onClick={onDownloadProtocolMarkdown}>Download Markdown</Action></>}
              {activeTaskActionKind === "gpt-update" && onOpenGptUpdate && <Action onClick={onOpenGptUpdate}>Open GPT Update</Action>}
              {activeTaskActionKind === "sequence-audit" && <Action onClick={onOpenIssueAudit}>Open Issue Audit</Action>}
            </div>
          </section>
        </section>
      </div>
    </section>
  );
}

function Metadata({ label, children }) { return <div className="mt-3"><div className="font-bold uppercase tracking-wider">{label}</div>{children}</div>; }
function Chips({ items }) { return <div className="mt-1 flex flex-wrap gap-1">{items.map((item) => <span key={item} className="rounded-md border px-2 py-0.5 font-semibold">{item}</span>)}</div>; }
function Action({ children, ...props }) { return <button type="button" {...props} className="rounded-md border px-3 py-2 text-sm font-bold disabled:cursor-not-allowed">{children}</button>; }
