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
          const toneClass = ["Risks and Concerns", "Risk Assessment"].includes(sectionTitle) ? "border-amber-200 bg-amber-50" : "";
          return (
            <div key={`card-${blockIndex}`}>
              <PolishedCardItem item={block.item} className={toneClass} />
            </div>
          );
        }

        if (block.type === "list" && ["Recommended Next Steps", "Recommended Actions"].includes(sectionTitle)) {
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

        if (block.type === "list" && ["Strongest Evidence", "Risks and Concerns", "Risk Assessment", "Key Findings"].includes(sectionTitle)) {
          const toneClass = ["Risks and Concerns", "Risk Assessment"].includes(sectionTitle) ? "border-amber-200 bg-amber-50" : "";
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
    ["Incidents", report.atAGlance?.incidentCount || 0],
    ["Evidence", report.atAGlance?.evidenceCount || 0],
    ["Milestones", report.atAGlance?.milestoneCount || 0],
    ["Open issues", report.atAGlance?.openIssueCount || 0],
  ];
  const coverPage = report.coverPage || {};
  const executiveSummary = report.executiveSummary || {};
  const keyFindings = report.keyFindings || [];
  const riskAssessment = report.riskAssessment || [];
  const managementAwarenessItems = report.managementAwarenessItems || [];
  const outstandingIssues = report.outstandingIssues || [];
  const recommendedActions = report.recommendedActions || report.recommendedNextSteps || [];
  const appendix = report.appendix || {};

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

  const renderEmpty = (text) => (
    <p className="mt-3 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">{text}</p>
  );

  return (
    <article className={className}>
      <header className="border-b border-neutral-200 pb-7 print:break-after-page print:pb-5">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-lime-700">MANAGEMENT REPORT</div>
        <div className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-500">1. Cover Page</div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-neutral-950 print:text-[22pt]">{coverPage.caseName || report.caseOverview?.name || report.title}</h1>
            <div className="mt-3 grid gap-1 text-sm text-neutral-600">
              <div><span className="font-semibold text-neutral-950">Report:</span> {coverPage.title || report.title}</div>
              <div><span className="font-semibold text-neutral-950">Category:</span> {coverPage.category || report.caseOverview?.category || "-"}</div>
              <div><span className="font-semibold text-neutral-950">Status:</span> {coverPage.status || report.caseOverview?.status || "-"}</div>
              <div><span className="font-semibold text-neutral-950">Generated:</span> {formatReportDate(report.generatedAt)}</div>
              <div><span className="font-semibold text-neutral-950">Length target:</span> {report.estimatedLengthPages || "2-8"} pages</div>
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
        {(coverPage.purpose || report.caseOverview?.description) && (
          <p className="mt-5 max-w-3xl text-sm leading-6 text-neutral-700">{coverPage.purpose || report.caseOverview.description}</p>
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
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">2. Executive Summary</div>
        <div className="rounded-2xl border border-lime-200 bg-lime-50 p-5">
          <h2 className="text-lg font-semibold text-neutral-950">Executive Summary</h2>
          {safeText(polishedSections["Executive Summary"]).trim() ? (
            <div className="mt-3">
              <ExecutivePolishedSection text={polishedSections["Executive Summary"]} sectionTitle="Executive Summary" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-xl font-semibold leading-8 text-neutral-950">{executiveSummary.summary || report.currentPosition?.operationalSummary || "No current operational summary recorded."}</p>
              <p className="mt-3 text-sm leading-6 text-lime-950">{executiveSummary.whyItMatters || report.currentPosition?.whyItMatters || ""}</p>
            </>
          )}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">At a Glance</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {metricItems.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-950">{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-800">Immediate Management Concern</div>
            <p className="mt-2 text-sm leading-6 text-amber-950">{executiveSummary.immediateConcern || "No urgent concern has been identified from the current case file."}</p>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 py-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">3. Key Findings</h2>
        {keyFindings.length === 0 ? renderEmpty("No key findings have been identified yet.") : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="border border-neutral-200 px-3 py-2">Finding</th>
                  <th className="border border-neutral-200 px-3 py-2">Basis</th>
                  <th className="border border-neutral-200 px-3 py-2">Management Meaning</th>
                </tr>
              </thead>
              <tbody>
                {keyFindings.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="border border-neutral-200 px-3 py-2 font-medium text-neutral-950">{item.finding}</td>
                    <td className="border border-neutral-200 px-3 py-2 text-neutral-700">{item.evidence}</td>
                    <td className="border border-neutral-200 px-3 py-2 text-neutral-700">{item.managementMeaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">4. Risk Assessment</h2>
        {riskAssessment.length === 0 ? renderEmpty("No major management risks are currently flagged.") : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {riskAssessment.map((item) => (
              <div key={item.id} className="break-inside-avoid rounded-xl border border-amber-200 bg-amber-50 p-4 print:break-inside-avoid">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">{item.level}</span>
                  <div className="font-semibold text-amber-950">{item.risk}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-900">{item.reason}</p>
                <p className="mt-2 text-xs font-semibold text-amber-950">Response: {item.managementResponse}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">5. Management Awareness Items</h2>
        {managementAwarenessItems.length === 0 ? renderEmpty("No records are currently marked for management awareness. Milestones will appear here when flagged.") : (
          <div className="mt-4 space-y-3">
            {managementAwarenessItems.map((item) => (
              <div key={`${item.recordType}-${item.id}`} className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">{item.recordType}</span>
                  <span className="text-xs font-bold text-neutral-500">{item.date || "No date"}</span>
                </div>
                <div className="mt-2 font-semibold text-neutral-950">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-neutral-700">{item.reason} {item.summary}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">6. Outstanding Issues</h2>
        {outstandingIssues.length === 0 ? renderEmpty("No outstanding issues are currently flagged.") : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="border border-neutral-200 px-3 py-2">Issue</th>
                  <th className="border border-neutral-200 px-3 py-2">Owner</th>
                  <th className="border border-neutral-200 px-3 py-2">Status</th>
                  <th className="border border-neutral-200 px-3 py-2">Next Step</th>
                </tr>
              </thead>
              <tbody>
                {outstandingIssues.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="border border-neutral-200 px-3 py-2 font-medium text-neutral-950">{item.issue}</td>
                    <td className="border border-neutral-200 px-3 py-2 text-neutral-700">{item.owner}</td>
                    <td className="border border-neutral-200 px-3 py-2 text-neutral-700">{item.status}</td>
                    <td className="border border-neutral-200 px-3 py-2 text-neutral-700">{item.nextStep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">7. Recommended Actions</h2>
        {safeText(polishedSections["Recommended Actions"]).trim() ? (
          <div className="mt-4 rounded-xl border border-lime-200 bg-lime-50 p-4">
            <ExecutivePolishedSection text={polishedSections["Recommended Actions"]} sectionTitle="Recommended Actions" />
          </div>
        ) : recommendedActions.length === 0 ? renderEmpty("No recommended actions have been recorded yet.") : (
          <ol className="mt-4 space-y-3">
            {recommendedActions.slice(0, 7).map((item, index) => (
              <li key={item.id || `${item.text}-${index}`} className={`break-inside-avoid rounded-xl border p-4 print:break-inside-avoid ${index < 3 ? "border-lime-200 bg-lime-50" : "border-neutral-200 bg-white"}`}>
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-neutral-700">{index + 1}</span>
                  <div>
                    <div className="text-sm font-semibold leading-6 text-neutral-900">{item.text}</div>
                    {item.priority && <div className="mt-1 text-xs font-medium uppercase tracking-wider text-neutral-500">{item.priority} priority</div>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="py-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">8. Appendix: Brief Chronology and Evidence Summary</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Brief Chronology</h3>
            {(appendix.chronology || []).length === 0 ? renderEmpty("No dated chronology has been recorded yet.") : (
              <div className="mt-3 space-y-2">
                {appendix.chronology.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-neutral-500">
                      <span>{item.date || "No date"}</span>
                      <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 uppercase">{item.type}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-neutral-950">{item.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Evidence Summary</h3>
            {(appendix.evidenceSummary || []).length === 0 ? renderEmpty("No evidence summary is available yet.") : (
              <div className="mt-3 space-y-2">
                {appendix.evidenceSummary.map((item) => (
                  <div key={item.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="text-sm font-semibold text-neutral-950">{item.title}</div>
                    <p className="mt-1 text-xs leading-5 text-neutral-600">{item.note}</p>
                    {item.supports?.length > 0 && <p className="mt-1 text-xs font-medium text-neutral-500">Supports: {item.supports.join(", ")}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </article>
  );
}
