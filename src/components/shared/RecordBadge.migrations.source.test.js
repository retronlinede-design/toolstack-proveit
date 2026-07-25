import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const watchSource = readFileSync(new URL("../caseDetail/WatchItemCard.jsx", import.meta.url), "utf8");
const partiesSource = readFileSync(new URL("../caseDetail/PartiesTab.jsx", import.meta.url), "utf8");

test("watch cards preserve badge labels while mapping status, category, and priority", () => {
  assert.match(watchSource, /item\.status && <RecordBadge variant=\{getWatchStatusBadgeVariant\(item\.status\)\}/);
  assert.match(watchSource, /item\.category && <RecordBadge variant="type"/);
  assert.match(watchSource, /item\.priority && <RecordBadge variant=\{getWatchPriorityBadgeVariant\(item\.priority\)\}/);
  assert.match(watchSource, /case "critical": return "priority-critical"/);
  assert.match(watchSource, /case "high": return "priority-high"/);
  assert.match(watchSource, /case "medium": return "priority-medium"/);
  assert.match(watchSource, /import RecordActions from "\.\.\/shared\/RecordActions\.jsx"/);
  assert.match(watchSource, /label: "Edit", onClick: \(\) => onEdit\(item\)/);
  assert.match(watchSource, /label: "Escalate to Incident"[^}]*onClick: \(\) => onConvert\(item, "incidents"\)/);
  assert.match(watchSource, /label: "Convert to Strategy"[^}]*onClick: \(\) => onConvert\(item, "strategy"\)/);
  assert.match(watchSource, /label: "Delete", variant: "danger", onClick: \(\) => onDelete\(item\)/);
});

test("party cards map entity, status, and restricted badges without changing labels", () => {
  assert.match(partiesSource, /<RecordBadge variant="type"[^>]*>\{getPartyEntityTypeLabel\(party\.entityType\)\}/);
  assert.match(partiesSource, /getPartyStatusBadgeVariant\(party\.status\)/);
  assert.match(partiesSource, /party\.confidentiality !== "normal"/);
  assert.match(partiesSource, /<RecordBadge variant="restricted"[^>]*>\{getPartyConfidentialityLabel\(party\.confidentiality\)\}/);
  assert.doesNotMatch(partiesSource, /tone="entity"|tone="status"|tone="restricted"/);
  assert.match(partiesSource, /import RecordActions from "\.\.\/shared\/RecordActions\.jsx"/);
  assert.match(partiesSource, /label: "Edit", onClick: \(\) => openEditModal\(party\)/);
  assert.match(partiesSource, /label: "Delete", variant: "danger", onClick: \(\) => deleteParty\(party\)/);
});
