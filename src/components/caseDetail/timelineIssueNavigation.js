import { resolveCaseIssue } from "../../domain/issueDomain.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveTimelineIssueNavigationTarget(caseData = {}, record = {}) {
  const source = record && typeof record === "object" ? record : {};
  const issueId = text(source.sequenceGroupId);
  if (issueId) return resolveCaseIssue(caseData, { issueId });

  const issueName = text(source.sequenceGroup);
  return issueName ? resolveCaseIssue(caseData, { issueName }) : null;
}
