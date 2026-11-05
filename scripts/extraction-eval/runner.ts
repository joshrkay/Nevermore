// The extraction eval: replays each fixture's messages through the same code a chat message takes
// in production (the browser's redaction and context, chamber-extract's prompt, the shared provider
// adapter, the response shaping, then the browser's merge into the intake), scores the result and
// Lenore's replies, and compares them with the committed baseline. The model call is injected, so runner.test.ts runs the
// whole path against a stub; connectProvider picks the real provider, and run.ts wires in the file
// system and the process.

import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import { CHAT_FALLBACK_REPLY, chatRequestBody, createChatMessage, openingMessage, type ChatMessage } from "@/data/chat";
import { applyExtraction, transcriptExtraction, type IntakeState } from "@/data/provenance";
import { redactSensitive } from "@/data/sensitive";
import { callModel, type ModelRequest, type ModelResult } from "../../supabase/functions/_shared/ai/model.ts";
import { selectAdapter } from "../../supabase/functions/_shared/ai/providers.ts";
import { shapeExtraction } from "../../supabase/functions/chamber-extract/extraction.ts";
import { buildUserPrompt, unsettledForTurn } from "../../supabase/functions/chamber-extract/prompt.ts";
import { CHAT_MAX_TOKENS, EXTRACT_TOOL, PROMPT_VERSION, SYSTEM_PROMPT } from "../../supabase/functions/chamber-extract/schema.ts";
import { FIXTURES, type Fixture } from "./fixtures";
import { describeCell, diffBaseline, formatBaseline, formatTable, parseBaseline, scoreFixture, type Baseline, type Cells } from "./scoring";

export type ModelCall = (request: ModelRequest) => Promise<ModelResult>;

export type Connection =
  | { ok: true; provider: string; model: string; call: ModelCall }
  | { ok: false; problem: string };

/** The provider chamber-extract would use with this environment (AI_PROVIDER, its key, AI_MODEL), with its reply budget. */
export function connectProvider(env: (name: string) => string | undefined): Connection {
  const chosen = selectAdapter(env, EXTRACT_TOOL, { maxTokens: CHAT_MAX_TOKENS });
  if (!chosen.ok) return chosen;
  const { adapter } = chosen;
  // The adapter doesn't expose its model; the request it builds names it.
  const { body } = adapter.buildRequest({ system: "", user: "" });
  return {
    ok: true,
    provider: adapter.name,
    model: String((body as { model?: unknown }).model),
    call: (request) =>
      callModel(adapter, request, {
        fetch: (input, init) => fetch(input, init),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
      }),
  };
}

export interface FixtureRun {
  state: IntakeState;
  /** Lenore's own reply to each turn that got one, null where the model gave none. */
  replies: (string | null)[];
  /** Why the run stopped early, when a model call failed. */
  error: string | null;
}

/** Sends the fixture's messages one after another, carrying the intake forward as the Chamber does. */
export async function runFixture(fixture: Fixture, model: ModelCall): Promise<FixtureRun> {
  let state: IntakeState = { data: EMPTY_CHAMBER_DATA, provenance: {} };
  // The conversation so far, as the Chamber keeps it, from Lenore's opening line: each call carries its last few messages.
  const transcript: ChatMessage[] = [openingMessage()];
  const replies: (string | null)[] = [];
  for (const [i, turn] of fixture.turns.entries()) {
    // useLenoreChat.send: the model and the transcript only see the message with sensitive numbers removed.
    const text = redactSensitive(turn.message);
    const message = createChatMessage("user", text);
    transcript.push(message);
    // The request body crosses the network as JSON, and the handler reads it back with req.json(). The handler
    // removes sensitive numbers from the recent conversation again (readRecent), Lenore's lines included.
    const body = JSON.parse(JSON.stringify(chatRequestBody(message, state.data, state.provenance, transcript)));
    const recent = body.recent.map((m: { sender: "user" | "lenore"; text: string }) => ({ ...m, text: redactSensitive(m.text) }));
    const sent = { context: body.context, statuses: body.statuses, recent, census: { rows: body.census.rows, workStates: body.census.work_states } };
    const user = buildUserPrompt({ message: body.message, ...sent });

    const result = await model({ system: SYSTEM_PROMPT, user });
    if (!result.ok) {
      return { state, replies, error: `turn ${i + 1}: model call failed (${result.kind}, HTTP ${result.httpStatus ?? "-"})` };
    }
    // The tool call is forced, so the handler answers a reply without one as invalid_response (US-2.4a).
    if (!result.args) return { state, replies, error: `turn ${i + 1}: the model made no tool call (invalid_response)` };
    // What the handler returns, as the browser parses it.
    // As the handler does: the field Lenore was asking about is the first one not yet settled.
    const { stopping: _stopping, doubted_unknown: _doubted, ...shaped } = shapeExtraction(result.args, body.message, unsettledForTurn(sent)[0]?.key);
    const response = JSON.parse(JSON.stringify(shaped));
    // ChamberPage's onExtracted for a chat message.
    if (response.extracted) state = applyExtraction(state, response.extracted, transcriptExtraction(message, response));
    // Her own reply is what a reply check scores: the handler's fallback question, asked when there is none, never
    // follows a rule of the prompt's.
    const reply = typeof response.reply === "string" && response.reply.trim() ? response.reply : null;
    replies.push(reply);
    // useLenoreChat: her reply, or the fallback line when the answer has none.
    transcript.push(createChatMessage("lenore", reply?.trim() || CHAT_FALLBACK_REPLY));
  }
  return { state, replies, error: null };
}

/** Runs the fixtures in order (one at a time, to stay inside provider rate limits) and scores them. */
export async function runFixtures(fixtures: Fixture[], model: ModelCall): Promise<{ cells: Cells; errors: string[] }> {
  const cells: Cells = {};
  const errors: string[] = [];
  for (const fixture of fixtures) {
    const run = await runFixture(fixture, model);
    if (run.error) errors.push(`${fixture.id}: ${run.error}`);
    Object.assign(cells, scoreFixture(fixture, run.state, run.error, run.replies));
  }
  return { cells, errors };
}

// ---------- Command line ----------

const RECORD = "npm run eval:extraction -- --update-baseline";

export interface MainDeps {
  /** Arguments after the script name. */
  args: string[];
  env: (name: string) => string | undefined;
  log: (line: string) => void;
  /** Where the baseline file is, as messages name it. */
  baselinePath: string;
  /** The baseline file's text, or null when there is none. */
  readBaseline: () => string | null;
  writeBaseline: (text: string) => void;
  now: () => Date;
  /** Defaults to connectProvider; tests pass a stub. */
  connect?: (env: (name: string) => string | undefined) => Connection;
  fixtures?: Fixture[];
}

const USAGE = "Usage: npm run eval:extraction -- [--only <fixture-id>] [--update-baseline]";

/**
 * Runs the eval and returns the exit code: 0 clean, 1 no provider, a regression or a failed model
 * call against the baseline, 2 bad usage. With no baseline yet there is nothing to regress from, so
 * the run reports what it found and exits 0.
 */
export async function main(deps: MainDeps): Promise<number> {
  const { log, baselinePath } = deps;
  const all = deps.fixtures ?? FIXTURES;

  let update = false;
  let only: string | null = null;
  for (let i = 0; i < deps.args.length; i++) {
    const arg = deps.args[i];
    if (arg === "--update-baseline") update = true;
    else if (arg === "--only" && i + 1 < deps.args.length) only = deps.args[++i];
    else {
      log(`Unknown argument "${arg}". ${USAGE}`);
      return 2;
    }
  }
  const fixtures = only ? all.filter((f) => f.id === only) : all;
  if (only && fixtures.length === 0) {
    log(`No fixture "${only}". Fixtures: ${all.map((f) => f.id).join(", ")}`);
    return 2;
  }
  if (only && update) {
    log("--update-baseline records every fixture; run it without --only.");
    return 2;
  }

  const connection = (deps.connect ?? connectProvider)(deps.env);
  if (!connection.ok) {
    log(`Cannot run the extraction eval: ${connection.problem}.`);
    log("Set ANTHROPIC_API_KEY (Anthropic is the only AI provider; AI_PROVIDER may be left unset); AI_MODEL overrides the default model.");
    return 1;
  }

  // Read the baseline first, so a broken file fails before any provider calls are spent.
  let baseline: Baseline | null = null;
  const baselineText = deps.readBaseline();
  if (baselineText !== null && !update) {
    try {
      baseline = parseBaseline(baselineText);
    } catch (e) {
      log(`${baselinePath}: ${e instanceof Error ? e.message : String(e)}. Fix it, or re-record it with: ${RECORD}`);
      return 1;
    }
  }

  log(`Extraction eval: prompt ${PROMPT_VERSION}, ${connection.provider} ${connection.model}, ${fixtures.length} fixture(s)`);
  const { cells, errors } = await runFixtures(fixtures, connection.call);
  log("");
  for (const line of formatTable(cells)) log(line);

  if (errors.length) {
    log("");
    log("Model calls failed, so the run is incomplete:");
    for (const e of errors) log(`  ${e}`);
  }

  if (update) {
    if (errors.length) {
      log("Not recording a baseline from an incomplete run.");
      return 1;
    }
    const meta = { prompt_version: PROMPT_VERSION, provider: connection.provider, model: connection.model, recorded_at: deps.now().toISOString() };
    deps.writeBaseline(formatBaseline(meta, cells));
    log("");
    log(`Recorded ${baselinePath}. Commit it with the prompt change.`);
    return 0;
  }

  if (!baseline) {
    log("");
    log(`No baseline yet. Record one from this provider and model with: ${RECORD}`);
    return 0;
  }

  log("");
  log(`Baseline: prompt ${baseline.prompt_version}, ${baseline.provider} ${baseline.model}, recorded ${baseline.recorded_at}`);
  if (baseline.prompt_version !== PROMPT_VERSION) {
    log(`The prompt is now ${PROMPT_VERSION}. Review the changes below, then re-record the baseline with: ${RECORD}`);
  }
  if (baseline.provider !== connection.provider || baseline.model !== connection.model) {
    log("This run uses a different provider or model from the baseline, so differences may come from that.");
  }

  const diff = diffBaseline(baseline.cells, cells, only);
  const show = (k: string) => `  ${k}: ${describeCell(baseline!.cells[k])} -> ${describeCell(cells[k])}`;
  if (diff.fixed.length) {
    log(`Now passing (${diff.fixed.length}):`);
    for (const k of diff.fixed) log(show(k));
  }
  if (diff.added.length) {
    log(`New since the baseline (${diff.added.length}):`);
    for (const k of diff.added) log(`  ${k}: ${cells[k].pass ? "pass" : "FAIL"} ${describeCell(cells[k])}`);
  }
  if (diff.removed.length) {
    log(`No longer asserted (${diff.removed.length}): ${diff.removed.join(", ")}`);
  }
  if (diff.regressions.length) {
    log(`REGRESSIONS: ${diff.regressions.length} cell(s) passed in the baseline and fail now:`);
    for (const k of diff.regressions) log(show(k));
    return 1;
  }
  log(`No regressions against the baseline (${diff.unchanged} unchanged).`);
  return errors.length ? 1 : 0;
}
