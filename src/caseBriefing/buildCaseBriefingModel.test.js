import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseBriefingModel } from "./buildCaseBriefingModel.js";

const now = "2026-08-02T12:00:00.000Z";
const build = (caseData = {}, extra = {}) => buildCaseBriefingModel({ caseData, now, ...extra });

test("empty case produces factual empty states and onboarding recommendation", () => {
  const model = build({ name: "New case" });
  assert.equal(model.isEmptyCase, true);
  assert.equal(model.snapshot.activeRecordCount, 0);
  assert.equal(model.recommendedAction.tab, "parties");
});

test("snapshot excludes Parties and archived records from active record total", () => {
  const model = build({ parties: [{ id: "p1" }], incidents: [{ id: "i1" }, { id: "i2", status: "archived" }], documents: [{ id: "d1" }] });
  assert.equal(model.snapshot.activeRecordCount, 2);
  assert.equal(model.snapshot.archivedRecordCount, 1);
  assert.equal(model.snapshot.partyCount, 1);
});

test("Issues combine metadata-only groups and direct record counts", () => {
  const model = build({ incidents: [{ id: "i1", sequenceGroup: "Pay" }], evidence: [{ id: "e1", sequenceGroup: "Pay" }] }, { sequenceGroupMeta: { Pay: { description: "Pay issue" }, Empty: { description: "Prepared" } } });
  assert.equal(model.issues.find((x) => x.name === "Pay").directRecordCount, 2);
  assert.equal(model.issues.find((x) => x.name === "Empty").metadataOnly, true);
});

test("Issues order by latest activity then name", () => {
  const model = build({ incidents: [{ id: "a", sequenceGroup: "Alpha", updatedAt: "2026-01-01" }, { id: "z", sequenceGroup: "Zulu", updatedAt: "2026-02-01" }] });
  assert.deepEqual(model.issues.map((x) => x.name), ["Zulu", "Alpha"]);
});

test("recent activity uses update timestamps and limits output", () => {
  const incidents = Array.from({ length: 10 }, (_, index) => ({ id: `i${index}`, title: `Incident ${index}`, updatedAt: `2026-07-${String(index + 1).padStart(2, "0")}` }));
  const model = build({ incidents });
  assert.equal(model.recentActivity.length, 8);
  assert.equal(model.recentActivity[0].id, "i9");
});

test("archived records do not appear in recent activity", () => {
  assert.equal(build({ evidence: [{ id: "e", status: "archived", updatedAt: now }] }).recentActivity.length, 0);
});

test("diagnostic findings preserve severity and are bounded", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: index, title: `Finding ${index}`, severity: "blocking", type: "incidents" }));
  const model = build({}, { diagnostics: { issues: [{ category: "Dates", items }] } });
  assert.equal(model.attentionItems.length, 7);
  assert.equal(model.snapshot.findingCount, 10);
  assert.equal(model.attentionItems[0].severity, "blocking");
});

test("unresolved diagnostic links remain navigable to their source record", () => {
  const record = { id: "i1", title: "Incident" };
  const model = build({ incidents: [record] }, { diagnostics: { issues: [{ category: "Links", items: [{ id: "x", title: "Missing link", detail: "Target is absent", severity: "blocking", type: "incidents", record }] }] } });
  assert.equal(model.attentionItems[0].record.id, "i1");
});

test("overdue Strategy reviews precede upcoming actions", () => {
  const model = build({ strategy: [{ id: "s1", title: "Old", reviewDate: "2026-08-01" }, { id: "s2", title: "Future", reviewDate: "2026-08-03" }] });
  assert.equal(model.nextActions[0].dueState, "overdue");
  assert.equal(model.nextActions[1].dueState, "upcoming");
});

test("due and overdue Watch reviews are labelled deterministically", () => {
  const model = build({ watchItems: [{ id: "w1", title: "Today", reviewDate: "2026-08-02" }, { id: "w2", title: "Late", reviewDate: "2026-08-01" }] });
  assert.deepEqual(model.nextActions.map((x) => x.dueState), ["overdue", "today"]);
});

test("action ordering places overdue, today, upcoming, then undated", () => {
  const model = build({ actionSummary: { nextActions: [{ text: "Undated" }] }, strategy: [{ id: "s", title: "Future", reviewDate: "2026-08-03" }], watchItems: [{ id: "w", title: "Today", reviewDate: "2026-08-02" }, { id: "x", title: "Late", reviewDate: "2026-08-01" }] });
  assert.deepEqual(model.nextActions.map((x) => x.dueState), ["overdue", "today", "upcoming", "undated"]);
});

test("obvious duplicate actions are collapsed", () => {
  const model = build({ actionSummary: { nextActions: [{ text: "Send letter" }, { text: " send   letter " }] } });
  assert.equal(model.nextActions.length, 1);
});

test("current focus reuses Action Summary without adding persistence", () => {
  const model = build({ actionSummary: { currentFocus: "Review evidence", nextActions: [{ text: "Call adviser" }], importantReminders: ["Keep original"], criticalDeadlines: ["Friday"], updatedAt: now } });
  assert.deepEqual(model.currentFocus, { text: "Review evidence", topNextAction: "Call adviser", activeActionCount: 1, reminderCount: 1, deadlineCount: 1, lastUpdated: now });
});

test("supplied time makes results deterministic", () => {
  const input = { strategy: [{ id: "s", reviewDate: "2026-08-02" }] };
  assert.deepEqual(build(input), build(input));
});

test("model construction does not mutate its inputs", () => {
  const input = { incidents: [{ id: "i", sequenceGroup: "Issue", updatedAt: now }], actionSummary: { nextActions: [{ text: "Act" }] } };
  const before = structuredClone(input);
  build(input);
  assert.deepEqual(input, before);
});

test("stable Issue metadata drives human labels, owner display, ordering, and review actions", () => {
  const model = build({ parties: [{ id: "p1", name: "Rory" }], issues: [{ id: "issue_a", reference: "ISS-002", name: "Normal", status: "open", priority: "normal", ownerPartyId: null, reviewDate: null }, { id: "issue_b", reference: "ISS-001", name: "Heating", status: "waiting_response", priority: "critical", ownerPartyId: "p1", reviewDate: "2026-08-01", currentPosition: "Awaiting landlord" }], incidents: [{ id: "i", sequenceGroupId: "issue_b", sequenceGroup: "Old name", updatedAt: now }] });
  assert.equal(model.issues[0].displayLabel, "ISS-001 — Heating");
  assert.equal(model.issues[0].owner, "Rory");
  assert.equal(model.issues[0].currentPosition, "Awaiting landlord");
  assert.ok(model.nextActions.some((action) => action.title === "Review ISS-001 — Heating" && action.dueState === "overdue"));
});
