import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ActionSummaryPanel.jsx", import.meta.url), "utf8");

test("Case Briefing defaults to a compact accessible disclosure", () => {
  assert.match(source, /useState\(false\)/);
  assert.match(source, />Case Briefing</);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /Expand Briefing/);
  assert.match(source, /Collapse Briefing/);
  assert.doesNotMatch(source, />Action Summary</);
  assert.doesNotMatch(source, /Live case briefing/);
});

test("expanded Case Briefing retains operational content and accessible removal", () => {
  for (const label of ["Current Focus", "Strategy Focus", "Next Actions", "Important Reminders", "Critical Deadlines"]) {
    assert.match(source, new RegExp(`>${label}<`));
  }
  assert.match(source, /Completed Actions \(\{completedNextActions\.length\}\)/);
  assert.match(source, /aria-label=\{`Remove action \$\{i \+ 1\}: \$\{actionText\}`\}/);
});
