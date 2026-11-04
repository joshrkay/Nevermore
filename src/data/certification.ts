import type { RequiredItem } from "./requiredItems";

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
 * Why certification can't be completed yet; empty when it can. Drives the submit button and its hint.
 * Missing required answers come first (US-1.2; the database refuses them too, EA003). Then each required
 * answer whose answers conflict (B-2, D26): the database refuses those too (EA008), whoever verified them,
 * so the browser holds back exactly what it would refuse. States of operation taken from a census in
 * conflict is resolved on the census, so that is named as well (B-2.2); the census alone never blocks.
 */
export function certificationBlockers(opts: {
  acknowledged: boolean[];
  signer: SignerDetails;
  signed: boolean;
  hasFileId: boolean;
  isGuest: boolean;
  /** Labels of the required answers the intake doesn't have yet (missingRequired in readiness.ts). */
  missingAnswers?: string[];
  /** Labels of the required answers in conflict, as the database reads them (conflictingRequired in readiness.ts). */
  conflictingAnswers?: string[];
  /** The intake's items (requiredItems.ts), for states of operation in conflict through the census. */
  requiredItems?: readonly RequiredItem[];
}): string[] {
  const conflicts = [...(opts.conflictingAnswers ?? [])];
  for (const item of opts.requiredItems ?? []) {
    if (item.required && item.state === "conflicting" && item.viaCensus && !conflicts.includes(CENSUS_LABEL)) conflicts.push(CENSUS_LABEL);
  }
  // What the intake still needs comes first: no signature can make up for it.
  const blockers: string[] = [
    ...(opts.missingAnswers ?? []).map((label) => `Add ${label.toLowerCase()}`),
    ...conflicts.map((label) => `Resolve the conflicting answers for ${label}`),
  ];
  if (opts.isGuest) blockers.push("Verify your email");
  if (!opts.hasFileId) blockers.push("Wait for your intake to finish saving");
  if (!opts.acknowledged.every(Boolean)) blockers.push("Check every statement");
  if (!opts.signer.name.trim()) blockers.push("Enter your full name");
  if (!opts.signer.title.trim()) blockers.push("Enter your role");
  if (!opts.signed) blockers.push("Sign");
  return blockers;
}

const CENSUS_LABEL = "Employee census";
