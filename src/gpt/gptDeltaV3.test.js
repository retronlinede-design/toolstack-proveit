import test from "node:test";
import assert from "node:assert/strict";

import { buildGptDeltaPreview, ingestGptDelta } from "./gptDelta.js";

function caseItem() {
  return {
    id: "case-1", name: "Case", parties: [{ id: "party-1", name: "Owner" }],
    incidents: [{ id: "inc-1", title: "Incident" }], evidence: [{ id: "ev-1", title: "Evidence" }], documents: [], ledger: [], tasks: [],
    strategy: [{ id: "str-1", type: "strategy", title: "Legacy", description: "Old", status: "open", attachments: [{ id: "att-1" }], createdAt: "2026-01-01T00:00:00.000Z" }],
    watchItems: [{ id: "watch-1", type: "watch", title: "Concern", status: "watching", date: "2026-07-20", eventDate: "2026-07-20", attachments: [{ id: "att-2" }], observations: [{ id: "watch-observation-old", date: "2026-07-20", text: "Old", createdAt: "2026-07-20T00:00:00.000Z" }], createdAt: "2026-07-20T00:00:00.000Z" }],
  };
}

const delta = (operations) => ({ app: "proveit", contractVersion: "gpt-delta-3.0", target: { caseId: "case-1" }, operations });

test("v3 patches every structured Strategy field with replacement semantics", () => {
  const result = ingestGptDelta(caseItem(), delta({ patch: { strategy: [{ id: "str-1", patch: {
    title: " Updated ", eventDate: "2026-07-24", strategySchemaVersion: 3, strategyType: "action", objective: " Objective ", rationale: "Reason", desiredOutcome: "Outcome", priority: "high", reviewDate: "2026-07-31", decisionStatus: "proposed", ownerPartyId: "party-1", assumptions: [" A ", ""], risks: ["R"], nextSteps: ["N"], status: "open", tags: ["new"], linkedRecordIds: ["inc-1"], linkedIncidentIds: ["inc-1"], linkedEvidenceIds: ["ev-1"]
  } }] } }));
  assert.equal(result.ok, true); const item = result.case.strategy.find((entry) => entry.id === "str-1");
  assert.equal(item.objective, "Objective"); assert.deepEqual(item.assumptions, ["A"]); assert.deepEqual(item.tags, ["new"]);
  assert.equal(item.createdAt, "2026-01-01T00:00:00.000Z"); assert.deepEqual(item.attachments, [{ id: "att-1" }]); assert.equal(result.summary.strategiesPatched, 1);
});

test("v3 rejects invalid Strategy values, owners, dates, typed links, protected and duplicate patches", () => {
  for (const patch of [{ priority: "urgent" }, { ownerPartyId: "missing" }, { reviewDate: "2026-02-30" }, { linkedIncidentIds: ["ev-1"] }, { createdAt: "x" }, { strategySchemaVersion: 2 }]) {
    assert.equal(ingestGptDelta(caseItem(), delta({ patch: { strategy: [{ id: "str-1", patch }] } })).ok, false);
  }
  assert.equal(ingestGptDelta(caseItem(), delta({ patch: { strategy: [{ id: "str-1", patch: { title: "A" } }, { id: "str-1", patch: { title: "B" } }] } })).ok, false);
});

test("v3 creates normalized monitored concerns with generated identity and synchronized date", () => {
  const result = ingestGptDelta(caseItem(), delta({ create: { watchItems: [{ clientId: "new-watch", record: { title: " Concern ", category: "management", priority: "high", date: "2026-07-24", watchFor: " Change ", linkedPartyIds: ["party-1"], linkedRecordIds: ["str-1"] } }] } }));
  assert.equal(result.ok, true); const item = result.case.watchItems.find((entry) => entry.id !== "watch-1");
  assert.match(item.id, /^watch-/); assert.equal(item.title, "Concern"); assert.equal(item.status, "watching"); assert.equal(item.date, "2026-07-24"); assert.equal(item.eventDate, "2026-07-24"); assert.equal(item.source, "gpt-delta-3.0"); assert.ok(item.createdAt); assert.equal(item.clientId, undefined);
  assert.deepEqual(result.clientIdMappings, [{ clientId: "new-watch", finalId: item.id }]);
});

test("v3 rejects unsafe or invalid watch creation and prohibited collections", () => {
  const records = [{ title: "" }, { title: "X", category: "bad" }, { title: "X", status: "open" }, { title: "X", priority: "urgent" }, { title: "X", linkedPartyIds: ["missing"] }, { title: "X", linkedRecordIds: ["missing"] }, { title: "X", attachments: [] }];
  for (const record of records) assert.equal(ingestGptDelta(caseItem(), delta({ create: { watchItems: [{ clientId: "x", record }] } })).ok, false);
  for (const section of ["incidents", "evidence", "documents", "ledger", "strategy"]) assert.equal(ingestGptDelta(caseItem(), delta({ create: { [section]: [] } })).ok, false);
});

test("v3 watch patch preserves protected data and synchronizes eventDate from date", () => {
  const result = ingestGptDelta(caseItem(), delta({ patch: { watchItems: [{ id: "watch-1", patch: { title: " Updated ", status: "escalated", date: "2026-07-24", eventDate: "2026-07-22", triggerConditions: [" Trigger ", ""], linkedRecordIds: ["str-1"], linkedPartyIds: ["party-1"] } }] } }));
  assert.equal(result.ok, true); const item = result.case.watchItems[0]; assert.equal(item.eventDate, "2026-07-24"); assert.equal(item.observations.length, 1); assert.deepEqual(item.attachments, [{ id: "att-2" }]); assert.equal(result.case.incidents.length, 1);
  for (const patch of [{ status: "open" }, { observations: [] }, { attachments: [] }, { id: "changed" }]) assert.equal(ingestGptDelta(caseItem(), delta({ patch: { watchItems: [{ id: "watch-1", patch }] } })).ok, false);
});

test("v3 observations append non-destructively with generated metadata", () => {
  const original = caseItem(); const result = ingestGptDelta(original, delta({ append: { watchObservations: [
    { watchItemId: "watch-1", observation: { date: "2026-07-24", text: " First " } },
    { watchItemId: "watch-1", observation: { date: "2026-07-25", text: "Second" } },
  ] } }));
  assert.equal(result.ok, true); const item = result.case.watchItems[0]; assert.equal(item.observations.length, 3); assert.ok(item.observations[1].id); assert.ok(item.observations[1].createdAt); assert.equal(item.latestObservation, ""); assert.equal(result.summary.observationsAppended, 2); assert.equal(original.watchItems[0].observations.length, 1);
});

test("v3 rejects invalid observation appends and duplicate entries atomically", () => {
  const invalid = [
    { watchItemId: "missing", observation: { date: "2026-07-24", text: "X" } },
    { watchItemId: "watch-1", observation: { date: "2026-02-30", text: "X" } },
    { watchItemId: "watch-1", observation: { date: "2026-07-24", text: " " } },
    { watchItemId: "watch-1", observation: { date: "2026-07-24", text: "X", id: "supplied" } },
  ];
  for (const entry of invalid) assert.equal(ingestGptDelta(caseItem(), delta({ append: { watchObservations: [entry] } })).ok, false);
  const input = caseItem(); const duplicate = { watchItemId: "watch-1", observation: { date: "2026-07-24", text: "Same" } };
  assert.equal(ingestGptDelta(input, delta({ patch: { strategy: [{ id: "str-1", patch: { title: "Would change" } }] }, append: { watchObservations: [duplicate, duplicate] } })).ok, false);
  assert.equal(input.strategy[0].title, "Legacy");
});

test("v3 preview explicitly labels monitored concerns and append-only observations", () => {
  const payload = delta({ create: { watchItems: [{ clientId: "new", record: { title: "Concern", date: "2026-07-24", triggerConditions: ["Review"] } }] }, append: { watchObservations: [{ watchItemId: "watch-1", observation: { date: "2026-07-24", text: "Observed" } }] } });
  const result = ingestGptDelta(caseItem(), payload); const preview = buildGptDeltaPreview(payload, caseItem(), result.case, result);
  assert.match(preview.createdRecords[0].recordType, /not an Incident/); assert.equal(preview.observationAppends[0].label, "Append only"); assert.equal(preview.resultSummary.watchItemsCreated, 1);
});

test("unsupported versions and unsupported operation groups are rejected separately", () => {
  assert.equal(ingestGptDelta(caseItem(), { ...delta({ patch: {} }), contractVersion: "gpt-delta-4.0" }).ok, false);
  assert.equal(ingestGptDelta(caseItem(), delta({ delete: { watchItems: [] } })).ok, false);
});
