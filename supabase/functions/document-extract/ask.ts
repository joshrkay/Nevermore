// Reads a document's free text with the model and turns the answer into candidate fields. The
// model is reached through the shared adapters, so AI_PROVIDER, the timeout, the retry and the
// redacted failure logs are the same as in chamber-extract. No Deno or network imports, so it is
// unit-tested with the frontend suite.

import type { AllowanceResult, Refusal } from "../_shared/ai/allowance.ts";
import type { AiErrorCode } from "../_shared/ai/errors.ts";
import { callModel, failureLogLine, failureResponse, type ModelDeps, type ModelResult, type ProviderAdapter } from "../_shared/ai/model.ts";
import { buildPromptText, shapeAiCandidates, type Candidate, type TextSection } from "./parse.ts";
import { SYSTEM_PROMPT } from "./schema.ts";

/** The model call was refused by a rate limit; the document stays ready to read later. */
export class AiQuotaError extends Error {
  readonly code = "rate_limited" as const;
}

/** AI can't be used right now (the daily ceiling is reached, or it isn't set up); the document stays ready to read later. */
export class AiUnavailableError extends Error {
  readonly code: "daily_cap" | "unavailable";
  constructor(message: string, code: "daily_cap" | "unavailable" = "unavailable") {
    super(message);
    this.code = code;
  }
}

/** The model was asked and failed (timed out, errored, or answered without the tool): the read failed. */
export class AiCallError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode) {
    super("AI extraction failed");
    this.code = code;
  }
}

/** What a budget refusal means for the document: a 429 is a rate limit, anything else is unavailable. */
export function refusalError(refusal: Refusal): Error {
  return refusal.status === 429 ? new AiQuotaError() : new AiUnavailableError(refusal.error, refusal.code === "daily_cap" ? "daily_cap" : "unavailable");
}

// A document read sends up to 20,000 characters of text and asks for a list of facts, a larger
// job than one chat message, so each attempt gets longer than chat's 20 seconds.
export const DOCUMENT_TIMEOUT_MS = 30_000;
// The answer is a list of up to 22 fields with short values; the adapter's default cap is too tight for it.
export const DOCUMENT_MAX_TOKENS = 4096;

export interface AskDeps {
  adapter: ProviderAdapter;
  model: Pick<ModelDeps, "fetch" | "sleep" | "now">;
  requestId: string;
  /** The intake the document belongs to, for the failure log. */
  sessionId?: string | null;
  log: (line: string) => void;
  /** Told how the model call went (attempts, latency), for the extraction event. */
  onResult?: (result: ModelResult) => void;
}

export async function askForCandidates(sections: TextSection[], deps: AskDeps): Promise<Candidate[]> {
  const result = await callModel(
    deps.adapter,
    {
      system: SYSTEM_PROMPT,
      // JSON.stringify keeps document text in a quoted slot so it reads as data, not instructions.
      user: `Document text: ${JSON.stringify(buildPromptText(sections))}`,
    },
    { ...deps.model, timeoutMs: DOCUMENT_TIMEOUT_MS },
  );
  deps.onResult?.(result);
  if (!result.ok) {
    // Fixed fields only: a provider's response can echo the document's text.
    deps.log(failureLogLine({ requestId: deps.requestId, provider: deps.adapter.name, result, sessionId: deps.sessionId }));
    if (result.kind === "rate_limited") throw new AiQuotaError();
    throw new AiCallError(failureResponse(result.kind).code);
  }
  if (!result.args) return [];
  return shapeAiCandidates(result.args.fields, sections);
}

/**
 * For an error that means "read this document again later": the status and message to answer with.
 * Null for any other error, which marks the document failed.
 */
export function retryLater(e: unknown): { status: 429 | 503; code: "rate_limited" | "daily_cap" | "unavailable"; message: string } | null {
  if (e instanceof AiQuotaError) return { status: 429, code: "rate_limited", message: "Rate limited, please try again shortly." };
  if (e instanceof AiUnavailableError) return { status: 503, code: e.code, message: e.message };
  return null;
}

export interface BudgetedAskDeps extends AskDeps {
  /** Spends one call from the caller's, their address's and the global budget, or says which refused. */
  checkBudget: () => Promise<AllowanceResult>;
}

/** Reads with the model only once the budget allows it, so a refused read never reaches the provider. */
export async function askWithinBudget(sections: TextSection[], deps: BudgetedAskDeps): Promise<Candidate[]> {
  const budget = await deps.checkBudget();
  if (!budget.allowed) throw refusalError(budget);
  return await askForCandidates(sections, deps);
}
