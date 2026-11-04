# Intake schema

The intake lives in `chamber_sessions`. The first section covers the answers themselves (`chamber_data`), then their provenance (`field_provenance`), then the session's lifecycle (`status`, expiry, archiving, revocation and the browser's backup of unsaved answers).

## Intake data (`chamber_data`)

`chamber_sessions.chamber_data` is a jsonb object with the 42 keys of `ChamberData` (`src/data/chamberTypes.ts`), the fields of intake schema v2, and the database also accepts `employees`, the roster's name before the census (migration `20261029092000` added `census`). The browser sanitises it (`src/data/chamberValidation.ts`) and the database refuses anything outside the same rules (`public.chamber_data_error`, migration `20261027090000_intake_validation_and_versioning.sql`). The client is the stricter side: it drops or truncates, so valid client output is never refused.

### Rules by kind

| Kind | Rule | Client on bad input |
| --- | --- | --- |
| text | `null` or a string of at most 1,000 characters (`TEXT_MAX`) | Trimmed; blank or longer is dropped |
| count | `null` or a whole JSON number, 0 to 1,000,000 (`COUNT_MAX`) | Numeric strings are coerced ("1,200"); anything else is dropped |
| boolean | `null`, `true` or `false` | Anything else is dropped |
| experience mod | `null` or a JSON number from 0 to 10 (`EXPERIENCE_MOD_MAX`), such as 0.92 | Numeric text is read ("0.92"); kept to two decimal places; out of range is dropped |
| dollars | `null` or a whole JSON number from 0 to 100,000,000 (`DOLLARS_MAX`) | `$`, commas and spaces are removed ("$18,400"); cents are rounded; over the cap is dropped, not capped |
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

Every field belongs to a section and is either required or recommended, with a rank: see "Sections, required fields and rank" below. The table is generated from the schema's `x-intake` annotations, and `src/data/intakeSchemaDoc.test.ts` fails while it differs from them.

Writers: **C** chat extraction (`chamber-extract`, which asks for every field but the census, for typed and spoken messages alike: a voice call's answers go through it too, US-2.3b), **D** document candidates (`document-extract`; a census sheet also supplies `census`, `employee_count`, `states`, `has_1099` and `ca_contractors`), **E** hand edit in the workspace.

| Section | Key | Label | Kind | Required | Rank | Writers |
| --- | --- | --- | --- | --- | --- | --- |
| Company | `company_name` | Company legal name | text | Required | 1 | C D E |
| Company | `employee_count` | Employee count | count | Recommended | 5 | C D E |
| Company | `industry` | Industry | text | Recommended | 6 | C D E |
| Company | `start_month` | Target start | text | Recommended | 15 | C D E |
| Company | `multiple_entities` | Multiple entities | boolean | Recommended | 16 | C E |
| Company | `fein_count` | FEIN count | count | Recommended | 17 | C |
| Locations | `states` | States of operation | state list | Required | 2 | C D E |
| Locations | `hq_state` | HQ state | state | Recommended | 7 | C D E |
| Census | `census` | Employee census | census (read-only in the workspace) | Recommended | 4 | D |
| Census | `has_1099` | 1099 contractors | boolean | Recommended | 34 | C D |
| Census | `ca_contractors` | California contractors | boolean | Recommended | 35 | C D |
| Benefits | `current_carrier` | Current carrier | text | Recommended | 8 | C D E |
| Benefits | `renewal_date` | Renewal date | text | Recommended | 9 | C D E |
| Benefits | `virgin_medical` | First-time medical coverage | boolean | Recommended | 18 | C D |
| Benefits | `rate_history` | Rate history | text | Recommended | 19 | C D E |
| Benefits | `benefits_waiting_period` | Waiting period | text | Recommended | 20 | C D E |
| Benefits | `ancillary_benefits` | Ancillary benefits | text list | Recommended | 21 | C D E |
| Benefits | `has_401k` | Retirement plan | boolean | Recommended | 22 | C D E |
| Benefits | `retirement_type` | Retirement plan type | text | Recommended | 23 | C D |
| Benefits | `employer_contributes` | Employer retirement contribution | boolean | Recommended | 24 | C D |
| Payroll | `pay_frequency` | Pay frequency | text (free text, not an enum) | Required | 3 | C D E |
| Payroll | `payroll_vendor` | Payroll vendor | text | Recommended | 10 | C D E |
| Payroll | `funding_days` | Funding lead time | count | Recommended | 25 | C E |
| Payroll | `has_nonexempt` | Nonexempt employees | boolean | Recommended | 26 | C |
| Payroll | `nonexempt_count` | Nonexempt count | count | Recommended | 27 | C D |
| Payroll | `exempt_count` | Exempt count | count | Recommended | 28 | C D |
| Payroll | `pto_types` | PTO types | text list | Recommended | 29 | C E |
| Payroll | `accrual_method` | Accrual method | text | Recommended | 30 | C E |
| Workers' comp | `wc_carrier` | Workers' comp carrier | text | Recommended | 11 | C |
| Workers' comp | `wc_renewal_date` | Workers' comp renewal date | text | Recommended | 12 | C |
| Workers' comp | `wc_experience_mod` | Experience mod | experience mod | Recommended | 13 | C |
| Workers' comp | `wc_annual_premium` | Workers' comp annual premium | dollars | Recommended | 14 | C |
| Operations & HR | `has_handbook` | Employee handbook | boolean | Recommended | 31 | C D |
| Operations & HR | `handbook_last_updated` | Handbook last updated | text | Recommended | 32 | C |
| Operations & HR | `hr_staff_count` | In-house HR staff | count | Recommended | 33 | C |
| Operations & HR | `uses_physical_clocks` | Physical time clocks | boolean | Recommended | 36 | C |
| Operations & HR | `uses_mobile_app` | Mobile timekeeping | boolean | Recommended | 37 | C |
| Operations & HR | `uses_computer_timekeeping` | Computer timekeeping | boolean | Recommended | 38 | C |
| Operations & HR | `shift_differentials` | Shift differentials | boolean | Recommended | 39 | C |
| Operations & HR | `hris_system` | HRIS system | text | Recommended | 40 | C |
| Operations & HR | `key_challenges` | Key challenges | text | Recommended | 41 | C |
| Operations & HR | `business_goals` | Business goals | text | Recommended | 42 | C |

Dates (`start_month`, `renewal_date`, `handbook_last_updated`, `wc_renewal_date`, `dob`) are free text. `field_provenance` and `documents.extraction` are not validated beyond the existing is-object checks. `transcript` is checked message by message (see "The transcript" below).

### Sections, required fields and rank

Each field's `x-intake` annotation in the schema names its label, its section, whether it is required, and its rank. The vocabulary is `GLOSSARY.md`'s.

- **Sections:** Company, Locations, Census, Benefits, Payroll, Workers' comp, and Operations & HR. Dependents have no section of their own: they sit inside each employee in the census. Locations are `hq_state`, `states` and each employee's `work_state` and `zip_code`; there is no list of worksites (decision D18). Workers' comp is the four `wc_` fields plus each employee's `class_code`.
- **Required fields** are the three an intake needs before it is *ready to certify*: company legal name, states of operation and pay frequency (D2, D25). They are `REQUIRED_ITEMS` in `src/data/readiness.ts`, which the Review, the Reckoning and the certification gate (`EA003`) use, and `src/data/intakeSchema.test.ts` fails while the schema's `required` flags differ from that list.
- **Recommended fields** are every other field, the census first. None is needed to certify. The census is recommended because today it only comes from an uploaded file, and no document is required (D2).
- **Rank** is the order Lenore asks in, 1 first. The required fields rank first, then the recommended fields in the order of decision D25 (the census, employee count, industry, HQ state, current medical carrier, renewal date, payroll vendor, then the four workers' comp fields), then the rest in the order the schema lists them. The product team owns the order; change `REQUIRED_FIELDS` or `RANKED_RECOMMENDED` in `supabase/functions/_shared/intakeSchema.ts`, then regenerate the published schema.
- **Open items** are not stored. They are worked out from the answers and their field statuses (see "Field provenance").

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

`chamber_sessions.schema_version` (smallint, migration `20261103091000`) records which version of the intake schema the row's answers follow. The current version is 2, the default, and the database refuses any other value. Version 2 (migrations `20261103120000` and `20261103120100`) is version 1 plus the workers' comp block, with nothing in v1 changed, so every row moved to 2 without its answers being rewritten. The move was not a save: no `data_version`, `updated_at` or `last_activity_at` changed. A later version changes the check in its own migration, says how rows move, and changes `INTAKE_SCHEMA_VERSION` with it.

### JSON Schema v2 and strict checks on the way in

The canonical schema is `supabase/functions/_shared/intakeSchema.ts`: `chamber_data` as a JSON Schema (draft 2020-12), published as [`docs/intake-schema.v2.json`](intake-schema.v2.json). Regenerate the file with `npm run schema:intake`; `src/data/intakeSchema.test.ts` fails while the two differ. [`docs/intake-schema.v1.json`](intake-schema.v1.json) is version 1 as it was published; the same test checks that v2 only adds to it.

Each top-level property carries an `x-intake` annotation: `{ "label", "section", "required", "rank" }`. Validators ignore it; it is how the schema publishes each field's required status and the order Lenore asks in.

It is the stricter statement of the same rules: every value it accepts, the database accepts. `src/data/schemaSync.test.ts` holds its state codes, caps, census value lists and field kinds to the migrations, and `src/data/chamberValidation.test.ts` checks that the sanitiser's output always passes it. It is stricter than the database in three ways:

- An unknown key is refused at every level, including inside a census row or a dependent. The database tolerates those, so an older client can save a newer census.
- `employees`, the roster's old name, is not part of the schema. The database still accepts it.
- A census row must carry `id`, `first_name`, `last_name`, `work_state`, `compensation_type`, `employment_type` and `classification`, as every writer gives it. The database requires only `first_name`.

The validator (`validateChamberData`, `validateIntakeField`) is strict. A value is accepted as sent or refused with a reason. Nothing is trimmed, upper-cased, split or converted. Issues name the path the way the database does (`states[1]`, `census[0].dependents[0].relationship`), never the value, and stop at 50. It implements only the keywords the schema uses (`type`, `enum`, `maxLength`, `pattern`, `minimum`, `maximum`, `maxItems`, `items`, `properties`, `required`, `additionalProperties: false`, local `$ref`, and the `x-intake` annotation), and refuses a schema with any other, so a rule can't be written into the schema and then go unenforced. Lengths count characters (code points), as Postgres does.

Where it runs:

| Data coming in | What happens to a value that breaks the schema |
| --- | --- |
| The model's extraction in `chamber-extract` | The field is refused and listed in the response's `rejected` (path and reason), along with its status, evidence and correction. The function logs `EXTRACTION_REFUSED request=… paths=…` (paths only). The browser never receives it. |
| The browser's backup of unsaved answers (see "Session lifecycle") | The whole copy is discarded, not offered for restore, and a warning names the paths. |
| A saved intake as the Chamber loads it | The mismatch is logged (paths and reasons). Rows saved by earlier versions stay editable: the sanitiser still loads what is valid. |

A voice call's answers are checked the same way: each spoken message goes through `chamber-extract` like a typed one (US-2.3b). The agent's own `<extract>` tags, which used to reach the intake through the sanitiser alone, are never read.

### Adding a field

A new field is a new schema version, because the schema refuses unknown keys. As v2 did:

1. A migration adds the key to `public.chamber_data_field_kind` with its kind, and a second one moves `schema_version` on (see "Versions").
2. In `supabase/functions/_shared/intakeSchema.ts`, add the field to `FIELDS` (rule, section, label), rank it if it belongs before schema order, and raise `INTAKE_SCHEMA_VERSION`. Then add it to `ChamberData`, `EMPTY_CHAMBER_DATA`, `FIELD_SCHEMAS` and `FIELD_KINDS`.
3. Run `npm run schema:intake` to publish `docs/intake-schema.v<N>.json`, and regenerate the field table above.
4. Add it to chat extraction: `FIELD_TYPES` and a one-line definition in `SYSTEM_PROMPT` (`supabase/functions/chamber-extract/schema.ts`), with a new `PROMPT_VERSION` and its fingerprints (`supabase/functions/_shared/ai/promptVersion.test.ts`).

`src/data/schemaSync.test.ts` compares the SQL key list, kinds, state codes and caps with the client constants and the schema, reading each `sync:` block from the latest migration that defines its function, and `FIELD_TYPES` with `ChamberData` and `FIELD_KINDS`, so a field added on one side only fails CI. The database refuses an unknown top-level key, so a front end shipped ahead of its migration would fail every save.

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
| `job_title`, `annual_salary` | Salary is whole dollars a year. An hourly rate becomes a year's pay at the stated weekly hours, or at 2,080 hours for a full-time worker (recorded in `assumed` when the hours weren't given). |
| `compensation_type` | `salary` or `hourly`. |
| `employment_type` | `full_time` or `part_time`; weekly hours of 30 or more are full time. Full time when nothing says, recorded in `assumed`. |
| `classification` | `w2` or `1099`. A blank label is stored as W-2 and recorded in `assumed`; a label that is neither (a K-1 owner) drops the row rather than guess. |
| `coverage_tier` | `EE`, `EE+SP`, `EE+CH`, `FAM` or `WAIVE`. When absent, the Manuscript derives a tier from the `dependents` named, and otherwise shows it as not provided. |
| `class_code` | Four-digit workers' comp code. |
| `dependents` | Named in conversation, never read from a document. |
| `assumed` | Which of `classification`, `employment_type` and `annual_salary` hold a default rather than an answer. Absent when none do. |

#### Defaults are recorded, not passed off as answers

A row always has a classification, an employment type and a pay type, so a file that doesn't say gets a default. `assumed` (US-1.4) lists the ones that are only defaults, so nothing downstream presents them as answers:

- **Reading a row** (`normalizeCensusRow`) adds a fact to `assumed` when it filled the value in, and keeps a fact a saved row already lists as long as the value is still the default. A row saved before the list existed has none: its values can't be told apart.
- **Merging a document's census** (`mergeCensus`) never lets a default replace an answer, even in a column the file has, and drops a fact from a person's `assumed` once a document states it.
- **The Manuscript** shows a defaulted classification as "Not provided" and counts it apart from W-2 and 1099, marks a year's pay worked out at assumed hours "(hourly, est.)", and lists each kind as an open item with a count. It never prints "Employee Only" or a dependent count nobody gave: a person with no tier and no named dependents is "Not provided", and the total says how many people it leaves out. The workspace's census tables show the same labels.
- **The database** tolerated unknown keys in a census row already, so no migration was needed. Intake schema v1 now lists `assumed` as an optional key of a census row (`docs/intake-schema.v1.json`), without a new version: it is optional, and nothing that validates against v1 runs outside the app that writes it.

Intakes, provenance entries, advisor reviews and signed snapshots saved before the census contract call the roster `employees` and use `state`, `title`, `salary` and `"W2"`. They are read as `census` and never rewritten, so a signed Manuscript still renders. A census row with no first name, or a `classification` that isn't W-2 or 1099, is dropped when read.

#### Never stored

Social Security numbers and bank account details are not stored anywhere. `redactSensitive` (`supabase/functions/_shared/sensitive.ts`) replaces a formatted SSN (groups split by hyphens, spaces, or en or em dashes, or by dots throughout: `123-45-6789`, `123–45–6789`, `123.45.6789`), an SSN glued to its label (`ssn123456789`, `SSN_123-45-6789`, `SS123-45-6789`), a labelled account or routing number, a card number in groups split by spaces or hyphens (`4111 1111 1111 1111`, three groups of four and the rest up to 19 digits, or American Express's `3782 822463 10005`) when it starts as a card number does (2 to 6) and passes the card's check digit (Luhn), also where it follows other groups of digits (a table's ID or year cell joined before it: `1042 4111 1111 1111 1111`), and any run of nine or more digits with `[redacted]` in free-text fields of `chamber_data`, chat messages (before they are stored or sent to the model), evidence quotes and everything `document-extract` reads or returns. Spreadsheet columns headed like an SSN or bank detail (`SSN`, `Tax ID`, `Routing Number`, `Direct Deposit Account` and similar) are never read, and the prospect is told which columns were skipped. The uploaded file is kept as it was, so a prospect can be told to upload a copy without those columns. An EIN (`12-3456789`), a phone number with separators (`(555) 123-4567`, `+1 555 123 4567`), an amount (`$85,000`, or a rate sheet's `512.40 1124.80`), a date (`01/02/1985`) and a row of years or class codes (`2021 2022 2023 2024`) are left alone. Two over-redactions are accepted: a bare run of nine or more digits is removed whatever it is, and so is a row of four-digit groups that starts like a card and happens to pass the check digit (about one such row in ten, a row of class codes for instance).

## Field provenance

Each field in `chamber_sessions.chamber_data` (see `src/data/chamberTypes.ts`) has a status and a source. These are stored beside the data in `chamber_sessions.field_provenance` (jsonb, keyed by field name, default `{}`). Fields with no entry have not been captured yet, or were captured before provenance existed.

The model and merge rules are in `src/data/provenance.ts`; the open items, one list for Review, The Manuscript and the advisor queue, in `src/data/openItems.ts` (US-2.2a): a required answer with none ("Not provided", or "Prospect to provide" when the prospect said they don't know), the census ("Document needed"), then fields by status: conflicting, incomplete, unknown, inferred. "Doesn't apply" (`not_applicable`) closes a field; only the prospect sets it, in Review, on an unanswered field certification doesn't need, and "Undo" takes it back. The advisor queue counts the same items (`advisor_list_submissions`, migration `20261104118000_open_items.sql`), less those an advisor verified; `supabase/tests/fixtures/open_items.json` holds both to the same answers, except for one case: a REQUIRED answer in conflict that an advisor verified stays an open item here (certification still blocks it), while the queue's count leaves it out. The queue's count is for the advisor, who has already settled it. Which items an intake must hold, and how settled each is, is under "Required items" below.

### Entry shape

```json
{
  "status": "inferred",
  "source": { "kind": "transcript", "message_id": "<chat message id>", "quote": "about 40 of us", "prompt_version": 1 },
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
| `unknown` | The prospect said they don't know yet. Holds no answer; Lenore stops asking. | "Prospect to provide" |
| `not_applicable` | The prospect said the field doesn't apply to them. Holds no answer. Only the prospect sets it (decision D31). | — (it closes the field) |

Open items are listed conflicting first, then incomplete, unknown and inferred. Statuses are defined in `GLOSSARY.md`.

#### Source

| `kind` | Fields | Produced by |
| --- | --- | --- |
| `transcript` | `message_id` (the `ChatMessage.id` in `transcript`), optional `quote` (≤ 200 chars), optional `prompt_version` (a positive integer; see "Extraction contract version and eval" below) | An extraction (`chamber-extract`) from a typed or spoken message. A spoken message's answers are `inferred` at most (D33) |
| `document` | `document_id`, optional `document_name`, `location` (e.g. sheet/row or page) | A value the prospect applied from an uploaded document (see "Document candidates" below) |
| `prospect_edit` | — | Confirm, Edit, Add, or "Use this" in the workspace |

### Merge rules (`applyExtraction`)

Every AI value reaches the intake through `applyExtraction`: an extraction from a typed or spoken message (`useLenoreChat` hands each one to the Chamber with the prospect's message it answers; a spoken message's statuses are capped at `inferred` by `transcriptExtraction`, D33), and a document candidate the prospect applies.

1. Values are validated per field (`sanitizeChamberPatch`). Invalid and empty values are dropped.
2. Sources rank `prospect_edit` (3) above `document` (2) above `transcript` (1, typed and spoken alike: a typed answer and a different spoken one are a conflict for the prospect to choose). A field whose source is `prospect_edit` is never changed by an extraction, and nothing is noted on it; neither is a field marked `not_applicable`, whatever source it records (only the prospect sets it and takes it back). An answer replaces `unknown`.
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
8. Prospect actions (`applyFieldAction`) set the status to `confirmed` and the source to `prospect_edit`, and clear any candidates and `also_heard`. Confirming a conflicting field requires choosing a candidate first, and a field with no answer (unknown or not applicable) has nothing to confirm; entering an answer is how the prospect takes it back. The prospect choosing a document's value in the Upload tab's conflict dialog is the exception: it keeps `also_heard` and notes the value it replaced (see "Document candidates" below). An advisor verifying a field leaves `also_heard` as it is.

These rules run in the browser, and the database checks only that `field_provenance` is an object. That is by design: every AI value reaches the database through the prospect's own browser, which can already save any value as the prospect's own edit, so a database check of precedence would stop nothing.

#### Advisor verification in the workspace

A field an advisor verified (`public.session_verified_fields`) is settled for the prospect too. In place of "Lenore captured this — please confirm", "Incomplete" or "Conflicting answers" the row shows "Verified by your advisor", with no Confirm button and no rival answers to choose between; Edit stays. The exception is a required answer in conflict (company legal name, states, pay frequency): certification still blocks it whoever verified it, so it keeps "Conflicting answers" and its "Use this" candidates. An answer the prospect already confirmed keeps "Confirmed" or "Confirmed by you", `unknown` and `not_applicable` fields are unchanged, and a verified value with no provenance at all (typed before provenance existed) gets the badge too. The browser reads the set whenever a row is loaded (opening the intake, Load latest, Discard) and ties each verified field to the answer it held when the row was loaded. A field is dropped the first time its answer on screen differs from that one, and stays dropped until the next read: an edit, another tab's change or a chat correction removes the badge at once, as the server resets that review (`chamber_sessions_reset_changed_reviews`), and writing the old answer back doesn't restore it, since the server doesn't either. Discarding a local edit reloads the row and reads again, which brings the badge back when the server still holds it. A field is only counted when the stored answer is the one loaded: a row saved by an earlier version (a roster keyed `employees` or without ids, a headcount saved as text) is rewritten in its clean form by the first save, so the server resets that review and the browser doesn't show it. A read that fails keeps the set already known. The set reaches every field row through `VerifiedFieldsContext` (`src/components/chamber/workspace/VerifiedFieldsContext.ts`), provided by `LiveWorkspace`.

#### Also heard

`also_heard` is a list of `{ value, source }`, the same shape as a candidate. It is a note, not a choice: it never changes the status or adds an open item. It holds at most 5 entries, newest last, one per value (a value heard again moves to the end, keeping the higher-ranked of the sources that gave it, or the latest if they rank the same), and never the field's current value. The prospect sees each entry under the answer as "Also heard: <value> — <where it came from>" (in the Review tab and the other workspace tabs, not in a read-only view; an answer a conflict already offers is not repeated), and the advisor sees it in the field row; neither The Manuscript nor its PDF shows it. It goes when the prospect confirms or edits the answer. Entries saved before it existed have none, and a malformed note is dropped without losing the rest of the entry.

### Extraction contract (`chamber-extract`)

Version 4 of the prompt (`PROMPT_VERSION`; US-2.1b and B-1.1 each built a version 2 at the same time, 3 is the two merged, and 4 adds how Lenore replies and the user turn's ready and census lines, US-2.3a). The request is `{ message, context, statuses, recent, census, session_id }`: the prospect's message; the answers captured so far (the census left out); each field's status; the last 10 messages, the prospect's and Lenore's only, oldest first, each at most 2,000 characters, with Social Security and account numbers removed again by the function; `census`, which is `{ rows, work_states }`: how many rows the uploaded census has and whether any names a work state, never the rows (optional; a tab from before it counts as no census); and the intake id, which must be the caller's own intake. `context`, `statuses` and `recent` together are at most 20,000 characters (`_shared/chatContext.ts`, which the browser uses to cut the oldest messages until they fit). A status for a field the intake doesn't have, a status that isn't one, or a message from anyone else is `bad_request`, before any quota is spent. From the answers and statuses the function works out the fields not yet settled, by rank (`_shared/followUp.ts`, D26), and names the first eight in the prompt, counting the census's work states as an answer to States of operation, with whether the intake is ready to certify (`readyToCertify`) and whether a census is in; the recent conversation lets a one-word answer ("Yes") be placed against the question Lenore asked last. The browser builds the request with `chatRequestBody` (`src/data/chat.ts`) and the function builds the user turn with `buildUserPrompt` (`chamber-extract/prompt.ts`); the extraction eval replays both.

The tool covers every top-level field of intake schema v2 but the census (`FIELDS`, `FIELD_TYPES` and `FIELD_GUIDE` in `chamber-extract/schema.ts`; the field list and types come from the schema, and a test fails when a field has no guide), as a string, a whole number, a decimal (the experience mod), a boolean or a list of strings. `SYSTEM_PROMPT` defines each one in a line, `- key (Label): guide`, and states this schema's caps (counts 0 to 1,000,000, the experience mod 0 to 10, the workers' comp premium up to 100,000,000 dollars, text up to 1,000 characters, lists up to 100 items). `has_401k` means any employer retirement plan, as the workspace labels it. The workspace shows `fein_count`, `retirement_type`, `employer_contributes`, `nonexempt_count` and `exempt_count` only beside their flag (`multiple_entities`, `has_401k`, `has_nonexempt`), so the guide asks for the flag with each. `src/data/schemaSync.test.ts` fails when a field is missing from `FIELD_TYPES` or typed differently from the kind the workspace edits it as (`FIELD_KINDS`). The response is `{ extracted, field_status, evidence, corrected_fields, reply, rejected, prompt_version, request_id }`; a failure is `{ error, code, request_id }` (codes, limits and the extraction event each call leaves: `docs/AI_OPERATIONS.md`). An answer without the forced tool call is `invalid_response`, not an empty extraction. `field_status` and `evidence` are keyed by field name. For a field in `extracted`, `field_status` is `confirmed`, `inferred` or `incomplete`. A field the prospect said they don't know has `field_status` `unknown`, its evidence, and no value; the browser marks it `unknown` ("Prospect to provide") while it has no answer, and never over the prospect's own edit or "Doesn't apply". The model never sets `conflicting` (only a disagreement does) or `not_applicable` (only the prospect does, D31). A field enters `extracted` only if the intake schema accepts the model's value exactly as sent. A lower-case `"ny"`, a state list with one unknown code, `12.5` people or a string of digits is refused and listed in `rejected` as `{ path, reason }`. The browser ignores `rejected`. A bad value costs only its own field: the rest of the extraction and Lenore's reply still apply. A key outside the field list is dropped without being logged. A reply whose tool arguments aren't JSON, or one Anthropic cut off at its cap (`CHAT_MAX_TOKENS`, 8,192 tokens, room for every field with its quote), is answered with a 502 `invalid_response`, "Lenore's answer didn't come through. Please try again.", and the browser offers Try again and Continue manually; nothing from it is kept.

### Extraction contract version and eval

`PROMPT_VERSION` in `supabase/functions/chamber-extract/schema.ts` (a positive integer) versions the whole extraction contract: `SYSTEM_PROMPT`, `EXTRACT_TOOL`, the user turn and the response shape. Every extraction event records it (`ai_extraction_events.prompt_version`, US-2.4a), every successful response carries it as `prompt_version`, and the browser stores it on the transcript source of each value a typed or spoken message produced. Entries saved before versioning, and from a voice `<extract>` before voice went through `chamber-extract` (US-2.3b), have none. Lenore's voice prompt, which governs only the conversation, has its own version: see `docs/prompts/`. A malformed stored version is dropped and the entry kept.

`supabase/functions/_shared/ai/promptVersion.test.ts` fingerprints each function's prompt and tool per `PROMPT_VERSION`, and for chat also the user turn (`buildUserPrompt` in `prompt.ts`, rendered for fixed inputs). Editing any of them without raising the version fails CI; then record the new version's fingerprints there, keeping the old ones. The response shape is not fingerprinted: raise the version by hand when it changes.

The extraction eval (`scripts/extraction-eval`) sends 10 synthetic transcripts through the path a chat message takes in production: the browser's redaction and context, the handler's prompt, the shared provider adapter, `shapeExtraction`, then `applyExtraction` as the Chamber merges a reply. It scores each asserted field's final value (strings ignoring case and surrounding space, lists as sets) and, where the fixture names one, its status (where it names none, a field left `conflicting` fails); fields that must stay empty; and digits (an SSN) that must never be stored. It calls a real model, so it runs on demand and never in CI:

```sh
LOVABLE_API_KEY=… npm run eval:extraction                            # the default provider
AI_PROVIDER=anthropic ANTHROPIC_API_KEY=… npm run eval:extraction
npm run eval:extraction -- --only contradiction                      # one fixture
npm run eval:extraction -- --update-baseline                         # record baseline.json
```

`AI_MODEL` overrides the provider's default model, as it does for the function. The variables can also go in `.env.local`, which the runner (vite-node) reads. The run prints a fixture-by-field table and the overall accuracy, then compares it with `scripts/extraction-eval/baseline.json`: a cell that passed there and fails now is a regression, and a regression, a failed model call or a missing key exits 1. New cells, and baseline cells no longer asserted (a deleted or renamed fixture), are reported. With no baseline the run reports any failed model calls, says how to record one and exits 0.

Before merging any change to the prompt, the tool schema or the response shape: raise `PROMPT_VERSION` and record its fingerprints, run the eval, review the regressions, then record a new baseline with `--update-baseline` and commit it with the change. No baseline is committed yet: the first needs a live provider key.

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

When the prospect signs, `submission.field_provenance` snapshots the provenance alongside `submission.chamber_data`. The Manuscript shows the status and source for each row, and adds the open items (see "Required items") to "Underwriting Readiness".

### Required answers

Three answers are required before an intake can be certified, and so before The Manuscript can be generated (decision D2, US-1.2). The one list is `REQUIRED_ITEMS` in `src/data/readiness.ts`:

| Key | Answer | Counts as given when |
| --- | --- | --- |
| `company_name` | Company legal name | it isn't blank |
| `states` | States of operation | `states` holds a state code, or a census row (or a row of the older `employees` roster) has a work state that is one |
| `pay_frequency` | Pay frequency | it isn't blank |

The employee census is recommended, not required (`RECOMMENDED_ITEMS`): it can only come from an uploaded file today, and no document is required. A missing census is an open item in the Review step and the Manuscript, and never blocks.

- **In the app.** These fields are marked "Required" wherever they appear (`ProvenanceField`), and say they're needed while empty. The Review step lists what is still missing, with a link to each field. The Reckoning lists them with a way back to Review, and keeps Generate disabled (`certificationBlockers`). The Manuscript lists them as "not provided" open items, as the advisor queue does.
- **In the database.** `public.intake_missing_required(chamber_data)` returns the missing keys in the order above. Since migration `20261104103000` it reads `public.intake_answers_present`, the one presence rule `intake_required_items` reads too (see "Required items"), so it trims as the browser does and counts a state only when it is a code. A certification sent from the browser (`current_user` `anon` or `authenticated`) is refused while any are missing, with SQLSTATE `EA003` and the keys, comma-separated, in DETAIL (`company_name,pay_frequency`). Nothing is written. Other saves, existing certifications and privileged writes are not checked. `src/data/schemaSync.test.ts` compares the function's keys with `REQUIRED_ITEMS`.
- **On `EA003`.** The client names the missing answers and points to the Review tab. It is a definite refusal: saving carries on as before.

#### A required answer in conflict

A required answer whose field status is `conflicting` (Lenore and a document, or two things the prospect said, disagree) blocks certification too, until the prospect picks one with "Use this" in Review, which confirms it (B-2, decision D26). A conflict on any other field is an open item and never blocks. A states conflict blocks even when census rows carry work states.

- **In the app.** `conflictingRequired(provenance)` in `src/data/readiness.ts`, read by `certificationBlockingItems` in `src/data/requiredItems.ts`, the one list of what blocks for both screens. Review lists each under "Still needed" with a link to the field and its candidates; The Reckoning lists them ("choose one answer for") and `certificationBlockers` keeps Generate disabled. An advisor's verification doesn't lift a conflict here: the database reads the field statuses, not the reviews. States of operation that only a census in conflict gives blocks too, in the browser only (B-2.2), named as the census, until an advisor verifies the census (the database never reads it).
- **In the database.** `public.intake_conflicting_required(field_provenance)` returns the keys in the order above (migration `20261104100000_certification_conflicts.sql`). A certification from the browser is refused while any are in conflict, after the missing-answer check, with SQLSTATE `EA008` and the keys, comma-separated, in DETAIL. It reads the row's `field_provenance`, which the browser saves before it certifies. Nothing is written; other saves, existing certifications and privileged writes are not checked, and a conflict that appears after a certification doesn't withdraw it (the certified answers haven't changed). `src/data/schemaSync.test.ts` compares the keys with `REQUIRED_ITEMS`. Field provenance is written by the browser and not validated, so this holds an honest client to its own state.
- **On `EA008`.** The client names the answers and points to the Review tab. It is a definite refusal, like `EA003`.

### The chosen PEO (`chosen_peo`)

`chamber_sessions.chosen_peo` (text, nullable, migration `20261103100000_chosen_peo.sql`) is the PEO the prospect picked on PEO Match, kept so that a reload during the final steps doesn't lose it. It is `NULL` until they pick one, which they never have to: we don't rank PEOs or choose for them. It can be a listed PEO or one the prospect typed in.

- It is saved by the same versioned write as the answers (`chamber_data`, `field_provenance`, `transcript`), sent with the keepalive save on page unload, and set on insert. A read-back after a write that matched no row compares it too, so a different choice saved elsewhere is a conflict. Start over clears it with the rest of the screen. The browser's copy of unsaved answers does not include it.
- It is not an answer. It is outside `chamber_data`, so changing it doesn't move the certification hash or withdraw a certification. The certified PEO is `submission.peo`. When the two differ, The Reckoning asks the prospect to certify again (in the browser only; the database doesn't enforce it).
- A CHECK constraint keeps it trimmed and 1 to 80 characters (`PEO_NAME_MAX` in `src/data/peoCatalog.ts`, compared by `src/data/schemaSync.test.ts`). `cleanPeoName` trims and cuts by character before saving, so the app never sends a value the constraint refuses. A closed intake refuses a change to it like any other (see Session lifecycle).

## Required items

Decision D2 (see "Required answers" above): three required answers, then the recommended employee census. `requiredItems` (`src/data/requiredItems.ts`) takes the items, their order, labels and presence from `readiness.ts`, and says how settled each is:

| Item | Label | Required | Present when |
| --- | --- | --- | --- |
| `company_name` | Company legal name | yes | `company_name` has text |
| `states` | States of operation | yes | `states` holds a state code, or a census row names one as its work state |
| `pay_frequency` | Pay frequency | yes | `pay_frequency` has text |
| `census` | Employee census | no (recommended) | the census has at least one row |

Text counts when something other than whitespace is left (trimmed as `String.prototype.trim` trims, on both sides). A state counts when it is a state or territory code, in any case and with whitespace around it ignored, as the browser reads it; a roster saved before 20261027 can hold a `state` such as `NA`, which names no state. The census is `census`, or `employees` on an intake saved before the census contract that has no `census`; a row's work state is `work_state`, or `state` on such a roster. There is no "Not applicable" status and no "Document needed" item: no document is ever required. The census never blocks certification and never holds an intake back from complete (`isIntakeComplete`: the three required items settled).

Each item is in one state:

| State | When |
| --- | --- |
| `missing` | Not present. An advisor verifying the field doesn't change that. |
| `settled` | Present, and its field is `confirmed` (whoever confirmed it: the model, a document the prospect applied, or the prospect), or an advisor verified it, or it has no provenance entry. Every AI value carries provenance, so a value without any was typed by the prospect or predates provenance. |
| `conflicting`, `incomplete`, `unconfirmed` | Present and none of the above: the field's status, with `inferred` read as `unconfirmed`. |

A provenance entry counts only when `parseProvenance` would keep it (a known status, a string `updated_at`, a valid source, and a valid source on every candidate); any other entry is read as none. The census's provenance is its `census` entry, or `employees` when there is none (as `parseProvenance` reads it). States of operation is settled by `states`, or by a settled census whose rows name a work state. Otherwise it takes the state of `states` when that holds anything, or else the census's state when only the census names states (the browser's copy marks that item `viaCensus`).

**One rule.** In the database (migration `20261104103000_required_items.sql`), `public.intake_answers_present(data)` says which answers an intake holds; the certification gate `public.intake_missing_required` and `public.intake_required_items(data, provenance, verified)` both read it. `intake_required_items` returns the items as `[{ item, label, field, required, state }]`, in order, from its arguments alone. The advisor queue's `missing_required` is the labels of the required items it reports `missing` (a missing census is not listed). `src/data/requiredItems.cases.json` holds the cases both sides are tested against: `supabase/tests/required_items.sql` passes each stored intake straight to the function (and checks that the gate refuses for exactly the required items reported missing), and `src/data/requiredItems.test.ts` loads it as the Chamber does first (`parseChamberData`, `parseProvenance`). The database reads stored values as the browser loads them, state codes and provenance included (`public.provenance_entry_status` mirrors `parseProvenance`; nothing on the server checks `field_provenance` itself), so the two agree on stored intakes, older `employees` rosters too. They can still differ on values the app never stores, most of which the database refuses on write: a state's full name (the browser's sanitiser reads "Oregon" as `OR`), a census row the sanitiser drops, or a `states` string rather than a list.

**Where it shows.**

- In the Review tab, "Still needed" lists the required answers that block certification, in order: missing ones (with a hint) and ones whose answers conflict. "Needs your review" then starts with the required answers given but not settled, as "Incomplete" or "Please confirm", followed by every other field `fieldOpenItems` lists. Each field appears once, and a field an advisor verified is never listed under "Needs your review"; a required answer still not provided, or in conflict, stays under "Still needed" whoever verified it. While only the census names states, the census is the answer to confirm or resolve. The recommended census is listed under "Recommended" while missing.
- The Manuscript's open items start with "<label> — not provided" for each missing required answer and a missing census, then the other open fields less the verified ones (a verified required answer in conflict stays), then the unmet or unverified eligibility checks, census flags and an advisor's follow-ups.
- A row whose field's status is `conflicting` shows a red "Conflicting" chip on the web Manuscript, and the PDF prints it as "<value> (unresolved — see open items)". A row built from several fields (entity structure and FEIN count, exempt and nonexempt counts, retirement, the census counts) takes its chip and marker from any of them that conflicts (`rowProvenance` in `src/data/manuscript.ts`). A field an advisor verified (other than a required answer in conflict, which stays unresolved and listed) is settled, so the Manuscript shows it confirmed and marks it neither way, as the advisor's packet does.
- The Reckoning won't submit while a required answer is missing (US-1.2) or its answers conflict (B-2 D26, "Choose one answer for <label>", after the missing ones; a conflict States of operation only takes from the census names the census). The database refuses both too (EA003, EA008), except the census case, which only the browser checks. The recommended census never blocks.

**Fields an advisor verified.** A field an advisor marked `verified` in `advisor_field_reviews` is settled for the prospect (`verificationSettles`: an inferred, incomplete or conflicting answer; a required answer in conflict still has to be chosen). `public.session_verified_fields(session_id)` returns those field names, sorted, to the intake's owner while they can read the intake (not once it is archived or revoked) and to advisors. Anyone else gets an empty list, and signed-out callers can't call it. It gives the names only: no other review state, note, reviewer or corrected value, and `advisor_field_reviews` itself stays advisor-only. A census review stored under `employees` counts as the census's unless the census has a review of its own. The Chamber asks whenever it loads a row (`useChamberSession`'s `verifiedFields`: opening an intake, Load latest, Discard), and the prospect's Manuscript page when it loads; the advisor's Manuscript uses the reviews the page already has. If the call fails, the Chamber keeps the set it already holds and the Manuscript page counts no field as verified; the prospect isn't told either way.

## Session lifecycle

Migration `20261103090000_intake_lifecycle.sql` (A-1.5). `supabase/tests/intake_lifecycle.sql` and `e2e/intake-lifecycle.spec.ts` cover it.

### When an intake is created

No intake exists until the prospect does something with it (A-1): their first message to Lenore, answer, PEO choice, upload, or voice call. Opening the Chamber, or reloading it, creates nothing; a blank intake with Lenore's greeting is on screen and the address names none. The first change creates the row with that change already in it (`useChamberSession`'s `ensureIntake`, which every change calls and which a message to Lenore and an upload wait for, so the AI call carries the intake id and the file is stored under it). After Start over, or "Start a new intake", the same holds: a blank intake, no row, and the address no longer names the old one.

A person has one open draft at a time: an intake in progress that was never certified. A new intake from the browser is refused while they have one (migration `20261104102000_one_open_draft.sql`, SQLSTATE `EA009`, the open draft's id in DETAIL); a transaction-scoped advisory lock per person makes two simultaneous starts take turns, so the second is refused (checked by hand with two connections; `supabase/tests/one_open_draft.sql` covers the rest). A certified intake changed since is a submission, not a draft, so Start over can begin a new intake beside it. When the Chamber is refused (another tab started first), it offers that intake as it offers a save that another tab beat: "Load latest" or "Keep my changes". A bare `/start` opens the latest open draft, so an ordinary reload or navigation never makes a second.

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

### Deletion

A closed draft (expired, archived or revoked, never certified) is deleted 30 days after it closed
(`public.closed_draft_retention()`), rows and stored files, by the daily retention job and the `purge-intakes`
function. Any intake, certified or not, can be deleted by an admin on request. Migration
`20261104092000_data_retention_and_deletion.sql`; the process, its guarantees and the recipes are in
`docs/DATA_HANDLING.md`.

### Intake consent

Before the Chamber opens, the account agrees to how intake information is used (`src/data/intakeConsent.ts`,
shown by `IntakeConsentGate`). `public.record_intake_consent(version, text)` records it in `intake_consents`
(the wording, the server's time, once per account and version). A browser insert into `chamber_sessions` or
`documents` without an agreement to `public.intake_consent_version()` is refused with `EA004` (DETAIL: the
version needed); a stale version is refused with `EA005`. A new intake records the agreement it was started
under in `chamber_sessions.intake_consent_id`, which the browser can't set. Migration
`20261104090000_intake_consent.sql`; `supabase/tests/intake_consent.sql` covers it.

### The browser's copy of unsaved answers

While a change hasn't been confirmed by the server, the Chamber keeps a copy in `localStorage` (`src/data/intakeBackup.ts`, key `eaa.intake-backup.v1:<user>:<intake>`), with the version it was made on. A confirmed save removes it. When the same person opens the same intake again and the copy differs from what the server has, the Chamber offers it back: "Restore my changes" saves it from the loaded version, or "Discard them". It warns when the intake was saved from somewhere else since. A copy the server already matches (the save sent as the page closed landed) is removed silently.

- The census is never written to the browser (names, dates of birth, pay). A restore keeps the server's census.
- A copy is kept for at most 7 days, is offered only to the user who wrote it, and every copy goes on a deliberate sign-out.
- A copy that isn't the shape written, or breaks the intake schema, is discarded.
- Not covered: answers typed before the intake row was first created (if creating it fails), and storage that is blocked or full. The Chamber warns when the browser won't keep site data at all.

### Getting back from another browser

The intake belongs to the Supabase user that created it. A guest is anonymous until they verify an email (at certification). When a link can't be opened, usually because this browser no longer holds the sign-in (another device, a private window, cleared data), the Chamber explains why and offers to email a sign-in code to the address they verified (`signInWithOtp` with `shouldCreateUser: false`, then `verifyOtp` type `email`). It says the same thing whether or not the address has an account. A guest on a fresh intake gets the same offer ("Continue an earlier intake"). Once signed in, the Chamber drops the blank guest intake and opens the linked intake, or their latest one. An intake that never had an email verified can't be recovered from another browser. The code arrives in Supabase's "Magic Link" email template, which must contain `{{ .Token }}` (`npm run setup:supabase` sets it).

### The transcript

`chamber_sessions.transcript` is the conversation in the order it happened: a list of messages, appended by the browser and saved by the same versioned write as the answers, so a stale tab can't overwrite it (A-2.2). It is the source evidence for the answers Lenore captured: a field taken from chat points at its message by `message_id` (see Provenance above), and advisors read it beside the answers. A message is:

| Key | Kind | Rule |
| --- | --- | --- |
| `id` | text, required | 1 to 100 characters; the `message_id` a field's provenance points to |
| `sender` | text, required | `user` (the prospect), `lenore`, or `system` (a note from the Chamber itself: today "Voice call started" and "Voice call ended") |
| `text` | text, required | at most 20,000 characters; Social Security and bank account numbers are removed before it is kept |
| `timestamp` | text, optional | when it was written, an ISO 8601 instant (`2026-11-04T14:34:05.123Z`). Messages saved before 2026-11-04 hold the browser's local time of day (`02:34 PM`) with no date, and are shown as they are. At most 64 characters |
| `kind` | `"greeting"`, optional | Lenore's hello; only the first is kept |
| `spoken` | boolean, optional | said aloud in a voice call (D33). An answer captured from a spoken message is at most `inferred` until the prospect confirms it |

Nothing else may be in a message. The database refuses a transcript that breaks these rules (`public.chamber_transcript_error`, migration `20261104101000_transcript_validation.sql`) on insert and whenever the transcript changes, with `EA001` and the path (`transcript[3].sender`) in DETAIL, never the text. Existing rows are not re-validated. The browser holds the same limits (`src/data/chat.ts`; `src/data/schemaSync.test.ts` compares them), and what it writes, and what `parseTranscript` reads back from an older row, always fits. A failed extraction never removes the prospect's message: it is added before Lenore is asked.

### Transcript on resume

A transcript is restored as saved, with repeated greetings removed: Lenore's opening line is marked `kind: "greeting"` (older openings are recognised by their words), and only the first greeting is kept. A voice session's own hello is not added again. The panel opens at the latest message without scrolling through the history, marks "Restored from your last visit" after the last restored message, and follows new messages only while the reader is at the bottom (otherwise it offers "New message"). The orb shows Lenore's latest line rather than a separate hello.

