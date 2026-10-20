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

/** Why certification can't be completed yet; empty when it can. Drives the submit button and its hint. */
export function certificationBlockers(opts: {
  acknowledged: boolean[];
  signer: SignerDetails;
  signed: boolean;
  hasFileId: boolean;
  isGuest: boolean;
}): string[] {
  const blockers: string[] = [];
  if (opts.isGuest) blockers.push("Verify your email");
  if (!opts.hasFileId) blockers.push("Wait for your intake to finish saving");
  if (!opts.acknowledged.every(Boolean)) blockers.push("Check every statement");
  if (!opts.signer.name.trim()) blockers.push("Enter your full name");
  if (!opts.signer.title.trim()) blockers.push("Enter your role");
  if (!opts.signed) blockers.push("Sign");
  return blockers;
}
