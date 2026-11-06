// What a prospect reads and agrees to before the Chamber opens (US-6.2, plan H-2.2): who we are (Nevermore, a
// service of Edgar Allan Advisory), what the intake collects, how it is used and kept. The database records the
// agreement with this wording and version (public.record_intake_consent) and refuses a new intake or document
// without one; src/data/schemaSync.test.ts keeps the version equal to public.intake_consent_version().
//
// Bump the version, here and in a migration, whenever any wording below changes: everyone is asked again.
//
// DRAFT: NOT LEGALLY REVIEWED. Production needs LEGAL-approved text (decisions D3 and D10; docs/LEGAL_REVIEW.md).

import { RETENTION } from "./dataPolicy";

// draft-2 (migration 20261107090000): the Nevermore name, introduced as a service of Edgar Allan Advisory, and the
// packet no longer called "the Manuscript". Nothing else changed.
export const INTAKE_CONSENT_VERSION = "2026-11-draft-2";
export const INTAKE_CONSENT_IS_DRAFT = true;

export interface ConsentSection {
  heading: string;
  body: string;
}

export const INTAKE_CONSENT_SECTIONS: ConsentSection[] = [
  {
    heading: "Who we are",
    body: "Nevermore, a service of Edgar Allan Advisory, prepares PEO underwriting packets. We are not a PEO, an insurance carrier or an insurance agency. We prepare the packet for you to send to the PEO you choose; we don't submit it or request a quote for you. A PEO shown in this product is listed for comparison only: naming it doesn't mean it endorses, sponsors or works with us.",
  },
  {
    heading: "What you'll share",
    body: "Details about your company and its contacts, and personal information about your employees: the employee census (names, dates of birth, job titles, pay and dependents), payroll, benefits and workers' compensation records, and any documents you upload. Leave out Social Security numbers, bank account details and medical records; the packet doesn't need them.",
  },
  {
    heading: "How it's used",
    body: "To prepare your packet, to let our advisors review it with you, and to contact you about it. An AI assistant (Lenore) reads what you type, say and upload so it can fill in your answers; you confirm or correct every answer before you certify. We don't sell your information or your employees' information.",
  },
  {
    heading: "How long it's kept",
    body: `An intake you don't certify expires ${RETENTION.draftDays} days after your last change and is deleted ${RETENTION.closedDraftDays} days later, documents included. A certified intake is kept for ${RETENTION.submittedYears} years after you last certify it, then reviewed for deletion. You can ask us to delete your information sooner. The Privacy Policy has the details.`,
  },
];

export const INTAKE_CONSENT_AGREEMENT =
  "I've read this, the Privacy Policy and the Terms of Use. I'm authorized by my company to share this information, including my employees' personal information, for preparing this packet, and I agree to it being used as described.";

/** The exact wording stored with the agreement: every section, then the agreement line. */
export function intakeConsentText(): string {
  return [
    ...INTAKE_CONSENT_SECTIONS.map((s) => `${s.heading}: ${s.body}`),
    INTAKE_CONSENT_AGREEMENT,
  ].join("\n\n");
}
