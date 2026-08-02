# ProveIt — Full Case Workflow and User-Experience Audit

**Audit date:** 2 August 2026  
**Repository:** `C:\Users\roryr\Desktop\Apps\toolstack-prove-it`  
**Audited commit:** `728f44489de3122033791090ab29057d481b3de6`  
**Purpose:** user workflow, investigation process, case management, communication, sharing, and recovery effectiveness

## Evidence and recommendation labels

- **Verified behaviour** — confirmed through an active render/import path, automated behavior test, or build output.
- **Source inference** — strongly supported by active source but not exercised in a current interactive browser session.
- **UX recommendation** — a proposed user-facing improvement; not current behavior.
- **Architecture recommendation** — a technical prerequisite or structural direction; not current behavior.

No private case data was inspected. Persona walkthroughs use generic representative examples. No production code, schema, report implementation, or test was changed.

## Table of contents

1. [Audit conclusion](#1-audit-conclusion)
2. [Repository and validation baseline](#2-repository-and-validation-baseline)
3. [User perspectives](#3-user-perspectives)
4. [Current end-to-end workflow](#4-current-end-to-end-workflow)
5. [New-case onboarding](#5-new-case-onboarding)
6. [Capture workflow](#6-capture-workflow)
7. [Record-type decisions](#7-record-type-decisions)
8. [Incomplete, uncertain, and conflicting information](#8-incomplete-uncertain-and-conflicting-information)
9. [Party workflow](#9-party-workflow)
10. [Attachments and evidence collection](#10-attachments-and-evidence-collection)
11. [Linking workflow](#11-linking-workflow)
12. [Sequence Group workflow](#12-sequence-group-workflow)
13. [Investigation workflow](#13-investigation-workflow)
14. [Chronology workflow](#14-chronology-workflow)
15. [Strategy and actions](#15-strategy-and-actions)
16. [To Watch workflow](#16-to-watch-workflow)
17. [Overview and daily return](#17-overview-and-daily-return)
18. [Reports as communication tools](#18-reports-as-communication-tools)
19. [Issue Report gap](#19-issue-report-gap)
20. [External sharing](#20-external-sharing)
21. [Backup and recovery](#21-backup-and-recovery)
22. [Search and retrieval](#22-search-and-retrieval)
23. [Error recovery and confidence](#23-error-recovery-and-confidence)
24. [Terminology](#24-terminology)
25. [Workflow duplication map](#25-workflow-duplication-map)
26. [Friction log](#26-friction-log)
27. [Investigative workflow maturity](#27-investigative-workflow-maturity)
28. [Persona walkthroughs](#28-persona-walkthroughs)
29. [Minimum viable workflow improvements](#29-minimum-viable-workflow-improvements)
30. [Nested Issue decision](#30-nested-issue-decision)
31. [Workflow-led roadmap](#31-workflow-led-roadmap)
32. [Final recommendation](#32-final-recommendation)
33. [Files changed](#33-files-changed)
34. [Validation](#34-validation)

## 1. Audit conclusion

ProveIt supports every broad stage in the intended chain—Capture, Organise, Investigate, Connect, Assess, Plan, Monitor, Report, Share, Preserve—but those stages do not yet operate as one coherent case workflow.

Its strongest experience begins after a knowledgeable user has already created well-classified records. Incident and Evidence workspaces, Sequence Group management, chronology, deterministic schedules, diagnostics, Strategy, Watch, and backups provide substantial capability. Its weakest experience is deciding what to create, understanding the next action, resolving a diagnostic finding, preparing one defensible Issue briefing, and preserving exactly what was shared.

The product currently behaves as both an investigation workspace and a sophisticated local database. It behaves like a workspace when it recommends a next action, identifies unsupported incidents, builds chronology, scopes records by group, or turns Watch observations into an Incident or Strategy. It behaves like a database when the user must choose among overlapping record types, manage raw relationship concepts, understand direct versus linked scope, choose among many exports, or infer whether a report is complete, importable, binary-inclusive, current, or AI-authored.

The central workflow failure is the absence of one visible loop:

```text
Active Issue
→ Important finding
→ Open affected record
→ Correct, link, verify, or plan
→ Mark addressed
→ See refreshed Issue status
→ Publish a reviewed Issue Report
```

Before hierarchy, ProveIt needs a daily attention view, clearer record-type guidance, stable flat Issue identity, minimal Issue metadata, audit-to-record correction, one primary Issue Report, and a safe finalization/share workflow.

## 2. Repository and validation baseline

| Item | Baseline result |
|---|---|
| Repository | `C:\Users\roryr\Desktop\Apps\toolstack-prove-it` |
| Branch | `main`, tracking `origin/main` |
| Commit | `728f44489de3122033791090ab29057d481b3de6` |
| Compared with prior technical audit | Same commit, not later |
| Initial working tree | `?? PROVEIT_CURRENT_STATE_AUDIT.md` only |
| Technical audit | Exists at repository root; 56,780 bytes at baseline |
| Initial tests | 758 passed, 0 failed, 0 skipped |
| Initial lint | Passed |
| Initial build | Passed in 1.79 seconds; 1,861 modules transformed |
| Main JavaScript bundle | 1,505.81 kB raw / 350.97 kB gzip |
| Build warning | Chunk larger than 500 kB |
| Initial `git diff --check` | Passed |

The existing technical audit was not modified. It was already untracked when this workflow audit began.

## 3. User perspectives

### Case owner

The case owner receives usable templates, accessible create buttons, permissive forms, attachments, a recommended Overview action, and client-facing output. They are least supported when deciding whether something is an Incident, Evidence, Document, Record, Strategy, or Watch Item. Technical terms such as Sequence Group, reasoning snapshot, GPT Delta, and audit pack impose unnecessary learning.

### Investigator

The investigator is the best-served persona. Incident/evidence linking, evidence coverage, chronology, Case Audit, schedules, weak-link packs, unresolved references, and group audits expose meaningful gaps. The weakness is follow-through: findings are spread among screens and cannot generally be assigned, dismissed, marked resolved, or reviewed as one queue.

### Case manager

The manager has Strategy, Action Summary, deadlines, Watch reviews, diagnostics, backup status, and reports. These controls overlap. There is no single authoritative “work due now” view or clean relationship between an Issue, its Strategy, and today's next action.

### External reader

The reader can receive polished reports and complete schedules but cannot interact with ProveIt context. Schedules are traceable and deterministic; the primary narrative reports are bounded or AI-assisted. No single report reliably answers “What is this Issue, what happened, what supports it, what remains disputed, and what happens next?”

### Future returning user

Case Briefing, recent timestamps, Overview recommendations, Strategy reviews, and Watch reviews help. However, the user cannot reliably see what changed since the last session, which Issues are active, which report is stale, what they were last doing, or one ranked list of attention items.

## 4. Current end-to-end workflow

### Verified current-state workflow

```text
Dashboard
├─ Create case from starter type or custom form
├─ Optionally create/select folder
└─ Open case
    ↓
Overview
├─ Read case health and recommended next action
├─ Add Party / Incident / Evidence / Document / Ledger
└─ Open one of 13 workspace selectors
    ↓
Capture
├─ Add typed record
├─ Add attachments and source/detail fields
├─ Link parties and selected record types
└─ Optionally assign Sequence Group
    ↓
Organise / Connect
├─ Use individual editors
└─ Use Sequence Group Manager for bulk assignment/move/split/merge
    ↓
Investigate / Assess
├─ Workspace metrics and missing-data filters
├─ Timeline / Narrative
├─ Diagnostics / Case Audit / Sequence Group Audit
└─ Incident Schedule / Chronology / Evidence Pack
    ↓
Plan / Monitor
├─ Strategy records
├─ Case Briefing / Action Summary
├─ Action Plan report
└─ To Watch observations and conversions
    ↓
Report / Share
├─ Report Centre
├─ Print Pack and Sequence Group exports
├─ Markdown / JSON / browser print
└─ AI packages and GPT-assisted prose
    ↓
Preserve
├─ Full App or Case Backup
├─ Rescue Snapshot
└─ Import / restore
```

The apparent intended order is Parties → Incidents → Evidence/Documents → links/groups → Strategy/Watch → diagnostics/timeline → reports. The actual application permits almost every stage to be skipped. That flexibility is useful for experienced investigators but weakens onboarding and data quality.

Alternative entry points exist through every workspace, conversions, the Overview buttons, Sequence Group Manager, AI Workspace, GPT Update, floating Tools, and dashboard export/import. These become disconnected when a task started in one area has no guided continuation in another.

## 5. New-case onboarding

Verified positive behavior:

- Dashboard contains three introductory steps: create a case, add core records, build the timeline.
- Starter case choices cover general, personal, work, housing, and custom matters.
- Case creation accepts name, category, description, notes, and later folder placement.
- Empty dashboard clearly offers first-case creation.
- Overview recommends Add Party, Add Incident, supporting evidence, Timeline, or Reports based on current state.
- Overview exposes direct buttons for Party, Incident, Evidence, Document, and Ledger.
- Incident and Evidence empty states contain useful calls to action.

Workflow gaps:

- Folder placement is not part of the create-case flow; it is a separate dashboard organization step.
- Starter types do not establish a guided checklist or explain record choices after creation.
- The Overview includes “Progress,” “Case health,” “Current phase,” and “Recent activity” placeholders, weakening trust in the first screen.
- The recommended action is rule-based but does not explain why this order is important or allow dismissal.
- Creating the first Sequence Group is not part of basic onboarding, despite groups driving issue-scoped reports.
- Linking is introduced inside editors rather than as an onboarding milestone.
- A user can add Evidence before an Incident or a Strategy before any Issue without an explanatory warning.
- First-time success still depends on learning internal nouns.

Folders add value for a user with several cases, but little value during the first case. Folder color and description are organizational metadata, not workflow behavior.

**UX recommendation:** retain flexible entry, but give an empty case a six-step “Start this case” checklist: purpose, Parties, first event, supporting source, Issue, next action. Each step should open the existing workspace rather than introduce a new wizard.

## 6. Capture workflow

| Capture type | Quick incomplete capture | Source/uncertainty support | Continue later | Mobile/source assessment |
|---|---|---|---|---|
| Incident | Yes; permissive fields | Free text, status, evidence status, links | Yes | Usable but long modal on mobile |
| Evidence | Yes | source/type/role/status/review notes | Yes | Stronger structure; attachment-heavy |
| Document | Yes | source, category, date, summary, text | Yes | Distinction from Evidence unclear |
| Tracking Record | Yes, but structured marker/text | record metadata embedded in document text | Yes | Advanced and form-heavy |
| Ledger | Yes | proof status/type and notes | Yes | Good for money; confusing for status notes |
| Strategy | Yes | assumptions/risks/decision status | Yes | Too detailed for a simple task |
| Watch Item | Yes | explicitly described as uncertain/developing | Yes | Strong uncertainty entry point |
| Party | Yes | roles/status/confidentiality | Yes | Separate workspace/modal context |

Event dates and created/updated timestamps are distinct in the stored model, which is valuable. The UI does not consistently explain “when it happened” versus “when you entered it.” Uncertain dates generally become blank/free text rather than a clearly communicated approximate date.

Attachments can be added while editing records. Users may need to leave context to create a Party, and the generic link selectors require existing targets. Incident-to-Evidence creation/conversion helps in some paths but is not a universal “add supporting material here” flow.

Quick Capture remains persisted but its UI is disabled. Disabling it removed duplicated capture/review concepts and avoids another queue that users must process. It also removed the only obvious low-friction inbox for information that cannot yet be classified. The right near-term answer is not simply re-enable the old queue; provide a lightweight “capture now, classify later” entry only if real mobile/interrupt-driven use demonstrates the need, and make ownership of that queue explicit.

## 7. Record-type decisions

### Current user-facing meanings

| Type | Meaning based on active behavior |
|---|---|
| Incident | An event or occurrence: what happened, when, and who/what it connects to |
| Evidence | Material or observation used to support, corroborate, or contextualize an Incident |
| Document | A source file or captured text such as a letter, email, notice, PDF, or screenshot |
| Tracking Record | A structured table/status record stored as a special Document |
| Ledger Entry | A payment, expected/paid amount, financial obligation, or measurable/status entry |
| Strategy | An intended approach, decision, rationale, risk, desired outcome, and next steps |
| Watch Item | An uncertain or developing concern monitored without treating it as a confirmed Incident |
| Party | A person or organization involved in the case |

### Likely confusion

- **Incident versus Evidence:** the conceptual distinction is sound—event versus support—but forms allow overlapping descriptions, dates, links, and attachments. Users need a one-sentence choice at creation.
- **Evidence versus Document:** a document can plainly be evidential. ProveIt treats Document as source/reference material and Evidence as an interpreted proof item, but this rule is not consistently explicit. A common workflow should be “store source Document, then create/link an Evidence assessment when its significance matters.”
- **Document versus Tracking Record:** the marker-based subtype is an implementation detail. The Records workspace makes it look distinct while storage and editing route through Documents. Users cannot be expected to understand that distinction.
- **Strategy versus Action Summary:** Strategy is issue-oriented planning; Action Summary is case-level immediate work. Both contain next steps, reminders, deadlines, and focus, with no authoritative handoff.
- **Watch versus Strategy:** Watch is for an uncertain/developing matter; Strategy is for an intended response. The Watch editor communicates this well, but conversion and escalation rules are not summarized elsewhere.
- **Ledger versus Tracking Record:** money belongs naturally in Ledger. Tracking Records can hold arbitrary status tables, including financial provenance, creating overlap.

**UX recommendation:** add a persistent “Which record should I add?” guide with short examples and two key distinctions: event versus support, and source Document versus interpreted Evidence. Hide the marker implementation behind the visible label “Tracking Record.”

## 8. Incomplete, uncertain, and conflicting information

| Concept | Current representation | Communication risk |
|---|---|---|
| Allegation | Incident description/notes/status or Watch | Can look like a recorded fact in schedules |
| Personal recollection | source/notes | No consistent visible provenance label |
| Confirmed fact | Evidence verified status/function summary | “Verified” lacks verifier/method/date structure |
| Disputed statement | notes/tags/status | No first-class disputed assertion |
| Conflicting accounts | Separate records and links/free text | No contradiction relationship or side-by-side review |
| Incomplete evidence | Evidence `incomplete`/`needs_review` | Supported reasonably |
| Uncertain date | blank/malformed date or notes | Chronology may simply place it in undated/malformed sections |
| Missing response | Watch, Strategy, or notes | No consistent pending-response workflow |
| Unavailable document | Document metadata or Evidence availability | Supported, but depends on careful entry |
| Corrected fact | edit plus audit log in some operations | No visible correction/supersession chain |
| Unknown authenticity | Evidence status/review notes | Possible but not consistently communicated in reports |
| Hearsay | source/notes/tags | No structured, visible treatment |
| Strategy assumption | `assumptions[]` | Supported well within Strategy |

The greatest workflow risk is that an Incident title/description is rendered in timelines and reports with the same visual confidence whether it is alleged, remembered, disputed, or corroborated. Watch correctly avoids treating developing matters as confirmed Incidents, but once converted, the distinction relies on retained notes.

**UX recommendation:** without changing schema, establish display conventions now: show source and evidence status beside Incident statements; use explicit “recorded account,” “unverified,” “disputed,” and “corroborated” wording; never translate record existence into factual certainty.

## 9. Party workflow

Parties can be created in the Parties workspace, searched and filtered, and linked from Incident, Evidence, Document, Ledger, Strategy, and Watch workflows. Reports resolve linked party names. Missing party references appear in diagnostics or missing-link UI, and deleting a Party cleans known `linkedPartyIds` and ownership references through general cleanup.

Friction:

- Record editors generally require the Party to exist first.
- No inline quick-create is available from a relationship selector.
- Duplicate name/contact detection and merge are absent.
- A person can have multiple case-wide roles, but role by Issue or Incident is not modeled.
- Confidentiality is descriptive and does not alter cards, reports, or exports consistently.
- A Party overview does not provide one complete narrative of involvement across the case.

Parties should be created when identity becomes relevant, not forced before every record. The least disruptive improvement is inline “Add Party” from existing selectors, followed by automatic selection and return to the unsaved record. Retain the Parties workspace for full details and duplicate review.

## 10. Attachments and evidence collection

Users can attach files during capture, preview supported images/PDFs, download originals, view email metadata, and run attachment-integrity diagnostics. Full Backup can embed and restore binaries. Large files produce warnings, and missing payloads/orphans can be detected.

Answers currently depend on the following:

| User question | Current source |
|---|---|
| What is this file? | filename, MIME type, record title/summary |
| Where did it come from? | Document/Evidence source or free text |
| When received? | document/capture/event date or notes; inconsistent |
| What does it demonstrate? | Evidence `functionSummary`; absent from a plain Document |
| Which Incident does it support? | incident/evidence/generic links |
| Reviewed or verified? | Evidence status/review notes; not plain Document |
| Is original still available? | Evidence availability and attachment integrity |

The core workflow ambiguity is whether a file should be a Document or Evidence. A defensible user rule is: Document records the source and its text; Evidence records the assessed role or significance of material. ProveIt currently allows both direct attachment and duplicate representation, so disciplined linking is required.

Missing workflow features include duplicate-file detection, a received-date convention, visible provenance chain, one-click navigation from attachment to every supported Incident, and clear missing-binary repair guidance.

## 11. Linking workflow

Users create links in record editors and see many links on cards. Incident/Evidence links are treated specially and reverse context is derived. Documents, Strategy, Watch, Ledger, Parties, tracking provenance, outcomes, causal Incident references, and generic supporting links use different controls and labels.

Strengths:

- Existing relationships are commonly shown before or during edit.
- IDs are deduplicated during normalization.
- Deleted targets are cleaned from known fields.
- Missing references appear in cards, diagnostics, and reports.
- Incident links include “Caused by” and “Outcomes.”

Friction:

- “Linked record” and “supporting link” do not state meaning.
- The same pair can appear through typed and generic arrays.
- Reverse links are derived differently by workspace.
- Users cannot always tell whether a link means supports, merely relates, or is based on.
- Cross-group links may appear as diagnostics despite being legitimate context.
- There is no unified relationship review or contradiction link.

One user-facing vocabulary is warranted:

```text
Supports
Contradicts
Relates to
Caused by
Outcome of
Involves
Based on
```

This can first be introduced as presentation guidance over current fields. A persisted typed-edge model is a later architecture prerequisite, not necessary for the first wording improvement.

## 12. Sequence Group workflow

Lifecycle support:

1. Recognition: records expose group fields, but the application does not teach when an Issue has emerged.
2. Creation: active manager/form supports name and description.
3. Assignment: individual editors and bulk record manager.
4. Ongoing capture: users can select existing names or create a new group in some editors.
5. Review: counts, filters, relationship/timeline views, audits, and reports.
6. Maintenance: move, remove, split, merge, rename, and delete.
7. Communication: group-scoped reports and exports.
8. Closure: no group-level status/archive workflow.

The manager is capable but oriented toward advanced administration. Daily users must understand that “Sequence Group” is the product's de facto Issue. Names may describe a topic, chronology, allegation, or outcome with no guidance. Description alone cannot express status, priority, owner, review date, reporting period, or current position.

Metadata-only groups are valid but can look like empty/broken Issues. Rename appears available and tested, yet it remains a high-anxiety operation because the visible name is also the identifier across records, metadata, reports, imports, and exports.

Current need, in order:

1. Stable IDs.
2. Rename the user concept to **Issue** while retaining “Sequence Group” internally during compatibility.
3. Minimal Issue metadata.
4. Better Issue summary/reporting.
5. Optional categories or tags if case scale requires them.
6. Hierarchy only after demonstrated need.

## 13. Investigation workflow

ProveIt does more than store records. It can identify unsupported Incidents, unused or weak Evidence, missing function summaries, missing dates, malformed chronology, unresolved links and parties, duplicate-title suspicion, attachment faults, ungrouped records, cross-group links, Strategy/Watch completeness, and report staleness in selected paths.

The active investigation tools include Case Audit, Sequence Group Audit, dashboard/case diagnostics, operational integrity, Incident Schedule, Chronology, Evidence Pack, workspace metrics, and specialized AI audit packs.

What works:

- Unsupported Incidents and unlinked Evidence are visible.
- Missing and malformed dates are identified.
- Weak Evidence and unresolved references are classified.
- Findings have severity and, in some operational paths, navigation targets.
- Complete deterministic schedules can be regenerated after correction.

What is missing:

- Contradictions are not detected as a first-class relationship or finding.
- Central-party analysis is not a primary view.
- “Strongest evidence” is partially inferred through evidence role/function summary, not one defensible ranking.
- Navigation from every report/audit finding to edit is not consistent.
- Findings cannot generally be assigned, dismissed with reason, or marked reviewed/resolved.
- Warnings and errors are spread across Overview, workspace metrics, Diagnostics, Case Audit, group audits, Action Plan, and AI packs.
- Re-running an audit changes the output but does not preserve finding-resolution history.

Current loop:

```text
Finding → sometimes open workspace/record → edit → rerun manually
```

Required loop:

```text
Finding → open exact record and field → correct/link/add
→ mark addressed or accepted → rerun → retain resolution evidence
```

## 14. Chronology workflow

Timeline is operational; Chronology Report is communicative. This is a useful distinction and both should remain.

- Timeline combines active record types, supports filters, milestones, group filtering, and navigation-oriented viewing.
- Chronology Report provides deterministic ordering, complete scoped output, malformed/missing-date sections, provenance, and export/print.
- Incident and Evidence ordering prioritizes normalized event dates.
- Created/updated timestamps exist but are not consistently displayed beside event dates.
- Undated records are visible but correction is not always one click from the report.
- Issue-scoped chronology uses direct membership; linked external context may appear elsewhere, requiring scope explanation.

Timeline often lists rather than explains. Narrative supplies incident-anchored storytelling, but its strength depends on links and function summaries. Users may not know why a document date, payment date, event date, or creation date was selected.

**UX recommendation:** retain Timeline for working the case and Chronology Report for communicating it. Label each date basis, provide direct “Fix date” navigation, and visually distinguish event date from entered/updated time.

## 15. Strategy and actions

Planning currently spans:

- Strategy record objective, rationale, outcome, decision, assumptions, risks, owner, review date, and next steps.
- Case Briefing/Action Summary current focus, next actions, reminders, strategy focus, and critical deadlines.
- Quick action entry and completion history.
- Action Plan report recommendations and diagnostics.
- Watch next check/review/escalation.
- Legacy `tasks[]`, which is persisted but has no active workspace.

The user can add a simple next action quickly in Case Briefing, but issue-specific work belongs more naturally in Strategy. A Strategy may be too complex for “call landlord tomorrow.” Actions in one place are not automatically reflected in the other. Overdue Strategy and Watch reviews are derivable but not presented as one daily queue. Completed briefing actions remain visible, which is useful, but lack Issue context.

Recommended single workflow:

```text
Issue
→ Strategy: intended approach and desired outcome
→ Next Action: concrete owned step
→ Reminder/Deadline: when it needs attention
→ Completion: immutable completion time
→ Review: decide next action or close/revise Strategy
```

Case Briefing should aggregate next actions from Issues/Strategies and allow truly case-wide tasks. It should not be a competing action database. Legacy `tasks[]` should not be revived without a clear migration/product decision.

## 16. To Watch workflow

Watch is one of the clearest specialized workflows. The editor explicitly says it records an uncertain or developing matter without treating it as a confirmed Incident. It supports focus, rationale, triggers, observations, review date, priority, next check, outcome, parties, records, and status.

It can convert/escalate to an Incident or Strategy while retaining a link and cautionary note. Observation history provides a useful longitudinal record. Resolved/archive states remain available for reports under report-specific policies.

Remaining gaps:

- Review dates do not create a unified due-action queue.
- `latestObservation` overlaps observation history.
- Escalation criteria are free text and status rather than a guided decision.
- Conversion does not lead the user through verification of the new Incident date/statement.
- Watch is group-linked but not presented as part of one Issue lifecycle.

Use Watch when something may become important but is not yet a confirmed event or chosen response. Use Incident when an event/account must be recorded; use Strategy when a response has been selected.

## 17. Overview and daily return

The Overview and Case Briefing currently provide case identity, broad health, counts, operational loops, current focus, active/completed actions, reminders, deadlines, Strategy focus, a recommended action, and direct add buttons.

They do not reliably answer all return questions:

| Return question | Current support |
|---|---|
| What changed recently? | Partial; timestamps and placeholder recent activity |
| Which records were added? | Not one visible feed |
| Which Issues are active? | No Issue status model |
| Which actions are overdue? | Partial, distributed |
| Which Watch reviews are due? | Derivable, not one daily list |
| Which evidence/links are missing? | Yes, but spread across metrics/audits |
| Which reports are stale? | Partial operational integrity, not Report Centre-wide |
| What was I doing last? | Selected tab persists; no last-work context |
| What should happen next? | One recommended action plus briefing actions |

Placeholder panels reduce the credibility of the most important return screen. Technical diagnostics compete with actionable work. Metrics are repeated across Overview, workspace summaries, audits, and reports.

Minimum useful return dashboard:

1. Current focus and last meaningful activity.
2. Active Issues with status/owner/next review.
3. Due and overdue actions/Watch reviews.
4. Top unresolved integrity findings with direct Fix links.
5. Recent additions/changes.
6. Stale draft reports.

## 18. Reports as communication tools

| Report | Question/audience | Communication assessment | Classification |
|---|---|---|---|
| Management Report | What matters, risks, and actions? Managers/HR/executives | Useful summary; bounded timeline; optional AI polish needs provenance | Primary communication report |
| Investigation Report | What does this case/thread contain? Investigator/adviser | Group mode explains a thread; whole case is explicitly bounded | Primary but bounded communication report |
| Case Audit | Is structured data complete and coherent? Internal investigator/manager | Strong, deterministic, technical; not an external merits report | Internal audit |
| Incident Schedule | What Incidents exist and what supports them? Investigator/adviser | Complete, traceable, understandable as a schedule | Supporting schedule |
| Chronology Report | What happened over time? Broad external/internal reader | Complete and useful; explains order more than significance | Supporting schedule |
| Evidence Pack | What Evidence exists and what does it support? Investigator/adviser | Strong matrix; needs source files separately | Supporting schedule |
| Document Pack | What source Documents exist? Investigator/adviser | Useful index/reference; does not itself establish significance | Supporting schedule |
| Ledger Pack | What payments/amounts/status entries exist? Adviser/manager | Useful if entries are disciplined; mixed status notes need explanation | Supporting schedule |
| Client Report | How can the case be explained to the affected person? Case owner/client | Readable, but GPT paste workflow risks unverified prose | Primary draft communication report |
| Action Plan | What should happen next? Case owner/manager | Useful internal plan; deterministic but duplicated with briefing/Strategy | Internal planning |
| Sequence Group exports | What is in one/all groups? Advanced investigator/GPT | Technical and audit-oriented | Technical export/internal audit |
| Print Pack | Combined printable material | Useful packaging but overlaps Report Centre and unavailable Lawyer view | Legacy/aggregate output |

Schedules and migrated packs expose completeness and provenance well. Management/Investigation/Client reports carry more explanatory value but also more bounding or AI risk. No single active report is a complete, reviewed Issue briefing for an external reader.

An external reader can trace many rows to IDs/titles but cannot open ProveIt links. Some outputs contain technical IDs and diagnostics that are useful internally but excessive externally. Attachments are generally not embedded in reports, and that exclusion must be explicit at finalization.

## 19. Issue Report gap

| Proposed section | Classification | Reason |
|---|---|---|
| Issue name | Deterministic now | Current group label |
| Purpose | Requires Issue metadata | Description is optional and not clearly purpose |
| Executive summary | Requires user approval | Can be assembled, but synthesis must be reviewed |
| Current status | Requires Issue metadata | No group status |
| Priority | Requires Issue metadata | No group priority |
| Owner | Requires Issue metadata | No group owner |
| Reporting period | Requires Issue metadata | Can derive range, but publication period is an authored choice |
| People involved | Deterministic now | Resolve linked parties from scoped records |
| Narrative chronology | Requires user approval | Facts/order deterministic; narrative emphasis is editorial |
| Evidence map | Deterministic now | Direct and linked structured records |
| What records show | Requires user approval | Function summaries help; conclusion still editorial |
| Outstanding issues | Requires user approval | Diagnostics and actions can seed it |
| Current position | Requires Issue metadata and approval | Must be authored/maintained |
| Next actions | Deterministic now if linked | Strategy/briefing actions exist, but Issue association is incomplete |
| Appendices | Deterministic now | Schedules and record references |
| Credibility/legal conclusion | Unsafe automatically | Requires human professional judgment |

Minimum Issue metadata:

```text
stable ID
name
purpose
status
priority
owner
review date
current position
optional category/tags
```

Minimum viable Issue Report:

1. Authored Issue header and current position.
2. Deterministic people and direct record inventory.
3. Deterministic chronology with uncertainty/status labels.
4. Deterministic evidence map and gaps.
5. Reviewed outstanding matters and next actions.
6. Appendices and source fingerprint.

## 20. External sharing

Current flow:

```text
Select report and optional group scope
→ preview
→ optionally paste/polish AI prose
→ print or export Markdown/JSON where supported
→ manually share downloaded/printed file
```

Missing steps:

- No audience-driven confidentiality filter.
- No redaction/relevance review workflow.
- No report draft/final state.
- No approval identity/date.
- No immutable “sent copy” stored in the case.
- AI sections are not consistently labeled with model/prompt/revision.
- Reports and backups/AI packages appear within neighboring export/tool surfaces.
- Browser print is not always described plainly as Print/Save as PDF.
- Reproducing the exact report later is not guaranteed because generated time, case content, and AI paste can change.

Recommended safe finalization:

```text
Choose audience and Issue
→ generate deterministic draft
→ show completeness, exclusions, attachments, AI content and confidentiality
→ review/redact and verify sources
→ approve as final
→ freeze report document + fingerprint + finalization time
→ export Print/Save PDF or Markdown
→ store a metadata receipt and optional final file reference
```

## 21. Backup and recovery

Positive workflow elements:

- Dashboard recommends Full App Backup before risky actions.
- Backup recency metadata is visible.
- Full App and single-case backup are distinguished.
- Full Backup declares binary inclusion and importability.
- Rescue Snapshot is described as structural and excludes attachments.
- Import creates an emergency backup and can report partial attachment/case failures.
- Storage Diagnostics provides recovery context.

Confidence gaps:

- Users cannot inspect a friendly manifest before download.
- The backup file is not verified by rereading/checksum after creation.
- Restore does not offer a completely isolated sandbox preview.
- Merge/conflict rules are hard for nontechnical users to predict.
- Partial restoration is visible after the attempt, not prevented in advance.
- There is no guided external-storage confirmation or tested-restore record.
- Large binary backups may fail due to memory/quota without a preflight estimate.

Ideal sequence:

```text
Create Backup
→ Verify manifest/counts/attachment bytes
→ Save externally
→ record backup date and checksum
→ test restore into a temporary isolated database
→ report verified/recoverable status
```

## 22. Search and retrieval

Search is workspace-specific:

- Dashboard case search/filter/sort.
- Incident search across text, tags, parties, Evidence, Documents, and group.
- Evidence search across summaries, tags, Incidents, Parties, and group.
- Strategy, Watch, Party, and Sequence Group manager searches.
- Timeline/group filters and link navigation.

There is no one global search across all records in the selected case. Report content and attachment filenames are not offered through a central search result experience. Results do not share a stable back-stack or saved query. Search behavior and included fields vary by workspace.

Highest-value improvement: a selected-case search palette returning typed results with title, matching snippet, Issue, date, unresolved-link/attachment state, and direct open/edit action. Cross-case search should wait until local persistence/security and the single-case index are stable.

## 23. Error recovery and confidence

| Workflow | Feedback/recovery | Confidence assessment |
|---|---|---|
| Save record/case | Often closes and updates; errors mostly console/notices | Moderate; no universal saved indicator |
| Delete | Native confirmation; emergency backup for cases | High anxiety; limited undo |
| Import/restore | Guard, backup, partial summaries | Better than average but complex |
| Move/split/merge groups | Confirmations and operation summaries | Moderate; rename identity remains scary |
| Generate report | Preview and output feedback | Good for deterministic reports |
| Copy Markdown/JSON | Local feedback, clipboard failure handling varies | Moderate |
| Download | Multiple helpers; browser behavior | Moderate |
| Attachment restore | Failed item count | Useful but post-failure |
| Refresh | IndexedDB reload and rescue protection | Good safeguards, weak user-visible save state |
| PIN unlock | Explicit error/reset paths | Operationally clear, security meaning misleading |

High-anxiety workflows are import/restore, case deletion, group rename/merge/delete, attachment removal, and GPT Delta apply. Recommended safeguards are operation preview, precise affected counts, automatic recoverable snapshot, durable operation receipt, and one-click rollback where technically possible. Success messages should report what was actually persisted, not only that a handler completed.

## 24. Terminology

| Current term | User comprehension | Recommendation |
|---|---|---|
| Case | Clear | Keep |
| Folder | Clear | Keep for dashboard organization |
| Record | Generic but useful | Use only as umbrella term |
| Incident | Mostly clear | Define as event/account |
| Evidence | Familiar but authoritative | Define as material assessed for support; status uncertainty visibly |
| Document | Clear but overlaps Evidence | Define as source file/text |
| Tracking Record | Moderately technical | Keep with examples; hide marker implementation |
| Ledger | Specialist term | Label “Ledger / Payments” where appropriate |
| Strategy | Abstract | Explain as intended approach |
| To Watch | Clear | Keep; explain uncertain/developing |
| Party | Legalistic but standard | Add “People & Organisations” subtitle |
| Sequence Group | Highly technical/opaque | Display as **Issue**; retain internal compatibility |
| Sequence Group Audit | Technical | “Issue quality review” in normal UI |
| Issue | Understandable | Primary user-facing concept |
| Report | Clear | Keep |
| Pack | Ambiguous | Reserve for collections of schedules/files |
| Snapshot | Technical | “Recovery snapshot” or “AI snapshot” with purpose |
| Backup | Clear | Reserve for importable recovery |
| Export | Broad | Always add purpose and importability |
| Reasoning Package | AI jargon | “Case files for AI review” |
| GPT Delta | Implementation term | “Review and apply AI-proposed updates” |
| Diagnostics | Technical | “Case quality checks” in normal UI |
| Case Briefing | Clear | Use for daily case overview |
| Action Summary | Overlaps Case Briefing | Treat as the editable content within Case Briefing |

Vocabulary principle: user labels should describe the task; technical contract names belong in Advanced details. “Sequence Group” should become “Issue” in the interface after stable IDs exist, with temporary wording such as “Issue (Sequence Group)” during transition.

## 25. Workflow duplication map

| User goal | Current entry points | Assessment | Primary / advanced recommendation |
|---|---|---|---|
| Manage next actions | Case Briefing, Strategy next steps, Action Plan, Watch next check | Confusing overlap | Case Briefing aggregation; Strategy authoritative per Issue |
| Inspect missing links | Overview, workspace metrics, Diagnostics, Case Audit, weak-links AI pack | Excessive duplication | Case Quality primary; AI pack advanced |
| Audit one group | Manager, Sequence Group Audit modal, Case Audit group scope, AI chain packs | Different outputs but unclear | Issue page primary; technical exports advanced |
| Export case structure | reasoning exports, link map, group index, split package, full-by-groups | Primarily technical variants | AI Workspace/Advanced only |
| Generate case summary | Management, Investigation, Client, Print Pack, structure report | Audience distinctions incomplete | Reports primary with audience labels |
| Build management report | Report Centre plus AI Workspace builder/polish | Useful draft workflow but duplicated | Report Centre primary; AI handoff advanced |
| Review chronology | Timeline, Chronology Report, Narrative, Investigation Report | Legitimately distinct | Timeline operational; Chronology communicative |
| Create AI package | toolbar, AI Workspace, dashboard reasoning export, group audit exports | Confusing | AI Workspace as sole normal entry |
| View evidence coverage | Overview, Incidents, Evidence, Case Audit, Evidence Pack | Useful at different detail, poorly connected | Overview summary → exact workspace/audit finding |
| Inspect ungrouped records | Manager, filters, ungrouped AI audits, report diagnostics | Too many paths | Issue Manager primary; AI audit advanced |
| Open AI tools | main toolbar and floating Tools | Duplicate access can be useful | One primary toolbar; floating shortcut only contextually |

## 26. Friction log

| ID | Stage / role | Problem and evidence | Frequency / impact | Workaround | Recommendation / dependency |
|---|---|---|---|---|---|
| WF-001 | Capture; owner | Overlapping record types require internal knowledge; separate Incident/Evidence/Document/Record buttons | Frequent/high | Guess and later convert/edit | Choice guide; no schema dependency |
| WF-002 | Capture; owner | Disabled Quick Capture leaves no unclassified inbox | Occasional/moderate | Create an approximate record or external note | Validate demand, then lightweight inbox |
| WF-003 | Onboarding; owner | Overview contains four placeholder panels | Frequent/high for new cases | Ignore them | Replace with real return information |
| WF-004 | Organise; all internal | “Sequence Group” does not communicate Issue | Frequent/high | Learn product jargon | User-facing Issue label; stable ID dependency |
| WF-005 | Organise; manager | Issue has no status, priority, owner, review date, current position | Frequent/high | Encode in name/description/Strategy | Minimal Issue metadata |
| WF-006 | Connect; investigator | Relationship meaning is split across generic and typed fields | Frequent/high | Infer from record type and prose | Relationship vocabulary, later typed projection |
| WF-007 | Verify; investigator | Allegation/recollection can render like fact | Frequent/high | Add caveats in notes | Visible confidence/source conventions |
| WF-008 | Parties; owner | Cannot quick-create Party during record editing | Frequent/moderate | Cancel or open Parties separately | Inline create-and-select |
| WF-009 | Evidence; investigator | Document versus Evidence boundary unclear | Frequent/high | Duplicate or choose inconsistently | Source-versus-assessment guidance |
| WF-010 | Evidence; manager | Attachment metadata and binary can diverge | Occasional/high | Run integrity diagnostic | Reconciliation and preflight |
| WF-011 | Investigate; investigator | Findings spread across multiple tools | Frequent/high | Run several audits manually | One Case Quality queue |
| WF-012 | Investigate; investigator | Findings cannot generally be assigned/resolved/dismissed | Frequent/high | Edit and rerun, remember mentally | Resolution loop; finding identity prerequisite |
| WF-013 | Chronology; investigator | Date basis not consistently explained | Frequent/moderate | Open source record | Label date basis and direct Fix link |
| WF-014 | Plan; manager | Case actions and Strategy next steps compete | Frequent/high | Maintain both manually | Issue Strategy authoritative, Briefing aggregates |
| WF-015 | Monitor; manager | Due Watch/Strategy reviews are not one daily queue | Frequent/high | Visit separate workspaces | Daily attention view |
| WF-016 | Return; all internal | No complete “what changed/what next” view | Frequent/high | Revisit tabs and audits | Minimum return dashboard |
| WF-017 | Report; external reader | No primary complete Issue briefing | Frequent/high | Combine several reports manually | Minimum viable Issue Report |
| WF-018 | Report; owner | AI prose can appear authoritative/stale | Occasional/high | Manual review from memory | Prominent provenance, approval, fingerprint |
| WF-019 | Share; manager | No redaction/audience/finalization flow | Occasional/critical | Manually edit external files | Draft/final workflow and receipt |
| WF-020 | Share; manager | Reports do not preserve exact sent snapshot | Occasional/high | Save file externally with manual naming | Freeze final document and metadata receipt |
| WF-021 | Preserve; owner | Backup cannot be safely test-restored in isolation | Occasional/critical | Trust download or use another browser | Sandbox restore verification |
| WF-022 | Preserve; owner | Large backup risk known only through warnings/failure | Occasional/high | Split/delete attachments manually | Quota/size preflight |
| WF-023 | Retrieval; all internal | No selected-case global search | Frequent/high | Search workspace by workspace | Global typed search palette |
| WF-024 | Confidence; owner | Save success is not uniformly visible/durable | Frequent/moderate | Navigate away and return | Standard persisted/saving/error indicator |
| WF-025 | Confidence; manager | Group rename uses visible label as identity | Occasional/high | Avoid renaming | Stable ID before normal Issue workflow |
| WF-026 | Navigation; investigator | Direct audit-to-field correction is inconsistent | Frequent/high | Locate tab and record manually | Navigation targets for every finding |

## 27. Investigative workflow maturity

| Stage | Classification | Explanation |
|---|---|---|
| Capture | Working | Permissive typed forms and attachments work, but low-friction unclassified capture is inactive |
| Classification | Fragmented | Record distinctions are conceptually valid but poorly explained and overlapping |
| Organisation | Partial | Flat grouping is capable; identity and Issue metadata are missing |
| Linking | Working | Broad link support and cleanup exist; vocabulary and canonical meaning are fragmented |
| Verification | Partial | Evidence status/role/notes exist; assertions, contradictions, and provenance are incomplete |
| Investigation | Working | Strong diagnostics and schedules; corrective resolution loop is missing |
| Chronology | Working | Timeline and complete Chronology Report are useful; date basis/navigation need improvement |
| Planning | Fragmented | Strategy, Briefing, Action Plan, Watch, and legacy tasks overlap |
| Monitoring | Working | Watch is coherent; due-review integration and Issue context are weak |
| Review | Partial | Briefing and recommendations help; recent change and unified attention views are absent |
| Reporting | Partial | Strong schedules/audits, but no complete reviewed Issue briefing |
| Sharing | Fragmented | Many outputs exist; audience, redaction, final state, and sent-copy preservation do not |
| Recovery | Working | Strong safeguards and Full Backup; isolated verification/atomic restore are missing |

No stage is classified Mature because none has complete user guidance, integrated browser-level workflow verification, and a closed feedback/recovery loop. Capture, linking, investigation, chronology, monitoring, and recovery are nevertheless substantial working capabilities.

## 28. Persona walkthroughs

### Scenario A — Employment issue

Ideal: create work case → add worker/manager/HR Parties → record overtime and Sunday-work Incidents → attach schedules/payslips/messages as Documents and Evidence → create Issues for overtime and Sunday work → add Ledger/Tracking calculations → link management responses → Strategy and next action → Watch future scheduling → Issue Report.

Current outcome: most records, links, calculations, chronology, audits, and management reporting are possible. Friction arises in Document/Evidence/Tracking choices, two separate Issue names with cross-cutting Evidence, duplicated actions, and lack of status/current position. The user reaches useful schedules and packs but must manually assemble a defensible Issue briefing.

### Scenario B — Housing defect

Ideal: add tenant/landlord/contractor → record heating failures as Incidents → add photographs as Evidence and repair emails/notices as Documents → group into Heating Issue → track dates and rent impact in Ledger → Watch recurrence/response deadline → Strategy for escalation → share Issue Report.

Current outcome: capture, attachments, chronology, Ledger, Watch, and Evidence Pack work well. The user may duplicate each photograph/document, has no clear “awaiting landlord response” workflow outside Watch/Strategy, and cannot finalize a redacted tenant/adviser report with attachments manifest. A useful internal case is achievable; external communication remains manually composed.

### Scenario C — Internal investigator

Ideal: open existing case → see active Issues and overdue work → run one quality review → open every unsupported/malformed record → assign or resolve findings → review chronology/central Parties → publish completeness assessment.

Current outcome: diagnostics, Case Audit, Incident Schedule, Chronology, and Evidence Pack provide strong factual coverage. The investigator must switch among several surfaces, cannot mark findings resolved/accepted, and lacks contradiction and central-party views. A useful assessment is achievable, but the investigation loop is laborious and resolution history is absent.

### Scenario D — External adviser

Ideal: receive one finalized Issue Report with purpose, current position, chronology, evidence map, gaps, actions, appendices, provenance, and confidentiality handling.

Current outcome: Management/Investigation reports plus schedules can collectively provide this information, but no single output guarantees it. Client prose may be AI-assisted; complete schedules can be technical; attachment inclusion and finality are not represented. The adviser can understand the case only if the sender selects and explains the right combination of files.

## 29. Minimum viable workflow improvements

Limit: nine items.

| Priority | User problem | Visible solution | Technical dependency / risk | Acceptance criteria |
|---|---|---|---|---|
| 1 | Returning users cannot see what needs attention | One Daily Case Briefing with changes, due work, active Issues, and top findings | Existing derived metrics; moderate | Within one screen, user identifies top three actions and opens each source |
| 2 | Users choose wrong record type | “What are you adding?” guide with examples and source-vs-assessment rule | None; low | Representative first-time tests classify common examples correctly |
| 3 | Sequence Group is opaque and rename-fragile | Stable flat Issue ID, visible label Issue | Compatibility layer; medium-high | Rename changes display name without changing membership or report scope |
| 4 | Issues lack operational meaning | Purpose, status, priority, owner, review date, current position | Stable Issue identity; medium | Issue summary answers why, state, owner, and next review |
| 5 | Findings do not lead to correction | Every quality finding opens exact record/field and can be reviewed/resolved | Stable finding codes/navigation; medium | User completes finding → fix → rerun loop without manual search |
| 6 | Parties interrupt capture | Inline Add Party and return/select | Existing Party form reuse; low-medium | Party can be created without losing unsaved record state |
| 7 | Planning is duplicated | Strategy owns Issue plan; Briefing aggregates next actions | Action mapping; medium | One action has one authoritative status and appears in daily view |
| 8 | External readers lack one briefing | Deterministic Issue Report with authored header/current position | Issue metadata/report document; medium | Standalone report states scope, uncertainty, provenance, gaps, and actions |
| 9 | Sharing/recovery feel unsafe | Report finalization receipt and backup verification manifest | Fingerprint/storage checks; medium | User can identify exact finalized report and verified backup later |

Global selected-case search is the next item after this minimum set unless retrieval testing demonstrates it blocks daily work sooner.

## 30. Nested Issue decision

### Flat Issues with richer metadata

Best fit for present workflow. It addresses naming, ownership, status, priority, review, current position, and reporting without adding navigation complexity. Stable IDs make rename safe and allow later category/hierarchy migration.

### Issue categories

Potentially useful for larger cases with many flat Issues, especially broad themes such as pay, scheduling, health, repair, or communication. Categories improve navigation and report grouping without changing direct record membership. Add only after observing case scale.

### Parent/child Issues

Not currently justified. It introduces scope inheritance, cross-Issue Evidence choices, roll-up counts, nested navigation, migration, and reporting ambiguity. Current pain is missing Issue identity/metadata and communication, not inability to nest.

**Decision:** hierarchy should be **later and conditional**, not next. First deliver stable flat Issues, richer metadata, daily workflow, and Issue reporting. Reassess with real cases after those changes. The decision is reversible because categories or parent IDs can later reference stable Issue IDs.

## 31. Workflow-led roadmap

### Stage 1 — Daily case workflow

- **Objective:** make opening, capturing, and resuming a case self-explanatory.
- **Visible benefit:** the user sees what changed and what to do next.
- **Deliverables:** Daily Case Briefing, real Overview panels, record-choice guide, consistent saved/error feedback, inline Party creation.
- **Prerequisites:** reuse existing health/action/review derivations; no schema redesign required except any action aggregation contract.
- **Completion:** first-time and returning persona tests reach the right record/action without documentation.
- **Defer:** hierarchy, cross-case search, new AI packs.

### Stage 2 — Issue management

- **Objective:** make the current grouping mechanism safe and operational.
- **Visible benefit:** users work with named Issues that have owner, status, priority, review, and current position.
- **Deliverables:** stable ID, “Issue” UI terminology, minimal metadata, Issue summary, safe rename.
- **Prerequisites:** versioned compatibility across records, metadata, imports, exports, and reports.
- **Completion:** rename-safe Issue lifecycle from creation through closure.
- **Defer:** parent/child Issues.

### Stage 3 — Issue communication

- **Objective:** explain one Issue to someone outside ProveIt.
- **Visible benefit:** one reviewed, standalone report rather than several manually combined outputs.
- **Deliverables:** deterministic Issue Report document, authored current position, uncertainty labels, appendices, draft/final state, provenance.
- **Prerequisites:** Stage 2 metadata and report fingerprint/finalization contract.
- **Completion:** adviser persona understands purpose, chronology, support, gaps, and actions from one file.
- **Defer:** AI factual synthesis and new pack variants.

### Stage 4 — Investigation loop

- **Objective:** turn diagnostics into corrective work.
- **Visible benefit:** findings lead directly to fixes and visibly clear after review.
- **Deliverables:** consolidated Case Quality queue, exact navigation, assignment/review/resolution, rerun history, contradiction workflow conventions.
- **Prerequisites:** stable finding identities and navigation targets.
- **Completion:** investigator can process all high findings without manually searching workspaces.
- **Defer:** automatic credibility/legal judgments.

### Stage 5 — Advanced organisation

- **Objective:** support genuinely large cases after flat Issue workflow is proven.
- **Visible benefit:** easier navigation across many Issues.
- **Deliverables:** categories first; hierarchy only when user evidence justifies it; global selected-case search.
- **Prerequisites:** stable IDs and measured case-scale needs.
- **Completion:** organization reduces retrieval time without obscuring direct membership.
- **Defer:** cross-case analytics until security/storage work.

### Stage 6 — Platform and security

- **Objective:** make preservation and external integration appropriate for sensitive cases.
- **Visible benefit:** durable, verifiable recovery and controlled disclosure.
- **Deliverables:** isolated restore verification, encryption design, durable versioned storage, secure API/sync, consent-controlled AI access.
- **Prerequisites:** threat model, migration plan, authentication/authorization decisions.
- **Completion:** recovery and confidentiality tests demonstrate stated guarantees.
- **Defer:** remote AI automation until consent and data boundaries are explicit.

## 32. Final recommendation

ProveIt should not add Issue hierarchy next. Its immediate product milestone should be a **coherent daily flat-Issue workflow**:

```text
Open case
→ see active Issues, changes, due actions and top gaps
→ capture the right record with clear guidance
→ link it to an Issue and people
→ move directly from findings to corrections
→ maintain one Strategy and next-action path
→ finalize one deterministic, reviewed Issue Report
→ preserve the exact report and verified backup
```

This milestone uses the application's strongest existing assets—typed records, Watch, Strategy, diagnostics, chronology, report documents, and backup safeguards—while removing the need for users to understand internal field names, Sequence Group storage, report adapters, or AI/export contracts.

## 33. Files changed

Created by this task:

```text
PROVEIT_CASE_WORKFLOW_AUDIT.md
```

Already present and unchanged at task start:

```text
PROVEIT_CURRENT_STATE_AUDIT.md
```

No production code, schema, tests, configuration, user data, or existing audit content was changed. No file was staged, committed, or pushed.

## 34. Validation

### Original baseline

```text
npm test: 758 passed, 0 failed, 0 skipped
npm run lint: passed
npm run build: passed in 1.79 s
git diff --check: passed
```

Build warning at baseline:

```text
Main JavaScript: 1,505.81 kB raw / 350.97 kB gzip
Some chunks are larger than 500 kB after minification.
```

### Final validation

```text
npm test: 758 passed, 0 failed, 0 skipped
test duration: 4026.7144 ms
npm run lint: passed
npm run build: passed in 1.89 s; 1,861 modules transformed
git diff --check: passed
```

The final build reproduced the baseline main bundle measurement and warning:

```text
Main JavaScript: 1,505.81 kB raw / 350.97 kB gzip
Some chunks are larger than 500 kB after minification.
```

Exact final working-tree changes:

```text
?? PROVEIT_CASE_WORKFLOW_AUDIT.md
?? PROVEIT_CURRENT_STATE_AUDIT.md
```

`PROVEIT_CURRENT_STATE_AUDIT.md` existed before this task and was not changed. `PROVEIT_CASE_WORKFLOW_AUDIT.md` is the only file created by this task. Neither file is staged. Nothing was committed or pushed.
