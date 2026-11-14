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
The member a firm's record (a lead, an account, an opportunity, a quote) belongs to, and so who sees it by level. An intake has none in Epic 1 (D-15): every current member of its firm reads it.
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
A firm's record of who did what: one row for each sign-in to the firm's console, submission opened, file downloaded, send recorded, export, invitation, removal, support access and membership, role or ownership change, with who did it, when, the kind and the id of the record it was about. Never content: no answer, name, email text or file. Nobody can change or delete a row, an admin included; the daily retention job removes entries after 90 days (D4). A firm's current owners read their own firm's and nobody else does, a platform admin included (D-16). Written only through `record_firm_activity` (server code; no actor argument), `open_submission` (the function that hands a submission to a member: the database writes the opening itself, so a browser cannot report a view it did not make), `record_member_activity` (a browser, for exact pairs of kind and record only, a repeat within 30 seconds being one entry) and, for membership changes, the triggers, which write through the internal `firm_activity_append`. The limit: a file saved from a storage link, or built in the browser (census, JSON, PDF, bundle), and a sign-in are seen only by the browser, so a member can still report one that did not happen; the entry says the person reported it, not that the database served it (the storage service signs the link, outside the database, and cannot write an entry). A membership entry records when the change was made, not when it takes effect: an end given a date in the future is written at once, and nothing is written when the date arrives. All of them take the firm from the record and the actor from the caller's own sign-in; nothing takes either from the caller. An owner reads only after the second factor (D-19), the rule written once in `can_read_firm_activity`. Read a page at a time by a cursor of time and a random key, never by an offset and never by the table's number, which is shared by every firm and so is never given to a reader.
_Avoid_: audit log, access log, activity feed, history (a submission's status history is a different record)

**Record history** (code: `record_history`, read by `record_history_list`):
What happened to one record of a firm's (today a referral partner; later a lead, account, contact or opportunity): who created it and when, and every change to its own fields, each as who, when, the field, the value before and the value after. It holds only the fields a trigger was told to track, named in the migration that attaches `record_history_capture`, so an intake's answers (which keep their own history as today) and a record's created and updated stamps can never enter it. It starts when it shipped: nothing before then is backfilled, so a record made earlier shows its first change as the first entry. Nobody edits it: no API role can write the table, and a trigger refuses every change, every emptying of the table and every deletion except one made by the role `record_history_remover` (no login, no API role belongs to it, read and delete on this table only, ADR 0012), which only `record_history_remove` acts as. That function deletes a record's history once the record is gone, and a firm's while the firm is closing, which `firm_closing_plan()` and `close_firm_now` do; no setting a caller can make allows a deletion, and only a superuser who becomes the role can still delete. `record_history_track` attaches the capture trigger and the guard against emptying the table together, and refuses at attach time a table, key column or field that does not exist. Read by whoever may see the record (for a referral partner, any current member of the firm, and a support session), through the function only, one record at a time, newest first, a page at a time by a cursor of time and random key. It shows who as the member's email, "Nevermore" for a platform admin who was not a member (no name, email or id, D-33) and "System" for the server. A value is stored as it is (text, number, date as ISO text, true or false); a time is stored in UTC in one fixed form whatever the writer's time zone, so the same instant reads the same; no value reads back as nothing, never as the word "null", and a JSON null inside a jsonb column and no value (SQL null) are the same to the history, so changing from one to the other is no change. A record is named by its key within its firm: a single column's value, or for several columns a compact JSON array of the parts, which is what a caller passes as the key.
_Avoid_: audit log, activity (the firm's record of who did what is a different thing: see below), change log, version (D-46's whole-number version is a different thing)

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

**Built-in view**:
A view a table ships with (for the queue, today's status tabs), written in the page's code, not kept as a row, so it can't be deleted or shared. Its columns are the person's column choice for the table.
_Avoid_: default view (the table's default sort and columns are something else)

**Column choice** (code: `table_preferences`, `my_table_columns`, `set_my_table_columns`):
Which columns a person shows on a table, in what order, kept in the database per firm, person and table, so it follows them to any device (D-43); nothing is kept in the browser. A person may also keep their own choice on a saved view they can read, which wins for them alone. What they see on a saved view is, in order: their own choice for that view, the view's own columns, their choice for the table, the table's defaults.
_Avoid_: layout, column settings, preferences (on its own)

**Entry kind** (code: `firm_activity.kind`):
What sort of thing an entry records: `sign_in`, `submission_viewed`, `document_downloaded`, `packet_downloaded`, `send_recorded`, `member_added`, `member_ended`, `owner_added`, `owner_ended`, and the ones later stories write: `export_made`, `invitation_sent`, `member_removed`, `support_access`. Removing a member writes `member_removed`, suspending one `member_suspended` and lifting it `member_restored`, each with who did it and to whom (and instead of, not as well as, the `member_ended` or `owner_added` that ending and beginning a membership would write). A firm's sign-up and its approval or refusal are `firm_signed_up`, `firm_approved` and `firm_refused`, an invitation withdrawn is `invitation_withdrawn` (one made or resent is `invitation_sent`, and one accepted is the `member_added` the membership trigger writes), written through `record_firm_event` with no address and no note. A role change shows as a member ended and a member added; a change to an owner has its own two kinds.

### Advisors

**Advisor Console**:
The advisory team's operating workflow: every submission with its pipeline stage, notes and history. The team works submissions here, not in a separate CRM. Since the firms stories it is **the firm's console**: it opens for a current member of a firm (never because of a platform role: **Firm guard**), and shows only that firm's records. The routes keep their `/advisor` paths until the screens that replace them ship (D-8).
_Avoid_: CRM, admin queue

**Table query** (code: `queue_list_submissions`, `queue_view_counts`; the shapes in `src/lib/tableQuery.ts`):
How a workspace table asks the database for its rows (D-44): a list of **filters**, one **sort**, a page number and the search, answered with one page of 50 rows and how many match in all. The database holds each table's **fields**, a fixed list naming each field's kind (text, number, date, one choice, several choices, yes or no, person), and refuses a field, operator or value it doesn't take, with the reason; it never drops one, since a dropped filter shows more rows than were asked for. Built first for the submissions queue (CRM-S3.3b); the accounts, leads and quotes tables copy it. The page's **table address** is what the query is built from: the view's filters and the address's own, the sort, the page and the search (CRM-S3.5a).
_Avoid_: dynamic query, search (a search is the words typed in the search box, which is one part of the query)

**Table frame** (code: `src/components/workspace/table/`; story CRM-S3.5a):
The one piece every workspace table is drawn with: its **table address** read from the page, its rows fetched through the query library (asked again on focus and every 60 seconds, the rows staying on screen while the next arrive), the table itself, and the pager. A table gives the frame a **column definition** list and its fields (a constant: what a cell needs besides its row comes through the frame's `context`); the frame owns what a view means for the query (the view's filters, then the address's, within the 20 the database takes) and draws the view tabs; the frame leaves named places for what later stories add: `empty` and `error` (Epic 2's page-state stories), the filter row, the columns menu, saved views and row selection. The queue is the first table on it.
_Avoid_: grid, data table (in screen words, say "table")

**Loading state** (code: `src/components/workspace/states/`; story CRM-S2.1, D-143 to D-146):
What a page shows while it has nothing to show yet. The page's frame (menu, title, tabs, toolbar, column headers, a record's panel headings) is drawn at once; only the data area holds grey placeholders. A table shows eight grey rows inside its real table under its real headers, each cell shaped like its column; a record shows grey lines where each field and list will be. A screen reader hears one polite status, "Loading submissions" (or the page's name), on the page empty from the first draw and filled just after, never row by row, and the placeholders are hidden from it. The table frame draws one table always (grey rows in its body, then the real rows), so focus and the scroll position survive. It is not shown for a refresh, a focus refetch or the next page over rows already on screen (D-49), and the shimmer stops for a person who asked for less motion. Controls that change the question (search, filters, tabs, sort) stay usable meanwhile; the pager, Refresh and anything acting on rows wait for the data, as `aria-disabled` controls that say why (D-143). Rows already on screen that answer another question are dimmed and marked busy, not replaced by grey rows (D-144).
_Avoid_: spinner (a spinner is what this replaces), skeleton (in screen words)

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
One condition on one field of a table, by an operator its kind takes: text (contains, is, is empty), number (is, more than, less than, between), date (on, before, after, between, in the next or last N days, each a day in the person's time zone), one or several choices (any of, none of, is empty), yes or no (is), person (any of, me, my team: refused until records have an owner, CRM-A1.1). Text and choices ignore case; a between takes its ends in either order. A table's filters combine with "and".

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
