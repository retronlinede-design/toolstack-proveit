import { getReportHeadingLabel } from "../../lib/reportHeadingLabels.js";
import { parseMilestoneTimelineEntry } from "./generatedClientReportHelpers.js";

export default function GeneratedClientReportArticle({
  className = "",
  displayLanguage,
  headerLogo,
  parsedReport,
  reportCoverSubtitle,
  reportHeaderMeta,
  selectedCase,
  variant = "default",
}) {
  const isPackVariant = variant === "pack";
  const headingLabel = (key) => getReportHeadingLabel(key, displayLanguage);

  return (
    <article className={className}>
      <div className="proveit-print-cover proveit-print-cover-break print:block hidden">
        <div className="proveit-print-cover-brand">
          <img src={headerLogo} alt="ProveIt" />
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-neutral-900">ProveIt</div>
            <div className="mt-1 text-[9pt] font-medium text-neutral-500">Evidence Management & Case Engine</div>
          </div>
        </div>
        <div className="proveit-print-cover-title">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">CLIENT REPORT</div>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-neutral-950 print:text-[26pt]">Client Report</h1>
          <p className="mt-5 text-lg font-semibold text-neutral-800 print:text-[15pt]">
            {selectedCase?.name || selectedCase?.id || "Untitled Case"}
          </p>
          <p className="mt-3 text-sm font-medium text-neutral-500 print:text-[11pt]">{reportHeaderMeta}</p>
          {reportCoverSubtitle && (
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 print:text-[9pt]">
              {reportCoverSubtitle}
            </p>
          )}
        </div>
      </div>
      <header className={`proveit-print-body-header print-pack-header border-b border-neutral-200 print:hidden ${isPackVariant ? "pb-7" : "pb-6"}`}>
        <div className="min-w-0">
          <div className={`font-bold uppercase tracking-[0.18em] text-neutral-500 ${isPackVariant ? "text-[11px]" : "text-xs"}`}>
            CLIENT REPORT
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 print:mt-4">
            <h1 className={`min-w-0 break-words font-bold leading-tight text-neutral-950 print:text-[22pt] ${isPackVariant ? "text-4xl" : "text-3xl"}`}>
              {parsedReport.reportTitle || headingLabel("REPORT_TITLE")}
            </h1>
            <div className="shrink-0 whitespace-nowrap text-right text-base font-medium text-neutral-500 print:mt-2 print:text-[11pt]">
              {reportHeaderMeta}
            </div>
          </div>
        </div>
      </header>

      {parsedReport.atAGlance?.length > 0 && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6 first:pt-7" : "py-6"} first:border-t-0 first:pt-6`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("AT_A_GLANCE")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedReport.atAGlance.map((item) => (
              <li key={item} className={`text-neutral-700 marker:text-neutral-400 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsedReport.yourSituation && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("YOUR_SITUATION")}</h4>
          </div>
          <p className={`whitespace-pre-wrap text-neutral-700 ${isPackVariant ? "mt-5 text-[15px] leading-7" : "mt-4 text-sm leading-6"}`}>
            {parsedReport.yourSituation}
          </p>
        </section>
      )}

      {parsedReport.mainAreasOfConcern.length > 0 && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("MAIN_AREAS_OF_CONCERN")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedReport.mainAreasOfConcern.map((item) => (
              <li key={item} className={`text-neutral-700 marker:text-neutral-400 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsedReport.whatThisReportShows.length > 0 && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("WHAT_THIS_REPORT_SHOWS")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedReport.whatThisReportShows.map((item) => (
              <li key={item} className={`text-lime-950 marker:text-lime-700 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsedReport.milestoneTimeline?.length > 0 && (
        <section className={`proveit-print-section proveit-print-section-break border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("MILESTONE_TIMELINE")}</h4>
          </div>
          <div className={`relative ${isPackVariant ? "mt-5 space-y-3.5" : "mt-4 space-y-3.5"}`}>
            {parsedReport.milestoneTimeline.map((item, index) => {
              const timelineItem = parseMilestoneTimelineEntry(item);
              return (
                <div
                  key={`${item}-${index}`}
                  className={`proveit-print-avoid-break print-pack-timeline-entry grid grid-cols-[1.25rem_1fr] gap-3 break-inside-avoid ${isPackVariant ? "items-start" : "items-start"}`}
                >
                  <div className="flex h-full flex-col items-center">
                    <span className={`mt-1 block h-2.5 w-2.5 rounded-full border border-amber-300 bg-white`}></span>
                    {index < parsedReport.milestoneTimeline.length - 1 && (
                      <span className={`mt-2 w-px flex-1 bg-amber-200/70`}></span>
                    )}
                  </div>
                  <div className={`rounded-lg border border-amber-100 bg-white ${isPackVariant ? "px-4 py-3.5" : "px-3.5 py-3"}`}>
                    {timelineItem.date && (
                      <div className={`text-neutral-500 ${isPackVariant ? "text-xs" : "text-[11px]"} font-semibold uppercase tracking-[0.08em]`}>
                        {timelineItem.date}
                      </div>
                    )}
                    <div className={`text-neutral-950 ${isPackVariant ? "mt-1 text-[15px] leading-6" : "mt-1 text-sm leading-6"} font-semibold`}>
                      {timelineItem.title || item}
                    </div>
                    {timelineItem.note && (
                      <p className={`text-neutral-700 ${isPackVariant ? "mt-1.5 text-[15px] leading-7" : "mt-1 text-sm leading-6"}`}>
                        {timelineItem.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {parsedReport.issues.length > 0 && (
        <section className={`proveit-print-section proveit-print-section-break border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>Issue Sections</h4>
          </div>
          <div className={`${isPackVariant ? "mt-6 space-y-6" : "mt-4 space-y-5"}`}>
            {parsedReport.issues.map((issue, index) => (
              <section
                key={`${issue.title || "issue"}-${index}`}
                className={`proveit-print-issue print-pack-issue-section break-inside-avoid rounded-lg border border-l-4 border-neutral-200 border-l-lime-500 bg-white ${isPackVariant ? "p-6 shadow-sm shadow-neutral-100" : "p-5"}`}
              >
                <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-4" : "pb-3"}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{headingLabel("ISSUE")}</div>
                  <h5 className={`mt-2 break-words font-semibold leading-tight text-neutral-950 ${isPackVariant ? "text-2xl" : "text-xl"}`}>
                    {issue.title || "Untitled issue"}
                  </h5>
                </div>

                {issue.whatHappened && (
                  <div className={isPackVariant ? "mt-5" : "mt-4"}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{headingLabel("WHAT_HAPPENED")}</div>
                    <p className={`mt-2 text-neutral-700 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>{issue.whatHappened}</p>
                  </div>
                )}

                {issue.keyProof.length > 0 && (
                  <div className={`proveit-print-avoid-break rounded-lg border border-neutral-200 bg-neutral-50/60 ${isPackVariant ? "mt-6 p-5" : "mt-5 p-4"}`}>
                    <h6 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{headingLabel("KEY_PROOF")}</h6>
                    <ul className={`list-disc pl-5 text-neutral-700 ${isPackVariant ? "mt-4 space-y-2.5 text-[15px] leading-7" : "mt-3 space-y-2 text-sm leading-6"}`}>
                      {issue.keyProof.map((item) => (
                        <li key={item} className="marker:text-neutral-400">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {issue.whatThisMeans.length > 0 && (
                  <div className={`proveit-print-avoid-break rounded-lg border border-lime-200 bg-lime-50/70 ${isPackVariant ? "mt-6 p-5" : "mt-5 p-4"}`}>
                    <h6 className="text-xs font-bold uppercase tracking-wider text-lime-800">{headingLabel("WHAT_THIS_MEANS")}</h6>
                    <ul className={`list-disc pl-5 text-lime-950 ${isPackVariant ? "mt-4 space-y-2.5 text-[15px] leading-7" : "mt-3 space-y-2 text-sm leading-6"}`}>
                      {issue.whatThisMeans.map((item) => (
                        <li key={item} className="marker:text-lime-700">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      )}

      {parsedReport.keyFacts.length > 0 && (
        <section className={`proveit-print-section proveit-print-section-break border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("KEY_FACTS")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedReport.keyFacts.map((item) => (
              <li key={item} className={`text-neutral-700 marker:text-neutral-400 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsedReport.currentPosition && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("CURRENT_POSITION")}</h4>
          </div>
          <p className={`whitespace-pre-wrap text-neutral-700 ${isPackVariant ? "mt-5 text-[15px] leading-7" : "mt-4 text-sm leading-6"}`}>
            {parsedReport.currentPosition}
          </p>
        </section>
      )}

      {parsedReport.recommendedNextSteps.length > 0 && (
        <section className={`border-t border-neutral-200 ${isPackVariant ? "py-8 print:py-6" : "py-6"}`}>
          <div className={`border-b border-neutral-100 ${isPackVariant ? "pb-3" : "pb-3"}`}>
            <h4 className={`font-bold uppercase tracking-wider text-neutral-500 ${isPackVariant ? "text-xs" : "text-sm"}`}>{headingLabel("RECOMMENDED_NEXT_STEPS")}</h4>
          </div>
          <ul className={`list-disc pl-5 ${isPackVariant ? "mt-5 space-y-3" : "mt-4 space-y-3"}`}>
            {parsedReport.recommendedNextSteps.map((item) => (
              <li key={item} className={`text-neutral-700 marker:text-neutral-400 ${isPackVariant ? "text-[15px] leading-7" : "text-sm leading-6"}`}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="proveit-print-footer">
        {reportHeaderMeta}
      </footer>
    </article>
  );
}
