---
name: verify
description: Verify the submission-notification pipeline (advisor alert + prospect confirmation) by running it for real. Use when asked to verify or QA changes to supabase/functions/dispatch-outbox, the submission_outbox migration, or useChamberSession's submit path.
---

# Verifying submission notifications

There is no Docker or hosted Supabase in the sandbox, so `harness/` stands up the closest real thing:

| Layer | Real or stand-in |
|---|---|
| Postgres 16, the real migrations (certification, guest block, outbox) | **real** (Supabase's `auth` schema and roles are stubbed in `setup.sql`) |
| PostgREST 12.2.3 (so `authenticated` / `anon` / `service_role` privileges are enforced) | **real** |
| `supabase/functions/dispatch-outbox/index.ts` under Deno | **real, unmodified** |
| Gateway on :54321: GoTrue `GET /auth/v1/user`, `/rest/v1/*` pass-through, `/functions/v1/dispatch-outbox` | stand-in (`front.mjs`) |
| Resend on :54400 (records requests; mimics the documented `Idempotency-Key` rule) | stand-in (`resend.mjs`) |

## One-time prerequisites

```bash
npm ci                                                          # repo deps (also gives esbuild and playwright-core)
npm i --prefix /tmp/verify-deno deno@2 --no-audit --no-fund    # deno.land and esm.sh are blocked, hence the import map in func.sh
mkdir -p /tmp/verify-pgrst && cd /tmp/verify-pgrst \
  && curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar xJ
```

## Run

```bash
.claude/skills/verify/harness/up.sh                  # prints: up: pgrst=200 gateway=404 func(GET)=405
source .claude/skills/verify/harness/lib.sh          # PROSPECT/GUEST/SVC/ANON tokens, sql, invoke, newsession, certify, mode, stats
SID=$(newsession $PROSPECT $U_A '{"company_name":"Acme Co"}')
certify $PROSPECT $SID '{"company_name":"Acme Co"}' 2026-05-01T12:00:00Z EAA-2026-TEST0001   # PATCH, as the browser's update does: expect 204
sql "select kind,status,payload from outbox_events where session_id='$SID'"                  # 2 pending rows
invoke POST $PROSPECT                                # the browser's nudge; the service key ($SVC) is the scheduled caller
cat $RUN/resend.jsonl | tail -2                      # the emails as the provider received them
.claude/skills/verify/harness/down.sh
```

Failure modes: `mode 503|429|403|slow|accept_then_hang` switches the fake provider. To step through backoff without waiting, move
`next_attempt_at` into the past (`update outbox_events set next_attempt_at = now() - interval '1 second' ...`). Config problems:
`func.sh SUPPORT_EMAIL= PROSPECT_RESPONSE_TIME=` restarts the function with those settings unset.

## Flows worth driving

- Certify, nudge: exactly one advisor alert and one confirmation, no census/payroll values in either.
- Re-send the same certify `PATCH` several times (separate requests): certifications grow, queue and emails do not. Edit then re-certify: one new "Updated intake".
- Refused callers (no token, anon key, guest, wrong method) leave a due queue untouched; guest certify is refused by the database.
- Provider 503: logged, `retry_in=60s`, held by backoff; five failures: `OUTBOX_DEAD`; requeue with the SQL in `docs/NOTIFICATIONS.md`.
- `accept_then_hang` then retry: provider shows a replay, not a second delivery.
- Parallel nudges over more than one batch (>10 events, `mode slow`): each event delivered once.
- Missing/invalid settings hold only the affected kind and spend no attempts.
- Hostile company name / `file_id` / profile text: escaped HTML, no CR/LF in subjects, nothing sent to an injected address.

## Browser leg

The app itself may not build (check `npm run build`; `ReckoningTab.tsx` was broken on main). The nudge can still be run for real:
bundle the app's real client and `src/lib/dispatchOutbox.ts` with esbuild (`--alias:@=src`, `--define:import.meta.env.VITE_SUPABASE_URL=...`
pointing at :54321 and the anon key from `lib.sh`), serve the bundle from another origin, drive it in Chromium
(`/opt/pw-browsers/chromium-*/chrome-linux/chrome`, `setSession` with `$PROSPECT`, then `window.dispatchOutbox()`). That exercises the CORS preflight a browser enforces.

## Gotchas

- `postgres` cannot read files in the scratchpad; feed SQL by stdin (`up.sh` does).
- `pkill -f <name>` matches your own shell's command line and kills it; use the pid files in `$RUN`.
- The service-role key is compared by exact equality, so tokens must be static (`jwt.mjs` uses a fixed `exp`); a freshly minted token is not the cron key.
- Truncating `$RUN/func.log` with `: >` while Deno holds it open leaves NUL padding; count lines before instead.
- The gateway stand-in must send CORS headers on `/auth/v1/*` or `setSession` fails in the browser.
