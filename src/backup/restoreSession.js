const sourceId = (attachment) => attachment?.storage?.imageId || attachment?.imageId || attachment?.id;

// Only attachment locations supported by fullBackup's restore traversal.
function attachmentsIn(value) {
  const attachments = [...(value?.attachments || []), ...(value?.availability?.digital?.files || [])];
  for (const collection of ["evidence", "incidents", "tasks", "strategy", "watchItems", "documents"]) {
    for (const record of value?.[collection] || []) attachments.push(...attachmentsIn(record));
  }
  return attachments;
}

export function createRestoreSession({ addImage, generateId, deleteImages } = {}, sources = []) {
  const payloads = new Map();
  const pending = new Map();
  const created = new Set();
  const committed = new Set();
  let closed = false;

  // Index bytes before parallel traversal so reference-only duplicates also remap.
  for (const value of sources) {
    for (const attachment of attachmentsIn(value)) {
      const key = sourceId(attachment);
      if (!key || !attachment.backupDataUrl) continue;
      if (payloads.has(key) && payloads.get(key) !== attachment.backupDataUrl) {
        throw new Error("Conflicting backup bytes for one imported image ID.");
      }
      payloads.set(key, attachment.backupDataUrl);
    }
  }

  return {
    hasPayload(attachment) {
      return !!attachment.backupDataUrl || payloads.has(sourceId(attachment));
    },
    async restore(attachment, ownerId) {
      if (closed) throw new Error("Restore session is closed.");
      const key = sourceId(attachment) || attachment;
      const dataUrl = attachment.backupDataUrl || payloads.get(key);
      if (!pending.has(key)) {
        // The promise is registered before any asynchronous write completes.
        pending.set(key, (async () => {
          for (let attempt = 0; attempt < 10; attempt += 1) {
            const id = generateId();
            try {
              await addImage({ id, evidenceId: ownerId || null, dataUrl, createdAt: attachment.createdAt || new Date().toISOString() });
              created.add(id);
              return id;
            } catch (error) {
              // Atomic add rejects even a concurrent collision; never fall back to put.
              if (error?.name !== "ConstraintError") throw error;
            }
          }
          throw new Error("Could not allocate a fresh restore image ID.");
        })());
      }
      return pending.get(key);
    },
    commit(value) {
      for (const attachment of attachmentsIn(value)) {
        const id = attachment?.storage?.imageId;
        if (created.has(id)) committed.add(id);
      }
    },
    async cleanup() {
      closed = true;
      // Promise.all in callers may reject while other binary writes are in flight.
      await Promise.allSettled([...pending.values()]);
      const disposable = [...created].filter((id) => !committed.has(id));
      if (disposable.length) await deleteImages(disposable);
      for (const id of disposable) created.delete(id);
    },
  };
}
