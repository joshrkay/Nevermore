# A line says what is being quoted

Status: accepted (founder, 2026-11-18: workers' comp is the second line, and it is to be built, not only written up). It reverses one row of the PRD's out-of-scope table ("Policies, carriers, certificates") for the part named under Decision, and nothing else in it. The questions at the end are still the founder's.

## Context

Nevermore quoted one thing: a PEO. The founder wants it to be the place a broker sends for quotes on anything quoted by people rather than by a rater, starting with workers' compensation on its own.

The CRM half does not know what is being quoted. Firms, memberships, leads, accounts, contacts, opportunities, conversations, mailboxes, the inbox, record history, saved views and export name no PEO in their tables.

The quoting half knew it in five places, and no interface said they shared the knowledge:

| Where | What it held that is a PEO's |
|---|---|
| The intake | One schema for every intake (`chamber_sessions.schema_version` must be 3; about 110 fields) |
| The market | `peos`, their requirement profiles, contacts and census templates, kept by platform admins; the employer's `peo_authorizations`; a firm's `peo_registrations` |
| The quote | `quotes`: the administrative fee and its basis, one-off fees, workers' comp rates by state and class code, unemployment, medical, each with its own validator |
| The comparison | The cost areas a row and a note can be about: a fixed list of those five |
| Words | "PEO" on the screens, in the line every message carries, and in the question the employer is asked |

Workers' compensation is the nearest second case, because most of what it needs was already here: the intake asks what a workers' comp application asks, and `workersCompPdf` prints it in the order of the standard application. What it lacked was somewhere to send it other than a PEO, and a quote that holds a premium.

## Decision

An opportunity has a **line**: what is being quoted for the account. Two exist, `peo` and `workers_comp`. It is chosen when the opportunity is made and never changes.

**Where the line is held, and what ties the copies.** Three rows hold it, and each copy is one the database keeps equal or keeps fixed, never one a function has to remember:

- The opportunity (`opportunities.line`): the choice. No writer changes it (a trigger refuses, the table's owner included).
- The intake (`chamber_sessions.line`): the employer reads their own intake and never the firm's opportunity, so the intake says what it is for. An opportunity holds only an intake of its own line, by a foreign key on the pair (`opportunities_intake_line_fkey`), as the firm is already held. An intake made for an opportunity is made with its line (`start_broker_intake`); an opportunity made for an intake that already exists takes the intake's (the chain at certification names none). An intake a prospect starts in the browser is a PEO intake, whatever the browser sends, until a firm link carries a line.
- The market (`peos.line`): who a quote request can be sent to. Never changed.

Quote requests and quotes hold no copy. Each is checked against its intake's line when it is written; that line never changes, so what passes then is right for good.

**One module, Line, answers what differs.** In the database it is `quote_lines()` and `quote_line_areas(line)`; in the browser, `src/data/lines.ts`; `schemaSync.test.ts` holds the two equal.

1. **Which markets.** A market is a PEO or a carrier, and both are rows of `peos`, which keeps its name. The requirement profile, the contacts, the employer's authorization, the send's registration and the reply address are the same for either, so a second table would have been a second copy of all of it. This is the part of "Policies, carriers, certificates" that is reversed: a carrier becomes someone a quote request is sent to. A policy, a certificate and anything else an agency management system holds stay out.
2. **Who may be authorized and sent to.** The employer is offered, and can authorize, only markets of their intake's line. Every send asks for that authorization, so a workers' comp search is sent to carriers and a PEO search to PEOs. The database refuses the wrong one in words, and a trigger refuses any other writer.
3. **What a quote holds.** `quote_line_areas`: for `peo`, the administrative fee, one-off fees, workers' comp rates, unemployment and medical, as before. For `workers_comp`: the estimated annual premium, workers' comp rates by state and class code (the existing list), the experience modification, the minimum premium, and fees. A quote holds nothing of another line's: `record_quote` refuses it in words and a trigger on `quotes` refuses any other writer. Within a line every quote holds the same things, so the PRD's rule stands: there are still no custom fields on a quote.
4. **What the comparison shows.** One row for each area of the opportunity's line, in the line's order. A comparison is of one opportunity, so of one line.

Sending, the bundle link, reply addresses, held mail, the inbox, reply suggestions, follow-up and withdrawal, the opportunity's stage, won and lost, placements, and firm isolation are the same for every line and read none of this. Isolation carries over without a new rule: a quote request and a quote belong to an intake, and an intake to a firm.

### What was considered and not done

- **A table of carriers beside `peos`.** Rejected once the code was read: a market's profile, contacts, authorizations, registrations and templates are six tables and more than forty functions, and each would need a twin.
- **A copy of the line on every quote request and quote, tied by foreign keys.** Not needed: the intake's line never changes, so a check when the row is written holds for good, and the two tables' shapes (and the history that logs every column of a quote request) are left alone.
- **Renaming.** `peos`, `peo_name` and the PEO functions keep their names. A market of the `workers_comp` line is called a carrier on every screen; in the code it is a row of `peos`.
- **A third line.** Added when it is named, against this interface; if it does not fit, the interface changes then.

## Consequences

- An account can have a PEO search and a workers' comp search open at once (an account was never limited to one open opportunity).
- A PEO is never called a carrier and a carrier never a PEO: the screens that were changed take their words from the line (`MARKET_WORDS`). The glossary gains **Line**, **Market** and **Carrier**.
- The site is deployed apart from the database. The browser names a line, or a workers' comp figure, only when it is not the default, and reads a missing line as `peo`, so a site deployed before the migration is pushed keeps working for PEO searches and refuses only a workers' comp one.
- The employer's authorization wording names the market itself and says neither word, so it is the same for every line under the one version; the question above it and the line every message carries have a carrier's wording, in the one legal-wording module, still a draft (D-12).
- A broker who places workers' comp needs a property and casualty producer licence in the state. D-21 built firm approval with no licence check because nothing recorded a producer number; this line is the reason to revisit that.

### Not built yet

- **The intake asked by line.** A workers' comp intake still asks every field of the one schema (medical plans and the current-PEO questions included), its PEO Match tab still lists PEOs, and the invitation an employer opens still says "PEO intake". The packet a carrier is sent is the same bundle a PEO gets, and the packet's own text speaks of PEOs.
- **A firm link that starts a workers' comp intake.** Only an agent starts one, from an opportunity.
- **The older screens' words.** A workers' comp search's own screens say carrier: New opportunity, the opportunity's page (the stage's guidance, the quotes panel, choosing and sending, the comparison, Mark won or lost and its reasons, the Lost banner), the quote's page (the details, the figures, recording a quote, what was sent, Send again) and the employer's boxes. These still say PEO whatever the line: the submission's page and its panels ("What each PEO still needs", the status panel), the lists that hold every line together (the quotes table, the inbox, the reports), the platform admin's page, the reasons for closing one quote request and its decline, the thread's own words, the history, and the words a firm that is not yet approved to send is told. The quotes table has no premium column. The opportunity made by the chain for a workers' comp intake (reachable only after an employer ends a firm's access and certifies again) is still named "PEO search".
- **Reading a carrier's quote document.** The reader proposes a PEO's figures only, so it is not offered on a carrier's quote.
- **A renewal's line.** Start the renewal offers the choice and starts on PEO; it does not yet take the line of the placement it renews. A renewal can rightly change line (an employer with workers' comp alone may look at a PEO at renewal), so this is a default to add, not a rule.

## Open questions

1. Who is a workers' comp quote request sent to in practice: carriers directly, wholesalers and general agents, or both? A quote from a wholesaler names an issuing carrier, which a quote has no place for yet.
2. Is a state fund or the assigned-risk plan a market here, or out of scope?
3. Does a firm need to show a producer licence before it can send on this line?
4. Is the quote's shape what brokers compare, or are payment plans, dividends and schedule credits needed? Today they go in the quote's note.
5. May a platform admin alone add a carrier, as with PEOs, or may a firm add its own markets?
