import { resolveCaseIssue } from "../../domain/issueDomain.js";

export const TIMELINE_ALL_ISSUES_FILTER = "all";
export const TIMELINE_UNASSIGNED_ISSUES_FILTER = "__ungrouped__";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isTimelineIssueFilterValid(caseData = {}, filterId) {
  const value = text(filterId);
  if (value === TIMELINE_ALL_ISSUES_FILTER || value === TIMELINE_UNASSIGNED_ISSUES_FILTER) return true;
  return Boolean(resolveCaseIssue(caseData, { issueId: value }));
}

export function isTimelineItemInIssueFilter(caseData = {}, timelineItem = {}, filterId) {
  const value = text(filterId);
  if (value === TIMELINE_ALL_ISSUES_FILTER) return true;

  const source = timelineItem?.source && typeof timelineItem.source === "object" ? timelineItem.source : {};
  const sourceIssueId = text(source.sequenceGroupId);
  const sourceIssueName = text(source.sequenceGroup);

  if (value === TIMELINE_UNASSIGNED_ISSUES_FILTER) {
    return !sourceIssueId && !sourceIssueName;
  }

  const selectedIssue = resolveCaseIssue(caseData, { issueId: value });
  if (!selectedIssue) return false;
  if (sourceIssueId) return sourceIssueId === selectedIssue.id;
  if (!sourceIssueName) return false;

  // Old records can contain only a display name. Match those only when that
  // name resolves to exactly one canonical Issue; duplicate names stay hidden.
  return resolveCaseIssue(caseData, { issueName: sourceIssueName })?.id === selectedIssue.id;
}
