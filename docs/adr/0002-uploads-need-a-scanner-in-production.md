# Uploads need a malware scanner in production, and production uses Scanii

Every uploaded document is scanned before anyone can open it (E-4.3). Until the 2026-11-05 live QA, an unset scanner held every upload in quarantine, unreadable, with nothing to release it, and the prospect saw "Checking for viruses" indefinitely: production was in that state (F7). We now refuse uploads instead of holding them, and production scans with **Scanii** (`MALWARE_SCANNER=scanii`), a hosted scanning API, chosen on 2026-11-05 (D13).

With no usable scanner, `document-upload` stores and records nothing, answers `scanner_missing`, logs `SCAN_CONFIG_MISSING` naming the setting, and the prospect is told uploads are paused. `document-scan` answers 503 on every five-minute run until a scanner is set, and records the `scan_failed` event (`config_missing`) that `ops-monitor` alerts on. That event comes from the schedule, not from each refused upload: a refusal comes before the intake or the file is checked, so recording one per refusal would let any signed-in guest write rows at will. `MALWARE_SCANNER=none` (no scanning, every file readable) is allowed only where `APP_ENV` names a non-production environment: `development`, `demo` or `staging`. An unset or unrecognised `APP_ENV` is production, so a project can't drop scanning by forgetting a setting.

## The rule

| `MALWARE_SCANNER` | `APP_ENV` | Uploads |
|---|---|---|
| `scanii` (production), `clamav` or `http`, settings complete | any | Scanned at upload. Clean files are readable as soon as the upload finishes; infected ones are quarantined, shown as "Blocked", and alerted (`MALWARE_DETECTED`) |
| `none` | `development`, `demo` or `staging` | Recorded `skipped` and readable unscanned |
| `none` | unset, `production` or anything else | Refused (`scanner_missing`), as if unset |
| unset, unknown, or settings incomplete | any | Refused (`scanner_missing`); `document-scan` answers 503, alerts, and leaves held files where they are |

How long a clean file takes to become readable: when the scanner answers at upload, it is readable the moment the upload returns (one scan, at most 60 seconds, `SCAN_TIMEOUT_MS`; Scanii answers in about a second). When the scanner can't answer then (unreachable, timed out, an error), the file waits in quarantine. `document-scan`, which runs every five minutes, first retries it 10 minutes after the upload, so within 15 minutes. If that also fails it backs off: 5 minutes, 15 minutes, 1 hour, 4 hours, then 12 hours. After six attempts it marks the file `failed` and alerts (`SCAN_FAILED`). The browser checks again while a file is pending and reads it once its scan passes.

Files held before this change (or while no scanner was set) are not stuck. `document-scan` claims nothing while there is no scanner, so no attempt is spent. Its first run after a scanner is set, within five minutes, scans every held file and releases the clean ones. A file already marked `failed` is requeued with `public.requeue_document_scan` (`docs/RUNBOOK.md`, "Scan failed").

## How Scanii is called

`supabase/functions/_shared/malwareScan.ts` posts the file as multipart form data (field `file`, never the prospect's file name) to `/v2.2/files` on `SCANII_API_URL`, by default `https://api-us1.scanii.com` (Virginia), with HTTP Basic auth: `SCANII_API_KEY` as the user, `SCANII_API_SECRET` as the password. Scanii answers 201 with a `findings` list. A `content.malicious.<name>` finding is malware, kept as the signature; any other finding (an unsafe image or language, from Scanii's other engines) is not what uploads are scanned for, so the file is clean. Anything but a 201 with a findings list counts as the scanner being unavailable, so the file waits and `document-scan` retries it. This follows Scanii's OpenAPI spec, v2.2 (`github.com/scanii/openapi`, `src/v22.yaml`).

## Considered Options

- **Keep holding uploads while no scanner is set.** Rejected: a prospect's file goes into a queue nothing drains, and the prospect is told it's being checked when it isn't. The only signal was an hourly `scan_failed` alert, and without `ENGINEERING_ALERT_WEBHOOK_URL` nobody received even that.
- **Fall back to `none` when unset.** Rejected: census and payroll files from prospects would become readable unscanned because a setting was missed.
- **Refuse to start the functions.** Not possible: an edge function has no start-up step to fail. It reads its secrets on each request, so the refusal happens per request, and the scheduled `document-scan` makes the misconfiguration visible every five minutes (503, a log line naming the setting, an alertable event) whether or not anyone uploads.
- **Self-hosted clamav** (still supported, `MALWARE_SCANNER=clamav`). Not chosen: free and the files stay on infrastructure we run, but someone has to host clamd behind a TLS proxy the edge functions can reach, keep its signatures current and raise `StreamMaxLength` above 20 MB.
- **Another hosted API.** Compared on 2026-11-05: Verisys (US region, deletes after the scan, synchronous to 100 MB; no SOC 2 or BAA found), Cloudmersive (cheapest, stores nothing; its terms allow processing in any country, no SOC 2 or BAA found, free tier capped at 3.5 MB), AttachmentScanner (synchronous only up to 30 seconds, dated data terms) and attachmentAV (synchronous only to 10 MB). Excluded outright: VirusTotal and MetaDefender's free tier, which share uploaded files with third parties.

**Why Scanii:** files are processed in a US region and never leave it, their contents are deleted when the scan ends, it offers a DPA and a BAA as an add-on, and it scans synchronously up to 200 MB, well above our 20 MB cap. **The trade-off:** its SOC 2 audit is still in preparation, and a vendor sees every census and payroll file, so it needs data-processing terms reviewed like the AI provider's (`docs/LEGAL_REVIEW.md`). Scanii keeps result records (ids, findings, timings, never contents) for up to 400 days unless deleted.

## Consequences

- Production takes no uploads until `MALWARE_SCANNER=scanii` and Scanii's key and secret are set. The census, which comes only from an upload (D21), can't be given until then, and Lenore's pointers to the Upload tab lead to the "uploads are paused" message. To show the product without a scanner, set `APP_ENV=demo` on a separate demo project, not on production.
- A new secret, `APP_ENV`, names the environment. Production leaves it unset.
- `scripts/supabase-setup.mjs` applies the rule before it changes anything: `MALWARE_SCANNER=none` without a non-production `APP_ENV`, an `APP_ENV` it doesn't know, or `scanii` without its key and secret stops it. An unset `MALWARE_SCANNER` is a warning, not a stop, so the rest of the setup isn't held up while the scanner's account is opened. `scripts/scannerSettings.test.ts` keeps the script's scanner names and environments the same as the functions'.
