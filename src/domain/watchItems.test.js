import test from "node:test";
import assert from "node:assert/strict";
import { getStrictCalendarDate, mergeCase, normalizeCase, normalizeWatchItem } from "./caseDomain.js";
import { resolveRecordById } from "./linkingResolvers.js";
import { filterAndSortWatchItems, getWatchReviewState, isWatchItemUnlinked, prepareWatchItemForm } from "../components/caseDetail/watchWorkspaceHelpers.js";
import { sanitizeCaseForExport } from "../export/caseExport.js";
import { buildFullBackupCase, restoreFullBackupCase } from "../backup/fullBackup.js";

test("missing watchItems normalizes without changing existing record collections", () => {
  const result = normalizeCase({ id: "case-1", incidents: [{ id: "i1", title: "Existing" }] });
  assert.deepEqual(result.watchItems, []);
  assert.equal(result.incidents[0].title, "Existing");
});

test("watch defaults and legacy partial values normalize safely", () => {
  const item = normalizeWatchItem({ id: "w1", title: "  Concern  ", date: "2026-02-03", observations: [null, {}, { id: "o2", date: "2026-02-02", text: " B ", createdAt: "z" }, { id: "o1", date: "2026-02-01", text: "A", createdAt: "a" }] });
  assert.equal(item.id, "w1"); assert.equal(item.type, "watch"); assert.equal(item.title, "Concern");
  assert.equal(item.status, "watching"); assert.equal(item.eventDate, item.date);
  assert.deepEqual(item.observations.map((o) => o.id), ["o1", "o2"]);
  assert.deepEqual(item.linkedRecordIds, []); assert.deepEqual(item.attachments, []);
});

test("calendar dates are strict and timezone independent", () => {
  assert.equal(getStrictCalendarDate("2024-02-29"), "2024-02-29");
  assert.equal(getStrictCalendarDate("2023-02-29"), "");
  assert.equal(getStrictCalendarDate("02/03/2026"), "");
  assert.equal(getStrictCalendarDate("2026-01-01T23:00:00-05:00"), "");
});

test("form preparation retains observation IDs and synchronizes dates", () => {
  const form = prepareWatchItemForm({ id: "w", date: "2026-04-01", eventDate: "2020-01-01", observations: [{ id: "stable", text: "Seen" }] });
  assert.equal(form.eventDate, "2026-04-01"); assert.equal(form.observations[0].id, "stable");
});

test("watch imports merge by ID and an absent collection cannot erase local items", () => {
  const existing = { id: "c", watchItems: [{ id: "w", title: "Local", date: "2026-01-01", rationale: "keep" }] };
  assert.equal(mergeCase(existing, { id: "c", name: "Import" }).watchItems[0].title, "Local");
  const merged = mergeCase(existing, { id: "c", watchItems: [{ id: "w", title: "Incoming", date: "2026-01-01" }] });
  assert.equal(merged.watchItems[0].title, "Incoming"); assert.equal(merged.watchItems[0].rationale, "keep");
});

test("sanitized exports preserve watch metadata and sanitize attachments", () => {
  const result = sanitizeCaseForExport({ watchItems: [{ id: "w", attachments: [{ id: "a", name: "x", binary: "remove" }] }] });
  assert.equal(result.watchItems[0].id, "w"); assert.equal(result.watchItems[0].attachments[0].binary, undefined);
});

test("full backup and restore preserve watch attachments", async () => {
  const source = { id: "c", watchItems: [{ id: "w", attachments: [{ id: "a", name: "file", storage: { imageId: "img" } }] }] };
  const backup = await buildFullBackupCase(source, { getImageById: async () => ({ dataUrl: "data:text/plain;base64,WA==" }) });
  assert.equal(backup.watchItems[0].attachments[0].backupDataUrl, "data:text/plain;base64,WA==");
  const restored = await restoreFullBackupCase(backup, { generateId: () => "new", saveImage: async () => "stored" });
  assert.equal(restored.watchItems[0].attachments[0].name, "file");
});

test("search, composed filters, review states, sorting, and unlinked calculation", () => {
  const items = [
    normalizeWatchItem({ id: "a", title: "Alpha", category: "security", priority: "critical", status: "watching", date: "2026-01-02", reviewDate: "2026-01-01" }),
    normalizeWatchItem({ id: "b", title: "Beta", category: "conduct", priority: "low", status: "resolved", date: "2026-01-01", reviewDate: "2026-01-02", linkedRecordIds: ["i"] }),
  ];
  assert.deepEqual(filterAndSortWatchItems(items, { search: "alpha", status: "watching", category: "security", priority: "critical", reviewState: "overdue", sort: "priority" }, "2026-01-02").map(i=>i.id), ["a"]);
  assert.deepEqual(filterAndSortWatchItems(items, { sort: "oldest" }).map(i=>i.id), ["b","a"]);
  assert.equal(getWatchReviewState(items[1], "2026-01-02"), "due"); assert.equal(isWatchItemUnlinked(items[0]), true); assert.equal(isWatchItemUnlinked(items[1]), false);
});

test("generic resolution supports watch items and missing targets", () => {
  const caseItem = { watchItems: [{ id: "w", title: "Watch", watchFor: "Change" }] };
  assert.equal(resolveRecordById(caseItem, "w").typeLabel, "To Watch"); assert.equal(resolveRecordById(caseItem, "missing"), null);
});
