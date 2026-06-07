import {
  EXECUTIVE_POLISH_SECTION_TITLES,
  buildPolishedContentBlocks,
  parseExecutivePolishSections,
  parseManagementReportV1Polish,
} from "../../report/executiveSummaryPolish.js";

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function formatReportDate(value) {
  return safeText(value) || "No date";
}

function formatChainStatus(value = "") {
  const status = safeText(value) || "needs_review";
  const labels = {
    ready: "Ready",
    needs_proof: "Needs proof",
    needs_review: "Needs review",
    reference_only: "Reference only",
  };
  return labels[status] || status.replaceAll("_", " ");
}

function getChainStatusClass(value = "") {
  if (value === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "needs_proof") return "border-amber-200 bg-amber-50 text-amber-900";
  if (value === "reference_only") return "border-neutral-200 bg-neutral-50 text-neutral-600";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function getGapClass(value = "") {
  if (value === "high") return "border-amber-200 bg-amber-50 text-amber-950";
  if (value === "medium") return "border-orange-200 bg-orange-50 text-orange-950";
  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function getRiskClass(value = "") {
  if (value === "High") return "text-amber-900";
  if (value === "Medium") return "text-orange-800";
  if (value === "Low") return "text-emerald-800";
  return "text-neutral-700";
}

function PolishedCardItem({ item, className = "" }) {
  return (
    <div className={`break-inside-avoid rounded-lg border border-neutral-200 bg-white p-3 print:break-inside-avoid ${className}`}>
      {item.label ? <div className="text-sm font-semibold text-neutral-950">{item.label}</div> : null}
      {item.text ? <p className={`${item.label ? "mt-1" : ""} text-sm leading-6 text-neutral-700`}>{item.text}</p> : null}
    </div>
  );
}

function ManagementReportHeader({ coverPage = {}, report = {} }) {
  return (
    <header className="management-report-header border-b border-neutral-300 pb-8 print:pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Management Report</div>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-neutral-950 print:text-[22pt]">{coverPage.caseName || report.caseOverview?.name || "Not specified"}</h1>
          <div className="mt-4 grid gap-1 text-sm text-neutral-600 print:text-[10pt]">
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
  );
}

function ChainSummaryStrip({ chainSummary = {}, ungroupedSummary = {} }) {
  const items = [
    ["Sequence chains", chainSummary.sequenceChainCount ?? 0],
    ["Chains with proof gaps", chainSummary.chainsWithProofGaps ?? 0],
    ["Ready for review", chainSummary.chainsReadyForReview ?? 0],
    ["Ungrouped records", chainSummary.ungroupedRecordCount ?? ungroupedSummary?.counts?.total ?? 0],
  ];

  return (
    <section className="management-report-summary border-b border-neutral-200 py-7 print:py-5">
      <h2 className="text-base font-semibold text-neutral-950">Sequence Chain Summary</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="border-l-2 border-neutral-300 bg-neutral-50 px-4 py-3 print:bg-white print:px-3 print:py-2">
            <div className="text-2xl font-bold text-neutral-950 print:text-[16pt]">{value}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChainCountRow({ counts = {} }) {
  const items = [
    ["Facts", counts.incidents ?? 0],
    ["Proof", counts.evidence ?? 0],
    ["Docs", counts.documents ?? 0],
    ["Actions", counts.strategy ?? counts.records ?? 0],
    ["Management", counts.managementAwareness ?? 0],
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-600 print:mt-3">
      {items.map(([label, value]) => (
        <span key={label} className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 print:rounded-none print:border-0 print:border-r print:px-2 print:py-0 last:print:border-r-0">
          {label}: {value}
        </span>
      ))}
    </div>
  );
}

function SequenceChainSection({ chain = {}, polishedBrief = {} }) {
  const facts = Array.isArray(chain.facts) ? chain.facts : [];
  const proof = Array.isArray(chain.proof) ? chain.proof : [];
  const gaps = Array.isArray(chain.gaps) ? chain.gaps : [];
  const risks = Array.isArray(chain.risks) ? chain.risks : [];
  const actions = Array.isArray(chain.actions) ? chain.actions : [];
  const referenceDocuments = Array.isArray(chain.referenceDocuments) ? chain.referenceDocuments : [];
  const briefing = {
    issueSummary: polishedBrief.issueSummary || chain.briefing?.issueSummary || "",
    managementImportance: polishedBrief.managementImportance || chain.briefing?.managementImportance || "",
    decisionNeeded: polishedBrief.decisionNeeded || chain.briefing?.decisionNeeded || "",
  };

  return (
    <section className="management-chain-section break-inside-avoid border-b border-neutral-300 py-9 print:break-inside-avoid print:py-6">
      <div className="border-l-4 border-neutral-900 pl-4 print:border-l-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Sequence chain</div>
            <h3 className="mt-1 text-2xl font-semibold leading-tight text-neutral-950 print:text-[17pt]">{chain.name || "Untitled chain"}</h3>
          </div>
          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider print:rounded-none print:px-2 print:py-0.5 ${getChainStatusClass(chain.status)}`}>
            {formatChainStatus(chain.status)}
          </span>
        </div>
        <ChainCountRow counts={chain.counts} />
      </div>

      <section className="mt-6 border-y border-neutral-200 py-4 print:mt-4 print:py-3">
        <h4 className="text-sm font-semibold text-neutral-950">Chain Brief</h4>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm leading-6 text-neutral-800 lg:grid-cols-3 print:block">
          <div className="print:mb-2">
            <dt className="text-xs font-bold uppercase tracking-wider text-neutral-500">Issue summary</dt>
            <dd className="mt-1">{briefing.issueSummary || "Not specified"}</dd>
          </div>
          <div className="print:mb-2">
            <dt className="text-xs font-bold uppercase tracking-wider text-neutral-500">Management importance</dt>
            <dd className="mt-1">{briefing.managementImportance || "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-neutral-500">Decision needed</dt>
            <dd className="mt-1 font-medium text-neutral-950">{briefing.decisionNeeded || "Review and confirm next action."}</dd>
          </div>
        </dl>
      </section>

      <div className="management-report-grid mt-6 grid gap-8 lg:grid-cols-2 print:block">
        <section className="print:mb-5">
          <h4 className="border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-950">Facts</h4>
          {facts.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No incident facts recorded for this chain.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {facts.map((fact) => (
                <li key={fact.id || fact.incidentId} className="break-inside-avoid border-l-2 border-neutral-300 pl-3 print:break-inside-avoid">
                  <div className="text-xs font-semibold text-neutral-500">{fact.date || "No date"}</div>
                  <div className="mt-1 text-sm font-semibold text-neutral-950">{fact.title || "Untitled fact"}</div>
                  {fact.summary ? <p className="mt-1 text-sm leading-6 text-neutral-700">{fact.summary}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h4 className="border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-950">Proof / What this establishes</h4>
          {proof.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No evidence proof recorded for this chain.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {proof.map((item) => (
                <li key={item.id || item.evidenceId} className="proof-card break-inside-avoid rounded-md border border-lime-300 bg-lime-50 p-4 print:break-inside-avoid print:bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-neutral-950">{item.title || "Untitled evidence"}</div>
                    <div className="text-xs font-semibold text-neutral-500">{item.date || "No date"}</div>
                  </div>
                  {item.missingFunctionSummary ? (
                    <p className="mt-2 border-l-2 border-amber-500 pl-3 text-sm font-semibold leading-6 text-amber-900">Evidence present, but proof purpose is not defined.</p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-lime-950">{item.establishes}</p>
                  )}
                  {item.note ? <p className="mt-2 text-xs font-medium text-neutral-600">{item.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="management-report-grid mt-7 grid gap-8 lg:grid-cols-[1fr_0.8fr_1fr] print:block">
        <div>
          <h4 className="border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-950">Gaps</h4>
          {gaps.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No major gaps flagged.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {gaps.map((gap, index) => (
                <li key={`${gap.code}-${gap.recordId}-${index}`} className={`rounded-lg border p-3 text-sm leading-6 ${getGapClass(gap.severity)}`}>
                  {gap.message || gap.code}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="print:mt-5">
          <h4 className="border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-950">Risks</h4>
          {risks.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No risk snapshot recorded.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {risks.map((risk) => (
                <div key={risk.type} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold print:rounded-none">
                  <span className="text-neutral-600">{risk.type}: </span>
                  <span className={getRiskClass(risk.level)}>{risk.level || "Unknown"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="print:mt-5">
          <h4 className="border-b border-neutral-200 pb-2 text-sm font-semibold text-neutral-950">Actions</h4>
          {actions.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No chain-specific actions recorded.</p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm leading-6 text-neutral-800">
              {actions.map((action, index) => (
                <li key={action.id || `${action.text}-${index}`} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white print:bg-white print:text-neutral-950">{index + 1}</span>
                  <span>{action.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <section className="mt-7 border-t border-neutral-200 pt-5">
        <h4 className="text-sm font-semibold text-neutral-800">Reference documents</h4>
        {referenceDocuments.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No reference documents recorded for this chain.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 print:block">
            {referenceDocuments.map((document) => (
              <li key={document.id} className="reference-document break-inside-avoid border border-neutral-200 bg-neutral-50 p-3 text-sm leading-6 text-neutral-600 print:mb-2 print:break-inside-avoid print:bg-white">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-neutral-800">{document.title || "Untitled document"}</span>
                  <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 print:rounded-none">
                    Reference material
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-neutral-500">{document.note || "Reference material only; not treated as proof by default."}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
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
  const sequenceChains = Array.isArray(report.sequenceChains) ? report.sequenceChains : [];
  const hasSequenceChains = sequenceChains.length > 0;
  const v1Polish = hasSequenceChains && hasPolishedNarrative
    ? parseManagementReportV1Polish(polishedMarkdown)
    : { executiveBrief: "", chainBriefs: {} };

  const renderEmpty = (text) => (
    <p className="mt-3 text-sm text-neutral-500">{text}</p>
  );

  if (hasSequenceChains) {
    return (
      <article className={className}>
        <ManagementReportHeader coverPage={coverPage} report={report} />

        {hasPolishedNarrative && (
          <div className="border-b border-neutral-200 py-4 print:hidden">
            <div className="rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm font-semibold text-lime-900">
              Using polished executive brief and chain brief wording. Sequence chain facts, proof, gaps, risks, actions, references, counts, and statuses remain deterministic.
              {missingPolishedSections.length > 0 && (
                <span className="mt-1 block text-xs font-medium text-lime-800">
                  Missing: {missingPolishedSections.join(", ")}
                </span>
              )}
            </div>
          </div>
        )}

        <section className="border-b border-neutral-200 py-8 print:py-5">
          <h2 className="text-base font-semibold text-neutral-950">Executive Brief</h2>
          <div className="mt-3 max-w-3xl">
            {safeText(v1Polish.executiveBrief).trim() ? (
              <ExecutivePolishedSection text={v1Polish.executiveBrief} sectionTitle="Executive Summary" />
            ) : (
              <p className="text-sm leading-7 text-neutral-800">{executiveSummary.summary || "Not specified"}</p>
            )}
          </div>
          <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">What management needs to decide or review</div>
            <p className="mt-2 text-sm leading-6 text-neutral-800">{report.managementQuestion || "Not specified"}</p>
          </div>
        </section>

        <ChainSummaryStrip chainSummary={report.chainSummary} ungroupedSummary={report.ungroupedSummary} />

        <section className="py-7 print:py-5">
          <div className="border-b border-neutral-200 pb-3">
            <h2 className="text-lg font-semibold text-neutral-950 print:text-[14pt]">Sequence Chain Briefings</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Each chain separates facts, proof, gaps, risks, actions, and reference documents.
            </p>
          </div>
          {sequenceChains.map((chain) => (
            <SequenceChainSection
              key={chain.id || chain.name}
              chain={chain}
              polishedBrief={v1Polish.chainBriefs?.[chain.id] || {}}
            />
          ))}
        </section>

        {(report.ungroupedSummary?.counts?.total ?? 0) > 0 && (
          <section className="border-t border-neutral-200 py-7">
            <h2 className="text-base font-semibold text-neutral-950">Ungrouped Records</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              {report.ungroupedSummary.managementNote || "Some records are not assigned to a sequence chain."}
            </p>
          </section>
        )}
      </article>
    );
  }

  return (
    <article className={className}>
      <ManagementReportHeader coverPage={coverPage} report={report} />

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
