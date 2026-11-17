// Production and evaluation deliver exactly the same shaped response and follow-up.
import { shapeExtraction } from "./extraction.ts";
import { shapeExtraAnswers } from "./extraQuestions.ts";
import { unsettledForTurn, workspaceForTurn, type UserTurn } from "./prompt.ts";
import { guardReply } from "./reply.ts";
import { FIELD_QUESTION } from "./schema.ts";

const CONTEXTUAL = /^(?:yes|no|yep|nope|yeah|sure|true|false|\d+(?:\.\d+)?)[.! ]*$/i;

export function shapeResponse(args: Record<string, unknown>, turn: UserTurn) {
  const unsettled = unsettledForTurn(turn);
  const asking = unsettled[0]?.key;
  const question = [...(turn.recent ?? [])].reverse().find((m) => m.sender === "lenore")?.text;
  // A bare yes/no or number cannot justify an unrelated field. If we cannot identify the
  // previous question, capture nothing and deliver the canonical question for clarification.
  const contextual = CONTEXTUAL.test(turn.message.trim());
  const contextualField = asking && question?.includes(FIELD_QUESTION[asking]) ? asking : null;
  const { stopping, doubted_unknown, ...shaped } = shapeExtraction(args, turn.message, asking);
  const rawReply = shaped.reply;
  let ambiguous = false;
  if (contextual) for (const key of Object.keys(shaped.extracted)) {
    if (key !== contextualField) {
      ambiguous = true;
      delete shaped.extracted[key];
      delete shaped.field_status[key];
      delete shaped.evidence[key];
      shaped.rejected.push({ path: key, reason: "requires an identifiable preceding question" });
    }
  }
  if (ambiguous) shaped.reply = null;
  const answered = new Set([
    ...Object.keys(shaped.extracted).filter((k) => shaped.field_status[k] !== "incomplete"),
    ...Object.entries(shaped.field_status).flatMap(([k, v]) => v === "unknown" ? [k] : []),
  ]);
  const ask = unsettled.find((f) => !answered.has(f.key));
  const guarded = guardReply(shaped.reply, ask ? FIELD_QUESTION[ask.key] : null, stopping, workspaceForTurn(turn));
  const questions = turn.extraQuestions ?? [];
  const extra = shapeExtraAnswers(args.extra_answers, contextual
    ? questions.filter((q) => question?.includes(q.text)) : questions, turn.message);
  return {
    response: { ...shaped, reply: guarded.reply, extra_answers: extra.answers },
    rawReply,
    doubted_unknown,
    guardReason: guarded.reason,
    next: ask?.key,
    refusedExtra: extra.refused,
  };
}
