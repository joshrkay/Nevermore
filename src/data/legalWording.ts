// Legal wording the product shows and records, in one place (D-12), so counsel's text is one change. Today it holds the employer's authorization of
// each PEO (M-1.1, slice 6.6a). The database records an authorization with this wording and its version (public.set_peo_authorization) and refuses
// any other version (EA005); src/data/schemaSync.test.ts keeps the version equal to public.peo_authorization_version().
//
// Bump the version, here and in a migration, whenever the wording changes. Authorizations already signed stay in place; a PEO added later is
// authorized under the new wording (M-1.1).
//
// DRAFT: NOT LEGALLY REVIEWED. Every screen that shows this wording says so (WORDING_IS_DRAFT, DRAFT_WORDING_NOTICE) until counsel approves it
// (docs/LEGAL_REVIEW.md).

export const PEO_AUTHORIZATION_VERSION = "2026-11-draft-1";

/** True until counsel has approved the wording in this module. */
export const WORDING_IS_DRAFT = true;

/** Shown beside the wording on every screen that shows it while it is a draft (D-12). */
export const DRAFT_WORDING_NOTICE = "Draft wording, not yet reviewed by counsel";

/** The exact words recorded when the employer ticks a PEO's box. */
export function peoAuthorizationText(peo: string): string {
  return `I authorize ${peo} to receive my company's packet, including my employees' personal information, so that it can consider my company for a quote. I can withdraw this at any time.`;
}

/** The exact words recorded when the employer unticks a PEO's box. */
export function peoWithdrawalText(peo: string): string {
  return `I withdraw my authorization for ${peo} to receive my company's packet. Nothing more is to be sent to ${peo}.`;
}

/** The question on Certify & sign, after the certification (D-608). */
export const PEO_AUTHORIZATION_QUESTION = "Which PEOs may receive your packet?";

/** What the employer reads above the boxes. */
export const PEO_AUTHORIZATION_EXPLAINER =
  "Tick each PEO your advisor may send your packet to. Your packet includes your employees' personal information. You don't have to tick any: with none ticked, nothing is sent. You can add or withdraw a PEO at any time from your profile.";

/** The heading on the employer's profile (D-608). */
export const PEO_AUTHORIZATION_PROFILE_HEADING = "Who can receive my packet";
