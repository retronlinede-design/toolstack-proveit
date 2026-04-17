import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGptDeltaPreview,
  ingestGptDelta,
  prepareGptDeltaPayloadForSelectedCase,
} from "./gptDelta.js";

function baseCase() {
  return {
    id: "case-1",
    name: "Case One",
    actionSummary: {
      currentFocus: "Old focus",
      nextActions: ["Old action"],
      importantReminders: ["Old reminder"],
      strategyFocus: ["Old strategy"],
      criticalDeadlines: ["Old deadline"],
      updatedAt: "old-action-summary-time",
    },
    strategy: [
      {
        id: "str-1",
        type: "strategy",
        title: "Old strategy record",
        date: "2024-01-01",
        description: "Old description",
        notes: "Old notes",
        status: "open",
        tags: ["old"],
        linkedRecordIds: ["inc-1"],
        createdAt: "2024-01-01T09:00:00.000Z",
        updatedAt: "2024-01-01T09:00:00.000Z",
      },
    ],
    incidents: [
      {
        id: "inc-1",
        type: "incidents",
        title: "Incident",
        date: "2024-01-01",
        linkedEvidenceIds: [],
      },
    ],
  };
}

function delta(patch, overrides = {}) {
  return {
    app: "proveit",
    contractVersion: "gpt-delta-1.0",
    target: { caseId: "case-1" },
    operations: { patch },
    ...overrides,
  };
}

test("ingestGptDelta rejects non-object payload", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), null),
    { ok: false, reason: "GPT delta requires a case and payload object." }
  );
});

test("ingestGptDelta rejects wrong app", () => {
  const result = ingestGptDelta(baseCase(), delta({}, { app: "other" }));

  assert.deepEqual(result, { ok: false, reason: "Unsupported GPT delta contract." });
});

test("ingestGptDelta rejects wrong contractVersion", () => {
  const result = ingestGptDelta(baseCase(), delta({}, { contractVersion: "gpt-delta-2.0" }));

  assert.deepEqual(result, { ok: false, reason: "Unsupported GPT delta contract." });
});

test("ingestGptDelta rejects missing and mismatched target.caseId", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), delta({}, { target: {} })),
    { ok: false, reason: "GPT delta target.caseId is required." }
  );

  assert.deepEqual(
    ingestGptDelta(baseCase(), delta({}, { target: { caseId: "case-2" } })),
    { ok: false, reason: "GPT delta target case does not match the provided case." }
  );
});

test("ingestGptDelta actionSummary patch applies only supported fields", () => {
  const result = ingestGptDelta(baseCase(), delta({
    actionSummary: {
      currentFocus: "New focus",
      nextActions: ["New action"],
      importantReminders: ["New reminder"],
      strategyFocus: ["New strategy"],
      criticalDeadlines: ["New deadline"],
      unsupportedField: "ignored",
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.case.actionSummary.currentFocus, "New focus");
  assert.deepEqual(result.case.actionSummary.nextActions, ["New action"]);
  assert.deepEqual(result.case.actionSummary.importantReminders, ["New reminder"]);
  assert.deepEqual(result.case.actionSummary.strategyFocus, ["New strategy"]);
  assert.deepEqual(result.case.actionSummary.criticalDeadlines, ["New deadline"]);
  assert.equal(Object.hasOwn(result.case.actionSummary, "unsupportedField"), false);
  assert.match(result.case.actionSummary.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(result.case.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("ingestGptDelta strategy patch applies only supported fields", () => {
  const result = ingestGptDelta(baseCase(), delta({
    strategy: [
      {
        id: "str-1",
        patch: {
          title: "New strategy record",
          date: "2024-02-01",
          description: "New description",
          notes: "New notes",
          status: "archived",
          tags: ["new"],
          linkedRecordIds: ["inc-2"],
          linkedEvidenceIds: ["ignored"],
          unsupportedField: "ignored",
        },
      },
    ],
  }));

  assert.equal(result.ok, true);
  const updated = result.case.strategy[0];
  assert.equal(updated.title, "New strategy record");
  assert.equal(updated.date, "2024-02-01");
  assert.equal(updated.eventDate, "2024-02-01");
  assert.equal(updated.description, "New description");
  assert.equal(updated.notes, "New notes");
  assert.equal(updated.status, "archived");
  assert.deepEqual(updated.tags, ["new"]);
  assert.deepEqual(updated.linkedRecordIds, ["inc-2"]);
  assert.deepEqual(updated.linkedEvidenceIds, []);
  assert.equal(Object.hasOwn(updated, "unsupportedField"), false);
  assert.match(updated.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("ingestGptDelta unsupported patch sections return current rejection behavior", () => {
  assert.deepEqual(
    ingestGptDelta(baseCase(), delta({ incidents: [{ id: "inc-1", patch: { title: "Ignored" } }] })),
    { ok: false, reason: "GPT delta has no supported patch sections." }
  );
});

test("buildGptDeltaPreview returns expected core preview shape", () => {
  const currentCase = baseCase();
  const updatedCase = {
    ...currentCase,
    strategy: [{ ...currentCase.strategy[0], title: "Updated preview title" }],
  };
  const payload = delta({
    actionSummary: {
      currentFocus: "New focus",
      nextActions: ["New action"],
      ignored: "ignored",
    },
    strategy: [
      { id: "str-1", patch: { title: "Updated preview title" } },
      { id: "", patch: { title: "Ignored blank id" } },
    ],
  });

  assert.deepEqual(buildGptDeltaPreview(payload, currentCase, updatedCase), {
    caseName: "Case One",
    caseId: "case-1",
    contractVersion: "gpt-delta-1.0",
    supportedSections: ["Action Summary", "Strategy"],
    actionSummaryFields: ["currentFocus", "nextActions"],
    strategyItems: [
      { id: "str-1", title: "Updated preview title" },
    ],
  });
});

test("prepareGptDeltaPayloadForSelectedCase fills missing blank and AUTO target.caseId with selectedCaseId", () => {
  assert.deepEqual(
    prepareGptDeltaPayloadForSelectedCase({ app: "proveit" }, "selected-1"),
    { app: "proveit", target: { caseId: "selected-1" } }
  );

  assert.deepEqual(
    prepareGptDeltaPayloadForSelectedCase({ app: "proveit", target: { caseId: "" } }, "selected-1"),
    { app: "proveit", target: { caseId: "selected-1" } }
  );

  assert.deepEqual(
    prepareGptDeltaPayloadForSelectedCase({ app: "proveit", target: { caseId: "AUTO" } }, "selected-1"),
    { app: "proveit", target: { caseId: "selected-1" } }
  );
});

