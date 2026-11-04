// What Lenore's voice is told during a call (US-2.3b, D24), and the version of her voice prompt. The voice side
// only holds the conversation: what the prospect says goes through chamber-extract like typed chat (ADR 0001), and
// these updates tell it which fields are still open. The prompt is docs/prompts/voice-agent-v{VOICE_PROMPT_VERSION}.md,
// pasted into the ElevenLabs agent; src/data/voiceAgent.test.ts fingerprints it and this update's wording, so changing
// either needs a new version.
import { INTAKE_FIELDS } from "../../supabase/functions/_shared/intakeSchema.ts";
import { NEXT_FIELDS, unsettledForTurn } from "../../supabase/functions/chamber-extract/prompt.ts";
import type { ChamberData } from "./chamberTypes";
import { chatAnswers } from "./chat";
import { censusSummary, statusesOf } from "./followUp";
import type { ProvenanceMap } from "./provenance";

/** The version of Lenore's voice prompt this Chamber's updates are written for. */
export const VOICE_PROMPT_VERSION = 1;

const list = (labels: string[]) => (labels.length > 0 ? labels.join("; ") : "none");

/**
 * The intake update sent to Lenore's voice (`sendContextualUpdate`): the next fields to ask about, most important
 * first and as many as typed chat's prompt names, then the fields already settled, then whether a census is in.
 * Field labels only, never an answer. It uses chamber-extract's rule for what is unsettled (`unsettledForTurn`), so
 * voice and typed chat never disagree about what to ask next.
 */
export function voiceContextUpdate(data: ChamberData, provenance: ProvenanceMap): string {
  const census = censusSummary(data);
  const unsettled = unsettledForTurn({ context: chatAnswers(data), statuses: statusesOf(provenance), census });
  const open = new Set(unsettled.map((f) => f.key));
  const next = unsettled.slice(0, NEXT_FIELDS).map((f) => (f.required ? `${f.label} (required)` : f.label));
  // The census is a file, never asked for aloud: it has its own line.
  const settled = INTAKE_FIELDS.filter((f) => f.key !== "census" && !open.has(f.key)).map((f) => f.label);
  return [
    "Intake update. Field names only: an update never holds the prospect's answers.",
    `Ask about next, most important first: ${list(next)}`,
    `Already settled, never ask again: ${list(settled)}`,
    `Employee census: ${census.rows > 0 ? "uploaded" : "not uploaded"}`,
  ].join("\n");
}
