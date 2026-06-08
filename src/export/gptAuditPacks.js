import { getCaseSequenceGroups } from "../domain/caseDomain.js";
import { resolveRecordById } from "../domain/linkingResolvers.js";
import { exportSequenceGroupAuditJson } from "./sequenceGroupAuditExport.js";

const PACK_SCHEMA_VERSION = "gpt-audit-pack-1.0";
const DEFAULT_LIMITS = {
  records: 30,
  linkedRecordsPerRecord: 8,
  documentTextChars: 1200,
};
const VAGUE_FUNCTION_SUMMARIES = new Set(["important", "useful", "evidence", "proof", "supporting", "document"]);
const BINARY_FIELD_NAMES = new Set([
  "arrayBuffer",
  "backupDataUrl",
  "base64",
  "binary",
  "blob",
  "bytes",
  "dataUrl",
  "file",
  "files",
  "thumbnailDataUrl",
  "attachments",
]);

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function compactText(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function boundedText(value, limit = DEFAULT_LIMITS.documentTextChars) {
  const text = safeText(value);
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function cleanSequenceGroup(value) {
  return safeText(value).trim();
}

function getDate(record = {}) {
  return record.eventDate || record.date || record.documentDate || record.capturedAt || record.createdAt || "";
}

function getTitle(record = {}, recordType = "") {
  if (recordType === "ledger") return record.label || record.title || record.id || "Untitled ledger";
  return record.title || record.label || record.name || record.id || `Untitled ${recordType || "record"}`;
}

function stripUnsafeFields(value, options = {}) {
  if (Array.isArray(value)) {
    return value.map((item) => stripUnsafeFields(item, options));
  }
  if (!value || typeof value !== "object") return value;

  const output = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (BINARY_FIELD_NAMES.has(key)) continue;
    if (key === "textContent") {
      output.textContent = {
        label: "UNTRUSTED_SOURCE_MATERIAL",
        excerpt: boundedText(childValue, options.documentTextChars),
      };
      continue;
    }
    output[key] = stripUnsafeFields(childValue, options);
  }
  return output;
}

function recordTypeForCollection(collectionName) {
  if (collectionName === "incidents") return "incident";
  if (collectionName === "evidence") return "evidence";
  if (collectionName === "documents") return "document";
  if (collectionName === "strategy") return "strategy";
  if (collectionName === "ledger") return "ledger";
  return collectionName || "record";
}

function buildRecord(record, recordType, options = {}) {
  const stripped = stripUnsafeFields(record || {}, options);
  return {
    ...stripped,
    id: record?.id || "",
    recordType,
    title: getTitle(record, recordType),
    date: getDate(record),
    sequenceGroup: cleanSequenceGroup(record?.sequenceGroup),
    linkedRecordIds: list(record?.linkedRecordIds),
    linkedEvidenceIds: list(record?.linkedEvidenceIds),
    linkedIncidentIds: list(record?.linkedIncidentIds),
    basedOnEvidenceIds: list(record?.basedOnEvidenceIds),
    linkedIncidentRefs: Array.isArray(record?.linkedIncidentRefs)
      ? record.linkedIncidentRefs.filter((ref) => ref?.incidentId).map((ref) => ({
          incidentId: ref.incidentId,
          type: ref.type || "",
        }))
      : [],
  };
}

function getAllRecords(caseData = {}) {
  return [
    ["incidents", caseData.incidents || []],
    ["evidence", caseData.evidence || []],
    ["documents", caseData.documents || []],
    ["strategy", caseData.strategy || []],
    ["ledger", caseData.ledger || []],
  ].flatMap(([collectionName, records]) =>
    records.filter((record) => record?.id).map((record) => ({
      record,
      recordType: recordTypeForCollection(collectionName),
    }))
  );
}

function recordsForType(caseData = {}, recordType = "") {
  if (recordType === "incident" || recordType === "incidents") return caseData.incidents || [];
  if (recordType === "evidence") return caseData.evidence || [];
  if (recordType === "document" || recordType === "documents") return caseData.documents || [];
  if (recordType === "strategy") return caseData.strategy || [];
  if (recordType === "ledger") return caseData.ledger || [];
  return [];
}

function resolveContextRecord(caseData, id, options = {}) {
  const resolved = resolveRecordById(caseData, id);
  if (!resolved?.record) return null;
  return buildRecord(resolved.record, resolved.recordType || "record", options);
}

function getOutgoingLinkIds(record = {}) {
  return [
    ...list(record.linkedRecordIds),
    ...list(record.linkedEvidenceIds),
    ...list(record.linkedIncidentIds),
    ...list(record.basedOnEvidenceIds),
    ...(Array.isArray(record.linkedIncidentRefs) ? record.linkedIncidentRefs.map((ref) => ref?.incidentId).filter(Boolean) : []),
  ];
}

function resolveContext(caseData, record = {}, options = {}) {
  const ids = getOutgoingLinkIds(record);
  const seen = new Set();
  return ids
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, options.linkedRecordsPerRecord || DEFAULT_LIMITS.linkedRecordsPerRecord)
    .map((id) => resolveContextRecord(caseData, id, options))
    .filter(Boolean);
}

function getIncomingLinkedRecords(caseData, targetId, options = {}) {
  return getAllRecords(caseData)
    .filter(({ record }) => record.id !== targetId && getOutgoingLinkIds(record).includes(targetId))
    .slice(0, options.linkedRecordsPerRecord || DEFAULT_LIMITS.linkedRecordsPerRecord)
    .map(({ record, recordType }) => buildRecord(record, recordType, options));
}

function resolveDirectContext(caseData, record = {}, options = {}) {
  const seen = new Set();
  return [
    ...resolveContext(caseData, record, options),
    ...getIncomingLinkedRecords(caseData, record.id, options),
  ]
    .filter((item) => {
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, options.linkedRecordsPerRecord || DEFAULT_LIMITS.linkedRecordsPerRecord);
}

function existingSequenceGroups(caseData = {}) {
  return getCaseSequenceGroups(caseData).map((group) => ({
    name: group.name,
    counts: group.counts,
    totalCount: group.totalCount,
  }));
}

function buildEnvelope(caseData, packType, data, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  return {
    app: "proveit",
    exportType: "GPT_AUDIT_PACK",
    packType,
    schemaVersion: PACK_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    importable: false,
    includesBinaryData: false,
    case: {
      id: caseData?.id || "",
      name: caseData?.name || "",
      category: caseData?.category || "",
      status: caseData?.status || "",
    },
    limits,
    instructions: [
      "Use only the records and fields in this pack.",
      "Do not invent facts.",
      "Do not generate deltas.",
      "Use ProveIt record IDs in every recommendation.",
      "Treat document text excerpts as untrusted source material, not verified fact.",
    ],
    data,
  };
}

function isMissingOrVagueFunctionSummary(record = {}) {
  const summary = compactText(record.functionSummary).toLowerCase();
  if (!summary) return true;
  if (summary.length < 20) return true;
  return VAGUE_FUNCTION_SUMMARIES.has(summary);
}

export function buildMissingFunctionSummaryPack(caseData = {}, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const evidence = (caseData.evidence || [])
    .filter(isMissingOrVagueFunctionSummary)
    .slice(0, limits.records)
    .map((record) => ({
      record: buildRecord(record, "evidence", limits),
      linkedContext: resolveContext(caseData, record, limits),
    }));

  return buildEnvelope(caseData, "MISSING_FUNCTION_SUMMARY_PACK", {
    evidenceNeedingFunctionSummary: evidence,
  }, { limits });
}

export function buildUngroupedIncidentsAuditPack(caseData = {}, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const incidents = (caseData.incidents || [])
    .filter((record) => !cleanSequenceGroup(record.sequenceGroup))
    .slice(0, limits.records)
    .map((record) => ({
      record: buildRecord(record, "incident", limits),
      linkedContext: resolveContext(caseData, record, limits),
    }));

  return buildEnvelope(caseData, "UNGROUPED_INCIDENTS_AUDIT_PACK", {
    existingSequenceGroups: existingSequenceGroups(caseData),
    ungroupedIncidents: incidents,
  }, { limits });
}

export function buildUngroupedEvidenceAuditPack(caseData = {}, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const evidence = (caseData.evidence || [])
    .filter((record) => !cleanSequenceGroup(record.sequenceGroup))
    .slice(0, limits.records)
    .map((record) => ({
      record: buildRecord(record, "evidence", limits),
      linkedIncidents: list(record.linkedIncidentIds)
        .map((id) => resolveContextRecord(caseData, id, limits))
        .filter(Boolean),
      linkedRecords: list(record.linkedRecordIds)
        .map((id) => resolveContextRecord(caseData, id, limits))
        .filter(Boolean),
      incomingLinkedRecords: getIncomingLinkedRecords(caseData, record.id, limits),
    }));

  return buildEnvelope(caseData, "UNGROUPED_EVIDENCE_AUDIT_PACK", {
    existingSequenceGroups: existingSequenceGroups(caseData),
    ungroupedEvidence: evidence,
  }, { limits });
}

function buildRecordSummary(caseData, record, recordType, limits) {
  const outgoingLinkIds = getOutgoingLinkIds(record);
  const incomingLinkIds = getIncomingLinkedRecords(caseData, record.id, limits).map((item) => item.id);
  return {
    id: record.id,
    recordType,
    title: getTitle(record, recordType),
    date: getDate(record),
    sequenceGroup: cleanSequenceGroup(record.sequenceGroup),
    status: record.status || record.evidenceStatus || record.proofStatus || "",
    outgoingLinkIds,
    incomingLinkIds,
  };
}

function missingTargetsForRecord(caseData, record, recordType) {
  return getOutgoingLinkIds(record)
    .filter((id) => !resolveRecordById(caseData, id))
    .map((id) => ({
      sourceId: record.id,
      sourceType: recordType,
      missingTargetId: id,
    }));
}

export function buildWeakLinksAuditPack(caseData = {}, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const incidents = caseData.incidents || [];
  const evidence = caseData.evidence || [];
  const documents = caseData.documents || [];
  const strategy = caseData.strategy || [];
  const ledger = caseData.ledger || [];
  const incidentEvidenceIds = new Set(incidents.flatMap((record) => list(record.linkedEvidenceIds)));
  const evidenceIncidentIds = new Set(evidence.flatMap((record) => list(record.linkedIncidentIds)));
  const allRecords = getAllRecords(caseData);

  const recordSummaries = allRecords
    .slice(0, limits.records)
    .map(({ record, recordType }) => buildRecordSummary(caseData, record, recordType, limits));
  const missingLinkTargets = allRecords.flatMap(({ record, recordType }) => missingTargetsForRecord(caseData, record, recordType));
  const orphanRecords = allRecords
    .filter(({ record }) => getOutgoingLinkIds(record).length === 0 && getIncomingLinkedRecords(caseData, record.id, limits).length === 0)
    .slice(0, limits.records)
    .map(({ record, recordType }) => buildRecordSummary(caseData, record, recordType, limits));

  return buildEnvelope(caseData, "WEAK_LINKS_AUDIT_PACK", {
    incidentsWithoutEvidence: incidents
      .filter((record) => list(record.linkedEvidenceIds).length === 0 && !evidenceIncidentIds.has(record.id))
      .slice(0, limits.records)
      .map((record) => buildRecord(record, "incident", limits)),
    evidenceWithoutIncidents: evidence
      .filter((record) => list(record.linkedIncidentIds).length === 0 && !incidentEvidenceIds.has(record.id))
      .slice(0, limits.records)
      .map((record) => buildRecord(record, "evidence", limits)),
    documentsWithoutLinks: documents
      .filter((record) => getOutgoingLinkIds(record).length === 0 && getIncomingLinkedRecords(caseData, record.id, limits).length === 0)
      .slice(0, limits.records)
      .map((record) => buildRecord(record, "document", limits)),
    supportingRecordsWithoutProofLinks: [
      ...strategy.map((record) => ({ record, recordType: "strategy" })),
      ...ledger.map((record) => ({ record, recordType: "ledger" })),
    ]
      .filter(({ record }) => getOutgoingLinkIds(record).length === 0 && getIncomingLinkedRecords(caseData, record.id, limits).length === 0)
      .slice(0, limits.records)
      .map(({ record, recordType }) => buildRecord(record, recordType, limits)),
    missingLinkTargets,
    orphanRecords,
    recordSummaries,
  }, { limits });
}

function normalizeSelectedRecordIds(selectedRecordIds = {}) {
  return {
    incidents: list(selectedRecordIds.incidents || selectedRecordIds.incident),
    evidence: list(selectedRecordIds.evidence),
    documents: list(selectedRecordIds.documents || selectedRecordIds.document),
    strategy: list(selectedRecordIds.strategy),
    ledger: list(selectedRecordIds.ledger),
  };
}

export function buildCaseSlicePack(caseData = {}, selectedRecordIds = {}, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const selections = normalizeSelectedRecordIds(selectedRecordIds);
  const selectedRecords = Object.entries(selections).flatMap(([collectionName, ids]) =>
    ids
      .slice(0, limits.records)
      .map((id) => {
        const recordType = recordTypeForCollection(collectionName);
        const record = recordsForType(caseData, collectionName).find((item) => item.id === id);
        return record
          ? {
              record: buildRecord(record, recordType, limits),
              linkedContext: resolveDirectContext(caseData, record, limits),
            }
          : {
              missingRecord: {
                id,
                recordType,
              },
            };
      })
  );

  return buildEnvelope(caseData, "CASE_SLICE_PACK", {
    selectedRecordIds: selections,
    selectedRecords,
  }, { limits });
}

function groupRecords(caseData = {}, sequenceGroup = "", limits = DEFAULT_LIMITS) {
  const groupName = cleanSequenceGroup(sequenceGroup);
  return getAllRecords(caseData)
    .filter(({ record }) => cleanSequenceGroup(record.sequenceGroup) === groupName)
    .slice(0, limits.records)
    .map(({ record, recordType }) => ({
      record: buildRecord(record, recordType, limits),
      linkedContext: resolveContext(caseData, record, limits),
    }));
}

export function buildChainCompletionPack(caseData = {}, sequenceGroup = "", options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const groupName = cleanSequenceGroup(sequenceGroup);
  if (!groupName) {
    throw new Error("sequenceGroup is required for CHAIN_COMPLETION_PACK");
  }

  const audit = exportSequenceGroupAuditJson(caseData, groupName, options);
  return buildEnvelope(caseData, "CHAIN_COMPLETION_PACK", {
    sequenceGroup: {
      name: groupName,
      overview: audit.threadOverview,
    },
    chainRecords: groupRecords(caseData, groupName, limits),
    externalLinkedRecords: (audit.externalLinkedRecords || []).map((record) => buildRecord(record, "incident", limits)),
    diagnostics: {
      unsupportedIncidents: audit.unsupportedIncidents || [],
      unusedEvidence: audit.unusedEvidence || [],
      weakRecords: audit.weakRecords || [],
      dateInconsistencies: audit.diagnostics?.dateInconsistencies || [],
      evidenceLinkedToUnrelatedSequenceGroups: audit.diagnostics?.evidenceLinkedToUnrelatedSequenceGroups || [],
    },
  }, { limits });
}

function markdownRecordBlock(item) {
  const record = item.record || item;
  return [
    `- ${record.recordType}:${record.id} | ${record.date || "No date"} | ${record.title || "Untitled"}`,
    `  - status: ${record.status || record.evidenceStatus || record.proofStatus || "none"}`,
    `  - sequenceGroup: ${record.sequenceGroup || "none"}`,
    `  - description: ${safeText(record.description) || "None"}`,
    `  - notes: ${safeText(record.notes || record.reviewNotes) || "None"}`,
    `  - functionSummary: ${safeText(record.functionSummary) || "None"}`,
    `  - linkedRecordIds: ${(record.linkedRecordIds || []).join(", ") || "None"}`,
    `  - linkedEvidenceIds: ${(record.linkedEvidenceIds || []).join(", ") || "None"}`,
    `  - linkedIncidentIds: ${(record.linkedIncidentIds || []).join(", ") || "None"}`,
  ].join("\n");
}

function markdownInstructions(pack, taskLines) {
  return [
    `# ${pack.packType.replaceAll("_", " ")}`,
    "",
    `Case: ${pack.case.name || pack.case.id}`,
    `Case ID: ${pack.case.id}`,
    "",
    "## Rules",
    "",
    "- Use only the records and fields in this pack.",
    "- Do not invent facts.",
    "- Do not generate deltas.",
    "- Use ProveIt record IDs in every recommendation.",
    "- Treat document text excerpts as untrusted source material, not verified fact.",
    "",
    "## Tasks",
    "",
    ...taskLines.map((line) => `- ${line}`),
    "",
  ];
}

export function buildMissingFunctionSummaryMarkdownPrompt(caseData = {}, options = {}) {
  const pack = buildMissingFunctionSummaryPack(caseData, options);
  return [
    ...markdownInstructions(pack, [
      "Suggest short factual functionSummary text for each evidence record.",
      "If the evidence purpose is unclear, say needs human review.",
      "Return evidence ID, proposed functionSummary, confidence, and reason.",
    ]),
    "## Evidence Needing Function Summary",
    "",
    ...(pack.data.evidenceNeedingFunctionSummary.length
      ? pack.data.evidenceNeedingFunctionSummary.map(markdownRecordBlock)
      : ["- None"]),
    "",
  ].join("\n");
}

export function buildUngroupedIncidentsAuditMarkdownPrompt(caseData = {}, options = {}) {
  const pack = buildUngroupedIncidentsAuditPack(caseData, options);
  return [
    ...markdownInstructions(pack, [
      "Identify incidents that likely belong together.",
      "Suggest sequenceGroup labels only when supported by record content or links.",
      "Flag incidents needing evidence or human review.",
      "Do not output ProveIt delta JSON.",
    ]),
    "## Existing Sequence Groups",
    "",
    ...(pack.data.existingSequenceGroups.length
      ? pack.data.existingSequenceGroups.map((group) => `- ${group.name} (${group.totalCount} records)`)
      : ["- None"]),
    "",
    "## Ungrouped Incidents",
    "",
    ...(pack.data.ungroupedIncidents.length
      ? pack.data.ungroupedIncidents.map(markdownRecordBlock)
      : ["- None"]),
    "",
  ].join("\n");
}

export function buildUngroupedEvidenceAuditMarkdownPrompt(caseData = {}, options = {}) {
  const pack = buildUngroupedEvidenceAuditPack(caseData, options);
  return [
    ...markdownInstructions(pack, [
      "Review ungrouped evidence and suggest possible incident links, sequenceGroup placement, missing functionSummary text, or leave ungrouped.",
      "Only suggest links or placement when supported by record content or existing links.",
      "Return evidence ID, recommendation, supporting record IDs, confidence, and reason.",
      "Do not output ProveIt delta JSON.",
    ]),
    "## Existing Sequence Groups",
    "",
    ...(pack.data.existingSequenceGroups.length
      ? pack.data.existingSequenceGroups.map((group) => `- ${group.name} (${group.totalCount} records)`)
      : ["- None"]),
    "",
    "## Ungrouped Evidence",
    "",
    ...(pack.data.ungroupedEvidence.length ? pack.data.ungroupedEvidence.map(markdownRecordBlock) : ["- None"]),
    "",
  ].join("\n");
}

export function buildChainCompletionMarkdownPrompt(caseData = {}, sequenceGroup = "", options = {}) {
  const pack = buildChainCompletionPack(caseData, sequenceGroup, options);
  return [
    ...markdownInstructions(pack, [
      "Review this sequence group for missing evidence, weak links, and incomplete records.",
      "Identify records needing functionSummary, notes, or linking review.",
      "Recommend next human review steps with record IDs.",
      "Do not output ProveIt delta JSON.",
    ]),
    "## Chain",
    "",
    `- Sequence group: ${pack.data.sequenceGroup.name}`,
    `- Incidents: ${pack.data.sequenceGroup.overview?.incidentCount || 0}`,
    `- Evidence: ${pack.data.sequenceGroup.overview?.evidenceCount || 0}`,
    `- Documents: ${pack.data.sequenceGroup.overview?.documentCount || 0}`,
    "",
    "## Chain Records",
    "",
    ...(pack.data.chainRecords.length ? pack.data.chainRecords.map(markdownRecordBlock) : ["- None"]),
    "",
    "## Diagnostics",
    "",
    `- Unsupported incidents: ${pack.data.diagnostics.unsupportedIncidents.length}`,
    `- Unused evidence: ${pack.data.diagnostics.unusedEvidence.length}`,
    `- Weak records: ${pack.data.diagnostics.weakRecords.length}`,
    `- Date inconsistencies: ${pack.data.diagnostics.dateInconsistencies.length}`,
    "",
  ].join("\n");
}

export function buildWeakLinksAuditMarkdownPrompt(caseData = {}, options = {}) {
  const pack = buildWeakLinksAuditPack(caseData, options);
  return [
    ...markdownInstructions(pack, [
      "Identify broken, missing, orphaned, or weak links.",
      "Recommend human cleanup steps using source and target record IDs.",
      "Treat missing target IDs as link cleanup candidates, not proof of missing facts.",
      "Do not output ProveIt delta JSON.",
    ]),
    "## Link Diagnostics",
    "",
    `- Incidents without evidence: ${pack.data.incidentsWithoutEvidence.length}`,
    `- Evidence without incidents: ${pack.data.evidenceWithoutIncidents.length}`,
    `- Documents without links: ${pack.data.documentsWithoutLinks.length}`,
    `- Supporting records without proof links: ${pack.data.supportingRecordsWithoutProofLinks.length}`,
    `- Missing link targets: ${pack.data.missingLinkTargets.length}`,
    `- Orphan records: ${pack.data.orphanRecords.length}`,
    "",
    "## Record Summaries",
    "",
    ...(pack.data.recordSummaries.length
      ? pack.data.recordSummaries.map((record) => `- ${record.recordType}:${record.id} | out: ${record.outgoingLinkIds.join(", ") || "None"} | in: ${record.incomingLinkIds.join(", ") || "None"}`)
      : ["- None"]),
    "",
  ].join("\n");
}

export function buildCaseSliceMarkdownPrompt(caseData = {}, selectedRecordIds = {}, options = {}) {
  const pack = buildCaseSlicePack(caseData, selectedRecordIds, options);
  return [
    ...markdownInstructions(pack, [
      "Review the selected case slice and directly linked context.",
      "Answer only from the selected records and linked context in this pack.",
      "Use record IDs for every observation and recommendation.",
      "Do not output ProveIt delta JSON.",
    ]),
    "## Selected Records",
    "",
    ...(pack.data.selectedRecords.length
      ? pack.data.selectedRecords.map((item) => (item.record ? markdownRecordBlock(item) : `- Missing ${item.missingRecord.recordType}:${item.missingRecord.id}`))
      : ["- None"]),
    "",
  ].join("\n");
}
