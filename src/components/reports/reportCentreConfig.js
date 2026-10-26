import { normaliseReportScope } from "../../report/reportScopes.js";
import { getReportDefinition } from "../../report/reportDefinitions.js";

export const REPORT_CENTRE_TYPES = Object.freeze([
  "executive", "management", "investigation", "caseAudit", "incidentSchedule", "chronologyReport", "evidence", "document", "ledger", "client", "action",
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

// User-facing wording only: report IDs, builders, and persisted data remain unchanged.
export const REPORT_CENTRE_PRESENTATION = Object.freeze({
  executive: { label: "Executive Report", kind: "Report", preparation: "Default concise briefing for the selected Issue; uses recorded material only." },
  management: { label: "Management Report", kind: "Report", preparation: "A whole-case position briefing for management review." },
  investigation: { label: "Investigation Report", kind: "Report", preparation: "Use an Issue scope when you need a focused investigation view." },
  client: { label: "Client Update Draft", kind: "Draft", preparation: "Requires the existing assisted drafting and human-review workflow." },
  incidentSchedule: { label: "Incident Schedule", kind: "Schedule", preparation: "Structured incident inventory." },
  chronologyReport: { label: "Chronology", kind: "Schedule", preparation: "Date-ordered record schedule." },
  evidence: { label: "Evidence Schedule", kind: "Schedule", preparation: "Structured evidence and relationship schedule." },
  document: { label: "Document Schedule", kind: "Schedule", preparation: "Document metadata and linked-record schedule." },
  ledger: { label: "Ledger Schedule", kind: "Schedule", preparation: "Structured financial and measurable-record schedule." },
  caseAudit: { label: "Case Quality Audit", kind: "Internal tool", preparation: "Checks recorded data quality and relationships; it does not assess legal merit." },
  action: { label: "Operational Brief", kind: "Internal tool", preparation: "Summarises recorded actions, reviews, and data-quality remediation." },
});

export const REPORT_CENTRE_FAMILIES = Object.freeze([
  { id: "professional", label: "Professional Reports", description: "Presentation-oriented documents for management and investigation, grounded in recorded case material.", reports: ["executive", "management", "investigation"] },
  { id: "client", label: "Client Updates", description: "Client-facing drafting and review, including the existing external-GPT workflow and saved history.", reports: ["client"] },
  { id: "technical", label: "Technical Records", description: "Traceable schedules, chronology, diagnostics, and operational source material for evidence review and later report drafting.", reports: ["incidentSchedule", "chronologyReport", "evidence", "document", "ledger", "caseAudit", "action"] },
]);

export function getReportCentreFamily(reportType) {
  return REPORT_CENTRE_FAMILIES.find((family) => family.reports.includes(reportType)) || REPORT_CENTRE_FAMILIES[0];
}

export function getReportCentrePreviewDescription(reportType, scopeType) {
  const scope = normaliseReportScope(reportType, scopeType);
  if (reportType === "executive") return scope === "sequenceGroup" ? "Concise executive briefing for the selected Issue, with traceable recorded material and unresolved matters." : "Concise executive briefing for the whole case, with traceable recorded material and unresolved matters.";
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
  if (reportType === "action") return "Internal operational plan separating recorded case actions from deterministic data-quality corrections.";
  return "Whole-case report preview.";
}
