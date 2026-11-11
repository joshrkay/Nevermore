// What Lenore still needs and when the intake is ready to certify, in the browser (US-2.3a, D26, D27). The rules
// are supabase/functions/_shared/followUp.ts, which chamber-extract uses too, so the intake and Lenore agree.
import type { ChamberData } from "./chamberTypes";
import type { ChatMessage } from "./chat";
import type { ProvenanceMap } from "./provenance";
import { type CensusSummary } from "../../supabase/functions/_shared/followUp.ts";
import { certificationBlockingItems, NO_VERIFIED_FIELDS, requiredItems } from "./requiredItems";

export { CERTIFICATION_REQUIRED, isSettled, readyToCertify, unsettledFields, workspaceAnswersOpen } from "../../supabase/functions/_shared/followUp.ts";

/** Each captured field's status, as the follow-up rules read it. */
export const statusesOf = (provenance: ProvenanceMap): Record<string, string> =>
  Object.fromEntries(Object.entries(provenance).flatMap(([field, p]) => (p ? [[field, p.status]] : [])));

/** The census as a chat call may know it: how many rows, and whether any names a work state. No rows leave. */
export const censusSummary = (data: ChamberData): CensusSummary => ({
  rows: data.census.length,
  workStates: data.census.some((e) => Boolean(e.work_state?.trim())),
});

/**
 * Whether the intake is ready to certify: every answer certification needs is given, none in conflict or incomplete.
 * Read from B-2.2's required items with the fields an advisor verified, and from what the certification gate refuses
 * (certificationBlockingItems: a required answer in conflict blocks whoever verified it), the rules the Reckoning and
 * the database use, so Lenore and the badge never call an intake ready that certification would refuse.
 */
export const isReadyToCertify = (data: ChamberData, provenance: ProvenanceMap, verified: ReadonlySet<string> = NO_VERIFIED_FIELDS): boolean =>
  certificationBlockingItems(data, provenance, verified).length === 0 &&
  requiredItems(data, provenance, verified).every((item) => !item.required || item.state === "settled" || item.state === "unconfirmed");

/**
 * What Lenore says, once per intake, when it first becomes ready to certify (D29). It is recognised by its words,
 * as greetings are, so nothing more is stored. Then she carries on with the recommended questions, so it never says
 * she has everything: being ready to certify needs three answers, and most of the intake is still to ask (QA F4).
 */
export const READY_MESSAGE =
  "Good news: you've given all the answers you need to certify. Whenever you're ready, check them on the Review tab, then certify on the Certify & sign tab. Your packet gets stronger with more detail, so if you have a few more minutes, let's keep going with questions that help underwriters.";

/** Lenore's earlier words for READY_MESSAGE, still in older transcripts: they count as having said it. */
const EARLIER_READY_MESSAGES: readonly string[] = [
  "That's everything The Manuscript needs. You can review your answers and certify now on the Review tab. If you have a few more minutes, I have some questions that help underwriters.",
  "You've given every answer certification needs, so you can review and certify on the Review tab whenever you're ready. The Manuscript is stronger with more, so if you have a few more minutes, let's keep going with the questions that help underwriters.",
];

/** Whether Lenore has already said the intake is ready, in today's words or earlier ones. */
export const hasAnnouncedReady = (messages: readonly ChatMessage[]): boolean =>
  messages.some((m) => m.sender === "lenore" && (m.text === READY_MESSAGE || EARLIER_READY_MESSAGES.includes(m.text)));

/**
 * Whether to say it now: the intake has just become ready (it wasn't at `before`), Lenore isn't in the middle of an
 * answer (hers comes first), and she hasn't said it in this intake already.
 */
export const shouldAnnounceReady = (before: boolean, now: boolean, waitingForLenore: boolean, messages: readonly ChatMessage[]): boolean =>
  !before && now && !waitingForLenore && !hasAnnouncedReady(messages);
