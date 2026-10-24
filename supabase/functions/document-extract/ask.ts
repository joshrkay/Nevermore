// Reads a document's free text with the model and turns the answer into candidate fields. The
// model is reached through the shared adapters, so AI_PROVIDER, the timeout, the retry and the
// redacted failure logs are the same as in chamber-extract. No Deno or network imports, so it is
// unit-tested with the frontend suite.

import type { AllowanceResult, Refusal } from "../_shared/ai/allowance.ts";
import { callModel, failureLogLine, type ModelDeps, type ProviderAdapter } from "../_shared/ai/model.ts";
import { buildPromptText, shapeAiCandidates, type Candidate, type TextSection } from "./parse.ts";
import { SYSTEM_PROMPT } from "./schema.ts";

/** The model call was refused by a rate limit; the document stays ready to read later. */
export class AiQuotaError extends Error {}

/** AI can't be used right now (the daily ceiling is reached, or it isn't set up); the document stays ready to read later. */
export class AiUnavailableError extends Error {}

/** What a budget refusal means for the document: a 429 is a rate limit, anything else is unavailable. */
export function refusalError(refusal: Refusal): Error {
  return refusal.status === 429 ? new AiQuotaError() : new AiUnavailableError(refusal.error);
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
  log: (line: string) => void;
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
  if (!result.ok) {
    // Fixed fields only: a provider's response can echo the document's text.
    deps.log(failureLogLine({ requestId: deps.requestId, provider: deps.adapter.name, result }));
    if (result.kind === "rate_limited") throw new AiQuotaError();
    throw new Error("AI extraction failed");
  }
  if (!result.args) return [];
  return shapeAiCandidates(result.args.fields, sections);
}

/**
 * For an error that means "read this document again later": the status and message to answer with.
 * Null for any other error, which marks the document failed.
 */
export function retryLater(e: unknown): { status: 429 | 503; message: string } | null {
  if (e instanceof AiQuotaError) return { status: 429, message: "Rate limited, please try again shortly." };
  if (e instanceof AiUnavailableError) return { status: 503, message: e.message };
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
