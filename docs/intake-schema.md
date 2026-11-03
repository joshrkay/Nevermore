# Intake schema

The intake lives in `chamber_sessions`. The first section covers the answers themselves (`chamber_data`), then their provenance (`field_provenance`), then the session's lifecycle (`status`, expiry, archiving, revocation and the browser's backup of unsaved answers).

## Intake data (`chamber_data`)

`chamber_sessions.chamber_data` is a jsonb object with the 38 keys of `ChamberData` (`src/data/chamberTypes.ts`), and the database also accepts `employees`, the roster's name before the census (migration `20261029092000` added `census`). The browser sanitises it (`src/data/chamberValidation.ts`) and the database refuses anything outside the same rules (`public.chamber_data_error`, migration `20261027090000_intake_validation_and_versioning.sql`). The client is the stricter side: it drops or truncates, so valid client output is never refused.

### Rules by kind

| Kind | Rule | Client on bad input |
| --- | --- | --- |
| text | `null` or a string of at most 1,000 characters (`TEXT_MAX`) | Trimmed; blank or longer is dropped |
| count | `null` or a whole JSON number, 0 to 1,000,000 (`COUNT_MAX`) | Numeric strings are coerced ("1,200"); anything else is dropped |
| boolean | `null`, `true` or `false` | Anything else is dropped |
| state | `null` or one of the 56 codes in "State codes" | Upper-cased after trimming; an unlisted value is dropped |
| state list | Array of listed codes, at most 60 (`MAX_STATES`) | Comma strings accepted; unlisted entries and duplicates dropped |
| text list | Array of text, at most 100 (`MAX_LIST_ITEMS`) | Invalid entries dropped, then truncated to 100 |
| census | Array of census rows, at most 5,000 (`MAX_EMPLOYEES`) | Invalid rows dropped, then truncated to 5,000; a roster under the old key `employees` is read as `census` |
| employee list (old) | `employees`: array of employee objects, the roster before the census. Still accepted by the database, never written by the client | Read as `census` |

A census row needs a non-blank `first_name`; every other key may be absent. Unknown keys inside census, employee and dependent objects are tolerated by the database (the client strips them); an unknown top-level key is refused. The rows of `employees` are checked as they were; the table below is the census row.

| Census row key | Rule | Client on bad input |
| --- | --- | --- |
| `id` | Text, 1 to 64 characters, not blank | Kept when valid and unused; otherwise derived from the row |
| `first_name` | Text, 1 to 1,000 characters, not blank | The row is dropped |
| `last_name` | Text, at most 200 characters, `""` allowed | Cut to 200 characters |
| `dob` | Text, at most 40 characters. The client keeps only a real `YYYY-MM-DD` date | Omitted |
| `age` | Whole number 14 to 100 | Omitted |
| `work_state` | `""` or a listed code | A code or a state's name is read; anything else is `""` (the row is kept) |
| `zip_code` | `12345` or `12345-6789` | Omitted |
| `job_title` | Text, at most 200 characters | Cut to 200 characters |
| `annual_salary` | Whole number 0 to 1,000,000 (`SALARY_MAX`) | Omitted (pay above the limit is left blank, not capped) |
| `compensation_type` | `salary` or `hourly` | `salary` |
| `employment_type` | `full_time` or `part_time` | `full_time` |
| `classification` | `w2` or `1099` | Common spellings are mapped; a missing label is `w2`; an unrecognised one drops the row |
| `coverage_tier` | `EE`, `EE+SP`, `EE+CH`, `FAM` or `WAIVE` | Omitted |
| `class_code` | Four digits | Omitted |
| `dependents` | Array of dependents, at most 20 (`MAX_DEPENDENTS`) | Invalid ones dropped, then truncated to 20 |
| `dependents[].first_name` | Text, 1 to 1,000 characters, not blank | The dependent is dropped |
| `dependents[].last_name`, `.dob` | Text, at most 200 and 40 characters | `""` |
| `dependents[].relationship` | `spouse`, `domestic_partner`, `child` or `other` | `other` |

Postgres jsonb refuses NUL and unpaired surrogate characters before any trigger runs, so the client removes them from every string.

### Fields

Writers: **C** chat extraction (`chamber-extract`), **D** document candidates (`document-extract`; a census sheet also supplies `census`, `employee_count`, `states`, `has_1099` and `ca_contractors`), **V** voice `<extract>` JSON (accepts any key), **E** hand edit in the workspace.

| Key | Kind | Writers |
| --- | --- | --- |
| `company_name` | text | C D V E |
| `industry` | text | C D V E |
| `hq_state` | state | C D V E |
| `states` | state list | C D V E |
| `employee_count` | count | C D V E |
| `start_month` | text | C D V E |
| `multiple_entities` | boolean | V E |
| `fein_count` | count | V |
| `virgin_medical` | boolean | C D V |
| `current_carrier` | text | C D V E |
| `renewal_date` | text | C D V E |
| `rate_history` | text | D V E |
| `benefits_waiting_period` | text | D V E |
| `ancillary_benefits` | text list | D V E |
| `has_401k` | boolean | C D V E |
| `retirement_type` | text | D V |
| `employer_contributes` | boolean | D V |
| `payroll_vendor` | text | C D V E |
| `pay_frequency` | text (free text, not an enum) | C D V E |
| `funding_days` | count | V E |
| `has_nonexempt` | boolean | V |
| `nonexempt_count` | count | D V |
| `exempt_count` | count | D V |
| `pto_types` | text list | V E |
| `accrual_method` | text | V E |
| `has_handbook` | boolean | C D V |
| `handbook_last_updated` | text | V |
| `hr_staff_count` | count | V |
| `has_1099` | boolean | C D V |
| `ca_contractors` | boolean | C D V |
| `uses_physical_clocks` | boolean | V |
| `uses_mobile_app` | boolean | V |
| `uses_computer_timekeeping` | boolean | V |
| `shift_differentials` | boolean | V |
| `hris_system` | text | V |
| `key_challenges` | text | C V |
| `business_goals` | text | C V |
| `census` | census (read-only in the workspace) | D V |

Dates (`start_month`, `renewal_date`, `handbook_last_updated`, `dob`) are free text. `transcript`, `field_provenance` and `documents.extraction` are not validated beyond the existing is-object checks.

### State codes

The 56 codes in exact upper case: the 50 states, `DC`, and `AS GU MP PR VI`. Military mail codes (`AA AE AP`), other territories and Canadian provinces are refused. The list is `public.is_us_state_code` in SQL and `US_STATE_CODES` in `src/data/chamberValidation.ts`; `document-extract/parse.ts` keeps a third copy because the function can't import from `src/`. Dropping the territories is a product decision, not a technical one: it would refuse Puerto Rico employers.

### Caps

| Limit | Value | Constant |
| --- | --- | --- |
| People in the census | 5,000 | `MAX_EMPLOYEES` |
| Dependents per person | 20 | `MAX_DEPENDENTS` |
| `states` | 60 | `MAX_STATES` |
| `ancillary_benefits`, `pto_types` | 100 | `MAX_LIST_ITEMS` |
| Counts | 1,000,000 | `COUNT_MAX` |
| Salary | 1,000,000 | `SALARY_MAX` |
| Text | 1,000 characters | `TEXT_MAX` |

The database refuses a list over its cap. The client truncates (keeping the first entries) so it never sends one. `document-extract` keeps the first 5,000 people of a larger roster, and says so in the roster candidate's location ("CSV, rows 2–7501; first 5,000 of 7,500 people kept"); the `employee_count` and `states` candidates still cover every row.

### When the database checks

| Write | Checked |
| --- | --- |
| Insert | Always |
| Update that changes `chamber_data` | Yes |
| Update that certifies the session (status becomes `submitted`, or `submission` changes while status is `submitted`) | Yes |
| Any other update | No, so a row that was invalid before this rule still saves its other columns |

Nothing is rewritten or backfilled, and there is no table CHECK constraint. `profiles.phone` is checked the same way when set to a new non-empty value: at most 50 characters, digits with spaces, parentheses, dots and dashes, an optional leading `+` and an optional extension (`x`, `ext`, `ext.`), 7 to 15 digits excluding the extension.

### Errors

A refused write changes nothing and raises SQLSTATE `EA001`. PostgREST answers an unknown SQLSTATE with HTTP 400 and passes the message, `details` and `hint` through.

| Part | Content | Example |
| --- | --- | --- |
| Message | `Invalid intake data at <path>: <reason>` | `Invalid intake data at census[1].work_state: must be blank or a US state or territory code such as CA` |
| DETAIL | `<path>` | `census[1].work_state` |
| HINT | `<reason>` | `must be blank or a US state or territory code such as CA` |

Paths are zero-based: `hq_state`, `states[2]`, `census[3].dob`, `census[0].dependents[1].relationship`. A value that is not an object is `chamber_data`. `23514` is not used because the certification trigger already raises it.

### Versions

`chamber_sessions.data_version` (integer, default 1) counts saves. The server sets it: 1 on insert, +1 on every update, ignoring any value a client sends. A client therefore:

1. Saves with `.eq("id", id).eq("data_version", lastSeen).select("id, data_version")` and never puts `data_version` in a body.
2. Treats zero returned rows as a possible conflict: reads the row back, and only when the server's version differs and its content isn't what was just sent does it report a conflict (offering "Load latest" or "Keep my changes", which resends at the server's version).
3. Treats `EA001` as not retryable: stops the automatic retry, keeps the edit pending and names the field from the path. Network, 5xx and auth errors are retried as before.
4. Adds the same `data_version` condition to the keepalive save on page unload, which can't read the response.

The migration must be deployed before the front end, which selects `data_version`.

`chamber_sessions.schema_version` (smallint, default 1, migration `20261103091000`) records which version of the intake schema the row's answers follow. Version 1 is the only one, so every row is version 1 and the database refuses any other value. A later version changes the check in its own migration, says how rows move, and changes `INTAKE_SCHEMA_VERSION` with it.

### JSON Schema v1 and strict checks on the way in

The canonical schema is `supabase/functions/_shared/intakeSchema.ts`: `chamber_data` as a JSON Schema (draft 2020-12), published as [`docs/intake-schema.v1.json`](intake-schema.v1.json). Regenerate the file with `npm run schema:intake`; `src/data/intakeSchema.test.ts` fails while the two differ.

It is the stricter statement of the same rules: every value it accepts, the database accepts. `src/data/schemaSync.test.ts` holds its state codes, caps, census value lists and field kinds to the migrations, and `src/data/chamberValidation.test.ts` checks that the sanitiser's output always passes it. It is stricter than the database in three ways:

- An unknown key is refused at every level, including inside a census row or a dependent. The database tolerates those, so an older client can save a newer census.
- `employees`, the roster's old name, is not part of v1. The database still accepts it.
- A census row must carry `id`, `first_name`, `last_name`, `work_state`, `compensation_type`, `employment_type` and `classification`, as every v1 writer gives it. The database requires only `first_name`.

The validator (`validateChamberData`, `validateIntakeField`) is strict. A value is accepted as sent or refused with a reason. Nothing is trimmed, upper-cased, split or converted. Issues name the path the way the database does (`states[1]`, `census[0].dependents[0].relationship`), never the value, and stop at 50. It implements only the keywords the schema uses (`type`, `enum`, `maxLength`, `pattern`, `minimum`, `maximum`, `maxItems`, `items`, `properties`, `required`, `additionalProperties: false`, local `$ref`), and refuses a schema with any other, so a rule can't be written into the schema and then go unenforced. Lengths count characters (code points), as Postgres does.

Where it runs:

| Data coming in | What happens to a value that breaks v1 |
| --- | --- |
| The model's extraction in `chamber-extract` | The field is refused and listed in the response's `rejected` (path and reason), along with its status, evidence and correction. The function logs `EXTRACTION_REFUSED request=… paths=…` (paths only). The browser never receives it. |
| The browser's backup of unsaved answers (see "Session lifecycle") | The whole copy is discarded, not offered for restore, and a warning names the paths. |
| A saved intake as the Chamber loads it | The mismatch is logged (paths and reasons). Rows saved by earlier versions stay editable: the sanitiser still loads what is valid. |

Voice extractions (`<extract>` tags) still go through the sanitiser, which repairs what it can (a lower-case state, a comma list, `"1,200"`).

### Adding a field

A new key in `ChamberData` needs a migration first: add it to `public.chamber_data_field_kind` with its kind, then to `EMPTY_CHAMBER_DATA`, `FIELD_SCHEMAS`, `FIELD_LABELS`, `FIELD_KINDS` and the JSON Schema's `properties` (then `npm run schema:intake`). `src/data/schemaSync.test.ts` compares the SQL key list, state codes and caps with the client constants and the schema, so a field added on one side only fails CI. The database refuses an unknown top-level key, so a front end shipped ahead of its migration would fail every save.

### Employee census (`chamber_data.census`)

The roster is an array of rows (`CensusEmployee`, defined in `supabase/functions/_shared/census.ts`, which `document-extract` and the app both import):

| Field | Notes |
| --- | --- |
| `id` | Generated. Kept when a row is saved and reloaded; derived from the row when a file is read, so reading the same file twice gives the same ids. |
| `first_name`, `last_name` | |
| `dob` | `YYYY-MM-DD`. Read from ISO dates, US `m/d/y` (two-digit years are the latest past year), month names and Excel serial numbers. |
| `age` | Whole years, 14 to 100. Used when a file gives an age and no date of birth. |
| `work_state` | Two-letter uppercase, from a code or a name; `""` until known. |
| `zip_code` | `12345` or `12345-6789`; a ZIP Excel stripped a zero from is padded. |
| `job_title`, `annual_salary` | Salary is whole dollars a year. An hourly rate becomes a year's pay at the stated weekly hours, or at 2,080 hours for a full-time worker. |
| `compensation_type` | `salary` or `hourly`. |
| `employment_type` | `full_time` or `part_time`; weekly hours of 30 or more are full time. |
| `classification` | `w2` or `1099`. A blank label means W-2; a label that is neither (a K-1 owner) drops the row rather than guess. |
| `coverage_tier` | `EE`, `EE+SP`, `EE+CH`, `FAM` or `WAIVE`. When absent, the Manuscript derives a tier from `dependents`. |
| `class_code` | Four-digit workers' comp code. |
| `dependents` | Named in conversation, never read from a document. |

Intakes, provenance entries, advisor reviews and signed snapshots saved before the census contract call the roster `employees` and use `state`, `title`, `salary` and `"W2"`. They are read as `census` and never rewritten, so a signed Manuscript still renders. A census row with no first name, or a `classification` that isn't W-2 or 1099, is dropped when read.

#### Never stored

Social Security numbers and bank account details are not stored anywhere. `redactSensitive` (`supabase/functions/_shared/sensitive.ts`) replaces a formatted SSN, a labelled account or routing number, and any run of nine or more digits with `[redacted]` in free-text fields of `chamber_data`, chat messages (before they are stored or sent to the model), evidence quotes and everything `document-extract` reads or returns. Spreadsheet columns headed like an SSN or bank detail (`SSN`, `Tax ID`, `Routing Number`, `Direct Deposit Account` and similar) are never read, and the prospect is told which columns were skipped. The uploaded file is kept as it was, so a prospect can be told to upload a copy without those columns.

## Field provenance

Each field in `chamber_sessions.chamber_data` (see `src/data/chamberTypes.ts`) has a status and a source. These are stored beside the data in `chamber_sessions.field_provenance` (jsonb, keyed by field name, default `{}`). Fields with no entry have not been captured yet, or were captured before provenance existed.

The model, merge rules and open items are in `src/data/provenance.ts`.

### Entry shape

```json
{
  "status": "inferred",
  "source": { "kind": "transcript", "message_id": "<chat message id>", "quote": "about 40 of us", "prompt_version": "2026-11-03.1" },
  "updated_at": "2026-10-21T09:00:00.000Z",
  "candidates": [{ "value": 40, "source": { "...": "..." } }],
  "also_heard": [{ "value": 45, "source": { "kind": "document", "document_id": "<document id>" } }]
}
```

`candidates` is present only while the field is `conflicting`. `also_heard` is present only when a source gave a value the field doesn't hold (see "Also heard" below).

#### Status

| Status | Meaning | Open item |
| --- | --- | --- |
| `confirmed` | The prospect stated it explicitly, or confirmed or entered it in the workspace. | — |
| `inferred` | Lenore derived or assumed it from what was said. | "Please confirm" |
| `incomplete` | Only part of the answer was given. | "Incomplete" |
| `conflicting` | Two sources of the same rank disagree. The first value is kept until the prospect picks one. | "Conflicting answers" |

#### Source

| `kind` | Fields | Produced by |
| --- | --- | --- |
| `transcript` | `message_id` (the `ChatMessage.id` in `transcript`), optional `quote` (≤ 200 chars), optional `prompt_version` (≤ 40 chars; see "Extraction contract version and eval" below) | Chat extraction (`chamber-extract`) and voice `<extract>` tags |
| `document` | `document_id`, optional `document_name`, `location` (e.g. sheet/row or page) | A value the prospect applied from an uploaded document (see "Document candidates" below) |
| `prospect_edit` | — | Confirm, Edit, Add, or "Use this" in the workspace |

### Merge rules (`applyExtraction`)

Every AI value reaches the intake through `applyExtraction`: a chat reply (`useLenoreChat` hands each one to the Chamber with the prospect's message it answers), a voice `<extract>` (one with no prospect message to cite is dropped, never merged untracked), and a document candidate the prospect applies.

1. Values are validated per field (`sanitizeChamberPatch`). Invalid and empty values are dropped.
2. Sources rank `prospect_edit` (3) above `document` (2) above `transcript` (1, chat and voice). A field whose source is `prospect_edit` is never changed by an extraction, and nothing is noted on it.
3. A field with no value takes the new one, with the model's status (default `inferred`; a document's value is `confirmed`).
4. The same value heard again can raise the status from `inferred` to `confirmed`, never lower it. The source becomes the new one unless it ranks lower, in which case the higher-ranked source stays. A list with the same entries in another order is the same value, and the stored order is kept.
5. A different value:
   - **From a higher-ranked source** replaces the value, with its own status and source, and the replaced value is noted in `also_heard`. A `conflicting` field is settled by it: every candidate is noted.
   - **From a lower-ranked source** is noted in `also_heard`; the value and status stay. A `conflicting` field stays conflicting.
   - **From a source of the same rank** (chat against chat, document against document) makes the field `conflicting`, with both values as candidates.
6. Two exceptions to rule 5:
   - **Corrections.** The model lists the field in `corrected_fields`, meaning the prospect explicitly corrected it in chat. The new value replaces anything but a `prospect_edit`, a document's value included, and settles a conflict. A replaced value from another kind of source is noted in `also_heard`; a replaced chat value is what they corrected and is not.
   - **Lists that only add entries** ("also Texas": every old entry and at least one new one) replace the old list, which is not noted. From a lower-ranked source (chat adding to a document's list), the field takes chat's source, with its quote, and the status `inferred`, so the prospect confirms the whole list; from the same or a higher rank it takes the new source and status. The field is then chat-sourced, so a later different value from a document outranks it. A competing value the new list doesn't include is noted.
7. The `census` is not ranked: an extracted roster replaces the old one (it is rebuilt as it grows), and a document's census is merged in the Upload tab (see "Document candidates" below).
8. Prospect actions (`applyFieldAction`) set the status to `confirmed` and the source to `prospect_edit`, and clear any candidates and `also_heard`. Confirming a conflicting field requires choosing a candidate first. The prospect choosing a document's value in the Upload tab's conflict dialog is the exception: it keeps `also_heard` and notes the value it replaced (see "Document candidates" below). An advisor verifying a field leaves `also_heard` as it is.

These rules run in the browser, and the database checks only that `field_provenance` is an object. That is by design: every AI value reaches the database through the prospect's own browser, which can already save any value as the prospect's own edit, so a database check of precedence would stop nothing.

#### Also heard

`also_heard` is a list of `{ value, source }`, the same shape as a candidate. It is a note, not a choice: it never changes the status or adds an open item. It holds at most 5 entries, newest last, one per value (a value heard again moves to the end, keeping the higher-ranked of the sources that gave it, or the latest if they rank the same), and never the field's current value. It is only stored for now; the workspace and the advisor view don't show it yet. Entries saved before it existed have none, and a malformed note is dropped without losing the rest of the entry.

### Extraction contract (`chamber-extract`)

The response is `{ extracted, field_status, evidence, corrected_fields, reply, rejected, prompt_version }`. `field_status` and `evidence` are keyed by field name and only cover fields in `extracted`. `field_status` is one of `confirmed`, `inferred` or `incomplete`; only a disagreement makes a field `conflicting`. A field enters `extracted` only if intake schema v1 accepts the model's value exactly as sent. A lower-case `"ny"`, a state list with one unknown code, `12.5` people or a string of digits is refused and listed in `rejected` as `{ path, reason }`. The browser ignores `rejected`.

### Extraction contract version and eval

`PROMPT_VERSION` in `supabase/functions/chamber-extract/schema.ts` (a date and a sequence number, such as `2026-11-03.1`) versions the whole extraction contract: `SYSTEM_PROMPT`, `EXTRACT_TOOL` and the response shape. Every successful response carries it as `prompt_version`, even when nothing was extracted, and the browser stores it on the transcript source of each value a chat message produced. Voice extractions (the ElevenLabs agent has its own prompt; `voiceExtraction` drops any version its `<extract>` names) and entries saved before versioning have none. A malformed stored version is dropped and the entry kept.

`chamber-extract/schema.test.ts` takes the sha256 of the canonical JSON of `SYSTEM_PROMPT`, `EXTRACT_TOOL` and the user turn (`buildUserPrompt` in `prompt.ts`, rendered for fixed inputs) and compares it with the hash recorded for `PROMPT_VERSION`. Editing any of them without a new version fails CI, and the failure gives the new hash to record. The response shape is not hashed: bump the version by hand when it changes.

The extraction eval (`scripts/extraction-eval`) sends 10 synthetic transcripts through the path a chat message takes in production: the browser's redaction and context, the handler's prompt, the shared provider adapter, `shapeExtraction`, then `applyExtraction` as the Chamber merges a reply. It scores each asserted field's final value (strings ignoring case and surrounding space, lists as sets) and, where the fixture names one, its status (where it names none, a field left `conflicting` fails); fields that must stay empty; and digits (an SSN) that must never be stored. It calls a real model, so it runs on demand and never in CI:

```sh
LOVABLE_API_KEY=… npm run eval:extraction                            # the default provider
AI_PROVIDER=anthropic ANTHROPIC_API_KEY=… npm run eval:extraction
npm run eval:extraction -- --only contradiction                      # one fixture
npm run eval:extraction -- --update-baseline                         # record baseline.json
```

`AI_MODEL` overrides the provider's default model, as it does for the function. The variables can also go in `.env.local`, which the runner (vite-node) reads. The run prints a fixture-by-field table and the overall accuracy, then compares it with `scripts/extraction-eval/baseline.json`: a cell that passed there and fails now is a regression, and a regression, a failed model call or a missing key exits 1. New cells, and baseline cells no longer asserted (a deleted or renamed fixture), are reported. With no baseline the run reports any failed model calls, says how to record one and exits 0.

Before merging any change to the prompt, the tool schema or the response shape: bump `PROMPT_VERSION` and record its hash, run the eval, review the regressions, then record a new baseline with `--update-baseline` and commit it with the change. No baseline is committed yet: the first needs a live provider key.

### Document candidates (`document-extract`)

Uploads live in `documents`, linked to their intake by `session_id`. RLS requires the caller to own both the row and the intake. The function reads one document as the calling user and writes the result to that row only: `status`, `category` (see below) and `extraction`.

- `category` is one of `employee_census`, `benefits_summary`, `payroll_report`, `workers_comp_loss_runs`, `peo_invoice`, `prior_proposal` or `other`. It is suggested from the file name and the prospect can change it. The first four are "still helpful to provide" when missing; none is ever required. A census found in a file filed as `other` is filed as `employee_census`.
- `file_sha256` is the SHA-256 of the file. The browser records it so a repeat can be refused before upload; `document-extract` records the hash of the stored bytes, which wins. An intake can't hold two files with the same hash (a unique index), or more than 25 documents (a trigger).
- Before storing a file the browser reads its leading bytes and refuses one that isn't what its name says (a PNG named `.pdf`) or is empty. Files are stored with the type their contents show. The `documents` bucket also refuses files over 20 MB and types outside PDF, Word, Excel and CSV; `document-extract` reads up to 10 MB and 50 pages and saves anything larger for the advisor.
- Stored files sit at `{user_id}/{session_id}/{file}` in the private `documents` bucket. Reading or deleting one requires owning that intake, the same as its row; advisors read through short-lived signed links.
- An interrupted read (`processing` when an intake opens) is shown as `failed` so the prospect can retry it.
- `status` is one of `uploaded`, `processing`, `extracted`, `no_data`, `unsupported`, `encrypted`, `unreadable`, `too_large` or `failed`.
- `extraction` is `{ message, notes, candidates: [{ field, value, location, facts? }], applied: { field: timestamp }, kept: { field: timestamp }, extracted_at }`. It defaults to `{}`. `notes` say how the file was read (a skipped column, rows left out). For a `census` candidate, `facts` lists the row facts the file had columns for.

CSV, XLSX and XLS sheets, and tables in a `.docx`, are searched for a census. Columns are matched to census fields by header (exact phrases, phrases with filler words removed such as "Employee DOB", key words, and small typos), and each row is read into a census row, so employee details never go to the model. The candidates proposed are the `census`, the W-2 `employee_count`, `states`, `has_1099` and `ca_contractors`. Totals lines, rows with no name and workers that aren't W-2 or 1099 are left out and counted in a note. Text PDFs, Word paragraphs and every table that isn't a census are read by the model for company-level fields only (never individual employees); where both give a field, the census wins. Old `.doc` files and scans are saved for the advisor and not read.

Candidates never change `chamber_data` by themselves. In the Upload tab the prospect sees each candidate next to what the intake holds (a census as rows, with a count of people missing an age, work state, title or salary) and can:

- **Apply** a value the intake doesn't have yet, or holds only from the conversation, which a document outranks (shown as "Replaces what you told Lenore: …"; `planCandidateMerge` calls it `replace`). It goes through `applyDocumentCandidates` in `src/data/documentCandidates.ts` and so `applyExtraction`, with status `confirmed` and a `document` source: a chat value gives way to the document's and is noted in `also_heard`. The merge rules also hold if a value has arrived meanwhile: a prospect's own value is never changed, and a different document's value makes the field `conflicting`. "Apply all new" applies only values the intake doesn't have; replacing an answer is one click per value.
- **Resolve** a value that differs from the prospect's own answer or another document's (or one with no provenance), in the conflict dialog. Nothing is pre-selected for a single value: they pick the intake's or the document's, and the one they keep is recorded as `confirmed`. Keeping the intake's value records it as their own (`prospect_edit`) and clears `also_heard`, as any confirm does. Choosing the document's value (`applyChosenValue` in `provenance.ts`) replaces the intake's, their own answer included, with the document as the source; as with a correction, a replaced value from another kind of source (their own answer, or chat) is noted in `also_heard` beside what was already noted, and one from another document is not. For a census the dialog lists who is in both, whose details differ, who is only in the file and who is only in the intake, and offers **Merge** (the default: people in both take the facts the file stated, new people are added, the rest stay, and everyone keeps their id and dependents), **Replace** with the file's census, or **Keep my census**. A choice is applied by `resolveCandidate`; a kept answer shows as "Kept yours".

### Submission

When the prospect signs, `submission.field_provenance` snapshots the provenance alongside `submission.chamber_data`. The Manuscript shows the status and source for each row, and adds the status-based open items to "Underwriting Readiness".

## Session lifecycle

Migration `20261103090000_intake_lifecycle.sql` (A-1.5). `supabase/tests/intake_lifecycle.sql` and `e2e/intake-lifecycle.spec.ts` cover it.

### Status

`chamber_sessions.status` is one of:

| Status | Meaning | The prospect |
| --- | --- | --- |
| `in_progress` | A draft, or a certified intake whose answers changed since | Reads and changes it |
| `submitted` | Certified | Reads it; changing an answer withdraws the certification (back to `in_progress`) |
| `expired` | A draft that was never certified and went untouched past the retention window | Reads it, so the Chamber can say it expired; can't change it or add documents |
| `archived` | A draft the prospect left with "Start over" | Can't read it, its documents or its stored files |
| `revoked` | A draft an admin closed | Can't read it, its documents or its stored files |

A check constraint holds the set. The browser can't set the last three. Row security turns a write to a closed intake into one that matches no row, and a trigger refuses one that gets past it with SQLSTATE `EA002` (DETAIL: the status). Advisors still read every intake.

### Activity and expiry

- `last_activity_at` is when the prospect last saved anything. Every write from the browser sets it to the current time. A client can't set it, and privileged roles (the jobs, the service role, an operator) may.
- `expires_at` is `last_activity_at` + `public.intake_draft_retention()` (30 days, decision D4) for an intake that is in progress and was never certified. It is null for anything ever certified. An expired intake keeps the time it was due.
- `public.expire_idle_intakes(p_limit default 500)` moves due drafts to `expired`, skipping rows being saved at that moment, and writes one `intake_lifecycle_events` row each. It never touches an intake that was ever certified, even one whose expiry was set another way. pg_cron runs it hourly as `expire-idle-intakes` (`17 * * * *`) when the project has pg_cron; otherwise the migration logs a notice and the function can be run from any scheduler with the service role. Only `service_role` may call it.
- When the migration ran, existing drafts got a full window from that day (nothing expired on deploy day), and `last_activity_at` was backfilled from `updated_at` without bumping versions.
- Changing the window means changing `intake_draft_retention()`, moving `expires_at` on existing drafts in the same migration, and changing `DRAFT_RETENTION_DAYS` (`src/data/intakeLifecycle.ts`), which the Chamber shows prospects. `schemaSync.test.ts` keeps that constant equal to the function.

The Chamber resumes the prospect's latest `in_progress` intake by `last_activity_at`. With none open, if their most recent intake expired, it says so ("This intake has expired") and offers a new one. A linked intake that expired says the same. A tab that is open when its intake expires finds out at its next save ("Not saved: this intake has expired.", with "Start a new intake", which keeps what is on screen).

### Start over and revocation

- **Start over** (the Chamber's top bar, confirmed first) calls `public.archive_chamber_session(id)` after any save already on its way, then begins a blank intake. It archives the caller's own draft when it was never certified (`'archived'`, one audit row), and keeps anything certified, once certified or expired (`'kept'`). It answers `PT404` (HTTP 404) for an intake that isn't the caller's, or is already archived, so a retry reads as done.
- **Revocation**: `public.revoke_chamber_session(id, reason)` is for admins only (`has_role('admin')`). It takes a draft that was never certified, in progress or expired, and needs a reason of 1 to 2,000 characters. It answers `PT404` for an unknown intake and refuses anything ever certified (`55000`) and records the admin and the reason. There is no screen for it yet: call it from the SQL editor as an admin's JWT, or through the API.
- `intake_lifecycle_events` (append-only, advisors can read it) holds every expiry, archive and revocation: session, owner, from and to status, reason, actor (null for the job) and when.

### The browser's copy of unsaved answers

While a change hasn't been confirmed by the server, the Chamber keeps a copy in `localStorage` (`src/data/intakeBackup.ts`, key `eaa.intake-backup.v1:<user>:<intake>`), with the version it was made on. A confirmed save removes it. When the same person opens the same intake again and the copy differs from what the server has, the Chamber offers it back: "Restore my changes" saves it from the loaded version, or "Discard them". It warns when the intake was saved from somewhere else since. A copy the server already matches (the save sent as the page closed landed) is removed silently.

- The census is never written to the browser (names, dates of birth, pay). A restore keeps the server's census.
- A copy is kept for at most 7 days, is offered only to the user who wrote it, and every copy goes on a deliberate sign-out.
- A copy that isn't the shape written, or breaks intake schema v1, is discarded.
- Not covered: answers typed before the intake row was first created (if creating it fails), and storage that is blocked or full. The Chamber warns when the browser won't keep site data at all.

### Getting back from another browser

The intake belongs to the Supabase user that created it. A guest is anonymous until they verify an email (at certification). When a link can't be opened, usually because this browser no longer holds the sign-in (another device, a private window, cleared data), the Chamber explains why and offers to email a sign-in code to the address they verified (`signInWithOtp` with `shouldCreateUser: false`, then `verifyOtp` type `email`). It says the same thing whether or not the address has an account. A guest on a fresh intake gets the same offer ("Continue an earlier intake"). Once signed in, the Chamber drops the blank guest intake and opens the linked intake, or their latest one. An intake that never had an email verified can't be recovered from another browser. The code arrives in Supabase's "Magic Link" email template, which must contain `{{ .Token }}` (`npm run setup:supabase` sets it).

### Transcript on resume

A transcript is restored as saved, with repeated greetings removed: Lenore's opening line is marked `kind: "greeting"` (older openings are recognised by their words), and only the first greeting is kept. A voice session's own hello is not added again. The panel opens at the latest message without scrolling through the history, marks "Restored from your last visit" after the last restored message, and follows new messages only while the reader is at the bottom (otherwise it offers "New message"). The orb shows Lenore's latest line rather than a separate hello.

