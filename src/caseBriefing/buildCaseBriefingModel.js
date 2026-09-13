const COLLECTIONS = [
  ["incidents", "Incident"],
  ["evidence", "Evidence"],
  ["documents", "Document"],
  ["ledger", "Ledger"],
  ["strategy", "Strategy"],
  ["watchItems", "To Watch"],
];

const text = (value) => typeof value === "string" ? value.trim() : "";
const list = (value) => Array.isArray(value) ? value : [];
const isArchived = (record) => text(record?.status).toLowerCase() === "archived" || record?.archived === true;
const timestamp = (record) => text(record?.updatedAt) || text(record?.createdAt);
const title = (record, fallback) => text(record?.title) || text(record?.name) || text(record?.description) || `${fallback} record`;
const day = (value) => text(value).slice(0, 10);
const validTime = (value) => { const time = Date.parse(value); return Number.isFinite(time) ? time : 0; };
const groupName = (record) => text(record?.sequenceGroup);
const issueLabel = (issue) => issue?.reference ? `${issue.reference} — ${issue.name}` : issue?.name || "";
const isActiveIssue = (issue) => !["closed", "complete", "completed", "done", "resolved", "archived", "cancelled", "canceled"].includes(text(issue?.status).toLowerCase());

function actionText(value) {
  return typeof value === "string" ? value.trim() : text(value?.text) || text(value?.title) || text(value?.label);
}

function flattenDiagnostics(diagnostics) {
  return list(diagnostics?.issues).flatMap((group) => list(group?.items).map((item) => ({
    id: `diagnostic:${group.category || "case"}:${item.id || item.title}`,
    severity: item.severity || "advisory",
    recordType: item.type || "case",
    title: item.title || group.category || "Case finding",
    reason: item.detail || "Review this case-quality finding.",
    record: item.record || null,
    sourceType: "diagnostic",
    sourceRecordId: item.record?.id || item.recordId || "",
    affectedRecordType: item.type || "case",
    affectedRecordId: item.record?.id || item.recordId || "",
    tab: item.tab || "overview",
  })));
}

function dueState(date, today) {
  if (!date) return "undated";
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "upcoming";
}

function buildActions(caseData, now) {
  const today = day(now);
  const actions = [];
  list(caseData?.strategy).filter((record) => !isArchived(record)).forEach((record) => {
    if (day(record.reviewDate)) actions.push({ id: `strategy-review:${record.id}`, title: `Review ${title(record, "Strategy")}`, source: "Strategy review", sourceType: "strategy", sourceRecordId: record.id, dueDate: day(record.reviewDate), owner: text(record.owner) || text(record.ownerName), issue: groupName(record), recordType: "strategy", record });
  });
  list(caseData?.watchItems).filter((record) => !isArchived(record)).forEach((record) => {
    if (day(record.reviewDate)) actions.push({ id: `watch-review:${record.id}`, title: `Review ${title(record, "Watch item")}`, source: "To Watch review", sourceType: "watch", sourceRecordId: record.id, dueDate: day(record.reviewDate), issue: groupName(record), recordType: "watchItems", record });
  });
  list(caseData?.issues).filter((issue) => isActiveIssue(issue) && issue.reviewDate).forEach((issue) => actions.push({ id: `issue-review:${issue.id}`, title: `Review ${issueLabel(issue)}`, source: "Issue review", sourceType: "issue_review", sourceRecordId: issue.id, dueDate: day(issue.reviewDate), issue: issueLabel(issue), recordType: "issue", issueId: issue.id, issueName: issue.name, action: "issue-manager" }));
  const seen = new Set();
  return actions.filter((item) => {
    const key = item.title.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map((item) => ({ ...item, dueState: dueState(item.dueDate, today) }))
    .sort((a, b) => {
      const rank = { overdue: 0, today: 1, upcoming: 2, undated: 3 };
      return rank[a.dueState] - rank[b.dueState] || String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    });
}

export function buildCaseBriefingModel({ caseData = {}, sequenceGroupMeta = {}, diagnostics = {}, now = new Date().toISOString(), folderName = "" } = {}) {
  const records = COLLECTIONS.flatMap(([key, label]) => list(caseData[key]).map((record) => ({ record, key, label })));
  const active = records.filter(({ record }) => !isArchived(record));
  const archived = records.length - active.length;
  const diagnosticItems = flattenDiagnostics(diagnostics);
  const groupMap = new Map();
  list(caseData.issues).filter((issue) => issue?.name && isActiveIssue(issue)).forEach((issue) => groupMap.set(issue.name, { name: issue.name, description: text(issue.description), metadataOnly: true, records: [], issue }));
  Object.entries(sequenceGroupMeta || {}).forEach(([name, meta]) => groupMap.set(name, { name, description: text(meta?.description), metadataOnly: true, records: [] }));
  active.forEach((entry) => {
    if (entry.record?.sequenceGroupId && list(caseData.issues).some((issue) => issue.id === entry.record.sequenceGroupId && !isActiveIssue(issue))) return;
    const matchedIssue = list(caseData.issues).find((issue) => isActiveIssue(issue) && entry.record?.sequenceGroupId && issue.id === entry.record.sequenceGroupId);
    const name = matchedIssue?.name || groupName(entry.record);
    if (!name) return;
    if (!groupMap.has(name)) groupMap.set(name, { name, description: "", metadataOnly: false, records: [] });
    groupMap.get(name).records.push(entry);
    groupMap.get(name).metadataOnly = false;
  });
  const issues = [...groupMap.values()].map((group) => {
    const counts = {};
    group.records.forEach(({ label }) => { counts[label] = (counts[label] || 0) + 1; });
    const latest = group.records.map(({ record }) => timestamp(record)).sort((a, b) => validTime(b) - validTime(a))[0] || "";
    const ids = new Set(group.records.map(({ record }) => record.id));
    const warningCount = diagnosticItems.filter((item) => item.record?.id && ids.has(item.record.id)).length;
    const owner = list(caseData.parties).find((party) => party.id === group.issue?.ownerPartyId);
    return { name: group.name, displayLabel: issueLabel(group.issue) || group.name, reference: group.issue?.reference || "", description: group.description, purpose: text(group.issue?.purpose), status: group.issue?.status || "", priority: group.issue?.priority || "", owner: text(owner?.displayName) || text(owner?.legalName) || text(owner?.name), reviewDate: group.issue?.reviewDate || "", currentPosition: text(group.issue?.currentPosition), directRecordCount: group.records.length, counts, latestActivity: latest, warningCount, empty: group.records.length === 0, metadataOnly: group.metadataOnly };
  }).sort((a, b) => {
    const priority = { critical: 0, high: 1, normal: 2, low: 3, "": 4 };
    const aOverdue = a.reviewDate && a.reviewDate < day(now) ? 0 : 1;
    const bOverdue = b.reviewDate && b.reviewDate < day(now) ? 0 : 1;
    return (priority[a.priority] ?? 4) - (priority[b.priority] ?? 4) || aOverdue - bOverdue || validTime(b.latestActivity) - validTime(a.latestActivity) || a.reference.localeCompare(b.reference) || a.name.localeCompare(b.name);
  });

  const today = day(now);
  const additionalFindings = [];
  const assignedIssueIds = new Set(list(caseData.issues).map((issue) => issue.id));
  const ungrouped = active.filter(({ record }) => !assignedIssueIds.has(record.sequenceGroupId) && !groupName(record));
  if (ungrouped.length) additionalFindings.push({ id: "ungrouped-records", severity: "advisory", recordType: "case", title: "Records are not assigned to an Issue", reason: `${ungrouped.length} active record${ungrouped.length === 1 ? " is" : "s are"} ungrouped.`, tab: "overview", action: "issue-manager" });
  issues.filter((issue) => issue.empty).forEach((issue) => additionalFindings.push({ id: `empty-issue:${issue.name}`, severity: "advisory", recordType: "Issue", title: "Empty Issue", reason: `${issue.name} has no direct records.`, issue: issue.name, action: "issue-manager" }));
  const seenFindings = new Set();
  const allFindings = [...diagnosticItems, ...additionalFindings].filter((item) => {
    const key = `${item.record?.id || item.sourceRecordId || item.id}:${item.title}:${item.reason}`;
    if (seenFindings.has(key)) return false;
    seenFindings.add(key); return true;
  });
  const severityRank = { blocking: 0, warning: 1, advisory: 2, info: 3 };
  allFindings.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));

  const recentActivity = active.map(({ record, key, label }) => ({ id: record.id, recordType: key, typeLabel: label, title: title(record, label), timestamp: timestamp(record), changeType: text(record.updatedAt) ? "Changed" : "Created", issue: groupName(record), archived: false, record }))
    .filter((item) => item.timestamp).sort((a, b) => validTime(b.timestamp) - validTime(a.timestamp) || a.title.localeCompare(b.title) || String(a.id).localeCompare(String(b.id))).slice(0, 8);
  const focus = text(caseData?.actionSummary?.currentFocus);
  const immediateActions = list(caseData?.actionSummary?.nextActions).filter((item) => !item?.completed).map((item, index) => ({ id: `briefing-action:${index}`, title: actionText(item), source: "Action Summary", sourceType: "case_briefing", sourceRecordId: "actionSummary", dueDate: day(item?.dueDate), dueState: dueState(day(item?.dueDate), today), recordType: "overview" })).filter((item) => item.title);
  const scheduledReviews = buildActions(caseData, now);
  let recommendedAction;
  if (!list(caseData.parties).length) recommendedAction = { title: "Add the people involved", reason: "No Parties are recorded for this case.", tab: "parties", buttonLabel: "Add Party" };
  else if (!list(caseData.incidents).length) recommendedAction = { title: "Record the first Incident", reason: "No Incidents are recorded for this case.", tab: "incidents", buttonLabel: "Add Incident" };
  else if (scheduledReviews[0]?.dueState === "overdue") recommendedAction = { title: scheduledReviews[0].title, reason: `This ${scheduledReviews[0].source.toLowerCase()} is overdue.`, item: scheduledReviews[0], buttonLabel: "Open source" };
  else if (allFindings[0]) recommendedAction = { title: allFindings[0].title, reason: allFindings[0].reason, item: allFindings[0], tab: allFindings[0].tab, buttonLabel: "Review finding" };
  else recommendedAction = { title: "Continue the current case plan", reason: "No higher-priority deterministic finding is currently detected.", tab: "overview", buttonLabel: "View Case Briefing" };

  return {
    isEmptyCase: records.length === 0 && list(caseData.parties).length === 0,
    snapshot: { name: text(caseData.name) || "Untitled case", category: text(caseData.category) || "Uncategorised", status: text(caseData.status) || "Not recorded", folder: folderName || "Inbox", lastUpdated: text(caseData.updatedAt) || text(caseData.createdAt), activeRecordCount: active.length, archivedRecordCount: archived, partyCount: list(caseData.parties).length, issueCount: issues.length, findingCount: allFindings.length },
    currentFocus: { text: focus, topNextAction: actionText(list(caseData?.actionSummary?.nextActions).find((item) => !item?.completed)), activeActionCount: list(caseData?.actionSummary?.nextActions).filter((item) => !item?.completed).length, reminderCount: list(caseData?.actionSummary?.importantReminders).length, deadlineCount: list(caseData?.actionSummary?.criticalDeadlines).length, lastUpdated: text(caseData?.actionSummary?.updatedAt) },
    issues,
    attentionItems: allFindings.slice(0, 7),
    immediateActions,
    scheduledReviews,
    nextActions: scheduledReviews,
    recentActivity,
    recommendedAction,
  };
}
