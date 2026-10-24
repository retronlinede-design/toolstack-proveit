import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../CaseDetail.jsx", import.meta.url);

test("Case Documentation stores canonical Issue IDs and does not select a first fallback Issue", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const \[threadIssueReportIssueId, setThreadIssueReportIssueId\] = useState\(""\)/);
  assert.match(source, /const \[caseBundleIssueId, setCaseBundleIssueId\] = useState\(""\)/);
  assert.match(source, /resolveReportCentreIssueSelection\(reportCentreIssues, threadIssueReportIssueId\)/);
  assert.match(source, /resolveReportCentreIssueSelection\(reportCentreIssues, caseBundleIssueId\)/);
  assert.match(source, /issueId: selectedCaseBundleIssue\?\.id/);
  assert.doesNotMatch(source, /threadIssueReportSequenceOptions/);
  assert.doesNotMatch(source, /threadIssueReportSequenceOptions\[0\]/);
});

test("Case Documentation blocks printing an unavailable selected Issue instead of changing scope", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /disabled=\{caseBundleScopeType === "sequenceGroup" && !selectedCaseBundleIssue\}/);
  assert.match(source, /disabled=\{!selectedThreadIssueReportIssue\}/);
  assert.match(source, /Issue no longer available\. Choose another Issue\./);
});
