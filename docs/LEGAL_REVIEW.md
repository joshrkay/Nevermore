# Legal review of public copy

Counsel completes this record before launch (US-6.2, plan H-2.1 to H-2.3, decisions D3, D4 and D10). Until it is
complete, every page that shows this copy says it is a draft pending legal review, and nothing here is approved.

**Status:** not started. No reviewer has been named (D10).

## What is reviewed

| Item | Where it lives | Version | What to check |
|---|---|---|---|
| Privacy Policy (`/privacy`) | `src/pages/PrivacyPage.tsx`. Its data classes and retention table are rendered from `src/data/dataPolicy.ts`, its service providers from `src/data/legal.ts` | `PRIVACY_POLICY_VERSION` `2026-11-draft-1` | Accuracy against the product, every commitment it makes, the retention windows, the provider list |
| Terms of Use (`/terms`) | `src/pages/TermsPage.tsx` | `TERMS_VERSION` `2026-11-draft-1` | Role and what we don't do, eligibility, accuracy, acceptable use, ownership of the packet; write the three bracketed sections (below) |
| Intake consent (shown before the Chamber opens) | `src/data/intakeConsent.ts`, rendered by `src/components/chamber/IntakeConsentGate.tsx` | `INTAKE_CONSENT_VERSION` `2026-11-draft-1`, also `public.intake_consent_version()` in `supabase/migrations/20261104090000_intake_consent.sql` | Who we are, what is shared, how it's used, how long it's kept, and the agreement line (authority to share employee data). The exact text is stored with every agreement (`intake_consents`) |
| Certification consent (The Reckoning, then printed on the Manuscript page and its PDF) | `src/data/certification.ts`, the only definition | `CONSENT_TEXT_VERSION` `2026-10-draft-1` | The three statements and the signing statement (D3), and the draft mark's wording, `CONSENT_DRAFT_LABEL` |
| Retention windows | `src/data/dataPolicy.ts` (`RETENTION`), enforced by the database functions it names | D4 | Draft 30 days after last change; closed drafts deleted 30 days after closing; submitted records reviewed for deletion 3 years after the latest certification; email delivery events 365 days; monitoring events 90 days; rate-limit records 1 day; browser backup 7 days |
| Role disclosure across the site | Landing page, intake consent, Privacy Policy, Terms of Use, The Reckoning, the notification emails, the Manuscript | n/a | Nothing implies we are a PEO, carrier or agency, that we act or submit for the prospect, or that a listed PEO endorses or works with us. `src/copy.guard.test.ts` bans the phrases we know of |

### Other copy to look at

These make claims that only counsel can stand behind. They are not part of the pages above, and none has been changed:

- **The Manuscript's data note.** Both the page (`src/pages/ManuscriptPage.tsx`) and the PDF (`src/lib/manuscriptPdf.ts`) print: "Information collected here constitutes employer HR records, not Protected Health Information under HIPAA. PHI protections apply upon enrollment submission to a health plan carrier." That is a legal characterization of the data. The landing page made a similar claim ("It's not health data until it goes to a carrier"), which has been removed.
- **The Manuscript's "Prepared by" line** names `edgar-allan-advisory.lovable.app`, a preview domain, not the production domain (plan J-1.2).
- **"For PEO Partners"**, the label of a landing-page section and of a navigation link (`src/pages/LandingPage.tsx`, `src/components/Navbar.tsx`). It addresses PEO underwriters who receive packets. Confirm it doesn't read as a claim of partnership.
- **"We don't sell your information"** appears in the intake consent, the Privacy Policy and the landing page.

## Placeholders to fill before launch

| Placeholder | Where | What it needs |
|---|---|---|
| Privacy contact | `PRIVACY_CONTACT` in `src/data/legal.ts` (null). The pages say the address "will be published here before launch" | A monitored role address for privacy questions and deletion requests, never a person's own inbox |
| AI model provider | `SERVICE_PROVIDERS` in `src/data/legal.ts` ("An AI model provider") | The provider chosen under D11 (Lovable AI gateway or Anthropic), named, with its data terms reviewed |
| Disclaimers | `src/pages/TermsPage.tsx` (`COUNSEL_PLACEHOLDER`) | Counsel's text |
| Limitation of liability | `src/pages/TermsPage.tsx` (`COUNSEL_PLACEHOLDER`) | Counsel's text |
| Governing law | `src/pages/TermsPage.tsx` (`COUNSEL_PLACEHOLDER`) | Counsel's text |
| Approval record | `LEGAL_APPROVAL` in `src/data/legal.ts` (all null) | Filled in when approved (below) |

## Questions for counsel

1. **Compensation and affiliation.** Does Edgar Allan Advisory receive, or expect to receive, referral fees,
   commissions or any other payment from a PEO or carrier, including one listed in the PEO comparison? If so, what
   must be disclosed, where (intake consent, PEO Match, Privacy Policy, Terms), and does it change the statement
   that naming a PEO doesn't mean it works with us?
2. **Licensing.** Does preparing an underwriting packet, or anything the advisory team does with it, need a
   producer or broker license in any state the product serves? The copy says we are not an insurance agency.
3. **"We don't sell."** Is that commitment accurate and complete under the privacy laws that apply (for example,
   "sharing" for advertising under California law)? The product has no advertising or analytics trackers today.
4. **Retention (D4).** Are the windows above right, and long enough for any record-keeping obligation that applies
   to the advisory business? Should submitted records ever be deleted automatically, or always after review as now?
5. **Applicable privacy and breach-notification law.** Which state privacy laws apply to a business-to-business
   intake that holds employee personal data, and what must the Privacy Policy say to meet them? Which
   breach-notification laws apply, and to whom (the prospect company, its employees, regulators)? The incident
   runbook needs the answer.
6. **Employee data.** The prospect shares its employees' personal information. Is the agreement line ("I'm
   authorized by my company to share this information, including my employees' personal information") enough, or
   does the employer need to have given its employees notice, and should we say so?
7. **Health information.** Benefits invoices, dependents and workers' compensation loss runs can describe health
   and injuries. Is the Manuscript's HIPAA data note correct, and does any of this data need more than our
   "restricted" handling?
8. **Processors.** Are the service providers' data terms (Supabase, Vercel, Resend, the AI provider under D11,
   ElevenLabs, Cloudflare) adequate, and must the Privacy Policy say more about them (location, sub-processors,
   whether the AI provider keeps or trains on what it reads)?
9. **Terms.** Write the disclaimers, limitation of liability and governing law; confirm the rest (acceptable use,
   suspension, ownership of the packet, the change clause).
10. **Contact address** for privacy and deletion requests (see placeholders).

## Approval record

One row per item and version. A changed wording is a new version and needs a new row.

| Item | Version | Reviewer (name, firm) | Date | Decision (approved / changes requested) | Notes |
|---|---|---|---|---|---|
| Privacy Policy | `2026-11-draft-1` | | | | |
| Terms of Use | `2026-11-draft-1` | | | | |
| Intake consent | `2026-11-draft-1` | | | | |
| Certification consent | `2026-10-draft-1` | | | | |
| Retention windows (D4) | `src/data/dataPolicy.ts` as of approval | | | | |
| Role disclosure audit (H-2.3) | site copy as of approval | | | | |

## Making approval live

Copy counsel changed goes in first, then:

1. **Privacy Policy and Terms.** Set the approved versions in `PRIVACY_POLICY_VERSION` and `TERMS_VERSION`, update
   `LEGAL_LAST_UPDATED`, fill `PRIVACY_CONTACT` and the AI provider in `SERVICE_PROVIDERS`, replace each
   `COUNSEL_PLACEHOLDER`, then set `LEGAL_APPROVAL` (who, when, version) and `LEGAL_COPY_APPROVED = true` in
   `src/data/legal.ts`. The draft notice on both pages disappears.
2. **Intake consent.** If the wording changed, give it a new version in `INTAKE_CONSENT_VERSION` and, in a new
   migration, in `public.intake_consent_version()` (`src/data/schemaSync.test.ts` fails until the two agree).
   Every account is then asked to agree again. Set `INTAKE_CONSENT_IS_DRAFT = false`.
3. **Certification consent.** If the wording changed, give it a new `CONSENT_TEXT_VERSION`; every certification
   stores the version and text it was signed with. Add the approved version to `APPROVED_CONSENT_VERSIONS` in
   `src/data/certification.ts`. That removes the "DRAFT: NOT LEGALLY REVIEWED" mark in The Reckoning, and the mark
   and watermark on the Manuscript page and PDF of every packet signed with that version. Packets signed with a
   draft wording stay marked: the mark follows the version signed, not today's.
4. **Retention.** If a window changed, change it in `src/data/dataPolicy.ts` and in a new migration that replaces
   the matching database function; `src/data/schemaSync.test.ts` keeps the two equal. The Privacy Policy follows
   on its own.
5. Fill in the approval record above in the same pull request, and mark D3, D4 and D10 decided in
   `docs/PRODUCTION_READINESS_PLAN.md`.

## What the code already checks

- `src/copy.guard.test.ts`: no named PEO, no claim of affiliation, agency or partnership, no promise to act or
  submit for the prospect, no quote; the role disclosure appears in the intake consent, the Privacy Policy and the
  Terms; the landing page's removed data claims stay removed; every page links to the Privacy Policy and Terms of
  Use, and both are routed.
- `src/pages/PrivacyPage.test.tsx` and `src/pages/TermsPage.test.tsx`: every section, the draft notice, the role
  disclosure, every retention rule and service provider, the counsel placeholders.
- The draft notices: the Privacy Policy and Terms (`LEGAL_COPY_APPROVED`), the intake consent
  (`INTAKE_CONSENT_IS_DRAFT`) and The Reckoning (`CONSENT_IS_DRAFT`) each say the wording is a draft while it is.
  The Manuscript page and its PDF mark the certification consent by the version that was signed
  (`isDraftConsent`), with a watermark behind the certification block (`ManuscriptPage.test.tsx`,
  `manuscriptPdf.test.ts`, and the end-to-end test, which reads the downloaded PDF).
