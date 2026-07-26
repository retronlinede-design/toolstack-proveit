import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const evidence = readFileSync(new URL("./EvidenceRecordCard.jsx", import.meta.url), "utf8");
const dispatcher = readFileSync(new URL("./RecordCard.jsx", import.meta.url), "utf8");

test("Evidence uses every shared record-card primitive through the active dispatcher", () => {
  for (const component of ["RecordCardShell", "RecordBadge", "RecordActions", "RecordMetadataRow", "RecordLinksRow"]) {
    assert.match(evidence, new RegExp(`import ${component}`));
    assert.match(evidence, new RegExp(`<${component}`));
  }
  assert.match(dispatcher, /import EvidenceRecordCard/);
  assert.match(dispatcher, /recordType === "evidence"/);
  assert.match(dispatcher, /return <EvidenceRecordCard/);
  assert.doesNotMatch(dispatcher, /rounded-2xl border p-4|absolute top-3 right-3/);
});

test("Evidence preserves badge semantics and ordering", () => {
  const badges = evidence.slice(evidence.indexOf("badges={<>"), evidence.indexOf("actions={<RecordActions"));
  const labels = [">Evidence<", "getStatusLabel", "Strong Evidence", ">Milestone<", ">Action Required<", "showTypeBadge", ">New<", "EVIDENCE_TYPE_LABELS", "EVIDENCE_ROLE_LABELS", "sequence-group"];
  labels.forEach((label, index) => { if (index) assert.ok(badges.indexOf(labels[index - 1]) < badges.indexOf(label)); });
  assert.match(badges, /Supporting Evidence/);
  assert.match(evidence, /verified"\) return "verification-verified"/);
  assert.match(evidence, /incomplete"\) return "verification-unverified"/);
  assert.match(evidence, /return "verification-partial"/);
});

test("Evidence preserves exact actions and handlers", () => {
  const actions = ['key: "open"', 'key: "convert"', 'key: "delete"'];
  actions.forEach((action, index) => { if (index) assert.ok(evidence.indexOf(actions[index - 1]) < evidence.indexOf(action)); });
  assert.match(evidence, /openEditRecordModal\("evidence", item\)/);
  assert.match(evidence, /onConvertRecord\?\.\("evidence", item\)/);
  assert.match(evidence, /deleteRecord\("evidence", item\.id\)/);
});

test("Evidence preserves metadata availability and descriptive content", () => {
  for (const key of ["availability", "evidence-date", "logged-date"]) assert.match(evidence, new RegExp(`key: "${key}"`));
  assert.match(evidence, /item\.eventDate \|\| item\.date/);
  assert.match(evidence, /formatLoggedAt\(item\.createdAt\)/);
  assert.match(evidence, /What this shows:/);
  assert.match(evidence, /item\.functionSummary/);
  assert.match(evidence, /item\.availability\?\.physical\?\.hasOriginal/);
  assert.match(evidence, /item\.availability\?\.digital\?\.hasDigital/);
});

test("Evidence preserves relationships truncation missing indicators and handlers", () => {
  const groups = ["linked-parties", "linked-incidents", "tracking-records"];
  groups.forEach((group, index) => { if (index) assert.ok(evidence.indexOf(groups[index - 1]) < evidence.indexOf(group)); });
  assert.match(evidence, /\.slice\(0, 4\)/);
  assert.match(evidence, /missing link/);
  assert.match(evidence, /missing part/);
  assert.match(evidence, /openLinkedRecord\?\.\(id\)/);
  assert.match(evidence, /openLinkedRecord\?\.\(record\.id\)/);
  assert.match(evidence, /\[TRACK RECORD\]/);
});

test("Evidence preserves attachment preview inputs and responsive dark presentation", () => {
  assert.match(evidence, /attachments=\{item\.attachments\} imageCache=\{imageCache\} onPreview=\{onPreviewFile\}/);
  assert.match(evidence, /type\.startsWith\("image\/"\)/);
  assert.match(evidence, /type === "application\/pdf"/);
  assert.match(evidence, /grid grid-cols-2 gap-1 sm:min-w-44/);
  assert.match(evidence, /dark:border-neutral-700/);
  assert.match(evidence, /dark:text-neutral-300/);
  assert.match(evidence, /expanded/);
});
