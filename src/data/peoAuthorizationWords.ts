import { PEO_AUTHORIZATION_PROFILE_HEADING } from "@/data/legalWording";
import { MARKET_WORDS, type QuoteLine } from "@/data/lines";
import type { PeoAuthorizationStateName } from "@/lib/peoAuthorizationsApi";

// The words the submission page's "Who may receive the packet" and New quote's step 4 (CRM-Q2.5, D-1783, D-1785) share, in one place.

/** Each state of the employer's say, as it is shown. */
export const STATE_WORDS: Record<PeoAuthorizationStateName, string> = {
  authorized: "May receive it",
  withdrawn: "Withdrawn by the employer",
  not_asked: "Not authorized",
};

/** The draft an advisor sends through Ask the prospect, naming no answers: the employer adds the PEO themselves. */
export const askToAddPeo = (peo: string) =>
  `We'd like to send your packet to ${peo}. If you agree, tick ${peo} under "${PEO_AUTHORIZATION_PROFILE_HEADING}" on your profile. Nothing goes to ${peo} until you do.`;

/** The same ask when no PEO is authorized yet: the employer picks from the listed ones. On a workers' comp search it says a carrier (ADR 0029). */
export const askToAddAnyPeo = (peos: readonly string[], line: QuoteLine = "peo") =>
  `We'd like to send your packet to ${MARKET_WORDS[line].a}. If you agree, tick one or more of ${peos.join(", ")} under "${PEO_AUTHORIZATION_PROFILE_HEADING}" on your profile. Nothing goes to ${MARKET_WORDS[line].a} until you do.`;
