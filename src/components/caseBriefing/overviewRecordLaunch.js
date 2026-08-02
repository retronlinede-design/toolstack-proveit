const EDITABLE_RECORD_TYPES = new Set(["incidents", "evidence", "strategy"]);

export function getOverviewRecordLaunch(item) {
  if (!item?.record) return null;
  if (item.recordType === "watchItems") return { kind: "watch", record: item.record };
  if (item.recordType === "documents") return { kind: "document", record: item.record };
  if (item.recordType === "ledger") return { kind: "ledger", record: item.record };
  if (EDITABLE_RECORD_TYPES.has(item.recordType)) {
    return { kind: "record", editorType: item.recordType, record: item.record };
  }
  return null;
}
