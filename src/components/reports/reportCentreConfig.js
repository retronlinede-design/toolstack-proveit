import { normaliseReportScope } from "../../report/reportScopes.js";
import { getReportDefinition } from "../../report/reportDefinitions.js";

export const REPORT_CENTRE_TYPES = Object.freeze([
  "management", "investigation", "caseAudit", "incidentSchedule", "chronologyReport", "evidence", "document", "ledger", "client", "action",
].map((value) => {
  const definition = getReportDefinition(value);
  return {
    value,
    label: definition.label,
    description: definition.description,
    audience: definition.audience,
    completeness: definition.completeness,
    supportedScopes: definition.supportedScopes,
    supportedOutputs: definition.supportedOutputs,
  };
}));

export function getReportCentrePreviewDescription(reportType, scopeType) {
  const scope = normaliseReportScope(reportType, scopeType);
  if (reportType === "management") return "Whole-case executive briefing focused on the current position, priority Issues, risks, decisions, and next actions.";
  if (reportType === "investigation") {
    return scope === "sequenceGroup"
      ? "Complete professional investigation document for the selected Issue's declared structured scope."
      : "Complete professional investigation document for the whole-case structured scope.";
  }
  if (reportType === "caseAudit") return "Internal deterministic audit of structured data quality, relationships, metadata, and coverage. It does not assess legal merit.";
  if (reportType === "incidentSchedule") return "Complete incident schedule with structured evidence associations, linked context, and deterministic quality findings.";
  if (reportType === "chronologyReport") return "Complete canonical chronology for directly assigned records in the selected scope.";
  if (reportType === "evidence") return "Uses the complete Evidence Schedule report document.";
  if (reportType === "document") return "Uses the complete Document Schedule report document.";
  if (reportType === "ledger") return "Uses the complete Ledger Schedule report document.";
  if (reportType === "client") return "Whole-case AI-assisted Client Report workflow with draft validation, provenance, and human-review warnings.";
  if (reportType === "action") return "Deterministic action plan assembled from structured case and sequence-group assignments.";
  return "Whole-case report preview.";
}
