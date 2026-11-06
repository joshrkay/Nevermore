// What Lenore says back, checked before it is sent (US-2.3a, QA F4). The handler uses it on every answer; the
// extraction eval and the tests read CLAIMS_COMPLETE from here, so "the reply says the intake is finished" means one
// thing everywhere. Relative imports only, so it runs under Deno and Vitest alike.

/**
 * A reply that tells the prospect the intake is finished: true only once nothing is left to ask (QA F4: "That's
 * everything The Manuscript needs" after two answers, with some 35 still to ask). Anchored to what is needed or to the
 * intake itself, so "that's all it measures" in an answer to the prospect's own question isn't one. The packet is the
 * Manuscript's name in what the prospect reads, so a claim about either counts.
 */
export const CLAIMS_COMPLETE =
  /\b(?:that(?:'|’)?s|that is) all (?:i|we|the manuscript|the packet|your packet) (?:need|needs|needed)\b|\beverything (?:i|we|the manuscript|the packet|your packet) (?:need|needs|needed)\b|\b(?:intake|manuscript|packet|interview) is (?:now )?(?:complete|done|finished)\b|\bnothing (?:more|else) (?:to ask|(?:i|we) need)\b/i;

/** How Lenore acknowledges an answer before her next question, when the model's reply is replaced or missing. */
export const ACKNOWLEDGE = "Thanks, got it.";
export const WRAP_UP_REPLY = "Thanks, that's everything I need. You can look over your intake on the Review tab.";
export const STOPPING_REPLY = "No problem. Your answers are saved, so come back any time to carry on, or check them on the Review tab.";

export type GuardReason = "claimed_complete" | "asked_nothing";

/**
 * Lenore's reply as sent. With a field still to ask about (`next`, its question) and the prospect not stopping, it
 * always asks something and never says the intake is finished: a reply claiming completion is replaced by the next
 * question, and one that asks nothing gets it added (so an explanation she gives is kept). With nothing left, or the
 * prospect stopping, the model's reply stands. No reply of the model's own: the next question, or the wrap-up.
 * `reason` says when the reply was changed.
 */
export function guardReply(reply: string | null, next: string | null, stopping: boolean): { reply: string; reason: GuardReason | null } {
  if (!reply) return { reply: !next ? WRAP_UP_REPLY : stopping ? STOPPING_REPLY : `${ACKNOWLEDGE} ${next}`, reason: null };
  if (!next || stopping) return { reply, reason: null };
  if (CLAIMS_COMPLETE.test(reply)) return { reply: `${ACKNOWLEDGE} ${next}`, reason: "claimed_complete" };
  if (!reply.includes("?")) return { reply: `${reply.trim()} ${next}`, reason: "asked_nothing" };
  return { reply, reason: null };
}
