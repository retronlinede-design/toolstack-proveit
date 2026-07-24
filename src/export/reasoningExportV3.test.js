import test from "node:test";
import assert from "node:assert/strict";

import { buildCaseReasoningExportV3Payload, classifyReasoningReviewDate, REASONING_EXPORT_V3, WATCH_FACTUAL_STATUS } from "./reasoningExportV3.js";
import { buildCaseReasoningExportPayload } from "./caseExport.js";

function fixture() {
  return {
    id: "case-1", name: "Case", category: "employment", status: "open", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-07-23T00:00:00.000Z",
    parties: [{ id: "party-1", name: "Alex" }], actionSummary: { currentFocus: "Clarify duties", nextActions: ["Ask"], importantReminders: [], strategyFocus: ["Written answer"], criticalDeadlines: [] },
    incidents: [{ id: "inc-1", type: "incidents", title: "Instruction", eventDate: "2026-07-20", sequenceGroup: "Duties", attachments: [{ dataUrl: "data:image/png;base64,secret" }] }],
    evidence: [{ id: "ev-1", type: "evidence", title: "Email", eventDate: "2026-07-21", sequenceGroup: "Duties" }], documents: [], ledger: [], tasks: [],
    strategy: [
      { id: "str-1", type: "strategy", title: "Clarify", description: "Duplicate objective", objective: "Duplicate objective", rationale: "Inconsistent instructions", desiredOutcome: "Written allocation", status: "open", strategyType: "action", priority: "high", decisionStatus: "proposed", ownerPartyId: "party-1", assumptions: ["Reply expected"], risks: ["No reply"], nextSteps: [], reviewDate: "2026-07-23", eventDate: "2026-07-20", sequenceGroup: "Duties", tags: ["work"], linkedRecordIds: ["inc-1", "missing"], updatedAt: "2026-07-23T00:00:00.000Z" },
      { id: "str-legacy", type: "strategy", title: "Legacy", description: "Legacy description", status: "open", eventDate: "2026-07-19" },
      { id: "str-archived", type: "strategy", title: "Archived", status: "archived" },
    ],
    watchItems: [
      { id: "watch-1", type: "watch", title: "Possible reassignment", status: "watching", category: "work_allocation", priority: "high", watchFor: "A direct instruction", rationale: "Developing concern", triggerConditions: ["Instruction issued"], latestObservation: "Newest", nextCheck: "Check schedule", reviewDate: "2026-07-31", eventDate: "2026-07-20", sequenceGroup: "Duties", tags: ["monitoring"], linkedPartyIds: ["party-1", "missing"], linkedRecordIds: ["str-1", "missing"], updatedAt: "2026-07-24T00:00:00.000Z", attachments: [{ dataUrl: "secret" }], observations: [
        { id: "o1", date: "2026-07-20", text: "Old", createdAt: "2026-07-20T01:00:00.000Z" }, { id: "o2", date: "2026-07-23", text: "Third", createdAt: "2026-07-23T01:00:00.000Z" }, { id: "o3", date: "2026-07-24", text: "Newest", createdAt: "2026-07-24T02:00:00.000Z" }, { id: "o4", date: "2026-07-24", text: "Other newest", createdAt: "2026-07-24T01:00:00.000Z" }, { id: "bad", date: "not-date", text: "Bad" },
      ] },
      { id: "watch-closed", type: "watch", title: "Closed", status: "resolved" },
    ],
  };
}

const options = { exportedAt: "2026-07-24T12:00:00.000Z", today: "2026-07-24" };

test("reasoning export v3 has an explicit compact non-importable contract", () => {
  const payload = buildCaseReasoningExportV3Payload(fixture(), options);
  assert.equal(payload.contractVersion, REASONING_EXPORT_V3); assert.equal(payload.exportType, "CASE_REASONING_EXPORT"); assert.equal(payload.importable, false); assert.equal(payload.includesBinaryData, false);
  assert.equal(payload.factualStatusConventions.watch, WATCH_FACTUAL_STATUS); assert.deepEqual(payload.case.counts, { incidents: 1, evidence: 1, documents: 0, ledger: 0, strategies: 3, watchItems: 2 });
  assert.doesNotMatch(JSON.stringify(payload), /dataUrl|base64,secret/);
});

test("structured and legacy strategies project safely with diagnostics and links", () => {
  const payload = buildCaseReasoningExportV3Payload(fixture(), options); const strategy = payload.case.strategies.find((item) => item.id === "str-1");
  assert.equal(strategy.factualStatus, "planning_or_analysis"); assert.equal(strategy.objective, "Duplicate objective"); assert.equal(strategy.description, undefined); assert.equal(strategy.owner.name, "Alex"); assert.equal(strategy.reviewState, "overdue");
  assert.deepEqual(strategy.linkedRecords.map((item) => item.id), ["inc-1"]); assert.ok(strategy.diagnostics.some((item) => item.code === "STRATEGY_NO_NEXT_STEPS")); assert.ok(strategy.diagnostics.some((item) => item.code === "STRATEGY_REVIEW_OVERDUE"));
  assert.ok(strategy.diagnostics.some((item) => item.code === "BROKEN_REFERENCE"));
  assert.equal(payload.case.strategies.find((item) => item.id === "str-legacy").objective, "Legacy description"); assert.equal(payload.case.strategies.some((item) => item.id === "str-archived"), false); assert.equal(payload.case.omitted.closedOrArchivedStrategies, 1);
});

test("watch projection is explicitly unconfirmed, bounded, ordered, and cautious", () => {
  const payload = buildCaseReasoningExportV3Payload(fixture(), options); const watch = payload.case.watchItems[0];
  assert.equal(watch.factualStatus, "unconfirmed_monitored_concern"); assert.equal(watch.reviewState, "due_soon"); assert.equal(watch.latestObservation, ""); assert.deepEqual(watch.recentObservations.map((item) => item.id), ["o3", "o4", "o2"]);
  assert.deepEqual(watch.relatedParties, [{ id: "party-1", name: "Alex" }]); assert.deepEqual(watch.linkedRecords.map((item) => item.id), ["str-1"]); assert.ok(watch.diagnostics.some((item) => item.code === "WATCH_TRIGGER_REVIEW_REQUIRED"));
  assert.ok(watch.diagnostics.some((item) => item.code === "BROKEN_REFERENCE"));
  assert.match(watch.diagnostics.find((item) => item.code === "WATCH_TRIGGER_REVIEW_REQUIRED").message, /Review whether escalation is required/); assert.equal(payload.case.watchItems.some((item) => item.id === "watch-closed"), false); assert.equal(payload.case.omitted.closedMonitoringItems, 1);
});

test("diagnostic summary and sequence groups remain compact contextual projections", () => {
  const payload = buildCaseReasoningExportV3Payload(fixture(), options);
  assert.equal(payload.case.diagnosticSummary.overdueStrategyReviews, 1); assert.equal(payload.case.diagnosticSummary.highPriorityStrategiesWithoutNextSteps, 1); assert.equal(payload.case.diagnosticSummary.watchItemsRequiringEscalationReview, 1);
  const thread = payload.case.sequenceGroups.find((item) => item.sequenceGroup === "Duties"); assert.deepEqual(thread.strategyIds, ["str-1"]); assert.deepEqual(thread.watchItemIds, ["watch-1"]); assert.deepEqual(thread.supportingRecords.map((item) => item.id), ["ev-1", "inc-1"]); assert.match(thread.note, /not evidentiary proof/);
});

test("v3 is deterministic, non-mutating, and supports explicit closed inclusion", () => {
  const source = fixture(); const before = structuredClone(source); const first = buildCaseReasoningExportV3Payload(source, options); const second = buildCaseReasoningExportV3Payload(source, options);
  assert.deepEqual(first, second); assert.deepEqual(source, before);
  const inclusive = buildCaseReasoningExportV3Payload(source, { ...options, includeClosedMonitoring: true, includeArchivedStrategies: true }); assert.equal(inclusive.case.watchItems.length, 2); assert.equal(inclusive.case.strategies.length, 3);
});

test("empty legacy cases work and old reasoning export remains version 2.0 by default", () => {
  const empty = { id: "empty", name: "Empty" }; const v3 = buildCaseReasoningExportV3Payload(empty, options); assert.deepEqual(v3.case.strategies, []); assert.deepEqual(v3.case.watchItems, []);
  assert.equal(buildCaseReasoningExportPayload(empty).contractVersion, "2.0"); assert.equal(classifyReasoningReviewDate("2026-07-24", "2026-07-24"), "due_soon"); assert.equal(classifyReasoningReviewDate("2026-02-30", "2026-07-24"), "none");
});
