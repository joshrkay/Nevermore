# An alert whose named people have all left goes to the current members

Status: accepted. Records D-102, which amends D-35 (rule 6) on one case. D-35's own text is unchanged.

D-35 fixes who receives a firm's alert when it is first prepared: the firm's current members at that moment. On a retry, anyone who has since left is dropped, and someone who joined since does not receive that one alert, because rebuilding a message to add them changes its send key and the people who already received it would receive it twice. D-35 left one case open: every person the alert named has since left.

- **None of the people a stored alert named is still a member: the alert goes to the firm's current members**, rebuilt, with a new send key. Nobody now in the firm can have received the first attempt, so nobody is sent a duplicate, and the firm is told about its intake.
- **An alert frozen to the shared inbox** (before alerts went to members) names no member, so it falls under the same rule.
- **At least one named person is still a member: D-35 stands.** The alert goes to those who stayed, leavers are dropped, and a joiner never receives an alert that still has a stayer.

## Considered Options

- **Fail with `no_recipients` and send nothing.** Rejected: a firm whose people all left, or an alert frozen before alerts went to members, would never be told about its intake, and the event would die on the Outbox page.

## Consequences

- In the shared-inbox case, an alert whose first attempt the mail provider accepted but never confirmed can arrive twice at an inbox that current members also read. This is accepted: the alternative is losing the alert.
- A joiner can receive an old alert when everyone it named has left; this is the intended change.
