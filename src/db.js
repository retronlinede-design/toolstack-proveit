import { openDB } from "idb";

export const dbPromise = openDB("proveit-db", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("cases")) {
      db.createObjectStore("cases", { keyPath: "id" });
    }

    if (!db.objectStoreNames.contains("evidence")) {
      const evidenceStore = db.createObjectStore("evidence", { keyPath: "id" });
      evidenceStore.createIndex("caseId", "caseId");
    }

    if (!db.objectStoreNames.contains("images")) {
      const imageStore = db.createObjectStore("images", { keyPath: "id" });
      imageStore.createIndex("caseId", "caseId");
      imageStore.createIndex("evidenceId", "evidenceId");
    }
  },
});