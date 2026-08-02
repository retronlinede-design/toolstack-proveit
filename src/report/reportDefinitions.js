const ACTIVE = "active";
const PLANNED = "planned";

export const REPORT_DEFINITIONS = Object.freeze({
  management: Object.freeze({
    id: "management", label: "Management Report", description: "Concise professional report for managers, HR, and executives.", audience: "management",
    supportedScopes: Object.freeze(["case"]), supportedOutputs: Object.freeze(["preview", "print"]),
    recordTypes: Object.freeze(["incident", "evidence", "document", "ledger", "strategy", "watch"]),
    completeness: "summary", includeArchived: true, aiPolicy: "optional-narrative-polish", status: ACTIVE,
  }),
  investigation: Object.freeze({
    id: "investigation", label: "Investigation Report", description: "Explain the investigation and its current position.", audience: "investigation",
    supportedScopes: Object.freeze(["case", "sequenceGroup"]), supportedOutputs: Object.freeze(["preview", "print", "markdown", "json"]),
    recordTypes: Object.freeze(["incident", "evidence", "document", "ledger", "strategy", "watch"]),
    completeness: "complete", includeArchived: true, aiPolicy: "none", status: ACTIVE,
  }),
  evidence: Object.freeze({
    id: "evidence", label: "Evidence Pack", description: "Evidence matrix and supporting material.", audience: "investigation",
    supportedScopes: Object.freeze(["case", "sequenceGroup"]), supportedOutputs: Object.freeze(["preview", "print", "markdown", "json"]),
    recordTypes: Object.freeze(["evidence", "incident"]), completeness: "complete", includeArchived: true, aiPolicy: "none", status: ACTIVE,
  }),
  document: Object.freeze({
    id: "document", label: "Document Pack", description: "Source document matrix, linked records, and attachment metadata.", audience: "investigation",
    supportedScopes: Object.freeze(["case", "sequenceGroup"]), supportedOutputs: Object.freeze(["preview", "print", "markdown", "json"]),
    recordTypes: Object.freeze(["document", "incident", "evidence", "strategy"]), completeness: "complete", includeArchived: true, aiPolicy: "none", status: ACTIVE,
  }),
  ledger: Object.freeze({
    id: "ledger", label: "Ledger Pack", description: "Financial, payment, and measurable record review.", audience: "investigation",
    supportedScopes: Object.freeze(["case", "sequenceGroup"]), supportedOutputs: Object.freeze(["preview", "print", "markdown", "json"]),
    recordTypes: Object.freeze(["ledger", "evidence", "document"]), completeness: "complete", includeArchived: true, aiPolicy: "none", status: ACTIVE,
  }),
  client: Object.freeze({
    id: "client", label: "Client Report", description: "GPT-assisted client-facing report drafting and rendering.", audience: "client",
    supportedScopes: Object.freeze(["case"]), supportedOutputs: Object.freeze(["preview", "print"]),
    recordTypes: Object.freeze(["incident", "evidence", "document", "ledger", "strategy", "watch"]),
    completeness: "summary", includeArchived: true, aiPolicy: "generated-narrative", status: ACTIVE,
  }),
  action: Object.freeze({
    id: "action", label: "Action Plan", description: "Outstanding issues, next steps, risks, and recommendations.", audience: "internal",
    supportedScopes: Object.freeze(["case", "sequenceGroup"]), supportedOutputs: Object.freeze(["preview", "print", "markdown"]),
    recordTypes: Object.freeze(["incident", "evidence", "document", "strategy", "watch"]), completeness: "summary", includeArchived: false, aiPolicy: "none", status: ACTIVE,
  }),
  caseAudit: Object.freeze({
    id: "caseAudit", label: "Case Audit Report", description: "Internal deterministic audit of case data quality, structure, and recorded relationships.", audience: "internal",
    supportedScopes: Object.freeze(["case", "sequenceGroup"]), supportedOutputs: Object.freeze(["preview", "print", "markdown", "json"]),
    recordTypes: Object.freeze(["incident", "evidence", "document", "ledger", "strategy", "watch"]), completeness: "complete", includeArchived: true, aiPolicy: "none", status: ACTIVE,
  }),
  incidentSchedule: Object.freeze({
    id: "incidentSchedule", label: "Incident Schedule", description: "Complete incident schedule with structured evidence coverage and quality findings.", audience: "investigation",
    supportedScopes: Object.freeze(["case", "sequenceGroup"]), supportedOutputs: Object.freeze(["preview", "print", "markdown", "json"]),
    recordTypes: Object.freeze(["incident", "evidence", "document", "strategy", "watch", "ledger"]), completeness: "complete", includeArchived: true, aiPolicy: "none", status: ACTIVE,
  }),
  chronologyReport: Object.freeze({
    id: "chronologyReport", label: "Chronology Report", description: "Complete canonical chronology across all supported record types.", audience: "investigation",
    supportedScopes: Object.freeze(["case", "sequenceGroup"]), supportedOutputs: Object.freeze(["preview", "print", "markdown", "json"]),
    recordTypes: Object.freeze(["incident", "evidence", "document", "ledger", "strategy", "watch"]), completeness: "complete", includeArchived: true, aiPolicy: "none", status: ACTIVE,
  }),
});

const UNKNOWN_REPORT_DEFINITION = Object.freeze({
  id: "unknown", label: "Unknown Report", description: "", audience: "internal",
  supportedScopes: Object.freeze(["case"]), supportedOutputs: Object.freeze([]), recordTypes: Object.freeze([]),
  completeness: "summary", includeArchived: true, aiPolicy: "none", status: PLANNED,
});

export function getReportDefinition(reportId) {
  return REPORT_DEFINITIONS[reportId] || UNKNOWN_REPORT_DEFINITION;
}

export function getActiveReportDefinitions() {
  return Object.values(REPORT_DEFINITIONS).filter((definition) => definition.status === ACTIVE);
}

export function reportSupportsScope(reportId, scope) {
  return getReportDefinition(reportId).supportedScopes.includes(scope);
}

export const reportDefinitionSupportsScope = reportSupportsScope;

export function reportSupportsOutput(reportId, output) {
  return getReportDefinition(reportId).supportedOutputs.includes(output);
}

export function normaliseReportScopeFromDefinition(reportId, requestedScope) {
  return reportSupportsScope(reportId, requestedScope) ? requestedScope : "case";
}
