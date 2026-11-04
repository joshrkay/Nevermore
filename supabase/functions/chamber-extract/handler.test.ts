import { describe, expect, it, vi } from "vitest";
import { handleRequest, type HandlerDeps, type SupabaseLike } from "./handler";
import { EXTRACT_TOOL, FIELD_TYPES, FIELDS, MAX_EVIDENCE_CHARS, PROMPT_VERSION, SYSTEM_PROMPT } from "./schema";
import { INTAKE_SCHEMA_VERSION } from "../_shared/intakeSchema";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const INTAKE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SOMEONE_ELSES_INTAKE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REQUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  IP_HASH_SECRET: "ip-secret",
  LOVABLE_API_KEY: "lovable-key",
};

// The gateway sends the tool's arguments as a JSON string, which the model can garble.
const gatewayArguments = (args: string) =>
  new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: args } }] } }] }), { status: 200 });
const gatewayReply = (args: Record<string, unknown>) => gatewayArguments(JSON.stringify(args));
const anthropicReply = (input: Record<string, unknown>, stopReason = "tool_use") =>
  new Response(JSON.stringify({ stop_reason: stopReason, content: [{ type: "tool_use", name: "extract_chamber_data", input }] }), { status: 200 });
const ANTHROPIC = { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "anthropic-key", LOVABLE_API_KEY: undefined };
const providerError = (status: number, body = "provider says no") => new Response(body, { status });

interface Setup {
  env?: Record<string, string | undefined>;
  /** `null` is a caller with no signed-in user, such as the bare anon key. */
  user?: { id: string } | null;
  quota?: { user?: boolean; ip?: boolean; global?: boolean };
  responses?: Array<Response | Error>;
  /** Who owns which intake, as row security shows it to the caller (an advisor sees every one). */
  intakes?: Record<string, string>;
  intakeLookupFails?: boolean;
  eventWriteFails?: boolean;
}

// Everything the handler touches is faked: Supabase, the AI provider, the clock and the log.
const setup = (opts: Setup = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const steps: string[] = [];
  const rpcCalls: Array<{ key: string; fn: string; args: Record<string, unknown> }> = [];
  const events: Array<{ key: string; row: Record<string, unknown> }> = [];
  const intakes = opts.intakes ?? { [INTAKE]: USER, [SOMEONE_ELSES_INTAKE]: OTHER_USER };
  const queue = [...(opts.responses ?? [gatewayReply({ reply: "Noted." })])];
  const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => {
    steps.push("model");
    const next = queue.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next instanceof Error) throw next;
    return next;
  });
  const allowed: Record<string, boolean> = {
    consume_ai_quota: opts.quota?.user ?? true,
    consume_ip_quota: opts.quota?.ip ?? true,
    consume_global_ai_budget: opts.quota?.global ?? true,
  };
  const createClient = vi.fn((_url: string, key: string): SupabaseLike => ({
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: USER } : opts.user } }) },
    rpc: async (fn, args) => {
      steps.push(fn);
      rpcCalls.push({ key, fn, args });
      return { data: allowed[fn], error: null };
    },
    from: (table) => ({
      select: () => ({
        eq: (_column, id) => ({
          maybeSingle: async () => {
            steps.push(`lookup:${table}`);
            if (opts.intakeLookupFails) return { data: null, error: { message: "boom" } };
            return { data: intakes[id] ? { id, user_id: intakes[id] } : null, error: null };
          },
        }),
      }),
      insert: async (row) => {
        expect(table).toBe("ai_extraction_events");
        events.push({ key, row });
        return { error: opts.eventWriteFails ? { code: "23514" } : null };
      },
    }),
  }));
  const deps: HandlerDeps = {
    env: (name) => env[name],
    createClient,
    fetch: fetchFn as unknown as typeof fetch,
    sleep: async () => {},
    now: () => 0,
    logError: (line) => logs.push(line),
    newRequestId: () => REQUEST,
  };
  const event = () => {
    expect(events, "exactly one event").toHaveLength(1);
    expect(events[0].key, "written with the service role").toBe("service-key");
    return events[0].row;
  };
  return { deps, logs, steps, rpcCalls, events, event, fetchFn, createClient };
};

const post = (body: unknown, headers: Record<string, string> = { Authorization: "Bearer jwt", "x-forwarded-for": "203.0.113.9" }) =>
  new Request("https://functions.test/chamber-extract", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });

const read = async (response: Response) => ({ status: response.status, body: await response.json(), headers: response.headers });

describe("chamber-extract handler: who may call it", () => {
  it("answers a preflight request without touching Supabase or the provider, and lets the browser read the request id", async () => {
    const t = setup();
    const response = await handleRequest(new Request("https://functions.test/chamber-extract", { method: "OPTIONS" }), t.deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe("X-Request-Id");
    expect(t.createClient).not.toHaveBeenCalled();
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("refuses a request with no Authorization header, and records nothing", async () => {
    const t = setup();
    const { status, body } = await read(await handleRequest(post({ message: "hi" }, {}), t.deps));
    expect(status).toBe(401);
    expect(body).toMatchObject({ code: "unauthorized", request_id: REQUEST });
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.events).toEqual([]);
  });

  it("refuses a caller with no signed-in user, such as the publishable anon key, and records nothing", async () => {
    const t = setup({ user: null });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(401);
    expect(body.code).toBe("unauthorized");
    expect(t.rpcCalls).toEqual([]);
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.events).toEqual([]);
  });
});

describe("chamber-extract handler: the request is checked before anything is spent", () => {
  it.each([
    ["no message", { session_id: INTAKE }, 400],
    ["a blank message", { message: "   ", session_id: INTAKE }, 400],
    ["a message over 2,000 characters", { message: "x".repeat(2001), session_id: INTAKE }, 413],
    ["a context that isn't an object", { message: "hi", context: "company_name=Acme", session_id: INTAKE }, 400],
    ["a context over 20,000 characters", { message: "hi", context: { key_challenges: "x".repeat(20001) }, session_id: INTAKE }, 413],
    ["an intake id that isn't one", { message: "hi", session_id: "not-an-id" }, 400],
    ["a body that isn't JSON", "{message: hi", 400],
    ["a body that isn't an object", ["hi"], 400],
  ] as const)("%s: refused as bad_request, with no quota spent and no lookup made", async (_label, body, status) => {
    const t = setup();
    const response = await read(await handleRequest(post(body), t.deps));
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ code: "bad_request", request_id: REQUEST });
    expect(t.steps).toEqual([]);
    expect(t.event()).toMatchObject({ outcome: "error", error_code: "bad_request", http_status: status, session_id: null, user_id: USER });
  });
});

describe("chamber-extract handler: the intake must be the caller's", () => {
  it("records the intake on the event once it has checked the caller owns it", async () => {
    const t = setup();
    const { status } = await read(await handleRequest(post({ message: "hi", session_id: INTAKE }), t.deps));
    expect(status).toBe(200);
    expect(t.steps).toEqual(["lookup:chamber_sessions", "consume_ai_quota", "consume_ip_quota", "consume_global_ai_budget", "model"]);
    expect(t.event()).toMatchObject({ session_id: INTAKE, outcome: "ok" });
  });

  it("refuses someone else's intake as not found, even for an advisor who can read it, and spends nothing", async () => {
    const t = setup();
    const { status, body } = await read(await handleRequest(post({ message: "hi", session_id: SOMEONE_ELSES_INTAKE }), t.deps));
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
    expect(t.steps).toEqual(["lookup:chamber_sessions"]);
    expect(t.event()).toMatchObject({ error_code: "not_found", session_id: null });
  });

  it("refuses an intake that doesn't exist, or that row security hides, the same way", async () => {
    const t = setup({ intakes: {} });
    const { status, body } = await read(await handleRequest(post({ message: "hi", session_id: INTAKE }), t.deps));
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("still answers a request with no intake id, from a tab running the previous front end", async () => {
    const t = setup();
    const { status } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(200);
    expect(t.steps).not.toContain("lookup:chamber_sessions");
    expect(t.event()).toMatchObject({ session_id: null, outcome: "ok" });
  });
});

describe("chamber-extract handler: configuration and budget", () => {
  it("logs the missing provider key, tells the browser only that Lenore is unavailable, and spends no budget", async () => {
    const t = setup({ env: { LOVABLE_API_KEY: undefined } });
    const { status, body } = await read(await handleRequest(post({ message: "hi", session_id: INTAKE }), t.deps));
    expect(status).toBe(503);
    expect(body.code).toBe("unavailable");
    expect(JSON.stringify(body)).not.toContain("LOVABLE_API_KEY");
    expect(t.logs).toEqual(["AI_CONFIG_MISSING: LOVABLE_API_KEY is not set"]);
    expect(t.rpcCalls).toEqual([]);
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.event()).toMatchObject({ error_code: "unavailable", http_status: 503 });
  });

  it("refuses when the service-role key or the IP hashing secret is missing", async () => {
    for (const missing of ["SUPABASE_SERVICE_ROLE_KEY", "IP_HASH_SECRET"]) {
      const t = setup({ env: { [missing]: undefined } });
      const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
      expect(status).toBe(503);
      expect(body.code).toBe("unavailable");
      expect(t.fetchFn).not.toHaveBeenCalled();
    }
  });

  it("can't record an event without the service-role key, and says so by request id", async () => {
    const t = setup({ env: { SUPABASE_SERVICE_ROLE_KEY: undefined } });
    await handleRequest(post({ message: "hi" }), t.deps);
    expect(t.events).toEqual([]);
    expect(t.logs).toContain(`AI_EVENT_NOT_RECORDED request=${REQUEST} reason=no_service_role`);
  });

  it("spends the user, IP and global budgets in that order, with limits that can be overridden", async () => {
    const t = setup({ env: { AI_IP_PER_MINUTE: "7", AI_IP_PER_DAY: "70", AI_GLOBAL_DAILY_CALLS: "700" } });
    await handleRequest(post({ message: "hi" }), t.deps);
    expect(t.rpcCalls.map((c) => c.fn)).toEqual(["consume_ai_quota", "consume_ip_quota", "consume_global_ai_budget"]);
    expect(t.rpcCalls[0]).toMatchObject({ key: "anon-key", args: { per_minute: 15, per_day: 300 } });
    expect(t.rpcCalls[1]).toMatchObject({ key: "service-key", args: { per_minute: 7, per_day: 70 } });
    expect(t.rpcCalls[1].args.p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(t.rpcCalls[2]).toMatchObject({ key: "service-key", args: { max_calls: 700 } });
  });

  it("refuses an over-quota user as rate_limited, before the provider is called", async () => {
    const t = setup({ quota: { user: false } });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(429);
    expect(body.code).toBe("rate_limited");
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.event()).toMatchObject({ error_code: "rate_limited", http_status: 429, attempts: null });
  });

  it("says Lenore is resting, as daily_cap, once the global ceiling is hit", async () => {
    const t = setup({ quota: { global: false } });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(503);
    expect(body).toMatchObject({ code: "daily_cap" });
    expect(body.error).toContain("resting");
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.event()).toMatchObject({ error_code: "daily_cap" });
  });
});

describe("chamber-extract handler: what is sent to the model", () => {
  it("sends the system prompt, the captured context and the quoted message to the provider with its key", async () => {
    const t = setup();
    await handleRequest(post({ message: 'We have 40 "full time" people', context: { company_name: "Acme" }, session_id: INTAKE }), t.deps);
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = t.fetchFn.mock.calls[0];
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer lovable-key");
    const sent = JSON.parse(init?.body as string);
    expect(sent.messages[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(sent.tools).toEqual([{ type: "function", function: EXTRACT_TOOL }]);
    expect(sent.tool_choice).toEqual({ type: "function", function: { name: "extract_chamber_data" } });
    expect(sent.messages[1].content).toBe(
      `Previous context (already captured data): {"company_name":"Acme"}\n\nNew user message: ${JSON.stringify('We have 40 "full time" people')}`,
    );
    expect(JSON.stringify(sent)).not.toContain(INTAKE);
  });

  it("sends just the quoted message when there is no context", async () => {
    const t = setup();
    await handleRequest(post({ message: "hello" }), t.deps);
    const sent = JSON.parse(t.fetchFn.mock.calls[0][1]?.body as string);
    expect(sent.messages[1].content).toBe('User message: "hello"');
  });

  it("goes to Anthropic when AI_PROVIDER says so", async () => {
    const t = setup({
      env: { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "anthropic-key", LOVABLE_API_KEY: undefined, AI_MODEL: "claude-haiku-5-5" },
      responses: [new Response(JSON.stringify({ content: [{ type: "tool_use", name: "extract_chamber_data", input: { company_name: "Acme" } }] }), { status: 200 })],
    });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(t.fetchFn.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
    const sent = JSON.parse(t.fetchFn.mock.calls[0][1]?.body as string);
    expect(sent.tool_choice).toEqual({ type: "tool", name: "extract_chamber_data" });
    expect(sent.tools[0].input_schema).toEqual(EXTRACT_TOOL.parameters);
    expect(status).toBe(200);
    expect(body.extracted).toEqual({ company_name: "Acme" });
    expect(t.event()).toMatchObject({ provider: "anthropic", model: "claude-haiku-5-5" });
  });

  // Each field reported costs a value, a status and a quote of up to MAX_EVIDENCE_CHARS. At 3 characters a
  // token (JSON keys and punctuation tokenize worse than prose), an answer to every field must still fit.
  it("gives Anthropic room for an answer that reports every field with its evidence, and a reply", async () => {
    const sample = (schema: unknown) => {
      switch ((schema as { type: string }).type) {
        case "integer": return 1_000_000;
        case "boolean": return false;
        case "array": return ["x".repeat(20), "x".repeat(20), "x".repeat(20)];
        default: return "x".repeat(40);
      }
    };
    const everyField = (value: (field: string) => unknown) => Object.fromEntries(FIELDS.map((field) => [field, value(field)]));
    const answer = {
      ...everyField((field) => sample(FIELD_TYPES[field])),
      field_status: everyField(() => "incomplete"),
      evidence: everyField(() => "x".repeat(MAX_EVIDENCE_CHARS)),
      corrected_fields: [],
      reply: "x".repeat(400),
    };
    const t = setup({ env: ANTHROPIC, responses: [anthropicReply({})] });
    await handleRequest(post({ message: "hi" }), t.deps);
    const sent = JSON.parse(t.fetchFn.mock.calls[0][1]?.body as string);
    expect(sent.max_tokens).toBeGreaterThanOrEqual(Math.ceil(JSON.stringify(answer).length / 3));
  });
});

describe("chamber-extract handler: the answer", () => {
  it("returns what the model extracted with its status, evidence, corrections, reply, the contract version and the request id", async () => {
    const t = setup({
      responses: [gatewayReply({
        employee_count: 45,
        field_status: { employee_count: "confirmed" },
        evidence: { employee_count: "actually it's 45 people" },
        corrected_fields: ["employee_count"],
        reply: "Thank you. And which states?",
      })],
    });
    const { status, body, headers } = await read(await handleRequest(post({ message: "actually it's 45 people", session_id: INTAKE }), t.deps));
    expect(status).toBe(200);
    expect(headers.get("X-Request-Id")).toBe(REQUEST);
    expect(body).toEqual({
      extracted: { employee_count: 45 },
      field_status: { employee_count: "confirmed" },
      evidence: { employee_count: "actually it's 45 people" },
      corrected_fields: ["employee_count"],
      reply: "Thank you. And which states?",
      rejected: [],
      prompt_version: PROMPT_VERSION,
      request_id: REQUEST,
    });
    expect(t.event()).toEqual({
      request_id: REQUEST,
      function_name: "chamber-extract",
      user_id: USER,
      session_id: INTAKE,
      document_id: null,
      outcome: "ok",
      error_code: null,
      http_status: 200,
      document_status: null,
      fields: ["employee_count"],
      refused_paths: [],
      prompt_version: PROMPT_VERSION,
      contract_version: INTAKE_SCHEMA_VERSION,
      provider: "lovable",
      model: "google/gemini-3-flash-preview",
      attempts: 1,
      latency_ms: 0,
    });
  });

  it("refuses an extracted value the intake schema doesn't accept, and logs and records its path but not the value", async () => {
    const t = setup({ responses: [gatewayReply({ company_name: "Acme", hq_state: "New York", reply: "Noted." })] });
    const { status, body } = await read(await handleRequest(post({ message: "we're Acme in New York", session_id: INTAKE }), t.deps));
    expect(status).toBe(200);
    expect(body.extracted).toEqual({ company_name: "Acme" });
    expect(body.rejected).toEqual([{ path: "hq_state", reason: "must be a US state or territory code such as CA" }]);
    expect(t.logs).toEqual([`EXTRACTION_REFUSED request=${REQUEST} session=${INTAKE} paths=hq_state`]);
    expect(t.event()).toMatchObject({ fields: ["company_name"], refused_paths: ["hq_state"] });
    expect(t.logs.join() + JSON.stringify(t.events)).not.toMatch(/New York|Acme/);
  });

  it("treats an answer with no tool call as invalid_response, not as 'nothing to extract'", async () => {
    const t = setup({ responses: [new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), { status: 200 })] });
    const { status, body } = await read(await handleRequest(post({ message: "hi", session_id: INTAKE }), t.deps));
    expect(status).toBe(502);
    expect(body).toMatchObject({ code: "invalid_response", request_id: REQUEST });
    expect(t.logs).toEqual([`AI_NO_TOOL_CALL request=${REQUEST} session=${INTAKE} provider=lovable`]);
    expect(t.event()).toMatchObject({ error_code: "invalid_response", attempts: 1 });
  });

  it("still answers when the event can't be written, and logs that it wasn't", async () => {
    const t = setup({ eventWriteFails: true });
    const { status } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(200);
    expect(t.logs).toEqual([`AI_EVENT_NOT_RECORDED request=${REQUEST} reason=23514`]);
  });
});

describe("chamber-extract handler: when the provider fails", () => {
  it("retries once on a provider 429 and then succeeds", async () => {
    const t = setup({ responses: [providerError(429), gatewayReply({ company_name: "Acme" })] });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(200);
    expect(body.extracted).toEqual({ company_name: "Acme" });
    expect(t.fetchFn).toHaveBeenCalledTimes(2);
    expect(t.event()).toMatchObject({ outcome: "ok", attempts: 2 });
  });

  it("passes a persistent rate limit on as rate_limited", async () => {
    const t = setup({ responses: [providerError(429), providerError(429)] });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(429);
    expect(body).toMatchObject({ code: "rate_limited" });
    expect(t.event()).toMatchObject({ error_code: "rate_limited", attempts: 2 });
  });

  it("gives a calm message and never logs, returns or records the provider's response body", async () => {
    const leak = "ACME-PAYROLL-SECRET";
    const t = setup({ responses: [providerError(500, `echoed: ${leak}`), providerError(500, `echoed: ${leak}`)] });
    const { status, body } = await read(await handleRequest(post({ message: "our payroll is 12345", session_id: INTAKE }), t.deps));
    expect(status).toBe(502);
    expect(body).toEqual({ error: "Lenore couldn't respond. Please try again.", code: "provider_error", request_id: REQUEST });
    expect(t.logs).toEqual([`AI_CALL_FAILED request=${REQUEST} session=${INTAKE} provider=lovable kind=provider_error status=500 attempts=2 latency_ms=0`]);
    expect(t.event()).toMatchObject({ error_code: "provider_error", http_status: 502, attempts: 2 });
    expect(JSON.stringify(body) + t.logs.join("\n") + JSON.stringify(t.events)).not.toMatch(new RegExp(`${leak}|12345`));
  });

  // Nothing is kept from a reply that can't be read: the browser offers Try again and Continue manually.
  it("answers tool arguments that aren't JSON with a 502 to try again, logging neither them nor the message", async () => {
    const t = setup({ responses: [gatewayArguments('{"company_name": "Acme')] });
    const { status, body } = await read(await handleRequest(post({ message: "we're Acme" }), t.deps));
    expect(status).toBe(502);
    expect(body).toEqual({ error: "Lenore's answer didn't come through. Please try again.", code: "invalid_response", request_id: REQUEST });
    expect(t.logs).toEqual([`AI_CALL_FAILED request=${REQUEST} session=- provider=lovable kind=invalid_response status=200 attempts=1 latency_ms=0`]);
  });

  // A reply cut off at its token cap has lost answers, and the tool input it holds may be partial.
  it("answers an Anthropic reply cut off at its token cap with a 502 to try again, keeping none of it", async () => {
    const t = setup({ env: ANTHROPIC, responses: [anthropicReply({ company_name: "Acme" }, "max_tokens")] });
    const { status, body } = await read(await handleRequest(post({ message: "we're Acme" }), t.deps));
    expect(status).toBe(502);
    expect(body).toEqual({ error: "Lenore's answer didn't come through. Please try again.", code: "invalid_response", request_id: REQUEST });
    expect(t.logs).toEqual([`AI_CALL_FAILED request=${REQUEST} session=- provider=anthropic kind=invalid_response status=200 attempts=1 latency_ms=0`]);
  });

  it("reports exhausted provider credits as unavailable, without mentioning billing", async () => {
    const t = setup({ responses: [providerError(402)] });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(503);
    expect(body.code).toBe("unavailable");
    expect(body.error).not.toMatch(/credit|billing/i);
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
  });

  it("answers a stalled provider with a 504 timeout instead of hanging", async () => {
    const t = setup();
    // A provider that never answers; it only gives up when the handler aborts the request.
    const stalled = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    t.deps.fetch = stalled as unknown as typeof fetch;
    vi.useFakeTimers();
    try {
      const pending = handleRequest(post({ message: "hi" }), t.deps);
      // The handler hashes the caller's address before it reaches the provider.
      await vi.waitFor(() => expect(stalled).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(20_000);
      const { status, body } = await read(await pending);
      expect(status).toBe(504);
      expect(body.code).toBe("timeout");
      expect(stalled).toHaveBeenCalledTimes(1);
      expect(t.event()).toMatchObject({ error_code: "timeout", attempts: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("chamber-extract handler: unexpected errors", () => {
  it("returns a generic 500 and logs only the error's class, never its message", async () => {
    const t = setup();
    t.deps.createClient = () => {
      throw new Error("boom with the prospect's text: SECRET-PROSPECT-TEXT");
    };
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Internal error", code: "internal", request_id: REQUEST });
    expect(t.logs).toEqual([`AI_UNEXPECTED_ERROR request=${REQUEST} error=Error`]);
  });

  it("records an internal error once the caller is known", async () => {
    const t = setup({ intakeLookupFails: true });
    const { status, body } = await read(await handleRequest(post({ message: "hi", session_id: INTAKE }), t.deps));
    expect(status).toBe(500);
    expect(body.code).toBe("internal");
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.event()).toMatchObject({ error_code: "internal", session_id: null });
  });
});
