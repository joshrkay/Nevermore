# The quoting platform: user stories

| | |
|---|---|
| **Version** | 0.1, a first draft for the founder to cut, reorder and challenge |
| **Date** | 2026-11-11 |
| **Scope** | Everything between today's intake and a two-sided marketplace: the common questions, the reverse map onto each PEO's ask, sending submissions, what comes back, the broker side, and the PEO side |
| **Depends on** | `docs/research/2026-11-10-peo-quoting-platform.md` (the evidence), `docs/PRODUCTION_READINESS_PLAN.md` (what is built; its epics 0 and A to J, decisions D1 to D44), `docs/GO_TO_MARKET.md`, `docs/LEGAL_REVIEW.md` |

Stories follow the readiness plan's rules: sizes are **S** (0.5 to 1.5 engineer-days) or **M** (2 to 4), never
larger; owners are `FE`, `BE`, `FS`, `PM`, `DES`, `LEGAL`, `OPS`. Every story here is NOT STARTED unless it says
what it builds on. The epics continue the readiness plan's letters from K (O is skipped, to avoid reading it as 0).

Each schema or table change ships as its own migration first, with a SQL test, and keeps the browser and database
rules equal through `src/data/schemaSync.test.ts`, as every existing story does. That is not repeated per story.

---

## 1. Where this is going

**The destination.** A broker enters an employer's information once, or has the employer do it with Lenore. The
product knows what each PEO asks for, says what is still missing for each one, and sends each PEO a complete,
certified submission in that PEO's own layout by email. Replies, questions, quotes and declines come back onto the
thread they belong to. The broker and the employer compare the quotes on the same lines. Every step is recorded:
who sent what to whom, when, and what came back.

**It is not a rater.** Each PEO's underwriters still price. Nothing here computes a price.

**Why each side shows up.**

| Side | What they get | What they have to change |
|---|---|---|
| **Brokers** | One entry instead of one per PEO. Each PEO's census and forms produced for them. A board of every submission and every PEO's answer. A comparison to show the client. A dated record that they submitted first | Where they keep their pipeline |
| **Employers** | Answer once. See exactly what is open. Compare quotes on the same lines | Nothing: this is today's intake |
| **PEOs** | Complete, certified submissions in their own layout, with open items listed. Fewer emails per quote. Later: a say in what they are sent, and a view of what arrives | Nothing at first. They receive an email |

**How the market starts.** Brokers first. A broker brings the PEO relationships they already have, so the product
needs no agreement with any PEO to be useful. Every submission a broker sends is also the product's introduction
to that PEO's sales desk: the PEO side is recruited by the email, not by a sales call. PEO accounts (Epic R) come
only after PEOs are already receiving submissions and have a reason to shape them.

**Neutrality is a product rule.** No PEO pays to be listed, ranked or recommended, and nothing is ordered by what
a PEO pays a broker. PEOs paying per submission stays ruled out (`docs/GO_TO_MARKET.md`, Model D).

---

## 2. Decisions needed before the stories they gate

| ID | Decision | Recommended | Owner | Gates |
|---|---|---|---|---|
| QP-D1 | May the product send a submission to a PEO for a broker or an employer, and under what authorization and disclosure? Reverses D9 and D44 | Yes, with a recorded authorization naming each PEO | Founder + LEGAL | Epic M |
| QP-D2 | May the product show quotes from different PEOs side by side, to a broker and to an employer? Does that need a license in any state? | Show to brokers first; to employers once counsel answers | LEGAL | N-3.x |
| QP-D3 | Who an outside broker is in our vocabulary, and what happens to **Advisor** | A **Firm** has **Brokers**; Edgar Allan Advisory is a firm whose brokers are still called advisors in its own copy | PM | Epic P |
| QP-D4 | Does a broker's intake belong to the firm, the employer, or both? Who may delete it? | The employer owns the answers; the firm has access the employer granted and can lose | PM + LEGAL | P-2.x |
| QP-D5 | Which PEOs first | Three to five whose real forms we can read and whose desks will talk to us | PM + advisory lead | Epic L |
| QP-D6 | The group health questionnaire: collect it or not | Not until counsel answers legal question 7 | LEGAL | K-4.3 |
| QP-D7 | How brokers pay, if at all, in the pilot | Free for the pilot; price after the numbers exist | Founder | Epic P launch |
| QP-D8 | Whether the product may name PEOs in broker-facing screens (the copy guard forbids it on the public site) | Yes inside signed-in broker screens; the public site stays as it is | LEGAL + PM | Epic L |
| QP-D9 | Inbound email provider | Check whether the current provider receives mail; otherwise add one for inbound only | OPS + BE | M-3.x |

---

## 3. Words these stories use

Existing terms mean what `GLOSSARY.md` says. Proposed new ones, to settle under QP-D3 before any code:

| Term | Meaning |
|---|---|
| **Firm** | A brokerage or advisory whose members work submissions together. Each intake a firm works is visible only to that firm and its prospect |
| **Broker** | A member of a firm. Today's Advisor is a broker of the firm Edgar Allan Advisory |
| **Requirement profile** | What one PEO asks for in order to quote: answers, census columns and layout, its own extra questions, documents, what it won't take on, and where to send a submission. Dated and versioned |
| **Common questions** | The union of every requirement profile's answers: what the intake asks |
| **PEO contact** | A person at a PEO a submission is sent to |
| **Thread** | Every email sent and received about one quote request |
| **Suggestion** | What the product read out of an email or a quote document, which changes nothing until a broker accepts it |
| **Comparison** | The quotes on one submission laid out on the same lines |
| **Registration** | The dated record that a firm submitted an employer to a PEO |

"Quote" keeps its glossary meaning. The file a PEO attaches is the **quote document**.

---

## 4. Epics and stories

### Epic K: The common questions

*The intake holds everything PEOs and their carriers already ask on their own forms, and asks it once.*

The gaps are listed in the research report, section 5.1.

#### K-1 Company

**K-1.1 Company identity answers.** S · FS
As a broker, I want the intake to hold the employer's FEIN, entity type, year founded, street address and website,
so that I never type them into a PEO's form.
- AC: each is a recommended field in intake schema v3 with a label, section and rank; the FEIN is validated as nine digits and shown masked except to the prospect and their firm.
- AC: Lenore can capture each from chat and from an uploaded document; each appears in Review and in the packet.
- AC: `multiple_entities` with more than one FEIN lets the prospect list each entity's legal name and FEIN.

**K-1.2 Industry as a code and a description.** S · FS
As an underwriter, I want an industry code and a plain description of what the business does, so that I can
classify it without a phone call.
- AC: the intake holds a NAICS code chosen from a search, and a description of operations of up to 1,000 characters; the existing free-text `industry` is kept and shown beside them.
- AC: Lenore proposes a code from the description as an inferred answer the prospect confirms.

**K-1.3 Current PEO.** S · FS
As a broker, I want to know whether the employer is in a PEO now, which one and when its agreement renews, so that
I ask for the right documents and don't submit them to their own PEO.
- AC: three recommended fields; "not in a PEO" closes the other two.

#### K-2 Census

**K-2.1 Census columns PEOs ask for.** M · FS
As a health underwriter, I want gender, hire date and COBRA status on every employee, so that I can rate the group.
- AC: the census row accepts `gender`, `hire_date`, `cobra` and `home_state`; the census template gains the columns; `document-extract` reads common spellings of each.
- AC: a census without them is still accepted; each missing column is one open item, not one per employee.

**K-2.2 Where and how each employee works.** S · FS
As a workers' comp underwriter, I want each employee's worksite, and whether they work remotely or travel, so that
I can assign class codes myself.
- AC: optional `worksite`, `remote` and `travels` on the census row, in the template and the extractor.

**K-2.3 Dependents from the file.** M · FS
As a broker, I want dependents read from the census file when it lists them, so that PEOs that want them one by one
get them.
- AC: the template documents one row per dependent linked to an employee; the extractor fills the `dependents` array that has no writer today (D21).
- AC: a census with tiers only is unchanged.

**K-2.4 Broker-entered census corrections.** S · FS · needs P-2.2
As a broker, I want to fix a census row the file got wrong, so that I don't re-upload for one typo.
- AC: a broker's edit is recorded with its source; the prospect sees it in Review before certifying.

#### K-3 Workers' compensation

**K-3.1 Owners and officers.** M · FS
As a workers' comp underwriter, I want each owner and officer with title, ownership share, duties and whether they
are covered, so that I can price inclusions and exclusions.
- AC: a list of up to 20 people with those answers, capturable by Lenore and editable in the workspace; shown in the packet's workers' comp section.

**K-3.2 Payroll by class code and state.** S · FS
As an underwriter, I want payroll and headcount for each class code in each state, so that I have the rating table.
- AC: computed from the census (class code, annual pay, work state, full or part time) and shown in the workspace and the packet; rows with no class code are totalled under "No class code yet" and listed as one open item.
- AC: the prospect can't type over it; it changes only when the census does.

**K-3.3 Loss history by year.** M · FS
As an underwriter, I want five policy years of carrier, premium, experience mod, number of claims, paid and
reserved, so that I can price without waiting for the loss runs to be read.
- AC: a list of up to five years with those answers; "no prior coverage" and "no claims" are answers.
- AC: an uploaded loss run proposes a year's figures as a document candidate the prospect applies; the valuation date is kept and shown.

**K-3.4 The standard workers' comp questions.** M · FS
As a broker, I want the yes/no questions every workers' comp application asks answered once, so that each PEO's
supplemental form is already filled.
- AC: the questions of ACORD 130's general information section are fields with an explanation when the answer is yes; the list is checked against the form itself, not from memory.
- AC: Lenore asks only the ones the employer's industry and class codes make relevant, and the rest are marked "Doesn't apply" by a rule the prospect can override.

#### K-4 Benefits and payroll

**K-4.1 Current medical plans.** M · FS
As a health underwriter, I want each current plan's name, carrier, rates by tier, employer contribution and
enrolment, so that I can show a side-by-side with what they pay now.
- AC: a list of plans with those answers; an uploaded invoice or renewal letter proposes them as document candidates.
- AC: renewal rates are held beside current rates when the employer has them.

**K-4.2 State unemployment rates.** S · FS
As a PEO pricing a quote, I want the employer's unemployment tax rate in each state, so that the tax line is right.
- AC: one rate and effective year per state of operation; an uploaded rate notice proposes it; a state with no rate is one open item.

**K-4.3 Group health questionnaire.** M · FS · **blocked by QP-D6**
As a broker, I want the health questionnaire some PEOs require answered once, so that I don't chase a signed form
per PEO.
- AC: not built until counsel answers; if built, the answers are visible only to the prospect, their firm and the PEOs they authorize, are never sent to the model that holds the conversation, and expire 90 days after signing.

#### K-5 Asking only what is needed

**K-5.1 Schema v3 and the published list.** S · BE
As a developer, I want the new fields in one versioned schema with the generated doc and tests the current schema
has, so that nothing drifts.
- AC: `docs/intake-schema.v3.json` and the generated tables in `docs/intake-schema.md`; a v2 intake opens and certifies unchanged.

**K-5.2 Lenore asks by relevance.** M · BE · needs L-1.1
As a prospect, I want Lenore to ask only what the PEOs I could go to need, so that a 20-person office isn't asked
about scaffolding.
- AC: the ask order is the required fields, then fields ranked by how many candidate requirement profiles need them, then the rest.
- AC: golden transcripts cover a low-hazard and a high-hazard employer.

**K-5.3 The packet covers every new answer.** S · FE
- AC: the test that fails when a schema field is neither in the packet nor deliberately excluded (D30) passes with v3.

---

### Epic L: Requirement profiles, the reverse map

*Each PEO's ask is data. The same data drives what is asked, what is missing, and what is produced.*

#### L-1 The profiles

**L-1.1 PEOs and their requirement profiles in the database.** M · BE
As the team, we want each PEO's ask stored as dated, versioned data, so that adding a PEO is not a code change.
- AC: a PEO table replaces the five names in `src/data/peoCatalog.ts`; a profile version names the answers needed to quote, the answers needed only before signing, the census columns, the documents, the eligibility rules, the PEO contacts and the date and source it was checked against.
- AC: a profile version is never edited after it is used; a change is a new version. Firms and prospects read them; only admins write.

**L-1.2 An editor for profiles.** M · FE · needs L-1.1
As an admin, I want to enter and update a PEO's profile from its own forms, so that maps are kept current without
an engineer.
- AC: each entry records its source (a document or a named person at the PEO) and date; a profile not checked in 180 days is marked stale wherever it is used.

**L-1.3 The first five profiles.** M · PM · needs QP-D5, L-1.2
- AC: five PEOs' profiles entered from their own published forms and a conversation with each one's broker desk; each PEO's actual census column list is on file.

**L-1.4 A firm's own notes on a PEO.** S · FS · needs P-1.1
As a broker, I want to record my own contact and my own standing with a PEO, so that submissions go to my rep.
- AC: a firm can add PEO contacts and a partner code per PEO, seen only by that firm; a firm can add a PEO that isn't listed, with no profile, and still send to it.

#### L-2 What is missing, per PEO

**L-2.1 Eligibility checks from real facts.** S · FS · needs L-1.1
As a broker, I want to know which PEOs will consider this employer before I send anything.
- AC: `peoFit` reads the profile's rules (minimum headcount, states, industries and class codes it won't take, minimum enrolment); each check says meets, does not meet or can't tell yet, with the rule's date.
- AC: nothing is ranked; PEOs are listed alphabetically within each outcome.

**L-2.2 Ready for this PEO.** M · FS · needs L-1.1
As a broker, I want each PEO's list of what is still missing, so that I know who I can send to today.
- AC: for each chosen PEO the submission page shows the open items its profile needs to quote, and separately the ones it needs only before signing.
- AC: one click turns a PEO's missing items into a draft information request to the prospect.

**L-2.3 A PEO's own extra questions.** M · FS · needs L-1.1
As a broker, I want a PEO's unusual questions asked only when that PEO is chosen.
- AC: a profile can define up to 30 extra questions (text, yes/no, number, choice); they appear in the intake when the PEO is chosen, are certified with the rest, and go only to that PEO.

#### L-3 What is produced, per PEO

**L-3.1 The census in a PEO's layout.** M · BE · needs L-1.1
As a broker, I want the census as a file in each PEO's own columns and order.
- AC: a profile's column map produces an .xlsx or .csv from the certified census; a column the intake can't fill is left blank and listed; a round-trip test per profile.
- AC: where a PEO requires its own template file, the output fills that file.

**L-3.2 The workers' comp application.** M · BE
As a broker, I want a filled ACORD 130 from the certified answers.
- AC: a PDF with applicant, locations, owners and officers, the rating table per state, prior carriers and loss history, nature of business and the general questions; blanks are listed, never guessed. Confirm we may reproduce the form.

**L-3.3 A machine-readable export.** S · BE
As a PEO or broker with their own system, I want the certified answers as JSON against the published schema.
- AC: a download beside the packet, for the prospect and their firm, with the File ID, version and certification.

**L-3.4 The submission bundle.** S · FS · needs L-3.1, L-3.2
As a broker, I want one click to assemble what a PEO needs: the packet, its census file, the workers' comp
application and the documents its profile lists.
- AC: the bundle names every file and every required document that is missing; it is built from one certified version and says which.

---

### Epic M: Sending submissions

*One quote request, one email thread, one address. Gated by QP-D1.*

#### M-1 Permission

**M-1.1 The employer authorizes each PEO.** M · FS · LEGAL
As a prospect, I want to say which PEOs may receive my packet, so that nothing about my employees goes anywhere I
didn't choose.
- AC: an authorization names each PEO, the version certified, who signed and when; it is kept like `intake_consents` and can be withdrawn for PEOs not yet sent to.
- AC: no send is possible for a PEO without one; the database refuses it, not only the screen.

**M-1.2 Consent, terms and the copy guard say what is true.** S · PM + LEGAL · needs QP-D1
- AC: the intake consent, the Terms, D9 and the banned phrases are changed together, in one release, to match the new role.

#### M-2 Sending

**M-2.1 Send to a PEO.** M · FS · needs M-1.1, L-3.4, M-3.1
As a broker, I want to send the bundle to a PEO contact from the submission page, with my own cover note.
- AC: sending creates or continues that PEO's quote request, records the version sent, and queues the email through the outbox with retries; the broker's name, firm and reply details are in the message.
- AC: a send that fails shows on the Outbox page with a retry, as other emails do.

**M-2.2 Send to several PEOs at once.** S · FE · needs M-2.1
- AC: one action sends to every chosen PEO that is authorized and ready, each on its own thread; no PEO sees another's address or name.

**M-2.3 Send an update.** S · FS · needs M-2.1
As a broker, I want to send a newer certified version on the same thread.
- AC: the queue's "older version sent" clears; the message says what changed, by field label.

**M-2.4 Follow up and withdraw.** S · FS · needs M-2.1
- AC: a follow-up and a withdrawal are sent on the same thread from templates the broker can edit; a withdrawal closes the quote request.

**M-2.5 Record what happened elsewhere.** S · FE
As a broker, I want to record a send, a call or a portal entry made outside the product.
- AC: today's hand-recorded quote request is kept, and a phone call or portal entry can be added to the timeline as a note with a date.

#### M-3 Threading

**M-3.1 A reply address per quote request.** M · BE + OPS · needs QP-D9
As the product, I need every reply about a quote request to land on it.
- AC: each quote request has an unguessable address on a subdomain we receive mail for; it can be revoked and reissued; every outgoing message uses it as Reply-To and sets its own `Message-ID`, `In-Reply-To` and `References`.

**M-3.2 Receive mail.** M · BE · needs M-3.1
- AC: an edge function verifies the provider's signature, stores each inbound message (sender, time, headers, text, attachments) against its quote request, and is idempotent on the provider's message id.
- AC: attachments are scanned before anyone can open them (D13); a message that is too large or fails the scan is recorded as received and quarantined.

**M-3.3 Mail that matches nothing.** S · FS · needs M-3.2
- AC: a message to a revoked or unknown address goes to a holding list an admin can assign or discard; nothing is attached by guesswork.

**M-3.4 The thread on the submission page.** M · FE · needs M-3.2
As a broker, I want to read the whole conversation with a PEO in order, with delivery and bounce marks on what we
sent.
- AC: the quote request shows every message, attachment, status change and note on one timeline, newest first; a bounce or a suppressed address is shown on the message it belongs to.

**M-3.5 Reply from the product.** S · FS · needs M-3.4
- AC: a broker can answer on the thread, with attachments from the intake's documents; the reply is recorded before it is sent.

**M-3.6 Tell the broker something arrived.** S · BE · needs M-3.2
- AC: a new inbound message emails the brokers working the submission with a link that needs sign-in, and no content from the message.

---

### Epic N: What comes back

*Replies become status, questions become requests, quote documents become comparable quotes.*

#### N-1 Reading replies

**N-1.1 Suggest what a reply means.** M · BE · needs M-3.2
As a broker, I want each reply read for me: received, a question, a quote, a decline.
- AC: each inbound message gets one suggestion with the sentence it rests on; nothing changes until a broker accepts it; the message's text is treated as data and can't instruct the model.
- AC: every suggestion and its outcome (accepted, changed, dismissed) is recorded without the message's content, as extraction events are (D20).

**N-1.2 More statuses for a quote request.** S · BE
- AC: `acknowledged` and `question open` join sent, quoted, declined and closed; the board can filter and sort by each.

**N-1.3 An underwriter's question becomes an information request.** S · FS · needs N-1.1
- AC: accepting a "question" suggestion drafts an information request naming the answers it is about; when the prospect certifies again, the broker is offered an update to that PEO (M-2.3).

**N-1.4 A decline keeps its reason.** S · FS
- AC: a declined quote request records a reason from a short list and the PEO's words.

#### N-2 Quotes

**N-2.1 A quote that holds the whole offer.** M · BE
As a broker, I want a quote to hold all four cost areas, not one number.
- AC: a quote holds the administrative fee and its basis (per employee per month, or percent of payroll), one-off fees, workers' comp rates per class code and state, how unemployment tax is charged per state, and medical rates per plan and tier, with expiry and proposed start as today.
- AC: a quote is marked **estimate** or **firm offer**, and the comparison never shows one as the other.

**N-2.2 Keep the quote document.** S · FS · needs M-3.2
- AC: a scanned quote document is stored with the quote and opens through a 60-second signed link; a quote recorded by hand can have one uploaded.

**N-2.3 Read the quote document.** M · BE · needs N-2.1, N-2.2
- AC: the figures are proposed as suggestions field by field, each pointing to its page; the broker accepts or corrects each; a quote isn't shown to a prospect until a broker has checked it.

**N-2.4 A revised quote.** S · BE · needs N-2.1
- AC: a later quote on the same quote request becomes the current one and the earlier is kept in the history.

#### N-3 The comparison

**N-3.1 The broker's comparison.** M · FE · needs N-2.1
As a broker, I want every quote on a submission on the same lines.
- AC: one column per PEO, alphabetical; rows for each cost area and an annual total worked out from the certified census and payroll, with the arithmetic shown; what a quote leaves out reads "Not quoted", never zero.
- AC: current costs sit in the first column when the intake holds them (K-4.1).

**N-3.2 Notes on the comparison.** S · FS · needs N-3.1
- AC: a broker can attach a note to a figure or a PEO, marked internal or for the client.

**N-3.3 The employer's comparison.** M · FS · needs N-3.1, QP-D2
As a prospect, I want to see the quotes my broker has checked, with their notes.
- AC: a broker shares a comparison; the prospect sees it in their intake and as a PDF; what the broker hasn't checked, and internal notes, are never shown.
- AC: how the broker is paid by each PEO is disclosed on the page if counsel requires it.

**N-3.4 The employer chooses.** S · FS · needs N-3.3
- AC: the prospect can mark a quote as the one they want; the broker is told; marking the submission won still names the winning quote as today.

**N-3.5 Hand the won employer to the PEO.** S · FS · needs N-3.4
- AC: the winning PEO can be sent the final certified export and documents on its thread, with the prospect's recorded yes.

---

### Epic P: Firms and the broker workspace

*The Advisor Console becomes every firm's console. Gated by QP-D3 and QP-D4.*

#### P-1 Firms

**P-1.1 Firms and membership.** M · BE
As the platform, we need every intake a firm works to be visible only to that firm.
- AC: a firm table and memberships with roles owner and member; Edgar Allan Advisory is created as the first firm and every existing advisor becomes its member; every existing submission is assigned to it.
- AC: row security on every table and function the console reads checks firm membership; the SQL isolation tests gain a second firm that can read nothing of the first's.

**P-1.2 Invite and remove members.** S · FS · needs P-1.1
- AC: an owner invites by email, removes a member, and passes ownership; a removed member loses access at once.

**P-1.3 Sign up a firm.** M · FS · needs P-1.1
As a broker, I want to create my firm's account myself.
- AC: sign-up takes the firm's name, the broker's name and a verified email; a new firm can work intakes immediately but cannot send to a PEO until an admin has approved it (Q-1.2).

**P-1.4 The console per firm.** M · FE · needs P-1.1
- AC: the queue, submission page, funnel, outbox and partners pages show only the firm's own records under a path that names no other firm; platform-wide pages (profiles, holding list, firm approval) are admin only.

**P-1.5 Assignment inside a firm.** S · FS · needs P-1.1
- AC: a submission can be assigned to a member, and the queue can list "mine"; revisits D16.

#### P-2 Working with clients

**P-2.1 A firm's link.** S · FS · needs P-1.1
As a broker, I want a link I give an employer that starts an intake my firm can see.
- AC: the link names the firm on the first screen ("You were invited by …") and the consent says the firm will see the answers; an intake started without a firm link belongs to no outside firm.

**P-2.2 Start an intake for a client.** M · FS · needs P-1.1
As a broker, I want to start the intake myself, upload what I already hold, and invite the employer to finish and
certify.
- AC: a broker's answers and uploads are marked as coming from the broker; the employer is invited by email, sees each of them as "Your broker entered this", and can change any of them.
- AC: only the employer certifies; the database refuses a certification from a firm member.

**P-2.3 The employer controls the firm's access.** S · FS · needs P-2.1, QP-D4
- AC: the prospect's profile shows which firm can see the intake and lets them end it; ending it stops new sends and leaves the record of what was already sent.

**P-2.4 A broker talks to Lenore.** S · BE · needs P-2.2
- AC: in a broker-started intake, a broker can type or paste what they know and Lenore records it as the broker's, never as the prospect's confirmed answer.

**P-2.5 Many clients at once.** S · FE · needs P-1.4
- AC: the queue shows, per client, the stage, how many PEOs are waiting, quotes back and the target start, as the board does today; it can be exported as a CSV.

#### P-3 The firm's name on the work

**P-3.1 Branding.** S · FS · needs P-1.1
- AC: a firm's name, logo and contact details appear on the packet's cover, the comparison and the emails it sends; "Prepared with Nevermore" stays in the footer.

**P-3.2 Message templates.** S · FS · needs M-2.1
- AC: a firm can edit its cover note, follow-up and withdrawal wording; the parts the law or the PEO needs can't be removed.

---

### Epic Q: Tracking brokers

**Q-1.1 Who the broker is.** S · FS · needs P-1.1
- AC: a broker and a firm can each record a National Producer Number, resident state and license lines; all optional, since PEO brokering is generally unlicensed.

**Q-1.2 Firm approval and license check.** M · BE + OPS · needs Q-1.1
- AC: an admin approves a firm before its first send; where a producer number is given it is checked against the national producer database through a provider, and the result and date are kept. Choosing the provider is part of the story.

**Q-1.3 Standing with each PEO.** S · FS · needs L-1.4
- AC: per firm and PEO: whether a partner agreement is in place, the code the PEO issued, and the PEO's own referral tool if it requires one; a PEO that requires its own tool shows that before a send.

**Q-2.1 The registration record.** M · BE · needs M-2.1
As a broker, I want proof of when I submitted an employer to a PEO.
- AC: every send writes an append-only registration: firm, PEO, the employer's FEIN (or name and state where there is none), version and time; a firm can download a dated statement of its own.
- AC: nobody can change or delete a registration, including admins.

**Q-2.2 Warn about a second submission.** S · BE · needs Q-2.1, QP-D4
- AC: before a send, if another firm has registered the same employer with the same PEO, the broker is told that one exists and when, and nothing about who; whether to block is a decision this story records, not assumes.

**Q-3.1 An activity record per firm.** M · BE · needs P-1.1
- AC: views of a submission, downloads, sends, shares and membership changes are recorded with who and when, without content; owners can read their firm's; kept for the period D4 sets for operational events unless counsel says longer.

**Q-3.2 The firm's numbers.** S · FE · needs P-1.4
- AC: per firm: intakes started and certified, median days from first send to first quote per PEO, quotes back out of sent, placements won; counts only.

**Q-4.1 Commission expected and received.** M · FS · needs N-3.4
- AC: a won placement records the expected basis (share of the administrative fee, per employee, or flat) and the firm can record payments against it; seen only by the firm.

---

### Epic R: The PEO side

*PEOs are recruited by the submissions they receive. Nothing here is needed for a broker to get value.*

**R-1.1 A page for the PEO contact, with no account.** M · FS · needs M-2.1
As a PEO sales rep, I want one link that opens this submission and nothing else.
- AC: the link in the email opens the bundle's files, the open items and a place to ask a question or attach a quote; it shows one submission, expires, can be revoked by the broker, and every open is recorded on the thread.
- AC: what the rep enters arrives on the thread exactly as an email would.

**R-1.2 A structured answer.** S · FS · needs R-1.1, N-2.1
- AC: the page offers the quote's fields as a form the rep may fill instead of attaching a document; a filled form still waits for the broker's check.

**R-2.1 A PEO claims its profile.** M · FS · needs L-1.2
As a PEO's broker-channel manager, I want to correct what you say we require.
- AC: a verified person at the PEO's own email domain can propose changes to its profile and contacts; an admin approves them; the profile shows "confirmed by the PEO" and the date.

**R-2.2 Where submissions should go.** S · FS · needs R-2.1
- AC: a PEO can set an address or desk per state or group size; a firm's own contact (L-1.4) still wins for that firm.

**R-3.1 A PEO's inbox.** M · FS · needs R-2.1
As a PEO, I want to see every submission sent to us through the product and its state.
- AC: PEO members see only submissions sent to their PEO, only what was sent, and never another PEO's quote or name.

**R-3.2 What a PEO learns.** S · FE · needs R-3.1
- AC: per PEO: submissions received, share complete on arrival, median days to quote, share won; counts about its own submissions only. No data about other PEOs' prices, ever.

**R-4.1 The public standard.** S · PM + FE
As a PEO or a payroll vendor, I want to read the schema and the census template without an account.
- AC: the v3 schema, the census template and a sample bundle are public pages search engines can read; the copy guard's rules still hold.

---

## 5. Order of work

Each slice is usable on its own. Sizes add up roughly; they are for comparing slices, not for dates.

| Slice | Stories | What a user can do at the end | Gate |
|---|---|---|---|
| **1. Ask it once** | K-1.x, K-2.1, K-2.2, K-3.x, K-4.1, K-4.2, K-5.1, K-5.3 | The packet holds what PEOs ask for | None. Improves today's product |
| **2. Know each PEO** | L-1.1 to L-1.3, L-2.1, L-2.2, L-3.1 to L-3.4, K-5.2 | Advisors see what each PEO still needs and download its files | QP-D5, QP-D8 |
| **3. Firms** | P-1.1, P-1.2, P-1.4, P-2.1, P-2.2, P-3.1, L-1.4 | Invited outside brokers work their own clients | QP-D3, QP-D4 |
| **4. Send and thread** | M-1.x, M-2.x, M-3.x, Q-2.1, Q-1.3 | Submissions go out and replies come back onto the request | QP-D1, QP-D9 |
| **5. Compare** | N-1.x, N-2.x, N-3.1, N-3.2 | Brokers compare quotes on the same lines | None beyond slice 4 |
| **6. Show the client** | N-3.3 to N-3.5, P-2.3 | Employers see and choose | QP-D2 |
| **7. Open the door** | P-1.3, P-1.5, P-2.4, P-2.5, P-3.2, Q-1.1, Q-1.2, Q-2.2, Q-3.x, Q-4.1 | Any firm signs up; brokers are verified and tracked | QP-D7 |
| **8. PEOs** | R-1.x, R-2.x, R-3.x, R-4.1, L-2.3, K-2.3, K-2.4 | PEOs shape and see what they are sent | PEOs already receiving submissions |

Slices 1 and 2 need no decision from counsel and make the pilot's packet better, so they can start now. Slice 3
can run beside them. Slice 4 is the first that changes what the company is.

## 6. Story index

| Epic | Stories | S | M |
|---|---|---|---|
| K The common questions | 17 | 9 | 8 |
| L Requirement profiles | 11 | 4 | 7 |
| M Sending submissions | 13 | 8 | 5 |
| N What comes back | 13 | 8 | 5 |
| P Firms and the workspace | 12 | 8 | 4 |
| Q Tracking brokers | 8 | 4 | 4 |
| R The PEO side | 7 | 4 | 3 |
| **Total** | **81** | **45** | **36** |

## 7. What would change this plan

- **A PEO won't accept anything but its own form.** Then L-3.1 (its layout) and L-2.3 (its questions) matter more
  than the packet, and that PEO's profile comes first.
- **Counsel says no to sending or to comparing.** Slices 4 to 6 are then available only to firms that hold the
  license counsel names, and Edgar Allan Advisory may not be one of them.
- **Brokers won't put clients into a tool run by a company with its own advisory arm.** Ask in the broker
  interviews the go-to-market plan already schedules; the answer may be to separate the two.
- **Replies mostly arrive by phone or portal, not email.** M-2.5 carries more weight and N-1.1 less.
