// The user turn the extraction model reads (US-2.1b, US-2.3a): the answers captured so far, each field's status,
// the fields not yet settled (most important first), whether the intake is ready to certify and whether a census
// is in, the recent conversation and the prospect's new message. The handler and the extraction eval
// (scripts/extraction-eval) both build it here, so the eval measures the prompt production sends (B-1.4).
// Relative imports only, so it runs under Deno and Vitest alike.

import type { RecentMessage } from "../_shared/chatContext.ts";
import { readyToCertify, unsettledFields, type CensusSummary, type FieldInfo } from "../_shared/followUp.ts";

/** How many unsettled fields the prompt names, most important first. */
export const NEXT_FIELDS = 8;
// The census comes only from an uploaded file (D21), so chat never asks for it.
const CHAT_EXCLUDES: ReadonlySet<string> = new Set(["census"]);
const NO_CENSUS: CensusSummary = { rows: 0, workStates: false };

export interface UserTurn {
  message: string;
  /** The answers captured so far, as the request carried them (the census left out). */
  context?: unknown;
  /** Each field's status. */
  statuses?: Record<string, string>;
  /** The conversation before the message, oldest first: the prospect's and Lenore's lines only. */
  recent?: readonly RecentMessage[];
  /** What the browser says of the census, never its rows: how many there are, and whether any names a work state. */
  census?: CensusSummary;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The turn's context as the prompt carries it, each part serialised once. The handler caps their total length. */
export function serializeTurn(turn: Omit<UserTurn, "message">): { contextJson: string; statusesJson: string; recentJson: string } {
  return {
    contextJson: turn.context ? JSON.stringify(turn.context) : "",
    statusesJson: JSON.stringify(turn.statuses ?? {}),
    recentJson: JSON.stringify(turn.recent ?? []),
  };
}

/**
 * Every field chat could still ask about, most important first: not the census, and not States of operation when the
 * census names the states. The prompt names the first NEXT_FIELDS of them; the handler asks the next one itself when
 * the model gives no reply (US-2.3a).
 */
export function unsettledForTurn(turn: Omit<UserTurn, "message">): FieldInfo[] {
  const answers = isObject(turn.context) ? turn.context : {};
  return unsettledFields(answers, turn.statuses ?? {}, { exclude: CHAT_EXCLUDES, census: turn.census ?? NO_CENSUS });
}

export function buildUserPrompt(turn: UserTurn): string {
  const { contextJson, statusesJson, recentJson } = serializeTurn(turn);
  const answers = isObject(turn.context) ? turn.context : {};
  const census = turn.census ?? NO_CENSUS;
  const next = unsettledForTurn(turn).slice(0, NEXT_FIELDS);
  const ready = readyToCertify(answers, turn.statuses ?? {}, census);
  // JSON.stringify quotes and escapes what the prospect wrote so it can't break out of its slot.
  return [
    `Captured so far (answers): ${contextJson || "{}"}`,
    `Field statuses: ${statusesJson}`,
    `Not yet settled, most important first: ${next.length > 0 ? next.map((f) => `${f.key} (${f.label})`).join(", ") : "none"}`,
    `Ready to certify: ${ready ? "yes" : "no"}`,
    `Employee census: ${census.rows > 0 ? `uploaded, ${census.rows} rows` : "not uploaded"}`,
    `Recent conversation, oldest first: ${recentJson}`,
    `New user message: ${JSON.stringify(turn.message)}`,
  ].join("\n\n");
}
