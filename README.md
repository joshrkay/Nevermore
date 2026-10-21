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
npm run lint && npm test && npm run build
```

The SQL tests (access control, certification, abuse limits) need a scratch Postgres you can create
databases on. Each file runs in its own throwaway database:

```sh
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh
```

CI (`.github/workflows/ci.yml`) runs both on every pull request and on pushes to `main`, as two
checks: `verify` (lint, test, build) and `sql-tests`. Make both required on `main` (repo Settings →
Branches).

## Advisors

Advisor tools are at `/advisor`. Roles, access rules and how to grant access: `docs/ADVISOR_ACCESS.md`.

## Plan

Backlog and decisions: `docs/PRODUCTION_READINESS_PLAN.md`.
