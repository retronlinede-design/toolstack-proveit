import test from "node:test";
import assert from "node:assert/strict";
import { runOperationalIntegrityCheck } from "./operationalIntegrity.js";

const NOW = "2026-05-11T12:00:00.000Z";

test("runOperationalIntegrityCheck reports fresh reasoning export as ok", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    updatedAt: "2026-05-10T10:00:00.000Z",
    reasoningExportMetadata: {
      generatedAt: "2026-05-10T10:05:00.000Z",
      caseUpdatedAt: "2026-05-10T10:00:00.000Z",
      exportVersion: "reasoning-v2",
    },
    incidents: [{ id: "inc-1", title: "Incident", updatedAt: "2026-05-10T09:00:00.000Z" }],
  }, { now: NOW });

  assert.equal(result.exportFreshness.status, "ok");
  assert.deepEqual(result.exportFreshness.issues, []);
  assert.equal(result.exportFreshness.stats.exportVersion, "reasoning-v2");
});

test("runOperationalIntegrityCheck detects stale export versus case and record updates", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    updatedAt: "2026-05-10T10:00:00.000Z",
    reasoningExportMetadata: {
      generatedAt: "2026-05-10T08:00:00.000Z",
      caseUpdatedAt: "2026-05-10T10:00:00.000Z",
    },
    evidence: [{ id: "ev-1", title: "Evidence", updatedAt: "2026-05-10T09:30:00.000Z" }],
  }, { now: NOW });

  assert.equal(result.exportFreshness.status, "warning");
  assert.deepEqual(result.exportFreshness.issues.map((issue) => issue.code), [
    "STALE_EXPORT",
    "STALE_EXPORT_RECORD_UPDATE",
  ]);
});

test("runOperationalIntegrityCheck detects missing export metadata", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    updatedAt: "2026-05-10T10:00:00.000Z",
  }, { now: NOW });

  assert.equal(result.exportFreshness.status, "warning");
  assert.equal(result.exportFreshness.issues[0].code, "MISSING_EXPORT_METADATA");
  assert.equal(result.exportFreshness.stats.hasMetadata, false);
});

test("runOperationalIntegrityCheck detects invalid export dates", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    updatedAt: "2026-05-10T10:00:00.000Z",
    reasoningExportMetadata: {
      generatedAt: "not-a-date",
    },
  }, { now: NOW });

  assert.equal(result.exportFreshness.status, "critical");
  assert.equal(result.exportFreshness.issues[0].code, "INVALID_EXPORT_TIMESTAMP");
});

test("runOperationalIntegrityCheck detects future export timestamp", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    updatedAt: "2026-05-10T10:00:00.000Z",
    reasoningExportMetadata: {
      generatedAt: "2026-05-12T00:00:00.000Z",
    },
  }, { now: NOW });

  assert.equal(result.exportFreshness.status, "critical");
  assert.equal(result.exportFreshness.issues[0].code, "FUTURE_EXPORT_TIMESTAMP");
});

test("runOperationalIntegrityCheck detects stale open strategy items", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    strategy: [{
      id: "str-1",
      title: "Follow up",
      status: "open",
      updatedAt: "2026-04-20T00:00:00.000Z",
      linkedRecordIds: [],
      linkedIncidentIds: [],
      linkedEvidenceIds: [],
    }],
  }, { now: NOW });

  assert.equal(result.openOperationalLoops.status, "warning");
  const staleIssue = result.openOperationalLoops.issues.find((issue) => issue.code === "STALE_STRATEGY_ITEM");
  assert.equal(staleIssue.code, "STALE_STRATEGY_ITEM");
  assert.equal(staleIssue.details.strategyId, "str-1");
});

test("runOperationalIntegrityCheck detects incidents without supporting evidence", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    incidents: [{
      id: "inc-1",
      title: "Unsupported incident",
      linkedEvidenceIds: [],
      attachments: [],
    }],
    documents: [],
  }, { now: NOW });

  assert.equal(result.openOperationalLoops.status, "warning");
  assert.equal(result.openOperationalLoops.issues[0].code, "WEAK_INCIDENT_EVIDENCE");
  assert.equal(result.openOperationalLoops.issues[0].details.incidentId, "inc-1");
});

test("runOperationalIntegrityCheck detects dormant sequence groups", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    incidents: [{
      id: "inc-1",
      title: "Open incident",
      status: "open",
      sequenceGroup: "Repairs",
      linkedEvidenceIds: ["ev-1"],
      updatedAt: "2026-04-01T00:00:00.000Z",
    }],
    evidence: [{
      id: "ev-1",
      title: "Photo",
      status: "open",
      sequenceGroup: "Repairs",
      updatedAt: "2026-04-02T00:00:00.000Z",
    }],
  }, { now: NOW });

  assert.equal(result.openOperationalLoops.status, "warning");
  assert.equal(result.openOperationalLoops.issues.some((issue) => issue.code === "DORMANT_OPERATIONAL_THREAD"), true);
  const dormantIssue = result.openOperationalLoops.issues.find((issue) => issue.code === "DORMANT_OPERATIONAL_THREAD");
  assert.equal(dormantIssue.details.sequenceGroup, "Repairs");
});

test("runOperationalIntegrityCheck detects stale actionSummary", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    actionSummary: {
      currentFocus: "Await response",
      nextActions: ["Call office"],
      updatedAt: "2026-04-20T00:00:00.000Z",
    },
  }, { now: NOW });

  assert.equal(result.openOperationalLoops.status, "warning");
  assert.equal(result.openOperationalLoops.issues[0].code, "STALE_ACTION_SUMMARY");
});

test("runOperationalIntegrityCheck reports clean open operational loops", () => {
  const result = runOperationalIntegrityCheck({
    id: "case-1",
    updatedAt: "2026-05-10T10:00:00.000Z",
    reasoningExportMetadata: {
      generatedAt: "2026-05-10T10:05:00.000Z",
      caseUpdatedAt: "2026-05-10T10:00:00.000Z",
    },
    incidents: [{
      id: "inc-1",
      title: "Supported incident",
      status: "closed",
      linkedEvidenceIds: ["ev-1"],
      sequenceGroup: "Repairs",
      updatedAt: "2026-05-10T09:00:00.000Z",
    }],
    evidence: [{
      id: "ev-1",
      title: "Photo",
      status: "closed",
      sequenceGroup: "Repairs",
      updatedAt: "2026-05-10T09:10:00.000Z",
    }],
    documents: [{
      id: "doc-1",
      title: "Letter",
      linkedRecordIds: ["inc-1"],
      updatedAt: "2026-05-10T09:20:00.000Z",
    }],
    strategy: [{
      id: "str-1",
      title: "Plan",
      status: "closed",
      updatedAt: "2026-05-10T09:30:00.000Z",
    }],
    actionSummary: {
      currentFocus: "",
      nextActions: [],
      importantReminders: [],
      strategyFocus: [],
      criticalDeadlines: [],
      updatedAt: "2026-05-10T10:00:00.000Z",
    },
  }, { now: NOW });

  assert.equal(result.openOperationalLoops.status, "ok");
  assert.deepEqual(result.openOperationalLoops.issues, []);
});

test("structured strategy diagnostics cover support, actions, reviews, risks, and ownership", () => {
  const result = runOperationalIntegrityCheck({
    parties: [], incidents: [{ id: "inc-1" }],
    strategy: [
      { id: "active", title: "Plan", status: "open", priority: "critical", reviewDate: "2026-05-10", risks: ["Delay"], nextSteps: [], updatedAt: "2026-05-10T00:00:00.000Z" },
      { id: "supported", title: "Supported", status: "open", linkedRecordIds: ["inc-1"], nextSteps: ["Act"], reviewDate: "2026-05-11" },
      { id: "archived", title: "Archived", status: "archived", priority: "critical", risks: ["Old"], nextSteps: [] },
    ],
  }, { now: NOW, today: "2026-05-11" });
  const codes = result.openOperationalLoops.issues.map((issue) => issue.code);
  assert.equal(codes.includes("STRATEGY_UNSUPPORTED"), true);
  assert.equal(codes.includes("STRATEGY_NO_NEXT_STEPS"), true);
  assert.equal(codes.includes("STRATEGY_REVIEW_OVERDUE"), true);
  assert.equal(codes.includes("STRATEGY_RISK_WITHOUT_ACTION"), true);
  assert.equal(codes.includes("STRATEGY_CRITICAL_NO_OWNER"), true);
  assert.equal(result.openOperationalLoops.issues.some((issue) => issue.recordId === "supported" && issue.code === "STRATEGY_UNSUPPORTED"), false);
  assert.equal(result.openOperationalLoops.issues.some((issue) => issue.recordId === "supported" && issue.code === "STRATEGY_REVIEW_OVERDUE"), false);
  assert.equal(result.openOperationalLoops.issues.some((issue) => issue.recordId === "archived"), false);
  assert.equal(result.openOperationalLoops.stats.overdueStrategyReviews, 1);
});

test("watch diagnostics remain cautious and respect recent observations and linked outcomes", () => {
  const result = runOperationalIntegrityCheck({
    incidents: [{ id: "inc-1" }], strategy: [], parties: [{ id: "p1" }],
    watchItems: [
      { id: "overdue", title: "Concern", status: "watching", priority: "high", reviewDate: "2026-05-10", triggerConditions: ["Review threshold"], latestObservation: "A new unconfirmed observation", observations: [{ id: "o1", date: "2026-05-11", text: "Recent" }], linkedPartyIds: ["p1"] },
      { id: "stale", title: "Stale", status: "watching", priority: "critical", watchFor: "Change", updatedAt: "2026-04-01T00:00:00.000Z" },
      { id: "escalated-ok", title: "Linked escalation", status: "escalated", linkedRecordIds: ["inc-1"] },
      { id: "escalated-gap", title: "Unlinked escalation", status: "escalated" },
      { id: "resolved", title: "Resolved", status: "resolved", priority: "critical", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
  }, { now: NOW, today: "2026-05-11", watchStaleDays: 14 });
  const issues = result.openOperationalLoops.issues;
  assert.equal(issues.some((issue) => issue.recordId === "overdue" && issue.code === "WATCH_REVIEW_OVERDUE"), true);
  const trigger = issues.find((issue) => issue.recordId === "overdue" && issue.code === "WATCH_TRIGGER_REVIEW_REQUIRED");
  assert.match(trigger.message, /Review whether escalation is required/);
  assert.doesNotMatch(trigger.message, /trigger.*(met|occurred)/i);
  assert.equal(issues.some((issue) => issue.recordId === "overdue" && ["WATCH_STALE", "WATCH_NO_RECENT_OBSERVATION"].includes(issue.code)), false);
  assert.equal(issues.some((issue) => issue.recordId === "stale" && issue.code === "WATCH_STALE"), true);
  assert.equal(issues.some((issue) => issue.recordId === "stale" && issue.code === "WATCH_NO_RECENT_OBSERVATION"), true);
  assert.equal(issues.some((issue) => issue.recordId === "stale" && issue.code === "WATCH_NO_NEXT_CHECK"), true);
  assert.equal(issues.some((issue) => issue.recordId === "escalated-ok" && issue.code === "WATCH_ESCALATED_NO_OUTCOME"), false);
  assert.equal(issues.some((issue) => issue.recordId === "escalated-gap" && issue.code === "WATCH_ESCALATED_NO_OUTCOME"), true);
  assert.equal(issues.some((issue) => issue.recordId === "resolved"), false);
  assert.equal(trigger.navigationTarget.tab, "watch");
});

test("watch review dates use strict calendar validation", () => {
  const result = runOperationalIntegrityCheck({ watchItems: [{ id: "w", title: "Invalid review", status: "watching", reviewDate: "2026-02-30", watchFor: "Change", updatedAt: NOW }] }, { now: NOW, today: "2026-05-11" });
  assert.equal(result.openOperationalLoops.issues.some((issue) => issue.code === "WATCH_REVIEW_OVERDUE"), false);
});
