const SECTION_MARKERS = [
  "--- TABLE ---",
  "--- SUMMARY (GPT READY) ---",
  "--- FILE LINKS ---",
  "--- NOTES ---",
];

function unavailable(reason) {
  return { status: "unavailable", reason, headers: [], rows: [] };
}

function containsSectionMarker(value) {
  return SECTION_MARKERS.some((marker) => value.includes(marker));
}

function parsePipeRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function isSeparatorCell(value) {
  return /^:?-{3,}:?$/.test(value);
}

function validateCell(value, { header = false } = {}) {
  if (typeof value !== "string") return "non_string_cell";
  if (value.includes("\n") || value.includes("\r")) return "newline_in_cell";
  if (value.includes("|")) return "pipe_in_cell";
  if (value.includes("\\|")) return "escaped_pipe_unsupported";
  if (containsSectionMarker(value)) return "section_marker_in_cell";
  if (header && value.trim() === "") return "empty_header";
  return null;
}

/**
 * Parses the supported Tracking Record pipe-table subset for future structured
 * row editing. It deliberately rejects ambiguous input so callers can retain
 * the existing raw-text editor for legacy or malformed tables.
 */
export function parseTrackingRecordTable(tableText) {
  if (typeof tableText !== "string") return unavailable("missing_table_text");

  const lines = tableText.replaceAll("\r\n", "\n").split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();

  if (lines.length < 2) return unavailable("missing_header_or_separator");
  if (lines.some((line) => line.trim() === "")) return unavailable("blank_line_in_table");
  if (lines.some((line) => line.includes("\\|"))) return unavailable("escaped_pipe_unsupported");

  const headers = parsePipeRow(lines[0]);
  if (!headers) return unavailable("invalid_header_row");
  const separator = parsePipeRow(lines[1]);
  if (!separator) return unavailable("invalid_separator_row");
  if (headers.length === 0 || separator.length !== headers.length || !separator.every(isSeparatorCell)) {
    return unavailable("malformed_separator");
  }

  for (const header of headers) {
    const reason = validateCell(header, { header: true });
    if (reason) return unavailable(reason);
  }

  const rows = [];
  for (const line of lines.slice(2)) {
    const row = parsePipeRow(line);
    if (!row) return unavailable("invalid_row_or_newline_in_cell");
    if (row.length !== headers.length) return unavailable("column_count_mismatch");

    for (const cell of row) {
      const reason = validateCell(cell);
      if (reason) return unavailable(reason);
    }
    rows.push(row);
  }

  return { status: "ok", reason: null, headers, rows };
}

export function removeTrackingRecordTableRow({ headers, rows } = {}, rowIndex) {
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    throw new Error("Cannot remove Tracking Record table row: invalid_table_model");
  }
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rows.length) {
    throw new Error("Cannot remove Tracking Record table row: invalid_row_index");
  }

  return {
    headers: [...headers],
    rows: rows.filter((_, index) => index !== rowIndex).map((row) => [...row]),
  };
}
function normalizeSerializableCell(value, options) {
  const reason = validateCell(value, options);
  if (reason) throw new Error(`Cannot serialize Tracking Record table: ${reason}`);
  return value.trim();
}

/**
 * Serializes a validated structured table model to the existing Markdown
 * pipe-table format. No escaping is introduced because the legacy display
 * parser does not understand escaped pipes.
 */
export function serializeTrackingRecordTable({ headers, rows } = {}) {
  if (!Array.isArray(headers) || headers.length === 0) {
    throw new Error("Cannot serialize Tracking Record table: missing_headers");
  }
  if (!Array.isArray(rows)) {
    throw new Error("Cannot serialize Tracking Record table: invalid_rows");
  }

  const normalizedHeaders = headers.map((header) => normalizeSerializableCell(header, { header: true }));
  const normalizedRows = rows.map((row) => {
    if (!Array.isArray(row) || row.length !== normalizedHeaders.length) {
      throw new Error("Cannot serialize Tracking Record table: column_count_mismatch");
    }
    return row.map((cell) => normalizeSerializableCell(cell));
  });

  const formatRow = (cells) => `| ${cells.join(" | ")} |`;
  return [
    formatRow(normalizedHeaders),
    formatRow(normalizedHeaders.map(() => "---")),
    ...normalizedRows.map(formatRow),
  ].join("\n");
}