# Edgar Allan Advisory: Go-to-Market Plan

| | |
|---|---|
| **Version** | 0.1, a first draft for the founder and the advisory lead to challenge and decide on |
| **Date** | 2026-11-06 |
| **Scope** | Who we sell to, how we reach them, and how we measure and improve that. It runs from today through the private pilot (M2), the public launch (M3) and the season for January 2028 start dates |
| **Depends on** | `docs/PRODUCTION_READINESS_PLAN.md` (what is built and what still blocks M2 and M3) and `docs/LEGAL_REVIEW.md` (its questions 1 and 2 decide how we are paid) |

Terms such as Prospect, Intake, Submission, The Manuscript, Advisor and Funnel mean what `GLOSSARY.md` says. Here,
**employer** means a company before it starts an intake, and **referral partner** means a person or firm outside
the company who sends employers to us. A PEO is never called a partner (see section 1.3).

Market figures come from the sources at the end. Every target in this plan is a guess to replace with pilot data.

---

## The short version

1. **Decide how we get paid before inviting anyone.** The Advisor Console already moves submissions through "sent to
   carrier", "quoted" and "won". The site, though, says the prospect sends The Manuscript themselves (D9). Counsel
   hasn't said whether we may take PEO compensation or need a license (`docs/LEGAL_REVIEW.md`, questions 1 and 2).
   **Recommended:** with the prospect's permission, advisors take The Manuscript to the PEOs the prospect picks. The
   PEO that wins pays us, and we disclose that up front. The prospect can always download The Manuscript and go
   alone. (Section 2.)
2. **Start narrow.** The first employers have 10 to 75 employees and work in two or more states. Their payroll system
   can export a census, and something has just happened to them: a medical renewal went up, they need benefits for
   the first time, they hired in a new state, or they're unhappy with their current PEO. Venture-backed companies and
   professional-services firms come first. (Section 4.)
3. **Reach them through people they already trust, not through ads.** Fractional CFOs and accounting firms that serve
   startups come first, then startup networks: accelerators, VC platform teams and startup law firms. Back that with
   web pages built around what the product already makes, such as a free PEO census template and a sample underwriting
   packet. Try paid search only as a small test. (Section 6.)
4. **Record where every intake came from.** The funnel (D41) shows how far intakes get, but not where they came from.
   Recording a content-free source and referral code on each intake is the one product change GTM needs before the
   pilot. (Section 7.1.)
5. **Plan around the calendar.** Many PEO moves start on January 1 and are prepared from August to October, so the
   January 2027 window has nearly closed. The pilot (January to March 2027) aims at April and July start dates and at
   employers outside the usual timing. Everything else is built to be ready for August to October 2027. (Section 8.)

---

## 1. Where we start from

### 1.1 What we already have that sells

- **One sitting, one packet.** A prospect goes from nothing to a certified underwriting packet in a single
  conversation with Lenore. The site says 15 to 20 minutes, and the pilot has to prove it (section 9).
- **The Manuscript is built for underwriters.** It has the same layout every time. It lists open items rather than
  hiding them, and it marks inferred, incomplete and conflicting answers. A verified contact certifies it, and it
  carries a File ID. The sample at `/manuscript/demo` is our best sales asset for every audience in this plan.
- **PEO-neutral.** The prospect chooses the PEO, and The Manuscript belongs to them.
- **An operating workflow.** The Advisor Console has a pipeline, information requests, "Needs advisor action" and
  the funnel. GTM needs no CRM, consistent with D6.
- **A privacy position we can stand behind.** There are no third-party trackers or ad pixels. Retention is
  enforced, and isolation between intakes is tested. Once counsel approves the copy, this is a selling point to CFOs,
  CPAs and cautious founders.

### 1.2 What stops us inviting real employers

These come from `docs/PRODUCTION_READINESS_PLAN.md`. Each one either stops an intake from finishing or stops us from
saying something in public.

| Blocker | Why it matters for GTM | Where |
|---|---|---|
| Legal copy is unreviewed and no reviewer is named | Every page says DRAFT, and the certification wording is printed DRAFT on every Manuscript. Counsel's answers to questions 1 and 2 decide the revenue model | D3, D10, `docs/LEGAL_REVIEW.md` |
| The malware scanner account is not opened | Production refuses uploads until it is, so there is no census, and the census is the core of the packet | D13 |
| The sender domain is not verified | Without it, nobody gets sign-in codes, Confirmations or Advisor Alerts | D7 |
| `PROSPECT_RESPONSE_TIME` and `SUPPORT_EMAIL` are unset | The Confirmation isn't sent. The response time is a promise to every prospect, so it is a GTM decision (section 7.3) | `docs/NOTIFICATIONS.md` |
| The PEO catalog holds no facts | PEO Match says "Not yet confirmed" for every eligibility check, so advisors can't sort submissions by fit | `src/data/peoCatalog.ts` |
| No alert channel or on-call | A pilot failure would go unnoticed | H-4.1 to H-4.3 |

### 1.3 Rules our marketing has to keep

- **The copy guard applies outside the app too.** `src/copy.guard.test.ts` keeps the site from naming PEOs,
  claiming partnership or agency, saying we act "on behalf of" the prospect, or promising a quote. Every ad, email,
  partner one-pager and slide should follow the same rules until counsel changes them. Talking to PEOs is fine. Saying
  in public that we work with one is not.
- **No third-party tracking.** That follows from the "we don't sell your information" promise and from D41. So there
  is no retargeting, no lookalike audiences and no ad-platform conversion pixels. Attribution has to be first-party
  (section 7.1).
- **The census comes only from an uploaded file** (D21). Our best prospects already have a payroll system and a
  computer, not just a phone.

---

## 2. The decision everything depends on: how we get paid

The code and the copy tell two different stories. The pipeline's stages (`ready_for_market`, `sent_to_carrier`,
`quoted`, `won`) describe an advisory that takes a packet to market. The site, the intake consent and D9 say "we
don't submit it or request a quote for you". As the copy stands, a submission never leads to an event that pays us.

| Model | Who pays | Fit with what's built | For | Against |
|---|---|---|---|---|
| **A. Paid by the PEO when an advisor places the employer** | The PEO that wins, as a one-time referral fee or a commission per employee per month | Strong: the pipeline stages, information requests and advisor Manuscript versions already exist | Free to the employer, so the least friction. It is how PEO brokers are normally paid. Revenue grows with the employer | Needs counsel on licensing and disclosure (questions 1 and 2). D9, the consent and some banned phrases change. Neutrality has to be shown, not just claimed |
| **B. The employer pays for the packet or advisor help** | The employer, as a flat fee | Strong, as the copy describes the product today | Neutrality is simple | Employers are used to free PEO help, because brokers are paid by the PEO. Small companies are unlikely to pay much for this |
| **C. Sell the intake to brokers and PEOs as software** | Brokers or PEOs, per seat or per Manuscript | Partial: needs workspaces for each firm, branding and firm-level access | Grows without adding advisors, and brokers feel the pain every week | Similar tools exist (BrokerQuoter, Zeyrax, StaffMarket). Needs product work, and sells better once the pilot has numbers |
| **D. PEOs pay for each certified submission** | PEOs | The Manuscript | Earns money from the neutral packet | It sells prospect data to PEOs and breaks "we don't sell your information". **Rule it out.** |

**Recommendation: Model A now, Model C after the pilot.**

- **Model A matches what is built.** The message becomes: "Your Manuscript is yours. Send it yourself, or let an
  advisor take it to the PEOs you pick." Neutrality becomes something we do: we disclose how each PEO pays us,
  advisors work the same way whichever PEO is chosen, and nothing is ranked by what it pays.
- **What Model A needs first:**
  - Counsel answers questions 1 and 2.
  - We register with the broker programs of the PEOs we'll send to.
  - D9, the intake consent, the Terms and the copy guard's banned phrases change wherever the new role makes them true.
  - Before an advisor sends anything, the prospect says yes in a recorded authorization, kept the way
    `intake_consents` keeps the intake consent.
- **The economics are thin, so keeping acquisition cheap matters.** Payouts depend on the contract. Paychex's
  published referral program, for example, pays $25 per employee up to $10,000 per employer, so placing a 30-person
  company earns $750 once. Ongoing commissions per employee are worth more but differ by PEO. Either way, winning a
  placement has to cost little. That is why section 6 relies on referral partners and web pages, not paid media.
- **Fallback if counsel rules out Model A:** go straight to Model C and sell the Chamber and The Manuscript to
  licensed brokers. The direct-to-employer funnel then becomes the demo and the source of proof.
- **Revisit Model C after the pilot.** By then we can show brokers our numbers: time to a certified Manuscript, how
  often advisors have to ask for more, and days to a quote.

---

## 3. The market

### 3.1 Size

- NAPEO counted 523 PEOs and about 4.5 million people employed through them in its 2023 report, which uses 2022 data.
- Secondary summaries of NAPEO's 2025 client study report the following. Treat them as approximate until checked
  against the paper itself.
  - About half of PEO clients have 10 to 49 employees, and 35% have fewer than 10.
  - About 15% of US employers with 10 to 499 employees use a PEO.
- NAPEO says the industry has added roughly 6,000 net new clients a year on average.

**What that means for us:** about 85% of employers with 10 to 499 employees don't use a PEO. Most buyers are first
timers who don't know what underwriters will ask. The rest are switching from one PEO to another, and they know
exactly how painful the paperwork is. The landing page's first persona, "Business owners who've been through this
before and want it faster", is that second group.

### 3.2 How an employer buys a PEO today

Something happens to them. They talk to one to three PEO sales reps or a broker. Each one asks for a census, a payroll
register, the current benefits invoice or renewal, and the workers' comp declarations page and loss runs. Emails go
back and forth. A quote arrives one to three weeks later, then come the comparison, the decision and 30 to 60 days of
onboarding. The landing page's three complaints describe this process: "Got it back — incomplete", "Answered the same
question. Then answered it again", "Waited three weeks".

### 3.3 Triggers: when an employer is ready to listen

| Trigger | Signal we can see from outside | When to act |
|---|---|---|
| A medical renewal increase | None from outside. Partners and the employer know | 60 to 90 days before the renewal date |
| Offering benefits for the first time | Hiring posts that mention benefits, or growth past about 10 people. The intake asks this as "First-time medical coverage" | When they decide to offer benefits |
| A first employee in a new state | Job posts in a new state, or registering to do business in another state | Before the first payroll there |
| Approaching 50 full-time equivalents, the ACA employer-mandate threshold | Headcount growth on public profiles | As they near 50 |
| A funding round | Funding announcements | 0 to 3 months after the round |
| Unhappy with their current PEO | The PEO's own rate renewal, or public complaints | Before their PEO renewal |
| An acquisition | Deal announcements | During integration planning |

### 3.4 The calendar

- **Many PEO moves start on January 1,** when plan years and payroll-tax wage bases reset. Those are prepared from
  August to October. Other moves follow the employer's own medical renewal date, which is often the first day of a
  quarter.
- **Partners have busy seasons of their own.** CPAs are busy from January to mid-April (tax season), and benefits
  brokers from October to December (January renewals). Recruit CPAs from May to September and brokers from January
  to March.
- **Today is November 6, 2026.** January 2027 starts are mostly decided already. The pilot should aim at April and
  July 2027 starts and at triggers that don't follow the calendar: first benefits, a new state, a funding round, a
  PEO they want to leave. The intake already asks for the target start date ("Target start", `start_month`), so
  advisors can sort by it.

### 3.5 The employer's alternatives

| Alternative | What it gives them | Where we win |
|---|---|---|
| Going straight to one or more PEO sales reps | Free and quick for one PEO | They answer the same questions for every PEO and never get a neutral view. Our Manuscript works for any PEO |
| A PEO broker or consultant | A comparison, usually paid for by the PEO | Theirs takes days of email. Ours is the same model (A) with a faster front door and a record of every answer |
| PEO comparison and RFP sites (StaffMarket, PEOcompare, Vyral's instant quotes) | Requests sent to several PEOs, or price estimates | Their data isn't good enough to underwrite from. Ours is a certified census with every open item listed |
| Quoting tools for brokers (BrokerQuoter, Zeyrax) | Help for the broker once the data is gathered | We gather the data from the employer, so these could become integrations or Model C partners rather than competitors |
| Doing nothing, or staying with a benefits broker | No change | Our answer is the trigger moment and the sample Manuscript |

---

## 4. Who we sell to

### 4.1 The first employers

| Attribute | First target | Why |
|---|---|---|
| Size | 10 to 75 employees, best between 15 and 50 | It's the core of the PEO market (section 3.1). Under 10, placement depends more on each PEO's minimums, which our catalog doesn't hold yet. Over about 100, buyers run formal RFPs through a broker |
| States | Two or more, or about to add one | Compliance across several states is one of the main reasons to use a PEO |
| Industry | Low-hazard work: software and tech, professional services (agencies, consultancies, law, accounting, architecture), financial services, nonprofits | More PEOs will write them and workers' comp underwriting is light. Come back to higher-hazard trades once the Pre-Screen's class-code handling is proven with underwriters |
| Systems | A payroll system that exports a census | The census only comes from an uploaded file (D21) |
| Timing | A trigger from section 3.3 and a target start within about four months | Their attention is limited and short-lived |

**Segment 1: venture-backed companies with 10 to 75 employees, from after their seed round to Series B.** They need
benefits to hire. Their investors and lawyers often suggest a PEO, and founders are comfortable with AI tools. A few
dense networks reach them: accelerators, VCs, startup accountants and law firms.

**Segment 2: professional-services firms with 15 to 75 employees.** Benefits matter for keeping staff, small-group
renewals often hurt, and the owner relies on an outside CPA, which makes the CPA the channel.

**Opportunistic:** employers of the right size switching from one PEO to another, in any low-hazard industry. They
find us through search and referrals, and they feel the pain we remove most.

### 4.2 The people inside the employer

| Role | What they care about | Their part in the intake | What to tell them |
|---|---|---|---|
| **Decider**: founder, CEO or COO | Cost, risk, time. "Is switching worth it?" | Often the person who certifies. Needs a reason to start | "Find out what a PEO would cost without answering the same questions for every PEO." † |
| **Doer**: office manager, HR generalist, ops lead or executive assistant | Not chasing reports for weeks | Usually the one who starts the intake, uploads the census and gathers documents | "Upload the census you already have. Lenore asks only for what's missing, and you can stop and come back." |
| **Influencer**: CFO, controller or outside CPA | Accurate numbers and no surprises at renewal | Reviews the cost and sends the doer to us | "Every open item is listed before an underwriter sees it, so the quote reflects your real numbers." |
| **Signer**: whoever certifies in The Reckoning | Having the authority to certify | Certifies | Explain what certifying means in plain words before they reach that step |

The doer usually starts the intake, but the decider has to want it. The Manuscript is what the doer forwards upward,
so its summary page has to persuade a CEO, not only inform an underwriter.

† Needs Model A and counsel's approval. Until then use "Get a packet any PEO can quote from".

### 4.3 Referral partners, in order of priority

| # | Partner | Why they'd send employers | What they get | Where to find them |
|---|---|---|---|---|
| 1 | **Fractional CFOs and outsourced accounting firms that serve startups and small firms** | They see payroll and benefits costs every month, clients ask them "should we use a PEO?", and they have no PEO expertise in-house | A neutral, complete packet for their client without spending their own hours on it | Founder referrals, LinkedIn and fractional-CFO networks |
| 2 | **Startup networks: accelerators, VC platform teams, startup law firms** | Supporting their portfolio is their job | A perk or office hours to offer their portfolio | Platform and portfolio-support leads, perks programs, demo-day cohorts |
| 3 | **CPA firms, outside tax season, and state CPA societies** | Segment 2's most trusted adviser | A way to answer the PEO question well | State CPA society events and talks that earn CPAs continuing-education credit (CPE) |
| 4 | **Fractional HR consultants and HR outsourcing firms** | They are present when an employer decides to switch | Less paperwork on PEO moves | HR consultant communities and local SHRM chapters |
| 5 | **Independent benefits brokers without a PEO practice** | Their clients ask about PEOs, and some leave for one | A way to keep the relationship | Professional groups such as NABIP. **Note the channel conflict**: they work better as Model C customers than as referrers |
| 6 | **M&A advisors and private-equity operating partners** | They have to fold acquired companies' employees into one platform | Later: due diligence needs a comparison of the target's costs, which we haven't built | Later, under Model C |

**Pay partners no cash during the pilot.** Rules on referral fees for anything near insurance differ by state, and
CPAs have their own ethics rules on commissions and referral fees. Counsel decides whether we can ever pay partners
(GTM-D3). What partners get is good service for their clients and a monthly count, from their link, of intakes started
and certified. They get counts only, never client data.

### 4.4 PEOs and their underwriters

PEOs aren't buyers yet, but their underwriters decide whether The Manuscript is worth anything. In Phase 0, show the
sample Manuscript to three to five PEO underwriters or sales engineers. Ask them whether they would price from it,
what is missing, and what would make them trust it. Under Model A, the next people to talk to are the managers of
their broker programs. Talk to PEOs freely, but never claim a partnership in public (section 1.3). Counsel is already
asked to look at the landing page's "For PEO Partners" label.

### 4.5 Who we don't target yet, and why

- **Under 10 employees:** welcome to use the site, but not targeted. Payouts are smallest, and PEO minimums vary.
- **Over about 150 employees:** they run formal RFPs through brokers, with longer cycles and more people involved.
- **High-hazard industries** (construction, manufacturing, trucking, staffing): fewer PEOs will write them, and
  workers' comp underwriting is heavier.
- **Private-equity associates doing due diligence** (the landing page's fourth persona): a different job that needs a
  different output. Revisit under Model C.
- **Employers without a spreadsheet who only use a phone:** the gap D21 already names.

---

## 5. Positioning and messages

**Positioning statement.** For employers with 10 to 75 people who are weighing a PEO, Edgar Allan Advisory is the
PEO-neutral way to get there. One conversation with Lenore produces a certified underwriting packet that any PEO can
price from. Under Model A, an advisor takes it from there. Compared with going PEO by PEO, or trading emails with a
broker, you answer each question once, see exactly what is still open, and keep the packet.

**Proof to collect in the pilot**, all from first-party data (section 9):
- the median time from starting to certified
- the share of Manuscripts with no required items open
- how often advisors have to send an information request
- days from sending to a PEO to receiving a quote
- underwriters' own verdicts

| Audience | Their pain | Message | Proof to show |
|---|---|---|---|
| Decider | "I don't know what a PEO would cost me, or whether to switch" | "One conversation. One packet, for any PEO." | The sample Manuscript and the median time |
| Doer | "I'm the one chasing reports" | "Upload the census you have. Lenore asks only for what's missing." | The census template, and saving progress |
| CFO or CPA | "Quotes come back wrong, then renewal brings surprises" | "Certified data in, an accurate quote out." | The open-items list and the certification |
| Referral partner | "Clients ask me about PEOs, and I can't spend hours on it" | "Send one link. Your client gets a neutral, complete packet." | Counts from their own link |
| PEO underwriter | "Incomplete submissions, and three email threads for each one" | The landing page's "A packet your underwriters can work from" | The sample Manuscript |

**Brand.** The rebrand to Nevermore (pull request 78, 7 November 2026) made two of the three landing-page changes
this plan asked for. The headline now leads with the outcome ("Never more back-and-forth."), and prospects no longer
see the gothic names: they read "your intake", the "Certify & sign" tab and "your packet", and Lenore speaks plainly.
`GLOSSARY.md` lists the names prospects see. What remains:

- **Update "Who this is for"** to the audiences chosen here: owners, ops leads, and CPAs and fractional CFOs. The
  page still lists brokers, CPAs doing due diligence and private-equity associates. Leave out private-equity
  associates until there is something built for them (GTM-D7).
- **Keep the outcome first** in every ad, email and page: "a PEO underwriting packet in one sitting".

---

## 6. How we reach them

### 6.1 The first 30 conversations (Phase 0)

| Who | How many | What we want from them |
|---|---|---|
| Employers in our own network who fit section 4.1 | 10 | Pilot employers, plus interviews about how they last bought benefits or a PEO |
| Fractional CFOs, startup accountants and accelerator or VC platform leads | 8 | Five referral partners for the pilot |
| PEO underwriters or sales engineers | 5 | Would they price from The Manuscript? What's missing? |
| Managers of PEO broker programs (if Model A) | 4 | Registration terms, and what disclosure they expect |
| Independent PEO brokers | 3 | How they work, where it hurts, and whether they would buy Model C |

### 6.2 Channels

| Channel | Audience | What we do | Cost | Phase | Measured by |
|---|---|---|---|---|---|
| Our network and early partners | Segments 1 and 2 | Personal introductions, with an advisor on hand for the first intakes | Time | 0 to 1 | Certified submissions by referral code |
| **Referral partners** (section 6.3) | Both segments, through their advisers | A partner link, a one-page explainer and the sample Manuscript | Time | 1 onward | Intakes started and certified per partner |
| Startup networks | Segment 1 | A portfolio perk, office hours, a talk to the cohort | Time | 1 onward | Same |
| **Web pages tied to the product** (section 6.4) | Doers and deciders who are searching | A census template, an underwriting checklist, the sample Manuscript, guides for switching PEOs and for renewals | Writing time | 2 onward | Intakes started by source |
| Outreach on triggers (section 6.5) | Deciders, at the trigger | Personal, low-volume emails from advisors | Time and a data source | 3 | Replies, then intakes started |
| Communities and events | CEO peer groups (Vistage, EO), SHRM chapters, CPA societies | Talks on "what PEO underwriters ask", including CPE webinars for CPAs | Low | 2 onward | Intakes started by event code |
| Paid search | High-intent searches such as "PEO census template" or "compare PEO quotes" | A small, capped test. Expect expensive auctions, because PEOs and brokers bid on these terms. Stop unless the cost of each certified submission fits section 2's economics | Capped | 2 | Cost per certified submission, from first-party UTMs |
| Model C | Brokers | Interviews, then an offer for a pilot | Product work | After the pilot | Brokers signed |

### 6.3 The referral partner program, pilot version

- **What we ask:** introduce two employers during the pilot, and give 20 minutes of feedback.
- **What partners get:**
  - A personal link (`/?ref=<code>`, once section 7.1 exists).
  - A one-page explainer and the sample Manuscript.
  - A 20-minute walkthrough.
  - A monthly count of intakes started and certified from their link.
- **What they never get:** their client's answers, census or Manuscript. The prospect can forward it if they want to.
- **What to aim for:** 15 conversations, leading to 8 partners who agree and 5 who actually send employers.

### 6.4 Web pages tied to the product

Each page answers something employers already search for, and each leads to "Start your intake":

1. **"PEO census template (free CSV)."** It is generated from `src/data/census.ts`, so it can't drift from what
   `document-extract` reads. Make it downloadable without starting an intake. Today it is only inside the Chamber.
2. **"What PEO underwriters ask for."** A checklist drawn from the intake schema's ranked fields
   (`docs/intake-schema.md`).
3. **"A sample PEO underwriting packet."** The page at `/manuscript/demo`.
4. **"Switching PEOs: what to gather and when."** The calendar from section 3.4.
5. **"Your medical renewal went up. Should you look at a PEO?"**
6. **"Exporting a census from your payroll system."** One version for each common payroll system. Several payroll
   companies also run PEOs, so check the naming against the copy guard and with counsel.

The app is a single-page React build, so these pages must be served as pre-rendered HTML that search engines can
read without running scripts.

### 6.5 Outreach on triggers

- **Sources:** funding announcements for companies with 10 to 75 employees, job posts that show a first employee in a
  new state or a first HR or office-manager hire, and headcount nearing 50.
- **How we do it:** advisors write each email themselves, at most about 20 a week. Each one offers the sample
  Manuscript and the census template, never claims a tie to any PEO, and always says how to opt out. Counsel to
  confirm the rules on unsolicited business email.

---

## 7. Improving the process

### 7.1 Record where every intake came from (built: J-2.3, D43)

**Built on 2026-11-06** (migration `20261106100000`, plan story J-2.3, decision D43). What was built differs from the
proposal below in two ways. The codes are kept in the visitor's browser for 30 days (`localStorage`), not only
for the tab, so a referral still counts when the employer comes back days later; the last tagged link counts. And
referral partners have their own page, `/advisor/partners`, with each partner's link and their counts for the last
30 days. Landing-page visits are still not counted (GTM-D6). `docs/ADVISOR_CONSOLE.md` describes the screens, and
`GLOSSARY.md` defines intake source, referral partner and referral code.

Before this, the funnel (`advisor_intake_funnel()`, D41) counted the steps intakes reach, but nothing recorded
which channel an intake came from, so channels couldn't be compared. The proposal kept to D41's rule of storing no
content:

- **The landing page notes the source.** It reads `ref`, `utm_source`, `utm_medium` and `utm_campaign` from the URL
  and keeps them in `sessionStorage` until an intake starts. Each read and write is wrapped in try/catch, and
  everything works without them.
- **The intake stores it.** When the intake is created, it stores the source, medium, campaign and referral code,
  either on the intake or in a small table of its own. These are short codes, never a name, an answer or an
  address. A `referral_partners` table maps each code to a partner's name and type, for advisors only.
- **The funnel shows it.** `advisor_intake_funnel()` accepts a source or partner filter, and `/advisor/funnel`
  shows each channel side by side. The submission page shows the referral partner.
- **Visits are counted only if counsel agrees.** Counting landing-page visits per source would need a cookieless
  counter. That is a privacy decision for counsel (question 3) and GTM-D6.

Size S to M, owner FS. Add it to the readiness plan as a J-2 story with its own migration and SQL test.

### 7.2 The funnel, step by step

The steps are D41's milestones. Each step is counted against intakes that started.

| From → to | What can go wrong | What to try first |
|---|---|---|
| Landing page → **Started an intake** | It isn't clear what this is, or the visitor is wary of sharing employee data | A headline that leads with the outcome. The sample Manuscript higher on the page. Make clear they can start as a guest |
| Started → **Gave a first answer** | The consent gate, or not knowing what to type first | Lenore's first question should be easy to answer. Read the transcripts of intakes that stalled here |
| First answer → **Uploaded a document** or **Provided an employee census** | They don't have the file to hand. **This is the drop-off we expect to be largest** | The public census template and the export guides. Prompt "Save your progress" earlier. Draft reminders are already built (D40) |
| → **Ready to certify** | Only three required answers. Unlikely to be the bottleneck | Watch for conflicts on required answers |
| → **Verified an email** → **Certified** | The signing step, and the DRAFT mark on the consent wording | Counsel-approved wording without the DRAFT mark. A plain-words explanation of certifying before The Reckoning |
| → **Downloaded The Manuscript** | Under Model A, this matters less than the advisor's first contact | Track the advisor's first contact (section 7.3) |
| After certification: the pipeline history in `submission_status_history` | Slow first review, packets that need more information, slow quotes | Time to "Under review", the share of submissions sent an information request, and days from "Sent to carrier" to "Quoted" |

### 7.3 Speed after certification

- **Set `PROSPECT_RESPONSE_TIME` to a promise we keep.** Recommended for the pilot: "1 business day" in the email,
  with the aim of calling the same day.
- **Send the Advisor Alert to an inbox someone watches.** Mark anything waiting on the team with "Needs advisor
  action".
- **Add triage when volume grows.** Every submission is worked today (D16, no qualifying step), which suits the
  pilot. At volume, sort by fit: headcount and states against the PEO catalog, and the target start date. Filling in
  the catalog's facts (section 1.2) is what makes that possible.

### 7.4 Experiments to try, one or two at a time

- **Headline:** the brand line against the outcome line.
- **Sample Manuscript:** linked above the fold against below it.
- **Census template:** downloadable before an intake starts against only inside the Chamber.
- **Voice:** offered against not offered, measured by how many intakes get certified (D8, the beta).
- **Partner links:** a page that says "Referred by <firm>" against the plain landing page.
- **Response promise:** same day against one business day, measured by how many submissions reach "Quoted".

**A caution:** pilot volumes are far too small for real A/B tests. In the pilot, make one change at a time, compare
before and after, and pair it with interviews. Real A/B tests come only after hundreds of intakes per variant.

### 7.5 The weekly GTM review (30 minutes)

1. The funnel by source, over the last 30 days.
2. The pipeline: submissions by stage, days in each stage, and the information requests sent and why.
3. Three transcripts of intakes that stalled: where did Lenore lose them? Lenore's prompt is versioned, so a fix is a
   new prompt version.
4. Partner activity: who sent employers and who went quiet.
5. One decision, recorded.

---

## 8. The phased plan

### Phase 0: Get ready (now to mid-December 2026)

- Decide the revenue model (GTM-D1) with counsel, and name the legal reviewer (D10).
- Clear the blockers in section 1.2: the scanner account, the sender domain, the response time and support email,
  the alert channel and the privacy contact.
- Build source capture (section 7.1). Done on 2026-11-06.
- Fill in and date the catalog facts (`minHeadcount`, `statesServed`, `lastVerified`) for the five PEOs listed.
- Have the 30 conversations in section 6.1. Change The Manuscript wherever underwriters say it falls short.
- Publish the census template page and the sample Manuscript page, both readable by search engines.

**Done when** the M2 exit criteria in the readiness plan are met, five referral partners have agreed, and ten
employers are lined up.

### Phase 1: Private pilot (January to March 2027, M2)

- **Who:** 20 to 30 employers. An advisor joins the first few intakes live.
- **Timing:** April and July 2027 start dates, plus employers whose trigger doesn't follow the calendar.
- **Running it:** hold the weekly review (section 7.5), with changes to copy and prompts in between.
- **Interviews:** ten prospects after they certify, and three who stopped partway.

**Done when** the scorecard (section 9) is met or the misses are explained, and we have decided which channels to
grow.

### Phase 2: Public launch and building channels (April to June 2027, M3)

- Counsel-approved copy, with the DRAFT marks gone.
- Grow to 15 to 20 active referral partners. Recruit CPAs after the April 15 tax deadline.
- Publish the six pages in section 6.4, and hold a CPE webinar for CPAs.
- Run the capped paid-search test.
- Model C research: interview ten brokers.

### Phase 3: The January 2028 season (preparing July to October 2027)

- Start trigger outreach in July. Remind partners to raise January 1 moves with their clients now. Give talks to CEO
  peer groups.
- Plan advisor capacity, since the season concentrates volume: hire, add triage (section 7.3), or both.
- Decide whether to build Model C.

---

## 9. Pilot scorecard

These are guesses to replace with real numbers after the first four weeks.

| Measure | Where it comes from | Pilot target |
|---|---|---|
| Intakes started | Funnel | 40 |
| Started → certified | Funnel | 40% or more |
| Certified intakes that include a census | Funnel | 70% or more |
| Median time from start to certified | Funnel (median minutes) | 60 minutes or less. The site says 15 to 20, so if the real figure is far off, change the copy or the product |
| First advisor contact within the promise | Tracked by hand for now | Every submission |
| Submissions sent an information request | Pipeline history | 30% or fewer |
| Median days from "Sent to carrier" to "Quoted" | Pipeline history | 7 or fewer, against the "three weeks" the landing page complains about |
| Placements won (Model A) | Pipeline | 3 or more |
| Share of intakes from referral partners | Source (section 7.1) | 50% or more |
| Underwriters who would price from The Manuscript | Interviews | 3 of 5 |

---

## 10. Risks

| Risk | Effect | What we do about it |
|---|---|---|
| Counsel rules out Model A or requires a license | Selling directly to employers earns nothing | Fall back to Model C. Or an advisor obtains whatever license counsel names |
| Employers won't share employee data with a name they don't know | Few intakes get started | Introductions from partners, the privacy and retention story, counsel-approved privacy copy |
| PEOs insist on their own forms | The Manuscript adds less value | Position it as the source for their forms. Ask underwriters in Phase 0 |
| Benefits brokers see us as a competitor | Partner channels turn hostile | Don't recruit brokers as referrers. Offer them Model C later |
| Small payouts per placement | Acquiring an employer can cost more than it earns | Referrals and web pages before paid media. Track the cost of each certified submission by channel. Prefer ongoing commissions |
| Missing the season | A year is lost | Follow the calendar in section 8 |
| Advisor capacity in the third and fourth quarters | Slow responses break the promise | Triage by fit, and plan hiring |
| The brand is misread | People bounce off the landing page | The headline test and pilot interviews (section 5) |
| AI mistakes reach underwriters | Our credibility suffers | Provenance, certification and advisor verification already exist. Track information requests caused by a misread answer |

---

## 11. Decisions this plan needs

| ID | Decision | Recommended | Owner | Needed by |
|---|---|---|---|---|
| GTM-D1 | How we are paid | Model A, disclosed. Model C as the fallback, and as the next step after the pilot | Founder + LEGAL | Mid-December 2026 |
| GTM-D2 | Who we target first | Segments 1 and 2, with 10 to 75 employees, low-hazard industries, two or more states | PM + advisory lead | Phase 0 |
| GTM-D3 | Pay for referral partners | No cash during the pilot. Counsel decides whether we ever pay | LEGAL | Before recruiting |
| GTM-D4 | The response promise (`PROSPECT_RESPONSE_TIME`) | "1 business day", aiming for the same day | Advisory lead | Phase 0 |
| GTM-D5 | Recording each intake's source (section 7.1) | **Built 2026-11-06** (J-2.3, D43) | PM + FS | Phase 0 |
| GTM-D6 | Counting landing-page visits | A cookieless counter if counsel agrees, otherwise none | PM + LEGAL | Phase 2 |
| GTM-D7 | The landing page's "Who this is for" | Owners, ops leads, CPAs and fractional CFOs. Drop private-equity associates for now | PM | Phase 1 |

---

## Sources

- NAPEO, [Industry statistics](https://www.napeo.org/what-is-a-peo/about-the-peo-industry/industry-statistics) and
  [PEO Industry Footprint 2023](https://napeo.org/wp-content/uploads/2025/03/peoindustryfootprint2023_finalweb.pdf)
- NAPEO, [PEO Clients 2025 white paper](https://napeo.org/wp-content/uploads/2025/10/PEOClients2025_WhitePaper_Web.pdf),
  with secondary summaries from [ExtensisHR](https://extensishr.com/resource/blogs/napeo-peo-clients-2025/) and
  [World Insurance](https://www.worldinsurance.com/blog/peo-what-are-the-stats). Check figures against the paper
  before quoting them outside the company
- Paychex, [PEO partner program referral terms](https://paychex.com/peo-partner-program/referral-terms)
- [Beancount: how PEO brokers are paid](https://beancount.io/blog/2026/09/15/peo-broker-free-help-how-paid-questions-before-signing-guide)
- Comparison and quoting services: [StaffMarket RFP](https://www.staffmarket.com/peo-vendor-evaluation),
  [PEOcompare](https://peocompare.com/About-PEO-compare-PEOs/), [Zeyrax](https://www.zeyrax.com/zeyrax.html),
  [Vyral PEO Resources](https://lifestyle.capitalcityrock.com/story/2704/vyral-peo-resources-launches-as-the-nations-first-instant-quote-peo-research-platform/)
- Renewal timing: [Justworks renewal guide](https://www.justworks.com/resources/the-complete-guide-to-renewal-season),
  [Landrum HR on switching PEOs](https://landrumhr.com/blogs/switching-peo-providers/),
  [Axcet HR on changing plans mid-year](https://blog.axcethr.com/can-you-change-health-insurance-mid-year)
