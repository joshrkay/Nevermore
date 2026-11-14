# The owner can reopen a won or lost search

Status: accepted (founder, 2026-11-14, CRM-O1.3, D-288, D-289). Changes the pipeline's moves, under which won and lost could move only to archived.

## Context

CRM-O1.3 says a won or lost opportunity "can be reopened by the owner". Today a won or lost submission can only be archived (`PIPELINE_TRANSITIONS`), and an archived one reopens to submitted, losing where it was. A win recorded on the wrong quote, or a search the employer revives, had no honest way back.

## Decision

`opportunity_reopen` is the only way to reopen a won or lost search. Won goes back to quoted: the quote is no longer chosen, and the placement and the renewal made with the win are deleted. Lost goes back to the stage it was lost from, read from the submission's status history. Quotes the win or loss closed stay closed. The opportunity's record owner or a firm owner may reopen. `set_submission_status` still refuses won to quoted and lost to any earlier stage, and refuses won and lost for a submission on an opportunity, so winning, losing and reopening each go one way.

Reopening a win is refused while its renewal is being worked by an opportunity, or while its placement has commission payments, so no later work or money record is deleted with it.

## Consequences

- The console's stage control offers Won and Lost through the opportunity's dialog, not by itself.
- An account's status follows a reopen without a write, since it is worked out (D-197, D-270).
