// The request handler for chamber-extract, with everything it touches passed in. index.ts wires in
// Deno and the real Supabase client; the tests wire in fakes. No remote imports, so it runs under
// Deno and Vitest alike.
//
// Order matters (US-2.4a): a request is checked before anything is spent on it, so a malformed,
// oversized or forged request never uses quota. Then the provider must be set up, the intake must be
// the caller's, the budget must allow the call, and only then is the model asked. Every signed-in call
// leaves one extraction event, and every answer carries the request id (body `request_id`, header
// X-Request-Id) and, when it fails, a code from _shared/ai/errors.ts.

import { checkAiBudget } from "../_shared/ai/budget.ts";
import { aiError, type AiErrorCode, type AiErrorReply } from "../_shared/ai/errors.ts";
import { recordAiEvent, type AiEvent, type EventWriter } from "../_shared/ai/events.ts";
import { callModel, failureLogLine, failureResponse, unexpectedErrorLine } from "../_shared/ai/model.ts";
import { selectAdapter } from "../_shared/ai/providers.ts";
import { emptyExtraction, shapeExtraction } from "./extraction.ts";
import { buildUserPrompt, serializeContext } from "./prompt.ts";
import { EXTRACT_TOOL, SYSTEM_PROMPT } from "./schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  // So the browser can read the request id off a failed response too.
  "Access-Control-Expose-Headers": "X-Request-Id",
};

// Caps keep a single request from running up AI costs.
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_CONTEXT_CHARS = 20000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result<T> = PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>;

/** The parts of the Supabase client this function uses. */
export interface SupabaseLike extends EventWriter {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null } }> };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Result<Record<string, unknown> | null> } };
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message?: string } | null }>;
  };
}

export interface HandlerDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers: Record<string, string> } }) => SupabaseLike;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  logError: (line: string) => void;
  newRequestId: () => string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  const requestId = deps.newRequestId();
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reply = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": requestId },
    });
  const refuse = (e: AiErrorReply) => reply({ error: e.message, code: e.code }, e.status);

  // Who is calling. A call with no signed-in user isn't recorded: there is no one to attribute it to,
  // and anyone could send them by the thousand. The publishable anon key is a valid JWT too, so require
  // an actual user.
  const supabaseUrl = deps.env("SUPABASE_URL")!;
  let supabase: SupabaseLike;
  let userId: string;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return refuse(aiError("unauthorized"));
    supabase = deps.createClient(supabaseUrl, deps.env("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return refuse(aiError("unauthorized"));
    userId = user.id;
  } catch (e) {
    deps.logError(unexpectedErrorLine(requestId, e));
    return refuse(aiError("internal"));
  }

  // Events are written with the service role; without it they can't be (and the budget refuses anyway).
  const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  const events: EventWriter | null = serviceRoleKey ? deps.createClient(supabaseUrl, serviceRoleKey) : null;
  const event: AiEvent = {
    requestId,
    functionName: "chamber-extract",
    userId,
    sessionId: null,
    httpStatus: 0,
    errorCode: null,
    promptVersion: PROMPT_VERSION,
    contractVersion: INTAKE_SCHEMA_VERSION,
  };
  const finish = async (body: Record<string, unknown>, status: number, code: AiErrorCode | null) => {
    event.httpStatus = status;
    event.errorCode = code;
    await recordAiEvent(events, event, deps.logError);
    return reply(body, status);
  };
  const fail = (e: AiErrorReply) => finish({ error: e.message, code: e.code }, e.status, e.code);

  try {
    // 1. The request itself, before anything is spent on it.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return await fail(aiError("bad_request", { message: "The request body must be JSON." }));
    }
    const { message, context, session_id: sessionId } = isObject(body) ? body : ({} as Record<string, unknown>);
    if (typeof message !== "string" || !message.trim()) {
      return await fail(aiError("bad_request", { message: "message is required" }));
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return await fail(aiError("bad_request", { status: 413, message: `message must be at most ${MAX_MESSAGE_CHARS} characters` }));
    }
    if (context !== undefined && context !== null && !isObject(context)) {
      return await fail(aiError("bad_request", { message: "context must be an object" }));
    }
    const contextJson = context ? JSON.stringify(context) : "";
    if (contextJson.length > MAX_CONTEXT_CHARS) {
      return await fail(aiError("bad_request", { status: 413, message: "context too large" }));
    }
    // Optional for now, so a tab still running the previous front end keeps working; when given, it
    // must be the caller's intake.
    if (sessionId !== undefined && sessionId !== null && !(typeof sessionId === "string" && UUID.test(sessionId))) {
      return await fail(aiError("bad_request", { message: "session_id must be an intake id" }));
    }

    // 2. The provider must be set up.
    const chosen = selectAdapter(deps.env, EXTRACT_TOOL);
    if (!chosen.ok) {
      deps.logError(`AI_CONFIG_MISSING: ${chosen.problem}`);
      return await fail(aiError("unavailable"));
    }
    event.provider = chosen.adapter.name;
    event.model = chosen.adapter.model;

    // 3. The intake must be the caller's. Row security lets an advisor read any intake, so the owner is
    // compared too.
    if (typeof sessionId === "string") {
      const { data: intake, error } = await supabase.from("chamber_sessions").select("id, user_id").eq("id", sessionId).maybeSingle();
      if (error) throw new Error("intake lookup failed");
      if (!intake || intake.user_id !== userId) return await fail(aiError("not_found", { message: "Intake not found" }));
      event.sessionId = sessionId;
    }

    // 4. Spend from the caller's, their address's and the global budget. The last two are
    // service-role only, so they use a separate client.
    const budget = await checkAiBudget({
      headers: req.headers,
      env: deps.env,
      user: supabase,
      createAdmin: (key) => deps.createClient(supabaseUrl, key),
      log: deps.logError,
    });
    if (!budget.allowed) return json({ error: budget.error }, budget.status);

    const { message, context } = await req.json();
    if (typeof message !== "string" || !message.trim()) {
      return json({ error: "message is required" }, 400);
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return json({ error: `message must be at most ${MAX_MESSAGE_CHARS} characters` }, 413);
    }
    const contextJson = serializeContext(context);
    if (contextJson.length > MAX_CONTEXT_CHARS) {
      return json({ error: "context too large" }, 413);
    }

    const result = await callModel(
      chosen.adapter,
      { system: SYSTEM_PROMPT, user: buildUserPrompt(message, contextJson) },
      { fetch: deps.fetch, sleep: deps.sleep, now: deps.now },
    );
    event.attempts = result.attempts;
    event.latencyMs = result.latencyMs;
    if (!result.ok) {
      deps.logError(failureLogLine({ requestId, provider: chosen.adapter.name, result, sessionId: event.sessionId }));
      return await fail(failureResponse(result.kind));
    }
    // The tool call is forced, so an answer without one is a broken answer, not "nothing to extract".
    if (!result.args) {
      deps.logError(`AI_NO_TOOL_CALL request=${requestId} session=${event.sessionId ?? "-"} provider=${chosen.adapter.name}`);
      return await fail(aiError("invalid_response"));
    }

    const shaped = shapeExtraction(result.args);
    event.fields = Object.keys(shaped.extracted);
    event.refusedPaths = shaped.rejected.map((issue) => issue.path);
    // Paths only: the refused values are the prospect's words.
    if (shaped.rejected.length > 0) {
      deps.logError(`EXTRACTION_REFUSED request=${requestId} session=${event.sessionId ?? "-"} paths=${event.refusedPaths.join(",")}`);
    }
    return await finish({ ...shaped }, 200, null);
  } catch (e) {
    deps.logError(unexpectedErrorLine(requestId, e));
    return await fail(aiError("internal"));
  }
}
