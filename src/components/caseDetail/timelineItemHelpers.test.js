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
