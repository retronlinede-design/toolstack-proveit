import { getIssueDisplayLabel } from "../../domain/issueDomain.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getReportCentreIssueOptions(caseItem = {}) {
  return (Array.isArray(caseItem.issues) ? caseItem.issues : [])
    .map((issue) => ({ id: text(issue?.id), name: text(issue?.name), label: getIssueDisplayLabel(issue || {}) }))
    .filter((issue) => issue.id);
}

export function resolveReportCentreIssueSelection(issueOptions = [], issueId = "") {
  const requestedIssueId = text(issueId);
  const selectedIssue = issueOptions.find((issue) => issue.id === requestedIssueId) || null;
  return {
    requestedIssueId,
    selectedIssue,
    isValid: Boolean(selectedIssue),
    displayLabel: selectedIssue?.label || "",
    sequenceGroupName: selectedIssue?.name || "",
  };
}
