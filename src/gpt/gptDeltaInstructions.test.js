import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const caseDetailSource = readFileSync("src/components/CaseDetail.jsx", "utf8");
const gptDeltaModalSource = readFileSync("src/components/gpt/GptDeltaModal.jsx", "utf8");
const sequenceGroupDeltaSource = readFileSync("src/gpt/sequenceGroupDelta.js", "utf8");

test("AI-facing GPT delta instructions describe the current v1 and v2 contract", () => {
  assert.match(caseDetailSource, /gpt-delta-1\.0 supports only operations\.patch\.actionSummary and operations\.patch\.strategy/);
  assert.match(caseDetailSource, /gpt-delta-2\.0 supports operations\.create\.incidents, operations\.create\.evidence, operations\.create\.documents, operations\.create\.ledger/);
  assert.match(caseDetailSource, /operations\.patch\.incidents, operations\.patch\.evidence, operations\.patch\.documents, operations\.patch\.ledger, operations\.patch\.strategy/);
  assert.match(caseDetailSource, /gpt-delta-2\.0 does not support operations\.patch\.actionSummary or operations\.create\.strategy/);
  assert.doesNotMatch(caseDetailSource, /GPT delta updates are currently limited to actionSummary and strategy patches/);
});

test("GPT delta UI copy warns about forbidden fields, ID rules, and full replacement arrays", () => {
  assert.match(gptDeltaModalSource, /gpt-delta-1\.0 supports only actionSummary and strategy patches/);
  assert.match(gptDeltaModalSource, /gpt-delta-2\.0 supports incident, evidence, document, and ledger creates/);
  assert.match(gptDeltaModalSource, /does not support actionSummary patches or strategy creates/);
  assert.match(gptDeltaModalSource, /attachments, binary payloads, files, dataUrl, backupDataUrl, delete operations, schema changes, unsupported fields, guessed IDs, or partial array append instructions/);
  assert.match(gptDeltaModalSource, /Patch IDs must be existing record IDs/);
});

test("sequence group instructions point cleanup deltas to sequence-group-delta-1.0", () => {
  assert.match(caseDetailSource, /sequence group cleanup belongs to sequence-group-delta-1\.0, not gpt-delta-2\.0/);
  assert.match(sequenceGroupDeltaSource, /return only sequence-group-delta-1\.0/);
});
