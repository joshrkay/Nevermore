# Nevermore for brokers: product requirements

| | |
|---|---|
| **Date** | 2026-11-13 |
| **Status** | Draft for the founder to challenge. Nothing here is built or decided |
| **What it covers** | The broker's workspace: quoting from start to finish, with leads, accounts, contacts, opportunities, email, reports and settings around it |
| **Stories** | `docs/BROKER_CRM_STORIES.md` holds every story and its acceptance criteria. This document says what the product is and why; that one says how each part is tested. Story IDs here (CRM-…) point there |
| **Design reasoning** | `docs/research/2026-11-12-broker-workspace.md` |
| **Screens** | 36, in `docs/prd-screens/`, drawn on the "Broker workspace screens" canvas. They are mockups with sample data, not the built product |

**How far to trust this.** What exists today was read from the repo's documents, not by running the app. What
brokers want rests on the founder's direction and on web research that could not open vendor pages; no broker
has been interviewed. Targets in section 4 are proposals with no baseline behind them.

---

## 1. Summary

Nevermore today takes an employer through one intake with Lenore, produces a certified packet, and lets an
advisory team track each PEO's answer. It is used when quoting and at no other time.

This product makes Nevermore the place a brokerage works all year. The quoting flow stays the centre: **New
quote** runs the original process from the account to the certified packet to the PEOs and back. Around it sit
the records a business-to-business sale needs: **leads, accounts, contacts, opportunities and quotes**, with
email in both directions, reports, and each brokerage on its own address with its agents under it.

It is one product. A broker who only wants to quote uses New quote and the Quotes list; the account, contact and
opportunity are made behind them. A broker who wants a CRM has one, and the quotes are already in it.

## 2. The problem

- **Brokers have no reason to open Nevermore except to quote.** A tool used a few times a year is forgotten, and
  the relationship lives somewhere else.
- **Quoting and the relationship are in two places.** The employer's name, the contact, the renewal date and the
  emails are in a CRM, a spreadsheet or an inbox; the intake, the packet and the PEOs' answers are here. Nothing
  connects them, so things are typed twice and lost.
- **Many small brokerages have no CRM at all** (the research's finding, from MarshBerry; no market-share figure
  exists). Those that have one will keep it, so the product must also link to it.
- **Today's console shows every submission to every advisor.** It cannot be given to a second firm as it is.

## 3. Who it is for

| Person | Who they are | What they need |
|---|---|---|
| **Agent** | A member of a brokerage who sells and quotes | Start a quote fast, know what needs them today, see every email on a deal |
| **Team lead** | Runs a team of agents | See the team's work, reassign it, spot what is stuck |
| **Owner** | Runs the brokerage | Bring people in and out safely, set the fields, see how the firm is doing |
| **Employer's contact** | The person at the business who answers and certifies (the glossary's prospect) | Answer once with Lenore, see who can see it, name which PEOs may get it |
| **PEO contact** | The person at a PEO who receives a quote request | A complete file from an address they recognise. They get an email, not an account |
| **Platform admin** | Nevermore's own staff | Approve firms, keep the PEO list, help a firm without reading its book unseen |

## 4. Goals, what is out, and how we'll know

**Goals**

1. A broker can go from nothing to quotes sent without leaving the product or typing anything twice.
2. Everything quoted is on an account, with its contact and opportunity, without the broker filing it.
3. Every email about a deal, both ways, is on the record it belongs to.
4. A brokerage can run its leads, accounts and renewals here with no other CRM, or keep its own and link it.
5. Each brokerage's data is seen only by that brokerage, and inside it only by the right people.
6. An owner can see how the firm is doing without building a report.

**Out of scope**

| Left out | Why |
|---|---|
| Email campaigns, sequences, bulk email, dialling, texting | Marketing and phone rules apply; brokers who want them have other tools |
| Two-way sync with another CRM | Names and people flow in, stage and a link flow out. Conflicts are most of the cost of a sync |
| Commission splits between agents | No evidence PEO brokerages pay that way. Expected and received per placement is enough |
| A report builder | Six fixed reports first |
| Policies, carriers, certificates | That is an agency management system |
| Reading a broker's mailbox | `docs/adr/0005`: send only |
| Custom fields on quotes | Quotes must hold the same lines to be compared |
| Accounts for PEOs | Epic R, later |

**How we'll know** (proposed; no baseline exists)

| Measure | Proposed target for the first ten firms |
|---|---|
| Share of quotes whose account, contact and opportunity were made without a separate step | 100% (it is a rule, CRM-Q1.1) |
| Median time from New quote to a certified intake | Under 3 days |
| Share of agents who open the product on a day they send no quote | Over 40% in a week |
| Share of PEO replies that land on their quote with nobody filing them | Over 90% |
| Firms still active after 90 days | 7 of 10 |
| A member of one firm able to read another's data | Never. Tested on every change (CRM-P2.1) |

## 5. What exists today and what is new

| Part | Today | New here |
|---|---|---|
| Intake with Lenore, the ten tabs, census, documents | Built | A broker starting it for a client; the firm's address and name on it |
| Certification, the packet and its files | Built | The employer naming PEOs as they certify (wording is counsel's) |
| What each PEO needs, fit checks, each PEO's files | Built | Shown as step 4 of New quote |
| Quote requests, their statuses, notes | Built, recorded by hand | Two more statuses; listed as Quotes; attached to an opportunity |
| Receiving PEO mail onto a quote | Built | Replying from the product; mail with contacts and leads; the Inbox |
| Sending to a PEO from the product | Mailbox connection built; the send is not | The send (Epic M) |
| Reading a quote out of an email or PDF | Not built | Suggestions the broker checks (Epic N) |
| Comparing quotes | Not built | Epic N |
| Firms, teams, who sees what | Not built: every advisor sees everything | Section 9 |
| Leads, accounts, contacts, opportunities | Not built | All of it |
| Reports | A funnel for the advisory team | Six reports |
| Look and feel | The current Nevermore look | One look across the CRM and the intake |

---

## 6. The product, screen by screen

Each screen names the stories that specify it. States (loading, empty, error) are in the stories under each page.

### 6.1 Home, Quotes and Inbox

**Screen 1. Home** (CRM-H1)
What needs the agent today: new mail, certified intakes, expiring quotes, stalled intakes, tasks. Five counts
that each open their list. Renewals coming up. Open opportunities by stage.

![Home](prd-screens/01-main.png)

**Screen 2. Quotes** (CRM-Q4.1)
Every quote across accounts, one row per PEO per opportunity, and one row per New quote left half done. Sorted
with what needs the agent first. This is the home for a broker who only quotes.

![Quotes](prd-screens/02-quotes.png)

**Screen 3. Inbox** (CRM-E1.4)
Every email on the agent's quotes, contacts and leads, both directions, each linked to its record. It is a view
of the product's own threads; it never reads the agent's mailbox.

![Inbox](prd-screens/03-inbox.png)

### 6.2 New quote: the original process, start to finish

New quote is in the menu on every page. It is five steps, and the records are made as it goes.

**Screen 4. Step 1, the account** (CRM-Q2.1, CRM-Q1.1)
Type the business; pick an account that matches or create one, with its contact. A name is required; the contact
needs an email or a phone. The opportunity is created with it.

![New quote, step 1](prd-screens/04-new-quote.png)

**Screen 5. Step 2, the intake with Lenore** (CRM-Q2.2)
The intake as built: Lenore on one side, the ten tabs on the other. What the account holds is already written
in. The broker can tell Lenore what they know and upload the census, each answer marked as theirs, or hand all
of it to the employer.

![New quote, step 2](prd-screens/05-quote-intake.png)

**Screen 6. What the employer sees** (CRM-Q2.3)
The employer's own page on the brokerage's address, with no CRM around it. Lenore asks what only they can answer.
They certify, sign and tick each PEO their packet may go to. Only the employer can certify.

![The employer's intake](prd-screens/06-employer-intake.png)

**Screen 7. Step 3, certified** (CRM-Q2.4)
Who certified and when, what the employer changed from the broker's entries, which PEOs they authorized, and the
packet and files to download. Before certification this step reads "Waiting for …" with a reminder.

![New quote, step 3](prd-screens/07-quote-certify.png)

**Screen 8. Step 4, choose PEOs** (CRM-Q2.5)
Each listed PEO with whether the employer fits it, what it still needs, whether the employer authorized it and
the firm's contact there. A PEO the employer hasn't authorized can't be chosen.

![New quote, step 4](prd-screens/08-quote-peos.png)

**Screen 9. Connect your email** (CRM-E1.1)
Shown the first time an agent sends. Google or Microsoft, send only. Or skip, and send from their own mail with
the quote's reply address in CC.

![Connect your email](prd-screens/09-connect-email.png)

**Screen 10. Step 5, review and send** (CRM-Q2.6)
One email per PEO from the agent's own address, each with that PEO's files in its own layout. Sending creates
one quote per PEO and moves the opportunity to In market.

![New quote, step 5](prd-screens/10-quote-send.png)

### 6.3 What comes back

**Screen 11. A quote** (CRM-Q3.2)
The emails with that PEO and a place to reply, what was sent, what it still needs, and the quote's figures. A
trail leads back up: Accounts / the account / the opportunity / the PEO.

![A quote](prd-screens/11-quote.png)

**Screen 12. Record the quote** (CRM-Q3.3)
The PEO's email and document beside a form. Figures the product read are filled in and say where they came from;
nothing is saved until the agent saves. A quote that came by phone or portal is typed in the same form.

![Record the quote](prd-screens/12-record-quote.png)

**Screen 13. Compare quotes** (CRM-Q4.2)
One column per PEO on the same lines. What a quote leaves out reads "Not quoted", never zero. The real comparison
holds more lines than this mockup shows (N-2.1: admin fee and its basis, one-off fees, workers' comp rates,
unemployment tax, medical rates).

![Compare quotes](prd-screens/13-compare.png)

### 6.4 Leads, accounts, contacts, opportunities

**Screen 14. Leads** (CRM-L1.1)
People not being quoted yet. Status views, filters, a Convert action per row.

![Leads](prd-screens/14-leads.png)

**Screen 15. A lead** (CRM-L2.1)
Status, details, the emails with them, calls, notes and tasks, and what converting will make.

![A lead](prd-screens/15-lead.png)

**Screen 16. Accounts** (CRM-A1.1)
The businesses the firm quotes for: main contact, open opportunity and stage, quotes, renewal, employees, owner,
last activity. Saved views are how an agent looks across accounts.

![Accounts](prd-screens/16-accounts.png)

**Screen 17. An account** (CRM-A2.1)
Everything hangs off the account. Details down one side; beside them its contacts, opportunities, quotes,
renewals and recent activity, each with its own tab and its own add action.

![An account](prd-screens/17-account.png)

**Screen 18. A contact** (CRM-C1.1)
Opens from its account. Details, the opportunities they are on, the emails with them, calls, notes and tasks.

![A contact](prd-screens/18-contact.png)

**Screen 19. An opportunity** (CRM-O1.1, CRM-O1.2)
Opens from its account. One search for one start date. Its stage, its quotes, its intake, its activity. Next
year's renewal is a new opportunity on the same account.

![An opportunity](prd-screens/19-opportunity.png)

### 6.5 Actions

| Screen | What it does | Stories |
|---|---|---|
| 21. New lead | Name is required; everything else optional | CRM-L1.2 |
| 22. Convert a lead | Makes an account, a contact and an opportunity in one step, or attaches to an existing account | CRM-L2.2 |
| 23. New account | Warns when one with the same website, or name and state, exists | CRM-A1.2, CRM-S4.2 |
| 24. Add a contact | On an account. Last name, and an email or a phone | CRM-A2.2 |
| 25. New opportunity | On an account. Can start from last year's certified answers | CRM-A2.3 |
| 26. Mark won or lost | Won names the quote taken, makes the account a client and adds its renewal | CRM-O1.3 |
| 27. Log a call, note or task | On a lead, account, contact or opportunity | CRM-E1.5 |
| 28. Import a CSV | Match columns, review, import; undone as a whole for 30 days | CRM-X4.1 |
| 29. Invite a team member | Email, role, team | CRM-X1.1, CRM-P1.2 |
| 30. Add a custom field | Table, name, kind, choices | CRM-X3.1 |

![New lead](prd-screens/21-new-lead.png)
![Convert a lead](prd-screens/22-convert-lead.png)
![New account](prd-screens/23-new-account.png)
![Add a contact](prd-screens/24-add-contact.png)
![New opportunity](prd-screens/25-new-opportunity.png)
![Mark won or lost](prd-screens/26-won-lost.png)
![Log a call, note or task](prd-screens/27-log-activity.png)
![Import a CSV](prd-screens/28-import.png)
![Invite a team member](prd-screens/29-invite-member.png)
![Add a custom field](prd-screens/30-add-field.png)

### 6.6 Reports and settings

**Screen 31. Reports** (CRM-R1.1)
Six reports: pipeline, quotes by PEO, won and lost, leads by source, renewals, activity. One set of controls for
period, whose work and source. Every figure opens the records it counts.

![Reports](prd-screens/31-reports.png)

**Screen 20. Settings** (CRM-X1.1, CRM-X2.1, CRM-X3.1)
One section, three parts: team members, email, and the fields for each table.

![Settings](prd-screens/20-settings.png)

### 6.7 What every table does

**Screens 32 to 36** (CRM-S2.x, CRM-S3.x)

| Screen | State |
|---|---|
| 32 | Loading: the frame shows at once, eight grey rows where the data will be |
| 33 | Nothing yet: one sentence and the first action |
| 34 | Nothing matches: the filters named, and Clear filters. Never an offer to create |
| 35 | Rows selected: a bar of bulk actions replaces the toolbar |
| 36 | Bulk edit: exactly what will change and what is skipped, before it does |

![Loading](prd-screens/32-accounts-loading.png)
![Nothing yet](prd-screens/33-accounts-empty.png)
![Nothing matches](prd-screens/34-accounts-no-match.png)
![Rows selected](prd-screens/35-accounts-bulk.png)
![Bulk edit](prd-screens/36-bulk-edit.png)

---

## 7. The records and their rules

| Record | What it is | Required | Statuses |
|---|---|---|---|
| **Lead** | A person and a business not being quoted yet | A name | New, working, converted, not a fit |
| **Account** | A business the firm quotes for | A name | Prospect, client, former client (worked out, never set) |
| **Contact** | A person at an account | A name, and an email or a phone | None |
| **Opportunity** | One search for one account and one start date | A name and its account | Qualifying, intake under way, ready to send, in market, quoted, won, lost |
| **Quote** | One PEO's handling of an opportunity (the glossary's quote request and the quote it returns) | As built | Not sent, sent, acknowledged, question open, quoted, declined, closed |

**The chain.** No quote without an opportunity, no opportunity without an account, and every intake on one
opportunity. Whichever way a quote starts, the chain is made in the same step (CRM-Q1.1). What the intake learns
is written back to the account's empty fields (CRM-Q1.2). Existing submissions are brought in on the same chain
(CRM-Q1.3).

**Statuses.** The table in CRM-Q3.1 says what each quote status means, what moves it there and what else
happens. An opportunity's stage follows the intake's pipeline stage (CRM-O1.2). An arriving email never changes
a status by itself; it can only suggest.

**Fields.** Standard fields are benchmarked on Pipedrive and Pipeline CRM (recalled, not checked against their
current documentation). A firm adds up to 30 of its own per table, on leads, accounts, contacts and
opportunities. No field may hold a tax ID, a census or anything about an employee: those stay in the intake,
which the employer owns.

---

## 8. Joining, leaving and keeping each firm's data its own

This section answers: how a brokerage and its agents get in, how they get out, and what stops anyone seeing
what they shouldn't. Stories: CRM-P1.x and CRM-P2.x.

### 8.1 What is in the repo today

- Two roles for the whole product, `advisor` and `admin`, in `user_roles`. Every advisor sees every submission.
- A person who signs in with Google or Microsoft gets the advisor role without an admin only if their
  organisation is on an admin's list, matched on what the provider vouches for (Google's verified domain,
  Microsoft's tenant), never on the email text. Every grant is logged and can't be edited.
- Row security on every table, and SQL tests that one person can't read another's intake.
- Mailbox tokens kept encrypted, server-side, never sent to the browser.

None of it knows what a firm is. That is the work.

### 8.2 A brokerage comes in

1. **Sign-up.** The owner gives the firm's name, a firm address (`name.nevermorepeo.com`) and a verified email.
   Names that read as Nevermore, a PEO, or a system word are refused.
2. **Working straight away, sending after approval.** A new firm can add leads and accounts and run intakes at
   once. It cannot send to a PEO until a platform admin approves it (Q-1.2), because a send goes out under
   Nevermore's name as well as the firm's.
3. **The first owner** is the person who signed up. A firm always has at least one owner.

### 8.3 An agent comes in

1. **By invitation only, to start.** An owner invites an email address with a role and a team. The link works
   once, for seven days, and only for that address.
2. **Signing in.** With Google or Microsoft, or with a password and a verified email. A password account must
   add a second factor before it can open a firm's data; a Google or Microsoft account relies on that
   provider's.
3. **What they see on day one.** Nothing but what they own, which is nothing. An owner or lead assigns them
   records, or they create their own.
4. **Their mailbox** is asked for at their first send, not at sign-in, and is theirs alone: no one else can send
   as them.
5. **Later, joining by organisation.** An owner can list the firm's Google domain or Microsoft tenant so that
   colleagues who sign in are offered to the owner for approval. Nobody joins without an owner saying yes.

### 8.4 An agent goes out

Removing a member is one action by an owner, and all of this happens in it:

| What | When |
|---|---|
| Every session they have is ended and they can open nothing of the firm's | At once |
| Their mailbox token is deleted; nothing more can be sent as them | At once |
| Their pending invitations and their own saved views are withdrawn | At once |
| Their leads, accounts and opportunities keep their history and are listed for the owner to reassign, one by one or in bulk | Until reassigned; nothing is deleted |
| Replies to emails they sent still land on the record, where the new owner sees them | Always: the reply address belongs to the record, not the person |
| What they exported in the last 30 days is shown to the owner | At removal |
| Their own sign-in is not deleted: it now belongs to no firm and sees nothing | Kept |

- **Suspend** does the first three and can be undone; it is for leave or an investigation.
- **A member can leave** by themselves; the same things happen, and the owner is told.
- **Whether a departing agent takes clients** is between them and the firm. The product gives the agent no
  export on the way out beyond what their role already allowed, and takes no side.
- Membership is dated, never overwritten, so who could see a record on a given day can always be answered.

### 8.5 A brokerage goes out

1. An owner asks to close the firm. They are offered a full export first.
2. For 30 days the firm is read-only and the request can be withdrawn.
3. Then the firm's own records are deleted: leads, accounts, contacts, opportunities, notes, tasks, custom
   fields, and email with contacts and leads.
4. **Intakes are the employers', not the firm's.** The firm's access to them ends; each stays for its employer
   under the retention rules that already apply, with the quote threads that are kept and deleted with it.
5. The firm address is not given to anyone else for 12 months, so old links can't be answered by a stranger.
6. A platform admin can suspend a firm (sign-in and sending blocked, data kept) for abuse or non-payment.

What happens to the append-only record of who submitted which employer to which PEO (Q-2.1) when a firm is
deleted is for counsel.

### 8.6 What keeps data apart

**Between firms**

- Every record carries its firm. The database checks membership on every row of every table and in every
  function; the browser is never trusted to say which firm it is.
- **The address is not the lock.** `acme.nevermorepeo.com` decides the name and logo shown before sign-in.
  A member of another firm who opens it sees a sign-in page and, signed in, nothing. A session belongs to one
  address.
- Search, tables, reports, exports and the inbox all go through the same check, so none can show what a table
  wouldn't.
- Files sit in private storage and open only through a link made for that person that lasts 60 seconds, as today.
- Mailbox and linked-CRM tokens are encrypted, held server-side, and never reach a browser.
- Each quote's and conversation's reply address has an unguessable part; mail to an address that belongs to no
  record goes to the holding list for an admin, never to a firm by guesswork.
- **Tested on every change.** The SQL tests hold a second firm, and a second agent in the first, and fail the
  build if either can read, change or count anything they shouldn't. A new table with no firm rule fails the
  build.
- **Shared on purpose:** the list of PEOs and what each asks for is the same for every firm and kept by
  platform admins. A firm's own contacts at a PEO are the firm's.
- **The one thing a firm can learn about another:** before a send, that another firm has already submitted this
  employer to this PEO, and when. Never who (Q-2.2).

**Inside a firm**

- An agent sees what they own; a lead, their team's; an owner, everything. A firm can switch this off.
- Changing a record's owner changes who sees it at once.
- Only owners manage members, fields and the firm's settings.

**Between the firm and the employer**

- The employer owns their answers. The firm sees an intake because the employer allowed it, and the employer
  can end that (P-2.3). The FEIN, the census and anything about an employee never enter the firm's records.

**Between the firm and Nevermore**

- Edgar Allan Advisory is one firm among the others; its advisors see their own firm only.
- Platform staff cannot browse a firm's book. Helping a firm means opening it through a named support action
  that records who, when and why, which the firm's owner can read.

**The record of who did what**

- Views of a record, downloads, exports, sends, sign-ins, and every membership and role change are recorded with
  who and when, without content (Q-3.1). Owners read their firm's. Nobody can edit it.
- An export of more than 500 rows, or a member exporting three times in an hour, tells the firm's owners.

### 8.7 What is not decided here

- Whether a second factor is required for every member or only for password accounts.
- How long a session lasts before signing in again (proposed: 30 days, and again before exporting everything or
  changing members).
- Encryption at rest and backups are the hosting provider's; how long a deleted firm's data stays in backups
  has not been checked.

---

## 9. Email

- An agent's mail goes out from their own Google or Microsoft mailbox, send only (`docs/adr/0005`).
- Each quote and each conversation with a contact or lead has its own reply address, first in Reply-To, so a
  reply reaches the record and the agent's inbox (`docs/adr/0004`).
- A message is stored once and shown on every record it belongs to.
- The Inbox is a view of those threads. The product never reads a mailbox.
- No bulk email.

Stories: CRM-E1.1 to E1.5. Threads on quotes are built for receiving; replying from the product and mail with
contacts and leads are new.

## 10. Data to add

| Table | Holds |
|---|---|
| `firms` | Name, firm address, branding, the visibility setting, approval, an optional parent firm |
| `firm_teams` | Firm, name, parent team, lead |
| `firm_memberships` | Firm, person, team, role, from and until. A change ends one row and adds another |
| `firm_invitations` | Firm, email, role, team, who invited, when it expires, when used |
| `leads` | Firm, owner, the person, the business, status, source, what it was converted into |
| `accounts` | Firm, owner, name, trade name, web domain, address, employees, and the rest of section 7's fields |
| `contacts` | Firm, account, name, title, email, phone, main contact, do not email |
| `opportunities` | Firm, account, owner, target start, stage before an intake, the intake, why lost |
| `placements` and `renewals` | What was won, with whom, from when; what renews and when |
| `conversations` | A thread with a contact or lead: its reply address and what it belongs to |
| `activities` | Calls, notes and tasks on a lead, account, contact or opportunity |
| `custom_fields` | Firm, table, name, kind, choices, order, archived; values kept on each record |
| `imports`, `saved_views` | One row per import batch; one per saved view |
| `record_history`, `access_log` | Every change to a record; views, downloads, exports and sign-ins without content |

On what exists: a firm on every intake and on every table the console reads; an opportunity on every intake.

## 11. Quality bars

| Bar | Requirement |
|---|---|
| **Access** | Section 8.6, tested on every change |
| **Accessibility** | WCAG 2.1 AA: every action by keyboard, visible focus, text 4.5:1, targets 44px, status never by colour alone, tables with real headers |
| **Phone** | Every page works at phone width: the menu collapses, tables scroll sideways inside their box |
| **Speed** (proposed) | A table's first page in under a second at 10,000 accounts; a record page in under a second; search results in under half a second |
| **Freshness** | Lists refresh on focus and every 60 seconds, as today |
| **Nothing lost** | A failed save keeps what was typed; two people editing one record are told, never overwritten |
| **Privacy** | No report, export, search or custom field holds an intake's answers, a census, a FEIN or anything about an employee |
| **Copy** | Plain words; the terms in `GLOSSARY.md`; required fields marked in words |

## 12. Release plan

The order is the stories' section 10. In short:

| Slice | What a broker can do at the end | Needs first |
|---|---|---|
| 1. The chain and firms | Every submission sits on an account, seen only by its firm; members invited and removed | Epic P's firm table |
| 2. Accounts | Work from the accounts table down to a quote | 1 |
| 3. New quote | Start with a quote and have the records made | Broker-started intakes (P-2.2) |
| 4. Leads and import | Bring a book in | 2 |
| 5. Bulk, merge, search | Change many records at once | 2 |
| 6. Send and email | Send from the product; see every email | Sending (Epic M) |
| 7. What comes back | Record, compare, win, renew | Epic N |
| 8. Reports and settings | See how the firm is doing | 2 to 7 |

Slices 1 to 3 are the smallest thing worth showing a broker: start a quote, and find it on an account afterwards.

## 13. Risks

| Risk | What we do about it |
|---|---|
| Brokers won't put their book in a tool run by a company with its own advisory arm | Section 8.6's rules; ask it in the broker interviews; separating the companies may be the answer |
| One firm sees another's data | The isolation tests gate every change; a new table with no firm rule fails the build |
| Quotes can't be read reliably from PEO documents | Collect real proposals from five to ten PEOs before designing the quote's lines; the broker always checks |
| The intake and the CRM look like two products | One look across both; budgeted as real front-end work |
| The CRM grows into a second product nobody finishes | The out-of-scope list in section 4; quoting stays the centre |
| A departing agent takes data | Role limits on export, export alerts to owners, the access record. It cannot be prevented, only seen |
| Nearby products already do this (BrokerQuoter, i-linked) | Demo both before building past slice 3 |

## 14. Decisions needed

1. Does a quote's status ever change with no person checking it? This document says no.
2. Does an opportunity's stage move automatically on the first send and first quote? That changes D44.
3. Is a second factor required for every member?
4. Does "multi-level" include a brokerage under another brokerage?
5. What happens to the submission record when a firm is deleted (counsel)?
6. May a firm erase an account and its intakes, or only archive (counsel, QP-D4)?
7. How brokers pay (QP-D7).
8. The glossary entries for firm, agent, lead, account, contact, opportunity and the screen word "quote" (QP-D3).
