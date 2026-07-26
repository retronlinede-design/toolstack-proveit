export const REPORT_SCOPE_SUPPORT = Object.freeze({
  management: Object.freeze(["case"]),
  investigation: Object.freeze(["case", "sequenceGroup"]),
  evidence: Object.freeze(["case", "sequenceGroup"]),
  document: Object.freeze(["case", "sequenceGroup"]),
  ledger: Object.freeze(["case", "sequenceGroup"]),
  client: Object.freeze(["case"]),
  action: Object.freeze(["case", "sequenceGroup"]),
});

const WHOLE_CASE_ONLY = Object.freeze(["case"]);

export function getSupportedReportScopes(reportType) {
  return REPORT_SCOPE_SUPPORT[reportType] || WHOLE_CASE_ONLY;
}

export function reportSupportsScope(reportType, scope) {
  return getSupportedReportScopes(reportType).includes(scope);
}

export function normaliseReportScope(reportType, requestedScope) {
  return reportSupportsScope(reportType, requestedScope) ? requestedScope : "case";
}

export const normalizeReportScope = normaliseReportScope;
