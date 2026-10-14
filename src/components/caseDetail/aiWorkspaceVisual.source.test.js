import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../CaseDetail.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("AI Workspace exposes a dedicated dark-navy styling scope", () => {
  assert.match(workspace, /className="ai-workspace-modal flex max-h-\[90vh\]/);
  assert.match(styles, /\.ai-workspace-modal \{ border: 1px solid var\(--pi-border\)/);
  assert.match(styles, /\[data-ai-workspace-navigation\]/);
  assert.match(styles, /\[data-ai-workspace-details\]/);
  assert.match(styles, /var\(--pi-accent\)/);
});

test("AI Workspace task selection has explicit state and keyboard-visible focus", () => {
  assert.match(workspace, /data-ai-workspace-task/);
  assert.match(workspace, /aria-current=\{activeAiTask === task\.id \? "page" : undefined\}/);
  assert.match(styles, /\[data-ai-workspace-task\]\[aria-current="page"\]/);
  assert.match(styles, /\[data-ai-workspace-task\]\):focus-visible/);
});

test("AI Workspace keeps feedback announced and contextual actions persistently reachable", () => {
  assert.match(workspace, /data-ai-workspace-feedback role="status" aria-live="polite"/);
  assert.match(workspace, /data-ai-workspace-actions className="ai-workspace-actions sticky bottom-0 z-10/);
  assert.match(styles, /\.ai-workspace-actions \{ border-top: 1px solid var\(--pi-border\)/);
});
