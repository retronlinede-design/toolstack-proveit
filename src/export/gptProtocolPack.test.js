import test from "node:test";
import assert from "node:assert/strict";

import {
  PROVEIT_GPT_PROTOCOL_PACK,
  exportGptProtocolPackJson,
  exportGptProtocolPackMarkdown,
} from "./gptProtocolPack.js";

const REQUIRED_SECTIONS = [
  "ProveIt Overview",
  "Record Types",
  "Field Meaning Rules",
  "Linking Rules",
  "Export Types",
  "AI Pack Types",
  "Report Builder Workflow",
  "Specialist Handoff Workflow",
  "Delta Rules",
  "Real Accepted gpt-delta-2.0 Contract",
  "Supported Create Collections",
  "Supported Patch Collections",
  "Create Incident + Evidence Example",
  "Patch Example",
  "Temporary ID Rules",
  "Unsupported Contracts",
  "Strategy Limitation",
  "Safe Output Rules",
  "Examples",
  "Forbidden Behavior",
];

test("protocol JSON has the expected safe export envelope", () => {
  const pack = exportGptProtocolPackJson({ exportedAt: "2026-06-10T00:00:00.000Z" });

  assert.equal(pack.app, "proveit");
  assert.equal(pack.exportType, PROVEIT_GPT_PROTOCOL_PACK);
  assert.equal(pack.importable, false);
  assert.equal(pack.includesBinaryData, false);
  assert.equal(pack.exportedAt, "2026-06-10T00:00:00.000Z");
});

test("protocol JSON includes required sections and safety rules", () => {
  const pack = exportGptProtocolPackJson();
  const sectionTitles = pack.sections.map((section) => section.title);
  const serialized = JSON.stringify(pack);

  assert.deepEqual(sectionTitles, REQUIRED_SECTIONS);
  assert.match(serialized, /Do not invent facts/);
  assert.match(serialized, /Do not generate deltas unless explicitly asked/);
  assert.match(serialized, /Do not mutate case data/);
  assert.match(serialized, /Do not treat documents as proof/);
  assert.match(serialized, /Evidence meaning comes from functionSummary/);
  assert.match(serialized, /Records\/ledger are strongest measurable proof/);
  assert.match(serialized, /Preserve IDs/);
  assert.match(serialized, /Use source IDs in recommendations/);
  assert.match(serialized, /Never include binary data/);
  assert.match(serialized, /Never output unsupported schema fields/);
  assert.match(serialized, /Never delete records/);
});

test("protocol JSON includes delta rules, export descriptions, and examples", () => {
  const pack = exportGptProtocolPackJson();
  const serialized = JSON.stringify(pack);

  assert.match(serialized, /gpt-delta-2\.0/);
  assert.match(serialized, /sequence-group-delta-1\.0/);
  assert.match(serialized, /CASE_REASONING_EXPORT/);
  assert.match(serialized, /GPT_AUDIT_PACK/);
  assert.match(serialized, /MANAGEMENT_REPORT_BUILDER_PACK/);
  assert.match(serialized, /FULL_CHAIN_GPT_PACK/);
  assert.match(serialized, /GPT_RECORD_EXPORT/);
  assert.match(serialized, /GPT_RECORDS_EXPORT/);
  assert.ok(pack.examples.managementAnalysisHandoff);
  assert.ok(pack.examples.reportBuilderOutput);
  assert.ok(pack.examples.missingFunctionSummarySuggestion);
  assert.ok(pack.examples.weakLinksRecommendation);
  assert.ok(pack.examples.safeGptDeltaUpdateExample);
  assert.ok(pack.examples.safeSequenceGroupDeltaExample);
});

test("protocol JSON documents the real gpt-delta-2.0 contract", () => {
  const pack = exportGptProtocolPackJson();
  const serialized = JSON.stringify(pack);

  assert.equal(pack.examples.realAcceptedGptDelta2Contract.app, "proveit");
  assert.equal(pack.examples.realAcceptedGptDelta2Contract.contractVersion, "gpt-delta-2.0");
  assert.deepEqual(pack.examples.realAcceptedGptDelta2Contract.target, { caseId: "case-1" });
  assert.deepEqual(pack.examples.realAcceptedGptDelta2Contract.operations, { create: {}, patch: {} });
  assert.match(serialized, /Supported create collection: incidents/);
  assert.match(serialized, /Supported create collection: evidence/);
  assert.match(serialized, /Supported create collection: documents/);
  assert.match(serialized, /Supported create collection: ledger/);
  assert.match(serialized, /Not supported: strategy create/);
  assert.match(serialized, /Strategy create is not supported in gpt-delta-2\.0/);
  assert.match(serialized, /Strategy patch is supported in gpt-delta-2\.0/);
});

test("protocol JSON includes accepted create and patch examples plus invalid wrappers", () => {
  const pack = exportGptProtocolPackJson();
  const serialized = JSON.stringify(pack);

  assert.equal(pack.examples.createIncidentEvidenceExample.operations.create.incidents[0].tempId, "tmp-inc-repair-delay");
  assert.deepEqual(pack.examples.createIncidentEvidenceExample.operations.create.incidents[0].linkedEvidenceIds, ["tmp-ev-repair-photo"]);
  assert.deepEqual(pack.examples.createIncidentEvidenceExample.operations.create.evidence[0].linkedIncidentIds, ["tmp-inc-repair-delay"]);
  assert.deepEqual(pack.examples.patchExample.operations.patch.evidence[0], {
    id: "ev-1",
    patch: {
      functionSummary: "Shows the reported repair condition on the same date as incident inc-1.",
    },
  });
  assert.equal(pack.examples.safeGptDeltaUpdateExample.delta.contractVersion, "gpt-delta-2.0");
  assert.ok(pack.examples.safeGptDeltaUpdateExample.delta.operations.patch.evidence);
  assert.doesNotMatch(JSON.stringify(pack.examples.safeGptDeltaUpdateExample), /"op":"update"/);
  assert.match(serialized, /\{"operations":\[\]\}/);
  assert.match(serialized, /\{"changes":\[\]\}/);
  assert.match(serialized, /\{"delta":\{"operations":\{\}\}\}/);
  assert.match(serialized, /\{"operations":\[\{"op":"create"\}\]\}/);
});

test("markdown export includes the same key sections and examples", () => {
  const markdown = exportGptProtocolPackMarkdown({ exportedAt: "2026-06-10T00:00:00.000Z" });

  REQUIRED_SECTIONS.forEach((sectionTitle) => {
    assert.ok(markdown.includes(`## ${sectionTitle}`));
  });

  assert.match(markdown, /Export type: PROVEIT_GPT_PROTOCOL_PACK/);
  assert.match(markdown, /Importable: false/);
  assert.match(markdown, /Includes binary data: false/);
  assert.match(markdown, /### Management Analysis Handoff/);
  assert.match(markdown, /### Report Builder Output/);
  assert.match(markdown, /### Missing Function Summary Suggestion/);
  assert.match(markdown, /### Weak Links Recommendation/);
  assert.match(markdown, /### Safe gpt-delta Update Example/);
  assert.match(markdown, /### Real Accepted gpt-delta-2\.0 Contract/);
  assert.match(markdown, /### Create Incident \+ Evidence Example/);
  assert.match(markdown, /### Patch Example/);
  assert.match(markdown, /### Unsupported Contract Examples/);
  assert.match(markdown, /### Strategy Limitation/);
  assert.match(markdown, /"contractVersion": "gpt-delta-2\.0"/);
  assert.match(markdown, /"caseId": "case-1"/);
  assert.match(markdown, /"create": \{\}/);
  assert.match(markdown, /"patch": \{\}/);
  assert.match(markdown, /Supported create collection: incidents/);
  assert.match(markdown, /Supported create collection: evidence/);
  assert.match(markdown, /Supported create collection: documents/);
  assert.match(markdown, /Supported create collection: ledger/);
  assert.match(markdown, /Strategy create is not supported in gpt-delta-2\.0/);
  assert.match(markdown, /"operations": \[\]/);
  assert.match(markdown, /"changes": \[\]/);
  assert.match(markdown, /"delta": \{/);
  assert.match(markdown, /"op": "create"/);
  assert.match(markdown, /### Safe Sequence Group Delta Example/);
  assert.match(markdown, /Do not invent facts/);
  assert.match(markdown, /Never delete records/);
});
