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
_Avoid_: quote (a quote is what a PEO returns on a quote request), submission, RFP, deal

**Thread**:
Every email sent and received about one quote request, read newest first on its timeline with its sends, status changes and quote request notes; corrections to the quote request's fields stay in its change log. A submission's threads can also be read together on one combined timeline, each entry naming its PEO. A message the product sends for a broker through their **connected mailbox** lists the reply address first in Reply-To and the broker's own address second, so a plain Reply reaches the thread and their inbox. Mail reaches a thread through the quote request's reply address: the File ID, the PEO's short name and an unguessable part, on a subdomain of nevermorepeo.com. The address keeps receiving after the quote request closes, until the intake is deleted or an advisor revokes and reissues it. A message to it joins the thread whoever sent it, with a sender not seen before marked as new, an automatic reply marked as one, and an advisor's own copied-in email marked as sent by hand. Mail a person at the PEO wrote sets a "new PEO mail" mark, one for the whole team, until any advisor opens the thread. Messages are shown as plain text, and an attachment that fails its malware scan is blocked while the rest of the message stays readable. An arriving message never changes the quote request status. Kept and deleted with the intake; the prospect never sees it.
_Avoid_: conversation, inbox, chain

**Connected mailbox**:
A broker's own Google or Microsoft mailbox, which they let the product send through, so a message to a PEO is from their real address and sits in their own Sent folder. The permission is send only: the product never reads the mailbox, so a PEO's reply reaches the **thread** only through the quote request's reply address, which every such message lists first in Reply-To, with the broker's own address second. A broker connects it when they sign in with Google or Microsoft on the broker sign-in page, which asks for send permission at the same time; the prospect sign-in page never asks. A broker can decline the permission and keeps an account, and then sends from their own mail with the reply address in CC. The product keeps only the token that lets it send, never a password, and deletes it when the broker disconnects or leaves. Not built yet (joshrkay/Nevermore#92).
_Avoid_: linked account, email integration, inbox connection

**Quote request note**:
A dated entry an advisor adds to a quote request's timeline for something that happened outside the product, with its kind: a call, a portal entry, an email sent elsewhere, an underwriter's question, or other. It changes nothing else: it never records a send or changes the quote request status, and it can be added to a closed quote request, which stays closed. It can be corrected, and each correction is logged. The quote request's own single note stays beside it, as the request's summary.
_Avoid_: activity, log entry, comment

**Holding list**:
Mail that arrived for a reply address that was revoked or never issued, or that an advisor moved off a thread it didn't belong to. Only an admin assigns a held message to a quote request or discards it; nothing is attached by guesswork. A message nobody assigns is deleted after 30 days, and its sender gets no reply. One ops alert is raised when the list stops being empty.
_Avoid_: unmatched inbox, spam folder, quarantine (quarantine holds files waiting for or failing a malware scan)

**Market authorization**:
The prospect's recorded yes to sending their packet and supporting documents to the PEOs they picked: the PEOs, the wording and its version, who signed and when. Distinct from **Certification** (the answers are true) and the intake consent (how their information is used). It names PEOs, not a packet version, so certifying again leaves it in place. It names only PEOs on the product's list, each one by name: there is no "any PEO my advisor chooses". The prospect can add a PEO or withdraw one at any time, and each change is appended, never edited. An advisor who wants another PEO asks through an information request, and the prospect adds it themselves. No send to a PEO is possible without one. Withdrawing a PEO closes its quote request, revokes its download link, and marks the submission as needing advisor action so an advisor tells the PEO; after that an advisor can still write to that PEO, but with no document or link. A new version of the wording leaves signed authorizations in place. A prospect who accepted the intake consent from before the product sent to PEOs accepts the new one before the authorization is offered. Counsel cleared it (QP-D1) on 2026-11-11 and writes its wording; not built yet (joshrkay/Nevermore#85, #92).
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
The email telling the advisory team that a submission arrived or was updated.
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

**Firm sign-up** (code: `sign_up_firm`, `/firms/new`):
A signed-in person with a verified email gives a firm name and a firm address and becomes the firm's first owner in one step. The firm exists at once and its members can work, but it is waiting for approval: it cannot send to a PEO until a platform admin approves it (Q-1.2). The address is read as every firm address is (lower case, no surrounding spaces) and the address rules of the table apply. A person has one firm waiting for approval at a time: signing up another is refused until the first is decided (D-30).

**Waiting for approval** (code: `firms.approved_at` empty and `firms.decision` empty):
A firm that has signed up and has no decision yet. A platform admin sees these through `admin_waiting_firms`, oldest first, and no other way (D-16). Each shows who signed the firm up, kept on the firm (`firms.signed_up_by`) when it was signed up: it stays that person if ownership later passes to someone else.

**Firm decision** (code: `admin_decide_firm`, `firms.decision`, `decided_at`, `decided_by`, `decision_note`):
A platform admin's approval or refusal of a waiting firm, with an optional note. Approving sets `approved_at`; refusing leaves it empty. A firm is decided once, and an admin does not decide on a firm they belong to. A refused firm is hidden at its address and its founder is not let in there, yet the address stays taken (D-31). The event is written through `record_firm_event`, the one small function the record of who did what (CRM-P2.3) takes over.

**Public firm name** (code: `firm_public_name`):
What a firm's address shows before anyone signs in: the firm's name, and nothing else, for any firm that exists and is not refused, approved or still waiting for approval (a waiting firm's members can work before approval; approval gates sending, not signing in). An address no firm holds, or one a refused firm holds (D-31), gives nothing, and it shows a plain not-found page to everyone, with no sign-in and no sign-in callback pages (D-27). Firms have no logo field yet.

**Not a member screen**:
What a signed-in person sees at a firm's address when they are not a current member of that firm: "You aren't a member of this firm", a way to sign out, and nothing else, whichever firm they do belong to. `is_member_of_firm_address` answers about the caller only, and false for a refused firm's address. The database, not this screen, refuses them the data (D-18).

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
A person's place in a firm, with a role, an optional team and the dates it began and ended. It is never changed: a change ends one row and adds another, so who could see a record on a given day can be answered. A person holds one membership of a firm at a time, and a firm always keeps at least one current owner. A **current member** is one whose membership has begun and not ended; `is_firm_member` and `firm_role` answer for the caller.
_Avoid_: seat, user (for a member)

**Invitation** (code: `firm_invitations`, `invite_member`, `accept_invitation`):
An owner's offer of a place in a firm to an email address, with a role (and, in the database, a team). It is single-use and lasts seven days. It is **pending** until it is accepted or withdrawn; one that has run out stays pending, shown as expired, for an owner to resend or withdraw. Only a hash of its token is stored. An owner of that firm, a current one, alone can make, resend or withdraw it (D-18). Accepting it, as the person signed in with that email (verified), adds a dated membership. At most one is pending per firm and email (D-29). A firm still waiting for approval can invite and be joined, but holds at most five pending invitations and causes at most ten invitation emails (made or resent, withdrawn ones still counted) until it is approved; a refused firm cannot invite or resend, and a pending invitation to it cannot be accepted (D-34).
_Avoid_: invite (as the noun), request to join (that is joining by organisation, CRM-P1.4)

**Invitation link** (code: `/join#token=...`, `JoinFirmPage`):
The link in an invitation's email, opened at the firm's own address. The secret in it is made by the `invite-member` server function, sent once in that email and never stored, returned or logged. It is in the part after the `#`, which a browser never sends to a server, so no request log and no Referer holds it and no route contains it; the page reads it, removes it from the address bar at once, and keeps it only in that tab until the person has joined. The browser hashes it before asking the database to accept, and gives the database the address it was opened at: the link is accepted only at the address of the firm it belongs to (D-34). A link that is used, expired, withdrawn or replaced by a resend opens nothing and says so in plain words, in the same words whether or not the invited email has an account.
_Avoid_: magic link, invite code, join URL (as if the secret were in the path)

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
The member a firm's record (a lead, an account, an opportunity, a quote) belongs to, and so who sees it by level. An intake has none in Epic 1 (D-15): every current member of its firm reads it.
_Avoid_: assignee, creator

**Visibility helper** (code: `can_see_firm_record(firm, owner)`):
The one question every firm-owned table asks of the caller: may they see a record of this firm that this person owns? Yes for a current member of a firm set to "everyone sees everything"; otherwise by level: an owner sees the firm's, a lead the records of members of their own team (the one on their membership) and of every team under it, an agent their own. A record with no owner, or whose owner has left, is an owner's alone. Anyone who is not a current member of the firm, a platform admin and a guest token included, sees nothing.
_Avoid_: permission check, ACL

**Firm rule** (code: the policies that call `is_firm_member` or a helper built on it):
A row-security or storage policy that requires current membership of the row's firm, reached through the intake or the quote request when the row has no firm of its own. A password sign-in that has not completed a second factor is not a member to it (D-19): `firm_role` asks the same rule as `has_role`, so no firm's data opens without it. Every table that holds a firm's data has one, and the isolation test fails a table that has none. A table of the PEO list, monitoring or the platform's own bookkeeping is declared platform-wide there instead.
_Avoid_: tenant filter, RLS (on its own)

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
A firm's record of who did what: one row for each sign-in to the firm's console, submission opened, file downloaded, send recorded, export, invitation, removal, support access and membership, role or ownership change, with who did it, when, the kind and the id of the record it was about. Never content: no answer, name, email text or file. Nobody can change or delete a row, an admin included; the daily retention job removes entries after 90 days (D4). A firm's current owners read their own firm's and nobody else does, a platform admin included (D-16). Written only through `record_firm_activity` (server code; no actor argument), `open_submission` (the function that hands a submission to a member: the database writes the opening itself, so a browser cannot report a view it did not make), `record_member_activity` (a browser, for exact pairs of kind and record only, a repeat within 30 seconds being one entry) and, for membership changes, the triggers, which write through the internal `firm_activity_append`. The limit: a file saved from a storage link, or built in the browser (census, JSON, PDF, bundle), and a sign-in are seen only by the browser, so a member can still report one that did not happen; the entry says the person reported it, not that the database served it (the storage service signs the link, outside the database, and cannot write an entry). A membership entry records when the change was made, not when it takes effect: an end given a date in the future is written at once, and nothing is written when the date arrives. All of them take the firm from the record and the actor from the caller's own sign-in; nothing takes either from the caller. An owner reads only after the second factor (D-19), the rule written once in `can_read_firm_activity`. Read a page at a time by a cursor of time and a random key, never by an offset and never by the table's number, which is shared by every firm and so is never given to a reader.
_Avoid_: audit log, access log, activity feed, history (a submission's status history is a different record)

**Retention role** (code: `firm_activity_pruner`):
The one database role allowed to delete a firm-record entry, and only past the window. It cannot sign in, no API role belongs to it, and only `prune_firm_activity()` runs as it; a delete is allowed by who is running it, never by a setting a caller can make (ADR 0012).
_Avoid_: admin delete, purge flag

**Record cursor**:
Where a page of the firm's record starts: after the entry with a given time and id, the two things the record is ordered by, so an entry arriving between two pages never repeats or skips a row.
_Avoid_: offset, page number (as the way a page is found)

**Owned firm**:
A firm the caller is a current owner of, as the database answers (`my_owner_firms()`). A page that reads a firm's record says which firm it wants, and the database checks the caller currently owns that one; there is no "the caller's firm" for someone who owns two.

**Entry kind** (code: `firm_activity.kind`):
What sort of thing an entry records: `sign_in`, `submission_viewed`, `document_downloaded`, `packet_downloaded`, `send_recorded`, `member_added`, `member_ended`, `owner_added`, `owner_ended`, and the ones later stories write: `export_made`, `invitation_sent`, `member_removed`, `support_access`. A firm's sign-up and its approval or refusal are `firm_signed_up`, `firm_approved` and `firm_refused`, an invitation withdrawn is `invitation_withdrawn` (one made or resent is `invitation_sent`, and one accepted is the `member_added` the membership trigger writes), written through `record_firm_event` with no address and no note. A role change shows as a member ended and a member added; a change to an owner has its own two kinds.

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
Where an intake stands in the advisors' work, from draft through submitted, under review, information requested, ready for market, sent to PEOs and quoted, to won, lost or archived. Advisors move it one step at a time, along the allow-list in `docs/ADVISOR_ACCESS.md`; an archived intake is reopened as submitted.
_Avoid_: status, intake status, workflow status

**Won**:
The pipeline stage of a submission whose employer took one of its quotes, which the submission names.
_Avoid_: closed, placed, converted

**Lost**:
The pipeline stage of a submission whose search ended without the employer taking a quote.
_Avoid_: closed, dead, rejected (a PEO declines; a submission is lost)

**Quote request status**:
Where one PEO's quote request stands: sent (the packet went and the PEO hasn't answered; a quote request in this status is waiting), quoted, declined, or closed (withdrawn by an advisor or by the prospect withdrawing that PEO's market authorization, expired, or the employer went elsewhere). A closed quote request goes back to sent when the packet is sent to that PEO again. A question from the PEO's underwriter is a quote request note and doesn't change its status; nor does a message arriving on the thread.
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
