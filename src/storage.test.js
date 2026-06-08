import test from "node:test";
import assert from "node:assert/strict";

import {
  EMERGENCY_BACKUP_PREFIX,
  collectEmbeddedCaseImageIds,
  deleteCaseFromDb,
  saveCaseToDb,
} from "./storage.js";

function makeFakeDb({ cases = [], evidence = [], images = [] } = {}) {
  const stores = {
    cases: new Map(cases.map((item) => [item.id, item])),
    evidence: new Map(evidence.map((item) => [item.id, item])),
    images: new Map(images.map((item) => [item.id, item])),
  };
  const deleted = [];

  return {
    stores,
    deleted,
    async get(storeName, id) {
      return stores[storeName].get(id);
    },
    async getAll(storeName) {
      return Array.from(stores[storeName].values());
    },
    async getAllFromIndex(storeName, indexName, value) {
      return Array.from(stores[storeName].values()).filter((item) => item?.[indexName] === value);
    },
    async delete(storeName, id) {
      deleted.push({ storeName, id });
      stores[storeName].delete(id);
    },
    async put(storeName, item) {
      stores[storeName].set(item.id, item);
      return item.id;
    },
  };
}

async function withPersistenceStubs(callback) {
  const originalLocalStorage = globalThis.localStorage;
  const originalWarn = console.warn;
  const values = new Map();
  const warnings = [];

  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  console.warn = (...args) => warnings.push(args);

  try {
    return await callback({ values, warnings });
  } finally {
    globalThis.localStorage = originalLocalStorage;
    console.warn = originalWarn;
  }
}

function attachment(imageId) {
  return { id: `att-${imageId}`, storage: { type: "indexeddb", imageId } };
}

test("collectEmbeddedCaseImageIds gathers current embedded case attachment image ids", () => {
  const imageIds = collectEmbeddedCaseImageIds({
    evidence: [
      {
        attachments: [attachment("ev-att")],
        availability: { digital: { files: [attachment("ev-file")] } },
      },
    ],
    incidents: [{ attachments: [attachment("inc-att")] }],
    tasks: [{ attachments: [attachment("task-att")] }],
    strategy: [{ attachments: [attachment("strategy-att")] }],
    documents: [{ attachments: [attachment("doc-att")] }],
  });

  assert.deepEqual([...imageIds].sort(), [
    "doc-att",
    "ev-att",
    "ev-file",
    "inc-att",
    "strategy-att",
    "task-att",
  ]);
});

test("deleteCaseFromDb deletes embedded attachment images for the deleted case", async () => {
  const db = makeFakeDb({
    cases: [
      {
        id: "case-1",
        evidence: [
          {
            attachments: [attachment("ev-att")],
            availability: { digital: { files: [attachment("ev-file")] } },
          },
        ],
        incidents: [{ attachments: [attachment("inc-att")] }],
        tasks: [{ attachments: [attachment("task-att")] }],
        strategy: [{ attachments: [attachment("strategy-att")] }],
        documents: [{ attachments: [attachment("doc-att")] }],
      },
    ],
    images: [
      { id: "ev-att" },
      { id: "ev-file" },
      { id: "inc-att" },
      { id: "task-att" },
      { id: "strategy-att" },
      { id: "doc-att" },
    ],
  });

  await deleteCaseFromDb(db, "case-1");

  assert.equal(db.stores.cases.has("case-1"), false);
  assert.deepEqual([...db.stores.images.keys()], []);
});

test("deleteCaseFromDb preserves embedded image ids still referenced by another case", async () => {
  const db = makeFakeDb({
    cases: [
      {
        id: "case-1",
        evidence: [{ attachments: [attachment("shared-img"), attachment("deleted-only-img")] }],
      },
      {
        id: "case-2",
        documents: [{ attachments: [attachment("shared-img")] }],
      },
    ],
    images: [
      { id: "shared-img" },
      { id: "deleted-only-img" },
    ],
  });

  await deleteCaseFromDb(db, "case-1");

  assert.equal(db.stores.images.has("shared-img"), true);
  assert.equal(db.stores.images.has("deleted-only-img"), false);
  assert.equal(db.stores.cases.has("case-2"), true);
});

test("deleteCaseFromDb keeps existing legacy evidence and image cleanup intact", async () => {
  const db = makeFakeDb({
    cases: [{ id: "case-1" }],
    evidence: [
      { id: "legacy-ev-1", caseId: "case-1" },
      { id: "other-legacy-ev", caseId: "case-2" },
    ],
    images: [
      { id: "legacy-img-1", evidenceId: "legacy-ev-1" },
      { id: "other-legacy-img", evidenceId: "other-legacy-ev" },
    ],
  });

  await deleteCaseFromDb(db, "case-1");

  assert.equal(db.stores.evidence.has("legacy-ev-1"), false);
  assert.equal(db.stores.images.has("legacy-img-1"), false);
  assert.equal(db.stores.evidence.has("other-legacy-ev"), true);
  assert.equal(db.stores.images.has("other-legacy-img"), true);
});

test("deleteCaseFromDb handles duplicate embedded image ids safely", async () => {
  const db = makeFakeDb({
    cases: [
      {
        id: "case-1",
        evidence: [
          {
            attachments: [attachment("dup-img"), attachment("dup-img")],
            availability: { digital: { files: [attachment("dup-img")] } },
          },
        ],
        documents: [{ attachments: [attachment("dup-img")] }],
      },
    ],
    images: [{ id: "dup-img" }],
  });

  await deleteCaseFromDb(db, "case-1");

  const imageDeletes = db.deleted.filter((item) => item.storeName === "images" && item.id === "dup-img");
  assert.equal(imageDeletes.length, 1);
  assert.equal(db.stores.images.has("dup-img"), false);
});

test("deleteCaseFromDb ignores missing and empty embedded attachment structures", async () => {
  const db = makeFakeDb({
    cases: [
      {
        id: "case-1",
        evidence: [
          {
            attachments: [null, {}, { storage: {} }],
            availability: { digital: { files: "not-an-array" } },
          },
        ],
        incidents: null,
        tasks: [{ attachments: "not-an-array" }],
        strategy: undefined,
        documents: [{ attachments: [attachment("doc-img")] }],
      },
    ],
    images: [{ id: "doc-img" }],
  });

  await deleteCaseFromDb(db, "case-1");

  assert.equal(db.stores.cases.has("case-1"), false);
  assert.equal(db.stores.images.has("doc-img"), false);
});

test("saveCaseToDb blocks suspicious overwrite that would erase non-empty core arrays", async () => {
  await withPersistenceStubs(async ({ values, warnings }) => {
    const existingCase = {
      id: "case-1",
      incidents: [{ id: "inc-1" }],
      evidence: [{ id: "ev-1" }],
      documents: [{ id: "doc-1" }],
      ledger: [{ id: "ledger-1" }],
      strategy: [{ id: "str-1" }],
    };
    const db = makeFakeDb({ cases: [existingCase] });

    await assert.rejects(
      saveCaseToDb(db, {
        ...existingCase,
        incidents: [],
        evidence: [],
        documents: [],
        ledger: [],
        strategy: [],
      }),
      /Blocked suspicious ProveIt case overwrite/
    );

    assert.deepEqual(db.stores.cases.get("case-1"), existingCase);
    assert.equal([...values.keys()].some((key) => key.startsWith(EMERGENCY_BACKUP_PREFIX)), true);
    assert.equal(warnings.some((entry) => String(entry[0]).includes("blocked suspicious case overwrite")), true);
  });
});

test("saveCaseToDb allows explicit suspicious overwrite override and creates emergency backup", async () => {
  await withPersistenceStubs(async ({ values }) => {
    const existingCase = {
      id: "case-1",
      incidents: [{ id: "inc-1" }],
      evidence: [{ id: "ev-1" }],
      documents: [{ id: "doc-1" }],
      ledger: [{ id: "ledger-1" }],
      strategy: [{ id: "str-1" }],
    };
    const incomingCase = {
      ...existingCase,
      incidents: [],
      evidence: [],
      documents: [],
      ledger: [],
      strategy: [],
    };
    const db = makeFakeDb({ cases: [existingCase] });

    await saveCaseToDb(db, incomingCase, {
      operation: "test:explicit-overwrite",
      allowSuspiciousOverwrite: true,
    });

    assert.deepEqual(db.stores.cases.get("case-1"), incomingCase);
    const backupKeys = [...values.keys()].filter((key) => key.startsWith(EMERGENCY_BACKUP_PREFIX));
    assert.equal(backupKeys.length, 1);
    const backup = JSON.parse(values.get(backupKeys[0]));
    assert.equal(backup.operation, "test:explicit-overwrite:allowed-suspicious-overwrite");
    assert.equal(backup.caseCount, 1);
  });
});
