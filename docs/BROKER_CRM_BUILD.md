# The broker's CRM: how it is being built

The spec is `docs/BROKER_CRM_STORIES.md` (stories `CRM-…`), `docs/QUOTING_PLATFORM_STORIES.md` (stories `K-` to
`R-`) and `docs/BROKER_CRM_PRD.md`. This page holds the founder's decisions of 2026-11-13, the epics, and the
rules every story's build follows. Where this page and a story disagree, this page wins.

## Decisions (founder, 2026-11-13)

| # | Decision |
|---|---|
| D-1 | Build every `CRM-` story, and the `K-` to `R-` stories they need: firms and memberships, a broker starting an intake for a client, the employer's PEO authorization, sending from the product, reading replies and quote documents, the comparison |
| D-2 | One pull request per epic. Each story is its own pull request into its epic's branch |
| D-3 | Epics are stacked: each epic's branch starts from the epic before it and its pull request targets that branch. Epic 1 starts from `claude/keen-brahmagupta-n7raz0` |
| D-4 | A story's pull request is merged into its epic branch by the orchestrator once its gate passes and its review is Ready. Epic pull requests are merged only by the founder |
| D-5 | Words: **firm** and **agent** in code and on screens; lead, account, contact, opportunity, quote. Roles: `owner`, `lead`, `agent` |
| D-6 | `firms` has a `parent_firm_id` column. No rule, policy, function or screen reads it yet |
| D-7 | The workspace (leads, accounts, quotes, inbox, reports, settings) uses the grey-and-blue look of `docs/prd-screens/`. The employer's intake keeps today's look |
| D-8 | Today's advisor console pages keep working, scoped to the firm, until the screen that replaces each ships. A page is removed only in the story that ships its replacement |
| D-9 | Reading a PEO's reply or quote document only suggests. Nothing is saved until an agent confirms |
| D-10 | An opportunity's stage moves by itself: the first send moves it to In market, the first recorded quote to Quoted. This changes D44 |
| D-11 | A second sign-in factor is required for password accounts only |
| D-12 | Sending to PEOs and the employer's PEO authorization are built switched on, with draft wording. All legal wording lives in one module so counsel's text is one change, and every pull request that shows it says so |
| D-13 | Tests are written at four seams and nowhere else: (1) database rules and functions, through SQL tests in `supabase/tests`; (2) pages and forms, through component tests of what a person sees and does; (3) a few end-to-end browser flows in `e2e/`; (4) server functions, through their request and response with the mail provider and the model faked |
| D-14 | Sonnet builds every story. Opus does every review. From Epic 2 on, see D-53 |
| D-25 | Stories in an epic are built at the same time wherever one does not need another. Up to three run side by side, each in its own working copy with its own test database; a story starts as soon as the stories it needs have merged |

## Epics, in order

| # | Epic | Branch | Stories |
|---|---|---|---|
| 1 | Firms and security | `crm/epic-01-firms-security` | P-1.1, CRM-S5.1, CRM-P2.1, P-1.4, CRM-P1.2, CRM-P1.3, CRM-P1.5, CRM-P1.6, CRM-P1.4, CRM-P1.1 with Q-1.2, CRM-P1.7, CRM-P1.8, CRM-P2.2, CRM-P2.3 with Q-3.1, CRM-P2.4, CRM-P2.5 with P-2.3 |
| 2 | Shell and tables | `crm/epic-02-shell-tables` | CRM-S1.1, CRM-S2.1 to S2.4, CRM-S3.1 to S3.5, CRM-S3.8, CRM-S4.1, CRM-S5.2 |
| 3 | Accounts and contacts | `crm/epic-03-accounts-contacts` | CRM-Q1.1, CRM-Q1.3, CRM-A1.1 to A1.3, CRM-S3.6 and CRM-S3.7 (D-47), CRM-A2.1, CRM-A2.2, CRM-C1.1, CRM-E1.5, CRM-S4.2, CRM-S4.3, CRM-S1.2 |
| 4 | Opportunities | `crm/epic-04-opportunities` | CRM-O1.1, CRM-O1.2, CRM-A2.3, CRM-A2.4, CRM-O1.3 with Q-4.1 |
| 5 | Quotes and New quote | `crm/epic-05-quotes` | P-2.1, P-2.2, P-2.4, M-1.1, CRM-Q2.1 to Q2.5, CRM-Q1.2, CRM-Q3.1 with N-1.2, CRM-Q3.2, CRM-Q3.4, CRM-Q4.1 |
| 6 | Sending and email | `crm/epic-06-sending-email` | M-2.1 to M-2.4, Q-2.1, Q-2.2, CRM-Q2.6, CRM-E1.1 to E1.4 |
| 7 | What comes back | `crm/epic-07-what-comes-back` | N-1.1, N-1.3, N-1.4, N-2.1 to N-2.4, N-3.1, N-3.2, CRM-Q3.3, CRM-Q4.2 |
| 8 | Leads | `crm/epic-08-leads` | CRM-L1.1 to L1.3, CRM-L2.1, CRM-L2.2 |
| 9 | Settings and import | `crm/epic-09-settings-import` | CRM-X1.1, CRM-X2.1, CRM-X3.1, CRM-X4.1 |
| 10 | Reports | `crm/epic-10-reports` | CRM-R1.1 to R1.3 |
| 11 | Home | `crm/epic-11-home` | CRM-H1 |

## Epic 1 decisions (2026-11-13)

The founder said to take the recommended answer on each decision a scout finds before an epic, and keep going.
These came from reading Epic 1's stories against the code.

| # | Decision |
|---|---|
| D-15 | In Edgar Allan Advisory, today's admins become owners and today's advisors become agents, and that firm is set to "everyone sees everything", so nobody loses sight of a submission. Submissions get no owner in Epic 1 |
| D-16 | A platform `admin` is not a member of any firm and stops reading firms' intakes. Assigning held mail shows only the File ID and the PEO |
| D-17 | Firm addresses (subdomains) are built in Epic 1. The code reads the host; the DNS, hosting and sign-in provider settings it needs are listed in the pull request for the founder to apply |
| D-18 | The database checks that the caller is a member of the record's firm. The address only chooses what the screen shows; it is never the lock |
| D-19 | A second factor is asked for when this sign-in used a password, not whenever the account has one |
| D-20 | The teams table and the visibility rules are built in Epic 1. No screen shows a team field until CRM-X1.1 |
| D-21 | Q-1.2 is built as the admin's approval of a firm only. No licence check, since nothing records a producer number yet |
| D-22 | CRM-P2.5 (the employer ends a firm's access) moves to Epic 5, after firm links exist |
| D-23 | CRM-P1.4 replaces the admin's organisation list: `/advisor/organisations` and `claim_advisor_role_by_organisation` are retired in that story |
| D-24 | An acceptance criterion about something a later epic creates (exports, send buttons, the Settings page, tables for leads, accounts, opportunities and quotes) is met in the story that creates that thing. The Epic 1 story builds the mechanism and applies it to what exists, and its pull request lists what was deferred and to which story |
| D-26 | A firm address is refused as a PEO's only when, with everything but letters and digits removed and in lower case, it is exactly a listed PEO's name or short name. No partial, prefix or contains matching: three review rounds showed any fuzzier rule both lets real look-alikes through and refuses innocent names. Platform admins approve each firm before it can send (Q-1.2), which is where a look-alike is caught |
| D-27 | What a firm address shows. **A firm that exists** (approved or still waiting for approval) shows its name and its sign-in page, because a waiting firm's members can work before approval; approval gates sending, not signing in. **An address no firm holds** shows a plain not-found page to everyone: no sign-in is offered there and the sign-in callback pages are not mounted; if a session somehow exists at that address, the not-found page carries a sign-out. A signed-in person who is not a member of an existing firm's address sees "You aren't a member of this firm" with a sign-out. Signing out on a firm address ends that address's session only; signing out on the bare domain keeps today's behaviour (every session of that person). When firms can be suspended or closed (CRM-P1.8, CRM-P1.7), a suspended or closed firm's address looks the same as one no firm holds |
| D-28 | The check that a table holding firm data has a firm rule is by behaviour, never by reading the policy's text. Every public table is listed in the isolation tests with what it holds (a firm's data, platform-wide data, a person's own data). Every table listed as a firm's data must have a two-firm probe that inserts a row for each firm and proves a member of the other firm reads, counts, changes and deletes nothing; a firm table with no probe, or a table not listed, fails the build. A text check can be fooled by a policy that mentions a firm helper without tying it to the row being read |
| D-29 | A rule of the form "at most one of these per person or per firm" is enforced by a database constraint (a unique or partial unique index), not only by a lock inside a function. A constraint is tested in one session by trying the second insert and seeing it refused; a lock on its own cannot be tested that way and reviews kept finding it unprotected. A lock may stay beside the constraint only to give a friendlier message, and then the constraint is what the test proves. First use: one firm waiting for approval per person who signed up (CRM-P1.1) |
| D-30 | A person has at most one firm waiting for approval at a time. Signing up another is refused ("You already have a firm waiting for approval") until the first is decided, so nobody holds addresses they have no use for or fills the admin's list. A broker who runs two firms signs the second up after the first is decided |
| D-31 | A refused firm behaves, at its address, like an address no firm holds: no name, no sign-in, and its founder is not let in (D-27). The address stays taken by the refused firm, with no end date, until a later story decides otherwise: a refused founder signs up again at a different address |
| D-32 | A lock that guards against two things happening at the same moment stays only if a test goes red when it is removed. Where the rule can be a constraint, D-29 applies. Where it cannot, and the clash it guards against cannot happen through anything a person or job can do today, the lock is removed and the story that first makes the clash possible adds it back with its test. Where the clash can happen today, it is tested with two database sessions; a lock no test protects is not merged. First use: the lock on an intake's firm while a funnel step is written (CRM-P2.1b) |
| D-33 | A firm never sees who at Nevermore acted on it. When a platform admin who is not a current member of the firm does something recorded in that firm's activity (approving or refusing it, later support access), the firm's owners see the actor as "Nevermore": no name, no email, no user id, in the list, in the person filter and in anything the reading functions return. The real actor is still stored, for the platform's own record only. A member of the firm who also holds a platform role and acts as a member is shown as themselves. Reason: every outside party who signs up a firm would otherwise learn staff sign-in emails |
| D-34 | Who can invite, by the firm's state. A firm still waiting for approval can invite and its invitations can be accepted (its people can work before approval, D-27), but it may hold at most five pending invitations until it is approved, so an unapproved sign-up cannot use Nevermore's mail to send in bulk. A refused firm cannot invite or resend, and a pending invitation to a refused firm cannot be accepted (D-31). An invitation link is accepted only at the address of the firm it belongs to; opened at another firm's address it is refused and joins nothing. The secret in an invitation link travels in the part of the address after `#`, which browsers do not send to servers, and the page removes it from the address bar as soon as it has read it |
| D-35 | Who receives a firm's alert when a send is retried. The recipients of an alert are fixed when it is first prepared: the firm's current members at that moment. On a retry, anyone who has since left the firm is dropped (a former member is never sent a firm's alert), and the message is rebuilt only for that reason. Someone who joined between the first attempt and the retry does not receive that one alert; they receive every alert prepared after they joined. Reason: rebuilding a message to add a new member changes its send key, so people who already received it would receive it twice |
| D-36 | How much invitation mail a firm waiting for approval can send. On top of D-34's five pending invitations, a waiting firm may send at most twenty invitation emails (first sends and resends together) in any twenty-four hours; the next is refused with a plain message saying when it can send again. There is no lifetime limit: a waiting firm whose invitations were accepted can invite more. Both limits end when the firm is approved. Reason: without a rate limit a sign-up nobody has approved could withdraw and re-invite in a loop to send mail in bulk; a lifetime limit would strand a real firm that is simply waiting |
| D-101 | (Epic 1 decisions continue from D-101; D-37 to D-99 belong to Epic 2.) Referral links and which firm an intake belongs to. Today every intake a prospect starts belongs to the default firm (Edgar Allan Advisory), whatever address or link they came by; starting an intake for another firm arrives with New quote (Epic 5), which must take the firm from the address on the server, never from the browser's word alone. Until then a referral partner's link is offered only for the default firm. For any other firm the Referral Partners page keeps the partner and its code but shows no link, and says links come when the firm can take intakes. A code is matched to a partner only within the intake's own firm, so another firm's code used on the bare domain attributes nothing |
| D-102 | Adds one case to D-35. When a firm's alert is retried and NONE of the people it was first prepared for is still a current member, the alert goes to the firm's current members, rebuilt with a new send key, so that it is not lost. In every other case D-35 stands unchanged: recipients are fixed when the alert is first prepared, leavers are dropped, and someone who joined later does not receive that alert. D-35's own text is not rewritten; a change to a decision is a new decision that names the one it changes |

### Epic 1 build order

P-1.1 says roles are owner and member; D-5 wins: owner, lead, agent. P-1.2 and P-1.3 are replaced by CRM-P1.2,
CRM-P1.5 and CRM-P1.1.

| # | Story | What it covers | Needs |
|---|---|---|---|
| 1 | P-1.1 | Firms, teams, dated memberships, the parent column, a firm on every intake; Edgar Allan Advisory seeded with its members and every existing submission | nothing |
| 2 | CRM-P2.1a (with CRM-S5.1) | The visibility helper; every table policy and storage policy scoped to the firm; two firms, two agents and a lead in the SQL tests; the check that fails on a table with no firm rule | 1 |
| 3 | CRM-P2.1b | Every advisor and admin function that reads or changes firm data filters by the caller's firm | 2 |
| 4 | CRM-P2.1c | What has no submission behind it: referral partners, the advisor alert's recipients, the new-mail mark, mailboxes, held mail (D-16) | 2 |
| 5 | P-1.4 | The existing console pages show only the firm's records; the front end asks "is a member", not "is an advisor" | 3 |
| 6 | CRM-P1.3a | The firm address: the host chooses the firm shown; "You aren't a member of this firm"; a session per address | 2 |
| 7 | CRM-P1.3b | A second factor for password sign-ins, including the test gateway's password sign-in | 2 |
| 8 | CRM-P2.3 with Q-3.1 | The record of who did what, read by owners; export alerts when exports exist | 2 |
| 9 | CRM-P1.2 | Invite a member | 2 |
| 10 | CRM-P1.5 | Remove or suspend a member | 4, 8, 9 |
| 11 | CRM-P1.6 | Leave a firm | 10 |
| 12 | CRM-P1.4 | Join by organisation (D-23) | 9 |
| 13 | CRM-P1.1 with Q-1.2 | Sign up a firm; an admin approves it | 6 |
| 14 | CRM-P1.8 | Suspend a firm | 13 |
| 15 | CRM-P1.7 | Close a firm | 8, 14 |
| 16 | CRM-P2.2 | Files, tokens and reply addresses | 3, 4 |
| 17 | CRM-P2.4 | Help from Nevermore, logged | 3, 8 |

New migration files are named to sort after `20261115140000`.

### The three lines of work, brought together (2026-11-14)

Epic 1's late stories (CRM-P1.5, CRM-P2.2 and their fixes) were merged into `crm/epic-01-firms-security` only, CRM-P1.8 and
CRM-S1.1b went to `main`, and Epic 2's review fixes stayed on `crm/epic-02-shell-tables`. All three are merged into one line
on `claude/friendly-feynman-wlpj9j`, and every remaining story is built there, one after another, in the build order below.

| # | Decision |
|---|---|
| D-103 | Where two lines disagreed about a member of several firms, one firm at a time wins (D-40, ADR 0016): the Members page, like every member page, lets them in at a firm's address and sends them to "Choose a firm" on the bare domain. The Members page sits inside the workspace shell and is linked from Settings, for owners |
| D-104 | Six database objects were each rewritten by two lines that did not see each other, so the later file undid the earlier one's rule (a suspended firm's members were let back in; suspending a member failed). `20261117160000_epics_reconciled.sql` states each once with every rule. The two migrations that restate the list of activity kinds (`20261116220000`, `20261116230000`) were edited to accept each other's kinds: without that, whichever is applied second is refused on a database that already holds the other's entries. This is the one edit to an old migration, and it changes nothing on a database where both are already applied |
| D-105 | A story's SQL test loads every migration, not only those up to its own, whenever a later migration restates something the story made. Migrations for the stories still to build are named to sort after `20261117160000`, in the order they are built; the timestamps in the Epic 2 table below are replaced by that rule |
| D-106 | An outbox row belongs to an intake or, for a firm-level notice such as "a member left" (CRM-P1.6), to a firm and no intake. Firm-level rows are not shown on the firm's Outbox page (that page lists events through their intakes), are withheld while the firm is suspended, and are deleted 90 days after they were queued, by the same daily job that prunes the firm's record (`prune_firm_activity`, then `prune_firm_outbox_events`), with the same window |
| D-107 | A suspended member, and any member of a suspended firm, cannot leave a firm: they are not current members, so there is nothing for them to end. An owner removes a suspended member (CRM-P1.5) |
| D-108 | One organisation (a Google domain or a Microsoft tenant) may be listed by several firms. A listing grants nothing by itself: an owner of the firm approves each person who asks to join from it (CRM-P1.4) |
| D-109 | A declined request, and an ended membership of that firm (removed or left), are final for the automatic ask: signing in again lists the person for no one, and an owner brings them back only by invitation. Removing a listing leaves the requests already open, which an owner can still approve or decline (CRM-P1.4) |
| D-110 | A platform admin never asks to join a firm: they join only by an owner's invitation, so a firm that lists Nevermore's domain learns no staff email (D-33). A sign-in made with a password is vouched for by no provider, even if the account once linked Google or Microsoft. The token does not say which provider a provider sign-in used, so an account with both is matched through either (CRM-P1.4) |
| D-111 | The old platform-wide organisation list was not copied to any firm: its two tables are kept read-only as a record, and people who got the advisor role through it keep the role (CRM-P1.4, D-23) |
| D-112 | Owners are not emailed when someone asks to join: they see the request on the Invitations page. "Approved with a role and a team" is built as a role only; the team waits for CRM-X1.1 (D-20) (CRM-P1.4) |
| D-113 | A firm waiting for approval can ask to close, since it is theirs. A refused firm and a suspended firm can't (CRM-P1.7) |
| D-114 | A suspended firm is not closed: the daily job and `close_firm_now` leave a due request open while the firm is suspended, and the firm stays as the suspension leaves it. Lifting a suspension of a firm with an open request moves its closing date to the later of what it was and seven days from the lift, so its owners have time to withdraw, and the banner shows the new date. A suspended firm's owners still can't withdraw (they get nothing while suspended). A platform admin can stop a closing with a reason (`admin_stop_firm_closure`: recorded as Nevermore's under D-33, owners emailed, shown on the Firms page) but can neither ask to close a firm nor withdraw for its owners (CRM-P1.7) |
| D-115 | A closing firm is read-only by a guard on every write path (`assert_firm_writable`), not by changing `firm_role`, because its members still read. The guard refuses members of that firm only, so nobody learns a firm is closing. The paths are functions, a trigger (a note on an intake) and the two manuscript storage policies; a standing test lists every write function and policy and fails on one that is neither guarded nor exempt with a reason. Each guarded write holds the firm's row `FOR KEY SHARE` (D-122). Opening a quote request's thread stays allowed: it only marks it read (ADR 0023) |
| D-116 | After closing, the address looks like one no firm holds (D-27). The firm's row stays; its address is held 12 months from the closing day and released only when a new firm asks for it, by renaming the old row to `x.<id>` (accepted by the table's check, refused by `sign_up_firm`, so no sign-up can ever take it). Who asked, withdrew or stopped is kept as bare ids with no foreign key, so deleting an account neither erases nor blocks it |
| D-117 | Closing deletes by one list (`firm_closing_plan`), checked against the isolation registry in `data_isolation.sql`: a story that adds a table that holds a firm's data adds a line. Teams are deleted after the team is cleared from the ended memberships, under a narrow exception in the membership history trigger that exists only while the closing runs |
| D-118 | Alerts continue while a firm is closing (its members still read). At closing the firm's waiting alerts and emails are ended as cancelled ("the firm closed"), and any queued for it afterwards are ended as they are queued. The emails to owners that a closing was asked, withdrawn or stopped are one outbox kind, `firm_closing`. A firm that fails to close is an ops event (code `firm_close_failed`, the firm's id in the id column) as well as a warning |
| D-119 | Mail for a closed firm's reply addresses is still received and threaded onto the intake, which stays with the employer. Nobody can read it, and held mail can't be assigned onto a closed firm |
| D-120 | Between the 30 days ending and the next daily run the firm stays read-only and the request can no longer be withdrawn |
| D-121 | The default firm (Edgar Allan Advisory) can't be closed: it is refused when asked and by the closing itself, and Settings doesn't offer it. Every intake is stamped with it (D-101), so closing it would send every later intake to a firm nobody reads. This holds until an intake can belong to another firm: New quote (Epic 5) must revisit it |
| D-122 | The firm's row is the one lock that orders closing, suspending, lifting, deciding, withdrawing, stopping, asking and members' writes: guarded writes take it `FOR KEY SHARE` (inside `assert_firm_writable` and the manuscript storage helper), everything that decides the firm's state takes it `FOR UPDATE` first and checks after. A key share conflicts only with `FOR UPDATE`, so ordinary writes never wait for or deadlock each other. Each use has a two-session test (`close_a_firm_races.sql`, `close_a_firm.sql`) that fails without it. The one known limit: file bytes written to the object store outside the database transaction (ADR 0023) |

## Epic 2 decisions (2026-11-13)

These came from reading Epic 2's stories against the code as it stands at Epic 1's tip, where P-1.1,
CRM-P2.1a to c, P-1.4, CRM-P1.3a and b, CRM-P2.3, CRM-P1.2 and CRM-P1.1 are merged and CRM-P1.5, P1.6, P1.4,
P1.8, P1.7, P2.2 and P2.4 are not. No Epic 2 story needs one of the unmerged ones. There are no tables yet for
leads, accounts, contacts, opportunities or quotes, so under D-24 each story builds its mechanism and applies it
to a page that exists: the submissions queue, a submission, referral partners, invitations, activity, the outbox.

| # | Decision |
|---|---|
| D-37 | Where the workspace's routes live. One layout route, the firm guard around the workspace shell, wraps the member pages, which keep their `/advisor/*` paths so links and end-to-end tests survive (D-8). A new section takes a top-level path when its epic ships (`/home`, `/quotes`, `/inbox`, `/leads`, `/accounts`, `/reports`); `/settings` exists now. Platform-admin pages (held mail, firms, organisations) stay outside the shell in today's look, and the shell shows a "Nevermore admin" link only to a platform admin |
| D-38 | What each menu item opens until its own epic. Quotes opens the queue `/advisor`, and a submission's page marks Quotes. Inbox opens the queue filtered to "has new PEO mail". Reports opens `/advisor/funnel`. Settings opens a new `/settings` page linking to Mailbox, Invitations, Activity (owners), Referral partners, PEOs and Outbox. New quote, Home, Leads and Accounts are not shown until the stories that build them (CRM-Q2.1, CRM-H1, CRM-L1.1, CRM-A1.1), so the menu has no dead buttons. The firm's name goes to `/advisor` |
| D-39 | What the menu's counts mean today. Quotes: quote requests with status sent, on intakes the person may see. Inbox: quote requests with new PEO mail, by the rule the queue's mark already uses. Leads has no count until CRM-L1.1 |
| D-40 | Choosing a firm. At a firm's address the browser sends that address with every request, and the database's membership helpers then also require that a row's firm is that address's firm. The address only narrows: membership is still the lock (D-18), and a request with no address behaves as today. The list of a person's own firms is not narrowed. On the bare domain a member of several firms sees "Choose a firm", a list linking to each firm's address. This ends the "kept out" rule of the ADR "the console asks for a membership" (renumbered 0014 by Epic 1), builds on ADR 0015 (at a firm's address the current firm is that firm), and is recorded as ADR 0016 in CRM-S1.1b |
| D-41 | The look. The grey-and-blue colours live in `src/index.css` under a `theme-workspace` class that the shell puts on the page's root element while it is mounted, so dialogs, sheets and messages drawn outside the shell take the same look. The employer's intake keeps today's colours |
| D-42 | The foot of the menu shows the person's name, or their email when they have no name, and their role (Owner, Lead, Agent). No team (D-20) |
| D-43 | Where a table's state lives. Page, sort, filters, view and search are in the page's address. A person's column choices are a row per firm, person and table in the database; saved views are rows a firm owner can share; built-in views live in code. Local storage is not used: "per person" means on any device |
| D-44 | Sort, filter and paging run in the database, 50 rows a page. Filters are matched by fixed SQL over a listed set of columns per table. No function builds SQL from what the browser sends |
| D-45 | A record's history and the firm's activity record are two things. The history holds a record's own fields, field by field, written only by a trigger that lists the fields to track, so an intake's answers can never enter it; it is kept as long as the record and read by whoever may see the record. The activity record (CRM-P2.3) stays the record of who did what: no content, owners only, ninety days. Neither writes into the other. A Nevermore staff actor is stored and shown as in D-33 |
| D-46 | What "someone else changed it" compares. Each editable record has a whole-number version that a trigger raises on every change. A save names the version it started from; a mismatch is refused and returns the current values and who changed them |
| D-47 | CRM-S3.6 (selecting rows) and CRM-S3.7 (bulk edit) move to Epic 3, after CRM-A1.1. Every bulk action named needs something that does not exist yet: submissions have no owner (D-15), there are no labels or custom fields, and the queue's fields are intake answers or values the product works out |
| D-48 | What can be exported. Never the queue: its columns are an intake's answers (CRM-S3.8). An export runs through a database function that returns the rows and records the export in the same step, so the recorded count is true and the record cannot be skipped. The owners' alert and the fresh sign-in for a whole-table export that CRM-P2.3 and CRM-P1.3 deferred are built with it. First applied to referral partners and, for owners, the activity record |
| D-49 | Workspace lists are fetched through the query library the app already provides: refreshed on focus and every 60 seconds, keeping the rows on screen while the next arrive |
| D-50 | Small helpers (the address codec, filter operators, field rules, the CSV builder) are tested through the page or form that uses them, as D-13 says, not on their own |
| D-51 | Workspace forms are built on the form and validation libraries already installed (`react-hook-form`, `zod`, `src/components/ui/form.tsx`) |
| D-52 | At a firm's address, `/` sends a signed-in member to the workspace instead of the landing page |
| D-53 | Builders (founder, 2026-11-13, replacing D-14 from Epic 2 on). Opus builds database and server-function stories and does every review. Sonnet builds page and form stories. The orchestrator writes each story's brief, merges, and settles what a review finds |

### Epic 2 build order

A story marked a, b or c is one story of `docs/BROKER_CRM_STORIES.md` split by seam. Lanes: **Q** changes the
queue page and `src/components/workspace/table/`; **P** changes the partners and invitations pages; **D** is the
database. Stories in different lanes run side by side.

| # | Story | What it covers now, and where | Needs | Builder | Migration |
|---|---|---|---|---|---|
| 1 | CRM-S1.1a | The shell: left menu, firm name and address, the person and role, a sheet at phone width, the current section marked, the grey-and-blue look, a title per page, the `/settings` page. Wraps every member page under `/advisor/*` | none | Sonnet (Q) | none |
| 2 | CRM-S1.1b | One firm at a time (D-40): the address narrows the database's answers; a member of several firms is let in at a firm's address and chooses on the bare domain. ADR 0016 | none | Opus (D) | `20261117090000` |
| 3 | CRM-S3.3b | The queue's query in the database (D-44): sort by any column, filters as data, 50 a page, a "has new PEO mail" filter, counts for view tabs | none | Opus (D) | `20261117100000` |
| 4 | CRM-S5.2 | Record history (D-45): the table, the capture trigger, the reading function. Applied to referral partners | none | Opus (D) | `20261117110000` |
| 5 | CRM-S3.1b with S3.4b | Where column choices and saved views are kept (D-43) | none | Opus (D) | `20261117120000` |
| 6 | CRM-S1.1c | Menu counts (D-39), refreshed on focus and every 60 seconds | 1 | Opus (D) | `20261117130000` |
| 7 | CRM-S3.5a | The table frame: column definitions, the address codec, the table, "1 to 50 of N" with Previous and Next. The queue moves onto it | 1, 3 | Sonnet (Q) | none |
| 8 | CRM-S4.1 | Forms: "Required" in words, errors under the field, focus to the first error, asking before closing with unsaved changes, edit in place. Applied to the referral-partner and invitation forms | 1 | Sonnet (P) | none |
| 9 | CRM-S2.1 | Loading: grey rows shaped like the columns, announced once, "taking longer than usual" after ten seconds. Queue, submission, activity, outbox | 7 | Sonnet (Q) | none |
| 10 | CRM-S3.2a | Sort: headers that sort and show the direction; the sort is in the address | 7 | Sonnet (Q) | none |
| 11 | CRM-S2.4b | The version for the conflict check (D-46), on referral partners | 4 | Opus (D) | `20261117140000` |
| 12 | CRM-S2.2 | Empty: "nothing yet" and "nothing matches". Queue, activity, outbox, invitations | 9 | Sonnet (Q) | none |
| 13 | CRM-S3.3a | Filter: the row of filters, chips, "Add filter", operators by kind of field, filters in the address. Today's status, action and waiting links keep working | 10, 3 | Sonnet (Q) | none |
| 14 | CRM-S2.3 | Something went wrong: failed load with "Try again", a failed panel, a failed save, "This submission isn't available" | 12 | Sonnet (Q) | none |
| 15 | CRM-S2.4a | Out of date: lists that refresh in place (D-49), the no-connection banner, the conflict dialog on the partner form | 8, 11 | Sonnet (P) | none |
| 16 | CRM-S3.1a | Columns: show, hide, reorder; the first column stays; kept per person | 13, 5 | Sonnet (Q) | none |
| 17 | CRM-S3.4a | Saved views: tabs with counts; today's status tabs are the built-in views; save, rename, delete, share | 16, 5, 3 | Sonnet (Q) | none |
| 18 | CRM-S3.8b | Export in the database (D-48), the owners' alert, the fresh sign-in | 2 | Opus (D) | `20261117150000` |
| 19 | CRM-S3.8a | The Export button and the CSV, on referral partners and the activity record | 16, 18 | Sonnet (P) | none |

**What each story leaves to a later one (D-24).** S1.1a: New quote to CRM-Q2.1, Home to CRM-H1, Leads to
CRM-L1.1, Accounts to CRM-A1.1, "an opportunity marks Accounts" to CRM-O1.1, the team under the person's name to
CRM-X1.1. S1.1c: the Leads count to CRM-L1.1, unread mail across every thread to CRM-E1.4, open quotes by the new
statuses to CRM-Q3.1. S2.1 and S2.2: import as a second action to CRM-X4.1; empty lists inside a record to
CRM-A2.1, CRM-C1.1 and CRM-O1.1. S2.4: keeping a selection through a refresh to CRM-S3.6; the conflict check on
accounts, contacts, leads and opportunities to the story that builds each one's form. S3.1 and S3.3: custom
fields to CRM-X3.1; "me" and "my team" filters to CRM-A1.1. S3.2, S3.4: each table's default sort, unsortable
columns and built-in views to that table's story. S3.8: exports of accounts, leads and quotes to CRM-A1.1,
CRM-L1.1 and CRM-Q4.1; exporting a selection to CRM-S3.6. S4.1: "a contact needs an email or a phone" to
CRM-A2.2, "an opportunity needs its account" to CRM-A2.3, the phone, state and date fields to CRM-A1.2, edit in
place on a record's page to CRM-A2.1. S5.2: history on each of the five records to the story that creates its
table; a screen that shows history to CRM-A2.1 and CRM-L2.1.

**Shared pieces, one owner each.** The shell, the menu's list and the theme class: S1.1a
(`src/components/workspace/`). Sending the firm address and the "Choose a firm" page: S1.1b. The table's column
type, address codec, table and pager: S3.5a (`src/components/workspace/table/`), which fixes the whole shape of
a table's address (page, sort, filters, view, search) so later stories only fill it in. Page states:
`src/components/workspace/states/`, each by the S2 story that names it. Forms:
`src/components/workspace/form/`, S4.1. Each story's calls to the database go in a file of its own under
`src/lib/`, not in `src/lib/advisorApi.ts`.

## Rules for building one story

1. **Branch.** `crm/<epic number>/<story id in lower case>` (for example `crm/01/crm-p1.2`), cut from the epic's
   branch. One pull request, into the epic's branch, titled `<story id>: <what a person can now do>`.
2. **Read first.** `GLOSSARY.md`, the ADRs for the area, the story and every story it names, and the screens it
   names in `docs/prd-screens/`.
3. **Test-driven** (the `tdd` skill): one failing test, then only the code that passes it, at the seams in D-13.
   Name the break each test catches. Mutate what you changed before you finish.
4. **The gate**, all green before the pull request is opened:
   `npm run lint && npm run typecheck:functions && npm test && npm run build`, then
   `PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh`, and
   `npm run test:e2e` when the story touches a flow in `e2e/`.
5. **Database.** A new migration file per story, never an edit to an old one. Every new table carries its firm
   and its row security in the same migration, with its SQL test.
6. **Words.** Add each new term to `GLOSSARY.md` in the story that introduces it. Record a decision that
   reverses an earlier one as an ADR in `docs/adr/`.
7. **What can't be built as written.** Stop and say so in the pull request, naming the story line and what is
   missing. Never invent a fact about a PEO, and never present draft legal wording as counsel's.
8. **Working beside other stories.** Each story is built in its own lane. Its migration file takes the timestamp it was given, so two stories never pick the same name. Before a story merges, the epic's branch is merged into it, conflicts are settled, and the gate is run again.
9. **The pull request says:** what a person can now do; the acceptance criteria met, each with its test; any
   criterion not met and why; what was not asked for and was left alone.

## Review of one story

The `code-review` skill, against the epic's branch: Standards, Spec and Adversarial, each read independently,
then validated. Ready means no verified P0 or P1 and no incomplete axis. P2 findings are fixed before merging;
P3 are fixed or listed in the pull request.
