# How P&C quoting got digitised: Progressive, comparative raters, ACORD — and what maps to PEO

Researched 2026-11-10. Labels: **[F]** = stated in a cited source; **[R]** = my recollection of industry practice, not confirmed by a source in this session; **[I]** = inference.

**Method caveat (read first).** Page fetching was blocked in this session (www.progressive.com, www.massagent.com, help.openly.com all failed DNS: not on the session's network allowlist). Every citation below therefore rests on search-result extracts of the page, not a full read. Dates and numbers should be re-checked against the linked page before they go in anything external. Many "how it works" sources are vendor marketing or vendor blogs; flagged where it matters.

---

## 1. Progressive

| Year | What | Source |
|---|---|---|
| 1993/1994 | Comparison rates by phone. 1-800-AUTO-PRO: 24/7 toll-free line giving a Progressive quote plus rates of up to three competitors. Progressive's own pages give both 1993 (comparison rates + buy by phone) and 1994 (1-800-AUTO-PRO). **[F, dates conflict]** | https://www.progressive.com/about/history/ ; https://filecache.mediaroom.com/mr5mr_progressive/177354/download/17P20114.H_history_of_progressive.pdf |
| 1996 | Limited online quoting / policy access. **[F]** | https://www.progressive.com/about/history/ |
| Aug 1997 | Real-time online *purchase* ("buy" option), launched in Minnesota first, then state by state. Described as first major auto insurer to sell in real time online. **[F]** | https://www.theautochannel.com/news/press/date/19980414/press011413.html |
| Oct 1997 | ForAgentsOnly.com domain registered. **[F]** | https://insurance-canada.ca/2007/10/03/usa-progressive-celebrates-milestone-time-saving-business-growing-web-site-agents/ |
| 2000-2002 | FAO: agent policy access and online endorsements (2000); redesign Jan 2002; agent online quoting rolled out 2002 (about 36M personal-lines quotes by 2007). **[F]** | https://insurancejournal.com/news/national/2000/07/10/11181.htm ; https://www.propertycasualty360.com/amp/2002/01/07/progressive-redesigns-agent-web-site/ ; insurance-canada link above |
| 2004 | TripSense usage-based pilot, Minnesota. **[F]** | https://www.progressive.com/about/history/ |
| 2008-2011 | MyRate, then rebrand to Snapshot. Progressive's pages give 2008 and 2009; the commonly quoted national Snapshot launch of 2010-11 was **not confirmed**. | same |
| 2008/2009 | Name Your Price (shopper states a budget, tool shows the coverage that fits). Progressive timeline says 2009; 2008 not confirmed. **[F]** | same |
| 2012 | FAO quote-and-sell from tablets. **[F]** | https://www.propertycasualty360.com/2012/01/19/progressive-offers-tablet-connection-for-agents |
| Jul 2017 | HomeQuote Explorer: multi-carrier home quoting. **[F]** | https://agencychecklists.com/2017/07/31/progressive-launches-homequote-explorer-featuring-multi-carrier-quoting-capability-19353/ |
| May 2019 | BusinessQuote Explorer (BOP, GL, PL, workers' comp) announced; Progressive's own history page puts BQX under 2017. Quotes come from *partner carriers*; Progressive did not itself write those coverages at launch. **[F, dates conflict]** | https://progressive.mediaroom.com/2019-05-08-progressive-R-launches-new-online-quoting-platform-for-small-business-owners ; https://www.insurancejournal.com/news/national/2019/05/08/525899.htm ; https://progressivecommercial.com/about-us/our-history |
| 2019 | "FAO Portfolio" quoting rebuild: auto data pre-fill, multi-product quote; state-by-state rollout from MO/IA/WI. **[F]** | https://coverager.com/progressive-launches-new-quoting-platform-for-agents/ |

**What mattered commercially**

- Dual channel at scale. FY2024 10-K: "more than 40,000 independent insurance agencies"; personal auto 44% agency / 56% direct; agency auto quote volume +17% and conversion +13% YoY; ~7,100 Platinum agents. **[F]** https://www.sec.gov/Archives/edgar/data/80661/000008066125000007/pgr-20241231.htm
- **[I]** The durable moves were (a) publishing a comparison, including when it was not flattering, which made Progressive the place to *start* shopping; (b) making the quote a self-serve, instantly bindable artefact; (c) giving agents the same engine via FAO rather than a slower back-office path; (d) later, being the storefront for *other* carriers' products (HQX/BQX) where it had no appetite. Snapshot and Name Your Price are pricing/UX features layered on that base, not the base.
- **Not verified:** specifics of Progressive's comparative-rater integrations and agent quoting APIs (no source found); the claim that phone comparison rates showed competitors even when cheaper **[R]**.

## 2. Comparative raters and agency quoting tools

**Lineage [F]**
- FSC Rater: Vertafore bought StoneRiver FSC, July 2011; now "FSC Rater powered by PL Rating". https://www.propertycasualty360.com/2011/07/20/vertafore-acquires-stoneriver-fsc ; https://www.vertafore.com/products/fsc-rater
- SEMCAT: acquired by Applied Systems, June 2015 (not 2011), became Applied Rater. https://www.streetinsider.com/Press+Releases/Applied+Systems+Acquires+SEMCAT/10655898.html
- EZLynx: founded 2003; Applied announced acquisition 14 Jan 2021. Claims real-time quotes from 330+ carriers. https://www.insurancejournal.com/news/national/2021/01/14/597515.htm ; https://www.ezlynx.com/products/rating-engine/
- ITC TurboRater: acquired by Zywave, announced Nov 2020 / closed Jan 2021 (sources differ). https://en.wikipedia.org/wiki/Zywave
- Tarmika (founded 2018, small-commercial rater "Bridge" plus embedded "Tunnel"): acquired by Applied, Aug 2022; panel folded into Ivans Distribution Platform. https://www.insurancejournal.com/news/national/2022/08/16/680700.htm ; https://ivans.com/faqs/tarmika-acquisition
- Bold Penguin: bought RiskGenius (Oct 2020); acquired by American Family (announced Jan 2021). https://www.insurancejournal.com/news/national/2021/01/14/597555.htm
- CoverWallet: Aon agreed to acquire, Nov 2019. (via Business Insurance coverage of the Bold Penguin deal) https://www.businessinsurance.com/article/20210114/NEWS06/912339121/American-Family-buys-insurtech-Bold-Penguin
- Semsee: one "smart form" merging carrier question sets; ~20 carriers by Mar 2023; acquired by an iBynd affiliate, Mar 2026. https://semsee.com/about-us ; https://www.celent.com/solutions/560580114

**Mechanics**

1. *Single entry (SEMCI).* EZLynx itself defines a comparative rater as a "single-entry multiple-company interface". **[F]** https://ezlynx.com/blog/posts/what-is-a-comparative-rater
2. *Mapping.* The rater holds a superset data model and per-carrier field mappings; dispatches in parallel; returns a side-by-side grid. **[F, vendor blog]** https://www.quotesweep.com/blog/what-is-a-commercial-insurance-comparative-rater
3. *Carrier connection.* Two kinds: carrier-built rating APIs/web services (both sides must fund and maintain them), and automation of the agent's carrier portal session. Vendor literature says to ask "does it use your actual carrier credentials for real quotes, or public rate tools". **[F, vendor]** same link. The exact API-vs-portal-automation mix per vendor is **not published**; RPA/screen-scrape use by named vendors is **[R]**.
4. *Credentials and appointments.* The rater is not the appointed party. The agency enters its own carrier logins/producer codes per carrier (EZLynx: Settings > Carrier Quoting Setup; help topics "Setting Carrier Logins (Rating)", "Keep Carrier Logins Up-to-Date"). No appointment with a carrier means no quote from it. **[F for the settings; I for the consequence]** https://sites.google.com/streetsmart.insurance/siteswiki/training/ezlynx/rating-engine . Alternative model: the platform (or an MGA/wholesaler behind it) holds the appointment and the agent is a sub-producer, sharing commission — Bold Penguin Exchange quotes a 50/50 split on matched referrals. **[F]** https://help.boldpenguin.com/en/articles/14324351-overview-refer-prospects-to-the-bold-penguin-exchange
5. *Carrier-specific questions.* Handled by a union form with conditional questions (Semsee's "smart form"), or by auto-loading each selected market's supplemental form by line and state (Appulate). **[F]** https://help.appulate.com/en/knowledge/acord-and-supplemental-forms-on-the-forms-tab
6. *Bridge to bind.* After the grid, the agent "bridges" into the carrier portal, with data carried over, to finish underwriting questions and bind/issue. **[F]** https://www.ezlynx.com/products/rating-engine/

**Indication vs bindable vs referral [F, vendor glossaries]**
- *Indication:* non-binding estimate on limited data; may change or be declined after full underwriting. https://www.insurerbrain.com/wiki/Definition:Indication
- *Bindable quote:* firm offer with defined coverage, limits, exclusions and premium.
- *Referral:* a quote that needs a human underwriter before binding, triggered by state, class, or answers to underwriting questions. https://helpcenter.coverforce.com/refer-to-carrier-underwriter
- Commercial rater grids are mostly indications; agents re-do the full submission in the carrier portal — a "two-pass" workflow. https://www.quotesweep.com/blog/bindable-vs-indication-api-rater-gap
- Pie's partner API exposes exactly this ladder as separate endpoints: appetite check, price indication, bindable quote. **[F]** https://www.pieinsurance.com/resource-center/press/pie-launches-partner-api
- Coterie publishes a commercial API with a "Create Bindable Quote" call (credentials on request). **[F]** https://explore.coterieinsurance.com/partner-faqs . Cowbell: quote/rate/bind API for cyber. https://cowbell.insure/api-quoting . NEXT: partner API gated, no public docs (third-party claim). https://supergood.ai/docs/next-insurance-api

## 3. Data standards: how the "ask" was standardised

- ACORD is the industry non-profit standards body; first paper form published 1971 (founding year 1970 **not confirmed**). P&C data standards exist in two formats: **AL3** (one-way batch, policy and commission "download") and **XML** (real-time request/response). AL3 use requires a licence. **[F]** https://acord.org/standards-architecture/acord-data-standards/Property_Casualty_Data_Standards
- IVANS: formed 1983/84 by 21-24 insurers as a shared network; P&C business bought by Applied Systems in 2013; carries AL3 download and ACORD XML real-time; self-reported ~38,000 agencies, 700+ carriers/MGAs. **[F, dates conflict]** https://www.insurancejournal.com/news/national/2013/05/01/290379.htm ; https://view.ceros.com/applied-systems/en-us-4-1
- Form family: ACORD 125 = common commercial application (entity, FEIN, NAICS/SIC, locations, prior insurance, lines requested); 126 = GL section; 140 = property section; 130 = workers' comp. **[F, secondary]** https://www.quotesweep.com/glossary/acord-125-commercial-application
- **[I]** Standardisation came form-first (a shared paper ask), then as a data dictionary behind the form (AL3, then XML). Carriers never agreed to drop their own supplementals; the standard covers the common ~80% and each carrier appends its own.

**ACORD 130 contents.** Section list confirmed from search extracts of the form and its instructions; field-level detail marked **[R]** is my recollection of the 2013/09 edition and should be checked against the PDF. Copies: https://www.statefundca.com/siteassets/all-forms/acord130.pdf ; https://xptspecialty.com/wp-content/uploads/2023/07/Acord-130-2013-09.pdf ; instructions https://www.montanastatefund.com/web/agents/docs/acord-130-application-instructions.pdf ; walkthrough https://totalcsr.com/resource-center/how-to-complete-the-acord-130/

1. **Agency / company / applicant** — agency, producer and CSR, agency customer ID; applicant name, mailing address, FEIN, entity type, years in business, SIC/NAICS; NCCI risk ID / other bureau ID **[R]**.
2. **Status of submission; billing and audit** — quote / bound / assigned risk; agency vs direct bill; payment plan; audit frequency. **[F]**
3. **Locations** — numbered list of premises. **[F]**
4. **Policy information** — proposed effective/expiration dates, anniversary rating date, Part 1 states, Part 2 employers' liability limits, Part 3 other states, deductibles, other coverages (USL&H, voluntary comp, foreign), dividend/retro plan. **[R]**
5. **Individuals included / excluded** — owners, partners, officers, relatives: name, title, ownership %, duties, included/excluded, class code, remuneration. **[F]**
6. **State rating worksheet** (one per state) — location, class code, duties, full-time/part-time employee counts, estimated annual remuneration, rate, manual premium; then experience mod, schedule credits, premium discount, expense constant, taxes, total/minimum/deposit premium. **[F]**
7. **Prior carrier information / loss history** — five years: carrier and policy number, premium, mod, number of claims, paid, reserved. **[F]**
8. **Nature of business / description of operations.** **[F]**
9. **General information** — yes/no with explanation. Confirmed by search: aircraft/watercraft; hazardous materials (past, present, discontinued operations); work underground or above 15 feet; work on barges, vessels, docks, bridges over water; other businesses; subcontractors (and %); employees under 16 or over 60; out-of-state travel; employee health plans; labour interchange with other businesses/subsidiaries; **leasing employees to or from other employers (2013 edition splits this into leasing to a client company vs from a PEO)**; tax liens/bankruptcy in five years; undisputed unpaid WC premium. From recollection **[R]**: work sublet without certificates; written safety program; group transportation; seasonal employees; volunteer labour; employees with physical handicaps; sponsored athletic teams; post-offer physicals; other insurance with this insurer; prior coverage declined/cancelled/non-renewed (3 years); employees predominantly working from home. Numbering and wording vary by edition and state.

## 4. Small-commercial digital quoting (closest analogue)

- **Appetite first.** Pie exposes an appetite checker and class-code search ahead of pricing; Appulate has a market directory; Bold Penguin "identif[ies], triage[s], quote[s] and bind[s]" and routes out-of-appetite prospects to an in-appetite agent or carrier. **[F]** https://boldpenguin.com/exchange ; https://blog.appulate.com/appulate-101-using-the-appulate-market-directory
- **Submission routing by market capability (Appulate).** Three tiers: eSubmission (market signed up and exposes a web service receiving ACORD XML); portal filling; emailed submission with forms. "Uplink" ingests ACORD data from any agency system that can print an ACORD form (printer-driver trick). **[F]** https://help.appulate.com/en/knowledge/submission-types ; https://appulate.com/for-agents
- **Clearance / broker of record.** Rules are per carrier, not standard. State Fund California: BOR set after a five-business-day rescission window; second broker gets a quote no sooner than 10 calendar days after notice to the first unless the insured rescinds. Celent polled carriers on policies ranging from "quote every submission" to "first submission received is the broker of record". Coalition and Chubb require a signed BOR letter. **[F]** https://www.statefundca.com/broker/broker-of-record-process/ ; https://www.celent.com/insights/591365917 ; https://help.coalitioninc.com/hc/en-us/articles/7666016304539-How-does-Coalition-support-Broker-of-Record-BOR-designations
- **Straight-through processing.** No neutral study found. Vendor figures: Verisk cites 65% of risks STP for LightSpeed customers; vendor guides give 40-75% for small commercial; a directory claims 73% of Pie submissions are auto-decided. Treat all as marketing. https://www.verisk.com/products/lightspeed-small-commercial/
- **Adoption is weak in commercial.** A vendor blog citing the Rough Notes 2024 technology survey says 76% of independent agents use no commercial comparative rater; a 2013 survey gave the reason as too few carriers offering commercial real-time rating. Tarmika reached about 31 carriers versus 330+ in personal lines. **[F, vendor-mediated]** https://www.quotesweep.com/blog/why-agents-dont-use-commercial-comparative-raters ; https://www.propertycasualty360.com/2013/10/18/survey-why-agencies-dont-use-real-time-download

## 5. Agent / broker portals

- Feature set observed across FAO, Pie, Appulate: login; quote and sell; policy access and endorsements; submission/quote lists with status; quote PDF retrieval; bind requests on eligible submissions; mobile access. **[F]** https://www.prnewswire.com/news-releases/pie-insurance-launches-automated-bind-requests-in-partner-portal-301135010.html ; FAO links in section 1. Commission statements, book-of-business reports and agency hierarchy/user administration are standard **[R]** — commission and policy data is also what AL3 download carries **[F]** (ACORD link above).
- **Producer identity.** NPN (National Producer Number) is assigned to individuals *and* business entities and is the key in NIPR's Producer Database (PDB); carriers appoint and terminate by NPN through NIPR, validated against the PDB. **[F]** https://nipr.com/industry-solutions/appointment-and-terminations ; https://nipr.com/help/help-articles/find-a-national-producer-number-npn-
- Programmatic licence checks: NIPR PDB (subscriber agreement required), or resellers — RegEd (search by agent ID, agency code, NPN or CRD), AgentSync ProducerSync (daily NIPR sync). **[F]** https://developer.reged.com/pages/producer-api-list ; https://developer.agentsync.io/producersync-api-overview.md
- Agency codes and sub-producer codes are carrier-issued, not NIPR data: one code per agency-carrier contract, sub-codes for locations or individuals, and commissions are paid against the code. **[R]** — no primary source found.

## 6. Sequence and lessons

1. **Standard ask before standard pipes.** ACORD forms (1971 onward) preceded AL3 batch download (IVANS, 1980s), which preceded real-time XML, which preceded REST APIs. **[F]** for each step; ordering **[I]**.
2. **Agent side first.** Raters sold seats to agencies and used the agency's existing appointments and logins; carriers were added one at a time and did not need to sign anything at first. **[I]** from the credential model in section 2.
3. **Before APIs.** Raters reproduced filed rate tables locally, then automated portals, then moved to carrier rating services. **[R]** — I could not find a source for this history; it is widely repeated but unverified here. Appulate's email/portal-fill/eSubmission tiers are the documented present-day equivalent. **[F]**
4. **Consolidation into management-system vendors.** Every independent personal-lines rater ended up inside Applied, Vertafore or Zywave (2011-2021). **[F]**
5. **Carrier-captive exchanges.** Bold Penguin to American Family, CoverWallet to Aon, Tarmika to Applied/Ivans. Bold Penguin itself published "why neutrality is the key to commercial connectivity". **[F]** https://boldpenguin.com/news/why-neutrality-is-the-key-to-commercial-connectivity
6. **What failed.**
   - Google Compare (closed March 2016, 28 insurers listed): state-by-state licensing, could not go national, treated insurance as a commodity. **[F]** https://www.insurancejournal.com/news/national/2016/02/23/399632.htm ; https://www.propertycasualty360.com/2016/02/25/why-google-couldnt-compare-with-local-agents
   - Commercial raters: thin carrier panels and indication-only grids, so agents re-key in the portal anyway and stop using the tool. **[F, vendor]**
   - Rater price differing from the carrier's final price is a recurring user complaint. **[F, review site]** https://www.capterra.com/compare/102928-123046/EZLynx-vs-PL-Rating

---

## Implications for a PEO quoting platform — INFERENCE

1. **The packet is the ACORD moment, not the Progressive moment.** A PEO-neutral intake that PEOs accept is the "standard ask". Model it explicitly on ACORD 130 sections 5-9 (owners, class code/payroll by state, five-year loss history, operations, yes/no questions) plus the benefits census that P&C never needed. Publish the schema; a form others adopt is a moat a UI is not.
2. **Expect a common core plus per-PEO supplementals.** P&C never eliminated carrier supplementals. Build a union question set with conditional per-PEO questions loaded when a PEO is selected (Semsee/Appulate pattern), rather than aiming for one universal form.
3. **Ship appetite before price.** PEO pricing is underwriter-judgement heavy, like commercial lines where STP is partial and indications dominate. The first real-time answer should be "which PEOs will look at this" (class codes, states, headcount, loss ratio knockouts), then an indication, and only later a bindable proposal. Label the three states precisely; mislabelled indications are what killed trust in commercial raters.
4. **Tier the PEO connection as Appulate does.** Structured PDF/email first, portal-fill second, API third. Do not wait for PEO APIs; most commercial carriers still lack them.
5. **Start on the broker side and ride their existing PEO relationships.** Raters grew by using the agency's own carrier codes. The alternative, holding the PEO contracts and treating brokers as sub-producers with a split (Bold Penguin Exchange), is a different, more regulated business; choose deliberately.
6. **Clearance is a feature you must design on day one.** PEOs, like carriers, will have "first in" / broker-of-record rules that differ by PEO. Timestamp submissions, record the certifying employer's broker designation, and surface conflicts before sending.
7. **Producer identity.** Key brokers on NPN (individual and agency), verify via NIPR or a reseller, and store PEO-issued broker codes per broker-PEO pair. Note the open question: PEO referral itself is not uniformly a licensed insurance activity, but the workers' comp and health components usually are.
8. **Stay neutral or say you are not.** The P&C exchanges were bought by carriers and distributors; panel breadth and perceived neutrality were the adoption constraint. Progressive's lesson is the opposite route: a single PEO could win by showing competitors' quotes. A neutral intake startup should assume one of its PEOs may try this.
9. **Accuracy beats breadth.** The persistent complaint is the rater number not matching the final number. A smaller panel with proposals that hold is worth more than a wide grid of soft indications.

## Not verified / open

- Progressive: comparative-rater integration details and agent APIs; exact Snapshot and Name Your Price launch years; whether comparison rates were shown when unfavourable.
- The rate-table then screen-scrape then API history of raters; which vendors use RPA today.
- ACORD's founding year; IVANS Markets appetite search; ACORD 130 fields marked [R].
- Any independent STP benchmark for small commercial.
- CoverWallet, Next, Cowbell, Coterie internals beyond what is cited.
