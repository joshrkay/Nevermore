# Edgar Allan Advisory: Production Readiness Plan

| | |
|---|---|
| **Version** | 1.0 (initial backlog) |
| **Date** | 2026-10-20 |
| **Verified against** | branch `claude/brave-wozniak-74ku0w`, commit `04503c3` |
| **Scope** | Everything between the current prototype and a supervised private pilot (M2) and a public launch (M3) |

---

## 0. How to Read This Document

### 0.1 Sizing rules

| Size | Meaning |
|---|---|
| **S (Small)** | One focused UI, copy, validation, or configuration change. Roughly 0.5 to 1.5 engineer-days. |
| **M (Medium)** | One coherent feature across a few frontend and backend components. Roughly 2 to 4 engineer-days. |
| **L (Large)** | **Not used.** Anything that would be Large is split into S or M stories below. |

Every story in this document is S or M. Section 8 logs how each earlier draft story was split.

### 0.2 Story format

Each story lists:

- **Owner**: `FE` frontend, `BE` backend/database, `FS` full stack, `PM` product, `QA` quality assurance, `LEGAL`, `OPS` operations, `DES` design.
- **Depends**: story IDs or open decisions that must be resolved first.
- **Milestone**: `M1` internal demo, `M2` private pilot, `M3` public launch.
- **Scope**: what is in.
- **Acceptance criteria (AC)**: testable conditions. A story is done only when every AC passes.
- **Tests**: the test cases that prove the ACs. They map to the test layers in I-4.

### 0.3 Terms

- **The Chamber**: the intake experience at `/start` (`src/pages/ChamberPage.tsx`).
- **Lenore**: the AI intake assistant (`src/components/LenoreChat.tsx`, `supabase/functions/chamber-extract`).
- **The Reckoning**: the final-step tab that certifies and hands off to the Manuscript (`src/components/chamber/ReckoningTab.tsx`).
- **The Manuscript**: the underwriting packet page and PDF at `/manuscript` (`src/pages/ManuscriptPage.tsx`).
- **Intake session**: the durable record of one prospect's intake. It replaces the current `chamber_sessions` table.
- **Continuation token**: a random secret that lets a guest reopen their own session. The server stores only its hash.
- **Snapshot**: the immutable copy of intake data taken at submission. The Manuscript and advisor views read from snapshots, not live drafts.

---

## 1. Current State (Verified Against the Branch)

This section records what the code does today. Several earlier status notes described work that is not on this branch. Those items are listed as **Not present** below.

| Area | What exists today | Gap for production |
|---|---|---|
| Session storage | `chamber_sessions` table (`id`, `user_id`, `chamber_data` jsonb, `transcript` jsonb, `status` default `in_progress`). RLS is owner-only. | No guest access, no continuation token, no version column, no certification or submission states, no expiry. |
| Session hook | `src/hooks/useChamberSession.ts` **creates a new session on every page load** ("Always start a fresh session"). It returns early with no session when the user is signed out. Autosave runs after 2 seconds of inactivity. Save failures are only written to `console.error`. | Refresh loses the in-progress intake. Guests cannot create a session. The prospect is never told a save failed. |
| Route protection | `/start` and `/manuscript` are not wrapped in `ProtectedRoute`. The component exists but is not used anywhere. | Route access is undefined. |
| Documents | `documents` table keyed on `user_id`, with per-user RLS and a storage policy. | Uploads are not tied to an intake session. No category, size, or processing state. |
| Lenore backend | `supabase/functions/chamber-extract/index.ts` calls the Lovable AI gateway with `LOVABLE_API_KEY` and model `google/gemini-3-flash-preview`. No timeout, no retry, no output validation, no rate limit. `supabase/config.toml` sets only `project_id`. | Provider dependency tied to the build platform. AI output is not validated or merged safely. |
| Reckoning | `ReckoningTab.tsx` hard-codes "Meridian Creative Group" (around line 75). "Generate The Manuscript" links to `/manuscript` with **no session identifier**. | The final step does not carry the prospect's session. |
| Manuscript | `ManuscriptPage.tsx` contains a hard-coded `SAMPLE_DATA` object for "Meridian Creative Group LLC". The PDF is generated in the browser with `html2canvas` and `jspdf`. | No real data. The PDF is a raster image, so text is not selectable, and it is not reproducible from a stored snapshot. |
| Data mapper | Not present. No mapper module exists in `src/` or `supabase/`, and the branch has no "Not provided" logic. | Entire mapper (D-1) is not started. |
| Authorization | Owner-only RLS on `profiles`, `documents`, and `chamber_sessions`. No roles table, no advisor concept. | Advisor access, guest access, and role enforcement are all missing. |
| Tests | `src/test/example.test.ts` is a placeholder. Vitest and Playwright are configured. | No real tests. |
| CI | No `.github/` directory exists. | Nothing gates a release. |
| Secrets hygiene | `.env` (three `VITE_SUPABASE_*` keys) is committed, and `.gitignore` does not exclude it. | Confirm only publishable keys are present, then stop tracking the file (F-0.1). |
| Voice | `useLenoreVoice.ts` and `VoiceOrb.tsx` exist. Live reliability is unverified. | See I-5. |

---

## 2. Delivery Principles

1. **Text is the dependable path.** Voice enhances intake and must never block it.
2. **The prospect controls their data.** AI proposes values. The prospect confirms material facts.
3. **No fabricated data.** Unknown underwriting data stays unknown, shown as "Not provided" or listed as an open item.
4. **Sensitive data stays private.** Census, payroll, benefits, and workers' compensation data are never publicly reachable.
5. **One source of truth.** The saved intake session feeds the Chamber, the review, the Manuscript, and the advisor view. Submitted packets are frozen as snapshots.
6. **Every story is independently releasable** and no larger than M.
7. **Access is enforced in the backend.** A hidden button is not access control.

---

## 3. Open Decisions (Blocking Items)

Each decision has an owner and a recommended default. Engineering can proceed on the default if the owner does not respond by the M1 kickoff. Decisions marked **Blocks** stop the listed stories.

| ID | Decision | Recommended default | Owner | Blocks |
|---|---|---|---|---|
| D1 | How does a guest return to their intake? | Secure tokenized link. The token lives in the URL fragment (`#t=`), so it is not sent to servers or logs. The browser also keeps it in `localStorage`. Email-based continuation is deferred to M2. No account is required for M1. | PM | A-1.2, A-1.3 |
| D2 | Minimum data required before certification | Company legal name, EIN, primary contact, states of operation, total employee count, census by state, and payroll frequency. Benefits, workers' comp, and dependents may be marked "Not applicable" or "Not provided" with a reason. | PM + Advisory lead | A-2.1, C-1.3 |
| D3 | Certification and consent wording | Engineering ships a placeholder marked `DRAFT: NOT LEGALLY REVIEWED`. Production requires approved text. | LEGAL | C-2.2, H-2.2 |
| D4 | Retention windows | Placeholder: abandoned drafts expire after 30 days of inactivity. Submitted records and documents follow the period legal sets. | LEGAL + PM | A-1.5, H-1.1 |
| D5 | Advisor roles and permissions | Two roles: `advisor` (read and manage submissions) and `admin` (also manage roles and delete records). | PM | F-1.1 |
| D6 | CRM or workflow destination | Undecided. Stories G-3.x wait on this. | PM | G-3.1 |
| D7 | Email provider and approved sender domain | Use a transactional email provider on a verified subdomain. Confirm before G-1 goes live. | OPS | G-1.2, G-2.1, J-1.2 |
| D8 | Is voice launch-critical? | Optional beta. Text is the primary path at launch. | PM | I-5.x scope |
| D9 | Carrier or PEO routing | One packet format for the first pilot. Advisor-mediated routing to partners comes later. | PM | Out of scope for M1 to M3 |
| D10 | Legal reviewer for policy, terms, and disclosures | Named outside counsel or in-house counsel, identified before M2. | LEGAL | H-2.1, H-2.3 |
| D11 | AI provider for Lenore and document extraction | Keep one provider behind an adapter. Choose the provider and its data-processing terms before pilot. | PM + BE | F-0.2, B-3.1 |
| D12 | PDF rendering approach | Text-based PDF in the browser (vector text with auto-sized tables) for M1. Revisit server-side rendering before M3. | BE + FE | D-3.1 |
| D13 | Malware-scanning provider for uploads | Choose before M2. Interim controls in E-4.1 apply until then. | OPS | E-4.3 |

---

## 4. Epics and Stories

### Epic 0: Foundations

#### F-0.1 Stop tracking `.env` and confirm secret hygiene
- **Size:** S · **Priority:** Highest · **Owner:** OPS · **Depends:** none · **Milestone:** M1
- **Scope:** Confirm that `.env` holds only publishable Supabase values. Remove it from the index with `git rm --cached`, add it to `.gitignore`, and add a committed `.env.example` with placeholder values.
- **AC:**
  - `git ls-files .env` returns nothing on the branch.
  - `.gitignore` excludes `.env` and `.env.*` except `.env.example`.
  - The README explains how to create `.env` from `.env.example`.
  - No service-role key, secret, or private token appears anywhere in the repository history for this branch. If one does, it is rotated before merge.
- **Tests:** `git check-ignore .env` succeeds. A fresh clone plus `.env.example` builds with `npm run build`.

#### F-0.2 Put the AI provider behind an adapter
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** D11 · **Milestone:** M1
- **Scope:** Move the model call in `chamber-extract` into a provider adapter. Read the provider, model name, and API key from function secrets. Remove the hard dependency on `LOVABLE_API_KEY`. Keep the request and response shape unchanged for the frontend.
- **AC:**
  - Switching providers requires changing one adapter file and one secret, not frontend code.
  - The function returns a structured error (code and message, no stack trace) when the key is missing.
  - The existing Lenore chat works end to end on the chosen provider.
- **Tests:** Unit test the adapter with a mocked HTTP client. One manual Lenore exchange in preview.

#### F-0.3 Document the route access map
- **Size:** S · **Priority:** Highest · **Owner:** PM + FS · **Depends:** none · **Milestone:** M1
- **Scope:** Write `docs/ROUTE_ACCESS.md` listing each route, its audience (public, prospect with token, advisor), and its enforcement point. Apply `ProtectedRoute` or an equivalent guard to any route that needs it. Remove dead code if the guard is replaced.
- **AC:**
  - Every route in `src/App.tsx` appears in the document with an audience.
  - `/start` and `/manuscript` have an explicit access rule. Neither is open to unauthenticated enumeration of data.
  - No route is described as protected unless the guard is in place.
- **Tests:** A test imports the route table and fails if a route is missing from the document.

---

### Epic A: Durable Intake Session

#### A-1.1 Intake session data model
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** D1, D4 · **Milestone:** M1
- **Scope:** Create `intake_sessions` with `id uuid`, `status` (`draft`, `ready_for_review`, `certified`, `submitted`, `archived`, `expired`, `deleted`), `token_hash bytea` (unique), `schema_version int`, `data_version int`, `created_at`, `updated_at`, `last_activity_at`, `expires_at`, and nullable `owner_user_id`. Enable RLS and deny direct table access to `anon` and `authenticated`. All access goes through edge functions that use the service role.
- **AC:**
  - The `status` check constraint accepts only the seven values above.
  - No plaintext token column exists. The token hash uses SHA-256 with a server-side secret.
  - A direct `select` by the `anon` role returns zero rows or a permission error.
  - Migration applies cleanly to a fresh local Supabase instance and to a copy of production.
- **Tests:** Migration applies twice without error. Constraint rejects an invalid status. Direct anon select is denied.

#### A-1.2 Create a guest session and issue a continuation token
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-1.1, D1 · **Milestone:** M1
- **Scope:** Edge function `intake-session` with action `create`. It generates a 256-bit random token, stores only its hash, and returns the plaintext token once. The frontend stores the token as described in A-1.3.
- **AC:**
  - A `create` call returns a session ID and a token. A second read of the session never returns the token.
  - Tokens are at least 256 bits from a cryptographically secure source.
  - Session IDs are UUIDs and cannot be used to access data without the token.
  - Creation is rate-limited per IP (default 10 per hour, configurable).
- **Tests:** Create returns a token. Lookup with a wrong token returns 404 with no data. Rate limit returns 429 after the threshold.

#### A-1.3 Restore a session after refresh, with a recovery screen
- **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** A-1.2, A-2.3, A-3.2 · **Milestone:** M1
- **Scope:** On `/start`, read the token from the URL fragment or `localStorage`, call `intake-session` with action `get`, and hydrate the Chamber. Replace the current "always create a new session" behavior. If no token exists, create one (A-1.2). If the token is invalid, expired, or revoked, show a recovery screen with "Start a new intake". The screen shows no session data.
- **AC:**
  - Refreshing `/start` restores structured fields, transcript, and uploaded-file list.
  - Opening `/start` again without a token creates exactly one new session, not one per load.
  - An invalid token shows the recovery screen and no prior data.
  - If `localStorage` is blocked, the intake still works in memory and shows a visible warning that refresh will lose progress.
- **Tests:** Refresh restores data. Two rapid loads create one session. Invalid token shows recovery. Storage-blocked mode shows the warning.

#### A-1.4 Autosave with visible status and local backup
- **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-1.2, A-2.2 · **Milestone:** M1
- **Scope:** Debounced autosave through `intake-session` action `save`. Show "Saving", "Saved", or "Not saved" with a retry action. Keep unsaved changes in `localStorage` until the server confirms, then clear them.
- **AC:**
  - "Saved" appears only after a 200 response from the backend.
  - A failed save shows "Not saved", offers "Retry", and keeps the data locally.
  - A save in flight when the page closes is recovered from the local backup on the next load.
  - Autosave does not fire more than once per 2 seconds during continuous typing.
- **Tests:** Simulate 500 on save and confirm the banner and local backup. Simulate reload after a pending save and confirm recovery. Count save calls during 10 seconds of typing.

#### A-1.5 Expiry, archive, and revocation
- **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** A-1.2, D4 · **Milestone:** M1
- **Scope:** Set `expires_at` from `last_activity_at` and the retention period from D4. A scheduled job marks stale drafts `expired` and deletes their transcript and uploads (H-1.2 covers the purge). "Start over" revokes the current token and marks the session `archived`.
- **AC:**
  - An expired token returns a safe "This link has expired" response with a restart option.
  - Revoked tokens stop working immediately.
  - A submitted session is never moved to `expired` by the job.
  - The job writes one audit row per session it changes.
- **Tests:** Expire a session in the test database, call `get`, and confirm the expired response. Revoke a token and confirm denial. Run the job against a submitted session and confirm no change.

#### A-1.6 Retire the legacy `chamber_sessions` path
- **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** A-1.3 · **Milestone:** M1
- **Scope:** Migrate any existing `chamber_sessions` rows that hold real data into `intake_sessions`, or mark them `archived`. Make the old table read-only. Remove `useChamberSession`'s create-on-load logic.
- **AC:**
  - No frontend code path writes to `chamber_sessions`.
  - Existing rows are either migrated with their data or archived, and the migration log lists which.
- **Tests:** Migration dry run on a production copy. Grep finds no writes to `chamber_sessions` in `src/`.

#### A-2.1 Canonical intake schema v1
- **Size:** M · **Priority:** Highest · **Owner:** BE + FS · **Depends:** D2 · **Milestone:** M1
- **Scope:** Define one schema module shared by the frontend and the edge functions (zod or equivalent). Every field uses an envelope: `{ value, status, source, updated_at, note? }`. `status` is one of `confirmed`, `inferred`, `incomplete`, `conflicting`, `not_applicable`. `source` is one of `prospect_edit`, `transcript_extraction`, `document_extraction`, `advisor_edit`, `system`. Sections: company, locations and states, census, dependents, benefits, payroll, state mix, contractors and entities, workers' comp, documents, open items. Mark each field required or optional for submission per D2. Write `docs/intake-schema.md`.
- **AC:**
  - Every field has a type, a validation rule, and a required-for-submission flag.
  - `0` is stored as a confirmed zero. Absent is stored as `incomplete` with no value. The two are never conflated.
  - Schema version is a constant and is stored on each session.
  - The document lists every field, type, and rule, and is kept in sync by a test that fails when a field is missing from the document.
- **Tests:** Round-trip serialize and parse for complete, partial, and empty data. Zero versus absent behaves differently in the required check.

#### A-2.2 Server-side validation and versioned writes
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-2.1, A-1.2 · **Milestone:** M1
- **Scope:** The `save` action validates the whole payload against the schema. It rejects invalid values with field-level errors. It accepts `expected_version` and returns 409 on a mismatch. A successful write increments `data_version`.
- **AC:**
  - An invalid payload changes nothing in the stored session.
  - A stale `expected_version` returns 409 and the current version.
  - Invalid numbers, malformed phone numbers, impossible employee counts (negative, or above 1,000,000), and unsupported state codes are rejected with a field path.
  - A successful save writes the new value, source, and timestamp for each changed field.
- **Tests:** One test per rejection type. Two concurrent saves with the same version produce one success and one 409.

#### A-2.3 Hydrate the Chamber workspace from saved data
- **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.1, A-2.2 · **Milestone:** M1
- **Scope:** Move the workspace tabs (`CompanyTab`, `CensusWorkspaceTab`, `DependentsTab`, `BenefitsTab`, `PayrollTab`, `LiveWorkspace`) from local state to the saved schema. Fields show their status badge. Empty fields show their empty-state text, not sample data.
- **AC:**
  - After refresh, every tab shows the values saved before the refresh.
  - No tab displays sample or demo data for a live session.
  - Changing a field updates the saved record and the other tabs.
- **Tests:** Fill every tab, refresh, and confirm each value. Open a new session and confirm all tabs are empty.

#### A-3.1 Store transcript messages as ordered rows
- **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** A-1.2 · **Milestone:** M1
- **Scope:** Create `intake_messages` with `session_id`, `seq`, `role` (`prospect`, `lenore`, `system`), `body`, `created_at`, and `extraction_status`. Assign `seq` on the server. Enforce `unique(session_id, seq)`.
- **AC:**
  - Messages return in `seq` order.
  - Each message has a role.
  - A message is never deleted when an extraction fails.
- **Tests:** Insert 50 messages concurrently and confirm unique ordered sequence. Fail an extraction and confirm the prospect message remains.

#### A-3.2 Restore the transcript on resume
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** A-3.1, A-1.3 · **Milestone:** M1
- **Scope:** Load the transcript from `intake_messages` when a session is restored. Show a "Restored from earlier" divider. Scroll to the last message.
- **AC:**
  - Refreshing shows the full conversation in original order.
  - Messages from Lenore, the prospect, and the system are visually distinct.
- **Tests:** Multi-turn conversation, refresh, compare message order and text.

---

### Epic B: Make AI Extraction Auditable and Useful

#### B-1.1 Extraction response contract and parser
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-2.1 · **Milestone:** M1
- **Scope:** Define the JSON contract the model must return: field-path updates, each with a value, status, and short evidence quote, plus a `reply` for the chat. Parse every response with the schema. Reject anything that does not conform. Only fields on the allow-list may be written.
- **AC:**
  - Non-conforming output is rejected and nothing is saved.
  - Updates to fields outside the allow-list are dropped and logged by field path only.
  - A response with no extractable data still returns a conversational reply.
  - The contract is versioned and stored with each extraction.
- **Tests:** Invalid state code is rejected. Unknown field path is dropped. Empty extraction still yields a reply.

#### B-1.2 Merge policy and conflict capture
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** B-1.1, A-2.2 · **Milestone:** M1
- **Scope:** Apply a precedence order to every update: `prospect_edit` > `advisor_edit` > `document_extraction` > `transcript_extraction` > `system`. A lower-precedence value never overwrites a higher one. A conflicting value is stored as `conflicting` with both candidates.
- **AC:**
  - An AI update never overwrites a prospect-confirmed value.
  - Two different employee counts from the transcript produce a `conflicting` field, not a silent replacement.
  - An explicit prospect correction overrides an earlier AI inference.
- **Tests:** The three cases above, one test each.

#### B-1.3 Lenore follow-up policy and completion state
- **Size:** M · **Priority:** Highest · **Owner:** BE + PM · **Depends:** B-1.2, D2 · **Milestone:** M1
- **Scope:** Compute the list of missing required fields and conflicts on the server. Pass the top priority items into the prompt. Lenore asks about one missing item per turn and does not re-ask a confirmed field. The session becomes `ready_for_review` when every required field is confirmed or marked not applicable and no conflicts remain.
- **AC:**
  - The prompt contains the next missing required field.
  - Lenore never re-asks a `confirmed` field in a test transcript.
  - `ready_for_review` is set only by the server, when the rule holds.
- **Tests:** Scripted transcript fills required fields in order and reaches `ready_for_review`. Scripted transcript with a conflict stays out of `ready_for_review`.

#### B-1.4 Prompt versioning and golden-transcript fixtures
- **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-1.1 · **Milestone:** M1
- **Scope:** Store the prompt version on every extraction. Create 10 golden transcripts with expected extractions and run them in CI with a stubbed model.
- **AC:**
  - Each extraction row records the prompt and contract version.
  - Golden tests fail when the parser output changes for a fixture.
- **Tests:** Golden suite runs in CI with the stub.

#### B-2.1 Provenance badges and confirm-or-edit controls
- **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** B-1.2 · **Milestone:** M2
- **Scope:** Show a badge for each inferred, conflicting, or incomplete value in the workspace. Inferred values read "Lenore captured this. Please confirm," with "Confirm" and "Edit" actions. Conflicts show both candidates and a resolution action.
- **AC:**
  - A prospect can find every inferred value in the workspace.
  - Confirming marks the value `confirmed` with source `prospect_edit`.
  - Editing saves the prospect's value and supersedes the AI value.
- **Tests:** Confirm an inferred value. Edit an inferred value. Resolve a conflict.

#### B-2.2 Derive open items from the schema
- **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-1.2, A-2.1 · **Milestone:** M1
- **Scope:** Generate open items server-side from missing required fields, conflicts, low-confidence values, and documents still needed. Each item has a reason: "Not provided", "Conflicting answers", "Document needed", or "Please confirm".
- **AC:**
  - Every open item has a reason from the approved list.
  - Resolving the underlying issue removes the item.
- **Tests:** One fixture per reason.

#### B-3.1 Timeouts, retries, and rate limits
- **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** B-1.1, F-0.2 · **Milestone:** M1
- **Scope:** Set a 20-second model timeout. Retry once on 429 or 5xx with 1-second backoff. Allow 30 Lenore requests per session per 10 minutes. Return a structured error for each case.
- **AC:**
  - A stalled model call returns a timeout error within 25 seconds.
  - One retry happens only for transient errors.
  - Exceeding the session limit returns 429 with a message the UI can show.
- **Tests:** Mocked slow model, mocked 503 then 200, and rate-limit burst.

#### B-3.2 User-facing failure states
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** B-3.1 · **Milestone:** M1
- **Scope:** On failure, keep the prospect's message visible, show "Lenore couldn't respond" with "Try again" and "Continue manually", and unlock the input. Never leave a spinner running past the timeout.
- **AC:**
  - The prospect's message remains after a failure.
  - The input is usable after a failure.
  - "Continue manually" opens the workspace with no data loss.
- **Tests:** Simulate timeout and 500. Confirm message persists, input is enabled, and retry works.

#### B-3.3 Operational logs with redaction
- **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** B-3.1 · **Milestone:** M1
- **Scope:** Log request ID, session ID, error code, latency, and provider status. Never log transcript text, field values, or document content.
- **AC:**
  - A failed extraction can be found by session ID in logs.
  - A test scans log output for transcript fixtures and finds none.
- **Tests:** Log-redaction test with known sensitive strings.

---

### Epic C: Review, Certification, and Submission

#### C-1.1 Read-only review by Manuscript section
- **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.3 · **Milestone:** M1
- **Scope:** A review view at `/review` (token-authorized, as in A-1.3). Sections match the Manuscript: company, workforce, locations, census, dependents, benefits, payroll, workers' comp, documents, open items. Each section shows one status: Complete, Needs confirmation, Incomplete, or Not applicable.
- **AC:**
  - The review shows data from the active session only.
  - No demo values appear for a live session.
  - Each section's status follows the rules in D2.
- **Tests:** Complete, partial, and empty sessions render the correct statuses.

#### C-1.2 Inline editing that writes to the canonical record
- **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** C-1.1, A-2.2 · **Milestone:** M1
- **Scope:** Each review field opens for editing. Saves go through the `save` action as `prospect_edit`. The workspace and review update immediately after the server confirms.
- **AC:**
  - Editing a company name changes it in the Chamber and the review.
  - Invalid input shows a field error and does not save.
  - Edits persist after reload.
- **Tests:** Edit, reload, confirm. Edit with invalid value, confirm rejection.

#### C-1.3 Readiness gate with jump links
- **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** C-1.1, B-2.2, D2 · **Milestone:** M1
- **Scope:** List missing required fields, each linked to the section that needs it. "Continue to certification" is enabled only when every required field is confirmed or validly marked not applicable. The reason for "not applicable" is stored.
- **AC:**
  - Leaving a required field blank disables "Continue".
  - Marking an optional field not applicable does not block.
  - Each missing item links to the correct section.
- **Tests:** Leave payroll blank and confirm the block. Mark a permitted field not applicable and confirm it unblocks.

#### C-2.1 Certification record and endpoint
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** C-1.3, A-1.2 · **Milestone:** M1
- **Scope:** Create `intake_certifications` (append-only): `session_id`, `data_version`, `consent_text_version`, `signer_name`, `signer_title`, `certified_at`, and a truncated user-agent hash. The `certify` action refuses unless readiness passes and the submitted `data_version` matches the current version.
- **AC:**
  - The server rejects certification when readiness fails.
  - A certification row is written in the same transaction that updates the session status.
  - Rows cannot be updated or deleted by any role except the retention job.
- **Tests:** Certify with readiness failing returns 422. Certify with a stale version returns 409. Successful certify writes one row.

#### C-2.2 Certification screen
- **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** C-2.1, D3 · **Milestone:** M1
- **Scope:** Show the consent text from its version constant. Require an acknowledgment checkbox, signer name, and title. The button stays disabled until all are valid. Success is shown only after a 200 response.
- **AC:**
  - The button stays disabled until the checkbox, name, and title are complete.
  - Failure shows an error and does not show success.
  - The placeholder consent text carries the `DRAFT` marker until D3 is resolved.
- **Tests:** Attempt submit without the checkbox. Force a 500 and confirm no success screen.

#### C-2.3 Re-certification after material changes
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** C-2.1 · **Milestone:** M1
- **Scope:** Define the material field list: legal name, EIN, employee count, states, census counts, benefits, and payroll. A change to any of these moves the session back to `ready_for_review` and marks the certification stale. A change to a non-material field does not.
- **AC:**
  - Changing a material field after certification requires new certification.
  - Changing a non-material field keeps the certification valid.
  - The Manuscript shows "Certification stale" when the data version has advanced.
- **Tests:** Edit employee count after certification and confirm re-certification is required. Edit the contact phone and confirm it is not.

#### C-3.1 Submit with idempotency and a human-readable reference
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** C-2.2, C-2.3 · **Milestone:** M1
- **Scope:** The `submit` action requires a current certification. It sets status `submitted` and assigns a reference in the form `EAA-YYYY-NNNN`. It accepts an idempotency key so repeated requests create one submission.
- **AC:**
  - Two submits with the same idempotency key produce one submission and one reference.
  - A submit without a current certification is rejected.
  - Status changes only after the transaction commits.
- **Tests:** Double-submit test. Submit without certification. Submit after an edit that invalidated certification.

#### C-3.2 Immutable submission snapshot
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** C-3.1 · **Milestone:** M1
- **Scope:** Create `intake_submissions` holding an immutable JSON snapshot of the data, the certification ID, the schema version, and a transcript hash. Later edits create a new draft version and never change the snapshot.
- **AC:**
  - The snapshot does not change after a later edit.
  - The snapshot references the certification it was submitted under.
  - Snapshots cannot be updated by any role.
- **Tests:** Submit, edit, confirm the snapshot is byte-identical to the original.

#### C-3.3 Confirmation screen
- **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** C-3.1 · **Milestone:** M1
- **Scope:** Show the reference, company name, and next step once the server confirms. On failure, show a retry option and no success message.
- **AC:**
  - The confirmation appears only after the server confirms.
  - The reference matches the one stored on the submission.
  - A failed submit shows a retry and no success.
- **Tests:** Successful submit shows reference. Forced failure shows retry and no success.

---

### Epic D: Connect Real Intake Data to The Manuscript

#### D-1.1 Mapper: company, workforce, locations, state mix
- **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.1 · **Milestone:** M1
- **Scope:** Create a pure function `buildManuscript(snapshot)` that returns the sections for company profile, workforce, locations, and state mix. Unknown values render as "Not provided". The function is deterministic.
- **AC:**
  - The same input always produces the same output.
  - No fabricated values appear. Missing data shows "Not provided".
  - Sensitive fields (EIN) are returned masked, with the unmasked value available only through an explicit parameter.
- **Tests:** Complete, partial, and empty fixtures.

#### D-1.2 Mapper: census, dependents, benefits, payroll
- **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** D-1.1 · **Milestone:** M1
- **Scope:** Map the census by state and coverage level, dependent summary, benefits, and payroll. Keep the employee list out of the Manuscript body unless it is needed for underwriting, per D2.
- **AC:**
  - Census counts match the snapshot.
  - Benefits and payroll show "Not provided" when absent.
  - A zero count renders as `0`, not "Not provided".
- **Tests:** Census fixture with zero, partial, and full coverage.

#### D-1.3 Mapper: workers' comp, documents, resolved and open items
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** D-1.1, B-2.2 · **Milestone:** M1
- **Scope:** Map workers' comp basics (marked "Not provided" until collected), document status, a "Resolved" list of confirmed facts, and the open-items list from B-2.2.
- **AC:**
  - Resolved items include only confirmed values.
  - Open items come from the server-derived list, not computed in the browser.
- **Tests:** Fixture with confirmed, inferred, and conflicting values lists each in the correct section.

#### D-1.4 Mapper unit tests
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** D-1.1, D-1.2, D-1.3 · **Milestone:** M1
- **Scope:** Test suite covering complete, partial, and conflicting data, plus a determinism test.
- **AC:**
  - Suite runs in `npm test`.
  - Any fabricated value fails the suite.
- **Tests:** The suite is the test.

#### D-1.5 Remove sample data from the live path
- **Size:** S · **Priority:** Highest · **Owner:** FS · **Depends:** D-1.1, C-3.2 · **Milestone:** M1
- **Scope:** Move `SAMPLE_DATA` in `ManuscriptPage.tsx` to a demo route only (`/manuscript/demo`). Replace the hard-coded "Meridian Creative Group" in `ReckoningTab.tsx` with the session's company name. "Generate The Manuscript" passes the submission reference.
- **AC:**
  - Grep for "Meridian" in `src/` finds matches only in the demo fixture file.
  - The Reckoning button carries the session reference.
  - The demo route is labelled as a demo and is not linked from the live flow.
- **Tests:** Grep check in CI. Click through the Reckoning and confirm the reference is in the URL.

#### D-2.1 Manuscript route by submission reference
- **Size:** M · **Priority:** Highest · **Owner:** FS · **Depends:** C-3.2, D-1.1 · **Milestone:** M1
- **Scope:** Route `/manuscript/:reference`. Prospect access requires the continuation token in the URL fragment (`#t=`). The backend returns the snapshot only when the token matches the submission. A wrong reference returns the same generic response as a missing one.
- **AC:**
  - A guessed reference without the token returns the generic not-found page.
  - The token is never sent in a query string.
  - The page renders from the snapshot, not from live session data.
- **Tests:** Valid token loads. Wrong token and missing token both return the generic response. Edit the session after submit and confirm the page is unchanged.

#### D-2.2 Safe error states
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** D-2.1 · **Milestone:** M1
- **Scope:** Show a safe message for missing, invalid, expired, or revoked references. Include no company or personal details in the error.
- **AC:**
  - Each error state has a message and a next action.
  - No error page shows company name or field values.
- **Tests:** Four error cases, each checked for absence of data.

#### D-3.1 Print layout: pagination, headers, footers, tables
- **Size:** M · **Priority:** Highest · **Owner:** FE · **Depends:** D-2.1, D12 · **Milestone:** M1
- **Scope:** Generate a text-based PDF with vector text, repeating table headers, page numbers, a header with company name and reference, and a footer with the generation date and data version. Prevent orphaned headings and clipped table cells.
- **AC:**
  - Text in the PDF is selectable.
  - Tables do not clip text and repeat their header on each page.
  - No heading appears alone at the bottom of a page.
  - Output is readable when printed on letter-size paper.
- **Tests:** Generate short, long, multi-state, and long-name fixtures. Check page breaks visually and by text extraction.

#### D-3.2 File name, metadata, and masking default
- **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** D-3.1 · **Milestone:** M1
- **Scope:** File name `EAA_<reference>_<company-slug>_<YYYYMMDD>.pdf`. Set PDF metadata (title, subject, creation date). Mask EIN, bank data, and dates of birth by default. Reveal is not available in the prospect view.
- **AC:**
  - File name follows the pattern for every fixture.
  - Masked values are masked in the PDF.
  - No reveal control exists in the prospect path.
- **Tests:** Filename pattern test. Text extraction confirms the EIN is masked.

#### D-3.3 Cross-browser and mobile download verification
- **Size:** S · **Priority:** High · **Owner:** QA · **Depends:** D-3.1 · **Milestone:** M1
- **Scope:** Verify download and print preview on current Chrome and Edge (desktop), Safari (macOS and iOS), and Chrome on Android. Record results in `docs/QA_MATRIX.md`.
- **AC:**
  - Each browser in the matrix downloads a readable PDF.
  - Any failure is logged as a defect with a link.
- **Tests:** Manual matrix run, results recorded.

---

### Epic E: Handle Documents Safely

#### E-1.1 Session-linked upload API and private storage
- **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** A-1.2 · **Milestone:** M1
- **Scope:** Create `intake_documents` (`session_id`, `original_name`, `mime_type`, `size_bytes`, `category` nullable, `status`, `storage_path`, `uploaded_at`). Upload through the `upload` action, which requires a valid token. Store objects in a private bucket. Write the record only after storage succeeds, and remove the stored object if the record write fails.
- **AC:**
  - An upload attaches only to the session identified by the token.
  - A failed record write leaves no orphaned object.
  - The bucket is private and has no public policy.
- **Tests:** Upload with valid token attaches. Upload with another session's token is denied. Simulated record-write failure removes the object.

#### E-1.2 Upload list, refresh, and removal in the UI
- **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** E-1.1, A-1.3 · **Milestone:** M1
- **Scope:** List uploads when a session is restored. Show progress during upload. Removing a file deletes the record and the stored object.
- **AC:**
  - Uploads remain listed after refresh.
  - Removal removes the file from the list and from storage.
  - A removed file cannot be downloaded.
- **Tests:** Upload, refresh, confirm listed. Delete, confirm gone and not downloadable.

#### E-1.3 Document access isolation
- **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** E-1.1 · **Milestone:** M1
- **Scope:** Issue short-lived signed URLs (5 minutes) only to requests that present a valid session token for the owning session.
- **AC:**
  - A signed URL expires after 5 minutes.
  - A token for session A cannot produce a URL for session B's document.
- **Tests:** Expired URL denied. Cross-session URL request denied.

#### E-2.1 Document categories and guidance
- **Size:** S · **Priority:** Medium · **Owner:** DES + FE · **Depends:** E-1.1 · **Milestone:** M2
- **Scope:** Categories: employee census, benefits summary, payroll report, workers' comp history, current PEO invoice, prior proposal, other. Each has a one-line description and an example.
- **AC:**
  - The prospect can assign or change a category.
  - The copy never says a document is required in every case.
- **Tests:** Assign and change a category. Copy review checklist.

#### E-2.2 Completeness checklist in review
- **Size:** S · **Priority:** Medium · **Owner:** FE · **Depends:** E-2.1, C-1.1 · **Milestone:** M2
- **Scope:** Show submitted versus recommended-but-missing categories in review. Non-blocking.
- **AC:**
  - Missing recommended categories are listed.
  - Submission is not blocked by missing documents.
- **Tests:** Review with zero, some, and all categories.

#### E-3.1 Text extraction for CSV, XLSX, and text PDF
- **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** E-1.1, B-1.1 · **Milestone:** M2
- **Scope:** Parse CSV, XLSX, and text-based PDF to produce candidate fields (for example, headcount by state from a census). Limit to 10 MB and 50 pages. Each candidate records its source document ID.
- **AC:**
  - Candidates include the document ID and a location (sheet and row, or page).
  - Scanned PDFs without text return a clear "unreadable" status.
- **Tests:** One fixture per format. Scanned-PDF fixture returns unreadable.

#### E-3.2 Candidate review and merge policy
- **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** E-3.1, B-1.2 · **Milestone:** M2
- **Scope:** Candidates enter the session with source `document_extraction` and status `inferred`. The merge policy from B-1.2 applies. The prospect confirms before a candidate becomes final.
- **AC:**
  - A document candidate never overwrites a confirmed prospect value.
  - A candidate that conflicts with an existing value creates a conflict.
- **Tests:** Candidate versus confirmed, candidate versus empty, candidate versus candidate.

#### E-3.3 Unsupported, encrypted, and unreadable file messages
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** E-3.1 · **Milestone:** M2
- **Scope:** Show a specific message for unsupported type, password-protected file, unreadable content, and oversized file. Processing failure does not block the rest of the intake.
- **AC:**
  - Each case shows its own message.
  - The rest of the intake remains usable.
- **Tests:** One fixture per case.

#### E-4.1 Upload validation before storage (interim controls)
- **Size:** S · **Priority:** Highest · **Owner:** BE · **Depends:** E-1.1 · **Milestone:** M1
- **Scope:** Check MIME type by file signature (magic bytes), not extension. Cap size at 10 MB per file and 25 files per session. Sanitize file names. Serve documents only as attachments, never inline.
- **AC:**
  - A file renamed to `.pdf` with a non-PDF signature is rejected.
  - Files over the cap are rejected before storage.
  - Downloads use `Content-Disposition: attachment`.
- **Tests:** Renamed-file fixture. Oversize fixture. Header check on download.

#### E-4.2 Document retention and deletion
- **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** E-1.1, H-1.2 · **Milestone:** M2
- **Scope:** Apply the D4 retention rule to documents. Expired or abandoned documents are deleted along with their storage objects. The deletion writes an audit row.
- **AC:**
  - Expired draft documents are removed from the database and storage.
  - Submitted-session documents follow the submitted retention rule.
  - Each deletion writes an audit row.
- **Tests:** Run the purge against fixtures and confirm removal from both locations.

#### E-4.3 Malware scanning
- **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** D13, E-1.1 · **Milestone:** M2
- **Scope:** Integrate the chosen scanner before any document is available for download. Define the operational response for a positive result.
- **AC:**
  - A file is not downloadable until scanning passes.
  - A positive result quarantines the file and alerts OPS.
- **Tests:** Use the scanner's test signature. Confirm quarantine and alert.

---

### Epic F: Build the Advisor Workflow

#### F-1.1 Role model
- **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** F-0.3, D5 · **Milestone:** M2
- **Scope:** Create `user_roles` (`user_id`, `role` enum `advisor` | `admin`) and a security-definer function `has_role(role)`. Roles cannot be self-assigned. Document how the first admin is created.
- **AC:**
  - A user cannot insert their own role.
  - `has_role` returns false for a signed-out user.
- **Tests:** Self-assignment attempt denied. Role check for each case.

#### F-1.2 Advisor routes and backend enforcement
- **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-1.1 · **Milestone:** M2
- **Scope:** Routes under `/advisor/*` guarded by a fixed `ProtectedRoute` and by the backend. Every advisor data query checks `has_role`.
- **AC:**
  - A prospect or signed-out user receives 403 from every advisor endpoint.
  - The UI guard is not the only check.
- **Tests:** Prospect token against each advisor endpoint returns 403.

#### F-1.3 Sign-in, sign-out, and unauthorized states
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** F-1.2 · **Milestone:** M2
- **Scope:** Clear states for sign-in, sign-out, expired session, and unauthorized. Decide on MFA for advisor accounts and record the decision in section 3.
- **AC:**
  - Each state has a message and a next action.
  - An expired session sends the advisor to sign-in without losing the destination.
- **Tests:** Expire the session and confirm redirect back to the same page after sign-in.

#### F-2.1 Submission queue
- **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-1.2, C-3.1 · **Milestone:** M2
- **Scope:** Table of submissions: company, contact, employee count, states, submitted date, completeness, status. Server-side pagination at 25 per page. Default sort is newest submitted first. The list omits census detail.
- **AC:**
  - Advisors see only submissions they are authorized for.
  - Rows open the correct detail page.
  - The list contains no census or payroll values.
- **Tests:** Pagination test. Row-to-detail test. Field-exclusion test.

#### F-2.2 Filter and search
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** F-2.1 · **Milestone:** M2
- **Scope:** Filter by status. Search by company, reference, or contact (minimum 3 characters). Empty, loading, and error states.
- **AC:**
  - Filters and search return correct results for the fixtures.
  - Each state renders.
- **Tests:** Fixture search and filter cases.

#### F-3.1 Submission detail: structured sections
- **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-2.1, C-3.2 · **Milestone:** M2
- **Scope:** Show the submitted snapshot by Manuscript section. Each value shows its source: prospect, AI-inferred, or advisor-updated.
- **AC:**
  - Each value shows a source badge.
  - Values match the snapshot.
- **Tests:** Snapshot fixture rendered and compared.

#### F-3.2 Transcript evidence and documents in detail
- **Size:** M · **Priority:** High · **Owner:** FS · **Depends:** F-3.1, E-1.3, B-2.1 · **Milestone:** M2
- **Scope:** Transcript panel with the message each field came from. Document list with private, time-limited access (E-1.3).
- **AC:**
  - A field's source message is reachable from the field.
  - Document links are signed and expire.
- **Tests:** Field-to-message link. Expired signed link denied.

#### F-3.3 Advisor edits tracked separately
- **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** F-3.1, D-1.1 · **Milestone:** M2
- **Scope:** Create `advisor_edits` (field path, old value, new value, reason, user, timestamp). An advisor edit creates a new Manuscript version (v+1) and does not change the prospect's snapshot.
- **AC:**
  - Every advisor edit writes an audit row.
  - The approved Manuscript reflects advisor edits.
  - The prospect's original snapshot remains unchanged.
- **Tests:** Edit a field and confirm the audit row, the new version, and the unchanged snapshot.

#### F-4.1 Status model and history
- **Size:** M · **Priority:** Medium · **Owner:** BE · **Depends:** F-2.1 · **Milestone:** M2
- **Scope:** Statuses: Draft, Submitted, Under review, Information requested, Ready for market, Sent to PEO, Quote received, Won, Lost, Archived. Append-only `submission_status_history` (who, when, old, new). Transitions follow an allow-list. Archived submissions cannot return to Draft.
- **AC:**
  - Every change writes a history row.
  - A disallowed transition returns an error with no change.
  - Archived cannot move to Draft.
- **Tests:** Full transition matrix. Archived-to-Draft denial.

#### F-4.2 Internal notes
- **Size:** S · **Priority:** Medium · **Owner:** BE · **Depends:** F-3.1 · **Milestone:** M2
- **Scope:** Advisor-only notes table with RLS. No prospect endpoint returns notes.
- **AC:**
  - Prospect endpoints never return notes, verified by test.
- **Tests:** Prospect token against the notes endpoint returns 403.

#### F-4.3 Follow-up flag and status filter
- **Size:** S · **Priority:** Medium · **Owner:** FE · **Depends:** F-4.1, F-2.2 · **Milestone:** M2
- **Scope:** Follow-up flag on a submission. Queue filter by status and by flag.
- **AC:**
  - Status changes update the queue filter results.
- **Tests:** Change status, confirm filter updates.

---

### Epic G: Communications and Operating Integrations

#### G-1.1 Outbox and event dispatch
- **Size:** M · **Priority:** High · **Owner:** BE · **Depends:** C-3.1 · **Milestone:** M2
- **Scope:** On submit, insert an `outbox_events` row with a unique key per submission. A worker sends events with retry and backoff (maximum 5 attempts). Failed events show with status `dead` in the admin view.
- **AC:**
  - One outbox row per submission, enforced by a unique constraint.
  - A failed send is retried and then marked `dead`.
- **Tests:** Duplicate submit creates one event. Forced failure exhausts retries.

#### G-1.2 Internal new-submission notification
- **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** G-1.1, D7 · **Milestone:** M2
- **Scope:** Send one email to the advisory distribution list with company name, contact name, reference, and a link to the advisor view. No census, payroll, or document content.
- **AC:**
  - Exactly one email per submission.
  - The email body contains no census, payroll, or document values.
- **Tests:** Send to a test inbox. Scan the body for forbidden fields.

#### G-1.3 Retry failed notifications
- **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** G-1.1, F-1.2 · **Milestone:** M2
- **Scope:** Admins can retry a `dead` event from the queue page.
- **AC:**
  - Retry sends the notification once and marks it sent.
- **Tests:** Dead event, retry, confirm one send.

#### G-2.1 Prospect confirmation email
- **Size:** M · **Priority:** Medium · **Owner:** BE + DES · **Depends:** G-1.1, D7, D10 · **Milestone:** M3
- **Scope:** Branded confirmation with company name, reference, next step, and support contact. Sent after successful submit only. No sensitive data.
- **AC:**
  - The email sends only after a confirmed submit.
  - It contains the correct company name and reference.
  - It contains no census, payroll, or document content.
  - Sending failure does not reverse the submission.
- **Tests:** Send after submit. Failure simulation confirms submission remains.

#### G-2.2 Bounce and suppression handling
- **Size:** S · **Priority:** Medium · **Owner:** BE · **Depends:** G-2.1 · **Milestone:** M3
- **Scope:** Process provider bounce webhooks. Mark the address undeliverable and flag the submission for advisor follow-up.
- **AC:**
  - A bounce flags the submission in the queue.
  - Suppressed addresses are not emailed again.
- **Tests:** Replay a bounce webhook fixture.

#### G-3.1 CRM selection and field-mapping specification
- **Size:** S · **Priority:** Medium · **Owner:** PM + BE · **Depends:** D6 · **Milestone:** M3
- **Scope:** Document the mapping for company, contacts, employee count, states, submission ID, status, and packet reference. Document ownership of each field.
- **AC:**
  - Every mapped field lists its source and target.
  - No target field receives a public document URL.
- **Tests:** Review against the mapping checklist.

#### G-3.2 CRM sync worker
- **Size:** M · **Priority:** Medium · **Owner:** BE · **Depends:** G-3.1, F-4.1, G-1.1 · **Milestone:** M3
- **Scope:** Upsert a lead keyed on the submission reference. Log every sync attempt.
- **AC:**
  - Repeated submits update one lead, not many.
  - Each attempt is logged with status.
- **Tests:** Sync the same submission twice and confirm one lead.

#### G-3.3 Sync failure visibility and retry
- **Size:** S · **Priority:** Medium · **Owner:** FS · **Depends:** G-3.2 · **Milestone:** M3
- **Scope:** Show failed syncs in the admin queue with a retry action.
- **AC:**
  - A failed sync appears in the queue.
  - Retry produces one lead.
- **Tests:** Forced failure, then retry.

---

### Epic H: Security, Privacy, and Legal Readiness

#### H-1.1 Data classification and retention matrix
- **Size:** S · **Priority:** Highest · **Owner:** LEGAL + PM · **Depends:** D4 · **Milestone:** M2
- **Scope:** Document each data class (contact, business, census, dependent, benefits, payroll, workers' comp, documents, transcripts, PDFs, audit records) with retention and deletion rules.
- **AC:**
  - Every stored data class has a rule.
  - The matrix is approved by LEGAL.
- **Tests:** Checklist review against the schema.

#### H-1.2 Automated retention enforcement
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** H-1.1, A-1.5 · **Milestone:** M2
- **Scope:** Scheduled job that applies the matrix to sessions, transcripts, documents, and generated PDFs. Writes an audit row per deletion.
- **AC:**
  - Expired records and objects are removed.
  - Submitted records are not removed by the draft rule.
  - Every deletion is audited.
- **Tests:** Fixture run confirms each class.

#### H-1.3 Deletion request workflow
- **Size:** S · **Priority:** High · **Owner:** FS · **Depends:** H-1.2, F-1.2 · **Milestone:** M2
- **Scope:** Admin deletes a submission, which cascades to its rows and files. The action is logged.
- **AC:**
  - After deletion, no row or file for the submission remains.
  - The audit log records the action and the admin.
- **Tests:** Delete a submission with documents and confirm full removal.

#### H-2.1 Privacy policy and terms pages
- **Size:** S · **Priority:** Highest · **Owner:** LEGAL + FE · **Depends:** D10 · **Milestone:** M2
- **Scope:** Publish privacy policy and terms from the site footer. Copy is approved by LEGAL.
- **AC:**
  - Both pages are reachable from every page.
  - Copy is marked approved by LEGAL before publication.
- **Tests:** Link check on all routes.

#### H-2.2 Intake consent gate
- **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** A-1.2, D3 · **Milestone:** M1
- **Scope:** Consent checkbox before the first sensitive field. Store the consent version and timestamp on the session.
- **AC:**
  - Sensitive fields are disabled until consent is recorded.
  - The consent record stores the version.
- **Tests:** Attempt a sensitive field without consent. Confirm consent record.

#### H-2.3 Role-disclosure copy audit
- **Size:** S · **Priority:** High · **Owner:** LEGAL + PM · **Depends:** H-2.1 · **Milestone:** M2
- **Scope:** Review all copy for implied carrier or PEO affiliation or endorsement. Make the role of Edgar Allan Advisory explicit.
- **AC:**
  - No copy implies a PEO has approved or received a submission before it has.
- **Tests:** Copy checklist review.

#### H-3.1 Guest isolation tests
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** A-1.2, E-1.3 · **Milestone:** M2
- **Scope:** Integration tests with two sessions. Cover read, write, upload, and download across sessions. Cover expired and revoked tokens.
- **AC:**
  - Every cross-session attempt is denied.
  - Each denial is tested.
- **Tests:** The suite is the test.

#### H-3.2 Prospect versus advisor permission tests
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** F-1.2, F-2.1 · **Milestone:** M2
- **Scope:** RLS and endpoint tests for each role against each protected resource.
- **AC:**
  - A prospect is denied every advisor resource.
  - An advisor sees only authorized submissions.
- **Tests:** Matrix of role by resource.

#### H-3.3 Signed URL and fragment-token tests
- **Size:** S · **Priority:** High · **Owner:** BE · **Depends:** D-2.1, E-1.3 · **Milestone:** M2
- **Scope:** Confirm signed URLs expire and fragment tokens are never sent to the server in a request line or logged.
- **AC:**
  - Expired URLs are denied.
  - Server logs contain no fragment tokens.
- **Tests:** Expiry test. Log scan for a known token.

#### H-4.1 Alerts for failed uploads, submits, AI calls, and auth
- **Size:** M · **Priority:** High · **Owner:** OPS · **Depends:** G-1.1, B-3.3 · **Milestone:** M2
- **Scope:** Alerts on error-rate thresholds for each category, delivered to the named owner.
- **AC:**
  - A forced failure in each category produces an alert.
- **Tests:** Forced failures in staging.

#### H-4.2 Incident runbook and escalation contacts
- **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** H-4.1 · **Milestone:** M2
- **Scope:** `docs/RUNBOOK.md` with escalation contacts, response steps, and rollback steps.
- **AC:**
  - Every alert category has a runbook section.
- **Tests:** Tabletop walk-through.

#### H-4.3 Backup and restore verification
- **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** J-1.1 · **Milestone:** M2
- **Scope:** Document backup frequency and perform one restore drill on staging.
- **AC:**
  - A restore from backup succeeds on staging and is recorded.
- **Tests:** Restore drill record.

---

### Epic I: Quality, Accessibility, and Release Readiness

#### I-1.1 Responsive Chamber layout
- **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** A-2.3, B-3.2 · **Milestone:** M2
- **Scope:** Three-zone layout collapses to tabs below 768 px. Touch targets at least 44 px. No horizontal overflow.
- **AC:**
  - No horizontal scroll at 360 px, 768 px, or 1280 px.
  - Every control is reachable on touch.
- **Tests:** Viewport tests at three widths.

#### I-1.2 Responsive review, certification, and Manuscript
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** C-1.2, D-2.1 · **Milestone:** M2
- **Scope:** Apply the responsive rules to review, certification, and Manuscript pages.
- **AC:**
  - No horizontal scroll at the same three widths.
- **Tests:** Viewport tests.

#### I-1.3 Mobile browser test matrix
- **Size:** S · **Priority:** High · **Owner:** QA · **Depends:** I-1.1, E-1.2 · **Milestone:** M2
- **Scope:** Test upload and PDF download on iOS Safari and Android Chrome.
- **AC:**
  - Upload and download pass on both.
- **Tests:** Manual matrix recorded in `docs/QA_MATRIX.md`.

#### I-2.1 Keyboard and labels for intake, review, and certification
- **Size:** M · **Priority:** High · **Owner:** FE · **Depends:** I-1.1 · **Milestone:** M2
- **Scope:** Accessible names on every control. Logical focus order. Visible focus states. Full keyboard path through intake, review, certification, and PDF.
- **AC:**
  - The full path completes using keyboard only.
  - Every control has an accessible name.
- **Tests:** Keyboard-only run. Automated name check plus manual review.

#### I-2.2 Live-region announcements
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** I-2.1, B-3.2 · **Milestone:** M2
- **Scope:** Announce AI responses, save status, upload progress, and validation errors.
- **AC:**
  - A screen reader announces each of the four event types.
- **Tests:** Manual screen-reader check.

#### I-2.3 Contrast and focus-style audit
- **Size:** S · **Priority:** High · **Owner:** DES + FE · **Depends:** I-1.1 · **Milestone:** M2
- **Scope:** Check text and key controls against WCAG AA. Fix failures.
- **AC:**
  - Normal text and key controls meet 4.5:1 and 3:1 respectively.
- **Tests:** Contrast tool run plus manual check.

#### I-3.1 Consistent loading, empty, and error states
- **Size:** S · **Priority:** High · **Owner:** FE · **Depends:** B-3.2, E-1.2, C-3.3 · **Milestone:** M1
- **Scope:** One pattern for loading, empty, and error states across the critical path.
- **AC:**
  - No success message appears before server confirmation.
  - Every critical-path state uses the pattern.
- **Tests:** Forced states on each screen.

#### I-4.1 Unit tests for validation and schema
- **Size:** S · **Priority:** Highest · **Owner:** FE · **Depends:** A-2.2 · **Milestone:** M1
- **Scope:** Vitest suite for schema validation and field rules. Replace the placeholder test.
- **AC:**
  - Suite runs with `npm test`.
  - The placeholder test is removed.
- **Tests:** The suite is the test.

#### I-4.2 Integration test harness on local Supabase
- **Size:** M · **Priority:** Highest · **Owner:** BE · **Depends:** J-1.1, A-1.2 · **Milestone:** M1
- **Scope:** Run integration tests against a local Supabase with seed data. Cover session create, save, certify, and submit.
- **AC:**
  - Tests run from one command.
  - Each run starts from a clean database.
- **Tests:** The suite is the test.

#### I-4.3 End-to-end test: intake to PDF
- **Size:** M · **Priority:** Highest · **Owner:** QA + FE · **Depends:** I-4.2, D-3.2 · **Milestone:** M1
- **Scope:** Playwright test: text intake, review, certify, submit, and PDF download.
- **AC:**
  - The test completes the full path and asserts the reference and PDF file name.
- **Tests:** The test is the test.

#### I-4.4 CI pipeline that gates releases
- **Size:** S · **Priority:** Highest · **Owner:** OPS · **Depends:** I-4.1, I-4.2, I-4.3 · **Milestone:** M1
- **Scope:** Create `.github/workflows/ci.yml` running lint, unit, integration, and end-to-end tests. Mark the job as required for merge.
- **AC:**
  - A failing test blocks merge.
  - The required check is enabled on the default branch.
- **Tests:** Deliberate failure on a branch is blocked.

#### I-5.1 Voice reliability diagnosis and state machine
- **Size:** M · **Priority:** Medium · **Owner:** FE · **Depends:** A-3.1, D8 · **Milestone:** M3
- **Scope:** Define the states: connecting, active, listening, speaking, disconnected, failed. Reproduce failures in the hosted environment and fix the top causes. Drive the orb from this state machine only.
- **AC:**
  - The orb state matches the connection state in each test run.
  - Each failure cause found is logged in `docs/VOICE_ISSUES.md` with its fix.
- **Tests:** Hosted-environment test with a real microphone on each supported browser.

#### I-5.2 Voice fallback and browser support matrix
- **Size:** S · **Priority:** Medium · **Owner:** PM + FE · **Depends:** I-5.1 · **Milestone:** M3
- **Scope:** Define supported browsers. Unsupported environments start text-first. Add help text for enabling the microphone.
- **AC:**
  - Unsupported browsers start in text mode without an error.
  - Help text explains how to enable the microphone.
- **Tests:** Run in an unsupported browser and confirm text-first start.

#### I-5.3 Voice failure UX
- **Size:** S · **Priority:** Medium · **Owner:** FE · **Depends:** I-5.1 · **Milestone:** M3
- **Scope:** Explain permission-denied, device-unavailable, connection-failed, and mid-call disconnect. Keep the text chat fully usable in each case.
- **AC:**
  - Each failure has a message and a text-chat path.
  - The text chat is usable after each failure.
- **Tests:** Simulate each failure.

---

### Epic J: Release Operations

#### J-1.1 Environment separation
- **Size:** M · **Priority:** Highest · **Owner:** OPS · **Depends:** F-0.1 · **Milestone:** M1
- **Scope:** Separate development, staging, and production Supabase projects. Configure environment variables per environment. Confirm the client bundle holds only publishable keys.
- **AC:**
  - Each environment has its own project and secrets.
  - A grep of the built bundle finds no secret key.
- **Tests:** Build artifact scan.

#### J-1.2 Production domain, HTTPS, canonical URL, and sender domain
- **Size:** S · **Priority:** High · **Owner:** OPS · **Depends:** J-1.1, D7, D-2.1 · **Milestone:** M3
- **Scope:** Connect the production domain. Enforce HTTPS and redirects. Set canonical URLs. Verify the sender domain.
- **AC:**
  - HTTP redirects to HTTPS.
  - Canonical URL is set on every public page.
  - Sender domain shows verified.
- **Tests:** Redirect check. Header check.

#### J-2.1 Funnel analytics events
- **Size:** M · **Priority:** Medium · **Owner:** FE + PM · **Depends:** H-2.2 · **Milestone:** M3
- **Scope:** Events: landing CTA, Chamber start, upload, intake milestones, review start, certification, submission, PDF download. No personal or census values in event payloads. Tracking waits for consent.
- **AC:**
  - Events fire at each milestone.
  - No event payload contains a personal or census value.
  - No event fires before consent.
- **Tests:** Payload scan. Consent-gate test.

#### J-2.2 Funnel view
- **Size:** S · **Priority:** Medium · **Owner:** PM · **Depends:** J-2.1 · **Milestone:** M3
- **Scope:** A funnel report that shows drop-off between milestones.
- **AC:**
  - The report shows counts for each milestone.
- **Tests:** Compare report to a manual count for a test run.

#### J-3.1 Launch checklist and controlled test submission
- **Size:** S · **Priority:** Highest · **Owner:** PM + OPS · **Depends:** I-4.3, G-1.2, H-4.2 · **Milestone:** M3
- **Scope:** Checklist covering function, permissions, privacy and legal, email, monitoring, backups, browsers, and accessibility. Run one test submission with non-sensitive test data.
- **AC:**
  - Every checklist item is signed off or waived with a named owner.
  - The test submission completes end to end.
- **Tests:** Checklist review and test submission record.

#### J-3.2 Rollback and maintenance plan
- **Size:** S · **Priority:** Highest · **Owner:** OPS · **Depends:** J-1.1 · **Milestone:** M3
- **Scope:** Document rollback steps and a maintenance-page procedure. Assign launch and support owners.
- **AC:**
  - Rollback is rehearsed on staging.
  - Support owner is named.
- **Tests:** Staging rollback rehearsal.

---

## 5. Dependency Order and Starting Backlog

### 5.1 Starting order for Milestone 1

Work the first items in this order. Items in the same tier can run in parallel.

| Tier | Stories |
|---|---|
| 0 (decisions and hygiene) | Resolve D1, D2, D4, D11; F-0.1, F-0.3 |
| 1 (foundations) | F-0.2, J-1.1, A-1.1, A-2.1, A-3.1, I-4.1 |
| 2 | A-1.2, A-2.2, B-1.1, B-3.1, E-4.1 |
| 3 | A-2.3, A-3.2, A-1.3, A-1.4, A-1.5, B-1.2, B-3.2, B-3.3, B-2.2, I-4.2 |
| 4 | A-1.6, B-1.3, B-1.4, C-1.1, C-1.2, C-1.3, D-1.1, D-1.2, D-1.3, D-1.4, H-2.2 |
| 5 | C-2.1, C-2.2, C-2.3, D-1.5, I-3.1 |
| 6 | C-3.1, C-3.2, C-3.3, D-2.1, D-2.2 |
| 7 | D-3.1, D-3.2, D-3.3, I-4.3, I-4.4 |

Milestone 1 is complete when tier 7 passes.

### 5.2 Critical path

`D1 → A-1.2 → A-2.2 → A-2.3 → C-1.1 → C-1.3 → C-2.1 → C-3.1 → C-3.2 → D-2.1 → D-3.1 → I-4.3`

Start D1 and D2 today. Each waiting day on a decision delays this path one day.

---

## 6. Milestone Exit Criteria

### Milestone 1: Internal Demo
- All M1 stories in section 7 are done.
- A test prospect completes text intake, review, certification, submission, and PDF download with real data.
- No "Meridian" text appears in the live path.
- Two sessions cannot access each other's data (automated test).
- Internal testers can repeat the flow without developer help.

### Milestone 2: Private Pilot
- All M2 stories are done.
- Advisors can review, manage status, and see notifications.
- Retention and deletion run on schedule.
- Privacy policy and terms are approved by LEGAL.
- Authorization, upload, and isolation tests pass in CI.
- Runbook, alerts, and backup drill are complete.

### Milestone 3: Public Launch
- All M3 stories are done, including voice items if voice is marketed (D8).
- Branded email is live and verified.
- Analytics consent is in place.
- Launch checklist is signed off and rollback is rehearsed.

---

## 7. Story Index

| ID | Title | Size | Priority | Owner | Milestone |
|---|---|---|---|---|---|
| F-0.1 | Stop tracking `.env` | S | Highest | OPS | M1 |
| F-0.2 | AI provider adapter | M | Highest | BE | M1 |
| F-0.3 | Route access map | S | Highest | PM+FS | M1 |
| A-1.1 | Intake session data model | M | Highest | BE | M1 |
| A-1.2 | Create guest session and token | M | Highest | BE | M1 |
| A-1.3 | Restore after refresh and recovery screen | M | Highest | FS | M1 |
| A-1.4 | Autosave status and local backup | M | Highest | FE | M1 |
| A-1.5 | Expiry, archive, revocation | M | High | BE | M1 |
| A-1.6 | Retire legacy `chamber_sessions` | S | High | FS | M1 |
| A-2.1 | Canonical intake schema v1 | M | Highest | BE+FS | M1 |
| A-2.2 | Server validation and versioned writes | M | Highest | BE | M1 |
| A-2.3 | Hydrate workspace from saved data | M | Highest | FE | M1 |
| A-3.1 | Transcript message rows | S | High | BE | M1 |
| A-3.2 | Restore transcript on resume | S | High | FE | M1 |
| B-1.1 | Extraction contract and parser | M | Highest | BE | M1 |
| B-1.2 | Merge policy and conflict capture | M | Highest | BE | M1 |
| B-1.3 | Follow-up policy and completion state | M | Highest | BE+PM | M1 |
| B-1.4 | Prompt versioning and golden fixtures | S | High | BE | M1 |
| B-2.1 | Provenance badges and confirm/edit | M | High | FE | M2 |
| B-2.2 | Open items from schema | S | High | BE | M1 |
| B-3.1 | Timeouts, retries, rate limits | M | High | BE | M1 |
| B-3.2 | User-facing failure states | S | High | FE | M1 |
| B-3.3 | Redacted operational logs | S | High | BE | M1 |
| C-1.1 | Read-only review by section | M | Highest | FE | M1 |
| C-1.2 | Inline editing to canonical record | M | Highest | FS | M1 |
| C-1.3 | Readiness gate with jump links | M | Highest | FS | M1 |
| C-2.1 | Certification record and endpoint | M | Highest | BE | M1 |
| C-2.2 | Certification screen | S | Highest | FE | M1 |
| C-2.3 | Re-certification after material change | M | Highest | BE | M1 |
| C-3.1 | Submit with idempotency and reference | M | Highest | BE | M1 |
| C-3.2 | Immutable submission snapshot | M | Highest | BE | M1 |
| C-3.3 | Confirmation screen | S | Highest | FE | M1 |
| D-1.1 | Mapper: company, workforce, locations | M | Highest | FE | M1 |
| D-1.2 | Mapper: census, dependents, benefits, payroll | M | Highest | FE | M1 |
| D-1.3 | Mapper: workers' comp, documents, open items | S | High | FE | M1 |
| D-1.4 | Mapper unit tests | S | High | FE | M1 |
| D-1.5 | Remove sample data from live path | S | Highest | FS | M1 |
| D-2.1 | Manuscript route by reference | M | Highest | FS | M1 |
| D-2.2 | Safe error states | S | High | FE | M1 |
| D-3.1 | Print layout and pagination | M | Highest | FE | M1 |
| D-3.2 | File name, metadata, masking default | S | Highest | FE | M1 |
| D-3.3 | Cross-browser and mobile download check | S | High | QA | M1 |
| E-1.1 | Session-linked upload API and storage | M | High | BE | M1 |
| E-1.2 | Upload list, refresh, removal UI | M | High | FE | M1 |
| E-1.3 | Document access isolation | S | High | BE | M1 |
| E-2.1 | Document categories and guidance | S | Medium | DES+FE | M2 |
| E-2.2 | Completeness checklist in review | S | Medium | FE | M2 |
| E-3.1 | Text extraction for CSV, XLSX, text PDF | M | High | BE | M2 |
| E-3.2 | Candidate review and merge | M | High | FS | M2 |
| E-3.3 | Unsupported and unreadable messages | S | High | FE | M2 |
| E-4.1 | Upload validation (interim controls) | S | Highest | BE | M1 |
| E-4.2 | Document retention and deletion | M | High | BE | M2 |
| E-4.3 | Malware scanning | S | High | OPS | M2 |
| F-1.1 | Role model | M | High | BE | M2 |
| F-1.2 | Advisor routes and backend enforcement | M | High | FS | M2 |
| F-1.3 | Sign-in, sign-out, unauthorized states | S | High | FE | M2 |
| F-2.1 | Submission queue | M | High | FS | M2 |
| F-2.2 | Filter and search | S | High | FE | M2 |
| F-3.1 | Detail: structured sections | M | High | FS | M2 |
| F-3.2 | Detail: transcript and documents | M | High | FS | M2 |
| F-3.3 | Advisor edits tracked separately | M | High | BE | M2 |
| F-4.1 | Status model and history | M | Medium | BE | M2 |
| F-4.2 | Internal notes | S | Medium | BE | M2 |
| F-4.3 | Follow-up flag and status filter | S | Medium | FE | M2 |
| G-1.1 | Outbox and event dispatch | M | High | BE | M2 |
| G-1.2 | Internal new-submission notification | S | High | BE | M2 |
| G-1.3 | Retry failed notifications | S | High | FS | M2 |
| G-2.1 | Prospect confirmation email | M | Medium | BE+DES | M3 |
| G-2.2 | Bounce and suppression | S | Medium | BE | M3 |
| G-3.1 | CRM mapping specification | S | Medium | PM+BE | M3 |
| G-3.2 | CRM sync worker | M | Medium | BE | M3 |
| G-3.3 | Sync failure visibility and retry | S | Medium | FS | M3 |
| H-1.1 | Data classification and retention matrix | S | Highest | LEGAL+PM | M2 |
| H-1.2 | Automated retention enforcement | M | Highest | BE | M2 |
| H-1.3 | Deletion request workflow | S | High | FS | M2 |
| H-2.1 | Privacy policy and terms | S | Highest | LEGAL+FE | M2 |
| H-2.2 | Intake consent gate | S | Highest | FE | M1 |
| H-2.3 | Role-disclosure copy audit | S | High | LEGAL+PM | M2 |
| H-3.1 | Guest isolation tests | M | Highest | BE | M2 |
| H-3.2 | Prospect vs advisor permission tests | M | Highest | BE | M2 |
| H-3.3 | Signed URL and fragment-token tests | S | High | BE | M2 |
| H-4.1 | Alerts for failures | M | High | OPS | M2 |
| H-4.2 | Incident runbook | S | High | OPS | M2 |
| H-4.3 | Backup and restore verification | S | High | OPS | M2 |
| I-1.1 | Responsive Chamber layout | M | High | FE | M2 |
| I-1.2 | Responsive review and Manuscript | S | High | FE | M2 |
| I-1.3 | Mobile browser matrix | S | High | QA | M2 |
| I-2.1 | Keyboard and labels | M | High | FE | M2 |
| I-2.2 | Live-region announcements | S | High | FE | M2 |
| I-2.3 | Contrast and focus audit | S | High | DES+FE | M2 |
| I-3.1 | Consistent loading, empty, error states | S | High | FE | M1 |
| I-4.1 | Unit tests for validation and schema | S | Highest | FE | M1 |
| I-4.2 | Integration harness on local Supabase | M | Highest | BE | M1 |
| I-4.3 | End-to-end test: intake to PDF | M | Highest | QA+FE | M1 |
| I-4.4 | CI pipeline gating releases | S | Highest | OPS | M1 |
| I-5.1 | Voice reliability and state machine | M | Medium | FE | M3 |
| I-5.2 | Voice fallback and support matrix | S | Medium | PM+FE | M3 |
| I-5.3 | Voice failure UX | S | Medium | FE | M3 |
| J-1.1 | Environment separation | M | Highest | OPS | M1 |
| J-1.2 | Domain, HTTPS, sender domain | S | High | OPS | M3 |
| J-2.1 | Funnel analytics events | M | Medium | FE+PM | M3 |
| J-2.2 | Funnel view | S | Medium | PM | M3 |
| J-3.1 | Launch checklist and test submission | S | Highest | PM+OPS | M3 |
| J-3.2 | Rollback and maintenance plan | S | Highest | OPS | M3 |

**Count:** 104 stories. Sizes: 0 Large; every story is Small or Medium.

---

## 8. Split Log (How Earlier Drafts Map to This Plan)

Earlier drafts sized several broad stories as Medium while they covered several independent deliveries. Those stories are split below. Nothing is dropped.

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
3. CI is green (lint, unit, integration, end-to-end once I-4.4 is live).
4. New or changed data access has an authorization test.
5. No sample or demo values appear in a live-session path.
6. Empty, loading, and error states exist for every new screen.
7. Any new data field is in `docs/intake-schema.md` and in the retention matrix (H-1.1).
8. Any new log line is checked for sensitive content.
9. Copy that makes a legal or affiliation claim is approved by LEGAL.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Decisions D1, D2, D4 stay open | Blocks the M1 critical path | Start on the recommended defaults; revisit at the next review. |
| Lenore provider choice changes late | Extraction behavior shifts | Adapter (F-0.2) and golden fixtures (B-1.4). |
| Browser PDF rendering differs across browsers | Layout failures in the packet | Browser matrix (D-3.3) and text-based rendering (D12). |
| Prospect data leaks through a URL or log | Serious privacy incident | Fragment tokens (D-2.1), log redaction (B-3.3), scan tests (H-3.3). |
| Voice behaves differently in production | Users stall at the voice step | Text-first path, state machine (I-5.1), and I-5.2 fallback. |
| Legal copy not approved in time | Public launch delayed | Placeholders marked DRAFT (C-2.2); legal approval is an M3 exit criterion. |
| Single-person knowledge of the stack | Slow incident response | Runbook (H-4.2) and named owners in J-3.2. |

---

## 11. Open Questions Left for Discussion

1. Should the first pilot allow prospects to re-enter after submit to supplement information? The current plan says no, and changes after submit create a new draft version (C-3.2). Confirm.
2. Should advisors be able to request a prospect re-certify from the advisor view, or only re-open the intake? The current plan assumes re-open, then re-certify.
3. Is there a required retention period from an insurer, PEO partner, or regulation that overrides D4?
