import {
  getActiveReportDefinitions,
  getReportDefinition,
  normaliseReportScopeFromDefinition,
  reportSupportsScope as definitionSupportsScope,
} from "./reportDefinitions.js";

export const REPORT_SCOPE_SUPPORT = Object.freeze(Object.fromEntries(
  getActiveReportDefinitions().map((definition) => [definition.id, definition.supportedScopes])
));

export function getSupportedReportScopes(reportType) {
  return getReportDefinition(reportType).supportedScopes;
}

export function reportSupportsScope(reportType, scope) {
  return definitionSupportsScope(reportType, scope);
}

export function normaliseReportScope(reportType, requestedScope) {
  return normaliseReportScopeFromDefinition(reportType, requestedScope);
}

export const normalizeReportScope = normaliseReportScope;
