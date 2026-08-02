const COLLECTION_BY_TYPE = {
  incident: "incidents",
  incidents: "incidents",
  evidence: "evidence",
  document: "documents",
  documents: "documents",
  ledger: "ledger",
  strategy: "strategy",
  watch: "watchItems",
  watchItems: "watchItems",
};

function unresolved(reason = "No direct record available") {
  return { handled: false, reason };
}

function findRecord(caseData, recordType, recordId, fallbackRecord) {
  const collection = COLLECTION_BY_TYPE[recordType];
  if (!collection) return null;
  const stableId = recordId || fallbackRecord?.id;
  if (!stableId) return null;
  return (caseData?.[collection] || []).find((record) => record.id === stableId) || null;
}

export function getOverviewRecordLaunch(item, caseData = {}) {
  if (!item) return unresolved();

  if (item.sourceType === "case_briefing" || item.recordType === "overview") {
    return { handled: true, targetType: "case_briefing", targetId: "actionSummary" };
  }

  if (item.action === "issue-manager" && item.sourceType !== "issue_review") {
    return { handled: true, targetType: "issue", targetId: item.issueId || "", targetName: item.issueName || item.issue || "" };
  }

  if (item.sourceType === "issue_review") {
    const targetId = item.issueId || "";
    if (!targetId && !item.issueName && !item.issue) return unresolved();
    return { handled: true, targetType: "issue", targetId, targetName: item.issueName || item.issue || "" };
  }

  const recordType = item.affectedRecordType || item.recordType || item.sourceType;
  const recordId = item.affectedRecordId || item.sourceRecordId || item.record?.id || item.id;
  const record = findRecord(caseData, recordType, recordId, item.record);
  if (!record) return unresolved();

  const targetType = COLLECTION_BY_TYPE[recordType];
  if (targetType === "watchItems") return { handled: true, targetType: "watch", targetId: record.id, record };
  if (targetType === "documents") return { handled: true, targetType: "document", targetId: record.id, record };
  if (targetType === "ledger") return { handled: true, targetType: "ledger", targetId: record.id, record };
  if (["incidents", "evidence", "strategy"].includes(targetType)) return { handled: true, targetType, targetId: record.id, record };
  return unresolved();
}
