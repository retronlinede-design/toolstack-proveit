function safeText(value) {
  return typeof value === "string" ? value : "";
}

export function parseMilestoneTimelineEntry(value) {
  const text = safeText(value).replace(/\s+/g, " ").trim();
  if (!text) return { date: "", title: "", note: "" };

  const separators = [" â€“ ", " â€” ", " - "];
  for (const separator of separators) {
    const separatorIndex = text.indexOf(separator);
    if (separatorIndex > 0) {
      const candidateDate = text.slice(0, separatorIndex).trim();
      const remainder = text.slice(separatorIndex + separator.length).trim();
      if (candidateDate && remainder) {
        const colonIndex = remainder.indexOf(":");
        if (colonIndex > 0) {
          return {
            date: candidateDate,
            title: remainder.slice(0, colonIndex).trim() || remainder,
            note: remainder.slice(colonIndex + 1).trim(),
          };
        }
        return {
          date: candidateDate,
          title: remainder,
          note: "",
        };
      }
    }
  }

  const colonIndex = text.indexOf(":");
  if (colonIndex > 0) {
    return {
      date: "",
      title: text.slice(0, colonIndex).trim() || text,
      note: text.slice(colonIndex + 1).trim(),
    };
  }

  return { date: "", title: text, note: "" };
}
