# Edgar Allan Advisory: Production Readiness Plan

| | |
|---|---|
| **Version** | 2.1 (v1.0 refreshed against the code, then updated after F-0.2 and F-0.4 landed) |
| **Date** | 2026-10-22 |
| **Verified against** | `main` at commit `6f2bf5c` (merge of pull request 21), plus the `chamber-extract` fix and the edge-function type check on branch `claude/peaceful-albattani-neiujl`. v1.0 was verified against `04503c3` (2026-10-20) |
| **Scope** | Everything between the current build and a supervised private pilot (M2) and a public launch (M3) |
| **How it was verified** | Every story was checked against the migrations, functions, front end, tests and docs. `npm ci`, `npm run lint` (0 errors, 8 warnings), `npm run typecheck:functions`, `npm test` (584 tests in 42 files) and `npm run build` all pass. The fixed `chamber-extract` handler was also type-checked and run under Deno 2.9.6 with the network denied. A manual CI run of the branch (run 39857171390) passed both jobs: `verify`, including `typecheck:functions`, and `sql-tests`. **Not run:** any end-to-end test (none exist), and `chamber-extract/index.ts` under Deno (its URL imports are unreachable from the verification environment). Nothing was deployed or tested live, so statuses describe the repository, not a running environment. |

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
| Lenore chat | `chamber-extract` (`handler.ts`, behind a thin `index.ts`) extracts 17 allow-listed fields with a per-field status and evidence quote, and writes a reply. It requires a signed-in user, caps a message at 2,000 characters and context at 20,000, and enforces per-user (15 a minute, 300 a day), per-IP (20 a minute, 400 a day) and global (2,000 a day) call limits that fail closed. Voice (ElevenLabs) is an opt-in beta behind `VITE_ELEVENLABS_AGENT_ID`. |
| Workspace | Nine tabs: Upload, Company, Payroll, Benefits, Your Team (census), Dependents, Review, PEO Match, The Reckoning. Autosave runs 2 seconds after the last change with a 10-second retry. A session survives refresh through `?session=`. |
| Provenance | Each captured field is `confirmed`, `inferred`, `incomplete` or `conflicting`, with a source. The prospect can confirm, edit, or choose between conflicting candidates. An AI value never overwrites a prospect edit. |
| Documents | PDF, Excel, CSV and Word uploads (20 MB, enforced in the browser only) in a private bucket, with seven categories. `document-extract` reads CSV, XLSX/XLS and text PDF into candidate values that the prospect reviews and applies. Word files are saved but not read. |
| PEO match | A sourced PEO catalog. It does not rank PEOs. Every fact is null until sourced, and unknowns show as unknown. The choice is stored in the submission. |
| Certification | Signer name and role, three acknowledgements and a separate sign step, with DRAFT consent text. A database trigger records `chamber_certifications` (server-stamped time, `data_sha256`, consent text and version) and refuses a missing, stale or guest certification. Any later change to the answers, or choosing a different PEO, withdraws it. |
| Manuscript | Rendered from the signed snapshot at `/manuscript?session=<id>` for the signed-in owner. A vector-text PDF (jsPDF) with repeating table headers and page numbers. Date of birth is masked by default. `/manuscript/demo` is a labelled sample. |
| Advisors | Roles `advisor` and `admin` in `user_roles` (granted by SQL). A submission queue with status filter and search. A detail page with field-by-field review, transcript evidence, documents through 60-second signed links, append-only internal notes, a nine-state pipeline with history, and versioned Manuscript PDFs in a private bucket. Prospects see only `submitted`, `under_review` and `information_requested`. |
| Notifications | Certification queues an advisor alert and a prospect confirmation in the same transaction. `dispatch-outbox` sends them through Resend with retries (5 attempts), a frozen-message idempotency design, and a reaper and reconciliation sweep. Needs function secrets and a once-a-minute schedule (`docs/NOTIFICATIONS.md`). |
| Quality gates | CI runs `verify` (lint, edge-function type check, test, build) and `sql-tests` on every pull request. 584 front-end and function unit tests. SQL tests cover certification, guest blocking, documents, provenance, AI limits, the advisor access matrix and the outbox. **No end-to-end tests.** |
| Hosting | `vercel.json` sets a Vite build and a single-page-app rewrite. One Supabase `project_id` is in `supabase/config.toml`. |

### 1.2 Architecture as built, against v1.0

| v1.0 assumed | The code does | Consequence |
|---|---|---|
| Guests return by a token in the URL fragment (D1). | Supabase anonymous auth in browser storage, the session id in `?session=`, owner RLS gates resume. | A row id grants nothing without the owner's JWT, so isolation holds. A guest upgraded by email has no sign-in path back (password-only sign-in), and a bare `/start` always creates a new session. |
| `intake_sessions`, `intake_messages`, `intake_documents`, `intake_submissions`, reachable only through edge functions. | `chamber_sessions` (jsonb data, provenance, transcript, submission), the extended `documents` table, `chamber_certifications`. The browser writes them directly under RLS. | No server-side field validation, no version column, saves are last-write-wins, and two tabs can overwrite each other (A-2.2). |
| `certify` and `submit` endpoints, idempotency keys, reference `EAA-YYYY-NNNN`. | A trigger on the status update records the certification and the snapshot. The reference is `EAA-<year>-<8 hex of the session id>`, built in the browser. | The reference is not unique or server-assigned, and a repeat submit adds another certification row (C-3.1). |
| Manuscript at `/manuscript/:reference#t=`, review at `/review`. | `/manuscript?session=<id>` with a JWT and owner RLS. Review is a tab inside the Chamber. | Viewing needs sign-in. Safe error states exist, but not expired or revoked ones. |
| Advisor access through endpoints with `has_role`. | `user_roles`, `has_role`, `require_advisor()` and RLS on every advisor table and function. | Matches the intent. Tests assert SQL refusals (42501), not HTTP 403s. |
| AI provider behind an adapter. | Built, tested, and now used by `chamber-extract` (it was not, until the fix in section 1.3). | `AI_PROVIDER`, the 20-second timeout, the retry and redacted logs apply. `document-extract` is still Lovable-only. |
| Text PDF with `html2canvas` removed (D12). | jsPDF vector text. `html2canvas` is never imported. | Matches. |
| No `.github/`. | `ci.yml` with `verify` and `sql-tests`. | Matches the intent of I-4.4. Required-for-merge is a repository setting this refresh could not see. |

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

**Still to do:** check which `chamber-extract` build is deployed (it may predate the merge), deploy the fix, and make one real Lenore exchange in a preview environment. Until then the failure and the fix are established from the code, the tests and a Deno run, not from a live call.

#### Other defects

| Defect | Where | Story |
|---|---|---|
| The consent wording is defined twice (`2026-10-draft-1` and an unused `2026-10-v1` with no draft flag). The Manuscript page and PDF print the signed consent with no DRAFT marker. | `certification.ts`, `manuscript.ts` | C-2.4 |
| The reference is not unique or server-assigned, and a repeat submit adds another certification row. | `manuscript.ts`, `useChamberSession.ts` | C-3.1 |
| The owner's update policy lets a prospect write `documents.status`, so it cannot carry a scan verdict. | `20261021100000_session_documents.sql` | E-4.3 |
| Upload limits (20 MB, file types) are enforced only in the browser. The bucket has no size or type limit. | `UploadTab.tsx`, `config.toml` | E-4.1 |
| A save can fail without the prospect knowing: the update has no `.select()` so a zero-row update looks like success, there is no status indicator, and no local backup. | `useChamberSession.ts` | A-1.4 |
| A bare `/start` always inserts a new session, so a returning guest is never resumed and orphan rows accumulate. | `useChamberSession.ts` | A-1.3 |
| An upgraded guest cannot sign back in: nothing sets a password or signs in by emailed code. | `useAuth.tsx` | D1, A-1.3 |
| The advisor queue has no `LIMIT` and the page loads every row. | `20261024100000_advisor_queue.sql` | F-2.1 |
| The opening message tells the prospect the workspace is 'a demonstration'. | `useChamberSession.ts` | A-2.3 |
| Public copy contradicts the role disclosure: 'No account required' while certification needs a verified email, 'Get Your Quote', and `SUBMITTED TO <PEO>` on the Manuscript. | `LandingPage.tsx`, `index.html`, `ManuscriptPage.tsx` | H-2.3 |
| `html2canvas` is a direct dependency that no source file imports. | `package.json` | D-3.1 |

### 1.4 What landed since v1.0

| Date | Work (commit subjects) |
|---|---|
| 2026-10-20 | Sourced PEO catalog replaces invented scoring. Guest intake with an email-verified account at certification. Per-IP and global AI limits with Turnstile. Real data and session recovery from the Reckoning to the Manuscript. Reliable AI calls (timeout, retry, adapter, safe logs, failure UX). Final certification with signer role, versioned consent and a server-side record. Text-based Manuscript PDF with a recorded, re-certifiable submission. Confidence and source for extracted fields. Session-linked uploads, categories and reviewed extraction. Advisor dashboard, pipeline status, field review and versioned Manuscripts. |
| 2026-10-21 | Vercel configuration. Epic E document handling finished. Advisor session states, the access matrix and the searchable queue. CI for lint, tests, build and SQL tests. Advisor and prospect notifications on submission. Re-certification when a different PEO is chosen. A verify skill that drives the app against a local stand-in. |
| 2026-10-22 | Supabase URL and key read from Vercel's integration variables. Outbox hardening: queueing faults heal and sends are frozen so a sender change cannot duplicate. |

Both busy days also include commits titled 'repair main after ... merges' (for example `7260101`, `7e3cd6d`, `b543876`, `d5ad19f`, `1f65822`), which fix breakage from overlapping branches. The `chamber-extract` break came from another merge of that kind, and no later commit repaired it.

### 1.5 Status summary

| Epic | Done | Partial | Superseded | Not started | Not verifiable | Total |
|---|---|---|---|---|---|---|
| 0 Foundations | 1 | 3 | 0 | 0 | 0 | 4 |
| A Durable session | 1 | 4 | 4 | 2 | 0 | 11 |
| B AI extraction | 2 | 4 | 1 | 2 | 0 | 9 |
| C Review, certify, submit | 1 | 7 | 0 | 2 | 0 | 10 |
| D Manuscript | 0 | 7 | 2 | 0 | 1 | 10 |
| E Documents | 5 | 1 | 3 | 2 | 0 | 11 |
| F Advisor | 4 | 6 | 1 | 0 | 0 | 11 |
| G Communications | 2 | 2 | 0 | 4 | 0 | 8 |
| H Security, privacy, legal | 1 | 4 | 0 | 5 | 2 | 12 |
| I Quality and accessibility | 1 | 8 | 0 | 4 | 1 | 14 |
| J Release operations | 0 | 1 | 0 | 3 | 2 | 6 |
| **Total** | **18** | **47** | **11** | **24** | **6** | **106** |

15 of 54 milestone-M1 stories are DONE or SUPERSEDED (intent met); 13 of 39 M2; 1 of 13 M3. The plan now holds 106 stories: v1.0's 104 plus two found during this refresh (F-0.4, C-2.4).

---

## 2. Delivery Principles

1. **Text is the dependable path.** Voice enhances intake and must never block it. *Holds: voice is opt-in and the text input is always present.*
2. **The prospect controls their data.** AI proposes values. The prospect confirms material facts. *Holds in the browser; not enforced by the database (A-2.2).*
3. **No fabricated data.** Unknown underwriting data stays unknown, shown as "Not provided" or listed as an open item. *Holds for the Manuscript and the PEO catalog. Demo data remains in `chamberTypes.ts` (D-1.5).*
4. **Sensitive data stays private.** Census, payroll, benefits, and workers' compensation data are never publicly reachable. *Holds: private buckets, owner and advisor RLS, a test that every public table has row security.*
5. **One source of truth.** The saved intake session feeds the Chamber, the review, the Manuscript, and the advisor view. Submitted packets are frozen as snapshots. *Holds, with the snapshot gaps in C-3.2.*
6. **Every story is independently releasable** and no larger than M.
7. **Access is enforced in the backend.** A hidden button is not access control. *Holds for advisors and prospects through RLS. Upload limits are the exception (E-4.1).*

---

## 3. Decisions

Status is the state of each decision in the code today. Engineering proceeds on the recommended default where the owner has not responded.

| ID | Decision | Status and evidence | Owner | Blocks |
|---|---|---|---|---|
| D1 | How does a guest return to their intake? | **Decided in code, with a different design** (see D14). Supabase anonymous auth persisted in browser storage; the session id in `?session=`; owner RLS gates resume. Email upgrade is a 6-digit code (`updateUser`, then `verifyOtp`), refused if the email already has an account ('we can't yet move your answers'). **Gap:** nothing sets a password or signs in by code, so an upgraded guest cannot return from another device or after clearing storage. | PM | A-1.3 |
| D2 | Minimum data required before certification | **Partly decided, not enforced.** A four-item minimum is reported (company legal name, states of operation, pay frequency, a non-empty census) in the Manuscript open items and the advisor queue, but `certificationBlockers` checks none of it. It differs from the recommended default: there is no EIN field, the contact comes from `profiles.contact_name`, total employee count is not required, and pay frequency is. There is no 'Not applicable' status. | PM + Advisory lead | C-1.3, C-2.1, B-1.3 |
| D3 | Certification and consent wording | **Open.** The placeholder `2026-10-draft-1` is marked DRAFT in the Reckoning. A second, unused wording (`2026-10-v1`) exists (C-2.4). No intake-consent text exists (H-2.2). | LEGAL | C-2.4, H-2.2 |
| D4 | Retention windows | **Open.** No windows in code. Drafts never expire. Only AI rate-limit logs are pruned, after a day. | LEGAL + PM | A-1.5, H-1.x, E-4.2 |
| D5 | Advisor roles and permissions | **Decided and implemented**: `advisor` and `admin` in `user_roles`. In the repo `admin` has no power beyond `advisor` (tests assert it cannot grant roles or delete intakes). | PM | none |
| D6 | CRM or workflow destination | **Open.** No CRM is named. | PM | G-3.1 |
| D7 | Email provider and sender domain | **Decided in code:** Resend, the only adapter. `EMAIL_FROM` has no default and must be on a verified domain. The domain is not named and the verification checklist item is unchecked. | OPS | G-2.1 launch, J-1.2 |
| D8 | Is voice launch-critical? | **Recommended default stands:** an opt-in beta behind a flag, with text always available. | PM | I-5.x scope |
| D9 | Carrier or PEO routing | **Unchanged:** out of scope for M1 to M3. The product tells prospects they send the packet themselves. | PM | none |
| D10 | Legal reviewer for policy, terms and disclosures | **Not recorded in the repo.** | LEGAL | H-2.1, H-2.3 |
| D11 | AI provider for Lenore and document extraction | **Partly decided:** the adapter supports Lovable (default) and Anthropic, and neither is chosen. `document-extract` is Lovable-only with Gemini hard-coded. Voice uses ElevenLabs. No data-processing terms are recorded. | PM + BE | F-0.2, E-3.1 |
| D12 | PDF rendering approach | **Decided and implemented:** browser jsPDF with vector text, lazy-loaded. Server-side rendering has not been revisited. | BE + FE | none |
| D13 | Malware-scanning provider for uploads | **Open.** | OPS | E-4.3 |
| D14 | **New.** Intake access model: keep Supabase Auth with owner RLS, or move to continuation tokens (v1.0 D1)? | **Recommended: keep as built.** It isolates sessions today and is covered by SQL tests. Drop the token stories (A-1.6), amend the envelope AC in A-2.1, and close the gaps it leaves: a return path for upgraded guests, resume of the latest session, and database validation with a version check (A-2.2). | PM + BE | A-1.3, A-2.1, H-3.3 |
| D15 | **New.** Reference format and assignment | **Recommended:** server-assigned `EAA-YYYY-NNNN` from a per-year sequence, recorded with the certification and unique. Today it is `EAA-<year>-<8 hex of the session id>` built in the browser. | PM + BE | C-3.1, D-3.2 |
| D16 | **New.** Advisor visibility: does every advisor see every intake? | **As built: yes**, with no assignment. **Recommended:** keep for a pilot with a small named advisory team and revisit before M3. | PM | F-2.1 |

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
- **Built:** `providers.ts` has a Lovable adapter and an Anthropic adapter, and `selectAdapter` reads `AI_PROVIDER`, `AI_MODEL` and the provider's key (default Lovable with `google/gemini-3-flash-preview`; Anthropic default `claude-haiku-5-5`). `chamber-extract` now goes through it: `handler.ts` calls `callModel` with the selected adapter, so the timeout, retry and redacted failure logs apply, and `schema.ts` is the one copy of the prompt and tool schema. Tested with fakes for both providers, and run under Deno 2.9.6 with the network denied.
- **Remaining:** Errors are still `{error}` with no `code` field (the AC asks for a code and a message). `document-extract` still hard-codes `LOVABLE_API_KEY`, the gateway and Gemini. The one manual Lenore exchange in a preview environment has not been done, and the fixed function has not been deployed or called live.

#### F-0.3 Document the route access map
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** PM + FS · **Depends:** none · **Milestone:** M1
- **Built:** Guards exist: `RequireAuth` on `/start` and `/profile`, `RequireAdvisor` on `/advisor*`. `/manuscript` has no route guard, but the page needs a signed-in user and a `?session=` id and RLS decides what is returned. `/manuscript/demo` is a labelled sample. `docs/ADVISOR_ACCESS.md` documents the two advisor routes.
- **Remaining:** Write `docs/ROUTE_ACCESS.md` covering every route in `src/App.tsx` (including `/login`, `/profile`, `/manuscript`, `/manuscript/demo`) and add the test that fails when a route is missing from it. The guards are named `RequireAuth` and `RequireAdvisor`; there is no `ProtectedRoute`.

#### F-0.4 Type-check and import-check edge functions in CI
- **Status:** **DONE** · **Size:** S · **Priority:** Highest · **Owner:** BE · **Depends:** F-0.2 · **Milestone:** M1
- **Built:** `npm run typecheck:functions` runs `tsc` over `supabase/functions` (`tsconfig.functions.json`, strict, with `types/functions-shims.d.ts` declaring the URL imports) and is a step in the CI `verify` job. Run against the previous `chamber-extract/index.ts` it fails with the two errors that broke the function (TS2440 and TS2304), and it also fails on a bad named import (TS2305), a missing file (TS2307) and an undefined name in another function. `chamber-extract/handler.test.ts` loads and exercises that function's handler.
- **Notes:** It passed on a GitHub runner in a manual CI run of this branch (run 39857171390, where `sql-tests` also passed). The failing case was shown locally with the same command, not on GitHub. The URL imports are declarations, not fetched modules, so a wrong remote URL or a wrong call into a remote package is not caught (the SheetJS declaration covers only what `document-extract/read.ts` uses). Only `chamber-extract` has a handler test; the other functions rely on the type check.

---

### Epic A: Durable Intake Session

*As built:* Sessions live in `chamber_sessions` under Supabase Auth and owner RLS (D14), not in token-gated edge-function tables. Isolation is in place and tested. What is missing is server-side validation and versioning, a visible save state, resume of the latest session, and expiry.

#### A-1.1 Intake session data model
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** D1, D4 · **Milestone:** M1
- **Built:** `chamber_sessions` (migration `20260324031329`) with owner-only RLS for `authenticated` (guests are `authenticated` with the `is_anonymous` claim). Advisors read all rows, read-only (`20261022090000`). The access matrix in `supabase/tests/advisor_operations.sql` covers signed-out, guest, other prospect, advisor and admin.
- **Remaining:** Anonymous denial and cross-owner isolation are met. Not met: `status` is free text (default `in_progress`, `submitted` at certification), not a checked set; there is no `schema_version`, `data_version`, `last_activity_at` or `expires_at`; the browser writes the table directly. The columns arrive with A-1.5 and A-2.2. The token-hash criteria no longer apply (D14).

#### A-1.2 Create a guest session and issue a continuation token
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-1.1, D1 · **Milestone:** M1
- **Built:** `signInAnonymously` (`useAuth.tsx`, `RequireAuth.tsx`) followed by a `chamber_sessions` insert (`useChamberSession.ts`). Turnstile guards guest creation when `VITE_TURNSTILE_SITE_KEY` is set. Per-user, per-IP and global limits cap AI spend (section 1.1), but nothing caps session creation.
- **Remaining:** A row id is useless without the owner's JWT, so the intent holds. No limit on sessions per user or per IP exists in the repo (a Supabase anonymous-sign-in limit would be dashboard configuration, which this refresh could not see). Turnstile is off when the key is unset: set it in every deployed environment. Decide whether to add a creation cap.

#### A-1.3 Restore a session after refresh, with a recovery screen
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** A-1.2, A-2.3, A-3.2 · **Milestone:** M1
- **Built:** The Supabase auth session persists in browser storage and the session id travels in `?session=` (`ChamberPage.tsx`). Resume is gated by RLS. When a session cannot be opened, a recovery screen offers 'Start a new intake' and shows no data. Both are tested.
- **Remaining:** A bare `/start` (landing CTA, navbar, Manuscript link) always inserts a new row, so a returning guest is never resumed and orphan rows accumulate: resume the user's latest open session instead. Two rapid loads or two tabs can create two rows. No warning when browser storage is blocked. The chosen PEO is local state and is lost on refresh. A guest upgraded by email has no cross-device or cleared-storage return path: nothing in `src` sets a password or signs in by emailed code, and `signIn` is password-only (D1).

#### A-1.4 Autosave with visible status and local backup
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-1.2, A-2.2 · **Milestone:** M1
- **Built:** 2-second debounced autosave, a 10-second retry, an in-flight save awaited before the next, and a keepalive request on page unload (up to 60,000 bytes, otherwise a leave-confirm prompt) in `useChamberSession.ts`. Submit waits for pending saves. Tested.
- **Remaining:** No 'Saving / Saved / Not saved' indicator and no Retry action: a failure reaches only `console.error`. No `localStorage` backup, so a failed save is lost on reload. 'Saved' means no PostgREST error: the update has no `.select()`, so an update that matched zero rows looks like success. Add all three.

#### A-1.5 Expiry, archive, and revocation
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** A-1.2, D4 · **Milestone:** M1
- *Revised scope, AC and tests:*
  - **Scope:** Add `last_activity_at` and `expires_at` to `chamber_sessions`. A scheduled job (pg_cron, the same pattern as `dispatch-outbox`) marks drafts idle past the D4 window `expired` and removes their transcript and uploads (H-1.2 covers the purge). 'Start over' archives the old session instead of only dropping its id in the browser.
  - **AC:**
    - The job changes only idle drafts, never a certified or submitted intake, and writes one audit row per session it changes.
    - An expired session opens a 'This intake has expired' state with a restart option.
    - After 'Start over' the old row is archived and unreachable from the Chamber.
  - **Tests:** Expire a session in the scratch database and confirm the expired state. Run the job against a certified session and confirm no change.

#### A-1.6 Retire the legacy `chamber_sessions` path
- **Status:** **SUPERSEDED** · **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** A-1.3 · **Milestone:** M1
- **Built:** `chamber_sessions` stayed the canonical store and is written in `useChamberSession.ts`.
- **Remaining:** Drop this story. Its AC ('no frontend code path writes to `chamber_sessions`') contradicts the shipped design (D14).

#### A-2.1 Canonical intake schema v1
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE + FS · **Depends:** D2 · **Milestone:** M1
- **Built:** `ChamberData` (36 flat fields plus an `employees` array) in `chamberTypes.ts`. Zod rules in `chamberValidation.ts`, used in the browser only. Provenance in a sibling `field_provenance` jsonb column. `docs/intake-schema.md` exists. Zero counts are accepted.
- **Remaining:** No `{value, status, source, updated_at, note?}` envelope: provenance is a sibling map. Recommended: keep the sibling map, since every consumer already reads it, and amend the AC (D14). Statuses lack `not_applicable` and sources lack `advisor_edit` and `system` (advisor changes live in `advisor_field_reviews`). No per-field required-for-submission flag (D2). No workers' comp, EIN or contractor sections. No schema-version constant stored on a session. The edge function keeps its own 17-field copy of the field list. `docs/intake-schema.md` covers provenance only: add the field table and a test that keeps it in sync. Zero-versus-absent is untested, and the Review tab shows 0 as a dash.

#### A-2.2 Server-side validation and versioned writes
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-2.1, A-1.2 · **Milestone:** M1
- *Revised scope, AC and tests:*
  - **Scope:** The browser writes whole-row jsonb straight to `chamber_sessions`, so nothing validates it on the server and saves are last-write-wins. Add a `data_version` column that a trigger increments, and a `BEFORE UPDATE` trigger that validates `chamber_data` (field types, state codes, count ranges). The client sends its last-seen version with each save (`.eq("data_version", n)` plus `.select()`), and treats zero matched rows as a conflict.
  - **AC:**
    - An invalid payload changes nothing and names the field path that failed.
    - A save made from a stale version is refused and the client is told the current version.
    - Invalid numbers, malformed phone numbers, counts below 0 or above 1,000,000, and unsupported state codes are rejected (`stateCode` currently accepts any two letters).
    - A successful save increments `data_version`.
  - **Tests:** One SQL test per rejection type. Two concurrent saves from the same version produce one success and one conflict.

#### A-2.3 Hydrate the Chamber workspace from saved data
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.1, A-2.2 · **Milestone:** M1
- **Built:** The workspace tabs render the hydrated `chamberData` with `isDemo={false}`. Company, Payroll and Benefits show status badges and empty-state text. Sample data appears only on `/manuscript/demo` and in tests.
- **Notes:** Census and Dependents have no badge or edit path. The chosen PEO is not saved (A-1.3). The opening message still tells the prospect the workspace is 'a demonstration' (`OPENING_MESSAGE` in `useChamberSession.ts`): rewrite it.

#### A-3.1 Store transcript messages as ordered rows
- **Status:** **SUPERSEDED** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** A-1.2 · **Milestone:** M1
- **Built:** The transcript is a jsonb array on `chamber_sessions.transcript`, rewritten on each save. Senders are `lenore` and `user`. The prospect's message is added before the model call and kept when the call fails (tested).
- **Remaining:** Order and role are met. Not met: separate rows, server-assigned `seq`, a `system` role, `extraction_status`. Two tabs overwrite each other's transcript. Recommended: keep the array and treat multi-tab editing as unsupported until A-2.2's version check lands.

#### A-3.2 Restore the transcript on resume
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** A-3.1, A-1.3 · **Milestone:** M1
- **Built:** `parseTranscript` runs on resume, the panel scrolls to the latest message, and user and Lenore bubbles are styled differently.
- **Remaining:** No 'Restored from earlier' divider, no system styling, no multi-turn refresh test.

---

### Epic B: Make AI Extraction Auditable and Useful

*As built:* Provenance, conflict handling, confirm-or-edit controls and failure states are built. The extraction function loads and is tested, and the follow-up policy, prompt versioning and golden tests are not started.

#### B-1.1 Extraction response contract and parser
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-2.1 · **Milestone:** M1
- **Built:** `chamber-extract` keeps only 17 allow-listed fields with a per-field `field_status` and `evidence` (up to 200 characters) and returns `{extracted, field_status, evidence, corrected_fields, reply}`; the shaping is in `extraction.ts` and the tool schema now asks the model for all of it. The client's `sanitizeChamberPatch` validates. An empty extraction yields a fallback reply.
- **Remaining:** Invalid fields are dropped one by one in the browser rather than rejecting the whole response. Unknown field paths are dropped without being logged. No contract version is stored with an extraction.

#### B-1.2 Merge policy and conflict capture
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** B-1.1, A-2.2 · **Milestone:** M1
- **Built:** Client-side `applyExtraction` (`provenance.ts`): an AI value never overwrites a `prospect_edit`, a differing AI value makes the field `conflicting` with both candidates, and an explicit correction replaces. Tested.
- **Remaining:** All three ACs hold in intent. Not met: the full precedence ladder (document, then transcript, then system; AI against AI keeps the first value and flags a conflict) and server-side enforcement, since a client can write any value. Revisit when A-2.2 adds database validation.

#### B-1.3 Lenore follow-up policy and completion state
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** Highest · **Owner:** BE + PM · **Depends:** B-1.2, D2 · **Milestone:** M1
- **Built:** The prompt has no missing-field list, no 'ask one item' rule and no 'do not re-ask' rule. Nothing sets `ready_for_review`.
- **Remaining:** Needs D2 first.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Compute the list of missing required fields and conflicts on the server. Pass the top priority items into the prompt. Lenore asks about one missing item per turn and does not re-ask a confirmed field. The session becomes `ready_for_review` when every required field is confirmed or marked not applicable and no conflicts remain.
  - **AC:**
    - The prompt contains the next missing required field.
    - Lenore never re-asks a `confirmed` field in a test transcript.
    - `ready_for_review` is set only by the server, when the rule holds.
  - **Tests:** Scripted transcript fills required fields in order and reaches `ready_for_review`. Scripted transcript with a conflict stays out of `ready_for_review`.

#### B-1.4 Prompt versioning and golden-transcript fixtures
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-1.1 · **Milestone:** M1
- **Built:** No prompt version is recorded and there are no golden transcripts.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Store the prompt version on every extraction. Create 10 golden transcripts with expected extractions and run them in CI with a stubbed model.
  - **AC:**
    - Each extraction row records the prompt and contract version.
    - Golden tests fail when the parser output changes for a fixture.
  - **Tests:** Golden suite runs in CI with the stub.

#### B-2.1 Provenance badges and confirm-or-edit controls
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** B-1.2 · **Milestone:** M2
- **Built:** Status badges, Confirm and Edit/Add controls, conflict candidates with 'Use this', and a 'Needs your review' list in the Review tab. Confirm sets source `prospect_edit`. Tested (`ProvenanceField.test.tsx`).
- **Notes:** The copy differs from the plan: 'Lenore inferred this' with a Confirm button.

#### B-2.2 Derive open items from the schema
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-1.2, A-2.1 · **Milestone:** M1
- **Built:** `fieldOpenItems` derives 'Conflicting answers', 'Incomplete' and 'Please confirm', and items clear when the issue is resolved. The Manuscript adds `<field> not provided` for the four core items.
- **Remaining:** Derived in the browser, not on the server. No 'Document needed' reason (missing recommended documents show as an informational line in Review). The reasons differ from the approved four.

#### B-3.1 Timeouts, retries, and rate limits
- **Status:** **PARTIAL** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** B-1.1, F-0.2 · **Milestone:** M1
- **Built:** `model.ts` has a 20-second timeout and one retry after 1 second on 429, 5xx or a network error (none on 402 or other 4xx). The handler now calls it, and `handler.test.ts` covers a retry that succeeds, a persistent 429, a 500, a 402 and a stalled provider (504). Quotas exist: per user 15 a minute and 300 a day, per IP 20 a minute and 400 a day, and a global 2,000 a day that fails closed with a 503.
- **Remaining:** The limits differ from the plan's 30 per session per 10 minutes, and no session-level limit exists: decide whether the per-user, per-IP and global quotas replace it. Errors are `{error}` with no `code`.

#### B-3.2 User-facing failure states
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** B-3.1 · **Milestone:** M1
- **Built:** 'Try again' and 'Continue manually', the prospect's message stays, and the input is never disabled. Tested for a 502, a thrown error, retry and dismiss.
- **Notes:** No client-side timeout: `pending` lasts as long as `functions.invoke` takes.

#### B-3.3 Operational logs with redaction
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-3.1 · **Milestone:** M1
- **Built:** `failureLogLine` and `unexpectedErrorLine` emit only fixed fields (request id, provider, kind, status, attempts, latency), and the handler uses them: the raw provider body is no longer logged. Tests assert that a provider body and an unexpected error's message appear in neither the logs nor the response.
- **Remaining:** No session id is logged or sent, so a failure cannot be found by session.

---

### Epic C: Review, Certification, and Submission

*As built:* Certification and submission are a database trigger on `chamber_sessions` plus a client update, not endpoints. The signed snapshot is real and enforced by the database. Missing: a readiness gate, a material-field list, a server-assigned unique reference, and idempotent submit.

#### C-1.1 Read-only review by Manuscript section
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.3 · **Milestone:** M1
- **Built:** The Review tab (tab 7 of the workspace) shows the live session only. There is no `/review` route: owner RLS replaces the token.
- **Remaining:** No per-section status (Complete, Needs confirmation, Incomplete, Not applicable) and no D2 rules. Review shows eligibility, six company fields, census and documents; benefits, payroll, dependents, workers' comp and open items are missing. Only documents are tested.

#### C-1.2 Inline editing that writes to the canonical record
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** C-1.1, A-2.2 · **Milestone:** M1
- **Built:** Company, Payroll and Benefits edits go through `ProvenanceField` and `applyFieldAction` (source `prospect_edit`). Invalid input is refused. Autosave writes through supabase-js.
- **Remaining:** The edit is local and optimistic: the prospect does not see it after server confirmation, and there is no save status (A-1.4). Census and dependents are read-only. The Review tab edits only flagged items. No edit, reload, confirm test.

#### C-1.3 Readiness gate with jump links
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** C-1.1, B-2.2, D2 · **Milestone:** M1
- **Built:** `certificationBlockers` checks only email verification, file id, acknowledgements, signer name, role and signature. The four-item minimum (company legal name, states, pay frequency, a non-empty census) exists only as reporting, in the advisor `missing_required` and the Manuscript open items.
- **Remaining:** Needs D2 and D16 first.
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
- **Remaining:** The reference is `EAA-<year>-<8 hex of the session id>`, made in the browser: not `EAA-YYYY-NNNN`, not unique-constrained, not server-assigned (D15). No idempotency key: submitting again adds another certification row. No double-submit test.
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
- **Built:** Census, dependent tiers and benefits are mapped. Zero counts render as `0`.
- **Remaining:** No payroll section (vendor and frequency sit in company rows). No census by state and coverage level. The full employee list (name, date of birth, salary) appears in the Manuscript body, where the plan says to keep it out unless underwriting needs it (D2). No zero, partial and full fixture test.

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
- **Built:** The list loads by session. Remove deletes the row then the object and restores the row on failure. Tested.
- **Notes:** Progress is a spinner, not a percentage.

#### E-1.3 Document access isolation
- **Status:** **SUPERSEDED** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** E-1.1 · **Milestone:** M1
- **Built:** No tokens. The storage select policy needs the folder to equal `auth.uid()` and an owned intake. Only advisors get signed URLs (`SIGNED_URL_SECONDS = 60`). Prospects have no download UI. Cross-user reads are denied in `session_documents.sql`.
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
- **Notes:** Word files are saved but not read. Census rows never go to the model; free text does. `read.ts` has no tests (Deno-only imports) and the scanned-PDF path is untested. Still Lovable/Gemini only (F-0.2).

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
- **Built:** The storage key is sanitised plus a UUID. Advisor links request a download. `sniffFormat` identifies files by signature inside `document-extract`.
- **Remaining:** Nothing is enforced on the server: the 20 MB cap is client-only (`UploadTab`), the bucket has no `file_size_limit` or `allowed_mime_types`, and there is no 25-file cap. A renamed non-PDF is stored and only later marked `unsupported`. `file_name` is stored raw. No test for `Content-Disposition`. The plan's cap is 10 MB. Set bucket limits and add a row-level count check.

#### E-4.2 Document retention and deletion
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** E-1.1, H-1.2 · **Milestone:** M2
- **Built:** No purge job, schedule or `expires_at` exists.
- **Remaining:** A foreign-key cascade does not remove storage objects, so the purge must delete them explicitly.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Apply the D4 retention rule to documents. Expired or abandoned documents are deleted along with their storage objects. The deletion writes an audit row.
  - **AC:**
    - Expired draft documents are removed from the database and storage.
    - Submitted-session documents follow the submitted retention rule.
    - Each deletion writes an audit row.
  - **Tests:** Run the purge against fixtures and confirm removal from both locations.

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
- **Built:** `advisor_list_submissions` returns the required columns and no census or payroll. Row-to-detail is tested.
- **Remaining:** No server-side pagination: the function has no `LIMIT` and the page loads every row (the plan says 25 a page). The sort is certified-first then recently active drafts, not 'newest submitted first'. 'Authorized' means every advisor sees every intake (D16).

#### F-2.2 Filter and search
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** F-2.1 · **Milestone:** M2
- **Built:** The status filter runs in the database. Search runs in the browser (every word must match). Loading, empty, no-match and error states. Tested.
- **Remaining:** No 3-character minimum. Search is not server-side, which matters once F-2.1 paginates.

#### F-3.1 Submission detail: structured sections
- **Status:** **PARTIAL** · **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-2.1, C-3.2 · **Milestone:** M2
- **Built:** The detail page uses the certified snapshot when there is one. Each field shows its status, its source and a separate 'Advisor correction' block.
- **Remaining:** Not grouped by Manuscript section (a flat list of 38 fields plus a census table). No distinct 'advisor-updated' badge. `loadSubmission` is untested.

#### F-3.2 Transcript evidence and documents in detail
- **Status:** **DONE** · **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-3.1, E-1.3, B-2.1 · **Milestone:** M2
- **Built:** 'View in transcript' scrolls to and highlights the source message. Documents open through 60-second signed links. Tested.
- **Notes:** The link exists only for transcript-sourced fields whose message still exists. No test for the document link or its expiry.

#### F-3.3 Advisor edits tracked separately
- **Status:** **SUPERSEDED** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** F-3.1, D-1.1 · **Milestone:** M2
- **Built:** `advisor_field_reviews` (corrected value, reason, user, time) and append-only `advisor_review_events`. Manuscript versions pin the review event. Tests assert three events and an unchanged prospect snapshot.
- **Remaining:** Intent met. Differences: an edit does not create version v+1 by itself (the advisor regenerates it); a correction applies only once the field is 'Verified'; the census cannot be corrected; only 38 allow-listed fields can be reviewed.

#### F-4.1 Status model and history
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Medium · **Owner:** BE · **Depends:** F-2.1 · **Milestone:** M2
- **Built:** `submission_workflow` and append-only `submission_status_history` (who, when, from, to, note). Every change writes history. Tested.
- **Remaining:** Nine statuses against the plan's ten: draft, submitted, under_review, information_requested, sent_to_carrier, quoted, won, lost, archived. 'Ready for market' is absent, 'Sent to PEO' is `sent_to_carrier` and 'Quote received' is `quoted`. No transition allow-list: an advisor can move any status to any non-draft status, including archived to under_review. No matrix test.

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

*As built:* The outbox and both emails are built and unusually well hardened. Gaps are an admin retry path, the schedule in a migration, bounce handling and the CRM.

#### G-1.1 Outbox and event dispatch
- **Status:** **PARTIAL** · **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** C-3.1 · **Milestone:** M2
- **Built:** `outbox_events` is unique on (kind, session id and data hash). Five attempts with delays of 1 minute, 5 minutes, 30 minutes and 2 hours, then `dead`. The reliability design (frozen message with an idempotency key, reaper, reconciliation sweep, `outbox_queued_at`) is described in `docs/NOTIFICATIONS.md`. Tested.
- **Remaining:** Unique per kind and certified data, not per submission: re-certified, changed answers queue a new 'Updated intake' alert (by design). No admin view of `dead` events (SQL only). The every-minute schedule exists only as documented SQL, not in a migration.

#### G-1.2 Internal new-submission notification
- **Status:** **DONE** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** G-1.1, D7 · **Milestone:** M2
- **Built:** The advisor alert carries company, contact name, reference and a link to the review page. Tested.
- **Notes:** The alert also includes the contact's email and phone, beyond the plan (documented). No real-inbox send is recorded; the pre-launch checklist is unchecked.

#### G-1.3 Retry failed notifications
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** G-1.1, F-1.2 · **Milestone:** M2
- **Built:** `requeue_outbox_event(id, rebuild)` exists and is tested.
- **Remaining:** Service-role SQL only: no admin-callable path and no queue page.

#### G-2.1 Prospect confirmation email
- **Status:** **DONE** · **Size:** M · **Priority:** Medium · **Owner:** BE + DES · **Depends:** G-1.1, D7, D10 · **Milestone:** M3
- **Built:** A confirmation email with company, reference, next step, expected response time and support address (also Reply-To). It is queued in the certification transaction, goes only to the account's own email, and a send failure never touches the submission.
- **Notes:** Plain-text header, no logo. `PROSPECT_RESPONSE_TIME` and `SUPPORT_EMAIL` have no default, so unset means not sent. The pre-launch checklist is unchecked.

#### G-2.2 Bounce and suppression handling
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Medium · **Owner:** BE · **Depends:** G-2.1 · **Milestone:** M3
- **Built:** No webhook, suppression table or flag exists.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Process provider bounce webhooks. Mark the address undeliverable and flag the submission for advisor follow-up.
  - **AC:**
    - A bounce flags the submission in the queue.
    - Suppressed addresses are not emailed again.
  - **Tests:** Replay a bounce webhook fixture.

#### G-3.1 CRM selection and field-mapping specification
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Medium · **Owner:** PM + BE · **Depends:** D6 · **Milestone:** M3
- **Built:** No CRM is named or mapped.
- **Remaining:** Blocked on D6.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Document the mapping for company, contacts, employee count, states, submission ID, status, and packet reference. Document ownership of each field.
  - **AC:**
    - Every mapped field lists its source and target.
    - No target field receives a public document URL.
  - **Tests:** Review against the mapping checklist.

#### G-3.2 CRM sync worker
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** Medium · **Owner:** BE · **Depends:** G-3.1, F-4.1, G-1.1 · **Milestone:** M3
- **Built:** The outbox `kind` check allows only the two email kinds.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Upsert a lead keyed on the submission reference. Log every sync attempt.
  - **AC:**
    - Repeated submits update one lead, not many.
    - Each attempt is logged with status.
  - **Tests:** Sync the same submission twice and confirm one lead.

#### G-3.3 Sync failure visibility and retry
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Medium · **Owner:** FS · **Depends:** G-3.2 · **Milestone:** M3
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Show failed syncs in the admin queue with a retry action.
  - **AC:**
    - A failed sync appears in the queue.
    - Retry produces one lead.
  - **Tests:** Forced failure, then retry.

---

### Epic H: Security, Privacy, and Legal Readiness

*As built:* Authorization tests are strong. Retention, deletion, privacy and terms pages, consent gate, alerting and the runbook are not started.

#### H-1.1 Data classification and retention matrix
- **Status:** **NOT VERIFIABLE** · **Size:** S · **Priority:** Highest · **Owner:** LEGAL + PM · **Depends:** D4 · **Milestone:** M2
- **Built:** No matrix exists. `docs/NOTIFICATIONS.md` notes that outbox rows keep recipient addresses and should be folded into D4.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Document each data class (contact, business, census, dependent, benefits, payroll, workers' comp, documents, transcripts, PDFs, audit records) with retention and deletion rules.
  - **AC:**
    - Every stored data class has a rule.
    - The matrix is approved by LEGAL.
  - **Tests:** Checklist review against the schema.

#### H-1.2 Automated retention enforcement
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** H-1.1, A-1.5 · **Milestone:** M2
- **Built:** Only `ai_request_log` and `ai_ip_log` rows older than a day are pruned, inline.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Scheduled job that applies the matrix to sessions, transcripts, documents, and generated PDFs. Writes an audit row per deletion.
  - **AC:**
    - Expired records and objects are removed.
    - Submitted records are not removed by the draft rule.
    - Every deletion is audited.
  - **Tests:** Fixture run confirms each class.

#### H-1.3 Deletion request workflow
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** H-1.2, F-1.2 · **Milestone:** M2
- **Built:** No delete function exists: nobody, admin included, can delete an intake (tested). Foreign-key cascades from `chamber_sessions` reach documents, certifications, workflow, notes, reviews and the outbox, but not storage objects. Status history, audit rows and `manuscript_versions` have no foreign key on purpose.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Admin deletes a submission, which cascades to its rows and files. The action is logged.
  - **AC:**
    - After deletion, no row or file for the submission remains.
    - The audit log records the action and the admin.
  - **Tests:** Delete a submission with documents and confirm full removal.

#### H-2.1 Privacy policy and terms pages
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Highest · **Owner:** LEGAL + FE · **Depends:** D10 · **Milestone:** M2
- **Built:** No privacy or terms routes exist, and the landing footer does not link to either.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Publish privacy policy and terms from the site footer. Copy is approved by LEGAL.
  - **AC:**
    - Both pages are reachable from every page.
    - Copy is marked approved by LEGAL before publication.
  - **Tests:** Link check on all routes.

#### H-2.2 Intake consent gate
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** A-1.2, D3 · **Milestone:** M1
- **Built:** Consent exists only at certification. No control gates the intake fields.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Consent checkbox before the first sensitive field. Store the consent version and timestamp on the session.
  - **AC:**
    - Sensitive fields are disabled until consent is recorded.
    - The consent record stores the version.
  - **Tests:** Attempt a sensitive field without consent. Confirm consent record.

#### H-2.3 Role-disclosure copy audit
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** LEGAL + PM · **Depends:** H-2.1 · **Milestone:** M2
- **Built:** `copy.guard.test.ts` bans named PEOs and phrases like 'on my behalf' in five files. Consent line 3 says Edgar Allan Advisory does not submit.
- **Remaining:** No LEGAL or PM audit record. Residual copy that implies affiliation or contradicts the consent: the Manuscript's `SUBMITTED TO <PEO>` and 'Certified Submission' (page and PDF); 'Get Your Quote' on the landing page; 'AI-native PEO brokerage' in `index.html`; and 'No account required' while certification needs a verified email.

#### H-3.1 Guest isolation tests
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-1.2, E-1.3 · **Milestone:** M2
- **Built:** `session_documents.sql` covers cross-user read, insert, object store, move, update and delete. The access matrix covers signed-out, guest, other prospect and advisor-as-guest.
- **Remaining:** Not tested: a cross-user download or signed URL, and expired or revoked sessions. The SQL tests run on stubbed `auth` and `storage` schemas, not the real Supabase APIs.

#### H-3.2 Prospect versus advisor permission tests
- **Status:** **DONE** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** F-1.2, F-2.1 · **Milestone:** M2
- **Built:** `advisor_operations.sql` has 7 callers by 13 sources with exact row counts, function refusals, write denials, and a catalogue check that every public table has row security. The `sql-tests` CI job runs it. The outbox is covered separately.
- **Notes:** The catalogue covers only what that file loads. Advisors see all intakes. No HTTP-level test.

#### H-3.3 Signed URL and fragment-token tests
- **Status:** **NOT STARTED** · **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** D-2.1, E-1.3 · **Milestone:** M2
- *Revised scope, AC and tests:*
  - **Scope:** Test that advisor signed URLs expire (60 seconds) and that no credential appears in a URL or log. The fragment-token tests no longer apply (D14). The session id in `?session=` is not a credential, so add a test that it grants nothing without the owner's JWT.
  - **AC:**
    - An expired signed URL is denied.
    - A request with a valid session id and no matching JWT returns no data.
    - Function logs contain no signed URL or token for a known test value.
  - **Tests:** Expiry test, session-id-without-JWT test, log scan.

#### H-4.1 Alerts for failed uploads, submits, AI calls, and auth
- **Status:** **PARTIAL** · **Size:** M · **Priority:** High · **Owner:** OPS · **Depends:** G-1.1, B-3.3 · **Milestone:** M2
- **Built:** `dispatch-outbox` emits alert-grade log lines (`OUTBOX_DEAD`, `OUTBOX_ENQUEUE_FAILED`, `OUTBOX_RECONCILE_ERROR`, `OUTBOX_REAP_ERROR`). `.claude/skills/verify` forces failures locally.
- **Remaining:** No alert configuration exists for any category. No upload, AI or auth alerting; `document-extract` only calls `console.error`. The `docs/NOTIFICATIONS.md` checklist item is unchecked.

#### H-4.2 Incident runbook and escalation contacts
- **Status:** **PARTIAL** · **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** H-4.1 · **Milestone:** M2
- **Built:** `docs/NOTIFICATIONS.md` 'Operating' has a log-line-to-action table and recovery SQL.
- **Remaining:** No `docs/RUNBOOK.md`: escalation contacts, rollback steps, and sections for uploads, AI and auth are missing.

#### H-4.3 Backup and restore verification
- **Status:** **NOT VERIFIABLE** · **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** J-1.1 · **Milestone:** M2
- **Built:** No backup or restore document or drill record exists.
- **Remaining:** Depends on J-1.1.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Document backup frequency and perform one restore drill on staging.
  - **AC:**
    - A restore from backup succeeds on staging and is recorded.
  - **Tests:** Restore drill record.

---

### Epic I: Quality, Accessibility, and Release Readiness

*As built:* Unit tests and CI exist. End-to-end tests, responsive and accessibility verification, and the voice state machine do not.

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
- **Remaining:** AI replies have no live region. There is no save status to announce. Upload progress is not announced. Sonner toast announcements are unverified. No screen-reader run.

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
- **Built:** `npm test` runs Vitest with 584 tests in 42 files, including `chamberValidation.test.ts` and `provenance.test.ts`. `src/test` holds only `setup.ts`, so the placeholder is gone.

#### I-4.2 Integration test harness on local Supabase
- **Status:** **PARTIAL** · **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** J-1.1, A-1.2 · **Milestone:** M1
- **Built:** `supabase/tests/run.sh` gives each SQL file a fresh database from one command. The CI `sql-tests` job covers certification, guest block, outbox, advisor, documents, provenance and AI limits.
- **Remaining:** Plain Postgres with a stubbed `auth` schema, not local Supabase. No seed data. No create, save, certify and submit run through the real API. `certification.sql` runs as a superuser (`advisor_operations.sql` does use `SET ROLE`).

#### I-4.3 End-to-end test: intake to PDF
- **Status:** **NOT STARTED** · **Size:** M · **Priority:** Highest · **Owner:** QA + FE · **Depends:** I-4.2, D-3.2 · **Milestone:** M1
- **Built:** There are zero end-to-end specs. `playwright.config.ts` is a bare `createLovableConfig({})`, and no script or CI step runs it.
- *Scope, AC and tests (from v1.0):*
  - **Scope:** Playwright test: text intake, review, certify, submit, and PDF download.
  - **AC:**
    - The test completes the full path and asserts the reference and PDF file name.
  - **Tests:** The test is the test.

#### I-4.4 CI pipeline that gates releases
- **Status:** **PARTIAL** · **Size:** S · **Priority:** Highest · **Owner:** OPS · **Depends:** I-4.1, I-4.2, I-4.3 · **Milestone:** M1
- **Built:** `ci.yml` runs `verify` (lint, edge-function type check, test, build) and `sql-tests` on every pull request and on pushes to `main`.
- **Remaining:** No end-to-end job. Whether the checks are required for merge is not verifiable from the repo: `README.md` asks the owner to set it. The edge-function type check (F-0.4) is in `verify` and passed in a manual run on this branch.

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
| 0: put the fix in front of users | Confirm which build of `chamber-extract` is deployed, deploy the fixed one, and make one real Lenore exchange in preview (the open part of F-0.2). | The fix is verified in code, tests, a Deno run and a CI run, not live. |
| 1: close the M1 demo gaps | C-2.4, C-3.1, D-1.5, A-1.3, A-1.4, A-2.2, C-1.1, C-1.2, C-1.3, C-2.1, C-2.3, C-3.3, H-2.2, I-3.1, I-4.3, I-4.4 (add the function check), F-0.1 (history scan), F-0.3, J-1.1 | The M1 stories that decide whether the intake-to-PDF path can be demonstrated, plus the end-to-end test that proves it. C-1.3, C-2.1 and B-1.3 wait for D2. C-2.4 and H-2.2 wait for D3 wording but can ship the structure now. C-3.1 waits for D15. |
| 2: gate the private pilot (M2) | All M2 stories, plus the M1-tagged hardening stories that do not block the demo path: A-1.5, A-3.2, B-1.1, B-1.3, B-1.4, B-2.2, D-1.1 to D-1.4, D-2.2, D-3.1 to D-3.3, E-4.1, I-4.2. In practice: E-4.1, E-4.3, E-4.2, F-2.1, F-4.1, F-4.3, G-1.1 (schedule in a migration), G-1.3, H-1.1 to H-1.3, H-2.1, H-2.3, H-3.1, H-3.3, H-4.1 to H-4.3, I-1.x, I-2.x | Retention, deletion, upload hardening, an admin view of failed emails, legal pages, alerting, a runbook, and accessibility. Most wait on D3, D4, D10 and D13. |
| 3: public launch (M3) | G-2.2, G-3.x, I-5.x, J-1.2, J-2.x, J-3.x | Bounces, CRM, voice reliability, domain, analytics and the launch checklist. G-3.x waits for D6. |

**Critical path to a credible demo:** `A-2.2 → C-1.3 → C-2.1 → C-3.1 → D-1.5 → I-4.3`. D2 and D15 must close before C-1.3 and C-3.1 start.

---

## 6. Milestone Exit Criteria

### Milestone 1: Internal Demo

| Criterion | Status |
|---|---|
| All M1 stories are done. | **Not met.** 15 of 54 are DONE or SUPERSEDED. |
| A test prospect completes text intake, review, certification, submission, and PDF download with real data. | **Not yet shown.** The chat path is fixed in code and tested with fakes, but is not deployed or exercised live. The workspace tabs, certification and PDF exist, and no end-to-end test (I-4.3) records a full run. |
| No "Meridian" text appears in the live path. | **Mostly met.** The live Manuscript never renders the sample (tested). 'Meridian Creative Group' remains in `chamberTypes.ts` and an `AuthPage` placeholder (D-1.5). |
| Two sessions cannot access each other's data (automated test). | **Met at the database level.** The SQL matrix covers cross-user reads and writes and runs in CI (not run in this refresh). There is no HTTP-level test. |
| Internal testers can repeat the flow without developer help. | **Not verifiable.** |

### Milestone 2: Private Pilot

| Criterion | Status |
|---|---|
| All M2 stories are done. | **Not met.** 13 of 39 are DONE or SUPERSEDED. |
| Advisors can review, manage status, and see notifications. | **Largely met in code:** queue, detail, field review, notes, status history, versioned Manuscripts, alert emails. Email needs secrets, a verified sender and the schedule. |
| Retention and deletion run on schedule. | **Not met.** Nothing exists (H-1.2, H-1.3, E-4.2, A-1.5). |
| Privacy policy and terms are approved by LEGAL. | **Not met.** No pages exist (H-2.1). |
| Authorization, upload, and isolation tests pass in CI. | **Authorization and isolation met** in the SQL tests. **Upload not met:** server-side limits, cross-user download and signed-URL expiry are untested (E-4.1, H-3.1, H-3.3). |
| Runbook, alerts, and backup drill are complete. | **Not met.** A log-line table exists for the outbox only (H-4.1 to H-4.3). |

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
| A-1.3 | Restore a session after refresh, with a recovery screen | M | Highest | M1 | PARTIAL |
| A-1.4 | Autosave with visible status and local backup | M | Highest | M1 | PARTIAL |
| A-1.5 | Expiry, archive, and revocation | M | High | M1 | NOT STARTED |
| A-1.6 | Retire the legacy `chamber_sessions` path | S | High | M1 | SUPERSEDED |
| A-2.1 | Canonical intake schema v1 | M | Highest | M1 | PARTIAL |
| A-2.2 | Server-side validation and versioned writes | M | Highest | M1 | NOT STARTED |
| A-2.3 | Hydrate the Chamber workspace from saved data | M | Highest | M1 | DONE |
| A-3.1 | Store transcript messages as ordered rows | S | High | M1 | SUPERSEDED |
| A-3.2 | Restore the transcript on resume | S | High | M1 | PARTIAL |
| B-1.1 | Extraction response contract and parser | M | Highest | M1 | PARTIAL |
| B-1.2 | Merge policy and conflict capture | M | Highest | M1 | SUPERSEDED |
| B-1.3 | Lenore follow-up policy and completion state | M | Highest | M1 | NOT STARTED |
| B-1.4 | Prompt versioning and golden-transcript fixtures | S | High | M1 | NOT STARTED |
| B-2.1 | Provenance badges and confirm-or-edit controls | M | High | M2 | DONE |
| B-2.2 | Derive open items from the schema | S | High | M1 | PARTIAL |
| B-3.1 | Timeouts, retries, and rate limits | M | High | M1 | PARTIAL |
| B-3.2 | User-facing failure states | S | High | M1 | DONE |
| B-3.3 | Operational logs with redaction | S | High | M1 | PARTIAL |
| C-1.1 | Read-only review by Manuscript section | M | Highest | M1 | PARTIAL |
| C-1.2 | Inline editing that writes to the canonical record | M | Highest | M1 | PARTIAL |
| C-1.3 | Readiness gate with jump links | M | Highest | M1 | NOT STARTED |
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
| E-4.2 | Document retention and deletion | M | High | M2 | NOT STARTED |
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
| G-1.1 | Outbox and event dispatch | M | High | M2 | PARTIAL |
| G-1.2 | Internal new-submission notification | S | High | M2 | DONE |
| G-1.3 | Retry failed notifications | S | High | M2 | PARTIAL |
| G-2.1 | Prospect confirmation email | M | Medium | M3 | DONE |
| G-2.2 | Bounce and suppression handling | S | Medium | M3 | NOT STARTED |
| G-3.1 | CRM selection and field-mapping specification | S | Medium | M3 | NOT STARTED |
| G-3.2 | CRM sync worker | M | Medium | M3 | NOT STARTED |
| G-3.3 | Sync failure visibility and retry | S | Medium | M3 | NOT STARTED |
| H-1.1 | Data classification and retention matrix | S | Highest | M2 | NOT VERIFIABLE |
| H-1.2 | Automated retention enforcement | M | Highest | M2 | NOT STARTED |
| H-1.3 | Deletion request workflow | S | High | M2 | NOT STARTED |
| H-2.1 | Privacy policy and terms pages | S | Highest | M2 | NOT STARTED |
| H-2.2 | Intake consent gate | S | Highest | M1 | NOT STARTED |
| H-2.3 | Role-disclosure copy audit | S | High | M2 | PARTIAL |
| H-3.1 | Guest isolation tests | M | Highest | M2 | PARTIAL |
| H-3.2 | Prospect versus advisor permission tests | M | Highest | M2 | DONE |
| H-3.3 | Signed URL and fragment-token tests | S | High | M2 | NOT STARTED |
| H-4.1 | Alerts for failed uploads, submits, AI calls, and auth | M | High | M2 | PARTIAL |
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
| I-4.3 | End-to-end test: intake to PDF | M | Highest | M1 | NOT STARTED |
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
- B-3.1: per-user, per-IP and global quotas exist instead of the plan's 30 requests per session per 10 minutes.
- G-1.2: the advisor alert includes the contact's email and phone, which the story did not ask for.
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
| G-3 CRM | Spec, worker, visibility | G-3.1 to G-3.3 |
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
3. CI is green: lint, the edge-function type check, unit tests, build and the SQL tests now; end-to-end once I-4.3 lands.
4. New or changed data access has an authorization test.
5. No sample or demo values appear in a live-session path.
6. Empty, loading, and error states exist for every new screen.
7. Any new data field is in `docs/intake-schema.md` and in the retention matrix (H-1.1).
8. Any new log line is checked for sensitive content.
9. Copy that makes a legal or affiliation claim is approved by LEGAL.
10. **New:** a merge that touches an edge function passes `npm run typecheck:functions` before it lands on `main`.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Edge-function type check uses declarations for URL imports, so a wrong remote URL or a wrong call into a remote package is not caught. A broken merge reached `main` with green CI before the check existed. | A function can still fail at deploy or run time on a dependency the check cannot see. | F-0.4 catches local faults. Smoke-test each function after deploy. |
| The browser writes intake data directly, with no server validation or version check. | Bad or overwritten data, with two tabs overwriting each other. | A-2.2 (database validation and a version column). |
| Deployed environments may differ from `main`. This refresh could not see them. | Statuses here could be wrong about production in either direction. | Confirm deployed function versions, secrets, the cron schedule and Turnstile before the demo. |
| Repeated 'repair main after merge' commits. | Overlapping branches keep breaking `main`. | Smaller pull requests, F-0.4, and required checks on `main`. |
| Decisions D2, D3, D4, D14, D15 stay open. | Blocks the M1 critical path. | Start on the recommended defaults. Revisit at the next review. |
| Guests who upgrade cannot return from another device. | Lost intakes and support load. | D1, A-1.3. |
| Prospect data leaks through a URL or log. | Serious privacy incident. | The session id is not a credential, signed URLs last 60 seconds, log redaction (B-3.3), scan tests (H-3.3). |
| Lenore provider choice changes late. | Extraction behavior shifts. | The adapter (F-0.2) and golden fixtures (B-1.4). |
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

