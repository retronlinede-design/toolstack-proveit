export const AI_TOOL_OPTIONS = [
  {
    id: "missing-function-summaries",
    title: "Missing Function Summaries",
    description: "Evidence records with missing or vague functionSummary fields.",
  },
  {
    id: "ungrouped-incidents-audit",
    title: "Ungrouped Incidents Audit",
    description: "Incidents without a sequenceGroup, with linked context and existing group names.",
  },
  {
    id: "ungrouped-evidence-audit",
    title: "Ungrouped Evidence Audit",
    description: "Evidence without a sequenceGroup, with resolved incident and record context.",
  },
  {
    id: "weak-links-audit",
    title: "Weak Links Audit",
    description: "Broken, missing, orphaned, and weak link diagnostics with record summaries.",
  },
  {
    id: "chain-completion-pack",
    title: "Chain Completion Pack",
    description: "One selected sequence group with scoped records, linked context, and diagnostics.",
  },
  {
    id: "full-chain-gpt-pack",
    title: "Full Chain GPT Pack",
    description: "Complete bounded safe records for one sequence chain, including diagnostics and external linked records.",
  },
  {
    id: "management-report-builder-pack",
    title: "Management Report Builder Pack",
    description: "Whole-case or sequence-group handoff package for a specialist Report Builder GPT.",
  },
  {
    id: "case-slice-pack",
    title: "Case Slice Pack",
    description: "A custom selected set of record IDs with directly linked context.",
  },
];

export const AI_WORKSPACE_SECTIONS = [
  {
    id: "report-building",
    title: "Report Building",
    icon: "FileText",
    description: "Prepare management-facing report handoffs and final report-builder prompts.",
    toolIds: ["management-report-builder-pack"],
  },
  {
    id: "audits-reviews",
    title: "Audits & Reviews",
    icon: "Search",
    description: "Find missing summaries, ungrouped records, weak links, and cleanup targets.",
    toolIds: [
      "missing-function-summaries",
      "ungrouped-incidents-audit",
      "ungrouped-evidence-audit",
      "weak-links-audit",
    ],
  },
  {
    id: "gpt-exports",
    title: "GPT Exports",
    icon: "Download",
    description: "Copy bounded, non-importable GPT work packs for selected case slices or chains.",
    toolIds: ["case-slice-pack", "full-chain-gpt-pack"],
  },
  {
    id: "sequence-group-ai",
    title: "Sequence Group AI",
    icon: "Network",
    description: "Review and complete sequence chains using focused chain diagnostics.",
    toolIds: ["chain-completion-pack", "full-chain-gpt-pack"],
  },
  {
    id: "specialist-workflows",
    title: "Specialist Workflows",
    icon: "Briefcase",
    description: "Route management report packs through specialist analysis before final drafting.",
    toolIds: ["management-report-builder-pack"],
  },
];
