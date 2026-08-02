# ProveIt Reports Centre — Professional UX and Workflow Audit

**Audit date:** 2 August 2026  
**Repository:** `C:\Users\roryr\Desktop\Apps\toolstack-prove-it`  
**Branch:** `main`  
**Audited commit:** `55270e297953f503d5f47040bb2d6c2c0122a46e` (`feat(issues): add stable identity and operational metadata`)  
**Audit type:** UX, workflow, information architecture, accessibility, responsive presentation, and discoverability. Report correctness and case-data quality are outside scope.

## Contents

1. Executive assessment
2. Repository state and method
3. Active runtime architecture
4. Current report inventory
5. First-time user workflow
6. Information architecture and categories
7. Report selector and cards
8. Scope workflow
9. Preview experience
10. Output actions
11. Report metadata
12. Empty states
13. Accessibility
14. Responsive layout
15. Dark mode
16. Advanced Reports
17. Print Pack
18. Issue / Sequence Group workflow
19. Legacy paths and technical debt
20. Prioritised UX findings
21. Capability matrix
22. Conceptual wireframe
23. Recommended development order
24. Validation

## 1. Executive assessment

The Reports Centre is functionally substantial but not yet organised as a professional report-selection workflow. It exposes ten active primary report choices, useful scope controls, honest completeness labels, several deterministic formats, and generally strong preview renderers. Its strongest UX quality is that selected reports now communicate scope, completeness, included record types, outputs, generation time, and source revision.

The main weakness is decision support. A first-time user sees a flat grid of ten similarly weighted report cards without categories, recommended use, audience labels, or a clear distinction between communication reports, schedules, internal quality checks, and operational plans. The user must understand internal product terminology to choose correctly.

The centre also contains three overlapping report surfaces:

1. The primary Report Centre selector and preview.
2. An embedded **Advanced Reports** disclosure duplicating Executive Summary, Evidence Pack, Document Pack, Ledger Pack, and Client Report workflows.
3. A separate top-level **Print Pack** workspace with Internal View, Client Report, and an unavailable Lawyer Pack.

This duplication is the largest UX and maintenance risk. It makes the application feel like several generations of reporting UI placed alongside one another rather than one coherent publishing workflow.

The recommended next phase is a conservative information-architecture redesign: categorise the existing reports, make audience/purpose/output/completeness visible before selection, establish one primary selection and output workflow, and demote duplicate or specialist paths without changing report builders.

## 2. Repository state and audit method

At the start of the audit:

- Repository path: `C:\Users\roryr\Desktop\Apps\toolstack-prove-it`
- Branch: `main`
- Commit: `55270e297953f503d5f47040bb2d6c2c0122a46e`
- Working tree: clean

The audit traced the active source path, report definitions, scope normalization, output capability checks, preview dispatch, report-specific render branches, Advanced Reports, Print Pack, tests, and all files under `src/components/reports`.

Confidence labels used below:

- **Verified source behaviour:** directly present in the active render path or configuration.
- **UX inference:** likely user effect inferred from the visible structure and labels.
- **Runtime limitation:** no interactive browser automation was available; viewport, focus order, contrast, and scrolling findings are source-level assessments rather than measured usability-test results.

## 3. Active runtime architecture

```text
App.jsx
  └─ tabs[] → Generate Report (activeTab: "generate-report")
       └─ CaseDetail.jsx active Report Centre branch
            ├─ ReportCentreControls
            │    ├─ report-type card grid
            │    ├─ scope buttons
            │    ├─ Sequence Group select
            │    └─ ReportOutputActions
            ├─ ReportContextHeader
            ├─ ReportCentrePreviewSummary
            ├─ report-specific preview dispatch
            └─ Advanced Reports disclosure

CaseDetail report state
  ├─ reportDefinitions.js
  ├─ reportScopes.js
  ├─ reportCentreConfig.js
  ├─ reportModel.js
  ├─ buildActiveReportDocument.js (six migrated reports)
  ├─ legacy/bespoke report builders (four primary reports)
  └─ report renderer components / inline Action Plan renderer

Separate top-level path
  └─ App.jsx tab "pack"
       └─ CaseDetail.jsx Print Pack
            ├─ Internal View
            ├─ Client Report
            └─ Lawyer Pack — Unavailable
```

### Active components and modules

| Responsibility | Active component/module |
|---|---|
| Workspace entry | `App.jsx` tabs, `CaseDetail.jsx` `activeTab === "generate-report"` |
| Primary selector, scope, output area | `ReportCentreControls.jsx` |
| Selector ordering and labels | `reportCentreConfig.js`, `REPORT_CENTRE_TYPES` |
| Authoritative capabilities | `reportDefinitions.js` |
| Scope normalization | `reportScopes.js` |
| Selected-report context | `ReportContextHeader.jsx` |
| Preview explanation | `ReportCentrePreviewSummary` |
| Shared output buttons | `ReportOutputActions.jsx` |
| Central factual projection | `reportModel.js` |
| Shared document dispatch | `buildActiveReportDocument.js` |
| Migrated renderers | Evidence, Document, Ledger, Incident Schedule, Chronology, Case Audit articles |
| Bespoke renderers | Executive Summary, Case Bundle, Thread Issue, Generated Client Report, inline Action Plan |
| Advanced surface | Inline disclosure in `CaseDetail.jsx` |
| Print Pack | Inline `activeTab === "pack"` branch in `CaseDetail.jsx` |

### Runtime split

Six reports use the central serialisable report-document runtime:

- Case Audit Report
- Incident Schedule
- Chronology Report
- Evidence Pack
- Document Pack
- Ledger Pack

Four active primary reports bypass that dispatcher:

- Management Report
- Investigation Report
- Client Report
- Action Plan

This split is visible to users through output availability and provenance: the migrated reports can offer shared Markdown/JSON outputs and source-revision metadata, while bespoke reports have different actions and interaction patterns.

## 4. Current report inventory

### Primary Reports Centre choices

| Report | Current purpose | Audience | Scope | Outputs | Completeness | Renderer | Document path | State |
|---|---|---|---|---|---|---|---|---|
| Management Report | Concise management view of findings, risks, awareness, issues, and actions | Managers, HR, executives | Whole case | Preview, Print | Summary; key timeline limited to five entries | `ExecutiveSummaryReportArticle` | Legacy/bespoke builder | Active, legacy-compatible |
| Investigation Report | Focused Issue/thread report or bounded whole-case investigation overview | Investigator or reviewer | Whole case, Issue/Sequence Group | Preview, Print | Bounded; whole-case evidence/documents capped at 12 each | `ThreadIssueReportArticle` or `CaseBundleReportArticle` | Legacy/bespoke builders | Active, mixed by scope |
| Case Audit Report | Deterministic structural/data-quality audit | Internal QA, investigator | Whole case, Issue | Preview, Print, Markdown, JSON | Complete for declared checks and scope | `CaseAuditReportArticle` | `buildCaseAuditDocument` | Active, migrated |
| Incident Schedule | Complete incident schedule with evidence associations and quality findings | Investigator, adviser | Whole case, Issue | Preview, Print, Markdown, JSON | Complete | `IncidentScheduleReportArticle` | `buildIncidentScheduleDocument` | Active, migrated |
| Chronology Report | Canonical chronology across supported record types | Investigator, adviser, external reader | Whole case, Issue | Preview, Print, Markdown, JSON | Complete | `ChronologyReportArticle` | `buildChronologyReportDocument` | Active, migrated |
| Evidence Pack | Evidence matrix and supporting material | Investigator, adviser | Whole case, Issue | Preview, Print, Markdown, JSON | Complete | `EvidencePackReportArticle` | `buildEvidenceScheduleDocument` | Active, migrated |
| Document Pack | Document matrix, links, and attachment metadata | Investigator, disclosure/review | Whole case, Issue | Preview, Print, Markdown, JSON | Complete | `DocumentPackReportArticle` | `buildDocumentScheduleDocument` | Active, migrated |
| Ledger Pack | Financial/payment/measurable-record review | Investigator, adviser, finance reader | Whole case, Issue | Preview, Print, Markdown, JSON | Complete | `LedgerPackReportArticle` | `buildLedgerScheduleDocument` | Active, migrated |
| Client Report | GPT prompt/paste/render workflow for client-facing prose | Client/case owner | Whole case | Preview, Print | Summary; generated narrative | `GeneratedClientReportArticle` | No shared report document | Active, AI-dependent bespoke workflow |
| Action Plan | Outstanding issues, actions, risks, and recommendations | Internal case owner/manager | Whole case, Issue | Preview, Print, Markdown | Summary | Inline `renderActionPlanReport` | Bespoke deterministic builder | Active, legacy-compatible |

### Other visible report surfaces

| Surface | Visible options | Current role | Assessment |
|---|---|---|---|
| Advanced Reports | Executive Summary, Ledger Pack, Document Pack, Evidence Pack, Client Report, Internal Report unavailable | Older/specialist generators and optional GPT workflows | Duplicates primary choices and splits user expectations |
| Print Pack | Internal View, Client Report, Lawyer Pack unavailable | Printable case summary/client output | Separate publishing destination with overlapping content |
| Sequence Group Audit | Opened from every report selection through the output column | Technical Issue/Sequence Group audit/export | Useful advanced tool but contextually unrelated to several selected reports |

## 5. First-time user workflow

### Can users answer “Which report should I use?”

Not reliably. All ten reports appear in one two-column grid with similar visual weight. There is no “recommended for” cue, audience filter, category heading, example outcome, or primary/supporting distinction.

### Can users understand what a report contains?

Partly. Each card has a short description. After selection, `ReportContextHeader` adds included record types and completeness, and `ReportCentrePreviewSummary` provides more report-specific detail. Important information therefore appears only after selection instead of helping the selection decision.

### Is the audience clear?

No. Audience exists in `reportDefinitions.js` but is not rendered on report cards or in `ReportContextHeader`. “Management” and “Client” imply audiences, but Investigation, Chronology, Evidence Pack, Document Pack, Ledger Pack, and Action Plan require product knowledge.

### Are report differences understandable?

Only after experimentation. The distinction between:

- Investigation Report and Incident Schedule;
- Investigation Report and Chronology Report;
- Evidence Pack and Document Pack;
- Management Report and Action Plan;
- Client Report and Print Pack Client Report;
- Case Audit and Sequence Group Audit

is not explained at the selector level.

### Which report explains the investigation?

The natural answer should be Investigation Report, but its whole-case output is explicitly bounded and its Issue-scoped output changes renderer and character. Management Report may be more communicative, while schedules may contain fuller factual detail. The UI does not explain this trade-off.

### Which reports are technical or internal?

Case Audit is described as internal. Action Plan is not visibly labelled internal despite its definition. JSON availability hints at technical use but is not explained. Sequence Group Audit is shown as a general output-column action for every selection, weakening its status as an advanced/internal tool.

## 6. Information architecture and categories

### Current ordering

The fixed order is:

1. Management Report
2. Investigation Report
3. Case Audit Report
4. Incident Schedule
5. Chronology Report
6. Evidence Pack
7. Document Pack
8. Ledger Pack
9. Client Report
10. Action Plan

The order mixes audience, purpose, maturity, and output type. An internal QA report appears before primary schedules; the Client Report appears near the end despite being a principal communication output; Action Plan appears last despite frequent operational value.

### Natural categories observed

The current capabilities naturally fall into:

- **Primary communication reports:** Management, Investigation, Client.
- **Supporting schedules and packs:** Incident Schedule, Chronology, Evidence, Document, Ledger.
- **Internal quality:** Case Audit and Sequence Group Audit.
- **Operational:** Action Plan.
- **Advanced/legacy publishing:** Advanced Reports and Print Pack.

These categories already exist semantically but are not represented visually.

### Terminology risks

- The tab is “Generate Report,” while the page title is “Report Centre.”
- Both “Report” and “Pack” are used without explaining whether a pack is a schedule, bundle, or attachment collection.
- The UI still says “Sequence Group” despite normal Issue terminology elsewhere.
- “Print / Save PDF” is accurate, but “Print Pack” sounds like a downloadable package rather than a browser-print workspace.
- “Advanced Reports” contains duplicates, not simply advanced capabilities.
- “Internal Report — Unavailable” and “Lawyer Pack — Unavailable” advertise future destinations alongside working workflows.

## 7. Report selector and cards

### Strengths

- Native buttons provide keyboard activation.
- `aria-pressed` communicates selection.
- Selected state includes visible text, not colour alone.
- Descriptions are concise.
- Two-column layout is compact on medium screens.
- Dark-mode classes exist for primary card surfaces.

### Weaknesses

- Cards lack audience, completeness, scope, outputs, and status metadata.
- Every report has equal weight despite different user value and maturity.
- Labels do not distinguish “external communication,” “internal QA,” and “supporting schedule.”
- No card answers the user’s question or shows a representative deliverable.
- Ten cards create scanning load before scope and output controls are considered.
- The selected card can be far from the preview below, particularly on mobile.
- Report ordering is configuration order rather than an explicit UX taxonomy.

### Missing card information

At minimum, selection needs awareness of:

- Intended reader
- Primary question answered
- Whole-case versus Issue availability
- Summary/bounded/complete status
- Human-readable versus technical output
- AI involvement
- Whether Markdown/JSON is available

## 8. Scope workflow

### Strengths

- Scope support is definition-driven and normalized consistently.
- Unsupported scope silently returns to whole case rather than producing invalid data.
- Single-scope reports show “Whole case only.”
- `aria-pressed` is present on scope buttons.
- Missing and empty Sequence Group states have explicit messages.

### Weaknesses

- Scope appears before report type visually, although available scope depends on the selected report. This reverses the natural decision order.
- A disabled active “Whole Case” button resembles an unavailable control rather than a fixed report property.
- “Sequence Group” is legacy implementation terminology; current user terminology is Issue.
- The Issue selector shows only names and does not expose status, reference, or record count.
- Scope state is split across scope buttons, a select, context header, preview summary, and empty-state messages.
- When changing report type, automatic scope normalization may be technically safe but can feel like the user’s selection changed without explanation.
- The always-visible “Open Sequence Group Audit” action is not conditional on Issue scope or selected-report purpose.

## 9. Preview experience

### Strengths

- Report previews use constrained reading widths.
- Print styles remove borders, padding, and shadows appropriately.
- The context header appears before preview content.
- Bounded Investigation output includes a prominent limitation notice.
- Migrated report renderers have structured headings, tables, notices, and provenance.
- Empty Issue scope is handled before attempting to render misleading content.

### Weaknesses

- The page is one long scroll containing selector, controls, metadata, preview, and Advanced Reports. There is no persistent selected-report navigation or quick return to controls.
- “Preview” appears both as a static output tile and as a heading, adding little information.
- Preview height is unbounded; long schedules push Advanced Reports far below.
- There is no explicit “preview begins here” landmark beyond visual sections.
- Bespoke renderers do not share identical surface, metadata, or dark-mode behaviour.
- The Client Report interposes a complex prompt/paste/editor workflow inside the preview area, changing the mental model from selecting a report to authoring one.
- There is no draft/final indicator, review checklist, or preserved generation snapshot.

### Does the preview provide enough context before export?

For the six migrated reports, mostly yes: name, completeness, scope, count, included types, outputs, generated time, and source fingerprint are visible. For Management, Investigation, Client, and Action Plan, provenance is less consistent because no shared report document is present. Audience and AI provenance remain insufficiently visible for all reports.

## 10. Output actions

### Current ordering

Within `ReportOutputActions`:

1. Copy Markdown
2. Download Markdown
3. Download JSON
4. Print / Save PDF

The output column first shows a non-interactive “Preview” tile, then these actions, then “Open Sequence Group Audit.”

### Assessment

- **Copy Markdown:** useful for AI/editor transfer, but its destination and formatting are unexplained.
- **Download Markdown:** clear format but user value is not described.
- **Download JSON:** technical data transfer/audit output; presented with equal prominence to human documents.
- **Print / Save PDF:** clearest external-sharing action and visually emphasised, but browser-print dependence is not stated until the label.
- **Feedback:** appropriately uses `role="status"` and `aria-live="polite"`.

The output list is capability-correct, but users are not told which output to choose. Technical and communication outputs should not have identical conceptual weight. “Open Sequence Group Audit” is navigation, not an output, and should not share the output group.

## 11. Report metadata

| Metadata | Current state |
|---|---|
| Purpose | Present as card description and selected preview description |
| Audience | Stored in definitions but not displayed |
| Contains | Displayed after selection in context header |
| Completeness | Clearly displayed after selection |
| Scope | Displayed in several places after selection |
| Generation time | Displayed only when a shared report document exists |
| Source revision | Displayed only when a shared report document exists |
| AI involvement | Defined but not exposed consistently in the selector/context header |
| Archived-record policy | Defined but not exposed |
| Draft/final state | Missing |
| Version/snapshot identity | Missing from the workflow |

The metadata foundation is strong, but the UI uses it mainly after selection. The audience and AI policy are the most important unused fields.

## 12. Empty states

### Strong empty states

- Missing selected Sequence Group explains the prerequisite.
- Empty scoped migrated reports explain that the group exists but contains no permitted records.
- Empty Case Audit distinguishes a valid empty group from an unresolved group.
- Client Report warns when pasted content resembles the prompt rather than generated output.

### Weak or inconsistent empty states

- Several Advanced Reports use “Select a case to preview…” even though this surface is already inside an active case; these states are likely defensive rather than normal and do not guide data entry.
- “No report content is rendered yet” explains the Client Report step but not the privacy/provenance implications of using GPT.
- Renderer-level empty states vary in tone and specificity.
- Empty messages do not consistently link to the workspace where missing data can be added.
- No empty state explains that a valid empty report may be useful as an audit result rather than an error.

## 13. Accessibility

### Strengths

- Native buttons and selects are used.
- Report and scope selection use `aria-pressed`.
- Output feedback is a polite live region.
- The selected report heading has `aria-labelledby` linkage.
- Disabled output actions use native `disabled` semantics.
- Important states generally include text rather than colour alone.

### Findings

- The report card grid is not grouped with a semantic heading/fieldset describing the choice.
- Scope selection behaves like a radio group but is implemented as independent pressed buttons without a group role or legend.
- The output-action container has `aria-label` but no semantic navigation or fieldset relationship.
- Advanced Reports uses nested disclosure buttons and controls; keyboard operation is likely possible, but focus movement and return are not explicit.
- The selected report change does not announce that preview content below has changed.
- No skip link moves from the selector to the preview.
- Report cards repeat lengthy descriptions; screen-reader users must traverse all ten before reaching output controls.
- Internal IDs/fingerprints are truncated visually with full content only in a title attribute, which is not reliable for keyboard or touch users.
- Several bespoke/Advanced/Print Pack surfaces lack explicit dark classes and may have contrast problems.

No formal WCAG compliance claim is made.

## 14. Responsive layout

### Source-level strengths

- Primary controls collapse from three desktop columns to a single flow.
- Report cards change from one to two columns at `sm`.
- Output actions change grid shape responsively.
- Preview articles use maximum widths and wrapping classes.
- Action groups generally use wrapping flex layouts.

### Source-level weaknesses

- On mobile, the user encounters scope first, then ten cards, then output actions, then context, then preview. This creates a long decision journey and puts actions far from preview verification.
- Ten cards in a single column are cumbersome at approximately 390 px.
- Tables inside schedule renderers may require horizontal handling; this audit did not verify actual overflow in a browser.
- Long Issue names in the native select depend on browser truncation.
- The Client Report editor includes an 18-row textarea and language controls, substantially lengthening the mobile page.
- Print Pack’s mode control and print action wrap, but unavailable options still consume scarce horizontal space.
- Advanced Reports multiplies long-form previews inside an already long page.

## 15. Dark mode

### Strong areas

- `ReportCentreControls`, `ReportContextHeader`, `ReportOutputActions`, scope controls, report cards, and principal empty-state surfaces include explicit dark classes.
- Selected/unselected states retain text labels.

### Gaps

- Primary preview article classes passed from `CaseDetail` commonly force `bg-white` without matching outer dark surfaces.
- Several report articles are print-oriented and use fixed neutral/white colours.
- Client Report prompt, textarea, rendered container, language selector, and feedback surfaces have incomplete dark treatment.
- Advanced Reports contains many white/neutral surfaces without consistent explicit dark classes.
- Print Pack intentionally uses white printable sheets, but outside print mode this creates a bright island in dark mode.
- Amber/lime informational panels need runtime contrast verification.

The shell is dark-compatible; the complete report-authoring and preview experience is not uniformly dark-themed.

## 16. Advanced Reports

Advanced Reports is an expandable section inside the primary Reports Centre. It contains:

- Executive Summary
- Ledger Pack
- Document Pack
- Evidence Pack
- Client Report
- Internal Report — Unavailable

Five of these overlap primary selector choices. They expose older or more specialised controls, including GPT narrative polish and prompt/paste workflows.

### UX impact

- Users cannot tell whether Advanced Reports are superior, legacy, more detailed, or simply alternative entry points.
- Duplicate labels imply duplicate deliverables but may use different generation paths.
- Advanced Reports is placed after potentially very long previews, making it difficult to discover deliberately but easy to encounter accidentally during scrolling.
- The unavailable Internal Report creates expectation without providing a workflow.
- The section expands the responsibility and size of `CaseDetail.jsx`.

Direction: explicitly classify this as legacy/specialist tooling during redesign and map each advanced entry to its primary equivalent before deciding what remains.

## 17. Print Pack

Print Pack is a separate top-level case workspace, not an output from the Reports Centre. It provides:

- Internal View
- Client Report
- Lawyer Pack — Unavailable
- Print / Save PDF

### Strengths

- Clear printable page styling.
- Simple mode selector.
- Direct print action.
- Internal view includes summary, core position, chains, context, gaps, and next steps.

### Weaknesses

- It competes with Management Report, Client Report, Investigation Report, and report-level Print actions.
- The term “Pack” does not explain that this is a composed browser-print view.
- The unavailable Lawyer Pack occupies primary navigation space.
- There is no visible relationship between the selected Reports Centre report and Print Pack.
- Users may reasonably expect attachments or multiple reports to be bundled; the UI does not clarify inclusion.
- There is no preserved “what was printed/sent” snapshot.

## 18. Issue / Sequence Group workflow

The Reports Centre still exposes “Sequence Group” throughout scope controls and empty states, while the product now uses stable Issues with references such as `ISS-003 — Heating Failure`.

Current workflow:

1. Select a report.
2. Select Sequence Group scope if supported.
3. Choose a group name from a select.
4. Generate the scoped preview.
5. Optionally open Sequence Group Audit.

UX issues:

- Legacy terminology leaks into ordinary use.
- The select lacks human Issue reference, status, priority, record count, and description.
- Report scope appears name-based to the user even where stable identity exists internally.
- Empty metadata-only Issues are valid but can resemble failures.
- Issue Audit navigation is placed among output formats.

The future UX should say “Issue” and display stable human reference plus name while preserving internal compatibility.

## 19. Legacy paths and technical debt

### Duplicate or overlapping paths

- Primary Management Report versus Advanced Executive Summary.
- Primary Evidence Pack versus Advanced Evidence Pack.
- Primary Document Pack versus Advanced Document Pack.
- Primary Ledger Pack versus Advanced Ledger Pack.
- Primary Client Report versus Advanced Client Report versus Print Pack Client Report.
- Primary Investigation Report versus Print Pack Internal View for broad case explanation.
- Case Audit versus Sequence Group Audit entry shown on every report.

### Legacy/bespoke builders

- Management Report uses Executive Summary legacy structures.
- Investigation switches between Thread Issue and Case Bundle builders.
- Client Report uses prompt/paste/parser persistence.
- Action Plan uses an inline renderer.

### Placeholder/unavailable features

- Internal Report — Unavailable.
- Lawyer Pack — Unavailable.

### Source organisation debt affecting UX

- Report state, selection, output orchestration, prompt flow, Advanced Reports, bespoke renderers, and Print Pack remain embedded in `CaseDetail.jsx`.
- Capability definitions are authoritative, but selector cards consume only labels and descriptions.
- Advanced Reports does not derive its inventory from definitions.
- Output actions and navigation are mixed in one column.
- Generation/provenance behaviour differs according to implementation generation rather than user-facing report category.

## 20. Prioritised UX findings

### Critical

No critical issue was verified that prevents all report generation or creates an inherently destructive action. This audit did not assess report correctness or confidentiality filtering.

### High

| ID | Problem | Impact | Suggested direction |
|---|---|---|---|
| H1 | Flat list of ten equally weighted reports | First-time users cannot confidently choose a report | Establish explicit user-facing categories and recommended purposes |
| H2 | Three overlapping report surfaces | Users may generate different outputs for the same apparent goal | Define one primary workflow and label legacy/specialist destinations |
| H3 | Audience and AI policy are stored but hidden | Users may share an internal or AI-authored output inappropriately | Show audience, internal/external intent, and AI involvement before generation |
| H4 | Client Report is a complex AI authoring workflow inside normal preview | Selection, generation, verification, and persistence are conflated | Treat it as a clearly staged specialist workflow |
| H5 | “Sequence Group” remains in ordinary report scope | Users must understand legacy implementation language | Present stable Issue reference and name; retain compatibility internally |

### Medium

| ID | Problem | Impact | Suggested direction |
|---|---|---|---|
| M1 | Scope is visually presented before report selection | Decision order feels backwards | Let report purpose lead, then expose applicable scope |
| M2 | Card metadata is available only after selection | Users must trial reports to compare them | Surface compact audience/scope/completeness/output metadata on cards |
| M3 | Output formats lack task explanations | JSON/Markdown/Print choices are unclear | Explain “share,” “edit/copy,” and “technical transfer” purposes |
| M4 | Sequence Group Audit appears as an output | Navigation and file generation are conflated | Move to an internal/advanced quality area |
| M5 | Bespoke reports lack consistent provenance | Confidence varies by implementation path | Apply a common context/provenance contract across active reports |
| M6 | Mobile page is exceptionally long | Controls and verified preview become separated | Introduce compact selection/navigation and a clear return-to-controls path |
| M7 | Dark mode is incomplete within previews and authoring | Bright/mixed surfaces reduce readability | Audit report articles and Client/Advanced/Print surfaces systematically |
| M8 | Empty states rarely link to corrective workspace | Users know what is absent but not how to resolve it | Provide contextual navigation where safe |

### Low

| ID | Problem | Impact | Suggested direction |
|---|---|---|---|
| L1 | “Preview” static tile duplicates preview heading | Adds visual noise | Use output space for meaningful action guidance |
| L2 | Capitalisation and terminology vary | Reduces polish | Standardise Report Centre, Issue, Pack, Schedule, and Print wording |
| L3 | Unavailable destinations occupy working UI | Creates false expectation | Move roadmap placeholders out of primary workflows |
| L4 | Fingerprint is truncated behind a title attribute | Full provenance is difficult on touch/keyboard | Provide accessible copy/reveal where provenance is relevant |

## 21. Capability matrix

| Report | Question answered | Audience | Scope | Outputs | Completeness | Architecture status |
|---|---|---|---|---|---|---|
| Management | What should management know and do? | Management/HR/executive | Case | Preview, Print | Summary | Active bespoke |
| Investigation | What does this investigation or Issue contain? | Investigator/adviser | Case, Issue | Preview, Print | Bounded | Active dual bespoke |
| Case Audit | What structural/data-quality problems exist? | Internal QA | Case, Issue | Preview, Print, MD, JSON | Complete for declared checks | Migrated |
| Incident Schedule | What Incidents exist and what supports them? | Investigator/adviser | Case, Issue | Preview, Print, MD, JSON | Complete | Migrated |
| Chronology | What happened over time? | Investigator/external reader | Case, Issue | Preview, Print, MD, JSON | Complete | Migrated |
| Evidence Pack | What Evidence exists and how is it connected? | Investigator/adviser | Case, Issue | Preview, Print, MD, JSON | Complete | Migrated |
| Document Pack | What Documents exist and how are they connected? | Investigator/disclosure reader | Case, Issue | Preview, Print, MD, JSON | Complete | Migrated |
| Ledger Pack | What financial/measurable records exist? | Investigator/finance reader | Case, Issue | Preview, Print, MD, JSON | Complete | Migrated |
| Client Report | How can the case be explained to the client? | Client/case owner | Case | Preview, Print | Summary | Active AI-assisted bespoke |
| Action Plan | What needs to happen next? | Internal manager/owner | Case, Issue | Preview, Print, MD | Summary | Active bespoke |
| Sequence Group Audit | What is weak or incomplete in one/all groups? | Internal QA/GPT workflow | Group/all | JSON, MD, Print variants | Technical audit | Separate advanced workflow |
| Print Pack Internal View | What printable internal case overview exists? | Internal reader | Case | Print/PDF | Summary/bespoke | Separate legacy surface |

## 22. Conceptual wireframe proposal

This is an information-architecture proposal, not a visual redesign specification.

```text
REPORTS CENTRE

Choose the outcome you need

PRIMARY REPORTS
  Management Report
    For: manager / HR / executive
    Answers: what matters, risks, decisions, next actions

  Investigation Report
    For: investigator / adviser
    Answers: what the investigation or selected Issue shows

  Client Report
    For: client / case owner
    AI-assisted; requires review

SUPPORTING SCHEDULES
  Incident Schedule
  Chronology Report
  Evidence Pack
  Document Pack
  Ledger Pack

INTERNAL QUALITY
  Case Audit Report
  Issue Audit (advanced)

OPERATIONAL
  Action Plan

ADVANCED / LEGACY
  Print Pack
  Specialist GPT narrative tools
  Technical exports

SELECTED REPORT
  Purpose | Audience | Completeness | AI policy
  Scope: Whole Case / Issue
  Issue: ISS-### — Name
  Includes | Outputs | Generated | Source revision

  [Preview]

  SHARE / OUTPUT
  Print / Save PDF
  Copy or Download Markdown
  Download technical JSON
```

## 23. Recommended development order

### Phase 1 — Clarify without changing builders

- Define explicit report categories and primary audiences.
- Add audience, completeness, scope, outputs, and AI-policy cues to selector data.
- Standardise Issue terminology and human Issue labels.
- Separate report outputs from audit/navigation actions.
- Remove unavailable destinations from primary decision paths while retaining them in source.

Completion criterion: a first-time user can choose a suitable report from the selector without opening multiple previews.

### Phase 2 — Consolidate navigation

- Establish the primary Reports Centre as the default entry.
- Map every Advanced and Print Pack entry to its equivalent or distinct user goal.
- Label retained specialist/legacy tools explicitly.
- Provide a return-to-controls/selected-report navigation pattern for long previews.

Completion criterion: every report goal has one obvious primary entry point.

### Phase 3 — Standardise context and outputs

- Apply consistent audience, completeness, AI involvement, generation time, and source-revision presentation.
- Explain output formats by task.
- Standardise empty-state structure and corrective navigation.
- Clarify browser Print/PDF versus Markdown/JSON transfer.

Completion criterion: users can understand what will be shared before activating an output.

### Phase 4 — Accessibility, responsive, and dark-mode verification

- Test keyboard and screen-reader flow in a browser.
- Test 1440, 1024, 768, and approximately 390 px.
- Audit tables and long Issue names for overflow.
- Complete dark-mode coverage for all preview/authoring surfaces.
- Test print preview separately from dark application presentation.

Completion criterion: no blocked keyboard workflow, horizontal page overflow, clipped actions, or unreadable mixed-theme surface.

### Phase 5 — Architectural convergence after UX parity

- Migrate remaining bespoke reports only where the agreed UX requires common provenance/outputs.
- Extract report orchestration from `CaseDetail.jsx` incrementally.
- Retire duplicate Advanced/Print paths only after capability and user-workflow parity.

Completion criterion: architectural simplification does not remove a distinct user capability.

## 24. Validation

- No application source file was modified by this audit.
- No report builder or definition was changed.
- No files were staged.
- No commit was created.
- Nothing was pushed.
- The only audit-created file is `PROVEIT_REPORTS_CENTRE_AUDIT.md`.

### Runtime limitation

Interactive browser tooling was unavailable. Responsive, focus, contrast, scrolling, and print-preview assessments are therefore based on active source inspection and existing rendered tests. A future redesign phase should begin with runtime walkthroughs using populated and empty cases at desktop and mobile widths.
