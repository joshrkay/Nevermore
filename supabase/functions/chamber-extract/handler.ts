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
import { MAX_CONTEXT_CHARS, MAX_RECENT_CHARS, MAX_RECENT_MESSAGES } from "../_shared/chatContext.ts";
import { FIELD_STATUSES as CONTEXT_STATUSES, readyToCertify, unsettledFields, type CensusSummary } from "../_shared/followUp.ts";
import { INTAKE_SCHEMA, INTAKE_SCHEMA_VERSION } from "../_shared/intakeSchema.ts";
import { redactSensitive } from "../_shared/sensitive.ts";
import { shapeExtraction } from "./extraction.ts";
import { EXTRACT_TOOL, FIELD_QUESTION, PROMPT_VERSION, SYSTEM_PROMPT } from "./schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  // So the browser can read the request id off a failed response too.
  "Access-Control-Expose-Headers": "X-Request-Id",
};

// Caps keep a single request from running up AI costs. The context cap (_shared/chatContext.ts) covers
// everything the browser sends besides the message: the answers, their field statuses and the recent
// conversation (D22).
export const MAX_MESSAGE_CHARS = 2000;
export { MAX_CONTEXT_CHARS, MAX_RECENT_CHARS, MAX_RECENT_MESSAGES };
export { NEXT_FIELDS } from "./prompt.ts";

const SCHEMA_KEYS = new Set(Object.keys(INTAKE_SCHEMA.properties as object));

/** The recent conversation as sent, or why it isn't acceptable. Only the prospect's and Lenore's lines. */
function readRecent(raw: unknown): { ok: true; messages: { sender: "user" | "lenore"; text: string }[] } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, messages: [] };
  if (!Array.isArray(raw) || raw.length > MAX_RECENT_MESSAGES) return { ok: false, message: `recent must be a list of at most ${MAX_RECENT_MESSAGES} messages` };
  const messages: { sender: "user" | "lenore"; text: string }[] = [];
  for (const m of raw) {
    if (!isObject(m) || (m.sender !== "user" && m.sender !== "lenore") || typeof m.text !== "string" || m.text.length > MAX_RECENT_CHARS) {
      return { ok: false, message: `each recent message must be { sender: "user" | "lenore", text } with at most ${MAX_RECENT_CHARS} characters` };
    }
    // The browser removes them already; this keeps them out of the prompt whatever a client sends.
    messages.push({ sender: m.sender, text: redactSensitive(m.text) });
  }
  return { ok: true, messages };
}

/** What the browser says of the census (never its rows), or why it isn't acceptable. */
function readCensus(raw: unknown): { ok: true; census: CensusSummary } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, census: { rows: 0, workStates: false } };
  if (!isObject(raw) || !Number.isInteger(raw.rows) || (raw.rows as number) < 0 || (raw.rows as number) > 5000 || typeof raw.work_states !== "boolean") {
    return { ok: false, message: "census must be { rows, work_states }" };
  }
  return { ok: true, census: { rows: raw.rows as number, workStates: raw.work_states } };
}

/** Each field's status as sent, or why it isn't acceptable: known fields, known statuses. */
function readStatuses(raw: unknown): { ok: true; statuses: Record<string, string> } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, statuses: {} };
  if (!isObject(raw)) return { ok: false, message: "statuses must be an object" };
  for (const [k, v] of Object.entries(raw)) {
    if (!SCHEMA_KEYS.has(k) || typeof v !== "string" || !(CONTEXT_STATUSES as readonly string[]).includes(v)) {
      return { ok: false, message: "statuses must map intake fields to field statuses" };
    }
  }
  return { ok: true, statuses: raw as Record<string, string> };
}

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
    const { message, context, statuses: rawStatuses, recent: rawRecent, census: rawCensus, session_id: sessionId } = isObject(body) ? body : ({} as Record<string, unknown>);
    if (typeof message !== "string" || !message.trim()) {
      return await fail(aiError("bad_request", { message: "message is required" }));
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return await fail(aiError("bad_request", { status: 413, message: `message must be at most ${MAX_MESSAGE_CHARS} characters` }));
    }
    if (context !== undefined && context !== null && !isObject(context)) {
      return await fail(aiError("bad_request", { message: "context must be an object" }));
    }
    const statuses = readStatuses(rawStatuses);
    if (!statuses.ok) return await fail(aiError("bad_request", { message: statuses.message }));
    const recent = readRecent(rawRecent);
    if (!recent.ok) return await fail(aiError("bad_request", { message: recent.message }));
    const census = readCensus(rawCensus);
    if (!census.ok) return await fail(aiError("bad_request", { message: census.message }));
    const contextJson = context ? JSON.stringify(context) : "";
    const statusesJson = JSON.stringify(statuses.statuses);
    const recentJson = JSON.stringify(recent.messages);
    if (contextJson.length + statusesJson.length + recentJson.length > MAX_CONTEXT_CHARS) {
      return await fail(aiError("bad_request", { status: 413, message: "context too large" }));
    }
    // Optional for now, so a tab still running the previous front end keeps working; when given, it
    // must be the caller's intake.
    if (sessionId !== undefined && sessionId !== null && !(typeof sessionId === "string" && UUID.test(sessionId))) {
      return await fail(aiError("bad_request", { message: "session_id must be an intake id" }));
    }

    // 2. The provider must be set up.
    // A full answer for every field needs more than a provider's default reply budget (B-1.1).
    const chosen = selectAdapter(deps.env, EXTRACT_TOOL, { maxTokens: CHAT_MAX_TOKENS });
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
    if (!budget.allowed) return await fail(aiError(budget.code, { status: budget.status, message: budget.error }));

    // 5. Ask the model. JSON.stringify quotes and escapes what the prospect wrote so it can't break out of its slot.
    const answers = isObject(context) ? context : {};
    const unsettled = unsettledFields(answers, statuses.statuses, { exclude: CHAT_EXCLUDES, census: census.census });
    const next = unsettled.slice(0, NEXT_FIELDS);
    const ready = readyToCertify(answers, statuses.statuses, census.census);
    const userPrompt = [
      `Captured so far (answers): ${contextJson || "{}"}`,
      `Field statuses: ${statusesJson}`,
      `Not yet settled, most important first: ${next.length > 0 ? next.map((f) => `${f.key} (${f.label})`).join(", ") : "none"}`,
      `Ready to certify: ${ready ? "yes" : "no"}`,
      `Employee census: ${census.census.rows > 0 ? `uploaded, ${census.census.rows} rows` : "not uploaded"}`,
      `Recent conversation, oldest first: ${recentJson}`,
      `New user message: ${JSON.stringify(message)}`,
    ].join("\n\n");
    const result = await callModel(
      chosen.adapter,
      { system: SYSTEM_PROMPT, user: buildUserPrompt(message, parts, next) },
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
    // No reply of the model's own: ask about the next field this message didn't settle, or wrap up (US-2.3a).
    if (!shaped.reply) {
      const answered = new Set([...Object.keys(shaped.extracted), ...Object.keys(shaped.field_status)]);
      const ask = unsettled.find((f) => !answered.has(f.key));
      shaped.reply = ask ? `Thank you, I've noted that. ${FIELD_QUESTION[ask.key]}` : "Thank you. That is everything I need: you can review your intake on the Review tab.";
    }
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
