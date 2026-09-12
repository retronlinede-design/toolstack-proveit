const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// JSON property presence is authoritative. Arrays/scalars replace; nested objects
// merge recursively so, for example, an omitted contact phone is not cleared.
export function mergePresentFields(existing, incoming) {
  if (!isObject(incoming)) return incoming;
  const fields = new Map(Object.entries(isObject(existing) ? existing : {}));
  for (const [key, value] of Object.entries(incoming)) {
    fields.set(key, isObject(value) ? mergePresentFields(fields.get(key), value) : value);
  }
  return Object.fromEntries(fields);
}

// Entity collections are additive by ID: [] imports no records, not a deletion.
// Arrays inside an entity (attachments, links, observations, etc.) still replace.
export function mergeImportedRecords(existing = [], incoming = []) {
  const records = new Map(existing.map((record) => [record?.id || Symbol(), record]));
  for (const record of incoming) {
    const key = record?.id || Symbol();
    records.set(key, mergePresentFields(records.get(key), record));
  }
  return [...records.values()];
}
