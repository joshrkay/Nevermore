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
   - The new value only adds entries to a list, or the field is the `employees` roster. The new value replaces the old one.
5. When the same value is heard again, the source is refreshed. The status can go up from `inferred` to `confirmed`, but never down.
6. Prospect actions (`applyFieldAction`) set the status to `confirmed` and the source to `prospect_edit`, and clear any candidates. Confirming a conflicting field requires choosing a candidate first.

## Extraction contract (`chamber-extract`)

The response is `{ extracted, field_status, evidence, corrected_fields, reply }`. `field_status` and `evidence` are keyed by field name and only cover fields in `extracted`. `field_status` is one of `confirmed`, `inferred` or `incomplete`; only a disagreement makes a field `conflicting`.

## Document candidates (`document-extract`)

Uploads live in `documents`, linked to their intake by `session_id`. RLS requires the caller to own both the row and the intake. The function reads one document as the calling user and writes the result to that row only: `status` and `extraction`.

- `category` is one of `census`, `benefits`, `payroll`, `workers_comp`, `peo_invoice`, `prior_proposal` or `other`. It is suggested from the file name and the prospect can change it. The first four are "still helpful to provide" when missing; none is ever required.
- Stored files sit at `{user_id}/{session_id}/{file}` in the private `documents` bucket. Reading or deleting one requires owning that intake, the same as its row; advisors read through short-lived signed links.
- An interrupted read (`processing` when an intake opens) is shown as `failed` so the prospect can retry it.
- `status` is one of `uploaded`, `processing`, `extracted`, `no_data`, `unsupported`, `encrypted`, `unreadable`, `too_large` or `failed`.
- `extraction` is `{ message, candidates: [{ field, value, location }], applied: { field: timestamp }, extracted_at }`.

Census sheets (CSV/XLSX) are mapped column by column, and their rows never go to the model. Text PDFs and other sheets are read by the model for company-level fields only.

Candidates never change `chamber_data` by themselves. In the Upload tab the prospect can:

- **Apply** a candidate (`applyDocumentCandidates` in `src/data/documentCandidates.ts`). The candidate goes through `applyExtraction` with status `confirmed` and a `document` source, so a prospect's own value is never changed and a different AI value becomes `conflicting`.
- **Replace** an existing value, which is the explicit way to overwrite one. The field becomes `confirmed` with the document as its source.

## Submission

When the prospect signs, `submission.field_provenance` snapshots the provenance alongside `submission.chamber_data`. The Manuscript shows the status and source for each row, and adds the status-based open items to "Underwriting Readiness".
