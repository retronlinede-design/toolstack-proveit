import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("./AiWorkspaceTab.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("AI Workspace exposes a dedicated dark-navy styling scope", () => {
  assert.match(workspace, /className="case-file-ai-workspace"/);
  assert.match(styles, /\.case-file-ai-workspace \{ border: 1px solid var\(--pi-border\)/);
  assert.match(styles, /case-file-ai-workspace-layout/);
  assert.match(styles, /\[data-ai-workspace-rail\]/);
  assert.match(styles, /\[data-ai-workspace-navigation\]/);
  assert.match(styles, /\[data-ai-workspace-primary\]/);
  assert.match(styles, /var\(--pi-accent\)/);
});

test("AI Workspace task selection has explicit state and keyboard-visible focus", () => {
  assert.match(workspace, /data-ai-workspace-task/);
  assert.match(workspace, /aria-pressed=\{activeTaskId === task\.id\}/);
  assert.match(styles, /\[data-ai-workspace-task\]\[aria-pressed="true"\]/);
  assert.match(styles, /\[data-ai-workspace-task\]:focus-visible/);
});

test("AI Workspace keeps advanced and transitional tools subordinate by default", () => {
  assert.match(workspace, /data-ai-workspace-advanced/);
  assert.match(workspace, /<details key=\{section\.id\}/);
  assert.match(workspace, /data-ai-workspace-task-group/);
  assert.match(styles, /\[data-ai-workspace-advanced\] > summary:focus-visible/);
});

test("AI Workspace keeps feedback announced and actions in its working area", () => {
  assert.match(workspace, /data-ai-workspace-feedback role="status" aria-live="polite"/);
  assert.match(workspace, /data-ai-workspace-actions aria-label="Selected tool actions"/);
  assert.match(workspace, /data-ai-workspace-action=\{kind\}/);
  assert.match(styles, /\[data-ai-workspace-actions\] \{ display: flex/);
});

test("Case Quality Review uses an accessible active-mode selector", () => {
  assert.match(workspace, /data-ai-workspace-quality-modes/);
  assert.match(workspace, /aria-pressed=\{selectedCaseQualityReviewMode\.id === mode\.id\}/);
  assert.match(styles, /\[data-ai-workspace-quality-modes\] button\[aria-pressed="true"\]/);
  assert.match(styles, /\[data-ai-workspace-quality-modes\] \{ display: grid; gap: \.45rem; grid-template-columns: repeat\(2/);
});
