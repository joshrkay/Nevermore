# From intake to the PEO industry's quoting platform

| | |
|---|---|
| **Date** | 2026-11-10 |
| **Question** | How does Nevermore get from a PEO underwriting intake to what Progressive and the comparative raters were for P&C insurance: how PEOs ask for data, how we map onto it, and how brokers log in, post submissions and are tracked |
| **Status** | Research and a recommended path, for the founder to challenge. Nothing here is decided |
| **Source notes** | `2026-11-10-pc-quoting-sources.md` (P&C history and mechanics) and `2026-11-10-peo-data-sources.md` (the PEO ask, brokers, regulation), both in this folder, each with a URL per claim |

**How far to trust this.** The codebase findings were read directly from the repo at commit `917fd86`. The external
findings were gathered by web search only: pages could not be opened from this environment, so each external claim
rests on a search extract of the cited page, and several come from vendor marketing. Before anything here goes
outside the company, or becomes a per-PEO field map, read the primary documents listed in section 9.

Below, **fact** means read in the repo or stated in a cited source, **inference** means reasoning from those, and
**recommendation** means a choice we would make.

---

## 1. The short version

1. **What P&C did was three separate things, in order.** A standard ask (ACORD forms, from 1971). Then pipes that
   carried one entry to many carriers (comparative raters such as EZLynx: "single entry, multiple company"). Then
   portals where agents quote, sell and are tracked (Progressive's ForAgentsOnly, agent quoting from 2002).
   Progressive's own contribution was showing competitors' prices beside its own (by phone from 1993/94) and making
   the quote something you could buy on the spot (online from 1997).
2. **Nevermore has built most of the first thing and none of the other two.** The packet is a standard ask in the
   making. Nothing is sent to a PEO by the product, a quote is one number typed in by an advisor, and nobody
   outside our own advisory team can log in to work a submission.
3. **A true rater is not available in PEO yet, and the research found nobody who has one.** P&C raters work because
   rates are filed and computable. PEO pricing is an underwriter's judgment made inside each PEO's own tool, and no
   PEO was found with a public quoting interface. The reachable product is: enter once, submit to every PEO in its
   own format, get proposals back, compare them on the same lines. Instant numbers come later and only where a PEO
   publishes its pricing.
4. **The reverse map is a per-PEO "requirement profile".** Each PEO's ask (fields, census template, supplemental
   questions, documents, what it won't write, how it wants to be sent a submission, how it registers a broker)
   becomes data. The intake collects the union once; each PEO gets its own projection. Today's intake is missing
   about a dozen things nearly every PEO asks for, starting with the FEIN.
5. **Brokers need a firm workspace, and the product is one refactor away from having one.** The Advisor Console
   already is a broker's pipeline. It assumes one firm (ours) that sees every intake. Make the firm a tenant,
   make Edgar Allan Advisory the first tenant, and the same screens serve outside brokers.
6. **Three written commitments have to change first**, and they need counsel: the product "sends nothing to a PEO"
   (D9, D44), the consent the prospect signs, and whether comparing PEO offers needs a license in some states.

---

## 1a. Direction set by the founder (2026-11-10)

After reading the first version of this report, the founder narrowed the goal. This section records that and
adds the one design the first version left thin: email.

- **Progressive is the idea, not the mechanism.** Underwriting stays with each PEO's underwriters. Nobody is
  asking for a rater that computes a price.
- **The core is the quoting tool: the common questions.** Take the forms PEOs and their carriers already use,
  make sure the intake holds everything they ask, and ask it once. That is section 5.
- **Delivery is email, and the email has to be threaded.** Status, replies, updates and annotations all come back
  onto the quote request they belong to. That is section 5a, new.
- **The users are brokers and their clients.** They create quote requests and compare what comes back. That is
  sections 5.4 and 6.
- **PEOs win because their data collection is done for them.** They get a complete, certified submission in their
  own layout and are asked to change nothing. So no step depends on a PEO adopting anything.

What this changes in the sequence (section 7): steps 5 and 6 (instant prices, integrations) drop out of the plan
until a PEO asks for them. Steps 1 to 4 are the product. Sending by threaded email becomes the centre of step 3
rather than the first of four delivery tiers.

---

## 2. What actually happened in P&C

Facts, from `2026-11-10-pc-quoting-sources.md`:

| Layer | What it was | Detail that matters for us |
|---|---|---|
| **Standard ask** | ACORD forms: 125 (common commercial application), 130 (workers' comp), and others. Later the same data as AL3 batch files and ACORD XML | Carriers never dropped their own supplemental questions. The standard covers the common core and each carrier appends its own |
| **Pipes** | Comparative raters: one entry, a mapping per carrier, sent to all in parallel, results in one grid, then a "bridge" into the carrier's portal to finish and bind | The rater is not the appointed party. The agency enters its own carrier logins and producer codes; no appointment, no quote |
| **Portal** | Carrier and platform agent portals: quote and sell, submission lists with status, documents, commissions | Producers are identified by National Producer Number (NPN, issued to people and to firms) plus a code each carrier issues |
| **Progressive** | Phone quotes with up to three competitors' rates (1993/94), online quoting (1996), real-time online purchase (1997), agent quoting on ForAgentsOnly (2002), then selling other carriers' products through its own storefront (HomeQuote Explorer 2017, BusinessQuote Explorer 2019) | Progressive was a carrier. It became where shopping starts by publishing the comparison, and it gave agents the same engine customers got |

Three more facts carry most of the lessons:

- **Three kinds of answer, kept apart.** An *indication* is a non-binding estimate. A *bindable quote* is a firm
  offer. A *referral* needs an underwriter. Pie's partner interface offers them as three separate steps: appetite
  check, price indication, bindable quote.
- **Commercial lines, the nearest cousin to PEO, mostly did not get there.** A vendor blog citing a 2024 trade
  survey says 76% of independent agents use no commercial comparative rater. The reasons given: too few carriers on
  the panel, and grids of indications that the agent had to re-key in the carrier's portal anyway. The recurring
  complaint about raters is that the number shown is not the final number.
- **How submissions travel when there is no API.** Appulate sends each submission the way that market can take it:
  a structured web service, filling the carrier's portal, or an email with forms attached.

Also fact: who gets credit for a submission ("clearance", broker of record) is each carrier's own rule, not a
standard. And the neutral exchanges were bought by carriers and distributors (Bold Penguin by American Family,
CoverWallet by Aon, Tarmika by Applied).

**Inference.** The honest analogy for Nevermore is ACORD plus a comparative rater plus an agent portal. The
"Progressive moment" (a price on the spot, competitors beside it) is the end of the road, and in PEO it depends on
PEOs agreeing to price by rule, which we do not control.

---

## 3. How PEOs ask for data today

Facts, from `2026-11-10-peo-data-sources.md`:

- **The flow is email.** A broker or the employer emails a census spreadsheet and PDFs to a PEO sales rep. The rep
  keys it into the PEO's internal pricing tool (a TriNet job listing describes exactly this; at PEOs running on
  PrismHR the tool is ClientSpace's Pricing Console). A proposal comes back in 24 hours to several business days.
- **What comes back has four cost areas**: the administrative fee (a percentage of payroll, or per employee per
  month), workers' comp, state unemployment tax, and health benefits. Each PEO lays its proposal out differently,
  which is why brokers build comparison sheets by hand.
- **The ask, by line:**

| Line | Asked by nearly everyone | Where PEOs differ |
|---|---|---|
| Company | Legal name, FEIN, entity type, address, industry code (SIC or NAICS), description of operations, states | Website or LinkedIn page (PrestigePEO) |
| Workers' comp | Per employee: job title, work state, pay. Class codes with payroll per code per state. Experience mod. Current carrier, policy and dates. Owners and officers, included or excluded. Loss runs | Years of loss runs: 3 (PrestigePEO, to quote guaranteed cost), 3 to 5 (ExtensisHR). PrestigePEO also wants worksite, remote and travel status per person |
| Health | Census: date of birth, gender, home ZIP, coverage tier. Current carrier invoice. Plan summaries. Current and renewal rates | Census depth: dependents listed one by one (ExtensisHR, Justworks) or not. Names required or not. COBRA participants (FrankCrum). **A mandatory template** (FrankCrum's own Excel file). **A signed group health questionnaire** (PrestigePEO, valid 90 days) or none at all (one Warner Pacific programme) |
| Payroll and tax | Pay frequency, gross payroll, headcount, state unemployment rate per state (the PEO asks the client for the state's rate notice) | Whether the proposal shows unemployment tax before and after the wage base |

- **No PEO was found with a public quoting interface or a portal that returns a firm price.** Justworks publishes a
  per-employee price list and requires referrals through its own partner tool. TriNet has a broker dashboard that
  shows a broker's submitted pipeline. This is absence of search results, not proof.
- **No standard exists.** NAPEO publishes nothing like an ACORD form. The workers' comp part follows ACORD 130
  because PEOs' carriers do. A benefits-industry standard for a quote census (LIMRA's LDEx) is still in development.
- **Nobody was found with a real rater.** The closest are Zeyrax (a "universal form", census-to-invoice checking and
  side-by-side comparison, sold to brokers) and Entravia ("the infrastructure layer for PEO shopping"). Vyral claims
  instant PEO quotes; how was not verified. These are the competitors to study first.

---

## 4. Where Nevermore is today

Facts, from the repo:

| P&C component | What Nevermore has | What is missing |
|---|---|---|
| Single entry | Lenore's intake by text and voice, document upload with extraction, 42 fields plus a census, provenance and status on every answer, certification by a verified signer (`docs/intake-schema.md`) | Depth: see section 5 |
| The standard form | The packet (The Manuscript): same layout every time, open items listed, File ID, versions | It is one PEO-neutral PDF. There is no per-PEO output, no machine-readable export, no ACORD 130 |
| Appetite | `peoFit()` compares headcount and states against the catalog | The catalog is five names in a source file with every fact `null` (`src/data/peoCatalog.ts`), so every check says "Not yet confirmed" |
| Sending to the market | Nothing. "The product sends nothing to the PEO" (GLOSSARY, D9, D44). Advisors send by hand and record it afterwards | The whole layer |
| Quotes | One quote request per PEO per submission, with status sent, quoted, declined or closed, and a full change log. A quote holds arrival, expiry, start date, **one number** (admin fee per employee per month) and a note. No attachment | The other three cost areas, the proposal document, indication against firm offer, any comparison, anything the prospect can see |
| Portal for the people who place business | The Advisor Console: queue as a board, submission page, information requests, notes, status history, funnel | Roles are only `advisor` and `admin`, and every advisor sees every intake (D16). No firms, no outside users |
| Tracking | Referral partners with a code and a link, counts by source, a content-free funnel (D41, D43) | Partners never log in and "never see the console". No identity, no license, no per-PEO registration record |
| Role and promises | "Not a PEO, an insurance carrier or an insurance agency"; the prospect sends the packet themselves; the copy guard forbids naming PEOs as partners or promising a quote | Each of these is contradicted by a quoting platform. `docs/LEGAL_REVIEW.md` questions 1 and 2 are still open |

**Inference.** The intake, the provenance, the certification and the append-only records are the hard parts of a
standard ask, and they exist. What is missing is depth in the data, any movement of that data toward a PEO, and
any tenant other than ourselves.

---

## 5. The reverse map: from each PEO's ask to our intake

### 5.1 What the intake does not collect yet

Comparing section 3 with `docs/intake-schema.md` (fact for each gap; the priority is a recommendation):

| Gap | Who asks | Note |
|---|---|---|
| **FEIN** (we hold only a count of FEINs) | Everyone; ACORD 130 | The readiness plan already notes "no EIN field" under D2 |
| Entity type, years in business, address, industry code, description of operations | Everyone; ACORD 130 | `industry` is free text today |
| Census: **gender**, **hire date**, COBRA status, remote or travel status, worksite | Health underwriters; PrestigePEO for comp | The census row has date of birth, ZIP, title, salary, tier and class code already |
| Dependents listed one by one | ExtensisHR, Justworks | The schema has the array; nothing writes it (D21) |
| Owners and officers: name, title, ownership, included or excluded from comp | Comp underwriters; ACORD 130 | Not held |
| Payroll by class code by state | Comp underwriters; PEO pricing tools | Can be computed from the census (class code, salary, work state). Not computed today |
| Loss history by year: carrier, premium, claims, paid, reserved; and the loss-run PDFs | Comp underwriters | We hold one carrier, one premium and one mod |
| The ACORD 130 yes/no questions (subcontractors, work at height, hazardous materials, travel, and so on) | Comp underwriters | Not held |
| Current plans: designs, rates by tier, employer contribution, participation, renewal rates | Health underwriters | We hold carrier, renewal date and a free-text rate history |
| State unemployment rate per state | Everyone pricing tax | Not held |
| Gross annual payroll | Everyone | Can be computed from the census |
| Whether they are in a PEO now, and which | ExtensisHR; brokers | Not held |
| Group health questionnaire | Some PEOs only | Sensitive: see section 8 |

### 5.2 The mechanism (recommendation)

Model each PEO's ask as data, not code. One **requirement profile** per PEO, versioned and dated like the catalog's
`lastVerified`:

- **Fields** it needs to quote, and which it needs only to bind (PrestigePEO quotes its large-deductible programme
  without loss runs and needs them before binding).
- **Census projection**: which columns, at what depth, in which file layout, including a PEO's own mandatory
  template.
- **Supplemental questions** nobody else asks, shown only when that PEO is selected. P&C never got rid of these
  and neither will we.
- **Documents** required: loss runs for how many years, invoices, plan summaries, state rate notices.
- **Appetite rules**: minimum headcount, states, industries or class codes it won't write, minimum enrolment.
- **Channel**: where a submission goes (an address, a partner tool, a portal) and in what form.
- **Registration rule**: how that PEO credits a broker and for how long.

Then four things fall out of the same profile:

1. **Lenore asks the union once.** The intake's ranked fields become "what the PEOs this employer could go to
   need", so a low-hazard 20-person firm is never asked about work at height.
2. **Readiness per PEO.** "Ready to certify" stays as it is. Beside it: "ready for PEO X: 2 items short", which is
   the open-items list filtered by a profile.
3. **Outputs per PEO.** That PEO's census file, a filled ACORD 130 for the comp part, and the packet, all rendered
   from the same certified answers.
4. **Appetite before price.** With real catalog facts, the first instant answer the product gives is "these PEOs
   will look at you, these won't, and why". That is the step P&C platforms put first, and it needs no PEO's
   cooperation.

Profiles are built by reading each PEO's own published forms and by asking their broker desks. The source notes
name the first documents to read (section 9).

### 5.3 How a submission reaches a PEO (recommendation)

Follow Appulate's tiers, cheapest first, and never wait for the next one:

1. **Email with structured attachments**, sent by the product, logged, with a tracked link back. This works with
   every PEO today.
2. **A PEO-side link, no account needed.** The PEO rep opens the submission, downloads the files in their format,
   asks a question (which becomes an information request to the employer) and uploads the proposal. This is where
   structured data starts coming back without any integration.
3. **The PEO's own partner tool**, where one is mandatory (Justworks requires its own).
4. **An API**, when a PEO offers one. None was found.

### 5.4 What comes back

A quote today is one number. To compare, it has to hold the four cost areas: administrative fee and its basis;
comp rates per class code; how unemployment tax is charged; benefit rates per plan and tier; one-off fees; what is
excluded. It also needs a label the product never blurs: **estimate**, **proposal**, or **declined**. The
comparison view, for the broker and then the employer, is the visible "Progressive" surface.

Instant numbers are possible only where the price is a rule. Justworks' published price list is the one found. Our
own record of proposals can later support a labelled estimate ("employers like you were quoted between…"), and
P&C's lesson is that a soft number presented as firm destroys trust in the tool.

---

## 5a. Threaded email: the delivery layer

All of this section is a recommendation, except where marked.

**Fact, from the repo.** Email today is outbound only. `dispatch-outbox` sends through Resend with retries and an
advisor-visible outbox; `resend-webhook` records delivery, bounces and suppression. Every email sets a Reply-To of
the support address, so a reply lands in a mailbox the product never sees. Nothing is sent to a PEO.

### The rule

**One quote request, one email thread, one address.** Each quote request gets its own reply address on a
subdomain we receive mail for, such as `q-<random token>@quotes.nevermorepeo.com`. Every message about that
employer and that PEO leaves from, and replies to, that address. Whatever arrives there belongs to that quote
request, whoever at the PEO wrote it and however many people were copied in.

Why an address and not only the email headers: the standard headers (`Message-ID`, `In-Reply-To`, `References`)
keep a thread together in the PEO rep's mail client, and we set them on everything we send. But a rep forwards to
underwriting, underwriting answers from a new message, someone changes the subject. The address survives all of
that. The File ID in the subject line is a third, human-readable fallback.

### What goes out

- The first message: a short cover note from the broker (their name, firm and reply details), the packet, the
  census in that PEO's layout, the ACORD 130 for workers' comp, and the documents that PEO's profile asks for.
- Attachments, not only links. PEO reps work from files, and a link that needs a login is one more step for them.
  A link back to a no-login page for that one submission can sit beside the attachments (section 5.3, tier 2).
- Later messages on the same thread: an updated packet version after the employer certifies again (the quote
  request already records "an older version sent"), an answer to an underwriter's question, a nudge, a withdrawal.
- The broker is copied, or sends from the product in their own name, so the PEO sees the relationship it already
  knows.

### What comes back, and what the product does with it

| Arrives on the thread | The product records | Who confirms |
|---|---|---|
| Any reply | A message on the quote request's timeline: sender, time, text, attachments. Delivery and bounce events for what we sent, from the webhook that already exists | Nobody: it is a record |
| "Received, in underwriting" | Suggests the status *acknowledged* | Broker, one click |
| A question, or a request for a missing item | Suggests an underwriter's question (the quote request already holds these as dated notes) and drafts an information request to the employer naming the answers it is about | Broker sends it |
| A proposal attached | Suggests *quoted*, stores the document, and reads the four cost areas out of it into the quote for the comparison | Broker checks the figures before the client sees them |
| A decline | Suggests *declined* with the reason | Broker |
| Nothing, for N days | Shows the wait on the board (it already sorts by longest wait) and offers a follow-up on the same thread | Broker |

Two rules keep this trustworthy. A reading of an email is a **suggestion** until a person accepts it, the same
way a document candidate changes nothing until the prospect applies it. And the timeline is **append-only**, like
`quote_request_events`: the original message is kept beside whatever was read out of it.

### Annotations

Three kinds, all on the quote request's timeline and never sent to the PEO unless the broker chooses:

- an internal note on a message ("rep says underwriting is backed up until the 20th");
- a tag on a figure in a proposal ("this admin fee excludes the 401(k) fee");
- a comment for the client on the comparison ("their workers' comp rate assumes the 8810 code for everyone").

### What it takes to build

| Piece | Starting point |
|---|---|
| Receiving mail: a subdomain with inbound routing to a new edge function that verifies the provider's signature | `resend-webhook` already verifies signed webhooks. Whether Resend's inbound service fits, or a separate inbound provider is needed, has to be checked against current documentation; it was not verified here |
| A message table per quote request (direction, sender, headers, body, attachments, what was suggested and what was accepted) | `quote_request_events` and `information_requests` are the patterns |
| Outbound on the thread, with our own `Message-ID`, `In-Reply-To` and `References` | `dispatch-outbox` gains a new event kind; it already retries and shows failures. It does not set custom headers today |
| Attachments scanned before anyone opens them | The upload scanner (D13). Today a quote has no attachment for exactly this reason |
| Reading a reply and a proposal into suggestions | `document-extract` and the Anthropic adapter already do this for prospect documents |
| Mail that matches no thread, or comes from an unknown sender | A holding queue for a person to assign. Never attach by guesswork |

**Risks to design for.** Reply addresses are capabilities, so they must be unguessable and can be revoked. Inbound
mail is untrusted input: scan it, and never let its text steer the model that reads it. Replies may contain health
or claims detail about named employees, so retention and access follow the intake's rules, and brokers see only
their own firm's threads. Some PEOs will answer by phone or in their own portal; the broker must always be able to
record that by hand, as advisors do now.

---

## 6. The broker side

### 6.1 Which model

**Fact.** P&C had two. In the rater model the agency uses its own carrier appointments and the tool is software.
In the exchange model the platform holds the market relationship and the agent is a sub-producer on a split (Bold
Penguin Exchange quotes 50/50).

**Recommendation.** Start with the rater model, which is Model C in `docs/GO_TO_MARKET.md`: brokers bring their
own PEO relationships and pay for the software. Edgar Allan Advisory becomes the first firm on the platform,
placing business under Model A. The exchange model (brokers placing through our PEO agreements) is a heavier,
more regulated business; choose it later and on purpose.

One vocabulary note: `GLOSSARY.md` tells us to avoid "broker" for an Advisor. Outside brokers are a new kind of
person and need their own entries (a broker firm, a broker), with Advisor either kept for our own team or made the
general word for a firm's member. That is a glossary decision to make before any code.

### 6.2 What a broker can do

| Need | What it takes | Starting point in the repo |
|---|---|---|
| Log in and belong to a firm | A firm table, memberships with roles (owner, member), invitations | `user_roles` has only global `advisor` and `admin` |
| See only their own clients | Every intake belongs to one firm; row security checks firm membership | Today "every advisor sees every intake" (D16). This is the main refactor, and the existing SQL isolation tests are the model for testing it |
| Start a client's intake | A firm link the employer opens; or the broker starts it, uploads what they already hold, and invites the employer to finish and certify | Referral codes and `/?ref=` links exist; they only count |
| Post information for a client | Broker uploads and answers carry their own provenance source ("from your broker"), and the employer still certifies | Provenance already ranks sources and the prospect's own action wins |
| Send to PEOs | Pick PEOs, see what each still needs, send (section 5.3) | Quote requests exist, recorded by hand |
| See status and compare | The queue as a board, per firm; the comparison view | The board exists (D44) |
| Ask the employer for more | Information requests | Built (D39) |
| Their own brand on the packet | Firm name and logo on the packet and emails | Not built |

The certification has to stay the employer's. A broker who could certify for a client would empty the packet of
the thing underwriters are meant to trust.

### 6.3 How brokers are tracked

- **Identity.** NPN for the person and the firm where they have one, checked against the national producer
  database through a reseller. PEO brokering is generally unlicensed, but PrestigePEO pays commission only to a
  broker licensed for health, so the license is a fact worth holding.
- **Per-PEO standing.** For each broker and PEO pair: the partner agreement in place, and the code or vendor ID
  the PEO issued (Paychex issues a Vendor ID).
- **Registration ledger.** An append-only record of which firm submitted which employer to which PEO, and when.
  This is the PEO equivalent of clearance. ExtensisHR and PrestigePEO refuse broker-of-record letters, so the
  first registered broker keeps the client; the product should warn before a second firm submits the same employer
  (matched on FEIN) to the same PEO. The `quote_request_events` log is already the right shape.
- **Activity.** Who viewed, downloaded, sent and changed what. The console's append-only histories cover our own
  advisors; extend them to firms. Keep the funnel's rule of counting without content.
- **Money.** Expected and received commission per placement. Fact: a share of the administrative fee is common
  (20% in one 2021 Oasis deck), Rippling lists $55 per enrolled employee, and Paychex pays for the life of the
  client. No industry-wide range was found.

---

## 7. A sequence

Recommendation. Each step is useful alone and none waits on a PEO building anything.

| Step | What ships | Why here |
|---|---|---|
| **0. Evidence and permission** | Counsel's answers (section 8). The real forms and partner agreements of three to five PEOs. Catalog facts filled and dated | Everything after depends on what PEOs really ask and what we may do |
| **1. Deepen the standard** | Intake schema v3 with the gaps in 5.1. Requirement profiles. Per-PEO readiness, census file and ACORD 130. Appetite from real catalog facts | It improves the product for today's employers and advisors with no change to our role |
| **2. Firms** | Tenancy, with Edgar Allan Advisory as the first firm. Then invited outside brokers, firm links, broker uploads, branding | Makes the console the broker portal |
| **3. Send through the product** | Recorded authorization from the employer. Email submission with a tracked PEO-side link. The registration ledger | Reverses D9. Turns "three weeks of email" into something measured |
| **4. Proposals in, comparison out** | The fuller quote record, proposal upload and extraction, the comparison view for broker and employer | The visible payoff |
| **5. Faster answers** | Instant appetite everywhere. Instant prices where published. Labelled estimates from our own history | Needs volume from steps 3 and 4 |
| **6. Integrations** | Partner tools and APIs as PEOs offer them. Handing the won employer's data to the PEO's onboarding | "Bind" in PEO is signing a client service agreement and enrolling; our part is the handoff |

Publishing the schema and the census template (the go-to-market plan already wants the template public) is how a
form becomes a standard: ACORD's forms were adopted before any pipe existed.

---

## 8. What has to change, and what needs counsel

| Commitment today | Conflict | Who decides |
|---|---|---|
| D9 and D44: the product sends nothing to a PEO; the prospect never sees a quote | Steps 3 and 4 | Founder, after counsel |
| Intake consent and Terms: "we don't submit it or request a quote for you" | Step 3 needs a recorded authorization naming the PEOs | Counsel |
| Copy guard: no naming PEOs as partners, no promising a quote | A comparison names PEOs and shows prices | Counsel |
| "Not an insurance agency"; licensing (legal question 2) | Louisiana bars comparing insurance policies in a PEO sale without a license, and Florida bars paying an unlicensed person a referral fee contingent on a sale (both from search extracts; read the statutes). Showing health or comp prices side by side may be licensed activity in some states | Counsel |
| "We don't sell your information" | Brokers seeing only their own clients is consistent. PEOs paying per submission is not, and the plan already rules that out | Keep |
| Health data | A census the employer supplies is employment data. A group health questionnaire with named conditions points toward business-associate obligations (inference from the regulation; legal question 7 already asks) | Counsel. Until answered, do not collect the questionnaire |
| D16: every advisor sees every intake | Firms | Product |
| D21: the census only comes from an upload | Brokers uploading for clients eases it; the phone-only gap remains | Product |
| Neutrality | The P&C exchanges were bought by carriers. Decide early whether Nevermore would ever rank by what a PEO pays; the plan says no | Founder |

---

## 9. What this research cannot establish

- **Whether PEOs will accept a neutral packet in place of their own forms.** The go-to-market plan's five
  underwriter conversations are the test, and the requirement profiles are the hedge.
- **Each PEO's actual columns and rules.** Read in full before building any map: PrestigePEO's workers' comp
  underwriting deck and group health questionnaire, FrankCrum's master-plan guidelines and health checklist, and
  the Paychex channel partner agreement (links in `2026-11-10-peo-data-sources.md`, marked "open this").
- **Registration windows and commission schedules.** They live in unpublished partner agreements.
- **Whether any PEO has a private quoting interface for partners.** None is public.
- **What Zeyrax, Entravia and Vyral really do.** Only their own descriptions were found. A demo of each would
  change the competitive picture more than anything else here.
- **Several P&C dates.** Progressive's own pages disagree by a year on some; they are flagged in the source notes.

## 10. Questions that could change the recommendation

1. Does counsel allow us to send to PEOs and show a comparison, and under what license? If not, the product is
   software for licensed brokers only, and step 2 moves ahead of everything.
2. Do brokers want this as their tool, or do they see it as a competitor with an advisory arm attached? The plan's
   three broker interviews should ask it directly, since Edgar Allan Advisory would be a firm on the same platform.
3. Will one or two PEOs take submissions through a link and answer in a structured form? One willing PEO makes
   step 3 real; a PEO with published prices makes step 5 real.
4. Is the first customer the employer (today's site) or the broker? The site, the consent and the landing page are
   written for the employer; a quoting platform's daily user is the broker.
