export const SEQUENCE_GROUP_TYPE_LABELS = {
  incidents: "Incidents",
  evidence: "Evidence",
  documents: "Documents",
  strategy: "Strategy",
};

export const SEQUENCE_RELATIONSHIP_FILTER_LABELS = {
  all: "Show all",
  weak: "Weak / unlinked",
  proof: "Incidents + evidence",
};

export function safeSequenceText(value) {
  return typeof value === "string" ? value : "";
}

export function getSequenceRecordKey(record) {
  return `${record.recordType}:${record.id}`;
}

export function getTimelineTypeClasses(recordType) {
  if (recordType === "incidents") return "border-red-200 bg-red-50 text-red-700";
  if (recordType === "evidence") return "border-lime-200 bg-lime-50 text-lime-700";
  if (recordType === "documents") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-violet-200 bg-violet-50 text-violet-700";
}

export function getRelationshipWarningLabel(flag) {
  if (flag === "incident_no_linked_evidence") return "No linked evidence";
  if (flag === "evidence_no_linked_incident") return "No linked incident";
  if (flag === "document_isolated") return "Isolated document";
  if (flag === "strategy_unlinked") return "Strategy unlinked";
  return "Weak link";
}

export function getRelationshipRelationLabel(relationType) {
  if (relationType === "incident_evidence") return "proves/supports";
  if (relationType === "based_on_evidence") return "based on";
  if (relationType === "linked_incident") return "linked incident";
  if (relationType === "linked_evidence") return "linked evidence";
  return "linked record";
}

export function sequenceRecordMatchesSearch(record, search) {
  if (!search) return true;
  return [record.title, record.summary, record.status, record.date]
    .some((value) => safeSequenceText(value).toLowerCase().includes(search));
}
