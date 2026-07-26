import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manager = readFileSync(new URL("./SequenceGroupManager.jsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("./SequenceGroupManagementModal.jsx", import.meta.url), "utf8");

test("manager uses three desktop regions and responsive stacking", () => {
  assert.match(manager, /lg:grid-cols-\[18rem_minmax\(0,1fr\)\]/);
  assert.match(manager, /xl:grid-cols-\[18rem_minmax\(0,1fr\)_15rem\]/);
  assert.match(manager, /lg:col-start-2 xl:col-start-auto/);
  assert.match(manager, /min-h-0 flex-1 overflow-y-auto p-3 sm:p-5/);
});

test("group list renders count descriptions and an announced selected state", () => {
  assert.match(manager, /Sequence Groups/);
  assert.match(manager, /No description\./);
  assert.match(manager, /group\.totalCount} record/);
  assert.match(manager, /aria-current=\{group\.name === activeGroupName/);
  assert.match(manager, /break-words text-sm font-semibold/);
  assert.match(manager, />New Group<\/button>/);
});

test("selected records use a non-colour-only selected treatment", () => {
  assert.match(manager, /data-selected-record=/);
  assert.match(manager, /ring-2 ring-\[#7a263a\]\/15/);
  assert.match(manager, /dark:ring-\[#d17a91\]\/20/);
});

test("actions are grouped and destructive actions are isolated", () => {
  for (const heading of ["Organisation", "Record Management", "Group Management", "Danger Zone"]) assert.match(manager, new RegExp(`>${heading}<`));
  for (const label of ["Manage Group Details", "Manage Records", "Move / Merge Group", "Delete Group"]) assert.match(manager, new RegExp(`label: "${label}"`));
  assert.match(manager, /border-red-200 bg-red-50\/50/);
  assert.match(manager, /variant: "danger"/);
});

test("manager metrics and empty states remain available", () => {
  for (const metric of ["Groups", "Need review", "Ungrouped", "Weak links / gaps"]) assert.match(manager, new RegExp(`"${metric}"`));
  for (const empty of ["No sequence groups yet", "Create your first sequence group", "No ungrouped records", "No matching records"]) assert.match(manager, new RegExp(empty));
});

test("manager surfaces include explicit dark mode treatments", () => {
  assert.match(manager, /dark:border-neutral-700 dark:bg-neutral-950/);
  assert.match(manager, /dark:border-neutral-700 dark:bg-neutral-900/);
  assert.match(manager, /dark:border-red-900 dark:bg-red-950\/20/);
  assert.match(manager, /dark:text-neutral-100/);
});

test("action shortcuts open the existing management sections", () => {
  assert.match(manager, /openEditGroupForm\("details"\)/);
  assert.match(manager, /openEditGroupForm\("records"\)/);
  assert.match(manager, /openEditGroupForm\("merge"\)/);
  assert.match(manager, /onDeleteGroup\?\.\(selectedGroup\)/);
  assert.match(manager, /initialSection=\{groupForm\.initialSection\}/);
  assert.match(modal, /initialSection = "details"/);
  assert.match(modal, /SECTIONS\.some\(\(\[key\]\) => key === initialSection\)/);
});
