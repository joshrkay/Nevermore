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
| D-14 | Opus builds database, security and server-function stories and does every review. Sonnet builds page and form stories |

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
8. **The pull request says:** what a person can now do; the acceptance criteria met, each with its test; any
   criterion not met and why; what was not asked for and was left alone.

## Review of one story

The `code-review` skill, against the epic's branch: Standards, Spec and Adversarial, each read independently,
then validated. Ready means no verified P0 or P1 and no incomplete axis. P2 findings are fixed before merging;
P3 are fixed or listed in the pull request.
