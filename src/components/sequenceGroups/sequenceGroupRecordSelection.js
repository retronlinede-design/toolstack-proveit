export const getSequenceGroupRecordKey = (record) => `${record.recordType}:${record.id}`;

export function filterSequenceGroupRecords(records, filters, selected = new Set()) {
  const query = (filters.search || "").trim().toLowerCase();
  return records.filter((record) => {
    if (query && !`${record.title || ""} ${record.summary || ""}`.toLowerCase().includes(query)) return false;
    if (filters.type !== "all" && record.recordType !== filters.type) return false;
    if (filters.status !== "all" && record.status !== filters.status) return false;
    if (filters.missingOnly && record.date) return false;
    if (filters.selectedOnly && !selected.has(getSequenceGroupRecordKey(record))) return false;
    return true;
  });
}

export function toggleSequenceGroupRecordSelection(selected, key) {
  const next = new Set(selected);
  next.has(key) ? next.delete(key) : next.add(key);
  return next;
}

export function selectVisibleSequenceGroupRecords(selected, visibleRecords) {
  return new Set([...selected, ...visibleRecords.map(getSequenceGroupRecordKey)]);
}
