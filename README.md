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

CI (`.github/workflows/ci.yml`) runs both on every pull request and on pushes to `main`, as two
checks: `verify` (lint, edge-function type check, test, build) and `sql-tests`. Make both required
on `main` (repo Settings → Branches).

## Supabase project

`npm run setup:supabase -- --project-ref <ref>` applies the migrations, sets function secrets,
deploys the edge functions, configures auth and schedules email delivery on a Supabase project, then
checks the result. What it needs and what to do after: `docs/SUPABASE_SETUP.md`.

## Advisors

Advisor tools are at `/advisor`. Roles, access rules and how to grant access: `docs/ADVISOR_ACCESS.md`.

## Notifications

Submitting an intake queues an advisor alert and a prospect confirmation email. Setup, scheduling,
failure handling and the pre-launch checklist: `docs/NOTIFICATIONS.md`.

## Plan

Backlog and decisions: `docs/PRODUCTION_READINESS_PLAN.md`.
