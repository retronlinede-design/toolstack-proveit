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

test("markdown export includes the same key sections and examples", () => {
  const markdown = exportGptProtocolPackMarkdown({ exportedAt: "2026-06-10T00:00:00.000Z" });

  REQUIRED_SECTIONS.forEach((sectionTitle) => {
    assert.match(markdown, new RegExp(`## ${sectionTitle}`));
  });

  assert.match(markdown, /Export type: PROVEIT_GPT_PROTOCOL_PACK/);
  assert.match(markdown, /Importable: false/);
  assert.match(markdown, /Includes binary data: false/);
  assert.match(markdown, /### Management Analysis Handoff/);
  assert.match(markdown, /### Report Builder Output/);
  assert.match(markdown, /### Missing Function Summary Suggestion/);
  assert.match(markdown, /### Weak Links Recommendation/);
  assert.match(markdown, /### Safe gpt-delta Update Example/);
  assert.match(markdown, /### Safe Sequence Group Delta Example/);
  assert.match(markdown, /Do not invent facts/);
  assert.match(markdown, /Never delete records/);
});
