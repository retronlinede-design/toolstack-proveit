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
          const toneClass = ["Risks and Concerns", "Risk Assessment", "Risk Snapshot"].includes(sectionTitle) ? "border-amber-200 bg-amber-50" : "";
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

        if (block.type === "list" && ["Strongest Evidence", "Risks and Concerns", "Risk Assessment", "Risk Snapshot", "Key Findings"].includes(sectionTitle)) {
          const toneClass = ["Risks and Concerns", "Risk Assessment", "Risk Snapshot"].includes(sectionTitle) ? "border-amber-200 bg-amber-50" : "";
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
  const coverPage = report.coverPage || {};
  const executiveSummary = report.executiveSummary || {};
  const keyFindings = report.keyFindings || [];
  const riskSnapshot = report.riskSnapshot || [];
  const recommendedActions = report.recommendedActions || report.recommendedNextSteps || [];
  const appendixSummary = report.supportingAppendixSummary || {};
  const chronologyPreview = (report.appendix?.chronology || []).slice(0, 5);

  const renderEmpty = (text) => (
    <p className="mt-3 text-sm text-neutral-500">{text}</p>
  );

  return (
    <article className={className}>
      <header className="border-b border-neutral-200 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-lime-700">Management Report</div>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-neutral-950 print:text-[22pt]">{coverPage.caseName || report.caseOverview?.name || "Not specified"}</h1>
            <div className="mt-4 grid gap-1 text-sm text-neutral-600">
              <div><span className="font-semibold text-neutral-950">Scope:</span> Whole case</div>
              <div><span className="font-semibold text-neutral-950">Status:</span> {coverPage.status || report.caseOverview?.status || "Not specified"}</div>
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

      <section className="border-b border-neutral-200 py-8">
        <h2 className="text-base font-semibold text-neutral-950">Executive Summary</h2>
        <div className="mt-3 max-w-3xl">
          {safeText(polishedSections["Executive Summary"]).trim() ? (
            <ExecutivePolishedSection text={polishedSections["Executive Summary"]} sectionTitle="Executive Summary" />
          ) : (
            <p className="text-sm leading-7 text-neutral-800">{executiveSummary.summary || "Not specified"}</p>
          )}
        </div>
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-base font-semibold text-neutral-950">Management Question</h2>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">What management needs to decide or review</div>
          {safeText(polishedSections["Management Question"]).trim() ? (
            <div className="mt-2 text-sm leading-6 text-neutral-800">
              <ExecutivePolishedSection text={polishedSections["Management Question"]} sectionTitle="Management Question" />
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-neutral-800">{report.managementQuestion || "Not specified"}</p>
          )}
        </div>
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-base font-semibold text-neutral-950">Key Findings</h2>
        {keyFindings.length === 0 ? renderEmpty("Not specified") : (
          <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-800">
            {keyFindings.slice(0, 5).map((item, index) => (
              <li key={item.id || index}>{item.text || item.finding || item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-base font-semibold text-neutral-950">Risk Snapshot</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full max-w-2xl border-collapse text-left text-sm">
            <tbody>
              {riskSnapshot.map((item) => (
                <tr key={item.label}>
                  <th className="w-1/2 border border-neutral-200 bg-neutral-50 px-3 py-2 font-semibold text-neutral-800">{item.label}</th>
                  <td className="border border-neutral-200 px-3 py-2 text-neutral-800">{item.value || "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-base font-semibold text-neutral-950">Recommended Actions</h2>
        {safeText(polishedSections["Recommended Actions"]).trim() ? (
          <div className="mt-4 max-w-3xl">
            <ExecutivePolishedSection text={polishedSections["Recommended Actions"]} sectionTitle="Recommended Actions" />
          </div>
        ) : recommendedActions.length === 0 ? renderEmpty("Not specified") : (
          <ol className="mt-4 max-w-3xl list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-800">
            {recommendedActions.slice(0, 5).map((item, index) => (
              <li key={item.id || `${item.text}-${index}`}>
                {item.text}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border-b border-neutral-200 py-7">
        <h2 className="text-base font-semibold text-neutral-950">Supporting Appendix Summary</h2>
        <div className="mt-4 grid max-w-2xl gap-2 text-sm text-neutral-800 sm:grid-cols-2">
          <div>Incidents: <span className="font-semibold">{appendixSummary.incidentCount ?? 0}</span></div>
          <div>Evidence items: <span className="font-semibold">{appendixSummary.evidenceCount ?? 0}</span></div>
          <div>Documents: <span className="font-semibold">{appendixSummary.documentCount ?? 0}</span></div>
          <div>Date range: <span className="font-semibold">{appendixSummary.dateRange?.firstDate || "Not specified"} to {appendixSummary.dateRange?.lastDate || "Not specified"}</span></div>
        </div>
        <p className="mt-4 text-sm font-medium text-neutral-700">{appendixSummary.fullDetailNote || "Use Investigation Report for full record detail."}</p>
      </section>

      {chronologyPreview.length > 0 && (
        <section className="py-7">
          <h2 className="text-base font-semibold text-neutral-950">Short Chronology Preview</h2>
          <ul className="mt-4 max-w-3xl space-y-2 text-sm leading-6 text-neutral-800">
            {chronologyPreview.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <span className="font-semibold">{item.date || "No date"}:</span> {item.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
