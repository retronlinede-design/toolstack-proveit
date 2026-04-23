export const PROVEIT_REPORT_PROMPT_V1 = `Create a client-facing report using only the case information provided.

Rules:
- Do not invent facts
- Do not add legal advice
- Do not add commentary outside the required format
- Keep wording clear, calm, and practical
- Output ONLY using the exact format below

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

function compactParagraph(lines) {
  return lines
    .map((line) => safeText(line).trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBulletList(lines) {
  return lines
    .map((line) => safeText(line).trim())
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, "").trim())
    .filter(Boolean);
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

    if (/^#\s+REPORT_TITLE$/i.test(line)) {
      setTopSection("REPORT_TITLE");
      continue;
    }
    if (/^#\s+YOUR_SITUATION$/i.test(line)) {
      setTopSection("YOUR_SITUATION");
      continue;
    }
    if (/^#\s+MAIN_AREAS_OF_CONCERN$/i.test(line)) {
      setTopSection("MAIN_AREAS_OF_CONCERN");
      continue;
    }
    if (/^#\s+WHAT_THIS_REPORT_SHOWS$/i.test(line)) {
      setTopSection("WHAT_THIS_REPORT_SHOWS");
      continue;
    }
    if (/^#\s+ISSUE$/i.test(line)) {
      setTopSection("ISSUE");
      continue;
    }
    if (/^#\s+KEY_FACTS$/i.test(line)) {
      setTopSection("KEY_FACTS");
      continue;
    }
    if (/^#\s+RECOMMENDED_NEXT_STEPS$/i.test(line)) {
      setTopSection("RECOMMENDED_NEXT_STEPS");
      continue;
    }

    if (/^##\s+WHAT_HAPPENED$/i.test(line) && currentTop === "ISSUE" && currentIssue) {
      commitBuffer();
      currentSub = "WHAT_HAPPENED";
      continue;
    }
    if (/^##\s+KEY_PROOF$/i.test(line) && currentTop === "ISSUE" && currentIssue) {
      commitBuffer();
      currentSub = "KEY_PROOF";
      continue;
    }
    if (/^##\s+WHAT_THIS_MEANS$/i.test(line) && currentTop === "ISSUE" && currentIssue) {
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
