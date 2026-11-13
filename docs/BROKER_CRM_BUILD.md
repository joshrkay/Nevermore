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
| D-14 | Sonnet builds every story. Opus does every review |
| D-25 | Stories in an epic are built at the same time wherever one does not need another. Up to three run side by side, each in its own working copy with its own test database; a story starts as soon as the stories it needs have merged |

## Epics, in order

| # | Epic | Branch | Stories |
|---|---|---|---|
| 1 | Firms and security | `crm/epic-01-firms-security` | P-1.1, CRM-S5.1, CRM-P2.1, P-1.4, CRM-P1.2, CRM-P1.3, CRM-P1.5, CRM-P1.6, CRM-P1.4, CRM-P1.1 with Q-1.2, CRM-P1.7, CRM-P1.8, CRM-P2.2, CRM-P2.3 with Q-3.1, CRM-P2.4, CRM-P2.5 with P-2.3 |
| 2 | Shell and tables | `crm/epic-02-shell-tables` | CRM-S1.1, CRM-S2.1 to S2.4, CRM-S3.1 to S3.8, CRM-S4.1, CRM-S5.2 |
| 3 | Accounts and contacts | `crm/epic-03-accounts-contacts` | CRM-Q1.1, CRM-Q1.3, CRM-A1.1 to A1.3, CRM-A2.1, CRM-A2.2, CRM-C1.1, CRM-E1.5, CRM-S4.2, CRM-S4.3, CRM-S1.2 |
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
| D-35 | Who receives a firm's alert when a send is retried. The recipients of an alert are fixed when it is first prepared: the firm's current members at that moment. On a retry, anyone who has since left the firm is dropped (a former member is never sent a firm's alert), and the message is rebuilt only for that reason. Someone who joined between the first attempt and the retry does not receive that one alert, unless none of the people it named is still a member (nobody now in the firm can have had it, so it goes to the current members; this also covers an alert frozen to the shared inbox before alerts went to members); they receive every alert prepared after they joined. Reason: rebuilding a message to add a new member changes its send key, so people who already received it would receive it twice |
| D-36 | How much invitation mail a firm waiting for approval can send. On top of D-34's five pending invitations, a waiting firm may send at most twenty invitation emails (first sends and resends together) in any twenty-four hours; the next is refused with a plain message saying when it can send again. There is no lifetime limit: a waiting firm whose invitations were accepted can invite more. Both limits end when the firm is approved. Reason: without a rate limit a sign-up nobody has approved could withdraw and re-invite in a loop to send mail in bulk; a lifetime limit would strand a real firm that is simply waiting |
| D-101 | (Epic 1 decisions continue from D-101; D-37 to D-99 belong to Epic 2.) Referral links and which firm an intake belongs to. Today every intake a prospect starts belongs to the default firm (Edgar Allan Advisory), whatever address or link they came by; starting an intake for another firm arrives with New quote (Epic 5), which must take the firm from the address on the server, never from the browser's word alone. Until then a referral partner's link is offered only for the default firm. For any other firm the Referral Partners page keeps the partner and its code but shows no link, and says links come when the firm can take intakes. A code is matched to a partner only within the intake's own firm, so another firm's code used on the bare domain attributes nothing |

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
