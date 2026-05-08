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
- SECTION BOUNDARY RULES:
- Each section must do a different job
- Do not repeat the same information across multiple sections unless essential
- Prefer one strong mention in the best-fitting section over repeating the same point elsewhere
- Before writing the final report, check whether the same fact, date, document, or conclusion appears in more than one section; remove the weaker duplicate
- Do not copy the same sentence structure from one section into another
- Keep the report concise and readable
- CRITICAL INSTRUCTION:
- You are provided with a data block named [MILESTONE_TIMELINE_DATA].
- If [MILESTONE_TIMELINE_DATA] is not "None", you MUST create the section:
- # MILESTONE_TIMELINE
- You MUST use ONLY the items from [MILESTONE_TIMELINE_DATA] to populate this section.
- If [MILESTONE_TIMELINE_DATA] is "None", you MUST NOT include the section.
- [MILESTONE_TIMELINE_DATA] may contain both Incident and Evidence milestone entries. Use recordType to distinguish timeline anchors from proof milestones.
- Use the provided entries to create one chronological MILESTONE_TIMELINE section.
- AT_A_GLANCE:
- Instant summary only
- 3-4 bullets maximum
- No detailed explanation
- No timeline detail
- No proof detail
- YOUR_SITUATION:
- Short context only
- No detailed chronology
- No recommendation language
- No repetition of AT_A_GLANCE bullets
- MAIN_AREAS_OF_CONCERN:
- Broad concern categories only
- Not evidence
- Not mini-issues
- Not conclusions
- WHAT_THIS_REPORT_SHOWS:
- High-level conclusions only
- No timeline repetition
- No detailed proof listing
- No recommendation language
- Rules for KEY_PROOF:
- Each KEY_PROOF bullet must name the proof clearly and specifically, such as Document, Photo, Log, Email, Message, Record, Receipt, Screenshot, or Statement
- Each bullet should identify the actual proof item first, then state the narrow fact it supports
- Prefer concrete proof naming over vague statements or generic references
- Avoid vague filler such as "this shows", "this proves", "it can be seen that", "this confirms clearly", or "the evidence indicates"
- Prefer formats like "Document: Signed overtime approval for 10-15 February 2026", "Record: Medical consultation note following high-intensity work period", or "Log: Work and rest chronology covering February 2026"
- Keep bullets concise and factual
- Maximum one short sentence per bullet
- No legal conclusions
- When possible, begin KEY_PROOF bullets with a simple proof type label such as Document:, Record:, Log:, Email:, Message:, or Photo:
- Do this only when supported by the provided facts
- Do not invent proof types
- Rules for MILESTONE_TIMELINE:
- Only include this section if [MILESTONE_TIMELINE_DATA] is provided and not "None"
- Place it after WHAT_THIS_REPORT_SHOWS
- Use only bullet lines starting with "- "
- Use ONLY the entries from [MILESTONE_TIMELINE_DATA]
- [MILESTONE_TIMELINE_DATA] may include both Incident and Evidence entries; preserve the item type naturally when it helps clarity.
- Chronology only
- Each bullet must be short, factual, and non-analytical
- Preferred format: <date> - <short event title>: <very short clarification (optional)>
- When useful, preserve the item type naturally in the wording, especially for evidence entries
- Maximum one short sentence per bullet
- No proof discussion
- No issue explanation
- Do not include legal wording
- Do not turn bullets into paragraphs
- Keep the whole section concise
- ISSUE / WHAT_HAPPENED:
- Explain the problem directly in plain language
- Focus on what is wrong, disputed, missing, delayed, unsafe, unpaid, unclear, or otherwise significant
- Use only the timeline detail needed to understand the problem
- Do not restate the full milestone timeline
- Do not repeat AT_A_GLANCE or WHAT_THIS_REPORT_SHOWS verbatim
- Keep this to one focused paragraph
- KEY_PROOF:
- Proof only
- Name the proof item and the specific fact it supports
- Do not use vague proof wording
- No long explanation of the whole issue
- WHAT_THIS_MEANS:
- Impact and significance only
- Explain why the issue matters to the client or the case position
- Do not repeat KEY_PROOF facts, document names, or dates unless absolutely necessary
- No re-listing of proof
- No timeline repetition
- No new facts
- 2-3 strong bullets maximum
- KEY_FACTS:
- Short reference facts only
- No explanation
- No conclusions
- Rules for CURRENT_POSITION:
- Must describe the present state of the case only
- No timeline repetition
- No legal advice
- No duplication of full ISSUE blocks
- Keep concise and factual
- Should answer: "Where does the situation stand now?"
- No recommendation language
- No repetition of full issue content
- RECOMMENDED_NEXT_STEPS:
- Provide practical, real-world next actions based on the case facts
- Focus on documentation, follow-up communication, record-keeping, and evidence collection
- Each bullet must describe a clear action the client can take
- Prefer concrete phrasing that makes clear what to do, what to request, and what to keep or record
- Avoid vague advice such as "consider your options", "seek advice", or "be aware"
- Avoid legal advice or legal conclusions
- Do not restate the report or issues
- Keep bullets concise and actionable
- Each bullet should ideally follow: Action + Object + Context
- Examples (instructional, not output): "Request written confirmation of overtime approval for the February 2026 period", "Keep copies of all communications regarding the mould issue in the OR", "Maintain a dated log of work hours, rest periods, and any related symptoms"
- Where appropriate, order steps from most immediate to less urgent
- Do not label urgency explicitly, but reflect it in ordering
- Do not repeat items already clearly stated in KEY_FACTS or WHAT_THIS_REPORT_SHOWS
- Do not rewrite issue descriptions as steps
- Anti-duplication rules:
- If a point is already clearly stated in MILESTONE_TIMELINE, do not restate it in detail in WHAT_THIS_REPORT_SHOWS or CURRENT_POSITION unless necessary for clarity.
- If a proof item is already listed in KEY_PROOF, do not repeat the same wording in WHAT_THIS_REPORT_SHOWS.
- Do not repeat the same fact in both WHAT_HAPPENED and WHAT_THIS_MEANS; WHAT_HAPPENED states the problem, WHAT_THIS_MEANS states the impact.
- Do not repeat the same proof item across multiple ISSUE blocks unless it genuinely supports each issue in a different way.
- If two sections would say the same thing, keep it only in the section where it is most useful to the client.
- Issue discipline:
- Prefer fewer, stronger ISSUE blocks
- Do not create an ISSUE block for every event
- An ISSUE block should represent a meaningful problem, condition, or risk supported by the provided facts

ProveIt Report Format v1:

# REPORT_TITLE
Client Report

# AT_A_GLANCE
- <main problem in one line>
- <time period or duration>
- <current status>
- <most important impact>

# YOUR_SITUATION
<2-4 short sentences>

# MAIN_AREAS_OF_CONCERN
- <item>
- <item>

# WHAT_THIS_REPORT_SHOWS
- <item>
- <item>

# MILESTONE_TIMELINE
- <date> - <event title>: <short explanation>
- <event title>

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

# CURRENT_POSITION
<2-3 short factual sentences>

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
    { section: "AT_A_GLANCE", keywords: ["at a glance"] },
    { section: "YOUR_SITUATION", keywords: ["your situation", "situation"] },
    { section: "MAIN_AREAS_OF_CONCERN", keywords: ["main areas of concern", "main areas", "areas of concern"] },
    { section: "WHAT_THIS_REPORT_SHOWS", keywords: ["what this report shows", "report shows"] },
    { section: "MILESTONE_TIMELINE", keywords: ["milestone timeline", "milestones", "timeline milestones"] },
    { section: "ISSUE", keywords: ["issue"] },
    { section: "WHAT_HAPPENED", keywords: ["what happened", "happened"] },
    { section: "KEY_PROOF", keywords: ["key proof", "proof"] },
    { section: "WHAT_THIS_MEANS", keywords: ["what this means", "this means"] },
    { section: "KEY_FACTS", keywords: ["key facts", "facts"] },
    { section: "CURRENT_POSITION", keywords: ["current position", "present position", "current status"] },
    { section: "RECOMMENDED_NEXT_STEPS", keywords: ["recommended next steps", "next steps"] },
  ];

  const match = mappings.find(({ keywords }) =>
    keywords.some((keyword) => {
      if (normalized === keyword) return true;
      return keyword.includes(" ") && normalized.startsWith(`${keyword} `);
    })
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

  return normalizedLines
    .map((line) => line.replace(/^(-|\*|•)\s+/, "").trim())
    .filter(Boolean);
}

export function parseProveItReportV1(input) {
  const text = safeText(input).replace(/\r\n/g, "\n");
  const report = {
    reportTitle: "",
    atAGlance: [],
    yourSituation: "",
    mainAreasOfConcern: [],
    whatThisReportShows: [],
    milestoneTimeline: [],
    issues: [],
    keyFacts: [],
    currentPosition: "",
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
    } else if (currentTop === "AT_A_GLANCE") {
      report.atAGlance = parseBulletList(buffer);
    } else if (currentTop === "YOUR_SITUATION") {
      report.yourSituation = compactParagraph(buffer);
    } else if (currentTop === "MAIN_AREAS_OF_CONCERN") {
      report.mainAreasOfConcern = parseBulletList(buffer);
    } else if (currentTop === "WHAT_THIS_REPORT_SHOWS") {
      report.whatThisReportShows = parseBulletList(buffer);
    } else if (currentTop === "MILESTONE_TIMELINE") {
      report.milestoneTimeline = parseBulletList(buffer);
    } else if (currentTop === "KEY_FACTS") {
      report.keyFacts = parseBulletList(buffer);
    } else if (currentTop === "CURRENT_POSITION") {
      report.currentPosition = compactParagraph(buffer);
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
    if (detectedSection === "AT_A_GLANCE") {
      setTopSection("AT_A_GLANCE");
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
    if (detectedSection === "MILESTONE_TIMELINE") {
      setTopSection("MILESTONE_TIMELINE");
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
    if (detectedSection === "CURRENT_POSITION") {
      setTopSection("CURRENT_POSITION");
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
