import { resolveCaseIssue } from "../../domain/issueDomain.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Resolves a manager selection without ever substituting a name for a supplied
 * canonical ID. Names remain a compatibility route for legacy-only groups.
 */
export function resolveSequenceGroupSelection(caseData, groups, { issueId = "", groupName = "" } = {}) {
  const normalizedIssueId = text(issueId);
  const normalizedGroupName = text(groupName);
  const availableGroups = Array.isArray(groups) ? groups : [];

  if (normalizedIssueId) {
    const issue = resolveCaseIssue(caseData, { issueId: normalizedIssueId });
    if (!issue) return { group: null, issue: null, invalidCanonicalSelection: true };
    const group = availableGroups.find((item) => item?.issue?.id === issue.id) || null;
    return { group, issue, invalidCanonicalSelection: !group };
  }

  if (!normalizedGroupName) return { group: null, issue: null, invalidCanonicalSelection: false };
  const matchingGroups = availableGroups.filter((item) => item?.name === normalizedGroupName);
  if (matchingGroups.length !== 1) return { group: null, issue: null, invalidCanonicalSelection: false };
  const group = matchingGroups[0];
  return { group, issue: group.issue || resolveCaseIssue(caseData, { issueName: normalizedGroupName }), invalidCanonicalSelection: false };
}

/**
 * Resolves an editor return target. A stale canonical ID deliberately does not
 * fall back to a display name, preventing a record from opening the wrong Issue.
 */
export function resolveSequenceGroupReturnTarget(caseData, { issueId = "", groupName = "" } = {}) {
  const normalizedIssueId = text(issueId);
  const normalizedGroupName = text(groupName);
  if (normalizedIssueId) {
    const issue = resolveCaseIssue(caseData, { issueId: normalizedIssueId });
    return issue ? { issue, groupName: issue.name, invalidCanonicalSelection: false } : { issue: null, groupName: "", invalidCanonicalSelection: true };
  }
  const issue = normalizedGroupName ? resolveCaseIssue(caseData, { issueName: normalizedGroupName }) : null;
  return { issue, groupName: issue?.name || normalizedGroupName, invalidCanonicalSelection: false };
}

export function didSequenceGroupSelectionChange(previousSelection = {}, nextSelection = {}) {
  const previousIssueId = text(previousSelection.issue?.id);
  const nextIssueId = text(nextSelection.issue?.id);
  if (previousIssueId && nextIssueId) return previousIssueId !== nextIssueId;
  return Boolean(text(previousSelection.groupName) && text(nextSelection.groupName) && text(previousSelection.groupName) !== text(nextSelection.groupName));
}
