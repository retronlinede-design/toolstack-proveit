function safeText(value) {
  return typeof value === "string" ? value : "";
}

export const EXECUTIVE_POLISH_SECTION_TITLES = [
  "Current Position",
  "Key Timeline",
  "Strongest Evidence",
  "Risks and Concerns",
  "Recommended Next Steps",
];

export function cleanPolishedMarkdownInline(text = "") {
  return safeText(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function normalizeExecutivePolishHeading(line = "") {
  const cleanLine = safeText(line)
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.+?)\*\*:?\s*$/, "$1")
    .replace(/^__(.+?)__:?\s*$/, "$1")
    .replace(/:$/, "")
    .trim();

  return EXECUTIVE_POLISH_SECTION_TITLES.find(
    (title) => title.toLowerCase() === cleanLine.toLowerCase()
  ) || "";
}

export function parseExecutivePolishSections(text = "") {
  const sections = {};
  let currentSection = "";

  safeText(text).split("\n").forEach((line) => {
    const sectionHeading = normalizeExecutivePolishHeading(line);
    if (sectionHeading) {
      currentSection = sectionHeading;
      sections[currentSection] = sections[currentSection] || [];
      return;
    }
    if (currentSection) sections[currentSection].push(line);
  });

  return Object.fromEntries(
    Object.entries(sections).map(([heading, lines]) => [heading, lines.join("\n").trim()])
  );
}

export function normalizePolishedContentLine(line = "") {
  return safeText(line)
    .replace(/^\*\*([^*]+?):\*\*\s*/, "$1: ")
    .replace(/^\*\*([^*]+?)\*\*:\s*/, "$1: ")
    .replace(/^__([^_]+?):__\s*/, "$1: ")
    .replace(/^__([^_]+?)__:\s*/, "$1: ")
    .trim();
}

export function splitPolishedLabelLine(line = "") {
  const cleanLine = normalizePolishedContentLine(line);
  const colonIndex = cleanLine.indexOf(":");
  if (colonIndex > 0 && colonIndex <= 70) {
    return {
      label: cleanPolishedMarkdownInline(cleanLine.slice(0, colonIndex)),
      text: cleanPolishedMarkdownInline(cleanLine.slice(colonIndex + 1)),
    };
  }

  const dashMatch = cleanLine.match(/^(.{2,70}?)\s+[\u2013\u2014-]\s+(.+)$/);
  if (dashMatch) {
    return {
      label: cleanPolishedMarkdownInline(dashMatch[1]),
      text: cleanPolishedMarkdownInline(dashMatch[2]),
    };
  }

  return {
    label: "",
    text: cleanPolishedMarkdownInline(cleanLine),
  };
}

export function parsePolishedTimelineLine(line = "") {
  const cleanLine = normalizePolishedContentLine(line);
  const datePattern = "(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4}|[A-Za-z]+\\s+\\d{4})";
  const dateMatch = cleanLine.match(new RegExp(`^(${datePattern})\\s*(?::|[\\u2013\\u2014-])\\s*(.*)$`));
  if (!dateMatch) return null;

  const eventText = cleanPolishedMarkdownInline(dateMatch[2]) || cleanPolishedMarkdownInline(cleanLine);
  return {
    date: cleanPolishedMarkdownInline(dateMatch[1]),
    text: eventText,
  };
}

export function parsePolishedListLine(line = "") {
  const bulletMatch = line.match(/^[-*\u2022]\s+(.+)$/);
  if (bulletMatch) return { ordered: false, text: bulletMatch[1] };

  const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
  if (numberedMatch) return { ordered: true, number: numberedMatch[1], text: numberedMatch[2] };

  return null;
}

export function splitPolishedSentences(text = "") {
  const cleanText = cleanPolishedMarkdownInline(text);
  if (cleanText.length < 170) return [cleanText].filter(Boolean);

  const sentenceMatches = cleanText.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [cleanText];
  const sentences = sentenceMatches.map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.length > 1 ? sentences : [cleanText].filter(Boolean);
}

export function promotePolishedConcernHeading(item) {
  if (item.label || !item.text) return item;

  const sentenceMatches = item.text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [];
  if (sentenceMatches.length < 2) return item;

  const heading = cleanPolishedMarkdownInline(sentenceMatches[0]);
  const detail = cleanPolishedMarkdownInline(item.text.slice(sentenceMatches[0].length));
  if (!heading || heading.length > 95 || !detail) return item;
  return { label: heading, text: detail };
}

export function buildPolishedStructuredItems(lines = [], sectionTitle = "") {
  const joinedText = cleanPolishedMarkdownInline(lines.join(" "));
  if (!joinedText) return [];

  const candidateLines = lines
    .map((line) => normalizePolishedContentLine(line))
    .filter(Boolean);
  const rawItems = candidateLines.length > 1
    ? candidateLines
    : splitPolishedSentences(joinedText);

  return rawItems
    .map((item) => splitPolishedLabelLine(item))
    .map((item) => (sectionTitle === "Risks and Concerns" ? promotePolishedConcernHeading(item) : item))
    .filter((item) => item.label || item.text);
}

export function buildPolishedContentBlocks(text = "", sectionTitle = "") {
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];
  let listOrdered = false;
  const cardSection = ["Strongest Evidence", "Risks and Concerns"].includes(sectionTitle);
  const structuredParagraphSection = ["Risks and Concerns", "Recommended Next Steps"].includes(sectionTitle);

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    if (structuredParagraphSection) {
      const structuredItems = buildPolishedStructuredItems(paragraphLines, sectionTitle);
      if (structuredItems.length > 0) {
        blocks.push({
          type: "list",
          ordered: sectionTitle === "Recommended Next Steps",
          items: structuredItems,
        });
        paragraphLines = [];
        return;
      }
    }
    const paragraphText = cleanPolishedMarkdownInline(paragraphLines.join(" "));
    if (paragraphText) blocks.push({ type: "paragraph", text: paragraphText });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", ordered: listOrdered, items: listItems });
    listItems = [];
    listOrdered = false;
  };

  safeText(text).split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const listLine = parsePolishedListLine(line);
    const contentLine = listLine?.text || line;
    const timelineLine = sectionTitle === "Key Timeline" ? parsePolishedTimelineLine(contentLine) : null;
    if (timelineLine) {
      flushParagraph();
      flushList();
      blocks.push({ type: "timeline", ...timelineLine });
      return;
    }

    if (listLine) {
      flushParagraph();
      if (listItems.length > 0 && listOrdered !== listLine.ordered) flushList();
      listOrdered = listLine.ordered;
      listItems.push(splitPolishedLabelLine(contentLine));
      return;
    }

    const labelLine = splitPolishedLabelLine(line);
    if (cardSection && labelLine.label && labelLine.text) {
      flushParagraph();
      flushList();
      blocks.push({ type: "card", item: labelLine });
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();
  return blocks;
}
