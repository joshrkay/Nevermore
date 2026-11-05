# QA checklist

Everything a tester needs to sign off a release of Edgar Allan Advisory: what to run, what to click, what to
call, and what only the real project can show. Built on 2026-11-05 from the code at `d73c0e3`, the docs in this
folder and the existing tests. Terms follow `GLOSSARY.md`.

## How to use this list

Each line is one check: `- [ ] **ID** action → expected result`. Copy the file (or the sections you run) into
the pull request or release ticket and tick it there; record the run in "Run record" at the end.

Tags say what already covers a check, so you can spend manual time where nothing else looks:

| Tag | Meaning |
|---|---|
| `[U]` | A unit or component test covers it (`npm test`). |
| `[S]` | A SQL test covers it (`supabase/tests`, run by `supabase/tests/run.sh`). |
| `[E]` | An end-to-end spec covers it, on the stand-in stack (`e2e/`). |
| `[L]` | Live only: needs the real Supabase project, a real provider or a real device. No automated test reaches it. |
| none | Manual only. |

A tagged check does not need repeating by hand every release, except the **Smoke** list. `[L]` checks are the
ones nothing else will catch, so they are the heart of a pre-launch pass.

Two things in this list are not checks. **Verify** marks something the code or the docs leave unclear: run it, then
decide whether the behavior is intended. Section 24 lists defects found by reading the code; file each one
as an issue (labels in `docs/agents/triage-labels.md`) or close it as intended.

---

## 1. Environments, accounts and test data

### Environments

| Environment | Use it for | Cannot show |
|---|---|---|
| Stand-in stack (`npm run test:e2e`) | Prospect path, database rules, two-tab and lifecycle behavior | Storage, uploads, voice, real auth, real functions, real AI, email |
| Preview or staging Supabase project, every migration applied, every function deployed, secrets set | All `[L]` checks | Production DNS and sender domain |
| Production | Smoke list and read-only checks only | Anything that writes test data you cannot delete |

### Accounts

- **G1, G2**: two guest sessions, each in its own browser profile.
- **P1, P2**: two email-verified prospects.
- **A**: an advisor. **AD**: an admin. Both are granted by SQL (`docs/ADVISOR_ACCESS.md`).
- A mailbox you can read for 6-digit codes and confirmations, and Resend's bounce test addresses.

### Files to have ready

- **Census**: the template from the Upload tab; a filled copy with 3 rows; a 5,001-row CSV; a CSV with an SSN
  column and a bank column; rows with a CA 1099 worker; rows missing age, state, title or salary; a roster with
  dependents (21 on one employee); a salary above 1,000,000.
- **PDF**: text PDF under 10 MB and 50 pages; one over 50 pages; a scanned (image-only) PDF; a
  password-protected PDF; one between 10 and 20 MB.
- **Office**: `.xlsx`, `.xls`, a tab-separated `.xls`, `.docx`, `.doc`.
- **Hostile**: the EICAR string saved as `eicar.csv`; an executable renamed `.pdf`; a text file named `.pdf`;
  an empty file; a file of exactly 20 MB and one byte over; a name with control and bidi characters; a name in
  a non-Latin script; the same file twice; a 26th file.
- **Names for Unicode checks**: `José Núñez`, `李雷`, `محمد`, an emoji.

### Browsers and devices

Chrome, Edge, Firefox and Safari on desktop; iOS Safari and Android Chrome (plan I-1.3 requires upload and PDF
download on both); widths 360, 768 and 1280.

---

## 2. Automated baseline (run first)

State on this checkout (2026-11-05): `npm run lint` 0 errors and 8 warnings; `npm run typecheck:functions`
clean; `npm test` 2,424 tests in 115 files, all passing; `npm run build` succeeds (main chunk 1.76 MB, 504 kB
gzipped). The SQL tests and the end-to-end spec were not run in that pass: they need Postgres.

- [ ] **BASE-01** `npm run lint && npm run typecheck:functions && npm test && npm run build` → all pass.
- [ ] **BASE-02** `PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh` → every file passes.
- [ ] **BASE-03** `npm run test:e2e` (Node 22.18 or later, Chromium installed) → all specs pass: `intake-to-pdf`, `intake-lifecycle`, `two-tabs-conflict`, `review-readiness`, `data-isolation`.
- [ ] **BASE-04** CI shows `verify`, `sql-tests` and `e2e` green on the release commit, and all three are **required** checks on `main` (a repository setting; not visible from the repo).
- [ ] **BASE-05** `[L]` `npm run eval:extraction` against the chosen AI provider (it calls a real model, so it never runs in CI) → no field-level regression against the previous run for the current `PROMPT_VERSION` (5). No `baseline.json` is committed yet, so the first run records one: keep it with the release notes.
- [ ] **BASE-06** Remove a rule on purpose (for example the `data_version` condition in a save) → the matching test fails. Spot-check one per release that the tests can still fail.

---

## 3. Smoke (every deploy, about 20 minutes)

Run on the environment you are deploying. Each step names the section with the detail.

- [ ] **SMK-01** `/` loads with no console errors; a CTA opens `/start` (PUB-01, PUB-02).
- [ ] **SMK-02** A new visitor becomes a guest and sees the intake consent; agreeing opens the Chamber (AUTH-14, AUTH-17).
- [ ] **SMK-03** Tell Lenore the company name, states and pay frequency in text → she replies and the fields fill in with statuses (LC-04).
- [ ] **SMK-04** Reload → the same intake and conversation are back (CH-02, LC-01).
- [ ] **SMK-05** Upload the census template filled with 3 rows → it clears its virus scan, reads, and applies (UP-06 to UP-09).
- [ ] **SMK-06** Review lists nothing blocking; choose a PEO (RV-01, PM-04).
- [ ] **SMK-07** Verify an email with a 6-digit code (AUTH-20) → the same intake continues.
- [ ] **SMK-08** Sign and certify → a File ID appears (RK-05).
- [ ] **SMK-09** The Manuscript opens at `/manuscript/<File ID>` and the PDF downloads with the fixed file name (MS-11).
- [ ] **SMK-10** Exactly two emails arrive: the advisor alert and the prospect confirmation (OB-01).
- [ ] **SMK-11** An advisor signs in, finds the submission in the queue, opens it, and changes its stage (AD-03, AD-21).
- [ ] **SMK-12** The advisor generates a Manuscript; the prospect's page offers it as the final one (AD-30, MS-10).
- [ ] **SMK-13** A prospect account opening `/advisor` sees "Advisor access required" (AUTH-22).
- [ ] **SMK-14** A second prospect cannot read the first one's intake or Manuscript (DB-02).
- [ ] **SMK-15** `/privacy` and `/terms` load and say they are drafts (PUB-09).
- [ ] **SMK-16** The Outbox page shows nothing dead or stalled (OB-03).

---

## 4. Public site and legal pages

- [ ] **PUB-01** `/` renders with no console errors; hero chips read "Start as a guest · 15–20 minutes · Manuscript ready same session".
- [ ] **PUB-02** The three "Start Your Intake →" buttons and the navbar "Begin →" all go to `/start`.
- [ ] **PUB-03** `[U]` Anchors `#how-it-works` and `#peo-partners` scroll with the header offset, a direct load of `/#peo-partners` scrolls, and an auth hash such as `#access_token=…` is not treated as an anchor.
- [ ] **PUB-04** "See a sample Manuscript →" (landing, and the navbar link) opens `/manuscript/demo`.
- [ ] **PUB-05** Navbar: transparent until you scroll about 40 px, then blurred; on a phone the hamburger opens a menu and a link click closes it. **Verify**: the phone menu has no "Profile" link where the desktop navbar does, and the hamburger has no accessible name.
- [ ] **PUB-06** **Verify** there is no way for a returning prospect to sign in or out from the landing page or navbar (`/login` is reached only by redirect or typed URL). Confirm that is intended.
- [ ] **PUB-07** `[U]` Read the landing copy against the product: "Every packet carries a File ID", "Manuscript ready same session", the data note ("drafts you don't certify are deleted on a schedule, and we don't sell your information"), "For PEO Partners". No PEO named, no claim of affiliation, no promise to submit for the prospect (`src/copy.guard.test.ts` scans the known phrases).
- [ ] **PUB-08** Legal links and © appear on every public page and the 404. **Verify** the error screen (`ErrorBoundary`) has no legal or home link.
- [ ] **PUB-09** `[U]` `/privacy` and `/terms`: draft banner, "Version 2026-11-draft-1 · Last updated 2026-11-04", the privacy contact placeholder text, seven providers, every retention rule, the four unfinished Terms sections ("[To be completed by counsel.]"), working cross-links, tab title set.
- [ ] **PUB-10** After visiting `/privacy`, navigate in-app to another page → the tab title is restored. **Verify** (the title is set with no cleanup).
- [ ] **PUB-11** Open the network panel on a full intake. Every third-party host appears in the Privacy Policy's provider list. **Verify** Google Fonts (`index.html`), which is requested on every page and is not listed.
- [ ] **PUB-12** An unknown path shows the 404 page; its "Return to Home" does a full reload. **Verify** the HTTP status is 200 on Vercel (a soft 404).
- [ ] **PUB-13** View source and link previews: title, description, Open Graph and Twitter tags. **Verify** the share image is a third-party preview screenshot, and there is no canonical URL or `og:url`.
- [ ] **PUB-14** `curl -I` the site: only the SPA rewrite and `/assets/*` immutable caching are set. **Verify** the missing security headers (CSP, frame options, referrer policy) against what the Privacy Policy claims about security.
- [ ] **PUB-15** After a deploy, request an old `/assets/<hash>.js` → it returns HTML, and a lazy page whose chunk is gone shows the error screen; Reload recovers.
- [ ] **PUB-16** Force a render error → "Something went wrong" with Reload, and an `app_error` / `render_error` ops event is recorded. **Verify** the line "Your progress is saved" is true when you had unsaved typing, and that the screen clears itself after navigation.

---

## 5. Accounts, sign-in and access

### Sign-in and sign-up (`/login`)

- [ ] **AUTH-01** `[U]` `/login` opens in sign-in mode ("Welcome Back"); it opens in sign-up ("Enter The Chamber") only when sent with reason `account_needed`; the notices read "Your session expired. Sign in again to continue." and "You've been signed out."
- [ ] **AUTH-02** `[U]` Sign up: company name optional, email required, password at least 6 characters. **Verify** the password rule is enforced by Supabase Auth, not only by the form. A registered email flips to sign-in with "That email already has an account. Sign in with it below."; success shows "Check your email" and the code form.
- [ ] **AUTH-03** `[U]` Code form: needs 6 characters; a wrong code → "That code didn't work. Check it, or send a new email and use the newest one."; a right code lands on the remembered page; "Send a new email" disables while sending and toasts "We sent a new email to …"; "Use a different email" keeps the typed email and password.
- [ ] **AUTH-04** `[U]` Sign in: success replaces history with the remembered page (else `/start`, or `/advisor` for the advisor audience); wrong password → a toast of Supabase's message; an unconfirmed address → the code screen, "Confirm your email first". **Verify** that screen implies an email was just sent, when none was.
- [ ] **AUTH-05** `[U]` Rate limits: ask for a code twice within a minute, exceed the email quota, and hammer the endpoint → three distinct messages (cooldown, quota, too many attempts). **Verify** a rate-limited code *verification* reads "That code didn't work" instead (the classification is applied to send and resend only).
- [ ] **AUTH-06** The advisor audience shows "Advisor Sign In" with no sign-up toggle.
- [ ] **AUTH-07** A signed-in, verified user opening `/login` is sent on to the remembered page; a guest stays on it.
- [ ] **AUTH-08** **Verify**: as a guest with answers, sign in to an existing account on `/login` → you become a *different* user and the guest's intake stays behind with no warning. (Only the Reckoning's email step upgrades a guest in place.)
- [ ] **AUTH-09** **Verify** no forgot-password flow exists and nothing lets a prospect set a password later. Confirm that is intended.

### Email links (`/auth/callback`)

- [ ] **AUTH-10** `[U]` A confirmation link opens a card with a "Confirm my email" button; nothing is verified until the click (mail scanners cannot spend the token). Walk every state: a 5xx or offline click keeps the button and says "We couldn't reach the server"; an expired or used link says "This link didn't work" in our own words (never the provider's text); the failure page differs for a guest ("Back to your intake"), a signed-in user (Continue) and a signed-out user (Sign in plus a resend form); a session-style link signs in, toasts and redirects; a confirmed user with no link sees "Your email is confirmed"; an empty visit sees "Nothing to confirm here".
- [ ] **AUTH-11** Reload `/auth/callback` after the address bar was cleaned → "Nothing to confirm here". **Verify** the person can still tell the link failed.
- [ ] **AUTH-12** `[U]` Redirect safety: `?next=//evil.example`, `/\evil`, a path with control characters, and `/auth/callback` all fall back to `/start`; a same-site path is kept.
- [ ] **AUTH-13** `[U]` A link opened on any other path (including `/login`) is forwarded to `/auth/callback` with the arrival path as `next`; a plain visit and section links are left alone.

### Guest sessions and CAPTCHA

- [ ] **AUTH-14** `[U]` First visit to `/start` or `/profile` signs in anonymously exactly once; the spinner reads "Entering The Chamber...". Refresh keeps the same guest; clearing site data makes a new one (then use the email-code recovery, CH-03).
- [ ] **AUTH-15** `[U]` With `VITE_TURNSTILE_SITE_KEY` set: the widget shows, no guest is created until it returns a token, and a failed widget or blocked script sends the visitor to `/login` as sign-up. **Verify** a challenge that never completes (no timeout, no expiry handler) leaves the spinner forever, and that any widget error forces account creation.
- [ ] **AUTH-16** **Verify** the session expiring or signing out in another tab while `/start` is open → the page recovers. (The guest request is made once per mount, so the spinner may never resolve.)

### Consent gate

- [ ] **AUTH-17** `[U]` `/start` shows nothing of the Chamber until consent: a checking spinner; "We couldn't open the Chamber" with Try again when the check fails; otherwise "Before you start" (Who we are, What you'll share, How it's used, How long it's kept) with the draft label and the retention figures from the policy (30 days, 30 days, 3 years). The box must be ticked before "Agree and start" enables; "Not now" goes to `/`; Privacy and Terms open in a new tab.
- [ ] **AUTH-18** `[U]` A stale page → "This page is out of date. Reload it…" (EA005); any other failure → "We couldn't record your agreement…". A new consent version asks everyone again; a different sign-in is asked again; a guest upgraded in place is not.
- [ ] **AUTH-19** `[S]` With no agreement on record, the database refuses a new intake and a new document row (EA004).

### Verify email at the Reckoning

- [ ] **AUTH-20** `[U]` A guest at the Reckoning sees "Verify your email to certify": send a code; "We sent a code to …"; verify upgrades the same user in place (same intake, same File ID later). Errors: email already registered ("…we can't yet move your answers into an existing account"), rate limits, generic send failure, wrong code.
- [ ] **AUTH-21** **Verify**: in the code step there is no way to resend or change the address, although the error says "or send a new one", and pressing Enter does nothing (no form). A mistyped address strands the guest until they reload.

### Route guards

- [ ] **AUTH-22** `[U]` `/advisor*` by caller: signed out or guest → `/login` (advisor audience, remembered page); verified prospect → "Advisor access required" with Home and "Sign in with another account" and an `auth_denied` ops event; advisor and admin → in; role check fails → "We couldn't check your access" with Try again; token rejected → "Your session has expired. Taking you to sign in again…"; after a deliberate sign-out the page is *not* remembered.
- [ ] **AUTH-23** `[U]` Signing out: advisors have a Sign out button; **verify** a verified prospect has none. A deliberate sign-out clears the browser's unsaved-answer copies; an expiry keeps them.

### Profile (`/profile`)

- [ ] **AUTH-24** `[U]` Prefill company, contact, phone, employee count; save → "Profile updated"; phone must read like "(555) 123-4567" (7–15 digits, at most 50 characters, optional leading `+`, optional extension); blank fields save as empty; other errors → "Failed to save profile".
- [ ] **AUTH-25** **Verify**: with the profile request failing, the form looks empty, and saving then writes empty values over everything stored; with no profile row, saving still says "Profile updated".
- [ ] **AUTH-26** **Verify** employee count accepts `-5`, `2.7` (saved as 2) and `1e3` (saved as 1).
- [ ] **AUTH-27** The profile copy says it is "used when generating PEO proposals". **Verify** against the product (the Manuscript is not a proposal; the data feeds the advisor view).

---

## 6. The Chamber: lifecycle, saving and recovery

- [ ] **CH-01** `[E]` Opening and reloading `/start` creates nothing in the database; the first message, answer, PEO choice or upload creates the intake; a reload keeps it.
- [ ] **CH-02** Bare `/start` resumes the latest in-progress intake by last activity; an unchanged submitted intake is *not* resumed; if the latest expired, the expired page shows.
- [ ] **CH-03** `?session=` is added once an intake exists and removed after Start over. An id that cannot be opened (another account, revoked, cleared storage) → "We couldn't open that intake" with guest or signed-in copy, the email-code recovery form, "An intake that never had an email verified can't be recovered from another browser.", and "Start a new intake". A guest who verified an email recovers it from another browser with a code.
- [ ] **CH-04** `[E]` Set `last_activity_at` back 31 days → "This intake has expired" with the date; Start a new intake works; a save from an open tab says "Not saved: this intake has expired."
- [ ] **CH-05** Load with the network off → "We couldn't load your intake", Try again, nothing created.
- [ ] **CH-06** Autosave: saves 2 seconds after the last change; the indicator goes Saving… → Saved; a failure shows "Not saved" with Retry and retries every 10 seconds; going offline then online recovers with no data loss.
- [ ] **CH-07** `[E]` Two tabs: tab B, behind, shows "Not saved: this intake was changed in another tab or device." with Load latest and Keep my changes; typing continues locally but nothing is sent; certifying says "This intake changed elsewhere. Reload the latest and certify again."; Keep my changes may conflict again; Load latest drops advisor-verified badges where the other tab changed the answer.
- [ ] **CH-08** `[E]` An answer the database refuses → "Not saved. Please check: <label>." with Discard; labels read sensibly for the census ("Employee 3 in your census") and the transcript.
- [ ] **CH-09** `[L]` Close the tab while a save is in flight and the body is 60,000 bytes or less → a keepalive save, no prompt; with unsaved changes otherwise → the browser's "Leave site?" prompt. Check in Chrome, Firefox and Safari.
- [ ] **CH-10** `[E]` Unsaved-answer copy: go offline, type, close the tab, reopen → "Changes you made on <date> didn't reach our server. This browser kept a copy." with Restore my changes and Discard them, plus the "saved from somewhere else since" line when relevant. The census is never in the copy; copies older than 7 days are dropped; one identical to the server's disappears silently; with site data blocked a warning banner says so.
- [ ] **CH-11** Answers typed before the row exists (if creation failed) have no copy and no leave prompt. **Verify** you can reproduce it (it is documented).
- [ ] **CH-12** `[E]` Start over: the dialog differs for an uncertified intake ("archived, and you won't be able to open it again") and a certified one ("it stays with your advisor"); "Keep this intake" cancels; success gives a blank intake, a new greeting, no PEO, the URL param gone, any voice call ended; a failure keeps the dialog open with "We couldn't set this intake aside just now."; the archived intake never opens again.
- [ ] **CH-13** One open draft per person: a second browser creating an intake → the conflict offer, not a second draft (EA009) `[S]`; a certified-then-edited intake does not count as a draft.
- [ ] **CH-14** Header: "Ready for your review" shows when ready and not certified; "Continue an earlier intake" shows for a guest who has sent no message; Start over shows only once an intake exists.
- [ ] **CH-15** Layout at 1280, 768 and 360: from 768 up the transcript sits beside the workspace; below it the transcript is hidden and a bottom bar appears with a "Chat" sheet. **Verify** a phone briefly shows the desktop layout on first render, that the full-height layout survives the iOS address bar, and that the top bar does not overflow at 360 px.
- [ ] **CH-16** The nine tabs (Upload, Company, Payroll, Benefits, Your Team, Dependents, Review, PEO Match, The Reckoning) all open; the tab bar scrolls sideways on a phone. **Verify** switching away from the Reckoning and back forgets the ticked statements and the typed signature.
- [ ] **CH-17** A banner above the tabs says there may be follow-up questions after submission.

---

## 7. Lenore, typed chat

- [ ] **LC-01** The greeting appears once. A restored conversation opens at the bottom, shows "Restored from your last visit" after the last restored line, and says no second hello.
- [ ] **LC-02** Enter and Send both send; whitespace-only is ignored; a message of 2,000 characters sends and 2,001 cannot be typed (the server answers 413 if forced).
- [ ] **LC-03** An SSN, bank number or card number you type becomes "[redacted]" in the transcript and in the request. **Verify** a message of about 1,995 characters containing a 9-digit run: redaction makes it longer, and it may exceed 2,000 and fail with a permanent "Lenore couldn't respond".
- [ ] **LC-04** Tell Lenore about the company → fields fill with a status each: typed answers are confirmed, inferred or incomplete (never spoken); evidence quotes are short; "I don't know" gives Not known yet; she asks about the next unsettled field in rank order (required first, then the census, then the rest), one at a time; she never asks again for a settled field; when the roster comes up she points to the Upload tab and the census template; she says once that the intake is ready, then carries on with recommended fields, then wraps up.
- [ ] **LC-05** `[U]` Merge rules: a field the prospect edited is never overwritten by Lenore; a field marked "Doesn't apply" is never overwritten; two different typed answers → Conflicting with both candidates; a lower-ranked source shows as "Also heard"; a correction ("actually it's 40") replaces the value.
- [ ] **LC-06** Failures, one at a time, each with its own words and the message kept: rate limit (over 15 a minute), daily cap, timeout (the browser gives up at 45 seconds), AI not set up, function unreachable, generic failure. "Try again" is hidden for the daily cap and "not available"; "Continue manually" always shows and opens Review with focus on its heading; retrying does not duplicate the message; sending anew clears the notice.
- [ ] **LC-07** The conversation log: announces as a log, follows new messages only within 48 px of the bottom and otherwise shows "New message", always scrolls for the prospect's own message, shows local times and centered system notes. **Verify** Enter during IME composition (Japanese, Chinese) does not send half a word, and that the phone bar input has no Send button.
- [ ] **LC-08** **Verify** the orb: thinking → speaking → idle; send a second message within 2 seconds of a reply and check the orb does not drop to idle while it is still thinking.
- [ ] **LC-09** `[L]` One real exchange through the deployed `chamber-extract` for each provider you may run (`AI_PROVIDER` unset or `lovable`, and `anthropic`). The plan still lists "confirm the deployed build is current" as open (F-0.2).
- [ ] **LC-10** Sanitising: counts accept "1,200"; dollars "$18,400"; an experience mod over 10, a dollar value over 100,000,000 and unlisted states are dropped silently, not capped.

---

## 8. Lenore, voice (opt-in beta)

Needs `VITE_ELEVENLABS_AGENT_ID`, a real microphone and each browser in the matrix. Reasons and fixes so far:
`docs/VOICE_ISSUES.md`.

- [ ] **VC-01** `[U]` With no agent id there is no voice button and the orb is not clickable; text works as normal.
- [ ] **VC-02** `[L]` Happy path: "Speak with Lenore" → "Waiting for your microphone. If your browser asks, allow access." → the permission prompt → "Connecting to Lenore..." → "Listening..." / "Lenore is speaking..."; the transcript notes "Voice call started"; spoken lines are saved as spoken; Lenore's first line is the one greeting; hanging up notes "Voice call ended".
- [ ] **VC-03** `[L]` The microphone prompt appears **once** per call in Chrome, Edge, Firefox (with "Remember this decision" unticked), Safari, iOS Safari and Android Chrome. (Our check, then the SDK's; still unverified in a hosted environment.)
- [ ] **VC-04** `[U]` `[L]` Each failure shows its own message, "Continue in text" (puts the cursor in the text box) and, except for an unsupported browser, "Try voice again": microphone blocked, no microphone or another app has it, browser cannot ask, no connection within 15 seconds, connection refused, call dropped (cut the network mid-call). The text chat works after each.
- [ ] **VC-05** `[U]` "Cancel" works while waiting for the microphone and while connecting; a second click is ignored; the button reads "Connecting..." and is disabled.
- [ ] **VC-06** Spoken answers are stored as at most Inferred and show "Please confirm"; a spoken answer that differs from a typed one makes the field Conflicting; a spoken message over 2,000 characters is cut to 2,000 for extraction while the transcript keeps all of it.
- [ ] **VC-07** When extraction of a spoken message fails, the notice says Lenore heard it but could not note the answer; Try again reads every such message again, oldest first, without a new reply.
- [ ] **VC-08** `[L]` After each message Lenore does not re-ask settled fields; she never says aloud that the intake is ready; the agent runs the prompt version named in `docs/prompts/voice-agent-v1.md` (the repo file is pasted into ElevenLabs by hand, so it can drift).
- [ ] **VC-09** Start over or leaving mid-call ends the call; late events from the old call change nothing.
- [ ] **VC-10** `[L]` Retry right after a timeout: record whether the retry waits on the same stalled socket (a known open item); reloading clears it.
- [ ] **VC-11** `[L]` `ops_events` gets `voice_failed` for timeout, refusal, drop and in-call error, and **not** for a blocked or missing microphone or an unsupported browser. A call that reaches its maximum length ends as a drop with no code.
- [ ] **VC-12** Unset the agent id and redeploy → the button is gone and everything else is unchanged (the runbook's lever).

---

## 9. Workspace tabs and field statuses

- [ ] **WS-01** `[U]` Each status shows its badge and controls: Confirmed ("Confirmed by you" for the prospect's own); Inferred ("Lenore captured this — please confirm" and Confirm); Incomplete; Conflicting ("Conflicting answers", the candidates, "Use this"; Confirm does nothing until one is picked); Not known yet ("Needed before you can certify" on a required field); Doesn't apply (with Undo, offered only in Review for an unanswered, non-required, non-census field); Verified by your advisor.
- [ ] **WS-02** Edit and Add by kind: text up to 1,000 characters; counts 0–1,000,000; dollars 0–100,000,000; experience mod 0–10 with two decimals; a state or a list of at most 60 states from the 56 codes; text lists up to 100 items; yes/no/not-sure for booleans. A bad value → "That doesn't look right. Please check the value." and the form stays open.
- [ ] **WS-03** **Verify**: clear a field with Edit → it reads "Lenore will fill this in..." but neither chat nor a document can fill it again (only Doesn't apply has Undo).
- [ ] **WS-04** Company, Payroll and Benefits show "N of M fields captured". **Verify** Benefits: it counts "of 7" but at most 6 things can be counted, so it never reads complete.
- [ ] **WS-05** Your Team: read-only roster (Name, Age, State and ZIP, Title, Pay, Type, Tier, class code); warnings for missing details and "⚠ AB5" for California 1099 workers; a Confirm control on the census; the empty text points to the Upload tab. **Verify** the tier column shows raw codes such as "EE+SP", and a 5,000-row census stays usable (no paging).
- [ ] **WS-06** **Verify** Dependents: the empty text says "Lenore will confirm dependents during conversation", but chat cannot write the census and nothing in the workspace adds a dependent. Confirm intent (decision D21).
- [ ] **WS-07** Every one of the 42 intake fields can be reached and edited somewhere (Review lists them all).
- [ ] **WS-08** The prospect sees full dates of birth in their own census view; they are masked in the Manuscript (MS-05).

---

## 10. Upload and documents

- [ ] **UP-01** Types and size: PDF, XLSX, XLS, CSV, DOC and DOCX up to 20 MB; the dropzone refuses over 20 MB ("<name> is over 20 MB.") and other types ("isn't a PDF, Excel, CSV, or Word file."); drag and drop and the file picker both work. (Not driven by any automated test.)
- [ ] **UP-02** Contents are checked, not just names: a program renamed `.pdf` → refused (415, "executable"); a text file named `.pdf` → "doesn't contain what its name says"; an empty file → "is empty"; a tab-separated `.xls` is accepted; control and bidi characters are stripped from names; names are capped at 200 characters.
- [ ] **UP-03** `[S]` The same bytes again (even renamed) → "already uploaded to this intake"; a 26th file → "an intake holds up to 25 files". `[L]` Race 25 uploads at once → the cap holds (the check has no lock, so verify).
- [ ] **UP-04** Category: seven options, guessed from the file name; changing it persists and rolls back on error; a census found in a file filed as "Other" is re-filed as the census.
- [ ] **UP-05** Delete → "Document removed."; a failure → "Failed to delete document."; the stored file goes before the row. A file that was certified stays for the advisor as "Removed after certification".
- [ ] **UP-06** Scan: a clean file shows "Checking for viruses" (polled every 15 seconds) then becomes readable; `[L]` the EICAR file → "Blocked", a `MALWARE_DETECTED` alert, and the file is in `quarantine`; with the scanner down, the file stays unreadable and after six attempts shows "Couldn't be checked". A blocked or failed file does not count as provided on the Upload tab. **Verify** Review still lists and counts it as uploaded.
- [ ] **UP-07** Reading: statuses Uploaded, Reading…, Read, Saved, "Saved, not read", Password-protected, Couldn't read, Too large to read. A scanned PDF (under 200 characters of text) is unreadable; `.doc` is saved, not read; a processing row stuck for 5 minutes becomes failed; Try again is offered only when it can help. **Verify** the dropzone says "Max 20 MB" while Lenore reads only files up to 10 MB and 50 pages, so a 15 MB file uploads and is never read.
- [ ] **UP-08** `[U]` Candidates: a new answer offers Apply and "Apply all new (N)"; a document answer that outranks chat shows "Replaces what you told Lenore: X"; a conflict opens "Which <label> is right?" with no default, Confirm disabled until a choice, Cancel changing nothing; states afterwards read Applied, Kept yours, Already in intake, and survive a reload.
- [ ] **UP-09** **Verify** applying a candidate for a field the prospect cleared or marked "Doesn't apply" → it still reads "Applied" although nothing changed; and re-reading an already-applied document resets its applied marks.
- [ ] **UP-10** Census files: first 5 rows previewed with "and N more"; rows missing age, state, title or salary are counted; an existing census opens "Compare with your census" with Merge (default), Replace and Keep my census and the counts in both, only in file, only in intake; 5,001 rows are cut to 5,000; SSN and bank columns are never read; a salary over 1,000,000 is dropped; 1099 rows are left out; at most 20 dependents per employee; headers are matched by name.
- [ ] **UP-11** The census template: 12 headers equal to the census row's keys (`first_name` to `class_code`), no SSN or bank column, "What goes in each column" explained, and a filled copy reads with every column matched and no notes.
- [ ] **UP-12** The checklist ("Still helpful to provide" / "That covers the documents we'd most like to see") is never blocking.
- [ ] **UP-13** Uploading before an intake exists creates it first; with consent missing the upload is refused; to a closed intake it says so.
- [ ] **UP-14** `[S]` `[L]` A direct `POST /storage/v1/object/documents/<uid>/<sid>/x.pdf` with a guest token → 403; a prospect cannot download a pending, infected or failed file.
- [ ] **UP-15** `[L]` A 20 MB upload passes the Supabase gateway's body limit (`docs/SUPABASE_SETUP.md` says to confirm).
- [ ] **UP-16** Throwaway project only: a crafted `.xlsx` zip bomb. **Verify** (only `.docx` has an inflate cap of 40 MB; spreadsheets are bounded only by the 10 MB compressed limit).
- [ ] **UP-17** iOS Safari and Android Chrome: choose a file from the phone, watch the progress, and read it (plan I-1.3).

---

## 11. Review, readiness and open items

- [ ] **RV-01** `[E]` `[S]` Required answers are company legal name, states of operation (a state code, or a work state on the census) and pay frequency. Remove each in turn → Review says "Still needed before The Manuscript can be generated: N" with a "Go to …" or "Choose …" button that scrolls and focuses the field; the Reckoning's button disables; a direct certification is refused by the database (EA003) naming the keys.
- [ ] **RV-02** `[E]` `[S]` A required answer with two values (chat, then a document) → Review shows "Choose"; certification is blocked even if an advisor verified it (EA008). States that conflict only through the census block in the browser only.
- [ ] **RV-03** **Verify** a required answer that is *incomplete*: Lenore does not call the intake ready and the "Ready for your review" badge stays off (the ready rule excludes incomplete), but neither the Reckoning nor the database blocks certification (the gate refuses only missing and conflicting). The glossary and a code comment call these one rule. Decide which is intended.
- [ ] **RV-04** An inferred required answer counts as ready and can be certified, and stays an open item.
- [ ] **RV-05** "Not known yet" and "Doesn't apply" cannot stand in for a required answer.
- [ ] **RV-06** **Verify** a section chip ("Needs confirmation") beside progress text "Complete" when its answers are inferred.
- [ ] **RV-07** `[U]` Open items: order is conflicting, incomplete, unknown, inferred; required first; each field once; reasons read "Not provided", "Prospect to provide", "Document needed", "Conflicting answers", "Incomplete", "Please confirm". The same list appears in Review, the Manuscript and the advisor queue's counts.
- [ ] **RV-08** The recommended box lists the census (with a hint to the Upload tab); it and "See Your PEO Matches →" never block.
- [ ] **RV-09** Eligibility checks: pass, fail and "— not yet verified"; flagged job classes. **Verify** the headcount check reads "— minimum not yet confirmed — not yet verified" on the Manuscript, and that the Industry, Workers' comp history and Renewal-increase checks are always "unknown" and nothing clears them.
- [ ] **RV-10** The ready announcement: Lenore says it once, after her own reply; not when the intake was ready on open; not again if it is already in the transcript.
- [ ] **RV-11** Review's documents block counts a blocked or unscanned file as "Uploaded". **Verify** (same as UP-06).

---

## 12. PEO Match

- [ ] **PM-01** Tiles: Total EEs (a headcount of 0 shows 0; a dash only when there is no count and no census), Dependents, Avg Salary, States. **Verify** Avg Salary divides by all rows and counts a missing salary as 0, so it understates.
- [ ] **PM-02** **Verify** the "Has 1099 Contractors" and "Multi-Entity" chips appear only once Virgin Medical is answered.
- [ ] **PM-03** Five PEOs, alphabetical, none ranked or pre-selected; every fit check reads "Not yet confirmed" and the footer says each is not yet checked against the PEO's materials. No claim that a PEO works with the advisory firm.
- [ ] **PM-04** "Choose <PEO>" → "✓ Selected" and the button reads "Proceed with <PEO> →"; with none chosen "Continue without choosing a PEO →". "Another PEO": 80 characters, trimmed, blank disabled. **Verify** typing a listed name in another case (`trinet`) selects no card yet the button names it.
- [ ] **PM-05** **Verify** what choosing a different PEO after certifying does: the Reckoning says "You certified for X, and you've since chosen Y. Certify again so your Manuscript names Y." The plan (section 1.1) says it withdraws the certification; the tab and the SQL test say it does not. Check the intake's status afterwards and reconcile the docs.

---

## 13. The Reckoning (certification)

- [ ] **RK-01** Three statements (the third names the chosen PEO, or "the PEO I choose") and a signing statement; the consent wording `2026-10-draft-1` carries "DRAFT: NOT LEGALLY REVIEWED".
- [ ] **RK-02** A guest sees the email step, not the sign form; the blocker list includes "Verify your email".
- [ ] **RK-03** Sign step: name and role required and prefilled from an earlier certification; each statement must be ticked; the toasts read "Check every statement before you sign.", "Type your full name to sign.", "Enter your role at the company to sign."; once signed it shows name, role, company and time with a Change link.
- [ ] **RK-04** "Generate The Manuscript →" stays disabled until nothing blocks; the line below lists every blocker in order (add…, choose one answer…, verify your email, wait for saving, check every statement, name, role, sign).
- [ ] **RK-05** `[U]` Success: toast "Your certification was recorded and your submission is saved.", then an overlay "The Raven has spoken." with company, signer, File ID, version and what happens next. **Verify** the overlay has no close button, and "Download The Manuscript" and "View Full Manuscript" go to the same place.
- [ ] **RK-06** `[E]` Double-click and four identical concurrent certifications → one submission, one File ID, one set of emails.
- [ ] **RK-07** Failures keep the signature: a network error shows "Your submission wasn't saved." and the button reads "Try again: Generate The Manuscript →"; a database refusal gives the specific message (add these on Review (EA003); choose one answer for these (EA008); invalid; changed elsewhere; expired; can no longer be saved).
- [ ] **RK-08** `[U]` Changing an answer after signing, or during the save, voids the signature and the ticks with "Your information changed after you signed…". Confirming or editing only the status of an answer, and chat messages, do not withdraw it.
- [ ] **RK-09** A certified and current intake shows "Certified by <name>, <role>, on <date>. File ID: … (version N)" with the Manuscript link; a changed one shows "Your answers changed after you certified on <date>… Your File ID stays <id>."
- [ ] **RK-10** `[S]` Re-certifying: the File ID never changes; the version goes up; an alert marked "Updated intake" and a second confirmation go out only when the answers changed; identical answers queue nothing.
- [ ] **RK-11** `[S]` The database stamps the time, the answers' SHA-256 and the consent text and version; a File ID sent by the browser is ignored; certifications cannot be changed or deleted by any API role.
- [ ] **RK-12** `[S]` A guest cannot certify (42501) and an expired intake cannot be certified.
- [ ] **RK-13** After success, `dispatch-outbox` is invoked; if that call fails the prospect's screen is unaffected.

---

## 14. The Manuscript (page and PDF)

### Access and states

- [ ] **MS-01** `[U]` Who sees what: the owner sees the frozen certification; another prospect, a revoked or archived intake, and a File ID that does not exist all show "We couldn't find that Manuscript…" (no difference between them); signed out with an id → "Sign in to view this manuscript."; signed out with no id → open it from The Reckoning. **Verify** the Sign in link returns the person to the Manuscript, and that an advisor opening a prospect's `/manuscript/<File ID>` gets a working page (the back link points at the prospect's own Review).
- [ ] **MS-02** `[U]` A File ID must match `EAA-<4 digits>-<4–12 of 0-9A-Z>`; lowercase is refused; a legacy `EAA-2026-1A2B3C4D` opens.
- [ ] **MS-03** `[U]` States: loading; not signed ("hasn't been signed yet"); expired (checked before not signed); changed after certifying and no snapshot ("no longer applies"); withdrawn (a snapshot exists: the banner, the "Withdrawn Underwriting Packet" heading, and no download buttons); ready; sample.
- [ ] **MS-04** `[U]` Header: Prepared For (the PEO, if chosen), Prepared By, Certified date, File ID (or "Not assigned"), Version "v2 · data version 17" (or "Not recorded"), Review "As certified, before advisor review", Prospect.
- [ ] **MS-05** `[U]` Twelve sections in order with their empty states; the census table; dates of birth shown as `••/••/1990` with "Age N"; a date with no year shows `••/••/••••`; there is no way to reveal them.
- [ ] **MS-06** `[U]` Status chips and source lines show only for conflicting, unknown and not-applicable answers beside "Not provided"; a verified answer reads Confirmed and leaves the open items; a required answer in conflict stays Conflicting; nothing is invented, and "Meridian" never appears outside the demo.
- [ ] **MS-07** `[U]` Draft consent: the line "Consent wording … · DRAFT: NOT LEGALLY REVIEWED" and a diagonal DRAFT watermark follow the version that was signed (the approved list is empty today); a legacy certification with no wording prints the fixed line.
- [ ] **MS-08** The page footer says "Prepared by: Edgar Allan Advisory · edgar-allan-advisory.lovable.app". **Verify**: production is `nevermorepeo.com`, and the PDF carries no such line.
- [ ] **MS-09** `[U]` The status note shows only for Submitted, Under review and Information requested, in the prospect's words; none for the internal stages.
- [ ] **MS-10** `[U]` Final version: offered only when the latest advisor version was built from the current certification; a green box, an "As certified (PDF)" button beside "Download the final Manuscript (PDF)" at the top, only the final one at the bottom; a failed download toasts "We couldn't download the final Manuscript."; a new certification removes the offer. **Verify** an error fetching the offer is swallowed with no message.

### The PDF

- [ ] **MS-11** `[U]` File name `The_Manuscript_<File ID>_v<n>_<company ≤40>_<YYYYMMDD>.pdf`, for example `The_Manuscript_EAA-2026-0042_v2_Signed_Co_20260501.pdf`; US Letter; selectable text; a running header and footer with File ID, version and "Page X of Y" on every page; table headers repeat and rows never split; a conflicting answer prints "(unresolved — see open items)" unless an advisor verified it; metadata title and author set; failure toasts "We couldn't generate the PDF. Please try again."
- [ ] **MS-12** `[U]` Draft consent in the PDF: a faint rotated DRAFT watermark and the consent line, kept on one page. **Verify** with a very long company name or consent text (the block height is estimated, so the block can spill and the watermark cover only part).
- [ ] **MS-13** Names outside Latin-1 (`李雷`, `محمد`, an emoji) print as `?` in the PDF while the page shows them; accents are folded. **Verify** and decide whether a packet sent to PEOs may lose names.
- [ ] **MS-14** **Verify** dates: the file name uses the UTC date and the page shows the viewer's local date; near midnight, or across time zones, the two differ, and the same packet prints different dates for different viewers.
- [ ] **MS-15** A 5,000-row census: the page and the PDF still build in acceptable time and memory.
- [ ] **MS-16** Download works in Chrome, Edge, Firefox, Safari, iOS Safari and Android Chrome, with and without a pop-up blocker; the browsers without the `download` attribute fall back to opening a tab.
- [ ] **MS-17** `[U]` `/manuscript/demo` needs no sign-in and makes no database call; it shows the "fictional data" banner, "EAA-SAMPLE", "[Full Name]" and "[Role]" in the signature block, and downloads a "Sample Underwriting Packet"; its back link reads "Start Yours".
- [ ] **MS-18** **Verify** that a token refresh or returning to the tab does not re-run the load and flash the full-page spinner (the load depends on the user object).

---

## 15. Advisor Console (`/advisor`)

### The queue

- [ ] **AD-01** `[U]` Header: Submissions and "Outbox & Notifications" links, the advisor's email, Sign out, legal links.
- [ ] **AD-02** `[U]` Ordering: certified submissions first, newest first, then uncertified intakes by last activity. `[S]` Empty guest drafts (no first message) are left out.
- [ ] **AD-03** `[U]` Columns: Company ("Company not provided" when empty, with the File ID or "No File ID yet"), Contact, States ("+N more" after 4), Employees, Submitted, Status, Completeness. The Submitted cell reads a date, or "Expired (idle draft)", "Archived by prospect", "Revoked", "Date not recorded", "Needs re-certification", "Not certified".
- [ ] **AD-04** `[U]` Filters live in the URL (`status`, `q`, `action`, `page`): a stage dropdown with all ten stages (an unknown value is ignored); "Needs advisor action only"; search by company, contact or File ID needs 3 non-space characters (the hint reads "Type at least 3 characters to search.") and waits 300 ms; a space typed before the pause is kept; any change goes back to page 1 and replaces history; paging pushes history so Back undoes it.
- [ ] **AD-05** `[U]` Paging at 25 a page with Previous / "Page X of Y" / Next; the count line reads "N submissions" or "a–b of N" with "matching “q”"; a page past the end says "There's nothing on page N." with a way back.
- [ ] **AD-06** `[U]` Empty states: none yet; none under review ("Show all statuses"); none needing action; search with no match ("Search covers company, contact and File ID." and "Clear search").
- [ ] **AD-07** `[U]` Completeness: "Missing required" (listing the fields), "Needs review" (open items and advisor flags), "Complete".
- [ ] **AD-08** `[U]` "Email bounced", "Reported as spam", "Email blocked" and "Email problem" show under the contact; if the flag check fails the queue still loads without flags.
- [ ] **AD-09** A click anywhere on a row opens the submission; the company link opens in a new tab with the keyboard or middle-click; the Refresh button works and disables while loading.
- [ ] **AD-10** **Verify** an unrecognized pipeline value renders as "Draft" with no signal that it was unknown.

### The submission

- [ ] **AD-11** `[U]` Not found: "Submission not found." **Verify** `/advisor/submissions/not-a-uuid` shows the same, not "We couldn't load this submission." with a raw database error.
- [ ] **AD-12** `[U]` Header and banners: company, a "Needs advisor action" badge, File ID or "File ID assigned when the prospect certifies"; one of three lines (certified by, withdrawn with what changed, not certified yet); the email-problem banner with the phone on file.
- [ ] **AD-13** `[U]` "Changed since signing" (As signed vs Now) shows only when withdrawn, and says "No answer differs from the signed copy." when it does not; the census reads as one row ("N people, details changed").
- [ ] **AD-14** The census table gives advisors full dates of birth, with tier, class code and dependents; no masking.
- [ ] **AD-15** `[U]` Transcript evidence: speaker (Prospect, Lenore, System), "· spoken", a date and time; the certified copy with "Showing the conversation as the prospect certified it. It has changed since."; "No conversation recorded."; "View in transcript" scrolls to and highlights the message.

### Field review

- [ ] **AD-16** `[U]` 42 fields in 7 sections with an anchor bar; the headline "N of 42 verified"; each field has Verified, Incomplete and Needs follow-up. **Verify** clicking the active one again clears it.
- [ ] **AD-17** `[U]` Corrections: "Corrected value" plus a reason (printed in the final Manuscript the prospect receives, up to 2,000 characters); "That isn't a valid value for <label>." and "Give a reason for the correction."; the census cannot be corrected, only reviewed. A new correction sets the review to Needs follow-up unless one exists.
- [ ] **AD-18** **Verify** Remove correction uses a browser `prompt`, and cancelling or leaving it blank does nothing and says nothing.
- [ ] **AD-19** `[U]` Audit badges: **Prospect confirmed** when the status is confirmed; **Advisor overridden** when a verified correction replaces it (it wins over Prospect confirmed); a pending correction has no badge and reads "Not used until verified"; "Conflicting answers: A vs B", "Also heard", "No source recorded".
- [ ] **AD-20** `[U]` A prospect's change to a reviewed answer resets its review with the notice "The prospect changed this answer after it was reviewed… Review it again."; a review of an answer that changed since the page loaded is refused (PT409), toasts, and reloads. **Verify** the "Corrected value" box stays open under the reloaded page.

### Pipeline, flags and notes

- [ ] **AD-21** `[U]` Pipeline: every allowed move works and nothing else is offered.

  | From | To |
  |---|---|
  | draft | archived |
  | submitted | under review, information requested, lost, archived |
  | under review | information requested, ready for market, lost, archived |
  | information requested | under review, lost, archived |
  | ready for market | under review, information requested, sent to carrier, lost, archived |
  | sent to carrier | information requested, quoted, lost, archived |
  | quoted | sent to carrier, won, lost, archived |
  | won, lost | archived |
  | archived | submitted ("Submitted (reopen)") |

  An intake never certified can only be archived; the select disables with "No status change is available."; a note up to 2,000 characters; success toasts "Status changed to X."; a refusal reads "A submission can't move from X to Y…" `[S]`. **Verify** after a refusal the page is not reloaded, so the dropdown stays stale.
- [ ] **AD-22** `[U]` The prospect-visibility hint is right for each stage: only Submitted, Under review and Information requested are shown to the prospect; a withdrawn certification shows nothing; a prospect certifying while at Information requested returns the stage to Submitted `[S]`.
- [ ] **AD-23** `[U]` History lists From → To, the actor (Prospect, an email, System), the time and the note; "needs action" rows that keep the stage read as flags, not stage changes.
- [ ] **AD-24** `[U]` `[S]` Needs advisor action: mark with a note up to 500 characters; the panel says who and when; Clear with an optional note; it shows on the queue, filters, survives stage changes and is never shown to the prospect.
- [ ] **AD-25** `[U]` Internal notes: up to 5,000 characters; "Add note" disabled when empty; newest first with author and time; there is no edit or delete in the screen and the database refuses both `[S]`.
- [ ] **AD-26** `[U]` Documents: name, category, size and date; Open makes a 60-second signed link and downloads; the annotations (Removed after certification, Added after certification, re-categorised, renamed); the scan notices (quarantined, not openable, being checked) disable Open. **Verify** the Open flow and scan notices by hand (no test drives them).
- [ ] **AD-27** The Review audit trail reads one line per event ("corrected X to Y", "marked X Verified (was …)", "changed X from A to B, so its review was reset"); "No review changes yet."

### Manuscript versions

- [ ] **AD-28** `[U]` Not certified: no Generate button and a message; withdrawn: "can be generated once they certify again". Certified: "Include full dates of birth" (off by default) and Generate or "Regenerate as new version".
- [ ] **AD-29** `[U]` Warnings: certified again after the version; review changed since; the prospect changed N answers; N corrections not verified yet.
- [ ] **AD-30** `[U]` Generate builds from the certified answers and the verified corrections, stores the file in the private `manuscripts` bucket at `<intake>/v<n>-<uuid>.pdf`, records the version, downloads it and toasts "Manuscript v<n> saved."; a failed record removes the file. Stale refusals (certified again meanwhile, review changed meanwhile, another version meanwhile) say so, reload, and keep no file.
- [ ] **AD-31** **Verify** the advisor-generated file name against the prospect's download of the same final version: the advisor's omits `_v<certification>_` and uses "Company" for a missing name, where the prospect's can read "Company_name_not_provided".
- [ ] **AD-32** `[U]` The version list: vN, who and when, corrections and DOB treatment, "Shared with the prospect as their final Manuscript" on the latest current one, "Built from an earlier certification" otherwise, a Download vN button (60-second link).

### Sessions and roles

- [ ] **AD-33** `[U]` Expired token on a load → "Your session has expired." then sign-in; role lost → "You no longer have advisor access." with an ops event.
- [ ] **AD-34** **Verify** the same expiry in the middle of a *change* (status, note, flag, generate, open a document): it only toasts, and does not end the session and go to sign-in as `docs/ADVISOR_ACCESS.md` says it should.
- [ ] **AD-35** Every advisor sees every intake (decision D16, accepted for the pilot). Confirm the pilot team is small and named, and that the quarterly access review is scheduled (RUN-10).
- [ ] **AD-36** Admin-only actions (revoke an intake, request or retry a deletion, ops summary) have no screen; test them through SQL or the API (DB-05).

---

## 16. Outbox and notification emails

- [ ] **OB-01** `[S]` One certification queues exactly two events (advisor alert, prospect confirmation); certifying identical answers again queues none; changed answers queue an "Updated intake" alert and a second confirmation.
- [ ] **OB-02** `[L]` The emails: File ID labelled as such; no census values, SSNs or bank data; headcount from the census; links use the production address (`APP_BASE_URL`); the response time and support address are the agreed ones; plain text; sent from the verified domain and landing in an inbox, not spam.
- [ ] **OB-03** `[U]` `/advisor/outbox`: filter chips with counts (All, Dead, Pending, Claimed, Sent, Suppressed, in the URL); a red alert when the oldest due item has waited 10 minutes ("Nothing has picked up the queue for N minutes."); columns Notification, Status, Attempts ("n / 5"), When, Last error (plain words plus the raw text), Actions. **Verify** a status with more than 100 events: the list shows 100 and the chip counts show the true total, with no paging or warning.
- [ ] **OB-04** `[U]` `[S]` Retry a dead event → "Queued again. It will be sent on the next run, within about a minute."; one retry at a time; a frozen one offers "Rebuild and retry…" with a duplicate warning; an event no longer dead says so; a suppressed one gives no retry.
- [ ] **OB-05** `[L]` Retry timing: after 1 minute, 5, 30 and 2 hours; five attempts, then dead and an `OUTBOX_DEAD` webhook post. Kill the provider key on a test project and watch it happen, then requeue.
- [ ] **OB-06** `[S]` `[L]` Bounces: send a confirmation to Resend's bounce test address → the address is in `email_suppressions`, the queue shows "Email bounced", the detail page shows the banner, and a second confirmation to it is held (`suppressed`). The advisory team's own addresses are never suppressed.
- [ ] **OB-07** `[U]` `[L]` Webhook: a bad or missing signature → 401 (even with no secret set); a stale or future timestamp (over 5 minutes) → 401; the same event twice → 200 with `duplicate`; no secret configured → 503; an event for an untracked type → 200 and ignored.
- [ ] **OB-08** `[L]` The "unqueued certifications" query in `docs/NOTIFICATIONS.md` returns no rows; test submissions are removed from `outbox_events` before launch.
- [ ] **OB-09** **Verify** the sign-in code emails (sent by Supabase Auth through the same Resend account): a bounce suppresses the address, but neither the prospect nor an advisor is told the code never arrived.

---

## 17. Edge functions (API level)

Call each against the staging project. Replace `<ref>`; use real JWTs. Every function answers CORS preflight with 200
and no auth, except `resend-webhook`, which answers 405.

### chamber-extract (POST, user JWT)

- [ ] **FN-01** No header, or the anon key alone → 401 `unauthorized` (and no event recorded).
- [ ] **FN-02** Bad body: not JSON, blank `message`, `context` not an object, unknown status value, more than 10 `recent` entries, a bad `census` → 400; `message` over 2,000 characters, or context plus statuses plus recent over 20,000 → 413; a `session_id` that is not a UUID → 400.
- [ ] **FN-03** `[U]` Someone else's or a missing `session_id` → 404 `not_found`, even for an advisor, and no budget is spent. **Verify** chat on an *expired* intake still works and spends budget (only ownership is checked).
- [ ] **FN-04** Limits: per user 15 a minute and 300 a day → 429; per address 20 and 400 → 429; global 2,000 a UTC day → 503 `daily_cap`; a budget service that fails → 503 (fails closed). Address comes from `cf-connecting-ip`, else the last `x-forwarded-for` hop.
- [ ] **FN-05** Provider: `AI_PROVIDER` unset or `lovable` (default model `google/gemini-3-flash-preview`), `anthropic` (default `claude-haiku-5-5`); `AI_MODEL` overrides; a missing key or unknown provider → 503 `unavailable` with `AI_CONFIG_MISSING` logged; 20 seconds per attempt, one retry after 1 second on a network error, 429 or 5xx only; timeout → 504; provider 402 → 503 (never says billing); other provider errors → 502; no tool call or a truncated answer → 502 `invalid_response`.
- [ ] **FN-06** Success returns `extracted`, `field_status`, `evidence`, `corrected_fields`, `reply`, `rejected`, `prompt_version` 5 and `request_id` (also the `X-Request-Id` header). Values the schema refuses are dropped and only their paths logged; with no model reply the server asks the next unsettled field.
- [ ] **FN-07** `[U]` Every signed-in call writes one `ai_extraction_events` row (no prospect content) via the service role.
- [ ] **FN-08** **Verify** `curl` with `message: "SSN 123-45-6789"` against a stub provider: the browser redacts, but only `recent` is redacted again server-side, so the message and context reach the provider unredacted from a direct caller.

### document-upload (POST multipart, user JWT: the only way files reach storage)

- [ ] **FN-09** The refusal ladder `[U]`: not POST 405; missing config 503; no user 401; oversize 413 (header and streamed body); not multipart, bad `session_id`, bad `category`, no file 400; zero bytes 422 `empty`; over 20 MiB 413 (exactly 20 MiB passes); executable 415 `executable`; wrong extension 415 `unsupported`; contents not matching the name 415 `mismatch`.
- [ ] **FN-10** `[S]` Row refusals: duplicate 409 `duplicate`; 25 files 409 `limit`; closed intake or a deletion open 409 `closed`; no consent 403 `consent`; not your intake 404; anything else 500 `internal`.
- [ ] **FN-11** Scanning by `MALWARE_SCANNER`: `clamav` (TLS unless localhost), `http` (https, Bearer token, the reply `{"verdict":"clean"}` or `infected` with a signature, redirects refused), `none` (verdict `skipped`, readable, internal demo only), unset or invalid (held in `quarantine`). An unreachable, failing or timed-out (60 s) scanner is never "clean". Clean and skipped store to `documents`; infected and unavailable to `quarantine`; everything is stored as `application/octet-stream`.
- [ ] **FN-12** A storage failure removes the row and returns 502 `storage`; if the intake is deleted while storing, the file and row are removed and the answer is 409 `closed`. **Verify** an exception after the row insert leaves a row with no file and the same file then returns 409 `duplicate` until the row is removed.
- [ ] **FN-13** **Verify** the function records no `upload_failed` ops event of its own (only the browser reports), so server-side 500 and 502 failures do not feed that alert.
- [ ] **FN-14** There is no upload rate limit; the only caps are file size, 25 files and no duplicate. Decide whether that is acceptable for launch.

### document-scan (POST, service role, every 5 minutes)

- [ ] **FN-15** `[U]` Anon key, a user token or no header → 401; GET → 405; missing config → 503.
- [ ] **FN-16** Per run: one document per claim with a 300 s lock, at most 50 documents or 45 seconds; with no scanner set, nothing is claimed, `scan_failed` / `config_missing` is recorded and orphans are still swept.
- [ ] **FN-17** Retry delays 5 minutes, 15 minutes, 1, 4 and 12 hours; after 6 attempts the document is `failed`, `SCAN_FAILED` posts, and `requeue_document_scan(id)` (service role) brings it back; an infected legacy file in `documents` is moved to `quarantine`; the response counts `{claimed, clean, skipped, infected, retrying, failed, gone, orphans_removed}`.

### document-extract (POST, user JWT)

- [ ] **FN-18** Order `[U]`: 401; 400 for bad JSON or a non-UUID id; 404 for another user's document; 409 when the scan has not passed; a document over 10 MiB returns 200 `too_large`.
- [ ] **FN-19** Limits: more than 50 PDF pages is too large; a scanned PDF is unreadable; encrypted is `encrypted`; `.doc` unsupported; `.docx` inflates at most 40 MB; at most 20,000 characters go to the model; no SSN or bank column is read; a census-only file spends no AI budget.
- [ ] **FN-20** A model failure returns **200** `{status:"failed", code}` (not a 5xx, unlike `docs/AI_OPERATIONS.md`); a budget refusal returns 429 or 503 and puts the document back to `uploaded`.
- [ ] **FN-21** **Verify** concurrency: two reads of one document at once both run and both spend budget; re-reading wipes the applied marks; a crash after the document is set to `processing` leaves it there and nothing on the server sweeps it.

### dispatch-outbox (POST)

- [ ] **FN-22** Auth: the service key (the schedule, which also runs the housekeeping) or a signed-in non-guest user; anon key, nothing, or a guest → 401. **Verify** any verified prospect can trigger a send sweep with no rate limit (probably deliberate).
- [ ] **FN-23** Config: a missing Resend key or no sendable kind → 503; a kind with invalid settings stays queued without spending an attempt and `last_error` names the missing setting. Advisor mail needs `EMAIL_FROM`, `ADVISORY_NOTIFY_EMAIL` and an https `APP_BASE_URL`; the confirmation needs `EMAIL_FROM`, `SUPPORT_EMAIL` and `PROSPECT_RESPONSE_TIME`.
- [ ] **FN-24** Batches of 10, a 600-second claim, a 10-second send timeout; the email is frozen with an idempotency key before the first send and reused byte for byte; a frozen message older than 20 hours is rebuilt under a new key; a key rotates only after a definite refusal (400, 401, 403, 404, 405, 413, 422, 429); provider text is stored with addresses and tokens removed.

### resend-webhook, ops-monitor, purge-intakes

- [ ] **FN-25** `[U]` `resend-webhook`: see OB-07; a body over 256 KiB → 413 (**verify** the body is read before the cap is checked); a database failure → 500 so the provider retries; at most 20 recipients kept.
- [ ] **FN-26** `[U]` `ops-monitor` (service role): it claims each kind past its threshold and outside its cooldown, logs `OPS_ALERT …`, posts to `ENGINEERING_ALERT_WEBHOOK_URL` (https, no credentials in the URL) and answers `{alerts, delivered}`; with the webhook unset it logs `OPS_CONFIG_MISSING`; a refused webhook counts as undelivered and the cooldown still starts.
- [ ] **FN-27** `[U]` `purge-intakes` (service role): claims 5 deletions with a 600 s lock, removes the files in chunks of 100, re-lists, then deletes the rows in one transaction (EA006 if a file remains, retried); stops after 20 batches or 40 seconds; delays 5 minutes, 30 minutes, 2 and 6 hours; after 5 attempts → `failed`, `deletion_failed` recorded and `DELETION_FAILED` posted.

---

## 18. Database and access control

- [ ] **DB-01** `[S]` `data_isolation.sql` passes over every migration; every table has row security; every `SECURITY DEFINER` function pins its `search_path`; no public bucket. When you add a migration, add it to the list in that file and bump its count.
- [ ] **DB-02** `[E]` `[L]` Cross-account read over the real API: guest B's `GET /rest/v1/chamber_sessions?id=eq.<A's intake>` → `[]`; with only the anon key → `[]` (`docs/SECURITY_REVIEW.md` check 3).
- [ ] **DB-03** The access matrix, by role (prospect/guest, advisor, admin, service role), against `docs/SECURITY_REVIEW.md`: intakes, certifications, documents, profiles, roles, consents, pipeline and notes, monitoring, outbox and email tables, buckets. A signed-out caller can call only `has_role`, `is_advisor`, `report_client_event`, `intake_consent_version` and pure helpers.
- [ ] **DB-04** `[S]` Every advisor function refuses a signed-out caller, a guest, a prospect and an advisor presenting a guest token (42501).
- [ ] **DB-05** `[S]` Admin only: `revoke_chamber_session` (needs a 1–2,000 character reason, 22023; refuses a certified intake, 55000), `request_intake_deletion`, `retry_intake_deletion`, `admin_ops_summary`.
- [ ] **DB-06** `[L]` Status codes over PostgREST: EA00x → 400, 42501 → 403, PT404 → 404, PT409 → 409, 23505 → 409. **Verify** the advisor functions that still raise `P0002` ("Submission not found") answer 500, not 404.
- [ ] **DB-07** `[S]` Certification gate: guest → 42501; missing company name, states or pay frequency → EA003 (DETAIL lists keys); a required field in conflict → EA008; a signature without name, role, consent text or version, or answers different from the intake's → 23514; a File ID that is not the intake's → 23514.
- [ ] **DB-08** **Verify** the gate reads field *statuses* that the browser writes: a client that lies about provenance bypasses EA008 (acknowledged in the migration). Decide whether that is acceptable.
- [ ] **DB-09** `[S]` File ID: `EAA-<UTC year>-<NNNN>`, padded to four digits and never truncated past 9999; set once; unique; the browser's value is ignored; two intakes certified at the same moment get different numbers.
- [ ] **DB-10** `[S]` Changing answers after certifying sets the intake back to in progress, supersedes the certification and returns the pipeline from Submitted to Draft.
- [ ] **DB-11** `[S]` Validation: an unknown top-level key or wrong shape → EA001 with the path; `data_version` is the database's; a stale save updates nothing; caps of 5,000 employees, 20 dependents and 60 states.
- [ ] **DB-12** `[S]` Lifecycle: `expires_at` is last activity plus 30 days and null once certified; a write to an expired, archived or revoked intake → EA002; `archive_chamber_session` answers `archived` or `kept`; setting those statuses directly → 42501.
- [ ] **DB-13** `[L]` Signed links expire: as an advisor open a document, copy the address from the download list, wait 70 seconds and request it → Storage answers 400, not the file (`docs/SECURITY_REVIEW.md` check 1). Strip `&download=…` from a link → the browser still downloads.
- [ ] **DB-14** `[L]` Buckets: `documents`, `manuscripts` and `quarantine` are all private; `documents` and `quarantine` allow only `application/octet-stream` up to 20 MB (check 2).
- [ ] **DB-15** `[L]` Supabase's security advisor (Database → Advisors) shows no table without row security and no function with a mutable search path (check 4).
- [ ] **DB-16** `[L]` Uploads go through the check: a direct storage `POST` → 403; a renamed program through `document-upload` → 415; the EICAR file → quarantined (check 5). Record the date in `docs/SECURITY_REVIEW.md`.
- [ ] **DB-17** `[S]` Every migration applies once, in order, to an empty database; no repeated version or SQL body (`src/data/migrations.test.ts`); an existing project follows "Migration versions" in `docs/SUPABASE_SETUP.md`.

---

## 19. Data lifecycle and retention

- [ ] **LIFE-01** `[S]` An uncertified draft expires 30 days after its last change (`expire-idle-intakes`, hourly at :17); a closed draft is queued for deletion 30 days after it closed (`run-retention`, 03:41 UTC) and removed by `purge-intakes` (hourly at :23).
- [ ] **LIFE-02** `[S]` Submitted records are never deleted automatically; `retention_review_due()` lists those three years past their latest certification.
- [ ] **LIFE-03** `[S]` Other windows: `ops_events` 90 days, `ai_extraction_events` 90 days (03:43), `email_delivery_events` 365 days (suppressions kept), AI rate-limit records 1 day, the browser's unsaved copy 7 days. The Privacy Policy renders the same numbers from `src/data/dataPolicy.ts`.
- [ ] **LIFE-04** `[L]` A deletion removes the files under `documents`, `quarantine` and `manuscripts` (check `storage.objects` is empty for the intake) and then every row; `intake_deletions` stays; accounts, consents and email delivery events stay.
- [ ] **LIFE-05** `[S]` While a deletion is open, a new document row is refused (EA007) and no upload lands after it.
- [ ] **LIFE-06** **Verify** a certified document the prospect removed (kept as evidence) is not purged once the certification moves on (a known open item, H-1.2).
- [ ] **LIFE-07** After a restore: re-delete the intakes listed in `DELETION_DONE` log lines, run `run_retention()` and `expire_idle_intakes()` once, and confirm the cron jobs are active (RUN-08).

---

## 20. Operations and monitoring

- [ ] **RUN-01** `[L]` Cron: `select jobname, schedule, active from cron.job` shows `dispatch-outbox` (every minute), `ops-monitor` (*/5), `document-scan` (*/5), `purge-intakes` (:23), `expire-idle-intakes` (:17), `run-retention` (03:41) and `prune-ai-extraction-events` (03:43). **Verify** the docs and the setup script count five or six jobs and do not check `prune-ai-extraction-events`.
- [ ] **RUN-02** `[L]` The HTTP jobs run: Vault holds `project_url` and `service_role_key`; `cron.job_run_details` is clean; `net._http_response` shows 200s. **Verify** no timeouts (the jobs set no timeout, and a scan or purge run can last 40–45 seconds).
- [ ] **RUN-03** `[L]` Monthly alert test: `select public.record_ops_event('deletion_failed','runbook-test','test')` → within five minutes the channel shows `OPS_ALERT kind=deletion_failed`; then delete the row.
- [ ] **RUN-04** `[L]` Each alert kind arrives at its threshold and stops for its cooldown: `app_error` 10 in 15 minutes, `upload_failed` 5, `ai_failed` 5, `auth_denied` 20, `deletion_failed` 1 in 60, `voice_failed` 5, `malware_detected` 1, `scan_failed` 1; the cooldown is 60 minutes.
- [ ] **RUN-05** `[L]` `ENGINEERING_ALERT_WEBHOOK_URL` posts to a channel somebody watches; `OUTBOX_DEAD`, `DELETION_FAILED`, `MALWARE_DETECTED` and `SCAN_FAILED` arrive; a second path exists (a log alert or drain), so a broken webhook does not silence everything.
- [ ] **RUN-06** An external uptime check watches `/` and `/start` (nothing in the repo does).
- [ ] **RUN-07** Weekly until launch: Supabase API logs filtered to 401 and 403, and Auth logs filtered to failed sign-ins (what `ops_events` cannot see).
- [ ] **RUN-08** Backups: daily backups on, **point-in-time recovery on** for production; files are not in database backups. Restore drill (quarterly, on staging only): restore to a new project, apply newer migrations, open one intake and one document as an advisor; record it in `docs/RUNBOOK.md`.
- [ ] **RUN-09** The escalation table in `docs/RUNBOOK.md` has a name, a route and a backup for every role (all rows are blank today).
- [ ] **RUN-10** Production access review recorded: roles, Supabase, Vercel, GitHub (branch protection and the three required checks), secrets, providers, alert channel.
- [ ] **RUN-11** An incident drill: pick one playbook (a leaked key, or a malware detection), run it end to end and time it.
- [ ] **RUN-12** Browser failure reports cannot be used to flood or fake alerts: more than 30 an hour per account, 200 for signed-out visitors together and 2,000 overall are dropped.

---

## 21. Deployment and configuration

- [ ] **CFG-01** A Vercel build with neither `VITE_SUPABASE_URL` nor `NEXT_PUBLIC_SUPABASE_URL` **fails** with a message naming them; a non-Vercel build with them missing gives a blank page ("supabaseUrl is required."). `.env.example` has only publishable values; **verify** `VITE_SUPABASE_PROJECT_ID` is read by nothing in `src`.
- [ ] **CFG-02** `[L]` `npm run setup:supabase -- --project-ref <ref>` applies the migrations, sets the secrets, deploys the functions, configures auth, schedules the jobs and then checks the result; run it twice (it must be repeatable).
- [ ] **CFG-03** `[L]` Function secrets all set and valid (`supabase/env.production.example`): `AI_PROVIDER` and its key, `AI_MODEL`, `IP_HASH_SECRET`, `AI_IP_*`, `AI_GLOBAL_DAILY_CALLS`, `APP_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADVISORY_NOTIFY_EMAIL`, `SUPPORT_EMAIL`, `PROSPECT_RESPONSE_TIME`, `RESEND_WEBHOOK_SECRET`, `MALWARE_SCANNER` and its settings, `ENGINEERING_ALERT_WEBHOOK_URL`.
- [ ] **CFG-04** `[L]` Every deployed function is the current build and bundles `supabase/functions/_shared`; `resend-webhook` has its gateway JWT check off and nothing else does (`supabase/config.toml`).
- [ ] **CFG-05** `[L]` Deploy order is respected: migrations, then functions, then the front end; the notes in each "What landed" row of the plan that say "deploy before the front end" are honored.
- [ ] **CFG-06** `[L]` Auth settings: "Confirm email" on; the site URL and redirect URLs include `https://nevermorepeo.com/auth/callback`; the one-time code is 6 digits (the app hard-codes 6); anonymous sign-ins on; the CAPTCHA provider and secret match `VITE_TURNSTILE_SITE_KEY`.
- [ ] **CFG-07** `[L]` Domain: the production domain serves HTTPS, HTTP redirects to it, a canonical URL is set, and the sender domain shows verified with the email provider and passes SPF, DKIM and DMARC; a test email from `EMAIL_FROM` reaches a real inbox.
- [ ] **CFG-08** The deployed bundle contains no secret: search the build for `service_role`, provider keys and `eyJ…` tokens other than the anon key (plan J-1.1).
- [ ] **CFG-09** Rollback rehearsed on staging: Vercel promote of the previous deployment; redeploying the previous function build; a migration that needs undoing has a documented path (plan J-3.2).
- [ ] **CFG-10** Dev, staging and production use separate Supabase projects and secrets (plan J-1.1).

---

## 22. Cross-cutting: accessibility, responsive, performance, privacy, copy

### Accessibility

- [ ] **A11Y-01** Keyboard only, start to finish: landing, consent, chat, every tab, upload, Review, PEO, Reckoning, Manuscript, and the advisor screens. Focus is always visible and never trapped; dialogs return focus.
- [ ] **A11Y-02** **Verify** known gaps: the workspace tab bar has no tablist or `aria-selected`; the Send button and chat inputs have no names; the voice orb is a clickable `div`; `AuthPage` labels have no `htmlFor`; inputs use a faint focus border; the phone menu button has no name.
- [ ] **A11Y-03** Screen reader (VoiceOver and NVDA): Lenore's replies are announced (they have no live region today), the save status is, errors use `role="alert"`, upload progress is announced, toasts are announced.
- [ ] **A11Y-04** Contrast with a tool: muted text on the background (about 4.1:1) used at 9–10 px, and the `/50` muted text on field rows (about 1.8:1) fail AA; fix or accept (plan I-2.3).
- [ ] **A11Y-05** Touch targets reach 44 px on the 10 px buttons in the field rows and the small icons in the transcript.
- [ ] **A11Y-06** 200% zoom and 400% reflow at 1280 wide; reduced-motion settings stop the orb and overlay animation.

### Responsive and browsers

- [ ] **RESP-01** Every page at 360, 768 and 1280: no horizontal scroll; Review's fixed two-column grid; the census table scrolls inside itself; the Reckoning and Manuscript grids collapse.
- [ ] **RESP-02** The browser matrix (section 1) for the whole smoke list, plus upload and PDF download on iOS Safari and Android Chrome.
- [ ] **RESP-03** The on-screen keyboard on a phone does not cover the chat bar or the Reckoning's inputs.

### Performance

- [ ] **PERF-01** First load on a throttled connection: the main bundle is 1.76 MB (504 kB gzipped) and the build warns about it; the advisor, Manuscript and legal pages are lazy. Record time to interactive and decide whether to split further.
- [ ] **PERF-02** A 5,000-row census: the Your Team tab, Dependents, the Manuscript page, the PDF and the advisor detail stay responsive (all rows render, none are paged).
- [ ] **PERF-03** The advisor queue with thousands of rows searches and pages within a second.

### Privacy and data

- [ ] **PRIV-01** No SSN, bank or card number is stored anywhere: in answers, the transcript, document extraction, logs or ops events. Check each with a deliberate test string.
- [ ] **PRIV-02** Logs and `ops_events` hold only codes, paths and ids, never answers, file names, messages, addresses or links.
- [ ] **PRIV-03** `localStorage` holds only the Supabase session and the unsaved-answer copy (without the census); nothing else with personal data.
- [ ] **PRIV-04** Unicode through every path (chat, edits, census, documents, the PDF, emails): accents, a non-Latin name, right-to-left text, an emoji; NUL and unpaired surrogates are stripped before saving.

### Copy and vocabulary

- [ ] **COPY-01** `[U]` No PEO named in public copy, no claim of affiliation, agency or partnership, no promise to act or submit for the prospect.
- [ ] **COPY-02** Read the product against `GLOSSARY.md`. **Verify**: the landing page says "packet" and "same session" and the profile page says "PEO proposals", which the glossary or the product contradict; the profile page is not in `copy.guard.test.ts`'s file list.
- [ ] **COPY-03** Every error and empty state reads as plain words, names what to do, and never shows a raw database or provider message (an advisor load error does show the raw text; the advisor detail with a bad id may show SQL).

---

## 23. Legal and launch sign-off

Complete `docs/LEGAL_REVIEW.md`; until then every draft label must stay.

- [ ] **LEG-01** Counsel has reviewed and approved, with a row in the approval record: Privacy Policy, Terms, intake consent, certification consent, retention windows (D4), role disclosure.
- [ ] **LEG-02** Placeholders filled: privacy contact address, the named AI provider and malware scanner (with their data terms), the four Terms sections.
- [ ] **LEG-03** Approval made live per "Making approval live": the draft notices disappear (Privacy, Terms, intake consent, the Reckoning's label) and the Manuscript page and PDF stop marking newly signed packets; **verify** packets signed earlier stay marked.
- [ ] **LEG-04** The Manuscript's HIPAA statement, "Prepared by" line, "For PEO Partners" and "We don't sell your information" are each approved by counsel.
- [ ] **LEG-05** The malware scanner is chosen (D13) and `MALWARE_SCANNER` is not `none` in production; the AI provider is chosen (D11).
- [ ] **LEG-06** The email-only launch checklist in `docs/NOTIFICATIONS.md` is fully ticked.
- [ ] **LEG-07** A controlled test submission through production is recorded, and its test data is deleted afterwards.

---

## 24. Known gaps to triage

Found by reading the code on 2026-11-05. "Confirmed" means a second read of the lines named; "Reported" means a
code survey found it and it has not been independently re-read. Severity is a suggestion. Each row needs an issue
or a "works as intended" note.

### Confirmed

| # | Sev | Where | Finding |
|---|---|---|---|
| G-01 | Med | `components/chamber/VerifyEmailGate.tsx:48,81-103` | The wrong-code error says "or send a new one", but step 2 has no resend and no way to change the address, and there is no form so Enter does nothing. |
| G-02 | Med | `data/requiredItems.ts:107-124`, `data/followUp.ts:101-117`, `20261104100000_certification_conflicts.sql` | A required answer that is *incomplete* keeps the intake "not ready" (no badge, no announcement), yet neither the Reckoning nor the database blocks certification. The glossary and a code comment call these one rule. |
| G-03 | Med | `components/chamber/workspace/ReviewTab.tsx:158` | Review counts blocked and failed-scan files as uploaded; the Upload tab excludes them. |
| G-04 | Med | `pages/ManuscriptPage.tsx:670` | The Manuscript page footer prints `edgar-allan-advisory.lovable.app`; production is `nevermorepeo.com`. |
| G-05 | Med | `supabase/functions/chamber-extract/handler.ts:49` | Only `recent` is redacted server-side; `message` and `context` reach the AI provider as the browser sent them. |
| G-06 | Med | `lib/advisorApi.ts:103`, `20261028090000_email_delivery_events.sql:227,272` | The Outbox list returns at most 100 rows with no paging or warning; chip counts show the true totals. |
| G-07 | Low | `components/chamber/PEOMatchTab.tsx:61-79` | The 1099 and Multi-Entity chips sit inside the Virgin Medical condition and never show until it is answered. |
| G-08 | Low | `components/chamber/workspace/BenefitsTab.tsx:13-28` | "N of 7 fields captured", but at most 6 can be counted. |
| G-09 | Low | `data/manuscript.ts:166,577`, `pages/ManuscriptPage.tsx:600`, `lib/manuscriptPdf.ts:385` | The headcount check reads "— minimum not yet confirmed — not yet verified". |
| G-10 | Low | `supabase/functions/document-upload/handler.ts:275-278` | The catch-all returns 500 without undoing the row inserted earlier; a retry of the same file then hits the duplicate rule. (Which step can throw was not traced.) |
| G-11 | Low | `docs/PRODUCTION_READINESS_PLAN.md` | Says 685 tests in 48 files (now 2,424 in 115); story I-1.3 names `docs/QA_MATRIX.md`, which does not exist (the matrix is in section 1 and RESP-02 here). |
| G-12 | Low | `docs/PRODUCTION_READINESS_PLAN.md` §1.1 vs `PEOMatchTab` and the intake-handoff SQL test | The plan says choosing a different PEO withdraws a certification; the tab and the SQL test say it does not (PM-05). |

### Reported

**Entry, auth, profile, shell**

- G-13 `RequireAuth.tsx:15,21-27`: the guest request is made once per mount; a session lost while mounted leaves "Entering The Chamber..." forever.
- G-14 `TurnstileWidget.tsx:53-57`: no timeout and no expiry handler; a widget error sends the visitor to `/login` as sign-up.
- G-15 `ProfilePage.tsx:44,54-73`: a failed load is console-only, saving then nulls every stored field, and a missing row still toasts "Profile updated".
- G-16 `ProfilePage.tsx:60,120`: `employee_count` has no bounds (`parseInt` accepts negatives and truncates); the copy mentions "PEO proposals".
- G-17 `LegalPageLayout.tsx:9-11`: the tab title is set with no cleanup.
- G-18 `Navbar.tsx:55-92`: the phone menu lacks Profile and the button lacks a name and `aria-expanded`; dead branches for non-landing routes.
- G-19 `useIntakeConsent.ts:71`: a user change mid-agree skips `setAgreeing(false)`.
- G-20 `AuthPage.tsx:159,166`, `VerifyEmailGate.tsx:90,97`: the 6-digit code length is hard-coded.
- G-21 `AuthPage.tsx:95`, `VerifyEmailGate.tsx:48`: a rate-limited code check reads as a wrong code.
- G-22 `useAuth.tsx:88,123`: a guest who signs in or up on `/login` becomes a new user; the intake stays under the old one.
- G-23 `AuthPage.tsx:68-70,147`: an unconfirmed sign-in lands on a message implying an email was just sent.
- G-24 `index.html:15,20-21`: Google Fonts is not in the provider list; the share image is a third-party screenshot; no canonical or `og:url`.
- G-25 `ErrorBoundary.tsx:29`: claims "Your progress is saved" unconditionally; no legal links; never clears on navigation.
- G-26 `vercel.json:7`: every path returns 200 (soft 404); no security headers.

**Chamber**

- G-27 `DependentsTab.tsx:21`: promises dependents Lenore cannot write (decision D21).
- G-28 `PEOMatchTab.tsx:24-26,36,84-91`: Avg Salary counts a missing salary as 0; a listed PEO typed in another case selects no card.
- G-29 `documentCandidates.ts:123-124`, `provenance.ts:312-314`: a candidate for a cleared or not-applicable field offers Apply, is skipped, and still reads "Applied".
- G-30 `ProvenanceField.tsx:56-62`, `provenance.ts:312`: a field cleared by Edit can never be filled again by chat or a document.
- G-31 `useLenoreChat.ts:157,198`: the idle timer is not cleared by a new send; redaction can push a 2,000-character typed message over the limit.
- G-32 `ReckoningTab.tsx:388-479`: both Manuscript links go to one URL and the overlay has no close; tab state resets on a tab switch (`LiveWorkspace.tsx:140`).
- G-33 `TranscriptPanel.tsx:134`, `ChamberPage.tsx:278,395`: Enter during IME composition sends; the phone bar has no Send button; the top bar has no wrap and uses `h-screen`; the phone layout flashes the desktop one first.
- G-34 `CensusWorkspaceTab.tsx:65-110`: raw tier codes and no paging for 5,000 rows.
- G-35 `UploadTab.tsx:111` vs `documentStatus.ts`: "Max 20 MB" against a 10 MB / 50 page read limit.
- G-36 `useChamberSession.ts:373,765`: answers typed before the row exists have no backup and no leave prompt (documented).
- G-37 `VoiceOrb`: a normal end and a mid-call service error show nothing.

**Manuscript and advisor**

- G-38 `ManuscriptPage.tsx:243` vs `ManuscriptPanel.tsx:18-19`: the prospect's and the advisor's file names for one version differ.
- G-39 `data/manuscript.ts:119-122,407`: the file name uses UTC, the page the viewer's time zone.
- G-40 `ManuscriptPage.tsx:192`: the load depends on the user object, so an auth refresh may re-run it.
- G-41 `ManuscriptPage.tsx:218,332-334`: the anonymous Sign in link has no return location; an advisor's back link points at the prospect's Review.
- G-42 `lib/manuscriptPdf.ts:47-61,421`: non-Latin names print as `?`; the DRAFT watermark relies on an estimated block height.
- G-43 `ManuscriptPage.tsx:203`, `lib/verifiedFields.ts:17-20`: errors fetching the final version or the verified fields are swallowed.
- G-44 `StatusPanel.tsx:67-69` and the other mutation panels: an expired session only toasts; a refused stage change does not reload.
- G-45 `lib/advisorApi.ts:192-196,208-210`: a non-UUID submission id probably shows a raw SQL error.
- G-46 `FieldReviewPanel.tsx:186`: a stale-review refusal reloads under an open edit box.
- G-47 `pages/advisor/AdvisorSubmissionPage.tsx:179`: `certifiedOnce` may disagree with the database for legacy rows.
- G-48 `data/manuscript.ts:184-186`: three eligibility checks are hard-coded "unknown" forever.

**Backend**

- G-49 `20261104100000`: the certification gate trusts browser-written provenance (acknowledged).
- G-50 `document-extract/read.ts:334`: no inflate cap on `.xlsx` or `.xls`; `20261029090000`: the 25-file cap is not race-safe.
- G-51 `document-upload`: no server-side `upload_failed` event and no rate limit.
- G-52 `docs/SUPABASE_SETUP.md`, `scripts/supabase-setup-lib.mjs:354-359`: five or six jobs documented, seven created; `prune-ai-extraction-events` is not checked.
- G-53 `20261104122000:85`, `20261104132000:57`, `20261104110000:172`: `P0002` (a 500 over PostgREST) where newer code uses `PT404`.
- G-54 `document-extract/handler.ts:156,164,177`: no concurrency or status guard, an applied-marks reset, a stuck `processing` row, and 200-with-failure against the AI operations doc.
- G-55 `chamber-extract/handler.ts:203-208`: chat on an expired intake works and spends budget.
- G-56 `resend-webhook/index.ts:25`: the body cap is checked after the body is read.
- G-57 cron `net.http_post` calls pass no timeout while scan and purge runs last 40–45 seconds; a comment in `document-scan/handler.ts` and a migration disagree on the function's time limit.
- G-58 `20261104102000:28`: the one-open-draft trigger returns early for inserts that are not in progress, which the insert policy allows.

---

## 25. Run record

| Date | Environment and commit | Sections run | Passed | Failed (issue links) | Not run, and why | Tester |
|---|---|---|---|---|---|---|
| | | | | | | |

Sign-off for a release: the smoke list, sections 2 and 18 in full, every `[L]` check in the sections you touched,
and no open item above "Low" in section 24 without a written decision.
