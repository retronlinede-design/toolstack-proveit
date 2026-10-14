export const CASE_NAVIGATION_ORDER_STORAGE_KEY = "toolstack.proveit.v1.caseNavigationOrder";

export function normaliseCaseNavigationOrder(savedOrder, canonicalIds) {
  const availableIds = Array.isArray(canonicalIds) ? canonicalIds.filter((id) => typeof id === "string") : [];
  const knownIds = new Set(availableIds);
  const preferredIds = Array.isArray(savedOrder)
    ? savedOrder.filter((id, index) => typeof id === "string" && knownIds.has(id) && savedOrder.indexOf(id) === index)
    : [];

  return [...preferredIds, ...availableIds.filter((id) => !preferredIds.includes(id))];
}

export function readCaseNavigationOrder(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(CASE_NAVIGATION_ORDER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCaseNavigationOrder(order, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CASE_NAVIGATION_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Navigation order is a convenience preference; unavailable storage must not affect navigation.
  }
}

export function resetCaseNavigationOrder(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(CASE_NAVIGATION_ORDER_STORAGE_KEY);
  } catch {
    // Navigation order is a convenience preference; unavailable storage must not affect navigation.
  }
}

export function moveCaseNavigationItem(order, tabId, direction) {
  const index = order.indexOf(tabId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return order;

  const nextOrder = [...order];
  [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
  return nextOrder;
}
