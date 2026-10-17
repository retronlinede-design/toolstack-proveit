export function createSequenceGroupDetailsBaseline(value) {
  return JSON.stringify(value);
}

export function hasSequenceGroupDetailsChanges(baseline, value) {
  return baseline !== JSON.stringify(value);
}

export function getSequenceGroupDetailsDiscardRequest({ detailsDirty, currentSection, nextSection = "", closing = false }) {
  if (!detailsDirty) return null;
  if (closing) return { type: "close" };
  if (currentSection === "details" && nextSection && nextSection !== currentSection) return { type: "section", section: nextSection };
  return null;
}
