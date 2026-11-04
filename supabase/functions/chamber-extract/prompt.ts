// The user turn the extraction model reads: the prospect's message and what the intake already holds, with
// each field's status, what is still unsettled, whether the intake is ready to certify, whether a census is in,
// and the recent conversation (D22, US-2.1b, US-2.3a). The handler and the extraction eval
// (scripts/extraction-eval) both build it here, so the eval measures the prompt production sends (B-1.4).
// Relative imports only, so it runs under Deno and Vitest alike.

import { readyToCertify, unsettledFields, type CensusSummary, type FieldInfo } from "../_shared/followUp.ts";

/** The request body's context as the prompt carries it; "" when there is none. The handler limits its length. */
export const serializeContext = (context: unknown): string => (context ? JSON.stringify(context) : "");

/** How many unsettled fields the prompt names, most important first. */
export const NEXT_FIELDS = 8;

// The census (the roster) comes only from an uploaded file, so chat never asks for it.
const CHAT_EXCLUDES: ReadonlySet<string> = new Set(["census"]);

export interface UserTurn {
  message: string;
  /** serializeContext of the answers; "" when there are none. */
  contextJson: string;
  answers: Record<string, unknown>;
  statuses: Record<string, string>;
  recent: readonly { sender: "user" | "lenore"; text: string }[];
  census: CensusSummary;
}

/** What is still to ask (every unsettled field chat can take, by rank) and whether the intake is ready to certify. */
export function followUp(turn: Pick<UserTurn, "answers" | "statuses" | "census">): { unsettled: FieldInfo[]; ready: boolean } {
  return {
    unsettled: unsettledFields(turn.answers, turn.statuses, { exclude: CHAT_EXCLUDES, census: turn.census }),
    ready: readyToCertify(turn.answers, turn.statuses, turn.census),
  };
}

/** The user turn. JSON.stringify quotes and escapes what the prospect wrote so it can't break out of its slot. */
export function buildUserPrompt(turn: UserTurn): string {
  const { unsettled, ready } = followUp(turn);
  const next = unsettled.slice(0, NEXT_FIELDS);
  return [
    `Captured so far (answers): ${turn.contextJson || "{}"}`,
    `Field statuses: ${JSON.stringify(turn.statuses)}`,
    `Not yet settled, most important first: ${next.length > 0 ? next.map((f) => `${f.key} (${f.label})`).join(", ") : "none"}`,
    `Ready to certify: ${ready ? "yes" : "no"}`,
    `Employee census: ${turn.census.rows > 0 ? `uploaded, ${turn.census.rows} rows` : "not uploaded"}`,
    `Recent conversation, oldest first: ${JSON.stringify(turn.recent)}`,
    `New user message: ${JSON.stringify(turn.message)}`,
  ].join("\n\n");
}

/** A turn from just a message and the answers, as the extraction eval's fixtures give it: no statuses, history or census. */
export const simpleTurn = (message: string, context?: Record<string, unknown> | null): UserTurn => ({
  message,
  contextJson: serializeContext(context),
  answers: context ?? {},
  statuses: {},
  recent: [],
  census: { rows: 0, workStates: false },
});

/**
 * The turn for a request body as the browser sends it (useLenoreChat), already read back from JSON: the extraction
 * eval builds its turns this way, so it sends what production does. The handler checks a body's parts before it
 * builds the same turn from them.
 */
export function turnFromBody(body: {
  message: string;
  context?: unknown;
  statuses?: Record<string, string>;
  recent?: { sender: "user" | "lenore"; text: string }[];
  census?: { rows: number; work_states: boolean };
}): UserTurn {
  const answers = typeof body.context === "object" && body.context !== null && !Array.isArray(body.context) ? (body.context as Record<string, unknown>) : {};
  return {
    message: body.message,
    contextJson: serializeContext(body.context),
    answers,
    statuses: body.statuses ?? {},
    recent: body.recent ?? [],
    census: body.census ? { rows: body.census.rows, workStates: body.census.work_states } : { rows: 0, workStates: false },
  };
}
