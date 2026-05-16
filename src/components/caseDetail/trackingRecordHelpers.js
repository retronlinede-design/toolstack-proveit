export function isTrackingRecord(doc) {
  return typeof doc?.textContent === "string" && doc.textContent.includes("[TRACK RECORD]");
}

export function getDocumentTextStatus(doc) {
  const text = typeof doc?.textContent === "string" ? doc.textContent.trim() : "";
  const attachmentCount = Array.isArray(doc?.attachments) ? doc.attachments.length : 0;
  const charCount = text.length;
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  if (charCount > 1000) {
    return {
      label: "Partial Text",
      detail: "Long text is captured; review the important parts.",
      tone: "amber",
      charCount,
      wordCount,
    };
  }

  if (charCount >= 80) {
    return {
      label: "GPT Ready",
      detail: "Usable text is captured for reasoning.",
      tone: "green",
      charCount,
      wordCount,
    };
  }

  if (attachmentCount > 0 && charCount === 0) {
    return {
      label: "No Usable Text",
      detail: "Only attachments are present.",
      tone: "red",
      charCount,
      wordCount,
    };
  }

  if (charCount > 0) {
    return {
      label: "Partial Text",
      detail: "Some text is captured, but it may be thin.",
      tone: "amber",
      charCount,
      wordCount,
    };
  }

  return {
    label: "No Usable Text",
    detail: "No document text is captured.",
    tone: "red",
    charCount,
    wordCount,
  };
}

export function getDocumentStatusClasses(tone) {
  if (tone === "green") return "border-lime-200 bg-lime-50 text-lime-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export function getSection(text, startMarker, endMarker = null) {
  if (!text || !startMarker) return "";
  const start = text.indexOf(startMarker);
  if (start === -1) return "";

  const from = start + startMarker.length;
  const rest = text.slice(from);

  if (!endMarker) return rest.trim();

  const end = rest.indexOf(endMarker);
  if (end === -1) return rest.trim();

  return rest.slice(0, end).trim();
}

export function parseMetaBlock(metaText) {
  const meta = {
    type: "",
    subject: "",
    period: "",
    status: "",
  };

  if (!metaText) return meta;

  metaText
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const idx = line.indexOf(":");
      if (idx === -1) return;

      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();

      if (key in meta) {
        meta[key] = value;
      }
    });

  return meta;
}

export function parseTrackTable(tableText) {
  if (!tableText) return [];

  const lines = tableText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("|") && line.endsWith("|"));

  if (lines.length < 3) return [];

  const headers = lines[0]
    .split("|")
    .map(cell => cell.trim())
    .filter(Boolean);

  const separator = lines[1];
  const dataLines = lines.slice(2);

  if (!separator.includes("---")) return [];

  return dataLines
    .map(line => line.split("|").map(cell => cell.trim()).filter(Boolean))
    .filter(cells => cells.length === headers.length)
    .map(cells => {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] ?? "";
      });
      return row;
    });
}

export function getRecordTypeLabel(metaType = "") {
  const value = String(metaType || "").toLowerCase();
  if (value === "payment_tracker") return "Financial";
  if (value === "work_time") return "Work Time";
  if (value === "compliance") return "Compliance";
  if (value === "custom") return "Custom";
  return metaType || "Unknown";
}

export function legacyEuroSymbol() {
  return String.fromCharCode(0x00e2, 0x201a, 0x00ac);
}

export function formatRecordTableHeader(header = "") {
  return String(header || "").replaceAll(legacyEuroSymbol(), "€");
}

export function getRecordTableHeaders(rows = []) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
  const preferred = ["Period/Date", "Date", "Expected", "Amount €", "Actual", "Difference", "Unit", "Direction", "Status", "Notes"];
  return headers.sort((a, b) => {
    const aIndex = preferred.indexOf(a);
    const bIndex = preferred.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    }
    return a.localeCompare(b);
  });
}

export function getRecordStatusClasses(status = "") {
  const value = String(status || "").toLowerCase();
  if (["paid", "confirmed", "complete", "completed", "compliant", "ok", "done"].includes(value)) {
    return "border-lime-200 bg-lime-50 text-lime-700";
  }
  if (["pending", "partial", "part-paid", "disputed", "review", "in_progress"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["unpaid", "missing", "late", "failed", "violation", "not_paid", "noncompliant"].includes(value)) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

export function getDifferenceClasses(value = "") {
  const normalized = String(value || "").replace("€", "").replace(legacyEuroSymbol(), "").replace(",", ".").trim();
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) {
    if (parsed > 0) return "text-lime-700";
    if (parsed < 0) return "text-red-700";
  }
  if (/owed|missing|short|late|unpaid|negative|under/i.test(String(value))) return "text-red-700";
  return "text-neutral-700";
}

export function parseFileLinks(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("-"))
    .map(line => line.replace(/^-+\s*/, "").trim())
    .filter(Boolean);
}

export function parseTrackingRecord(doc) {
  const text = doc?.textContent || "";

  const metaText = getSection(text, "meta:", "--- TABLE ---");
  const tableText = getSection(text, "--- TABLE ---", "--- SUMMARY (GPT READY) ---");
  const summaryText = getSection(text, "--- SUMMARY (GPT READY) ---", "--- FILE LINKS ---");
  const fileLinksText = getSection(text, "--- FILE LINKS ---", "--- NOTES ---");
  const notesText = getSection(text, "--- NOTES ---");

  const meta = parseMetaBlock(metaText);
  const table = parseTrackTable(tableText);
  const fileLinks = parseFileLinks(fileLinksText);

  return {
    id: doc.id,
    title: doc.title || "Untitled Tracking Record",
    category: doc.category || "other",
    documentDate: doc.documentDate || "",
    source: doc.source || "",
    meta,
    table,
    summary: summaryText || "",
    fileLinks,
    notes: notesText || "",
    rawDocument: doc,
  };
}

export function mapDirectionToLedger(direction) {
  if (direction === "paid") return "outgoing";
  if (direction === "received") return "incoming";
  return null;
}

export function parseAmount(value) {
  if (typeof value !== "string") return 0;
  const normalized = value.replace("€", "").replace(legacyEuroSymbol(), "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function generateLedgerEntries(trackingRecords) {
  const entries = [];

  trackingRecords.forEach(record => {
    if (record.meta.type !== "payment_tracker") return;

    record.table.forEach((row, index) => {
      const date = row["Date"] || "";
      const amount = parseAmount(row["Amount €"] ?? row[`Amount ${legacyEuroSymbol()}`]);
      const directionRaw = (row["Direction"] || "").trim().toLowerCase();
      const status = (row["Status"] || "").trim().toLowerCase();
      const note = row["Notes"] || "";
      const direction = mapDirectionToLedger(directionRaw);

      if (!direction) return;
      if (!amount || amount <= 0) return;
      if (status === "waived") return;

      entries.push({
        id: `${record.id}__derived__${index}`,
        date,
        subject: record.meta.subject || record.title || "unknown_subject",
        amount,
        direction,
        status: status || "confirmed",
        note,
        sourceTrackingRecordId: record.id,
        sourceTrackingRecordTitle: record.title,
      });
    });
  });

  return entries.sort((a, b) => {
    const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCompare !== 0) return dateCompare;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}
