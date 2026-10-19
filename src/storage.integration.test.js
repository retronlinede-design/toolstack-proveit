import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { deleteDB, openDB } from "idb";
import { saveCaseToDb, saveCasesAndImagesToDb } from "./storage.js";

let databaseNumber = 0;

// The production save guard records emergency snapshots in browser storage.
// Provide the minimal browser-compatible API so intentional record removals do
// not produce unrelated Node-environment warnings during these tests.
if (!globalThis.localStorage) {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function attachment(imageId) {
  return { id: `att-${imageId}`, storage: { type: "indexeddb", imageId } };
}

function caseWith(id, { evidence = [], documents = [] } = {}) {
  return {
    id,
    revision: 1,
    incidents: [],
    evidence,
    documents,
    ledger: [],
    strategy: [],
    watchItems: [],
  };
}

async function createDatabase() {
  const name = `proveit-storage-integration-${++databaseNumber}`;
  const db = await openDB(name, 1, {
    upgrade(database) {
      database.createObjectStore("cases", { keyPath: "id" });
      database.createObjectStore("images", { keyPath: "id" });
    },
  });
  return {
    db,
    async dispose() {
      db.close();
      await deleteDB(name);
    },
  };
}

function completionInstrumentedDb(db, onComplete) {
  return {
    transaction(...args) {
      const tx = db.transaction(...args);
      return {
        objectStore: (name) => tx.objectStore(name),
        abort: () => tx.abort(),
        get done() {
          return tx.done.then(() => {
            onComplete();
          });
        },
      };
    },
  };
}

function failingImageDeleteDb(db) {
  return {
    transaction(...args) {
      const tx = db.transaction(...args);
      return {
        objectStore(name) {
          const store = tx.objectStore(name);
          if (name !== "images") return store;
          return new Proxy(store, {
            get(target, property, receiver) {
              if (property === "delete") {
                return async () => {
                  throw new Error("simulated image deletion failure");
                };
              }
              return Reflect.get(target, property, receiver);
            },
          });
        },
        abort: () => tx.abort(),
        get done() { return tx.done; },
      };
    },
  };
}

function failingSecondCasePutDb(db) {
  let writes = 0;
  return {
    transaction(...args) {
      const tx = db.transaction(...args);
      return {
        objectStore(name) {
          const store = tx.objectStore(name);
          if (name !== "cases") return store;
          return new Proxy(store, {
            get(target, property, receiver) {
              if (property === "put") {
                return async (value) => {
                  writes += 1;
                  if (writes === 2) throw new Error("simulated second case write failure");
                  return target.put(value);
                };
              }
              const value = Reflect.get(target, property, receiver);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        },
        abort: () => tx.abort(),
        get done() { return tx.done; },
      };
    },
  };
}

test("saveCaseToDb resolves only after its IndexedDB transaction completes", async () => {
  const fixture = await createDatabase();
  let completed = false;
  const initial = caseWith("case-1", { evidence: [{ id: "ev-1", attachments: [attachment("remove-me")] }] });

  try {
    await fixture.db.put("cases", initial);
    await fixture.db.put("images", { id: "remove-me", dataUrl: "data:image/png;base64,AA==" });

    await saveCaseToDb(
      completionInstrumentedDb(fixture.db, () => { completed = true; }),
      { ...initial, evidence: [] },
      { allowSuspiciousOverwrite: true }
    );

    assert.equal(completed, true);
    assert.equal((await fixture.db.get("cases", "case-1")).evidence.length, 0);
    assert.equal(await fixture.db.get("images", "remove-me"), undefined);
  } finally {
    await fixture.dispose();
  }
});

test("a binary cleanup failure aborts the real IndexedDB transaction", async () => {
  const fixture = await createDatabase();
  const initial = caseWith("case-1", { evidence: [{ id: "ev-1", attachments: [attachment("preserve-me")] }] });

  try {
    await fixture.db.put("cases", initial);
    await fixture.db.put("images", { id: "preserve-me", dataUrl: "data:image/png;base64,AA==" });

    await assert.rejects(
      saveCaseToDb(failingImageDeleteDb(fixture.db), { ...initial, evidence: [] }, { allowSuspiciousOverwrite: true }),
      /simulated image deletion failure/
    );

    assert.equal((await fixture.db.get("cases", "case-1")).evidence.length, 1);
    assert.equal((await fixture.db.get("images", "preserve-me")).dataUrl, "data:image/png;base64,AA==");
  } finally {
    await fixture.dispose();
  }
});

test("shared image binaries remain until the final persisted case reference is removed", async () => {
  const fixture = await createDatabase();
  const first = caseWith("case-1", { evidence: [{ id: "ev-1", attachments: [attachment("shared-image")] }] });
  const second = caseWith("case-2", { documents: [{ id: "doc-1", attachments: [attachment("shared-image")] }] });

  try {
    await fixture.db.put("cases", first);
    await fixture.db.put("cases", second);
    await fixture.db.put("images", { id: "shared-image", dataUrl: "data:application/pdf;base64,AA==" });

    await saveCaseToDb(fixture.db, { ...first, evidence: [] }, { allowSuspiciousOverwrite: true });
    assert.notEqual(await fixture.db.get("images", "shared-image"), undefined);

    await saveCaseToDb(fixture.db, { ...second, documents: [] }, { allowSuspiciousOverwrite: true });
    assert.equal(await fixture.db.get("images", "shared-image"), undefined);
  } finally {
    await fixture.dispose();
  }
});

test("atomic restore batch commits all cases and staged binaries together", async () => {
  const fixture = await createDatabase();
  const first = caseWith("case-1");
  const second = caseWith("case-2");
  let completed = false;
  try {
    await fixture.db.put("cases", first);
    await fixture.db.put("cases", second);
    const updatedFirst = { ...first, evidence: [{ id: "ev-1", attachments: [attachment("restored-image")] }] };
    const updatedSecond = { ...second, documents: [{ id: "doc-1", title: "Restored document", attachments: [] }] };

    await saveCasesAndImagesToDb(
      completionInstrumentedDb(fixture.db, () => { completed = true; }),
      [updatedFirst, updatedSecond],
      [{ id: "restored-image", evidenceId: "ev-1", dataUrl: "data:application/pdf;base64,AA==" }],
      { operation: "restoreBackupPayload" }
    );

    assert.equal((await fixture.db.get("cases", "case-1")).evidence[0].id, "ev-1");
    assert.equal((await fixture.db.get("cases", "case-2")).documents[0].id, "doc-1");
    assert.equal((await fixture.db.get("images", "restored-image")).dataUrl, "data:application/pdf;base64,AA==");
    assert.equal(completed, true);
    assert.equal(updatedFirst.revision, 2);
    assert.equal(updatedSecond.revision, 2);
  } finally {
    await fixture.dispose();
  }
});

test("atomic restore batch aborts all earlier case writes when a later case write fails", async () => {
  const fixture = await createDatabase();
  const first = caseWith("case-1");
  const second = caseWith("case-2");
  try {
    await fixture.db.put("cases", first);
    await fixture.db.put("cases", second);
    await assert.rejects(
      saveCasesAndImagesToDb(
        failingSecondCasePutDb(fixture.db),
        [{ ...first, evidence: [{ id: "ev-1", attachments: [] }] }, { ...second, documents: [{ id: "doc-1", attachments: [] }] }],
        [{ id: "not-committed", dataUrl: "data:application/pdf;base64,AA==" }],
        { operation: "restoreBackupPayload" }
      ),
      /simulated second case write failure/
    );
    assert.deepEqual(await fixture.db.get("cases", "case-1"), first);
    assert.deepEqual(await fixture.db.get("cases", "case-2"), second);
    assert.equal(await fixture.db.get("images", "not-committed"), undefined);
  } finally {
    await fixture.dispose();
  }
});

test("atomic restore batch rejects a stale case without changing other selected cases", async () => {
  const fixture = await createDatabase();
  const first = { ...caseWith("case-1"), revision: 2 };
  const second = caseWith("case-2");
  try {
    await fixture.db.put("cases", first);
    await fixture.db.put("cases", second);
    await assert.rejects(
      saveCasesAndImagesToDb(fixture.db, [caseWith("case-1"), { ...second, evidence: [{ id: "ev-2", attachments: [] }] }], [], { operation: "restoreBackupPayload" }),
      /Case save conflict/
    );
    assert.deepEqual(await fixture.db.get("cases", "case-1"), first);
    assert.deepEqual(await fixture.db.get("cases", "case-2"), second);
  } finally {
    await fixture.dispose();
  }
});

test("atomic restore batch preserves a shared image referenced by another restored case", async () => {
  const fixture = await createDatabase();
  const first = caseWith("case-1", { evidence: [{ id: "ev-1", attachments: [attachment("shared-image")] }] });
  const second = caseWith("case-2");
  try {
    await fixture.db.put("cases", first);
    await fixture.db.put("cases", second);
    await fixture.db.put("images", { id: "shared-image", dataUrl: "data:application/pdf;base64,AA==" });
    await saveCasesAndImagesToDb(
      fixture.db,
      [{ ...first, evidence: [] }, { ...second, documents: [{ id: "doc-1", attachments: [attachment("shared-image")] }] }],
      [],
      { operation: "restoreBackupPayload", allowSuspiciousOverwrite: true }
    );
    assert.notEqual(await fixture.db.get("images", "shared-image"), undefined);
  } finally {
    await fixture.dispose();
  }
});
