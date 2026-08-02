import { documentStyles, REPORT_DOCUMENT_METADATA_FIELDS } from "./reportDocumentStyles.js";

function joinClasses(...values) { return values.filter(Boolean).join(" "); }
function hasValue(value) { return value !== null && value !== undefined && value !== ""; }
function formatDateTime(value) {
  if (!hasValue(value)) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" }).format(date);
}
function issueLabel(reference, name) { return [reference, name].filter(hasValue).join(" — "); }

export function ReportDocumentShell({ header, documentControl, footer, children, className = "", ...articleProps }) {
  return <article {...articleProps} className={joinClasses(documentStyles.shell, className)}>
    {header || null}
    {documentControl ? <div className="px-5 sm:px-8 lg:px-12 print:px-0">{documentControl}</div> : null}
    {children != null ? <div className={documentStyles.body}>{children}</div> : null}
    {footer || null}
  </article>;
}

export function ReportDocumentHeader({ title, subtitle, caseName, caseReference, issueReference, issueName, generatedAt, preparedBy, approvedBy, version, documentStatus, confidentiality, className = "" }) {
  const issue = issueLabel(issueReference, issueName);
  const identityItems = [
    caseName && ["Case", caseName], caseReference && ["Case reference", caseReference], issue && ["Issue", issue],
    generatedAt && ["Generated", formatDateTime(generatedAt)], preparedBy && ["Prepared by", preparedBy],
    approvedBy && ["Approved by", approvedBy], version && ["Version", version],
  ].filter(Boolean);
  return <header className={joinClasses("border-b border-neutral-200 px-5 py-7 sm:px-8 sm:py-9 lg:px-12 dark:border-neutral-700 print:border-neutral-400 print:px-0 print:pb-6 print:pt-0", className)}>
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><p className="text-sm font-semibold tracking-wide text-burgundy-800 dark:text-lime-300 print:text-black">ProveIt</p><h1 className={joinClasses(documentStyles.heading, "mt-2 text-3xl leading-tight sm:text-4xl print:text-[26pt]")}>{title || "Report"}</h1>{subtitle ? <p className="mt-2 max-w-3xl break-words text-base leading-7 text-neutral-600 dark:text-neutral-300 print:text-neutral-800">{subtitle}</p> : null}</div>
      {(documentStatus || confidentiality) ? <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-56 sm:justify-end">{documentStatus ? <span className="rounded-md border border-neutral-400 px-2.5 py-1 text-xs font-bold text-neutral-800 dark:border-neutral-500 dark:text-neutral-100 print:border-black print:text-black">Status: {documentStatus}</span> : null}{confidentiality ? <span className="rounded-md border border-burgundy-700 px-2.5 py-1 text-xs font-bold text-burgundy-900 dark:border-lime-500 dark:text-lime-200 print:border-black print:text-black">Confidentiality: {confidentiality}</span> : null}</div> : null}
    </div>
    {identityItems.length ? <dl className="mt-7 grid min-w-0 gap-x-6 gap-y-3 border-t border-neutral-200 pt-5 sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-700 print:border-neutral-400">{identityItems.map(([label, value]) => <div key={label} className="min-w-0"><dt className={documentStyles.metadataLabel}>{label}</dt><dd className={documentStyles.metadataValue}>{value}</dd></div>)}</dl> : null}
  </header>;
}

export function ReportDocumentControl({ metadata = null, className = "", ...fields }) {
  const values = metadata ? { ...fields, ...metadata } : fields;
  const rows = REPORT_DOCUMENT_METADATA_FIELDS.map(([key, label]) => [key, label, key === "generatedAt" ? formatDateTime(values[key]) : values[key]]).filter(([, , value]) => hasValue(value));
  if (!rows.length) return null;
  return <section aria-labelledby="report-document-control-heading" className={joinClasses("border-b border-neutral-200 py-6 dark:border-neutral-700 print:border-neutral-400", className)}><h2 id="report-document-control-heading" className="text-lg font-semibold text-neutral-950 dark:text-neutral-50 print:text-black">Document control</h2><dl className="mt-4 grid min-w-0 gap-x-8 gap-y-4 sm:grid-cols-2">{rows.map(([key, label, value]) => <div key={key} className={joinClasses("min-w-0", key === "sourceRevision" || key === "exclusions" ? "sm:col-span-2" : "")}><dt className={documentStyles.metadataLabel}>{label}</dt><dd className={joinClasses(documentStyles.metadataValue, key === "sourceRevision" ? "font-mono text-xs [overflow-wrap:anywhere] select-text" : "")}>{value}</dd></div>)}</dl></section>;
}

export function ReportDocumentSection({ id, title, description, eyebrow, sectionNumber, headingLevel = 2, breakBefore = false, avoidBreakInside = false, children, className = "" }) {
  if (children === null || children === undefined || children === false) return null;
  const level = [2, 3, 4, 5, 6].includes(headingLevel) ? headingLevel : 2;
  const Heading = `h${level}`;
  const titleId = id ? `${id}-heading` : undefined;
  return <section id={id} aria-labelledby={titleId} className={joinClasses("py-7 first:pt-0 print:py-6", breakBefore && documentStyles.breakBefore, avoidBreakInside && documentStyles.avoidBreak, className)}>
    {(eyebrow || sectionNumber) ? <p className="mb-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400 print:text-neutral-700">{[sectionNumber, eyebrow].filter(hasValue).join(" · ")}</p> : null}
    <Heading id={titleId} className={joinClasses(documentStyles.heading, level === 2 ? "text-2xl print:text-[17pt]" : level === 3 ? "text-xl print:text-[14pt]" : "text-base print:text-[11pt]")}>{title}</Heading>
    {description ? <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-neutral-600 dark:text-neutral-300 print:text-neutral-800">{description}</p> : null}
    <div className="mt-4 min-w-0 space-y-4 leading-7">{children}</div>
  </section>;
}

export function ReportDocumentStatistics({ items = [], columns = 4, className = "", ariaLabel = "Report statistics" }) {
  if (!items.length) return null;
  const columnClass = columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return <dl aria-label={ariaLabel} className={joinClasses("grid min-w-0 grid-cols-1 gap-3", columnClass, className)}>{items.map((item, index) => <div key={item.key ?? `${item.label}-${index}`} className="min-w-0 break-inside-avoid border-l-2 border-neutral-400 px-3 py-2 dark:border-neutral-500 print:border-black"><dt className={documentStyles.metadataLabel}>{item.label}</dt><dd className="mt-1 break-words text-2xl font-semibold text-neutral-950 dark:text-neutral-50 print:text-black">{item.value}</dd>{item.note ? <dd className="mt-1 break-words text-xs leading-5 text-neutral-500 dark:text-neutral-400 print:text-neutral-700">{item.note}</dd> : null}</div>)}</dl>;
}

const CALLOUTS = {
  information: { label: "Information", classes: "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100" },
  warning: { label: "Warning", classes: "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100" },
  limitation: { label: "Limitation", classes: "border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100" },
  recommendation: { label: "Recommendation", classes: "border-lime-500 bg-lime-50 text-lime-950 dark:border-lime-700 dark:bg-lime-950/40 dark:text-lime-100" },
  quality: { label: "Quality note", classes: "border-violet-400 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100" },
  confidentiality: { label: "Confidentiality", classes: "border-burgundy-700 bg-red-50 text-burgundy-950 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100" },
};
export function ReportDocumentCallout({ variant = "information", title, children, className = "" }) {
  if (children === null || children === undefined || children === false) return null;
  const treatment = CALLOUTS[variant] || CALLOUTS.information;
  return <aside className={joinClasses("break-inside-avoid rounded-lg border-l-4 px-4 py-3 print:rounded-none print:border print:border-l-4 print:bg-white print:text-black", treatment.classes, className)}><p className="text-xs font-bold">{treatment.label}</p>{title ? <p className="mt-1 font-semibold">{title}</p> : null}<div className="mt-1 whitespace-pre-wrap text-sm leading-6">{children}</div></aside>;
}

export function ReportDocumentAppendix({ id, label, title, description, children, className = "" }) {
  if (children === null || children === undefined || children === false) return null;
  const headingId = id ? `${id}-heading` : undefined;
  return <section id={id} aria-labelledby={headingId} className={joinClasses(documentStyles.breakBefore, "border-t border-neutral-300 pt-7 dark:border-neutral-600 print:border-black print:pt-0", className)}><p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 print:text-neutral-700">{label || "Appendix"}</p><h2 id={headingId} className={joinClasses(documentStyles.heading, "mt-1 text-2xl print:text-[17pt]")}>{title}</h2>{description ? <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-neutral-600 dark:text-neutral-300 print:text-neutral-800">{description}</p> : null}<div className="mt-5 min-w-0 space-y-5">{children}</div></section>;
}

export function ReportDocumentFooter({ reportTitle, caseName, caseReference, issueReference, sourceRevision, version, documentStatus, confidentiality, generatedAt, className = "" }) {
  const primary = [reportTitle, caseName || caseReference, issueReference].filter(hasValue).join(" · ");
  const secondary = [version && `Version ${version}`, documentStatus && `Status: ${documentStatus}`, confidentiality && `Confidentiality: ${confidentiality}`, generatedAt && `Generated ${formatDateTime(generatedAt)}`].filter(hasValue).join(" · ");
  return <footer className={joinClasses("border-t border-neutral-200 px-5 py-4 text-xs leading-5 text-neutral-500 sm:px-8 lg:px-12 dark:border-neutral-700 dark:text-neutral-400 print:border-neutral-500 print:px-0 print:text-neutral-700", className)}><div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:justify-between"><p className="min-w-0 break-words"><span className="font-semibold text-neutral-700 dark:text-neutral-200 print:text-black">ProveIt</span>{primary ? ` · ${primary}` : ""}</p>{secondary ? <p className="min-w-0 break-words">{secondary}</p> : null}</div>{sourceRevision ? <p className="mt-1 break-all font-mono text-[10px] select-text">Source revision: {sourceRevision}</p> : null}</footer>;
}

export function ReportDocumentFoundationDemo({ documentStatus = "Draft", omitOptionalMetadata = false }) {
  const metadata = { title: "Investigation Report", subtitle: "Professional document foundation demonstration", caseName: "A representative case name long enough to demonstrate safe wrapping across narrow screens", caseReference: omitOptionalMetadata ? undefined : "CASE-2026-014", issueReference: "ISS-003", issueName: "Heating failure, repeated repair delays, correspondence, and unresolved winter service concerns", generatedAt: "2026-08-02T10:30:00Z", preparedBy: "Case Manager", approvedBy: omitOptionalMetadata ? undefined : "Review Lead", version: "1.0", documentStatus, confidentiality: "Confidential" };
  return <ReportDocumentShell data-testid="foundation-demo" header={<ReportDocumentHeader {...metadata} />} documentControl={<ReportDocumentControl purpose="Explain the selected investigation Issue." audience="Investigator / adviser" scope="ISS-003 — Heating failure" reportingPeriod="January to August 2026" exclusions="Attachment contents are not reproduced." completeness="Complete for the declared structured records" generatedAt={metadata.generatedAt} sourceRevision="sha256:8e499d965feeac7d61ff12c03474c827a9999fe85e407f0782972e41c7c38f21" preparedBy={metadata.preparedBy} approvedBy={metadata.approvedBy} version={metadata.version} documentStatus={documentStatus} confidentiality={metadata.confidentiality} aiAssistance="Narrative wording assisted; factual content requires human review." />} footer={<ReportDocumentFooter reportTitle={metadata.title} caseName={metadata.caseName} issueReference={metadata.issueReference} sourceRevision="sha256:8e499d965feeac7d61ff12c03474c827a9999fe85e407f0782972e41c7c38f21" version={metadata.version} documentStatus={documentStatus} confidentiality={metadata.confidentiality} generatedAt={metadata.generatedAt} />}>
    <ReportDocumentStatistics items={[{ key: "incidents", label: "Incidents", value: 0, note: "Directly assigned" }, { key: "evidence", label: "Evidence", value: 12 }, { key: "open", label: "Outstanding matters", value: 3 }]} columns={3} />
    <ReportDocumentSection id="current-position" title="Current Position" description="User-authored case-management position." headingLevel={2}><p>The repair history is recorded. The most recent response and completion date remain outstanding.</p><ReportDocumentCallout variant="limitation" title="Scope limitation">This demonstration contains representative data only.</ReportDocumentCallout></ReportDocumentSection>
    <ReportDocumentSection id="review-notes" title="Review Notes" headingLevel={2} avoidBreakInside><div className="grid gap-3 sm:grid-cols-2"><ReportDocumentCallout variant="information">Supporting context is available.</ReportDocumentCallout><ReportDocumentCallout variant="warning">Review dates before publication.</ReportDocumentCallout><ReportDocumentCallout variant="recommendation">Confirm the next action and owner.</ReportDocumentCallout><ReportDocumentCallout variant="quality">One record has incomplete metadata.</ReportDocumentCallout><ReportDocumentCallout variant="confidentiality">Do not circulate without approval.</ReportDocumentCallout></div></ReportDocumentSection>
    <ReportDocumentSection id="simple-table" title="Reference Table" headingLevel={2}><table className={documentStyles.wideTable}><thead><tr><th className="border-b border-neutral-400 p-2">Reference</th><th className="border-b border-neutral-400 p-2">Description</th></tr></thead><tbody><tr><td className="break-words border-b border-neutral-200 p-2">INC-001</td><td className="break-words border-b border-neutral-200 p-2">Representative factual record</td></tr></tbody></table></ReportDocumentSection>
    <ReportDocumentAppendix id="appendix-a" label="Appendix A" title="Evidence Schedule" description="Complete evidence register for the selected scope."><ReportDocumentSection id="appendix-notes" title="Schedule Notes" headingLevel={3}><p>Appendix content remains owned by the individual report.</p></ReportDocumentSection></ReportDocumentAppendix>
  </ReportDocumentShell>;
}

