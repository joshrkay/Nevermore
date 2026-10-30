# Intake schema

The intake lives in `chamber_sessions`. The first section covers the answers themselves (`chamber_data`), the rest their provenance (`field_provenance`).

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

### Adding a field

A new key in `ChamberData` needs a migration first: add it to `public.chamber_data_field_kind` with its kind, then to `EMPTY_CHAMBER_DATA`, `FIELD_SCHEMAS`, `FIELD_LABELS` and `FIELD_KINDS`. `src/data/schemaSync.test.ts` compares the SQL key list, state codes and caps with the client constants, so a field added on one side only fails CI. The database refuses an unknown top-level key, so a front end shipped ahead of its migration would fail every save.

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
  "source": { "kind": "transcript", "message_id": "<chat message id>", "quote": "about 40 of us" },
  "updated_at": "2026-10-21T09:00:00.000Z",
  "candidates": [{ "value": 40, "source": { "...": "..." } }]
}
```

`candidates` is present only while the field is `conflicting`.

#### Status

| Status | Meaning | Open item |
| --- | --- | --- |
| `confirmed` | The prospect stated it explicitly, or confirmed or entered it in the workspace. | — |
| `inferred` | Lenore derived or assumed it from what was said. | "Please confirm" |
| `incomplete` | Only part of the answer was given. | "Incomplete" |
| `conflicting` | Two sources disagree. The first value is kept until the prospect picks one. | "Conflicting answers" |

#### Source

| `kind` | Fields | Produced by |
| --- | --- | --- |
| `transcript` | `message_id` (the `ChatMessage.id` in `transcript`), optional `quote` (≤ 200 chars) | Chat extraction (`chamber-extract`) and voice `<extract>` tags |
| `document` | `document_id`, optional `document_name`, `location` (e.g. sheet/row or page) | A value the prospect applied from an uploaded document (see "Document candidates" below) |
| `prospect_edit` | — | Confirm, Edit, Add, or "Use this" in the workspace |

### Merge rules (`applyExtraction`)

1. Values are validated per field (`sanitizeChamberPatch`). Invalid and empty values are dropped.
2. A field whose source is `prospect_edit` is never changed by AI extraction.
3. A new field takes the value, with the model's status (default `inferred`).
4. If AI sources (transcript or document) give a different value, the old value is kept and the field becomes `conflicting`, with both candidates. Two exceptions:
   - The model lists the field in `corrected_fields`, meaning the prospect explicitly corrected it. The new value replaces the old one.
   - The new value only adds entries to a list, or the field is the `census`. The new value replaces the old one.
5. When the same value is heard again, the source is refreshed. The status can go up from `inferred` to `confirmed`, but never down.
6. Prospect actions (`applyFieldAction`) set the status to `confirmed` and the source to `prospect_edit`, and clear any candidates. Confirming a conflicting field requires choosing a candidate first.

### Extraction contract (`chamber-extract`)

The response is `{ extracted, field_status, evidence, corrected_fields, reply }`. `field_status` and `evidence` are keyed by field name and only cover fields in `extracted`. `field_status` is one of `confirmed`, `inferred` or `incomplete`; only a disagreement makes a field `conflicting`.

### Document candidates (`document-extract`)

Uploads live in `documents`, linked to their intake by `session_id`. RLS requires the caller to own both the row and the intake. The function reads one document as the calling user and writes the result to that row only: `status`, `category` (see below) and `extraction`.

- `category` is one of `employee_census`, `benefits_summary`, `payroll_report`, `workers_comp_loss_runs`, `peo_invoice`, `prior_proposal` or `other`. It is suggested from the file name and the prospect can change it. The first four are "still helpful to provide" when missing; none is ever required. A census found in a file filed as `other` is filed as `employee_census`.
- `file_sha256` is the SHA-256 of the file. The browser records it so a repeat can be refused before upload; `document-extract` records the hash of the stored bytes, which wins. An intake can't hold two files with the same hash (a unique index), or more than 25 documents (a trigger).
- Before storing a file the browser reads its leading bytes and refuses one that isn't what its name says (a PNG named `.pdf`) or is empty. Files are stored with the type their contents show. The `documents` bucket also refuses files over 20 MB and types outside PDF, Word, Excel and CSV; `document-extract` reads up to 10 MB and 50 pages and saves anything larger for the advisor.
- Stored files sit at `{user_id}/{session_id}/{file}` in the private `documents` bucket. Reading or deleting one requires owning that intake, the same as its row; advisors read through short-lived signed links.
- An interrupted read (`processing` when an intake opens) is shown as `failed` so the prospect can retry it.
- `status` is one of `uploaded`, `processing`, `extracted`, `no_data`, `unsupported`, `encrypted`, `unreadable`, `too_large` or `failed`.
- `extraction` is `{ message, notes, candidates: [{ field, value, location, stated? }], applied: { field: timestamp }, kept: { field: timestamp }, extracted_at }`. It defaults to `{}`. `notes` say how the file was read (a skipped column, rows left out). For a `census` candidate, `stated` maps each row id to the facts that row actually stated (a bit per entry of `CENSUS_FACTS`); a blank cell is not stated.

CSV, XLSX and XLS sheets, and tables in a `.docx`, are searched for a census. Columns are matched to census fields by header (exact phrases, phrases with filler words removed such as "Employee DOB", key words, and small typos), and each row is read into a census row, so employee details never go to the model. The candidates proposed are the `census`, the W-2 `employee_count`, `states`, `has_1099` and `ca_contractors`. Totals lines, rows with no name and workers that aren't W-2 or 1099 are left out and counted in a note. Text PDFs, Word paragraphs and every table that isn't a census are read by the model for company-level fields only (never individual employees); where both give a field, the census wins. Old `.doc` files and scans are saved for the advisor and not read.

Candidates never change `chamber_data` by themselves. In the Upload tab the prospect sees each candidate next to what the intake holds (a census as rows, with a count of people missing an age, work state, title or salary) and can:

- **Apply** a value the intake doesn't have yet (`applyDocumentCandidates` in `src/data/documentCandidates.ts`). It goes through `applyExtraction` with status `confirmed` and a `document` source, so a prospect's own value is never changed.
- **Resolve** a value that differs from the intake's, in the conflict dialog. Nothing is pre-selected for a single value: they pick the intake's or the document's, and the one they keep is recorded as `confirmed`. For a census the dialog lists who is in both, whose details differ, who is only in the file and who is only in the intake, and offers **Merge** (the default: people in both take the facts their row stated, so a blank cell never overwrites an answer; new people are added; the rest stay; and everyone keeps their id and dependents. Merge is not offered when the result would pass 5,000 people), **Replace** with the file's census, or **Keep my census**. A choice is applied by `resolveCandidate`; a kept answer shows as "Kept yours".

### Submission

When the prospect signs, `submission.field_provenance` snapshots the provenance alongside `submission.chamber_data`. The Manuscript shows the status and source for each row, and adds the status-based open items to "Underwriting Readiness".
