import { openDB } from "idb";

export const dbPromise = openDB("proveit-db", 2, {
  upgrade(db, oldVersion, newVersion, transaction) {
    if (!db.objectStoreNames.contains("cases")) {
      db.createObjectStore("cases", { keyPath: "id" });
    }

    let evidenceStore;
    if (!db.objectStoreNames.contains("evidence")) {
      evidenceStore = db.createObjectStore("evidence", { keyPath: "id" });
    } else {
      evidenceStore = transaction.objectStore("evidence");
    }

    if (!evidenceStore.indexNames.contains("caseId")) {
      evidenceStore.createIndex("caseId", "caseId");
    }

    let imageStore;
    if (!db.objectStoreNames.contains("images")) {
      imageStore = db.createObjectStore("images", { keyPath: "id" });
    } else {
      imageStore = transaction.objectStore("images");
    }

    if (!imageStore.indexNames.contains("caseId")) {
      imageStore.createIndex("caseId", "caseId");
    }

    if (!imageStore.indexNames.contains("evidenceId")) {
      imageStore.createIndex("evidenceId", "evidenceId");
    }
  },
});
