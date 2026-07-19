import assert from "node:assert/strict";
import test from "node:test";

import {
  compareIncidentsNewestFirst,
  parseIncidentDate,
} from "./incidentOrdering.js";

test("sorts incidents by eventDate newest first without mutating the source", () => {
  const incidents = [
    { id: "added-today", eventDate: "2023-06-10", createdAt: "2026-07-19T12:00:00.000Z" },
    { id: "newest-event", eventDate: "2025-01-15", createdAt: "2024-01-01T12:00:00.000Z" },
    { id: "middle-event", eventDate: "2024-03-02", updatedAt: "2026-07-19T12:00:00.000Z" },
  ];

  const sorted = [...incidents].sort(compareIncidentsNewestFirst);

  assert.deepEqual(sorted.map((incident) => incident.id), ["newest-event", "middle-event", "added-today"]);
  assert.deepEqual(incidents.map((incident) => incident.id), ["added-today", "newest-event", "middle-event"]);
});

test("places missing and malformed incident dates at the bottom", () => {
  const incidents = [
    { id: "missing" },
    { id: "valid", eventDate: "2024-03-02" },
    { id: "malformed", eventDate: "not-a-date" },
    { id: "impossible", eventDate: "2024-02-31" },
  ];

  const sorted = [...incidents].sort(compareIncidentsNewestFirst);

  assert.equal(sorted[0].id, "valid");
  assert.deepEqual(sorted.slice(1).map((incident) => incident.id), ["missing", "malformed", "impossible"]);
});

test("parses date-only incident values as UTC calendar dates", () => {
  assert.equal(parseIncidentDate("2024-03-02"), Date.UTC(2024, 2, 2));
  assert.equal(parseIncidentDate("03/02/2024"), null);
});
