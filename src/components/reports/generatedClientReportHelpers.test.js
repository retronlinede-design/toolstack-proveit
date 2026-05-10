import test from "node:test";
import assert from "node:assert/strict";
import { parseMilestoneTimelineEntry } from "./generatedClientReportHelpers.js";

test("parseMilestoneTimelineEntry preserves blank fallback shape", () => {
  assert.deepEqual(parseMilestoneTimelineEntry(""), { date: "", title: "", note: "" });
  assert.deepEqual(parseMilestoneTimelineEntry(null), { date: "", title: "", note: "" });
});

test("parseMilestoneTimelineEntry parses date, title, and note using existing separators", () => {
  assert.deepEqual(parseMilestoneTimelineEntry("2026-05-10 - Hearing: Evidence reviewed"), {
    date: "2026-05-10",
    title: "Hearing",
    note: "Evidence reviewed",
  });
});

test("parseMilestoneTimelineEntry falls back to title and note for colon-only entries", () => {
  assert.deepEqual(parseMilestoneTimelineEntry("Hearing: Evidence reviewed"), {
    date: "",
    title: "Hearing",
    note: "Evidence reviewed",
  });
});
