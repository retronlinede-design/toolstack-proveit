export function parseIncidentDate(value) {
  if (typeof value !== "string") return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return time;
}

export function compareIncidentsNewestFirst(a, b) {
  const aTime = parseIncidentDate(a?.eventDate);
  const bTime = parseIncidentDate(b?.eventDate);

  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return bTime - aTime;
}

export function compareIncidentsOldestFirst(a, b) {
  const aTime = parseIncidentDate(a?.eventDate);
  const bTime = parseIncidentDate(b?.eventDate);

  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return aTime - bTime;
}
