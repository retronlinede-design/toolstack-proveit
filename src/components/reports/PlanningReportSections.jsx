import { ReportLinkedList } from "./ReportArticleShared.jsx";

const humanize = (value) => String(value || "").replaceAll("_", " ");

function List({ title, items }) {
  return items?.length ? <div><h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div> : null;
}

export function StrategyReportCards({ items = [] }) {
  return items.length ? <div className="mt-4 space-y-4">{items.map((item) => <article key={item.id} className="break-inside-avoid rounded-xl border border-neutral-200 p-4">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-neutral-950">{item.title}</h3><div className="text-xs capitalize text-neutral-500">{[item.priority, item.strategyType, item.status, item.decisionStatus].filter(Boolean).map(humanize).join(" · ")}</div></div>
    {item.objective && <div className="mt-3"><div className="text-xs font-bold uppercase text-neutral-500">Objective</div><p className="mt-1 text-sm text-neutral-800">{item.objective}</p></div>}
    {item.legacyDescription && <p className="mt-2 text-sm text-neutral-700">{item.legacyDescription}</p>}
    {item.rationale && <div className="mt-3"><div className="text-xs font-bold uppercase text-neutral-500">Analysis / reasoning</div><p className="mt-1 text-sm text-neutral-700">{item.rationale}</p></div>}
    {item.desiredOutcome && <div className="mt-3"><div className="text-xs font-bold uppercase text-neutral-500">Desired outcome</div><p className="mt-1 text-sm text-neutral-700">{item.desiredOutcome}</p></div>}
    <div className="mt-3 grid gap-3 md:grid-cols-3"><List title="Risks" items={item.risks}/><List title="Assumptions" items={item.assumptions}/><List title="Next steps" items={item.nextSteps}/></div>
    {(item.ownerName || item.reviewDate) && <p className="mt-3 text-xs text-neutral-500">{item.ownerName && `Owner: ${item.ownerName}`}{item.ownerName && item.reviewDate ? " · " : ""}{item.reviewDate && `Review: ${item.reviewDate}${item.reviewState !== "none" ? ` (${humanize(item.reviewState)})` : ""}`}</p>}
    {item.linkedRecords?.length > 0 && <p className="mt-2 text-xs text-neutral-500">Linked records: <ReportLinkedList items={item.linkedRecords}/></p>}
  </article>)}</div> : null;
}

export function WatchReportCards({ items = [], disclaimer, showHistory = false }) {
  if (!items.length) return null;
  return <div className="mt-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">{disclaimer}</div><div className="mt-4 space-y-4">{items.map((item) => <article key={item.id} className="break-inside-avoid rounded-xl border border-sky-200 bg-sky-50/40 p-4">
    <div className="flex flex-wrap justify-between gap-2"><div><div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Monitored concern</div><h3 className="font-semibold text-neutral-950">{item.title}</h3></div><div className="text-xs capitalize text-neutral-500">Monitoring status: {humanize(item.status)}{item.category ? ` · ${humanize(item.category)}` : ""}{item.priority ? ` · ${humanize(item.priority)}` : ""}</div></div>
    {item.watchFor && <div className="mt-3"><div className="text-xs font-bold uppercase text-neutral-500">What is being monitored</div><p className="mt-1 text-sm text-neutral-800">{item.watchFor}</p></div>}
    {item.rationale && <div className="mt-3"><div className="text-xs font-bold uppercase text-neutral-500">Why it matters</div><p className="mt-1 text-sm text-neutral-700">{item.rationale}</p></div>}
    <div className="mt-3 grid gap-3 md:grid-cols-2"><List title="Trigger for review" items={item.triggerConditions}/>{item.latestObservation && <div><h4 className="text-xs font-bold uppercase text-neutral-500">Unconfirmed observation</h4><p className="mt-1 text-sm text-neutral-700">{item.latestObservation}</p></div>}</div>
    {showHistory && item.recentObservations?.length > 0 && <List title={`Recent monitoring history (${item.observationCount} total)`} items={item.recentObservations.map((observation) => `${observation.date ? `${observation.date}: ` : ""}${observation.text}`)}/>} 
    {(item.nextCheck || item.reviewDate || item.outcome) && <p className="mt-3 text-xs text-neutral-600">{item.nextCheck && `Next check: ${item.nextCheck}`}{item.nextCheck && item.reviewDate ? " · " : ""}{item.reviewDate && `Review: ${item.reviewDate} (${humanize(item.reviewState)})`}{item.outcome && ` · Outcome: ${item.outcome}`}</p>}
    {item.relatedParties?.length > 0 && <p className="mt-2 text-xs text-neutral-500">Related people: {item.relatedParties.join(", ")}</p>}{item.linkedRecords?.length > 0 && <p className="mt-2 text-xs text-neutral-500">Linked records: <ReportLinkedList items={item.linkedRecords}/></p>}
  </article>)}</div></div>;
}
