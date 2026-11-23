// Legal wording the product shows and records, in one place (D-12), so counsel's text is one change. Today it holds the employer's authorization of
// each PEO (M-1.1, slice 6.6a). The database records an authorization with this wording and its version (public.set_peo_authorization) and refuses
// any other version (EA005); src/data/schemaSync.test.ts keeps the version equal to public.peo_authorization_version().
//
// Bump the version, here and in a migration, whenever the wording changes. Authorizations already signed stay in place; a PEO added later is
// authorized under the new wording (M-1.1).
//
// DRAFT: NOT LEGALLY REVIEWED. Every screen that shows this wording says so (WORDING_IS_DRAFT, DRAFT_WORDING_NOTICE) until counsel approves it
// (docs/LEGAL_REVIEW.md).

import type { QuoteLine } from "@/data/lines";

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

/**
 * The same question and explainer for each line (ADR 0029): on a workers' comp intake the employer chooses among carriers, and is never asked about a PEO.
 * The words recorded with a tick (peoAuthorizationText, peoWithdrawalText) name the market itself and say neither word, so they are the same for every
 * line, under the one version. DRAFT: NOT LEGALLY REVIEWED, as the rest of this module.
 */
export const AUTHORIZATION_WORDING: Record<QuoteLine, { question: string; explainer: string; theOneYouTick: string; couldNotLoad: string }> = {
  peo: {
    question: PEO_AUTHORIZATION_QUESTION,
    explainer: PEO_AUTHORIZATION_EXPLAINER,
    theOneYouTick: "the PEO you tick",
    couldNotLoad: "We couldn't load the PEOs. Check your connection and try again.",
  },
  workers_comp: {
    question: "Which workers' comp carriers may receive your packet?",
    explainer:
      "Tick each carrier your advisor may send your packet to. Your packet includes your employees' personal information. You don't have to tick any: with none ticked, nothing is sent. You can add or withdraw a carrier at any time from your profile.",
    theOneYouTick: "the carrier you tick",
    couldNotLoad: "We couldn't load the carriers. Check your connection and try again.",
  },
};

/**
 * The line every message to a PEO carries, last in the fixed block under the advisor's note (M-2.1, D-12): the "line counsel requires", in draft. The
 * database writes it into the message (public.peo_send_notice, kept equal by schemaSync.test.ts), so the advisor can't edit it. No apostrophes: the
 * sync test reads the database's copy as one quoted string.
 */
export const PEO_SEND_NOTICE =
  "Draft wording: sent with the authorization of the employer, for this PEO alone to consider them for a quote. Please do not pass the link on.";

/**
 * The same line on a message to a carrier, on a workers' comp search (ADR 0029): the database writes it in place of the PEO's (public.carrier_send_notice,
 * kept equal by schemaSync.test.ts), so a carrier is never told the message was for a PEO. DRAFT: NOT LEGALLY REVIEWED. No apostrophes, as above.
 */
export const CARRIER_SEND_NOTICE =
  "Draft wording: sent with the authorization of the employer, for this carrier alone to consider them for a quote. Please do not pass the link on.";

/** The heading on the employer's profile (D-608). */
export const PEO_AUTHORIZATION_PROFILE_HEADING = "Who can receive my packet";

/** The heading on the intake's first screen at a firm's link, above what the firm will see (P-2.1, D-1744). */
export const FIRM_SEES_ANSWERS_HEADING = "Who will see your answers";

/**
 * What the employer reads on the first screen of an intake started at a firm's link, and what is recorded with their agreement (D-1744): the firm will see
 * the answers. Counsel's wording replaces this one (D-12). DRAFT: NOT LEGALLY REVIEWED.
 */
export function firmSeesAnswersText(firm: string): string {
  return `${firm} invited you, so ${firm} will see everything you enter in this intake: your answers, your employees' personal information and the documents you upload.`;
}

/**
 * What the employer reads before ending a firm's access to their intake, and the firm's name in it (CRM-P2.5, D-1714, D-1827). Counsel's wording replaces
 * this one (D-12). DRAFT: NOT LEGALLY REVIEWED.
 */
export function endFirmAccessText(firm: string): string {
  return `${firm} will no longer see your answers, your employees' personal information or your documents, and nothing more will be sent to a PEO for this intake. ${firm} keeps its own records of your company and of what it already sent, and can't undo this. You can invite a firm again later.`;
}
