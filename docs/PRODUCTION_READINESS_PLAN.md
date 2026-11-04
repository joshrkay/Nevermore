# Edgar Allan Advisory: Production Readiness Plan

| | |
|---|---|
| **Version** | 2.7 (v1.0 refreshed against the code, then updated after F-0.2 and F-0.4 landed, `document-extract` moved onto the adapter and gained the per-address and global ceilings, A-2.2 added database validation and versioned writes, A-1.3, A-1.4, A-1.5, A-2.1 and A-3.2 closed Epic A's open work, and version 2.7 closed Epic G with D6 decided) |
| **Date** | 2026-11-03 |
| **Verified against** | `main` at commit `2a5e9af` (merge of pull request 27). That includes the `chamber-extract` fix, the move of `document-extract` onto the shared adapter, the per-address and global ceilings on document reads and the edge-function type check (pull request 26), and the end-to-end test (pull request 25). Version 2.3 was verified against `6f2bf5c` plus branch `claude/peaceful-albattani-neiujl`; v1.0 against `04503c3` (2026-10-20). A-2.2 (version 2.5) was verified on a branch cut from `2a5e9af`, before pull request 28's review fixes to the end-to-end test. |
| **Scope** | Everything between the current build and a supervised private pilot (M2) and a public launch (M3) |
| **How it was verified** | Every story was checked against the migrations, functions, front end, tests and docs. `npm ci`, `npm run lint` (0 errors, 8 warnings), `npm run typecheck:functions`, `npm test` (685 tests in 48 files) and `npm run build` all pass. The fixed `chamber-extract` handler and `document-extract`'s model call were also type-checked and run under Deno 2.9.6 with the network denied. A manual CI run of the branch (run 40063090154, on commit `a180305`) passed both jobs: `verify`, including `typecheck:functions`, and `sql-tests`. The `e2e` job has run green in CI: pull request 25's run 40774885703 on its final commit, and pull request 27's run 40812758403. This refresh read the test and its stand-ins and did not re-run the end-to-end test. **Not run:** `chamber-extract/index.ts` under Deno (its URL imports are unreachable from the verification environment). Nothing was deployed or tested live, so statuses describe the repository, not a running environment. A-2.2 was checked separately on `a22-local` with `npm run lint` (0 errors, 8 warnings), `npm run typecheck:functions`, `npm test` (806 tests in 50 files), `npm run build`, all eight SQL tests and `npm run test:e2e` (four tests, run three times in a row). The new two-tab test fails when the client's version condition is removed. Two real database connections saving from one version were checked by hand, not in CI. Version 2.6 (A-1.3, A-1.4, A-1.5, A-2.1, A-3.2) was checked on branch `claude/sharp-keller-qpo079`, cut from `main` at `34441de`, with `npm run lint` (0 errors, 8 warnings), `npm run typecheck:functions`, `tsc -p tsconfig.app.json` (clean once the advisor page's lost imports were restored), `npm test` (1,204 tests in 66 files), `npm run build`, all eleven SQL tests on Postgres 16, and `npm run test:e2e` (seven tests, three runs in a row). The new SQL and hook tests were checked to fail when the rule each covers is removed. The `/verify` harness (real PostgREST 12.2.3 and `dispatch-outbox` under Deno) passed its certify-and-send flow. Rebuilt on every migration, it showed that certifying through the lifecycle trigger still sends exactly two emails, that an expired draft can't be certified and queues nothing, and that archiving and every refused caller behave over HTTP. That run is also why a missing intake answers `PT404` (HTTP 404) and not `P0002`, which PostgREST turns into a 500. Nothing was deployed. Version 2.7 (Epic G, US-5.1 to US-5.3) was checked on branch `claude/vigilant-brahmagupta-astca7`, cut from `main` at `578cfba` and merged with `main` at `378abef`, with `npm run lint` (0 errors, 8 warnings), `npm run typecheck:functions`, `tsc -p tsconfig.app.json`, `npm test` (1,345 tests in 72 files), `npm run build`, all thirteen SQL tests on Postgres 16, and `npm run test:e2e` (nine tests, all 28 migrations). The new File ID and email-label tests were checked to fail before the change. The `/verify` harness (real PostgREST 12.2.3 and `dispatch-outbox` under Deno 2.9.6) delivered both emails labelled File ID with no census values, sent nothing for a repeat certification of the same answers, and sent one "Updated Intake" alert and a second, identical confirmation for changed answers. With US-1.2's readiness check loaded, a certification missing required answers was refused (`EA003`) and queued nothing, and a complete one sent both emails. Nothing was deployed. |

---

## 0. How to Read This Document

### 0.1 Sizing rules

| Size | Meaning |
|---|---|
| **S (Small)** | One focused UI, copy, validation, or configuration change. Roughly 0.5 to 1.5 engineer-days. |
| **M (Medium)** | One coherent feature across a few frontend and backend components. Roughly 2 to 4 engineer-days. |
| **L (Large)** | **Not used.** Anything that would be Large is split into S or M stories below. |

### 0.2 Status vocabulary

Every story carries one status, judged against its written acceptance criteria (AC), not against general quality.

| Status | Meaning |
|---|---|
| **DONE** | Every AC is met by code in the repository. Small caveats are listed under Notes. |
| **PARTIAL** | Some ACs are met. The Remaining line lists what is not. |
| **SUPERSEDED** | The story's intent is met by a different design than the one it prescribes (see D14). The Built line says what the design is, and Remaining lists any gap against the original intent. |
| **NOT STARTED** | Nothing in the repository implements it. |
| **NOT VERIFIABLE** | A manual, operations, legal or QA step with no artifact in the repository. It may have been done elsewhere. |

### 0.3 Story format

Each story lists its status, size, priority, owner, dependencies and milestone, then:

- **Built**: what exists today, with the file or symbol where it lives.
- **Remaining** (or **Notes** for DONE): what is missing against the AC.
- For NOT STARTED stories, and where marked, the **Scope**, **AC** and **Tests** from v1.0 (or a revised version, marked *Revised*).

Owners: `FE` frontend, `BE` backend/database, `FS` full stack, `PM` product, `QA` quality assurance, `LEGAL`, `OPS` operations, `DES` design. Milestones: `M1` internal demo, `M2` private pilot, `M3` public launch.

**Reading v1.0 text that survives here.** v1.0 assumed continuation tokens, an `intake_sessions` table and edge-function-only access. The code uses Supabase Auth and owner row-level security instead (D14). Where retained text says *token*, read *the owner's signed-in session*. Where it says *edge-function action*, read *a database function, a trigger, or a row-security-protected write*. Stories whose text could not be read that way are rewritten and marked *Revised*.

### 0.4 Terms

- **The Chamber**: the intake experience at `/start` (`src/pages/ChamberPage.tsx`).
- **Lenore**: the AI intake assistant (`src/hooks/useLenoreChat.ts`, `supabase/functions/chamber-extract`).
- **The Reckoning**: the final-step tab that certifies and hands off to the Manuscript (`src/components/chamber/ReckoningTab.tsx`).
- **The Manuscript**: the underwriting packet page and PDF at `/manuscript?session=<id>` (`src/pages/ManuscriptPage.tsx`, `src/lib/manuscriptPdf.ts`).
- **Intake session**: a `chamber_sessions` row (`chamber_data`, `field_provenance`, `transcript`, `submission`, `status`), owned by a Supabase Auth user, who may be an anonymous guest.
- **Continuation token**: **not used.** A guest returns through their browser's auth session and the `?session=` URL parameter (D1, D14).
- **Snapshot**: the `submission` jsonb on the session plus its `chamber_certifications` row (with `data_sha256`). Advisors generate further versions in `manuscript_versions`.

---

## 1. Current State (Verified Against the Code)

### 1.1 What the product does today

| Area | What exists today |
|---|---|
| Entry and accounts | Guests sign in anonymously (optional Turnstile CAPTCHA). Certifying needs an email-verified account: the guest adds an email, enters a 6-digit code, and is upgraded in place (`VerifyEmailGate`, a database trigger blocks guest certification). Password sign-in and sign-up are at `/login`. |
| Lenore chat | `chamber-extract` (`handler.ts`, behind a thin `index.ts`) extracts every intake field except the census with a per-field status and evidence quote, and writes a reply. It requires a signed-in user, caps a message at 2,000 characters and context at 20,000, and enforces per-user (15 a minute, 300 a day), per-IP (20 a minute, 400 a day) and global (2,000 a day) call limits that fail closed. Voice (ElevenLabs) is an opt-in beta behind `VITE_ELEVENLABS_AGENT_ID`. |
| Workspace | Nine tabs: Upload, Company, Payroll, Benefits, Your Team (census), Dependents, Review, PEO Match, The Reckoning. Autosave runs 2 seconds after the last change with a 10-second retry. A session survives refresh through `?session=`. |
| Provenance | Each captured field is `confirmed`, `inferred`, `incomplete` or `conflicting`, with a source. The prospect can confirm, edit, or choose between conflicting candidates. An AI value never overwrites a prospect edit. |
| Documents | PDF, Excel, CSV and Word uploads (20 MB, enforced in the browser only) in a private bucket, with seven categories. `document-extract` reads CSV, XLSX/XLS and text PDF into candidate values that the prospect reviews and applies, using the same AI provider setting as chat. Word files are saved but not read. |
| PEO match | A sourced PEO catalog. It does not rank PEOs. Every fact is null until sourced, and unknowns show as unknown. The choice is stored in the submission. |
| Certification | Signer name and role, three acknowledgements and a separate sign step, with DRAFT consent text. A database trigger records `chamber_certifications` (server-stamped time, `data_sha256`, consent text and version) and refuses a missing, stale or guest certification. Any later change to the answers, or choosing a different PEO, withdraws it. |
| Manuscript | Rendered from the signed snapshot at `/manuscript?session=<id>` for the signed-in owner. A vector-text PDF (jsPDF) with repeating table headers and page numbers. Date of birth is masked by default. `/manuscript/demo` is a labelled sample. |
| Advisors | Roles `advisor` and `admin` in `user_roles` (granted by SQL). A submission queue with status filter and search. A detail page with field-by-field review, transcript evidence, documents through 60-second signed links, append-only internal notes, a nine-state pipeline with history, and versioned Manuscript PDFs in a private bucket. Prospects see only `submitted`, `under_review` and `information_requested`. |
| Notifications | Certification queues an advisor alert and a prospect confirmation in the same transaction. `dispatch-outbox` sends them through Resend with retries (5 attempts), a frozen-message idempotency design, and a reaper and reconciliation sweep. A dead event is pushed to an optional alert webhook, and advisors see and retry the queue at `/advisor/outbox`. Needs function secrets and a once-a-minute schedule (a guarded migration creates it; `docs/NOTIFICATIONS.md`). |
| Quality gates | CI runs `verify` (lint, edge-function type check, test, build), `sql-tests` and `e2e` on every pull request. 685 front-end and function unit tests. SQL tests cover certification, guest blocking, documents, provenance, AI limits, the advisor access matrix and the outbox. **One end-to-end test** (I-4.3) takes a guest's text intake to the downloaded Manuscript PDF against a Supabase stand-in with the real migrations. It does not cover document upload (no Storage), voice, the advisor path, real Supabase Auth, REST or edge functions, or a live AI model. |
| Hosting | `vercel.json` sets a Vite build and a single-page-app rewrite. One Supabase `project_id` is in `supabase/config.toml`. |

### 1.2 Architecture as built, against v1.0

| v1.0 assumed | The code does | Consequence |
|---|---|---|
| Guests return by a token in the URL fragment (D1). | Supabase anonymous auth in browser storage, the session id in `?session=`, owner RLS gates resume. | A row id grants nothing without the owner's JWT, so isolation holds. A guest upgraded by email gets back with an emailed code (A-1.3). A bare `/start` opens the latest open draft, and nothing is created until the prospect starts (2026-11-04). |
| `intake_sessions`, `intake_messages`, `intake_documents`, `intake_submissions`, reachable only through edge functions. | `chamber_sessions` (jsonb data, provenance, transcript, submission), the extended `documents` table, `chamber_certifications`. The browser writes them directly under RLS. | The database validates `chamber_data` and versions every save (A-2.2), so a tab that is behind is refused instead of overwriting the other. Nothing validates the transcript or provenance. |
| `certify` and `submit` endpoints, idempotency keys, reference `EAA-YYYY-NNNN`. | A trigger on the status update records the certification and the snapshot. The reference is `EAA-<year>-<8 hex of the session id>`, built in the browser. | The reference is not unique or server-assigned, and a repeat submit adds another certification row (C-3.1). |
| Manuscript at `/manuscript/:reference#t=`, review at `/review`. | `/manuscript?session=<id>` with a JWT and owner RLS. Review is a tab inside the Chamber. | Viewing needs sign-in. Safe error states exist, but not expired or revoked ones. |
| Advisor access through endpoints with `has_role`. | `user_roles`, `has_role`, `require_advisor()` and RLS on every advisor table and function. | Matches the intent. Tests assert SQL refusals (42501), not HTTP 403s. |
| AI provider behind an adapter. | Built, tested, and now used by both AI functions (`chamber-extract` after the fix in section 1.3, and `document-extract`). The shared code is in `supabase/functions/_shared/ai`. | `AI_PROVIDER`, the timeout, the retry and redacted logs apply to both. Chat gets 20 seconds per attempt and document reads 30. |
| Text PDF with `html2canvas` removed (D12). | jsPDF vector text. `html2canvas` is never imported. | Matches. |
| No `.github/`. | `ci.yml` with `verify`, `sql-tests` and `e2e`. | Matches the intent of I-4.4. Required-for-merge is a repository setting this refresh could not see. |

### 1.3 Defects found while verifying

#### Fixed: Lenore's extraction function could not load

`supabase/functions/chamber-extract/index.ts` was broken at `6f2bf5c`:

- It imported `SYSTEM_PROMPT` from `./schema.ts` (line 6) and declared `const SYSTEM_PROMPT` again (line 35). A duplicate declaration is a module-level `SyntaxError`; `tsc` reported TS2440.
- It still posted directly to the Lovable gateway with `LOVABLE_API_KEY`, which was no longer declared anywhere in the file (TS2304, a `ReferenceError` at run time).
- `callModel`, `failureResponse` and `failureLogLine` were imported but never called, so the 20-second timeout, the retry, the provider choice and the redacted logging never ran, and the raw provider response body was logged.
- The adapter's tool schema lacked `field_status`, `evidence` and `corrected_fields`, which the handler's copy defined.
- **Cause:** merge `cf6c87f` (2026-10-20) combined the provider-adapter work (`10eaee5`) with the earlier inline implementation. It had been on `main` since pull request 13.
- **Why CI was green:** `index.ts` had no test, Vitest does not type-check, and `npm run build` does not touch the functions.

**What changed (F-0.2, F-0.4):** the request handling moved to `handler.ts` and calls the model through `callModel` and the selected adapter. `schema.ts` is the single copy of the prompt and tool schema, and `extraction.ts` shapes the response. `handler.test.ts` and `extraction.test.ts` cover the handler and the contract. `npm run typecheck:functions` runs in the CI `verify` job, and against the previous `index.ts` it fails with the same two errors. The fix was exercised under Deno 2.9.6 with fakes, not against a live provider.

**Follow-up in 2.2:** `document-extract` had the same hard-coded gateway, key and model, so `AI_PROVIDER`, `AI_MODEL` and the provider key applied to chat only. It now calls the model through the same adapters (`ask.ts`). Behavior changes: a document read has a 30-second timeout and one retry on a transient error where before it had no limit, an Anthropic reply is capped at 4,096 tokens, a provider rate limit still leaves the document ready to read later, and a provider's response body is no longer logged.

**Follow-up in 2.3:** `document-extract` spent only the caller's own quota, so each new guest session (free to create) got a fresh allowance and AI document reads were not bounded in aggregate. The three counts now live in `_shared/ai/budget.ts` and both functions spend from them, so chat and document reads share the per-address and global ceilings (20 a minute and 400 a day per address, 2,000 a day overall, unless the `AI_IP_*` and `AI_GLOBAL_DAILY_CALLS` secrets override them). A refused read never reaches the provider and the document goes back to 'ready to read'; the daily ceiling, an unreachable budget and missing configuration now do the same (a 503), where a missing provider key used to mark the document failed. Chat's behavior and limits are unchanged. Function secrets are project-wide, so the secrets chat already needs (`IP_HASH_SECRET`, and the service-role key Supabase provides) are the ones document reads need; no new secret is required.

**Still to do:** check which `chamber-extract` and `document-extract` builds are deployed (`chamber-extract` may predate the merge), deploy both, confirm the deploy bundles `supabase/functions/_shared`, and make one real Lenore exchange and one real document read in a preview environment. Until then the failure and the fix are established from the code, the tests and a Deno run, not from a live call.

#### Other defects

| Defect | Where | Story |
|---|---|---|
| The consent wording is defined twice (`2026-10-draft-1` and an unused `2026-10-v1` with no draft flag). The Manuscript page and PDF print the signed consent with no DRAFT marker. | `certification.ts`, `manuscript.ts` | C-2.4 |
| The reference is not unique or server-assigned, and a repeat submit adds another certification row. | `manuscript.ts`, `useChamberSession.ts` | C-3.1 |
| The owner's update policy lets a prospect write `documents.status`, so it cannot carry a scan verdict. | `20261021100000_session_documents.sql` | E-4.3 |
| Only the browser checks a file's contents before upload. The `documents` bucket refuses files over 20 MB and undeclared types (migration `20261029090000`), but it checks the type the client declares, not the bytes. | `uploadCheck.ts`, `20261029090000_document_ingestion.sql` | E-4.1 |
| ~~Two rapid loads or two tabs can still create two sessions.~~ Fixed 2026-11-04: nothing is created until the prospect's first change, and the database refuses a second open draft per person (`EA009`). | `useChamberSession.ts`, `20261104102000_one_open_draft.sql` | A-1.3 |
| A certified document's file, kept when the prospect removed it, stays in storage once the certification moves on, with nothing in the app pointing to it. Its `removed` row in `document_events` records the path. Purge it with retention. | `20261104112000_certified_evidence.sql` | H-1.2 |
| The queue derives a draft's reference with the UTC year; the browser shows the local year, so around New Year a draft's displayed reference may not find it. A draft's `submission.file_id` is prospect-written and searchable. | `20261104114000_paged_advisor_queue.sql` | F-2.2 |
| The opening message tells the prospect the workspace is 'a demonstration'. | `useChamberSession.ts` | A-2.3 |
| Public copy contradicted the role disclosure ('No account required', 'Get Your Quote', `SUBMITTED TO <PEO>`). **Fixed** and guarded by `copy.guard.test.ts`, which now also bans affiliation claims; the landing page's 'not health data' and 'nothing else' claims are gone (US-6.2). The Manuscript's HIPAA statement and preview-domain 'Prepared by' line are left for counsel. | `LandingPage.tsx`, `index.html`, `ManuscriptPage.tsx`, `manuscriptPdf.ts` | H-2.3 |
| `html2canvas` is a direct dependency that no source file imports. | `package.json` | D-3.1 |

### 1.4 What landed since v1.0

| Date | Work (commit subjects) |
|---|---|
| 2026-10-20 | Sourced PEO catalog replaces invented scoring. Guest intake with an email-verified account at certification. Per-IP and global AI limits with Turnstile. Real data and session recovery from the Reckoning to the Manuscript. Reliable AI calls (timeout, retry, adapter, safe logs, failure UX). Final certification with signer role, versioned consent and a server-side record. Text-based Manuscript PDF with a recorded, re-certifiable submission. Confidence and source for extracted fields. Session-linked uploads, categories and reviewed extraction. Advisor dashboard, pipeline status, field review and versioned Manuscripts. |
| 2026-10-21 | Vercel configuration. Epic E document handling finished. Advisor session states, the access matrix and the searchable queue. CI for lint, tests, build and SQL tests. Advisor and prospect notifications on submission. Re-certification when a different PEO is chosen. A verify skill that drives the app against a local stand-in. |
| 2026-10-22 | Supabase URL and key read from Vercel's integration variables. Outbox hardening: queueing faults heal and sends are frozen so a sender change cannot duplicate. |
| 2026-10-29 | Epic E census ingestion (branch `claude/adoring-dijkstra-2fcocb`, not yet merged): the roster is `chamber_data.census` with the spec's `CensusEmployee` row, and older `employees` data is read as it; `document-extract` matches census columns by header, reads `.docx`, never reads or keeps SSN or bank details; upload checks by contents with a SHA-256 and duplicate refusal; category names and per-intake limits in the database; a review step that shows census rows and settles differences in a dialog. Deploy order: the migrations (including `20261029092000`, which teaches the A-2.2 intake validator the `census` key and still accepts `employees`), then `document-extract` (it imports `_shared`), then the front end. See `docs/intake-schema.md`. |
| 2026-11-04 | `main` repaired after #35. Its merge of main had lost code in 20 files, so the app didn't build and 53 tests failed: Review declared `required` twice and read fields it never defined, the Chamber page sent an undefined `setChamberData`, `chatContext` and the chat field types were gone, and chamber-extract built the US-2.1b user turn but sent B-1.1's. Both sides are kept: the user turn (answers, statuses, unsettled fields, recent conversation) is built in `chamber-extract/prompt.ts` for the function and the extraction eval, the browser's request in `chatRequestBody`; the field guide carries B-1.1's definitions and caps, so the contract is `PROMPT_VERSION` 3. Review and the Reckoning take what blocks certification from `certificationBlockingItems`, which follows the database's gate (an advisor's verification no longer lifts a conflict there, as the database refuses it) plus B-2.2's census case, which a verified census still settles. The extraction eval replays the browser's request from Lenore's opening line. Migrations: PRs #46 and #47 each removed a different copy of `outbox_operations` and `document_storage_path`, leaving neither; the `…090001` and `…110001` copies are back, and `required_items` moves to `20261104103000` (it shared `20261104100000` with `certification_conflicts`). An existing project: see `docs/SUPABASE_SETUP.md`, Migration versions. |
| 2026-11-04 | Fixes from the review of the medium fixes (`20261104115000`): intakes certified before certification rows existed are workable and their re-certification isn't their first; Manuscript versions recorded before `certified_at` are still offered when they match; a document re-created under the same id with another file is shown as the certified one removed and a new one added; the prospect's status follows the order history was written; an intake created certified is recorded as certified; the queue's search box keeps a space typed before a pause, and Back undoes a page change; the status hint for a withdrawn intake and the 1099 tier match what the prospect and the Manuscript show. Kept evidence files are not yet purged (H-1.2). |
| 2026-11-04 | The medium findings of the US-4.x review: the pipeline follows the prospect (certifications and withdrawals in the history whatever the status, an answered information request returns to Submitted, the prospect isn't left being asked to act, never-certified intakes can only be archived; `20261104111000`); certification keeps the transcript and document list, document changes are audited and certified files kept (`20261104112000`); the advisor-reviewed version built from the current certification is the prospect's final Manuscript, offered on their Manuscript page, their own copy labelled 'as certified, before advisor review', and older versions marked as built from an earlier certification (`20261104113000`, decision: the reviewed version is final); the queue pages, searches and describes completeness from the certified copy in the database (`20261104114000`); dependents, the printed tier and the certified PEO on the detail page. Deploy the four migrations before the front end, which calls the queue with search and paging; a front end from before them keeps working (it gets the whole list). |
| 2026-11-03 | Advisor reviews and Manuscript versions belong to the answers they were made from (migration `20261104110000`; deploy it before the front end, and reload open advisor tabs: until then Generate fails, because the old call no longer exists). A prospect's change to a reviewed answer resets that review, visibly and in the audit trail, so an old "Verified" or correction can't reach the packet as advisor-confirmed; a review or version based on a page loaded before the change is refused and the page reloads. Those refusals are now `PT409` (HTTP 409): `record_manuscript_version` raised `40001`, which PostgREST retries, so a refused Generate hung instead of explaining (found running the function over real PostgREST). |
| 2026-11-04 | Each migration in the folder once: two branches renumbered the same two files differently and both copies merged, so `db push` and the e2e stack ran `outbox_operations` twice and stopped. The copies (`20261027090100`, `20261103110100`) are deleted, and `src/data/migrations.test.ts` fails on a repeated name or SQL body. An existing project: see `docs/SUPABASE_SETUP.md`, Migration versions. |
| 2026-11-03 | Migration versions made unique: `outbox_operations` is now `20261027090001` and `document_storage_path` `20261103110001`, each the second of a pair that shared a number, which `supabase db push` can't apply. CI fails on a duplicate (`src/data/migrations.test.ts`). An existing project: see `docs/SUPABASE_SETUP.md`, Migration versions. |
| 2026-11-03 | US-1.4, real data in the Manuscript: a payroll section, and no invented values (census defaults are recorded in a row's `assumed` list and shown as not provided; no made-up coverage tiers or dependent counts). No migration. See D-1.2 and `docs/intake-schema.md`. |
| 2026-11-03 | US-1.3, the hand-off to The Reckoning: the chosen PEO is saved with the intake (`chamber_sessions.chosen_peo`, migration `20261103100000`, deploy it before the front end), and the Manuscript page says when an intake has expired instead of calling it unsigned. See A-1.3. |
| 2026-11-03 | Document fixes from the US-3 review: a new document row must point into its own intake's folder (migration `20261103110001`, which only changes a policy and can deploy before or after the front end), and removing a document deletes the stored file before its row and treats storage's empty answer as "not deleted" unless the file is gone. See E-1.2 and E-1.3. |
| 2026-11-03 | Epic G closed (US-5.1 to US-5.3). D6 decided: the Advisor Console is the operating workflow, mapped in `docs/ADVISOR_CONSOLE.md`; G-3.2 and G-3.3 superseded. The File ID keeps the year its intake started (UTC) instead of the signer's current year. Both emails and the queue search call it the File ID. The confirmation's consent stance is written down in `docs/NOTIFICATIONS.md`. Terms are in a new `GLOSSARY.md`. |
| 2026-11-04 | US-6.1 to US-6.4 (Epic H). Classification and retention (`docs/DATA_HANDLING.md`, `src/data/dataPolicy.ts`) with a daily retention job and a deletion process that removes stored files, then rows (`purge-intakes`); the Privacy Policy, Terms of Use, legal links on every page and an intake consent gate the database enforces; an isolation test over every migration with a findings register (`docs/SECURITY_REVIEW.md`) and a fix migration; failure monitoring with threshold alerts (`ops-monitor`) and `docs/RUNBOOK.md`. Deploy order: migrations `20261104090000` to `20261104093000`, then the `purge-intakes` and `ops-monitor` functions and the updated `chamber-extract` and `document-extract` (they import `_shared`), then the front end, close behind the consent migration. See H-1 to H-4. |
| 2026-11-04 | A required answer in conflict blocks certification (B-2, D26): Review and the Reckoning list it, and the database refuses the certification with `EA008` (migration `20261104100000_certification_conflicts.sql`, which can deploy before or after the front end). See C-1.3 and `docs/intake-schema.md`, Required answers. |
| 2026-11-04 | The transcript as evidence (A-3): ISO timestamps, a `system` sender (voice call notes), a `spoken` flag that caps a spoken answer at `inferred` (D33), and a database check of each message (migration `20261104101000_transcript_validation.sql`, either deploy order). See A-3.1 and `docs/intake-schema.md`, The transcript. |
| 2026-11-04 | Review copy and failure states: 'Lenore captured this — please confirm', 'Confirmed by you' for the prospect's own confirmations, a headcount of 0 shown as 0 on PEO Match, and 'Continue manually' opening Review (B-2.1, B-3.2). No migration. |
| 2026-11-04 | An intake is created on the prospect's first change, not when the Chamber opens, and a person has one open draft at a time (A-1): migration `20261104102000_one_open_draft.sql` (`EA009`, either deploy order), `ensureIntake` for chat and uploads, and the address cleared after Start over. See A-1.3 and `docs/intake-schema.md`, When an intake is created. |
| 2026-11-04 | US-2.1b, the extraction contract: chat extracts every field but the census, with `unknown` for what the prospect doesn't know, and each call carries the field statuses and the last 10 messages; prompt version 2. No migration; deploy `chamber-extract` with the front end (an old bundle's requests still work). See US-2.1b and `docs/intake-schema.md`, Extraction contract. |
| 2026-11-04 | US-2.3a: Lenore asks about the next unsettled field, one at a time, wraps up when none is left, and says once when the intake is ready to certify ("Ready for your review" in the header); one shared readiness rule; ten golden transcripts; prompt version 4. No migration. See US-2.3a and `GLOSSARY.md`, Ready to certify. |
| 2026-11-04 | US-2.2a: Review lists every field with its badge and how much of each section is settled, "Doesn't apply" with Undo, one open-items list (Review, The Manuscript, the advisor queue, migration `20261104118000_open_items.sql`, either deploy order), the census's status on the Census tab, and advisors can review workers' comp answers. See US-2.2a. |
| 2026-10-28 | The intake-to-PDF end-to-end test, its `e2e/stack` stand-ins and the `e2e` CI job (I-4.3, I-4.4). Also on `main`, not re-checked against their stories in 2.4: a save-status indicator and resume of the latest intake, public copy that no longer promises what the product doesn't do, no new intake started over one that could not be loaded, and a script that sets up and checks a Supabase project. |

Both busy days also include commits titled 'repair main after ... merges' (for example `7260101`, `7e3cd6d`, `b543876`, `d5ad19f`, `1f65822`), which fix breakage from overlapping branches. The `chamber-extract` break came from another merge of that kind, and no later commit repaired it.

### 1.5 Status summary

| Epic | Done | Partial | Superseded | Not started | Not verifiable | Total |
|---|---|---|---|---|---|---|
| 0 Foundations | 1 | 3 | 0 | 0 | 0 | 4 |
| A Durable session | 7 | 0 | 4 | 0 | 0 | 11 |
| B AI extraction | 7 | 1 | 1 | 0 | 0 | 9 |
| C Review, certify, submit | 2 | 7 | 0 | 1 | 0 | 10 |
| D Manuscript | 0 | 7 | 2 | 0 | 1 | 10 |
| E Documents | 6 | 1 | 3 | 1 | 0 | 11 |
| F Advisor | 4 | 6 | 1 | 0 | 0 | 11 |
| G Communications | 6 | 0 | 2 | 0 | 0 | 8 |
| H Security, privacy, legal | 6 | 5 | 0 | 0 | 1 | 12 |
| I Quality and accessibility | 2 | 8 | 0 | 3 | 1 | 14 |
| J Release operations | 0 | 1 | 0 | 3 | 2 | 6 |
| **Total** | **41** | **39** | **13** | **8** | **5** | **106** |

29 of 54 milestone-M1 stories are DONE or SUPERSEDED (intent met, except B-1.3: its work moved to US-2.3a, which is not started); 20 of 39 M2; 5 of 13 M3. The plan now holds 106 stories: v1.0's 104 plus two found during this refresh (F-0.4, C-2.4).

---

## 2. Delivery Principles

1. **Text is the dependable path.** Voice enhances intake and must never block it. *Holds: voice is opt-in and the text input is always present.*
2. **The prospect controls their data.** AI proposes values. The prospect confirms material facts. *Holds, and is enforced in the browser by design (B-1.2): every AI value reaches the intake through the prospect's own browser, which can already save any value as the prospect's own edit, so a database check that an AI value never overwrites a prospect's edit would stop nothing. The database validates answers and refuses stale saves (A-2.2).*
3. **No fabricated data.** Unknown underwriting data stays unknown, shown as "Not provided" or listed as an open item. *Holds for the Manuscript and the PEO catalog. Demo data remains in `chamberTypes.ts` (D-1.5).*
4. **Sensitive data stays private.** Census, payroll, benefits, and workers' compensation data are never publicly reachable. *Holds: private buckets, owner and advisor RLS, a test that every public table has row security.*
5. **One source of truth.** The saved intake session feeds the Chamber, the review, the Manuscript, and the advisor view. Submitted packets are frozen as snapshots. *Holds, with the snapshot gaps in C-3.2.*
6. **Every story is independently releasable** and no larger than M.
7. **Access is enforced in the backend.** A hidden button is not access control. *Holds for advisors and prospects through RLS. Checking a file's contents is the exception: storage enforces the size and declared type, and only the browser reads the bytes (E-4.1).*

---

## 3. Decisions

Status is the state of each decision in the code today. Engineering proceeds on the recommended default where the owner has not responded.

| ID | Decision | Status and evidence | Owner | Blocks |
|---|---|---|---|---|
| D1 | How does a guest return to their intake? | **Decided in code, with a different design** (see D14). Supabase anonymous auth persisted in browser storage; the session id in `?session=`; owner RLS gates resume. Email upgrade is a 6-digit code (`updateUser`, then `verifyOtp`), refused if the email already has an account ('we can't yet move your answers'). A guest who verified an email can get back to the intake from another browser, or after this one's data was cleared, by signing in with a 6-digit code emailed to that address (A-1.3); the Chamber then opens the linked intake or their latest one. **Gap:** a guest who never verified an email has no way back from another browser, and nothing sets a password. | PM | none |
| D2 | Minimum data required before certification | **Decided (2026-11-03, US-1.2 and B-2.2).** Company legal name, states of operation (a state code in `states`, or a work state on the census) and pay frequency are required: the Reckoning won't generate The Manuscript without them, and the database refuses a certification from the browser (`EA003`, `public.intake_missing_required`). The census is recommended, not required, because today it can only come from an uploaded file and no document is required: it is listed (as recommended in Review, as an open item in the Manuscript), never blocks, never holds an intake back from being complete, and is not in the advisor queue's `missing_required`. A present answer is settled when its field is confirmed (by the model, a document the prospect applied, or the prospect), an advisor verified it, or it has no provenance; otherwise it is conflicting, incomplete or unconfirmed, and a conflicting required answer also blocks certification (B-2 D26: the database refuses it too, `EA008`, whoever verified it; States of operation that only a census in conflict gives is checked in the browser only, B-2.2). One list in `src/data/readiness.ts` (compared with the database by `schemaSync.test.ts`) and one presence rule in the database (`public.intake_answers_present`, read by both the gate and `public.intake_required_items`); `src/data/requiredItems.ts` builds the item states on readiness. There is no 'Not applicable' status and no 'Document needed' item. Still differs from the v1.0 default: no EIN field, no total-employee-count requirement. | PM + Advisory lead | B-1.3 |
| D3 | Certification and consent wording | **Open.** The placeholder `2026-10-draft-1` is marked DRAFT in the Reckoning. A second, unused wording (`2026-10-v1`) exists (C-2.4). The intake consent (`src/data/intakeConsent.ts`, `2026-11-draft-1`) is marked DRAFT on the gate (H-2.2). Both wait for LEGAL (`docs/LEGAL_REVIEW.md`). | LEGAL | C-2.4, H-2.2 |
| D4 | Retention windows | **Recommended defaults enforced in code, LEGAL to confirm** (US-6.1, `docs/DATA_HANDLING.md`): a draft expires 30 days after its last change and a closed draft is deleted 30 days after it closed; a submitted record is reviewed for deletion 3 years after its latest certification; operational events 90 days, email delivery events 365 days, AI rate-limit records 1 day; the browser's copy of unsaved answers at most 7 days. One list in `src/data/dataPolicy.ts`, kept equal to the database by `schemaSync.test.ts`. | LEGAL + PM | H-1.x, E-4.2 |
| D5 | Advisor roles and permissions | **Decided and implemented**: `advisor` and `admin` in `user_roles`. In the repo `admin` has no power beyond `advisor` (tests assert it cannot grant roles or delete intakes). | PM | none |
| D6 | CRM or workflow destination | **Decided:** the Advisor Console (`/advisor`) is the operating workflow, and there is no CRM. Every Submission appears there when certified, so nothing is re-keyed or synced. Field mapping and ownership: `docs/ADVISOR_CONSOLE.md`. | PM | none |
| D7 | Email provider and sender domain | **Decided in code:** Resend, the only adapter. `EMAIL_FROM` has no default and must be on a verified domain. The domain is not named and the verification checklist item is unchecked. | OPS | G-2.1 launch, J-1.2 |
| D8 | Is voice launch-critical? | **Recommended default stands:** an opt-in beta behind a flag, with text always available. | PM | I-5.x scope |
| D9 | Carrier or PEO routing | **Unchanged:** out of scope for M1 to M3. The product tells prospects they send the packet themselves. | PM | none |
| D10 | Legal reviewer for policy, terms and disclosures | **Not recorded in the repo.** `docs/LEGAL_REVIEW.md` is the record to fill in: what to review, the questions for counsel, and how approval is made live. | LEGAL | H-2.1, H-2.3 |
| D11 | AI provider for Lenore and document extraction | **Partly decided:** the adapter supports Lovable (default) and Anthropic, and neither is chosen. Both AI functions use the one adapter, so a single `AI_PROVIDER` secret switches them. Voice uses ElevenLabs. No data-processing terms are recorded. | PM + BE | F-0.2, E-3.1 |
| D12 | PDF rendering approach | **Decided and implemented:** browser jsPDF with vector text, lazy-loaded. Server-side rendering has not been revisited. | BE + FE | none |
| D13 | Malware-scanning provider for uploads | **Open.** | OPS | E-4.3 |
| D14 | **New.** Intake access model: keep Supabase Auth with owner RLS, or move to continuation tokens (v1.0 D1)? | **Recommended: keep as built.** It isolates sessions today and is covered by SQL tests. Drop the token stories (A-1.6), amend the envelope AC in A-2.1, and close the gaps it leaves: a return path for upgraded guests, and database validation with a version check (A-2.2). | PM + BE | A-1.3, A-2.1, H-3.3 |
| D15 | **New.** Reference format and assignment | **Recommended:** server-assigned `EAA-YYYY-NNNN` from a per-year sequence, recorded with the certification and unique. Today it is `EAA-<year>-<8 hex of the session id>` built in the browser. The year is the one the intake started in (UTC), as the database's fallback has it, so an intake keeps one File ID for good; it used to be the signer's current local year, which gave an intake certified across New Year two File IDs. A File ID already recorded on a certification, even a withdrawn one, is kept as it is, so no File ID already issued changes. The database still does not check the File ID a certification carries. | PM + BE | C-3.1, D-3.2 |
| D16 | **New.** Advisor visibility: does every advisor see every intake? | **As built: yes**, with no assignment. **Recommended:** keep for a pilot with a small named advisory team and revisit before M3. | PM | F-2.1 |
| D17 | **New (US-2.1).** What does "required for submission" do? | **Decided 2026-11-03:** a per-field required flag in the intake schema, report-only. Lenore asks about required fields first, and the open items and the completion state use it. Certification does not check it; the gate stays in C-1.3. Until then a prospect can still sign with a required field missing. | PM | US-2.1, US-2.3, C-1.3 |
| D18 | **New (US-2.1).** Workers' comp and locations in the schema | **Decided 2026-11-03:** add four flat fields for workers' comp: current carrier, policy renewal date, experience mod, and annual premium. Each needs a migration first. No locations structure: locations stay derived from `hq_state`, `states` and the census rows' `work_state` and `zip_code`. | PM | US-2.1, D-1.3 |
| D19 | **New (US-2.1, US-2.3).** How voice answers are extracted | **Decided 2026-11-03:** each finished prospect utterance in a voice call goes through `chamber-extract`, the same contract as typed chat, and `<extract>` tags are ignored. There is one extraction contract, versioned in the repo. Each utterance makes one AI call, counted against the same quotas. Recorded in `docs/adr/0001-voice-answers-use-the-text-extraction-contract.md`. Consequence: `chamber-extract` must cover every flat field voice used to write. The roster and dependents lose their only conversational writer (see round 2). | PM + BE | US-2.1, US-2.3, US-2.4 |
| D20 | **New (US-2.4).** Where extraction outcomes are recorded | **Decided 2026-11-03:** an extraction events table with one row per AI call. Each row holds the session id, request id, function, outcome, error kind, refused field paths, prompt and contract version, model and latency. It stores no prospect content and old rows are pruned. Both AI functions receive the session id, and the request id is returned to the browser. This also records the prompt version for B-1.4. | BE | US-2.4, B-1.4 |
| D21 | **New (US-2.1).** How the roster and dependents are provided after D19 | **Decided 2026-11-03:** the roster comes only from an uploaded file. A downloadable CSV census template gives one row per employee, with a coverage-tier column, and Lenore points prospects to it. Named dependents are not captured: tiers come from the file's coverage tier, and the `dependents` array stays in the schema with no writer. The Census tab stays read-only. Known gap: a prospect on a phone with no spreadsheet can't supply a roster, so it stays an open item. | PM | US-2.1, US-2.3, D-1.2 |
| D22 | **New (US-2.3).** What each `chamber-extract` call includes | **Decided 2026-11-03:** the new message, the captured values, each field's status, the missing list, and the last ~10 transcript messages. SSNs and bank numbers are redacted with `redactSensitive`, and everything stays inside the 20,000-character context cap. The census is still left out. | PM + BE | US-2.3 |
| D23 | **New (US-2.1, US-2.2).** Recording "doesn't know" and "doesn't apply" | **Decided 2026-11-03:** two new provenance statuses. `unknown`: the prospect doesn't know yet, so Lenore stops asking and the field stays an open item ("Prospect to provide"). `not_applicable`: the field is closed and its open item clears. Neither stores a value. | PM | US-2.1, US-2.2, US-2.3 |
| D24 | **New (US-2.3).** How voice Lenore knows what to ask | **Decided 2026-11-03:** after each extraction the browser sends the ElevenLabs agent a contextual update (`sendContextualUpdate`) naming, by label only, the next missing fields and the ones already settled. The agent's prompt moves into the repo with a version number. | PM + BE | US-2.3 |
| D25 | **New (US-2.1, US-2.3).** Field tiers | **Decided 2026-11-03, amended 2026-11-04:** required is the three answers D2 requires: company legal name, states of operation and pay frequency. The census is recommended, as D2 and `src/data/readiness.ts` have it, and ranks first in the recommended tier (the 2026-11-03 text made it a fourth required field; the schema's `x-intake` now agrees with readiness, and `intakeSchema.test.ts` holds the two together). Every other field gets a rank in the "recommended" tier, which Lenore asks about after the required fields. The draft ranking, for PM to edit: the census, employee count, industry, HQ state, current medical carrier, medical renewal date, payroll vendor, WC carrier, WC renewal date, WC experience mod, WC annual premium, then the rest in schema order. | PM | US-2.1, US-2.3 |
| D26 | **New (US-2.3).** When an intake is ready to certify | **Decided 2026-11-03:** an intake is *ready to certify* (not "ready for review", which collides with the advisor's "Under review"; see `GLOSSARY.md`) when every required field holds a value that is not `conflicting` or `incomplete`, or is marked `unknown` or `not_applicable`. Inferred values count. Inferred and unknown fields remain open items. | PM | US-2.3, C-1.3 |
| D27 | **New (US-2.3).** Where readiness lives | **Decided 2026-11-03:** derived, not stored. One shared function, used by the Chamber and by `chamber-extract`, computes it from `chamber_data` and `field_provenance`. The Chamber shows that the intake is ready to certify (prospect-facing copy may say "Ready for your review"), and Lenore says so by pointing to Review. Advisors can't filter drafts by readiness. This replaces B-1.3's server-set `ready_for_review`. | PM + BE | US-2.3, B-1.3 |
| D28 | **New (US-2.2).** Where prospects see every field | **Decided 2026-11-03:** the Review tab lists every captured field, grouped by section, each with its status badge and Confirm/Edit, not only the open ones. Workspace tabs are unchanged. | PM + FE | US-2.2, B-2.1 |
| D29 | **New (US-2.3).** What Lenore does once the intake is ready | **Decided 2026-11-03:** she says once that it is ready and the prospect can review now. She then carries on with the recommended tier until it is settled, then wraps up for good. Review is always open. Nothing extra is stored. | PM | US-2.3 |
| D30 | **New (US-2.1).** Manuscript coverage | **Decided 2026-11-03:** every schema field is mapped. A workers' comp section holds the D18 block and the census class codes. An "Operations & HR" section holds the 13 fields not mapped today. Census rows keep `class_code` and `zip_code`. A test fails when a schema field is neither mapped nor listed as deliberately excluded with a reason. | PM + FE | US-2.1, D-1.2, D-1.3 |
| D31 | **New (US-2.2).** Who sets `unknown` and `not_applicable` | **Decided 2026-11-03:** the model may set `unknown`, with an evidence quote, when the prospect says they don't know. Only the prospect sets `not_applicable`, with a "Doesn't apply" control in Review. When the prospect says a field doesn't apply, Lenore points them to that control. | PM | US-2.2, US-2.3 |
| D32 | **New.** How US-2.1 to US-2.4 are split | **Decided 2026-11-03:** US-2.1 to US-2.4 stay as parent stories, and the work ships as nine S or M child stories, each releasable alone with its migration first. In deploy order: 2.1a schema metadata, the WC block and the new statuses (M); 2.4a extraction events, session and request ids, error codes and the client timeout (M); 2.1b the extraction contract and Lenore's context (M); 2.3a the follow-up policy, readiness, wrap-up and golden transcripts (M); 2.2a Review lists every field, with "Doesn't apply" and one open-items list (M); 2.3b voice through `chamber-extract` with live context (M); 2.3c voice failure states and the mobile transcript (S); 2.1c Manuscript coverage (M); 2.3d the census template (S). | PM | US-2.1 to US-2.4 |
| D33 | **New (US-2.2).** What field status a spoken answer can have | **Decided 2026-11-03:** an extraction from a voice utterance can be `inferred`, `incomplete` or `unknown`, never `confirmed`. Speech-to-text mishears: "fifteen" stored as a confirmed 50 would change PEO eligibility and never show as an open item. A spoken answer shows as "Please confirm" until the prospect confirms it in Review or types it. Transcript messages record whether they were spoken. Vocabulary for this and D26 is in `GLOSSARY.md`. | PM | US-2.2, US-2.3 |

---

## 4. Epics and Stories

### Epic 0: Foundations

*As built:* The provider adapter is wired into `chamber-extract` and the edge functions are type-checked in CI (section 1.3). Secrets hygiene and route guards are mostly in place.

#### F-0.1 Stop tracking `.env` and confirm secret hygiene
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** OPS · **Depends:** none · **Milestone:** M1
- **Built:** `.env` is untracked and ignored (`.gitignore` excludes `.env` and `.env.*` but keeps `.env.example`); `.env.example` is committed; the README explains setup.
- **Remaining:** Confirm no service-role key or other secret exists anywhere in the branch history (owner action; this refresh could not read the history of `.env`). Run a fresh-clone `npm run build` from `.env.example`.

#### F-0.2 Put the AI provider behind an adapter
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** D11 · **Milestone:** M1
- **Built:** `providers.ts` has a Lovable adapter and an Anthropic adapter, and `selectAdapter` reads `AI_PROVIDER`, `AI_MODEL` and the provider's key (default Lovable with `google/gemini-3-flash-preview`; Anthropic default `claude-haiku-5-5`). The adapters, `model.ts` and `providers.ts` now live in `supabase/functions/_shared/ai` and take the tool to force as a parameter. `chamber-extract` goes through them (`handler.ts` calls `callModel` with the selected adapter, and `schema.ts` is the one copy of its prompt and tool schema), and so does `document-extract` (`ask.ts`, with its own prompt and `report_document_fields` tool), so one `AI_PROVIDER` secret switches both. Tested with fakes for both providers and both functions, and run under Deno 2.9.6 with the network denied.
- **Remaining:** Errors are still `{error}` with no `code` field (the AC asks for a code and a message). The one manual Lenore exchange in a preview environment has not been done, and neither fixed function has been deployed or called live. The functions now import from `supabase/functions/_shared`, so confirm the deploy mechanism bundles it.

#### F-0.3 Document the route access map
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** PM + FS · **Depends:** none · **Milestone:** M1
- **Built:** Guards exist: `RequireAuth` on `/start` and `/profile`, `RequireAdvisor` on `/advisor*`. `/manuscript` has no route guard, but the page needs a signed-in user and a `?session=` id and RLS decides what is returned. `/manuscript/demo` is a labelled sample. `docs/ADVISOR_ACCESS.md` documents the two advisor routes.
- **Remaining:** Write `docs/ROUTE_ACCESS.md` covering every route in `src/App.tsx` (including `/login`, `/profile`, `/manuscript`, `/manuscript/demo`) and add the test that fails when a route is missing from it. The guards are named `RequireAuth` and `RequireAdvisor`; there is no `ProtectedRoute`.

#### F-0.4 Type-check and import-check edge functions in CI
- **Status:** **DONE** · **Size:** S · **Priority:** Highest · **Owner:** BE · **Depends:** F-0.2 · **Milestone:** M1
- **Built:** `npm run typecheck:functions` runs `tsc` over `supabase/functions` (`tsconfig.functions.json`, strict, with `types/functions-shims.d.ts` declaring the URL imports) and is a step in the CI `verify` job. Run against the previous `chamber-extract/index.ts` it fails with the two errors that broke the function (TS2440 and TS2304), and it also fails on a bad named import (TS2305), a missing file (TS2307) and an undefined name in another function. `chamber-extract/handler.test.ts` loads and exercises that function's handler.
- **Notes:** It passed on a GitHub runner in a manual CI run of this branch (run 39857171390, and again after the `document-extract` change in run 39859505690; `sql-tests` passed in both). The failing case was shown locally with the same command, not on GitHub. The URL imports are declarations, not fetched modules, so a wrong remote URL or a wrong call into a remote package is not caught (the SheetJS declaration covers only what `document-extract/read.ts` uses). `chamber-extract` has a handler test and `document-extract` has a test of its model call; every function's `index.ts` otherwise relies on the type check.

---

### Epic A: Durable Intake Session

*As built:* Sessions live in `chamber_sessions` under Supabase Auth and owner RLS (D14), not in token-gated edge-function tables. Isolation is in place and tested. Validation and versioned writes (A-2.2), expiry, archive and revocation (A-1.5), a local backup of unsaved answers (A-1.4), a way back from another browser (A-1.3), the canonical JSON Schema checked on the way in (A-2.1) and a clean transcript on resume (A-3.2) are done. `docs/intake-schema.md` → "Session lifecycle" describes them.

#### A-1.1 Intake session data model
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** D1, D4 · **Milestone:** M1
- **Built:** `chamber_sessions` (migration `20260324031329`) with owner-only RLS for `authenticated` (guests are `authenticated` with the `is_anonymous` claim). Advisors read all rows, read-only (`20261022090000`). The access matrix in `supabase/tests/advisor_operations.sql` covers signed-out, guest, other prospect, advisor and admin.
- **Remaining:** Anonymous denial and cross-owner isolation are met. `status` is now a checked set (`in_progress`, `submitted`, `expired`, `archived`, `revoked`), and `last_activity_at`, `expires_at` (A-1.5), `schema_version` (A-2.1) and `data_version` (A-2.2) exist, all set by the server. The browser still writes the table directly, under row security and triggers. The token-hash criteria no longer apply (D14).

#### A-1.2 Create a guest session and issue a continuation token
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-1.1, D1 · **Milestone:** M1
- **Built:** `signInAnonymously` (`useAuth.tsx`, `RequireAuth.tsx`) followed by a `chamber_sessions` insert (`useChamberSession.ts`). Turnstile guards guest creation when `VITE_TURNSTILE_SITE_KEY` is set. Per-user, per-IP and global limits cap AI spend (section 1.1), but nothing caps session creation.
- **Remaining:** A row id is useless without the owner's JWT, so the intent holds. No limit on sessions per user or per IP exists in the repo (a Supabase anonymous-sign-in limit would be dashboard configuration, which this refresh could not see). Turnstile is off when the key is unset: set it in every deployed environment. Decide whether to add a creation cap.

#### A-1.3 Restore a session after refresh, with a recovery screen
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** A-1.2, A-2.3, A-3.2 · **Milestone:** M1
- **Built:** The Supabase auth session persists in browser storage and the session id travels in `?session=` (`ChamberPage.tsx`). Resume is gated by RLS. A bare `/start` resumes the prospect's latest open intake (by `last_activity_at`), and offers a retry rather than a new intake when it can't be checked or opened. When a linked intake can't be opened, the recovery screen says why: for a guest, that this browser no longer holds the sign-in (another device, a private window, cleared data). It offers to email a 6-digit sign-in code to the address they verified (`RecoverIntake.tsx`, `useAuth().requestSignInCode` / `verifySignInCode`: `signInWithOtp` with `shouldCreateUser: false`, then `verifyOtp` type `email`). The reply is the same whether or not the address has an account. A guest on a fresh intake gets the same offer ("Continue an earlier intake"). Once signed in, the hook drops what was on screen and opens the linked intake, or the person's latest one; a link that named the guest's own blank intake is dropped. The Chamber warns when the browser won't keep site data at all. `npm run setup:supabase` puts the code in the magic-link template and `--check` verifies it. Unit tests cover the screen, the form, the auth calls and the switch to another user. The browser path of the email code is not in the end-to-end test (the stand-in has no `/otp`).
- **Notes:** A guest who never verified an email can't come back from another browser, and the screen says so. Nothing sets a password. Since 2026-11-04 opening or reloading the Chamber creates nothing: the prospect's first change creates the intake, and the database refuses a second open draft per person (`EA009`, migration `20261104102000_one_open_draft.sql`); a tab refused that way offers the other tab's intake ("Load latest" or "Keep my changes"). Orphans that predate this still expire (A-1.5). The chosen PEO is saved with the intake (`chamber_sessions.chosen_peo`, migration `20261103100000`, US-1.3), so a reload in The Reckoning keeps it (end-to-end tested). A reload still returns to the first workspace tab.

#### A-1.4 Autosave with visible status and local backup
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-1.2, A-2.2 · **Milestone:** M1
- **Built:** 2-second debounced autosave, a 10-second retry, an in-flight save awaited before the next, and a keepalive request on page unload (up to 60,000 bytes, otherwise a leave-confirm prompt) in `useChamberSession.ts`. Submit waits for pending saves. `SaveStatus.tsx` shows Saving / Saved / Not saved with a Retry action, and A-2.2 added conflict, invalid-field and missing-row states. 'Saved' means the versioned update returned the row, and zero rows is a conflict, not a success. Tested.
- **Local backup:** While a change is unconfirmed, the hook keeps a copy in `localStorage` (`src/data/intakeBackup.ts`) with the version it was made on, and removes it once a save is confirmed. When the same person opens the same intake and the copy differs from the server, `BackupNotice` offers "Restore my changes" (saved from the loaded version, warning when the intake was saved elsewhere since) or "Discard them". A copy the server already matches is dropped silently. The census is never written to the browser, copies last at most 7 days, are offered only to the user who wrote them, are checked against intake schema v1 before use, and are all removed on a deliberate sign-out. Tested in the hook, the module and `e2e/intake-lifecycle.spec.ts` (saves blocked, tab closed, copy restored and saved).
- **Notes:** Answers typed before the intake row is first created are not backed up (creation failing means the database is unreachable). Blocked or full storage keeps nothing, quietly, beyond the Chamber's warning that the browser keeps no site data.

#### A-1.5 Expiry, archive, and revocation
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** A-1.2, D4 · **Milestone:** M1
- **Built:** Migration `20261103090000_intake_lifecycle.sql`. `status` is a checked set with three closed states: `expired`, `archived`, `revoked`. `last_activity_at` and `expires_at` are server-set (last activity + 30 days for an uncertified draft, null once ever certified). `public.expire_idle_intakes()` runs hourly through pg_cron (`expire-idle-intakes`, also scheduled by `npm run setup:supabase`). It moves only in-progress drafts that were never certified, skips rows being saved, and writes one `intake_lifecycle_events` row per intake. "Start over" in the Chamber calls `archive_chamber_session` (own, never-certified drafts; anything certified is kept) and begins a blank intake. `revoke_chamber_session(id, reason)` is admin-only and audited. Row security hides archived and revoked intakes, their documents and their stored files from the prospect; an expired one stays readable but can't be changed or take documents, and a trigger backs that up (`EA002`). The Chamber shows "This intake has expired" with a restart, for a link and for a bare `/start` whose latest intake expired. A tab open at expiry is told at its next save. The advisor queue labels closed drafts. Existing drafts got a full window from the deploy, with versions untouched. Tested in `supabase/tests/intake_lifecycle.sql` (upgrade, activity, the job and its limit, certified and once-certified intakes left alone, the expired, archived and revoked access rules, the audit trail, the schedule), the hook and page tests, and `e2e/intake-lifecycle.spec.ts`.
- **Notes:** The window (30 days) is a recommended default until D4 closes. Expiry closes a draft but keeps its data, transcript and uploads: purging them is H-1.2. Revocation has no screen yet (SQL or API as an admin, `docs/ADVISOR_ACCESS.md`). Deploy the migration before the front end, which orders by `last_activity_at` and calls `archive_chamber_session`.

#### A-1.6 Retire the legacy `chamber_sessions` path
- **Status:** **SUPERSEDED** · **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** A-1.3 · **Milestone:** M1
- **Built:** `chamber_sessions` stayed the canonical store and is written in `useChamberSession.ts`.
- **Remaining:** Drop this story. Its AC ('no frontend code path writes to `chamber_sessions`') contradicts the shipped design (D14).

#### A-2.1 Canonical intake schema v1
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE + FS · **Depends:** D2 · **Milestone:** M1
- **Built:** `ChamberData` (37 flat fields plus an `employees` array) in `chamberTypes.ts`. Zod rules in `chamberValidation.ts` sanitise in the browser, and the database enforces the same limits (A-2.2). Provenance in a sibling `field_provenance` jsonb column. `docs/intake-schema.md` exists. Zero counts are accepted.
- **JSON Schema and strict checks:** `supabase/functions/_shared/intakeSchema.ts` is the canonical schema, v1, as a draft 2020-12 JSON Schema, published as `docs/intake-schema.v1.json` (`npm run schema:intake`; a test fails while they differ). Its validator is strict: no coercion, unknown keys refused at every level, paths named like the database's, values never echoed, and any keyword it doesn't implement refused. It runs where data comes in: `chamber-extract` refuses each extracted field that breaks it and returns `rejected`, logging paths only; a local backup is checked before it is offered; a saved row is checked as it loads and mismatches are logged. Everything it accepts the database accepts: `schemaSync.test.ts` holds its codes, caps, value lists and kinds to the migrations, and the sanitiser's output always passes it (golden and seeded random inputs). `chamber_sessions.schema_version` (migration `20261103091000`) records v1 on every row and refuses any other value.
- **Notes:**
  - Provenance stays a sibling map rather than a `{value, status, source, …}` envelope, as D14 recommends; amend the AC. Statuses lack `not_applicable` and sources lack `advisor_edit` and `system` (advisor changes live in `advisor_field_reviews`). There is no per-field required-for-submission flag: D2 is decided as three required answers and a recommended census, in `readiness.ts` and one presence rule in the database (US-1.2, B-2.2). D2 adds no workers' comp, EIN or contractor sections. Voice `<extract>` data still goes through the lenient sanitiser. `chamber-extract` keeps its own field list, every field but the census since B-1.1 (`schemaSync.test.ts` holds it to `ChamberData`), checked value by value against the schema. Nothing checks the field table in `docs/intake-schema.md` against the code (the JSON file is checked). Zero-versus-absent is untested, and the Review tab shows 0 as a dash.
  - Remaining schema work (found by B-1.1): the epic's categories that have no field at all, so chat can't extract them: workers' comp basics, the legal and business address, a prior PEO arrangement, total payroll estimates, a dependent coverage summary, a contractor count and the list of entities. Each needs a migration, the client's constants and a schema v1 property ("Adding a field" in `docs/intake-schema.md`), and then a line in `chamber-extract`'s field list and prompt. D2 requires none of them, so the status stands.

#### A-2.2 Server-side validation and versioned writes
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-2.1, A-1.2 · **Milestone:** M1
- **Built:** Migration `20261027090000_intake_validation_and_versioning.sql`. `chamber_sessions.data_version` (integer, default 1) is set by a trigger, not the client: 1 on insert, +1 on every update, whatever a client sends. `public.chamber_data_error` checks `chamber_data` on insert, whenever it changes and when the session is certified. It checks the kind of each of the 38 keys, the state codes (the 50 states, DC and `AS GU MP PR VI`), counts and salaries (whole numbers, 0 to 1,000,000), text length (1,000 characters) and the caps (5,000 employees, 20 dependents each, 60 states, 100 list items). A refused write changes nothing and raises SQLSTATE `EA001`, which PostgREST answers with HTTP 400 and the zero-based path (`employees[3].dob`) in `details`. `profiles.phone` is checked by its own trigger. `useChamberSession.ts` saves with `.eq("data_version", n).select(...)` through one queue; on zero rows it reads the row back and tells a conflict ('Load latest' or 'Keep my changes') from its own lost response, a deleted row and a transient error. `EA001` is not retried and the status names the field. The browser sanitiser (`chamberValidation.ts`) and `document-extract` hold the same limits, so valid client output is never refused, and `src/data/schemaSync.test.ts` fails CI when the migration and the client drift. `supabase/tests/intake_validation.sql` has 59 rejection cases plus the version, certification, phone and legacy-row cases. `e2e/two-tabs-conflict.spec.ts` shows a stale tab refused with the database keeping the other tab's save, and a direct `PATCH` refused with `EA001`. The field table and rules are in `docs/intake-schema.md`.
- **Notes:**
  - **Phone:** `chamber_data` has no phone. The only phone is `profiles.phone`, checked when it is set to a new non-empty value (7 to 15 digits, `+`, spaces, brackets, dots, dashes, an extension). Rows that already hold a bad phone stay editable.
  - **Unknown keys:** an unknown top-level key in `chamber_data` is refused (unknown keys inside an employee or dependent are tolerated), so a new field needs its migration before the front end that sends it.
  - **Existing rows:** nothing is backfilled or re-validated. A row that already holds invalid data stays editable until its `chamber_data` changes or it is certified.
  - **Concurrency:** the SQL test and the browser test save from one version one after the other. That proves the version condition and the server-owned version. Two real connections (the second waits on the first's row lock, then matches no row) were checked by hand with two `psql` sessions and are not run in CI.
  - **Keepalive:** the save on page unload carries the version condition and cannot read the response, so a tab that is behind and is closed with unsaved edits loses them, and says nothing. While a conflict, a refused answer or a deleted row is showing, or while a save is in flight or has failed (it may have landed and moved the version on), closing the page asks the prospect to confirm instead.
  - **Not covered:** the transcript, `field_provenance` and `documents.extraction` (only the existing is-object checks), `status`, and advisor edits. Dates stay free text.
  - **Deploy order:** the migration must reach production before the front end, which selects and filters on `data_version`. Without the column every load, create and save fails. Deploy the front end and `document-extract` right after the migration: a tab still running the old bundle sends data the new database refuses (a state code outside the list, an employee state such as 'NA', a list over its cap), so every save from that tab fails with `EA001`, retries every 10 seconds, and loses its edits when the prospect leaves. Prospects with an intake open should reload after the deploy. An old tab also keeps last-write-wins, because it sends no version. A safer order, if the risk matters: ship a front end with the tightened `chamberValidation.ts` and the new `document-extract` first, then the migration.
  - The state list, the caps, refusing unknown keys, validating inserts and putting the phone rule on `profiles` are product choices made on recommended defaults: confirm them (open question 7).
- *Revised scope, AC and tests:*
  - **Scope:** The browser writes whole-row jsonb straight to `chamber_sessions`, so nothing validates it on the server and saves are last-write-wins. Add a `data_version` column that a trigger increments, and a `BEFORE UPDATE` trigger that validates `chamber_data` (field types, state codes, count ranges). The client sends its last-seen version with each save (`.eq("data_version", n)` plus `.select()`), and treats zero matched rows as a conflict.
  - **AC:**
    - An invalid payload changes nothing and names the field path that failed.
    - A save made from a stale version is refused and the client is told the current version.
    - Invalid numbers, malformed phone numbers, counts below 0 or above 1,000,000, and unsupported state codes are rejected (`stateCode` currently accepts any two letters).
    - A successful save increments `data_version`.
  - **Tests:** One SQL test per rejection type. Two saves from the same version produce one success and one conflict: run one after the other in `intake_validation.sql` and `e2e/two-tabs-conflict.spec.ts`, which proves the version condition. The two-connection row-lock wait was checked by hand, not in CI (see Notes, Concurrency).

#### A-2.3 Hydrate the Chamber workspace from saved data
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.1, A-2.2 · **Milestone:** M1
- **Built:** The workspace tabs render the hydrated `chamberData` with `isDemo={false}`. Company, Payroll and Benefits show status badges and empty-state text. Sample data appears only on `/manuscript/demo` and in tests.
- **Notes:** Census and Dependents have no badge or edit path. The chosen PEO is saved with the intake (A-1.3). The opening message still tells the prospect the workspace is 'a demonstration' (`OPENING_MESSAGE` in `useChamberSession.ts`): rewrite it.

#### A-3.1 Store transcript messages as ordered rows
- **Status:** **SUPERSEDED** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** A-1.2 · **Milestone:** M1
- **Built:** The transcript is a jsonb array on `chamber_sessions.transcript`, rewritten on each save. Senders are `lenore` and `user`. The prospect's message is added before the model call and kept when the call fails (tested).
- **Remaining:** Order and role are met. Not met: separate rows, server-assigned `seq`, `extraction_status`. Two tabs no longer overwrite each other's transcript: a save from a stale version is refused and that tab offers 'Load latest' or 'Keep my changes' (A-2.2). Recommended: keep the array.
- **2026-11-04 (A-3):** each message now carries a full ISO 8601 timestamp (older time-of-day strings still display), a `system` sender for the Chamber's own notes (voice call started and ended), and a `spoken` flag; a spoken answer is captured as `inferred` at most (D33). The database checks every message's shape (migration `20261104101000_transcript_validation.sql`, `EA001` with the path). Advisors see the speaker, "spoken" and the date and time. Tested in `chat.test.ts`, `provenance.test.ts`, the panel, evidence and page tests, `supabase/tests/transcript_validation.sql` and the sync test.

#### A-3.2 Restore the transcript on resume
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** A-3.1, A-1.3 · **Milestone:** M1
- **Built:** `parseTranscript` runs on resume and `dedupeGreetings` keeps only the first greeting. Lenore's opening is marked `kind: "greeting"`, and older openings, including the 'demonstration' wording, are recognised by their words. A voice session's own hello is marked as one and not added again. The panel opens at the latest message without animating through the history and scrolls only itself, never the page. It follows new messages only while the reader is at the bottom, otherwise offering "New message", and always shows the prospect's own message. It marks "Restored from your last visit" after the last restored message. The orb shows Lenore's latest line instead of a separate hard-coded hello. Tested in `chat.test.ts`, `useLenoreVoice.test.ts`, `TranscriptPanel.test.tsx`, the hook (deduped load, restored marker) and the page.
- **Notes:** No `system` sender (A-3.1 recommends keeping the array). The restored marker is set when an intake is opened, not when another tab's version is loaded.

---

### Epic B: Make AI Extraction Auditable and Useful

*As built:* Provenance, conflict handling, confirm-or-edit controls and failure states are built. The extraction function loads and is tested, and chat extracts every intake field except the census. Prompt versioning and a live extraction eval are built and wait on a first recorded baseline. The follow-up policy (B-1.3) moved to US-2.3a, which is not started.

*Re-scoped (2026-11-03):* the remaining work in this epic is planned as US-2.1 to US-2.4 and their nine child stories, under "US-2.1 to US-2.4" at the end of this epic (decisions D17 to D33). Vocabulary follows `GLOSSARY.md`.

#### B-1.1 Extraction response contract and parser
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-2.1 · **Milestone:** M1
- **Built:** `chamber-extract` now asks the model for every intake field except the census. `FIELD_TYPES` (`chamber-extract/schema.ts`) holds all 41: the 24 it lacked are the entities and FEIN count, rate history, waiting period, ancillary benefits, retirement plan type and employer contribution, funding lead time, the nonexempt and exempt mix, PTO types and accrual, when the handbook was updated, HR staff, three ways of keeping time, shift differentials, the HRIS, and schema v2's four workers' comp answers (carrier, renewal date, experience mod, annual premium). Each is a string, a whole number, a decimal (the experience mod), a boolean or a list of strings, and `SYSTEM_PROMPT` defines each in one line, worded to the intake schema (whole numbers from 0 to 1,000,000 unless a field says otherwise, the experience mod from 0 to 10, the premium up to 100,000,000 dollars, text up to 1,000 characters, lists of up to 100 items as arrays, never a comma string). `has_401k` is defined as any employer retirement plan, as the workspace labels and shows it, and the answers the workspace shows only beside a flag (the FEIN count, the plan type and match, the nonexempt and exempt counts) ask for that flag with them. `src/data/schemaSync.test.ts` fails when a `ChamberData` field other than the census is missing from `FIELD_TYPES` or typed differently from the kind the workspace edits it as (`FIELD_KINDS`), and `extraction.test.ts` when a field has no definition in the prompt, a caps line drifts from the schema, or a flag goes missing. The response is `{extracted, field_status, evidence, corrected_fields, reply, rejected, prompt_version}`, shaped in `extraction.ts`, with a per-field `field_status` and `evidence` (up to 200 characters). Each value is checked against the intake schema as sent: one that breaks it is refused on its own, listed in `rejected` and its path logged as `EXTRACTION_REFUSED` (A-2.1), and the valid fields and Lenore's reply still apply. The browser's sanitiser also drops field by field, and the database refuses a bad shape on save (A-2.2). A key outside the field list is dropped on the server. Tool arguments that aren't JSON are answered with a 502 `invalid_response` ("Lenore's answer didn't come through. Please try again.", US-2.4a), which the browser shows with Try again and Continue manually (B-3.2). Anthropic is asked for up to 8,192 tokens (`CHAT_MAX_TOKENS`), room for every field with its quote and a reply, where the adapter's default of 1,024 would cut a dense answer off; a reply cut off at the cap is answered with the same 502, since its tool input may be partial. An extraction with nothing in it still gets a reply: the model's, or the browser's own line when it sends none. The contract version is `PROMPT_VERSION` (main's integer, US-2.4a, carrying B-1.4's stamp), now 3: US-2.1b and this work each made a 2, and 3 is the two merged (US-2.1b's user turn and field list, these definitions and caps). The eval's ten fixtures now also assert two entities with two FEINs, the hourly and salaried mix, a retirement plan that isn't a 401(k) (a SIMPLE IRA) with its match, the funding lead time, ancillary benefits as a list, two timekeeping answers (one a negation) and the HRIS; the nothing-extractable fixture's must-stay-empty list is the field list, so it covers the new fields. The eval asks the provider for the same reply budget. Tested in `extraction.test.ts` (the new kinds kept, wrong shapes refused, every field defined, the caps and flags in the prompt), `handler.test.ts` (unreadable tool arguments, the reply budget, a reply cut off at it), `providers.test.ts`, `schemaSync.test.ts` and the eval's stub-model tests (`runner.test.ts`, `fixtures.test.ts`).
- **Notes:**
  - **Revised.** v1.0 rejected the whole response when any of it didn't conform. A bad value now costs only its own field, so the prospect keeps the valid answers and Lenore's reply, and the database still refuses a bad shape whatever the browser sends.
  - Keys outside the field list are dropped but not logged. Logging their paths is deferred to M2.
  - The eval's baseline must be recorded with a live provider key for prompt version 4; none is committed yet (B-1.4).
  - Categories the epic names that have no field yet can't be extracted until the schema has them; they are listed in A-2.1's Notes as remaining schema work.
  - The Anthropic adapter is shared, so a `document-extract` read cut off at its own cap (4,096 tokens) now fails like an unreadable reply instead of keeping part of the list.
  - Voice is unchanged: the ElevenLabs agent has its own prompt, and its `<extract>` data still goes through the lenient sanitiser.
- *Revised scope, AC and tests:*
  - **Scope:** The model returns field updates, each with a value, status and short evidence quote, plus a `reply`, for any intake field except the census. The server checks each value against the intake schema and keeps or refuses it on its own. Only fields on the list are kept.
  - **AC:**
    - A value that doesn't conform is refused, listed in `rejected` and its path logged; the valid fields and the reply still apply, and the database refuses the shape if it is ever sent.
    - A key outside the field list is dropped on the server.
    - Output that can't be parsed, or is cut off at the token cap, is a 502, and the browser offers Try again and Continue manually.
    - A response with no extractable data still returns a conversational reply.
    - The contract is versioned and stored with each extracted value (B-1.4).
    - Chat can extract every existing intake field except the census.
  - **Tests:** An invalid state code, a negative or fractional count and a list sent as text are refused alone. An unknown field is dropped. Unparseable tool arguments and a reply cut off at Anthropic's cap get a 502, and Anthropic is given room for a full answer. An empty extraction is still versioned. The field list matches `ChamberData` and `FIELD_KINDS`, and the prompt defines every field. The eval's fixtures cover the new fields.

#### B-1.2 Merge policy and conflict capture
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** B-1.1, A-2.2 · **Milestone:** M1
- **Built:** `applyExtraction` (`provenance.ts`) ranks sources: the prospect's edit, then a document they applied, then chat (`transcript`, voice included). An AI value never touches a `prospect_edit`. When two values disagree, the higher-ranked one stands and the other is kept on the field as `also_heard` (value and source; newest last, one per value, at most 5, never the field's own value), and a higher-ranked value settles a conflict between lower-ranked ones, keeping every candidate as `also_heard`. Two values of the same rank (chat against chat, document against document) still make the field `conflicting`. An explicit correction (`corrected_fields`) still replaces anything but a prospect's edit, a document's value included, and keeps a replaced value from another kind of source. A list that only adds entries still extends: added to from chat, a document's list takes chat's source and `inferred`, so the prospect confirms the whole list. The same value heard again (a list in any order) never trades its source for a lower-ranked one, and a note heard again keeps its higher-ranked source. The census is not ranked. Applying a document candidate over a chat value now replaces it instead of raising a conflict: the Upload tab offers Apply for it ("Replaces what you told Lenore: …"; `planCandidateMerge` kind `replace`), which keeps the chat value as `also_heard`, and keeps the conflict dialog for a differing prospect's or document's value, or one with no provenance. Choosing the document's value in that dialog (`applyChosenValue`) replaces the intake's and, as a correction does, keeps a replaced value from another kind of source (the prospect's own answer included) as `also_heard`. The prospect confirming, editing or resolving a field, or keeping their answer in the dialog, clears `also_heard`; an advisor verifying it does not. The untracked merges are gone: a voice `<extract>` with no prospect message to cite is dropped, `useLenoreChat` hands every extraction to the Chamber's `applyExtraction`, and `mergeChamberData` is removed. `parseProvenance` reads entries saved without `also_heard` and drops a malformed note without losing the entry. The database checks only that `field_provenance` is an object, so no migration. Tested in `provenance.test.ts` (each rank pair both ways, conflicts settled, corrections across kinds, lists across ranks, repeated values and reordered lists, the notes' cap, de-duplication and clearing, old entries), `documentCandidates.test.ts`, `DocumentCandidates.test.tsx`, `useLenoreChat.test.ts` and `ChamberPage.test.tsx`. The rules are in `docs/intake-schema.md`.
- **Notes:**
  - **No server-side enforcement, by decision.** Every AI value reaches the database through the prospect's own browser, which can already save any value as the prospect's own edit, so a database check of provenance or precedence would stop nothing the prospect couldn't do anyway. That part of v1.0's AC is dropped for good, not deferred. The database validates the answers themselves (A-2.2).
  - There is no `system` rung: nothing writes a system value.
  - `also_heard` is stored by this story and shown by B-2.1: under the answer in the workspace and in the advisor's field row.
  - `scripts/extraction-eval` drives chat only, so its scoring is unchanged, except that its forbidden-digits check now also scans `also_heard`. The prompt did not change, so neither did `PROMPT_VERSION`.
- *Revised scope, AC and tests:*
  - **Scope:** One precedence ladder in the browser's merge: prospect edit, then document, then chat. A value that loses is kept on the field as a note rather than discarded or raised as a conflict, and values of the same rank still conflict. No AI value reaches the intake except through the merge.
  - **AC:**
    - An AI value never changes a prospect's edit.
    - A higher-ranked value replaces a lower-ranked one and the replaced value is kept; a lower-ranked value never replaces a higher-ranked one and is kept.
    - Two different values of the same rank make the field `conflicting` with both candidates.
    - An explicit correction replaces any value except a prospect's edit.
    - Every chat and voice extraction is merged with its provenance, or not at all.
  - **Tests:** Unit tests for each rank pair in both orders, conflict settlement, corrections across kinds, list extension across ranks, repeated values, the notes' cap, de-duplication and clearing, reading old entries, and the chat and voice call sites.

#### B-1.3 Lenore follow-up policy and completion state
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** Highest · **Owner:** BE + PM · **Depends:** B-1.2, D2 · **Milestone:** M1
- **Built:** By US-2.1b and US-2.3a (2026-11-04): the prompt names the unsettled fields by rank, Lenore asks one at a time and never a settled one, and "ready to certify" is derived by one shared rule rather than set as `ready_for_review` (D27).
- **Remaining:** None: US-2.1b and US-2.3a built it.
- **Notes:**
  - **Revised.** No `ready_for_review` status: completion is derived when it is read, never stored or set by the server (D27). An intake is complete when every required item is settled (B-2.2).
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Compute the list of missing required fields and conflicts on the server. Pass the top priority items into the prompt. Lenore asks about one missing item per turn and does not re-ask a confirmed field. The session becomes `ready_for_review` when every required field is confirmed or marked not applicable and no conflicts remain.
  - **AC:**
    - The prompt contains the next missing required field.
    - Lenore never re-asks a `confirmed` field in a test transcript.
    - `ready_for_review` is set only by the server, when the rule holds.
  - **Tests:** Scripted transcript fills required fields in order and reaches `ready_for_review`. Scripted transcript with a conflict stays out of `ready_for_review`.

#### B-1.4 Prompt versioning and golden-transcript fixtures
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-1.1 · **Milestone:** M1
- **Built:** `PROMPT_VERSION` (`chamber-extract/schema.ts`) versions the whole extraction contract: the system prompt, the tool schema and the response shape. `schema.test.ts` hashes the prompt and tool schema and fails CI when either changes without a new version, naming the hash to record. Every successful response, an empty one included, carries `prompt_version`, and the browser stores it on the field's transcript source (`transcriptExtraction` in `provenance.ts`); stored provenance without it still parses, and a malformed one is dropped. Voice extractions, whose prompt lives in the ElevenLabs agent, carry none: `voiceExtraction` drops any version the agent writes. `npm run eval:extraction` (`scripts/extraction-eval`) sends 10 synthetic transcripts through the production path (the browser's redaction and context, the handler's prompt, now `buildUserPrompt` in `prompt.ts`, the shared adapter, `shapeExtraction`, then `applyExtraction` as the Chamber merges a reply) against the configured provider. It scores each asserted field's final value and status (a field left conflicting fails unless the fixture expects the conflict), fields that must stay empty and an SSN that must never be stored, prints a table and the accuracy, and exits 1 on any cell that passed in the committed baseline and fails now. Its scoring, baseline comparison, fixtures and the whole path against a stub model are unit-tested in CI. The rule and the commands are in `docs/intake-schema.md`. Ten golden transcripts also run in CI against a stubbed model (US-2.3a, `supabase/functions/chamber-extract/golden.test.ts`): they hold our side of the contract (the prompt, the request building, the merge), not how a real model answers, which stays the live eval.
- **Remaining:** Record the first baseline with a live provider key; no key is available in the build environment.
- *Revised scope, AC and tests:*
  - **Scope:** One version string for the extraction contract, stored on each transcript provenance source rather than an extraction row (there is no extraction table). The golden suite is a live, on-demand eval against a committed baseline rather than a stubbed CI suite: a stub can only replay answers we wrote, while the risk is a prompt or model change that alters what the model extracts.
  - **AC:**
    - Every value extracted from a chat message records the contract version on its provenance source.
    - Changing the prompt or tool schema without a new version fails CI.
    - The eval fails when a cell that passed in the baseline fails, and a baseline is recorded and committed with each prompt change.
  - **Tests:** Hash test in CI. Scoring, baseline comparison, fixture validity and the pipeline against a stub model in CI. The eval itself against a live provider, before merging a prompt change.

#### B-2.1 Provenance badges and confirm-or-edit controls
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** B-1.2 · **Milestone:** M2
- **Built:** Status badges, Confirm and Edit/Add controls, conflict candidates with 'Use this', and a 'Needs your review' list in the Review tab. Confirm sets source `prospect_edit`. Tested (`ProvenanceField.test.tsx`).
- **Notes:** Since 2026-11-04 the copy is the plan's: 'Lenore captured this — please confirm' with a Confirm button, and a value the prospect confirmed or typed is badged 'Confirmed by you', apart from one Lenore heard stated outright ('Confirmed'). Since 2026-11-04 a required answer in conflict can't be certified until one value is chosen (C-1.3), so a conflicting required value never reaches The Manuscript as a certified fact.
- **Notes (verified and also heard):** A field an advisor verified shows 'Verified by your advisor' in place of the please-confirm, incomplete or conflicting badge, with no Confirm button and no rival answers; Edit stays, and a prospect-confirmed answer keeps its 'Confirmed' badge (`VerifiedFieldsContext`, provided by `LiveWorkspace`, so every tab's rows read the set `session_verified_fields` loaded). Each `also_heard` note shows under the answer as 'Also heard: <value> — <source>' in the workspace and in the advisor's field row (`FieldReviewPanel`); not in The Manuscript or its PDF, and it goes when the prospect confirms or edits. Tested in `ProvenanceField.test.tsx`, `LiveWorkspace.test.tsx` and `FieldReviewPanel.test.tsx`.

#### B-2.2 Derive open items from the schema
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-1.2, A-2.1 · **Milestone:** M1
- **Built:** On top of US-1.2's readiness list (D2: three required answers, then the recommended census), each item now also says how settled it is. In the database, `public.intake_answers_present(data)` is the one presence rule: the certification gate `intake_missing_required` (same keys, order and sync block; its trigger and `EA003` untouched) and `public.intake_required_items(data, provenance, verified)` both read it (migration `20261104103000`). In the browser, `requiredItems` (`src/data/requiredItems.ts`) takes presence from `readiness.ts`'s own tests and adds the states. Both run the same cases, `src/data/requiredItems.cases.json`, and the SQL test also checks that the gate refuses for exactly the required items reported missing. Each item is missing, conflicting, incomplete, unconfirmed or settled, and says whether it is required; `isIntakeComplete` is the three required items settled, whatever the census. A present item is settled when its field is confirmed (by anyone), an advisor verified it, or it has no provenance; otherwise it takes its field's status. States of operation is also settled by a settled census that names a work state. The advisor queue's `missing_required` is the required items reported missing (`advisor_list_submissions` keeps its arguments and columns; the rule written out in three migrations is gone, and a missing census is no longer listed). `public.session_verified_fields(id)` gives the intake's owner (under the owner's read rule, so never for an archived or revoked intake) and advisors the names of the fields an advisor verified, and nothing else of the review; `advisor_field_reviews` stays advisor-only. The Chamber reads it once when it opens an intake (`useChamberSession`, an empty list on any error), as does the prospect's Manuscript page; the advisor's Manuscript uses the reviews the page has loaded. In the Review tab, 'Still needed' (US-1.2) lists the required answers that block certification, missing or in conflict; 'Needs your review' starts with the required answers given but not settled ('Incomplete', 'Please confirm'), then the other open fields, each field once, never one an advisor verified. While only the census names states, the census is the answer to confirm or resolve. The Manuscript lists '<item> — not provided' for the missing required answers and the recommended census, then the open fields less the verified ones. The Reckoning won't submit while a required answer's answers conflict ('Choose one answer for <item>', after US-1.2's missing-answer blockers; a conflict States of operation takes from the census names the census), as Review lists it (`certificationBlockingItems`). The PDF prints a value whose field's status is conflicting as '<value> (unresolved — see open items)' wherever the web Manuscript shows the red chip; a row built from several fields (entity structure, exempt and nonexempt counts, retirement, the census counts) takes the chip and the marker from any of them that conflicts (`rowProvenance`). Tested in `required_items.sql` (the shared cases, the gate's agreement, malformed input, who may read verified fields, the queue against its old definition), `certification_readiness.sql` (now on the redefined gate), `advisor_operations.sql`, `requiredItems.test.ts`, `provenance.test.ts`, `ReviewTab.test.tsx`, `LiveWorkspace.test.tsx`, `manuscript.test.ts`, `manuscriptPdf.test.ts`, `certification.test.ts`, `ReckoningTab.test.tsx`, `useChamberSession.test.ts`, `ManuscriptPage.test.tsx`, `ChamberPage.test.tsx`, `advisor.test.ts` and `verifiedFields.test.ts`. The rule is in `docs/intake-schema.md` → "Required items".
- **Notes:**
  - **Revised.** The rule is one presence test in the database and readiness's list in the browser, with the item states held together by a shared case table, rather than read from a per-field flag in the schema. The per-field reasons (inferred, incomplete, conflicting) stay in the browser, from provenance.
  - **Reconciled with US-1.2** (both landed 2026-11-03): D2 is US-1.2's three required answers with the census recommended. The census no longer appears in the advisor queue's `missing_required`, and it never counts against completeness or blocks certification.
  - 'Document needed' (US-2.2a) is the census's reason in Review's Recommended list and The Manuscript's open items; the advisor queue never lists the census as missing, and no document is required (D2).
  - A conflicting required answer blocks certification in the browser and the database (`EA008`, B-2 D26), whoever verified it; States of operation that only a census in conflict gives is checked in the browser only, and a verified census settles it.
  - The database reads stored values as the browser loads them, so the two agree on stored intakes: text is blank when `String.trim` leaves nothing, a state counts only when it is a state or territory code (any case, whitespace around it ignored), which also covers rosters saved before 20261027 with a `state` such as 'NA'; and a provenance entry counts only when `parseProvenance` keeps it (`provenance_entry_status`), since nothing on the server checks `field_provenance`. The gate now reads answers the same way, so it trims as the browser does and refuses an old roster's invalid state as no state. The shared cases cover both. They can still differ on values the app never stores, most of which the database refuses on write: a state's full name, which the browser reads as its code, a census row the browser can't read, or a `states` string rather than a list.
  - A conflicting field an advisor verified is settled: it is not an open item, and the Manuscript shows it confirmed, with no red chip on the web and no "unresolved" marker in the PDF, as the advisor's packet does (`applyAdvisorReview`).
  - The census's older name: `employees` in the answers or the provenance is read as the census when there is no `census`, and an advisor's review under `employees` counts as the census's unless the census has its own.
  - `chamber-extract`'s prompt did not change, so neither did `PROMPT_VERSION`.
- *Revised scope, AC and tests:*
  - **Scope:** One definition of the D2 items (the three required answers, then the recommended census) and how settled each is, in the database, mirrored in the browser and tested against the same cases. Open items list unsettled required answers first, then the other fields that need the prospect, never a field an advisor verified unless it is a required answer still not provided. A conflicting required answer holds certification back, as the database's gate does (`EA008`).
  - **AC:**
    - The certification gate, the advisor queue, the Review tab, the Manuscript and certification read one rule, and the browser's copy gives the database's answer on every shared case.
    - A field an advisor verified is settled. Its owner can learn which fields those are, and nothing else of the review.
    - The Review tab lists each field once, required answers first, with a reason.
    - A required answer whose answers conflict blocks certification; the recommended census never does.
  - **Tests:** The shared case table in SQL and vitest, with every state of every item, stored provenance and state codes read as the browser reads them, and the gate's agreement; verified fields as the owner, another user, an advisor, a guest token and a signed-out caller, and for an archived intake; the Review lists' order, reasons and counts; the Manuscript's open items; the PDF marker and the web chip, combined rows included; the certification blocker.
- **Built (US-2.2a):** Since 2026-11-04, one list (`src/data/openItems.ts`) with the reasons Not provided, Document needed, Conflicting answers, Incomplete, Prospect to provide and Please confirm, used by Review and The Manuscript, and copied in the advisor queue's `open_fields` count (`advisor_list_submissions`, migration `20261104118000_open_items.sql`, which replaces the paged queue of `20261104114000` and is numbered after it for that reason). A shared fixture and a sync test hold the two to the same answers. A field an advisor verified is left out of the list, as `fieldOpenItems` does.
- **Notes:** The browser derives it for the prospect; the server derives the queue's counts itself.

#### B-3.1 Timeouts, retries, and rate limits
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** B-1.1, F-0.2 · **Milestone:** M1
- **Built:** `model.ts` gives each chat attempt 20 seconds (a document read's attempt 30, `document-extract/ask.ts`) and retries once, after 1 second, on a 429, a 5xx or a network error; never on a timeout, a 402, another 4xx or a bad answer. Both functions call it, and a stalled provider is answered with a 504 `timeout`. Every failure carries an error code (US-2.4a, B-3.2). Quotas: per user 15 a minute and 300 a day, per address 20 a minute and 400 a day, and a global 2,000 a day that fails closed with a 503 `daily_cap`. They live in `_shared/ai/budget.ts` and both AI functions spend from them, so chat and document reads share the per-address and global counts (a refused document read goes back to 'ready to read' and never reaches the provider), and only a request that passed validation spends any (US-2.4a). The browser gives up on a chat answer after 45 seconds (`CHAT_TIMEOUT_MS`), longer than the function's worst case of two 20-second attempts and the pause. Tested in `model.test.ts`, `handler.test.ts` (a retry that succeeds, a persistent 429, a 500, a 402, a stalled provider), `budget.test.ts`, `allowance.test.ts`, `supabase/tests/ai_abuse_limits.sql` and `useLenoreChat.test.ts`. The limits are in `docs/AI_OPERATIONS.md` → "Limits and timeouts".
- **Notes:**
  - **Revised.** The per-user, per-address and global quotas replace the plan's 30 requests per session per 10 minutes (decided 2026-11-04). There is no per-intake limit; the per-user quota bounds an intake.
  - **Not built, by decision (2026-11-04):** no overall deadline on a call beyond its attempts, no `Retry-After` handling, and no exponential backoff (one retry, after a fixed second). The browser waits 45 seconds, not the plan's 30, because it must outlast two 20-second attempts.
- *Revised scope, AC and tests:*
  - **Scope:** A time limit on each provider attempt and one retry on the errors that can clear; per-user, per-address and global quotas in place of a per-session limit; a browser wait longer than the function's worst case.
  - **AC:**
    - A stalled provider is answered with `timeout`, and a chat with no answer after 45 seconds ends in the browser's timeout state.
    - A 429, a 5xx or a network error is retried once; a timeout, a 402 or another 4xx is not.
    - A caller over a quota, or any call past the daily ceiling, is refused before the provider is called, and a malformed request spends no quota.
  - **Tests:** Model and handler tests for each retry case and the stall, quota tests in SQL and in unit tests, and the browser timeout in the chat hook's test.

#### B-3.2 User-facing failure states
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** B-3.1 · **Milestone:** M1
- **Built:** The chat says why Lenore couldn't answer, in words chosen by the function's error code (US-2.4a, `CHAT_FAILURE_MESSAGES` in `src/data/aiFailure.ts`): a rate limit, the daily cap, a timeout, Lenore not set up or paid for (`unavailable`), the provider or the function not answering (`provider_error`, or no answer at all: now told apart from `unavailable` as `unreachable`), and any other failure. The prospect's message stays in the conversation, and the input is never disabled. 'Continue manually' is always offered, and opens Review with the keyboard on its heading, where every answer can be added (2026-11-04). 'Try again' is offered only when retrying could clear the failure (`retryCanClear`), so never for `daily_cap` or `unavailable`, whose words say instead that the prospect can keep filling in the workspace. A chat with no answer after 45 seconds shows the timeout's words, with Try again (B-3.1). The Upload tab says why the last read of a file didn't go through, and follows the same rule: after a daily cap or `unavailable` it offers no 'Read it' or 'Try again' until the page is reloaded, and its words for `unavailable` no longer promise a retry. Tested in `ChatFailureNotice.test.tsx` (each kind's words and buttons), `TranscriptPanel.test.tsx` (under each kind's notice, the message stays on screen and the input sends), `useLenoreChat.test.ts` (each code's kind, the request id, the timeout, retry and dismiss), `UploadTab.test.tsx` and `useSessionDocuments.test.ts`.
- **Notes:**
  - **Revised.** v1.0 offered 'Try again' on every failure. A daily cap, or a provider that isn't set up, can't be checked or can't be paid, doesn't clear by retrying, so the button is not shown for them (decided 2026-11-04). The function's own wording for `unavailable` ("Please try again in a few minutes", in the raw response) is not shown to prospects and is unchanged.
  - **Words for `unavailable`.** The chat's words changed although they promised no retry: US-2.4a's "Lenore can't be reached right now. Your message is saved." didn't tell the prospect they could carry on in the workspace, which is all that is left to them once Try again is gone. Those words now belong to `unreachable`, which keeps Try again.
  - **Per file in the Upload tab.** The rule applies to the file whose read was put off: its retry is hidden. Another file still offers 'Read it', a first read, which the function refuses the same way and the tab then says why. The hidden button comes back when the page is reloaded, so after the daily cap resets a reload is needed to read that file. Judged enough for now (2026-11-04).
  - The browser waits 45 seconds, not 30 (B-3.1). A document read has no browser timeout: one left processing shows as failed after 5 minutes (US-2.4a).

#### B-3.3 Operational logs with redaction
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-3.1 · **Milestone:** M1
- **Built:** `failureLogLine` and `unexpectedErrorLine` emit only fixed fields, built from codes and ids (request id, intake id as `session=`, provider, kind, status, attempts, latency), and both functions use them: the raw provider body is never logged, and a document reader's failure names the error's class only, since its message can quote the file (US-2.4a). Every signed-in call to either AI function also leaves one row in `ai_extraction_events` with its request id, intake id, outcome and error code, so a failure is found by intake (`docs/AI_OPERATIONS.md` → "Finding a failed extraction"); the table's checks refuse anything in `fields` or `refused_paths` that isn't a field name or a schema path. No log line or event holds prospect content: a message, a quote, a value or a provider's response. Before text is stored or sent to the model, `redactSensitive` (`supabase/functions/_shared/sensitive.ts`, shared by the browser and the functions) now also removes an SSN written with en or em dashes or with dots throughout (123–45–6789, 123.45.6789), an SSN glued to its label (ssn123456789, SSN_123-45-6789, SS123-45-6789; SSN#123-45-6789 was already caught), and a card number in groups, with spaces or hyphens (four groups of four, three of four and the rest up to 19 digits, and American Express's 4-6-5), when it starts as a card number does and passes the card's check digit (Luhn), also where it follows other groups of digits (1042 4111 1111 1111 1111, as a document's joined table cells read). An EIN (12-3456789), a phone number with separators, an amount (a rate sheet's 512.40 1124.80 included), a date and a row of years or plan years are left alone. Tested in `chamber-extract/handler.test.ts` and `document-extract/handler.test.ts` (a provider body and an error's message in neither the logs nor the response), `events.test.ts`, `supabase/tests/ai_extraction_events.sql` and `sensitive.test.ts`; every user of the redaction (the census reader, `document-extract`'s parser and header check, the chat, the sanitiser, provenance) still passes its tests.
- **Notes:**
  - **Revised.** The intake id is logged and recorded where v1.0 asked for a session id: an intake is the session. `chamber-extract` takes it as an optional `session_id`, so a tab running an older front end keeps working (US-2.4a).
  - A bare run of nine or more digits is still redacted whatever it is, an order number included (an over-redaction accepted 2026-11-04). So is a row of four-digit groups that starts like a card and happens to pass the check digit, about one such row in ten (a row of class codes, for instance; accepted 2026-11-04). A dot counts as an SSN's separator only when both are dots, so an amount next to another number stays.

#### US-2.1 to US-2.4: re-scoped (D17 to D33)

Four parent stories, delivered as nine child stories. Each child ships alone, migration first, in the order below (D32). They absorb what is left of B-1.1, B-1.3, B-1.4, B-2.2, B-3.1 and B-3.3, the workers' comp part of D-1.3, and A-2.1's notes on required fields and workers' comp. Terms are defined in `GLOSSARY.md`.

**Parents and their acceptance criteria** (as written by the product team):

- **US-2.1 Structured intake schema and extraction contract.** A documented schema covers company, locations, census, dependents, benefits, payroll, workers' comp and open items. Each field has a type, a validation rule and a required status. Extraction outputs are validated before being saved. Unknown, low-confidence or contradictory information is identified rather than overwritten. The Manuscript mapper consumes the same schema. *Children:* 2.1a, 2.1b, 2.1c.
- **US-2.2 Confidence and source tracking.** Extracted fields keep a field source. Fields carry a field status. Review clearly tells inferred answers from confirmed ones. The prospect's own edits beat AI answers. Inferred and conflicting fields appear as open items. *Children:* 2.1a (statuses), 2.2a.
- **US-2.3 Lenore's discovery prompts and fallback.** Lenore asks targeted questions about missing high-priority fields. She does not re-ask settled fields. Text stays fully usable without voice. A voice failure falls back clearly to text. A defined completion state (*ready to certify*) shows when there is enough for review. *Children:* 2.3a, 2.3b, 2.3c, 2.3d.
- **US-2.4 AI safety, error handling and observability.** AI failures show a friendly retry state. An invalid extraction never corrupts the intake. Logs capture failures and validation errors without unnecessary sensitive content. Failed extractions can be found by intake. Rate limits and timeouts are defined and tested. *Children:* 2.4a, plus the golden transcripts in 2.3a.

##### US-2.1a Intake schema v2: field metadata, the workers' comp block, and two new field statuses
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE + FE · **Depends:** none · **Milestone:** M1
- **Built:**
  - **Migrations.** `20261103120000_intake_schema_v2_workers_comp.sql` adds the four keys and two kinds to `chamber_data_field_kind` and `chamber_data_error`:
    - `experience_mod`: a JSON number from 0 to 10.
    - `dollars`: whole dollars from 0 to 100,000,000.
  - **Version move.** `20261103120100_intake_schema_v2_version.sql` moves every row to `schema_version` 2 with the table's triggers off, so it is not a save. It sets the default to 2 and refuses any other value.
  - **Schema module.** `supabase/functions/_shared/intakeSchema.ts` holds `INTAKE_SCHEMA_V2`, published as `docs/intake-schema.v2.json`:
    - Each property's `x-intake` gives its label, section, required flag and rank.
    - `INTAKE_FIELDS` lists the fields in rank order, and `REQUIRED_FIELDS` names the core four.
    - `FIELD_LABELS` now comes from the schema.
  - **Statuses.** `provenance.ts` adds `unknown` (open item "Prospect to provide") and `not_applicable` (closed, and never changed by an extraction or document candidate). The workspace and the Manuscript show both as badges in place of an answer.
  - **Client.** The sanitiser reads "$18,400" and "0.92", and the edit control takes a decimal mod.
  - **Docs.** `docs/intake-schema.md` has the field table by section, generated from the schema.
  - **Tests:**
    - SQL: 10 new rejection cases and the version move in `intake_lifecycle.sql`.
    - `intakeSchema.test.ts`: v2 is a superset of `docs/intake-schema.v1.json`, plus metadata and ranking checks.
    - `intakeSchemaDoc.test.ts`: the doc's field table matches the schema.
    - `schemaSync.test.ts`: now reads each `sync:` block from the latest migration that defines its function. Before, a block was keyed by name only, so replacing one function would have stopped the test from checking another function's `caps`.
    - Provenance and component tests for both statuses.
- **Notes:**
  - **Writers today.** Nothing writes `unknown` until 2.1b (the model) and nothing writes `not_applicable` until 2.2a (the "Doesn't apply" control). Only voice `<extract>` writes the workers' comp fields until 2.1b, and they have no workspace home until 2.2a.
  - **Advisor queue.** Its open-field count still counts only inferred, incomplete and conflicting fields. 2.2a brings it in line with the open items.
  - **Census tier (2026-11-04).** `REQUIRED_FIELDS` now names three; the census ranks first among the recommended fields (D25 as amended), as `src/data/readiness.ts` has it.
  - **Deploy order:** the two migrations, then the front end. A tab still running the old bundle reads a row holding workers' comp answers without them, and its next save drops them, so prospects with an intake open should reload after the deploy (as in A-2.2).
- **Scope:**
  - Intake schema v2 is v1 plus four workers' comp fields (D18):
    - `wc_carrier`: text.
    - `wc_renewal_date`: free text, like the other dates.
    - `wc_experience_mod`: a number from 0 to 10.
    - `wc_annual_premium`: whole dollars from 0 to 100,000,000.
  - Each top-level field carries its label, section, whether it is required, and its rank in the published schema (D17, D25):
    - Sections: company, locations, census, benefits, payroll, workers' comp and operations. Dependents sit inside each employee in the census.
    - The required fields rank first.
  - Migration first: the database accepts the four keys and their two new kinds, and every intake records schema version 2.
  - Field statuses gain `unknown` and `not_applicable` (D23), with labels and badges. Neither stores an answer. `unknown` is an open item ("Prospect to provide"), and `not_applicable` closes one.
  - `docs/intake-schema.md` lists every field by section with its kind, rule, required flag and rank.
- **AC:**
  - `docs/intake-schema.v2.json` gives every field a type, a rule, a label, a section, a required flag and a rank. Every required field ranks before every recommended field.
  - v2 only adds to v1: every v1 property and definition is unchanged.
  - The database accepts each workers' comp answer within its rule. It refuses one outside its rule with `EA001` and the field's path. Every intake records schema version 2.
  - A stored `unknown` or `not_applicable` survives a reload. `unknown` is listed as an open item, and `not_applicable` is not.
  - An extracted answer replaces `unknown`. No extraction or document candidate changes a field the prospect marked `not_applicable`.
- **Tests:**
  - SQL: rejection cases for each new kind and the version check.
  - The sync test: covers the new kinds and caps, reading each `sync:` block from the latest migration that defines its function.
  - Schema tests: metadata, ranking, and v2 being a superset of v1.
  - Provenance tests: both new statuses.
  - A test that holds the field table in `docs/intake-schema.md` to the schema.

##### US-2.4a Extraction events, intake id, error codes and a browser timeout
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE + FE · **Depends:** none · **Milestone:** M1
- **Built:**
  - **Events table.** Migration `20261103120200_ai_extraction_events.sql` adds `ai_extraction_events`:
    - Checks refuse anything in `fields` and `refused_paths` that isn't a field name or a schema path, so no prospect words can be stored.
    - Advisors read events, and clients can't write them.
    - `prune_ai_extraction_events()` runs daily under pg_cron, with 90-day retention.
  - **Shared modules.** `_shared/ai/errors.ts` holds the codes, `_shared/ai/events.ts` the recorder, and each function's `PROMPT_VERSION` has a fingerprint test.
  - **`chamber-extract`:**
    - It checks the request before any quota is spent.
    - It takes an optional `session_id` and refuses an intake that isn't the caller's, even for an advisor.
    - An answer without the tool call is `invalid_response`.
  - **`document-extract`.** Moved into a testable `handler.ts`, with the same codes and events. Its logs name an error's class only.
  - **Browser.**
    - The chat sends the intake id and gives up after 45 seconds. Each code gets its own message.
    - The Upload tab says why the last read didn't go through.
  - **Runbook.** `docs/AI_OPERATIONS.md` lists the codes, limits, event columns, queries and log lines.
  - **Tests:**
    - Handler tests per code for both functions.
    - SQL tests: `ai_extraction_events.sql` (content checks, access, cascade, pruning), plus per-user quota cases in `ai_abuse_limits.sql`.
    - Chat hook tests for each code and the timeout.
    - The e2e chat writes a real event.
- **Notes:**
  - **Codes.** `provider_unavailable` from the scope above became two codes: `unavailable` (not set up, budget unreadable, provider can't pay) and `provider_error`. The prospect saw the same words for both until B-3.2 told them apart (2026-11-04): `unavailable`, like `daily_cap`, no longer offers Try again, since retrying can't clear it.
  - **Optional intake id.** `session_id` is optional for now, so a tab running the previous front end keeps working. Make it required once old bundles are gone.
  - **Document reads have no browser timeout.** A read can take two 30-second attempts. A read left `processing` still shows as failed after 5 minutes, as before.
  - **Reading events.** Events are read in SQL only; the advisor screens don't show them yet.
  - **Deploy order:** the migration, then both functions, then the front end. A function deployed before the migration logs `AI_EVENT_NOT_RECORDED` and otherwise works.
- **Scope:**
  - An extraction events table (D20).
  - Both AI functions receive the intake id and check the caller owns the intake. Each call writes one event:
    - the request id, the function and the outcome;
    - the error kind and the refused field paths;
    - the prompt and contract version, the provider, the model and the latency.
  - Events hold no prospect words. Advisors can read them, and they are pruned after 90 days.
  - Error responses carry a code: `rate_limited`, `daily_cap`, `provider_unavailable`, `timeout`, `invalid_response` or `bad_request`. The request id is returned to the browser.
  - The browser shows a different message for each code, gives up after 45 seconds, and treats a model reply with no tool call as `invalid_response`.
  - Quota is spent only after a request passes validation.
  - `document-extract` logs only the error class, and records why a read failed.
- **AC:**
  - Every call to either AI function leaves one event, findable by intake id or request id, with no prospect words in it.
  - A daily cap, a rate limit, a provider outage and a timeout each show a different message, with Try again.
  - A request with no answer after 45 seconds ends in the retry state.
  - A malformed or oversized request spends no quota.
- **Tests:**
  - Handler tests for each code, for both functions.
  - SQL tests: event access, pruning, and the per-user quota (untested today).
  - Browser tests: each message and the timeout.

##### US-2.1b The extraction contract and Lenore's context
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** 2.1a, 2.4a · **Milestone:** M1
- **Built (2026-11-04):**
  - **Contract.** `chamber-extract/schema.ts` takes its field list and types from intake schema v2: every top-level field but the census, each with a one-line guide (`FIELD_GUIDE`). Prompt version 2, recorded on each event (fingerprinted in `promptVersion.test.ts`); 3 since it was merged with B-1.1's definitions and caps.
  - **Statuses.** The model may say `confirmed`, `inferred`, `incomplete`, or `unknown` (with evidence, no value) when the prospect doesn't know; never `conflicting` or `not_applicable`. `shapeExtraction` keeps `unknown` only for a known field with no value and no refused value. The browser marks such a field `unknown` while it has no answer (`applyExtraction`'s `unknown`), never over the prospect's own edit or "Doesn't apply".
  - **Context (D22).** The chat sends the answers (census left out), each field's status and the last 10 messages (`_shared/chatContext.ts`, cut to fit 20,000 characters). The function checks their shape and size before any quota is spent, redacts the messages again, works out the unsettled fields by rank (`_shared/followUp.ts`, the one rule for D26) and names the first eight in the prompt.
  - **Tests:** a contract test per field (each kind accepted with its status and evidence), the census refused, `unknown` kept and refused, context validation cases (each a `bad_request` with no quota spent), the prompt's parts, redaction, `followUp.test.ts`, `chatContext.test.ts`, the browser's `unknown` handling and the chat body.
- **Notes:** A one-word answer is placed by the model from the recent conversation; the golden transcripts that hold that and the follow-up order to a stubbed model are 2.3a. The prompt still asks Lenore only to "ask a follow-up question"; asking about the first unsettled field, announcing readiness and wrapping up are 2.3a. Voice still goes through `<extract>` (2.3b).
- **Scope:**
  - `chamber-extract` extracts every top-level field of schema v2 except the census. Each answer has a field status (`confirmed`, `inferred`, `incomplete` or `unknown`; never `conflicting` or `not_applicable`, D31) and an evidence quote. Each answer is checked against schema v2, and refused paths go into the event.
  - Each call carries (D22):
    - the captured answers and their field statuses;
    - the unsettled fields by rank;
    - the last ~10 transcript messages, redacted, inside the 20,000-character cap.
    The function checks the shape and size of all of it.
  - The prompt and tool schema carry a version, recorded on each event.
- **AC:**
  - Any top-level field except the census can be answered in chat. It is captured with its field status and evidence quote.
  - A one-word answer ("Yes") to Lenore's yes-or-no question is captured against the field she asked about.
  - An answer that breaks schema v2 is not applied, and its path is in the event.
  - "I don't know" about a field records it as `unknown`, with no answer.
- **Tests:** contract tests per kind, context-size tests, and the golden transcripts shared with 2.3a.

##### US-2.3a Follow-up policy, ready to certify, wrap-up and golden transcripts
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE + PM · **Depends:** 2.1b · **Milestone:** M1
- **Built (2026-11-04):**
  - **One rule (D26, D27).** `supabase/functions/_shared/followUp.ts`: `unsettledFields` (by rank) and `readyToCertify`, used by `chamber-extract` and, through `src/data/followUp.ts`, by the Chamber. Ready means the three answers certification requires (D2) each hold an answer that isn't in conflict or incomplete; inferred counts, states count from the census's work states, and "unknown" or "doesn't apply" can't stand in for a required answer (certification needs it). That is stricter than D26's wording, which would count "unknown" as settled; certification would then refuse an intake Lenore called ready. `readiness.test.ts` holds the required list to `REQUIRED_ITEMS`.
  - **The prompt (version 4, on the user turn `chamber-extract/prompt.ts` builds for the function and the eval).** It names the first eight unsettled fields, whether the intake is ready, and whether a census is uploaded (a count, never rows). Lenore asks about one field at a time, the first the message didn't answer, never a settled one; accepts "don't know" and moves on; invites a census upload once the required answers are in; wraps up when nothing is left; and never claims readiness herself.
  - **No canned reply.** When the model gives no reply, the function asks the next unsettled field's question (`FIELD_QUESTION`), or wraps up. "Could you tell me more about your team?" is gone; the browser's fallback for an older function is a plain acknowledgement.
  - **Ready, once (D29).** When the intake first becomes ready in a visit, after Lenore's own answer, the Chamber adds her fixed `READY_MESSAGE`, recognised by its words so it is said once per intake and nothing new is stored. An intake that was ready when it opened gets no announcement. The header shows "Ready for your review" while it is ready and uncertified.
  - **Golden transcripts.** `supabase/functions/chamber-extract/golden.test.ts`: ten conversations through the real request building, the real `chamber-extract` handler with the model stubbed, and the real merge: the required order and one announcement, a one-word yes, a conflict that blocks until chosen, a correction, "don't know", an incomplete answer, the fallback question, a refused answer, census work states and the wrap-up. Every turn checks that the prompt names no settled field and keeps rank order (a mutation that names settled fields fails them).
- **Notes:** The census template Lenore would point to is 2.3d. Voice doesn't get the context yet (2.3b). The golden transcripts hold our side to the contract; how a real model follows the prompt is checked only by a live exchange, which hasn't been done.
  - **Decisions carried over from B-1.3** (product owner, 2026-11-04; B-1.3 is superseded by this story):
    - One item per turn: the missing required items first, then a request to confirm an inferred or incomplete value. A plain "yes" to a confirmation comes back as `confirmed`.
    - A required field whose answers conflict: Lenore says the answers disagree and points to the Review tab's 'Use this'. She does not resolve it in chat.
    - The census: only once the required items are settled, Lenore recommends uploading one (the Upload tab, or Your Team). She never lists employees in chat.
    - When the required items are settled, she says so once and keeps discovering.
    - Completion is derived when it is read; no status is stored (D27).
    - Settled means confirmed by anyone, verified by an advisor, `not_applicable` on a present value, or a value with no provenance (B-2.2's rule, `requiredItems`).
    - Verification: deterministic prompt tests with a stubbed model, plus one manual check in preview. The live extraction eval (`scripts/extraction-eval`, B-1.4) must be run on the new prompt.
- **Scope:**
  - One shared function returns two things from the answers and field statuses (D26, D27): the unsettled fields by rank, and whether the intake is ready to certify.
  - The prompt names the next few unsettled fields, and Lenore asks about one at a time.
  - When the intake first becomes ready to certify, she says so once and points to Review. She then carries on with recommended fields, and wraps up when none are left (D29).
  - For the census she points to the upload and the template (2.3d).
  - The Chamber shows "Ready for your review" while the intake is ready to certify.
  - About ten golden transcripts run in CI against a stubbed model.
- **AC:**
  - The prompt never names a settled field, and names unsettled fields in rank order.
  - An intake is ready to certify exactly when every required field is settled. A conflicting required field keeps it not ready.
  - Lenore announces readiness once per intake.
  - The canned "Could you tell me more about your team?" reply is gone.
- **Tests:** unit tests for the shared function, and golden transcripts covering the field order, a conflict, unknown answers and the wrap-up.

##### US-2.2a Review lists every field, "Doesn't apply", and one open-items list
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** FE + BE · **Depends:** 2.1a · **Milestone:** M1
- **Built (2026-11-04):**
  - **Every field.** Review lists every answer of the intake schema, each its own row with its badge and Confirm/Edit, in seven sections (Company, Workforce, Locations, Payroll, Benefits, Workers' comp, Operations & HR; `REVIEW_FIELDS`, which a test holds to the schema). Each section says how many of its answers are settled ("3 of 5 settled", or "Complete"). The census keeps its table in Workforce, and the Census tab shows its status, source and Confirm.
  - **Doesn't apply (D31).** An unanswered field that certification doesn't need can be marked "Doesn't apply" (`applyFieldAction` `not_applicable`), which closes it, and "Undo" (`reopen`) takes it back. No extraction or document changes it (2.1a).
  - **One list.** `src/data/openItems.ts`: a required answer with none ("Not provided", or "Prospect to provide" when they don't know), the census ("Document needed"), then fields by status (conflicting, incomplete, unknown, inferred). Review shows them under "Still needed", "Recommended" and "Needs your review"; The Manuscript lists them as "Company legal name — not provided"; the advisor queue counts them (migration `20261104103000_open_items.sql`: `open_fields` now counts unknown answers, and a required answer the prospect doesn't know once, not twice). The queue reads "N open items".
  - **Held together.** `supabase/tests/fixtures/open_items.json` holds five intakes with what the queue must show; `src/data/openItems.test.ts` and `supabase/tests/open_items.sql` both read it. `schemaSync.test.ts` holds the queue's statuses and labels to `OPEN_ITEM_STATUSES` and the readiness items.
  - **Found on the way:** `is_reviewable_field` never got the four workers' comp answers (2.1a), so advisors couldn't mark them reviewed. The same migration adds them, and a sync test holds the list to the schema.
- **Notes:** The queue still leaves out a field an advisor marked verified; that is the advisor's own view, and the only way it differs from Review. Deploy the migration before or after the front end.
- **Scope:**
  - Review lists every field by section, each with its badge and Confirm/Edit (D28).
  - "Doesn't apply" marks a field `not_applicable` as a prospect action, and can be undone (D31).
  - Open items, as the glossary defines them, are computed by one function, used by Review, the Manuscript and the advisor queue. The advisor queue's SQL copy is held to it by a sync test.
  - The Census tab shows the census's field status and source.
- **AC:**
  - Every schema field appears in Review with its badge.
  - Review, the Manuscript and the advisor queue list the same open items for the same intake.
  - "Doesn't apply" removes the open item, and no extraction undoes it.
  - A recommended field with no answer is not an open item.
- **Tests:** component tests, open-items unit tests, and the advisor-queue sync test.

##### US-2.3b Voice answers through `chamber-extract`, with live context
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** High · **Owner:** FE + BE · **Depends:** 2.1b, 2.3a · **Milestone:** M2
- **Scope:**
  - Each finished prospect utterance in a call goes to `chamber-extract`, marked as spoken (ADR 0001, D19). Agent `<extract>` tags are stripped and ignored, and the direct merge with no transcript message is removed.
  - A spoken answer is stored as `inferred` at most (D33).
  - After each extraction the agent receives the next unsettled fields and the settled ones, by label only (D24).
  - The agent's prompt lives in the repo with a version.
- **AC:**
  - A voice answer is checked against schema v2 and records the utterance it came from.
  - No spoken answer is stored as `confirmed` until the prospect confirms it.
  - An `<extract>` tag in an agent reply changes nothing.
  - The agent is told the next fields after every extraction.
- **Tests:** hook tests with a fake conversation, and a merge test for the spoken cap.

##### US-2.3c Voice failure states and the mobile transcript
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** none · **Milestone:** M1
- **Scope:**
  - "Speak with Lenore" is hidden when voice isn't configured, so no setup instructions reach prospects.
  - Connecting times out after 15 seconds.
  - A denied microphone, a failed connection and a dropped call each get their own message, with "Continue in text", which focuses the text input.
  - A second click while connecting starts nothing.
  - On a phone, the full transcript is readable.
- **AC:**
  - Every voice failure shows a message and leaves text usable, and nothing spins longer than 15 seconds.
  - Prospects never see setup instructions.
  - On a phone, every Lenore reply can be read in full.
- **Tests:** hook tests for each failure and the timeout, and a component test for the mobile transcript.

##### US-2.1c Manuscript coverage
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** 2.1a · **Milestone:** M1
- **Scope:**
  - A workers' comp section with the four fields and the census class codes.
  - An "Operations & HR" section with the 13 fields not mapped today (D30).
  - Census rows keep their class code and ZIP.
  - The page and the PDF show the same sections.
- **AC:**
  - Every schema field appears in the Manuscript, or is listed as deliberately excluded with a reason.
  - The workers' comp section shows the four fields and the class codes.
- **Tests:** mapper tests, a coverage test that fails on an unmapped field, and a PDF test.

##### US-2.3d Census template
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Medium · **Owner:** FE + PM · **Depends:** none · **Milestone:** M1
- **Scope:**
  - The Upload tab offers a CSV template (D21). It has one row per employee and the columns `document-extract` reads:
    - first and last name, date of birth, work state and ZIP;
    - job title, annual salary, compensation type and employment type;
    - classification, coverage tier and class code.
  - It has no SSN or bank columns. Lenore points to it (with 2.3a).
- **AC:** a filled-in template uploads and reads with every column matched and no skipped-column notes.
- **Tests:** a `parse.ts` test reads the template's header with every column matched.

---

### Epic C: Review, Certification, and Submission

*As built:* Certification and submission are a database trigger on `chamber_sessions` plus a client update, not endpoints. The signed snapshot is real and enforced by the database. Missing: a readiness gate, a material-field list, a server-assigned unique reference, and idempotent submit.

#### C-1.1 Read-only review by Manuscript section
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.3 · **Milestone:** M1
- **Built:** The Review tab (tab 7 of the workspace) shows the live session only. There is no `/review` route: owner RLS replaces the token. Since US-1.2 (2026-11-03) it shows every answer the Manuscript draws on in five sections (Company, Workforce, Locations, Payroll, Benefits) plus the census table, its dependents and the census state mix, and the open items: required answers still needed (with a link to each), the recommended census, fields still inferred, incomplete or conflicting, and the eligibility checks. Tested in `ReviewTab.test.tsx` and `e2e/review-readiness.spec.ts`.
- **Remaining:** No per-section status chip (Complete, Needs confirmation, Incomplete, Not applicable). No workers' comp section, because there are no workers' comp fields yet.
- **Notes:** B-2.2 adds a required answer in conflict to 'Still needed' (it blocks certification too), puts required answers given but not yet settled at the head of 'Needs your review', and leaves out any field an advisor verified.

#### C-1.2 Inline editing that writes to the canonical record
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** C-1.1, A-2.2 · **Milestone:** M1
- **Built:** Company, Payroll and Benefits edits go through `ProvenanceField` and `applyFieldAction` (source `prospect_edit`). Invalid input is refused. Autosave writes through supabase-js.
- **Remaining:** The edit is local and optimistic: the prospect does not see it after server confirmation, and the save status (A-1.4) reports the server's answer, not the field. Census and dependents are read-only (a corrected file replaces them, through the conflict dialog). Since US-1.2 every scalar answer is editable in the Review tab too, and `e2e/review-readiness.spec.ts` adds answers there and checks the database and the other tabs.

#### C-1.3 Readiness gate with jump links
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** C-1.1, B-2.2, D2 · **Milestone:** M1
- **Built (2026-11-03, US-1.2):** The required answers (D2) are marked "Required" wherever they appear. The Review step lists the missing ones, each with a hint and a link that brings its field into view with the Add button focused. The Reckoning lists them with "Go to Review", and `certificationBlockers` puts them first, so Generate stays disabled until they're given. The database refuses a certification from the browser without them (migration `20261103110000_certification_readiness.sql`, `EA003`, the missing keys in DETAIL), and the client turns that refusal into the same advice. Tested in unit tests, `supabase/tests/certification_readiness.sql` and `e2e/review-readiness.spec.ts`.
- **Notes:** There is no 'Not applicable' status: optional answers never block, so there is nothing to mark. The AC's "Continue" is the Reckoning's Generate button; moving on to PEO Match stays open. B-2.2 moves the gate's presence test onto `public.intake_answers_present` (migration `20261104103000`), the rule `intake_required_items` reads too, so the gate now trims as the browser does and reads a state only when it is a code.
- **Conflicts (2026-11-04, B-2 / D26):** a required answer in conflict blocks too. Review lists it under "Still needed" with a link to its candidates, the Reckoning lists it and keeps Generate disabled, and the database refuses the certification (migration `20261104100000_certification_conflicts.sql`, `EA008`, the keys in DETAIL), which the client turns into the same advice. Both screens take what blocks from one rule, `certificationBlockingItems` (`src/data/requiredItems.ts`): an advisor's verification doesn't lift a conflict, since the database reads the field statuses, not the reviews; States of operation that only a census in conflict gives blocks too, in the browser only (B-2.2), until an advisor verifies the census. Tested in unit tests, `supabase/tests/certification_conflicts.sql` and `e2e/review-readiness.spec.ts`. Incomplete required answers still don't block (D26 says they should; not yet decided for certification).
- *Scope, AC and tests (from v1.0):*
  - **Scope:** List missing required fields, each linked to the section that needs it. "Continue to certification" is enabled only when every required field is confirmed or validly marked not applicable. The reason for "not applicable" is stored.
  - **AC:**
    - Leaving a required field blank disables "Continue".
    - Marking an optional field not applicable does not block.
    - Each missing item links to the correct section.
  - **Tests:** Leave payroll blank and confirm the block. Mark a permitted field not applicable and confirm it unblocks.

#### C-2.1 Certification record and endpoint
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** C-1.3, A-1.2 · **Milestone:** M1
- **Built:** `chamber_certifications` (migration `20261020210000`). An `AFTER` trigger writes it in the same transaction as the status update, refuses a missing or stale certification, and API roles are select-only. The client does a direct update. There is no `certify` endpoint.
- **Remaining:** Readiness is not checked in the database. The row stores `data_sha256`, not a `data_version`, and no user-agent hash. Failures raise SQLSTATE 23514, not a 422 or 409 the client can map. Rows are not immutable: the table's own trigger sets `superseded_*`, the service role can modify rows, and the foreign key cascades deletes. `certification.sql` runs as a superuser, so role denial is untested.
- *Revised scope, AC and tests:*
  - **Scope:** Keep the trigger design. Add the readiness check to the certification trigger (every required field confirmed, or `not_applicable` with a reason, once C-1.3 and D2 land). Store `data_version` beside `data_sha256` and a truncated user-agent hash. Make `chamber_certifications` immutable apart from the supersede columns and the retention job.
  - **AC:**
    - Certifying with readiness failing is refused by the database with an error the client maps to 'finish these items'.
    - Certifying a stale version is refused (already true).
    - No role can update or delete a row except the supersede trigger and the retention job.
    - `certification.sql` runs the denial cases under a non-superuser role.
  - **Tests:** Readiness-failing certify, stale-version certify, and a direct update and delete attempt as `authenticated` and `service_role`.

#### C-2.2 Certification screen
- **Status:** **DONE** · **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** C-2.1, D3 · **Milestone:** M1
- **Built:** The button stays disabled until the three acknowledgements, name, role and a separate 'sign' click are done. A failure shows an error and no success. The DRAFT marker shows. Tested.
- **Notes:** More than the plan asked: three checkboxes and a separate sign click.

#### C-2.3 Re-certification after material changes
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** C-2.1 · **Milestone:** M1
- **Built:** Any `chamber_data` change sets the status back to `in_progress` and supersedes the certification (trigger). The client mirrors it, and the Manuscript shows a 'recertify' state. Choosing a different PEO also forces re-certification (client-side).
- **Remaining:** No material-field list: non-material edits (for example `key_challenges`) also withdraw certification, where the plan wants a contact phone change to keep it. Provenance and transcript saves do not. The Manuscript is blocked with 'recertify' rather than showing 'Certification stale'. The status goes to `in_progress`, not `ready_for_review`. The PEO rule is client-only.

#### C-2.4 One consent definition, marked DRAFT everywhere it appears
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** D3, C-2.2 · **Milestone:** M1
- *Revised scope, AC and tests:*
  - **Scope:** `certification.ts` (`CONSENT_TEXT_VERSION = "2026-10-draft-1"`, `CONSENT_IS_DRAFT = true`) and the unused `certificationConsent()` in `manuscript.ts` (`2026-10-v1`, no draft flag, a different signing statement) disagree. Keep one definition. The Manuscript page and PDF print the signed consent with no DRAFT marker: show it wherever the signed text appears until D3 closes.
  - **AC:**
    - One exported consent definition and one version constant.
    - The Manuscript page and PDF mark the text DRAFT while `CONSENT_IS_DRAFT` is true.
    - Submissions certified under `LEGACY_CONSENT_TEXT` still render.
  - **Tests:** Render a submission under each version and confirm the text and the DRAFT marker.

#### C-3.1 Submit with idempotency and a human-readable reference
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** C-2.2, C-2.3 · **Milestone:** M1
- **Built:** Submit is one update. The database refuses a missing or stale certification and refuses guests. The status changes atomically with the commit. The notification emails dedupe on (kind, session, data hash).
- **Remaining:** The reference (the File ID) is `EAA-<year the intake started, UTC>-<8 hex of the session id>`, made in the browser: not `EAA-YYYY-NNNN`, not unique-constrained, not server-assigned (D15). No idempotency key: submitting again adds another certification row. No double-submit test.
- *Revised scope, AC and tests:*
  - **Scope:** Assign the reference in the database (a per-year sequence) when the certification is recorded, and make a repeat submit of unchanged data return the existing certification and reference.
  - **AC:**
    - Two submits of the same data produce one certification and one reference.
    - The reference matches `EAA-YYYY-NNNN` and is unique.
    - A submit without a current certification is refused (already true).
  - **Tests:** Double-submit, submit without certification, and submit after an edit that invalidated certification.

#### C-3.2 Immutable submission snapshot
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** C-3.1 · **Milestone:** M1
- **Built:** The snapshot is `submission.chamber_data` plus `field_provenance` inside `chamber_sessions`. The database forces it to equal the saved data at certification and stamps `data_sha256`. Later edits leave it untouched and the Manuscript renders it (tested).
- **Remaining:** No separate `intake_submissions` table, schema version, transcript hash or link to the certification id. The owner can overwrite the snapshot by re-certifying, and no history of the old one is kept. Advisor versions live separately in `manuscript_versions`. Decide whether the supersession history in `chamber_certifications` is enough (then amend the AC) or add an immutable submissions table.

#### C-3.3 Confirmation screen
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** C-3.1 · **Milestone:** M1
- **Built:** The confirmation overlay appears only after the server call returns true and shows the File ID and next steps. Tested.
- **Remaining:** No company name on the confirmation. A failure is a transient toast with no dedicated retry control (the same button can be clicked again).

---

### Epic D: Connect Real Intake Data to The Manuscript

*As built:* The Manuscript renders real, signed data as a vector-text PDF and the demo is separated. The mapper is incomplete (payroll, workers' comp, documents), and the filename, masking, header and reference details differ from the ACs.

#### D-1.1 Mapper: company, workforce, locations, state mix
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.1 · **Milestone:** M1
- **Built:** `buildManuscript(data, opts)` with `orNotProvided`, and tests that include 'Not provided' cases.
- **Remaining:** Not pure unless `date` or `submission` is supplied (`new Date()` inside), and there is no determinism test. The mapper returns the raw date of birth (masking is in the renderers). No EIN field exists (only `fein_count`), so EIN masking is moot until an EIN is collected (D2). No separate locations section.

#### D-1.2 Mapper: census, dependents, benefits, payroll
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** D-1.1 · **Milestone:** M1
- **Built:** Census, dependent tiers and benefits are mapped. Zero counts render as `0`. Since US-1.4 (2026-11-03) payroll is its own section (vendor, frequency, funding lead time, accrual method, PTO types, timekeeping, shift differentials, HRIS) on the page and in the PDF. Nothing is made up: a census default (W-2, full time, pay at full-time hours) is recorded per row in `assumed` and shown as "Not provided" or "est." with an open item; a person with no tier or named dependents is "Not provided", not "Employee Only"; the dependent total counts only the dependents known of. Tested in `manuscript.test.ts`, `manuscriptPdf.test.ts` and `ManuscriptPage.test.tsx`.
- **Remaining:** No census by state and coverage level. The full employee list (name, date of birth, salary) appears in the Manuscript body, where the plan says to keep it out unless underwriting needs it (D2).

#### D-1.3 Mapper: workers' comp, documents, resolved and open items
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** D-1.1, B-2.2 · **Milestone:** M1
- **Built:** Open items and the provenance cases are mapped and tested.
- **Remaining:** No workers' comp section (only a 'not yet verified' eligibility check). Documents are not in the `Manuscript` type. `resolved` lists passing eligibility checks rather than confirmed values. Open items are computed in the browser, not server-derived.

#### D-1.4 Mapper unit tests
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** D-1.1, D-1.2, D-1.3 · **Milestone:** M1
- **Built:** `manuscript.test.ts` (256 lines) runs under `npm test`.
- **Remaining:** No determinism test. Fabrication is guarded only by a 'not Meridian' assertion and 'Not provided' checks.

#### D-1.5 Remove sample data from the live path
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** FS · **Depends:** D-1.1, C-3.2 · **Milestone:** M1
- **Built:** `/manuscript/demo` is the only sample route and is labelled. The live route never shows the sample (tested). The Reckoning uses the session's company name.
- **Remaining:** 'Meridian Creative Group' remains in non-test source: `chamberTypes.ts` (demo data, not a dedicated fixture file) and `AuthPage.tsx` (a placeholder). No CI grep. The Reckoning button links `/manuscript?session=<session id>`, not the reference. The demo is linked from the landing navbar, where the AC says it must not be linked from the live flow.

#### D-2.1 Manuscript route by submission reference
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** C-3.2, D-1.1 · **Milestone:** M1
- **Built:** `/manuscript?session=<id>` with the Supabase JWT and an owner-RLS select. It renders the signed snapshot, not live data (tested).
- **Remaining:** Intent met: another user's or a missing id gets one generic message, and later edits do not change the page. No reference route and no `#t=` token: viewing requires sign-in. The session UUID in the query string is not a credential (D14).

#### D-2.2 Safe error states
- **Status:** **SUPERSEDED** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** D-2.1 · **Milestone:** M1
- **Built:** Static messages, each with a next action, for no session, unsigned, recertify and not-found or sign-in.
- **Remaining:** Intent met. No expired or revoked state (no tokens). The tests do not assert that no company data appears on an error page: add that.

#### D-3.1 Print layout: pagination, headers, footers, tables
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** D-2.1, D12 · **Milestone:** M1
- **Built:** jsPDF vector text (selectable). `html2canvas` is never imported. Repeating table headers, page numbers, keep-with-next on section headings, letter format. Tested.
- **Remaining:** The header lacks the company name (it is in the footer) and the footer lacks the data version. Sub-headings can orphan. Non-Latin text prints as '?'. No long-name or multi-state fixtures and no visual check. Remove the unused `html2canvas` dependency from `package.json`.

#### D-3.2 File name, metadata, and masking default
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** D-3.1 · **Milestone:** M1
- **Built:** PDF properties are set (title, subject, author, creator). The date of birth is masked by default (tested).
- **Remaining:** The filename is `The_Manuscript_<id>_<slug>.pdf`, not `EAA_<ref>_<slug>_<YYYYMMDD>.pdf`. The creation date is not set explicitly. EIN and bank data are not collected, so nothing is masked. A reveal toggle exists in the prospect view, where the AC says there must be none, and it is tested.

#### D-3.3 Cross-browser and mobile download verification
- **Status:** **NOT VERIFIABLE** · **Size:** S · **Priority:** High · **Owner:** QA · **Depends:** D-3.1 · **Milestone:** M1
- **Built:** Only jsdom tests of `downloadBlob` exist. There is no `docs/QA_MATRIX.md`.
- **Remaining:** The whole manual browser matrix.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Verify download and print preview on current Chrome and Edge (desktop), Safari (macOS and iOS), and Chrome on Android. Record results in `docs/QA_MATRIX.md`.
  - **AC:**
    - Each browser in the matrix downloads a readable PDF.
    - Any failure is logged as a defect with a link.
  - **Tests:** Manual matrix run, results recorded.

---

### Epic E: Handle Documents Safely

*As built:* Documents are built end to end, with extraction and candidate review. Gaps are server-side upload enforcement, purge, and scanning.

#### E-1.1 Session-linked upload API and private storage
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** A-1.2 · **Milestone:** M1
- **Built:** The existing `documents` table was extended (session id with cascade, `mime_type`, `size_bytes`, `category`). The bucket is private. RLS requires owning both the row and the intake. The client uploads to storage, inserts the row, and removes the object if the insert fails (tested).
- **Remaining:** Intent met through owner RLS: no tokens and no `upload` action. Cleanup is client-side and best-effort: a tab closed between the two steps leaves an orphan and nothing sweeps them. `mime_type` is browser-declared. An orphan sweep belongs with H-1.2.

#### E-1.2 Upload list, refresh, and removal in the UI
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** E-1.1, A-1.3 · **Milestone:** M1
- **Built:** The list loads by session. Remove deletes the stored file, then the row. Storage answers success with an empty list when it deleted nothing (including when its policies refused), so an empty answer is checked with `exists()`: a file still there keeps the row, a file already gone lets the row go. A row that can't be deleted stays listed, and the next try finds its file gone and finishes. Nothing is put back, so an expired intake (which refuses new rows) can't leave a stored file with no row. Tested in `useSessionDocuments.test.ts`.
- **Notes:** Progress is a spinner, not a percentage.

#### E-1.3 Document access isolation
- **Status:** **SUPERSEDED** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** E-1.1 · **Milestone:** M1
- **Built:** No tokens. The storage select policy needs the folder to equal `auth.uid()` and an owned intake. Only advisors get signed URLs (`SIGNED_URL_SECONDS = 60`). Prospects have no download UI. Cross-user reads are denied in `session_documents.sql`. A new row's `storage_path` must be `{user_id}/{session_id}/{file}` (migration `20261103110001`), so a prospect can't add a row that points at another user's file for an advisor to open; also in `session_documents.sql`.
- **Remaining:** The URL lifetime is 60 seconds, not 5 minutes (shorter is stricter: amend the AC). No test covers signed-URL issuance or expiry, only row visibility.

#### E-2.1 Document categories and guidance
- **Status:** **DONE** · **Size:** S · **Priority:** Medium · **Owner:** DES + FE · **Depends:** E-1.1 · **Milestone:** M2
- **Built:** Seven categories with guidance and an example (`documentCategories.ts`), a category select in the upload list, and copy that says 'None of these are required'.
- **Notes:** No component test for changing a category (SQL only).

#### E-2.2 Completeness checklist in review
- **Status:** **DONE** · **Size:** S · **Priority:** Medium · **Owner:** FE · **Depends:** E-2.1, C-1.1 · **Milestone:** M2
- **Built:** Review lists submitted categories against 'Still helpful' ones and does not block. Tests cover zero, some and all.

#### E-3.1 Text extraction for CSV, XLSX, and text PDF
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** E-1.1, B-1.1 · **Milestone:** M2
- **Built:** `document-extract` reads CSV, XLSX/XLS and text PDF (10 MiB, 50 pages). Locations read 'Sheet..., rows' or 'Page N'. A PDF with under 200 characters of text returns `unreadable`. The document id is carried into provenance on apply.
- **Notes:** `.docx` files are now read (tables as census candidates, paragraphs by the model); old `.doc` files are saved but not read. Census sheets are mapped to the canonical `chamber_data.census` row by scored header matching (`parse.ts`, tested), and rows never go to the model; free text does, after redaction of SSN and bank numbers. `read.ts` (the file-format handling) has no tests (Deno-only imports) and the scanned-PDF path is untested; the zip reader behind `.docx` is tested (`zip.test.ts`) but has not been run against a real Word file. Its model call goes through the shared provider adapter (`ask.ts`, tested for both providers) with a 30-second timeout and one retry, after spending the shared AI budget.

#### E-3.2 Candidate review and merge policy
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** E-3.1, B-1.2 · **Milestone:** M2
- **Built:** Candidates stay in `documents.extraction`. The prospect applies them (source `document`). An applied candidate never overwrites a prospect value except through their explicit Replace, and a differing value becomes a pending choice.
- **Remaining:** Intent met, with two differences: candidates are not written to the session as `inferred` first, and a conflict is shown as a pending choice, not stored as `conflicting`.

#### E-3.3 Unsupported, encrypted, and unreadable file messages
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** E-3.1 · **Milestone:** M2
- **Built:** Distinct messages for unsupported, encrypted, unreadable, too large and failed files. The intake stays usable.
- **Notes:** No tests for `UploadTab` or `documentStatus`. Upload accepts up to 20 MB while extraction refuses over 10 MB ('saved for your advisor').

#### E-4.1 Upload validation before storage (interim controls)
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** BE · **Depends:** E-1.1 · **Milestone:** M1
- **Built:** The storage key is sanitised plus a UUID. Advisor links request a download. `sniffFormat` identifies files by signature inside `document-extract`, and the browser now reads each file's leading bytes before upload (`uploadCheck.ts`), refusing a mismatch or an empty file, and stores it with the type its contents show. Migration `20261029090000` sets the `documents` bucket's `file_size_limit` (20 MB) and `allowed_mime_types`, adds a trigger capping an intake at 25 documents, and records each file's `file_sha256` with a unique index per intake (the browser refuses a repeat first; `document-extract` records the hash of the stored bytes). The SQL tests cover the cap, the unique hash and the category names.
- **Remaining:** The bucket limits are applied only where the storage schema has those columns, and the SQL tests' storage stand-in has them but real Supabase Storage was not exercised, so confirm they took effect on the project. Storage checks the declared type, not the bytes: a renamed file sent straight to the API is stored and later marked `unsupported`. `file_name` is stored raw. No test for `Content-Disposition`. The 20 MB upload cap is above the 10 MB the plan names and the 10 MB `document-extract` reads.

#### E-4.2 Document retention and deletion
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** E-1.1, H-1.2 · **Milestone:** M2
- **Built (US-6.1, with H-1.2):** A closed draft's documents are deleted 30 days after it closed, stored files through the Storage API first, then the rows (`purge-intakes`, `complete_intake_deletion`, which refuses while any file remains). Documents of a submitted record follow the submitted-record rule (reviewed after 3 years, deleted by request). Every deletion is recorded in `intake_deletions` with the files and rows removed. Tests: `supabase/tests/data_retention.sql` and `purge-intakes/handler.test.ts`.
- **Notes:** Since US-6.3 (SR-5) a prospect can only change a document's row while its intake is open; removing one from an expired draft is still allowed.

#### E-4.3 Malware scanning
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** D13, E-1.1 · **Milestone:** M2
- **Built:** No scanner and no quarantine status. Downloads are not gated.
- **Remaining:** The owner's update policy lets a prospect write `documents.status` (the ownership trigger locks only `user_id`, `session_id` and `storage_path`), so a scan verdict cannot live in that column as it is: use a separate, service-only column.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Integrate the chosen scanner before any document is available for download. Define the operational response for a positive result.
  - **AC:**
    - A file is not downloadable until scanning passes.
    - A positive result quarantines the file and alerts OPS.
  - **Tests:** Use the scanner's test signature. Confirm quarantine and alert.

---

### Epic F: Build the Advisor Workflow

*As built:* The advisor workflow is largely built on RLS and database functions, with a strong access matrix test. Gaps are pagination, the status allow-list, and a submission-level follow-up flag.

#### F-1.1 Role model
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** F-0.3, D5 · **Milestone:** M2
- **Built:** `user_roles`, enum `app_role` and SECURITY DEFINER `has_role`. No write policy or grant exists, so nobody can self-assign. It returns false for signed-out and anonymous JWTs. Tested.
- **Notes:** No dedicated first-admin recipe: `docs/ADVISOR_ACCESS.md` gives a generic service-role insert. In the repo `admin` adds nothing over `advisor` (tests assert admin cannot grant roles or delete intakes), which matches D5 only in part.

#### F-1.2 Advisor routes and backend enforcement
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-1.1 · **Milestone:** M2
- **Built:** `RequireAdvisor` in the UI. `require_advisor()` and RLS enforce it in the database on every advisor read and write. SQL tests refuse signed-out, guest, prospect and advisor-as-guest callers.
- **Notes:** There are no custom endpoints, so the tests assert a SQL refusal (42501), not an HTTP 403, and an RLS-filtered select returns empty rows.

#### F-1.3 Sign-in, sign-out, and unauthorized states
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** F-1.2 · **Milestone:** M2
- **Built:** Notices for expired and signed-out sessions, and `RequireAdvisor` and `AdvisorLoadError` states for expired, denied and revoked. Both ACs are met and tested.
- **Remaining:** The MFA decision for advisor accounts is not recorded anywhere: add it to section 3.

#### F-2.1 Submission queue
- **Status:** **PARTIAL** · **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-1.2, C-3.1 · **Milestone:** M2
- **Built:** `advisor_list_submissions` returns the required columns and no census or payroll, 25 a page with the total (`p_limit`, `p_offset`), read as its owner after its advisor check (on 20,000 intakes a page takes about 75 ms; the old function took 4.5 s for the whole list, which the page loaded every time). A certified intake's completeness comes from its certified copy, and a verified advisor correction supplies a missing item (migration `20261104114000`). Row-to-detail is tested.
- **Remaining:** The sort is certified-first then recently active drafts, not 'newest submitted first'. 'Authorized' means every advisor sees every intake (D16). Empty guest drafts are still listed.

#### F-2.2 Filter and search
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** F-2.1 · **Milestone:** M2
- **Built:** The status filter and search (company, contact, reference; every word must match) run in the database, and search waits for a pause in typing. Status, search and page are in the URL. Loading, empty, no-match, past-the-end and error states. Tested.
- **Remaining:** No 3-character minimum.

#### F-3.1 Submission detail: structured sections
- **Status:** **PARTIAL** · **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-2.1, C-3.2 · **Milestone:** M2
- **Built:** The detail page uses the certified snapshot when there is one. Each field shows its status, its source and a separate 'Advisor correction' block.
- **Remaining:** Not grouped by Manuscript section (a flat list of 38 fields plus a census table, which now shows each employee's dependents and the tier the Manuscript prints, and the header the certified PEO). No distinct 'advisor-updated' badge.

#### F-3.2 Transcript evidence and documents in detail
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-3.1, E-1.3, B-2.1 · **Milestone:** M2
- **Built:** 'View in transcript' scrolls to and highlights the source message. Documents open through 60-second signed links. A certified intake shows the transcript and document list as certified (stamped into the submission at certification): documents removed, added, renamed or re-categorised since are marked with who and when (`document_events`), and a removed certified document's file is kept while the intake is certified (migration `20261104112000`). Tested.
- **Notes:** The link exists only for transcript-sourced fields whose message still exists. No test for the document link or its expiry.

#### F-3.3 Advisor edits tracked separately
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** F-3.1, D-1.1 · **Milestone:** M2
- **Built:** `advisor_field_reviews` (corrected value, reason, user, time) and append-only `advisor_review_events`. Manuscript versions pin the review event and the certification they were built from (data hash and `certified_at`, checked by `record_manuscript_version`). A review is refused if the answer it names is no longer the intake's, and a prospect's change to a reviewed answer resets that review and is recorded as an `answer_changed` event (migration `20261104110000`). Tests assert three events, an unchanged prospect snapshot, the reset, the refusals and the pinning.
- **Remaining:** Intent met. Differences: an edit does not create version v+1 by itself (the advisor regenerates it); a correction applies only once the field is 'Verified'; the census cannot be corrected; only 38 allow-listed fields can be reviewed.

#### F-4.1 Status model and history
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Medium · **Owner:** BE · **Depends:** F-2.1 · **Milestone:** M2
- **Built:** `submission_workflow` and append-only `submission_status_history` (who, when, from, to, note). Every advisor change and every prospect certification or withdrawal writes history, whatever the status. Certifying answers an information request (back to `submitted`). An intake never certified can only be archived. The prospect is never left on 'information requested' after the advisor moves on (migration `20261104111000`). Tested.
- **Remaining:** Nine statuses against the plan's ten: draft, submitted, under_review, information_requested, sent_to_carrier, quoted, won, lost, archived. 'Ready for market' is absent, 'Sent to PEO' is `sent_to_carrier` and 'Quote received' is `quoted`. No transition allow-list among certified statuses: an advisor can move any certified intake to any non-draft status, including archived to under_review.

#### F-4.2 Internal notes
- **Status:** **DONE** · **Size:** S · **Priority:** Medium · **Owner:** BE · **Depends:** F-3.1 · **Milestone:** M2
- **Built:** `advisor_notes` is advisor-only, append-only and author-stamped. Tests cover prospect and guest denial.
- **Notes:** The tests assert zero rows and a refused insert, not an HTTP 403.

#### F-4.3 Follow-up flag and status filter
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Medium · **Owner:** FE · **Depends:** F-4.1, F-2.2 · **Milestone:** M2
- **Built:** Status changes update the filter results (tested). A field-level `follow_up` review state and a `flagged_fields` count exist.
- **Remaining:** No submission-level follow-up flag and no flag filter.

---

### Epic G: Communications and Operating Integrations

*As built:* The outbox, both emails, the every-minute schedule (a guarded migration), the engineering alert for dead events and the advisor Outbox & Notifications page with one-click retry are built and tested. Bounce and suppression handling is built too. D6 is decided: the Advisor Console is the operating workflow, so G-3 needed a mapping document and no sync. Nothing here has run against a hosted project, a real inbox, a real Resend webhook or a real alert channel yet, and the sender domain (D7) is not chosen.

#### G-1.1 Outbox and event dispatch
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** C-3.1 · **Milestone:** M2
- **Built:** `outbox_events` is unique on (kind, session id and data hash). Claims are `status = 'claimed'` with `claimed_at` and a 10 minute lease (`FOR UPDATE SKIP LOCKED`); a lost worker's claim is taken over by the next run, or marked dead by the reaper once every attempt is used. Five attempts with delays of 1 minute, 5 minutes, 30 minutes and 2 hours, then `dead`; each failure records `attempts`, `next_attempt_at` and `last_error` (failure kind plus the provider's explanation, with addresses and keys redacted). A dead event is logged (`OUTBOX_DEAD`) and pushed to `ENGINEERING_ALERT_WEBHOOK_URL` when set. A kind that cannot be sent says why on each waiting event. The every-minute `pg_cron` job is created by `20261027100000_outbox_schedule.sql` (guarded: never replaces an existing job, never fails a deploy). The reliability design (frozen message with an idempotency key, reaper, reconciliation sweep, `outbox_queued_at`) is in `docs/NOTIFICATIONS.md`. Tested, and run against real Postgres, PostgREST and the function under Deno.
- **Notes:** Unique per kind and certified data, not per submission: re-certified, changed answers queue a new 'Updated intake' alert (by design). The schedule migration was tested against stand-ins for `pg_cron`, `pg_net` and Vault, not a hosted project: confirm with `select jobname, schedule from cron.job;` after deploy, and set the two Vault secrets. No alert channel is configured yet (H-4.1).

#### G-1.2 Internal new-submission notification
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** G-1.1, D7 · **Milestone:** M2
- **Built:** The advisor alert (`New Intake Certified: <company> (<reference>)`, or `Updated Intake:`) carries company legal name, primary signer, title, work email, phone, employee count, HQ state, reference, the server-stamped certification time and a link to the review page, as HTML (a complete document with a title, a phone-width layout and row headers) and plain text. Never salaries, SSNs, the census or documents. If `ADVISORY_NOTIFY_EMAIL` is unset or invalid, its events stay queued and each records `not_configured: ...` in `last_error`. Tested, and the delivered message inspected on the real stack.
- **Notes:** No real-inbox send is recorded and rendering in real desktop and mobile mail clients has not been looked at; the pre-launch checklist is unchecked.

#### G-1.3 Retry failed notifications
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** G-1.1, F-1.2 · **Milestone:** M2
- **Built:** `advisor_requeue_outbox_event(event_id, rebuild_payload)`, `advisor_list_outbox_events` and `advisor_outbox_summary`, each checking `is_advisor()` (so a non-advisor gets 42501, HTTP 403). `/advisor/outbox` ("Outbox & Notifications" in the advisor header): status tabs with counts (dead, pending, claimed, sent), attempts, `last_error` with a plain reading, a stalled-queue banner, and Retry send (a dead event only: attempts 0, pending, due now) with a confirmed Rebuild and retry for an event whose email may already have been delivered. Who retried and how often is recorded on the event. Tested at the database, API and page level, and driven in a real browser against real PostgREST.
- **Notes:** `rebuild_payload` rebuilds the email from the stored payload and current settings under a new key; the payload is the summary taken at certification and is not re-read from live data. Retry is for dead events only.

#### G-2.1 Prospect confirmation email
- **Status:** **DONE** · **Size:** M · **Priority:** Medium · **Owner:** BE + DES · **Depends:** G-1.1, D7, D10 · **Milestone:** M3
- **Built:** A confirmation email with company, reference, next step, expected response time and support address (also Reply-To). It is queued in the certification transaction, goes only to the account's own email, and a send failure never touches the submission.
- **Notes:** Plain-text header, no logo. `PROSPECT_RESPONSE_TIME` and `SUPPORT_EMAIL` have no default, so unset means not sent. The pre-launch checklist is unchecked. Both emails call the identifier the File ID, as the app and the signed Manuscript do. Consent and preferences (US-5.2): the confirmation is a transactional receipt, so it needs no opt-in and has no preference setting. "Respected" means it goes only to the verified account address and never to a suppressed one, and that a re-certification sends another, identical confirmation by design (`docs/NOTIFICATIONS.md`, "Consent and preferences").

#### G-2.2 Bounce and suppression handling
- **Status:** **DONE** · **Size:** S · **Priority:** Medium · **Owner:** BE · **Depends:** G-2.1 · **Milestone:** M3
- **Built:** A `resend-webhook` function (gateway JWT check off, the webhook's own Svix signature checked instead, 5 minute timestamp window) records `email.bounced`, `email.complained`, `email.delivery_delayed`, `email.failed` and `email.suppressed` once each (a provider retry is a no-op). A permanent bounce, a complaint, or the provider's own suppression puts the address on `email_suppressions`; temporary trouble is recorded only. The claim holds back a due confirmation to a suppressed address (new status `suppressed`, shown on the Outbox page), so a re-certification or retry cannot email it. The advisory team's addresses are never suppressed: a bounce on one is logged as `WEBHOOK_ADVISOR_BOUNCE`. `advisor_email_problems()` flags the submission in the advisor queue ("Email bounced", "Reported as spam") and on its page. The signature scheme and event fields were taken from the official `svix` and `resend` packages; the verifier is tested against Svix's own signer. Replayed fixtures are covered in the SQL and function tests, and the whole path was run on real Postgres, PostgREST and the function under Deno.
- **Notes:** Not exercised against a real Resend webhook or a real bounce (the build environment cannot reach resend.com): create the webhook, set `RESEND_WEBHOOK_SECRET`, and run the checklist item in `docs/NOTIFICATIONS.md`. Lifting a suppression is SQL only. Both new tables hold addresses and belong in the D4 retention rule. The prospect's sign-in code emails share the Resend account: their bounces are recorded but nothing shows them to anyone.

#### G-3.1 CRM selection and field-mapping specification
- **Status:** **DONE** · **Size:** S · **Priority:** Medium · **Owner:** PM + BE · **Depends:** D6 · **Milestone:** M3
- **Built:** D6 decided the Advisor Console is the operating workflow, with no CRM. `docs/ADVISOR_CONSOLE.md` maps company, contacts, employee count, locations, status, File ID and Manuscript to where advisors see them, with each field's source and owner, and lists every link and how it is protected: no stored or emailed link opens a document; signed storage links last 60 seconds and are made on click.
- **Notes:** The console does not show the account's email (the Advisor Alert carries it); the doc records this as a known gap. Should a CRM be added later, the doc says how: an outbox kind keyed on the intake id, never the File ID or a signed link.

#### G-3.2 CRM sync worker
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** Medium · **Owner:** BE · **Depends:** G-3.1 · **Milestone:** M3
- **Built:** Nothing to sync: every Submission is in the Advisor Console when it is certified (D6). The outbox `kind` check still allows only the two email kinds.

#### G-3.3 Sync failure visibility and retry
- **Status:** **SUPERSEDED** · **Size:** S · **Priority:** Medium · **Owner:** FS · **Depends:** G-3.2 · **Milestone:** M3
- **Built:** No sync, so no sync failures. Failed emails about a Submission are visible and retriable on `/advisor/outbox` (G-1.3).

---

### Epic H: Security, Privacy, and Legal Readiness

*As built (after US-6.1 to US-6.4):* Classification and retention are documented and enforced, deletion removes rows and stored files, the privacy and terms pages and the intake consent gate exist (copy pending LEGAL), every table and function is covered by an isolation catalogue, and failures are recorded and alerted with a runbook behind them. What remains is mostly outside the repository: LEGAL approval, filling in contacts, configuring the alert channel, and the first restore drill.

#### H-1.1 Data classification and retention matrix
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** LEGAL + PM · **Depends:** D4 · **Milestone:** M2
- **Built (US-6.1):** `docs/DATA_HANDLING.md`: four sensitivity levels (Restricted, Confidential, Internal, Public) with handling rules; fifteen data classes (contact, company, census, payroll, benefits, workers' comp, documents, transcripts, Manuscript PDFs, certification and consent, advisor work, notifications, accounts, audit, operational), each with where it is stored, its retention and its deletion rule; the advisory team's responsibilities. `src/data/dataPolicy.ts` is the same policy in code, and the Privacy page renders it. `src/data/dataPolicy.test.ts` checks every table and bucket the migrations create belongs to a class, so a new table fails CI until it is classified. `schemaSync.test.ts` keeps the windows equal to the database's.
- **Remaining:** LEGAL's approval of the matrix and windows (D4; `docs/LEGAL_REVIEW.md`). Until then they are recommended defaults, enforced as written.

#### H-1.2 Automated retention enforcement
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** H-1.1, A-1.5 · **Milestone:** M2
- **Built (US-6.1):** Migration `20261104092000_data_retention_and_deletion.sql`. `run_retention()` runs daily (`run-retention`, pg_cron): it queues a deletion for every closed draft (expired, archived, revoked, never certified) 30 days after it closed (`closed_draft_retention()`), and prunes operational events (90 days), email delivery events (365 days) and the AI rate-limit logs (1 day, which until now were pruned only for a caller on their next call, so idle accounts' rows were kept for good). The `purge-intakes` edge function (hourly) carries each deletion out: stored files through the Storage API, then every row in one transaction (`complete_intake_deletion`, which refuses while any file remains). Each deletion is recorded in `intake_deletions` with counts per table; a deletion out of attempts alerts (H-4.1). Submitted records are never touched by the draft rule: after 3 years (`submitted_record_retention()`) `retention_review_due()` lists them for an admin. Tests: `supabase/tests/data_retention.sql`, `supabase/functions/purge-intakes/handler.test.ts`.
- **Notes:** Needs `purge-intakes` deployed and Vault's `project_url` and `service_role_key` set (`docs/SUPABASE_SETUP.md`). Not exercised against real Supabase Storage. A database restore can bring deleted intakes back; `docs/RUNBOOK.md` ("After a restore") says how to delete them again.

#### H-1.3 Deletion request workflow
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** H-1.2, F-1.2 · **Milestone:** M2
- **Built (US-6.1):** `request_intake_deletion(session, reason)` (admins only, any intake, idempotent while one is open) queues the same deletion H-1.2 runs, recording who asked and why; `retry_intake_deletion` re-queues a failed one. The append-only audit tables (status history, review events, notes, lifecycle events, Manuscript versions) refuse every change except this deletion of the one intake it names. `docs/DATA_HANDLING.md` has the request, verification, account-deletion and review steps.
- **Notes:** No screen: an admin's token through the API, or the SQL editor. Deleting the account itself (Supabase Auth, profile, consents) is a documented manual step.

#### H-2.1 Privacy policy and terms pages
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** LEGAL + FE · **Depends:** D10 · **Milestone:** M2
- **Built (US-6.2):** `/privacy` and `/terms` (`PrivacyPage.tsx`, `TermsPage.tsx`, `src/data/legal.ts`). The Privacy Policy renders the data classes and the retention rules from `dataPolicy.ts`, names the service providers, and says how to ask for deletion. Both show "Draft, pending legal review" while `LEGAL_COPY_APPROVED` is false. `LegalLinks` is on every page (landing footer, sign-in, Chamber top bar, consent gate, Manuscript page, profile, not found, auth callback, advisor header); `copy.guard.test.ts` fails if a page file doesn't render it. `docs/LEGAL_REVIEW.md` is the review and approval record.
- **Remaining:** LEGAL review and approval (D10), the privacy-request contact address, and the Terms' bracketed sections (liability, governing law, disclaimers).

#### H-2.2 Intake consent gate
- **Status:** **DONE** · **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** A-1.2, D3 · **Milestone:** M1
- **Built (US-6.2):** `IntakeConsentGate` wraps `/start`: nothing of the Chamber renders, so nothing can be typed, said or uploaded, until the account agrees to `src/data/intakeConsent.ts` (who Edgar Allan Advisory is and isn't, what is collected, how it's used and kept). Migration `20261104090000_intake_consent.sql`: `record_intake_consent` stores the wording, the version and the server's time in `intake_consents`; the database refuses a new intake or document from the browser without an agreement to the version in force (`EA004`), and a new intake records which agreement it was started under (`intake_consent_id`). Tests: `supabase/tests/intake_consent.sql`, `IntakeConsentGate.test.tsx`; the e2e specs agree and `intake-to-pdf.spec.ts` checks the record.
- **Notes:** The wording is a draft marked as such until LEGAL approves it (D3). Saves to intakes started before this change aren't refused (open tabs keep working); the gate asks for consent before any intake opens. Deploy the migration and the front end close together.

#### H-2.3 Role-disclosure copy audit
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** LEGAL + PM · **Depends:** H-2.1 · **Milestone:** M2
- **Built:** `copy.guard.test.ts` covers the landing page, Chamber, Reckoning, consent gate, PEO Match, Privacy and Terms pages and the emails: no named PEOs, no "on my behalf", no quote or submission promises, and (new) no affiliation or agency claims ("partnered with", "authorized agent", "on behalf of", …). The consent, Privacy and Terms state the role disclosure word for word (not a PEO, carrier or insurance agency; naming a PEO isn't endorsement). The landing page's "not health data" and "nothing else" claims are gone.
- **Remaining:** LEGAL's audit record (`docs/LEGAL_REVIEW.md`), including whether any compensation arrangement with a PEO must be disclosed. Residual copy for counsel: the Manuscript's HIPAA statement and its preview-domain "Prepared by" line.

#### H-3.1 Guest isolation tests
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-1.2, E-1.3 · **Milestone:** M2
- **Built (US-6.3):** `supabase/tests/data_isolation.sql` loads every migration and checks guests and prospects against each other's intakes in every status (rows, transcript, provenance, documents, files in both buckets, certifications, consents), including archived, revoked and expired intakes, a known intake id with someone else's token or none, and storage `SELECT` (which is what signing a link checks). `e2e/data-isolation.spec.ts` repeats the core of it over HTTP through the gateway.
- **Notes:** The SQL runs on mirrored `auth` and `storage` schemas and the HTTP spec on a stand-in gateway, not real Supabase (finding SR-9, accepted; launch checks in `docs/SECURITY_REVIEW.md`).

#### H-3.2 Prospect versus advisor permission tests
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** F-1.2, F-2.1 · **Milestone:** M2
- **Built:** `advisor_operations.sql` has 7 callers by 13 sources with exact row counts, function refusals, write denials, and a catalogue check that every public table has row security. US-6.3 added `data_isolation.sql`: 25 tables and buckets by 9 callers with exact counts over every migration; every advisor, admin and service-only function by caller; advisors refused monitoring data, the AI rate-limit tables, other users' roles, deletions and every write to prospect data; and catalogue checks that fail when a table isn't in the matrix, a function callable by the API roles isn't on the reviewed allowlist, or a bucket is public.
- **Notes:** Advisors see all intakes (D16, finding SR-7, accepted for the pilot).

#### H-3.3 Signed URL and fragment-token tests
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** D-2.1, E-1.3 · **Milestone:** M2
- **Built (US-6.3):** A known session id grants nothing without the owner's token (`data_isolation.sql`, `e2e/data-isolation.spec.ts`). `src/lib/fileLinks.test.ts`: every signed link goes through one helper with a 60-second expiry, nothing calls `getPublicUrl`, no link is stored, put in a URL or logged, edge functions never sign links, and no migration makes a bucket public. Monitoring redacts links from anything it records (`ops_redact`).
- **Remaining:** That an expired link is refused is Supabase Storage's to enforce and isn't in the test stack (SR-10): the manual launch check in `docs/SECURITY_REVIEW.md` covers it.

#### H-4.1 Alerts for failed uploads, submits, AI calls, and auth
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** OPS · **Depends:** G-1.1, B-3.3 · **Milestone:** M2
- **Built (US-6.4):** Migration `20261104091000_ops_monitoring.sql`: `ops_events` records application errors, failed uploads, AI failures, authorization failures and failed deletions, with a code and a redacted detail, never contents. The browser reports through `report_client_event` (`src/lib/monitoring.ts`: the error boundary, uncaught errors, upload and document-read failures, chat that never answered, advisor denials), capped per account and overall. AI failures are counted from `ai_extraction_events`, the record of every AI call (US-2.4a), so the AI functions don't report them twice; the browser adds only calls that never reached them. `ops_alert_rules()` sets a threshold per kind; the `ops-monitor` edge function (every five minutes) raises each at most once per cooldown and posts to `ENGINEERING_ALERT_WEBHOOK_URL`. Admins read `admin_ops_summary`. Tests: `supabase/tests/ops_monitoring.sql`, `src/lib/monitoring.test.ts`, `ops-monitor/handler.test.ts`.
- **Notes:** Before launch, set `ENGINEERING_ALERT_WEBHOOK_URL` to a watched channel and send the test event (`docs/RUNBOOK.md`). Refusals that never reach the browser or a function (direct API 401/403, failed sign-ins) are in Supabase's logs only; the runbook says where to look. Browser reports can be forged to raise false alerts (SR-11, accepted, capped). No external uptime check.

#### H-4.2 Incident runbook and escalation contacts
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** H-4.1 · **Milestone:** M2
- **Built (US-6.4):** `docs/RUNBOOK.md`: escalation contacts, what is monitored and how alerts arrive, severity levels with response times, response steps and an incident log template, playbooks (application errors, uploads, AI, authorization, deletions, notifications, suspected data exposure, leaked secrets), backup and recovery expectations, and the quarterly production access review with its record. `schemaSync.test.ts` keeps its alert table equal to `ops_alert_rules()`.
- **Remaining:** Names and numbers in the contacts table (no people are invented in the repo).

#### H-4.3 Backup and restore verification
- **Status:** **NOT VERIFIABLE** · **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** J-1.1 · **Milestone:** M2
- **Built:** `docs/RUNBOOK.md` "Backup and recovery": what is backed up and what isn't (stored files are not in database backups), recovery point and time expectations, the quarterly restore drill and its record, and what to do after a restore (re-delete intakes deleted since the backup).
- **Remaining:** Confirm the production plan's backups and PITR, and run and record the first drill on staging (J-1.1).

---

### Epic I: Quality, Accessibility, and Release Readiness

*As built:* Unit tests, one end-to-end test and CI exist. Responsive and accessibility verification and the voice state machine do not.

#### I-1.1 Responsive Chamber layout
- **Status:** **PARTIAL** · **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** A-2.3, B-3.2 · **Milestone:** M2
- **Built:** A 768 px breakpoint. On mobile the transcript is hidden and a fixed chat bar appears. The tab bar scrolls horizontally.
- **Remaining:** It does not collapse to tabs and there is no conversation view on mobile (a reply shows only as a 120-character caption on the orb). Controls under 44 px exist (`text-[10px]` buttons in `ProvenanceField`, a `w-3.5` icon in `TranscriptPanel`). No viewport tests (`setup.ts` mocks `matchMedia` to false). No horizontal overflow at 360, 768 or 1280 was observed in this refresh.

#### I-1.2 Responsive review, certification, and Manuscript
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** C-1.2, D-2.1 · **Milestone:** M2
- **Built:** Responsive grids on the Reckoning and Manuscript, an overflow-scrolling census table, and a shortened button label on small screens.
- **Remaining:** The Review tab uses a fixed two-column grid. No viewport tests, and overflow was not observed in this refresh.

#### I-1.3 Mobile browser test matrix
- **Status:** **NOT VERIFIABLE** · **Size:** S · **Priority:** High · **Owner:** QA · **Depends:** I-1.1, E-1.2 · **Milestone:** M2
- **Built:** No `docs/QA_MATRIX.md` exists.
- **Remaining:** The manual run on iOS Safari and Android Chrome.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Test upload and PDF download on iOS Safari and Android Chrome.
  - **AC:**
    - Upload and download pass on both.
  - **Tests:** Manual matrix recorded in `docs/QA_MATRIX.md`.

#### I-2.1 Keyboard and labels for intake, review, and certification
- **Status:** **PARTIAL** · **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** I-1.1 · **Milestone:** M2
- **Built:** `aria-label`s in `ProvenanceField`, `UploadTab` and the Reckoning name and role fields. A screen-reader-only checkbox with a focus ring. `VerifyEmailGate` uses `htmlFor`.
- **Remaining:** The workspace tab bar has no tablist or `aria-selected`. The send button and chat inputs are unnamed. The voice orb is a clickable div. `AuthPage` labels have no `htmlFor`. Inputs use `outline-none` with a faint border focus. No automated name check and no keyboard-only run.

#### I-2.2 Live-region announcements
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** I-2.1, B-3.2 · **Milestone:** M2
- **Built:** Validation errors use `role="alert"` (`ProvenanceField`, `VerifyEmailGate`, `ChatFailureNotice`, Reckoning) and the success overlay has `aria-live`.
- **Remaining:** AI replies have no live region. The save status is a polite live region (`SaveStatus.tsx`), and conflict and invalid states use `role="alert"`. Upload progress is not announced. Sonner toast announcements are unverified. No screen-reader run.

#### I-2.3 Contrast and focus-style audit
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** High · **Owner:** DES + FE · **Depends:** I-1.1 · **Milestone:** M2
- **Built:** No audit artifact exists.
- **Remaining:** Initial reading of `index.css`: `--muted-foreground` on `--background` is about 4.1:1 and is used at 9 to 10 px; `text-muted-foreground/50` in `ProvenanceField` is about 1.8:1; focus styling is weak. Confirm with a contrast tool.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Check text and key controls against WCAG AA. Fix failures.
  - **AC:**
    - Normal text and key controls meet 4.5:1 and 3:1 respectively.
  - **Tests:** Contrast tool run plus manual check.

#### I-3.1 Consistent loading, empty, and error states
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** B-3.2, E-1.2, C-3.3 · **Milestone:** M1
- **Built:** No success appears before server confirmation (Reckoning).
- **Remaining:** No shared pattern: full-page spinners, toasts, inline alerts and plain text are mixed. An autosave failure goes only to `console.error`.

#### I-4.1 Unit tests for validation and schema
- **Status:** **DONE** · **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.2 · **Milestone:** M1
- **Built:** `npm test` runs Vitest with 685 tests in 48 files, including `chamberValidation.test.ts` and `provenance.test.ts`. `src/test` holds only `setup.ts`, so the placeholder is gone.

#### I-4.2 Integration test harness on local Supabase
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** J-1.1, A-1.2 · **Milestone:** M1
- **Built:** `supabase/tests/run.sh` gives each SQL file a fresh database from one command. The CI `sql-tests` job covers certification, guest block, outbox, advisor, documents, provenance and AI limits.
- **Remaining:** Plain Postgres with a stubbed `auth` schema, not local Supabase. No seed data. Create, save, certify and submit now run end to end through a PostgREST and GoTrue stand-in with the real migrations and row security (I-4.3), but not through the real Supabase API. `certification.sql` runs as a superuser (`advisor_operations.sql` does use `SET ROLE`).

#### I-4.3 End-to-end test: intake to PDF
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** QA + FE · **Depends:** I-4.2, D-3.2 · **Milestone:** M1
- **Built:** `e2e/intake-to-pdf.spec.ts` drives a browser from a guest's text intake through review, a PEO choice, email verification, certification and submission to the Manuscript page and the PDF download. It asserts the File ID (reference), the PDF file name and its text, the rows in the database, and that the run produced no console errors or failed requests. `npm run test:e2e` starts the stack (`playwright.config.ts`, `e2e/stack/`): real Postgres with every migration, so row security and triggers are real; a gateway that serves subsets of GoTrue and PostgREST; the real `chamber-extract` handler with a scripted AI provider; and a `dispatch-outbox` that sends no email. The `e2e` job in `ci.yml` runs it on every pull request and has run green (run 40774885703 on pull request 25's final commit, run 40812758403 on pull request 27).
- **Notes:** The path is a stand-in for Supabase, not Supabase. It uploads no documents (no Storage), does not use voice, does not touch the advisor side, and the model is scripted, so none of those is covered. The gateway implements only the calls the path makes. Setup, ports and the database it recreates are in `README.md`.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Playwright test: text intake, review, certify, submit, and PDF download.
  - **AC:**
    - The test completes the full path and asserts the reference and PDF file name.
  - **Tests:** The test is the test.

#### I-4.4 CI pipeline that gates releases
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** OPS · **Depends:** I-4.1, I-4.2, I-4.3 · **Milestone:** M1
- **Built:** `ci.yml` runs `verify` (lint, edge-function type check, test, build), `sql-tests` and `e2e` (I-4.3) on every pull request and on pushes to `main`.
- **Remaining:** Whether the checks, `e2e` included, are required for merge is not verifiable from the repo: `README.md` asks the owner to set it. The edge-function type check (F-0.4) is in `verify`. Its config also bans what Node's type stripping cannot run, because the `e2e` gateway loads `chamber-extract` that way.

#### I-5.1 Voice reliability diagnosis and state machine
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** Medium · **Owner:** FE · **Depends:** A-3.1, D8 · **Milestone:** M3
- **Built:** `OrbState` is idle, listening, speaking, thinking, disabled, set ad hoc from hook callbacks (`useLenoreVoice.ts`) and by the chat hook.
- **Remaining:** No connecting, active, disconnected or failed states, no single driver, no `docs/VOICE_ISSUES.md`, no hosted test.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Define the states: connecting, active, listening, speaking, disconnected, failed. Reproduce failures in the hosted environment and fix the top causes. Drive the orb from this state machine only.
  - **AC:**
    - The orb state matches the connection state in each test run.
    - Each failure cause found is logged in `docs/VOICE_ISSUES.md` with its fix.
  - **Tests:** Hosted-environment test with a real microphone on each supported browser.

#### I-5.2 Voice fallback and browser support matrix
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Medium · **Owner:** PM + FE · **Depends:** I-5.1 · **Milestone:** M3
- **Built:** Voice never auto-starts, text input is always present, and voice is behind `VITE_ELEVENLABS_AGENT_ID`.
- **Remaining:** No browser-support detection or definition and no microphone help text. A missing agent id opens a developer-facing modal.

#### I-5.3 Voice failure UX
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Medium · **Owner:** FE · **Depends:** I-5.1 · **Milestone:** M3
- **Built:** Permission denied, start failure, `onError` and disconnect only call `console.error` and set the orb to idle (`useLenoreVoice.ts`).
- **Remaining:** No user-facing messages. Text chat is merely unaffected.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Explain permission-denied, device-unavailable, connection-failed, and mid-call disconnect. Keep the text chat fully usable in each case.
  - **AC:**
    - Each failure has a message and a text-chat path.
    - The text chat is usable after each failure.
  - **Tests:** Simulate each failure.

---

### Epic J: Release Operations

*As built:* Mostly operations work with no repository artifacts.

#### J-1.1 Environment separation
- **Status:** **NOT VERIFIABLE** · **Size:** M · **Priority:** Highest · **Owner:** OPS · **Depends:** F-0.1 · **Milestone:** M1
- **Built:** One `project_id` in `supabase/config.toml`. `.env.example` holds publishable values only. `vite.config.ts` excludes service-role and Postgres variables. `src` reads four `VITE_*` variables.
- **Remaining:** Separate projects and secrets are an ops step. No bundle-scan step in CI.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Separate development, staging, and production Supabase projects. Configure environment variables per environment. Confirm the client bundle holds only publishable keys.
  - **AC:**
    - Each environment has its own project and secrets.
    - A grep of the built bundle finds no secret key.
  - **Tests:** Build artifact scan.

#### J-1.2 Production domain, HTTPS, canonical URL, and sender domain
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** J-1.1, D7, D-2.1 · **Milestone:** M3
- **Built:** `index.html` has no canonical link. `vercel.json` holds only the SPA rewrite and an asset cache header. The Manuscript footer hardcodes a `lovable.app` URL. The sender-domain item in `docs/NOTIFICATIONS.md` is unchecked.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Connect the production domain. Enforce HTTPS and redirects. Set canonical URLs. Verify the sender domain.
  - **AC:**
    - HTTP redirects to HTTPS.
    - Canonical URL is set on every public page.
    - Sender domain shows verified.
  - **Tests:** Redirect check. Header check.

#### J-2.1 Funnel analytics events
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** Medium · **Owner:** FE + PM · **Depends:** H-2.2 · **Milestone:** M3
- **Built:** No analytics code, dependency or consent mechanism exists.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Events: landing CTA, Chamber start, upload, intake milestones, review start, certification, submission, PDF download. No personal or census values in event payloads. Tracking waits for consent.
  - **AC:**
    - Events fire at each milestone.
    - No event payload contains a personal or census value.
    - No event fires before consent.
  - **Tests:** Payload scan. Consent-gate test.

#### J-2.2 Funnel view
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Medium · **Owner:** PM · **Depends:** J-2.1 · **Milestone:** M3
- **Built:** No funnel report exists.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** A funnel report that shows drop-off between milestones.
  - **AC:**
    - The report shows counts for each milestone.
  - **Tests:** Compare report to a manual count for a test run.

#### J-3.1 Launch checklist and controlled test submission
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** PM + OPS · **Depends:** I-4.3, G-1.2, H-4.2 · **Milestone:** M3
- **Built:** `docs/NOTIFICATIONS.md` has an email-only pre-launch checklist, all unchecked.
- **Remaining:** The other seven categories, the sign-off and a test-submission record.

#### J-3.2 Rollback and maintenance plan
- **Status:** **NOT VERIFIABLE** · **Size:** S · **Priority:** Highest · **Owner:** OPS · **Depends:** J-1.1 · **Milestone:** M3
- **Built:** No rollback or maintenance document exists in the repo.
- **Remaining:** The document, the owners and a staging rehearsal.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Document rollback steps and a maintenance-page procedure. Assign launch and support owners.
  - **AC:**
    - Rollback is rehearsed on staging.
    - Support owner is named.
  - **Tests:** Staging rollback rehearsal.

---

## 5. Proposed Order of Work

v1.0's tiered starting order is replaced. This order follows the milestone tags and dependencies against the statuses above. It is a proposal, and it changes as the open decisions close.

| Tier | Stories | Why |
|---|---|---|
| 0: put the fixes in front of users | Confirm which builds of `chamber-extract` and `document-extract` are deployed, deploy both (and check the deploy bundles `supabase/functions/_shared`), and make one real Lenore exchange and one real document read in preview (the open part of F-0.2). | The fixes are verified in code, tests, a Deno run and a CI run, not live. |
| 1: close the M1 demo gaps | C-2.4, C-3.1, D-1.5, C-1.1, C-1.2, C-1.3, C-2.1, C-2.3, C-3.3, H-2.2, I-3.1, I-4.4 (make the checks required), F-0.1 (history scan), F-0.3, J-1.1 | The M1 stories that decide whether the intake-to-PDF path can be demonstrated, plus making the end-to-end test (I-4.3, built) a required check. D2 is decided (US-1.2, B-2.2): C-1.3 is done, and C-2.1 can start. B-1.3's follow-up policy moved to US-2.3a. C-2.4 and H-2.2 wait for D3 wording but can ship the structure now. C-3.1 waits for D15. |
| 2: gate the private pilot (M2) | All M2 stories, plus the M1-tagged hardening stories that do not block the demo path: B-1.1, B-1.3, B-1.4, B-2.2, D-1.1 to D-1.4, D-2.2, D-3.1 to D-3.3, E-4.1, I-4.2. In practice: E-4.1, E-4.3, E-4.2, F-2.1, F-4.1, F-4.3, G-1.1 (schedule in a migration), G-1.3, H-1.1 to H-1.3, H-2.1, H-2.3, H-3.1, H-3.3, H-4.1 to H-4.3, I-1.x, I-2.x | Retention, deletion, upload hardening, an admin view of failed emails, legal pages, alerting, a runbook, and accessibility. Most wait on D3, D4, D10 and D13. |
| 3: public launch (M3) | G-2.2, G-3.x, I-5.x, J-1.2, J-2.x, J-3.x | Bounces, voice reliability, domain, analytics and the launch checklist. G-3.x closed with D6 (the Advisor Console, no CRM). |

**Critical path to a credible demo:** `C-2.1 → C-3.1 → D-1.5` (A-2.2 and C-1.3 are done), with the end-to-end test (I-4.3, built) kept passing as each lands. D15 must close before C-3.1 starts; D2 is decided (US-1.2, B-2.2).

---

## 6. Milestone Exit Criteria

### Milestone 1: Internal Demo

| Criterion | Status |
|---|---|
| All M1 stories are done. | **Not met.** 22 of 54 are DONE or SUPERSEDED. |
| A test prospect completes text intake, review, certification, submission, and PDF download with real data. | **Shown in CI against stand-ins, not live.** The end-to-end test (I-4.3) completes text intake, review, certification, submission and PDF download in a browser with a scripted AI model and a Supabase stand-in. It is not shown on a deployed environment, with a real model or real Supabase, or with document upload. |
| No "Meridian" text appears in the live path. | **Mostly met.** The live Manuscript never renders the sample (tested). 'Meridian Creative Group' remains in `chamberTypes.ts` and an `AuthPage` placeholder (D-1.5). |
| Two sessions cannot access each other's data (automated test). | **Met at the database level.** The SQL matrix covers cross-user reads and writes and runs in CI (not run in this refresh). There is no HTTP-level test. |
| Internal testers can repeat the flow without developer help. | **Not verifiable.** |

### Milestone 2: Private Pilot

| Criterion | Status |
|---|---|
| All M2 stories are done. | **Not met.** 13 of 39 are DONE or SUPERSEDED. |
| Advisors can review, manage status, and see notifications. | **Largely met in code:** queue, detail, field review, notes, status history, versioned Manuscripts, alert emails. Email needs secrets, a verified sender and the schedule. |
| Retention and deletion run on schedule. | **Met in the repository.** Drafts expire hourly (A-1.5); `run-retention` queues closed drafts for deletion and prunes logs daily, and `purge-intakes` deletes files and rows hourly (H-1.2, H-1.3, E-4.2). Needs the functions deployed and Vault's secrets set on the project. |
| Privacy policy and terms are approved by LEGAL. | **Not met.** The pages and the intake consent exist as marked drafts; LEGAL's approval is recorded in `docs/LEGAL_REVIEW.md` (H-2.1, H-2.2, D10). |
| Authorization, upload, and isolation tests pass in CI. | **Authorization and isolation met** (`data_isolation.sql` over every migration, `e2e/data-isolation.spec.ts`, cross-user storage reads included). **Upload partly met:** only the browser checks file contents (E-4.1), and signed-link expiry is a manual launch check (H-3.3, SR-10). |
| Runbook, alerts, and backup drill are complete. | **Partly met.** `docs/RUNBOOK.md` and alerting for every failure kind exist (H-4.1, H-4.2). Escalation names, the alert channel and the first restore drill (H-4.3) are still to do. |

### Milestone 3: Public Launch

| Criterion | Status |
|---|---|
| All M3 stories are done, including voice items if voice is marketed (D8). | **Not met.** 1 of 13 are DONE or SUPERSEDED. |
| Branded email is live and verified. | **Not met.** The emails are built and plain text. The sender domain is unverified. |
| Analytics consent is in place. | **Not met.** No analytics or consent exists. |
| Launch checklist is signed off and rollback is rehearsed. | **Not met.** Email-only checklist, unchecked. |

---

## 7. Story Index

| ID | Title | Size | Priority | Milestone | Status |
|---|---|---|---|---|---|
| F-0.1 | Stop tracking `.env` and confirm secret hygiene | S | Highest | M1 | PARTIAL |
| F-0.2 | Put the AI provider behind an adapter | M | Highest | M1 | PARTIAL |
| F-0.3 | Document the route access map | S | Highest | M1 | PARTIAL |
| F-0.4 | Type-check and import-check edge functions in CI | S | Highest | M1 | DONE |
| A-1.1 | Intake session data model | M | Highest | M1 | SUPERSEDED |
| A-1.2 | Create a guest session and issue a continuation token | M | Highest | M1 | SUPERSEDED |
| A-1.3 | Restore a session after refresh, with a recovery screen | M | Highest | M1 | DONE |
| A-1.4 | Autosave with visible status and local backup | M | Highest | M1 | DONE |
| A-1.5 | Expiry, archive, and revocation | M | High | M1 | DONE |
| A-1.6 | Retire the legacy `chamber_sessions` path | S | High | M1 | SUPERSEDED |
| A-2.1 | Canonical intake schema v1 | M | Highest | M1 | DONE |
| A-2.2 | Server-side validation and versioned writes | M | Highest | M1 | DONE |
| A-2.3 | Hydrate the Chamber workspace from saved data | M | Highest | M1 | DONE |
| A-3.1 | Store transcript messages as ordered rows | S | High | M1 | SUPERSEDED |
| A-3.2 | Restore the transcript on resume | S | High | M1 | DONE |
| B-1.1 | Extraction response contract and parser | M | Highest | M1 | DONE |
| B-1.2 | Merge policy and conflict capture | M | Highest | M1 | DONE |
| B-1.3 | Lenore follow-up policy and completion state | M | Highest | M1 | SUPERSEDED |
| B-1.4 | Prompt versioning and golden-transcript fixtures | S | High | M1 | PARTIAL |
| B-2.1 | Provenance badges and confirm-or-edit controls | M | High | M2 | DONE |
| B-2.2 | Derive open items from the schema | S | High | M1 | DONE |
| B-3.1 | Timeouts, retries, and rate limits | M | High | M1 | DONE |
| B-3.2 | User-facing failure states | S | High | M1 | DONE |
| B-3.3 | Operational logs with redaction | S | High | M1 | DONE |
| C-1.1 | Read-only review by Manuscript section | M | Highest | M1 | PARTIAL |
| C-1.2 | Inline editing that writes to the canonical record | M | Highest | M1 | PARTIAL |
| C-1.3 | Readiness gate with jump links | M | Highest | M1 | DONE |
| C-2.1 | Certification record and endpoint | M | Highest | M1 | PARTIAL |
| C-2.2 | Certification screen | S | Highest | M1 | DONE |
| C-2.3 | Re-certification after material changes | M | Highest | M1 | PARTIAL |
| C-2.4 | One consent definition, marked DRAFT everywhere it appears | S | Highest | M1 | NOT STARTED |
| C-3.1 | Submit with idempotency and a human-readable reference | M | Highest | M1 | PARTIAL |
| C-3.2 | Immutable submission snapshot | M | Highest | M1 | PARTIAL |
| C-3.3 | Confirmation screen | S | Highest | M1 | PARTIAL |
| D-1.1 | Mapper: company, workforce, locations, state mix | M | Highest | M1 | PARTIAL |
| D-1.2 | Mapper: census, dependents, benefits, payroll | M | Highest | M1 | PARTIAL |
| D-1.3 | Mapper: workers' comp, documents, resolved and open items | S | High | M1 | PARTIAL |
| D-1.4 | Mapper unit tests | S | High | M1 | PARTIAL |
| D-1.5 | Remove sample data from the live path | S | Highest | M1 | PARTIAL |
| D-2.1 | Manuscript route by submission reference | M | Highest | M1 | SUPERSEDED |
| D-2.2 | Safe error states | S | High | M1 | SUPERSEDED |
| D-3.1 | Print layout: pagination, headers, footers, tables | M | Highest | M1 | PARTIAL |
| D-3.2 | File name, metadata, and masking default | S | Highest | M1 | PARTIAL |
| D-3.3 | Cross-browser and mobile download verification | S | High | M1 | NOT VERIFIABLE |
| E-1.1 | Session-linked upload API and private storage | M | High | M1 | SUPERSEDED |
| E-1.2 | Upload list, refresh, and removal in the UI | M | High | M1 | DONE |
| E-1.3 | Document access isolation | S | High | M1 | SUPERSEDED |
| E-2.1 | Document categories and guidance | S | Medium | M2 | DONE |
| E-2.2 | Completeness checklist in review | S | Medium | M2 | DONE |
| E-3.1 | Text extraction for CSV, XLSX, and text PDF | M | High | M2 | DONE |
| E-3.2 | Candidate review and merge policy | M | High | M2 | SUPERSEDED |
| E-3.3 | Unsupported, encrypted, and unreadable file messages | S | High | M2 | DONE |
| E-4.1 | Upload validation before storage (interim controls) | S | Highest | M1 | PARTIAL |
| E-4.2 | Document retention and deletion | M | High | M2 | DONE |
| E-4.3 | Malware scanning | S | High | M2 | NOT STARTED |
| F-1.1 | Role model | M | High | M2 | DONE |
| F-1.2 | Advisor routes and backend enforcement | M | High | M2 | DONE |
| F-1.3 | Sign-in, sign-out, and unauthorized states | S | High | M2 | PARTIAL |
| F-2.1 | Submission queue | M | High | M2 | PARTIAL |
| F-2.2 | Filter and search | S | High | M2 | PARTIAL |
| F-3.1 | Submission detail: structured sections | M | High | M2 | PARTIAL |
| F-3.2 | Transcript evidence and documents in detail | M | High | M2 | DONE |
| F-3.3 | Advisor edits tracked separately | M | High | M2 | SUPERSEDED |
| F-4.1 | Status model and history | M | Medium | M2 | PARTIAL |
| F-4.2 | Internal notes | S | Medium | M2 | DONE |
| F-4.3 | Follow-up flag and status filter | S | Medium | M2 | PARTIAL |
| G-1.1 | Outbox and event dispatch | M | High | M2 | DONE |
| G-1.2 | Internal new-submission notification | S | High | M2 | DONE |
| G-1.3 | Retry failed notifications | S | High | M2 | DONE |
| G-2.1 | Prospect confirmation email | M | Medium | M3 | DONE |
| G-2.2 | Bounce and suppression handling | S | Medium | M3 | DONE |
| G-3.1 | CRM selection and field-mapping specification | S | Medium | M3 | DONE |
| G-3.2 | CRM sync worker | M | Medium | M3 | SUPERSEDED |
| G-3.3 | Sync failure visibility and retry | S | Medium | M3 | SUPERSEDED |
| H-1.1 | Data classification and retention matrix | S | Highest | M2 | PARTIAL |
| H-1.2 | Automated retention enforcement | M | Highest | M2 | DONE |
| H-1.3 | Deletion request workflow | S | High | M2 | DONE |
| H-2.1 | Privacy policy and terms pages | S | Highest | M2 | PARTIAL |
| H-2.2 | Intake consent gate | S | Highest | M1 | DONE |
| H-2.3 | Role-disclosure copy audit | S | High | M2 | PARTIAL |
| H-3.1 | Guest isolation tests | M | Highest | M2 | DONE |
| H-3.2 | Prospect versus advisor permission tests | M | Highest | M2 | DONE |
| H-3.3 | Signed URL and fragment-token tests | S | High | M2 | PARTIAL |
| H-4.1 | Alerts for failed uploads, submits, AI calls, and auth | M | High | M2 | DONE |
| H-4.2 | Incident runbook and escalation contacts | S | High | M2 | PARTIAL |
| H-4.3 | Backup and restore verification | S | High | M2 | NOT VERIFIABLE |
| I-1.1 | Responsive Chamber layout | M | High | M2 | PARTIAL |
| I-1.2 | Responsive review, certification, and Manuscript | S | High | M2 | PARTIAL |
| I-1.3 | Mobile browser test matrix | S | High | M2 | NOT VERIFIABLE |
| I-2.1 | Keyboard and labels for intake, review, and certification | M | High | M2 | PARTIAL |
| I-2.2 | Live-region announcements | S | High | M2 | PARTIAL |
| I-2.3 | Contrast and focus-style audit | S | High | M2 | NOT STARTED |
| I-3.1 | Consistent loading, empty, and error states | S | High | M1 | PARTIAL |
| I-4.1 | Unit tests for validation and schema | S | Highest | M1 | DONE |
| I-4.2 | Integration test harness on local Supabase | M | Highest | M1 | PARTIAL |
| I-4.3 | End-to-end test: intake to PDF | M | Highest | M1 | DONE |
| I-4.4 | CI pipeline that gates releases | S | Highest | M1 | PARTIAL |
| I-5.1 | Voice reliability diagnosis and state machine | M | Medium | M3 | NOT STARTED |
| I-5.2 | Voice fallback and browser support matrix | S | Medium | M3 | PARTIAL |
| I-5.3 | Voice failure UX | S | Medium | M3 | NOT STARTED |
| J-1.1 | Environment separation | M | Highest | M1 | NOT VERIFIABLE |
| J-1.2 | Production domain, HTTPS, canonical URL, and sender domain | S | High | M3 | NOT STARTED |
| J-2.1 | Funnel analytics events | M | Medium | M3 | NOT STARTED |
| J-2.2 | Funnel view | S | Medium | M3 | NOT STARTED |
| J-3.1 | Launch checklist and controlled test submission | S | Highest | M3 | PARTIAL |
| J-3.2 | Rollback and maintenance plan | S | Highest | M3 | NOT VERIFIABLE |

**Count:** 106 stories (v1.0's 104, plus F-0.4 and C-2.4). Sizes: 0 Large; every story is Small or Medium.

---

## 8. Changes From v1.0

**Added**
- A status, a Built line and a Remaining line on every story (sections 0.2 and 4), and a status column in the story index.
- Section 1 rewritten from the code, including the architecture comparison (1.2) and the defects found (1.3).
- Two stories: **F-0.4** (type-check and import-check edge functions in CI) and **C-2.4** (one consent definition, marked DRAFT everywhere).
- Three decisions: **D14** (intake access model), **D15** (reference format), **D16** (advisor visibility), and a status on D1 to D13.
- Milestone exit criteria with a status against each criterion (section 6).

**Updated in 2.6** (after A-1.3, A-1.4, A-1.5, A-2.1 and A-3.2 landed)
- All five are DONE, so Epic A has no open story: a way back from another browser by emailed code, a local backup of unsaved answers, draft expiry with archive and admin revocation, intake schema v1 as a JSON Schema checked on the way in, and a transcript that restores once, at its latest message. Each story's Notes list what it leaves out (no way back for a guest who never verified an email, no backup before the intake row exists, no purge on expiry, the D2 schema items, no `system` sender).
- D1 and D4 record what is now in code. Section 1.3 loses the 'no local backup' and 'cannot sign back in' defects; sections 1.5, 5 and 6 follow. The M2 retention criterion is partly met.
- Also fixed on the branch: `AdvisorSubmissionPage.tsx` had lost its email-problem imports in a merge (`409e3f5`), so the page threw as it loaded and its test failed on `main`.

**Updated in 2.5** (after A-2.2 landed)
- A-2.2 is DONE: the database validates `chamber_data` and versions every save, and the client sends its last-seen version and handles a conflict. Its Notes list what is not covered (the phone rule lives on `profiles.phone`, unknown keys are refused, two real connections were checked by hand, the keepalive limit).
- A-1.1, A-1.4, A-2.1, A-3.1 and B-1.2 no longer say the database has no validation or version column, or that the update has no `.select()`. Sections 1.2, 1.3, 1.5 and 2, the Epic A summary, the risk table, the Definition of Done and open question 7 follow. Section 5 no longer lists A-2.2 as open work, and its critical path starts at C-1.3.

**Updated in 2.4** (after the intake-to-PDF end-to-end test landed)
- I-4.3 is DONE: the test, its stand-ins and `npm run test:e2e` exist, and the `e2e` CI job has run green (runs 40774885703 and 40812758403). I-4.4 now lists the `e2e` job as built, and only whether the checks are required for merge remains. I-4.2 notes that create, save, certify and submit run through a PostgREST and GoTrue stand-in under real row security.
- Sections 1.1, 1.2, 1.4, 1.5, 5 and 6 and the Definition of Done no longer say no end-to-end test exists. The M1 'test prospect completes the path' criterion is met in CI against stand-ins and still not shown live. The test does not cover document upload, voice, the advisor path or real Supabase, so those stay open under their own stories.
- Not re-verified: main's other changes since 2.3 (save-status indicator and resume of the latest intake, public-copy changes, the Supabase setup script). They may change A-1.3, A-1.4, I-2.2, I-3.1 and H-2.3 and the matching rows in section 1.3; those statuses are as of 2.3. Version 2.5 re-read A-1.3, A-1.4, C-1.2 and I-2.2 and their risk rows against `SaveStatus.tsx` and `latestOpen()` and corrected their text; no status changed. I-3.1 and H-2.3 are still as of 2.3.

**Updated in 2.3** (after the ceilings reached `document-extract`)
- B-3.1 no longer lists the missing ceilings on document reads, and the matching defect and open question are removed. One shared budget serves both functions.

**Updated in 2.2** (after `document-extract` moved onto the adapter)
- F-0.2 no longer lists `document-extract`; what remains is error codes and one live exchange. E-3.1's model call is on the shared adapter. B-3.1 and section 1.3 record that document reads have no per-IP or global ceiling.

**Updated in 2.1** (after the `chamber-extract` fix and the CI check)
- F-0.4 is DONE. F-0.2 stays PARTIAL (error codes, `document-extract`, one live exchange). B-1.1, B-3.1 and B-3.3 lose the 'does not load' remainder. I-4.4 gains the type-check step. Section 1.3 records the defect as fixed, and section 5 no longer lists it as a blocker.

**Dropped**
- **A-1.6** (retire `chamber_sessions`): the table is the canonical store, and the AC contradicts the shipped design.

**Rewritten because the text assumed tokens or edge-function endpoints**
- A-1.5 (expiry), A-2.2 (validation and versioned writes), C-2.1 (certification), C-3.1 (submit), H-3.3 (signed-URL and session-id tests).

**Superseded, with the design that meets the intent** (see D14)
- A-1.1, A-1.2, A-3.1, B-1.2, D-2.1, D-2.2, E-1.1, E-1.3, E-3.2, F-3.3.

**Changed expectations worth a second look**
- E-1.3: the URL lifetime is 60 seconds, not 5 minutes. Shorter is stricter, so the AC should be amended.
- B-3.1: per-user, per-IP and global quotas exist instead of the plan's 30 requests per session per 10 minutes. Decided 2026-11-04: they replace it.
- G-1.1: `last_error` holds the provider's error name and message (addresses replaced by `[email]`, key-like strings by `[redacted]`, 140 characters) rather than the raw response, which can echo the message. Raw provider bodies would put recipient addresses in the queue table and on the advisor page.
- F-4.1: nine pipeline statuses with different names and no transition allow-list.

### Split log (from v1.0)

Earlier drafts sized several broad stories as Medium while they covered several independent deliveries. Those stories were split. Nothing was dropped.

| Earlier story | Covered scope | Now |
|---|---|---|
| A-1 Guest session (Medium, but broad) | Persistence, token, restore, expiry, save UX, migration | A-1.1 to A-1.6 |
| A-2 Structured data with versioning | Schema, validation, hydration | A-2.1 to A-2.3 |
| A-3 Transcript evidence | Storage, restore | A-3.1, A-3.2 |
| B-1 Extraction contract | Contract, merge, follow-up, versioning | B-1.1 to B-1.4 |
| B-2 Confidence and evidence | Badges, open items | B-2.1, B-2.2 |
| B-3 AI failure handling | Timeouts, UX, logging | B-3.1 to B-3.3 |
| C-1 Review experience | Read view, editing, gate | C-1.1 to C-1.3 |
| C-2 Certification | Record, screen, re-certification | C-2.1 to C-2.3 |
| C-3 Submission | Transition, snapshot, confirmation | C-3.1 to C-3.3 |
| D-1 Mapper | Mapping, tests, sample-data removal | D-1.1 to D-1.5 |
| D-2 Manuscript route | Route, errors | D-2.1, D-2.2 |
| D-3 PDF | Layout, metadata, browser checks | D-3.1 to D-3.3 |
| E-1 Uploads | API, UI, isolation | E-1.1 to E-1.3 |
| E-2 Categories | Categories, checklist | E-2.1, E-2.2 |
| E-3 Document processing | Extraction, merge, messages | E-3.1 to E-3.3 |
| E-4 File security (from US-3.4) | Validation, retention, scanning | E-4.1 to E-4.3 |
| F-1 Advisor auth | Roles, routes, states | F-1.1 to F-1.3 |
| F-2 Queue | List, filter | F-2.1, F-2.2 |
| F-3 Detail | Structured view, evidence, edits | F-3.1 to F-3.3 |
| F-4 Status and notes | Statuses, notes, flags | F-4.1 to F-4.3 |
| G-1 Internal notification | Outbox, send, retry | G-1.1 to G-1.3 |
| G-2 Prospect email | Send, bounces | G-2.1, G-2.2 |
| G-3 Operating workflow | Advisor Console mapping (no CRM sync) | G-3.1 to G-3.3 |
| H-1 Retention | Matrix, enforcement, deletion | H-1.1 to H-1.3 |
| H-2 Privacy and consent | Pages, consent gate, copy audit | H-2.1 to H-2.3 |
| H-3 Access tests | Guest, role, signed URL | H-3.1 to H-3.3 |
| H-4 Monitoring | Alerts, runbook, backups | H-4.1 to H-4.3 |
| I-1 Responsive | Chamber, other pages, matrix | I-1.1 to I-1.3 |
| I-2 Accessibility | Keyboard, announcements, contrast | I-2.1 to I-2.3 |
| I-4 Automated tests | Unit, integration, end-to-end, CI | I-4.1 to I-4.4 |
| I-5 Voice | State machine, fallback, failure UX | I-5.1 to I-5.3 |
| Epic 9 (release ops) | Environments, domain, analytics, launch | J-1.1 to J-3.2 |

---

## 9. Global Definition of Done

A story is done only when all of the following are true:

1. Every acceptance criterion passes, and the tests listed in the story pass.
2. Code is reviewed and merged to the default branch through a pull request.
3. CI is green: lint, the edge-function type check, unit tests, build, the SQL tests and the end-to-end test.
4. New or changed data access has an authorization test.
5. No sample or demo values appear in a live-session path.
6. Empty, loading, and error states exist for every new screen.
7. Any new data field is in `docs/intake-schema.md` and in the retention matrix (H-1.1). A new `chamber_data` key is also in the database's field list (`chamber_data_field_kind`) first (A-2.2).
8. Any new log line is checked for sensitive content.
9. Copy that makes a legal or affiliation claim is approved by LEGAL.
10. **New:** a merge that touches an edge function passes `npm run typecheck:functions` before it lands on `main`.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Edge-function type check uses declarations for URL imports, so a wrong remote URL or a wrong call into a remote package is not caught. A broken merge reached `main` with green CI before the check existed. | A function can still fail at deploy or run time on a dependency the check cannot see. | F-0.4 catches local faults. Smoke-test each function after deploy. |
| The browser writes intake data directly under RLS. The database validates `chamber_data` and refuses stale saves (A-2.2), but not the transcript or provenance. | A stale tab's last edits are refused and, if it is closed, lost; provenance and the AI precedence ladder are the client's word, by design (B-1.2). | A-2.2 (built) and the keepalive Note in A-2.2. Precedence stays in the browser by decision: the prospect could save any value as their own edit anyway (B-1.2). |
| The AI functions now import shared code from `supabase/functions/_shared`. A deploy that uploads only a function's own folder would fail to resolve it. | Both AI functions fail to start. | Deploy through the Supabase CLI, which bundles relative imports, and smoke-test a preview deploy first. |
| Deployed environments may differ from `main`. This refresh could not see them. | Statuses here could be wrong about production in either direction. | Confirm deployed function versions, secrets, the cron schedule and Turnstile before the demo. |
| Repeated 'repair main after merge' commits. | Overlapping branches keep breaking `main`. | Smaller pull requests, F-0.4, and required checks on `main`. |
| Decisions D3, D4, D14, D15 stay open. | Blocks the M1 critical path. | Start on the recommended defaults. Revisit at the next review. |
| Guests who upgrade cannot return from another device. | Lost intakes and support load. | D1, A-1.3. |
| Prospect data leaks through a URL or log. | Serious privacy incident. | The session id is not a credential, signed URLs last 60 seconds, log redaction (B-3.3), scan tests (H-3.3). |
| Lenore provider choice changes late. | Extraction behavior shifts. | The adapter (F-0.2) and the extraction eval against a recorded baseline (B-1.4). |
| Voice behaves differently in production. | Users stall at the voice step. | Text-first path, state machine (I-5.1), I-5.2 fallback. |
| Legal copy not approved in time. | Public launch delayed. | Placeholders marked DRAFT (C-2.2, C-2.4). Legal approval is an M3 exit criterion. |
| Single-person knowledge of the stack. | Slow incident response. | Runbook (H-4.2) and named owners (J-3.2). |

---

## 11. Open Questions Left for Discussion

1. Should the first pilot allow prospects to re-enter after submit to supplement information? The plan assumes no, and changes after submit create a new draft version. Today the owner can re-certify and replace the snapshot (C-3.2). Confirm.
2. Should advisors be able to request a prospect re-certify from the advisor view, or only re-open the intake? The plan assumes re-open, then re-certify.
3. Is there a required retention period from an insurer, PEO partner, or regulation that overrides D4?
4. Which `chamber-extract` build is deployed (the fix is on the branch, not necessarily live), and is Turnstile enabled in every deployed environment?
5. Are the CI checks required for merge on `main`? The README asks the owner to set it, and the repo cannot show whether they did.
6. Should an advisor `admin` be able to do more than an `advisor` (delete an intake, grant a role through the app), or is SQL-only management the intent (D5)?
7. A-2.2 shipped on the recommended defaults. Confirm them: the 56 state codes (the 50 states, DC and five territories; military mail codes are refused), the caps (5,000 employees, 20 dependents each, 60 states, 100 list items, 1,000 characters of text, 1,000,000 for counts and salary), refusing unknown top-level keys, validating inserts as well as updates, and checking the phone only on `profiles.phone`, since `chamber_data` has none.
