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

CI runs the same three on every pull request. Make the `verify` check required on `main` (repo Settings → Branches).

## Advisors

Advisor tools are at `/advisor`. Roles, access rules and how to grant access: `docs/ADVISOR_ACCESS.md`.

## Notifications

Submitting an intake queues an advisor alert and a prospect confirmation email. Setup, scheduling,
failure handling and the pre-launch checklist: `docs/NOTIFICATIONS.md`.

## Plan

Backlog and decisions: `docs/PRODUCTION_READINESS_PLAN.md`.
