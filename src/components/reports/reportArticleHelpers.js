export function formatReportDate(value) {
  return typeof value === "string" && value ? value : "No date";
}

export function formatReportMoney(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export function formatLedgerAmount(value, currency = "") {
  const amount = formatReportMoney(value);
  return currency && amount !== "-" ? `${amount} ${currency}` : amount;
}

export function getLinkedListLabel(item) {
  return typeof item === "string" ? item : item?.title || item?.id || "";
}
