// The privacy boundary for every caller, including clients that do not use the browser helpers.
import { INTAKE_SCHEMA } from "../_shared/intakeSchema.ts";
import { redactForModel } from "../_shared/sensitive.ts";
import type { UserTurn } from "./prompt.ts";

const keys = new Set(Object.keys(INTAKE_SCHEMA.properties as object));
const tableKeys: Record<string, string> = {
  owners_officers: "name", loss_history: "policy_year", medical_plans: "name", suta_rates: "state",
};
const clean = (value: unknown): unknown => {
  if (typeof value === "string") return redactForModel(value);
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").map(clean);
  return null;
};

export function prepareTurn(turn: UserTurn): UserTurn {
  const context = typeof turn.context === "object" && turn.context !== null && !Array.isArray(turn.context)
    ? turn.context as Record<string, unknown> : {};
  return {
    ...turn,
    message: redactForModel(turn.message),
    context: Object.fromEntries(Object.entries(context).flatMap(([key, value]) => {
      if (!keys.has(key) || key === "census") return [];
      // Preserve presence for workspace follow-up without sending entity names or tax IDs.
      if (key === "entities") return [[key, Array.isArray(value) ? value.map(() => ({})) : []]];
      if (key === "fein") {
        // Presence is useful to follow-up; the full identifier never is.
        return [[key, typeof value === "string" && value ? `[masked]${value.replace(/\D/g, "").slice(-4)}` : null]];
      }
      const column = tableKeys[key];
      if (column) return [[key, Array.isArray(value) ? value.map((row) => {
        const cell = typeof row === "object" && row !== null ? (row as Record<string, unknown>)[column] : undefined;
        return cell === undefined ? {} : { [column]: clean(cell) };
      }) : []]];
      return [[key, clean(value)]];
    })),
    recent: turn.recent?.map((m) => ({ ...m, text: redactForModel(m.text) })),
    extraQuestions: turn.extraQuestions?.map((q) => ({ ...q, peo: redactForModel(q.peo), text: redactForModel(q.text),
      ...(q.choices ? { choices: q.choices.map(redactForModel) } : {}) })),
  };
}
