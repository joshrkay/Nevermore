# An alert whose named people have all left goes to the current members

D-35 fixes who receives a firm's alert when it is first prepared: the firm's current members at that moment. On a retry, anyone who has since left is dropped, and someone who joined since does not receive that one alert, because rebuilding a message to add them changes its send key and the people who already received it would receive it twice.

That left one case undecided: every person the alert named has since left. The first version of D-35 failed such an alert with `no_recipients` and sent nothing. This amends D-35 on that case only.

- **When none of the people a stored alert named is still a member, the rebuilt alert goes to the firm's current members.** Nobody now in the firm can have received the first attempt, so nobody receives a duplicate, and the firm is told about its intake instead of the event dying on the Outbox page.
- **An alert frozen to the shared inbox** (`ADVISORY_NOTIFY_EMAIL`, before alerts went to members) names no member, so it falls under the same rule and goes once to the current members.
- When at least one named person is still a member, D-35 is unchanged: the alert goes to those who stayed, and a joiner does not receive it.

## Considered Options

- **Keep failing with `no_recipients`.** Rejected: a firm whose people all left, or an alert frozen before alerts went to members, would never be told. The alternative of moving frozen alerts once in a migration was set aside because it does nothing for the all-left case.

## Consequences

- A first attempt that was accepted by the mail provider but never confirmed can reach a current member twice when that member reads the shared inbox it was frozen to. This is the one duplicate the rule admits.
- A joiner can receive an old alert when everyone it named has left. D-35 as first written forbade this; it is the intended change.
- Status: proposed. The founder confirms this reversal; until then the pull request that carries it (the story CRM-P2.1c fixes) is not marked ready.
