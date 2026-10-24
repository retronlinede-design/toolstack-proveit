import { resolveCaseIssue } from "../domain/issueDomain.js";

const text = (value) => typeof value === "string" ? value.trim() : "";
const normalizedName = (value) => text(value).replace(/\s+/g, " ").toLocaleLowerCase();
const issues = (caseData) => Array.isArray(caseData?.issues) ? caseData.issues : [];

/**
 * Resolves an export scope without ever using an editable display name as a
 * substitute for a supplied canonical Issue ID. A name-only scope is retained
 * solely for genuinely legacy records, and is rejected when ambiguous.
 */
export function resolveIssueExportScope(caseData = {}, selection = "") {
  const input = selection && typeof selection === "object" && !Array.isArray(selection)
    ? selection
    : { issueName: selection };
  const issueId = text(input.issueId);
  const requestedName = text(input.issueName || input.legacyName);

  if (issueId) {
    const issue = resolveCaseIssue(caseData, { issueId });
    if (!issue) throw new Error("The selected canonical Issue is no longer available. Choose an Issue again before exporting.");
    const sameNameIssues = issues(caseData).filter((candidate) => normalizedName(candidate?.name) === normalizedName(issue.name));
    return {
      kind: "canonical",
      issueId: issue.id,
      name: issue.name,
      issue,
      // A legacy record does not carry an ID. It can only be included when its
      // display name identifies one canonical Issue and cannot join two
      // same-named Issues in a handoff pack.
      allowLegacyNameFallback: sameNameIssues.length === 1,
    };
  }

  if (!requestedName) throw new Error("An Issue is required for this export.");
  const matches = issues(caseData).filter((issue) => normalizedName(issue?.name) === normalizedName(requestedName));
  if (matches.length > 1) throw new Error("This Issue name is ambiguous. Select the canonical Issue again before exporting.");
  if (matches.length === 1) {
    const issue = matches[0];
    return { kind: "canonical", issueId: issue.id, name: issue.name, issue, allowLegacyNameFallback: true };
  }

  return { kind: "legacy", issueId: "", name: requestedName, issue: null };
}

export function recordMatchesIssueExportScope(record = {}, scope) {
  if (!scope) return false;
  const recordIssueId = text(record?.sequenceGroupId);
  if (scope.issueId) {
    if (recordIssueId) return recordIssueId === scope.issueId;
    return Boolean(scope.allowLegacyNameFallback)
      && normalizedName(record?.sequenceGroup) === normalizedName(scope.name);
  }
  return !recordIssueId && normalizedName(record?.sequenceGroup) === normalizedName(scope.name);
}

export function filterIssueExportRecords(records = [], scope) {
  return (Array.isArray(records) ? records : []).filter((record) => recordMatchesIssueExportScope(record, scope));
}
