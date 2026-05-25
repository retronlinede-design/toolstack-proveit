import { openDB } from "idb";
import { DB_NAME, DB_VERSION, STORE_NAMES } from "./dbConstants.js";

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {
    if (!db.objectStoreNames.contains(STORE_NAMES.cases)) {
      db.createObjectStore(STORE_NAMES.cases, { keyPath: "id" });
    }

    let evidenceStore;
    if (!db.objectStoreNames.contains(STORE_NAMES.evidence)) {
      evidenceStore = db.createObjectStore(STORE_NAMES.evidence, { keyPath: "id" });
    } else {
      evidenceStore = transaction.objectStore(STORE_NAMES.evidence);
    }

    if (!evidenceStore.indexNames.contains("caseId")) {
      evidenceStore.createIndex("caseId", "caseId");
    }

    let imageStore;
    if (!db.objectStoreNames.contains(STORE_NAMES.images)) {
      imageStore = db.createObjectStore(STORE_NAMES.images, { keyPath: "id" });
    } else {
      imageStore = transaction.objectStore(STORE_NAMES.images);
    }

    if (!imageStore.indexNames.contains("caseId")) {
      imageStore.createIndex("caseId", "caseId");
    }

    if (!imageStore.indexNames.contains("evidenceId")) {
      imageStore.createIndex("evidenceId", "evidenceId");
    }
  },
});
