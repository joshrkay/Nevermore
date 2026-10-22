---
name: verify
description: Verify the submission-notification pipeline (advisor alert + prospect confirmation) by running it for real. Use when asked to verify or QA changes to supabase/functions/dispatch-outbox, the submission_outbox or outbox_reliability migrations, or useChamberSession's submit path.
---

# Verifying submission notifications

There is no Docker or hosted Supabase in the sandbox, so `harness/` stands up the closest real thing:

| Layer | Real or stand-in |
|---|---|
| Postgres 16, the real migrations (certification, guest block, outbox, outbox reliability) | **real** (Supabase's `auth` schema and roles are stubbed in `setup.sql`) |
| PostgREST 12.2.3 (so `authenticated` / `anon` / `service_role` table privileges are enforced; function ACLs are not, see Gotchas) | **real** |
| `supabase/functions/dispatch-outbox/index.ts` under Deno | **real, unmodified** |
| Gateway on :54321: GoTrue `GET /auth/v1/user`, `/rest/v1/*` pass-through, `/functions/v1/dispatch-outbox` | stand-in (`front.mjs`) |
| Resend on :54400 (records requests; mimics the documented `Idempotency-Key` rule; answers a rate limit before it looks the key up) | stand-in (`resend.mjs`) |

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
source .claude/skills/verify/harness/lib.sh          # PROSPECT/GUEST/SVC/ANON tokens, sql, invoke, newsession, certify, mode, stats, due, provider
SID=$(newsession $PROSPECT $U_A '{"company_name":"Acme Co"}')
certify $PROSPECT $SID '{"company_name":"Acme Co"}' 2026-05-01T12:00:00Z EAA-2026-TEST0001   # PATCH, as the browser's update does: expect 204
sql "select kind,status,payload from outbox_events where session_id='$SID'"                  # 2 pending rows
invoke POST $PROSPECT                                # the browser's nudge: sends and retries only
invoke POST $SVC                                     # the scheduled run: also reaps lost claims and queues what the trigger missed
provider 2                                           # the emails as the provider received them (the raw log is $RUN/resend.jsonl)
.claude/skills/verify/harness/down.sh
```

The function's log lines are in `$RUN/func.log`. To read just one run's: `L=$(wc -l < $RUN/func.log)` before it, then
`tail -n +$((L+1)) $RUN/func.log` after.

Failure modes: `mode 503|429|403|slow|accept_then_hang` switches the fake provider (`accept_then_hang` delivers, then never answers, so
the function times out after 10 s; the fake remembers its key). To step through backoff without waiting, run `due`. Config problems:
`func.sh SUPPORT_EMAIL= PROSPECT_RESPONSE_TIME=` restarts the function with those settings unset; `func.sh 'EMAIL_FROM=Name <x@mail.other.example>'`
changes one.

## Flows worth driving

`invoke POST $SVC` is the scheduled run, `invoke POST $PROSPECT` the browser's nudge. The response of the first carries `reaped` and `reconciled`; the
second's does not. `stats` shows `deliveries` (what the provider actually sent) against `requests`. Comparing the two is the only check that housekeeping
is limited to service-role callers and runs ahead of the claim: `index.ts` is Deno-only, so no unit test sees it.

- Certify, nudge: exactly one advisor alert and one confirmation, no census/payroll values in either.
- Re-send the same certify `PATCH` several times (separate requests): certifications grow, queue and emails do not. Edit then re-certify: one new "Updated intake".
- Refused callers (no token, anon key, guest, wrong method) leave a due queue untouched; guest certify is refused by the database.
- Provider 503: logged, `retry_in=60s`, held by backoff; five failures: `OUTBOX_DEAD`. `select public.requeue_outbox_event('<id>')` (from `sql`) retries the
  same frozen email (`msg=frozen`); with `, true` it is rebuilt from the current settings (`msg=fresh`: change `EMAIL_FROM` first and the provider's `from` follows).
  A second call returns `f`, the event is no longer dead.
- Frozen send across a sender change: `mode accept_then_hang`, certify, `invoke POST $SVC` (about 20 s, both sends time out; `pending_send` is set), change
  `EMAIL_FROM` with `func.sh`, `mode ok`, `due`, `invoke POST $SVC`. Expect `OUTBOX_SENT ... msg=frozen`; `provider` shows `replay=true` with the ORIGINAL sender and the
  same key; `stats` deliveries went up by 2, not 4.
- Definitive failure, then a fixed sender: `mode 403`, certify, run: `reason=auth:403 msg=fresh` and `pending_send` is null. Fix `EMAIL_FROM`, `mode ok`, `due`, run:
  `msg=fresh`, the new sender and a new key.
- Timeout, then 429, then success: `mode accept_then_hang`, certify, run (timeout); `mode 429`, `due`, run: `rate_limited:429 msg=frozen`, `pending_send` still set with the same
  key; `mode ok`, `due`, run: `msg=frozen`, `replay=true`, one delivery per event.
- Queueing fault: `sql "alter table outbox_events add constraint fault check (kind <> 'advisor_notification') not valid"`, then certify. It still answers 204;
  `outbox_queued_at` is null, `outbox_failures` 1, `outbox_last_sqlstate` 23514, no events. A scheduled run logs `OUTBOX_ENQUEUE_FAILED: unqueued=1 ... last_sqlstate=23514`
  (a failure backs off 2 minutes: backdate it with `update chamber_certifications set outbox_last_failed_at = now() - interval '1 hour' where outbox_queued_at is null`
  to see `reconciled.failed` 1). Drop the constraint and backdate again: a nudge as `$PROSPECT` heals nothing; a scheduled run logs `OUTBOX_RECONCILED`, sends both emails in the same
  run, sets `outbox_queued_at`, and the alert is not flagged as an update.
- Deleted events stay deleted: after a send, `delete from outbox_events where session_id='$SID'`, then a scheduled run: `reconciled.healed` 0, no rows return, no new delivery.
- Reaping: after certify, `update outbox_events set status='sending', attempts=5, locked_until=now() - interval '1 second' where session_id='$SID'`, and give one a frozen send with
  `update outbox_events set pending_send = jsonb_build_object('key','x') where session_id='$SID' and kind='advisor_notification'`. A nudge leaves both `sending`; a scheduled run answers `reaped:2` and logs
  `OUTBOX_DEAD ... reason=worker_lost_maybe_sent` for the frozen one and `reason=worker_lost` for the other.
- Emoji at the length cap: certify with a company name of 198 `a`, one emoji and a `b` (`NAME=$(node -e 'process.stdout.write("a".repeat(198)+"\u{1F600}"+"b")')`). Both emails send
  and the subject holds the whole emoji; cutting it by UTF-16 units left half a surrogate pair, which the database refuses to store.
- Deploy order, by hand: load `setup.sql` minus the last `\i` into a second database, point PostgREST at it (`db-uri` in `$RUN/pgrst.conf`, restart), and run the function. Nothing is sent
  (`freeze_failed`, `OUTBOX_RECORD_FAILED`, `PGRST202` from reap and reconcile); apply the migration, `notify pgrst, 'reload schema'`, and the queue drains. The previous function against the
  new schema still sends, but cannot record a failure.
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
- `sql` prints a header and a footer; take line 2 (`sed -n 2p`) when you need one value, such as an id.
- A fault constraint must be `not valid`, or adding it fails on rows already in the queue.
- After changing the schema by hand, `notify pgrst, 'reload schema'` or PostgREST keeps answering from its old cache.
- `setup.sql` sets default privileges for tables only. Supabase also grants EXECUTE on new functions to `anon` and `authenticated`, and the harness does not,
  so `anon` and a prospect hold no explicit EXECUTE here, and a migration that forgot to `REVOKE` it from them would still look closed. The function ACLs
  (helper, reconcile, reap, freeze, fail, requeue) are covered only by `supabase/tests/submission_outbox.sql`, which models those defaults.
