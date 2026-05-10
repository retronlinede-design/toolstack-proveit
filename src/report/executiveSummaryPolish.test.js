import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPolishedContentBlocks,
  parseExecutivePolishSections,
  parsePolishedTimelineLine,
  splitPolishedLabelLine,
} from "./executiveSummaryPolish.js";

test("parseExecutivePolishSections handles flexible headings and empty fallback sections", () => {
  const sections = parseExecutivePolishSections(`
# Current Position
The position is active.

**Key Timeline**
2026-05-10: Appointment booked

Risks and Concerns:
- Missing proof: certificate not attached
`);

  assert.equal(sections["Current Position"], "The position is active.");
  assert.equal(sections["Key Timeline"], "2026-05-10: Appointment booked");
  assert.equal(sections["Risks and Concerns"], "- Missing proof: certificate not attached");
  assert.equal(sections["Recommended Next Steps"], undefined);
});

test("buildPolishedContentBlocks parses prose as paragraphs", () => {
  const blocks = buildPolishedContentBlocks("This is a concise operational paragraph.", "Current Position");

  assert.deepEqual(blocks, [
    { type: "paragraph", text: "This is a concise operational paragraph." },
  ]);
});

test("buildPolishedContentBlocks parses bullet risks as concern cards", () => {
  const blocks = buildPolishedContentBlocks("- Missing proof: No receipt is attached.\n- Weak timeline - Date is unclear.", "Risks and Concerns");

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "list");
  assert.equal(blocks[0].items[0].label, "Missing proof");
  assert.equal(blocks[0].items[0].text, "No receipt is attached.");
  assert.equal(blocks[0].items[1].label, "Weak timeline");
  assert.equal(blocks[0].items[1].text, "Date is unclear.");
});

test("buildPolishedContentBlocks parses numbered actions as ordered items", () => {
  const blocks = buildPolishedContentBlocks("1. Call the provider\n2. Upload the receipt", "Recommended Next Steps");

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].ordered, true);
  assert.equal(blocks[0].items[0].text, "Call the provider");
  assert.equal(blocks[0].items[1].text, "Upload the receipt");
});

test("splitPolishedLabelLine parses bold labels", () => {
  assert.deepEqual(splitPolishedLabelLine("**Immediate:** Contact the council"), {
    label: "Immediate",
    text: "Contact the council",
  });
});

test("parsePolishedTimelineLine keeps date and event text", () => {
  assert.deepEqual(parsePolishedTimelineLine("**10 May 2026:** Appointment booked"), {
    date: "10 May 2026",
    text: "Appointment booked",
  });
  assert.deepEqual(parsePolishedTimelineLine("May 2026 — Evidence bundle sent"), {
    date: "May 2026",
    text: "Evidence bundle sent",
  });
});
