import test from "node:test";
import assert from "node:assert/strict";
import { buildAiWorkspaceCurrentCase } from "./export/aiWorkspace.js";

import {
  CaseRevisionConflictError,
  EMERGENCY_BACKUP_PREFIX,
  collectEmbeddedCaseImageIds,
  deleteCaseFromDb,
  getCommittedCaseRevision,
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

function makeTransactionalFakeDb(initialState, { failImageDelete = false } = {}) {
  const db = makeFakeDb(initialState);
  db.transaction = (storeNames, mode) => {
    assert.deepEqual(storeNames, ["cases", "images"]);
    assert.equal(mode, "readwrite");
    const staged = {
      cases: new Map(db.stores.cases),
      images: new Map(db.stores.images),
    };
    let aborted = false;

    const tx = {
      objectStore(storeName) {
        return {
          async get(id) { return staged[storeName].get(id); },
          async getAll() { return [...staged[storeName].values()]; },
          async put(item) { staged[storeName].set(item.id, item); },
          async delete(id) {
            if (storeName === "images" && failImageDelete) throw new Error("simulated image cleanup failure");
            staged[storeName].delete(id);
          },
        };
      },
      abort() { aborted = true; },
      done: {
        then(resolve, reject) {
          if (aborted) return reject(new Error("transaction aborted"));
          for (const storeName of ["cases", "images"]) {
            db.stores[storeName].clear();
            for (const [id, item] of staged[storeName]) db.stores[storeName].set(id, item);
          }
          return resolve();
        },
      },
    };
    return tx;
  };
  return db;
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

test("saveCaseToDb removes a unique Evidence attachment binary but leaves unrelated historical orphans", async () => {
  const existingCase = {
    id: "case-1", revision: 1, incidents: [], documents: [], ledger: [], strategy: [], watchItems: [],
    evidence: [{ id: "ev-1", attachments: [attachment("removed-image")] }],
  };
  const db = makeFakeDb({
    cases: [existingCase],
    images: [{ id: "removed-image" }, { id: "historical-orphan" }],
  });

  await saveCaseToDb(db, { ...existingCase, evidence: [{ id: "ev-1", attachments: [] }] });

  assert.equal(db.stores.images.has("removed-image"), false);
  assert.equal(db.stores.images.has("historical-orphan"), true);
});

test("saveCaseToDb retains an Evidence binary while its mirrored digital-file reference remains", async () => {
  const existingCase = {
    id: "case-1", revision: 1, incidents: [], documents: [], ledger: [], strategy: [], watchItems: [],
    evidence: [{
      id: "ev-1",
      attachments: [attachment("mirrored-image")],
      availability: { digital: { files: [attachment("mirrored-image")] } },
    }],
  };
  const db = makeFakeDb({ cases: [existingCase], images: [{ id: "mirrored-image" }] });

  await saveCaseToDb(db, {
    ...existingCase,
    evidence: [{ id: "ev-1", attachments: [], availability: { digital: { files: [attachment("mirrored-image")] } } }],
  });

  assert.equal(db.stores.images.has("mirrored-image"), true);
});

test("saveCaseToDb safely cleans attachment binaries for deleted Evidence, Incident, Document, and Strategy records", async () => {
  const cases = [
    ["evidence", { id: "ev-1", attachments: [attachment("evidence-image")] }],
    ["incidents", { id: "inc-1", attachments: [attachment("incident-image")] }],
    ["documents", { id: "doc-1", attachments: [attachment("document-image")] }],
    ["strategy", { id: "strategy-1", attachments: [attachment("strategy-image")] }],
  ];

  for (const [collection, record] of cases) {
    const existingCase = {
      id: `case-${collection}`, revision: 1, incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [],
      [collection]: [record],
    };
    const imageId = record.attachments[0].storage.imageId;
    const db = makeFakeDb({ cases: [existingCase], images: [{ id: imageId }] });

    await saveCaseToDb(db, { ...existingCase, [collection]: [] }, { allowSuspiciousOverwrite: true });

    assert.equal(db.stores.images.has(imageId), false, `${collection} binary should be removed`);
  }
});

test("saveCaseToDb preserves shared attachment IDs across records and cases", async () => {
  const existingCase = {
    id: "case-1", revision: 1, incidents: [], documents: [], ledger: [], strategy: [], watchItems: [],
    evidence: [{ id: "ev-1", attachments: [attachment("shared-image")] }],
  };
  const otherCase = {
    id: "case-2", revision: 1, incidents: [], evidence: [], ledger: [], strategy: [], watchItems: [],
    documents: [{ id: "doc-1", attachments: [attachment("shared-image")] }],
  };
  const db = makeFakeDb({ cases: [existingCase, otherCase], images: [{ id: "shared-image" }] });

  await saveCaseToDb(db, { ...existingCase, evidence: [] }, { allowSuspiciousOverwrite: true });

  assert.equal(db.stores.images.has("shared-image"), true);
});

test("a rejected case save does not delete attachment binaries", async () => {
  const existingCase = {
    id: "case-1", revision: 2, incidents: [], documents: [], ledger: [], strategy: [], watchItems: [],
    evidence: [{ id: "ev-1", attachments: [attachment("protected-image")] }],
  };
  const db = makeFakeDb({ cases: [existingCase], images: [{ id: "protected-image" }] });

  await assert.rejects(
    saveCaseToDb(db, { ...existingCase, revision: 1, evidence: [] }, { allowSuspiciousOverwrite: true }),
    CaseRevisionConflictError
  );

  assert.equal(db.stores.images.has("protected-image"), true);
  assert.equal(db.stores.cases.get("case-1").evidence.length, 1);
});

test("a transactional attachment cleanup failure rolls back the staged case write and binary deletion", async () => {
  const existingCase = {
    id: "case-1", revision: 1, incidents: [], documents: [], ledger: [], strategy: [], watchItems: [],
    evidence: [{ id: "ev-1", attachments: [attachment("protected-image")] }],
  };
  const db = makeTransactionalFakeDb(
    { cases: [existingCase], images: [{ id: "protected-image" }] },
    { failImageDelete: true }
  );

  await assert.rejects(
    saveCaseToDb(db, { ...existingCase, evidence: [] }, { allowSuspiciousOverwrite: true }),
    /simulated image cleanup failure/
  );

  assert.equal(db.stores.cases.get("case-1").evidence.length, 1);
  assert.equal(db.stores.images.has("protected-image"), true);
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

test("saveCaseToDb protects retained Task records from an unexpected empty-array overwrite", async () => {
  await withPersistenceStubs(async ({ values }) => {
    const existingCase = {
      id: "case-tasks",
      revision: 3,
      name: "Retained task case",
      incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [],
      tasks: [{ id: "task-1", title: "Legacy task", attachments: [attachment("task-image")] }],
    };
    const db = makeFakeDb({ cases: [existingCase], images: [{ id: "task-image" }] });

    await saveCaseToDb(db, { ...existingCase, description: "An unrelated update" });
    assert.equal(db.stores.cases.get("case-tasks").tasks[0].id, "task-1");
    assert.equal(db.stores.images.has("task-image"), true);

    const current = db.stores.cases.get("case-tasks");
    await assert.rejects(
      saveCaseToDb(db, { ...current, tasks: [] }),
      /Blocked suspicious ProveIt case overwrite/
    );

    assert.equal(db.stores.cases.get("case-tasks").tasks[0].id, "task-1");
    assert.equal(db.stores.images.has("task-image"), true);
    assert.equal([...values.keys()].some((key) => key.startsWith(EMERGENCY_BACKUP_PREFIX)), true);
  });
});

test("saveCaseToDb permits an explicitly authorised retained Task deletion and cleans its unreferenced binary", async () => {
  await withPersistenceStubs(async () => {
    const existingCase = {
      id: "case-task-delete",
      revision: 1,
      incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [],
      tasks: [{ id: "task-1", title: "Retired task", attachments: [attachment("task-image")] }],
    };
    const db = makeFakeDb({ cases: [existingCase], images: [{ id: "task-image" }] });

    await saveCaseToDb(db, { ...existingCase, tasks: [] }, { allowSuspiciousOverwrite: true });

    assert.deepEqual(db.stores.cases.get("case-task-delete").tasks, []);
    assert.equal(db.stores.images.has("task-image"), false);
    assert.equal(db.stores.cases.get("case-task-delete").revision, 2);
  });
});

test("saveCaseToDb leaves cases with no retained Tasks unaffected", async () => {
  await withPersistenceStubs(async () => {
    const existingCase = {
      id: "case-no-tasks",
      revision: 1,
      name: "No task case",
      incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [], tasks: [],
    };
    const db = makeFakeDb({ cases: [existingCase] });
    await saveCaseToDb(db, { ...existingCase, name: "Updated no task case" });
    assert.equal(db.stores.cases.get("case-no-tasks").name, "Updated no task case");
    assert.deepEqual(db.stores.cases.get("case-no-tasks").tasks, []);
  });
});

test("retained Task saves still reject a stale case revision before any Task change", async () => {
  await withPersistenceStubs(async () => {
    const existingCase = {
      id: "case-task-revision",
      revision: 4,
      incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [],
      tasks: [{ id: "task-1", title: "Retained task" }],
    };
    const db = makeFakeDb({ cases: [existingCase] });
    const freshWriter = { ...structuredClone(existingCase), description: "A fresh change" };
    await saveCaseToDb(db, freshWriter);

    await assert.rejects(
      saveCaseToDb(db, { ...existingCase, tasks: [] }),
      CaseRevisionConflictError
    );
    assert.equal(db.stores.cases.get("case-task-revision").tasks[0].id, "task-1");
    assert.equal(db.stores.cases.get("case-task-revision").revision, 5);
  });
});

test("case revisions initialize, migrate, and advance only for a successful material save", async () => {
  await withPersistenceStubs(async () => {
    const db = makeFakeDb();
    const newCase = { id: "new-case", name: "New", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] };
    await saveCaseToDb(db, newCase);
    assert.equal(newCase.revision, 1);
    assert.equal(db.stores.cases.get("new-case").revision, 1);

    const legacy = { id: "legacy", name: "Legacy", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] };
    db.stores.cases.set(legacy.id, structuredClone(legacy));
    const migrated = structuredClone(legacy);
    await saveCaseToDb(db, migrated);
    assert.equal(migrated.revision, 1);

    const changed = { ...migrated, name: "Changed" };
    await saveCaseToDb(db, changed);
    assert.equal(changed.revision, 2);
    const reload = structuredClone(db.stores.cases.get("legacy"));
    await saveCaseToDb(db, reload);
    assert.equal(reload.revision, 2);
  });
});

test("case revision does not advance for a rejected save", async () => {
  await withPersistenceStubs(async () => {
    const existing = { id: "case-1", revision: 4, incidents: [{ id: "inc" }], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] };
    const db = makeFakeDb({ cases: [existing] });
    await assert.rejects(saveCaseToDb(db, { ...existing, incidents: [] }), /Blocked suspicious ProveIt case overwrite/);
    assert.equal(db.stores.cases.get("case-1").revision, 4);
  });
});

test("AUDIT-007: revision-checked saves reject stale whole-case writers without losing newer fields", async () => {
  await withPersistenceStubs(async () => {
    const original = { id: "case-1", revision: 7, name: "Original", description: "Original description", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] };
    const db = makeFakeDb({ cases: [original] });
    const firstWriter = { ...structuredClone(original), name: "First writer" };
    const staleWriter = { ...structuredClone(original), description: "Stale writer change" };

    await saveCaseToDb(db, firstWriter);
    assert.equal(firstWriter.revision, 8);

    await assert.rejects(saveCaseToDb(db, staleWriter), (error) => {
      assert.equal(error instanceof CaseRevisionConflictError, true);
      assert.equal(error.code, "CASE_REVISION_CONFLICT");
      assert.equal(error.expectedRevision, 7);
      assert.equal(error.actualRevision, 8);
      return true;
    });
    assert.deepEqual(db.stores.cases.get("case-1"), firstWriter);
    assert.equal(staleWriter.revision, 7);
    assert.equal(db.stores.cases.get("case-1").revision, 8);

    const freshWriter = structuredClone(db.stores.cases.get("case-1"));
    freshWriter.description = "Fresh writer change";
    await saveCaseToDb(db, freshWriter);
    assert.equal(freshWriter.revision, 9);
    assert.equal(db.stores.cases.get("case-1").name, "First writer");
    assert.equal(db.stores.cases.get("case-1").description, "Fresh writer change");
  });
});

test("AUDIT-007: a current-revision no-op stays a no-op", async () => {
  await withPersistenceStubs(async () => {
    const existing = { id: "case-1", revision: 4, name: "Current", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] };
    const db = makeFakeDb({ cases: [existing] });
    const noOp = structuredClone(existing);
    await saveCaseToDb(db, noOp);
    assert.equal(noOp.revision, 4);
    assert.equal(db.stores.cases.get("case-1").revision, 4);
  });
});

test("AUDIT-007: AI Workspace reports the revision committed after a fresh save", async () => {
  await withPersistenceStubs(async () => {
    const current = { id: "case-1", revision: 2, name: "Current", incidents: [], evidence: [], documents: [], ledger: [], strategy: [], watchItems: [] };
    const db = makeFakeDb({ cases: [current] });
    const fresh = { ...structuredClone(current), name: "Fresh" };
    await saveCaseToDb(db, fresh);
    assert.equal(fresh.revision, 3);
    assert.equal(buildAiWorkspaceCurrentCase(fresh).baseRevision, 3);
  });
});

test("existing revision wins over an imported revision and advances once for the committed change", () => {
  assert.equal(getCommittedCaseRevision({ id: "case", revision: 9, name: "Local" }, { id: "case", revision: 2, name: "Imported" }), 10);
  assert.equal(getCommittedCaseRevision({ id: "case", revision: 9, name: "Local" }, { id: "case", revision: 2, name: "Local" }), 9);
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

test("saveCaseToDb persists Strategy v3 planning fields without storage transformation", async () => {
  const strategy = {
    id: "str-v3",
    strategySchemaVersion: 2,
    objective: "Reach agreement",
    assumptions: ["The offer remains open"],
    risks: ["Terms may change"],
    nextSteps: ["Draft response"],
  };
  const caseItem = {
    id: "case-v3",
    incidents: [],
    evidence: [],
    documents: [],
    ledger: [],
    strategy: [strategy],
  };
  const db = makeFakeDb();

  await saveCaseToDb(db, caseItem);

  assert.deepEqual(db.stores.cases.get("case-v3").strategy[0], strategy);
});
