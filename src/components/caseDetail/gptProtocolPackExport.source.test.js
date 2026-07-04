import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/CaseDetail.jsx", "utf8");

test("header export menu exposes GPT protocol pack downloads", () => {
  assert.match(source, /exportGptProtocolPackJson/);
  assert.match(source, /exportGptProtocolPackMarkdown/);
  assert.match(source, /function handleDownloadGptProtocolPackJson/);
  assert.match(source, /function handleDownloadGptProtocolPackMarkdown/);
  assert.match(source, /Data \/ AI Reference/);
  assert.match(source, /Download GPT Protocol Pack JSON/);
  assert.match(source, /Download GPT Protocol Pack Markdown/);
});

test("GPT protocol pack buttons download JSON and Markdown without changing case data", () => {
  assert.match(source, /downloadTextFile\(JSON\.stringify\(payload, null, 2\), getGptProtocolPackFilename\("json"\), "application\/json"\)/);
  assert.match(source, /downloadTextFile\(markdown, getGptProtocolPackFilename\("md"\), "text\/markdown"\)/);
  assert.doesNotMatch(source, /function handleDownloadGptProtocolPackJson\(\) \{[^}]*onUpdateCase/);
  assert.doesNotMatch(source, /function handleDownloadGptProtocolPackMarkdown\(\) \{[^}]*onUpdateCase/);
});
