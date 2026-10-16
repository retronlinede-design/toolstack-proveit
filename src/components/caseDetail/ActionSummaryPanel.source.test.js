import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ActionSummaryPanel.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../index.css", import.meta.url), "utf8");

test("Case Briefing defaults to a compact accessible disclosure", () => {
  assert.match(source, /useState\(false\)/);
  assert.match(source, /className="case-file-action-summary/);
  assert.match(source, />Case Briefing</);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /Expand Briefing/);
  assert.match(source, /Collapse Briefing/);
  assert.doesNotMatch(source, />Action Summary</);
  assert.doesNotMatch(source, /Live case briefing/);
});

test("expanded Case Briefing retains operational controls and live feedback", () => {
  for (const label of ["Current Focus", "Strategy Focus", "Next Actions", "Important Reminders", "Critical Deadlines"]) {
    assert.match(source, new RegExp(`>${label}<`));
  }
  assert.match(source, /Completed Actions \(\{completedNextActions\.length\}\)/);
  assert.match(source, /aria-label=\{`Remove action \$\{i \+ 1\}: \$\{actionText\}`\}/);
  assert.match(source, /aria-label=\{`Move action \$\{i \+ 1\}: \$\{actionText\} up`\}/);
  assert.match(source, /aria-label=\{`Move action \$\{i \+ 1\}: \$\{actionText\} down`\}/);
  assert.match(source, /onToggleNextActionCompleted/);
  assert.match(source, /onMoveNextAction/);
  assert.match(source, /onCopy\(\); announce\("Case Briefing copied to the clipboard\."\)/);
  assert.match(source, /role="status" aria-live="polite"/);
});

test("Action Summary styling is scoped to the open case file tokens", () => {
  assert.match(styles, /\.proveit-dark-shell \.case-file-action-summary \{/);
  assert.match(styles, /case-file-action-summary :is\(button, input, summary\):focus-visible/);
  assert.match(styles, /case-file-action-summary-compact \{[\s\S]*?grid-template-areas: "focus" "action" "indicators"/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1\.65fr\) minmax\(0, 1fr\)/);
  assert.doesNotMatch(source, /lime-/);
  assert.doesNotMatch(source, /case-briefing-control/);
});
