import {
  EXECUTIVE_POLISH_SECTION_TITLES,
  buildPolishedContentBlocks,
  parseExecutivePolishSections,
} from "../../report/executiveSummaryPolish.js";

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function formatReportDate(value) {
  return safeText(value) || "No date";
}

function PolishedCardItem({ item, className = "" }) {
  return (
    <div className={`break-inside-avoid rounded-lg border border-neutral-200 bg-white p-3 print:break-inside-avoid ${className}`}>
      {item.label ? <div className="text-sm font-semibold text-neutral-950">{item.label}</div> : null}
      {item.text ? <p className={`${item.label ? "mt-1" : ""} text-sm leading-6 text-neutral-700`}>{item.text}</p> : null}
    </div>
  );
}

export function ExecutivePolishedSection({ text = "", sectionTitle = "", fallback = null }) {
  const cleanText = safeText(text).trim();
  if (!cleanText) return fallback;

  const blocks = buildPolishedContentBlocks(cleanText, sectionTitle);

  return (
    <div className="space-y-4">
      {blocks.map((block, blockIndex) => {
        if (block.type === "paragraph") {
          return (
            <p key={`paragraph-${blockIndex}`} className="text-sm leading-7 text-neutral-700">
              {block.text}
            </p>
          );
        }

        if (block.type === "timeline") {
          return (
            <div key={`timeline-${blockIndex}`} className="break-inside-avoid rounded-xl border border-neutral-200 bg-white p-4 print:break-inside-avoid">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">{block.date}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-800">{block.text}</p>
            </div>
          );
        }

        if (block.type === "card") {
          const toneClass = sectionTitle === "Risks and Concerns" ? "border-amber-200 bg-amber-50" : "";
          return (
            <div key={`card-${blockIndex}`}>
              <PolishedCardItem item={block.item} className={toneClass} />
            </div>
          );
        }

        if (block.type === "list" && sectionTitle === "Recommended Next Steps") {
          return (
            <ol key={`actions-${blockIndex}`} className="space-y-3">
              {block.items.map((item, index) => (
                <li key={`${item.label || item.text}-${index}`} className="break-inside-avoid rounded-xl border border-lime-200 bg-white p-4 print:break-inside-avoid">
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-100 text-xs font-bold text-lime-900">
                      {index + 1}
                    </span>
                    <div>
                      {item.label ? <div className="text-sm font-semibold text-neutral-950">{item.label}</div> : null}
                      <p className={`${item.label ? "mt-1" : ""} text-sm leading-6 text-neutral-800`}>{item.text}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "list" && ["Strongest Evidence", "Risks and Concerns"].includes(sectionTitle)) {
          const toneClass = sectionTitle === "Risks and Concerns" ? "border-amber-200 bg-amber-50" : "";
          return (
            <div key={`cards-${blockIndex}`} className="space-y-3">
              {block.items.map((item, index) => (
                <div key={`${item.label || item.text}-${index}`}>
                  <PolishedCardItem item={item} className={toneClass} />
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={`list-${blockIndex}`}
              className={`space-y-2 text-sm leading-6 text-neutral-700 ${block.ordered ? "list-decimal" : "list-disc"} pl-5`}
            >
              {block.items.map((item, index) => (
                <li key={`${item.label || item.text}-${index}`} className="pl-1">
                  {item.label ? <span className="font-semibold text-neutral-900">{item.label}: </span> : null}
                  {item.text}
                </li>
              ))}
            </ListTag>
          );
        }

        return null;
      })}
    </div>
  );
}

export default function ExecutiveSummaryReportArticle({
  report,
  polishedMarkdown = "",
  className = "",
}) {
  if (!report) return null;

  const hasPolishedNarrative = Boolean(safeText(polishedMarkdown).trim());
  const polishedSections = hasPolishedNarrative ? parseExecutivePolishSections(polishedMarkdown) : {};
  const missingPolishedSections = hasPolishedNarrative
    ? EXECUTIVE_POLISH_SECTION_TITLES.filter((title) => !safeText(polishedSections[title]).trim())
    : [];
  const metricItems = [
    ["Incidents", report.atAGlance.incidentCount],
    ["Evidence", report.atAGlance.evidenceCount],
    ["Milestones", report.atAGlance.milestoneCount],
    ["Open issues", report.atAGlance.openIssueCount],
  ];
  const headlineConcern = report.risksAndConcerns[0]?.message || report.currentPosition.immediateConcerns?.[0] || "No urgent concern has been identified from the current case file.";

  const renderPlainList = (items = [], getText) => (
    items.length === 0 ? (
      <p className="mt-3 text-sm text-neutral-500">None recorded.</p>
    ) : (
      <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-700">
        {items.map((item, index) => (
          <li key={item.id || `${getText(item)}-${index}`} className="rounded-lg border border-neutral-200 bg-white p-3">
            {getText(item)}
          </li>
        ))}
      </ul>
    )
  );

  return (
    <article className={className}>
      <header className="border-b border-neutral-200 pb-7 print:pb-5">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-lime-700">EXECUTIVE SUMMARY</div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-neutral-950 print:text-[22pt]">{report.caseOverview.name || report.title}</h1>
            <div className="mt-3 grid gap-1 text-sm text-neutral-600">
              <div><span className="font-semibold text-neutral-950">Category:</span> {report.caseOverview.category || "-"}</div>
              <div><span className="font-semibold text-neutral-950">Status:</span> {report.caseOverview.status || "-"}</div>
              <div><span className="font-semibold text-neutral-950">Generated:</span> {formatReportDate(report.generatedAt)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-lime-500 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-lime-400/30 print:hidden"
          >
            Print / Save PDF
          </button>
        </div>
        {report.caseOverview.description && (
          <p className="mt-4 text-sm leading-6 text-neutral-700">{report.caseOverview.description}</p>
        )}
      </header>

      {hasPolishedNarrative && (
        <div className="border-b border-neutral-200 py-4 print:hidden">
          <div className="rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm font-semibold text-lime-900">
            Using polished narrative. Missing sections will use deterministic fallback.
            {missingPolishedSections.length > 0 && (
              <span className="mt-1 block text-xs font-medium text-lime-800">
                Missing: {missingPolishedSections.join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      <section className="border-b border-neutral-200 py-7">
        <div className="rounded-2xl border border-lime-200 bg-lime-50 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-lime-800">Current Position</h2>
          {safeText(polishedSections["Current Position"]).trim() ? (
            <div className="mt-3">
              <ExecutivePolishedSection text={polishedSections["Current Position"]} sectionTitle="Current Position" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-xl font-semibold leading-8 text-neutral-950">{report.currentPosition.operationalSummary}</p>
              <p className="mt-3 text-sm leading-6 text-lime-950">{report.currentPosition.whyItMatters}</p>
            </>
          )}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Procedural Position</div>
            <p className="mt-2 text-sm leading-6 text-neutral-700">{report.currentPosition.proceduralPosition}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-800">Immediate Concern</div>
            <p className="mt-2 text-sm leading-6 text-amber-950">{headlineConcern}</p>
          </div>
        </div>
        {report.currentPosition.mainProblems?.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">What matters most now</h3>
            {renderPlainList(report.currentPosition.mainProblems, (item) => item)}
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Case at a Glance</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {metricItems.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
              <div className="mt-1 text-lg font-semibold text-neutral-950">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 border-b border-neutral-200 py-7 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Key Timeline</h2>
          {safeText(polishedSections["Key Timeline"]).trim() ? (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <ExecutivePolishedSection text={polishedSections["Key Timeline"]} sectionTitle="Key Timeline" />
            </div>
          ) : report.keyTimeline.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No dated chronology has been recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {report.keyTimeline.slice(0, 6).map((item) => (
                <div key={`${item.recordType}-${item.id}`} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500">{item.date || "No date"}</span>
                    {item.importanceLabel && (
                      <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-500">{item.importanceLabel}</span>
                    )}
                  </div>
                  <div className="mt-2 font-semibold text-neutral-950">{item.title}</div>
                  {item.summary && <p className="mt-1 text-sm leading-6 text-neutral-700">{item.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Strongest Evidence</h2>
          {safeText(polishedSections["Strongest Evidence"]).trim() ? (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <ExecutivePolishedSection text={polishedSections["Strongest Evidence"]} sectionTitle="Strongest Evidence" />
            </div>
          ) : report.strongestEvidence.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No evidence has been recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {report.strongestEvidence.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="font-semibold text-neutral-950">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">{item.whyItMatters}</p>
                  {item.supports?.length > 0 && (
                    <p className="mt-2 text-xs font-medium text-neutral-500">Supports: {item.supports.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 border-b border-neutral-200 py-7 lg:grid-cols-[0.9fr_1.1fr]">
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Risks and Concerns</h2>
          {safeText(polishedSections["Risks and Concerns"]).trim() ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <ExecutivePolishedSection text={polishedSections["Risks and Concerns"]} sectionTitle="Risks and Concerns" />
            </div>
          ) : report.risksAndConcerns.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No major operational concerns are currently flagged.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {report.risksAndConcerns.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="font-semibold text-amber-950">{item.title || "Concern"}</div>
                  <p className="mt-1 text-sm leading-6 text-amber-900">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">What Should Happen Next</h2>
          {safeText(polishedSections["Recommended Next Steps"]).trim() ? (
            <div className="mt-4 rounded-xl border border-lime-200 bg-lime-50 p-4">
              <ExecutivePolishedSection text={polishedSections["Recommended Next Steps"]} sectionTitle="Recommended Next Steps" />
            </div>
          ) : report.recommendedNextSteps.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No next actions have been recorded yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {report.recommendedNextSteps.slice(0, 7).map((item, index) => (
                <li key={item.id || `${item.text}-${index}`} className={`rounded-xl border p-4 ${index < 3 ? "border-lime-200 bg-lime-50" : "border-neutral-200 bg-white"}`}>
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-neutral-700">{index + 1}</span>
                    <div className="text-sm font-semibold leading-6 text-neutral-900">{item.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="py-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Issue Threads</h2>
        {report.sequenceGroupOverview.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No sequence groups recorded.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {report.sequenceGroupOverview.slice(0, 6).map((group) => (
              <div key={group.name} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="font-semibold text-neutral-950">{group.name}</div>
                <div className="mt-1 text-xs text-neutral-600">
                  {group.totalCount} records across this issue thread.
                </div>
                {group.warnings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {group.warnings.map((warning) => (
                      <span key={warning} className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">{warning}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
