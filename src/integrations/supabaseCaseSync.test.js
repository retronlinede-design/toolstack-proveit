import test from "node:test";
import assert from "node:assert/strict";

import {
  SUPABASE_REASONING_EXPORT_KEY,
  SUPABASE_REASONING_EXPORT_URL,
  SUPABASE_REASONING_SNAPSHOT_API_KEY,
  SUPABASE_REASONING_SNAPSHOT_URL,
  exportReasoningCaseToSupabase,
  sendReasoningSnapshotToSupabase,
} from "./supabaseCaseSync.js";

const baseCase = () => ({
  id: "case-1",
  name: "Housing Case",
  category: "housing",
  status: "open",
  priority: "high",
  updatedAt: "2024-01-02T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  description: "Case description",
  notes: "",
  evidence: [],
  incidents: [],
  tasks: [],
  strategy: [],
  documents: [],
  actionSummary: {
    currentFocus: "",
    nextActions: [],
    importantReminders: [],
    strategyFocus: [],
    criticalDeadlines: [],
    updatedAt: "",
  },
});

function withConsoleStubs(fn) {
  return async () => {
    const originalLog = console.log;
    const originalError = console.error;
    const logs = [];
    const errors = [];
    console.log = (...args) => logs.push(args);
    console.error = (...args) => errors.push(args);

    try {
      await fn({ logs, errors });
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  };
}

test("sendReasoningSnapshotToSupabase posts the current snapshot payload shape and returns response JSON", withConsoleStubs(async ({ logs }) => {
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ ok: true, id: "remote-1" }),
    };
  };

  try {
    const result = await sendReasoningSnapshotToSupabase(baseCase());

    assert.deepEqual(result, { ok: true, id: "remote-1" });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0][0], SUPABASE_REASONING_SNAPSHOT_URL);
    assert.equal(fetchCalls[0][1].method, "POST");
    assert.deepEqual(fetchCalls[0][1].headers, {
      "Content-Type": "application/json",
      "x-api-key": SUPABASE_REASONING_SNAPSHOT_API_KEY,
    });

    const body = JSON.parse(fetchCalls[0][1].body);
    assert.equal(body.id, "case-1");
    assert.equal(body.name, "Housing Case");
    assert.equal(body.type, "housing");
    assert.equal(body.status, "open");
    assert.equal(body.priority, "high");
    assert.equal(body.snapshot.app, "proveit");
    assert.equal(body.snapshot.exportType, "CASE_REASONING_EXPORT");
    assert.equal(body.snapshot.contractVersion, "2.0");
    assert.deepEqual(logs, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

test("sendReasoningSnapshotToSupabase preserves current error handling after reading response JSON", async () => {
  const originalFetch = globalThis.fetch;
  let jsonRead = false;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: "Server Error",
    json: async () => {
      jsonRead = true;
      return { error: "bad" };
    },
  });

  try {
    await assert.rejects(
      sendReasoningSnapshotToSupabase(baseCase()),
      /Sync to Supabase failed: 500 Server Error/
    );
    assert.equal(jsonRead, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exportReasoningCaseToSupabase posts current export payload shape headers and returns response JSON", withConsoleStubs(async ({ logs }) => {
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ exported: true }),
    };
  };

  try {
    const result = await exportReasoningCaseToSupabase(baseCase());

    assert.deepEqual(result, { exported: true });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0][0], SUPABASE_REASONING_EXPORT_URL);
    assert.equal(fetchCalls[0][1].method, "POST");
    assert.deepEqual(fetchCalls[0][1].headers, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_REASONING_EXPORT_KEY}`,
      "apikey": SUPABASE_REASONING_EXPORT_KEY,
      "x-api-key": SUPABASE_REASONING_SNAPSHOT_API_KEY,
    });

    const body = JSON.parse(fetchCalls[0][1].body);
    assert.equal(body.case_id, "case-1");
    assert.match(body.exported_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(body.case_json.app, "proveit");
    assert.equal(body.case_json.exportType, "CASE_REASONING_EXPORT");
    assert.deepEqual(logs, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

test("exportReasoningCaseToSupabase preserves current catch log and rethrow behavior", withConsoleStubs(async ({ errors }) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    statusText: "Unavailable",
    json: async () => ({ error: "down" }),
  });

  try {
    await assert.rejects(
      exportReasoningCaseToSupabase(baseCase()),
      /Full case export failed: 503/
    );
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "Full case export failed");
    assert.match(errors[0][1].message, /Full case export failed: 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));
