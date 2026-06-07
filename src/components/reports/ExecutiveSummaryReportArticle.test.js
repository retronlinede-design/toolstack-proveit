import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/reports/ExecutiveSummaryReportArticle.jsx", "utf8");

test("ExecutiveSummaryReportArticle prefers sequenceChains when present", () => {
  assert.match(source, /const sequenceChains = Array\.isArray\(report\.sequenceChains\)/);
  assert.match(source, /const hasSequenceChainReport = Object\.prototype\.hasOwnProperty\.call\(report, "sequenceChains"\)/);
  assert.match(source, /if \(hasSequenceChainReport\)/);
  assert.match(source, /Sequence Chain Briefings/);
});

test("ExecutiveSummaryReportArticle renders chain facts, proof, gaps, risks, actions, and references", () => {
  assert.match(source, /Issue summary/);
  assert.match(source, /Management importance/);
  assert.match(source, /Decision needed/);
  assert.match(source, /Facts/);
  assert.match(source, /Proof \/ What this establishes/);
  assert.match(source, /Gaps/);
  assert.match(source, /Risks/);
  assert.match(source, /Actions/);
  assert.match(source, /Supporting records/);
  assert.match(source, /Reference documents/);
});

test("ExecutiveSummaryReportArticle uses functionSummary output and missing proof warnings", () => {
  assert.match(source, /item\.establishes/);
  assert.match(source, /item\.missingFunctionSummary/);
  assert.match(source, /Evidence present, but proof purpose is not defined\./);
});

test("ExecutiveSummaryReportArticle applies v1 polish only to executive and chain brief fields", () => {
  assert.match(source, /parseManagementReportV1Polish/);
  assert.match(source, /v1Polish\.executiveBrief/);
  assert.match(source, /polishedBrief=\{v1Polish\.chainBriefs\?\.\[chain\.id\]/);
  assert.match(source, /polishedBrief\.issueSummary \|\| chain\.briefing\?\.issueSummary/);
  assert.match(source, /polishedBrief\.managementImportance \|\| chain\.briefing\?\.managementImportance/);
  assert.match(source, /polishedBrief\.decisionNeeded \|\| chain\.briefing\?\.decisionNeeded/);
});

test("ExecutiveSummaryReportArticle keeps deterministic proof gaps risks actions and references", () => {
  assert.match(source, /const proof = Array\.isArray\(chain\.proof\)/);
  assert.match(source, /const records = Array\.isArray\(chain\.records\)/);
  assert.match(source, /const gaps = Array\.isArray\(chain\.gaps\)/);
  assert.match(source, /const risks = Array\.isArray\(chain\.risks\)/);
  assert.match(source, /const actions = Array\.isArray\(chain\.actions\)/);
  assert.match(source, /const referenceDocuments = Array\.isArray\(chain\.referenceDocuments\)/);
  assert.match(source, /Sequence chain facts, proof, gaps, risks, actions, references, counts, and statuses remain deterministic/);
});

test("ExecutiveSummaryReportArticle shows a v1 empty state when no sequence chains exist", () => {
  assert.match(source, /No sequence chains are available for this management report/);
  assert.match(source, /Add sequenceGroup labels to incidents, evidence, documents, ledger entries, or strategy records/);
});

test("ExecutiveSummaryReportArticle labels documents as reference material", () => {
  assert.match(source, /Reference material/);
  assert.match(source, /not treated as proof by default/);
});

test("ExecutiveSummaryReportArticle keeps old report fallback layout", () => {
  assert.match(source, /return \(\s*<article className=\{className\}>/m);
  assert.match(source, /Key Findings/);
  assert.match(source, /Supporting Appendix Summary/);
  assert.match(source, /Short Chronology Preview/);
});
