export function getModelPackRecords(model, type) {
  const allRecords = model?.records?.all || [];
  if (model?.scope?.type !== "sequenceGroup") return (model?.records?.byType?.[type] || []);
  const primary = (model?.records?.primaryScopedRecords || []).filter((record) => record.type !== "ledger");
  const primaryIds = new Set(primary.map((record) => record.id));
  const directlyLinkedIds = new Set(primary.flatMap((record) => record.linkedRecordIds || []));
  return allRecords.filter((record) => record.type === type && (
    primaryIds.has(record.id)
    || directlyLinkedIds.has(record.id)
    || (record.linkedRecordIds || []).some((id) => primaryIds.has(id))
  ));
}

export function getModelRecordById(model) {
  return new Map((model?.records?.all || []).map((record) => [record.id, record]));
}

export function projectLegacyLink(recordById, link) {
  const target = recordById.get(link.targetId);
  return target
    ? { id: target.id, recordType: target.type, title: target.title, status: "resolved" }
    : { id: link.targetId, recordType: "unknown", title: link.targetId, status: "missing" };
}

export function getLegacyLinkedRecords(record, recordById, referenceTypes) {
  const links = (record.links || []).filter((link) => referenceTypes.includes(link.referenceType));
  return [...new Map(links.map((link) => projectLegacyLink(recordById, link)).map((item) => [item.id, item])).values()];
}
