import { normaliseReportScope } from "../../report/reportScopes.js";
import { getReportDefinition } from "../../report/reportDefinitions.js";

export const REPORT_CENTRE_TYPES = Object.freeze([
  "management", "investigation", "evidence", "document", "ledger", "client", "action",
].map((value) => {
  const definition = getReportDefinition(value);
  return { value, label: definition.label, description: definition.description };
}));

export function getReportCentrePreviewDescription(reportType, scopeType) {
  const scope = normaliseReportScope(reportType, scopeType);
  if (reportType === "management") return "Whole-case management summary focused on findings, risks, awareness items, outstanding issues, and actions. Its key timeline is currently limited to five entries.";
  if (reportType === "investigation") {
    return scope === "sequenceGroup"
      ? "Focused Thread / Issue Report for the selected sequence group."
      : "Bounded investigation overview. It does not include a complete incident schedule and previews at most 12 evidence records and 12 documents.";
  }
  if (reportType === "evidence") return "Uses the complete Evidence Schedule report document.";
  if (reportType === "document") return "Uses the existing Document Pack builder.";
  if (reportType === "ledger") return "Uses the existing Ledger Pack builder.";
  if (reportType === "client") return "Whole-case GPT-generated Client Report workflow and renderer.";
  if (reportType === "action") return "Deterministic action plan assembled from structured case and sequence-group assignments.";
  return "Whole-case report preview.";
}
