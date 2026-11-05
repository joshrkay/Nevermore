# Uploads need a malware scanner in production

Every uploaded document is scanned before anyone can open it (E-4.3). Which scanner is still open (D13), so the code takes either a clamd daemon (`MALWARE_SCANNER=clamav`) or an HTTPS scanning service (`http`). Until now, an unset scanner held every upload in quarantine, unreadable, with nothing to release it, and the prospect saw "Checking for viruses" indefinitely: the 2026-11-05 live QA found production in that state (F7). We now refuse uploads instead of holding them. With no usable scanner, `document-upload` stores and records nothing, answers `scanner_missing`, and the prospect is told uploads are paused. It also records a `scan_failed` event (`config_missing`), which `ops-monitor` alerts on. `document-scan` answers 503 on every run until a scanner is set. `MALWARE_SCANNER=none` (no scanning, every file readable) is allowed only where `APP_ENV` names a non-production environment: `development`, `demo` or `staging`. An unset or unrecognised `APP_ENV` is production, so a project can't drop scanning by forgetting a setting.

## The rule

| `MALWARE_SCANNER` | `APP_ENV` | Uploads |
|---|---|---|
| `clamav` or `http`, settings complete | any | Scanned at upload. Clean files are readable as soon as the upload finishes; infected ones are quarantined, shown as "Blocked", and alerted (`MALWARE_DETECTED`) |
| `none` | `development`, `demo` or `staging` | Recorded `skipped` and readable unscanned |
| `none` | unset, `production` or anything else | Refused (`scanner_missing`), as if unset |
| unset, unknown, or settings incomplete | any | Refused (`scanner_missing`); `document-scan` answers 503 and leaves held files where they are |

How long a clean file takes to become readable: when the scanner answers at upload, it is readable the moment the upload returns (one scan, at most 60 seconds, `SCAN_TIMEOUT_MS`). When the scanner can't answer then (unreachable, timed out, an error), the file waits in quarantine. `document-scan`, which runs every five minutes, first retries it 10 minutes after the upload, so within 15 minutes. If that also fails it backs off: 5 minutes, 15 minutes, 1 hour, 4 hours, then 12 hours. After six attempts it marks the file `failed` and alerts (`SCAN_FAILED`). The browser checks again while a file is pending and reads it once its scan passes.

Files held before this change (or while no scanner was set) are not stuck. `document-scan` claims nothing while there is no scanner, so no attempt is spent. Its first run after a scanner is set, within five minutes, scans every held file and releases the clean ones. A file already marked `failed` is requeued with `public.requeue_document_scan` (`docs/RUNBOOK.md`, "Scan failed").

## Considered Options

- **Keep holding uploads while no scanner is set.** Rejected: a prospect's file goes into a queue nothing drains, and the prospect is told it's being checked when it isn't. The only signal was an hourly `scan_failed` alert, and without `ENGINEERING_ALERT_WEBHOOK_URL` nobody received even that.
- **Fall back to `none` when unset.** Rejected: census and payroll files from prospects would become readable unscanned because a setting was missed.
- **Refuse to start the functions.** Not possible: an edge function has no start-up step to fail. It reads its secrets on each request, so the refusal happens per request, and the scheduled `document-scan` makes the misconfiguration visible every five minutes (503, a log line naming the setting, an alertable event) whether or not anyone uploads.

## Open decision (owner)

**Which scanner (D13).** Both kinds are built and tested; the choice is the owner's:

- **clamav**: a clamd daemon behind a TLS proxy (stunnel) that the edge functions can reach. Free and the files stay on infrastructure we run, but someone has to host it, keep signatures current and raise `StreamMaxLength` above 20 MB.
- **http**: a hosted scanning API, or a thin wrapper around one, that takes the file as `POST application/octet-stream` with a bearer token and answers `{"verdict":"clean"}` or `{"verdict":"infected","signature":"..."}`. Nothing to host, but the provider sees every file: it needs data-processing terms like the AI provider's (`docs/LEGAL_REVIEW.md`).

Until it is chosen, production takes no uploads. That is deliberate. To show the product without a scanner, set `APP_ENV=demo` on a separate demo project, not on production.

## Consequences

- A production project with no scanner takes no uploads. The census, which comes only from an upload (D21), can't be given until one is set, and Lenore's pointers to the Upload tab lead to the "uploads are paused" message.
- A new secret, `APP_ENV`, names the environment. Production leaves it unset.
- `scripts/supabase-setup.mjs` still warns rather than errors on an unset `MALWARE_SCANNER`, and accepts `none` without looking at `APP_ENV`. It should refuse both for a production project (see `docs/SUPABASE_SETUP.md`).
