import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./IncidentRecordCard.jsx", import.meta.url), "utf8");
const recordCard = readFileSync(new URL("./RecordCard.jsx", import.meta.url), "utf8");

test("Incident uses every shared record-card primitive through the shared dispatcher", () => {
  for (const component of ["RecordCardShell", "RecordBadge", "RecordActions", "RecordMetadataRow", "RecordLinksRow"]) {
    assert.match(source, new RegExp(`import ${component}`));
    assert.match(source, new RegExp(`<${component}`));
  }
  assert.match(recordCard, /recordType === "incidents"\) return <IncidentRecordCard/);
  assert.match(recordCard, /recordType === "evidence"\) return <EvidenceRecordCard/);
  assert.doesNotMatch(source, /<article|rounded-2xl border p-4/);
});

test("Incident preserves badge visibility and ordering", () => {
  const badges = source.slice(source.indexOf("badges={"), source.indexOf("actions={"));
  for (const label of ["Milestone", "Action Required", "Incident", "New"]) assert.match(badges, new RegExp(label));
  assert.ok(badges.indexOf("Milestone") < badges.indexOf("Action Required"));
  assert.ok(badges.indexOf("Action Required") < badges.indexOf("showTypeBadge"));
  assert.ok(badges.indexOf("showTypeBadge") < badges.indexOf("isNew"));
  assert.match(source, /variant=\{milestone \? "milestone" : isNew \? "new" : "default"\}/);
});

test("Incident preserves action labels, accessible names, order, and exact handlers", () => {
  const actions = source.slice(source.indexOf("actions={"), source.indexOf("metadata={"));
  for (const key of ['key: "open"', 'key: "convert"', 'key: "delete"']) assert.match(actions, new RegExp(key));
  assert.ok(actions.indexOf('key: "open"') < actions.indexOf('key: "convert"'));
  assert.ok(actions.indexOf('key: "convert"') < actions.indexOf('key: "delete"'));
  assert.match(actions, /openEditRecordModal\("incidents", item\)/);
  assert.match(actions, /onConvertRecord\?\.\("incidents", item\)/);
  assert.match(actions, /deleteRecord\("incidents", item\.id\)/);
  assert.match(actions, /"aria-label": `Open \$\{incidentTitle\}`/);
  assert.match(actions, /"aria-label": `Delete \$\{incidentTitle\}`/);
});

test("Incident preserves chronology formatting and uses a compact description preview", () => {
  assert.match(source, /value: item\.eventDate \|\| item\.date/);
  assert.match(source, /formatLoggedAt\(item\.createdAt\)/);
  assert.match(source, /toLocaleDateString/);
  assert.match(source, /toLocaleTimeString/);
  assert.match(source, /item\.description\.length > 220/);
  assert.match(source, /expanded \|\| isTimeline/);
});

test("Incident preserves attachment preview data and handler", () => {
  assert.match(source, /<AttachmentPreview attachments=\{item\.attachments \|\| \[\]\} imageCache=\{imageCache\} onPreview=\{onPreviewFile\} \/>/);
});

test("Incident preserves relationship ordering handlers and missing indicators", () => {
  const keys = ["linked-parties", "linked-evidence", "caused-by", "supporting-records", "outcomes", "related"];
  keys.forEach((key) => assert.match(source, new RegExp(`key: "${key}"`)));
  assert.match(source, /openEditRecordModal\("evidence", evidence\)/);
  assert.match(source, /openLinkedRecord\?\.\(id\)/);
  assert.match(source, /onOpen\?\.\(incident\.id\)/);
  assert.match(source, /missing link/);
  assert.doesNotMatch(source, /label:.*record\.id|label:.*evidence\.id/);
});

test("Incident uses a compact accessible disclosure and retains expandable content", () => {
  assert.match(source, /grid grid-cols-2 gap-1 sm:min-w-44/);
  assert.match(source, /const \[expanded, setExpanded\] = useState\(isTimeline\)/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /aria-controls=\{detailId\}/);
  assert.match(source, /Show details/);
  assert.match(source, /expanded && <>/);
});

test("Incident resolves canonical Issue labels and presents status metadata", () => {
  assert.match(source, /resolveCaseIssue\(selectedCase, \{ issueId: item\.sequenceGroupId, issueName: sequenceGroup \}\)/);
  assert.match(source, /getIssueDisplayLabel\(issue\)/);
  assert.match(source, /Status: \{titleCase\(item\.status, "open"\)\}/);
  assert.match(source, /Evidence: \{titleCase\(item\.evidenceStatus, "needs evidence"\)\}/);
  assert.match(source, /relationship-count/);
});
