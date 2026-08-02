# ProveIt — Current-State Application Audit

Audit date: 2 August 2026  
Repository: `C:\Users\roryr\Desktop\Apps\toolstack-prove-it`  
Audited commit: `728f44489de3122033791090ab29057d481b3de6`

Assessment labels used in this report:

- **Verified**: confirmed through active imports/render paths, automated tests, or build output.
- **Source inference**: supported by source inspection but not exercised in a current live browser session.
- **Architecture recommendation**: proposed structural direction, not current behavior.
- **UX recommendation**: proposed user-facing improvement, not current behavior.

## 1. Executive Summary

ProveIt is a local-first, browser-based case-management and investigation workspace. It organizes cases into incidents, evidence, documents, tracking records, ledger entries, strategies, monitored concerns, and parties. Records can be connected through several ID-based relationship fields and assigned to flat Sequence Groups. The application also creates deterministic reports, data-quality audits, backups, and bounded GPT packages.

Its strongest capability is the combination of structured case records, relationship diagnostics, Sequence Group scoping, and the newer deterministic reporting foundation.

The current organizing model is:

```text
Folder
  └─ Case
      ├─ Typed records and parties
      ├─ Direct ID-based links
      ├─ Flat, label-based Sequence Groups
      ├─ Action summary and generated client prose
      └─ Reports / exports / GPT packages
```

Closest to production-ready:

- Core case and typed-record CRUD.
- IndexedDB case persistence.
- Incident/evidence relationship synchronization.
- Flat Sequence Group membership operations.
- Deterministic Case Audit, Incident Schedule, Chronology, Evidence, Document, and Ledger report documents.
- Full Backup construction/restoration and persistence safeguards.
- Core domain, report, export, and import validation tests.

Experimental or transitional:

- GPT Delta import, especially its overlapping protocol generations.
- Client Report copy/paste workflow and persisted AI prose.
- Management narrative polish.
- Legacy/transitional evidence store and disabled Supabase sync.
- Tracking Records embedded inside Documents.
- Print Pack and older report builders alongside the new Report Centre.
- Metadata-only Sequence Groups stored separately from cases.

Overbuilt relative to current user value:

- The number of specialized GPT and audit package variants.
- Parallel report surfaces and compatibility projections.
- Numerous Sequence Group export variants before stable group identity exists.
- Large amounts of orchestration embedded directly in `CaseDetail.jsx`.

Critical incomplete workflows:

- Encrypted storage or meaningful confidentiality protection.
- Transactional backup/import across cases, metadata, and attachments.
- Comprehensive browser-level recovery and accessibility tests.
- Stable, typed relationship identity across all record types.
- Staleness/provenance controls for persisted Client Report prose.
- A clear distinction between Documents and Tracking Records.
- A deterministic Issue Report backed by explicit Issue metadata.

The largest architectural risk is that `App.jsx` and `CaseDetail.jsx` remain enormous stateful orchestrators spanning persistence, editors, relationships, exports, diagnostics, reports, and AI. The largest product risk is that users may treat locally stored sensitive material, PIN locks, AI-generated prose, browser-print “PDF” paths, or summary reports as safer or more authoritative than they are.

The next milestone should be integrity and workflow consolidation, not nested Sequence Groups. Stabilize persistence/import/attachment consistency, extract orchestration boundaries, and introduce minimal Issue metadata before building an Issue Report.

## 2. Repository and Validation Baseline

| Item | Result |
|---|---|
| Repository | `C:\Users\roryr\Desktop\Apps\toolstack-prove-it` |
| Branch | `main`, tracking `origin/main` |
| Commit | `728f44489de3122033791090ab29057d481b3de6` |
| Commit subject | `feat(reports): add deterministic case audit report` |
| Initial working tree | Clean |
| Node | `v24.12.0` |
| npm | `11.6.2` |
| Package | `toolstack-prove-it@0.0.0`, private |
| Tests | 758 passed, 0 failed, 0 skipped |
| Lint | Passed |
| Build | Passed |
| Diff check | Passed |
| Bundle warning | Main JavaScript chunk exceeds Vite's 500 kB warning threshold |

Major dependencies:

- React `^19.2.4`
- React DOM `^19.2.4`
- Vite `^8.0.1`
- Tailwind CSS `^4.2.2`
- `idb` `^8.0.3`
- JSZip `^3.10.1`
- Lucide React `^0.577.0`
- ESLint `^9.39.4`

The confirmed baseline is 758 tests, not the previously mentioned totals near 514.

The recent reporting work is committed and active:

- `728f444` — Case Audit Report
- `525bf59` — Incident Schedule and Chronology
- `17af7c1` — report capabilities and provenance

## 3. Current Product Definition

The active runtime is:

```text
main.jsx
  → App.jsx
      → dashboard / folders / case cards
      → selected case
          → CaseDetail.jsx
              → visible workspaces
              → record and editor components
              → case-domain helpers
              → saveCase()
                  → IndexedDB cases store
              → report model and documents
              → exports, print, clipboard and GPT workflows
```

Visible case workspace selectors:

1. Overview
2. Parties
3. Incidents
4. Evidence
5. To Watch
6. Documents
7. Records
8. Ledger
9. Timeline
10. Reports
11. Strategy
12. Narrative
13. Print Pack

The source `tabs` array has 12 entries; Records is inserted after Documents at render time.

Retained inactive or unavailable paths:

- `overview-legacy` conditional with no active tab.
- `ideas` conditional with no active tab.
- Quick Capture and Review Queue disabled through `SHOW_REVIEW_QUEUE = false`.
- Internal Report unavailable.
- Lawyer Pack unavailable.
- Legacy IndexedDB evidence store.
- Supabase synchronization disabled through `ENABLE_SUPABASE_REMOTE = false`.

## 4. Current Architecture

The canonical case source of truth is explicitly the IndexedDB `cases` store. React state holds the currently rendered working copy.

Supplementary sources of truth remain:

- Sequence Group metadata in localStorage.
- Folder definitions in localStorage.
- Quick Captures in localStorage.
- Attachment binaries in the IndexedDB `images` store.
- App-lock configuration in localStorage.
- Selected case/tab and backup metadata in local/session storage.
- Generated report prose persisted inside case data.

This is therefore a canonical case store with several non-transactional side stores, not one atomic persistence model.

| Layer | Current owner |
|---|---|
| Shell, dashboard and most editors | `App.jsx` |
| Selected-case workspaces and orchestration | `CaseDetail.jsx` |
| Normalization and mutations | `domain/caseDomain.js` |
| Case persistence | `storage.js` |
| Binary persistence | IndexedDB `images` |
| Report facts | `report/reportModel.js` |
| Structured reports | `report/*Document.js` |
| Legacy reports | `report/reportBuilder.js` |
| AI packages | GPT/reasoning export modules |
| AI mutation | GPT Delta and Sequence Group Delta modules |

## 5. Feature Inventory

| Feature | Runtime/reachability | Data/persistence | Current state | Risk | Recommendation |
|---|---|---|---|---|---|
| Dashboard and folders | `App`; reachable | cases in IndexedDB, folders in localStorage | Working | Moderate | Improve |
| Cases | `App → CaseDetail`; reachable | canonical case object | Mature | Moderate | Preserve |
| Case header/navigation | `CaseDetail`; reachable | case plus selected tab | Working | Low | Preserve |
| Overview | inline `CaseDetail`; reachable | derived health and metrics | Partial; placeholders remain | Moderate | Improve |
| Legacy Overview | conditional only; unreachable | case data | Legacy | Low | Remove after migration |
| Incidents | CaseDetail/card/modal; reachable | `case.incidents` | Working | Moderate | Preserve/improve |
| Evidence | CaseDetail/card/modal; reachable | `case.evidence` | Working | Moderate | Preserve/improve |
| Documents | `DocumentsTab` plus App editor; reachable | `case.documents` | Working | Moderate | Preserve |
| Tracking Records | `RecordsTab`; reachable | marker-based Documents | Partial/overlapping | High | Refactor |
| Ledger | `LedgerTab`; reachable | `case.ledger` | Working | Moderate | Improve |
| Strategy | `StrategyWorkspace`; reachable | `case.strategy` | Working, schema-version overlap | Moderate | Preserve/improve |
| To Watch | `WatchWorkspace`; reachable | `case.watchItems` | Working | Moderate | Preserve |
| Parties | `PartiesTab`; reachable | `case.parties` | Working | Moderate | Preserve/improve |
| Timeline | inline `CaseDetail`; reachable | derived from active records | Working | Moderate | Refactor |
| Narrative | inline `CaseDetail`; reachable | derived incident chains | Partial | Moderate | Improve |
| Reports | Report Centre; reachable | model/documents and generated prose | Mixed | High | Consolidate |
| Print Pack | inline `CaseDetail`; reachable | legacy builders | Working/duplicated | Moderate | Consolidate |
| Sequence Group Manager | modal; reachable | labels plus localStorage metadata | Working, fragile identity | High | Preserve then refactor |
| Sequence Group Audit | tools/AI workspace; reachable | derived | Working | Moderate | Preserve |
| AI Workspace | CaseDetail modal; reachable | packages and clipboard | Working, crowded | High privacy | Consolidate |
| GPT Delta import | App modal; reachable | validated case mutation | Experimental | High | Improve |
| Reasoning exports | dashboard/tools; reachable | sanitized projections | Working/duplicated | Moderate | Consolidate |
| Split Reasoning Package | AI Workspace; reachable | ZIP of sanitized JSON | Working | Moderate | Preserve |
| Backups/import | dashboard; reachable | cases, folders, captures, metadata, binaries | Working, non-atomic | High | Improve P0 |
| Settings | dashboard modal; reachable | localStorage | Working | Moderate | Improve |
| Diagnostics | dashboard and case tools; reachable | storage/case/image checks | Working, fragmented | Moderate | Consolidate |
| App lock | app shell; reachable | hashed localStorage PIN | Working access curtain | High if misunderstood | Improve |
| Case PIN | dashboard/case; reachable | plaintext inside case | Insecure | High | Replace |
| Quick Capture/review | guarded false; unreachable | localStorage | Legacy/inactive | Moderate | Defer/remove after decision |
| Attachment preview/store | shared preview; reachable | case metadata and IndexedDB binaries | Working | High integrity | Improve P0 |
| Search/filters | dashboard and workspaces | transient state | Working, inconsistent | Low | Improve |
| Floating Tools | CaseDetail; reachable | action dispatch | Working | Moderate | Improve |
| Developer/advanced tools | GPT Protocol, Link Map, repair and diagnostics | mixed | Working/specialist | Moderate | Keep advanced |

## 6. Case Domain and Schema

Canonical normalized top-level fields:

```text
id, name, category, status, folderId
notes, description, tags
createdAt, updatedAt

evidence[], incidents[], tasks[], strategy[]
ledger[], documents[], parties[], watchItems[]

actionSummary
privacyLock
generatedReportText
generatedReportVersions
activeGeneratedReportLanguage
auditLog
```

Important schema findings:

- `tasks[]` is normalized and persisted but has no active workspace.
- Tracking Records are Documents whose `textContent` contains `[TRACK RECORD]`.
- `generatedReportText` remains as a legacy English fallback beside `generatedReportVersions`.
- `strategySchemaVersion` defaults to 2 while current workflows also contain v3 structures.
- Sequence Group membership is a mutable string on each record.
- Sequence Group descriptions and empty-group identity are absent from the case and live in localStorage.
- `privacyLock.pin` stores a plaintext 4–6 digit PIN.
- Evidence can duplicate attachments between `attachments` and `availability.digital.files`.
- Date fields overlap across `date`, `eventDate`, `capturedAt`, `documentDate`, `dueDate`, `paymentDate`, `reviewDate`, and timestamps.
- Relationships overlap across generic and typed arrays.

| Area | Finding | Risk |
|---|---|---|
| IDs | UUID fallback uses `Math.random` where Web Crypto UUID is unavailable | Low/moderate |
| Status | Generic and subtype-specific normalization rules differ | Moderate |
| Dates | Historical fields use different validation and fallback behavior | High for chronology |
| Tracking Records | Type is encoded in document text | High |
| Attachments | Duplicate metadata shapes can diverge | High |
| Generated prose | No mandatory source revision on persisted Client Report text | High |
| Sequence Groups | Mutable label is identity and foreign key | High |
| Tasks | Read/persisted without active management UI | Moderate |
| Parties | No explicit duplicate-resolution identity | Moderate |
| Ledger | Invalid or blank numeric values can normalize to zero | Moderate |

Concepts not represented cleanly include conflicting assertions with provenance, one record directly belonging to multiple issues, stable issue identity across rename, issue-specific evidence roles, duplicate-party equivalence, attachment tombstones, explicit uncertainty, and report approval state.

## 7. Persistence and Storage

| Store/key | Owner | Read/write path | Validation/recovery |
|---|---|---|---|
| IndexedDB `proveit-db/cases` | Cases | `getAllCases`, `saveCase`, delete/import | normalization, shrink guard, emergency snapshot |
| IndexedDB `evidence` | Legacy evidence | legacy helpers | transitional, not canonical |
| IndexedDB `images` | Attachment binaries | save/get/delete image | integrity diagnostics, separate writes |
| `toolstack.proveit.v1.folders` | Folders | App localStorage effects | normalized; missing imported folders recovered |
| `...captures` | Quick Capture | App localStorage | normalized; UI disabled |
| `...sequenceGroupMeta` | Group metadata | sequence-group helpers | normalized and mergeable |
| `...appLock` | App lock | PBKDF2 configuration | validated; corrupt reset path |
| `...appLock.sessionUnlocked` | Unlock convenience | sessionStorage | best effort |
| `...selectedCase`, `...activeTab` | UI continuity | App effects | minimal validation |
| `...rescueSnapshot` | Structural recovery | periodic localStorage snapshot | binary stripped; zero-case overwrite refused |
| `...emergencyBackup.*` | Destructive guard | storage helpers | best effort, quota dependent |
| Backup timestamp/meta keys | Backup reminder | localStorage | best effort |

Verified safeguards:

- Startup does not save an empty default case over real data.
- Suspicious non-empty-to-empty core-array overwrites are blocked unless explicitly overridden.
- Restore/import creates an emergency backup first.
- Folder deletion unfiles affected cases before deleting the folder.
- Case deletion cleans known image IDs and preserves IDs still referenced by another case.
- Full Backup includes attachment payloads when image data is available.
- Partial attachment restoration is counted and surfaced.

Remaining risks:

- No transaction spans cases, images, folders, captures, and group metadata.
- Import can partially succeed case by case.
- Metadata and binary restoration can diverge.
- Emergency backups can exceed localStorage quota.
- Rescue snapshots duplicate case structures without binaries.
- Group metadata and case membership are saved separately.
- App settings are not part of Full Backup.
- Data is unencrypted and local to one browser profile.

## 8. Record-Type Findings

### Incidents

Working and well covered. Supports chronology, milestone, status, evidence status, typed incident references, generic links, evidence links, parties, attachments, tags, notes, Sequence Group membership, conversion, deletion cleanup, exports, and reports.

Gaps: shallow status semantics, overlapping relationship representations, no structured conflicting-account model, and substantial App/CaseDetail orchestration.

### Evidence

Working and among the stronger record types. Supports evidence role/type, verification status, function summary, source, availability, attachments, incidents, generic links, parties, chronology, conversions, reports, and audits.

Gaps: attachment duplication, limited verification provenance, and no explicit verifier/method/timestamp structure.

### Documents

Working. Supports category, date, source, summary, full text, attachments, links, parties, Sequence Group membership, conversion, and reports.

Gaps: no extraction/verification provenance; tracking records rely on a text marker; document tags accepted in GPT input are explicitly not persisted.

### Ledger

Working but semantically mixed. Supports amounts, currency, dates, status, payment method/reference/counterparty, proof type/status, batches, parties, links, exports, and packs.

Gaps: status notes and money entries share a collection, blank values can become zero, currencies require separate totals, and provenance is weakly typed.

### Strategy

Working and increasingly structured. Supports objective, rationale, desired outcome, type, priority, review date, decision status, owner, assumptions, risks, next steps, links, parties, attachments, archive state, and reports.

Gaps: schema v2/v3 overlap; legacy description and notes remain independent; ownership is a raw party ID.

### To Watch

Working. Supports status, priority, category, focus, rationale, triggers, review/check dates, observations, outcome, parties, records, groups, tags, attachments, and reports.

Gaps: `latestObservation` overlaps the observation array; invalid category/priority strings are retained; escalation is not a structured event.

### Parties

Working. Supports identity, aliases, roles, organization/job details, contacts, address, relationship to case, status, tags, notes, and confidentiality.

Gaps: no duplicate merge flow, no party-to-party relationships, and confidentiality does not constrain exports.

### Tracking Records

Reachable and useful, with structured tables, metadata sections, expansion, and GPT export. Architecturally they are not a distinct record type; they are Documents identified by `[TRACK RECORD]`. Their derived-ledger relationship overlaps Documents and Ledger. Preserve the user value but introduce an explicit subtype before extension.

## 9. Linking and Relationships

Current mechanisms:

- `linkedRecordIds`
- `linkedPartyIds`
- `linkedEvidenceIds`
- `linkedIncidentIds`
- `linkedIncidentRefs`
- `basedOnEvidenceIds`
- Strategy owner party IDs
- Evidence availability and tracking-record provenance
- Sequence Group strings
- Report-specific supporting-record projections

There is no single authoritative relationship entity or typed edge model.

Incident/evidence links receive special bidirectional synchronization. Most other links are one-way, with reverse links derived by scanning collections. Reports resolve the arrays into typed references where possible.

Deletion cleanup traverses major collections and removes known IDs. Import normalization deduplicates arrays but cannot establish semantic type correctness for generic IDs. Missing targets become diagnostics or unresolved report references.

Risks include raw-ID collision, disagreement between generic and typed arrays, variable reverse-link behavior, semantically invalid imported IDs, legacy task references, scope differences between reports, and stale links surviving unsupported paths.

Architecture recommendation: first create a canonical typed-edge projection for diagnostics, reports, deletion, and import validation. Migrate stored relationships only after parity tests demonstrate equivalence.

## 10. Sequence Group Findings

Verified current behavior:

- One string-valued `sequenceGroup` per supported record.
- Group identity is the display name.
- Metadata is keyed by `caseId → groupName` in localStorage.
- Metadata-only and empty groups are supported through that metadata store.
- Display ordering is alphabetical or derived, not a persisted user order.
- Create, select, rename, edit description, delete, move, split, merge, ungroup, filtering, and bulk operations are active.
- Rename and merge update records and separately update metadata.
- Deletion clears memberships but retains records.
- Audits support selected group, all groups, full case by groups, and group index exports.
- Reports and reasoning packages consume flat group names.

Inconsistency: newer paths include Watch records; older helpers and some membership/export paths focus on incidents, evidence, documents, and strategy. Ledger participates in reports and some exports but the canonical ledger normalizer does not establish a Sequence Group field.

Hierarchy-breaking assumptions:

- Names are IDs.
- Every record has at most one direct group.
- Names are embedded in records, exports, prompts, filenames, deltas, tests, and report scopes.
- Group metadata is a map, not an entity collection.
- Imports merge by name.
- Rename is a bulk foreign-key rewrite.
- The manager UI assumes a flat selected-group list.

Hierarchy readiness: **not ready for safe implementation**.

Required prerequisite schema:

```text
issueGroups: [{
  id,
  name,
  description,
  parentId | categoryId,
  order,
  createdAt,
  updatedAt
}]

record.issueGroupId
```

Migration complexity is medium-to-high. Data conversion is manageable, but compatibility across backup, import, deltas, audits, reports, filenames, and UI is broad.

## 11. Reports Findings

### Active Report Centre

| Report | Runtime | Scope/output | State |
|---|---|---|---|
| Management Report | legacy builder/renderer | case; preview/print | Working summary, five-entry timeline bound, optional polish |
| Investigation Report | thread/case-bundle builder | case/group; preview/print | Working but bounded to 12 evidence and 12 documents |
| Case Audit Report | central model → document | case/group; preview/print/MD/JSON | Active, complete, deterministic |
| Incident Schedule | central model → document | case/group; preview/print/MD/JSON | Active, complete |
| Chronology Report | central model → document | case/group; preview/print/MD/JSON | Active, complete |
| Evidence Pack | model → document → compatibility renderer | case/group; preview/print/MD/JSON | Active, complete |
| Document Pack | model → document → compatibility renderer | case/group; preview/print/MD/JSON | Active, complete |
| Ledger Pack | model → document → compatibility renderer | case/group; preview/print/MD/JSON | Active, complete |
| Client Report | prompt/paste/persisted prose | case; preview/print | Working but AI-dependent |
| Action Plan | deterministic legacy builder | case/group; preview/print/MD | Working summary |

Other report surfaces:

- Print Pack remains active outside the central report-document runtime.
- Advanced Reports exposes older flows.
- Internal Report is unavailable.
- Lawyer Pack is unavailable.
- Sequence Group audits and GPT report packs sit outside the Report Centre.

The reporting foundation is **mixed but usable**:

- A strong factual projection exists across six record types.
- Six reports have shared serializable report documents.
- Definitions are authoritative for declared scope and output.
- Capability tests show no active declared/rendered mismatch.
- Fingerprints are deterministic and binary-safe.
- Evidence, Document, and Ledger still project back into legacy renderer shapes.
- Management, Investigation, Client, and Action bypass the shared document dispatcher.
- Report orchestration remains in `CaseDetail`.
- `reportBuilder.js` is 2,186 lines.
- Normal runtime timestamps use the current time unless explicitly injected.
- Fingerprints are useful revision identifiers but are not cryptographic integrity proofs.

Issue Report recommendation: do not relabel the bounded Thread Issue Report as complete. Add stable Issue metadata, then create a deterministic report document on the central model. Reuse chronology, evidence coverage, parties, actions, and appendices; keep “current position” explicitly authored.

## 12. AI and GPT Workflow Findings

| Workflow | Input/output | Mutation | Main risk |
|---|---|---|---|
| Reasoning Snapshot | Whole sanitized case JSON | No | Broad confidential-data disclosure |
| Split Reasoning Package | ZIP of JSON sections | No | Stale distributed copies |
| Missing Summary audit | Evidence subset/prompt | No | AI wording may lose provenance |
| Ungrouped audits | Records and groups | No | Suggestions use mutable names |
| Weak Links audit | Diagnostics and summaries | No | Duplicates built-in diagnostics |
| Chain Completion | One group plus context | No | Direct/link scope differences |
| Full Chain pack | Bounded chain context | No | Potentially extensive sensitive context |
| Management builder | Whole case or group | No direct mutation | AI prose may be treated as fact |
| Case Slice | Selected IDs plus links | No | Manual raw-ID selection |
| Protocol Pack | Instructions/examples | No | Developer complexity |
| GPT Delta v1/v2/v3 | Validated JSON delta | Yes | Untrusted import and overlapping contracts |
| Sequence Group Delta | Move/rename/merge/clear | Yes | Mutable group identity |
| Client Report | Prompt and pasted response | Persists prose | No mandatory source-revision staleness |
| Narrative polish | Report prompt/paste | Persists limited prose | Provenance depends on user discipline |

Positive controls:

- Binary fields are generally excluded.
- GPT imports use allowlists, length limits, case-target checks, duplicate checks, protected fields, and previews.
- v3 confines mutation mainly to Strategy and Watch operations.
- Sequence Group Delta rejects unknown and conflicting operations.
- Reports distinguish deterministic sections from optional narrative polish.

Remaining problems:

- Multiple GPT Delta contracts increase maintenance and security burden.
- Prompts and report composition remain embedded in UI-oriented files.
- Clipboard/download workflows create uncontrolled copies.
- Party inclusion differs between packages.
- Confidentiality labels do not automatically filter exports.
- Persisted AI prose does not consistently store prompt, model, time, and case fingerprint.
- Management and Client labels can imply more authority than the workflow supplies.

## 13. Export and Backup Findings

| Export family | Format | Importable | Binary | Status |
|---|---|---:|---:|---|
| Full App Backup | JSON | Yes | Yes | Primary backup |
| Single Case Full Backup | JSON | Yes | Yes | Primary transfer/backup |
| Rescue Snapshot | localStorage JSON | Structural | No | Emergency recovery |
| Case Reasoning variants | JSON | No | No | Legacy/current AI packages |
| Reasoning v3 | JSON | No | No | Preferred structured snapshot |
| Split Reasoning Package | ZIP/JSON | No | No | Large-case AI package |
| Link Map | JSON/clipboard | No | No | Technical audit |
| Sequence Group Audit | JSON/MD/print | No | No | Working |
| All Group Audits | JSON/MD | No | No | Working |
| Full Case by Groups | JSON/MD | No | No | Working |
| Sequence Groups Index | JSON/MD | No | No | Working |
| Report documents | JSON/MD/print | No | Metadata only | Six reports |
| Action Plan | MD/print | No | No | Working |
| GPT audit packs | JSON/MD/clipboard | No | No | Numerous |
| Protocol Pack | JSON/MD | No | No | Developer aid |
| Tracking Record GPT | JSON/clipboard | No | No | Working |
| Print Pack | Browser print | No | Rendered | Working |

No dedicated CSV export was found.

Export concerns:

- Filename sanitization is duplicated.
- JSON, text, ZIP, preview download, and print helpers are separate.
- Reviewed object URLs are revoked.
- MIME declarations vary between helpers.
- New report documents are deterministic; legacy exports have their own order rules.
- Backup contract `2.0` is versioned, while non-importable packages use independent versions.
- Full Backups can become very large because binaries are embedded as data URLs.
- AI packages can expose more context than a narrow task requires.
- Browser print is not a generated PDF and should be labeled “Print / Save as PDF.”

Terms should remain distinct:

- **Backup**: complete and importable recovery.
- **Archive**: durable historical snapshot; not separately implemented.
- **Report**: human-readable output.
- **AI package**: sanitized model input, not importable.
- **Audit**: deterministic quality/relationship output.
- **Data transfer**: importable scoped data.

## 14. Attachment Findings

```text
Record attachment metadata
  └─ storage.imageId
       └─ IndexedDB image record containing dataUrl
```

Inline preview supports PNG, JPEG, WebP, GIF, and PDF. Other documents and email files show metadata but are not rendered as active HTML. PDF uses a browser iframe. No OCR or content analysis was performed.

Strengths:

- MIME allowlist for inline preview.
- Blob URL revocation.
- Missing-image, orphan, and metadata-mismatch diagnostics.
- Case-deletion binary cleanup with shared-reference preservation.
- Full Backup binary inclusion/restoration.
- Warnings at 10 MB and 25 MB.

Risks:

- Files above 25 MB are warned about, not rejected.
- Data URLs inflate memory and backups.
- Metadata and binary writes are non-atomic.
- Some removal paths may leave binaries.
- No content-hash deduplication.
- Restored IDs can collide.
- No magic-byte validation, malware scanning, quota preflight, or streaming ZIP.
- Preview failures lack detailed recovery guidance.

## 15. UI and Accessibility Findings

Shared components are active across several record modules:

- `RecordCardShell`
- `RecordBadge`
- `RecordActions`
- `RecordMetadataRow`
- `RecordLinksRow`

They improve semantic consistency, responsive wrapping, missing-link display, and dark styling. Ledger, Timeline, Reports, dashboard cards, editors, and legacy report layouts retain separate patterns.

Source-level responsive findings:

- Mobile workspace selector replaces desktop tabs.
- Manager/workspace layouts contain responsive stacks.
- Shared cards include explicit dark classes.
- Reduced-motion and print styles exist.
- Large inline branches make responsive regressions likely.
- Dashboard/settings/PIN/import surfaces contain uneven dark styling.
- Overview contains visible placeholders.
- The desktop tab bar is dense at tablet widths.

Modal findings:

- AI Workspace and Sequence Group management have Escape/focus-containment coverage.
- Several dialogs use `role="dialog"` and `aria-modal`.
- Many App-level overlays lack verified dialog semantics, focus trap, or focus restoration.
- Destructive operations often use `window.confirm`.
- File preview lacks a complete verified dialog contract.
- Footer, validation, and scrolling patterns are inconsistent.

Accessibility severity:

| Severity | Finding |
|---|---|
| High | Focus trapping/restoration is not consistent across core editors and settings/PIN/import dialogs |
| High | No comprehensive live-browser keyboard and screen-reader workflow coverage |
| Moderate | Several overlays lack explicit dialog semantics |
| Moderate | Dense tabs and tables may be difficult at tablet/mobile widths |
| Moderate | Dark-mode coverage is uneven outside recently shared components |
| Moderate | Icon-only actions need systematic accessible-name verification |
| Low | Shared cards provide non-colour selected treatment and semantic buttons in tested paths |

No formal WCAG compliance claim is made. A current interactive browser session was not available for a complete desktop/tablet/390 px and light/dark matrix. UI conclusions combine rendered test evidence with source inference.

## 16. Security and Privacy Findings

### Confidentiality

High risks:

- Case data and binaries are unencrypted in browser storage.
- Case PINs are plaintext inside cases and backups.
- The app-level PIN uses PBKDF2-SHA-256 but gates only the UI; it does not encrypt storage.
- Backups, clipboard output, AI packages, print windows, and browser caches create plaintext copies.
- Party confidentiality does not constrain exports.
- AI use requires manual disclosure to external systems.

### Integrity

- Full imports depend heavily on normalization rather than a strict full schema.
- General backup imports lack explicit size/depth limits.
- Independent stores prevent atomic restoration.
- Group labels are mutable foreign keys.
- Generic links lack type identity.
- Backups and report fingerprints are not cryptographically signed.
- Dangerous-key rejection should be explicit in all import validators.

### Availability and data loss

- Browser storage is the only durable source.
- Eviction, profile deletion, corruption, quota exhaustion, or device loss can remove data.
- Large base64 backups can exhaust memory or quota.
- Emergency backups also depend on localStorage capacity.
- No verified automatic external backup exists.
- Disabled Supabase paths are not recovery.

Practical recommendations:

1. Label locks as privacy screens, not encryption.
2. Remove plaintext case PIN storage or implement real encrypted case envelopes.
3. Add strict import size, depth, and schema checks before mutation.
4. Add backup verification and restore dry-run summaries.
5. Add confidentiality-aware export warnings.
6. Add storage-quota and attachment-integrity health indicators.
7. Do not enable remote AI/database access without threat modeling and explicit consent boundaries.

## 17. Performance Findings

Measured build artifacts:

| Artifact | Raw | Gzip |
|---|---:|---:|
| Main JavaScript | 1,505.81 kB | 350.97 kB |
| CSS | 92.27 kB | 15.52 kB |
| Header image | 2,447.99 kB | — |
| Logo image | 678.67 kB | — |
| IndexedDB chunk | 3.93 kB | 1.51 kB |

The build warns about chunks above 500 kB.

Source-supported risks:

- CaseDetail repeatedly derives links, chronology, reports, filters, narratives, and diagnostics.
- Some projections are memoized, but many helpers and objects are recreated each render.
- Multiple report models/documents can coexist.
- Image hydration loads data into an application-level cache.
- JSON stringify, base64 backup assembly, and JSZip generation run on the main thread.
- Large lists are not virtualized.
- Reports, Print Pack, AI, and managers are eagerly bundled.

No claim about measured interaction latency is made; no representative large-case benchmark was run.

Priority improvements:

1. Dynamically import Reports, Print Pack, AI, diagnostics, and managers.
2. Add a memoized selected-case index for ID and reverse-link resolution.
3. Build only the active report document.
4. Lazy-load preview binaries.
5. Move large ZIP/serialization work to a worker if case-size measurements justify it.
6. Optimize the 2.45 MB header image.

## 18. Code Architecture Findings

Largest files:

| File | Lines |
|---|---:|
| `CaseDetail.jsx` | 7,851 |
| `App.jsx` | 5,655 |
| `caseDomain.test.js` | 3,014 |
| `reportBuilder.js` | 2,186 |
| `caseDomain.js` | 2,133 |
| `gptDelta.js` | 1,705 |
| `RecordModal.jsx` | 1,663 |
| `gptAuditPacks.js` | 1,271 |
| `SequenceGroupManager.jsx` | 1,087 |

There are 17 files of at least 500 lines and 11 files of at least 1,000 lines.

`CaseDetail.jsx` currently owns:

```text
Case header and navigation
Workspace layout
Overview and health metrics
Incident/evidence filtering and rendering
Timeline and narrative construction
Sequence Group orchestration
Sequence Group audits and downloads
AI Workspace and clipboard operations
Report Centre state and documents
Legacy reports and renderers
Client Report prompt/paste flow
Print Pack
Diagnostics and incident-date repair
Record conversion
Floating tools and numerous modal states
```

Recommended extraction order:

1. Report Centre controller and report output service.
2. Sequence Group controller coordinating case and metadata writes.
3. AI Workspace controller and package registry.
4. Timeline/Narrative workspaces with a shared indexed case view.
5. Incident/Evidence workspace containers.
6. Diagnostics/tool controller.
7. Case header/action-summary shell.

This should be incremental and protected by characterization tests, not a rewrite.

Additional debt:

- UI files still contain domain/export logic.
- Filename and download helpers are duplicated.
- Tracking Record parsing is a hidden subtype system.
- Report adapters prolong dual architecture.
- An automated dependency-cycle check should be added.
- Source-string tests can preserve obsolete structure.

## 19. Test-Suite Findings

- 758 tests.
- 116 test files.
- 27 explicitly named `*.source.test.*` files.
- At least six explicitly named rendered/integration files.
- No dedicated end-to-end browser suite was found.
- `runtime-browser-proof.mjs` is an ad hoc DevTools script and is not part of `npm test`.

Strong coverage:

- Domain normalization and mutation.
- Sequence Group operations and metadata.
- Report model, definitions, documents, adapters, outputs, and renderers.
- GPT Delta and Sequence Group Delta validation.
- Export sanitation.
- Persistence guards and backups.
- Diagnostics and attachment integrity.
- Shared record-card primitives.

False-confidence areas:

- Source-string tests verify imports/classes/handlers without user interaction.
- Several visual tests inspect class names rather than pixels/layout.
- Dashboard, editor, lock, and import paths lack full browser coverage.
- Persistence stores are mocked independently, so cross-store atomicity is not exercised.
- Print, download, clipboard permission, and quota failures are not realistically tested.
- No large-case fixture or sustained rendering benchmark was found.
- Accessibility checks are focused rather than systematic.

Recommended testing pyramid:

- Broad domain/report/export units.
- Rendered component tests for editors and dialogs.
- Browser integration using real IndexedDB/localStorage.
- Small Playwright suite for create/edit/link/reload/backup/restore/delete.
- Accessibility scans and keyboard tests for each modal family.
- Malformed, oversized, deeply nested, and malicious import fixtures.
- One representative large-case performance fixture.

## 20. Error Handling Findings

| Area | Current handling |
|---|---|
| Case save/delete | Mostly caught; console plus notices in some paths |
| Suspicious overwrite | Explicit and recoverable |
| Full Backup | Console plus blocking alert |
| Import | Partial-result notices, console, generic alert on total failure |
| Attachment restore | Log-and-continue plus failed-attachment summary |
| Clipboard | Often console plus local feedback; inconsistent |
| Sequence export | Frequently console-only |
| Report output | Feedback state plus console |
| Print popup | Inconsistent across paths |
| Storage diagnostics | Explicit error panel |
| Rescue restore | Explicit success/warning/error |
| Malformed records | Normalization plus diagnostics |
| Stale links | Diagnostics/report findings |
| Lock corruption | Explicit reset workflow |

Diagnostics are useful but fragmented:

- Dashboard Storage Diagnostics checks stores, counts, and rescue state.
- Case Diagnostics checks links, chronology, coverage, duplicates, and groups.
- Attachment Integrity checks metadata and payloads.
- Operational Integrity checks stale reasoning exports, Strategy, and Watch.
- Case Audit overlaps these in report-document form.

Recommendation: introduce one shared diagnostic finding contract with codes, severity, navigation, remediation state, and export. Storage Diagnostics and Case Audit can remain distinct views over shared findings.

## 21. Nested Issue Readiness

### Option A — Parent/child Sequence Groups

Advantages:

- Real issue/sub-issue containment.
- Natural hierarchical reporting and navigation.

Disadvantages:

- Requires stable IDs, parent constraints, cycle prevention, ordering, migration, nested UI, and changed scope semantics.
- Highest import/report/test burden.
- Ambiguous descendant counts and cross-group evidence behavior.

Risk: high. Current suitability: low.

### Option B — Issue categories

Advantages:

- Adds broad organization without changing record membership.
- Keeps Sequence Groups as working issue threads.
- Easier reporting, filtering, migration, and reversal.

Data changes:

```text
category entities or category string
groupMetadata[group].categoryId
```

Risk: moderate. Current suitability: best near-term option after stable group IDs.

### Option C — Flat groups with tags

Advantages:

- Lowest implementation burden.
- Flexible many-to-many themes.
- Easy filtering.

Disadvantages:

- Weak semantics and vocabulary drift.
- Does not solve ownership, status, or report identity.

Risk: low-to-moderate. Suitable when the need is discovery, not hierarchy.

Recommendation: do not make nested Sequence Groups the next milestone. First introduce stable group IDs and minimal Issue metadata. If broader grouping remains necessary, prefer Option B. Use tags only for cross-cutting themes and reserve real hierarchy for demonstrated parent/child workflows.

## 22. Issue Report Readiness

Deterministic sections possible now:

- Case and group identifiers.
- Group description.
- Direct record counts.
- People involved from links.
- Canonical chronology.
- Evidence map and unresolved links.
- Action Plan data.
- Strategy risks and next steps.
- Watch concerns.
- Record appendices and source fingerprint.

Sections requiring new metadata:

- Issue purpose distinct from a description.
- Issue status and priority.
- Owner.
- Reporting period.
- Authored current position.
- Explicit outstanding-issue list.
- Review/approval state.
- Stable identity across rename.
- Category or parent relationship.

Minimum metadata:

```text
id
name
description or purpose
status
priority
ownerPartyId
reportingPeriodStart
reportingPeriodEnd
currentPosition
createdAt
updatedAt
```

Recommendation: build the Issue Report only after this metadata exists. Facts, chronology, evidence map, and appendices should remain deterministic. “Current position” should be authored or explicitly approved; AI factual synthesis should not be the default.

## 23. Classification Matrix

| Subsystem | Classification |
|---|---|
| Case CRUD/domain normalization | Preserve |
| Incident/evidence workflows | Preserve and improve |
| Documents | Preserve |
| Tracking Records inside Documents | Refactor |
| Ledger | Improve |
| Strategy | Preserve and improve |
| To Watch | Preserve |
| Parties | Improve |
| Flat Sequence Group operations | Preserve |
| Label-based group identity | Replace |
| Separate group metadata store | Refactor |
| Central report model/documents | Preserve |
| Legacy report builders | Consolidate |
| Report compatibility adapters | Remove after migration |
| Client Report AI prose | Improve |
| Print Pack | Consolidate |
| GPT audit variants | Consolidate |
| GPT Delta import | Improve; defer expansion |
| Full Backup | Preserve and improve |
| Rescue/emergency snapshots | Preserve |
| Legacy evidence store | Remove after migration |
| Quick Capture/review queue | Defer; remove after product decision |
| Overview placeholders | Replace |
| Legacy Overview/Ideas branches | Remove after migration |
| App lock | Improve |
| Plaintext case PIN | Replace |
| Supabase integration | Defer |
| Shared record components | Preserve |
| Modal/form patterns | Consolidate |
| App/CaseDetail orchestration | Refactor |

## 24. Risk Register

| ID | Risk | Likelihood/impact | Evidence | Mitigation/phase | Blocking |
|---|---|---|---|---|---|
| R1 | Browser-local data loss | Medium/critical | No durable external source | Verified recovery and quota health; Stage 1 | Yes |
| R2 | Partial import corruption | Medium/high | Case-by-case cross-store writes | Dry run, journal, rollback; Stage 1 | Yes |
| R3 | Attachment orphan/missing payload | Medium/high | Separate metadata/binary paths | Atomic service and reconciliation; Stage 1 | Yes |
| R4 | Plaintext confidentiality | High/high | Unencrypted storage/backups | Warnings and encryption roadmap | Yes for sensitive deployment |
| R5 | Case PIN misrepresented as security | High/high | PIN stored inside case | Remove/replace; Stage 1 | Yes |
| R6 | Large-file memory/quota failure | Medium/high | Base64, ZIP, warning-only limits | Preflight, limits, worker/streaming | No |
| R7 | Stale Client Report prose | High/medium | No source revision | Fingerprint and stale banner; Stage 2 | No |
| R8 | AI provenance loss | Medium/high | Paste/polish workflows | Store model/prompt/time/fingerprint | No |
| R9 | Group rename fragility | Medium/high | Labels are IDs | Stable IDs; Stage 3 | Yes for hierarchy |
| R10 | CaseDetail integration defects | High/high | 7,851-line component | Incremental extraction; Stage 2 | No |
| R11 | Insufficient browser testing | High/high | Mostly unit/source tests | Playwright recovery suite; Stage 1 | Yes |
| R12 | Legacy report duplication | High/medium | Dual builders and surfaces | Incremental migration; Stage 2 | No |
| R13 | Local-only source limitations | High/high | One browser profile | Backup now; secure sync later | No |
| R14 | Generic link ambiguity | Medium/high | Raw untyped IDs | Typed-edge projection; Stage 2 | No |
| R15 | Emergency backup quota failure | Medium/high | localStorage best effort | Size check and IndexedDB journal | Yes |

## 25. Technical Debt Register

| Debt | Consequence | Remediation | Scope/dependency |
|---|---|---|---|
| CaseDetail owns report orchestration | Large integration/rerender surface | Extract Report Centre controller | Medium; parity tests |
| App owns persistence and editors | Difficult failure isolation | Case repository/editor controllers | Large, incremental |
| Labels are group IDs | Rename rewrites records/metadata | Stable group entities | Medium-high |
| Group metadata outside case | Non-atomic writes/backups | Store entities with case | Medium; schema version |
| Tracking type encoded in text | Fragile parsing and overlap | Explicit document subtype | Medium |
| Attachment stores split | Orphans and partial restore | Attachment repository/journal | Medium-high |
| Multiple download helpers | Inconsistent names/MIME/errors | Shared export service | Small-medium |
| Multiple filename sanitizers | Divergent filenames | One tested sanitizer | Small |
| Three GPT Delta contracts | Maintenance/security burden | Consolidate lifecycle | Medium |
| Legacy reports bypass model | Divergent facts/scopes | Migrate one at a time | Large |
| Source-string UI tests | Structure without behavior confidence | Rendered/browser replacements | Medium |
| Client report lacks staleness | Old prose appears current | Persist fingerprint | Small-medium |
| Date fields vary | Chronology inconsistency | Canonical date contract | Medium |
| Generic links untyped | Collision and cleanup ambiguity | Typed-edge projection | Medium |
| Overview placeholders | Misleading UI | Real metrics or removal | Small |
| Legacy evidence store | Confusing ownership | Remove after usage verification | Small-medium |

## 26. Prioritised Product Backlog

### P0 — Integrity and safety

1. **Transaction-aware backup/import**
   - User problem: imports can partially change local data.
   - Acceptance: schema/size/ID dry run, rollback or operation journal, final integrity summary.
2. **Attachment reconciliation**
   - User problem: attachment cards and binaries can diverge.
   - Acceptance: list, export, repair, or safely remove missing/orphaned payloads.
3. **Browser recovery E2E suite**
   - Acceptance: create → attach → reload → backup → delete → restore preserves links, metadata, and binary.
4. **Replace plaintext case PIN**
   - Acceptance: no plaintext PIN in IndexedDB or backups; UI accurately explains protection.
5. **Storage quota and large-file guard**
   - Acceptance: projected sizes and blocking guidance before unsafe actions.

### P1 — Core workflow

- Stable Sequence Group IDs without hierarchy.
- Canonical typed-link projection and validation.
- Explicit Tracking Record document subtype.
- Extract Report Centre and Sequence Group controllers.
- Consolidate diagnostics.

### P2 — Usability and communication

- Provenance/staleness banners for Client and polished Management reports.
- Replace Overview placeholders.
- Consolidate report/export discovery.
- Standardize modal semantics, validation, and errors.
- Improve responsive, dark-mode, and accessibility browser coverage.

### P3 — Strategic enhancements

- Minimal Issue metadata.
- Deterministic Issue Report.
- Issue categories if user need is confirmed.
- Optional stable typed relationship storage.
- Secure consent-controlled synchronization.

### P4 — Optional polish

- Image optimization.
- Visual report refinements.
- CSV only after demonstrated demand.
- Cross-case visualization after model stabilization.

## 27. Recommended Roadmap

### Stage 1 — Integrity and stabilization

Objective: make browser-local data recoverable and failures visible.

Deliverables:

- Real-browser persistence/recovery tests.
- Import dry-run, limits, and rollback/journal behavior.
- Attachment reconciliation and quota checks.
- Case PIN resolution.
- Backup verification receipt.

Completion criterion: a representative binary-rich case survives reload, export, deletion, import, and simulated partial failure without silent loss.

### Stage 2 — Workflow consolidation

Objective: reduce integration risk without redesigning the UI.

Deliverables:

- Report Centre extraction.
- Shared export/download service.
- Shared diagnostics findings.
- Typed relationship index.
- Client Report provenance and staleness.
- Replace high-value source tests with behavior tests.

Completion criterion: active behavior remains at parity while CaseDetail no longer owns report/export/diagnostic orchestration.

### Stage 3 — Issue communication

Objective: support reliable issue-level reporting.

Deliverables:

- Stable group IDs.
- Minimal Issue metadata.
- Deterministic Issue Report document.
- Authored-versus-derived labels.

Completion criterion: rename-safe Issue Report with fingerprinted deterministic facts and no default AI factual synthesis.

### Stage 4 — Issue organization

Objective: add broader organization only after need is validated.

Preferred path: Issue categories over existing groups. Implement hierarchy only if real cases demonstrate parent/child semantics that categories cannot meet.

Completion criterion: backup/import/report compatibility and reversible migration are proven.

### Stage 5 — Strategic platform work

Objective: address local-only limits.

Possible deliverables:

- Encrypted local envelopes.
- Authenticated API/database.
- Consent-controlled AI gateway.
- Versioned server backups and cross-case search.

This requires a separate threat model and product decision.

## 28. Current and Recommended Architecture Diagrams

### Current

```text
React UI
├─ main.jsx
└─ App.jsx
   ├─ Dashboard / folders / settings / locks
   ├─ Editors and import/backup
   └─ CaseDetail.jsx
      ├─ Workspaces and record cards
      ├─ Sequence Group management
      ├─ Diagnostics
      ├─ Reports / Print Pack
      └─ AI Workspace / GPT Delta

Domain and projections
├─ caseDomain
├─ linking / health / narrative
├─ Sequence Group helpers
├─ reportModel → report documents
└─ legacy report builders/adapters

Persistence
├─ React state
├─ IndexedDB
│  ├─ cases — canonical case data
│  ├─ images — attachment binaries
│  └─ evidence — legacy
├─ localStorage
│  ├─ folders and Quick Captures
│  ├─ Sequence Group metadata
│  ├─ rescue/emergency snapshots
│  └─ locks/settings
└─ sessionStorage unlock flag

Outputs
├─ Full Backups / imports
├─ Reports / browser print
├─ Audit and link exports
└─ AI / reasoning / protocol packages
```

### Recommended near-term

```text
React shell
├─ Dashboard feature
└─ Case workspace shell
   ├─ Record workspaces
   ├─ Issue/Sequence workspace
   ├─ Report Centre
   └─ Diagnostics

Application services
├─ Case service
├─ Attachment service
├─ Relationship index
├─ Issue/Sequence service
├─ Report service
├─ Import/backup service
└─ AI package and validated-delta service

Versioned domain
├─ Case and typed records
├─ Stable issue-group entities
├─ Typed relationship projection
└─ Report model/documents

Local repository
├─ IndexedDB cases and attachments
├─ Transaction/operation journal
├─ Versioned migrations
└─ localStorage only for small UI preferences

External files
├─ Verified importable backups
├─ Deterministic reports/audits
└─ Explicitly non-importable AI packages
```

## 29. Quantitative Findings

| Metric | Finding |
|---|---:|
| Tests | 758 |
| Test files | 116 |
| Explicit source-test files | 27 |
| Active Report Centre definitions | 10 |
| Shared report-document builders | 6 |
| Factual report-model record types | 6 |
| Primary active case collections | 8 plus legacy `tasks` |
| Visible case workspace selectors | 13 |
| IndexedDB stores | 3 |
| Files at least 500 lines | 17 |
| Files at least 1,000 lines | 11 |
| Largest source file | 7,851 lines |
| Main bundle | 1,505.81 kB raw / 350.97 kB gzip |
| Largest static asset | 2,447.99 kB |
| Explicit unreachable UI branches | Quick Capture queue, legacy Overview, Ideas |
| Explicit unavailable reports | Internal Report, Lawyer Pack |
| Major legacy report paths | Management, Investigation/Bundle, Client, Action, Print Pack |
| Duplicate utility families | filename sanitation, download helpers, link resolution, report projections |

Export formats cannot safely be reduced to one feature count because many named exports share formats but implement different contracts. Verified physical formats are JSON, Markdown/text, ZIP, clipboard text, and browser print.

## 30. Files Inspected

Significant inspected groups; this does not claim line-by-line inspection of every test file:

- Application shell: `src/main.jsx`, `src/App.jsx`, `src/App.css`, `src/index.css`.
- Domain: `src/domain/caseDomain.js`, record-form, linking, Quick Capture, Watch, and incident-date modules.
- Persistence: `src/db.js`, `src/dbConstants.js`, `src/storage.js`, `src/storageDiagnostics.js`, `src/rescueSnapshot.js`, `src/appLock.js`.
- Backup: `src/backup/fullBackup.js`.
- Case UI: `src/components/CaseDetail.jsx`, `RecordModal.jsx`, record cards, and case-detail workspaces.
- Sequence Groups: metadata, manager, form, management, operation, and selection modules.
- Reports: definitions, scopes, model, record utilities, document contract, active dispatch, six document builders, formatters, outputs, capability audit, legacy builder, articles, and controls.
- Exports: case, reasoning v3, split package, link map, Sequence Group audits/index/consolidation, GPT audit and protocol packs.
- AI: GPT Delta v1/v2, GPT Delta v3, Sequence Group Delta, AI workspace configuration, and modal.
- Attachments: attachment preview, file preview, file security, and image storage helpers.
- Diagnostics: case diagnostics, operational integrity, and case health.
- Shared UI: record shell, badges, actions, metadata, and link rows.
- Tests: all test filenames inventoried; representative domain, persistence, report, component, import/export, source, rendered, and integration suites inspected through source and output.
- Configuration: `package.json`, lockfile metadata, Vite, ESLint, and browser-proof script.

`node_modules` and generated `dist` source were excluded except for build artifact measurements. No user case database contents were inspected.

## 31. Files Changed

Production files: none.

Audit deliverable added after the audit at the user's request:

- `PROVEIT_CURRENT_STATE_AUDIT.md`

No characterization tests were needed. No application code or user data was changed. Nothing was committed or pushed.

## 32. Validation Results

The completed audit validation before adding this documentation file was:

```text
npm test
758 tests
758 passed
0 failed
0 skipped
duration: 4019.4525 ms

npm run lint
Passed

npm run build
Passed in 1.76 s
1861 modules transformed
Main JavaScript: 1,505.81 kB / 350.97 kB gzip
Large-chunk warning remains

git diff --check
Passed

git status
## main...origin/main
```

After the user requested a saved copy, the only working-tree change is this Markdown audit document. No commit or push was performed.
