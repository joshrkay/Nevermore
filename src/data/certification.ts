// The wording a prospect certifies. The version is stored with every certification so we can
// always tell which text a signer agreed to; bump it whenever any wording below changes.
//
// DRAFT: NOT LEGALLY REVIEWED. Production needs LEGAL-approved text (plan decision D3).
export const CONSENT_TEXT_VERSION = "2026-10-draft-1";
export const CONSENT_IS_DRAFT = true;

/** The statements the signer acknowledges, in the order they are shown and stored. */
export function consentStatements(chosenPeo: string | null): string[] {
  return [
    "The information I've provided is accurate and complete to the best of my knowledge.",
    "All employees listed are W-2. Any K-1 owners or 1099 contractors have been identified separately.",
    `I understand this packet is prepared for me to send to ${chosenPeo ?? "the PEO I choose"} myself. Edgar Allan Advisory does not submit it or request a quote for me.`,
  ];
}

export const CONSENT_SIGNING_STATEMENT =
  "By signing, I certify, as an authorized representative of my company, that I have reviewed the information in this intake and agree to each statement above.";

export interface SignerDetails {
  name: string;
  title: string;
}

/**
 * A required answer the intake can't be certified without: not given yet, or given two ways (B-2, D26).
 * blockingItems in readiness.ts lists them; the database refuses the same (EA003, EA008).
 */
export interface NeededAnswer {
  label: string;
  reason: "missing" | "conflicting";
}

const neededAction = ({ label, reason }: NeededAnswer): string =>
  reason === "conflicting" ? `Choose one answer for ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`;

/**
 * Why certification can't be completed yet; empty when it can. Drives the submit button and its hint.
 * What the intake still needs comes first, missing answers before conflicts; then the signer's own steps.
 */
export function certificationBlockers(opts: {
  acknowledged: boolean[];
  signer: SignerDetails;
  signed: boolean;
  /** Whether the intake exists on the server yet (its File ID is assigned when it is certified). */
  hasIntake: boolean;
  isGuest: boolean;
  /** The required answers the intake still needs (blockingItems in readiness.ts). */
  needed?: NeededAnswer[];
}): string[] {
  // What the intake still needs comes first: no signature can make up for it.
  const blockers: string[] = (opts.needed ?? []).map(neededAction);
  if (opts.isGuest) blockers.push("Verify your email");
  if (!opts.hasIntake) blockers.push("Wait for your intake to finish saving");
  if (!opts.acknowledged.every(Boolean)) blockers.push("Check every statement");
  if (!opts.signer.name.trim()) blockers.push("Enter your full name");
  if (!opts.signer.title.trim()) blockers.push("Enter your role");
  if (!opts.signed) blockers.push("Sign");
  return blockers;
}
