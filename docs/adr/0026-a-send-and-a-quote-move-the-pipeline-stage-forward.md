# A send and a quote move the pipeline stage forward

Status: accepted (founder, 2026-11-13, D-10; grilled 2026-11-14, D-411, D-412). Reverses D44's "the pipeline stage stays manual, with a one-click offer of the next step after a first send or a first quote".

## Context

D44 kept the pipeline stage manual: an advisor who recorded a send was offered, in one click, the move to Sent to PEOs, and the same after a first quote. CRM-O1.2 makes an opportunity's stage follow the submission's pipeline stage, and D-10 says the first send moves it to In market and the first recorded quote to Quoted. If the pipeline stage stayed manual, an opportunity would sit at Ready to send while its quotes were out, whenever the advisor skipped the offer.

## Decision

Recording a send while the submission is Ready for market moves it to Sent to PEOs, and recording a quote while it is Sent to PEOs moves it to Quoted, in the same transaction as the record. The rule is the stage the submission is in, not whether the send or quote is the first: D-10 names the first because that is when it usually happens, and a submission put back to Sent to PEOs after a quote moves to Quoted again with the next one. Nothing else moves by itself: a send or a quote recorded at any other stage changes no stage, and no move goes backward. The move is written to the submission's status history like any other, by the person who recorded the send or the quote, with its cause (`quote_send` or `quote_recorded`) and the quote request that caused it.

## Consequences

- The one-click offer for those two moves is removed from the submission's page.
- An opportunity's history can say what moved its stage ("by the send to PEO B").
- An arriving email still never changes a status (PRD 7). Only a person's recorded send or quote does.
