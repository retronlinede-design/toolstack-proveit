import test from "node:test";
import assert from "node:assert/strict";

import {
  repairIncidentEventDates,
  scanIncidentDateMismatches,
} from "./incidentDateRepair.js";

test("scanIncidentDateMismatches reports incidents with date and stale eventDate", () => {
  const caseItem = {
    incidents: [
      { id: "inc-1", title: "Mismatch", date: "2024-02-02", eventDate: "2024-01-01", sequenceGroup: "Safety" },
      { id: "inc-2", title: "Synced", date: "2024-02-03", eventDate: "2024-02-03", sequenceGroup: "Safety" },
      { id: "inc-3", title: "Missing event date", date: "2024-02-04", eventDate: "" },
      { id: "inc-4", title: "Missing date", date: "", eventDate: "2024-02-05" },
    ],
  };

  assert.deepEqual(scanIncidentDateMismatches(caseItem), [
    {
      id: "inc-1",
      title: "Mismatch",
      date: "2024-02-02",
      eventDate: "2024-01-01",
      sequenceGroup: "Safety",
    },
  ]);
});

test("repairIncidentEventDates repairs only selected incidents", () => {
  const caseItem = {
    id: "case-1",
    updatedAt: "old-case-time",
    incidents: [
      { id: "inc-1", title: "Repair", date: "2024-02-02", eventDate: "2024-01-01", updatedAt: "old-1" },
      { id: "inc-2", title: "Leave", date: "2024-03-03", eventDate: "2024-01-03", updatedAt: "old-2" },
    ],
  };

  const updated = repairIncidentEventDates(caseItem, ["inc-1"]);

  const repaired = updated.incidents.find((incident) => incident.id === "inc-1");
  const untouched = updated.incidents.find((incident) => incident.id === "inc-2");
  assert.equal(repaired.eventDate, "2024-02-02");
  assert.match(repaired.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(untouched.eventDate, "2024-01-03");
  assert.equal(untouched.updatedAt, "old-2");
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("repairIncidentEventDates returns original case when no selected incidents need repair", () => {
  const caseItem = {
    incidents: [
      { id: "inc-1", title: "Synced", date: "2024-02-02", eventDate: "2024-02-02" },
    ],
  };

  assert.equal(repairIncidentEventDates(caseItem, ["inc-1"]), caseItem);
  assert.equal(repairIncidentEventDates(caseItem, []), caseItem);
});

test("repairIncidentEventDates recalculates incident sort order after repair", () => {
  const caseItem = {
    incidents: [
      { id: "inc-late", title: "Late", date: "2024-03-03", eventDate: "2024-03-03", createdAt: "2024-03-03T09:00:00.000Z" },
      { id: "inc-repair", title: "Repair", date: "2024-03-04", eventDate: "2024-01-01", createdAt: "2024-01-01T09:00:00.000Z" },
    ],
  };

  const updated = repairIncidentEventDates(caseItem, ["inc-repair"]);

  assert.deepEqual(updated.incidents.map((incident) => incident.id), ["inc-late", "inc-repair"]);
});
