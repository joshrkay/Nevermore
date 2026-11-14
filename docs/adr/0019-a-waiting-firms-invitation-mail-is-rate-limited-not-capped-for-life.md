# A waiting firm's invitation mail is rate-limited, not capped for life

The invitations story (CRM-P1.2) refused a firm waiting for approval its eleventh invitation email for life, counting every first send and resend it had ever caused (`send_count`, withdrawn invitations included). A real firm that was simply waiting, whose invitations had been accepted, was stranded. D-36 reverses that part of D-34; D-34's five pending invitations stand.

- **No lifetime limit.** A waiting firm whose invitations were accepted or withdrawn can invite again.
- **A rate limit instead.** A waiting firm sends at most twenty invitation emails, first sends and resends together, in any twenty-four hours. The twenty-first is refused with a plain message saying when it can send again.
- **Counted from the firm's record.** Each email is one `invitation_sent` entry in the firm's activity record, written in the same transaction as the send, so the limit counts those entries of the last twenty-four hours (the record is kept ninety days). Both limits are read under the firm's row lock, so two owners sending at once are counted one after the other.
- **Both limits end on approval.**

## Considered Options

- **Keep a lifetime count and raise it.** Rejected: any lifetime number strands a firm that is honestly waiting.
- **A counter column on the firm reset daily.** Rejected: a second source of truth beside the record, and a reset job to run.

## Consequences

- The record's retention must stay longer than twenty-four hours; it is ninety days.
- `invitation_sent` entries now also carry the role offered (the same story), so the record and the limit read from one place.
