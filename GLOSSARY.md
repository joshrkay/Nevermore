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
_Avoid_: user, customer, client, guest (a guest is only a prospect who hasn't verified an email yet), and "prospect" for a business (a prospect account is an account's status, see **Account**)

**PEO**:
A professional employer organization: a company that co-employs the employer's staff and runs their payroll, benefits and workers' comp. The packet is prepared for PEOs, and each quote request is to one. The PEOs we list are kept by admins, each with its **Requirement profile**; a PEO is never removed, only marked not listed, after which nothing offers it but what was sent to it still reads. A PEO a prospect or advisor names that isn't listed stays a name in free text, with no profile.
_Avoid_: carrier (an insurance carrier is a different business), vendor, provider

**Advisor**:
A member of the advisory team who reviews certified intakes and works them through the pipeline.
_Avoid_: agent (except the firm role, see **Owner**, **lead**, **agent**), broker, reviewer

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
One underwriting question the intake can hold an answer to, such as company legal name, pay frequency or the census. Every intake asks the same fields; a question only one PEO asks is an **Extra question**, not a field.
_Avoid_: attribute, property, key

**Extra question**:
A question one PEO asks beyond the intake's fields, from its **Requirement profile** in use (up to 30, each answered as text, yes or no, a number, or a choice). The intake asks it only for that PEO: the PEO the prospect chose, or another one an **Information request** names. The prospect answers it in "Questions from <PEO>" or to Lenore, one stored answer each with the same field status and source as a field's, and can always certify without it. An answer belongs to the question as worded when it was given: a reworded question is a new one, unanswered until answered. Answered ones are covered by the certification, with their wording; changing one withdraws it like any answer. The answers go only to that PEO, in its **Supplement**, never in The Manuscript, an email or another PEO's files.
_Avoid_: custom field, supplemental question, PEO question

**Supplement**:
One PEO's own file beside the packet, "Additional questions from <PEO>": its **Extra questions** and the answers in the last certified version, which version that is, the ones not answered, and any answer certified to wording it no longer asks, under that wording. Offered to the prospect for their chosen PEO and any PEO whose questions they answered, and to advisors for every PEO with extra questions. Only that PEO's.
_Avoid_: addendum, rider, PEO questionnaire

**Workers' comp application data**:
Our own PDF, "Workers' compensation application data", of what the last certified version holds that a workers' comp application asks, in the order of the standard application (applicant, locations, owners and officers, the rating table by state, prior carriers and loss history, nature of business, general questions), and which version it is from. It is not the ACORD form and never presents itself as it. Nothing is guessed: whatever the certified answers don't hold is printed "Not in the certified answers", and every blank is counted and listed at its start and beside the download. The rating table groups the certified census by work state and class code, counting full and part time and summing pay only where the census states them. People the census marks 1099 are not employees there: they are left out of the counts and the payroll and shown apart with the pay stated for them; whether any must be rated is for the carrier. The same for every PEO; offered to advisors on each PEO's card and to the prospect beside their packet.
_Avoid_: ACORD 130, ACORD form, workers' comp form

**Answers as JSON**:
The certified answers as one JSON file for a PEO's or advisor's own system: the File ID, the certified version, the certification, and the answers, census included, which validate against the published intake schema, each with its field status as certified. Offered beside the packet to the prospect and to advisors, only while the certification stands. Never a PEO's **Extra question** answers, and never anything an advisor wrote. Its stored data hash identifies the stored record the certification covers; it can't be recomputed from the answers in the file, which are laid out in the schema's order.
_Avoid_: export, data dump, API file

**Bundle**:
One .zip of what a PEO needs, built from one certified version and named for the File ID, the PEO and the version: the packet prepared for that PEO, its census file (in its **PEO census layout**, its **PEO template workbook** filled, or the **Census template**'s layout), the **Workers' comp application data**, its **Supplement** when it asks **Extra questions**, and, for an advisor, the uploaded documents its **Requirement profile** lists that are on file (certified and through the virus check; never a file blocked or not yet checked). A contents page, CONTENTS.txt and the zip's comment, leads with what is missing (each required document not on file and why, any file that couldn't be included, the answers it needs to quote), then names every file, the blanks and the certified version. Offered to advisors on each PEO's card in "What each PEO still needs" and to the prospect for their chosen PEO, whose bundle holds only what they can download one by one, never the documents. Never another PEO's answers, and nothing an advisor wrote. Downloading one is never a send: the advisor is asked, and records it only if they say so.
_Avoid_: package, zip, submission package

**Bundle link** (code: `bundle_links`, `issue_bundle_link`, the edge function `bundle-link`; slice 6.6b, ADR 0003, D-609):
The link an advisor's send gives a PEO instead of attachments: `/b/<token>`, opened with no sign-in, for 30 days. It shows the employer's company name as certified, the File ID and version, the PEO, the day it stops working, each file with its own Download (the advisor's **Bundle** as separate files, plus the certified answers as JSON) and the open items as they stood when it was issued. One is live per quote request; a newer version sent, a withdrawal, the submission closing, the employer withdrawing the PEO or the advisor revokes it. Each download is on the quote request's timeline as "Downloaded <file>, by the bundle link". A link that no longer works shows one page, "This link no longer works", naming nobody.
_Avoid_: share link, download link, portal

**Send to a PEO** (code: `send_to_peo`, `attach_peo_link`, outbox kind `peo_message`, `SendToPeo`; M-2.1, slice 6.6, D-670 to D-679):
An advisor's email to people at one PEO, from their own connected mailbox, carrying their cover note and the **Bundle link**, never files. It creates or continues that PEO's quote request and is on its thread as sent. Under the note is the **Fixed block**.
_Avoid_: submit to carrier, upload

**Update to a PEO** (code: `send_peo_update`, `quote_request_messages.update_from_version`, `SendToPeo`'s `updateFrom`; M-2.3, slice 6.8, D-1610 to D-1619):
A **Send to a PEO** of the latest certified version to a PEO whose quote request is still open (sent or quoted) and holds an older one. It is offered on the PEO's card ("<PEO> has version 1. Version 2 is certified.") and goes only when an advisor sends it, on the same thread. Under the note it says what changed since the PEO's version: each answer by its label and the census by count (added, removed, changed), never a value. Its new **Bundle link** revokes the old one as a newer version.
_Avoid_: resend, revision, amendment

**Quote given on version** (code: `quote_requests.quoted_version`; M-2.3, D-1615):
The certified version a PEO's quote answered. A quoted request stays quoted when an **Update to a PEO** is sent, and reads "Quote given on version 1; version 2 sent since" until the advisor records a new answer (a quote whose dates or fee changed, or a request newly marked quoted). A note alone is no new answer.
_Avoid_: stale quote, old quote

**Send to several PEOs** (code: `SendToSeveralPeos`, `peoLinkIssuer`; M-2.2, slice 6.7, D-1600 to D-1609):
One action that makes a **Send to a PEO** for each PEO the advisor ticks, one at a time: each its own quote request, its own **Bundle link** and its own message, addressed only to that PEO's own contacts, opening with its own greeting ("Hello Dana,") over the advisor's one note. A PEO is **ready** when nothing it needs to quote is missing and no eligibility check is not met; a ready PEO starts ticked, one that isn't starts unticked with what it is missing. A review shows each chosen PEO's recipients, greeting, files and open items before anything goes; one the employer hasn't authorized, or with no contact address, is not sent and the rest go. The result says Sent or Not sent, with the reason, for each.
_Avoid_: bulk send, blast, mass mail

**Choose PEOs** (code: `ChoosePeos`, `SendToSeveralPeos`; slice 5.0y, D-1727):
**Send to several PEOs** as the opportunity's quotes panel places it: the button that, for a certified intake, reads the submission and opens the choosing of PEOs from its last certified answers. Not drawn for a support session or an archived account.
_Avoid_: Send to a PEO (that is one PEO, on the submission's page)

**Close and withdraw** (code: `opportunity_mark_won_and_withdraw`, `opportunity_mark_lost_and_withdraw`, `CloseOpportunityDialog`; slice 5.0y, D-1720 to D-1725):
Marking an opportunity Won or Lost with the one withdrawal note sent, in the same transaction, on the own thread of each PEO still open but the winner. Ticked by default; unticked, it is the plain Won or Lost, and every PEO's **Bundle link** but the winner's stops working either way.
_Avoid_: close with email

**Follow-up** (code: `follow_up_peo`, `FollowUpOrWithdraw`; M-2.4, slice 6.9, D-1620 to D-1629):
An advisor's email to a PEO already sent the bundle, on that PEO's own thread (In-Reply-To and References continue it), from their connected mailbox. It opens with default text kept in code, which the advisor edits, and carries a fresh **Bundle link** to the version already sent under the **Fixed block**, replacing the earlier link. Offered only while the quote request is open, the employer still authorizes the PEO, the advisor has not revoked its link, and the version sent is the one last certified (a newer one is an update, M-2.3).
_Avoid_: reminder, chaser, nudge

**Withdrawal** (code: `withdraw_from_peo`, `quote_requests.withdrawn_reason`; M-2.4, slice 6.9, D-1620 to D-1629):
An advisor's email telling one PEO to set the submission aside, on its own thread, carrying no link. Sending it closes that PEO's quote request and revokes its **Bundle link** (reason withdrawn), and records why, for advisors only: the employer went elsewhere, the prospect withdrew this PEO, the PEO is not a fit, or other. Sending to the PEO again reopens the quote request and clears the reason. Not the employer withdrawing a PEO (M-1.1), which sends the PEO nothing.
_Avoid_: cancellation, decline (a decline is the PEO's answer)

**Closing withdrawal** (code: `close_submission_and_withdraw`; M-2.4, D-1624):
The one **Withdrawal** the Status panel offers when a submission is marked Won, Lost or Archived: written once, sent on the thread of each PEO the move closes that the product sent to, never the winner. The advisor can untick it; the links of every PEO but the winner are revoked either way (reason submission_closed).

**Registration** (code: `peo_registrations`, `register_peo_send`, `peo_registration_statement`, `RegistrationStatement`; Q-2.1, slice 6.10, D-1630 to D-1639):
The record every **Send to a PEO** writes in its own transaction: the firm, the PEO, who the employer is (its FEIN, or its name and headquarters' state where it gave none), the File ID, the version sent and when. It is the firm's proof of when it submitted the employer to the PEO. Nobody changes or deletes one, a platform admin and the table's owner included; it stays when the intake is deleted and when the firm closes. A firm takes the **Registration statement** of its own; no one reads the table itself.
_Avoid_: claim, lock, ownership, protection

**Registration statement** (Q-2.1, D-1636):
A firm's dated CSV of its own **Registrations**, oldest first, from Settings: who it is for and the moment it was taken, then each registration's time, PEO, employer, state, the FEIN's last four digits (never all nine: a file taken out of the product holds no FEIN, D-48), File ID and version. Not offered to a support session.

**Registered elsewhere** (code: `peo_registered_elsewhere`; Q-2.2, D-604, D-1637):
What an advisor is told before a send, on the PEO's card and in the review of a send to several: "Another firm registered this employer with this PEO on Nov 3." It names no firm and never blocks the send. The same employer is the same FEIN where both have one, and otherwise the same name (case, spaces and punctuation aside) in the same state. It answers only for an intake the caller's own firm holds.
_Avoid_: duplicate, conflict, already submitted by

**Fixed block** (M-2.1, D-674):
What the database writes under the advisor's note on a send to a PEO, which the advisor can't edit: the link and the day it stops working, the File ID and version, the open items, the advisor's name, firm and phone, and the draft line from the legal-wording module.
_Avoid_: signature, footer

**Census**:
The list of the employer's employees, one row per person, with the facts underwriting needs about each.
_Avoid_: roster, employee list, employees

**Census template**:
Our own census layout: the columns the census upload reads, offered to prospects as a CSV to fill in, and the layout a PEO's census file takes when the PEO has none of its own.
_Avoid_: census format, PEO template workbook (that is a PEO's own file)

**PEO census layout**:
A PEO's own column layout for a census, so the certified census can be sent in the shape its underwriters read: its columns in order, each filled from one of our census columns or left blank, and the file it takes, CSV or xlsx. Where the PEO wants its own spreadsheet filled in, the layout names its **PEO template workbook** with the sheet, the row its headers are on and the first row of data, and the census is written under its headers, matched by their text, the rest of the workbook kept. Columns the intake doesn't collect are left blank and named before the download. Every file is built from the last certified version and says which. A PEO whose profile in use holds no layout, or a PEO typed in that isn't on the list, gets the **Census template**'s layout. It is part of the PEO's **Requirement profile**.
_Avoid_: census template (that is our own layout), census format

**PEO template workbook**:
A PEO's own blank census spreadsheet (.xlsx) that an admin uploads so the census can be written into it. An upload like any other: scanned before anyone can use it, and only a clean one is used. The rows from its first row of data down to the end of the sheet must be empty, so no employee is ever written over the PEO's own words (a footer, a totals row, a signature line, example rows); one with anything there, or with parts that filling it would lose (charts, pivot tables, macros, slicers, data connections and the like), is refused, saying what is in the way.
_Avoid_: census template (that is our own layout), template file, PEO template

**Employee**:
One person in the census.
_Avoid_: census row, worker, member

**Dependent**:
A spouse, domestic partner, child or other person covered through an employee in the census. Listed in the census file on the rows directly under their employee, told apart by the relationship column; never asked for in chat.

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
A test of the intake's answers against what a PEO accepts, such as its minimum headcount, the states it serves, or the workers' comp class codes it excludes (how a PEO's industry exclusions are compared, since the intake's industry is free text). The rules come from the PEO's **Requirement profile** in use. It passes, fails, or can't be told yet: it can't be told until the PEO's own materials have been checked for that fact. A failed check is a warning, never a reason to hide or rule out a PEO. It is not an open item.
_Avoid_: requirement, open item

**Minimum participation**:
The share of an employer's employees eligible for the health plan who must enrol for a PEO to take it on, as a percentage: 7 enrolling of 12 eligible is 58%. One of a PEO's eligibility rules. It is told only from how many employees are eligible and how many enrol, both given by the employer; until both are, the **Eligibility check** can't be told.
_Avoid_: minimum enrolment, enrolment rate, take-up

**Requirement profile**:
What one PEO asks for, as dated, versioned data: the answers it needs to quote and those it needs only before signing, its **PEO census layout**, the documents it wants, its eligibility rules (each "can't tell yet" until sourced), up to 30 questions of its own, and the **PEO contacts** to deal with. Each eligibility rule and each of those other parts carries its own source, either a document (its title, with a link when there is one) or a named person at the PEO (name and role), and the date it was checked; prospects see such a person by their role alone, never their name. How current a profile is goes by its oldest check: one last checked more than 180 days ago is out of date, and is still used everywhere, with a warning giving that date. A version is a draft until an admin publishes it; publishing freezes it, dates included, and the newest published version is the one in use. A change or a re-check is a new version.
_Avoid_: PEO requirements, PEO rules, appetite, catalog entry

**Complete for a PEO**:
A submission is complete for a PEO when its last certified version holds an answer for every **Field** that PEO's **Requirement profile** needs to quote, and none of those fields is an **Open item** (so a field marked **Unknown** is still needed, while one the prospect marked **Not applicable** counts as answered), every one of its **Extra questions** is answered as worded and isn't an open item, and every document the profile asks for is on file: part of that certification and through the virus check. What the PEO needs only before signing is listed apart and doesn't count. An **Eligibility check** that isn't met is a warning beside it and never changes it. It says only what is on file; whether an advisor may record a send is still the **Pipeline stage**'s rule.
_Avoid_: ready for a PEO, ready to send, ready

**PEO contact**:
A person at a PEO that a **Requirement profile** version names: their name, role, work email and phone. Read by advisors only, never by prospects.
_Avoid_: rep, PEO rep, underwriter (an underwriter is one kind of PEO contact)

**Advisor follow-up**:
A field an advisor has marked as needing more from the prospect. It belongs to the advisor's review, not to the prospect's open items. It reaches the prospect only through an information request, which starts out naming the fields marked this way.
_Avoid_: open item, flag

**Information request**:
An advisor's message asking the prospect for more, naming the answers it is about (or none, for something no answer holds, such as a document) and any PEO's **Extra questions** it asks, each by its PEO and wording. Sending one emails the prospect (the email names no PEO and no extra question), shows it in The Chamber with "Your advisor asked about this" on each answer and extra question it names (that PEO's questions are shown too), has Lenore ask about those answers first, and moves the pipeline stage to information requested. Certifying again answers it, as does the advisor moving the stage on. The record of each is kept with the intake and never changed.
_Avoid_: follow-up, RFI, query

**Quote request**:
One PEO's handling of one submission, from when an advisor sent it the packet until that PEO quotes, declines or the request is closed. A submission has at most one per PEO; sending a newer packet version to the same PEO continues it. Advisors record it after acting outside the product: the product sends nothing to a PEO yet, and an advisor sends from their own mail. Counsel cleared the product sending (QP-D1) on 2026-11-11; it starts when Epic M's sending is built and counsel's wording is in. Each quote request has its own reply address and one **thread**. The prospect never sees it.
_Avoid_: quote (a quote is what a PEO returns on a quote request; only the workspace's screens call the pair a quote, see **Quote** (on the workspace's screens)), submission, RFP, deal (an opportunity is the CRM's word)

**Thread**:
Every email sent and received about one quote request, read newest first on its timeline with its sends, status changes and quote request notes; corrections to the quote request's fields stay in its change log. A submission's threads can also be read together on one combined timeline, each entry naming its PEO. A message the product sends for a broker through their **connected mailbox** lists the reply address first in Reply-To and the broker's own address second, so a plain Reply reaches the thread and their inbox. Mail reaches a thread through the quote request's reply address: the File ID, the PEO's short name and an unguessable part, on a subdomain of nevermorepeo.com. The address keeps receiving after the quote request closes, until the intake is deleted or an advisor revokes and reissues it. A message to it joins the thread whoever sent it, with a sender not seen before marked as new, an automatic reply marked as one, and an advisor's own copied-in email marked as sent by hand. Mail a person at the PEO wrote sets a "new PEO mail" mark, one for the whole team, until any advisor opens the thread. Messages are shown as plain text, and an attachment that fails its malware scan is blocked while the rest of the message stays readable. An arriving message never changes the quote request status. Kept and deleted with the intake; the prospect never sees it.
_Avoid_: conversation, inbox, chain

**Connected mailbox**:
A broker's own Google or Microsoft mailbox, which they let the product send through, so a message to a PEO is from their real address and sits in their own Sent folder. The permission is send only: the product never reads the mailbox, so a PEO's reply reaches the **thread** only through the quote request's reply address, which every such message lists first in Reply-To, with the broker's own address second. A broker connects it when they sign in with Google or Microsoft on the broker sign-in page, which asks for send permission at the same time; the prospect sign-in page never asks. A broker can decline the permission and keeps an account, and then sends from their own mail with the reply address in CC. The product keeps only the token that lets it send, never a password, and deletes it when the broker disconnects or leaves. It can also be connected from any place to write ("Connect your email to write from here") and from the first send, which with none offers Connect Google, Connect Microsoft and, on a send to a PEO only, sending from their own mail with the reply address in CC; each comes back to where they were writing. When the newest send failed for a mailbox reason (the provider took the permission back, or refused the send), the place to write says so with **Reconnect** (CRM-E1.1, D-650 to D-652). Sending through it is built for a **Conversation** with a contact or a lead (the send-mail function, CRM-E1.2a); sending to a PEO through it is built in M-2.1 and, to several at once, M-2.2.
_Avoid_: linked account, email integration, inbox connection

**Quote request note**:
A dated entry an advisor adds to a quote request's timeline for something that happened outside the product, with its kind: a call, a portal entry, an email sent elsewhere, an underwriter's question, or other. It changes nothing else: it never records a send or changes the quote request status, and it can be added to a closed quote request, which stays closed. It can be corrected, and each correction is logged. The quote request's own single note stays beside it, as the request's summary.
_Avoid_: activity, log entry, comment

**Reply address**:
The address a quote request's replies are sent to, `<File ID>.<PEO short name>.<16 hex characters>` at the receiving subdomain. The first two parts are for an advisor to recognise it by; only the last is the secret: 64 bits from the database's random generator, so there are 2^64 addresses for one File ID and PEO, and nothing in it is a quote request's id, a counter or a time. One is live per quote request; a revoked one is never issued again. Mail for an address with no live quote request goes to the **Holding list**.
_Avoid_: inbound address, reply-to token

**Signed link**:
The only way a stored file reaches a browser: a link made for one file at one click by Supabase Storage, lasting 60 seconds, made only if the person asking could read that file under row security, which asks the same current-membership question every table policy asks (a member of another firm, a former or suspended member, a platform admin and a signed-out caller get none). Saved as a download, under the file's cleaned name, and never kept, logged or put in an address. There is no public bucket and no long-lived link to a firm's file. A browser-built object link (a PDF or bundle made in the page) and the mail provider's link to an inbound attachment (followed by a server function, never handed on) are not signed links and are listed as exempt in `src/lib/fileLinks.test.ts`.
_Avoid_: public URL, download URL, share link

**Stored secret**:
A token, key or ciphertext the product keeps for someone, listed column by column in the isolation tests' secrets list: a broker's mailbox refresh token (sealed by the mailbox function with a key only it holds, so the database holds ciphertext it can't read) and an invitation's link secret (kept only as a hash). No policy, view, publication or function returns one to a browser; only the server function that sends reads a mailbox token back. A table added later with a column named like a secret fails the build until it is listed, closed to the API and swept. A linked CRM's token does not exist yet.
_Avoid_: credential, API key (for what a person's mailbox lets the product do)

**Holding list**:
Mail that arrived for a reply address that was revoked or never issued, or that an advisor moved off a thread it didn't belong to. Mail to a firm's own revoked address, or moved off its thread, is **held for that firm**: its current members read it. Mail to an address nobody held belongs to no firm, and so does mail sent to addresses of two firms at once: a message is held for a firm only when every reply address of ours on it belonged to that one firm, whatever else it was sent to (CRM-P2.2). A platform admin, who belongs to no firm, sees only a File ID and a PEO for each (never a sender, subject or text). Only a platform admin assigns a held message to a quote request (of the same firm, if it has one) or discards it; nothing is attached by guesswork. A message nobody assigns is deleted after 30 days, and its sender gets no reply. One ops alert is raised when the list stops being empty.
_Avoid_: unmatched inbox, spam folder, quarantine (quarantine holds files waiting for or failing a malware scan)

**Market authorization**:
The prospect's recorded yes to sending their packet and supporting documents to the PEOs they picked: the PEOs, the wording and its version, who signed and when. Distinct from **Certification** (the answers are true) and the intake consent (how their information is used). It names PEOs, not a packet version, so certifying again leaves it in place. It names only PEOs on the product's list, each one by name: there is no "any PEO my advisor chooses". The prospect can add a PEO or withdraw one at any time, and each change is appended, never edited. An advisor who wants another PEO asks through an information request, and the prospect adds it themselves. No send to a PEO is possible without one. Withdrawing a PEO closes its quote request, revokes its download link, and marks the submission as needing advisor action so an advisor tells the PEO; after that an advisor can still write to that PEO, but with no document or link. A new version of the wording leaves signed authorizations in place. A prospect who accepted the intake consent from before the product sent to PEOs accepts the new one before the authorization is offered. Counsel cleared it (QP-D1) on 2026-11-11 and writes its wording. Built in slice 6.6a (M-1.1, D-620 to D-629): one row per change in `peo_authorizations`, written only by the intake's own employer through `set_peo_authorization`; each PEO's state (authorized, withdrawn, not asked) from `peo_authorization_states`; `peo_authorized` and `assert_peo_authorized` are the database's own check for every send. The employer ticks a box per PEO on Certify & sign ("Which PEOs may receive your packet?") and on their profile ("Who can receive my packet"); the advisor sees "Who may receive the packet" on the submission's page. Its wording, in `src/data/legalWording.ts`, is a draft not yet reviewed by counsel (D-12) (joshrkay/Nevermore#85, #92).
_Avoid_: consent (the intake consent is a different record), permission, release, authorization on its own

**Quote**:
What a PEO returns on a quote request when it offers to take the employer on: when it arrived, when it expires, the proposed start date and the headline admin fee per employee per month, with the advisor's note. Recorded by an advisor and seen only by advisors. The file a PEO attaches is the quote document: it arrives on the thread and is scanned before anyone can open it. When a newer packet version is sent to a PEO that has quoted, the quote request stays quoted and its quote is marked as given on the older version until an advisor records the PEO's new answer.
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
The email telling a firm that a submission arrived or was updated. It goes to the **alert recipients**: the current members of the firm the intake belongs to, looked up each time it is sent, so a member who leaves stops receiving at once. Never another firm's people, a platform admin who belongs to no firm, or a platform-wide list. The new-PEO-mail notice goes to the same people.
_Avoid_: internal notification, new-submission notification

**Confirmation**:
The transactional email a prospect receives after each certification, saying what was received and what happens next. It is a receipt, not marketing, so it needs no opt-in.
_Avoid_: receipt, acknowledgement

**Draft reminder**:
The email a week before an uncertified draft closes, saying when and linking back to it. Sent only to a prospect with a verified email who asked for it ("Email me before an unfinished intake closes", in "Save your progress" or on their profile), and each one says how to stop them.
_Avoid_: nudge, expiry warning

### Firms

**Firm** (code: `firms`):
A brokerage that works intakes on Nevermore, with its own people, its own records and its own address. Edgar Allan Advisory is the first firm: it has every intake that existed before firms did, is approved, and is set to "everyone sees everything". A firm's records are visible to its current members only; the platform `admin` role by itself grants no firm access (D-16); an admin reads a firm only through a membership, as Edgar Allan Advisory's owners do (D-15). An intake started without a firm belongs to Edgar Allan Advisory.
_Avoid_: organisation (the Google domain or Microsoft tenant that lets an advisor sign in), company (the employer), account (a CRM record of an employer)

**Firm address** (code: `firms.address`):
The firm's name in a web address (`name.nevermorepeo.com`): 3 to 40 lower-case letters, digits or hyphens, never starting or ending with a hyphen, unique, and refused when it is a system word (`www`, `app`, `api`, `mail`, `admin`, `status`, `quotes`) or reads as Nevermore or a listed PEO. It chooses what a screen shows; it is never the lock (D-18).
_Avoid_: subdomain, slug, URL

**Firm host** (code: `firmAddressFromHost`, `src/lib/firmHost.ts`):
The firm address read out of the host the app is served on: `name.nevermorepeo.com`, or `name.localhost` for local development and the end-to-end tests. The bare domain, `www` and any other host name no firm and keep today's behaviour; a name with more than one label in front of the domain matches no firm and shows as not found. It only picks what the screen shows (D-17, D-18).

**Firm link** (code: the `x-firm-address` header, `public.keep_intake_firm`, `public.firm_takes_intakes`, `getAQuoteUrl` in `src/lib/firmHost.ts`, `GetAQuote`; slice 5.2, P-2.1, D-1704, D-1713):
The address that starts an intake for a firm: `name.nevermorepeo.com/start`, "Get a quote" on the firm's public page. The intake belongs to the firm that holds the address, which the database works out from the address the browser names on every request, never from a firm id the browser sends. Its first screen says "You were invited by <Firm>" and the agreement says the firm will see the answers (draft wording, D-12). An intake started with no firm link, on the bare domain, belongs to the default firm (D-121). A link starts nothing when no firm holds the address or the firm is refused, suspended, closing or closed (D-1741). A referral partner's link is the firm link with the partner's code (`?ref=`), for every firm, and a code is matched to a partner only within the intake's own firm.
_Avoid_: invite link (an invitation to join a firm or to finish and certify), quote link, public link (the firm's public page, which also offers "Ask to be contacted")

**Firm sign-up** (code: `sign_up_firm`, `/firms/new`):
A signed-in person with a verified email gives a firm name and a firm address and becomes the firm's first owner in one step. The firm exists at once and its members can work, but it is waiting for approval: it cannot send to a PEO until a platform admin approves it (Q-1.2). The address is read as every firm address is (lower case, no surrounding spaces) and the address rules of the table apply. A person has one firm waiting for approval at a time: signing up another is refused until the first is decided (D-30).

**Waiting for approval** (code: `firms.approved_at` empty and `firms.decision` empty):
A firm that has signed up and has no decision yet. A platform admin sees these through `admin_waiting_firms`, oldest first, and no other way (D-16). Each shows who signed the firm up, kept on the firm (`firms.signed_up_by`) when it was signed up: it stays that person if ownership later passes to someone else.

**Firm decision** (code: `admin_decide_firm`, `firms.decision`, `decided_at`, `decided_by`, `decision_note`):
A platform admin's approval or refusal of a waiting firm, with an optional note. Approving sets `approved_at`; refusing leaves it empty. A firm is decided once, and an admin does not decide on a firm they belong to. A refused firm is hidden at its address and its founder is not let in there, yet the address stays taken (D-31). The event is written through `record_firm_event`, the one small function the record of who did what (CRM-P2.3) takes over.

**Suspended firm** (code: `firm_suspensions`, `firm_is_suspended`, `admin_suspend_firm`, `admin_lift_firm_suspension`, CRM-P1.8):
A firm a platform admin has shut for now, with a reason. It is a state of its own, separate from the **Firm decision**: an approved firm can be suspended, a firm still waiting for approval can be suspended and simply gains the suspended state (it stays in the approvals list and can still be decided), and a refused firm already behaves as an address no firm holds (D-31), so suspending it adds nothing visible. While it is suspended the database answers "not a member" for every member of it, so every table policy and every firm-scoped function refuses them as it refuses a non-member (D-18); the firm cannot invite, resend or have an invitation accepted; its alerts are not sent (and one prepared before the suspension is not sent either, D-35); mail addressed to it is still received and stays held. Nothing is deleted: lifting the suspension gives back everything as it was. Only a platform admin who is not a member of the firm suspends or lifts, enforced in the database; a firm's owner cannot lift it. Suspending and lifting are in the firm's record of who did what as done by Nevermore (D-33), and in the platform's own record, `firm_suspensions` (who, when, why, and when and by whom it was lifted), which no firm reads. A firm has at most one open suspension (a unique index, D-29).
_Avoid_: banned, disabled, frozen, closed (closing a firm for good is **Closing a firm**)

**Closing a firm** (code: `request_firm_closure`, `withdraw_firm_closure`, `close_firm_now`, `close_due_firms`, `firm_closures`, CRM-P1.7):
An owner of the firm asks to close it from Settings, after a confirmation that says in plain words what will happen and when and asks them to type the firm's name. Nothing happens at once: for 30 days the firm is a **Read-only firm**, and any owner can withdraw the request until the 30 days end, which leaves the firm exactly as it was. On the day after, a daily job (a step of the one that prunes the firm's record) closes it: the firm's own working data is deleted, every membership is ended (never deleted), a mailbox a person connected only for this firm goes with their last membership, and the firm's address can't be taken by another firm for 12 months from that day. The firm's intakes are not deleted: they belong to the employer who made them and stay for them. Asking and withdrawing are each written to the firm's record, and the firm's owners are emailed for each. A firm waiting for approval can ask; a refused or suspended firm can't. A platform admin can neither ask nor withdraw for a firm.
_Avoid_: delete the firm, cancel the firm, deactivate

**Read-only firm** (code: `firm_is_read_only`, `assert_firm_writable`):
A firm whose owner has asked to close it, until the request is withdrawn (and for good once it is closed). Its members still sign in and read everything, but nothing of the firm's can be changed, added, sent or deleted by a member, at the database: every function that changes a firm's data asks `assert_firm_writable` first, a trigger does the same for a note on an intake, and the two storage policies for generated manuscripts carry the same condition; each refuses a member with "This firm is closing and can't be changed" (code PT423). Every such write takes the firm's row `FOR KEY SHARE` while it checks, and asking to close takes it `FOR UPDATE`, so a request waits for writes already running and later writes see it. This holds for a member who also holds the platform `admin` role, as for any member; a person who is not a member of the firm is not refused by it. What still works: reading, a member leaving, an owner withdrawing, signing in and the firm's record, opening a thread (which only marks it read), and inbound PEO mail. Not the same as a **Suspended firm**, whose members are refused everything.
_Avoid_: frozen, locked, archived

**Closing record** (code: `firm_closures`, `admin_firm_states`):
The platform's record of each request to close a firm: when it was asked and by whom (an id), when it was withdrawn or when the firm closed, the address the firm held, and a count per table of what was deleted. No names and no row content. Closed to the API: a platform admin reads it through the firm list on the Firms page, which shows "Closing on <date>" or "Closed on <date>". The firm never reads it, and by then it has no members to.
_Avoid_: audit log, deletion log

**What closing deletes** (code: `firm_closing_plan`):
The one list of what closing a firm does with every table that holds a firm's data: delete it (and by which column and in what order) or keep it, with the reason. A story that adds a table that holds a firm's data (leads, accounts, contacts, opportunities, custom fields, imports, conversations) adds one line to it, and `supabase/tests/data_isolation.sql` fails until it does.
_Avoid_: retention list, purge list

**Support access** (code: `support_sessions`, `start_support_session`, `end_support_session`, `firm_role` = `support`, CRM-P2.4):
One hour in which a platform admin, who is no member of any firm, can read one firm's workspace at its own address, after giving a reason the firm's owners will read. They read what any member reads, plus the firm's members and its record (what an owner reads there), and no secret an owner is not shown (no mailbox token, no invitation's hash). They do not see pending invitations, requests to join or listed organisations, which are about people who are not members yet. At a suspended firm they read what the firm's own members cannot, because the firm's own people are locked out and support is not. They can change nothing, export nothing, send nothing, open no stored file and are offered no download: that last is a rule of the screens (a person with the rows on screen can still copy them), while the database's rule is that no stored file opens. It starts and ends by the server's clock, one open session per admin per firm, ends when the firm is closed or refused, and the admin can end it early. A suspended firm can be looked at. Each use is in the firm's record as Nevermore's, with the reason and the times, and never who. Not a membership: nobody mistakes it for an owner, lead or agent.
_Avoid_: impersonation, login as, god mode, support login

**Support session** (code: `support_sessions`):
The platform's record of one use of support access: which Nevermore person (id and email, for the platform alone), which firm, why, when it started, when it was to end, and when and how it did end (`ended`, `ran_out`, `firm_ended`, or `became_member` when the admin joined the firm during it). Closed to the API: platform admins read it through the Firms page, and the firm's owners read the reason and the times, never who, in Activity.

**Nevermore support** (the role shown in the workspace menu while a session is open):
What the workspace calls the person on a support session, in the place of Owner, Lead or Agent. The workspace shows a banner on every page: "Nevermore support: you are looking at <firm>. You can't change anything. Ends at <time>.", with "End now".

**Suspended screen** (code: `FirmAddressGate`, `my_suspended_firm_at_address`):
What a current member of a suspended firm sees at the firm's address: "<Firm name> is suspended", to contact Nevermore, and a working sign-out, and nothing of the firm. The firm's name and sign-in still show before sign-in, as for a waiting firm (D-27). `my_suspended_firm_at_address` answers true only for a current member of that firm, so no one else learns a firm is suspended.

**Firm states list** (code: `admin_firm_states`):
Every firm with its approval state (waiting, approved, refused), whether it is suspended and, for a platform admin only, since when and why. It is what the Firm approvals page's "Every firm" section shows.

**Public firm name** (code: `firm_public_name`):
What a firm's address shows before anyone signs in: the firm's name, and nothing else, for any firm that exists and is not refused, approved or still waiting for approval (a waiting firm's members can work before approval; approval gates sending, not signing in). An address no firm holds, or one a refused firm holds (D-31), gives nothing, and it shows a plain not-found page to everyone, with no sign-in and no sign-in callback pages (D-27). Firms have no logo field yet.

**Not a member screen**:
What a signed-in person sees at a firm's address when they are not a current member of that firm: "You aren't a member of this firm", a way to sign out, and nothing else, whichever firm they do belong to. `is_member_of_firm_address` answers about the caller only, and false for a refused firm's address. The database, not this screen, refuses them the data (D-18).

**Address narrowing** (code: `x-firm-address`, `address_admits_firm`):
At a firm's address the browser names the address on every request to the database, and the membership helper (`firm_role`, so `is_firm_member` and every firm rule built on it) then answers only for the firm that holds that address (D-40, ADR 0016). It only narrows: membership is still the lock (D-18), so another firm's address, an address no firm holds or a refused firm's address shows nothing, and a header anyone can send grants nothing. A request with no address (the bare domain, the service role, a scheduled job) is answered as before. The list of a person's own firms (`my_firms`) is not narrowed.
_Avoid_: firm switcher, firm context (no firm is put in the session or the token)

**Choose a firm** (code: `ChooseFirmPage`, `/choose-firm`):
What a member of several firms sees on the bare domain: their firms, each a link to that firm's address, where they sign in (a session belongs to one address). It only shows the way; it opens no firm's records.

**Session per address**:
A sign-in belongs to one firm address: the browser keeps its session per origin, so signing in at one firm's address does not sign the person in at another's, and the provider sends them back to the address they started from. A person in two firms signs in to each. Signing out on a firm's address ends only that address's session; on the bare domain and www it is a plain sign-out that ends every session of that person, as before (D-27). If a session exists at an address no firm holds, the not-found page carries a sign-out.

**Visibility** (code: `firms.visibility`):
A firm's setting for who sees its records: `by_level` (an agent sees what they own, a lead their team's, an owner everything) or `everyone` ("everyone sees everything"). A new firm sees by level.

**Parent firm** (code: `firms.parent_firm_id`):
A firm's optional parent firm (D-6). Stored only: no rule, policy, function or screen reads it.

**Team** (code: `firm_teams`):
A named group inside one firm, with an optional parent team of the same firm and a lead. No screen shows teams until CRM-X1.1 (D-20).
_Avoid_: department, office

**Membership** (code: `firm_memberships`):
A person's place in a firm, with a role, an optional team and the dates it began and ended. It is never changed: a change ends one row and adds another, so who could see a record on a given day can be answered. A person holds one membership of a firm at a time, and a firm always keeps at least one current, unsuspended owner. A **current member** is one whose membership has begun and not ended; `is_firm_member` and `firm_role` answer for the caller.
_Avoid_: seat, user (for a member)

**Removing a member** (code: `remove_member`):
An owner of the firm ends a member's membership now. The membership is dated and kept, never deleted, so who could see what on a given day can still be answered. The person stops seeing or changing anything of the firm at once, through every table policy and every firm-scoped function, and stops being told the firm's alerts, a retried alert included (D-35). Their sign-in is kept; at the firm's address they see "You aren't a member of this firm" (D-27). What they created stays with the firm. A mailbox they connected is deleted when their last current membership anywhere ends. Pending invitations they sent stay valid, and they can no longer manage them. Only a current owner of that firm can do it (D-18), never a platform admin who is not a member (D-16), and not to oneself (leaving is CRM-P1.6). The firm's last owner cannot be removed, even when two owners remove each other at the same moment.
_Avoid_: delete a member, deprovision, kick

**Leaving a firm** (code: `leave_firm`):
A current member, of any role, ends their own membership now, from Settings, after a confirmation that says in plain words what happens. It is the same ending as **Removing a member** (one internal function, `end_membership_now`, which both call): dated and kept, never deleted; they stop seeing the firm and stop receiving its alerts at once, through every policy and function; a mailbox they connected is deleted when it was their last current membership; what they created stays with the firm; invitations they sent stay valid, as when someone is removed (ADR 0016). Their sign-in is kept: signed in, they see "You aren't a member of any firm", or at the firm's own address "You aren't a member of this firm", and the firm left is still that address's firm. It is written to the firm's record as its own kind, `member_left`, with the person as the actor (acting as a member, so a platform admin who also belongs to the firm is shown as themselves, D-33), and queues the **Owners' leaving notice**, all in the one step: a leaving that cannot be recorded or told does not happen. The last owner of a firm cannot leave (the rule of **Removing a member**), and is told so in words that say what to do. Only the caller's own membership of the named firm: the function names no other person. A suspended member, and any member of a suspended firm, cannot leave: they are not current members (D-107); an owner removes a suspended member.
_Avoid_: quit, resign, delete my account

**Owners' leaving notice** (code: the outbox kind `member_left`, `outbox_owner_recipients`):
The email a firm's owners get when a member leaves: who left (their email address), from which firm, and when (UTC). Nothing else: no role, no reason, no link into the firm's records, nothing the person made. It goes through the same outbox and dispatcher as the firm's other alerts, so it is retried the same way and withheld while the firm is suspended, and its recipients follow the same rule (D-35, D-102): the firm's current owners, looked up when it is sent, fixed at the first preparation, never the person who left. It is the first outbox event that belongs to a firm and not to an intake (`firm_id` set, `session_id` empty), so the advisor's Outbox page, which lists a firm's events through their intakes, does not show it. It is deleted 90 days after it was queued, by the daily job that prunes the firm's record (D-106).

**Suspension** (code: `suspend_member`, `lift_member_suspension`, `firm_member_suspensions`):
A member kept on the firm's list who grants nothing until an owner lifts it. It is stored as the membership ended (so every rule that asks "is this a current member" already refuses the person, with no second condition to forget) plus a suspension record of the role and team to give back; lifting begins a new membership from that moment with them (ADR 0016). At most one suspension is open per person and firm (a unique index, D-29), and a suspended person cannot be added again by an invitation or an insert: only lifting brings them back. A suspended person keeps a connected mailbox stored but cannot use it. A suspended owner does not count as an owner the firm keeps. Removing a suspended person closes the suspension as removed.
_Avoid_: pause, lock out, disabled (a suspended firm is CRM-P1.8's, a different thing)

**First recipients** (code: `outbox_events.first_recipients`):
The addresses an advisor alert was first prepared for, written on the outbox event by the first freeze and never cleared or rewritten, even when the frozen message is thrown away. Every retry sends only to those of them who are still current members; when none is, the alert goes to the firm's current members under a new key (D-35, D-102). Nobody who joined after the first preparation is added.
_Avoid_: frozen recipients (the frozen message is disposable, this is not)

**Mailbox cleanup** (code: `drop_mailboxes_of_former_members`, `lock_mailbox_owner`):
The hourly job that deletes the stored **connected mailbox** of anyone with no current membership and no open suspension, which catches a last membership that ended by reaching its date (no change fires then). Storing a mailbox and every ending of a membership take the same per-person lock first, so concurrent endings or a concurrent store cannot leave a mailbox for a non-member (D-32).

**Members page** (code: `AdvisorMembersPage`, `/advisor/members`, `firm_members`):
The console page where an owner sees the current and suspended members of the firm with their role and state, and removes, suspends or lifts a suspension, each after a confirmation in plain words. It is for the owners of the **current firm**, reached from the console menu. A removed person is not listed; the firm's record says they were.

**Invitation** (code: `firm_invitations`, `invite_member`, `accept_invitation`):
An owner's offer of a place in a firm to an email address, with a role (and, in the database, a team). It is single-use and lasts seven days. It is **pending** until it is accepted or withdrawn; one that has run out stays pending, shown as expired, for an owner to resend or withdraw. Only a hash of its token is stored. An owner of that firm, a current one, alone can make, resend or withdraw it (D-18). Accepting it, as the person signed in with that email (verified), adds a dated membership. At most one is pending per firm and email (D-29). A firm still waiting for approval can invite and be joined, but holds at most five pending invitations until it is approved, and sends at most twenty invitation emails (first sends and resends together) in any twenty-four hours, the next being refused with the time it can send again (D-34, D-36; there is no lifetime limit, and both limits end on approval); a refused firm cannot invite or resend, and a pending invitation to it cannot be accepted (D-34).
_Avoid_: invite (as the noun), request to join (that is joining by organisation, CRM-P1.4)

**Invitation link** (code: `/join#token=...`, `JoinFirmPage`):
The link in an invitation's email, opened at the firm's own address. The secret in it is made by the `invite-member` server function, sent once in that email and never stored, returned or logged. It is in the part after the `#`, which a browser never sends to a server, so no request log and no Referer holds it and no route contains it; the page reads it, removes it from the address bar at once, and keeps it only in that tab until the person has joined. The browser hashes it before asking the database to accept, and gives the database the address it was opened at: the link is accepted only at the address of the firm it belongs to (D-34). A link that is used, expired, withdrawn or replaced by a resend opens nothing and says so in plain words, in the same words whether or not the invited email has an account.
_Avoid_: magic link, invite code, join URL (as if the secret were in the path)

**Listed organisation** (code: `firm_organisations`, `add_firm_organisation`, `remove_firm_organisation`):
A Google domain or a Microsoft tenant that a firm's owner has listed as the firm's own. It is matched on what the provider vouches for, never on the email text: for Google the verified hosted domain, for Microsoft the tenant ID the sign-in was issued by. A free-mail domain (gmail.com and the like) and Microsoft's tenants for personal accounts can never be listed, so nobody with a free account is matched. A firm lists an organisation at most once; two firms may each list the same one, since a listing never makes anyone a member by itself. Only a current owner of the firm lists or removes one (D-18); a refused firm lists nothing, a firm waiting for approval can. Removing one stops later requests matching it and leaves the requests already open. It replaces the platform admin's list of allowed organisations, which gave a person the platform-wide advisor role (retired, D-23).
_Avoid_: allowed organisation (the retired platform list), domain allow-list, auto-join

**Request to join** (shown as **Asked to join**; code: `join_requests`, `ask_to_join_firm`):
A person who is not a member of a firm, signed in at the firm's address from one of its listed organisations, is shown the firm's owners as having asked to join. The database makes it, from the person's own sign-in claims; the browser sends only the firm address it is at (as with an invitation link), which chooses among firms, and names no organisation. A platform admin, a person whose membership of the firm has ended, and a sign-in made with a password are never listed this way. It shows their email, when they asked and which listed organisation vouched. It is **open** until an owner approves it with a role (owner, lead or agent, no team until CRM-X1.1), which makes a dated membership, or declines it. A person has at most one open request per firm (D-29). A declined person is not listed again by signing in again; an owner who changes their mind invites them by email. The person is told, at the firm's address, that they have asked and that an owner must approve them; a person from no listed organisation is told what they were told before and learns nothing about what the firm lists.
_Avoid_: join request (as a code word on screen), pending member, auto-approval

**Resend** (code: `resend_invitation`):
Sending a pending invitation again: a new token replaces the old one, so the old link stops working, and seven days start from now. Used and withdrawn invitations are not resent.
_Avoid_: reinvite

**Send** (the invitation's link, one generation of it; code: the token hash that `record_invitation_delivery` is given):
One link and the email that carries it. A resend makes a new send. How an email fared is recorded against the send it belongs to, and a result for a send that has since been replaced is dropped, so two resends finishing out of order cannot mark the current link delivered when its email failed, or the reverse.
_Avoid_: attempt (that is one try at the mail provider inside a send)

**Unknown delivery** (code: `email_outcome = 'unknown'`):
What an invitation's email is when the mail provider may have accepted it though it did not say so (a network failure, a timeout, most server errors). It is tried once more with the same message and key, which the provider drops if the first was accepted; if the answer is still unclear it is kept as unknown, shown to the owner as "not sure the email was delivered", never as failed, and sending again is described as replacing the first link. The other outcomes are `sent` and `failed` (the provider certainly refused it).
_Avoid_: pending email, soft failure

**Platform admin** (code: the `admin` role in `user_roles`):
A person who runs Nevermore itself: keeps the PEO list and its profiles, reads monitoring, and approves firms. Not thereby a member of any firm (D-16), so the role opens no firm's intakes, notes, quote requests, profiles or files, through a table or through a function; held mail, which belongs to no firm until one is assigned, is theirs to read.
_Avoid_: admin (on its own, where a firm's owner could be meant), super user

**Record owner**:
The member a firm's record (a lead, an account, an opportunity, a quote) belongs to, and so who sees it by level. An intake has none in Epic 1 (D-15): every current member of its firm reads it. Who may change a record also follows level, whatever the firm's visibility: an agent their own, a lead their team's, an owner the firm's, and a record with no owner only an owner. That covers its fields, its owner, archiving, deleting and moving a contact. Adding to a record (a contact, a call, a note, a task) is open to anyone who may see it (D-209).
_Avoid_: assignee, creator

**Visibility helper** (code: `can_see_firm_record(firm, owner)`):
The one question every firm-owned table asks of the caller: may they see a record of this firm that this person owns? Yes for a current member of a firm set to "everyone sees everything"; otherwise by level: an owner sees the firm's, a lead the records of members of their own team (the one on their membership) and of every team under it, an agent their own. A record with no owner, or whose owner has left, is an owner's alone. Anyone who is not a current member of the firm, a platform admin and a guest token included, sees nothing.
_Avoid_: permission check, ACL

**Firm rule** (code: the policies that call `is_firm_member` or a helper built on it):
A row-security or storage policy that requires current membership of the row's firm, reached through the intake or the quote request when the row has no firm of its own. A password sign-in that has not completed a second factor is not a member to it (D-19): `firm_role` asks the same rule as `has_role`, so no firm's data opens without it. Every table that holds a firm's data has one, and the isolation test fails a table that has none. A table of the PEO list, monitoring or the platform's own bookkeeping is declared platform-wide there instead.
_Avoid_: tenant filter, RLS (on its own)

**Alert recipients** (code: `outbox_alert_recipients()`):
The current members of the firm an intake belongs to, whom the Advisor Alert and the new-PEO-mail notice go to. See **Advisor Alert**.
_Avoid_: distribution list, advisory team list

**Held for a firm** (code: `quote_request_messages.firm_id` on held mail):
Held mail that carries the firm its address belonged to, or whose thread a member of that firm moved it off. A held message with no firm is read by nobody. See **Holding list**.

**Firm-scoped function** (code: the `firm_scoped` class of `fn_class` in `supabase/tests/data_isolation.sql`):
A database function that runs as its owner, so row security does not bind it, and reads or changes a firm's data for an advisor or platform admin: the queue, the outbox, the funnel, setting a status, reviewing a field, recording a quote send, a platform admin's deletion request. It asks the firm rule itself, taking the firm from the row it is given and never from the caller: a row of a firm the caller is not a current member of is answered as a row that isn't there (a list leaves it out, a call by id says not found). The role it also asks for, advisor or platform admin, is not what opens a firm's data.
_Avoid_: scoped RPC, tenant-aware function

**Function registry** (code: `fn_class`, `function_gate_problems()` in `supabase/tests/data_isolation.sql`):
The list in the isolation test of every function in `public` that runs as its owner or that the API roles can execute, each classed: firm-scoped (and probed with two firms), platform-wide by design, a person's own, public, service-only, a trigger, or deferred to a named story. It is compared with the database catalogue, never with a function's text, so a new privileged function nobody classed fails the build, as a new table nobody listed does.
_Avoid_: allowlist (the older list of what the API roles may call, which says who may call it, not what it does with a firm's data)

**Owner**, **lead**, **agent** (code: `firm_memberships.role`):
The three roles in a firm (D-5; `agent` is now a code and screen word, see ADR 0011). In Edgar Allan Advisory today's admins are owners and today's advisors are agents (D-15).
_Avoid_: member (as a role), broker, advisor (the platform role in `user_roles`)

**Firm activity** (code: `firm_activity`):
A firm's record of who did what: one row for each sign-in to the firm's console, submission opened, file downloaded, send recorded, export, invitation, removal, support access and membership, role or ownership change, with who did it, when, the kind and the id of the record it was about. Never content: no answer, name, email text or file. Nobody can change or delete a row, an admin included; the daily retention job removes entries after 90 days (D4). A firm's current owners read their own firm's and nobody else does, a platform admin included (D-16). Written only through `record_firm_activity` (server code; no actor argument), `open_submission` (the function that hands a submission to a member: the database writes the opening itself, so a browser cannot report a view it did not make), `record_member_activity` (a browser, for exact pairs of kind and record only, a repeat within 30 seconds being one entry), `export_rows` (an export's own entry, in the same statement as the rows it gives, so a browser cannot report an export it did not make or skip the record of one it did) and, for membership changes, the triggers, which write through the internal `firm_activity_append`. The limit: a file saved from a storage link, or built in the browser (census, JSON, PDF, bundle), and a sign-in are seen only by the browser, so a member can still report one that did not happen; the entry says the person reported it, not that the database served it (the storage service signs the link, outside the database, and cannot write an entry). A membership entry records when the change was made, not when it takes effect: an end given a date in the future is written at once, and nothing is written when the date arrives. All of them take the firm from the record and the actor from the caller's own sign-in; nothing takes either from the caller. An owner reads only after the second factor (D-19), the rule written once in `can_read_firm_activity`. Read a page at a time by a cursor of time and a random key, never by an offset and never by the table's number, which is shared by every firm and so is never given to a reader.
_Avoid_: audit log, access log, activity feed, history (a submission's status history is a different record)

**Export** (code: `export_rows`; the record of it is a firm activity entry of kind `export_made`; story CRM-S3.8b):
Taking a table's rows out of the product: one database function returns the rows and, in the same statement, writes the entry (who, when, which table, how many rows), so the count in the record is the count of the rows given and an export cannot be made without its record (if the entry can't be written the rows are not given). It gives only rows the person may see and only the columns the table lists in `export_table_registry()`, which is today referral partners (any member; the partners page's two 30-day counts are columns, counts only) and the firm's record (owners; filters person, kind and a period `from`/`to`, so a record larger than one export is taken in pieces); never an intake's answers, a census or a FEIN, and never the queue, whose columns are an intake's answers. It refuses a support session first (PT423, D-128), takes the one firm the address names (D-40), and asks a **Fresh sign-in** for a whole table. A closing firm's members can still export, because taking the tables out is the way out of a closing firm and the entry goes to the firm's record, which stays writable (ADR 0023). At most 50,000 rows. The button and the CSV are made from the answer in the browser (CRM-S3.8a). A **Selection** (a list of the records' ids, at most 1,000) is an export of those rows only.
_Avoid_: download (a file saved from a link is `document_downloaded`), data dump, answers as JSON (a different file: see above), report

**Fresh sign-in** (code: `caller_last_sign_in_at`; the refusal is `PT401`):
A sign-in within the last 12 hours, read from the token's own `amr` claim (each way the session was proved, with its time; the latest counts, so a second factor done an hour ago is a sign-in an hour ago). A whole-table export asks for one and answers "Sign in again to export a whole table" without one, or with a token that says nothing of when. A selection by ids does not (CRM-P1.3 names whole tables and member changes; the 1,000-id ceiling and the alert bound a selection).
_Avoid_: re-authentication, recent login, session age

**Export button** (code: `ExportControl`; story CRM-S3.8a):
The control that takes a table out as a file: on the referral partners page (any member) and on the firm's record page (owners). One press asks the database (`export_rows`) for every row that matches the page's filters, not only the page on screen, and makes the answer into a CSV of **the columns the page shows**, in the order it shows them, with the page's headings and its words for each value (the record page's What and Record are the kind and the record as the page words them, never `sign_in` or `referral_partners`; the partners page's link or code). A column the page does not show stays out, and an answer that lacks one the page shows is no file. The partners page has no filter, so it takes every partner; the record page passes its **Person** and **Kind** (its period filter is the database's only, until the page has one). The file is named for the table and the day the database took the rows (`referral-partners-2026-11-19.csv`, `firm-record-2026-11-19.csv`). Afterwards one line says "Exported 42 referral partners." A refusal is said in words and gives no file: more than 50,000 rows says to narrow it with a filter; a support session, a non-owner and a failed call say so. A last sign-in older than 12 hours (a **Fresh sign-in**, PT401) is stepped up **in place** or by signing in again, and the export then runs again with the same filters: a person with an authenticator app types its code in a dialog (a right code gives a token with a fresh proof at the level that opens a firm's data); a person with none is signed out, of this device only, and the page's filters are kept in the address (`person`, `kind`) so the sign-in page, whichever way they sign in, brings them back to the same view. There is no password step, because of D-19: a password sign-in that has not done its second factor opens no firm's data, so asking for the password would swap a working session for a locked-out one. A person on a Nevermore support session is offered no Export (ADR 0024): one plain line, "Downloads are off during Nevermore support.", stands where the button was, and nothing is asked of the database. The firm's record reads an export as "Exported 42 referral partners" (the table's words and the count), never "Table referral_partners".
_Avoid_: download (a file saved from a link is `document_downloaded`), report, backup, re-authentication

**Export file** (code: `exportFile`; story CRM-S3.8a):
The CSV an export is given as, written in the browser from the database's answer and nothing else, so it holds only what the database decided the person may take (never an intake's answers, a census or a FEIN). RFC 4180: CRLF between rows and after the last; a cell with a comma, a semicolon, a quote or a line break in double quotes with its quotes doubled; a yes or no as "yes" or "no"; nothing as nothing; and a byte order mark first so a spreadsheet reads an accent as it was written. What is done against a spreadsheet running a cell as a formula, and no more: a cell or heading whose first character is `=`, `+`, `-`, `@`, a tab, a carriage return, a line feed, or the full-width `＝`, `＋`, `－`, `＠` is kept as text by a leading apostrophe, and a cell with a semicolon is quoted so that a spreadsheet set to split on semicolons does not split it. A value that does not start with one of those characters is written as it is. The census file uses the same writer (`src/lib/csv.ts`).
_Avoid_: dump, spreadsheet (the file is a CSV, which a spreadsheet opens)

**Export alert** (code: `export_alert`, an outbox kind and a firm's alert):
The email to a firm's owners, queued in the same transaction as the export, when one export holds more than 500 rows or when it is the third by one member within an hour (not a fourth: the alert is for the crossing). It says who ("A member" for an account with no email address, so the alert is never lost), which table, how many rows and when, and nothing of the rows, and it needs a sender and nothing else (it has no link into the app). Like the notice of a member leaving it waits while the firm is suspended and a bounce never suppresses an owner's address.
_Avoid_: export notification, data-loss alert

**Record history** (code: `record_history`, read by `record_history_list`):
What happened to one record of a firm's (today a referral partner; later a lead, account, contact or opportunity): who created it and when, and every change to its own fields, each as who, when, the field, the value before and the value after. It holds only the fields a trigger was told to track, named in the migration that attaches `record_history_capture`, so an intake's answers (which keep their own history as today) and a record's created and updated stamps can never enter it. It starts when it shipped: nothing before then is backfilled, so a record made earlier shows its first change as the first entry. Nobody edits it: no API role can write the table, and a trigger refuses every change, every emptying of the table and every deletion except one made by the role `record_history_remover` (no login, no API role belongs to it, read and delete on this table only, ADR 0012), which only `record_history_remove` acts as. That function deletes a record's history once the record is gone, and a firm's while the firm is closing, which `firm_closing_plan()` and `close_firm_now` do; no setting a caller can make allows a deletion, and only a superuser who becomes the role can still delete. `record_history_track` attaches the capture trigger and the guard against emptying the table together, and refuses at attach time a table, key column or field that does not exist. Read by whoever may see the record (for a referral partner, any current member of the firm, and a support session), through the function only, one record at a time, newest first, a page at a time by a cursor of time and random key. It shows who as the member's email, "Nevermore" for a platform admin who was not a member (no name, email or id, D-33) and "System" for the server. An opportunity's history also reads the **Stage change**s of its submission, which are not stored here. A value is stored as it is (text, number, date as ISO text, true or false); a time is stored in UTC in one fixed form whatever the writer's time zone, so the same instant reads the same; no value reads back as nothing, never as the word "null", and a JSON null inside a jsonb column and no value (SQL null) are the same to the history, so changing from one to the other is no change. A record is named by its key within its firm: a single column's value, or for several columns a compact JSON array of the parts, which is what a caller passes as the key.
_Avoid_: audit log, activity (the firm's record of who did what is a different thing: see below), change log, version (D-46's whole-number version is a different thing: see Record version)

**Record version** (code: `version`, raised by `record_version_bump`, attached by `record_track` or `record_version_track`):
A whole number on each editable record (today a referral partner; later an account, contact, lead or opportunity) that says how many times its own fields have really changed, starting at 1. A trigger owns it: it is raised by exactly one when one of the fields the record's history tracks (a partner's name or kind) really changes, and by nothing else, so saving a form without changing it, or changing only a stamp such as when it was saved, leaves it alone. Nobody sets it: whatever a statement writes into it is put back, and a new row is 1 whatever it said. A save names the version it started from (`p_version`); a save that names none is refused. The record's history also says which version each entry produced, so "what changed since version N" is exact. It is the whole-record counter of D-46, not a record's history and not an intake's `schema_version`.
_Avoid_: revision, etag, timestamp (it is not a time), history

**Conflict** (answered by `advisor_update_referral_partner` as `conflict: true`):
What a save is answered with when the record's version is no longer the one the person started from: someone else changed it while they were editing. Nothing is saved. The answer carries the current version, the current values of the editable fields, and for each field whose value now differs from what the person started from, the value now, who changed it last and when. Who is named the way the record's history names people (a member's email, "Nevermore" for Nevermore's own people, "System" for the server), never an id (D-33). It is a normal answer, not an error, and it is only given to someone the save would have let through: a person who is refused (not a member, suspended, a support session, a closing firm) gets that refusal whatever version they send. The partners form opens the conflict dialog on it (see Conflict dialog).
_Avoid_: collision, merge conflict, stale write, error

**Firm activity versus record history**:
Two records, and neither writes into the other (D-45). The firm's activity record says who did what in the firm, with no content, for owners, for ninety days. A record's history says what changed in that record, field by field, with the values, for whoever may see the record, for as long as the record lives.

**Retention role** (code: `firm_activity_pruner`):
The one database role allowed to delete a firm-record entry, and only past the window. It cannot sign in, no API role belongs to it, and only `prune_firm_activity()` runs as it; a delete is allowed by who is running it, never by a setting a caller can make (ADR 0012).
_Avoid_: admin delete, purge flag

**Record cursor**:
Where a page of the firm's record starts: after the entry with a given time and id, the two things the record is ordered by, so an entry arriving between two pages never repeats or skips a row.
_Avoid_: offset, page number (as the way a page is found)

**Owned firm**:
A firm the caller is a current owner of, as the database answers (`my_owner_firms()`). A page that reads a firm's record says which firm it wants, and the database checks the caller currently owns that one; there is no "the caller's firm" for someone who owns two.

**Workspace table** (code: the domain `workspace_table`):
A table of the workspace whose column choices and saved views are kept: today only the submissions queue (`submissions`); accounts, leads, quotes, the inbox and the lists inside a record join the list as their stories ship, one small migration each. A name not on the list is refused.
_Avoid_: grid, list (as the name of the whole thing)

**Saved view** (code: `saved_views`, `save_view`, `list_saved_views`):
A named set of a table's filters, sort and columns that a person keeps, shown as a tab over the table. It belongs to the person who saved it, in one firm: only they rename, change or delete it, and nobody else reads it until a current owner **shares** it with the firm; then every current member reads it and only an owner can stop sharing it (it goes back to its saver, nothing is lost). A shared view is the firm's while it is shared: its saver changes, renames or deletes it only while they are a current owner (an owner made an agent no longer can, until an owner unshares it). An owner shares a view they saved. A view is known by its id, never its name: names are unique per person per table and, among shared views, per firm per table, ignoring case (folded the same on any database), but a person's private view may carry the name of a view someone else shared, so the tabs mark shared views apart. A name has no whitespace around it and no invisible character in it; a person keeps at most thirty per table. A person who leaves the firm reaches none of theirs at once; what they shared stays with the firm until an owner unshares it. Reached only through its functions, never the table.
_Avoid_: filter preset, saved search, report

**View tabs** (code: `ViewTabs`, `ViewMenu`, `SaveViewButton`, `useSavedViewsControl` in `src/components/workspace/table/`; story CRM-S3.4a):
The bar over a table: "All" and each view as a tab (the table's built-in views first, then the saved ones the person may open, oldest first), each tab a link to the address with that view and showing its **view count**; a shared view carries "Shared with the firm". A saved view's tab has an options button offering only what the database says the person may do: rename, delete, share with the firm, stop sharing. "Save this as a view" keeps the filters in force (the open view's own and the chips over it), the sort the rows are in and the columns the person sees, under a name, as their own view, and opens it. A view with a sort of its own opens in that order, and "Back to this view's order" is the way back to it. A saved view the screen has changed (chips over it, a sort of its own) is **changed on screen, not kept**; the person who may change it can keep the change as the view's own.
_Avoid_: view switcher, filter tabs

**Built-in view**:
A view a table ships with (for the queue, today's status tabs), written in the page's code, not kept as a row, so it can't be renamed, deleted or shared. It has no sort or columns of its own: the table's own order applies and its columns are the person's column choice for the table.
_Avoid_: default view (the table's default sort and columns are something else)

**Column choice** (code: `table_preferences`, `my_table_columns`, `set_my_table_columns`):
Which columns a person shows on a table, in what order, kept in the database per firm, person and table, so it follows them to any device (D-43); nothing is kept in the browser. A person may also keep their own choice on a saved view they can read, which wins for them alone. What they see on a saved view is, in order: their own choice for that view, the view's own columns, their choice for the table, the table's defaults.
_Avoid_: layout, column settings, preferences (on its own)

**Columns menu** (code: `ColumnsMenu`, `useMyColumns`, `columnChoice.ts` in `src/components/workspace/table/`; story CRM-S3.1a):
The "Columns" control over a workspace table, where a person shows or hides each column with a box, moves a shown one earlier or later with a pair of buttons, and goes back to the table's usual columns. Each change is kept at once as the person's column choice for the table (no Apply). The **name column** (the table's first, `isName`: the queue's Company) is always shown and always first. On a saved view the same list is the person's own choice for that view, and "Go back to this view's columns" forgets it (CRM-S3.4a); the firm's custom fields join this menu with CRM-X3.1.
_Avoid_: column picker, column settings, customise

**Name column** (code: `ColumnDefinition.isName`):
A table's first column, the one that names the record (the queue's Company). It can't be hidden or moved and no choice can put another column before it (a stored choice that leaves it out or puts it elsewhere is read with it first), and it is **pinned**: it stays in view at the left of the table's scroll box when the table scrolls sideways, in the header and in every row, including the grey rows of the loading state. Its cell is each row's header cell.
_Avoid_: key column, frozen column

**Entry kind** (code: `firm_activity.kind`):
What sort of thing an entry records: `sign_in`, `submission_viewed`, `document_downloaded`, `packet_downloaded`, `send_recorded`, `member_added`, `member_ended`, `owner_added`, `owner_ended`, and the ones later stories write: `export_made` (about a table: its record type is `table`, its record id the table's name, and it alone carries `row_count`; see Export), `invitation_sent`, `member_removed`, `support_access`. Removing a member writes `member_removed`, suspending one `member_suspended` and lifting it `member_restored`, each with who did it and to whom (and instead of, not as well as, the `member_ended` or `owner_added` that ending and beginning a membership would write). A firm's sign-up and its approval or refusal are `firm_signed_up`, `firm_approved` and `firm_refused`, an invitation withdrawn is `invitation_withdrawn` (one made or resent is `invitation_sent`, and one accepted is the `member_added` the membership trigger writes), written through `record_firm_event` with no address and no note. A role change shows as a member ended and a member added; a change to an owner has its own two kinds.

### The broker's CRM

**Account**:
A business the firm quotes for: one of the firm's records, with a **Record owner** or, until one is assigned, none (an account made from an employer's intake or brought in starts with none, D-214). Made by an agent, by bringing an existing submission in (CRM-Q1.3), or when an intake an employer started is first certified (ADR 0025); later also by New quote, by converting a lead and by an import. When it is made from a submission, its empty fields are filled from the certified answers (legal name, address, website, states of operation, employees, industry, current provider), never the FEIN, the census or anything about an employee (ADR 0006); once copied they are the firm's own fields. It is archived, never deleted, while it holds an intake; one with no intake, quote or email can be deleted by its record owner or a firm owner, and its contacts, calls, notes and tasks go with it. Its status is worked out, never set: Prospect until one of its submissions is won, then Client (Former client arrives with the placement record in Epic 4). A prospect account is never the person the glossary calls the **Prospect** (D-208). Its source is set by the product and never edited: Employer's intake (with the referral partner's name when the intake came by a partner's link), Added by hand, and later New quote, Lead and Import (D-211).
_Avoid_: company, customer, employer (the employer is the business; the account is the firm's record of it)

**Making an account by hand** (code: `create_account`, source `added_by_hand`):
New account on the Accounts page, for a person of the firm (never Nevermore support, and never a closing firm). The **Record owner** is the person who made it unless they choose another, and what they may choose follows the level rule of **Record owner**: an agent only themselves, a lead themselves and the people on their teams, an owner anyone currently in the firm, so nobody makes a record they could not then change. Its source is Added by hand. The same name, website or contact email as another account is never refused: a likeness is a warning (CRM-S4.2), not a rule. A **Phone** is 10 to 15 digits with only spaces, brackets, dots and dashes between them and an optional extension ("x12"); the form and the database ask the same rule. On save the new account opens. The renewal date and the firm's own fields come with renewals and custom fields (D-186).
_Avoid_: add an account (the button and the screen say "New account")

**Selection**:
The rows a person has ticked on the accounts table (CRM-S3.6), shown in a bar of the table's bulk actions with "Clear". It is either a list of rows, held across pages and through sorting and refreshes, or "every row that matches" the filters in force, which holds no list: a later bulk action takes it as the filters, and the database counts again when it runs. It belongs to the view, filters and search on screen, and changing any of them ends it.
_Avoid_: checked rows, bulk selection

**Contact**:
A person at an account, on exactly one account, with a name and an email or a phone. Seen by whoever may see its account. An account has at most one main contact (**Adding a contact**, **Moving a contact**). The prospect of a submission becomes one when its chain is made: the contact keeps a link to that prospect so they are never added twice to that account (the same prospect can be a contact on two accounts, one each), and their name, email and phone are copied once and not kept in step, because the contact is the firm's record and the profile is the person's.
_Avoid_: PEO contact (a person at a PEO), prospect (the person who certifies; a prospect becomes a contact and the two stay separate records), lead

**Conversation** (code: `conversations`, `conversation_messages`; story CRM-E1.2, D-601, D-606):
The mail a firm has with one **Contact** or one **Lead**: one conversation per person, shared by the firm, made with the first message anyone writes to them. It has its own **Conversation address** and holds each message, both ways once replies are read (CRM-E1.3). It is seen by whoever may see the record (the level rule, as calls, notes and tasks are), so a contact's conversation follows the contact to another account; it goes when the account or the lead goes. A message is written to one person, from the writer's own **Connected mailbox**, with at most 10 in CC; it is recorded as queued before anything is sent, then sent (with Google's id, or for Microsoft our own Message-ID) or failed with why in words. Never to a contact marked Do not email, to a lead in the bin or converted. A file goes with a message only as a **File link** (D-605). Kept apart from a quote request's **thread** with a PEO. A reply to its **Conversation address** joins it, whoever sent it (CRM-E1.3): marked automatic when a machine wrote it, **sent by hand** when one of the firm's own people copied the address in, and from a **new sender** when no earlier message was from or to that address. Each file on a reply is scanned as PEO mail's are, and one that fails is blocked while the rest stay readable. A message is stored once and read on the contact, the account and the account's opportunities (or the lead). A conversation with mail from a person since anyone in the firm last opened it is **new**, one mark for the whole firm, cleared when anyone opens it.
_Avoid_: thread (a quote request's mail with a PEO), email log, inbox (CRM-E1.4's view of all of them)

**Place to write** (code: `PlaceToWrite`, `EmailAContact`; story CRM-E1.2, slice 6.3):
Where an agent writes to a **Contact** from the product: on the contact's page, and through Email on an account's page (which first asks which contact; on an opportunity, its main contact first). It shows the **Conversation** newest first, sent and received, and a subject and a message, sent from the agent's **Connected mailbox**; Reply names the message answered. It says "No emails yet" when there are none; with no mailbox it is replaced by "Connect your email to write from here"; for a contact marked Do not email, or with no email address, it says so and offers nothing. What was written is kept across the trip to Google or Microsoft to connect.
_Avoid_: composer, email form

**File link** (code: `conversation_message_files`, `conversation_file_open`, the edge function `message-file`, the page `/f`; slice 6.3, D-605):
How a file goes with a message to a contact: never as an attachment, always as a link that stops working 30 days after the message was sent. Only a file from the contact's own account's files, past the virus check, that the agent may open, can go, so a census goes only to its own employer; the database refuses any other. The token is made each time the message is built to be sent and only its hash is kept; it is after `#` in the link, so no request to the site carries it. The file is checked again at each download, and each download is logged. Wrong guesses count against the same hourly limit as a **Bundle link**'s.
_Avoid_: attachment, shared link

**New sender** (code: `conversation_messages.new_sender`; story CRM-E1.3):
Someone who writes to a **Conversation** and was not on it before: no earlier message was from them, to them or copied to them. Never an automatic reply or the firm's own copy. On a contact's conversation, a new sender who is not yet a contact on that account is offered as one, and an agent adds them with Add as contact (`add_sender_as_contact`, through **Adding a contact** and all its rules). A lead's conversation offers nothing: a lead has no account (D-662).
_Avoid_: unknown sender, stranger

**Sent by hand**:
A message one of the firm's own people sent from their own mail, outside the product, with a **Conversation address** (or a quote request's reply address) in To or CC. It comes back like any reply and is kept as theirs: never new mail and never a **New sender**. On a conversation they are known by their sign-in address or their **Connected mailbox**'s, while they are a current member of the conversation's firm.
_Avoid_: copied-in mail, BCC

**Conversation address**:
A conversation's own reply address, `c.<the business or the name, shortened>.<16 random hex characters>` at the receiving subdomain, issued with its first message and never reused. The `c.` prefix can't be a File ID, so it never reads as a quote request's **Reply address**. Every message lists it first in Reply-To, with the writer's own address second, so a reply reaches both the record and the writer's inbox. The receiving function looks an address up among both kinds (CRM-E1.3): mail to one that belongs to no record, a conversation deleted with its account included, goes to the **Holding list**, as does mail to two conversations' addresses at once.
_Avoid_: reply token, inbound address

**Inbox** (code: `inbox_list`, `inbox_view_counts`, `/inbox`; story CRM-E1.4, D-607, D-690 to D-699):
The workspace page that lists every message, both ways, on the PEO **thread**s and the **Conversation**s a person may see, newest first: who it is from, what it is about (the contact, lead or PEO, and the account, each linked), its first line, its kind (from or to a PEO, a contact or a lead) and when. Views: All, New, From PEOs, From contacts and leads, Sent; filters by owner and by account; a search of the sender, the subject and the account, never the body. Opening a message opens it on its record (a contact's page, a PEO thread's submission, or for a lead the Leads page searched to it) and clears its thread's **new** mark for everyone. It lists only the product's own threads: it never shows, reads or searches anyone's mailbox. The menu's Inbox number is the threads with new mail it lists. Not the queue's "has new PEO mail" filter, which stays the queue's.
_Avoid_: mailbox, email client, unified inbox

**Adding a contact** (code: `add_contact`; story CRM-A2.2, screen 24):
Add contact on an account's Contacts panel or tab, and "Save and add a contact" on New account, for anyone who may see the account (D-209) and never on an archived account, for Nevermore support or in a closing firm. The account is filled in. A contact needs a last name and an email, a phone or a mobile; the phone and the mobile follow the same rule as an account's **Phone**. The **Record owner** of the contact is the person who added it unless they choose another, by the same level rule as **Making an account by hand**. "Save and add another" saves and starts an empty form on the same account. An email already on another contact is a warning (CRM-S4.2), never a refusal.
_Avoid_: create a contact, new contact

**Moving a contact** (code: `move_contact`; story CRM-A2.2, D-209, D-233):
Move on a contact of an account, to another account of the same firm. It takes three yeses by the level rule: the contact (its record owner's level), the account it leaves and the account it joins, each also one the person may see; an archived account cannot be joined. The contact's calls, notes and tasks go with it in the same step. A call, note or task that also names an opportunity of the account the contact leaves cannot stay on both accounts: it goes with the contact and loses its link to that opportunity, and a contact that was an opportunity's main contact stops being it. The person is asked first, in words that count them, and nothing changes until they agree. A main contact arrives as nobody's main contact: it never takes the place of the main contact of the account it joins. Its history has one entry for the move.
_Avoid_: transfer, reassign (that is changing a record owner)

**A contact's page** (code: `contact_page`, `contact_activity`, route `/contacts/:id`; story CRM-C1.1, screen 18; D-186, D-209, D-222):
The page a contact's name opens, from an account's Contacts panel and tab and from a row of its calls, notes and tasks. It shows who they are (name, **Main contact** when they are, title at the account, email, phone), their **Details** with **Edit** in place, the opportunities they are the **Main contact** of ("Not on an opportunity yet" when none), and their calls, notes and tasks: the account's own rows and components, narrowed to this contact (All, Calls, Notes, Tasks). Anyone who may see the contact's account sees the contact; **Edit**, **Move to another account**, Log a call, Add a task and Add a note are offered by the same rules as on the account (D-209, D-238, D-222: nothing is added through a contact of an archived account, and Nevermore support changes nothing). The emails with the contact, the place to write and "Email" wait for Epic 6, and the firm's own fields for custom fields (D-186).
_Avoid_: contact record, contact profile

**Editing a contact** (code: `update_contact`; story CRM-C1.1, D-46, D-209, D-238):
The save of a contact's own fields from its page: name, title, email, phone, mobile, owner, **Main contact** and **Do not email**, from the version the person started from, with the same conflict answer as an account (nothing saved; what is there now and who changed it). Allowed by the level rule on the **Contact**'s own record owner, a contact with no owner or whose owner has left by an owner of the firm only. A new owner must be a current member the person may give the contact to. Ticking **Main contact** takes over from the old main contact, which needs the level rule on that contact too, and says who it took over from. An email, a phone or a mobile left as it was is not judged for its look again, so a contact copied from an intake with an older-format phone can still save its other fields. Moving the contact to another account is **Moving a contact**, not an edit.
_Avoid_: update contact (the code's name only), change a contact's account

**Do not email**:
A mark on a contact: they are not to be written to. It is kept and shown on the contact's page and in its edit form (D-186) and hides nothing until emails exist: from Epic 6 it hides the place to write and every Email button for that contact, and says why.
_Avoid_: unsubscribed (that is a recipient's own choice, recorded by the mail provider), opted out

**Opportunity**:
One search for one account and one start date. Every submission sits on one, and so every quote request. Its name is offered as the start month and "PEO search" ("March 2027 PEO search"), or "PEO search" when no start is known. It holds at most one intake; next year's renewal is a new opportunity on the same account. Its **Opportunity stage** is worked out, never stored (D-206): Qualifying (no intake), Intake under way (draft, submitted, under review, information requested), Ready to send (ready for market), In market (sent to PEOs), Quoted, Won, and Lost (lost or archived, or marked lost with no intake). It is open until it is won or lost.
_Avoid_: deal, search (on its own), case

**Contacts on this search** (code: `contacts` of `opportunity_page(firm, opportunity)`; story CRM-O1.1a, D-429):
The people an opportunity's page lists: its main contact (marked Main) and the contact made from its intake's prospect (marked "fills in the intake"), one row for each person, so the usual case, where the prospect is the main contact, is one row with both marks. An account's other contacts are not on the search; there is no per-opportunity list of contacts or roles.
_Avoid_: opportunity contacts (as if there were a list kept per opportunity), participants

**Opportunity activity** (code: `opportunity_activity(firm, opportunity, filter, limit, offset)`; story CRM-O1.1a, D-427):
Everything that happened on one opportunity, newest first: the **Call**s, **Note**s and **Task**s that name it, the events of its quote requests (sent, quoted, declined, closed) and its **Record history** with its **Stage change**s. Filtered All, Calls, Notes, Tasks or Changes; the quote requests' events and the history are the Changes. A call, note or task logged on an opportunity is still on its account, so it is **Last activity** of the account too.
_Avoid_: timeline, feed

**An opportunity's page** (code: `opportunity_page`, `opportunity_activity`, `update_opportunity`, route `/opportunities/:id`; story CRM-O1.1b, screen 19; D-421 to D-432):
The page an opportunity's name opens, from an account's Overview and its Opportunities tab. A trail (Accounts / the account / the opportunity); a header with the name, its **Opportunity stage**, target start, employees, main contact and owner, the **Stage bar** and, under it, what would move it on; then **Quotes**, **Intake**, **Activity** (with Add a note and Add a task, which open the account's form about this opportunity), **Details** edited in place from a version (the account and the stage are shown, never edited), and **Contacts on this search**. Details shows the source as "Referral · <partner>" when a partner is named, and its Source box is a choice (No source and the **Opportunity source** list, plus the opportunity's own source when it is an older value off the list, kept as it is); the partner is not chosen there and is kept while the source stays Referral. Anyone who may see the account sees the opportunity; Edit follows the level rule on the opportunity's own owner. On an archived account the page shows its archived note and nothing on it can be changed (D-432): no Edit, Add a note, Add a task, Mark done, Open again or Edit of an entry. An opportunity that is not there, is another firm's or may not be seen shows "This opportunity isn't available", the same for all three. Email the contact and Send to a PEO are off (D-402), Mark won or lost is CRM-O1.3b's, and New quote's Start the quote is Epic 5's.
_Avoid_: deal page, opportunity detail

**Stage bar** (story CRM-O1.1b, D-415):
The row of places under an opportunity's header: Qualifying, Intake under way, Ready to send, In market and Quoted, then Won or, for a lost opportunity, Lost in the last place. The current stage is marked; the ones before it on the way to Won are shaded; a lost opportunity shades none, since nothing says how far it got.

**Still needs** (the Quotes panel's column; story CRM-O1.1b, D-424):
What one PEO still needs to quote, as "What each PEO still needs" on the submission's page works it out (**Complete for a PEO**), read in the browser against the last certified version and the PEO's **Requirement profile**: "Nothing", the label of the one missing item, or a count ("2 of its own questions", "1 answer and 1 document"). A quote request is matched to its PEO's profile by name ignoring case; a PEO with no profile, or a version that cannot say what it held, reads "Not known". It is read without opening the submission, so no opening is recorded in the firm's record.

**New opportunity** (code: `opportunity_create(account, fields)`, `opportunity_create_context(firm, account)`; story CRM-A2.3, screen 25, D-436 to D-442):
The form that makes an opportunity by hand on an account, a dialog over the account's page opened from its header and its Opportunities tab (not offered on an archived account or in a Nevermore support session). The account is filled in and read-only: an opportunity is never moved to another account here. Its fields: name (required, at most 200; offered as "<Month YYYY> PEO search" from the target start and kept in step with it until the person types in the name), target start, employees in this search (offered from the account's), main contact (one of the account's contacts, offered as its main contact, optional), expected close, value a year (dollars, not negative), **Opportunity source**, stage (Qualifying, shown and not changeable: with no intake it is the only stage there is), owner (the maker unless they choose another current member the level rule lets them give it to and who can see the account) and next step (at most 2,000). One function makes it, with no intake, and the form then opens the new opportunity's own page. Anyone who may see the account may add one; an account holds any number of opportunities, several open at once, and nothing refuses another. "Save and start the quote" and "Start from last year's certified answers" come with New quote (Epic 5).
_Avoid_: new deal, new search, add an opportunity

**Opportunity source** (code: `opportunities.source`, `opportunities.referral_partner_code`, `opportunity_source_is_known(source)`; story CRM-A2.3, D-439):
Where an opportunity came from, one of a fixed list kept in one module and checked by the database: Referral, Renewal, Existing client, Inbound, Outbound, Event, Other (blank is no source). Referral may also name which of the firm's own **Referral partner**s sent it, kept as the partner's code (a partner has no id of its own; its code is its key within the firm and never changes), and a partner is kept for no other source (leaving Referral clears it). A source changed on an opportunity's page must be on the list; one saved before the list is accepted only unchanged. Renewal is set by "Start the renewal" (CRM-A2.4). It is not an account's source, which is set by the product and never edited (D-211).
_Avoid_: lead source, channel

**Main contact**:
The one contact of an account that is the person to deal with first; an account has at most one, by a constraint (D-29), and an opportunity's main contact is a contact on the same account. Making a new contact the main contact makes it the only one: the old main contact is unticked in the same step, and the person is told who it was. An account made from a submission starts with its prospect as its main contact (D-214).
_Avoid_: primary contact, lead contact

**Account status** (code: `account_status(account)`; story CRM-Q1.1a, CRM-A1.3, CRM-A2.4a, D-197, D-451):
Whether an account is a prospect account, a client or a **Former client**, worked out each time it is asked and never stored: a `client` while it has a **Placement** not ended or, with no placement at all, a won submission (one won before the placement record existed; a won submission put away, archived straight from won, stays won, D-216, until it is reopened); a `former_client` when it has placements and all of them have ended, whatever its submissions say (D-455); otherwise a `prospect`. Nobody sets it: adding a PEO placement's renewal by hand, marking a renewal "Didn't renew" and its undo move it. Not callable by the browser: a query that has decided the caller may see the account asks it.
_Avoid_: account type, lifecycle stage

**Placement** (code: `placements`; story CRM-A2.4a, D-446, D-447):
What a firm placed for an account with a PEO: the PEO's name (at most 80 characters), the start date if known, the broker of record, and when it ended. A placement a win makes (CRM-O1.3a) also holds the opportunity that was won and the quote request the employer took; one the firm made before the product is made, with no opportunity and no quote, in the same step as a renewal of a PEO placement added by hand. A placement not ended makes its account a client; it ends when its renewal is marked "Didn't renew" and begins again when that is undone. Read by whoever may see its account, written only through functions, with a history and a version. A win also records the **Commission basis** expected, with the number and the figure for a year, all optional together; the commission received is **Commission payment**s.
_Avoid_: policy, contract, sale, win (a win is the opportunity's outcome, the placement is what it leaves)

**Renewal** (code: `renewals`; story CRM-A2.4a, D-446 to D-454):
A date an account's cover comes up: what renews (a PEO placement, or the employer's current plan, which makes no placement), with whom (at most 80 characters), the date, the placement it came from and the opportunity working it (at most one, set by "Start the renewal"). Added by hand by anyone who may see the account, or made by a win; edited or deleted by whoever may change the account, except that one a win made is deleted only by reopening that win. It is **done** when its working opportunity is Won or when it is marked "Didn't renew" with a day (`not_renewed_on`), which ends the placement it came from; done is worked out and never stored beyond that day, and undoing "Didn't renew" brings the renewal and the placement back. Days away is worked out each time from today: "in 45 days", "today", "12 days ago". The accounts table's Renewal column is the date of an account's nearest renewal not done, and the built-in view "Renewing in 120 days" keeps the accounts with one on or before 120 days from today, overdue included, soonest first.
_Avoid_: expiry (a quote expires, a renewal comes up), policy end

**Start the renewal** (code: `opportunity_create` with `p_renewal_id`, `renewals.opportunity_id`; story CRM-A2.4b, D-449):
The button on a renewal not done and not worked by an open opportunity. It opens **New opportunity** filled in (name "<Month YYYY> renewal" from the renewal's date, target start that date, source Renewal, employees and main contact from the account) and saving links the new opportunity to the renewal in the same step. While that opportunity is open the renewal shows it and the button is not offered; if it is lost the renewal shows "<name>, lost" and offers the button again, which links the new one. Refused (PT409) for a renewal marked "Didn't renew", one its opportunity won, and one an open opportunity already works ("Its renewal is being worked by <name>").
_Avoid_: renew (a renewal is renewed by a win, not by this), link renewal

**Former client** (story CRM-A2.4a, D-197, D-451):
An account that has placements and every one of them has ended. A status of the account, worked out from its placements and never set; an account that places again (a new placement not ended, by a win or by hand) is a client again, and undoing "Didn't renew" reopens the placement and brings the account back.
_Avoid_: lost client, churned

**Opportunity stage** (code: `opportunity_stage(opportunity)`, `opportunity_stage_of(pipeline stage)`; stories CRM-Q1.1a, CRM-O1.2, D-206, D-408):
Where an opportunity is, worked out each time it is asked and never stored, with one exception. With an intake it follows the submission's **Pipeline stage**: `intake_under_way` (draft, submitted, under review, information requested), `ready_to_send` (ready for market), `in_market` (sent to PEOs), `quoted`, `won`, and `lost` (lost or archived, except that a submission archived straight from won stays `won`: D-216). What decides is the last move into archived from another stage; marking or clearing "needs action" on an archived submission writes a history row from archived to archived, which is not a move. With no intake it is `qualifying`, or `lost` when an agent marked it so: that one fact is kept on the opportunity (`lost_at`, `lost_by`, with the **Lost reason**), so there is one truth for each opportunity, never two. An opportunity marked lost is refused an intake ("This opportunity was marked lost. Reopen it before starting a quote.") and one that has an intake is lost through its submission. A pipeline stage the mapping does not know is refused, never answered with nothing, so a stage added to the pipeline fails a test until it is mapped. An agent sets the stage by hand only while there is no intake; after that it follows the intake, a send, a quote, and Mark won or lost. On screen: Qualifying, Intake under way, Ready to send, In market, Quoted, Won, Lost. Under it the page says what would move it on (`whatMovesItOn`, D-414): "Waiting for Lucia to certify", "Send to a PEO to move to In market". Every change of stage is in the opportunity's history, with who or what caused it (see **Stage change**). Not callable by the browser: the page's read asks it after deciding the person may see the opportunity (D-416).
_Avoid_: status (an account has a status, an opportunity a stage), pipeline stage (that is the submission's own)

**Stage change** (code: kind `stage_changed` of `record_history_list`; story CRM-O1.2, D-412, D-413):
A move of an opportunity's submission that changes the opportunity's stage, shown in the opportunity's history with who made it ("Stage: Ready to send to In market, by the send to PEO B, Dana Reyes"). Read from the submission's status history when the history is asked for and never copied into **Record history**, so nothing but the trigger writes that. A move inside one stage (submitted to under review), the row that starts a submission, a stage to itself ("needs action") and archiving straight from won (the opportunity stays Won) are not stage changes. Its key is worked out from the status row's own id, and it is ordered with the record's own entries by time, then key. Lost and reopened with no intake are tracked fields of the opportunity (`lost_at`, `lost_by`) and so ordinary entries.
_Avoid_: stage history, transition, activity

**Move cause** (code: `submission_status_history.cause`, `cause_quote_request_id`; story CRM-O1.2, D-412, ADR 0026):
Why a submission moved when no person chose the move: `quote_send` (a send recorded while it was Ready for market moved it to Sent to PEOs) or `quote_recorded` (a quote recorded while it was Sent to PEOs moved it to Quoted) or `quote_taken` (the quote the employer took, on a win), with the quote request that caused it. Null for a person's own move. The move names the person who recorded the send or the quote as who made it, and an arriving email never makes one (PRD 7).
_Avoid_: reason (a Lost reason is something else), trigger, automation

**Web domain** (code: `web_domain_of(website)`, `accounts.web_domain`; story CRM-Q1.1a, D-193):
An account's website reduced to what the duplicate match compares: lower case, without the scheme, a login, the path, query or port, a trailing dot or a leading `www.`. Worked out from the website, never typed. Whether it is a free-mail domain is the duplicate match's question, not stored here.
_Avoid_: URL, host

**Accounts table** (code: `accounts_list`, `accounts_view_counts`, `accounts_rows`; story CRM-A1.1b, D-44, D-173):
The accounts a person may see in one firm, as the Accounts page draws them, worked out in the database: 50 a page with the total, sorted by any listed column but the main contact (default: last activity, newest first; empty values last), filtered by the table's listed fields, searched by account name, trade name, web domain and a contact's name or email, and counted for each view's tab under the same filters. An archived account is in no view unless a filter on archived asks for it (the Archived view). Each row carries its worked-out columns: the owner (only while a current member), the **main contact** with email or phone, the **open opportunity** and how many are open, the quotes, the status and the last activity.
_Avoid_: accounts list (the list is the table's rows), grid

**Open opportunity** (the Opportunity column of the accounts table):
Of the opportunities of an account that are not Won or Lost, the one with the nearest target start (the earliest; one with no start after one with; the one made first when they tie), shown with its name and stage, and "+N more" for the others that are open. The Quotes column is for the same opportunity (CRM-A1.1): the quote requests on its intake that are not closed, how many came back and the nearest expiry of one that did, and whether one still waits on a PEO. An account whose last opportunity was won and whose new one is open shows the new one's quotes, never last year's; an open opportunity with no intake yet has none.
_Avoid_: current opportunity, main opportunity

**Level rule** (code: `can_change_firm_record(firm, owner)`; story CRM-A2.1a, D-209):
The one question every change to a record of a firm's CRM asks of the caller, written once: may they change a record of this firm that this person owns? An agent changes the records they own; a lead their own and those of their team and of every team under it; an owner of the firm the firm's; a record with no owner, or whose owner has left, only an owner. It does not read the firm's visibility setting: "everyone sees everything" lets a member see a colleague's record, never change it. Nevermore support is no member and changes nothing. Adding a contact, a call, a note or a task is open to anyone who may see the record, so the adding stories do not ask it. Not callable by the browser: each write function asks it after the one write guard (a closing firm and Nevermore support are refused first), and an account's page answers it as `can_change` so the screen shows Edit only to those it will serve.
_Avoid_: permission, edit rights, ACL

**Account's page** (code: `account_page(firm, account)`; story CRM-A2.1a, screen 17):
What the page of one account draws, read in one call: the account's own fields with its version, its worked-out status and source (with the referral partner's name when its first intake came by a partner's link), its owner by name, and for each tab its count and first five rows: Contacts, Opportunities (name, worked-out stage, target start, and the submission it holds; a name opens the opportunity's own page, as on the contact's page and in the search box and recent records, D-430, which replaced D-187), Quotes (a quote request on an intake of its opportunities: PEO, status, sent, quote dates), Activity and Files. There is no Renewals tab (D-186). It answers only someone who may see the account, and answers the same nothing for an account that is not there. The save of the account's own fields (`update_account`) is edit in place, from a version, by the level rule; the owner, archiving and source are not among them.
_Avoid_: account view, 360 view, detail page

**Archived account** (code: `accounts.archived_at`; `archive_account`, `restore_account`; story CRM-A1.1c, D-204, D-222):
An account put away without deleting it. It is in no view of the Accounts table but Archived; its fields can still be edited and it can be restored by anyone the level rule gives it, but nothing can be added to it (a contact, an opportunity, a call, a note or a task are refused while it is archived). Archiving changes nothing else: its opportunities, its status and its history are kept, and the change is one entry of its history. Archived and restored on the Accounts table's row and on the account's page; archiving an archived account, or restoring one that is not, changes nothing.
_Avoid_: closed, inactive, hidden, soft-deleted

**Deleting an account** (code: `delete_account`; story CRM-A1.1c, D-204, D-219, D-233):
Removing an account together with its contacts, its calls, notes and tasks, its placements and renewals, and their history. Allowed to whoever the level rule gives the account, and refused (PT409) for an account that has **any opportunity**: an opportunity is another person's work (it has its own owner, and may hold an intake, a submission and quote requests), so a delete never removes one and never chooses between them. The person is offered **Archive** instead. This also keeps every submission and every quote request on an opportunity (CRM-Q1.3). An email (Epic 6) will refuse a delete the same way.
_Avoid_: erase, purge, remove (a member is removed, an account is deleted)

**Change of owner** (code: `change_account_owner`; story CRM-A1.1c, D-209, D-214):
Giving an account to another current member of the firm, by the level rule. The dialog starts with nobody chosen and offers only people other than the current owner; it can't be saved until a new owner is picked. It offers to give the account's **open** opportunities (not Won or Lost) the same owner: those the person may change by the level rule change, and they are told how many of a colleague's were left with their owners. The owner is never cleared, and a former member can't be chosen.
_Avoid_: reassign, transfer, hand over

**Account's tab** (code: `account_tab(firm, account, tab, limit, offset)`; story CRM-A2.1b):
One list of an account's page opened in full: Contacts, Opportunities, Quotes, Activity or Files, from any place and a page at a time (fifty on the screen, "Show more" for the next). The Overview shows the first five rows of each and "See all" opens its tab; the rows come from the one function the page's first five come from, so the two are never different lists. A contact's name opens the Contacts tab with that contact in view until a contact has a page of its own (CRM-C1.1); an opportunity's name opens its own page (CRM-O1.1b, D-430, which replaces D-187 here) and a quote's PEO opens its submission's page until the quote has a page of its own (Epic 5). It answers only someone who may see the account.
_Avoid_: sub-page, panel (a panel is one box of the Overview)

**Account line** (on a submission's page; story CRM-A2.1b, D-213):
"Account: <name>" under the submission's source, linking to the account's page. Shown only when the submission is on an account the person may see; a submission that is on none, and an account the person's level does not reach, have no line.
_Avoid_: company link, parent account

**Account's files** (code: `account_files(firm, account)`; story CRM-A2.1a, D-199):
The files of the account's intakes that passed the virus check (scan verdict clean; never one pending, quarantined, failed or not scanned), newest first, named and placed and never with what was read out of them. Each stays under its own access rule: the list gives no link, a link is a signed link made by Storage only to someone its file rule lets read the file, and a support session is given none. Uploading a file to an account is CRM-A2.5's.
_Avoid_: attachments, documents (the intake's own word for what a prospect uploads)

**Activity tab**:
The tab of an account's page that lists, newest first, its calls, notes and tasks (from Epic 6 its emails) together with its record history, with a filter for All, Calls, Notes, Tasks and Changes (D-212). It is never the **Firm activity** record.
_Avoid_: activity feed, audit log, timeline (on its own)

**The chain**:
A quote request's opportunity and that opportunity's account, with the account's contacts. No quote request without an opportunity, no opportunity without an account, and every submission on one opportunity: the database refuses anything else. It is made in the same step a quote starts, and the same step run twice makes one chain, not two. An intake an employer started that has not been certified yet has none (ADR 0025).
_Avoid_: hierarchy, link, filing

**Bringing in** (the existing submissions):
Giving every submission that existed before the chain did its account, contact and opportunity (CRM-Q1.3), by the same step a first certification takes, owned by nobody. Each gets its own account; where two match, the later is marked "Possible duplicate of" the earlier, by when each was first certified, and nothing is merged. Its quote requests are on its opportunity because they are on its intake: a quote request has no table of its own for this. A closed firm's submissions are left alone. It can be run again and then makes nothing, and it reports how many of each it made. From then on the database refuses a submission, or a quote request, with no opportunity: a closed firm's intakes and a firm that is closing (which deletes its opportunities) are the only exceptions.
_Avoid_: import (that is a file of records from elsewhere), migration (for the people who read it)

**Quote** (on the workspace's screens):
One row of the Quotes list or of an account's Quotes tab: a **Quote request** together with the **Quote** it returns, if any (D-185). In code and in the entries above, the two keep their own names.

**Duplicate match** (code: `find_duplicate_account`, `account_name_key`, `is_free_mail_domain`; story CRM-Q1.1b, D-193):
How the product decides that a business may already be an account, exactly and never by likeness, within one firm's accounts: the same web domain (without `www.`, and never a free-mail domain such as gmail.com), the same name and state (both must have a state) (the name's last word dropped when it is a legal designator, LLC, Inc, Corp, Co, Ltd, LLP, PC or PLLC, with or without its punctuation, and only then put in lower case with letters and digits only, so "Acme Co." and "Acme" match but "Costco" and "Cost" do not), or a contact with the same email, ignoring case. When several accounts match, the earliest made is the one named; an archived account still matches. While a person creates a record, a match is a warning naming the record and its owner, with a link; one they may not see says only that one exists and who to ask. They can still save. When an employer's intake is certified there is nobody to warn: the account is made and marked **Possible duplicate**.
_Avoid_: fuzzy match, similar record

**Search** (code: `search_records(firm, words)`; story CRM-S1.2b, D-185, D-226, D-227):
What the search box asks the database: the **Accounts**, **Contacts**, **Opportunities** and **Quotes** (on the workspace's screens) of one firm that the person may see by their level, whose own fields hold every word typed (any order, any case, as a part of the field), five of each kind and whether there are more. It reads an account's name, trade name, **Web domain** and phone, a contact's name, email, phone and mobile, an opportunity's name, a quote's PEO, and the File ID of an opportunity's or a quote's submission; a contact, an opportunity and a quote are also found by their account's name, trade name, web domain and phone (the business). It never reads an intake's answers, the FEIN or the census (ADR 0006). An address typed ("https://www.acme.com/about") finds the web domain, and a phone typed with any marks finds the phone. Fewer than two characters finds nothing. A support session searches as a member does and records nothing.
_Avoid_: find, lookup, filter (a filter narrows a table's list; search names records across kinds)

**Recent record** (code: `recent_records`, `note_recent_record`, `my_recent_records`; story CRM-S1.2b, D-214):
One of the last records a person opened in a firm, kept per person and per firm (the last 20), for the search box's "last five opened". Opening a record puts it at the top; only a record the person may see is noted; one they may no longer see is passed over; Nevermore support notes none; closing a firm deletes them. The workspace pages that show an account or a contact note it as opened (story CRM-S1.2a, D-620).

**Menu search** (code: `MenuSearch`, `useNoteOpened`; story CRM-S1.2a, D-620 to D-624):
The search box in the workspace menu. Empty, it lists the person's last five **recent records**; from two characters it shows the **Search** answer in groups of up to five, each result opening its record (an opportunity opens its submission until it has a page), with "See all accounts" when more than five accounts were found, and, when nothing matches, "Nothing matches" with a New account button that opens the New account form named with the words typed.
_Avoid_: global search, omnibox, quick find

**Chain at certification** (code: `make_intake_chain`, the trigger `chamber_sessions_chain`; story CRM-Q1.1b, D-192):
The step that makes an intake's **chain** the first time an employer certifies it, in the same transaction as the certification, so a certification that cannot make its chain fails and a submission is never left without one. It reads the answers of the intake's latest certification (never the working copy, never the FEIN, the census or anything about an employee): the account (the legal name, address and website, state of the headquarters, states of operation, employees, industry, and current provider when the employer said they have one; owned by nobody; source Employer's intake), marked a **Possible duplicate** of the earliest account the **Duplicate match** finds, never merged and never asked of the employer; the contact (the prospect's name from their profile, or the signer's name when the profile has none, with their email and phone, the main contact, linked to the prospect, left out only when they have neither an email nor a phone); and the opportunity (named for the start month as typed and "PEO search", or "PEO search" alone; its main contact the prospect's contact; owned by nobody; holding the intake). It is written in the intake's firm whatever state the firm is in, since certifying is the employer's act and not a member's: a closing firm's chain is deleted with the rest when the closing ends, and a suspended firm's members read nothing until the suspension is lifted. Certifying again, or the step run again, finds the chain that is there and changes nothing; one lock per firm orders two chains made at once, so the second sees the first. The step is also the one CRM-Q1.3 calls for the submissions that exist.
_Avoid_: auto-create, sync, conversion (a lead's conversion is CRM-L2.2)

**Duplicate warning** (code: `duplicate_account_check`, `duplicate_contact_check`, `DuplicateWarning`; story CRM-S4.2, D-601 to D-604):
What New account and Add a contact say while the person types, when the **Duplicate match** finds records of the firm that may be the same: for an account its website, or its name with a state; for a contact its email. It names each record the person may see with its owner and why it matched, and a link that opens it in a new tab; it never stops the save, and it offers no merge. A check that fails shows nothing.
_Avoid_: duplicate error, duplicate check (a check is the database's question; the warning is what the person sees)

**Masked match** (story CRM-S4.2, D-602):
A duplicate the person may not see (an account by their level, a contact by its account's). It says only that one exists and whom to ask: the account's owner, or the firm's owners when it has none or theirs has left. It never names the record, links to it, says which field matched or counts how many there are.
_Avoid_: hidden duplicate, redacted record

**Possible duplicate**:
A mark on an account that the duplicate match found may be a business the firm already has, made when an employer's intake or the bringing-in of existing submissions created it. Nothing is merged by guesswork: an agent merges it or keeps it separate, which clears the mark. The employer is never asked.
_Avoid_: duplicate (on its own: it is a question, not a finding)

**Merge**:
Two accounts, two contacts or two leads made one. For each field that differs the person picks the value to keep; everything attached to the one removed moves to the one kept; the one removed is deleted, its history moves to the kept record marked as from the merged record, its old address leads to the kept record, and the merge is recorded on the kept record. Anyone allowed to change both can merge them. There is no unmerge. Two accounts that each hold an intake can be merged: both intakes stay, each on its own opportunity.
In the database (code: `merge_accounts`, `merge_contacts`, `merge_preview`; story CRM-S4.3b, D-203, D-210, D-640 to D-649): the person names the record to keep and the one to remove, the version each was at when they chose, and for each field that differs which value to keep (a field they leave out keeps the kept record's value, or takes the removed one's when the kept one is blank). An account's contacts, opportunities (with their intakes and quotes), calls, notes, tasks, labels, placements and renewals move to the kept account; two contacts of the two accounts that are the same prospect become one. Two contacts merge only when they are on the same account. Both must be ones the person may change by the **Level rule**, the kept account must not be archived, a closing firm and a Nevermore support session are refused, and a record changed since the person chose refuses the merge. The kept record's history shows each entry copied from the removed record marked as from it, and one "Merged" entry.
_Avoid_: combine, dedupe

**Lead** (the record; code: `leads`; stories CRM-L1.x and CRM-L2.x, D-803 to D-809):
A person and their business the firm is not quoting yet: one row holding who (name, title, email, phone) and which business (its name, state, city, employees, current provider), with its **Record owner**, its source (Added by hand, Import, Referral partner, Firm's link) and its status. It is not in the chain: it has no account, contact or opportunity until it is converted, which copies it into them and moves its calls, notes and tasks onto the account. Its status is **New** when made, **Working** after its first logged call, saved change or by hand, **Not a fit** with a reason from a short list (too small, wrong industry, not interested, bad contact details, other) and reopenable, or **Converted**, set only by converting, with the records it made, after which it never changes. Seen by the level rule as an account is. Deleting puts it in the bin (`deleted_at`), seen only by owners, for 30 days. Every change of its fields and status is in its history. Not the **lead** role (Owner, lead, agent): on a screen the record is "lead" in a table of leads, the role "team lead".
_Avoid_: prospect (the employer who fills in an intake), contact (a person at an account)

**Keep separate** (code: `account_keep_separate`; story CRM-S4.3b, D-193):
Taking the **Possible duplicate** mark off an account: the person has decided the two accounts are different businesses. Nothing is merged and nothing else changes; the account's history shows the mark taken off. Whoever may change the account may.
_Avoid_: dismiss, ignore

**Merge dialog** (story CRM-S4.3a, D-665 to D-667):
The screen where a person merges two accounts or two contacts of one account: both records side by side, one choice for each field that differs (each starts on what the database would do for a field left alone), what will happen in words, and the warning that a merge can't be split again. It shows the database's reason instead of the button when the person may not merge them.
_Avoid_: merge wizard, conflict screen

**Possible duplicate banner** (story CRM-S4.3a, D-661):
The note at the top of an account marked **Possible duplicate**, naming the other account, with Merge and **Keep separate** for whoever may change the account.
_Avoid_: duplicate warning (that is what New account and Add a contact say while typing)

**Merged-into address** (table `merged_records`, code: `resolve_merged_record`; story CRM-S4.3b, D-203):
What the database keeps of a record that was merged away: which record it became (an account or a contact, by id, with the name it had). The removed record's old address leads to the kept record, also when that one is merged later, for a person who may see the kept record; for anyone else it leads nowhere, as a record that does not exist.
_Avoid_: redirect, tombstone

**Contact me** (code: `request_contact`, reached only through the `contact-request` function; story CRM-L1.2b, D-1660 to D-1679):
A visitor's request, on a firm's public link, to be contacted: the section "Rather talk to someone first?" on the landing page at a firm's address (and nowhere on the bare domain), for someone who starts no intake. It makes one **Lead** of the firm the address names (the firm is never named by the browser), with the source **Firm's link**, the status New and **no Record owner**, so only owners see it until one gives it to someone. The visitor gives a name and an email or a phone, and may add a business and a message, which the lead keeps in its note. Asking again with the same email within a day makes no second lead and tells the visitor the same thing; a firm's link takes 20 requests an hour and all firms' links together 200, past which the visitor is told to try again later and nothing is made. A closing firm takes none, and an address no firm holds, a refused firm's or a closed firm's takes none and says no firm holds it. A visitor must pass a **Turnstile check** (Cloudflare Turnstile's widget, loaded only on the form) before anything is made: the form posts to the `contact-request` function, which checks the token and only then asks the database, so the database's function answers no browser. With no Turnstile key set the form is not offered ("Asking to be contacted isn't available right now") and the function refuses: never open without the check. When it makes a lead the firm's owners get one email, the **Lead from link** alert (code: `lead_from_link`, an outbox kind and a firm's alert like the **Export alert**): "<Name> asked <Firm> to contact them", with the business if given, when, and a link to the lead, and never the visitor's email, phone or message, which stay on the lead behind sign-in. It waits while the firm is suspended, a bounce never suppresses an owner's address, and a repeat ask or a busy link makes none.

**Reopen** (a lead; code: `reopen_lead`; story CRM-L2.1, D-1652):
The one change a **Not a fit** lead takes: it becomes **Working** again and its reason is cleared, both moves kept in its history. Offered on the Not a fit banner of the lead's page to whoever the level rule lets change the lead. Until then a Not a fit lead, like a Converted one or one in the bin, is read, not changed: its fields, its calls, notes and tasks and its status stay as they are.

**Converting makes** (a lead's page; story CRM-L2.1, D-1653):
What the lead's page says converting would make, before converting (CRM-L2.2) is done: an account named after the lead's business (its name when it has none), a contact named after the person unless the lead's name is its business's (no person, no contact), and an opportunity named "<account> – PEO search".

**Label**:
A word from the firm's own list, made by typing it, that can be put on any number of accounts and leads (CRM-L1.1b; one list for both). The same word in other letters is the same label (the first spelling stays); a label is at most 40 characters. It is made the first time a bulk change puts it on an account, and an archived account takes no new one. Putting one on or taking one off is one entry in the account's history ("Labels changed from nothing to VIP"). Renaming or deleting a label is Settings' (Epic 9). The Accounts table shows each account's labels and can be filtered and sorted by them.
_Avoid_: tag, category

**Bulk change** (code: `bulk_accounts_change`; story CRM-S3.7b, D-202, D-209):
One action done to many accounts in one step, from the table's **Selection** (at most 1,000, counted again by the database, which refuses more in words): change the owner (and, when asked, the open opportunities' owners), set one optional field (never the name, a required field or one the product works out), add or remove a **Label**, or archive. Export is the table's own export of the selection. The **Level rule** is asked for each account: those the person may not change are **skipped**, counted and named with the reason, and never stop the rest; an account already as asked is counted as unchanged and writes nothing. All or none: if anything fails nothing changes. Each changed record gets one entry in its history. A preview says what will happen before anything changes. On the Accounts table (CRM-S3.7a) the bar offers Change owner, Set a field, Label and Archive to a member of the firm (never to Nevermore support); the dialog shows the preview (how many change, how many stay as they are, each skipped account by name with the reason); after a change the selection ends and a line over the table says what changed and offers **Undo** for ten minutes, and after an undo says what was put back and what was left.
_Avoid_: mass edit, batch update

**Bulk change of leads** (code: `bulk_leads_change`, `bulk_leads_preview`, `bulk_leads_undo`; story CRM-L1.1b, D-811, D-1641 to D-1644):
The leads' **Bulk change**, with the same selection, cap, preview, all or none, history and **Undo**: change the owner, change the status (New or Working only), Not a fit (one reason for all), set one optional field, add or remove a **Label**, or delete (to the **Lead bin**). A converted lead is skipped for every action; a Not a fit lead is skipped for all but a change of status (which reopens it) and delete. A lead in the bin is never in a selection. On the Leads table the bar offers Change owner, Change status, Not a fit, Set a field, Label, Delete and Export, never to Nevermore support; Delete asks "Delete N leads?" first.
_Avoid_: mass edit, batch update

**Lead bin** (code: `leads.deleted_at`; `leads_bin`, `restore_leads`, `remove_binned_leads`; story CRM-L1.1b, D-806, D-1645, D-1646):
Where a deleted **Lead** waits for 30 days: in no view of the Leads table, shown only to the firm's owners (and read by Nevermore support) under Deleted, each with the day it goes for good, and put back with **Restore** by an owner (or by the **Undo** of the delete). The firm record's daily job then removes it for good, with its calls, notes, tasks, labels and history. A converted lead is never in it.
_Avoid_: trash, recycle bin, archive (an account's)

**Undo** (of a bulk change; D-202):
For ten minutes after a **Bulk change**, and once, the person who made it can put it back. It restores every record nobody has changed since, and skips and names the rest (a record whose owner, archived state, field or label was changed again, an owner who has since left the firm, a label that would go back on an archived account, a record that is gone). It does not ask the **Level rule** again: an agent who gave accounts away can no longer change them, and the undo is theirs because they made the change. It writes its own history entries.
_Avoid_: revert, rollback

**Call**, **Note**, **Task**:
What an agent logs on an account, a contact or an opportunity (later on a lead). A call records who with, about what, when, the outcome and what was said, and logging one can add a follow-up task in the same step. A note can be edited only by the person who wrote it and only for 24 hours; after that it is fixed, and "Add to note" appends a dated addition. A task says what, for which member and when it is due, and is open or done; anyone who may see its record can mark it done.
_Avoid_: activity (on its own), quote request note (a note on one PEO's quote request is a different record)

**Follow-up task**:
The task a call can add as it is logged, saved in the same step as the call and on the same account, contact and opportunity. Both are saved or neither is. For the person logging it unless another member is chosen.

**Addition** (to a note):
Text appended to a note with "Add to note", dated and signed by whoever added it. Anyone who may see the note can add, at any time. A note's own text stays as written once it is fixed, and additions are only ever added at the end, never changed or taken away.
_Avoid_: edit (of a fixed note)

**Last activity**:
When something last happened on an account: the newest of its creation, a call, note or task logged or completed on it, its contacts or its opportunities, a quote request's status changing and (from Epic 6) an email. Editing a field is not activity. A call counts at when it took place, a note or a task when it was made, a task again when it is done and a note at each addition. Opening a task again, or changing a call, a task or a note's text, is not activity (code: `account_activity_times(firm, account)`, the one function that gains a branch for email in Epic 6).
_Avoid_: last modified, updated

### Advisors

**Advisor Console**:
The advisory team's operating workflow: every submission with its pipeline stage, notes and history. The team works submissions here, not in a separate CRM. Since the firms stories it is **the firm's console**: it opens for a current member of a firm (never because of a platform role: **Firm guard**), and shows only that firm's records. The routes keep their `/advisor` paths until the screens that replace them ship (D-8).
_Avoid_: CRM, admin queue

**Table query** (code: `queue_list_submissions`, `queue_view_counts`; the shapes in `src/lib/tableQuery.ts`):
How a workspace table asks the database for its rows (D-44): a list of **filters**, one **sort**, a page number and the search, answered with one page of 50 rows and how many match in all. The database holds each table's **fields**, a fixed list naming each field's kind (text, number, date, one choice, several choices, yes or no, person), and refuses a field, operator or value it doesn't take, with the reason; it never drops one, since a dropped filter shows more rows than were asked for. Built first for the submissions queue (CRM-S3.3b); the accounts, leads and quotes tables copy it. The page's **table address** is what the query is built from: the view's filters and the address's own, the sort, the page and the search (CRM-S3.5a).
_Avoid_: dynamic query, search (a search is the words typed in the search box, which is one part of the query)

**Table frame** (code: `src/components/workspace/table/`; story CRM-S3.5a):
The one piece every workspace table is drawn with: its **table address** read from the page, its rows fetched through the query library (asked again on focus and every 60 seconds, the rows staying on screen while the next arrive), the table itself, and the pager. A table gives the frame a **column definition** list and its fields (a constant: what a cell needs besides its row comes through the frame's `context`); the frame owns what a view means for the query (the view's filters, then the address's, within the 20 the database takes) and draws the view tabs; the frame leaves named places for what later stories add: `empty` and `error` (Epic 2's page-state stories), the filter row (built, CRM-S3.3a: `FilterRow`), the columns menu (built, CRM-S3.1a: `ColumnsMenu`; the first column is pinned to the left edge when the table scrolls sideways), saved views (built, CRM-S3.4a: `ViewTabs`) and row selection. The queue is the first table on it.
_Avoid_: grid, data table (in screen words, say "table")

**Loading state** (code: `src/components/workspace/states/`; story CRM-S2.1, D-143 to D-146):
What a page shows while it has nothing to show yet. The page's frame (menu, title, tabs, toolbar, column headers, a record's panel headings) is drawn at once; only the data area holds grey placeholders. A table shows eight grey rows inside its real table under its real headers, each cell shaped like its column; a record shows grey lines where each field and list will be. A screen reader hears one polite status, "Loading submissions" (or the page's name), on the page empty from the first draw and filled just after, never row by row, and the placeholders are hidden from it. The table frame draws one table always (grey rows in its body, then the real rows), so focus and the scroll position survive. It is not shown for a refresh, a focus refetch or the next page over rows already on screen (D-49), and the shimmer stops for a person who asked for less motion. Controls that change the question (search, filters, tabs, sort) stay usable meanwhile; the pager, Refresh and anything acting on rows wait for the data, as `aria-disabled` controls that say why (D-143). Rows already on screen that answer another question are dimmed and marked busy, not replaced by grey rows (D-144).
_Avoid_: spinner (a spinner is what this replaces), skeleton (in screen words)

**Nothing yet** (code: `NothingYet` in `src/components/workspace/states/`; story CRM-S2.2, D-158 to D-165):
One of the two kinds of empty, and the one that says the firm has no records of this kind at all. It shows one sentence saying what belongs here and, when a person can make the first record, one primary action; where import applies a second action to import (CRM-X4.1, not built: the component has the place for it). It is shown only for an address that asks the whole question (no view, search or filter) and for a list that has no search or filter at all. It never names a filter and never offers to clear one. The queue has no action yet, because a member cannot make a submission until New quote (CRM-Q2.1).
_Avoid_: blank slate, "no results" (that is nothing matches)

**Nothing matches** (code: `NothingMatches`; story CRM-S2.2, D-158 to D-165):
The other kind of empty: records may exist, but the view, the search or the filters leave none. It keeps the toolbar and the column headers, says "No submissions match these filters" (or "this search", or "this search and these filters", or the page's own exact words), lists in plain words what is in force (the tab by its label, the search in quotes, each filter as its field, operator and value: "Needs advisor action: yes", "Employees is between 10 and 50"), and offers one way back that does only what its label says: "Clear search", "Clear filters" or "Clear filters and search" clear those and keep the tab and the sort; when only the tab narrows the list the button is "Show all statuses" (the table's all-view name) and leaves the tab. Each is a step Back undoes. It never offers to create a record. Its words for a filter come from `filterInWords` (one value reads "Status is Won", a pair is put in order, a value the table does not list is shown in quotes), which the filter chips (CRM-S3.3a) use too.
_Avoid_: no results, empty search

**Load failed** (code: `LoadFailed`, `PanelFailed` in `src/components/workspace/states/`; story CRM-S2.3, D-175, D-177):
What a page or a panel shows in its data area when it could not load: "We couldn't load the submissions." with one plain sentence and a "Try again" button that asks again and keeps the page's filters, sort and view. It never shows the database's or the network's own words. A lapsed session is told so and signs the person out; a refused role is told so with no retry. A failed panel of a record says so in its own body with its own "Try again", and the rest of the record stays. Focus is kept deliberately: when "Try again" goes with the failure, focus goes to the page's main area or the panel, and a retry that fails again takes focus back to its own button (only the panel whose button was pressed, when two share a read). Two panels waiting on one read say so once. A refused query (a filter the database won't take) is not this: the table frame shows the database's own reason and a way back (D-138). A refresh that fails over rows already on screen is not this either: the rows stay under a Refresh note (D-181).
_Avoid_: error page, "something went wrong" as the heading (say what could not be loaded)

**Conflict dialog** (code: `ConflictDialog`, `SaveConflict`, `conflictDialog` option of `useWorkspaceForm` in `src/components/workspace/form/`; story CRM-S2.4a, D-183):
What a form shows when its save is answered with a conflict: "Someone else changed this partner", with every field EITHER side changed, what each side made it, and who changed it and when ("You didn't change this" or "They didn't change this" where a side left it alone). Three choices, each per field: **Keep mine** (save what you changed, and keep their change on every field you left alone, from the version that holds their change), **Keep theirs** (take their values for the fields they changed, and keep anything else you typed) and **Keep editing** (go back, nothing changed; Escape does this). Nothing is saved or dropped until one is chosen. A modal alert dialog: focus is trapped inside and starts on Keep editing, and it is announced once as it opens.
_Avoid_: merge dialog, overwrite warning, "reload to see their change"

**No-connection banner** (code: `ConnectionBanner`, `useOnline` in `src/components/workspace/`; story CRM-S2.4a, D-182):
The line over every workspace page, while the browser reports no connection: "You're offline. What's on screen may be out of date, and nothing can be saved until you're back online." One live region on the page from the start, so it is announced once when the connection goes and not by each poll; it says nothing when the connection is back. While it shows, a form's Save, and the save buttons of the panels (notes, status, quote requests, field review, the packet's Generate), are `aria-disabled` with the reason "You're offline. Saving is back when you are." and a save made with Enter is not sent and says so. It is the browser's word, so a network that is up but unreachable is not called offline; a request that fails is told in its own place.
_Avoid_: toast, "network error" banner

**Refresh note** (code: `RefreshFailed` in `src/components/workspace/states/`; story CRM-S2.4a, D-181):
The note over a table's rows when a refresh failed and the rows are still on screen: "We couldn't refresh the submissions. What's below may be out of date." with "Try again". The rows stay. A polite status, one element for as long as refreshes keep failing, so it is read once, and gone when a refresh works. A table with nothing to show that failed is not this: it is the failed-load panel (Load failed), and it is asked again only by its "Try again".
_Avoid_: error banner, toast

**Not available** (code: `NotAvailable`; story CRM-S2.3, D-176):
What a record's page says when the record was removed, belongs to another firm, or was never a record: "This submission isn't available." with a link back to the list, in the same words for all three, so it never tells a person whether something exists that they may not open. It is not an error and not a wait: no alert, no "Try again". Focus goes to its heading.
_Avoid_: not found, 404, "you don't have access" (it must not say which)

**Failed save** (code: `SaveFailed`, `useSaveFailure`, `failureWords` in `src/components/workspace/form/`; story CRM-S2.3, D-178):
What a form or a panel says when a save did not go through: plain words next to its buttons, as an alert, with what the person typed still in place and the form still open. An error's own sentence is shown when the product raised it for people (a refusal with its own code, such as 55000, P0002, 23514, 23505 or 40001, whose text is not the server's own); a dropped network, a function call's status line, a timeout, or the server's own constraint and syntax messages read as a sentence of ours ("The note wasn't saved. Check your connection and try again. What you typed is still here."). Focus goes back to the button that was disabled while the save ran.
_Avoid_: toast for a save that failed (a toast is gone in seconds and is not beside the button)

**Slow-load line** (code: `useSlowLoad`, `SlowLoadLine`; story CRM-S2.1, D-145):
The line under a page's title that says "This is taking longer than usual" with a "Try again" button, shown when a loading state has lasted ten seconds. A polite status on the page, empty, from the first draw of the wait and filled at ten seconds, so it is announced once. It goes when the data arrives or the load fails, "Try again" asks again and starts the ten seconds over, and no timer is left once the page is gone. Where nothing has been asked yet it says what it is waiting for instead of offering the button.

**Column definition** (code: `ColumnDefinition`, `TableDefinition`, `FieldDefinition`):
How a table is described to the frame. A **field** is listed once, with its label, kind (which decides the filters it takes) and, for a choice, its values, mirroring the database's list. A **column** has an id that never changes (column choices are kept by it), the words in its header, how a cell draws from a row, the fields it sorts and filters by (by id; a column with no sort field has a plain header), an optional plain text for an export, and whether it is the first, name column that can never be hidden. The first column's cell is each row's header cell, so a screen reader can say whose row it is. A table's views and fields may be not known yet (loading from the database); the address keeps what it can't judge until they arrive.

**Sortable header** (code: `DataTable`'s `onSort`, `OrderLine`; story CRM-S3.2a, D-147 to D-151):
The header of a column that has a sort field: a button filling the whole cell that sorts the table by that column. Its name is the header's words; the cell says `aria-sort` (ascending, descending, or none), a decorative shape marks the direction, and what a click will do is the button's description. A first click sorts in the field's first direction (a date newest first, anything else ascending, unless the field says otherwise), the next click reverses, the one after reverses again, and nothing clears the sort. One column is sorted at a time. A click on a new column is a step Back undoes; reversing the same column replaces it. Every sort returns to page 1. The line over the table (plain text) says "Order: Newest first" when no column is sorted and the table's own order is no column's, and "Sorted by Company, ascending." with the definition's own "Back to newest first" once one is; that button is the only way to clear a sort. A column with no sort field (the queue's Completeness) has a plain header.
_Avoid_: sort box, sort menu (the queue had one until this story)

**Table address** (code: `readAddress`, `addressToSearch`, `changeAddress`):
A table's whole state, kept in the page's search parameters (D-43): the page (from 1), one sort, the list of filters, the view (a built-in view's id or a saved view's id) and the search. One pair of functions reads and writes it for every table, so a bookmark, a shared link, a new tab and Back all show the same rows. An address nobody wrote with care (garbage, stale, hand-edited, the queue's old parameters) is read as far as it can be, and the page rewrites it cleanly; changing anything but the page returns to page 1. Each parameter and the old ones the queue accepts are in `docs/BROKER_CRM_BUILD.md`, "The table address".
_Avoid_: URL state, query string (in code comments; say "address")

**Filter** (code: `{field, op, value}`, checked by `workspace_filter_check`):
One condition on one field of a table, by an operator its kind takes: text (contains, is, is empty), number (is, more than, less than, between), date (on, before, after, between, in the next or last N days, each a day in the person's time zone), one or several choices (any of, none of, is empty), yes or no (is), person (any of a list of people by their id, me, my team: the accounts table's Owner, CRM-A1.1b, D-173; "my team" is every current member of the caller's team and of the teams under it, and a person on no team has none). Text and choices ignore case; a between takes its ends in either order. A table's filters combine with "and" (at most 20 in all, a tab's own filters counted first). A filter is set from the **filter row**, which shows each one as a **filter chip**.

**Filter row** (code: `FilterRow`, `FilterEditor`, `src/components/workspace/table/`; story CRM-S3.3a, D-166 to D-173):
The labelled group ("Filters") above a table where a person narrows it. It holds the table's **listed filters** (the few fields a table names in `listedFilters`, each a button always there, ready to set: "Filter by Needs advisor action"), "Add filter" (every other field of the table, searchable by its words), a **filter chip** for each filter in the address, and "Clear filters" once there is one. Setting a filter opens a small editor under the button: the condition (the operators of the field's kind, in plain words, from the one list the codec and the database share) and the value (a text box, a number, a date, a number of days, or a searchable list of the field's choices by their words). Nothing is applied until "Apply" or Enter, and what is typed is checked first by the same limits as the address and the database (200 characters, 100 list values, 0 to 3660 days, real dates), with the reason under the field. Escape or a click away closes it and changes nothing. A field carries one filter in the row: once it has a chip, its button and its place in "Add filter" are gone and the chip is its control. "Add filter" is unavailable, with the reason "A table takes up to 20 filters.", at the limit. Adding, changing, removing and clearing each push a history entry and start at page 1.
_Avoid_: filter bar, filter panel, facets

**Filter chip** (code: in `FilterRow`):
One filter the address holds, shown as its words (`filterInWords`: "Employees is more than 50"): the chip itself opens its editor and the small button beside it ("Remove filter: Employees is more than 50") takes it off. A filter that belongs to the current tab is not a chip (it is not in the address; the tab is its control). A filter held for a field that has not loaded yet (D-141) is a quiet chip with its text as written, which can only be removed.
_Avoid_: tag, pill, token

**View count** (code: `queue_view_counts`):
The number on a view's tab: how many rows that view's filters match, under the same rules as the table, for several views in one call.

**Firm guard** (code: `RequireFirm`, `src/components/RequireFirm.tsx`; the database's answer is `my_firms()`):
The one guard in front of the firm's console pages. A person is let in when the database says they are a current member of a firm (an owner of that firm, for the firm's record of who did what: the role the caller holds at the **current firm**, never ownership of some other firm), past the second factor a password sign-in owes (D-19); whether they hold a platform role is never asked. At a firm's address the firm must be one of theirs, and they are let in whatever other firms they belong to: the database answers for that address's firm alone (**Address narrowing**). On the bare domain a member of exactly one firm lands in it, and a member of several is sent to **Choose a firm**. A person who belongs to no firm is told so ("You aren't a member of any firm").
_Avoid_: advisor guard, role check

**Workspace** (code: `src/components/workspace/`):
The broker's side of the product: the pages a current member of a firm works in (quotes, inbox, reports, settings and the console pages that are still to be replaced), drawn inside the **Workspace shell** and in the **Workspace look**. Not the tabs inside The Chamber, which are the prospect's. The workspace's pages keep their `/advisor` paths until the screens that replace them ship (D-8, D-37); Settings is `/settings`. Platform pages are never part of it.
_Avoid_: the console (for the whole of it), dashboard, CRM

**Workspace shell** (code: `WorkspaceShell`):
The frame around every workspace page: the **menu** down the left and the page beside it, one layout route inside the firm guard, so it draws only for a current member. The menu shows the firm's name and address at the top (linking to the queue), Quotes, Inbox and Reports, and at the foot Settings, the signed-in person (name, or email when there is none) with their role (Owner, Lead, Agent), and sign-out; a "Nevermore admin" link shows to a platform admin only (D-37). The current section is marked with `aria-current="page"` and a submission's page marks Quotes. New quote, Home, Leads and Accounts are not listed until the stories that build them (D-38). At phone width the menu is a button that opens it over the page. The menu's items are data (`menu.ts`); Quotes and Inbox carry a **menu count**, a small badge. Inbox opens the queue with the address parameter `mail=new`, which the queue reads as the filter "has new PEO mail" (CRM-S3.5a) and rewrites as `filter=has_new_peo_mail:is:true`; the menu marks Inbox for either spelling.
_Avoid_: layout, sidebar (in screen words)

**Menu count** (code: `menu_counts()`, `useMenuCounts`):
The small number beside a menu item (story CRM-S1.1c, D-39). Today there are two. **Quotes** counts quote requests sent and not yet answered (status `sent`), on the intakes the person may see; an intake sent to three PEOs counts three. **Inbox** counts intakes with new PEO mail: the same rows the queue marks and its "has new PEO mail" filter shows (the rows Inbox opens), by the one rule `quote_requests_with_new_peo_mail()` (mail a person at the PEO wrote, not an automatic reply, after any advisor last opened that thread), so an intake with two unread threads counts once, and an empty guest draft the queue hides is counted by neither (D-133). **Leads** has no count until CRM-L1.1. Zero shows no badge, more than 99 shows "99+", and a screen reader hears the link as "Quotes, 4 open" or "Inbox, 2 with new mail" with the real number. The numbers are read in one database call for the firm the address names, refreshed when the window gets focus and every 60 seconds; a failed refresh keeps the last numbers without an error, and the numbers go only once refreshes have been failing for five minutes, never merely because a tab sat in the background (D-134). Opening a thread that clears the mark, recording a send, a quote answer or a status change refreshes them at once.
_Avoid_: notification count, unread count (it counts intakes, not messages)

**Workspace look** (code: the `theme-workspace` class, `src/index.css`):
The grey page, white cards, blue actions and dark navy menu of `docs/prd-screens/`. The shell puts the class on the document's root element while it is mounted, so a dialog or sheet drawn outside the shell takes the look; the employer's intake and the landing page never have it (D-41).

**Workspace form** (code: `src/components/workspace/form/`):
The one way a workspace form validates, reports and closes (CRM-S4.1, D-51). A required field says "Required" in words under its label; an error shows under its field when the person leaves it or presses save, and the first field in error takes the focus; Save is never disabled to point at an error, only while a save is in flight. A failed save keeps everything typed, says what failed beside the form's buttons and never closes the form; a refusal that belongs to one field shows under that field. Closing with unsaved changes asks first (Cancel, Escape, a dialog's close, moving to another page, the browser's leave-page prompt), and never after a save. "Edit" on a record turns its details into fields in place, with Save and Cancel.

**Current firm** (code: `currentFirm()`, `src/lib/currentFirm.ts`):
The one firm the console acts for, from the person's own memberships and the address they are at: at a firm's address that address's firm, which must be one of theirs, whatever other firms they belong to (it says so, so a member route can keep them out); on the bare domain the firm of a member of exactly one. A person with no current firm (none, not this firm's, or several on the bare domain) is kept out. The guard, the header's links and the pages that offer an owner-only view all ask it.
_Avoid_: active firm, selected firm

**Platform page** (code: `RequirePlatformAdmin`):
A page that is platform-wide and not a firm's: the firms waiting for approval, who gets the advisor role by organisation, held mail. Opened by a platform admin and by no one else, a member of a firm included; and opening one is no way into a firm's console (D-16).

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
The code in a referral partner's link (`?ref=`), which names that partner in the Advisor Console. A partner and its code belong to one firm, and two firms may each use the same code for their own partner. It never changes once given, because links carrying it are already out. A code no partner has is still kept, and shows as unlisted. A code is matched to a partner only within the intake's own firm, so another firm's code on an intake attributes it to nobody. See **Referral link**.
_Avoid_: promo code, tracking code

**Referral link** (code: `partnerLink`, `referralLinksWork`):
The site's front page with a referral partner's code. Every intake a browser starts belongs to the default firm (D-101), so a link reaches only the default firm: the Referral Partners page shows and copies one only for that firm. For any other firm it keeps the partner and its code and says links come when the firm can take intakes (New quote, Epic 5).
_Avoid_: tracking link, affiliate link

**Second factor**:
The extra step, after a password, that proves it is the advisor signing in: the 6-digit code from an authenticator app. It is required when *this sign-in* used a password, not whenever the account has one; a sign-in through Google or Microsoft relies on that provider's and is never asked. Without it a password sign-in opens nothing of the Advisor Console, and the database refuses it, not only the screen. Prospects and guests are never asked: no employer is ever asked for a second factor.
_Avoid_: two-factor, 2FA, MFA (in anything a person reads)

**Authenticator app**:
The phone app (Google Authenticator, Microsoft Authenticator, 1Password and the like) that shows the second factor's code. An advisor sets one up once, by scanning a code or typing its key, and enters its code at each later password sign-in.
_Avoid_: token, OTP app

**Assurance level** (aal):
How far this sign-in has proved who it is, as Supabase Auth writes it in the sign-in token: `aal1` is one step, `aal2` is a second factor completed in this sign-in. A password sign-in at `aal1` is refused advisor access; at `aal2` it is let in. The token's `amr` lists how the sign-in began (a password, a provider, a code).
_Avoid_: security level, trust level

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
Where an intake stands in the advisors' work, from draft through submitted, under review, information requested, ready for market, sent to PEOs and quoted, to won, lost or archived. Advisors move it one step at a time, along the allow-list in `docs/ADVISOR_ACCESS.md`; an archived intake is reopened as submitted. Two moves are made by recording something instead (ADR 0026): a send recorded while it is Ready for market moves it to Sent to PEOs, and a quote recorded while it is Sent to PEOs moves it to Quoted, each in the same transaction as the record and only from that exact stage (see **Move cause**).
_Avoid_: status, intake status, workflow status

**Lost reason** (code: `opportunities.lost_reason`, `lost_note`; story CRM-O1.3a, D-468):
Why a search was lost, asked when it is marked lost: stayed with current provider, price, went direct to a PEO, no decision, or other (other needs a note saying why; any note is at most 500 characters). Kept on the opportunity while it is lost, whether the loss is the submission's (it has an intake) or the opportunity's own (it has none), and cleared by a reopen; the **Record history** keeps it. Nothing is chosen from outside the list.
_Avoid_: lost because, loss code, status reason

**Close reason** (code: `quote_requests.close_reason`; story CRM-O1.3a, D-464):
Why a quote request was closed by a win or a loss: `went_elsewhere` ("the employer went elsewhere": another quote was chosen) or `search_ended` (the opportunity was lost). Empty for a quote request an advisor closed by hand and for one that is not closed; sending the packet to that PEO again opens the request and clears it. A quote that declined stays declined and is never closed by either.
_Avoid_: reason closed, withdrawn

**Commission basis** (code: `placements.commission_basis`, `commission_rate`, `commission_expected_yearly`; story CRM-O1.3a, Q-4.1, D-466):
How the commission a placement expects is worked out: `share` (a percent of the PEO's admin fee, per employee per month: typed as 20 for 20%, above 0 and at most 100), `per_employee` (dollars per employee per month, above 0) or `flat` (dollars a year, above 0), with the figure expected a year, which the dialog works out ((percent / 100) x admin fee x employees x 12, or per employee x employees x 12, or the flat figure; to the cent) and the person may overwrite. All optional, and a yearly figure needs its basis. Kept as typed, in dollars and cents.
_Avoid_: commission rate (the rate is only the number), fee, split

**Commission payment** (code: `commission_payments`; story CRM-O1.3a, Q-4.1, D-467):
Commission the firm received against a placement: the day, an amount above zero (to the cent) and a note (at most 500). Seen only by the firm, never by a prospect or a PEO: read by whoever may see the account, recorded, edited and deleted only through functions by whoever may change the opportunity the placement was won on (for a placement the firm made by hand, whoever may change its account), each from a version, with a history. A win's placement with payments is not deleted by a reopen ("Delete its payments first").
_Avoid_: payout, invoice, receipt

**Won**:
The pipeline stage of a submission whose employer took one of its quotes, which the submission names. A submission on an opportunity is marked won only through the opportunity (`opportunity_mark_won`: the quote chosen, the other open quotes closed, the placement and its renewal made, all or none), and reopened only by `opportunity_reopen` (ADR 0027).
_Avoid_: closed, placed, converted

**Lost**:
The pipeline stage of a submission whose search ended without the employer taking a quote. A submission on an opportunity is marked lost only through the opportunity (`opportunity_mark_lost`, with a **Lost reason**), which closes its open quotes with the reason `search_ended`.
_Avoid_: closed, dead, rejected (a PEO declines; a submission is lost)

**Quote request status**:
Where one PEO's quote request stands: sent (the packet went and the PEO hasn't answered; a quote request in this status is waiting), quoted, declined, or closed (withdrawn by an advisor or by the prospect withdrawing that PEO's market authorization, expired, or the employer went elsewhere). A closed quote request goes back to sent when the packet is sent to that PEO again. A closed request may carry a **Close reason**. A question from the PEO's underwriter is a quote request note and doesn't change its status; nor does a message arriving on the thread.
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
- A **PEO** has zero or more **Requirement profile** versions, at most one a draft; the newest published one is in use, and each version names zero or more **PEO contacts**
- An **Eligibility check** compares an **Intake**'s answers with the rules of a **PEO**'s **Requirement profile** in use
- A **Submission** is or isn't **Complete for a PEO** by its last certified version, against that PEO's **Requirement profile** in use
- An **Intake** holds at most one answer per **Extra question** per PEO; a **Certification** keeps them with their wording, and each PEO's go only into its **Supplement**
- A **Quote request** has one **Thread** and one reply address at a time; a message to an address that no longer belongs to a quote request goes to the **Holding list**
- A **Submission** has at most one **Market authorization**, naming zero or more PEOs; a PEO it doesn't name, or no longer names, can't be sent to
- A **Submission** that is won names the **Quote request** whose **Quote** the employer took; its other open **Quote requests** close, as all of them do when it is lost or archived
