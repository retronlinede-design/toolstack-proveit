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
    id: "case-slice-pack",
    title: "Case Slice Pack",
    description: "A custom selected set of record IDs with directly linked context.",
  },
];
