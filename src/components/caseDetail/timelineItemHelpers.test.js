import test from "node:test";
import assert from "node:assert/strict";

import { toTimelineItems } from "./timelineItemHelpers.js";

test("evidence timeline items use the normalized eventDate first", () => {
  const items = toTimelineItems([
    {
      id: "ev-1",
      title: "Evidence",
      date: "2024-05-09",
      eventDate: "2024-05-09",
      capturedAt: "2024-05-01",
    },
  ], "evidence");

  assert.equal(items[0].date, "2024-05-09");
});

test("timeline items retain complete presentation summaries for every supported source type", () => {
  const longSummary = "A".repeat(220);
  const fixtures = [
    ["incident", { id: "inc-1", title: "Incident", eventDate: "2024-01-01", description: longSummary }],
    ["evidence", { id: "ev-1", title: "Evidence", eventDate: "2024-01-02", description: longSummary }],
    ["document", { id: "doc-1", title: "Document", documentDate: "2024-01-03", summary: longSummary }],
    ["ledger", { id: "led-1", label: "Payment", paymentDate: "2024-01-04", notes: longSummary }],
    ["strategy", { id: "str-1", title: "Strategy", eventDate: "2024-01-05", notes: longSummary }],
  ];

  fixtures.forEach(([recordType, item]) => {
    const [timelineItem] = toTimelineItems([item], recordType);
    assert.equal(timelineItem.fullSummary.includes(longSummary), true);
    assert.equal(timelineItem.summary.endsWith("..."), true);
  });
});
