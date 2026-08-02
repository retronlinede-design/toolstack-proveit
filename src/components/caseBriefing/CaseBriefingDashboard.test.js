import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithOxc } from "vite";

const url = new URL("./CaseBriefingDashboard.jsx", import.meta.url);
const transformed = await transformWithOxc(await readFile(url, "utf8"), url.pathname);
const code = transformed.code.replaceAll('from "react/jsx-runtime"', `from "${import.meta.resolve("react/jsx-runtime")}"`);
const Dashboard = (await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)).default;
const base = { isEmptyCase: false, snapshot: { name: "Case A", category: "Employment", status: "Open", folder: "Work", lastUpdated: "2026-08-02", activeRecordCount: 3, archivedRecordCount: 1, partyCount: 2, issueCount: 1, findingCount: 1 }, currentFocus: { text: "Establish chronology", topNextAction: "Review letter", activeActionCount: 1, reminderCount: 0, deadlineCount: 1 }, issues: [{ name: "Overtime", description: "Hours and responses", directRecordCount: 2, counts: { Incident: 1, Evidence: 1 }, latestActivity: "2026-08-01", warningCount: 1 }], attentionItems: [{ id: "f", severity: "blocking", recordType: "incidents", title: "Incident requires Evidence", reason: "No Evidence is linked." }], nextActions: [{ id: "a", title: "Review letter", source: "Strategy", dueState: "overdue", dueDate: "2026-08-01" }], recentActivity: [{ id: "i", recordType: "incidents", typeLabel: "Incident", title: "Sunday work", timestamp: "2026-08-02", issue: "Overtime" }], recommendedAction: { title: "Review letter", reason: "This strategy is overdue.", item: { id: "a" }, buttonLabel: "Open source" } };
const render = (model = base) => renderToStaticMarkup(React.createElement(Dashboard, { model }));

test("renders all six briefing sections and recommended action", () => { const html = render(); for (const label of ["Case Snapshot", "Current Focus", "Active Issues", "Needs Attention", "Next Actions", "Recent Activity", "Recommended next action"]) assert.match(html, new RegExp(label)); });
test("renders populated Issue, attention, overdue, and activity content", () => { const html = render(); for (const value of ["Overtime", "Hours and responses", "blocking", "Incident requires Evidence", "Overdue", "Sunday work"]) assert.match(html, new RegExp(value, "i")); });
test("renders the new-case actions", () => { const html = render({ ...base, isEmptyCase: true }); for (const value of ["Start building this case", "Add Party", "Add Incident", "Add Evidence", "Add Document"]) assert.match(html, new RegExp(value)); });
test("renders useful empty states", () => { const html = render({ ...base, snapshot: { ...base.snapshot, issueCount: 0, findingCount: 0 }, issues: [], attentionItems: [], nextActions: [], recentActivity: [] }); for (const value of ["No Issues have been created yet", "does not confirm", "No active actions", "No recent record activity"]) assert.match(html, new RegExp(value)); });
test("uses native buttons for Issue and record navigation", () => { const html = render(); assert.match(html, /<button[^>]*>.*Overtime/s); assert.match(html, />Open<\/button>/); });
test("includes explicit dark-mode and responsive classes", () => { const html = render(); assert.match(html, /dark:bg-neutral-9/); assert.match(html, /lg:grid-cols-2/); assert.match(html, /break-words/); });
test("contains no former Overview placeholder copy", () => { const html = render(); assert.doesNotMatch(html, /placeholder|Coming soon|Investigation Progress|Current Phase/i); });
test("identifies Parties as excluded from record scope", () => assert.match(render(), /Excludes Parties/));

