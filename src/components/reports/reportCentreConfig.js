import { normaliseReportScope } from "../../report/reportScopes.js";

export const REPORT_CENTRE_TYPES = Object.freeze([
  { value: "management", label: "Management Report", description: "Concise professional report for managers, HR, and executives." },
  { value: "investigation", label: "Investigation Report", description: "A focused thread report or bounded whole-case investigation overview." },
  { value: "evidence", label: "Evidence Pack", description: "Evidence matrix and supporting material." },
  { value: "document", label: "Document Pack", description: "Source document matrix, linked records, and attachment metadata." },
  { value: "ledger", label: "Ledger Pack", description: "Financial, payment, and measurable record review." },
  { value: "client", label: "Client Report", description: "GPT-assisted client-facing report drafting and rendering." },
  { value: "action", label: "Action Plan", description: "Outstanding issues, next steps, risks, and recommendations." },
]);

export function getReportCentrePreviewDescription(reportType, scopeType) {
  const scope = normaliseReportScope(reportType, scopeType);
  if (reportType === "management") return "Whole-case management summary focused on findings, risks, awareness items, outstanding issues, and actions. Its key timeline is currently limited to five entries.";
  if (reportType === "investigation") {
    return scope === "sequenceGroup"
      ? "Focused Thread / Issue Report for the selected sequence group."
      : "Bounded investigation overview. It does not include a complete incident schedule and previews at most 12 evidence records and 12 documents.";
  }
  if (reportType === "evidence") return "Uses the existing Evidence Pack builder.";
  if (reportType === "document") return "Uses the existing Document Pack builder.";
  if (reportType === "ledger") return "Uses the existing Ledger Pack builder.";
  if (reportType === "client") return "Whole-case GPT-generated Client Report workflow and renderer.";
  if (reportType === "action") return "Deterministic action plan assembled from structured case and sequence-group assignments.";
  return "Whole-case report preview.";
}
