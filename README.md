# Edgar Allan Advisory

PEO underwriting intake: a prospect talks to Lenore (AI intake assistant) in The Chamber, reviews and certifies the data, and downloads a PEO-neutral packet (The Manuscript).

## Setup

```sh
cp .env.example .env   # fill in the publishable Supabase values
npm ci
npm run dev
```

Only publishable values go in `.env`; it is git-ignored. Secrets (AI provider key, service-role key) live in Supabase function secrets, never in `VITE_*` variables.

## Checks

```sh
npm run lint && npm run typecheck:functions && npm test && npm run build
```

`typecheck:functions` type-checks the Deno edge functions with `tsc` (`tsconfig.functions.json`). Their
URL imports can't be fetched by `tsc`, so `types/functions-shims.d.ts` declares them; add a
declaration there when a function starts using more of a remote package than it already does.

The SQL tests (access control, certification, abuse limits) need a scratch Postgres you can create
databases on. Each file runs in its own throwaway database:

```sh
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh
```

CI (`.github/workflows/ci.yml`) runs both, and the end-to-end test below, on every pull request and
on pushes to `main`, as three checks: `verify` (lint, edge-function type check, test, build),
`sql-tests` and `e2e`. Make all three required on `main` (repo Settings → Branches).

## End-to-end test

One Playwright test (`e2e/intake-to-pdf.spec.ts`) walks the prospect's path in a browser: a guest
tells Lenore about the company in text, reviews the answers, picks a PEO, verifies an email with a
6-digit code, certifies and signs, submits, then opens the Manuscript and downloads the PDF. It
asserts the File ID, the PDF's file name and what the database recorded.

It needs no Supabase project. A real Postgres runs every migration in `supabase/migrations`, so row
security, grants and triggers are the real ones, and the real `chamber-extract` handler answers
Lenore. The stand-ins live in `e2e/stack/`: a gateway (`gateway.mjs`) that serves subsets of
Supabase Auth (GoTrue) and the REST API (PostgREST), a scripted AI provider in place of the model,
and a `dispatch-outbox` that accepts the call and sends no email. There is no Storage, so the path
uploads no documents. The email code is read from a test-only gateway endpoint.

It needs a Postgres you can create databases on: by default the superuser `postgres` with password
`postgres` on `localhost:5432`, as for the SQL tests. `PGHOST`, `PGPORT` and `PGPASSWORD` point it
elsewhere (the role must still be `postgres`). Every run **drops and recreates** the database
`eaa_e2e`; `E2E_DATABASE` renames it (the name must contain `e2e`). It also creates Supabase's roles
(`anon`, `authenticated`, `service_role`) in that server, so don't aim it at one that holds anything
you care about.

```sh
npx playwright install chromium   # once
npm run test:e2e
```

Playwright starts the gateway on port 54399 and a production build of the app (`vite build`, then
`vite preview`) on 4180; `E2E_GATEWAY_PORT` and `E2E_APP_PORT` change them. Locally it reuses a
server already running on either port, so stop a stale one. A machine whose Chromium is not the
build Playwright expects points `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at its own.

Everything generated goes to `e2e/.output/` (git-ignored): the app build, traces and screenshots of
failures in `test-results/`, and the HTML report in `report/`. Open it with
`npx playwright show-report e2e/.output/report`. When the CI job fails it uploads the report and
traces as an artifact.

A Lovable sync may restore its own generated `playwright.config.ts`. If `npm run test:e2e` stops
starting the stack, restore the config from git.

## Advisors

Advisor tools are at `/advisor`. Roles, access rules and how to grant access: `docs/ADVISOR_ACCESS.md`.

## Notifications

Submitting an intake queues an advisor alert and a prospect confirmation email. Setup, scheduling,
failure handling and the pre-launch checklist: `docs/NOTIFICATIONS.md`.

## Plan

Backlog and decisions: `docs/PRODUCTION_READINESS_PLAN.md`.
