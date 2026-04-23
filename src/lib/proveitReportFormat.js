export const PROVEIT_REPORT_PROMPT_V1 = `Create a client-facing report using only the case information provided.

Rules:
- Do not invent facts
- Do not add legal advice
- Do not add commentary outside the required format
- Output ONLY using the exact headings below
- Do not rename headings
- Do not add extra headings
- Do not add text before the first heading
- Do not add text after the last section
- For list sections, use only bullet lines starting with "- "
- For issue sections, repeat the ISSUE block as needed

ProveIt Report Format v1:

# REPORT_TITLE
Client Report

# YOUR_SITUATION
<2-4 short sentences>

# MAIN_AREAS_OF_CONCERN
- <item>
- <item>

# WHAT_THIS_REPORT_SHOWS
- <item>
- <item>

# ISSUE
<issue title>

## WHAT_HAPPENED
<short paragraph>

## KEY_PROOF
- <item>
- <item>

## WHAT_THIS_MEANS
- <item>
- <item>

# ISSUE
<issue title>

## WHAT_HAPPENED
<short paragraph>

## KEY_PROOF
- <item>
- <item>

## WHAT_THIS_MEANS
- <item>
- <item>

# KEY_FACTS
- <item>
- <item>

# RECOMMENDED_NEXT_STEPS
- <item>
- <item>`;

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function normalizeWhitespace(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function normalizeHeadingText(value) {
  return normalizeWhitespace(value)
    .replace(/^#+\s*/, "")
    .replace(/[:\-–—]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isLikelyLooseHeading(rawLine, normalizedHeading) {
  if (!normalizedHeading) return false;
  const trimmed = safeText(rawLine).trim();
  if (!trimmed) return false;
  if (/^#+\s*/.test(trimmed)) return true;
  if (trimmed.length > 80) return false;
  if (/^[A-Z][A-Za-z0-9\s/_-]*$/.test(trimmed)) return true;
  return trimmed === trimmed.toUpperCase();
}

function detectReportSection(rawLine, currentTop = null) {
  const normalized = normalizeHeadingText(rawLine);
  if (!normalized) return null;

  const mappings = [
    { section: "REPORT_TITLE", keywords: ["report title"] },
    { section: "YOUR_SITUATION", keywords: ["your situation", "situation"] },
    { section: "MAIN_AREAS_OF_CONCERN", keywords: ["main areas of concern", "main areas", "areas of concern"] },
    { section: "WHAT_THIS_REPORT_SHOWS", keywords: ["what this report shows", "report shows"] },
    { section: "ISSUE", keywords: ["issue"] },
    { section: "WHAT_HAPPENED", keywords: ["what happened", "happened"] },
    { section: "KEY_PROOF", keywords: ["key proof", "proof"] },
    { section: "WHAT_THIS_MEANS", keywords: ["what this means", "this means"] },
    { section: "KEY_FACTS", keywords: ["key facts", "facts"] },
    { section: "RECOMMENDED_NEXT_STEPS", keywords: ["recommended next steps", "next steps"] },
  ];

  const match = mappings.find(({ keywords }) =>
    keywords.some((keyword) => normalized === keyword || normalized.startsWith(`${keyword} `))
  );

  if (!match) return null;
  if (!isLikelyLooseHeading(rawLine, normalized)) return null;

  if (
    (match.section === "WHAT_HAPPENED" || match.section === "KEY_PROOF" || match.section === "WHAT_THIS_MEANS") &&
    currentTop !== "ISSUE"
  ) {
    return null;
  }

  return match.section;
}

function compactParagraph(lines) {
  return lines
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBulletList(lines) {
  const normalizedLines = lines
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const explicitBullets = normalizedLines
    .filter((line) => /^(-|\*|•)\s+/.test(line))
    .map((line) => line.replace(/^(-|\*|•)\s+/, "").trim())
    .filter(Boolean);

  if (explicitBullets.length > 0) return explicitBullets;
  return normalizedLines;
}

export function parseProveItReportV1(input) {
  const text = safeText(input).replace(/\r\n/g, "\n");
  const report = {
    reportTitle: "",
    yourSituation: "",
    mainAreasOfConcern: [],
    whatThisReportShows: [],
    issues: [],
    keyFacts: [],
    recommendedNextSteps: [],
  };

  if (!text.trim()) return report;

  const lines = text.split("\n");
  let currentTop = null;
  let currentIssue = null;
  let currentSub = null;
  let buffer = [];

  const commitBuffer = () => {
    if (buffer.length === 0) return;

    if (currentTop === "REPORT_TITLE") {
      report.reportTitle = compactParagraph(buffer);
    } else if (currentTop === "YOUR_SITUATION") {
      report.yourSituation = compactParagraph(buffer);
    } else if (currentTop === "MAIN_AREAS_OF_CONCERN") {
      report.mainAreasOfConcern = parseBulletList(buffer);
    } else if (currentTop === "WHAT_THIS_REPORT_SHOWS") {
      report.whatThisReportShows = parseBulletList(buffer);
    } else if (currentTop === "KEY_FACTS") {
      report.keyFacts = parseBulletList(buffer);
    } else if (currentTop === "RECOMMENDED_NEXT_STEPS") {
      report.recommendedNextSteps = parseBulletList(buffer);
    } else if (currentTop === "ISSUE" && currentIssue) {
      if (!currentSub) {
        currentIssue.title = compactParagraph(buffer);
      } else if (currentSub === "WHAT_HAPPENED") {
        currentIssue.whatHappened = compactParagraph(buffer);
      } else if (currentSub === "KEY_PROOF") {
        currentIssue.keyProof = parseBulletList(buffer);
      } else if (currentSub === "WHAT_THIS_MEANS") {
        currentIssue.whatThisMeans = parseBulletList(buffer);
      }
    }

    buffer = [];
  };

  const commitIssue = () => {
    if (!currentIssue) return;
    const hasContent =
      currentIssue.title ||
      currentIssue.whatHappened ||
      currentIssue.keyProof.length > 0 ||
      currentIssue.whatThisMeans.length > 0;

    if (hasContent) {
      report.issues.push({
        title: currentIssue.title,
        whatHappened: currentIssue.whatHappened,
        keyProof: currentIssue.keyProof,
        whatThisMeans: currentIssue.whatThisMeans,
      });
    }

    currentIssue = null;
    currentSub = null;
  };

  const setTopSection = (sectionName) => {
    commitBuffer();
    if (currentTop === "ISSUE") commitIssue();
    currentTop = sectionName;
    currentSub = null;
    if (sectionName === "ISSUE") {
      currentIssue = {
        title: "",
        whatHappened: "",
        keyProof: [],
        whatThisMeans: [],
      };
    }
  };

  for (const rawLine of lines) {
    const line = safeText(rawLine).trim();
    const detectedSection = detectReportSection(rawLine, currentTop);

    if (detectedSection === "REPORT_TITLE") {
      setTopSection("REPORT_TITLE");
      continue;
    }
    if (detectedSection === "YOUR_SITUATION") {
      setTopSection("YOUR_SITUATION");
      continue;
    }
    if (detectedSection === "MAIN_AREAS_OF_CONCERN") {
      setTopSection("MAIN_AREAS_OF_CONCERN");
      continue;
    }
    if (detectedSection === "WHAT_THIS_REPORT_SHOWS") {
      setTopSection("WHAT_THIS_REPORT_SHOWS");
      continue;
    }
    if (detectedSection === "ISSUE") {
      setTopSection("ISSUE");
      continue;
    }
    if (detectedSection === "KEY_FACTS") {
      setTopSection("KEY_FACTS");
      continue;
    }
    if (detectedSection === "RECOMMENDED_NEXT_STEPS") {
      setTopSection("RECOMMENDED_NEXT_STEPS");
      continue;
    }

    if (detectedSection === "WHAT_HAPPENED" && currentTop === "ISSUE" && currentIssue) {
      commitBuffer();
      currentSub = "WHAT_HAPPENED";
      continue;
    }
    if (detectedSection === "KEY_PROOF" && currentTop === "ISSUE" && currentIssue) {
      commitBuffer();
      currentSub = "KEY_PROOF";
      continue;
    }
    if (detectedSection === "WHAT_THIS_MEANS" && currentTop === "ISSUE" && currentIssue) {
      commitBuffer();
      currentSub = "WHAT_THIS_MEANS";
      continue;
    }

    if (/^##\s+/.test(line)) {
      commitBuffer();
      currentSub = null;
      continue;
    }

    if (/^#\s+/.test(line)) {
      commitBuffer();
      if (currentTop === "ISSUE") commitIssue();
      currentTop = null;
      currentSub = null;
      continue;
    }

    if (!currentTop) continue;
    buffer.push(rawLine);
  }

  commitBuffer();
  if (currentTop === "ISSUE") commitIssue();

  return report;
}
