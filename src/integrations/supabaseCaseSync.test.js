import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  REMOTE_SYNC_NOT_CONFIGURED_ERROR,
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

const configuredRemote = () => ({
  functionUrl: "https://example.test/functions/v1/proveit-remote",
  anonKey: "test-anon-key",
});

test("sendReasoningSnapshotToSupabase fails safely when remote sync is not configured", async () => {
  await assert.rejects(
    sendReasoningSnapshotToSupabase(baseCase()),
    new RegExp(REMOTE_SYNC_NOT_CONFIGURED_ERROR)
  );
});

test("sendReasoningSnapshotToSupabase posts the current snapshot payload shape and returns response JSON when configured", withConsoleStubs(async ({ logs }) => {
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
    const result = await sendReasoningSnapshotToSupabase(baseCase(), configuredRemote());

    assert.deepEqual(result, { ok: true, id: "remote-1" });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0][0], configuredRemote().functionUrl);
    assert.equal(fetchCalls[0][1].method, "POST");
    assert.deepEqual(fetchCalls[0][1].headers, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${configuredRemote().anonKey}`,
      "apikey": configuredRemote().anonKey,
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
      sendReasoningSnapshotToSupabase(baseCase(), configuredRemote()),
      /Reasoning snapshot upload failed: 500 Server Error/
    );
    assert.equal(jsonRead, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exportReasoningCaseToSupabase fails safely when remote sync is not configured", withConsoleStubs(async ({ errors }) => {
  await assert.rejects(
    exportReasoningCaseToSupabase(baseCase()),
    new RegExp(REMOTE_SYNC_NOT_CONFIGURED_ERROR)
  );
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], "Reasoning snapshot upload failed");
  assert.match(errors[0][1].message, new RegExp(REMOTE_SYNC_NOT_CONFIGURED_ERROR));
}));

test("exportReasoningCaseToSupabase posts current export payload shape headers and returns response JSON when configured", withConsoleStubs(async ({ logs }) => {
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
    const result = await exportReasoningCaseToSupabase(baseCase(), configuredRemote());

    assert.deepEqual(result, { exported: true });
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0][0], configuredRemote().functionUrl);
    assert.equal(fetchCalls[0][1].method, "POST");
    assert.deepEqual(fetchCalls[0][1].headers, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${configuredRemote().anonKey}`,
      "apikey": configuredRemote().anonKey,
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
      exportReasoningCaseToSupabase(baseCase(), configuredRemote()),
      /Reasoning snapshot upload failed: 503/
    );
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "Reasoning snapshot upload failed");
    assert.match(errors[0][1].message, /Reasoning snapshot upload failed: 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}));

test("supabaseCaseSync source does not contain removed frontend secrets", async () => {
  const source = await readFile(new URL("./supabaseCaseSync.js", import.meta.url), "utf8");
  const removedCustomSecret = ["proveit-live", "read", "123456"].join("-");
  const removedPublishablePrefix = ["sb", "publishable", ""].join("_");
  const removedProjectId = ["aftbtklrlkccng", "jiaacv"].join("");

  assert.equal(source.includes(removedCustomSecret), false);
  assert.equal(source.includes(removedPublishablePrefix), false);
  assert.equal(source.includes(removedProjectId), false);
});
