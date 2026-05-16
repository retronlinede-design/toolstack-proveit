function safeText(value) {
  return typeof value === "string" ? value : "";
}

export function truncateTimelineText(value, max = 180) {
  const text = safeText(value).trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

export function getTimelineTypeDetail(recordType, item) {
  const text = `${safeText(item?.title)} ${safeText(item?.description)} ${safeText(item?.summary)} ${safeText(item?.notes)} ${safeText(item?.category)}`.toLowerCase();
  if (recordType === "ledger") return "payment";
  if (["email", "whatsapp", "message", "letter", "reply", "notice", "sms"].some((word) => text.includes(word))) {
    return "communication";
  }
  return recordType;
}

export function getTimelineDate(recordType, item) {
  if (recordType === "document") return item.documentDate || item.date || item.createdAt || "";
  if (recordType === "ledger") return item.paymentDate || item.dueDate || item.period || item.createdAt || "";
  return item.eventDate || item.date || item.capturedAt || item.createdAt || "";
}

export function getTimelineTitle(recordType, item) {
  if (recordType === "ledger") return item.label || item.category || "Untitled ledger entry";
  if (recordType === "document") return item.title || "Untitled document";
  if (recordType === "strategy") return item.title || "Untitled strategy";
  if (recordType === "incident") return item.title || "Untitled incident";
  return item.title || "Untitled evidence";
}

export function getTimelineSummary(recordType, item) {
  if (recordType === "ledger") {
    const amounts = [
      item.expectedAmount !== undefined && item.expectedAmount !== "" ? `Expected ${item.expectedAmount} ${item.currency || ""}`.trim() : "",
      item.paidAmount !== undefined && item.paidAmount !== "" ? `Paid ${item.paidAmount} ${item.currency || ""}`.trim() : "",
      item.differenceAmount ? `Difference ${item.differenceAmount} ${item.currency || ""}`.trim() : "",
    ].filter(Boolean).join(" · ");
    return truncateTimelineText([amounts, item.status, item.proofStatus, item.notes].filter(Boolean).join(" · "));
  }
  if (recordType === "document") return truncateTimelineText(item.summary || item.textContent || item.notes);
  if (recordType === "evidence") return truncateTimelineText(item.functionSummary || item.description || item.notes || item.reviewNotes);
  return truncateTimelineText(item.summary || item.description || item.notes);
}

export const toTimelineItems = (items, recordType) => (items || []).map((item) => ({
  id: item.id || `${recordType}-${getTimelineTitle(recordType, item)}`,
  recordType,
  typeDetail: getTimelineTypeDetail(recordType, item),
  date: getTimelineDate(recordType, item),
  title: getTimelineTitle(recordType, item),
  summary: getTimelineSummary(recordType, item),
  isMilestone: (recordType === "incident" || recordType === "evidence") ? !!item?.isMilestone : false,
  source: item,
}));
