export function resolveSelectedTrackingRecordId(records = [], requestedId = "") {
  const availableRecords = Array.isArray(records) ? records.filter((record) => record?.id) : [];
  if (availableRecords.some((record) => record.id === requestedId)) return requestedId;
  return availableRecords[0]?.id || "";
}