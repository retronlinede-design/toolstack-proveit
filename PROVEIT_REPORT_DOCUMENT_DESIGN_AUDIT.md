# ProveIt Report Document Design Audit

**Audit date:** 2 August 2026  
**Repository:** `C:\Users\roryr\Desktop\Apps\toolstack-prove-it`  
**Audited commit:** `22f703d764287fe68c3139e16ce7e2fff8f62be3`  
**Branch:** `main`

## Contents

1. Executive assessment
2. Method and confidence
3. Product-wide document findings
4. Report maturity matrix
5. Individual report audits
6. Table and schedule assessment
7. Print, identity, and branding
8. Consistency assessment
9. Prioritised findings
10. Standard report template
11. Recommended redesign order
12. Acceptance principles for the redesign
13. Files inspected
14. Validation

## 1. Executive assessment

ProveIt can produce factually structured and often information-rich reports, but the documents do not yet form one professional publication system. They divide into three visibly different families:

- The Management Report and Client Report aim to communicate a story and have the strongest sense of an intended reader.
- The Investigation Report and Action Plan provide useful operational material, but their document flow is inconsistent and lacks a shared report identity.
- The schedules, packs, and audits are primarily database projections: valuable as references, but too technical and dense to serve as the main explanation of a case.

The strongest current document is the **Management Report** in structural ambition: it has a cover-like header, executive material, attention items, issue briefings, risks, and actions. Its largest professional weakness is that visible placeholder text can enter the document when authored narrative is absent. That is a publication-blocking defect.

The greatest redesign need is the **Investigation Report**. Its Issue-scoped form contains the right ingredients—overview, chronology, incidents, evidence, documents, diagnostics, and actions—but it begins as a record bundle rather than a concise investigative account. Its whole-case form is explicitly bounded and looks like a configurable bundle, not a definitive investigation report.

The **Client Report** has the clearest reader-oriented vocabulary, but it is wholly dependent on pasted GPT-generated prose. Its authorship, approval, provenance, draft/final status, and source traceability are not sufficiently visible inside the finished document.

The reference schedules are useful and should be preserved, but their detailed matrices belong after a short orientation section and often in appendices. The current documents frequently expose internal IDs, implementation terminology such as “Sequence Group,” diagnostic codes, and source fingerprints without translating them for external readers.

The correct next design milestone is a shared document system—not a shared report calculation system—with:

1. consistent cover and identity;
2. explicit purpose, audience, scope, exclusions, generation time, case revision, and approval status;
3. a short reader orientation before detail;
4. clear separation of conclusions, recorded facts, data-quality warnings, and technical appendices;
5. repeatable print typography, page breaks, headers, footers, and table rules.

## 2. Method and confidence

This audit evaluates the active React report articles and the Issue Audit Markdown/print path. It does not assess whether the underlying facts or calculations are correct.

Evidence labels used in this document:

- **Verified from source:** directly visible in the active renderer or export path.
- **Design inference:** likely reader experience inferred from structure, styling, and content order.
- **Recommendation:** proposed document-design direction; not current behaviour.

No browser print-to-PDF session was performed during this audit. Print findings are therefore based on print classes, overflow rules, break rules, and source structure. Visual fidelity at specific paper sizes remains to be confirmed with real browser print testing.

## 3. Product-wide document findings

### 3.1 Professional appearance

The application has professional building blocks—restrained colours, bordered sections, statistic cards, confidentiality notices, and print-specific sizing—but these are applied unevenly. Management, Client, Investigation, packs, schedules, and audits use different heading conventions and different document identities. A recipient could reasonably assume they came from different products.

### 3.2 Readability and context

Most reports name the case, scope, and generation time. Few explain all four essential orientation questions together:

- What is this document?
- Why was it produced?
- What records and time period does it cover?
- What does it exclude or limit?

Completeness notices exist in parts of the reporting system, but are not consistently placed in the printable document itself. External readers should not need access to the Reports Centre to understand a document's limitations.

### 3.3 Narrative flow

The prevalent order is metadata followed by record detail. Management and Client are exceptions. Reference packs correctly contain schedules, but do not first explain the significance, coverage, or principal limitations of the included material. Investigation reports should lead with the question, current position, findings, and outstanding matters before chronology and evidence detail.

### 3.4 Executive summaries

Only Management and Client have a genuine reader-facing summary intent. Investigation has an overview/count layer rather than an executive summary. Schedules and audits have numerical summaries, which orient quantity but not meaning. Action Plan starts with Current Focus, which is useful but not equivalent to a status summary.

### 3.5 Visual hierarchy

Heading hierarchy is generally semantic, but many reports use small uppercase labels for major sections. This produces a compact application-card appearance rather than a formal document hierarchy. Dense tables dominate Incident Schedule, Case Audit, Document Pack, and Ledger Pack. The consistent use of cards works on screen but can create visually fragmented print documents.

### 3.6 Storytelling

ProveIt is strongest at structured enumeration and weakest at authored transitions. Reports rarely explain why a section follows the previous one or what the reader should take from it. Chronology entries, evidence rows, and findings are traceable, but the relationship between them is left to the reader.

### 3.7 Current position and outstanding matters

Stored Issue metadata now supports `purpose`, `status`, `priority`, `ownerPartyId`, `reviewDate`, and user-authored `currentPosition`. The active report documents do not consistently make this operational context the entry point for Issue-scoped reporting. Current Position should appear prominently and be explicitly labelled as user-authored, dated case-management content—not an automated finding.

Outstanding matters appear under several names: diagnostics, gaps, weak records, unresolved references, open questions, risks, next actions, and recommended fixes. These distinctions can be useful internally, but external-facing reports need one consolidated “Outstanding Matters” section with clear subtypes.

### 3.8 Appendices

Detailed schedules, full record lists, diagnostic codes, link maps, raw IDs, and attachment metadata are best treated as appendices in communication reports. Reference reports can retain these as their core body, but should add a one-page overview first.

## 4. Report maturity matrix

| Report | Primary classification | Professional readiness | Narrative strength | Best current use |
| --- | --- | --- | --- | --- |
| Management Report | Executive Report | Partial | Strongest current | Internal management briefing after careful review |
| Investigation Report | Executive/Operational Report | Partial | Moderate at Issue scope; weak at whole-case scope | Investigator working bundle |
| Client Report | Executive Report | Partial, approval-dependent | Potentially strong but AI-authored | Reviewed client communication draft |
| Incident Schedule | Reference Schedule | Working | Low by design | Factual appendix and incident register |
| Chronology Report | Reference Schedule | Working | Moderate chronological flow | Factual timeline appendix |
| Evidence Pack | Reference Schedule | Working | Low | Evidence review and appendix |
| Document Pack | Reference Schedule | Working | Low | Document review and appendix |
| Ledger Pack | Reference Schedule | Working | Low | Financial/measurable-record appendix |
| Case Audit | Audit | Working internally | Low by design | Internal quality assurance |
| Issue Audit | Audit / Technical Appendix | Early/technical | Low | Internal forensic data review and AI pack |
| Action Plan | Planning Document | Working | Moderate operational flow | Internal case-management plan |

No active report in this inventory is merely a non-rendering placeholder. However, the Management Report contains visible placeholder fallback sentences, and the Issue Audit print output is a styled preformatted Markdown dump rather than a designed report document.

## 5. Individual report audits

### 5.1 Management Report

**Classification:** Executive Report.  
**Intended audience:** managers, HR, executives.  
**Current maturity:** structurally advanced, publication-risky.

**Verified structure:** management title/header, case and generation metadata, confidentiality information, executive summary statement, management attention, KPI-style summaries, top Issues, positive outcomes, purpose/value, chain briefings, facts, proof, gaps, risks, actions, supporting records, reference documents, monitoring priorities, ungrouped records, and a short chronology preview.

**Strengths**

- Closest to a professional briefing document.
- Puts management attention and executive material near the beginning.
- Separates facts, proof, gaps, risks, and actions within Issue/chain briefings.
- Includes a prepared-by field and confidentiality treatment.
- Distinguishes supporting records from reference documents.

**Weaknesses**

- The source includes visible `TODO: AI-generated... placeholder` fallback copy. If reached, this is unacceptable in a professional document.
- The dashboard-style first page is visually ambitious but may feel like an application screenshot rather than a formal report.
- “Sequence Chain” and “Chain Brief” are internal concepts that are not self-explanatory to an external manager.
- Current Position, Issue owner, review date, and Issue status are not the consistent framing device for each Issue.
- The detailed chain material can make an executive report long and repetitive.
- Source revision/version is not consistently prominent in the primary management cover treatment.

**Recommended structure**

1. Cover and document control
2. Executive Summary
3. Decisions / Attention Required
4. Current Position by Issue
5. Key Findings and Evidence Overview
6. Risks and Outstanding Matters
7. Recommended Actions
8. Short Chronology
9. Appendices: Issue detail and record references

**Print suitability:** potentially suitable for management after placeholder removal and real print QA. Not yet safe for formal external/legal circulation without document control and stronger traceability.

### 5.2 Investigation Report

**Classification:** Executive/Operational Report.  
**Intended audience:** investigator or reviewer.  
**Current maturity:** mixed; Issue scope is more coherent than whole-case scope.

**Verified structure:** whole-case rendering uses a bounded Case Bundle with contents, optional Issue summary, Evidence/Document/Ledger sections, strategy/actions, monitoring, and combined diagnostics. Issue rendering includes case overview, statistics, diagnostics, thread chronology, incidents, evidence matrix, documents, ledger, strategy, Watch, open questions, and next actions.

**Strengths**

- Broad coverage of investigation material.
- Issue scope creates a useful bounded investigation packet.
- Explicitly includes chronology, evidence, open questions, and next actions.
- Whole-case mode makes its bounded nature visible in the application.

**Weaknesses**

- It does not begin with an investigative question, terms of reference, executive finding summary, or current position.
- Diagnostics appear before the narrative chronology in Issue mode, interrupting reader orientation.
- The whole-case version is a collection of report fragments, not a unified investigation account.
- Evidence, documents, and ledger are presented as record detail without a preceding synthesis of what they collectively show.
- Record previews are bounded, but the printable report needs an explicit limitation statement within the document.
- “Thread / Issue,” “Bundle Contents,” and “Combined Diagnostics” expose implementation language.

**Recommended structure**

1. Cover and document control
2. Purpose / Terms of Reference
3. Executive Summary
4. Scope, exclusions, and methodology
5. Current Position
6. Key Findings by Issue
7. Narrative Chronology
8. Evidence Overview
9. Conflicting, missing, or unverified material
10. Outstanding Matters and Next Actions
11. Appendices: incident, evidence, document, and ledger schedules

**Print suitability:** currently suitable as an internal working bundle, not yet as a definitive report for a lawyer, government body, or adjudicator.

### 5.3 Client Report

**Classification:** Executive Report.  
**Intended audience:** the person affected by the case.  
**Current maturity:** reader-friendly structure, high provenance risk.

**Verified structure:** branded cover variant, report title, case metadata, At a Glance, Your Situation, Main Areas of Concern, What This Report Shows, Milestone Timeline, Issue sections, What Happened, Key Proof, What This Means, Key Facts, and further client-oriented sections defined by the structured format. Content is pasted from a GPT-generated response and parsed into known sections.

**Strengths**

- Most accessible language in the suite.
- Strong progression from situation to concern, timeline, proof, and meaning.
- Issue-level sections can explain rather than merely enumerate.
- Branding and cover treatment are more developed than most reports.

**Weaknesses**

- The finished document does not make AI authorship, human review, approval, and source revision sufficiently prominent.
- “What This Means” can imply evaluative authority beyond deterministic records.
- Statements are not consistently traceable to record references.
- Draft/final state, prepared by, approved by, and report version are absent.
- The report can vary materially according to pasted prose even when the case data has not changed.

**Recommended direction:** retain the client-oriented flow, but add a mandatory document-control block, a visible “AI-assisted draft reviewed by…” statement, record citations for factual claims, and a user-approved Current Position. Treat interpretive sections as authored commentary rather than system findings.

**Print suitability:** potentially suitable for a client after explicit human approval; currently inappropriate to present as an automatically verified case statement.

### 5.4 Incident Schedule

**Classification:** Reference Schedule.  
**Intended audience:** investigator.  
**Current maturity:** strong factual appendix, weak standalone communication document.

**Verified structure:** title/scope/source revision, numerical summary, a minimum-width 1000px table, evidence coverage, weak/incomplete incidents, unresolved references, and notices.

**Strengths**

- Clearly identifies itself as a complete factual report.
- Useful coverage statistics and quality sections.
- Explicitly states that evidence coverage does not determine whether an incident is proven.
- Separates unresolved references and notices.

**Weaknesses**

- The table has twelve columns and is unlikely to print legibly on portrait paper.
- Raw technical IDs and “Sequence Group” terminology dominate the schedule.
- Long descriptions and linked-record lists create highly variable row height.
- There is no short explanation of the principal incident pattern before the table.
- Evidence coverage is repeated after already appearing within the wide table.

**Recommended direction:** keep as a reference report. Add a one-page Incident Overview, use human Issue labels, move technical IDs to a reference column or appendix, split the matrix into a concise incident schedule plus relationship appendix, and define landscape print rules.

### 5.5 Chronology Report

**Classification:** Reference Schedule.  
**Intended audience:** investigator.  
**Current maturity:** useful and readable, but not a narrative chronology.

**Verified structure:** title/scope/source revision, total/date-quality statistics, record-type totals, date-grouped ordered entries, summaries, Issue/group labels, link and attachment counts, parties, archived markers, and notices.

**Strengths**

- Date grouping and vertical timeline treatment are easier to read than a wide table.
- Malformed and missing dates are visible.
- Includes multiple record types and distinguishes archived material.
- Works well as a canonical factual chronology.

**Weaknesses**

- The chronology interleaves operational records such as Strategy and To Watch with events and source material; unfamiliar readers may not understand why.
- It does not distinguish event date, document date, logged date, or review date in reader-facing language.
- It offers no opening chronology narrative or milestone summary.
- Raw record IDs and link/attachment counts add technical noise.
- Month/date groups are good navigation, but individual entries do not explain causal or evidential relationships.

**Recommended direction:** retain this as the complete chronology appendix. Add a separate “Chronology Overview” with key milestones, date semantics, and scope; reserve the full canonical list for detail.

### 5.6 Evidence Pack

**Classification:** Reference Schedule.  
**Intended audience:** investigator.  
**Current maturity:** working evidence register.

**Verified structure:** report identity, At a Glance, Evidence Matrix, Supported Incidents, Unlinked/Weak Evidence, and Diagnostics.

**Strengths**

- Logical quality-control sections.
- Connects evidence to supported incidents.
- Separates weak or unlinked material from the main matrix.
- Includes clear empty states.

**Weaknesses**

- It starts with metrics and then immediately enters the Evidence Matrix.
- There is no Evidence Overview explaining the strongest evidence, coverage, provenance quality, or important limitations.
- “Supported Incidents” can be misread as a finding that the incident is established rather than structurally linked.
- Diagnostics and evidence-quality concepts are mixed into one document without audience guidance.
- A full evidence schedule is too detailed for the body of an executive or client report.

**Recommended structure:** Evidence Overview; scope and handling note; key evidence; coverage and limitations; evidence schedule; unsupported/unlinked items; technical diagnostics appendix.

### 5.7 Document Pack

**Classification:** Reference Schedule.  
**Intended audience:** investigator.  
**Current maturity:** working document register.

**Verified structure:** report identity, At a Glance, Document Matrix, linked Incident/Evidence support, unlinked/weak documents, and diagnostics.

**Strengths**

- Separates source documents from Evidence records.
- Surfaces attachment metadata, summaries, and structured links.
- Includes weak/unlinked document review.

**Weaknesses**

- The matrix is dense and can repeat summary/function information.
- It does not first explain what document classes exist, which are central, or what remains missing.
- “Linked support” risks implying evidential weight without explanatory language.
- Attachment availability and source/provenance should be more prominent than implementation-oriented link detail.

**Recommended direction:** add a Document Overview and provenance summary, then place the complete matrix in the body only when this is explicitly a reference pack; otherwise use it as an appendix.

### 5.8 Ledger Pack

**Classification:** Reference Schedule.  
**Intended audience:** investigator; potentially finance reviewer.  
**Current maturity:** working technical schedule.

**Verified structure:** report identity, At a Glance, Ledger Matrix, proof/support summary, unlinked/weak entries, and diagnostics.

**Strengths**

- Separates currencies and avoids presenting conversions.
- Distinguishes proof coverage and missing proof.
- Provides a dedicated schedule for measurable and financial records.

**Weaknesses**

- The audience metadata says investigator, while the document content may also be sent to finance or management readers without tailored explanation.
- It lacks an opening financial position: what is claimed, paid, disputed, pending, waived, or excluded.
- Status-note and monetary entries need stronger visual distinction.
- Totals without a narrative definition can be misunderstood.
- The matrix and diagnostic sections are better as supporting schedules than the main financial communication.

**Recommended direction:** add a Financial Position summary, totals by currency with definitions, disputed/missing-proof callouts, and a clear accounting limitation before the detailed ledger appendix.

### 5.9 Case Audit

**Classification:** Audit.  
**Intended audience:** internal case manager/investigator.  
**Current maturity:** useful internal quality report.

**Verified structure:** audit identity, scope and source revision, audit status, statistic cards, findings by severity, findings by category, findings by record type, unresolved references, Sequence Group coverage, ledger integrity, and notices. Findings use an 850px minimum-width table and expose codes and raw record IDs.

**Strengths**

- Clearly states that it assesses data quality rather than factual or legal merit.
- Good separation by severity and category.
- Useful no-findings disclaimer.
- Source revision provides meaningful reproducibility context.

**Weaknesses**

- The same findings can repeat in severity and category sections, lengthening the document.
- Raw codes, IDs, technical references, and “Sequence Group” language make it unsuitable for most external readers.
- The findings table is wide and likely requires landscape output.
- It does not prioritise a short remediation plan before the full findings register.
- “Audit Status” may sound more authoritative than the bounded deterministic rules justify.

**Recommended direction:** keep internal. Open with Quality Summary and Priority Remediation, present each finding once in the main body, and move code/category cross-indexes to appendices.

### 5.10 Issue Audit

**Classification:** Audit / Technical Appendix.  
**Intended audience:** internal investigator and AI-assisted review workflow.  
**Current maturity:** technically useful, not a professionally designed document.

**Verified structure:** Markdown export headed “Sequence Group Full Record Audit Report,” case and group identity, thread overview, chronology table, full Incident records, full Evidence records, link map, unsupported incidents, unused evidence, weak records, external linked records, and a GPT audit prompt block. Printing writes escaped Markdown into a `<pre>` element and opens the browser print dialog.

**Strengths**

- Broad, explicit audit content.
- Useful technical link map and weak-record sections.
- Preserves detail required for forensic internal review.

**Weaknesses**

- User-facing title and body still use Sequence Group rather than Issue.
- The print path is a preformatted Markdown dump, not a document renderer.
- Raw IDs and field names such as `linkedEvidenceIds`, `functionSummary`, and `externalLinkedRecord` are exposed.
- The GPT prompt block must never appear in a report intended for a human external recipient.
- There is no cover, audience, purpose, Issue metadata, current position, document control, or readable conclusions.

**Recommended direction:** preserve the existing export as a technical audit package. Create a separate professionally rendered Issue Audit for humans; do not merely restyle the GPT package.

### 5.11 Action Plan

**Classification:** Planning Document.  
**Intended audience:** internal case manager, with possible sharing to management/HR/legal after review.  
**Current maturity:** useful operational report.

**Verified structure:** title, case/scope/generated date, confidentiality and open-risk count, review-before-sharing notice, Current Focus, Next Actions, Critical Deadlines, Strategy Focus, Open Strategy Records, Open Tasks, Matters to Watch, Risks and Gaps, and Recommended Fixes.

**Strengths**

- Strong action-oriented flow.
- Current Focus appears early.
- Separates deadlines, strategy, monitoring, risks, and fixes.
- Includes an explicit caution for To Watch items.

**Weaknesses**

- Next Actions, Strategy Focus, Open Strategy Records, Open Tasks, and Recommended Fixes can overlap.
- Actions do not consistently present owner, due date, status, Issue, and completion criteria in one scan-friendly form.
- “Recommended Fixes” are diagnostic remediations and can be confused with case strategy.
- The report lacks a short status summary: overdue, due soon, blocked, and unassigned.
- The empty Issue message still uses internal Sequence Group terminology in the renderer.

**Recommended direction:** standardise each action row as action, Issue, owner, due date, status, dependency, and source. Separate case actions from data-quality remediation.

## 6. Table and schedule assessment

| Document/table | Assessment | Recommended treatment |
| --- | --- | --- |
| Incident Schedule matrix | Excessively wide at 12 columns; high repetition | Split core incident register from relationship appendix; landscape print |
| Evidence Matrix | Useful register but lacks overview | Add Evidence Overview before matrix; appendix in communication reports |
| Document Matrix | Dense, variable-length text cells | Introduce compact register and separate detail sheets |
| Ledger Matrix | Useful but requires definitions and currency context | Add financial summary and status legend; landscape where required |
| Case Audit findings | 850px minimum, repeated across views | One principal findings table; category/code indexes in appendix |
| Issue Audit chronology | Plain Markdown table | Keep for machine/technical export; create human renderer separately |
| Management risk table | Appropriate for summary if bounded | Retain, with severity definitions and source references |

Professional table rules should include repeated print headers, controlled column widths, row-break prevention where feasible, visible units/currencies, plain-language empty cells, page orientation guidance, and a reference key. Raw IDs should be secondary, not the principal label.

## 7. Print, identity, and branding

### 7.1 Report identity

Every printable report should carry:

- ProveIt identity and report title;
- case name and optional case reference;
- Issue reference and name when scoped;
- purpose and intended audience;
- scope and explicit exclusions;
- reporting period where applicable;
- generated timestamp;
- source revision;
- prepared by and, when relevant, approved by;
- document version;
- Draft / Final / Superseded status;
- confidentiality classification;
- page number and stable footer reference.

The internal UUID should not be the ordinary human reference.

### 7.2 Cover pages

Full cover pages are appropriate for Management, Investigation, and Client Reports. Action Plan should have a compact title/control page. Reference schedules and audits need a strong report header and document-control block, but not necessarily a separate cover sheet unless exported as standalone formal documents.

### 7.3 Branding

The documents should share a restrained ProveIt publication identity: one type scale, one heading hierarchy, one cover system, one metadata block, one callout language, and one footer. Branding should not overwhelm evidence or suggest institutional authority that ProveIt does not possess.

### 7.4 Print risks

- Wide schedule and audit tables require landscape handling or structural splitting.
- Screen card grids may consume excessive paper and produce awkward page breaks.
- Several renderers have print-aware spacing and break classes, but no common page header/footer system is evident.
- Issue Audit printing is not acceptable as a professional document.
- Colour-coded findings and status surfaces require grayscale-safe text labels and borders.

## 8. Consistency assessment

The reports do not currently feel like one product family.

| Dimension | Current consistency |
| --- | --- |
| Cover/title treatment | Low |
| Case/scope/generated metadata | Moderate |
| Prepared by/version/status | Low |
| Purpose and exclusions | Low |
| Heading hierarchy | Moderate-low |
| Summary statistics | Moderate |
| Empty-state language | Moderate |
| Issue terminology | Low |
| Source revision | Inconsistent |
| AI provenance | Low |
| Print page system | Low |
| Tables | Moderate within schedule family |

The schedule family is internally the most consistent. Management and Client are visually distinct from it and from one another. Case Audit uses a newer data-document style. Issue Audit is an export artifact rather than a designed report.

## 9. Prioritised findings

### Critical

**DOC-C01 — Placeholder prose can appear in Management Report**  
**Problem:** visible `TODO` fallback sentences exist in the active renderer.  
**Impact:** an unfinished statement could be printed or shared as part of a management document.  
**Suggested direction:** never render implementation placeholders; use an honest omitted-section state or deterministic content.

**DOC-C02 — AI-authored Client Report lacks sufficient publication provenance**  
**Problem:** the finished report does not prominently identify AI assistance, human review, approval, and source revision.  
**Impact:** generated prose may be mistaken for verified system findings or approved client statements.  
**Suggested direction:** mandatory draft/final and reviewer controls, claim traceability, and an AI-assistance disclosure.

### High

**DOC-H01 — Investigation Report does not provide a definitive investigative narrative**  
**Problem:** it behaves as a bounded bundle or Issue record packet.  
**Impact:** an external reader must reconstruct the question, findings, and current position.  
**Suggested direction:** redesign around terms of reference, executive summary, findings, current position, evidence overview, and outstanding matters.

**DOC-H02 — No shared document-control system**  
**Problem:** prepared by, version, source revision, status, scope, exclusions, and confidentiality are inconsistent.  
**Impact:** recipients cannot reliably identify, compare, or reproduce what was sent.  
**Suggested direction:** standard document identity component and publication metadata contract.

**DOC-H03 — Issue Audit print is a technical Markdown dump**  
**Problem:** human print output exposes raw Markdown, internal fields, IDs, and GPT instructions.  
**Impact:** not suitable for professional circulation and risks accidental disclosure of AI instructions.  
**Suggested direction:** separate technical package from human Issue Audit document.

**DOC-H04 — Reference reports expose excessive implementation detail**  
**Problem:** raw IDs, codes, fingerprints, link counts, and Sequence Group terminology dominate.  
**Impact:** external readers face unnecessary cognitive load and may misinterpret technical fields.  
**Suggested direction:** human labels in the body; technical identifiers in appendices or footnotes.

**DOC-H05 — Wide tables are not print-safe by design**  
**Problem:** Incident Schedule and Case Audit enforce large minimum widths.  
**Impact:** clipping, tiny scaling, or horizontal overflow in printed/PDF output.  
**Suggested direction:** split tables, define orientation, repeat headings, and test on A4/Letter.

### Medium

**DOC-M01 — Evidence begins with a matrix rather than an overview**  
**Impact:** readers see inventory before understanding coverage and limitations.  
**Direction:** add Evidence Overview before the complete schedule.

**DOC-M02 — Current Position is not consistently used**  
**Impact:** Issue reports do not immediately explain where the matter stands.  
**Direction:** include dated, user-authored Current Position with attribution.

**DOC-M03 — Outstanding matters are fragmented**  
**Impact:** gaps, risks, unresolved links, Watch items, and actions are difficult to scan together.  
**Direction:** one Outstanding Matters section with clearly defined subcategories.

**DOC-M04 — Chronology lists rather than interprets**  
**Impact:** useful factual order does not become a reader-friendly account.  
**Direction:** retain complete chronology and add a milestone overview with date semantics.

**DOC-M05 — Case Audit repeats findings**  
**Impact:** long reports and reduced prioritisation.  
**Direction:** one findings register plus appendix indexes.

**DOC-M06 — Action concepts overlap**  
**Impact:** users cannot easily distinguish strategic work, tasks, diagnostic fixes, and monitoring.  
**Direction:** consistent action rows and clear separation of case action from data-quality remediation.

**DOC-M07 — Terminology is inconsistent**  
**Impact:** Issue, Thread, Sequence Group, Chain, Pack, Audit, and Bundle require product knowledge.  
**Direction:** use Issue in human documents and explain specialist document types once.

### Low

**DOC-L01 — Major headings are often small uppercase labels**  
**Impact:** formal hierarchy can appear visually flat.  
**Direction:** shared print typography with stronger section levels.

**DOC-L02 — Screen cards can create print fragmentation**  
**Impact:** excess boxes and awkward pagination.  
**Direction:** use flatter print styling while preserving on-screen scanning.

**DOC-L03 — Empty sections use inconsistent language**  
**Impact:** varying confidence about whether data is absent, excluded, or unavailable.  
**Direction:** standard empty-state vocabulary for none recorded, none in scope, unavailable, and omitted.

## 10. Standard report template

The template should be modular: communication reports use the full sequence, while schedules and audits use a shortened variant.

```text
Cover / Report Identity
  Report title
  Case and Issue reference
  Prepared by / approved by
  Version and Draft / Final status
  Generated time and source revision
  Confidentiality

Document Control
  Purpose
  Intended audience
  Scope and reporting period
  Exclusions and limitations
  Method / source basis

Executive Summary
  Current position
  Principal findings
  Decisions or attention required

Issue Overview
  Purpose, status, priority, owner, review date
  People involved
  Key statistics

Narrative Chronology
  Milestones and explanation
  Link to complete chronology appendix

Evidence Overview
  Strongest supporting material
  Coverage and provenance
  Conflicting, missing, or unverified material

Supporting Documents / Financial Position
  Summary appropriate to the report

Outstanding Matters
  Missing information
  Unresolved references
  Risks and monitoring
  Required decisions

Recommendations / Next Actions
  Action, owner, due date, status, dependency

Appendices
  Incident schedule
  Complete chronology
  Evidence schedule
  Document schedule
  Ledger schedule
  Audit findings
  Technical reference index
```

Content rules:

- Deterministic facts and authored interpretation must be visually and verbally distinct.
- Current Position must state author and last-updated date.
- AI-assisted text must never be presented as system-verified fact.
- Every significant factual statement in communication reports should be traceable to readable record references.
- A summary report must disclose that it is not exhaustive.
- A complete schedule must define what “complete” means for its scope.

## 11. Recommended redesign order

1. **Shared document identity and print foundation.** Every later redesign depends on stable cover, metadata, typography, page, and appendix rules.
2. **Investigation Report.** It is the central case-communication gap and should establish the standard narrative template.
3. **Management Report.** Remove publication-blocking placeholders and align its strong content with the shared identity.
4. **Client Report.** Preserve its accessible language while adding provenance, approval, traceability, and safety.
5. **Issue Audit.** Separate the human audit document from the technical/GPT package.
6. **Action Plan.** Consolidate operational presentation and action ownership without changing action data.
7. **Evidence Pack.** Establish the “overview before schedule” pattern.
8. **Incident Schedule.** Resolve the most severe table/print-density problem.
9. **Chronology Report.** Add milestone orientation while preserving canonical detail.
10. **Document Pack and Ledger Pack.** Apply the reference-family template and domain-specific overview blocks.
11. **Case Audit.** Reduce repetition and improve prioritised remediation after the shared audit design is established.

This order deliberately tackles the common document system and the most important communication reports before polishing every schedule independently.

## 12. Acceptance principles for the redesign

A redesigned report should not be considered complete until:

- its purpose and audience are clear on page one;
- its scope, exclusions, generation time, and source revision travel with the document;
- a reader unfamiliar with ProveIt can understand the terminology;
- deterministic facts, user-authored positions, and AI-assisted prose are distinguishable;
- the document has a clear narrative or reference purpose, not both accidentally;
- detailed schedules are appropriately placed in appendices;
- tables print legibly on declared paper sizes;
- headers, footers, page numbers, and document version survive PDF output;
- empty and bounded sections explain what is absent or excluded;
- the report can be reproduced and compared with a later version;
- colour is not required to understand status or severity;
- a real print/PDF review has been completed in light and grayscale output.

## 13. Files inspected

Significant active sources inspected include:

- `src/report/reportDefinitions.js`
- `src/report/reportBuilder.js`
- `src/report/actionPlanReport.js`
- `src/report/chronologyReportDocument.js`
- `src/report/buildActiveReportDocument.js`
- `src/report/reportOutputs.js`
- `src/lib/proveitReportFormat.js`
- `src/export/sequenceGroupAuditExport.js`
- `src/components/CaseDetail.jsx`
- `src/components/reports/ReportArticleShared.jsx`
- `src/components/reports/ExecutiveSummaryReportArticle.jsx`
- `src/components/reports/CaseBundleReportArticle.jsx`
- `src/components/reports/ThreadIssueReportArticle.jsx`
- `src/components/reports/GeneratedClientReportArticle.jsx`
- `src/components/reports/IncidentScheduleReportArticle.jsx`
- `src/components/reports/ChronologyReportArticle.jsx`
- `src/components/reports/EvidencePackReportArticle.jsx`
- `src/components/reports/DocumentPackReportArticle.jsx`
- `src/components/reports/LedgerPackReportArticle.jsx`
- `src/components/reports/CaseAuditReportArticle.jsx`
- associated rendered and document tests for these reports

The audit did not inspect private case data and did not evaluate factual correctness.

## 14. Validation

- Application files modified by this audit: **None**
- File added: `PROVEIT_REPORT_DOCUMENT_DESIGN_AUDIT.md`
- Commits created: **None**
- Pushes performed: **None**
- Production code, report builders, calculations, documents, outputs, and persistence changed: **No**

