# Edgar Allan Advisory

PEO underwriting intake. A prospect talks to Lenore in The Chamber, reviews and certifies their answers, and receives a PEO-neutral underwriting packet (The Manuscript). Advisors work the packets that come in.

## Language

### People

**Prospect**:
The employer, or the person acting for it, who gives the answers and certifies them.
_Avoid_: user, customer, client, guest (a guest is only a prospect who hasn't verified an email yet)

**Advisor**:
A member of the advisory team who reviews certified intakes and works them through the pipeline.
_Avoid_: agent, broker, reviewer

**Lenore**:
The AI intake guide the prospect talks to, by text or by voice. One persona, whichever mode is used.
_Avoid_: the bot, the agent, the assistant, the model

### The intake

**Intake**:
One prospect's whole set of answers for one company, from first message to certification.
_Avoid_: session, intake session, Chamber session, file, application

**The Chamber**:
The space where the prospect talks to Lenore and sees their answers fill in.
_Avoid_: the app, the workspace (the workspace is the tabs inside The Chamber)

**Field**:
One underwriting question the intake can hold an answer to, such as company legal name, pay frequency or the census.
_Avoid_: attribute, property, key

**Census**:
The list of the prospect's employees, one row per person, with the facts underwriting needs about each.
_Avoid_: roster, employee list, employees

**Employee**:
One person in the census.
_Avoid_: census row, worker, member

**Dependent**:
A spouse, domestic partner, child or other person covered through an employee in the census.

**Required field**:
A field an intake needs before it can be certified: company legal name, states of operation and pay frequency (D2). The census is recommended: it can only come from an upload, so it never blocks, though Lenore points to the Upload tab for it. (The intake schema's `x-intake.required` still marks the census, for Lenore's ask order.)
_Avoid_: core item, required for submission, mandatory field

**Recommended field**:
A field that is not required but strengthens the Manuscript. Each has a rank, and Lenore asks about them in rank order after the required fields.
_Avoid_: optional field, nice-to-have, priority field

**Ready to certify**:
An intake is ready to certify when every required field holds an answer that isn't in conflict or incomplete (an inferred answer counts; states also count from the census's work states). "Not known yet" or "Doesn't apply" can't stand in for a required answer, because certification needs the answer itself. Lenore says so once and keeps going with recommended fields; the prospect can certify before or after. One rule, `readyToCertify` in `supabase/functions/_shared/followUp.ts`, used by the Chamber and by `chamber-extract`.
_Avoid_: ready for review, complete, done, discovery complete

**Open item**:
Something the prospect still owes on a field: a required field with no answer, or any field that is inferred, incomplete, conflicting or unknown. A recommended field with no answer is not an open item.
_Avoid_: gap, missing item, to-do, issue

**Eligibility check**:
A test of the intake's answers against what a PEO accepts, such as minimum headcount or industry exclusions. It passes, fails, or can't be told yet. It is not an open item.
_Avoid_: requirement, open item

**Advisor follow-up**:
A field an advisor has marked as needing more from the prospect. It belongs to the advisor's review, not to the prospect's open items.
_Avoid_: open item, flag

### Certifying and what it produces

**Certification**:
The prospect's signed statement that the intake's answers are true, made in The Reckoning. Changing an answer afterwards withdraws it.
_Avoid_: submit, sign-off, attestation

**Submission**:
The answers and their field statuses exactly as they stood at certification, frozen.
_Avoid_: snapshot, packet, application

**The Manuscript**:
The underwriting document rendered from a submission, for the prospect to send to PEOs. Advisors can render further versions of it.
_Avoid_: packet, report, PDF, proposal

**Reference**:
The identifier a submission carries, such as EAA-2026-0042.
_Avoid_: File ID, file number, case number

**The Reckoning**:
The last step in The Chamber, where the prospect certifies.
_Avoid_: checkout, submit page

### Where an answer came from

**Extraction**:
The answers Lenore takes from one thing the prospect said, typed or spoken.
_Avoid_: parse, capture

**Document candidate**:
An answer read from an uploaded document. It waits for the prospect to apply it, keep their own answer, or choose between the two.
_Avoid_: suggestion, extracted value

**Field source**:
Where a field's current answer came from: something the prospect said (with the message it came from), an uploaded document (with where in it), or the prospect's own action in the workspace.
_Avoid_: origin, provenance (provenance is the source and the field status together)

**Evidence quote**:
The prospect's own words that an extracted answer rests on, kept short.

### Field status

Every captured field has exactly one field status.

**Confirmed**:
The prospect typed the answer explicitly, or entered, applied or confirmed it in the workspace. A spoken answer is not confirmed until the prospect confirms it or types it.

**Inferred**:
Lenore derived or assumed the answer from what the prospect said, or heard it spoken, and the prospect hasn't confirmed it.
_Avoid_: guessed, low confidence

**Incomplete**:
Only part of the answer has been given.
_Avoid_: partial, missing (missing means no answer at all)

**Conflicting**:
Two sources give different answers and the prospect hasn't chosen between them. The first answer is kept until they do.
_Avoid_: contradictory, disputed

**Unknown**:
The prospect said they don't know the answer yet. Lenore stops asking; the prospect still owes it.
_Avoid_: missing, blank, TBD

**Not applicable**:
The prospect said the field doesn't apply to them. Only the prospect can mark it.
_Avoid_: N/A as a value, none, skipped

**Settled**:
A field is settled when it holds an answer that is not conflicting or incomplete, or is marked unknown or not applicable. Lenore asks again only about fields that are not settled.

### Other kinds of status

Always say which kind; never a bare "status".

**Intake status**:
Where the intake stands for the prospect: in progress, submitted (certified), expired, archived (left with Start over) or revoked (closed by an admin).
_Avoid_: status, state, session status

**Pipeline stage**:
Where an intake stands in the advisors' work, from draft through submitted, under review, information requested, sent to carrier and quoted, to won, lost or archived.
_Avoid_: status, intake status, workflow status

**Review state**:
An advisor's verdict on one field: verified, incomplete or needs follow-up. Separate from the field status the prospect sees.
_Avoid_: field status, status, advisor status

**Document status**:
How far reading an uploaded document has got, from uploaded through read to unreadable or failed.
_Avoid_: status, extraction status

## Relationships

- An **Intake** holds one answer per **Field**, a **Census**, and for every captured field one **Field status** and one **Field source**
- An **Employee** in the **Census** has zero or more **Dependents**
- An **Extraction** comes from one prospect message and proposes answers for several **Fields**
- A **Document candidate** comes from one uploaded document and changes nothing until the **Prospect** applies it
- A **Prospect**'s own action always beats an **Extraction** or a **Document candidate** for the same field
- A **Certification** produces one **Submission**, which carries one **Reference**; **The Manuscript** is rendered from a **Submission**
- An **Intake** can be certified more than once; each **Certification** produces a new **Submission**
