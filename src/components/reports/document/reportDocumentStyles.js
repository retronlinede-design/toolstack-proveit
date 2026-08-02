export const documentStyles = Object.freeze({
  shell: "proveit-report-document mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-800 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:bg-white print:text-black print:shadow-none",
  body: "px-5 py-6 sm:px-8 sm:py-8 lg:px-12 print:px-0 print:py-0",
  heading: "break-words font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 print:text-black",
  metadataLabel: "text-xs font-semibold text-neutral-500 dark:text-neutral-400 print:text-neutral-700",
  metadataValue: "mt-1 min-w-0 break-words text-sm leading-6 text-neutral-800 dark:text-neutral-200 print:text-black",
  avoidBreak: "break-inside-avoid print:break-inside-avoid",
  breakBefore: "break-before-page print:break-before-page",
  wideTable: "proveit-report-wide-table w-full table-fixed border-collapse text-left",
});

export const REPORT_DOCUMENT_METADATA_FIELDS = Object.freeze([
  ["purpose", "Purpose"], ["audience", "Intended audience"], ["scope", "Scope"],
  ["reportingPeriod", "Reporting period"], ["exclusions", "Exclusions / limitations"],
  ["completeness", "Completeness"], ["generatedAt", "Generated"],
  ["sourceRevision", "Source revision"], ["preparedBy", "Prepared by"],
  ["approvedBy", "Approved by"], ["version", "Version"],
  ["documentStatus", "Document status"], ["confidentiality", "Confidentiality"],
  ["aiAssistance", "AI assistance"],
]);

