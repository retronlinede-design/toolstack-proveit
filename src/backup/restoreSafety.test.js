import test from "node:test";
import assert from "node:assert/strict";
import { restoreFullBackupCase } from "./fullBackup.js";
import { createRestoreSession } from "./restoreSession.js";
import { addImageToDb, saveCaseToDb } from "../storage.js";
import { normalizeStoredCase } from "../domain/caseNormalization.js";

const attachment = (id = "X", bytes = "IMPORTED") => ({ id: `att-${id}`, imageId: id, storage: { type: "indexeddb", imageId: id }, backupDataUrl: bytes });
const caseWith = (id, attachments) => ({ id, evidence: [{ id: `record-${id}`, attachments }] });
function fixture(sources, { failSave = false, candidates = [] } = {}) {
  const images = new Map([["X", { id: "X", dataUrl: "ORIGINAL" }]]);
  const cases = new Map();
  const deleted = [];
  let next = 0;
  const db = {
    async add(store, item) {
      assert.equal(store, "images");
      if (images.has(item.id)) throw Object.assign(new Error("exists"), { name: "ConstraintError" });
      images.set(item.id, structuredClone(item));
    },
    async get(store, id) { assert.equal(store, "cases"); return cases.get(id); },
    async put(store, item) {
      assert.equal(store, "cases");
      if (failSave) throw new Error("case save failed");
      cases.set(item.id, structuredClone(item));
    },
  };
  const deps = {
    addImage: (image) => addImageToDb(db, image),
    generateId: () => candidates.shift() || `fresh-${++next}`,
    deleteImages: async (ids) => { for (const id of ids) { deleted.push(id); images.delete(id); } },
  };
  const restoreSession = createRestoreSession(deps, sources);
  return { images, cases, deleted, db, session: restoreSession, deps: { ...deps, restoreSession } };
}

test("AUDIT-002: imported image ID collision leaves ORIGINAL bytes untouched", async () => {
  const images = new Map([["X", { id: "X", dataUrl: "ORIGINAL" }]]);
  const restored = await restoreFullBackupCase({ id: "case", evidence: [{ id: "record", attachments: [
    { id: "attachment", storage: { type: "indexeddb", imageId: "X" }, backupDataUrl: "IMPORTED" },
  ] }] }, {
    generateId: () => "fresh",
    saveImage: async (image) => images.set(image.id, image),
    addImage: async (image) => {
      assert.ok(!images.has(image.id), "insert must not overwrite");
      images.set(image.id, image);
    },
  });
  assert.equal(images.get("X").dataUrl, "ORIGINAL");
  const restoredId = restored.evidence[0].attachments[0].storage.imageId;
  assert.notEqual(restoredId, "X");
  assert.equal(images.get(restoredId).dataUrl, "IMPORTED");
});

test("AUDIT-002: case-save failure cleans only fresh binaries, preserving local bytes", async () => {
  const source = caseWith("case", [attachment()]);
  const f = fixture([source], { failSave: true });
  await assert.rejects(async () => {
    try {
      const restored = normalizeStoredCase(await restoreFullBackupCase(source, f.deps));
      await saveCaseToDb(f.db, restored);
      f.session.commit(restored);
    } finally { await f.session.cleanup(); }
  }, /case save failed/);
  assert.deepEqual([...f.images.keys()], ["X"]);
  assert.equal(f.images.get("X").dataUrl, "ORIGINAL");
  assert.deepEqual(f.deleted, ["fresh-1"]);
});

test("AUDIT-002: successful non-colliding restore persists remapped bytes and survives cleanup", async () => {
  const source = caseWith("case", [attachment("remote")]);
  const f = fixture([source]);
  try {
    const restored = normalizeStoredCase(await restoreFullBackupCase(source, f.deps));
    await saveCaseToDb(f.db, restored);
    f.session.commit(restored);
  } finally { await f.session.cleanup(); }
  const stored = f.cases.get("case").evidence[0].attachments[0];
  assert.equal(stored.storage.imageId, "fresh-1");
  assert.equal(stored.imageId, "fresh-1");
  assert.equal(stored.id, "att-remote");
  assert.equal(stored.backupDataUrl, undefined);
  assert.equal(f.images.get(stored.storage.imageId).dataUrl, "IMPORTED");
  assert.deepEqual(f.deleted, []);
});

test("AUDIT-002: repeated parallel and reference-only IDs share one binary across cases", async () => {
  const first = caseWith("first", [attachment(), attachment()]);
  first.evidence[0].availability = { digital: { files: [attachment("X", undefined)] } };
  delete first.evidence[0].availability.digital.files[0].backupDataUrl;
  const second = caseWith("second", [attachment()]);
  const f = fixture([first, second]);
  const restored = await Promise.all([first, second].map((item) => restoreFullBackupCase(item, f.deps)));
  const refs = [...restored[0].evidence[0].attachments, ...restored[0].evidence[0].availability.digital.files, ...restored[1].evidence[0].attachments];
  assert.deepEqual(new Set(refs.map((att) => att.storage.imageId)), new Set(["fresh-1"]));
  assert.equal(f.images.size, 2);
  // First case fails; second succeeds and owns the shared binary.
  await saveCaseToDb(f.db, normalizeStoredCase(restored[1]));
  f.session.commit(restored[1]);
  await f.session.cleanup();
  assert.deepEqual(f.deleted, []);
  assert.equal(f.images.get("fresh-1").dataUrl, "IMPORTED");
  assert.equal(f.images.get("X").dataUrl, "ORIGINAL");
});

test("AUDIT-002: duplicate references with no successful owner are deleted exactly once", async () => {
  const source = caseWith("case", [attachment(), attachment()]);
  const f = fixture([source]);
  await restoreFullBackupCase(source, f.deps);
  await f.session.cleanup();
  await f.session.cleanup();
  assert.deepEqual(f.deleted, ["fresh-1"]);
  assert.equal(f.images.get("X").dataUrl, "ORIGINAL");
});

test("AUDIT-002: generated ID collision retries insert-only without overwriting", async () => {
  const source = caseWith("case", [attachment()]);
  const f = fixture([source], { candidates: ["X", "fresh-safe"] });
  const restored = await restoreFullBackupCase(source, f.deps);
  assert.equal(restored.evidence[0].attachments[0].storage.imageId, "fresh-safe");
  await f.session.cleanup();
  assert.equal(f.images.get("X").dataUrl, "ORIGINAL");
  assert.deepEqual(f.deleted, ["fresh-safe"]);
});

test("AUDIT-002: normalization failure after binary restore rolls back owned bytes", async () => {
  const source = { ...caseWith("case", [attachment()]), category: { invalid: true } };
  const f = fixture([source]);
  await assert.rejects(async () => {
    try { normalizeStoredCase(await restoreFullBackupCase(source, f.deps)); }
    finally { await f.session.cleanup(); }
  });
  assert.deepEqual(f.deleted, ["fresh-1"]);
  assert.equal(f.images.get("X").dataUrl, "ORIGINAL");
});

test("AUDIT-002: cleanup waits for in-flight binary writes after an early failure", async () => {
  const source = caseWith("case", [attachment()]);
  const f = fixture([source]);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const session = createRestoreSession({ ...f.deps, addImage: async (image) => { await gate; await f.deps.addImage(image); } }, [source]);
  const pending = session.restore(source.evidence[0].attachments[0], "record");
  const cleanup = session.cleanup();
  release();
  await pending;
  await cleanup;
  assert.deepEqual([...f.images.keys()], ["X"]);
});

test("AUDIT-002: contradictory bytes under one imported ID fail before any write", () => {
  assert.throws(() => fixture([caseWith("case", [attachment("X", "ONE"), attachment("X", "TWO")])]), /Conflicting backup bytes/);
});
