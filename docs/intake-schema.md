# Intake schema: field provenance

Each field in `chamber_sessions.chamber_data` (see `src/data/chamberTypes.ts`) has a status and a source. These are stored beside the data in `chamber_sessions.field_provenance` (jsonb, keyed by field name, default `{}`). Fields with no entry have not been captured yet, or were captured before provenance existed.

The model, merge rules and open items are in `src/data/provenance.ts`.

## Entry shape

```json
{
  "status": "inferred",
  "source": { "kind": "transcript", "message_id": "<chat message id>", "quote": "about 40 of us" },
  "updated_at": "2026-10-21T09:00:00.000Z",
  "candidates": [{ "value": 40, "source": { "...": "..." } }]
}
```

`candidates` is present only while the field is `conflicting`.

### Status

| Status | Meaning | Open item |
| --- | --- | --- |
| `confirmed` | The prospect stated it explicitly, or confirmed or entered it in the workspace. | — |
| `inferred` | Lenore derived or assumed it from what was said. | "Please confirm" |
| `incomplete` | Only part of the answer was given. | "Incomplete" |
| `conflicting` | Two sources disagree. The first value is kept until the prospect picks one. | "Conflicting answers" |

### Source

| `kind` | Fields | Produced by |
| --- | --- | --- |
| `transcript` | `message_id` (the `ChatMessage.id` in `transcript`), optional `quote` (≤ 200 chars) | Chat extraction (`chamber-extract`) and voice `<extract>` tags |
| `document` | `document_id`, optional `document_name`, `location` (e.g. sheet/row or page) | A value the prospect applied from an uploaded document (see "Document candidates" below) |
| `prospect_edit` | — | Confirm, Edit, Add, or "Use this" in the workspace |

## Merge rules (`applyExtraction`)

1. Values are validated per field (`sanitizeChamberPatch`). Invalid and empty values are dropped.
2. A field whose source is `prospect_edit` is never changed by AI extraction.
3. A new field takes the value, with the model's status (default `inferred`).
4. If AI sources (transcript or document) give a different value, the old value is kept and the field becomes `conflicting`, with both candidates. Two exceptions:
   - The model lists the field in `corrected_fields`, meaning the prospect explicitly corrected it. The new value replaces the old one.
   - The new value only adds entries to a list, or the field is the `census`. The new value replaces the old one.
5. When the same value is heard again, the source is refreshed. The status can go up from `inferred` to `confirmed`, but never down.
6. Prospect actions (`applyFieldAction`) set the status to `confirmed` and the source to `prospect_edit`, and clear any candidates. Confirming a conflicting field requires choosing a candidate first.

## Extraction contract (`chamber-extract`)

The response is `{ extracted, field_status, evidence, corrected_fields, reply }`. `field_status` and `evidence` are keyed by field name and only cover fields in `extracted`. `field_status` is one of `confirmed`, `inferred` or `incomplete`; only a disagreement makes a field `conflicting`.

## Employee census (`chamber_data.census`)

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

### Never stored

Social Security numbers and bank account details are not stored anywhere. `redactSensitive` (`supabase/functions/_shared/sensitive.ts`) replaces a formatted SSN, a labelled account or routing number, and any run of nine or more digits with `[redacted]` in free-text fields of `chamber_data`, chat messages (before they are stored or sent to the model), evidence quotes and everything `document-extract` reads or returns. Spreadsheet columns headed like an SSN or bank detail (`SSN`, `Tax ID`, `Routing Number`, `Direct Deposit Account` and similar) are never read, and the prospect is told which columns were skipped. The uploaded file is kept as it was, so a prospect can be told to upload a copy without those columns.

## Document candidates (`document-extract`)

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

- **Apply** a value the intake doesn't have yet (`applyDocumentCandidates` in `src/data/documentCandidates.ts`). It goes through `applyExtraction` with status `confirmed` and a `document` source, so a prospect's own value is never changed.
- **Resolve** a value that differs from the intake's, in the conflict dialog. Nothing is pre-selected for a single value: they pick the intake's or the document's, and the one they keep is recorded as `confirmed`. For a census the dialog lists who is in both, whose details differ, who is only in the file and who is only in the intake, and offers **Merge** (the default: people in both take the facts the file stated, new people are added, the rest stay, and everyone keeps their id and dependents), **Replace** with the file's census, or **Keep my census**. A choice is applied by `resolveCandidate`; a kept answer shows as "Kept yours".

## Submission

When the prospect signs, `submission.field_provenance` snapshots the provenance alongside `submission.chamber_data`. The Manuscript shows the status and source for each row, and adds the status-based open items to "Underwriting Readiness".
