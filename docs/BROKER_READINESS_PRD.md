# Nevermore for brokers: ready for a working PEO or insurance brokerage

| | |
|---|---|
| **Date** | 2026-11-24 |
| **Status** | Draft for the founder to challenge. Built so far: from slice A, BR-1.3, BR-1.4 and BR-2.2; from slice C, BR-3.1 (Home), BR-3.2 (upcoming tasks), BR-3.3 (daily summary), BR-3.6 (request emails) and BR-5.2 (a new firm's Home). From slice F: BR-6.1 (the five reports). From slice E: BR-5.1 (import), BR-5.3 (roles, teams, visibility), BR-3.5 (templates), BR-3.4 (a reply) and the duplicate warning of BR-5.4. `docs/BROKER_CRM_BUILD.md` ("Sendable", "Home", "Daily summary and request emails", "Import", "Roles, teams and visibility", "Leads catch up", "Templates and replies", "Reports") says what was decided and what was left out. Nothing else here is built |
| **What it covers** | What stands between the broker's workspace as built and a PEO or workers' comp brokerage working in it every day: the markets, the launch gates, the daily workflow, what the employer is handed, moving a firm in, and the depth of each line |
| **Builds on** | `docs/BROKER_CRM_PRD.md` (the workspace), `docs/QUOTING_PLATFORM_STORIES.md` (Epics K to R), `docs/BROKER_CRM_STORIES.md`, `docs/adr/0029` (lines) |
| **Stories** | Not written yet. Each requirement below carries an ID (BR-…) and, where one exists, the story it finishes |

**How far to trust this.** What exists today was read from the code and the documents at commit `56094d0`, not
by running the app; what is set up in production (PEO profiles, the scanner, the sender domain) cannot be seen
from the repo. No broker has been interviewed, so every claim about what a broker wants is the founder's
direction or an inference. Competitors are known from search summaries of their own marketing; none was demoed.
Targets in section 4 are proposals with no baseline.

`docs/BROKER_CRM_PRD.md` section 5 says most of the workspace is not built. That is out of date: firms, the
chain, accounts, contacts, opportunities, leads, New quote, sending, the Inbox, recording and comparing quotes,
placements, renewals and commission are in code. Section 5 here is the current list.

---

## 1. Summary

The quoting flow is the product's strength, and it is particular to this industry: one intake the employer
certifies, each PEO's or carrier's own files made from it, a check of fit before anything is sent, sends from the
agent's own mailbox with replies landing on the quote, a dated registration of every send, quotes recorded on
the same lines and compared, and the renewal and commission after the win.

Three things keep a brokerage from using it:

1. **A new firm can't send.** The list of PEOs and carriers holds five names with empty profiles and no
   contacts, a firm can't add its own, and the wording an employer certifies to is a draft.
2. **It is opened to quote and at no other time.** There is no Home, no list of the agent's tasks, no reminder,
   one report, and no way to bring a book in.
3. **The agent has nothing to hand the employer.** The comparison is on the agent's screen only.

This document specifies the work that closes those three, then the depth each line still lacks. Quoting stays
the centre; nothing here adds marketing, policy administration or a report builder.

## 2. The problem

- **Nothing is sendable on day one.** A send needs a published **Requirement profile** with a contact address.
  Migrations seed five PEO names with empty draft profiles and no carriers; only a platform admin can add or
  publish one.
- **The packet says it is a draft.** `LEGAL_COPY_APPROVED` is false, the intake consent is a draft, and every
  certified packet prints "DRAFT: NOT LEGALLY REVIEWED". Twelve questions for counsel are open
  (`docs/LEGAL_REVIEW.md`).
- **A workers' comp firm is approved with no licence on record.** ADR 0029 says a carrier search needs a P&C
  producer licence; firm approval has nowhere to record one.
- **The agent's day isn't here.** A member lands on the Submissions queue. Tasks exist on each record and
  nowhere across them. Nothing tells an agent a task is due, a quote is about to expire or a renewal is near.
- **The win happens outside the product.** The agent retypes the comparison into a spreadsheet or a slide to
  show the employer. Notes marked "For the client" are stored and shown nowhere.
- **A firm can't move in.** No CSV import, no logo on what the employer sees, no role change after joining, no
  message templates.
- **An owner can't see the firm.** The only report is the intake funnel.
- **Workers' comp is half a line.** Its intake asks PEO and medical questions and calls itself a PEO intake;
  loss runs are filed, not read; a carrier's quote document isn't read.
- **Nobody has checked any of this with a broker.**

## 3. Who it is for

The people of `docs/BROKER_CRM_PRD.md` section 3, with two made sharper:

| Person | What they need that they lack today |
|---|---|
| **Agent at a PEO brokerage** | PEOs they can send to on day one; a page that says what needs them; something to put in front of the employer |
| **Agent at a workers' comp agency** | An intake that asks what a carrier asks and nothing else; loss runs read; carriers to send to |
| **Owner** | Their book brought in; their name on what the employer sees; reports; roles they can change |
| **Employer's contact** | A comparison they can read without the agent on the phone; the firm's name, not only Nevermore's |
| **Platform admin** | A quick way to publish and keep many profiles; a licence to check before approving a firm |

## 4. Goals, what is out, and how we'll know

**Goals**

1. A firm approved today can send its first quote request the same day, with no data entry by Nevermore for
   that firm.
2. An agent has a reason to open the product on a day they send nothing.
3. The agent wins the deal with something the product made.
4. A firm can move its book in within an hour and look like itself to its employers.
5. A workers' comp search asks, reads and produces what a carrier search needs, and no PEO question.
6. Nothing goes to a real employer or PEO under wording counsel has not approved.

**Out of scope**

| Left out | Why |
|---|---|
| Lines beyond PEO and workers' comp (group health, EPLI, other P&C) | Finish two lines before adding a third; section 10 says what a third would need |
| Carrier or PEO APIs, portal filling, a rater | No evidence yet which markets offer one; email and the **Bundle link** work for all |
| Payroll or HRIS census pull | After the interviews say which systems; the census file works |
| Two-way CRM sync, a public API, webhooks | Unchanged from `docs/BROKER_CRM_PRD.md` section 4 |
| Billing | Free for the pilot (QP-D7); priced once the numbers exist. Section 12 names the decision |
| Class code lookup and bureau experience-mod data | Needs a licensed source; decide after the interviews |
| The PEO's own sign-in (Epic R) | Later, and blocked on counsel |

**How we'll know** (proposed; no baseline exists)

| Measure | Proposed target for the first ten firms |
|---|---|
| Time from a firm's approval to its first send | Under one working day |
| Share of a firm's sends that go to a profile Nevermore published, not one the firm asked for | Over 80% |
| Share of agents who open the product on a day they send no quote | Over 40% in a week (the workspace PRD's target, unmet today by design) |
| Share of won opportunities where the employer was sent the product's comparison | Over 60% |
| Firms that import a book in their first week | 6 of 10 |
| Packets printed with a draft notice | None after launch |

## 5. What exists today and what is missing

Read from code at `56094d0`.

| Part | Today | Missing |
|---|---|---|
| Intake with Lenore, census, documents, certification, the packet | Built | Counsel's approval of the wording; a workers' comp wording of the intake |
| Requirement profiles, fit checks, each market's files | Built | Profiles with facts in them; carriers; a firm's own contact at a market |
| New quote, broker-started intake, intake invitation | Built | Entry points at step 2 (issue 242) |
| Send, send to several, update, follow-up, withdrawal, bundle link | Built | A free reply on a thread; message templates |
| Inbound mail, Inbox, reply suggestions | Built | |
| Record a quote, read the quote document, comparison | Built for the agent, PEO line | Annual total, current cost, the employer's copy, carrier documents, scanned documents |
| Accounts, contacts, opportunities, placements, renewals, commission | Built | Renewal on the workers' comp line |
| Leads | Built: table, convert, bulk, bin, "contact me" form | CSV import, merge, duplicate warning, label column (issue 245) |
| Home, a tasks list, reminders | Not built | All of it |
| Reports | The intake funnel | Pipeline, quotes by market, won and lost, renewals, commission |
| Settings | Mailbox, invitations, members, activity, export | Role change, teams, visibility, branding, templates, custom fields |
| Onboarding | An empty queue and a wait for approval | A first-run checklist |
| Licence record | Not built | A field, and a check at approval |
| Billing | Not built | Out of scope here |

---

## 6. Requirements

Priority: **P0** is needed before a firm outside Edgar Allan Advisory uses the product. **P1** is needed for a
firm to stay. **P2** follows.

### 6.1 Markets a firm can send to (P0)

**BR-1.1 Published profiles for the first PEOs.**
At least ten PEOs have a published **Requirement profile** with what each asks, its census layout or template
workbook where it has one, and at least one **PEO contact** address, each fact sourced from the PEO's own form
or a named person there. The five seeded names are among them.
*Not code alone: this is a platform admin's work, and the requirement is that it is done and dated.*

**BR-1.2 The first carriers.**
At least five workers' comp carriers or wholesalers are listed with published profiles. A wholesaler is listed
as a carrier is, with the issuing carrier named on the quote it returns (ADR 0029, open question).

**BR-1.3 A firm's own contact at a market.**
An agent adds the person they deal with at a listed PEO or carrier. That contact is the firm's, seen by no other
firm, and is offered first when that firm sends. A market with no published contact but a firm contact is
sendable by that firm.

**BR-1.4 Asking for a market that isn't listed.**
From Choose PEOs, an agent asks for a PEO or carrier to be listed: its name, a contact, and its forms if they
have them. A platform admin is told by email on each request (decided 2026-11-24, and built), and sees a count on the PEOs page. The agent sees the request and its answer. Until it is listed, the agent
can record a quote from it as **Sent by hand**.

**BR-1.5 Keeping many profiles.**
A platform admin can copy a profile as the start of another, and sees a list of profiles by the date their facts
were last confirmed, oldest first.

*Acceptance in brief:* a firm approved with no help can send to a market on the same day; a firm's contact is
never readable by another firm (the isolation tests hold it); a request for a market is on the admin's list
within a minute.

### 6.2 Launch gates (P0)

**BR-2.1 Approved wording.**
The Privacy Policy, Terms of Use, intake consent, certification statements, market authorization and the
**Fixed block** are approved by counsel and recorded in `docs/LEGAL_REVIEW.md`. `LEGAL_COPY_APPROVED` is true,
the consent version is in `APPROVED_CONSENT_VERSIONS`, and no packet prints a draft notice.

**BR-2.2 The licence on record.**
Firm sign-up asks for the firm's National Producer Number and the states and lines it is licensed in. A firm
that makes workers' comp searches must hold a P&C line. A platform admin sees the record at approval and
records that it was checked and when. An owner keeps it current; a change is in the firm's activity. What the
check must be, and for which states, is counsel's (LEGAL_REVIEW question 2). Finishes Q-1.1 and D-21.

**BR-2.3 Comparison cleared, or held back.**
Counsel answers QP-D2: whether showing an employer several PEOs' or carriers' prices side by side needs a
licence, and where. Section 6.4 is built behind that answer.

**BR-2.4 Production is real.**
The document scanner is contracted and set, so uploads work; the sender domain is verified; the escalation
contacts and alert channel are named; a backup has been restored once; the launch checks in
`docs/SECURITY_REVIEW.md` are filled in; the whole path has been run once on the deployed environment with a
real model.

**BR-2.5 The multi-firm model is reviewed.**
`docs/SECURITY_REVIEW.md` gains a section on firms: isolation, support access, firm addresses, the firm's own
contacts and anything section 6 adds. The open findings SR-19, SR-20, SR-23, SR-25, SR-29 and SR-31 are closed
or accepted in writing.

**BR-2.6 Five brokers have seen it.**
Three agents at PEO brokerages and two at workers' comp agencies are walked through New quote to the comparison,
and what they said is written in `docs/research/`. BrokerQuoter and i-linked are demoed and written up beside
them. Anything below marked "after the interviews" is decided then.

### 6.3 The agent's day (P1)

**BR-3.1 Home.**
Home is story CRM-H1 as `docs/BROKER_CRM_STORIES.md` has it, with two numbers changed (founder, 2026-11-24): a quote
is in **Needs you** when it expires within 14 days (the story said seven), and an intake when nothing is new on it
for 7 days (the story said ten). Every member of a firm lands on Home, Edgar Allan Advisory's included; the
Submissions queue stays under Quotes. This replaces D-38's "the firm's address opens the queue".

**BR-3.2 Upcoming tasks.**
A panel on Home, not a page: the open tasks due in the next 14 days for whoever Home is showing (Mine, My team,
Everyone, as CRM-H1 switches them), by due date, each with done and a link to its record. Decided 2026-11-24: no
separate "My tasks" page.

**BR-3.3 Daily summary.**
One email to each member, Monday to Friday, in the morning of the member's own time zone, only when there is
something in it: what **Needs you** holds for them. Decided 2026-11-24: each member's own time zone (taken from
their browser, kept on the member, and theirs to change), weekdays only, on for every member with an off switch in
their profile and a link in the email, and called "Daily summary". It never holds an intake's answers, a census or
a FEIN.

**BR-3.6 Emails about a request for a PEO or carrier.**
Decided 2026-11-24: platform admins are emailed when a firm makes a request (BR-1.4), and the person who asked is
emailed the answer. Both are built.

**BR-3.4 Replying on a thread.**
An agent writes a free reply on a PEO's or carrier's thread from their connected mailbox, with no new bundle
link unless they ask for one. Finishes M-3.5.

**BR-3.5 Message templates.**
An owner keeps the firm's own opening text for a send, a follow-up and a withdrawal. The **Fixed block** under
it is never editable. Finishes P-3.2.

### 6.4 What the employer is handed (P1, behind BR-2.3)

**BR-4.1 The comparison is complete.**
The comparison adds, per quote, a first-year total worked from the certified census and payroll, with each part
shown and the arithmetic stated; and a column for what the employer pays today, entered by the agent or taken
from the intake's current-PEO and current-carrier answers. A cost area a quote leaves out still reads **Not
quoted**, never zero, and a total that leaves one out says which. Comparison notes can be edited and deleted.
Finishes D-778.

**BR-4.2 The employer's copy.**
The agent chooses which quotes to show and makes one document: the firm's name and logo, the employer, the
certified version it rests on, each chosen quote on the same lines, the totals, the notes marked "For the
client", each quote's expiry, and the wording counsel requires. It is a PDF and an expiring link, opened with no
sign-in as the **Bundle link** is. Making it and each opening of it are on the opportunity's activity. Finishes
N-3.3; relates to issue 85.

**BR-4.3 The firm's name on what the employer sees.**
An owner uploads a logo and sets the firm's display name. They appear on the intake, the intake invitation, the
employer's copy of the comparison and the firm's public link. "Nevermore, a service of Edgar Allan Advisory"
stays wherever the consent, the role disclosure and the certification need it. Finishes P-3.1.

*Whether the employer chooses a quote in the product (N-3.4) and the hand-off to the chosen PEO (N-3.5) stay
after the interviews.*

### 6.5 Moving a firm in (P1)

**BR-5.1 Import a CSV.**
Accounts with contacts, or leads: upload, match columns, review what will be made and what matches a record
already there, import. One import is undone as a whole for 30 days. Renewal date, current PEO or carrier and
employee count are importable, so the renewals view is useful on the first day. No column may be mapped to a
tax ID or anything about an employee. Finishes CRM-X4.1.

**BR-5.2 A new firm's Home.**
Decided 2026-11-24 (founder): no self-ticking checklist. A firm with no records sees CRM-H1's "Nothing yet" state
(one line, New quote, the three steps to a first quote; no Import button until import is built) and one line
saying what stops it sending now: waiting for Nevermore's approval, or no mailbox connected. The line goes when
nothing stops it. Built with Home (slice C).

**BR-5.3 Roles, teams and visibility.**
An owner changes a member's role and team after they join, makes and renames teams, and sets whether agents see
only their own records. The tables and the `firms.visibility` column exist; the screens and the role-change
function don't. Finishes CRM-X1.1 and CRM-P1.2.

**BR-5.4 Leads catch up with accounts.**
A duplicate warning when a lead is made, merge and keep separate, the label column and filter (issue 245), and
leads in the menu search.

**BR-5.5 Custom fields.**
Up to 30 per table on leads, accounts, contacts and opportunities, with the rule already written: none may hold
a tax ID, a census or anything about an employee. Finishes CRM-X3.1. P2.

### 6.6 Seeing the firm (P1)

**BR-6.1 Reports.**
Five beside the intake funnel, with one set of controls (period, whose work, line) and every figure opening the
records it counts:

| Report | Answers |
|---|---|
| Pipeline | Open opportunities by stage, by owner, and how long each has sat |
| Quotes by market | Sent, quoted, declined and why, days to a quote, win rate, per PEO or carrier |
| Won and lost | By period, owner, source and reason |
| Renewals | What renews when, and what was kept or lost at renewal |
| Commission | Expected against received, by placement and month |

Finishes CRM-R1.1. Leads by source and activity stay as the stories have them, P2.

### 6.7 Workers' comp as a line of its own (P1 for a workers' comp firm)

**BR-7.1 An intake that asks what a carrier asks.**
On a workers' comp search the intake, Lenore, the invitation and every screen say workers' comp and carrier. It
skips the fields only a PEO asks (benefits, medical, current PEO services) and requires what a carrier can't
quote without: class codes and payroll by state, the experience mod where there is one, prior carriers and
years of loss history. Which fields those are is decided against real carrier applications (BR-1.2).

**BR-7.2 Loss runs read.**
An uploaded loss run is read into loss-history rows as proposals the prospect or agent confirms (ADR 0028),
each with its **Evidence quote**. Scanned documents are read too: this is where text recognition is added
(D-769), and quote documents gain it with it.

**BR-7.3 A carrier's quote read and compared.**
The quote document reading covers the workers' comp line: premium by class and state, the experience mod
applied, schedule credits and debits, payment plan, dividend plan, the issuing carrier. The comparison shows
them on the same lines, and the quotes table shows the premium.

**BR-7.4 Renewal on the right line.**
A won workers' comp search makes a renewal on that line, at the policy's expiry, and Start the renewal opens a
workers' comp search.

### 6.8 Later (P2)

- A census pulled from a payroll system, once the interviews name the systems.
- A link to the firm's own CRM, as `docs/BROKER_CRM_PRD.md` has it: names in, stage and a link out.
- The group health questionnaire, when counsel answers LEGAL_REVIEW question 7.
- Class code lookup and bureau experience-mod data.
- A third line (section 10).

---

## 7. Rules that hold across all of it

Nothing here loosens what is already decided:

- A firm's records are seen only by that firm; a new table with no firm rule fails the build. BR-1.3's contacts,
  BR-4.3's logo and BR-5.1's imports are all under it.
- The FEIN, the census and anything about an employee never enter a firm's records, a report, an export, a
  reminder or a custom field. The employer's copy of the comparison holds totals, never a person.
- What AI reads is a proposal until a person confirms it (ADR 0028). BR-7.2 and BR-7.3 are proposals.
- An arriving email never changes a status by itself.
- Mail goes from the agent's own mailbox, send only (ADR 0005). BR-3.3's reminder is the product's own mail to
  a member, like the existing alerts.
- Files reach anyone outside the firm by expiring link, never as attachments (ADR 0003).
- Tables are added to, never replaced (ADR 0007).

## 8. Data to add

| Table or column | Holds | For |
|---|---|---|
| `firm_market_contacts` | Firm, market, person, address, who added it | BR-1.3 |
| `market_requests` | Firm, who asked, the market's name and contact, files, the admin's answer | BR-1.4 |
| `firm_licences` | Firm, NPN, state, line, expiry; who checked it and when | BR-2.2 |
| `firms.logo_path`, `firms.display_name` | The firm's look | BR-4.3 |
| `member_reminder_settings` | Member, which parts, off | BR-3.3 |
| `firm_message_templates` | Firm, kind, text | BR-3.5 |
| `comparison_shares` | Opportunity, the quotes chosen, version, token, expiry, openings | BR-4.2 |
| `imports` | One row per batch, for the undo | BR-5.1 |
| `custom_fields` | As `docs/BROKER_CRM_PRD.md` section 10 | BR-5.5 |

Names are proposals; the glossary gains an entry for each new term before it is built.

## 9. Quality bars

Those of `docs/BROKER_CRM_PRD.md` section 11, with three added:

| Bar | Requirement |
|---|---|
| **The employer's copy** | Reads on a phone; prints on one or two pages for up to five quotes; every figure traces to a recorded quote and a certified version |
| **Reading documents** | Before BR-7.2 and BR-7.3 ship, accuracy is measured on real loss runs and carrier quotes from at least five sources, and the figure is written down |
| **Accessibility** | The contrast audit (I-2.3) is done, and an automated check runs on the workspace's pages in the browser tests |

## 10. What a third line would need

Not planned here; written down so the cost is known. A line today is a code constant mirrored in the database
(`src/data/lines.ts`, `quote_lines()`), with its cost areas hard-coded. Each new line needs: its cost areas, its
intake fields and which are required, its application data sheet, its quote-document reading, its words on
every screen, a licence line in BR-2.2, and counsel's view. Group health also needs the health questionnaire
and an answer on protected health information. Do none of it until two lines are finished and a broker asks.

## 11. Release plan

| Slice | What is true at the end | Needs first |
|---|---|---|
| A. Sendable | A firm approved today sends today, under approved wording, with its licence on record | BR-1.1 to 1.4, BR-2.1, 2.2, 2.4. **Built:** BR-1.3, BR-1.4, BR-2.2. **Open, and not code:** BR-1.1, BR-1.2 (profiles), BR-2.1 (counsel), BR-2.4 (production) |
| B. Checked | Five brokers and two competitors' demos are written up; this document is revised | A, BR-2.6 |
| C. The day | Home, upcoming tasks, the daily summary, a new firm's Home | B. **Built** (2026-11-24), ahead of B at the founder's choice |
| D. The win | The complete comparison, the employer's copy, the firm's logo | B, BR-2.3 |
| E. Moving in | Import, roles and teams, leads caught up, templates, a free reply | C. **Built:** import (BR-5.1); roles, teams and visibility (BR-5.3); the duplicate warning for a new lead (of BR-5.4); a firm's message templates (BR-3.5); a reply on a thread (BR-3.4). leads in the menu's search and the Label column and filter on the leads table (of BR-5.4). **Not built, of BR-5.4:** merging two leads |
| F. The owner | Five reports | C, E. **Built** (BR-6.1): the pipeline, quotes by market, won and lost, renewals, commission, on `/reports` |
| G. Workers' comp | Its own intake, loss runs and carrier quotes read, its renewal | B, BR-1.2 |

A is mostly not code: profiles, counsel, the scanner contract. It is still first, because nothing after it can
be used without it. B comes before any large build so that C to G are built for what brokers said.

## 12. Risks

| Risk | What we do about it |
|---|---|
| PEOs won't quote from a neutral packet | Each profile produces that PEO's own layout; ask every PEO contact while sourcing BR-1.1 |
| Sourcing profiles is slow, and they go stale | Start with the ten the pilot firms use most; BR-1.5's oldest-first list; firms' requests (BR-1.4) say what to add |
| Counsel says the comparison needs a licence | BR-2.2 already records licences by state and line; show the employer's copy only where the firm holds one |
| Counsel takes months | A is gated on it; start now, and pilot with Edgar Allan Advisory as the only firm meanwhile |
| Brokers won't put a book in a tool run by a company with an advisory arm | Ask it in BR-2.6; the workspace PRD's section 13 stands |
| Reading loss runs is unreliable | Proposals only, measured before shipping (section 9) |
| The workspace grows past what one team can finish | P2 stays P2; section 4's out-of-scope list |
| BrokerQuoter already hands the employer a comparison | Demo it in B; D is the answer |

## 13. Decisions needed

1. Which ten PEOs and five carriers are first (BR-1.1, BR-1.2).
2. ~~May a firm send to a market on its own contact alone, with no profile Nevermore published (BR-1.3)?~~ **Decided 2026-11-24 (founder): no.** A PEO or carrier is chosen for a send only once its profile is published; a firm's contact fills in where the profile names nobody (D-2103).
3. What the licence check is: a field the firm fills, a lookup against the national producer database, or both
   (BR-2.2; counsel).
4. Does the employer's copy show every quote received, or only those the agent chooses (BR-4.2)? Choosing may
   carry a duty to disclose; counsel.
5. Is the first-year total the product's arithmetic or the agent's entry (BR-4.1)?
6. ~~Does Home replace the Submissions queue as the first page for every role, Edgar Allan Advisory's included?~~ **Decided 2026-11-24 (founder): yes, for every member of a firm.**
7. How brokers pay (QP-D7), and whether BR-2.6 asks it.
8. ~~Whether workers' comp (slice G) comes before or after the workspace slices C to F.~~ **Decided 2026-11-24 (founder): after.** The first firms are PEO brokerages only, so slice G waits and the carrier licence rule (D-2109) affects nobody yet.
