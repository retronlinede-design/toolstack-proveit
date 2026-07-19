import assert from "node:assert/strict";
import test from "node:test";

import {
  compareRecordsNewestFirst,
  parseCalendarDate,
} from "./recordDateOrdering.js";

test("sorts incidents by eventDate newest first without mutating the source", () => {
  const incidents = [
    { id: "added-today", eventDate: "2023-06-10", createdAt: "2026-07-19T12:00:00.000Z" },
    { id: "newest-event", eventDate: "2025-01-15", createdAt: "2024-01-01T12:00:00.000Z" },
    { id: "middle-event", eventDate: "2024-03-02", updatedAt: "2026-07-19T12:00:00.000Z" },
  ];

  const sorted = [...incidents].sort(compareRecordsNewestFirst);

  assert.deepEqual(sorted.map((incident) => incident.id), ["newest-event", "middle-event", "added-today"]);
  assert.deepEqual(incidents.map((incident) => incident.id), ["added-today", "newest-event", "middle-event"]);
});

test("sorts evidence by eventDate instead of creation or update metadata", () => {
  const evidence = [
    { id: "entered-later", eventDate: "2022-05-01", createdAt: "2026-07-19T12:00:00.000Z" },
    { id: "newest-evidence", eventDate: "2025-08-12", createdAt: "2023-01-01T12:00:00.000Z" },
    { id: "middle-evidence", eventDate: "2024-02-29", updatedAt: "2026-07-19T12:00:00.000Z" },
  ];

  const sorted = [...evidence].sort(compareRecordsNewestFirst);

  assert.deepEqual(sorted.map((item) => item.id), ["newest-evidence", "middle-evidence", "entered-later"]);
  assert.deepEqual(evidence.map((item) => item.id), ["entered-later", "newest-evidence", "middle-evidence"]);
});

test("places missing, malformed, and impossible record dates at the bottom", () => {
  const records = [
    { id: "missing" },
    { id: "valid", eventDate: "2024-03-02" },
    { id: "malformed", eventDate: "not-a-date" },
    { id: "impossible", eventDate: "2024-02-31" },
  ];

  const sorted = [...records].sort(compareRecordsNewestFirst);

  assert.equal(sorted[0].id, "valid");
  assert.deepEqual(sorted.slice(1).map((record) => record.id), ["missing", "malformed", "impossible"]);
});

test("parses date-only record values as UTC calendar dates", () => {
  assert.equal(parseCalendarDate("2024-03-02"), Date.UTC(2024, 2, 2));
  assert.equal(parseCalendarDate("03/02/2024"), null);
});
