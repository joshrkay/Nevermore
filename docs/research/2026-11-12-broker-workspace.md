# The broker's workspace: a book, a dashboard and levels, leading into the quote

| | |
|---|---|
| **Date** | 2026-11-12 |
| **Question** | If brokers are to work in Nevermore for the whole relationship and not only while quoting, what do we give them (a simple CRM, a dashboard, their contacts brought in, agents under a brokerage on its own subdomain, a link to the CRM they already have), and how does that lead into the quoting flow already built |
| **Status** | A design for the founder to challenge. Nothing here is decided, and nothing is built |
| **Builds on** | `2026-11-10-peo-quoting-platform.md` section 6 and Epics P and Q in `docs/QUOTING_PLATFORM_STORIES.md` |

**How far to trust this.** The codebase findings were read from the repo at commit `389e173`. The external
findings were gathered by web search only: no vendor page could be opened from this environment, so every external
claim rests on a search summary, and many come from vendor marketing. Prices, API limits and legal points must be
read at the source before they are relied on. **Fact** means read in the repo or stated in a cited source,
**inference** means reasoning from those, **recommendation** means a choice we would make.

---

## 1. The short version

- **The idea.** A broker's year with an employer is mostly not quoting: finding them, staying in touch, the
  renewal. A tool opened only to quote is a tool brokers forget. So the employer's record lives in Nevermore from
  the first conversation, and an intake is something a broker starts *from* that record.
- **What we add.** Four things on top of what Epics P and Q already plan:
  1. **The book**: each firm's employers and the people at them, brought in by hand, by CSV, from Google or
     Microsoft contacts, or from the firm's own CRM.
  2. **A dashboard** that opens on what needs the broker today, across the whole relationship.
  3. **Levels**: a firm, teams inside it, brokers inside those, each seeing their own book and what is under them.
  4. **A subdomain per firm**, where its brokers sign in and its employers arrive.
- **One pipeline, not two.** An employer's stage in the book is the firm's own until an intake exists, and is read
  from the intake's **pipeline stage** after. Nothing is kept twice.
- **Keep it light.** No email campaigns, no dialler, no commission-split engine, no two-way sync. The quoting is
  what no other CRM has; the book only has to be good enough that a small brokerage needs nothing else, and a firm
  with HubSpot can keep it.
- **It reverses three recorded choices**: D6 (no CRM), D16 (every advisor sees every intake), and the order in
  `docs/GO_TO_MARKET.md` (brokers as customers after the employer pilot). Section 9 lists them.
- **The largest risk is trust, not engineering.** A broker's book is their business, and Nevermore is operated by
  an advisory that places employers itself. Section 7.

---

## 2. What the research found

Sources are in section 11.

| Finding | Kind | What it means here |
|---|---|---|
| Many small agencies run with no CRM; no market-share figure exists for small PEO or benefits brokerages | Fact (MarshBerry), then inference | The built-in book has to stand on its own. CSV is the import everyone can use |
| HubSpot, Zoho, Pipedrive and GoHighLevel offer OAuth APIs on most or all plans. Salesforce Professional needs a paid add-on for API access. The insurance agency systems (Applied Epic, AMS360, EZLynx, HawkSoft) give API access only through partner programs | Fact, from search summaries | Link HubSpot first. Agency systems are reached by CSV |
| Unified CRM APIs: Merge charges about $65 per linked account after the first ten; Nango is usage-based and code-first | Fact, from search summaries | Per-account pricing is wrong for many small firms with one link each. Build HubSpot directly, or use Nango |
| No public evidence of multi-tier commission overrides in PEO brokerage, as life and health marketing organizations have. What exists is referral partners paid a flat residual | Inference from absence | Levels are for who sees what and for roll-up, not for splitting money |
| AgentSync models a hierarchy as a tree whose memberships are dated, so "who was above whom on that day" can be answered | Fact | Date our memberships the same way |
| ExtensisHR and PrestigePEO refuse broker-of-record letters; other PEOs allow a change of agent of record | Fact | Record, per employer and PEO, who is broker of record. Already Q-1.3 and Q-2.1 |
| BrokerQuoter (Zeyrax) covers PEO quote comparison, a broker portal and lead management, sold mainly to PEOs and general agents. i-linked describes a CRM for PEO with quoting. No product was found that is a broker-owned book plus one certified intake sent to several PEOs | Vendor claims only | Demo both before assuming the space is empty |
| Google's contacts permission is "sensitive", not "restricted": app verification, no paid security assessment. Microsoft's read-contacts permission can be granted by the user | Fact, from search summaries; the Microsoft point is an inference from a policy summary | Importing contacts is practical. Ask for it when the broker imports, not at sign-in |
| CAN-SPAM has no exception for business-to-business email. Several states bar commissions to unlicensed people where insurance is sold | Fact (FTC; Ohio and North Carolina statutes) | No outreach features until counsel has looked. Keep the optional licence fields (Q-1.1) |

---

## 3. Words

Existing terms mean what `GLOSSARY.md` says. Proposed new ones, to settle with QP-D3 before any code. The founder
says "brokerage" and "agents"; the glossary tells us to avoid "agent", and the stories already propose **Firm** and
**Broker**. A firm's own screens can call its brokers agents if it prefers.

| Term | Meaning |
|---|---|
| **Firm** | A brokerage whose members work employers together. As in the stories, plus: it has one **firm address** and its own **book** |
| **Broker** | A member of a firm. Today's Advisor is a broker of the firm Edgar Allan Advisory |
| **Team** | A group of brokers inside a firm, with a lead. A team can sit inside another team |
| **Book** | A firm's employers and contacts, each owned by one broker. Seen by that broker, by the leads above them and by the firm's owners; never by another firm |
| **Contact** | A person at an employer in a firm's book. The contact a broker invites to an intake becomes its **Prospect** |
| **Book stage** | Where an employer stands with a firm before and after quoting: new, in conversation, intake under way, in market, placed, lost, dormant. From "intake under way" to "placed" or "lost" it is read from the intake's **Pipeline stage**, never set by hand |
| **Placement** | An employer joined a PEO through the firm: which PEO, from when, the renewal date, and who is broker of record |
| **Firm address** | The firm's subdomain, such as `acme.nevermorepeo.com` |
| **Linked CRM** | A firm's own CRM that the book reads employers and contacts from and writes each intake's stage back to |

**Employer** already means the company; a book entry is an employer the firm knows, with or without an intake.

---

## 4. What a broker sees

### 4.1 The firm address

Recommendation.

- Each firm picks a name at sign-up and gets `name.nevermorepeo.com`. Its brokers sign in there. Its employers
  arrive there, so "You were invited by Acme Benefits", the firm's logo and its contact details (P-3.1) come from
  the address itself.
- **The address decides what is shown before sign-in, never what a person may read.** Access is firm membership,
  checked by the database on every row. A broker of one firm who opens another firm's address sees its sign-in
  page and nothing else.
- **Sign-in.** Google and Microsoft return to the project's one callback and the browser is then sent back to the
  firm address it came from. The list of addresses sign-in may return to has to allow any firm's subdomain. A
  session belongs to one address, so a person in two firms signs in to each.
- **Reserved names.** `www`, `app`, `api`, `mail`, `admin`, `status`, the subdomain the quote requests' reply
  addresses use, and any listed PEO's name. A firm can't take a name that reads as a PEO or as Nevermore.
- **The plain site stays.** `nevermorepeo.com` is still where an employer with no broker starts, and Edgar Allan
  Advisory is the firm those intakes belong to.
- **Later:** a firm's own domain, such as `quotes.acmebenefits.com`.

To confirm before building: that the host serves a wildcard subdomain on our DNS setup, and that the sign-in
provider's return list accepts a wildcard. Both are believed true and neither has been checked.

### 4.2 The dashboard

The first screen after sign-in answers "what do I do today", in this order:

1. **Needs you.** New PEO mail on a thread. An employer answered an information request. A quote expires within
   seven days. An intake with nothing new for ten days. A task due. Each line opens the thing itself.
2. **Renewals.** Placed employers whose renewal is within 120 days, soonest first. This is the reason to open the
   product in a month with no quoting.
3. **The pipeline.** A count per book stage, each opening the list. The quoting board (D44) is this list filtered
   to "in market".
4. **This quarter.** Intakes started and certified, quotes back out of sent, placements, median days to a first
   quote (Q-3.2). Counts only.

A lead sees the same for their team, an owner for the firm, each with a table by broker underneath.

### 4.3 The book

- **An employer's page** holds, top to bottom: who owns it and its book stage; its contacts; a timeline of notes,
  calls and tasks; then, once there is one, the intake with its open items, quote requests and threads, exactly as
  the submission page shows them today; then the placement.
- **A note or task** is the broker's own, dated, seen inside the firm only. A task has a due date and shows on the
  dashboard.
- **The list** shows each business with its main contact, their email and phone, its stage, its quotes and its
  owner, and searches by business, person or email. It filters by owner, stage, state and headcount, and exports
  as CSV at any time, with no limit and no request to us.
- **Navigation** is a menu down the left: Today, Book, Quoting, Renewals, Firm.
- **Quotes attach to the business by the outbound email.** Each send carries its quote request's reply address
  (`docs/adr/0004`, `docs/adr/0005`), so a PEO's answer lands on that business's page under that PEO, with nobody
  filing it. This is the **thread** as built; the book only gives it a business to sit on.
- **What the book never holds:** the FEIN (`docs/adr/0006`: typed into the workspace only), a census, or anything
  about an employee. Those stay in the intake, where the employer owns them.

### 4.4 Bringing the book in

In the order to build. Each is useful without the next.

| Way | What happens | Why here |
|---|---|---|
| **By hand** | Add an employer and a contact in one form | Needed for everything else |
| **CSV** | Upload, match the columns, preview, import. Every import is one batch that can be undone whole. A row matching an employer already in the book (same web domain, or same name and state) is offered as an update, never imported twice | Works for every firm, including those on an agency system with no open API |
| **Google or Microsoft contacts** | The broker picks which contacts to bring in; nothing is taken that they didn't pick, and nothing is kept in step afterwards | Same providers as sign-in. The permission is asked for at the import, not at sign-in, and is not kept |
| **Linked CRM, HubSpot first** | Companies and contacts are read in and kept current, each with its owner matched to a broker. Nevermore writes back, on the company, the book stage, the File ID and a link to the intake | For firms that already have a CRM and will keep it |

**The linked CRM in one rule: their CRM keeps the relationship, Nevermore keeps the quote.** Names, people and
owners flow in. The stage and a link flow out. No answer, census, quote or price ever leaves, and an edit in one
is never fought over in the other. The write-back goes through the outbox, as `docs/ADVISOR_CONSOLE.md` already
says a CRM should: queued, retried, and shown with a retry button.

Zoho and Pipedrive follow HubSpot if firms ask. Salesforce comes later, since its smaller plans have no API.

### 4.5 Levels

- **The shape.** A firm has teams; a team can hold teams; a broker belongs to one. Small firms have no teams and
  never see the word.
- **Who sees what.** A broker sees the employers they own. A lead sees their team's and everything under it. An
  owner sees the firm's. Brokers on the same level don't see each other's. A firm can switch this off so everyone
  sees everything, which is how a three-person firm works and how the console works today.
- **Roles.** Owner (members, teams, the linked CRM, the firm address, billing), lead, broker. A firm has at least
  one owner.
- **Memberships are dated**, never overwritten, so the record of who owned or could see an employer on a given day
  holds.
- **Moving and leaving.** An owner or lead reassigns an employer, and the change is logged. When a broker leaves,
  their access ends at once and their book waits for an owner to reassign; nothing is deleted. Whether a departing
  broker takes clients with them is between them and the firm, and the product takes no side.
- **Referral partners** (`GLOSSARY.md`) become each firm's own: a broker's link carries their code, and the
  partner still gets counts only.
- **Not built:** paying up the levels. A placement records what the firm expects from the PEO (Q-4.1); how a firm
  shares it out is its own business until firms ask for more.

**Open question for the founder.** Whether "multi-level" also means a brokerage *under another brokerage*: a
general agency whose member firms each have their own address and book, with the agency seeing across them. The
tables below leave room for it (a firm can name a parent), but it changes who may see whose book and should be
chosen on purpose.

---

## 5. How the book leads into the quote

One employer, start to finish. Steps 4 to 8 are already built or already planned; this design adds 1 to 3 and 9.

| # | What happens | Book stage | Where it is today |
|---|---|---|---|
| 1 | The employer is in the book, imported or added, with a contact | New | New |
| 2 | The broker notes calls, sets a task, learns the renewal date | In conversation | New |
| 3 | **Start intake** on the employer's page. What the book knows (name, state, rough headcount, the contact) is written in as "Your broker entered this". The broker adds what they hold and uploads documents | Intake under way | P-2.2, plus the prefill |
| 4 | The contact is invited by email, opens the firm address, finishes with Lenore and certifies. Only the employer certifies. The consent names the firm | Intake under way | P-2.1, P-2.2; the intake is built |
| 5 | The employer authorizes each PEO by name | Intake under way | **Market authorization**, M-1.1 |
| 6 | The broker sees what each PEO still needs, and sends each its bundle from their own mailbox | In market | Built (Epic L); sending is M-2.1 |
| 7 | Replies and quotes come back onto each thread; the broker compares | In market | Receiving is built; comparison is Epic N |
| 8 | The employer takes a quote, or the search ends | Placed, or lost | **Won**, **Lost** |
| 9 | The placement records the PEO, the start, the renewal date and the broker of record. The renewal shows on the dashboard 120 days out, and re-marketing starts from the same employer's page with last year's answers to certify again | Placed | New; the expected commission is Q-4.1 |

**The other way in.** An employer who follows a broker's link (P-2.1) with no book entry gets one: the employer
and the prospect are added to that broker's book as the intake starts. Either way there is one record.

**What has to be true for this to hold together:**

- **The employer still owns the answers** (QP-D4). The book is the firm's; the intake is the employer's, which the
  firm sees because the employer allowed it and can stop (P-2.3). Ending the firm's access leaves the book entry
  and its notes, and removes the intake from the employer's page.
- **A broker's entry is never the employer's confirmed answer.** It is a new **field source**, below the
  prospect's own action, and the employer sees and can change every one before certifying.
- **The book stage is read, not kept.** From step 3 on it is computed from the pipeline stage. A broker moves the
  pipeline, as today; the book follows.
- **An employer can be in two firms' books.** Neither sees the other. The only place they meet is the registration
  warning before a send (Q-2.2), which says that another firm registered this employer with this PEO and when,
  never who.

---

## 6. What it takes in the code

Fact, from the repo:

- Roles are global: `user_roles` holds `advisor` and `admin`, and every advisor reads every submission (D16).
- An intake (`chamber_sessions`) belongs to its prospect's account and to no firm.
- `allowed_organisations` already matches a sign-in to an organisation by what Google or Microsoft vouch for. It
  grants the global advisor role; with firms it would instead offer membership of the firm that listed the
  organisation.
- `broker_mailboxes`, `referral_partners`, the quote request tables and the outbox exist and would each gain a firm.
- The site is one single-page app on one host; `vercel.json` rewrites every path to it.

Recommendation, as tables. Names are for discussion.

| Table | Holds |
|---|---|
| `firms` | Name, firm address, branding, the visibility setting, an optional parent firm, approval (Q-1.2) |
| `firm_teams` | Firm, name, parent team, lead |
| `firm_memberships` | Firm, person, team, role, from and until. Append-only: a change ends one row and adds another |
| `book_employers` | Firm, owning broker, legal name, trade name, web domain, state, rough headcount, renewal date, the stage before an intake, and the intake once there is one |
| `book_contacts` | Firm, employer, name, title, email, phone, and where it came from |
| `book_entries` | Notes, calls and tasks on an employer: who, when, the text, a due date and when done |
| `book_imports` | One row per import: who, when, the source and the counts, so a batch can be undone |
| `placements` | Employer, PEO, start, renewal date, broker of record, the quote request it came from |
| `crm_links` | Firm, provider, the token (encrypted, server-side, as `broker_mailboxes` keeps its own), and the last sync |
| `crm_link_records` | Which record in the CRM each employer and contact is |

And on what exists: a firm on every intake and on every table the console reads, with row security that asks one
function, "may this person see this firm's record owned by that broker", so the levels live in one place. The SQL
isolation tests gain a second firm, and a second broker in the first, that can read nothing they shouldn't. This
is P-1.1 made one step larger, and it is still the main refactor.

---

## 7. Trust

A broker deciding whether to put their book into Nevermore asks three things. The design has to answer each in the
product and in the terms, not in a sales call.

1. **"Can you see my clients?"** Edgar Allan Advisory is a firm on the platform and places employers itself (the
   stories' section 7 already names this). Recommendation: the advisory's brokers are members of their own firm
   only. A platform admin can read a firm's book only through a named, logged support action the firm's owner can
   see. The book is never used to find employers for anyone else.
2. **"Will you contact my clients?"** Never. The only mail an employer gets is what their own broker starts (the
   intake invitation, an information request) and the receipts for their own certification.
3. **"Can I leave?"** Export the whole book and every placement as CSV at any time, without asking. Deleting the
   firm deletes its book; intakes stay with the employers who own them.

If the broker interviews in `docs/GO_TO_MARKET.md` say brokers won't use a tool run by a company with an advisory
arm, the answer may be to separate the two companies. Ask it directly.

---

## 8. What we leave out, and why

| Left out | Why |
|---|---|
| Email campaigns, sequences, a dialler, texting | CAN-SPAM and the phone rules apply; brokers who want them have HubSpot, which is why we link to it |
| Two-way CRM sync | Conflicts and duplicates are most of the cost of a sync. One direction each way avoids them |
| Commission splits and overrides | No evidence PEO brokerages pay that way. Expected and received per placement (Q-4.1) is enough to start |
| Policies, carriers, certificates | That is an agency management system. PEO is the one line we do |
| Reading the broker's inbox | `docs/adr/0005` already rules it out |

---

## 9. What this changes in the plan

| Recorded | Change |
|---|---|
| **D6**: the Advisor Console is the workflow and there is no CRM | The console grows a book. `docs/ADVISOR_CONSOLE.md`'s "if a CRM is added later" becomes the linked CRM |
| **D16**: every advisor sees every intake | Firms, then levels inside a firm |
| **QP-D3**: a firm has brokers | Adds team, book, contact, book stage, placement, firm address, linked CRM |
| **Go-to-market**: paid by the PEO now (Model A), sell to brokers after the pilot (Model C) | Brokers become the first customer. The research's question 4 ("is the first customer the employer or the broker?") is answered: the broker. The employer site remains, as the advisory's own front door |
| **Epic P** | P-1.1 gains teams and the firm address; P-2.2 gains the prefill; P-1.5 (assignment) becomes ownership and moves from slice 7 to the start |
| **Epic Q** | Q-4.1 hangs off the placement |
| **Legal** | New for counsel: holding contact details a broker brings (we act for the firm), the privacy policy's wording for it, and the contacts permission |

## 10. Order of work

| Slice | What ships | What a broker can do at the end |
|---|---|---|
| **1. Firms and addresses** | Firms, memberships, teams, visibility, the firm address, invitations (P-1.1, P-1.2, P-1.4, enlarged) | Invited firms sign in at their own address and see only their own work |
| **2. The book** | Employers, contacts, notes and tasks, by hand and by CSV, export, the dashboard | Keep their clients here, with no intake needed |
| **3. Book to quote** | Start intake from an employer with the prefill, the firm link creating book entries, the computed book stage (P-2.1, P-2.2) | Go from a name in the book to a certified intake |
| **4. After the quote** | Placements, renewal dates on the dashboard, re-marketing from last year's answers, expected commission (Q-4.1) | Have a reason to come back all year |
| **5. Bring it from elsewhere** | Google and Microsoft contacts; HubSpot as the first linked CRM | Keep their own CRM and still quote here |
| **6. Open the door** | Firm sign-up, approval (P-1.3, Q-1.2), a firm's own domain, firms under firms if chosen | Any firm signs up |

Slices 1 to 3 are the smallest thing that tests the idea: a broker's book in, and an intake out of it. Sending and
comparison (Epics M and N) run beside them, unchanged.

**Before building:** demo BrokerQuoter and i-linked; put the three questions in section 7 to the brokers already
on the interview list; and decide the open question in section 4.5.

---

## 11. Sources

All read as search summaries; none could be opened.

- **How PEO brokers work and are paid:** prestigepeo.com/for-brokers, prestigepeo.com/broker-faq,
  extensishr.com/blog/broker-centric-business-model-timeline,
  paychex.com/sites/default/files/2022-09/channel-partner-agreement.pdf,
  peospectrum.com/finance-professionals-referral-partner-program
- **CRMs in use and their APIs:** marshberry.com/?p=47958,
  developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines,
  developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api/intro_rest_compatible_editions.htm,
  zoho.com/crm/developer/docs/api/v4/api-limits.html, pipedrive.readme.io/docs/core-api-concepts-rate-limiting,
  marketplace.gohighlevel.com/docs/other/rate-limits,
  hashlogics.com/answers/applied-epic-ams360-and-ezlynx-apis-what-a-real-integration-involves
- **Nearby products:** zeyrax.com/broker-quoter.html, zeyrax.com/bqlite-universal-form.html,
  appulate.com/for-peo, capterra.com/p/106088/i-linked, zywave.com/products/brokeragebuilder
- **Linking a CRM:** help.merge.dev/en/articles/6641605-self-serve-with-merge-launch-plans-faq,
  nango.dev/blog/merge-pricing,
  developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification,
  mc.merill.net/message/MC1304287
- **Levels:** help.agentsync.io/how-to-set-up-and-view-upline-and-downlines-hierarchies-in-agentsync-manage,
  agencybloc.com/who-we-serve/insurance-uplines
- **Rules:** ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business,
  flsenate.gov/laws/statutes/2025/626.112, codes.ohio.gov/ohio-revised-code/section-3905.18,
  ncleg.net/enactedlegislation/statutes/html/bysection/chapter_58/gs_58-33-82.html
