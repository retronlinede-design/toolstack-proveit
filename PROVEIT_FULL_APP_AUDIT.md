# ProveIt Full Application Audit

Audit date: **12 September 2026**. Repository baseline: **`de90aeee32322283179610b29e09b3be6f0df8ac`**. Mode: **investigation only; no remediation**.

This report is stored beside the four existing root-level ProveIt audits. It is a new baseline, not an amendment to those historical documents. Paths below are repository-relative. Function/component names are the primary evidence anchors; selected line numbers refer to this commit.

## 1. Executive Summary

ProveIt is a substantial local-first investigation workspace with structured records, relationship diagnostics, monitoring and planning tools, multiple report pipelines, manual GPT handoffs, and browser-local recovery features. It is not a connected multi-user case-management service. The active browser application has no remote authentication, server-authoritative data layer, or automatic AI execution.

The implementation has meaningful strengths: pure domain/report modules, explicit non-importable reasoning exports, restricted GPT update contracts, attachment preview MIME restrictions, case overwrite guards, source references in reports, and a substantial passing test suite. All **852 tests**, lint, and the production build passed. The npm dependency audit returned **zero known vulnerabilities** at audit time.

However, passing checks do not establish safe end-to-end persistence. The highest-risk defects occur where separately tested systems meet:

1. **Issue data is discarded during general normalization and then rewritten at startup.** Stable Issue IDs/references, rich metadata, retired references, and record membership IDs do not survive the general case normalizer. A synthetic reload changed a resolved `ISS-009` into a newly generated open `ISS-001`, losing its purpose and reference history (AUDIT-001).
2. **Restore writes attachment bytes under existing global IDs before validating/saving cases.** A failed case save can then delete those same IDs. Neither the pre-import emergency snapshot nor the cleanup restores overwritten original bytes (AUDIT-002).
3. **Older or sparse imports overwrite current fields with defaults.** Merge-by-ID preserves unmatched records, but normalizes incoming records first and replaces matching content without a revision/conflict check (AUDIT-003).
4. **The split GPT reasoning package exports the plaintext case PIN.** Binary removal is not credential removal; `privacyLock` survives the generic case-metadata projection (AUDIT-004).
5. **Issue management mixes old name-based operations and new stable-ID operations.** Moves can undo themselves, merges pass an undefined case to persistence, and deletion can recreate an Issue through legacy metadata (AUDIT-005).

A further high-priority recovery defect is that a Full Backup can claim binary inclusion while silently omitting missing attachment bytes (AUDIT-006).

**Overall assessment:** useful and extensively implemented, but not yet a trustworthy baseline for migrations, cross-device restore, or confidential GPT handoff without targeted integrity work. This does not justify a rewrite. Preserve the successful domain/report separation and repair the integration boundaries first.

Risk register totals: **37 findings**. Severity counts are tabulated in section 16. P0 is reserved for the documented data-loss and disclosure paths, not cosmetic or speculative concerns. No CRITICAL finding is asserted: the audit did not verify a deployed public compromise or loss of actual user data.

## 2. Audit Scope & Method

### Scope and evidence

The audit inventoried tracked files and the working directory, including hidden locations, existing audits, source, tests, package/lock/configuration files, public assets, ignored build output, ignored logs, and the standalone browser proof script. `.agents` was present but empty; no applicable `AGENTS.md` was found. No `.openai/hosting.json`, environment file, database migration SQL, CI workflow, deployment manifest, or supplied GPT JSON archive was found in this workspace inventory.

Implementation tracing covered application startup, navigation, case/record CRUD, quick capture, attachments, case folders, both lock mechanisms, backup/import/rescue, Issue/Sequence Group operations, links, Parties, To Watch, Strategy, tracking-record parsing, Ledger, report definitions/models/documents/outputs, GPT exports/deltas, diagnostics, and dormant remote code. All 130 test files were executed by the existing test command. Source review emphasized active orchestration and contract boundaries; not every line of every component was manually reviewed.

Evidence labels:

- **CONFIRMED:** directly demonstrated in source, an existing test, an isolated synthetic execution, or command output. This does not imply reproduction in a live browser unless stated.
- **LIKELY:** the code path strongly supports the behavior, but the browser/platform behavior was unavailable for confirmation.
- **POTENTIAL:** a conditional risk requiring deployment, malicious-input, concurrency, scale, or product-context verification.

Synthetic checks imported pure modules in Node and used newly constructed objects or in-memory Maps. They did not open IndexedDB, import user backups, read browser case contents, or write application data. Assertions/results are summarized in section 13 and reproducible examples appear in the appendix.

### Verification limits

- The computer-use browser entry point returned **“No browser is available.”** Therefore no current visual, keyboard, mobile viewport, browser storage, PDF pagination, download-completion, or full UI journey was verified.
- The existing Vite preview was started on `127.0.0.1:51893`; HTTP GET returned 200 and the built HTML. The initial sandbox attempt failed with `spawn EPERM` and native dependency loading errors; the approved outside-sandbox retry succeeded. The audit-owned server was stopped afterward.
- The existing `runtime-browser-proof.mjs` was inspected but **not executed**: it attaches to the first debug-browser page on port 9224 and creates/modifies records. It is not a safe read-only probe of an unknown user session.
- No live Supabase project, JWT gateway setting, RLS policy, deployed Edge Function, GPT Builder configuration, GPT conversation, actual user-data history, or historical full-backup fixture was available.
- The Product Owner was asked for the location of the stated supplied exports. No such path/artifact was available when this report was prepared. This is an explicit audit gap, not evidence that the external GPT configurations are correct or incorrect.
- Secret-pattern checks found no obvious private-key/token literal in inspected text artifacts. This is a bounded current-workspace check, not a certification of Git history or every possible secret format. No credential values are reproduced here.

## 3. Repository & Architecture Overview

### Actual architecture

`index.html` loads `src/main.jsx`; React `createRoot` renders `ProveItApp` under StrictMode. `App.jsx` owns the case collection, selected case/tab, most editors, lock state, file conversion, backup orchestration, and IndexedDB writes. It passes case objects and callbacks into `CaseDetail.jsx`, which owns workspace filters, Issue tools, reports, diagnostics, and AI handoffs. Navigation is React state, not URL routing.

```text
index.html -> main.jsx (React StrictMode)
                  |
               App.jsx
                  |-- state: cases, selectedCaseId, activeTab, editors, locks
                  |-- storage.js -> idb -> proveit-db v2
                  |                      |-- cases: whole embedded case objects
                  |                      |-- images: attachment data URLs
                  |                      `-- evidence: legacy separate records
                  |-- localStorage: captures, folders, group metadata,
                  |                 locks, rescue/emergency copies, UI/backup state
                  |-- backup/fullBackup.js <-> downloadable JSON
                  `-- CaseDetail.jsx
                        |-- record tabs/cards/editors -> domain operations -> App save
                        |-- Issue manager -> issueDomain + legacy sequence operations
                        |-- diagnostics + caseBriefing -> overview/action suggestions
                        |-- reportModel -> report documents -> JSX / Markdown / JSON
                        |-- legacy reportBuilder -> advanced reports / Print Pack
                        `-- GPT packs -> clipboard/JSON/ZIP -> external human/GPT
                                                            |
                                             pasted delta / report text
                                                            |
                                          validation + preview -> case save

Dormant branch (not imported by active app):
supabaseCaseSync.js -> configured HTTP endpoint
components/index.ts -> Deno/Supabase snapshot-to-import converter
```

### Inventory summary

| Area | Implemented responsibility |
|---|---|
| `src/App.jsx` | 5,670 lines; application controller, persistence, editors, dashboard, recovery, locks |
| `src/components/CaseDetail.jsx` | 7,848 lines; workspace and report/AI/Issue orchestration |
| `src/domain/` | Case/record normalization, CRUD, link maintenance, conversion, Issue identity, quick capture, date repair, form suggestions |
| `src/storage.js`, `db.js`, `dbConstants.js` | IndexedDB access, schema creation/indexes, destructive-write guards, image cleanup |
| `src/backup/`, `rescueSnapshot.js`, `storageDiagnostics.js` | Downloadable backup, restore helpers, recovery copies, storage counts |
| `src/components/caseDetail/` | Documents, Records, Ledger, Parties, Strategy, Watch, Action Summary, menu and filter helpers |
| `src/components/sequenceGroups/` | Issue/Sequence Group forms, selection, management, operations and audit export UI |
| `src/components/shared/` | Shared badges, record shells, actions, metadata and link rows |
| `src/components/caseBriefing/`, `src/caseBriefing/` | Overview model, source-linked next actions, Issue summaries, recent activity |
| `src/diagnostics/`, `src/lib/caseHealth.js` | Link/attachment/data-quality checks and planning/monitoring heuristics |
| `src/report/` | Definitions, source projection, report documents, formatters, adapters, older builders |
| `src/components/reports/` | Report controls and JSX renderers; shared document/print primitives |
| `src/export/` | Case reasoning, v3 planning snapshot, split ZIP, graph, audit/protocol/group packages |
| `src/gpt/` | Versioned delta validation, creation/patching, temp IDs, preview, group-delta contract |
| `src/integrations/`, `src/components/index.ts` | Disabled/unconnected remote snapshot helpers and Deno server code |
| `src/browser/downloadJson.js` | Blob-based JSON download helper |
| `src/assets/`, `public/` | Branding PNGs, icons/favicons, unused Vite/React starter assets |
| Root configuration | npm, Vite React/Tailwind plugins, ESLint, HTML entry, ignore rules |
| Root documentation/artifacts | README, four previous audits, one browser proof script and screenshot, ignored logs/build |

The inventory found **298 files under `src`**, including **158 production JS/JSX/TS modules**, **130 test files**, and **42,736 production module lines**. A lightweight static relative-import graph found no cycle. It is a heuristic, not a full dynamic-module proof. All declared application libraries have an identifiable usage: React/React DOM, Lucide, idb, JSZip, and Tailwind/Vite plugins.

No Redux/Zustand/router library is present. State ownership is primarily component-local hooks and callback props. No active service worker, background synchronization, web worker, server session, payment integration, or automatic OpenAI API call was found.

## 4. Feature / Workflow Inventory

| Workflow / entry | Interaction, rules and persistence | Feedback/edge cases/status |
|---|---|---|
| Case dashboard | Create/edit case name, category, description and notes; select a case; whole-case IndexedDB save | New cases default to open; most saves await persistence before UI update. Blank-name fallbacks differ between creation and normalization. No deep links/history routing. |
| Folders | Create/rename/delete folder, filter/sort dashboard, move case | Folder definitions in localStorage; case carries `folderId`. Delete clears membership case by case, then removes folder. Mid-operation failure can partially move cases. |
| Case deletion | Native confirmation; delete canonical case, legacy evidence and candidate images | No trash. Emergency metadata copy is best effort. Quick captures and legacy group metadata are not removed by the case deletion handler. |
| Overview | Case Briefing dashboard: counts, Issues, recent activity, diagnostics and next actions | Pure model combines several subsystems; source launch helpers navigate to record/editor. Empty-case guidance exists. These are heuristic quality signals, not adjudicated facts. |
| Parties | Search/filter, editor, roles/contact/address/confidentiality, delete confirmation | Embedded `parties`; record `linkedPartyIds`. Save returns success/failure to editor. Owner references are not included in deletion cleanup (AUDIT-014). |
| Incidents | Add/edit, chronology date, importance, evidence status, milestones, typed incident references, links and attachments | Title required in save handler. Evidence creation can return to the parent Incident. Deletes clean array links. Unknown dates are defaulted, and editor paths do not uniformly maintain new Issue IDs. |
| Evidence | Add/edit, upload, proof-purpose `functionSummary`, role/type/source/relevance, review status, original/digital availability | Evidence suggestions use deterministic keywords and incident-word overlap, not a model. Incident/evidence links are synchronized on regular saves. Separate digital-file metadata and attachment arrays remain compatibility paths. |
| Documents | Add/edit metadata, source text, attachments and links; copy GPT text-extraction prompt | No OCR/document extraction service runs in the app. User supplies extracted text. `getDocumentTextStatus` uses text length thresholds rather than completeness verification. |
| Records | Documents containing `[TRACK RECORD]`; edit marked text sections and table; link source evidence; single/all GPT export | Not a separate store/entity. Parsing and generated ledger rows depend on exact delimiters/headers; blank table cells can silently drop rows (AUDIT-022). |
| Ledger | Add/edit/duplicate, category/batch filters, amount/payment/proof metadata and party/record links | Canonical ledger rows are distinct from derived tracking rows. Title/label gate exists; finite numeric validation is incomplete. Certain batch names crash grouping (AUDIT-037). |
| Strategy | Structured objective/rationale/outcome, priority/review/decision, owner, assumptions/risks/next steps; filters/cards | Stored in case; v3 planning fields coexist with older free text. Conversion from other record types shows dropped fields before confirmation. |
| To Watch | Add/edit concern, triggers, reviews, observation history; convert to Incident/Strategy | Keeps monitored concern distinct from fact; conversion escalates the original and links new record. Last-item delete is blocked by the general save guard; save/conversion handlers do not await success consistently. |
| Quick Capture | Disabled capture modal and review queue; retained localStorage persistence and record-conversion handlers | `SHOW_REVIEW_QUEUE=false` gates both creation and review UI. Historical/imported captures remain stored without normal review/conversion access. |
| Timeline | Combined supported records, ordering, milestone and group filters; open linked record | Timeline participation differs among legacy helpers, report model and tracking derivations. Dates can be inferred from creation timestamps. |
| Narrative | Deterministic narrative sections and case context | Separate from AI-generated Client Report. Has its own aggregation and presentation logic. |
| Issues / Sequence Groups | Create rich Issue, rename/edit, select records, move/split/merge/delete, chronology/map/audit | Stable Issue layer is implemented, but integration with legacy name-based operations is defective (AUDIT-001/005). Reports/selectors still use group names in several places. |
| Reports Centre | Choose report/scope, preview, copy/download Markdown/JSON, print | Ten active definitions/builders; unsupported scopes normalized. Shared documents exist for every active type. Print uses browser facilities. |
| Client Report | Copy language-specific prompt, paste generated text, validate/render/save English or German | Required headings and instruction/placeholder rejection exist; stale/unknown provenance warnings exist. Narrative provenance is transient and saves can show rendered text despite persistence failure. |
| Advanced reports / Print Pack | Older executive/thread/bundle reports, narrative polish, printable case presentation | Parallel accessible pipelines, not all aliases of canonical report documents. Legacy executive renderer still includes literal TODO placeholders. |
| AI Tools | Task-oriented menu; clipboard JSON/Markdown, whole-case reasoning, split ZIP, group and diagnostic packs | External human-mediated GPT workflow. Binary exclusions are generally explicit, but split metadata leaks case PIN and omits full task records. |
| GPT Update | Paste JSON, validate/preview, back up, apply supported delta | Version/field/link validation is substantial; target defaults to selected case only for missing/blank/AUTO IDs. No durable applied-delta ID or concurrency/revision guard. |
| Full Backup / Import | All-app or selected-case JSON; restore matching IDs by merge | Binary writes occur first; no full transaction. Partial failures surfaced, but warnings can be overwritten by success notice. Restore is merge, not exact replace. |
| Rescue / Diagnostics | Local metadata snapshot, storage counts, attachment checks, manual restore | Rescue excludes binaries and large capture sets. Empty database warning protects against casually assuming an empty profile is expected. No off-device durability guarantee. |
| App Lock / case PIN | PBKDF2 app PIN and inactivity options; separate plaintext per-case PIN | UI privacy gates, not storage encryption or server authorization. Corrupt app-lock state disables the gate. |

### Report capability baseline

`reportDefinitions.js`, `buildActiveReportDocument.js`, `reportCentreConfig.js`, and `ReportCentreControls.jsx` agree on these ten active types:

| Report | Scope | Character |
|---|---|---|
| Management | Whole case | Deterministic executive summary |
| Investigation | Whole case / Issue | Complete declared structured investigation scope |
| Client | Whole case | AI-assisted narrative with review/provenance notices |
| Incident Schedule | Whole case / Issue | Complete projected incident schedule |
| Chronology | Whole case / Issue | Canonical chronology of supported records |
| Evidence Pack | Whole case / Issue | Evidence and incident support schedule |
| Document Pack | Whole case / Issue | Document/source text and attachment metadata |
| Ledger Pack | Whole case / Issue | Financial schedule; separate currency totals and exclusions |
| Case Audit | Whole case / Issue | Deterministic data-quality audit |
| Action Plan | Whole case / Issue | Recorded actions/planning plus separately identified remediation |

All declare preview, print, Markdown and JSON. “Complete” means complete for the declared projection/scope, not an archival backup or inclusion of original attachment files. Most include archived records; Action Plan excludes them. Parties are projected context, and legacy tasks are not one of the six canonical report record types, although Action Plan receives tasks separately.

## 5. Data Architecture & Persistence

### Stores and lifecycles

| Store/key | Shape and purpose | Lifecycle / limitations |
|---|---|---|
| IndexedDB `proveit-db`, version 2, `cases` | `keyPath: id`; each value is an entire case with embedded collections | `getAllCases`, `saveCase`/`put`, `deleteCase`; no case revision/CAS, foreign keys, or unique record-ID constraint |
| IndexedDB `images` | `id`, `evidenceId`, `dataUrl`, `createdAt`; indexed on `caseId` and `evidenceId` | Actual file creation/restore does not populate `caseId`; that index cannot be assumed complete. Shared global image namespace. |
| IndexedDB `evidence` | Legacy separate evidence keyed by `id`, `caseId` index | Not canonical for active records; still read during case deletion. No upgrade backfill of legacy evidence into embedded cases is implemented. |
| `toolstack.proveit.v1.captures` | Quick-capture array | React initializer parses; effect rewrites. Attachments reference IndexedDB. |
| `toolstack.proveit.v1.folders` | Folder array with `id/name/description/color/createdAt/updatedAt` | localStorage definitions, separate from case membership updates |
| `toolstack.proveit.v1.sequenceGroupMeta` | Object keyed by case ID, then group name; description/update timestamp | Legacy registry used by rich Issue normalization; separate write ordering creates inconsistency |
| `toolstack.proveit.v1.selectedCase`, `.activeTab` | Selected case ID and tab string | Convenience persistence; limited validation of historical/imported tab values |
| `toolstack.proveit.v1.appLock` | Enabled flag, hash/salt/iterations, timestamps, auto-lock minutes | Hash protects PIN representation only; no case encryption |
| sessionStorage `.appLock.sessionUnlocked` | Boolean-like string | Session convenience flag; independently writable by same-origin script |
| localStorage `.lastFullBackupAt`, `.lastBackupMeta` | Timestamp/type/counts | Marks attempted download or successful full import; not evidence of an independently recoverable file |
| localStorage `.rescueSnapshot` | One non-binary case/folder/capture snapshot | Debounced 1.2 seconds; skips zero cases; excludes captures if stripped serialization exceeds 100,000 characters |
| localStorage `.emergencyBackup.<timestamp>.<operation>` | Case snapshots, counts, operation and timestamp | Best effort; no binary image-store payloads or bounded retention/rotation |
| Memory caches | `imageCache`, diagnostic images, report models, filters, drafts, unlock sets | Rebuilt at runtime; image cache accumulates and diagnostic image reads span the whole DB |

No active PostgreSQL/Supabase persistence is part of the current user workflow. The dormant Deno code selects `cases.snapshot`; the actual remote table schema is not supplied.

### Implemented entities

Most entities have string IDs and ISO creation/update timestamps. IDs default to `crypto.randomUUID`, with a Math.random fallback in the general helper; Quick Capture directly uses `crypto.randomUUID`. Fields are enforced by procedural JavaScript normalizers, not a checked schema. “Required” below describes actual normalizer/UI behavior rather than a database constraint.

| Entity | Important fields, defaults and relationships |
|---|---|
| Case | `id`, normalized nonempty `name`, lowercase category default `general`, status `open/closed/archived`, nullable `folderId`, notes/description/tags, timestamps; incidents/evidence/tasks/strategy/ledger/documents/parties/watchItems; actionSummary; privacyLock; generatedReportText/versions/language; auditLog |
| Incident | Base record fields; status open/archived; date/eventDate, milestone, importance, sequenceGroup, `linkedEvidenceIds`, typed `linkedIncidentRefs` (`CAUSES`, `RELATED_TO`); evidenceStatus documented/witnessed/contextual/unverified/needs_evidence |
| Evidence | Base record fields; review status; sourceType/capturedAt/importance/relevance; evidenceRole and evidenceType; functionSummary, reviewNotes, usedIn; `linkedIncidentIds`; physical original metadata and digital file metadata |
| Document | `id/title/category/documentDate/source/summary/textContent/attachments/linkedRecordIds/linkedPartyIds/sequenceGroup/edited/timestamps`; `basedOnEvidenceIds` retained only for marked tracking documents |
| Tracking Record | Document subtype inferred from `[TRACK RECORD]` inside text; `meta:` type/subject/period/status plus TABLE, SUMMARY, FILE LINKS and NOTES delimiters; no independent schema/store |
| Ledger | `id/category/subType/label/period`, expectedAmount/paidAmount/differenceAmount, currency default EUR, due/payment dates, payment/proof statuses, method/reference/counterparty/notes/batchLabel, links and timestamps; normalization does not preserve arbitrary extra fields |
| Strategy | Base record fields plus strategySchemaVersion, strategyType, objective/rationale/desiredOutcome, priority/reviewDate/decisionStatus/ownerPartyId, assumptions/risks/nextSteps; planning content is not evidence |
| Watch item | `id/type=watch/title/category/status/priority/date/eventDate/reviewDate`, watchFor/rationale/triggerConditions/latestObservation/nextCheck/outcome, links/group/tags/files, observations/source/timestamps; status defaults watching; invalid/missing event date defaults to today |
| Watch observation | `id/date/text/createdAt`; empty text dropped; normalized/sorted; GPT contract appends rather than replaces history |
| Party | `id/entityType/displayName/legalName/aliases/roles/organisationName/jobTitle/department/relationshipToCase`, contact/address, status/tags/notes/confidentiality, edited/timestamps; normalizer discards unknown fields |
| Issue | `id/reference/name/description/purpose/status/priority/ownerPartyId/reviewDate/currentPosition/createdAt/updatedAt`; case adds `issues`, `issueSchemaVersion=1`, next reference number and retired references/history; member record has `sequenceGroupId` plus legacy `sequenceGroup` name |
| Quick Capture | `id/caseId/caseName/title/date/note/attachments/status/convertedTo/source/createdAt/updatedAt`; status unreviewed/converted/archived; conversion records target type, not a durable destination record ID |
| Action Summary | currentFocus; nextActions as `{text, completed, completedAt}`; importantReminders/strategyFocus/criticalDeadlines arrays; updatedAt |
| Attachment descriptor | `id/name/type/mimeType/size/kind/createdAt/emailMeta/storage`; `storage.imageId` resolves to global images store; imports may temporarily carry `backupDataUrl` |
| Generated report | English/German strings plus active language and legacy English text; current provenance/review metadata is React state, not saved with the strings |

Relationships are usually untyped ID arrays. Incident/Evidence have special reciprocal synchronization; other links need not be reciprocal. `cleanupDeletedRecordLinks` removes common arrays and typed incident references across record collections. It does not remove scalar owner IDs or Issue owners. There is no database referential constraint, uniqueness check spanning all record types, or atomic relationship transaction independent of whole-case saves.

### Migration and normalization risks

**AUDIT-001 — HIGH, CONFIRMED.** `normalizeCase` (`caseDomain.js:1227`) constructs an allowlisted object excluding all rich Issue fields. Record normalizers similarly omit `sequenceGroupId`. `App.jsx` startup maps `normalizeCase`, then `normalizeCaseIssues`, then saves every newly created object. Consequently this is a write-on-open data transformation, not merely a lossy display projection. Metadata-only Issues can disappear; record-named groups are recreated with different identity and default status/priority; retirement history is lost. GPT v3 ingestion also calls `normalizeCase` at the end, and backup import uses the same normalization chain. A raw Full Backup may contain rich Issue fields, yet current restore discards them. Core-array counts remain unchanged, so the suspicious-shrink guard does not detect it.

**AUDIT-008 — MEDIUM, CONFIRMED.** General normalization is not a versioned migration framework. DB version 2 only creates stores/indexes; no per-case migration ledger, source-schema acceptance range, dry run, or quarantine exists. `restoreBackupPayload` checks export type and `cases` array but does not enforce `contractVersion`, complete nested shapes, or a supported app/schema version before writing binaries. Invalid records can throw later, and unknown fields are dropped. One malformed stored case can reject the aggregate startup normalization/save and leave the UI with an empty case list plus a generic load notice. Existing legacy `evidence` store records are not automatically backfilled into canonical cases. Whether user data is affected requires read-only historical inventory.

**AUDIT-020 — MEDIUM, POTENTIAL.** IDs are generated for new data but import does not reject duplicate case/record IDs or cross-type collisions. Generic link maps resolve raw IDs; report projection deduplicates same-type IDs and its `recordById` chooses the first matching ID across types. Ambiguous imports can resolve to the wrong entity or silently collapse duplicate records. Evidence: merge Maps in `caseDomain.js`, `reportModel.js:collectRecords/resolveReferences`, and export relationship indexes.

**AUDIT-021 — MEDIUM, CONFIRMED.** `normalizeTimelineFields`, `normalizeRecord`, and `normalizeWatchItem` replace unknown dates with created dates/today. `getSafeDate` uses permissive Date parsing, whereas strict calendar-date checks exist elsewhere. Imported undated facts can become apparently dated chronology entries without an explicit “inferred” marker. Legacy task status `done` is normalized to `open`, while health, reports and reasoning exports still test for `done`. This changes both chronology and completion meaning on load/merge.

### Backup, merge, deletion and durability

**AUDIT-002 — HIGH, CONFIRMED.** `restoreFullBackupAttachment` selects an imported `storage.imageId`/imageId/id and calls `saveImage` (`put`). `App.restoreBackupPayload` restores all binaries before normalizing or merging cases. Same-ID existing bytes are overwritten; subsequent failed-case cleanup calls `deleteImages` for IDs recorded as restored, without distinguishing newly allocated from overwritten existing IDs. Cross-case/shared references are not protected in this rollback path. A synthetic Map-backed execution confirmed original bytes were replaced. A failure after another case has restored a shared ID can also remove that case's bytes. Use fresh restore IDs, validate the whole plan first, and commit a recoverable transaction/journal before changing existing data.

**AUDIT-003 — HIGH, CONFIRMED.** `mergeCase` and collection merge helpers merge matching IDs by incoming precedence after normalization. Defaults such as empty attachments, links and description are treated as supplied values. There is no timestamp comparison or conflict preview. A synthetic current Evidence record with description merged with `{id, title}` lost its description and acquired empty attachment/link arrays. A legacy snapshot converter can therefore overwrite rich records with summaries under the same IDs. Preserve missing-vs-explicit fields until conflict resolution; do not treat this merge as a fidelity-preserving restore.

**AUDIT-006 — HIGH, CONFIRMED.** `buildFullBackupAttachment` silently returns a descriptor if its image lookup has no `dataUrl`; payloads still declare `includesBinaryData:true`. Full backup UI records success after initiating the download, without attachment completeness totals or verification of file retention. Full imports also mark a new “last backup” timestamp. Import attachment-failure warning can immediately be replaced by a general success notice. Backup recency therefore overstates verified recoverability. Rescue/emergency copies do not contain separate image-store bytes and cannot fill that gap.

**AUDIT-007 — MEDIUM, POTENTIAL.** Whole-case read/check/put operations use separate IDB calls; no revision precondition, serialized mutation queue, multi-tab notification, or writer lock was found. A stale tab, overlapping save, or delayed GPT preview can overwrite newer changes while retaining nonempty arrays. The guard only detects nonempty-to-empty transitions, not partial loss, metadata loss, or stale edits. `applyValidatedGptDelta` saves a previously computed whole case without revalidating it against the latest persisted revision.

**AUDIT-009 — MEDIUM, CONFIRMED.** Captures/folders/selected-tab effects call localStorage.setItem without handling quota/security failures. Read failures become empty defaults, which effects can subsequently write back. Emergency backups accumulate unbounded case JSON; rescue copies also serialize cases in the same origin quota. Failures can make a UI edit appear available in memory but not durable. Case/quick-capture conversion and folder deletion span IndexedDB/localStorage without a shared commit. Do not interpret local rescue availability as off-device backup durability.

**AUDIT-012 — MEDIUM, CONFIRMED.** File upload persists bytes before the record is saved. Cancel/removal and ordinary record/document deletion do not consistently delete unused blobs. Case deletion gathers currently referenced IDs, so earlier orphan blobs can survive. Deleting a case also leaves its quick captures and name-keyed metadata/recovery copies. Conversely, the legacy evidence deletion loop removes images before checking references from remaining embedded cases. This combines quota/retention debt with a conditional shared-binary deletion risk. Any future cleanup must build a reference inventory including captures and legacy paths before deleting bytes.

## 6. GPT / AI Architecture

### Actual integration model

The active app does not call a model API. It builds prompts and bounded data packages, copies/downloads them, and expects the user to interact with an external GPT. Model responses return through a pasted JSON delta, pasted report text, or manually prepared document/tracking text. No provider key, model selector, temperature, token budget, retry/backoff or remote response stream exists in the active app. Retry is manual. “AI tools” generally mean preparation/validation tools, not autonomous inference.

| Contract/component | Input/output and validation |
|---|---|
| `gpt-delta-1.0` | actionSummary and Strategy patches; unsupported-field handling includes warnings; case target enforced by dispatcher |
| `gpt-delta-2.0` | Create Incidents/Evidence/Documents/Ledger; patch those plus Strategy. Explicit collection/field allowlists, enums, ID/link checks, temp-ID mapping and duplicate-risk warnings. No Strategy creation or binary/delete operations. |
| `gpt-delta-3.0` | Structured Strategy patches; Watch creation with clientId; Watch patches; append dated Watch observations. Strict dates/fields/enums/references. clientId is result correlation, not same-delta link identity. |
| `sequence-group-delta-1.0` | Move/clear records, rename/merge groups; validate and preview, then confirmation/apply. Separate from ordinary GPT delta importer. |
| Client Report | `PROVEIT_REPORT_PROMPT_V1`, language-specific prompt package, heading parser and `clientReportValidation.js`; three required headings, rejection of raw prompt/JSON/placeholder/internal UUID patterns; stale/unknown revision warnings |
| Executive narrative polish | Expected fixed Markdown headings; parsed into optional narrative sections; does not provide automated fact verification |
| Document/Record prompts | `DOCUMENT_GPT_SUMMARY_PROMPT`, `RECORD_GPT_PROMPT` in App; user pastes source text or tracking grammar; no automatic OCR/MIME-text extraction beyond simple email headers |
| GPT protocol knowledge pack | `gptProtocolPack.js`; JSON/Markdown instructions and synthetic examples; documentation only, not a deployed GPT export |

Field validation is valuable but cannot establish truth, appropriate classification, or factual support. AI-authored content and user-supplied source text are still untrusted data. React text rendering provides escaping in the primary UI; the app does not evaluate generated JavaScript or execute tool calls from model output. A report passing a heading validator is structurally plausible, not factually verified.

**AUDIT-015 — MEDIUM, CONFIRMED.** `reasoningExportV3.js` uses a strings-only list helper for `actionSummary.nextActions`; canonical nextActions are objects. Synthetic canonical input exported `nextActions:[]`. The same area merits field-by-field checks for structured planning lists. Fix the export projection and test using normalized production-shaped objects, not just legacy string fixtures.

**AUDIT-016 — MEDIUM, CONFIRMED.** Client Report sourceRevision/promptRevision/generatedAt/review/approval metadata live in `clientNarrativeMeta` state in `CaseDetail`. Save persists report strings/language only; case changes/remount reset metadata. Returning to a saved report gives unknown provenance even when the draft was created through the new workflow. The model fingerprint is a lightweight change indicator, not a cryptographic signature; it excludes some case-level inputs such as actionSummary, relying partly on updatedAt discipline. Persist language-specific provenance and define exactly which inputs establish staleness.

**AUDIT-017 — MEDIUM, CONFIRMED.** The protocol pack's general delta rules say a GPT update must use v2 and its temporary-ID rules say tempId is required for new records; later sections correctly document v3 Watch creation using clientId. The top record-type overview omits Watch while later additions describe it. Stable human-readable Issue instructions appear in `issueDomain.js` and reasoning exports but are not a unified base contract throughout the older protocol/group instruction sections. This is an internal documentation contradiction, not evidence that v3 is wholly undocumented. Prompt edits can break marker parsing, enum values, field allowlists, new-record identity and supported operation sets. Use per-version examples generated/validated against the importer and a single capability matrix.

The app has no persisted delta identity for replay prevention. Reapplying a creation delta can generate additional records, and v3 duplicate-observation checking is within one delta, not an existing-history idempotency guarantee. Treat this as part of the concurrency/replay boundary in AUDIT-007 and test it before adding retries.

## 7. JSON & Information Export Findings

### What was actually supplied in this repository

The full non-vendor file inventory found **only `package.json` and `package-lock.json` as physical JSON files**. No business-data JSON, JSONL, ZIP, GPT Builder configuration, OpenAPI action schema, TXT knowledge export, PDF or DOCX information export was found. Vendor JSON in node_modules is dependency metadata, not Product Owner case/GPT material.

**AUDIT-032 — INFO, CONFIRMED inventory gap.** The requested supplied-artifact comparison remains incomplete until the Product Owner identifies those files. No claim is made about external GPT instructions matching the app. Do not substitute freshly generated synthetic exports for the missing historical artifacts.

The four existing audit Markdown files and runtime proof artifacts were inspected as historical information. They are not authoritative runtime specifications. `PROVEIT_CURRENT_STATE_AUDIT.md` describes commit `728f444...`, 758 passing tests, flat label-based groups and stable Issues as future work. The current commit has 852 tests and a rich Issue implementation. Earlier reports-centre/design audits describe missing or less mature report paths; the current code has ten canonical builders, report categories, audience/completeness hints, and several new document-control sections. Their residual warnings about import atomicity, local confidentiality, duplicate report paths and browser-test gaps remain supported where reverified here.

### Generated export inventory and comparison

| Generator/artifact | Contract / content | Importability and fidelity |
|---|---|---|
| `backup/fullBackup.js` all-app | `FULL_BACKUP_ALL`, contract `2.0`; cases, quick captures, folders (duplicated in appData/data), legacy sequence metadata, selected case/tab, inline attachment backup bytes | Importable merge; not app-lock/session backup; binary completeness not enforced |
| Same, selected case | `FULL_BACKUP_CASE`, contract `2.0`; one case, selection/tab, embedded backup bytes | No global folders/captures/legacy group registry; current Issue normalization makes rich-field round trip unsafe |
| `export/caseExport.js` | `CASE_REASONING_EXPORT`; compact/detailed bounded reasoning projection, report context, links and summaries | Explicitly non-importable; detailed is still bounded: Incidents 60, Evidence/Documents 80 each, Ledger 75, chronology 120, document excerpt 1,500 characters |
| `export/reasoningExportV3.js` | `reasoning-export-3.0`; structured active Strategy/Watch, party references, Issue index, diagnostics and counts | Non-importable planning/monitoring snapshot, not a complete replacement of v2 case evidence content |
| `export/splitReasoningPackage.js` | Package `1.0`; read-me/manifest plus numbered JSON sections; nominal 2 MiB splitting target | Non-importable, binaries stripped, records not split internally; generic case metadata includes PIN; full legacy tasks omitted |
| `export/linkMapExport.js` | Case graph nodes/edges, missing links and metrics | Non-importable relationship projection |
| `export/gptAuditPacks.js` | GPT_AUDIT_PACK family: missing summary, ungrouped incidents/evidence, weak links, chain completion, full chain, management builder, case slice | Bounded specialist context and Markdown prompts, not backups; original files/Parties often excluded intentionally |
| `export/sequenceGroupAuditExport.js` | Selected-group audit JSON/Markdown and browser-print helper | Scoped records, diagnostics, timeline and external link context |
| `export/sequenceGroupConsolidatedExport.js` | All group audits / case organized by groups | Duplicates context across group views intentionally; not canonical full-backup format |
| `export/sequenceGroupsIndexExport.js` | Lightweight group/index JSON/Markdown | Navigation/identity context; does not substitute for record content |
| `gpt/sequenceGroupDelta.js` | `SEQUENCE_GROUP_REVIEW_PACKAGE` and group-delta contract | Review package non-mutating; delta goes through separate validator/apply path |
| `components/caseDetail/recordsGptExport.js` | `GPT_RECORD_EXPORT` / `GPT_RECORDS_EXPORT` | Parsed tracking-record context, dependent on text grammar |
| `export/gptProtocolPack.js` | `PROVEIT_GPT_PROTOCOL_PACK`, `proveit-gpt-protocol-pack-1.0`; export timestamp, instructions and examples | Knowledge/reference only; no external GPT model/config/release identity |
| `report/reportJsonFormatter.js` | Canonical report-document JSON | Direct document serialization; schema governed by builders, not backup importer |
| `rescueSnapshot.js`, `storage.js` | Rescue/emergency local JSON structures | Recovery metadata, not portable complete binary backups |
| `components/index.ts` | Legacy `version:1.0`, `storageKey` wrapper with `data.cases`; creates case-shaped summaries from remote snapshot | Dangerous import compatibility if revived: no `importable:false`/reasoning export type, so the current importer can accept lossy reconstructed data |

**AUDIT-004 — HIGH, CONFIRMED.** `projectSplitReasoningSections` derives `caseMetadata` by excluding collections, actionSummary and auditLog. It does not exclude privacyLock; `sanitizeSplitReasoningValue` removes binary keys only. Synthetic output retained a `privacyLock.pin` property. The AI Tools split-package action is reachable and explicitly intended for external GPT upload. This is an unintended credential disclosure path; no actual stored PIN was read or exported in this audit. Use an explicit non-sensitive case projection and test that lock material never enters handoffs.

**AUDIT-019 — MEDIUM, CONFIRMED.** Split package declares all files form a complete case, but `tasks` is in COLLECTIONS and removed from caseMetadata without a corresponding task section. Only task chronology snippets/relationships survive; full notes, priority and other details do not. Synthetic task notes were absent. Also `sequenceGroups` section uses names as IDs while rich Issue identity exists elsewhere in summary metadata. Preserve a full task section or explicitly state the exclusion and unify identity semantics. Do not remove legacy tasks simply because their editing UI is hidden.

The selected-case backup's omission of global group metadata was historically significant; the new rich Issues should make it self-contained, but AUDIT-001 currently defeats that improvement. All-app folder duplication is compatibility structure; import precedence should be documented and tested with conflicting copies rather than assumed equivalent.

## 8. Functional Findings

**AUDIT-005 — HIGH, CONFIRMED.** Three concrete Issue integration failures:

- `moveCaseSequenceGroupRecords`/split/remove/legacy rename helpers update `sequenceGroup` but preserve the old `sequenceGroupId`. `normalizeCaseIssues` resolves the ID before the name. A synthetic move from A to B returned B from the legacy helper and A after the same canonicalization used by `App.handleUpdateCase`.
- `CaseDetail.handleManagedSequenceGroupOperation` builds merge results from `mergeCaseIssues`, whose field is `caseData`, then calls `onUpdateCase(result.caseItem)`. That property is undefined. App catches the failed access and returns false, so the merge does not persist. This is a confirmed source/API mismatch; the exact browser notice was not observed.
- `handleDeleteManagedSequenceGroup` saves the deleted Issue result before removing its name from localStorage metadata. `handleUpdateCase` normalizes against that still-present metadata and recreates the Issue, even though its former reference is retired. The synthetic pipeline reproduced recreation. Similar ordering risks exist in merge/rename metadata maintenance.

Repair all active operations against one canonical Issue API, including ordinary record editor changes and GPT group updates. Unit success from a legacy helper is not sufficient; verify the saved/reloaded result and feedback.

**AUDIT-010 — MEDIUM, CONFIRMED.** `WatchWorkspace.remove` sends a case with an empty watchItems array through generic `onUpdateCase`, which has no suspicious-overwrite override. `saveCase` blocks deleting the last Watch item. Ordinary record/document/ledger deletion supplies explicit overrides; this path does not. The synthetic guard returns true for one-to-zero Watch deletion. Route this through the same explicit, confirmed destructive operation policy.

**AUDIT-011 — MEDIUM, CONFIRMED.** `SHOW_REVIEW_QUEUE=false` in App gates both the creation modal and the review/conversion queue. No setter opening the modal was found. LocalStorage persistence, historical/imported captures, archive/conversion handlers and backup support remain. `tasks` similarly remains a data type with no active task tab. The Ideas screen has in-memory state but no normal tab entry. Distinguish deliberately retired UI from an incomplete feature; provide access to valuable existing captures before changing their schema.

**AUDIT-013 — MEDIUM, CONFIRMED source omission; LIKELY visible symptom.** App's selected-case image hydration scans Evidence/Incidents/Strategy attachments, Documents and the review queue. It does not scan Watch/tasks or Evidence `availability.digital.files` when those files are absent from attachments. Preview components rely on cache/inline data. Old records with only digital availability references can lack previews until another path happens to populate the cache. The diagnostic image list is separate and does not hydrate preview cache. Verify historical attachment shapes in a clean isolated browser before changing them.

**AUDIT-014 — MEDIUM, CONFIRMED.** Party deletion removes linkedPartyIds but does not clear `strategy.ownerPartyId` or `issues[].ownerPartyId`. Synthetic Strategy ownership still referenced the deleted party. Downstream reports can lose owner display or show unresolved context; Issue validation rejects nonexistent owners in some edit paths. Define reassignment/clear-with-warning behavior and test deletion across all scalar and array relationships.

**AUDIT-022 — MEDIUM, CONFIRMED.** Tracking parser `parseTrackTable` removes empty cells with `.filter(Boolean)` then requires cell count to equal header count. A valid row with an empty Notes cell produced no parsed rows. Text remains stored, but rendered/derived/exported records silently lose the row. Amount parsing is also inconsistent: `normalizeLedgerEntry` accepts NaN from arbitrary strings, while tracking helpers use ad hoc comma/symbol replacement. Preserve blank cells, surface malformed rows, and validate finite amounts at every import/editor boundary. The canonical Ledger Schedule already separates currencies; do not replace that with cross-currency totals.

**AUDIT-025 — MEDIUM, CONFIRMED.** Async save outcomes are not uniformly respected. Watch save closes its editor immediately without awaiting `onUpdateCase`; group-delta apply clears the draft and announces Applied before persistence finishes; Client Report renders text before saving and ignores false success return. Attachment file handlers also have inconsistent rejection handling for parallel uploads. Users can lose draft context or see success-like state after storage failure. Keep dialogs/drafts until a successful commit, return a consistent result, and present partial upload failures explicitly.

**AUDIT-035 — MEDIUM, CONFIRMED.** `reportModel.projectParties` reads `role/relationshipRole` and `organisation/organization`, while the canonical Party stores `roles[]` and `organisationName`. A synthetic normalized witness/organisation projected blank role and organisation. Report output can omit meaningful context despite successful Party entry. Map canonical fields deliberately, including multiple roles, and test with normalized fixtures.

**AUDIT-036 — LOW, CONFIRMED.** Navigation persists arbitrary activeTab strings; startup only special-cases `tasks`, and import accepts activeTab without a whitelist. Unknown tabs render no normal workspace content. The dormant converter supplies `activeTab:'cases'`, which is not a CaseDetail tab. Navigation has no URL/deep-link/back-stack integration. Validate restored tabs; URL routing is an optional product improvement, not a required rewrite.

**AUDIT-037 — MEDIUM, CONFIRMED.** `groupLedgerEntriesByBatch` uses an ordinary `{}` accumulator indexed by user batchLabel. Labels such as `constructor` collide with inherited properties and cause `acc[key].items.push` to throw. A synthetic execution reproduced the exception. This is a user-input crash, not a proven global prototype-pollution exploit. Use a Map or own-key-safe dictionary and boundary tests.

## 9. UI / UX Findings

There are useful implemented improvements: task-oriented AI choices, report cards with audience/scope/completeness/output information, responsive workspace select navigation, explicit unknown/stale Client Report warnings, record conversion previews, missing-link indicators, empty/filter-reset states, and source-linked Overview actions. Report document primitives and CSS provide dedicated print layouts. These were inspected in code and rendered-string tests, not visually verified in this session.

**AUDIT-024 — MEDIUM, CONFIRMED source gaps.** Accessibility is uneven. AI Tools has an explicit focus/keyboard effect; `GptDeltaModal` and `FilePreviewModal` lack equivalent dialog semantics/focus trapping/escape handling, and File Preview has an unlabeled icon-only close button. WatchEditor has role/dialog labels and autofocus but no comparable focus trap. App's case forms and disabled legacy capture form rely heavily on placeholders rather than persistent associated labels. Attachment thumbnails use clickable images/divs, though a separate Preview button offers an alternate action. Source gaps are confirmed; screen-reader and keyboard impact remains unverified. Adopt a shared accessible modal/form baseline and then test keyboard/mobile behavior.

**AUDIT-026 — MEDIUM, CONFIRMED.** The advanced `ExecutiveSummaryReportArticle.jsx` still renders literal TODO/placeholder text, including management attention, chart placeholder and “What Is Working” content. It remains imported and rendered in advanced report paths. Do not describe this as the current canonical Management Report, which has a separate deterministic builder and improved document controls. Legacy/advanced outputs require an explicit draft/availability policy before external use.

UX risks requiring product judgment, rather than automatic redesign:

- “Issue,” “Sequence Group,” “thread,” “chain,” and generic diagnostic “issue” overlap. Rich stable Issues exist, but many selectors still present only names.
- Reports, Generate Report, Advanced Reports, Client Generator, Narrative and Print Pack can expose related content through different models.
- “GPT Ready” for 80–1,000 characters and “Partial Text” above 1,000 characters is a heuristic, not proof of extraction quality (`trackingRecordHelpers.getDocumentTextStatus`).
- Metadata-only Issues can exist without appearing in selectors derived solely from `getCaseSequenceGroups`, which enumerates record membership. The report model can represent them, but UI scope choices may not.
- Tiny uppercase metadata, dense desktop tabs, wide tracking tables, hard-coded white modal backgrounds and mixed dark-mode support warrant real viewport/contrast testing. No visual defect beyond source evidence is asserted.
- Native confirms are present for major deletion and group operations, but there is no uniform pending-save/unsaved-draft/undo model. Optional UX improvements should follow integrity fixes.

## 10. Code Quality & Maintainability

Strengths include focused pure modules for normalizers, diagnostics, report source projection, document building, output formatting, delta validation, and many UI helper functions. Shared RecordCard primitives and ReportDocument components reduce presentation duplication. No circular dependency was found by the static import scan. Existing adaptations to legacy report models are not inherently harmful if they preserve tested output parity.

**AUDIT-027 — MEDIUM, CONFIRMED structural debt; POTENTIAL scale impact.** App and CaseDetail total 13,518 lines and own persistence, forms, AI/report state, navigation and many async callbacks. CaseDetail creates numerous report documents and older report models through useMemo even when the corresponding report is not the visible task. App reloads all images for diagnostics on cases/selection/imageCache changes and accumulates cache entries. Build emits a 1,659.72 kB main JS chunk (385.64 kB gzip), plus a 2,447.99 kB header PNG and 678.67 kB logo. Actual responsiveness/OOM thresholds were not measured. Extract mutation and report controllers incrementally after integration tests; compute expensive models on demand and measure large-case behavior before optimizing.

JavaScript dominates; there is no TypeScript/checkJs/JSDoc schema enforcement across domain-return values. The merge `caseData` versus `caseItem` defect demonstrates a concrete cost of unchecked shapes. Adding checked boundaries or runtime schema validation would be useful; converting every file to TypeScript is not a prerequisite. Avoid cosmetic abstraction changes unrelated to demonstrated risks.

Repeated normalizers/parsers, string enums and duplicated list helpers encode business semantics differently. The task completion and nextActions mismatches are examples of real debt, not naming preferences. Prefer production-shaped fixtures and one authoritative contract per concept. Several newer files compress large expressions onto single lines, making review of mutations and error paths harder; readability work belongs after correctness.

## 11. Security & Privacy

### Trust boundaries and positive controls

The browser profile/origin is the principal security boundary. IndexedDB/localStorage contain investigation material; downloads and clipboard handoffs move it outside that boundary. The app is not an authentication or authorization authority. Case PIN, App Lock and Party confidentiality labels do not implement object-level access control or redaction.

Positive controls: App Lock stores a PBKDF2/SHA-256 hash with a random salt and 100,000 iterations; GPT updates use allowlists and reject binaries/deletion; React renders most source/AI text as escaped text; preview MIME types are restricted to common raster images and PDF; group audit HTML escapes `&<>`; downloads use generated Blob URLs in normal export paths. No direct `dangerouslySetInnerHTML` path or model-code execution was found in the reviewed active code.

**AUDIT-033 — MEDIUM, CONFIRMED limitation.** Per-case `privacyLock.pin` is plaintext in the case, while the App Lock is hashed separately. Neither encrypts cases, attachments, rescue/emergency snapshots or full backups. Corrupt/missing app-lock configuration disables the gate, and same-origin script/devtools can access storage independently of the UI. There is no persistent attempt-rate limit in the reviewed lock implementation. These features should be understood as casual screen privacy, not protection from another browser-profile user or compromised origin. Whether encryption is required is a product threat-model decision. The external PIN disclosure is separately HIGH in AUDIT-004 because it is a reachable handoff defect, not merely local storage design.

**AUDIT-023 — MEDIUM, POTENTIAL.** `FilePreviewModal` accepts imported `file.dataUrl/backupDataUrl`, and `getPreviewMimeType` falls back to caller-supplied MIME if the URL is not a data URL. There is no explicit URL-scheme/origin allowlist on those fallback fields. A crafted descriptor could supply a remote URL labeled PDF/image; preview may navigate/embed or request it, and download uses it directly as an anchor URL. No network request from malicious input was performed, and code execution is not asserted. Validate stored/imported payload URL format and restrict preview/download to intended local sources.

**AUDIT-018 — MEDIUM, POTENTIAL deployment risk with CONFIRMED source gaps.** `src/components/index.ts` is Deno server code sitting under components, outside active Vite reachability, ESLint's JS/JSX scope and Node tests. It accepts caseId, uses server-side `PROVEIT_SUPABASE_SECRET_KEY`, and queries a snapshot without an in-function user/ownership check. CORS permits all origins. A correctly configured gateway/authorization layer might mitigate access, but none is supplied. If deployed with broadly accepted credentials, possession of a case ID could expose a snapshot. This must be verified before activation; it is not a confirmed live breach. Its output also reconstructs summaries as importable case data, creating the AUDIT-003 integrity hazard.

The two client remote helpers use public VITE environment values and send different payload shapes (`id/name/type/status/priority/snapshot` versus `case_id/exported_at/case_json`). Neither calls the Deno reader's `{caseId}` contract. Both lack timeout/retry and parse JSON before checking response.ok. `ENABLE_SUPABASE_REMOTE=false` and no active helper imports prevent treating these as current sync functionality.

Secret scan result: no obvious hard-coded provider tokens/private keys detected in current repository text or logs; only environment-variable references were identified in remote code. The server secret variable must remain server-only. The `.gitignore` does not broadly ignore all `.env` filenames (it does ignore `*.local`), so future environment files need deliberate handling. No secret was copied into this report.

Privacy review must also include full party contact/address/confidentiality and case notes in complete handoffs. “No binary data” and “read only” do not mean anonymized, redacted, or safe for arbitrary external recipients. No external user-data transmission occurred during this audit.

## 12. Dependencies / Build / Configuration

| Item | Observed baseline |
|---|---|
| Runtime/toolchain | Node `v24.12.0`, npm `11.6.2`; package private/version `0.0.0`; ES modules |
| Framework | React/React DOM `19.2.4`; Vite `8.0.1`, React plugin `6.0.1` |
| Styling/UI | Tailwind and Tailwind Vite plugin `4.2.2`; Lucide React `0.577.0` |
| Persistence/export | idb `8.0.3`; JSZip `3.10.1` |
| Lint | ESLint `9.39.4`, hooks `7.0.1`, refresh `0.5.2`, browser globals; no autofix script |
| Scripts | dev, build, test (`node --test`), lint (`eslint .`), preview |
| Lockfile | npm lockfileVersion 3; no `deprecated` entries found |
| Compiler coverage | No typecheck script or tsconfig; Deno `.ts` code is not covered by active build/lint |
| Deployment | No committed deploy workflow/config, server headers, production-origin policy, remote SQL/RLS or environment template found |
| Security package check | `npm audit --json`: zero known vulnerabilities; no dependency upgrade performed |

**AUDIT-029 ? LOW, CONFIRMED.** README remains a framework template. The repository does not provide a deployment/recovery runbook, supported browser/runtime policy, environment setup guide or CI workflow. Because valuable data is tied to a browser origin, operators need explicit origin continuity, backup verification and restore procedures. Evidence: README.md and the root/configuration inventory; this is an operational documentation gap, not proof that an external runbook does not exist.

**AUDIT-031 — LOW, CONFIRMED.** `npm ls --depth=0` found six extraneous installed packages: `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`, `tslib`. The current installation is not a clean-install proof. Package.json has no engines or packageManager pin. Build/lint pass here; fresh installation and cross-platform deployment were not tested because dependency installation was outside this audit's mutation scope. Do not call packages unused solely because they are transitive or build-time. No known vulnerability or deprecation is inferred from age/version alone.

The initial preview sandbox error disappeared on the approved retry; it is an environment limitation, not evidence of a broken production bundle. Build configuration uses default Vite output and no route-level splitting. Origin changes (scheme/host/port) lead to a different browser storage namespace; deploying to a new URL requires a tested migration/export procedure, not an assumption that local cases follow the app.

## 13. Testing & Verification

### Exact commands and results

| Command / check | Result |
|---|---|
| `git status --short` before work | Clean |
| `git rev-parse HEAD` | `de90aeee32322283179610b29e09b3be6f0df8ac` |
| `node --version`; `npm --version` | `v24.12.0`; `11.6.2` |
| `npm test` | Exit 0; 852 passed, 0 failed/cancelled/skipped/todo; 130 test files in inventory; ~6.63 seconds reported test duration |
| `npm run lint` | Exit 0, no diagnostics; no `--fix` |
| `npm run build` | Exit 0; 1,878 modules; ~8.16 seconds; chunk-size warning; regenerated ignored `dist/` |
| `npm ls --depth=0` | Exit 0 for npm listing; declared packages installed, six extraneous packages listed |
| `npm audit --json` | Exit 0; total known vulnerabilities 0; dependency metadata total 218 |
| `npm run preview -- --host 127.0.0.1 --port 51893 --strictPort` | Sandbox attempt exit 1, EPERM/native-load error; approved outside-sandbox retry started successfully |
| `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:51893/` | HTTP 200; HTML references generated JS/CSS. No browser storage opened. |
| Audit-owned preview session Ctrl+C | Stopped; interrupted process exit 1 is intentional, not a test failure |
| `cua.getBrowser({url: 'http://127.0.0.1:51893'})` | No browser available; no visual runtime verification |
| PowerShell here-string piped to `node --input-type=module` | Four synthetic diagnostic batches; results below; no files or user storage written |
| Read-only Node inventory/import-graph/secret-pattern scripts | File/module/test counts, no detected relative-import cycle, no obvious secret-pattern candidate; scope limits apply |
| `git diff --check`; final `git status --short` | Final checks recorded in section 19 |

Some batched exploratory shell commands ended with exit 1 because a final `rg` search had no matches; these were not application verification failures. Initial `rg --files -g AGENTS.md` likewise found no instruction file.

### Synthetic observations

| Probe | Observed result |
|---|---|
| `normalizeCaseIssues(normalizeCase(richIssueCase))` | Rich Issue changed from ISS-009 to ISS-001; purpose/status/priority/reference retirement lost |
| `moveCaseSequenceGroupRecords` followed by canonical Issue normalization | Requested B, resulting persisted-shape membership A |
| `deleteCaseIssue` followed by normalization with unchanged legacy metadata | Deleted name recreated |
| `Object.keys(mergeCaseIssues(...))` | Contains caseData, not caseItem |
| Sparse matching Evidence merge | Current description replaced with empty default |
| Map-backed attachment restore with existing image ID | Existing synthetic bytes overwritten |
| Full-backup attachment with missing image | Descriptor returned without backupDataUrl and without error |
| v3 reasoning on canonical Action Summary | nextActions exported as empty array |
| split reasoning metadata | privacyLock still contains a pin property; no actual credential value displayed |
| split reasoning with legacy task | Full task notes absent; no tasks array/section |
| normalize legacy completed task | done becomes open |
| delete Party with Strategy owner | ownerPartyId remains unresolved |
| report projection of canonical Party | roles/organisationName become blank role/organisation |
| final Watch item removal | Suspicious shrink guard returns true |
| Markdown tracking table row with blank Notes | Parser returns zero rows |
| normalize invalid ledger amount | Number.isFinite returns false |
| Ledger batchLabel constructor | Throws “Cannot read properties of undefined (reading 'push')” |

### Coverage assessment

**AUDIT-028 — MEDIUM, CONFIRMED gap.** The suite has strong pure-domain, report-document, export/delta, storage-double, rendered-string and source-characterization coverage. Several tests explicitly preserve historical behavior (including restore-ID selection and log-and-continue attachment failure). Numerous `.source.test.js` tests check source text/regex and cannot verify user interactions or cross-module persistence. Passing independent Issue and case-normalizer tests did not catch their destructive composition. No integrated browser suite runs under npm test; `runtime-browser-proof.mjs` is a one-off mutable script, not a safe isolated regression harness.

Highest-value missing tests:

- Existing rich case -> startup -> save -> reload; metadata-only Issues, retired references, custom/legacy fields.
- All-app and selected-case backup round trips with shared/colliding IDs, missing bytes, partial failure and existing newer records.
- Issue create/move/split/merge/delete through the actual parent callback and persistence boundary.
- Quota failures and localStorage/IndexedDB split commits; multi-tab and stale GPT preview writes.
- Production-normalized Action Summary/Party/Watch fixtures through every report/GPT projection.
- Quick Capture reachability/conversion and last-Watch deletion.
- File-preview origin restrictions, malicious/malformed imports and blank table cells.
- Client provenance across reload/language changes and async-save failure draft retention.
- Keyboard/modal focus, mobile layout, actual download/print pagination and large cases.

No new tests, source changes or dependency changes were implemented in this audit. The synthetic probes establish reproducible evidence, not permanent regression coverage.

## 14. Dead Code / Legacy / Duplication

**AUDIT-030 — LOW, CONFIRMED candidates.** The static import scan identified `src/caseHealth.js`, `src/integrations/supabaseCaseSync.js`, `src/components/index.ts`, report-document wrapper/demo entry modules and `reportCapabilityAudit.js` as unreachable from main.jsx. Some are deliberate test/API surfaces: the capability auditor is used by tests, and document wrappers re-export shared foundation components. Do not delete them merely because this graph marks them unreachable. The older root caseHealth duplicates the active `src/lib/caseHealth.js` implementation and is a stronger cleanup candidate.

Additional legacy/parallel areas:

- `App.css` and React/Vite SVG assets retain starter-template content; no active App.css import was found.
- Disabled `overview-placeholder-disabled` and `overview-legacy` branches remain inside CaseDetail, as does an Ideas branch without a normal tab.
- Legacy evidence store/helper functions coexist with embedded canonical evidence.
- Label-keyed Sequence Group metadata/operations coexist with stable Issue objects.
- `reportBuilder.js` builds older executive/thread/pack/bundle models beside canonical report documents; advanced UI still uses them.
- Tracking record markers/parser helpers occur in App, case domain, export and tab helpers. Changes must preserve existing data grammar until an explicit migration is designed.
- Action Summary normalization appears in domain and UI helpers, while v3 export uses a different list expectation.
- Report document thin wrappers are not necessarily duplicates to remove; they can be stable import boundaries.

**AUDIT-034 — LOW, CONFIRMED.** `saveCaseToDb` logs an operation and stack for every save, including non-destructive saves; startup always reconstructs and saves cases. Logs are noisy, and `mergeCase` concatenates auditLog arrays without deduplication, so repeated imports can multiply historical entries. The audit log is not append-only tamper evidence. Four ignored runtime logs already exist; they contain historical error markers and cannot be treated as current failures. Define useful event logging and deduplication without erasing historical user context.

## 15. Cross-System Consistency Findings

| System boundary | What appears reasonable independently | Combined failure / evidence |
|---|---|---|
| Issue schema -> case normalizer -> startup save | Stable Issue schema and legacy normalizer each have tests | Normalizer drops new fields; startup persists loss (001) |
| Group operation -> canonical save | Name-only move reports success | Old membership ID wins and reverses move (005) |
| New Issue API -> UI handler | Domain returns successful caseData | Handler passes undefined caseItem (005) |
| Issue deletion -> legacy registry | Delete retires reference and clears links | Save reads old registry and recreates deleted Issue (005) |
| Backup -> image store -> case commit | Restore helper writes files; case guard prevents bad overwrite | Files overwritten first; rollback can delete existing/shared files (002) |
| Import normalization -> merge | Defaults create a well-shaped record | Missing fields become explicit empty replacements of newer content (003) |
| Backup status -> recovery | Download initiated and timestamp saved | Missing bytes are not counted; recent import can look like verified backup (006) |
| Split export -> case privacy | Generic binary sanitizer removes file bytes | PIN is non-binary metadata and leaks to GPT handoff (004) |
| Action Summary -> v3 reasoning | Canonical completion objects and strings-only exporter each work on own fixtures | Next actions disappear (015) |
| Party editor -> report projection | Roles/organisation valid in canonical Party | Projector reads different property names (035) |
| Party delete -> planning | Generic link arrays cleaned | Scalar Strategy/Issue ownership becomes orphaned (014) |
| Watch delete -> save guard | Guard protects nonempty arrays | Intentional final deletion lacks override and cannot complete (010) |
| Tracking text -> parser -> Ledger/GPT | Text stored successfully | Empty cells cause silent row omission in derived output (022) |
| Generated report -> persistence -> provenance | Text persists; metadata validation works in session | Reload loses source identity/review metadata (016) |
| Legacy tasks -> “complete” package | Task snippets appear in chronology | Full task records missing; task completion also normalized away (019/021) |
| UI promise -> storage | Parent returns false on failure | Several child handlers discard draft/announce success without awaiting it (025) |
| Remote reasoning -> legacy import | Reader produces case-shaped summary data | Current importer accepts it and can replace full record content (003/018) |

These are the primary reason to prioritize integration/round-trip tests over increasing source-string test counts.

## 16. Risk Register

Severity reflects current reachable impact and available evidence. P0/P1 ordering is in section 17. No data-loss incident against actual user data was performed or observed.

| ID | Severity | Area | Finding / confidence | Impact | Evidence/location | Recommended action |
|---|---|---|---|---|---|---|
| AUDIT-001 | HIGH | Persistence/Issues | CONFIRMED: normalization drops Issue identity/metadata and startup writes it | Silent rich Issue/history loss on reload/import/GPT update | caseDomain.normalizeCase/normalizeRecord; App loadCases; issueDomain; gptDeltaV3 | Preserve canonical fields; design versioned non-lossy migration and round-trip tests |
| AUDIT-002 | HIGH | Restore | CONFIRMED: attachment ID reuse before case commit; cleanup deletes restored IDs | Existing/shared attachment bytes overwritten or deleted | fullBackup.restoreFullBackupAttachment; App.restoreBackupPayload | Prevalidate, remap IDs, transaction/journal with true rollback |
| AUDIT-003 | HIGH | Import | CONFIRMED: normalized incoming defaults overwrite matching records | Older/sparse backup can erase current text/files/links | caseDomain.mergeCase/mergeRecords; App restore | Preserve absent fields; conflict/revision preview and explicit merge policy |
| AUDIT-004 | HIGH | GPT/privacy | CONFIRMED: split metadata includes plaintext case PIN | Credential disclosure in intended external handoff | splitReasoningPackage.projectSplitReasoningSections | Explicit safe projection; credential-exclusion tests |
| AUDIT-005 | HIGH | Issue workflow | CONFIRMED: stale membership IDs, wrong merge return property, deletion recreation | Moves/merge/delete do not produce stated saved result | CaseDetail managed handlers; caseDomain legacy operations; issueDomain | One canonical mutation API; saved/reloaded integration checks |
| AUDIT-006 | HIGH | Backup confidence | CONFIRMED: absent bytes silently omitted; success/recency overstated | User relies on incomplete recovery file | fullBackup builders; App backup/import notices | Completeness manifest, missing-file warnings, verified status distinctions |
| AUDIT-007 | MEDIUM | Concurrency/GPT | POTENTIAL: stale whole-case puts and cached delta apply; no replay identity | Lost concurrent edits or duplicate created records | storage.saveCaseToDb; App.applyValidatedGptDelta; gptDeltaV3 | Revision checks, serialized mutations and replay policy |
| AUDIT-008 | MEDIUM | Schema/legacy | CONFIRMED: weak preflight and unversioned eager normalization | Bad record blocks load; legacy/unknown fields lost | db.upgrade; caseDomain; App load/restore | Validate before writes; quarantine/versioned migration; legacy inventory |
| AUDIT-009 | MEDIUM | Local durability | CONFIRMED: unguarded localStorage writes, empty fallbacks, cross-store commits | Unsaved captures/folders or partial conversion; quota pressure | App effects; rescueSnapshot; storage emergency writes | Durable error-aware persistence and bounded recovery retention |
| AUDIT-010 | MEDIUM | To Watch | CONFIRMED: last-item deletion trips overwrite guard | Confirmed deletion fails | WatchWorkspace.remove; App.handleUpdateCase; storage guard | Explicit destructive save path and regression test |
| AUDIT-011 | MEDIUM | Capture/legacy UI | CONFIRMED: creation/review UI disabled; historical/imported captures persist | Captures lack normal review/conversion path | App.SHOW_REVIEW_QUEUE and capture handlers | Product decision plus safe access to existing captures |
| AUDIT-012 | MEDIUM | Attachments/retention | CONFIRMED: orphan bytes/captures/metadata; conditional legacy shared-file cleanup | Quota growth, residual sensitive data, conditional file loss | App upload/delete; storage.deleteCaseFromDb | Reference inventory and conservative transactional cleanup |
| AUDIT-013 | MEDIUM | Attachment preview | CONFIRMED missing hydration paths; LIKELY missing previews | Legacy digital-only files/Watch/task files not cached | App.loadAllImages; AttachmentPreview/FilePreviewModal | Shared reference enumeration and clean-cache browser tests |
| AUDIT-014 | MEDIUM | Relationships | CONFIRMED: Party deletion leaves scalar owner references | Orphaned Strategy/Issue ownership | caseDomain.cleanupDeletedRecordLinks/deletePartyFromCase | Explicit scalar-reference cleanup/reassignment policy |
| AUDIT-015 | MEDIUM | GPT v3 | CONFIRMED: canonical next-action objects filtered out | GPT loses planned actions | reasoningExportV3 actionSummary projection | Map canonical actions; normalized fixture contract tests |
| AUDIT-016 | MEDIUM | Client reports | CONFIRMED: provenance transient and fingerprint coverage partial | Saved narrative loses auditability/staleness certainty | CaseDetail.clientNarrativeMeta/save/effect; reportModel | Persist per-language provenance and define revision inputs |
| AUDIT-017 | MEDIUM | GPT contracts | CONFIRMED: generic v2/tempId rules contradict v3/clientId additions | Invalid GPT outputs; brittle prompt evolution | gptProtocolPack sections; gptDelta validators | Version-specific single capability contract and validated examples |
| AUDIT-018 | MEDIUM | Dormant remote | POTENTIAL: service-role reader lacks in-function ownership; summary converted to import | Disclosure or lossy restore if activated unsafely | components/index.ts; integrations/supabaseCaseSync.js | Verify deployment auth/schema; prohibit summary-as-backup before enabling |
| AUDIT-019 | MEDIUM | Split package | CONFIRMED: full tasks omitted despite completeness claim | Incomplete external reasoning context | splitReasoningPackage COLLECTIONS/sections/manifest | Add task content or explicit scope exclusion; consistent identities |
| AUDIT-020 | MEDIUM | IDs/import | POTENTIAL: duplicate/cross-type IDs accepted and resolved ambiguously | Wrong links or collapsed records | merge Maps; reportModel.resolveReferences | Validate unique identity and typed target resolution |
| AUDIT-021 | MEDIUM | Dates/status | CONFIRMED: unknown dates become dates; done tasks become open | Misleading chronology/completion after load | caseDomain normalizers; report/health consumers | Preserve uncertainty/status semantics with migration tests |
| AUDIT-022 | MEDIUM | Records/Ledger | CONFIRMED: blank table cells drop rows; invalid numeric input yields NaN | Silent derived/export omissions and inaccurate values | trackingRecordHelpers.parseTrackTable; normalizeLedgerEntry | Lossless parser and finite numeric validation |
| AUDIT-023 | MEDIUM | Import/URL | POTENTIAL: imported non-local URL accepted via MIME fallback | Unintended remote request/embed/navigation | fileSecurity.getPreviewMimeType; FilePreviewModal | Restrict local payload URL format and preview sources |
| AUDIT-024 | MEDIUM | Accessibility | CONFIRMED source gaps in modal semantics/focus and labels | Keyboard/screen-reader barriers | GptDeltaModal; FilePreviewModal; WatchEditor; App forms | Shared accessible dialog/form baseline; browser testing |
| AUDIT-025 | MEDIUM | Save feedback | CONFIRMED: children do not await/check save outcome | Draft loss or misleading success after failed writes | WatchWorkspace; CaseDetail group/report handlers; App file handlers | Consistent async result contract; retain drafts on failure |
| AUDIT-026 | MEDIUM | Advanced reports | CONFIRMED: reachable legacy renderer includes TODO placeholders | Unfinished external-looking report output | ExecutiveSummaryReportArticle; CaseDetail advanced branch | Explicit draft/availability policy; eliminate exposed placeholders later |
| AUDIT-027 | MEDIUM | Architecture/performance | CONFIRMED monolith/eager models/large bundle; POTENTIAL scale failure | High integration cost, slow large cases and memory pressure | App/CaseDetail; build output; diagnostic image effect | Incremental controllers, lazy model evaluation and profiling |
| AUDIT-028 | MEDIUM | Verification | CONFIRMED: strong unit/source tests lack critical composed workflows | Serious regressions pass current suite | 130 tests; runtime-browser-proof.mjs | Add isolated persistence/browser/round-trip failure tests |
| AUDIT-029 | LOW | Operations/docs | CONFIRMED: template README, no deployment/recovery runbook | Setup/origin/recovery uncertainty | README; root inventory/config | Document supported environment, origin and restore procedures |
| AUDIT-030 | LOW | Legacy code | CONFIRMED unreachable/parallel candidates, some intentional | Drift and maintenance burden | caseHealth.js; disabled UI; report wrappers/adapters | Validate reachability/ownership before cleanup |
| AUDIT-031 | LOW | Dependencies/config | CONFIRMED: extraneous installs, no runtime pin/fresh install proof | Environment reproducibility uncertainty | npm ls; package.json/lock | Fresh CI install validation and supported runtime policy |
| AUDIT-032 | INFO | Supplied exports | CONFIRMED: stated business/GPT exports absent from workspace | External configuration comparison incomplete | Full non-vendor inventory; user location request | Obtain artifact paths and append comparison without assuming parity |
| AUDIT-033 | MEDIUM | Local privacy | CONFIRMED: locks are UI gates; data/backups unencrypted | Sensitive data readable outside UI gate | appLock; case privacyLock; storage/fullBackup | Define threat model and accurately describe protection; decide encryption |
| AUDIT-034 | LOW | Logging/history | CONFIRMED: noisy all-save logging; repeated import duplicates audit log | Diagnostic noise and history growth | storage logging; caseDomain.mergeCase | Scoped event logging and non-destructive deduplication policy |
| AUDIT-035 | MEDIUM | Reports/Parties | CONFIRMED: canonical role/org fields not projected | Missing report context | reportModel.projectParties; normalizeParty | Align canonical fields and report tests |
| AUDIT-036 | LOW | Navigation | CONFIRMED: arbitrary persisted/imported tabs accepted | Blank workspace on legacy/invalid values | App tab initialization/import; CaseDetail tabs | Whitelist/fallback restored navigation |
| AUDIT-037 | MEDIUM | Ledger | CONFIRMED: inherited dictionary-key collision | User-provided batch name crashes tab | ledgerViewHelpers.groupLedgerEntriesByBatch | Map/own-key-safe dictionary and adversarial-label tests |

| Severity | Count |
|---|---:|
| CRITICAL | 0 |
| HIGH | 6 |
| MEDIUM | 25 |
| LOW | 5 |
| INFO | 1 |
| **Total** | **37** |

## 17. Recommended Remediation Roadmap

This is a proposed sequence for Product Owner/DevLead review. **Nothing in this roadmap was implemented.**

### P0 — immediate data-loss/disclosure risks

1. **Preserve Issue data before any further normalization/migration work (001).** Add failing round-trip fixtures for rich/empty/retired Issues, then make the canonical save/load/import contract non-lossy. Preserve raw historical data until the migration is reviewed. Do not attempt to regenerate lost reference history from names as if it were authoritative.
2. **Prevent binary overwrite/delete during restore (002), and preserve current records on older/sparse import (003).** Validate/import-plan first; use fresh attachment IDs, conflict decisions and a recoverable commit. Cover shared IDs, partial failure and repeated imports before releasing a change.
3. **Remove lock material from GPT split handoffs (004).** Audit every exported case projection using synthetic credential markers, without circulating real backup data.
4. **Make Full Backup completeness/status truthful (006).** Count missing binaries and surface partial results before a backup is used as a safety prerequisite. Distinguish download attempted, file verified and imported-from-backup states.

These items share test infrastructure (028). Add the minimum integrated harness alongside the fixes rather than postponing correctness for a broad framework migration.

### P1 — correctness and reliability

- Repair all Issue operation paths and result shapes after the canonical schema is stable (005); verify create/edit/move/split/merge/delete through save/reload and legacy metadata cleanup.
- Add revision/concurrency/replay protection and preflight/quarantine for malformed historical imports (007, 008, 020).
- Make captures/folders/recovery writes error-aware, then standardize awaited mutation results and explicit last-Watch deletion (009, 010, 025).
- Preserve scalar owner relationships and canonical date/completion meaning (014, 021).
- Repair v3 action projection, complete split task scope, blank-cell parsing/numeric validation, and reserved Ledger labels (015, 019, 022, 037).
- Persist Client Report provenance and define its staleness inputs (016).
- Establish safe attachment cleanup coverage before introducing any orphan deletion operation (012).
- **Activation gate only:** do not enable/deploy the dormant remote path without verified auth/ownership/schema and non-lossy export semantics (018). No live emergency is inferred.
- Add integrated regression coverage for each of these changes (028); passing source tests alone is insufficient acceptance.

### P2 — maintainability, UX and test improvements

- Restore/clarify access to quick captures and legacy tasks, with Product Owner input (011); validate legacy tab fallback (036).
- Fix missing attachment hydration and Party report projection (013, 035).
- Consolidate version-specific GPT documentation/examples and export identity conventions (017, 019).
- Validate imported URL sources, define local privacy guarantees and evaluate encryption requirements (023, 033).
- Improve modal/form accessibility and remove or clearly mark unfinished advanced reports (024, 026).
- Extract mutation/report orchestration incrementally and profile realistic attachment/record volumes; preserve existing report builders until parity is verified (027).
- Add clean-install/CI, browser/print/mobile verification and operational documentation (028, 029, 031).

### P3 — optional cleanup/optimization

- Remove or archive proven unused starter/legacy code only after references/tests and historical data paths are understood (030).
- Reduce logging noise and define repeated audit-history import semantics (034).
- Optimize branding assets/chunk loading based on measured usage (027).
- Consider URL deep links and simpler report/tool navigation as product improvements (036), not prerequisites for data safety.

Dependency order matters: preserve schema/identity first, repair mutation orchestration next, then consolidate exports/reports. Do not clean legacy stores, retired records or attachment orphans until a complete reference inventory and tested recovery path exist.

## 18. Open Questions for Product Owner

1. Where are the stated supplied GPT/application JSON and information exports, and which versions are actually installed in the external GPTs?
2. Is the whole Quick Capture creation/review workflow intentionally disabled? How should users access and resolve existing queued captures and legacy completed tasks?
3. Are browser-profile privacy gates sufficient for the intended deployment, or must case files, attachments and backups be encrypted? Which external GPT recipients are approved for which case/Party data?
4. On importing an older backup over an existing case, should the user choose restore-as-copy, exact historical restore, or explicit conflict merge? The current implementation silently merges by incoming precedence.
5. Are metadata-only Issues expected to appear in all report/AI scope selectors? Which name/reference should users consistently see when Issues are renamed or retired?
6. Is any copy of the dormant Supabase function actually deployed, and what authentication/ownership boundary and table schema protect it?
7. Which report surfaces are intended for external sharing: canonical Reports Centre only, or also the advanced executive/thread/bundle reports and Print Pack?
8. What should an undated event and a historical completed task mean in current workflows? Defaulting either to a new active dated item should not be accidental.
9. What retention behavior is intended when deleting a case: its captures, retired metadata, emergency copies and orphan attachment bytes included or retained for recovery?

These questions concern intended behavior/deployment or unavailable artifacts. Code defects such as discarded Issue fields, the merge property mismatch, blank-cell row loss and the PIN export do not require product clarification to establish their existence.

## 19. Appendix

### A. Important implementation anchors

| Concern | Modules/functions |
|---|---|
| Case mutation | `App.handleUpdateCase`, saveRecord/saveDocumentEntry/saveLedgerEntry/saveParty/deleteRecord; `domain/caseDomain.js` upsert/delete/merge helpers |
| Normalization | `normalizeCase`, `normalizeRecord`, `normalizeDocumentEntry`, `normalizeLedgerEntry`, `normalizeParty`, `normalizeWatchItem`, `normalizeTimelineFields` |
| Issue identity | `domain/issueDomain.js` normalizeCaseIssues/createCaseIssue/updateCaseIssue/mergeCaseIssues/deleteCaseIssue/buildIssueIndex |
| Legacy group operations | `domain/caseDomain.js` moveCaseSequenceGroupRecords/splitCaseSequenceGroup/removeCaseSequenceGroupRecords/renameCaseSequenceGroup; `sequenceGroupMeta.js` |
| Storage integrity | `storage.js` saveCaseToDb/deleteCaseFromDb/collectEmbeddedCaseImageIds; `db.js` upgrade |
| Recovery | `backup/fullBackup.js`; `App.restoreBackupPayload/restoreRescueSnapshot/handleFullBackup`; `rescueSnapshot.js` |
| Attachments | `App.fileToSerializable/loadAllImages`; AttachmentPreview/FilePreviewModal; `lib/fileSecurity.js` |
| Relationships | `domain/linkingResolvers.js`; syncCaseLinks/cleanupDeletedRecordLinks; `export/linkMapExport.js` |
| Monitoring/planning | WatchWorkspace/watchWorkspaceHelpers; StrategyWorkspace/StrategyEditorSection; operationalIntegrity; caseBriefing model |
| Tracking/ledger | trackingRecordHelpers/recordsGptExport/ledgerViewHelpers; RecordsTab/LedgerTab; App tracking form text helpers |
| Canonical reports | reportDefinitions/reportScopes/reportModel/reportRecordUtils/reportDocument/buildActiveReportDocument/reportOutputs; type-specific document builders and adapters |
| UI report composition | ReportCentreControls/ReportOutputActions/ReportContextHeader; shared ReportDocumentFoundation and print CSS; CaseDetail reportCentre state |
| AI contracts | gptDelta/gptDeltaV3/sequenceGroupDelta; GptDeltaModal; gptProtocolPack; aiToolsConfig; proveitReportFormat/clientReportValidation |
| Disabled remote | integrations/supabaseCaseSync.js; components/index.ts; CaseDetail.ENABLE_SUPABASE_REMOTE |

### B. Screens and integrations

Normal tabs: Overview, Parties, Incidents, Evidence, To Watch, Documents, Records (inserted after Documents), Ledger, Timeline, Reports (tab ID generate-report), Strategy, Narrative, Print Pack. Dashboard, lock screens, record/file editors, AI tools and Issue manager are overlays/stateful views rather than routes. Disabled/legacy branches include tasks navigation fallback, Ideas, overview-legacy and overview-placeholder-disabled.

Active external surfaces are browser clipboard, file download/upload selection, and browser printing. External GPT usage is manual. Dormant Supabase configuration references `VITE_SUPABASE_FUNCTION_URL`, `VITE_SUPABASE_ANON_KEY`, server `SUPABASE_URL`, and server `PROVEIT_SUPABASE_SECRET_KEY`; no values are included here.

### C. Historical artifacts inspected

- `PROVEIT_CURRENT_STATE_AUDIT.md` — general earlier baseline; not current evidence for new Issue/report functionality.
- `PROVEIT_CASE_WORKFLOW_AUDIT.md` — prior user/workflow assessment; overlap with current navigation/backup/report concerns rechecked.
- `PROVEIT_REPORTS_CENTRE_AUDIT.md` — earlier report workflow assessment; current categories/capabilities are more developed.
- `PROVEIT_REPORT_DOCUMENT_DESIGN_AUDIT.md` — design recommendations, not a runtime specification or current security severity scale.
- `runtime-browser-proof.mjs`, `runtime-sequence-group-manager.png` — historical proof script/screenshot, not current visual verification; script intentionally not run.
- `runtime-vite.err.log`, `runtime-vite.out.log`, `vite-dev.err.log`, `vite-dev.out.log` — ignored historical logs; inspected through bounded error-marker inventory, not reproduced as current failures.
- `package.json`, `package-lock.json` — only physical non-vendor JSON artifacts discovered; not GPT information exports.
- All export/AI source generators listed in section 7 — inspected as implementation contracts; synthetic outputs generated in memory only.

### D. Reproduction examples (synthetic, read-only)

The following examples can be run from the repository with a PowerShell single-quoted here-string piped into `node --input-type=module`. They import no storage database module and operate only on new values. They are documentary examples, not added test files.

```js
import { normalizeCase, moveCaseSequenceGroupRecords } from './src/domain/caseDomain.js';
import { normalizeCaseIssues } from './src/domain/issueDomain.js';

const original = {
  id: 'audit-synthetic', name: 'Synthetic',
  issues: [{ id: 'original', reference: 'ISS-009', name: 'A',
    purpose: 'Preserve me', status: 'resolved', priority: 'high' }],
  retiredIssueReferences: ['ISS-010'], nextIssueReferenceNumber: 12,
  incidents: [{ id: 'i', title: 'Synthetic', sequenceGroup: 'A',
    sequenceGroupId: 'original' }],
};
const reloaded = normalizeCaseIssues(normalizeCase(original)).caseData;
console.log(reloaded.issues, reloaded.retiredIssueReferences);
// Current result: rebuilt ISS-001, lost purpose/status/history.

const moved = moveCaseSequenceGroupRecords({ caseData: reloaded,
  sourceGroup: 'A', destinationGroup: 'B',
  recordRefs: [{ recordType: 'incidents', recordId: 'i' }] });
console.log(moved.caseItem.incidents[0].sequenceGroup);
console.log(normalizeCaseIssues(moved.caseItem).caseData.incidents[0].sequenceGroup);
// Current result: B, then A.
```

```js
import { parseTrackTable } from './src/components/caseDetail/trackingRecordHelpers.js';
import { groupLedgerEntriesByBatch } from './src/components/caseDetail/ledgerViewHelpers.js';
console.log(parseTrackTable(
  '| Date | Expected | Notes |\n| --- | --- | --- |\n| 2026-01-01 | 10 | |'
)); // Current result: [] despite one table row.
try { groupLedgerEntriesByBatch([{ id: 'synthetic', batchLabel: 'constructor' }]); }
catch (error) { console.log(error.message); }
```

### E. Relevant TODO / placeholder locations

- `src/diagnostics/caseDiagnostics.js:504–507`: escalation readiness, report scoring, contradiction analysis and AI-assisted diagnostics extension comments. These are unimplemented extensions, not evidence of current AI scoring.
- `src/components/reports/ExecutiveSummaryReportArticle.jsx`: management attention, chart, narrative and progress TODO placeholders, including lines 101–133, 225, 245, 293–316 at this baseline.
- `src/components/CaseDetail.jsx`: disabled overview placeholder/legacy sections and parallel advanced report paths.
- `src/report/clientReportValidation.js`: TODO appears as a rejection pattern; it is a validator control, not an unfinished implementation.

### F. Repository change and final quality record

Final tracked/untracked change: **this new audit document only**. No application source, tests, configuration, schemas, dependencies, lockfile, existing documentation, exports or user/application data were intentionally modified. No remediation was started.

The existing build command necessarily regenerated ignored `dist/` output. It was already present before the audit and was not snapshotted first; its prior ignored bytes cannot be safely reconstructed from Git. It is retained as verification output rather than deleted or replaced with an assumed baseline. Preview tooling may also refresh ignored Vite temporary cache files under node_modules. These generated effects are distinct from application changes and are not portable user backups.

Final quality pass completed: all 19 sections and 37 stable finding IDs checked; severity totals reconciled; register/detail and roadmap alignment reviewed; P0/P1 items tied to repository evidence; no secret values included. Final `git diff --check` passed and Git status showed only this new document. Git emitted a line-ending notice for the existing PROVEIT_REPORT_DOCUMENT_DESIGN_AUDIT.md, but no tracked diff or modification was present.
