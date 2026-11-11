# Nevermore

PEO underwriting intake, under the brand Nevermore (nevermorepeo.com), operated by Edgar Allan Advisory. A prospect talks to Lenore in their intake (The Chamber, in code), reviews and certifies their answers on the Certify & sign tab (The Reckoning), and receives a PEO-neutral underwriting packet (The Manuscript). Advisors work the packets that come in.

The code keeps the older names (The Chamber, The Reckoning, The Manuscript) in identifiers, files, routes, database tables, columns and events, and so do the entries below. What a prospect reads uses the names under **Brand and the names prospects see**.

## Language

### Brand and the names prospects see

**Nevermore**:
The product's brand, at nevermorepeo.com: what the app, the emails and Lenore call it. Operated by **Edgar Allan Advisory**, so the Privacy Policy, the Terms of Use and the intake consent introduce it once as "Nevermore, a service of Edgar Allan Advisory". Headlines may use the tagline "Never more back-and-forth."
_Avoid_: Edgar Allan Advisory where the brand is meant

**Edgar Allan Advisory**:
The legal operator of Nevermore: "we" in the Privacy Policy and Terms of Use, the party named in the role disclosure (not a PEO, an insurance carrier or an insurance agency), in the certification statements a prospect signs, and in the copyright. File IDs keep its EAA prefix.
_Avoid_: using it as the product's name in emails, the app or Lenore's lines

**Your intake** (code: The Chamber):
What a prospect calls the space where they talk to Lenore and see their answers fill in (the intake, your intake). The Chamber stays its name in code (`ChamberPage`, `chamber_sessions`, `chamber-extract`).
_Avoid_: The Chamber in anything a prospect reads

**Certify & sign tab** (code: The Reckoning):
The workspace tab, labelled "⑩ Certify & sign", where the prospect certifies. The Reckoning stays its name in code (`ReckoningTab`). Tab ⑧ is "⑧ Review".
_Avoid_: The Reckoning in anything a prospect reads

**The packet** (code: The Manuscript):
What a prospect calls the underwriting document they download and send to PEOs (the packet, your packet). The Manuscript stays its name in code (`ManuscriptPage`, `buildManuscript`) and in the entries below.
_Avoid_: The Manuscript in anything a prospect reads

### People

**Employer**:
The company whose employees are in the census and that would join a PEO. It, not whoever filled in the intake for it, takes a quote or walks away.
_Avoid_: company (on its own), client, customer

**Prospect**:
The person who gives the answers and certifies them for an employer: the employer's owner or someone acting for it, such as its CFO.
_Avoid_: user, customer, client, guest (a guest is only a prospect who hasn't verified an email yet)

**PEO**:
A professional employer organization: a company that co-employs the employer's staff and runs their payroll, benefits and workers' comp. The packet is prepared for PEOs, and each quote request is to one.
_Avoid_: carrier (an insurance carrier is a different business), vendor, provider

**Advisor**:
A member of the advisory team who reviews certified intakes and works them through the pipeline.
_Avoid_: agent, broker, reviewer

**Lenore**:
The AI intake assistant the prospect talks to, by text or by voice: "Lenore, the intake assistant at Nevermore". One persona, whichever mode is used: warm, quick, a little informal, in plain words and short sentences, never jokey about the prospect's data.
_Avoid_: the bot, the agent, the model, or "the assistant" in place of her name

### The intake

**Intake**:
One prospect's whole set of answers for one company, from first message to certification.
_Avoid_: session, intake session, Chamber session, file, application

**The Chamber**:
The space where the prospect talks to Lenore and sees their answers fill in. Its name in code; a prospect reads "your intake" (see **Your intake**).
_Avoid_: the workspace (the workspace is the tabs inside The Chamber)

**Field**:
One underwriting question the intake can hold an answer to, such as company legal name, pay frequency or the census.
_Avoid_: attribute, property, key

**Census**:
The list of the employer's employees, one row per person, with the facts underwriting needs about each.
_Avoid_: roster, employee list, employees

**PEO census layout**:
A PEO's own column layout for a census, so the certified census can be sent in the shape its underwriters read. Columns the intake doesn't collect are left blank and named. A PEO whose layout isn't held gets the census template's own layout.
_Avoid_: census template (that is our own layout), census format

**Employee**:
One person in the census.
_Avoid_: census row, worker, member

**Dependent**:
A spouse, domestic partner, child or other person covered through an employee in the census.

**Workspace answer**:
A field Lenore never asks for in conversation, because the prospect enters it on a workspace tab: the FEIN, the NAICS code and every table. Lenore says which tab it is on, and takes what the prospect volunteers of one where the conversation can hold it. The FEIN is the exception: it is never taken from the conversation or from a document.
_Avoid_: manual field, typed answer, offline field

**Table**:
A field whose answer is rows rather than one value: the legal entities, the owners and officers, the loss history, the current medical plans and the state unemployment tax rates. What is heard or read later is added to a table, never traded for it.
_Avoid_: list of rows, grid, roster (the roster is the census)

**FEIN**:
The employer's federal employer identification number, nine digits. The prospect, the advisors and the packet see all nine; everything else sees the last four.
_Avoid_: EIN (in the app's own words), tax ID, TIN

**Required field**:
A field an intake needs before it can be certified: company legal name, states of operation and pay frequency (D2). The census is recommended: it can only come from an upload, so it never blocks, though Lenore points to the Upload tab for it. (The intake schema's `x-intake.required` still marks the census, for Lenore's ask order.)
_Avoid_: core item, required for submission, mandatory field

**Recommended field**:
A field that is not required but strengthens the Manuscript. Each has a rank, and Lenore asks about them in rank order after the required fields, the census first.
_Avoid_: optional field, nice-to-have, priority field

**Ready to certify**:
An intake is ready to certify when every required field holds an answer that isn't in conflict or incomplete (an inferred answer counts; states also count from the census's work states). "Not known yet" or "Doesn't apply" can't stand in for a required answer, because certification needs the answer itself. Lenore says so once and keeps going with recommended fields; the prospect can certify before or after. One rule, `readyToCertify` in `supabase/functions/_shared/followUp.ts`, used by the Chamber and by `chamber-extract`.
_Avoid_: ready for review, complete, done, discovery complete

**Open item**:
Something the prospect still owes on an intake: a required field with no answer, or any field that is inferred, incomplete, conflicting or unknown. Four things are open items though they are not a field's status, and none of them ever blocks certification: a missing census, a fact PEOs ask of every employee that people on the census lack (once per fact, however many people lack it), employees with no workers' comp class code, and a state of operation with no unemployment tax rate (once per state). A recommended field with no answer is otherwise not an open item.
_Avoid_: gap, missing item, to-do, issue

**Eligibility check**:
A test of the intake's answers against what a PEO accepts, such as its minimum headcount, the states it serves, or the workers' comp class codes it excludes (how a PEO's industry exclusions are compared, since the intake's industry is free text). It passes, fails, or can't be told yet: it can't be told until the PEO's own materials have been checked for that fact. A failed check is a warning, never a reason to hide or rule out a PEO. It is not an open item.
_Avoid_: requirement, open item

**Advisor follow-up**:
A field an advisor has marked as needing more from the prospect. It belongs to the advisor's review, not to the prospect's open items. It reaches the prospect only through an information request, which starts out naming the fields marked this way.
_Avoid_: open item, flag

**Information request**:
An advisor's message asking the prospect for more, naming the answers it is about (or none, for something no answer holds, such as a document). Sending one emails the prospect, shows it in The Chamber with "Your advisor asked about this" on each answer it names, has Lenore ask about those answers first, and moves the pipeline stage to information requested. Certifying again answers it, as does the advisor moving the stage on. The record of each is kept with the intake and never changed.
_Avoid_: follow-up, RFI, query

**Quote request**:
One PEO's handling of one submission, from when an advisor sent it the packet until that PEO quotes, declines or the request is closed. A submission has at most one per PEO; sending a newer packet version to the same PEO continues it. Advisors record it after acting outside the product, and the product sends nothing to the PEO. The prospect never sees it.
_Avoid_: quote (a quote is what a PEO returns on a quote request), submission, RFP, deal

**Quote**:
What a PEO returns on a quote request when it offers to take the employer on: when it arrived, when it expires, the proposed start date and the headline admin fee per employee per month, with the advisor's note. Recorded by an advisor and seen only by advisors.
_Avoid_: proposal, offer, pricing

**Needs advisor action**:
A submission an advisor has marked because someone on the team has to act on it, with an optional note saying what. It shows on the queue, which can list only these, until an advisor clears it, and stays through pipeline stage changes. It belongs to the whole submission, where an advisor follow-up belongs to one field, and the prospect never sees it.
_Avoid_: flag, flagged, follow-up flag

### Talking with Lenore

**Transcript**:
Everything the prospect and Lenore have said in an intake, typed or spoken, in order, with The Chamber's own notes such as a voice call starting. Prospect-facing copy may call it the conversation.
_Avoid_: chat, chat log, conversation history, messages

**Voice call**:
A spoken conversation with Lenore, from when it connects until it ends. An attempt that never connects is not a call.
_Avoid_: voice session, voice mode

**Dropped call**:
A voice call that the connection ended, rather than the prospect or Lenore.
_Avoid_: disconnect, hang-up

### Certifying and what it produces

**Certification**:
The prospect's signed statement that the intake's answers are true, made in The Reckoning. Changing an answer afterwards withdraws it, and the intake is certified again.
_Avoid_: submit, signing, sign-off, attestation

**Submission**:
An intake that has been certified at least once. Certifying changed answers updates the same submission rather than creating another. Every submission is one the advisory team works; there is no separate qualifying step.
_Avoid_: lead, submission record, qualified submission, packet, application

**The Manuscript**:
The underwriting document rendered from a submission, for the prospect to send to PEOs. Advisors can render further versions of it. Its name in code; a prospect reads "the packet" (see **The packet**).
_Avoid_: report, PDF, proposal

**File ID**:
The identifier of one intake, such as EAA-2026-0042, shown in the app, on the signed Manuscript and in every email about it. The database assigns it from a per-year sequence the first time the intake is certified, and it never changes after that; no two intakes share one, and a draft has none. Intakes certified before then keep the File ID they were given, such as EAA-2026-1A2B3C4D.
_Avoid_: reference, submission reference, submission ID, file number, case number

**The Reckoning**:
The last step in The Chamber, where the prospect certifies. Its name in code; a prospect reads "the Certify & sign tab" (see **Certify & sign tab**).
_Avoid_: checkout, submit page

### Communications

**Advisor Alert**:
The email telling the advisory team that a submission arrived or was updated.
_Avoid_: internal notification, new-submission notification

**Confirmation**:
The transactional email a prospect receives after each certification, saying what was received and what happens next. It is a receipt, not marketing, so it needs no opt-in.
_Avoid_: receipt, acknowledgement

**Draft reminder**:
The email a week before an uncertified draft closes, saying when and linking back to it. Sent only to a prospect with a verified email who asked for it ("Email me before an unfinished intake closes", in "Save your progress" or on their profile), and each one says how to stop them.
_Avoid_: nudge, expiry warning

### Advisors

**Advisor Console**:
The advisory team's operating workflow: every submission with its pipeline stage, notes and history. The team works submissions here, not in a separate CRM.
_Avoid_: CRM, admin queue

**Milestone**:
A step an intake reached, recorded the first time it does: started, answered, a document uploaded, a census provided, ready to certify, an email verified, certified, The Manuscript downloaded. A milestone holds the step and its times, never an answer, name or address, and stays (unlinked) when its intake is deleted.
_Avoid_: event, analytics event, conversion

**Funnel**:
The advisors' count, for the intakes started in a period, of how many reached each milestone and how long it took. Each step is counted against the intakes that started, since prospects don't all take them in the same order. The funnel by source counts the same intakes for each intake source.
_Avoid_: analytics, report, conversion rate

**Intake source**:
Where an intake came from: the referral code and campaign tags (source, medium, campaign) of the last tagged link the prospect followed to the site, in the 30 days before the intake started. Each is kept as a short code, never free text. It is set when the intake is created and never changes; an intake started without a tagged link has none. Each milestone keeps it, so a deleted intake still counts for its source.
_Avoid_: channel (a channel is a kind of source, such as referrals or search), attribution, lead source, UTM

**Referral partner**:
A person or firm outside the advisory team who sends employers to the site with a link carrying their own referral code, such as a fractional CFO or an accelerator. Advisors add and name them in the Advisor Console. A referral partner never sees a prospect's answers, only the counts an advisor sends them. A PEO is never a referral partner.
_Avoid_: partner on its own, affiliate, referrer

**Referral code**:
The code in a referral partner's link (`?ref=`), which names that partner in the Advisor Console. It never changes once given, because links carrying it are already out. A code no partner has is still kept, and shows as unlisted.
_Avoid_: promo code, tracking code

### Where an answer came from

**Extraction**:
The answers Lenore takes from one thing the prospect said, typed or spoken.
_Avoid_: parse, capture

**Document candidate**:
An answer read from an uploaded document. It waits for the prospect to apply it, keep their own answer, or choose between the two.
_Avoid_: suggestion, extracted value

**Field source**:
Where a field's current answer came from: something the prospect said (with the message it came from), an uploaded document (with where in it), or the prospect's own action in the workspace. Typed and spoken messages are the same kind of source: when they give different answers, the field is conflicting and the prospect chooses.
_Avoid_: origin, provenance (provenance is the source and the field status together)

**Evidence quote**:
The prospect's own words, from the message an extracted answer came from, that the answer rests on, kept short. Only an answer has one: a field the prospect never answered, or said they don't know, is never quoted.
_Avoid_: source quote, citation

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
A field is settled when it holds an answer that is not conflicting or incomplete, or is marked unknown or not applicable. An advisor's verification settles an unconfirmed answer in Review, the open items and the Manuscript, except a required answer in conflict, which still has to be chosen. Lenore's follow-up does not read verification: she asks about the fields her own rule leaves unsettled.

### Other kinds of status

Always say which kind; never a bare "status".

**Intake status**:
Where the intake stands for the prospect: in progress, submitted (certified), expired, archived (left with Start over) or revoked (closed by an admin).
_Avoid_: status, state, session status

**Pipeline stage**:
Where an intake stands in the advisors' work, from draft through submitted, under review, information requested, ready for market, sent to PEOs and quoted, to won, lost or archived. Advisors move it one step at a time, along the allow-list in `docs/ADVISOR_ACCESS.md`; an archived intake is reopened as submitted.
_Avoid_: status, intake status, workflow status

**Won**:
The pipeline stage of a submission whose employer took one of its quotes, which the submission names.
_Avoid_: closed, placed, converted

**Lost**:
The pipeline stage of a submission whose search ended without the employer taking a quote.
_Avoid_: closed, dead, rejected (a PEO declines; a submission is lost)

**Quote request status**:
Where one PEO's quote request stands: sent (the packet went and the PEO hasn't answered; a quote request in this status is waiting), quoted, declined, or closed (withdrawn, expired, or the employer went elsewhere). A closed quote request goes back to sent when the packet is sent to that PEO again. A question from the PEO's underwriter is noted on the quote request and doesn't change its status.
_Avoid_: status, pipeline stage, quote status

**Also heard**:
An answer Lenore heard for a field from another source than the one kept (a chat answer beside a document's, say, or the value a spoken correction replaced). It is shown under the answer to the prospect and to the advisor, never in The Manuscript, and goes when the prospect confirms or edits the field.
_Avoid_: alternative, rejected value

**Review state**:
An advisor's verdict on one field: verified, incomplete or needs follow-up. Separate from the field status the prospect sees, though a verified field reads as settled to the prospect too ("Verified by your advisor"), except a required answer in conflict.
_Avoid_: field status, status, advisor status

**Audit badge**:
Whose value an answer is, as the advisor's field review shows it: **Prospect confirmed** (the field status is confirmed and nothing replaces it) or **Advisor overridden** (an advisor's correction, verified, replaces it in the advisor Manuscript). An answer that is neither has no badge.
_Avoid_: source tag, approval

**Document status**:
How far reading an uploaded document has got, from uploaded through read to unreadable or failed.
_Avoid_: status, extraction status

## Relationships

- An **Intake** holds one answer per **Field**, a **Census**, and for every captured field one **Field status** and one **Field source**
- An **Employee** in the **Census** has zero or more **Dependents**
- An **Extraction** comes from one prospect message and proposes answers for several **Fields**
- An **Intake** begins with the **Prospect**'s first message, typed or spoken; The Chamber's own notes never begin one
- An **Intake** has one **Transcript**; each **Voice call** adds its spoken lines to it and notes when the call started and when it ended or dropped
- A **Document candidate** comes from one uploaded document and changes nothing until the **Prospect** applies it
- A **Prospect**'s own action always beats an **Extraction** or a **Document candidate** for the same field
- An **Intake** has one **File ID** and any number of **Certifications**; its first **Certification** makes it a **Submission**
- **The Manuscript** is rendered from a **Submission**'s certified answers
- Each **Certification** of new answers produces one **Advisor Alert** and one **Confirmation**; certifying the same answers again produces neither
- Every **Submission** appears in the **Advisor Console**
- A **Submission** has zero or more **Quote requests**, at most one per PEO; each **Quote request** records the version of the **Submission** last sent and holds at most one current **Quote**
- A **Submission** that is won names the **Quote request** whose **Quote** the employer took; its other open **Quote requests** close, as all of them do when it is lost or archived
