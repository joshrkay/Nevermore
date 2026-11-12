# How PEOs ask for data, and how PEO brokers work

Research date: 2026-11-10. Purpose: reverse-map Nevermore's intake onto each PEO's ask.

## Read this first: evidence quality

- **Method limit.** This session could run web searches but could not open pages: every direct fetch failed because the hosts are outside the session's allowed network domains (paychex.com, frankcrum.com, gnapartners.com, insurancenewsnet.com and others). Every "observed" claim below therefore rests on the search engine's extract of the cited URL, not on a full read of the document. Before building field maps, someone should open the documents marked **[open this]** and copy the actual column lists.
- **Labels.** *Observed* = stated in the cited source's extract. *Inference* = my reasoning. *Not verified* = looked for, not found.
- **Not reached at all:** SEC 10-K text (TriNet, Insperity, ADP, Paychex, Justworks, Rippling), NAPEO's member-only regulatory database, any PEO's actual census spreadsheet columns, and ClientSpace's current help site.

---

## 1. What a PEO needs to quote a prospect

### 1.1 Workers' compensation

Observed:

- **PrestigePEO (2025 WC underwriting deck)** splits the ask by program. Large-deductible program: complete census with job titles, remote-work status, worksite locations and travel status; description of operations; FEIN; website or LinkedIn page; declarations page or current PEO invoice if available. Loss runs are not needed to quote but are needed before binding, and a quote without them is illustrative only. Guaranteed-cost program: the same items, but currently valued three-year loss runs are required to quote. Poor loss history can push a group to guaranteed cost or a carve-out. **[open this]** https://www.prestigepeo.com/wp-content/uploads/2025/07/PrestigePEO-Presents-PEO-WC-Underwriting-and-Risks.pdf
- **ExtensisHR** asks for workers' compensation loss runs for roughly the previous 3 to 5 years. https://extensishr.com/blog/broker-centric-business-model-timeline
- **Texas Mutual (a carrier writing PEO business)** asks per client for at least two years of Texas payroll history and two years of currently valued loss runs, plus class codes and estimated payroll; at the PEO level it wants five years of currently valued loss runs and the experience modifier worksheet. https://TexasMutual.com/content/contentassets/agent-forms/peo-pre-approval-and-exclusions-092220-2-a.pdf and https://www.texasmutual.com/content/contentassets/agent-forms/professional-employer-organization-requirements-111918.docx
- **Wholesale and agency practice** for a standard WC submission is an ACORD 130, payroll by class code, three years of loss runs and the experience mod; Warner Pacific's checklist asks for an ACORD 130, a supplemental application and four years of loss runs. Novatae asks for explanations of claims over $20,000 and a loss-history affidavit where coverage lapsed. https://stagingwww.warnerpacific.com/getmedia/331b9eff-2211-4f13-8d89-87908871d7c1/Warner-Pacific-Prequal-Checklist_052620.pdf and https://completemarkets.com/company/novatae/professional-employer-organization/
- **KeyRisk's PEO supplemental** asks for current NCCI experience rating worksheets. https://c-8149-20170310-www-keyrisk-com.i.icims.com/sites/g/files/xkzibx186/files/2023-12/KRISK_PEOSupplemental_UND.10.19.225.pdf
- **Pennsylvania's state fund (SWIF)** asks for five years of loss runs for any PEO client with premium of $40,000 or more. https://www.pa.gov/agencies/dli/programs-services/workers-compensation/state-workers--insurance-fund-home/professional-employer-organization.html
- **Owner/officer inclusion or exclusion** and current carrier, policy number, effective dates and class codes appear on PEO-related intake forms. https://form.jotform.com/240976454493064 and https://form.jotform.com/260545517379162

Inference: the WC ask is the most standardised part of a PEO submission, because it inherits the ACORD 130 shape. The PEO-specific twist is that PEOs want the WC detail *inside the census* (job title, location, remote status per person), so they can assign class codes themselves, rather than a pre-summarised payroll-by-code table.

Not verified: whether any PEO publicly requires an actual signed ACORD 130 from the prospect (versus the same data on its own form); subcontractor and safety-program questions in a published PEO form.

### 1.2 Health and benefits (master plan underwriting)

Observed:

- **ExtensisHR**: dependent-level census, the most recent health insurance invoice(s), plan summaries. If the prospect is already in a PEO, ExtensisHR supplies a worksheet naming the documents to request from the current PEO. https://extensishr.com/blog/broker-centric-business-model-timeline
- **FrankCrum** requires census submissions in Excel on the *FrankCrum Census Template*. Groups with no prior medical coverage need a member-level census with at least legal first and last name and gender. Active COBRA participants must be on the census. Without current plan designs and rates, proposals carry no side-by-side comparison. Open-market quotes may also need a Group Health Questionnaire (GHQ), FEIN, primary address and SIC code. Florida Blue needs a minimum enrolment of 5; groups of 200 or more need leadership review and more time. **[open this]** https://www.frankcrum.com/hubfs/2023%20RESOURCES%20FOLDER/Benefits/Guides/PEO_Benefits_Master%20Plan%20Underwriting%20Guidelines.pdf and https://www.frankcrum.com/hubfs/2023%20RESOURCES%20FOLDER/Benefits/Forms/PEO_Health_Underwriting_Checklist.pdf
- **PrestigePEO's Group Health Questionnaire** (seven pages in the 2021 version) asks for business description, SIC code, number of locations, states of operation, prior health-quote denials, current contributions and known medical conditions. The 2025 form says disclosures are valid for effective dates within 90 days of signing and that Prestige may re-underwrite if the census changes. **[open this]** https://www.prestigepeo.com/wp-content/uploads/2025/01/PrestigePEO_GHQ_Form_25v1.pdf (2021 version: https://www.prestigepeo.com/wp-content/uploads/2021/10/GHQ-2021.pdf)
- **Warner Pacific's Colorado PEO partner matrix (2023)** lists, for one PEO programme, group health questionnaire "NA" and individual medical questionnaire "NA", so the census alone is the underwriting document, with a 5-enrolled minimum. https://warnerpacific.com/getmedia/902c6acb-c334-402e-a68f-3e9247c4dca6/co-peo-partner-matrix-9-6-23.pdf
- **Justworks** asks for a company census with basic information on employees and covered dependents; minimum carrier participation requirements apply to groups newly offering medical. https://help.justworks.com/hc/en-us/articles/360004481811 and https://help.justworks.com/hc/en-us/articles/360046094251-Carrier-Eligibility-Requirements
- **AvMed** publishes a PEO questionnaire for carrier-side underwriting. https://avmed.org/media/mt0bjakt/peo_questionnaire.pdf
- Generic census columns named by a general agency: home ZIP, gender, date of birth or age, hire date, coverage selected, dependents. https://brokerblog.wordandbrown.com/why-word-brown/health-insurance-census-forms/
- PEOs are buying predictive health-risk scores to underwrite from a census: Gradient AI's SAIL at PrestigePEO and Questco, Verikai's first-dollar risk score. https://www.gradientai.com/lines-of-business/group-health-peos and https://www.businesswire.com/news/home/20240917946921/en/

Differences worth mapping:

| Source | Census level | Health questionnaire | Distinctive ask |
|---|---|---|---|
| ExtensisHR | Dependent-level | Not mentioned | Current invoices and plan summaries; separate worksheet for prospects leaving a PEO |
| FrankCrum | Member-level for virgin groups; own Excel template mandatory | GHQ possible on open-market quotes | COBRA participants; SIC code; names |
| PrestigePEO | Census plus job/location detail | Group-level GHQ, signed, 90-day validity | Prior quote denials; known conditions |
| Warner Pacific CO programme | Census of eligible employees | None | 5-enrolled minimum |

Not verified: a size threshold (50+ or 100+) at which PEOs demand claims experience. One search extract attributes a "minimum of 12 months of claims history" rule to an Aetna PEO master-plan guide, but I could not confirm the group size it applies to. Treat the threshold as unknown and PEO-specific.

### 1.3 Payroll, tax and administration

Observed:

- A PEO reviews payroll history, WC claims and loss runs, current benefit plans and census data, and states of employment. https://www.gnapartners.com/resources/guides/peo-renewal-readiness-scorecard
- PEOs do not receive SUTA rate notices from the state automatically and ask the client to forward them (Paychex PEO resource page). https://www.paychex.com/sites/default/files/2020-10/Q3-2020-PEO-ResourcePage.pdf
- SUTA handling differs by state: Florida lets a PEO elect a master rate or each client's own rate; in Indiana the client inherits the PEO's merit rate. https://www.in.gov/dwd/indiana-unemployment/employers/employer-guide/employer-qualifications-and-special-circumstances/peo
- Some PEO quotes show a separate SUTA rate before and after the wage-base cutoff, others do not. https://www.peocompare.com/5-things-to-look-for-in-a-peo-quote/
- A Paychex PEO employee form pairs job title, WC class code, withholding state and state unemployment insurance per employee. https://download.paychex.com/pas_pbs/formfiles/peo074.pdf

Not verified: a published PEO checklist that names Form 941, W-2 counts, a payroll register or financial statements for quoting. Those are common in practice by my general knowledge, but I found no primary source this session.

### 1.4 EPLI and HR risk

Observed: one broker RFP intake form asks whether the business currently uses a PEO and whether employees handle hazardous materials. https://form.jotform.com/252672925122153

Not verified: any published PEO form asking about prior employment claims, handbooks or turnover. PrismHR's ClientSpace tracks EPLI policies and claims on the PEO side, which shows PEOs price it, but not what they ask prospects. https://www.prismhr.com/solutions/clientspace/risk-management/

---

## 2. How the request flows today

Observed:

- **Intake is documents plus a spreadsheet.** A PEO-quoting vendor describes the status quo as data gathered by email, and sells a "universal form" to replace it. https://zeyrax.com/bqlite-universal-form.html
- **The rep keys it into an internal portal.** A TriNet job listing describes gathering prospect data, entering it into TriNet's portal for pricing quotes, and submitting RFP documents to Risk and Medical Pricing through that portal. https://remotejobs.org/remote-jobs/sales-associate-Hck3wLj0
- **PEO-side pricing tool.** ClientSpace (PrismHR's CRM for PEOs) has a Pricing Console: pricing batches, states and comp codes per batch, a manual rate (PEO rate per $100 before mods) and a funding rate (carrier cost per $100), comparison batches, profitability and commission projection, and a CSV template to pre-load the pricing grid. https://clientspace.atlassian.net/wiki/spaces/KNOW/pages/8683593/Adding+Policy+Comp+Codes+To+ClientSpace and https://clientspace.atlassian.net/wiki/spaces/KNOW/pages/93588718/Creating+Pricing+In+ClientSpace+Next and https://www.prismhr.com/?p=650
- **Turnaround.** One provider claims a fully underwritten quote in 48 to 72 hours from census, renewal invoice and benefit summary; ExtensisHR says "several business days"; one WC programme cites 24 to 48 hours; missing loss runs slow WC quotes; general-agency large-group medical quotes take 7 to 10 business days, longer in Q4. https://extensishr.com/blog/broker-centric-business-model-timeline , https://www.amwins.com/resources-and-insights/market-insights/article/peo-sector-faces-new-challenges-with-labor-shifts , https://www.wordandbrown.com/getmedia/6aa8dcf9-fb2a-4fdf-84a0-7d48a12bdb13/WB-051225-Large-Group-Quotes-FAQ_5-25.pdf
- **Manual effort.** Zeyrax claims its tool saves 8 to 12 hours per quote comparison for the broker and 3 to 5 hours per underwriting submission for the PEO rep. Vendor claim, unverified. https://zeyrax.com/broker-quoter.html
- **What comes back.** Four cost areas: administrative fee, workers' compensation, state unemployment tax, health benefits. Administrative fees are a percentage of payroll or a flat per-employee-per-month amount. Proposals are not organised the same way across PEOs, which is why brokers build comparison sheets. https://www.staffmarket.com/peo-proposal-analysis , https://www.staffmarket.com/peo-pricing/types , https://connecteam.com/peo/e-peo-broker/
- **ExtensisHR sends the proposal to the broker first**, before the prospect sees it. https://extensishr.com/blog/broker-centric-business-model-timeline

Portals, APIs and instant quotes:

| PEO | What is public | Source |
|---|---|---|
| Justworks | Published PEPM price list. Referrals must come through its partner relationship management platform, advisor dashboard or a unique link. Instant health quote exists on Justworks *Payroll* when the group qualifies. | https://help.justworks.com/hc/en-us/articles/34505946562843-What-is-the-Justworks-Partner-Program , https://help.justworks.com/hc/en-us/articles/41418873066395-Justworks-Payroll-Benefits |
| TriNet | Broker programme with a "Partner Connect Dashboard" showing submitted pipeline; no public rate card; pricing is a three-step request. | https://trinet.com/partners/brokers , https://www.trinet.com/peo/pricing |
| Paychex PEO (incl. Oasis) | Channel partner programme, partner calculator; payment requires a Paychex Vendor ID. | https://www.paychex.com/peo-partner-program , https://go.paychex.com/peo-calculator |
| Rippling | Broker partner tiers (Standard, Gold, Platinum). | https://www.rippling.com/broker-partnership-program |
| Vensure | Login page has a broker section for submitting referrals. | https://vensure.com/login/ |
| ADP TotalSource, Insperity | Broker referral programmes under separate channel agreements. | https://adp.com/what-we-offer/products/totalsource-peo/brokers.aspx , https://www.insperity.com/hr-solutions/brokers/ |
| PrismHR (platform under many mid-size PEOs) | REST and SOAP API exists; no quoting endpoint found. | https://prismhr.com/software/api |

**Not verified, and probably not public:** I found no PEO exposing a public quoting API, and no documentation of a broker portal that accepts a structured submission and returns a bindable quote. Nothing found for broker portals at Engage, CoAdvantage, G&A, Questco, Decent or Sequoia One. Absence of search results is not proof of absence.

---

## 3. Existing marketplaces, brokers and their tech

Observed (mostly vendor self-description):

| Player | What it actually does | Source |
|---|---|---|
| **Zeyrax BrokerQuoter / BQ Lite** | Closest thing to a comparative rater. Intake by email, mobile form or upload ("universal form"); error checking; census-to-invoice reconciliation; side-by-side comparison across PEOs, products and plans; gives PEOs data on case disposition, pricing and broker quality. Sold to brokers and general agents. | https://zeyrax.com/broker-quoter.html , https://zeyrax.com/bqlite-universal-form.html |
| **Entravia** | Describes itself as "the infrastructure layer for PEO shopping"; monitors pricing and renewals; claims SOC 2 and HIPAA compliance; free to buyers. Founder Kasey Devine. | https://f4.fund/startups/entravia |
| **Vyral PEO Resources** | Launched January 2026 claiming "instant PEO quotes" and positioning as a research centre, not a broker. Mechanics not verified. | https://www.prnewswire.com/news-releases/vyral-peo-resources-launches-as-the-nations-first-instant-quote--peo-research-platform-302666788.html |
| **PEO Score** | Launched 2019; proprietary algorithm scores the employer for PEOs; one comparative report; commissions paid by PEOs and disclosed up front. Current status not verified. | https://www.prnewswire.com/news-releases/peo-score-announces-platform-launch-a-powerful-simplified-peo-process-through-smart-fast-and-cost-effective-technology-300787645.html |
| **Onward Advisors PEO Pro** | 2020 portal for data gathering, output is a side-by-side report. | https://www.prweb.com/releases/onward-advisors-launches-peo-pro-tm-platformindustry-first-online-portal-saves-employers-time-money-and-resources-888805438.html |
| **StaffMarket** | RFP marketplace: employer registers requirements, qualifying PEOs are notified and submit proposals directly; does not set pricing. | https://www.staffmarket.com/peo-vendor-evaluation |
| **PEOcompare.com** | Matching tool and "Quick Compare"; lead routing to participating PEOs. | https://peocompare.com/About-PEO-compare-PEOs/ |
| **Libertate / RiskMD** | Not an employer-facing marketplace. A general agency placing property and casualty insurance *for PEOs*, with RiskMD as a data and pricing-analytics arm (merged with Ballator in 2019). | https://insurancejournal.com/news/southeast/2019/01/07/513912.htm |
| **Appulate PEOConnect** | WC submission network that distributes PEO products to agents; dated sources. | https://appulate.com/for-peo |
| **ClientSpace Pricing Console** | PEO-internal pricing, not a cross-PEO rater (see section 2). | https://www.prismhr.com/?p=650 |

Not verified: anything specific about PEO Spectrum, NetPEO, Compass PEO, Hadley, PEO Insider, "PEO Velocity", "PEO Pricer", Aspen HR, BenefitMall PEO or Stratus.hr as quoting technology. Searches returned nothing usable. Several names in the brief may be traditional brokers with no engine, or may not exist under that name.

Inference: nobody has demonstrably built a rater in the P&C sense (structured input in, carrier-computed bindable price out). What exists is intake plus document assembly plus a human-built comparison. Zeyrax and Entravia are the direct competitors to study first.

---

## 4. Broker economics and tracking

Observed:

- **Basis.** Paychex pays referral fees on administrative fees; a 2021 Oasis deck shows 20% of the administrative fee, paid monthly, no cap, on an example of $1,000 admin fee per employee per year. The Oasis-brand agreement makes the percentage case-by-case, confirmed by underwriting. **[open this]** https://www.paychex.com/sites/default/files/2022-09/channel-partner-agreement.pdf and https://www.vailvalleypartnership.com/fa-content/uploads/sites/2/2021/05/Presentation_ChannelPartners.pdf
- G&A Partners pays a percentage of the PEO administrative fee. https://go.gnapartners.com/hubfs/Files/NFP_PartnersFinancial_Slicks/GAP_BrokerOverview.pdf
- Rippling lists a PEO referral payment of $55 per enrolled employee. https://rippling.com/brokers
- Insperity's general referral offer is flat: $500 (5 to 9 employees) or $2,000 (10 or more); broker channel terms sit in separate channel agreements. https://solutions.insperity.com/mm/aiagency-referral/
- ExtensisHR advertises up to $18,750 per referral. https://extensishr.com/brokers/
- VertiSource pays a residual percentage of payroll, lifetime. https://vertisource26.opal19.i4.net/partners/
- Justworks partners can take a referral bonus or pass it to the client as a PEPM rebate. https://www.justworks.com/partner-referrals-customer-rebate-program
- **Duration.** Paychex fees can continue for the life of the client's service agreement, even after the partner agreement ends. Source as above.
- **Broker of record.** ExtensisHR and PrestigePEO state they do not recognise or accept Broker of Record letters, so the referring broker cannot be displaced. TriNet says referral fees are protected from broker-of-record changes. Paychex requires the partner to disclose the lines on which it is agent or broker of record. https://extensishr.com/resource/broker-friendly-peos-5-myths-debunked/ , https://prestigepeo.com/for-brokers/ , https://trinet.com/partners/brokers
- **Appointment requirements.** PrestigePEO: broker must be licensed to sell health insurance to receive commissions. Paychex: Vendor ID. TriNet: no executive of the partner may work for or sit on the board of a competitor. https://prestigepeo.com/broker-faq/ , https://www.trinet.com/partners/brokers/registration/unum
- **Licensing law.** A 2014 trade article says PEO brokers are generally not subject to licensing, but in some states only licensed agents may compare health plans. Louisiana bars a PEO from holding itself out as an insurer, broker or agent without a licence, and bars PEO representatives from comparative analysis or advice on insurance policies in a sale. Florida bars a licensee from paying an unlicensed person a referral fee contingent on a sale. https://www.propertycasualty360.com/2014/10/27/what-insurance-agents-should-know-about-peo-broker , https://legis.la.gov/legis/Law.aspx?d=508737 , https://florida.public.law/statutes/fla._stat._626.112

Not verified: a typical commission range across the industry; any published deal-registration window (30/60/90 days) or first-to-submit rule at a named PEO; W-9 requirements (near-certain in practice, no source found). Registration rules appear to live in unpublished partner agreements.

---

## 5. Regulatory and trust constraints

Observed:

- **State licensing.** ESAC says 39 state agencies have PEO-specific licensing or registration requirements. California, Pennsylvania, Georgia and Idaho have no PEO licence but have laws recognising PEOs. NAPEO's 50-state regulatory database is members-only. https://esac.org/Regulators/regulator-benefits-and-services , https://napeo.org/peo-resources/tools/regulatory-database
- **IRS CPEO.** Annual audited financial statements, quarterly attestations, and a bond on Form 14751; Rev. Proc. 2023-18 consolidates the ongoing requirements. The IRS publishes the active CPEO list. https://www.irs.gov/tax-professionals/certified-professional-employer-organization-application , https://www.irs.gov/pub/irs-sbse/active-cpeos.pdf
- **ESAC.** Each accredited PEO buys an individual surety bond of $250,000 to $1 million; ESAC adds a $15 million aggregate bond, held in trust. https://www.esac.org/about-esac/
- **HIPAA.** Enrolment data an employer holds as employer is not PHI; brokers commonly become business associates when they handle PHI for creation, renewal or replacement of a health insurance contract, and need a business associate agreement. https://www.assuredpartners.com/-/media/Files/Corporate/EB-Compliance-Documents/2-19-Employees/Column-1/HIPAA/Brokers-as-Business-Associates.pdf , https://www.hhs.gov/guidance/document/employers-and-health-information-workplace
- **Loss runs.** Florida requires an insurer to provide a loss run within 15 calendar days of the insured's written request; Kentucky sets 20 days. https://florida.public.law/statutes/fla._stat._627.444

Inference (from my knowledge of the regulation, not fetched this session): 45 CFR 160.103 excludes employment records held by a covered entity in its role as employer from PHI, and 45 CFR 164.504(f) lets a group health plan give a plan sponsor summary health information to obtain premium bids. So a census of name, DOB, gender, ZIP and tier supplied *by the employer* is employment data, not PHI. A completed health questionnaire with named conditions is sensitive health information, and it becomes PHI once held by a carrier or health plan, or by anyone acting as their business associate. Nevermore should assume the questionnaire and any claims report put it in business-associate territory and get counsel's view. https://www.ecfr.gov/current/title-45/section-160.103 , https://www.ecfr.gov/current/title-45/section-164.504

Not verified: SSN requirements at quote stage. No source showed a PEO asking for SSNs to quote; they appear at onboarding. Loss-run confidentiality rules beyond the insured's right of access were not found.

---

## 6. Standardisation attempts

Observed:

- **No PEO submission standard found.** Nothing from NAPEO resembling an ACORD form. Each PEO publishes its own census template (FrankCrum makes its own mandatory).
- **ACORD 130** is the WC application standard and the nearest thing to a common format. https://www.saif.com/Documents/Forms/ACORD_Fillable.pdf
- **LIMRA LDEx**: free standards for benefits data exchange. Enrolment standard is established (v1.3; v2.0 adds REST). A *Benefits Quote Management Standard*, including a standardised demographic census structure for pre-sale and renewal RFPs, is described as in development, not published as far as I could find. https://www.limra.com/en/solutions-and-services/data-exchange-standards/ldex-overview/
- **Ideon** exposes a group quoting API: create a group, add census members and dependents (ZIP, FIPS county code, household and relationship fields), then request quotes filtered by carrier. Most small-group carriers are rated by Ideon's own engine from filed rates; UnitedHealthcare uses a real-time integration. Some carriers need extra fields (Angle needs member names and the broker's email). https://ideonapi.gitbook.io/quote-and-select/quote-groups/small-group-medical/add-a-census , https://ideonapi.gitbook.io/quote-and-select/quote-groups/small-group-medical/quote-a-group
- **ThreeFlow** runs RFPs between brokers and carriers: census and plan documents in, normalised quotes out; quotes in minutes for plans in its library, about two business days otherwise; system-to-system "Connect" links to carrier rating systems; claims 75+ certified carriers. https://www.threeflow.com/platform/ai-that-works , https://www.threeflow.com/solutions/threeflow-for-carriers
- **FormFire** (now AgencyBloc) standardised the individual medical questionnaire for small-group underwriting, one interview reused across carriers; AgencyBloc's Quote+ reformats census data to each carrier's submission format. https://www.agencybloc.com/quoting/medical-health-questionnaire
- **Salesforce** ships census-member objects in its insurance data model. https://developer.salesforce.com/docs/atlas.en-us.insurance_developer_guide.meta/insurance_developer_guide/actions_obj_get_group_census_members.htm

Not verified: Employee Navigator and Ease census column lists; Noyo.

---

## Table: data element → who asks → source document → standard format

| Data element | Who asks for it | Usual source document | Standard format, if any |
|---|---|---|---|
| FEIN, legal name, entity type, address | All PEOs; WC carriers | Employer; IRS letter; ACORD 130 | ACORD 130 fields |
| SIC/NAICS code, description of operations | PrestigePEO GHQ, FrankCrum, WC underwriters | Employer narrative; website | ACORD 130; none for PEO |
| States and locations | All | Census; payroll report | None |
| Employee census: name, DOB, gender, home ZIP | All PEO health underwriters | Payroll or HRIS export; prior carrier invoice | None for PEO. Ideon API schema; LDEx quote census (in development) |
| Dependents (dependent-level) | ExtensisHR, Justworks | Carrier invoice; enrolment file | As above |
| Coverage tier, waivers, COBRA status | FrankCrum (COBRA explicit) | Carrier invoice | None |
| Job title, worksite, remote/travel status | PrestigePEO WC | Census | None |
| Salary or annual payroll per employee | PEO WC and admin-fee pricing | Payroll register | None |
| WC class codes with payroll per code per state | WC carriers; PEO pricing tools | Current policy declarations; audit; ACORD 130 | NCCI or state bureau class codes; ACORD 130 |
| Experience mod | WC carriers, KeyRisk, Texas Mutual | NCCI or bureau rating worksheet | NCCI worksheet |
| Loss runs, currently valued, 3 to 5 years | PrestigePEO (3 for guaranteed cost), ExtensisHR (3 to 5), Texas Mutual | Carrier-issued loss runs | None (carrier PDFs) |
| Current WC carrier, policy number, dates | PEO onboarding and WC | Declarations page | ACORD 130 |
| Owner/officer inclusion or exclusion | WC | Employer; policy endorsements | ACORD 130 |
| Current plan designs | ExtensisHR, FrankCrum | SBCs, plan summaries | SBC is a federal template |
| Current and renewal rates | ExtensisHR, FrankCrum | Carrier invoice; renewal letter | None |
| Contributions, participation | PrestigePEO GHQ; carriers | Employer; invoice | None |
| Group health questionnaire | PrestigePEO; FrankCrum open-market; not all | PEO's own signed form | None (FormFire is the de facto individual-level analogue) |
| Claims experience | Larger groups; threshold not verified | Carrier claims report | None |
| SUTA rate by state | PEOs for tax pricing | State rate notice | None; state-specific |
| Pay frequency, gross payroll, headcount | All | Payroll register | None |
| Prior PEO relationship | ExtensisHR; broker intake forms | Current PEO invoice | None |
| Hazard and HR-risk questions | Broker intake; EPLI (not verified for PEOs) | Employer | None |

---

## Implications (inference)

1. **The neutral packet is the missing standard.** No ACORD-like PEO submission exists and LDEx's quote census is unfinished, so a packet that is a superset of the per-PEO asks has no incumbent format to displace. It should emit ACORD 130-shaped WC data, since that is the one piece PEOs and carriers already share.
2. **The census is the hinge.** PEOs differ mainly in census depth (employee versus dependent level, names or not, job/location detail, COBRA). Collect the deepest version once and down-project per PEO, including FrankCrum's mandatory template.
3. **Documents still matter as much as fields.** Loss runs, invoices, SBCs and SUTA notices are carrier- or state-issued PDFs. A rater that only captures typed answers will not remove the rekeying; extraction and reconciliation (what Zeyrax sells) is part of the job.
4. **"Quote-and-bind" is far off; "submit-once, compare-normalised" is reachable.** P&C raters work because rates are filed and computable. PEO pricing is discretionary underwriting inside tools like ClientSpace, with no public quoting API found. The realistic wedge is structured submission into each PEO's desk plus normalised proposals back. Justworks, with a published price list, is the likeliest first instant quote.
5. **Broker-of-record behaviour is a product requirement.** PEOs protect the referring broker by ignoring BOR letters and by paying on registered referrals through their own partner tools. The platform needs a timestamped, per-PEO record of who submitted which employer when, and must not break each PEO's own registration channel.
6. **Licensing and HIPAA posture should be decided early.** Comparing health plans or WC coverage can require a producer licence in some states even though PEO brokering generally does not, and holding health questionnaires points toward business-associate obligations. Both need counsel; neither is settled by the sources here.
7. **Verify before building maps.** The documents marked [open this] should be read in full, and partner agreements from three or four target PEOs obtained directly, since registration windows and commission schedules are not public.
