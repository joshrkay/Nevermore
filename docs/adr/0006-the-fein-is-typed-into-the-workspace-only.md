# The FEIN is typed into the workspace, never taken from chat or a document

Story K-1.1 asked for Lenore to capture the employer's FEIN "from chat and from an uploaded document". We decided against that: the FEIN, and each legal entity's, is a **workspace answer** typed into its own box on the Company tab, and nowhere else. A FEIN is nine digits, and the guard that keeps Social Security numbers out of the transcript and away from the model provider redacts any nine digits in a row; loosening it to let a FEIN through would also let a mistyped SSN through.

So chat extraction has no FEIN field, no document proposes one, a FEIN written with its hyphen (12-3456789) is redacted in chat messages and document text like any other sensitive number, and what Lenore's model is told of the answers so far holds only the last four digits. The prospect, the advisors and the packet see all nine, because a PEO's own form asks for all nine. Lenore never asks for it: she says it goes in the FEIN box on the Company tab.

## Considered Options

- **Lift a hyphenated FEIN out of a chat message in the browser, before redaction.** Rejected: a parser that must never mistake `123-45-6789` for a FEIN, for one field the prospect can type in five seconds.
- **Let hyphenated FEINs through to the model.** Rejected: an SSN mistyped in that shape would reach the provider, which the guard exists to prevent.
- **Mask the FEIN in the packet too.** Rejected: an advisor would retype it into each PEO's form, the typing the story is meant to remove.

## Consequences

- A phone extension or part number written as two digits, a hyphen and seven digits is redacted in chat too.
- When firms other than Edgar Allan Advisory exist (QP-D3), "advisors" above becomes "the prospect's firm".
