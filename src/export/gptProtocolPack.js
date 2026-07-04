import { buildExportPrivacyMetadata, EXPORT_PRIVACY_PROFILES } from "./exportPrivacy.js";

export const PROVEIT_GPT_PROTOCOL_PACK = "PROVEIT_GPT_PROTOCOL_PACK";

const PROTOCOL_SCHEMA_VERSION = "proveit-gpt-protocol-pack-1.0";

const REQUIRED_SAFE_RULES = [
  "Do not invent facts.",
  "Do not generate deltas unless explicitly asked.",
  "Do not mutate case data.",
  "Do not treat documents as proof.",
  "Evidence meaning comes from functionSummary.",
  "Records/ledger are strongest measurable proof.",
  "Preserve IDs.",
  "Use source IDs in recommendations.",
  "Never include binary data.",
  "Never output unsupported schema fields.",
  "Never delete records.",
];

const PROTOCOL_SECTIONS = [
  {
    id: "proveit-overview",
    title: "ProveIt Overview",
    summary: "ProveIt is a case workspace for organizing incidents, evidence, documents, tracking records, ledger rows, strategy, reports, and AI review packs.",
    bullets: [
      "A ProveIt case is a structured evidence workspace, not a free-form chat transcript.",
      "External GPTs should use ProveIt exports as bounded source material and should not infer missing facts.",
      "Recommendations must preserve source IDs so a user can trace every suggestion back to case records.",
      "Documentation packs such as this protocol pack are non-importable reference material.",
    ],
  },
  {
    id: "record-types",
    title: "Record Types",
    summary: "Record type determines how a case item should be interpreted during analysis.",
    bullets: [
      "Incident: an alleged event or issue that may need evidence, dates, status, and narrative context.",
      "Evidence: a proof item or observation. Its meaning comes from functionSummary, linked incidents, source metadata, and review status.",
      "Document: a source container or extracted text. Do not treat documents as proof by themselves.",
      "Record: a structured tracking record derived from document data, often with tables and measurable entries.",
      "Ledger: the strongest measurable proof surface when it records payments, dates, obligations, balances, or other auditable rows.",
      "Strategy: planning, arguments, tasks, risks, or next steps; strategy is not proof unless linked to evidence or records.",
    ],
  },
  {
    id: "field-meaning-rules",
    title: "Field Meaning Rules",
    summary: "Field names carry evidence semantics and should not be rewritten casually.",
    bullets: [
      "id fields are stable source identifiers and must be preserved exactly.",
      "title, label, description, notes, and summary are user-entered or generated context; cite them as context, not proof unless supported.",
      "functionSummary explains what an evidence item proves or helps prove.",
      "evidenceStatus, proofStatus, importance, relevance, and evidenceRole are review signals, not automatic conclusions.",
      "sequenceGroup identifies the chain or issue cluster a record belongs to.",
      "linkedRecordIds, linkedEvidenceIds, linkedIncidentIds, linkedDocumentIds, basedOnEvidenceIds, and linkedIncidentRefs define traceability.",
      "Never output unsupported schema fields in deltas or suggested machine-readable updates.",
    ],
  },
  {
    id: "linking-rules",
    title: "Linking Rules",
    summary: "Links are the audit trail between facts, proof, documents, records, and recommendations.",
    bullets: [
      "Use source IDs in every recommendation that depends on case material.",
      "Prefer direct links over narrative claims when deciding what supports what.",
      "A weak link means the existing IDs do not clearly support the claim, not that the claim is false.",
      "Do not fabricate links to make a chain look complete.",
      "When suggesting new links, identify the source record ID, target record ID, and reason in plain language.",
    ],
  },
  {
    id: "export-types",
    title: "Export Types",
    summary: "ProveIt exports differ by purpose, importability, and intended reader.",
    bullets: [
      "CASE_REASONING_EXPORT is a non-importable reasoning snapshot for AI review. It summarizes case structure, chronology, evidence, links, and report context without attachment binaries.",
      "GPT_AUDIT_PACK is a non-importable specialist audit package with a bounded packType such as missing function summaries, weak links, ungrouped evidence, case slices, or chain completion.",
      "MANAGEMENT_REPORT_BUILDER_PACK is a GPT_AUDIT_PACK packType for helping a Report Builder GPT draft management-report-ready analysis from supplied source material.",
      "FULL_CHAIN_GPT_PACK is a GPT_AUDIT_PACK packType focused on one sequence group or chain, including records and surrounding context needed for chain-level review.",
      "GPT_RECORD_EXPORT is a non-importable Records tab export for one tracking record.",
      "GPT_RECORDS_EXPORT is a non-importable Records tab export for all tracking records.",
      "CASE_LINK_MAP_EXPORT describes link graph structure and diagnostics for traceability review.",
      "Full case backup exports are importable user data backups and should not be treated as GPT instruction packs.",
    ],
  },
  {
    id: "ai-pack-types",
    title: "AI Pack Types",
    summary: "AI packs are bounded work packages, not permission to rewrite the case.",
    bullets: [
      "Missing Function Summary packs ask a GPT to identify evidence records whose functionSummary needs clearer proof meaning.",
      "Weak Links packs ask a GPT to identify unclear or unsupported relationships between records.",
      "Ungrouped Evidence or Ungrouped Incident packs ask a GPT to recommend sequence group placement or cleanup.",
      "Case Slice packs constrain review to selected records and their direct context.",
      "Chain Completion packs ask what evidence, records, or links may be missing from a sequence group.",
      "Management Report Builder packs should produce report-ready analysis and cite source IDs, not mutate the case.",
    ],
  },
  {
    id: "report-builder-workflow",
    title: "Report Builder Workflow",
    summary: "A Report Builder GPT should turn supplied ProveIt material into structured report suggestions while keeping facts traceable.",
    bullets: [
      "Read only the supplied pack and protocol reference.",
      "Separate facts, analysis, risks, recommendations, and missing-source questions.",
      "For each proposed paragraph or finding, include source IDs that support it.",
      "Use neutral language when evidence is weak, incomplete, or only document-based.",
      "Return prose, outline, or structured JSON only in the format requested by the user.",
      "Do not create ProveIt deltas unless the user explicitly asks for a supported delta format.",
    ],
  },
  {
    id: "specialist-handoff-workflow",
    title: "Specialist Handoff Workflow",
    summary: "Specialist handoff packages give a narrowly scoped GPT enough context for a specific audit or drafting task.",
    bullets: [
      "Confirm the task scope before analyzing.",
      "Use the packType, instructions, records, diagnostics, and source IDs supplied in the handoff.",
      "Return findings grouped by severity, confidence, and source IDs where useful.",
      "Flag missing data as a question or recommendation instead of filling the gap.",
      "Keep recommendations reviewable by a human ProveIt user.",
    ],
  },
  {
    id: "delta-rules",
    title: "Delta Rules",
    summary: "Deltas are machine-readable update requests and should be generated only on explicit request.",
    bullets: [
      "Do not generate deltas unless explicitly asked.",
      "A gpt-delta update must use app: proveit, contractVersion: gpt-delta-2.0, target.caseId, and an operations object.",
      "A sequence group delta must use the supported sequence group delta schema version and only supported group/record move operations.",
      "Deltas must preserve IDs and target existing records unless the supported contract explicitly allows creation.",
      "Never delete records.",
      "Never include binary data in a delta.",
      "Never output unsupported schema fields.",
      "If a requested change cannot be represented safely, return a human-readable recommendation instead of a delta.",
      "Use deltas for narrow, reviewable updates such as a functionSummary improvement, sequenceGroup assignment, or link recommendation only when the active UI flow supports it.",
    ],
  },
  {
    id: "real-accepted-gpt-delta-2-contract",
    title: "Real Accepted gpt-delta-2.0 Contract",
    summary: "ProveIt accepts an object-shaped operations wrapper for gpt-delta-2.0, not an operations array.",
    bullets: [
      "Top-level app must be proveit.",
      "Top-level contractVersion must be gpt-delta-2.0.",
      "target.caseId is required and must match the active case.",
      "operations must be an object.",
      "operations.create and operations.patch are optional individually, but at least one supported create or patch operation must be present.",
      "The accepted wrapper is { app, contractVersion, target: { caseId }, operations: { create: {}, patch: {} } }.",
    ],
  },
  {
    id: "supported-create-collections",
    title: "Supported Create Collections",
    summary: "gpt-delta-2.0 can create only the supported record collections.",
    bullets: [
      "Supported create collection: incidents.",
      "Supported create collection: evidence.",
      "Supported create collection: documents.",
      "Supported create collection: ledger.",
      "Not supported: strategy create.",
      "Do not create unsupported collections or unsupported fields.",
    ],
  },
  {
    id: "supported-patch-collections",
    title: "Supported Patch Collections",
    summary: "gpt-delta-2.0 can patch existing records in the supported collections.",
    bullets: [
      "Supported patch collection: incidents.",
      "Supported patch collection: evidence.",
      "Supported patch collection: documents.",
      "Supported patch collection: ledger.",
      "Supported patch collection: strategy.",
      "Patch ids must be existing baseline record ids.",
      "Array fields are full replacements, not append instructions.",
    ],
  },
  {
    id: "create-incident-evidence-example",
    title: "Create Incident + Evidence Example",
    summary: "Use tempId values to link newly created records within the same delta.",
    bullets: [
      "Create examples use operations.create.incidents and operations.create.evidence arrays.",
      "New records use tempId values for cross-linking.",
      "linkedEvidenceIds may reference an evidence tempId declared in the same delta.",
      "linkedIncidentIds may reference an incident tempId declared in the same delta.",
      "ProveIt resolves tempIds to final IDs during import.",
    ],
  },
  {
    id: "patch-example",
    title: "Patch Example",
    summary: "Patch examples use operations.patch.<collection> arrays with { id, patch } items.",
    bullets: [
      "Patch items must include an existing id.",
      "The patch object contains only supported fields for that collection.",
      "To update an evidence functionSummary, patch operations.patch.evidence.",
      "Do not use op: update, collection, or operations arrays.",
    ],
  },
  {
    id: "temporary-id-rules",
    title: "Temporary ID Rules",
    summary: "tempId is the only safe way for GPT-created records to refer to each other before ProveIt generates final IDs.",
    bullets: [
      "For specialist GPT output, tempId is required for new records.",
      "Each tempId must be unique within the delta.",
      "Links may reference tempIds declared in the same delta.",
      "ProveIt resolves final IDs during import.",
      "GPT must never invent final IDs.",
      "Patch operations must use existing final record IDs, not tempIds.",
    ],
  },
  {
    id: "unsupported-contracts",
    title: "Unsupported Contracts",
    summary: "These wrappers are invalid for ProveIt gpt-delta-2.0 import.",
    bullets: [
      "{ \"operations\": [] } is invalid.",
      "{ \"changes\": [] } is invalid.",
      "{ \"delta\": { \"operations\": {} } } is invalid.",
      "{ \"operations\": [{ \"op\": \"create\" }] } is invalid.",
      "Do not use op:create, op:update, operations arrays, changes arrays, or nested delta.operations wrappers.",
    ],
  },
  {
    id: "strategy-limitation",
    title: "Strategy Limitation",
    summary: "Strategy records have different create and patch support in gpt-delta-2.0.",
    bullets: [
      "Strategy create is not supported in gpt-delta-2.0.",
      "Strategy patch is supported in gpt-delta-2.0.",
      "Use operations.patch.strategy for existing strategy records.",
      "Do not output operations.create.strategy.",
    ],
  },
  {
    id: "safe-output-rules",
    title: "Safe Output Rules",
    summary: "External GPTs should produce bounded, traceable, reviewable output.",
    bullets: REQUIRED_SAFE_RULES,
  },
  {
    id: "examples",
    title: "Examples",
    summary: "These examples show safe output shapes and wording. They are reference examples, not data from the current case.",
    bullets: [
      "Management Analysis Handoff: produce findings with sourceIds, confidence, and missing information questions.",
      "Report Builder output: draft report sections with source IDs beside each finding.",
      "Missing Function Summary suggestion: propose a concise functionSummary for an evidence ID and explain why.",
      "Weak Links recommendation: identify the weak relationship and recommend a review action with both source IDs.",
      "Safe gpt-delta update example: only update an allowed text field for an existing record when explicitly requested.",
      "Safe sequence group delta example: move existing records into an existing or proposed sequence group using supported operations only.",
    ],
  },
  {
    id: "forbidden-behavior",
    title: "Forbidden Behavior",
    summary: "These behaviors are not allowed for specialist GPTs working with ProveIt material.",
    bullets: [
      "Inventing facts, dates, parties, payments, documents, evidence, or links.",
      "Treating document text as proof without evidence, record, ledger, or source ID support.",
      "Generating deltas without an explicit request.",
      "Deleting records or proposing destructive machine actions.",
      "Including binary/image/base64/attachment data.",
      "Outputting unsupported schema fields.",
      "Changing IDs or using new IDs for existing records.",
      "Claiming a chain is proven when links or functionSummary fields are weak.",
      "Importing or mutating case data from this protocol pack.",
    ],
  },
];

const PROTOCOL_EXAMPLES = {
  managementAnalysisHandoff: {
    task: "Review management conduct issues from the supplied MANAGEMENT_REPORT_BUILDER_PACK.",
    safeResponseShape: {
      findings: [
        {
          title: "Repair chronology appears incomplete",
          sourceIds: ["inc-2026-001", "ev-2026-014", "ledger-2026-rent"],
          confidence: "medium",
          analysis: "The incident is linked to evidence and a ledger row, but the chain has no follow-up record after the reported repair date.",
          recommendedFollowUp: "Ask the user to add or link any completion notice, inspection, or payment adjustment record.",
        },
      ],
      questions: [
        {
          question: "Was a completion document received after the repair visit?",
          sourceIds: ["inc-2026-001"],
        },
      ],
    },
  },
  reportBuilderOutput: {
    section: "Management Report Draft Finding",
    safeResponseShape: {
      heading: "Delayed repair response",
      paragraph: "The supplied records indicate a reported repair issue, linked evidence, and a related ledger entry. The report should avoid saying the issue is proven unless the missing completion source is added.",
      sourceIds: ["inc-2026-001", "ev-2026-014", "ledger-2026-rent"],
      caveat: "Document text alone should be described as source material, not proof.",
    },
  },
  missingFunctionSummarySuggestion: {
    evidenceId: "ev-2026-014",
    suggestedFunctionSummary: "Shows the reported repair condition on the same date as incident inc-2026-001.",
    reason: "The current functionSummary is missing or vague; the suggested text states what the evidence helps prove without overclaiming.",
    sourceIds: ["ev-2026-014", "inc-2026-001"],
  },
  weakLinksRecommendation: {
    issue: "Incident inc-2026-001 links to document doc-2026-quote, but no evidence or ledger row confirms the quoted amount.",
    sourceIds: ["inc-2026-001", "doc-2026-quote"],
    recommendation: "Review whether ledger-2026-rent or another record should be linked, or mark the amount as document-only context.",
    confidence: "medium",
  },
  safeGptDeltaUpdateExample: {
    note: "Only output this when the user explicitly asks for a supported gpt-delta-2.0 update.",
    delta: {
      app: "proveit",
      contractVersion: "gpt-delta-2.0",
      target: {
        caseId: "case-1",
      },
      operations: {
        patch: {
          evidence: [
            {
              id: "ev-2026-014",
              patch: {
                functionSummary: "Shows the reported repair condition on the same date as incident inc-2026-001.",
              },
            },
          ],
        },
      },
    },
  },
  realAcceptedGptDelta2Contract: {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: {
      caseId: "case-1",
    },
    operations: {
      create: {},
      patch: {},
    },
  },
  createIncidentEvidenceExample: {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: {
      caseId: "case-1",
    },
    operations: {
      create: {
        incidents: [
          {
            tempId: "tmp-inc-repair-delay",
            title: "Repair delay reported",
            date: "2026-05-15",
            description: "User reported an unresolved repair delay.",
            evidenceStatus: "needs_evidence",
            sequenceGroup: "Repair Delay Chain",
            linkedEvidenceIds: ["tmp-ev-repair-photo"],
          },
        ],
        evidence: [
          {
            tempId: "tmp-ev-repair-photo",
            title: "Repair condition photo",
            date: "2026-05-15",
            functionSummary: "Shows the reported repair condition on the same date as the repair delay incident.",
            evidenceRole: "VISUAL_EVIDENCE",
            linkedIncidentIds: ["tmp-inc-repair-delay"],
          },
        ],
      },
    },
  },
  patchExample: {
    app: "proveit",
    contractVersion: "gpt-delta-2.0",
    target: {
      caseId: "case-1",
    },
    operations: {
      patch: {
        evidence: [
          {
            id: "ev-1",
            patch: {
              functionSummary: "Shows the reported repair condition on the same date as incident inc-1.",
            },
          },
        ],
      },
    },
  },
  unsupportedContractExamples: [
    {
      operations: [],
    },
    {
      changes: [],
    },
    {
      delta: {
        operations: {},
      },
    },
    {
      operations: [
        {
          op: "create",
        },
      ],
    },
  ],
  strategyLimitation: {
    unsupported: "operations.create.strategy",
    supported: "operations.patch.strategy",
  },
  safeSequenceGroupDeltaExample: {
    note: "Only output this when the user explicitly asks for a supported sequence group delta.",
    delta: {
      app: "proveit",
      schema: "sequence-group-delta-1.0",
      operations: [
        {
          op: "moveRecordToSequenceGroup",
          recordType: "incident",
          recordId: "inc-2026-001",
          sequenceGroup: "Repair Delay Chain",
          reason: "The incident is part of the same repair delay chain as evidence ev-2026-014.",
          sourceIds: ["inc-2026-001", "ev-2026-014"],
        },
      ],
    },
  },
};

function renderList(items = []) {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderJsonBlock(value) {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

export function buildGptProtocolPack(options = {}) {
  return {
    app: "proveit",
    exportType: PROVEIT_GPT_PROTOCOL_PACK,
    schemaVersion: PROTOCOL_SCHEMA_VERSION,
    exportedAt: options.exportedAt || new Date().toISOString(),
    exportMetadata: buildExportPrivacyMetadata(EXPORT_PRIVACY_PROFILES.GPT_AUDIT_PACK, {
      exportType: PROVEIT_GPT_PROTOCOL_PACK,
      label: "GPT Audit Pack",
      createdAt: options.exportedAt,
      includesPrivateNotes: false,
    }),
    importable: false,
    includesBinaryData: false,
    purpose: "Knowledge/reference pack for external specialist GPTs that need to understand ProveIt export, import, report, AI pack, and delta rules.",
    audience: [
      "Custom GPT knowledge files",
      "Specialist GPTs",
      "Report Builder GPTs",
      "Audit and handoff workflows",
    ],
    requiredSafeRules: REQUIRED_SAFE_RULES,
    sections: PROTOCOL_SECTIONS,
    examples: PROTOCOL_EXAMPLES,
  };
}

export function exportGptProtocolPackJson(options = {}) {
  return buildGptProtocolPack(options);
}

export function exportGptProtocolPackMarkdown(options = {}) {
  const pack = buildGptProtocolPack(options);
  const lines = [
    "# ProveIt GPT Protocol Pack",
    "",
    `- App: ${pack.app}`,
    `- Export type: ${pack.exportType}`,
    `- Schema version: ${pack.schemaVersion}`,
    `- Importable: ${pack.importable}`,
    `- Includes binary data: ${pack.includesBinaryData}`,
    `- Includes evidence files: ${pack.exportMetadata.includesEvidenceFiles}`,
    `- Includes private notes: ${pack.exportMetadata.includesPrivateNotes}`,
    `- Includes PIN data: ${pack.exportMetadata.includesPinData}`,
    `- Exported at: ${pack.exportedAt}`,
    "",
    "## Purpose",
    "",
    pack.purpose,
    "",
    "## Required Safe Rules",
    "",
    renderList(pack.requiredSafeRules),
    "",
  ];

  pack.sections.forEach((section) => {
    lines.push(`## ${section.title}`, "", section.summary, "", renderList(section.bullets), "");
  });

  lines.push(
    "## Example Payloads",
    "",
    "### Management Analysis Handoff",
    "",
    renderJsonBlock(pack.examples.managementAnalysisHandoff),
    "",
    "### Report Builder Output",
    "",
    renderJsonBlock(pack.examples.reportBuilderOutput),
    "",
    "### Missing Function Summary Suggestion",
    "",
    renderJsonBlock(pack.examples.missingFunctionSummarySuggestion),
    "",
    "### Weak Links Recommendation",
    "",
    renderJsonBlock(pack.examples.weakLinksRecommendation),
    "",
    "### Safe gpt-delta Update Example",
    "",
    renderJsonBlock(pack.examples.safeGptDeltaUpdateExample),
    "",
    "### Real Accepted gpt-delta-2.0 Contract",
    "",
    renderJsonBlock(pack.examples.realAcceptedGptDelta2Contract),
    "",
    "### Create Incident + Evidence Example",
    "",
    renderJsonBlock(pack.examples.createIncidentEvidenceExample),
    "",
    "### Patch Example",
    "",
    renderJsonBlock(pack.examples.patchExample),
    "",
    "### Unsupported Contract Examples",
    "",
    ...pack.examples.unsupportedContractExamples.flatMap((example) => [renderJsonBlock(example), ""]),
    "### Strategy Limitation",
    "",
    renderJsonBlock(pack.examples.strategyLimitation),
    "",
    "### Safe Sequence Group Delta Example",
    "",
    renderJsonBlock(pack.examples.safeSequenceGroupDeltaExample),
    "",
  );

  return lines.join("\n");
}
