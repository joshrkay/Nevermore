# AI calls: errors, limits, events and logs

How `chamber-extract` (Lenore's chat) and `document-extract` (reading uploads) fail, what they tell the browser, what they record, and how to find a failed call later. Story US-2.4a; decision D20. Terms are those of `GLOSSARY.md`.

## What a call answers

Every answer carries the call's request id, in the body as `request_id` and in the `X-Request-Id` header (exposed to the browser through CORS). A failure also carries a code:

```json
{ "error": "Lenore is taking too long to answer. Please try again.", "code": "timeout", "request_id": "3f2a…" }
```

The codes are `AI_ERROR_CODES` in `supabase/functions/_shared/ai/errors.ts`. The database's copy (the `ai_error_codes` sync block in `20261103120200_ai_extraction_events.sql`) is held to it by `src/data/schemaSync.test.ts`.

| Code | HTTP | When | The prospect sees (`src/data/aiFailure.ts`) |
| --- | --- | --- | --- |
| `bad_request` | 400, or 413 for size | A missing or blank message, a message over 2,000 characters, a context that isn't an object or is over 20,000 characters, an intake or document id that isn't one, a body that isn't JSON | "Lenore couldn't respond" |
| `unauthorized` | 401 | No signed-in user (the publishable key alone isn't one) | — |
| `not_found` | 404 | The intake or document isn't the caller's, or doesn't exist. An advisor can read every intake but can't run Lenore on someone else's | "Lenore couldn't respond" |
| `rate_limited` | 429 | The caller's, their address's or the provider's rate limit | "You're writing faster than Lenore can keep up…" |
| `daily_cap` | 503 | The daily ceiling shared by everyone | "Lenore is resting for the day…" |
| `unavailable` | 503 | AI isn't set up, the budget can't be checked, or the provider account can't pay | "Lenore can't be reached right now…" |
| `provider_error` | 502 | The provider answered with an error, or couldn't be reached | "Lenore can't be reached right now…" |
| `timeout` | 504 | The provider took too long | "Lenore took too long to answer…" |
| `invalid_response` | 502 | The provider answered without the forced tool call, or with arguments that aren't an object | "Lenore couldn't respond" |
| `internal` | 500 | Anything else | "Lenore couldn't respond" |

In the chat the prospect's message is always kept, and "Try again" and "Continue manually" are always offered. A document read that is put off (`rate_limited`, `daily_cap`, `unavailable`) leaves the document `uploaded`, ready to read again. One that fails once the model was asked leaves it `failed`, answering HTTP 200 with `{ status: "failed", code }`. Either way the Upload tab says why next to "Read it" or "Try again", until the page is reloaded.

## Order of checks

Both functions check, in order:

1. **Who is calling.** No signed-in user gets a 401, and nothing is recorded.
2. **The request itself.** A malformed, oversized or forged request is refused here, before any quota is spent.
3. **Configuration.** `chamber-extract` checks the provider before the intake; `document-extract` checks it only when a document needs the model.
4. **Ownership.** The intake or document must be the caller's.
5. **The budget.** The caller's quota, then their address's, then the global ceiling.
6. **The model.**

`chamber-extract` takes `session_id`, the intake id, in its body. It is optional for now, so a tab running an older front end keeps working. When it is given, it must be the caller's own intake.

## Limits and timeouts

| Limit | Value | Where | Tested in |
| --- | --- | --- | --- |
| Per user | 15 a minute, 300 a rolling day (fixed) | `consume_ai_quota`, `_shared/ai/budget.ts` | `supabase/tests/ai_abuse_limits.sql`, `budget.test.ts` |
| Per address (hashed, never stored raw) | 20 a minute, 400 a rolling day (`AI_IP_PER_MINUTE`, `AI_IP_PER_DAY`) | `consume_ip_quota` | `ai_abuse_limits.sql`, `budget.test.ts` |
| Everyone | 2,000 a UTC day (`AI_GLOBAL_DAILY_CALLS`) | `consume_global_ai_budget` | `ai_abuse_limits.sql`, `allowance.test.ts` |
| Chat message / context | 2,000 / 20,000 characters | `chamber-extract/handler.ts` | `chamber-extract/handler.test.ts` |
| Provider timeout | 20 s a chat attempt, 30 s a document attempt | `_shared/ai/model.ts`, `document-extract/ask.ts` | `model.test.ts`, `handler.test.ts`, `ask.test.ts` |
| Retry | One, after 1 s, on 429, 5xx or a network error; none on a timeout, 402, other 4xx or a bad answer | `_shared/ai/model.ts` | `model.test.ts` |
| Browser wait for chat | 45 s, then "Try again" (longer than two 20 s attempts and the pause) | `CHAT_TIMEOUT_MS`, `src/hooks/useLenoreChat.ts` | `useLenoreChat.test.ts` |

Chat and document reads spend from the same budgets. A limit that can't be checked refuses the call: guest sessions are free to create, so failing open would leave spend unbounded. There is no per-intake limit; the per-user quota bounds an intake.

## Extraction events

`public.ai_extraction_events` has one row for every signed-in call to either function, whatever its outcome. It is written with the service role. An event that can't be written is logged as `AI_EVENT_NOT_RECORDED`, and the call goes on as it would have.

| Column | Holds |
| --- | --- |
| `request_id`, `created_at` | The id the call answered with, and when |
| `function_name` | `chamber-extract` or `document-extract` |
| `user_id`, `session_id`, `document_id` | Who called; the intake, once ownership is checked; the document |
| `outcome`, `error_code`, `http_status` | `ok` or `error`, the code above, and the HTTP status answered |
| `document_status` | What a document read left the document as |
| `fields`, `refused_paths` | Field names extracted or proposed; schema paths the intake schema refused (`states[1]`). Never values |
| `prompt_version`, `contract_version` | The function's `PROMPT_VERSION`, and the intake schema version answers were checked against |
| `provider`, `model`, `attempts`, `latency_ms` | How the model call went, when there was one |

**No prospect content.** `_shared/ai/events.ts` drops anything in `fields` or `refused_paths` that isn't a field name or a path. The table's checks refuse it too. No column holds a message, a quote, a value or a provider's response.

**Who reads them.** Advisors and admins (`is_advisor()`). Prospects and guests can't read or write them.

**Retention.** 90 days (`public.ai_event_retention()`). `public.prune_ai_extraction_events()` runs daily at 03:43 UTC under pg_cron when the project has it. Otherwise run it with the service role from any scheduler. An intake that is deleted takes its events with it.

### Finding a failed extraction

By intake, with the newest first:

```sql
select created_at, function_name, outcome, error_code, http_status, document_status, refused_paths, attempts, latency_ms, request_id
from public.ai_extraction_events
where session_id = '<intake id>'
order by created_at desc;
```

By the request id a prospect or a log line gives:

```sql
select * from public.ai_extraction_events where request_id = '<request id>';
```

What failed today, by code:

```sql
select function_name, error_code, count(*)
from public.ai_extraction_events
where outcome = 'error' and created_at > now() - interval '1 day'
group by 1, 2 order by 3 desc;
```

## Log lines

Every line has fixed fields, built from codes and ids, never from a message, a document or a provider's response.

| Line | When |
| --- | --- |
| `AI_CALL_FAILED request= session= provider= kind= status= attempts= latency_ms=` | The model call failed after its retry |
| `AI_NO_TOOL_CALL request= session= provider=` | The model answered without the tool call |
| `EXTRACTION_REFUSED request= session= paths=` | The intake schema refused extracted values, by path |
| `DOCUMENT_READ_FAILED request= session= document= error=<class>` | A file reader threw. The class only: its message can quote the file |
| `DOCUMENT_HASH_NOT_RECORDED request= document= code=` | The stored file's hash couldn't be saved |
| `AI_UNEXPECTED_ERROR request= error=<class>` | Anything else |
| `AI_EVENT_NOT_RECORDED request= reason=` | The event couldn't be written (a database code, or `no_service_role`) |
| `AI_CONFIG_MISSING: <secret name>` | A provider key, the service-role key or `IP_HASH_SECRET` is missing |
| `AI_GLOBAL_CEILING_HIT` | The daily ceiling was reached |
| `AI_BUDGET_CHECK_FAILED: <database error>` | A budget couldn't be checked; the call is refused |

## Prompt versions

Each function's `PROMPT_VERSION` (in its `schema.ts`) is recorded on every event. `supabase/functions/_shared/ai/promptVersion.test.ts` holds a fingerprint of each version's prompt and tool, so changing either fails CI until the version is raised and the new fingerprint recorded.

## Deploy order

1. The migration `20261103120200_ai_extraction_events.sql`.
2. Both functions, which write events and import `_shared`.
3. The front end, which sends `session_id` and reads the codes.

A function deployed before the migration answers as usual and logs `AI_EVENT_NOT_RECORDED` for each call. A front end older than the functions still works: it ignores the codes, and `session_id` is optional.
