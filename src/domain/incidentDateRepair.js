import { sortTimelineItems } from "./caseDomain.js";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function scanIncidentDateMismatches(caseItem) {
  const incidents = Array.isArray(caseItem?.incidents) ? caseItem.incidents : [];

  return incidents
    .filter((incident) => {
      const date = cleanText(incident?.date);
      const eventDate = cleanText(incident?.eventDate);
      return Boolean(incident?.id && date && eventDate && date !== eventDate);
    })
    .map((incident) => ({
      id: incident.id,
      title: incident.title || "",
      date: cleanText(incident.date),
      eventDate: cleanText(incident.eventDate),
      sequenceGroup: cleanText(incident.sequenceGroup),
    }));
}

export function repairIncidentEventDates(caseItem, incidentIds = []) {
  if (!caseItem || !Array.isArray(caseItem.incidents)) return caseItem;

  const repairIds = new Set(incidentIds.filter(Boolean));
  if (repairIds.size === 0) return caseItem;

  const now = new Date().toISOString();
  let changed = false;
  const updatedIncidents = caseItem.incidents.map((incident) => {
    const date = cleanText(incident?.date);
    const eventDate = cleanText(incident?.eventDate);
    if (!repairIds.has(incident?.id) || !date || !eventDate || date === eventDate) {
      return incident;
    }

    changed = true;
    return {
      ...incident,
      eventDate: date,
      updatedAt: now,
    };
  });

  if (!changed) return caseItem;

  return {
    ...caseItem,
    incidents: sortTimelineItems(updatedIncidents),
    updatedAt: now,
  };
}
