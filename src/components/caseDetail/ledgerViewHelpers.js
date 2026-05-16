export function sortChronological(items) {
  return [...items].sort((a, b) => {
    const dateA = a.eventDate || a.date || "";
    const dateB = b.eventDate || b.date || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const createdA = a.createdAt || "";
    const createdB = b.createdAt || "";
    if (createdA !== createdB) return createdA.localeCompare(createdB);

    // Tie-breaker for same date/timestamp items
    const idA = String(a.id || "");
    const idB = String(b.id || "");
    return idA.localeCompare(idB);
  });
}

export function sortLedgerEntries(entries = []) {
  return [...entries].sort((a, b) => {
    const aPayment = a.paymentDate || "";
    const bPayment = b.paymentDate || "";
    if (aPayment !== bPayment) return bPayment.localeCompare(aPayment);

    const aDue = a.dueDate || "";
    const bDue = b.dueDate || "";
    if (aDue !== bDue) return bDue.localeCompare(aDue);

    const aPeriod = a.period || "";
    const bPeriod = b.period || "";
    if (aPeriod !== bPeriod) return bPeriod.localeCompare(aPeriod);

    const aCreated = a.createdAt || "";
    const bCreated = b.createdAt || "";
    if (aCreated !== bCreated) return bCreated.localeCompare(aCreated);

    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export function filterLedgerEntries(entries = [], filter = "all") {
  if (filter === "all") return entries;
  return entries.filter(item => item.category === filter);
}

export function groupLedgerEntriesByBatch(ledger = []) {
  const groupedLedger = Object.values(
    ledger.reduce((acc, item) => {
      const key = item.batchLabel || "Ungrouped";
      if (!acc[key]) {
        acc[key] = {
          batchLabel: key,
          items: []
        };
      }
      acc[key].items.push(item);
      return acc;
    }, {})
  );

  groupedLedger.sort((a, b) => {
    if (a.batchLabel === "Ungrouped") return 1;
    if (b.batchLabel === "Ungrouped") return -1;
    return a.batchLabel.localeCompare(b.batchLabel);
  });

  groupedLedger.forEach(group => {
    group.items.sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  return groupedLedger;
}
