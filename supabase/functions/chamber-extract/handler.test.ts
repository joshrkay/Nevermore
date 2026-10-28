import { describe, expect, it, vi } from "vitest";
import { handleRequest, type HandlerDeps, type SupabaseLike } from "./handler";
import { EXTRACT_TOOL, SYSTEM_PROMPT } from "./schema";

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  IP_HASH_SECRET: "ip-secret",
  LOVABLE_API_KEY: "lovable-key",
};

const gatewayReply = (args: Record<string, unknown>) =>
  new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }] }), { status: 200 });
const providerError = (status: number, body = "provider says no") => new Response(body, { status });

interface Setup {
  env?: Record<string, string | undefined>;
  /** `null` is a caller with no signed-in user, such as the bare anon key. */
  user?: unknown;
  quota?: { user?: boolean; ip?: boolean; global?: boolean };
  responses?: Array<Response | Error>;
}

// Everything the handler touches is faked: Supabase, the AI provider, the clock and the log.
const setup = (opts: Setup = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const rpcCalls: Array<{ key: string; fn: string; args: Record<string, unknown> }> = [];
  const queue = [...(opts.responses ?? [gatewayReply({})])];
  const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => {
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
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: "user-1" } : opts.user } }) },
    rpc: async (fn, args) => {
      rpcCalls.push({ key, fn, args });
      return { data: allowed[fn], error: null };
    },
  }));
  const deps: HandlerDeps = {
    env: (name) => env[name],
    createClient,
    fetch: fetchFn as unknown as typeof fetch,
    sleep: async () => {},
    now: () => 0,
    logError: (line) => logs.push(line),
    newRequestId: () => "req-1",
  };
  return { deps, logs, rpcCalls, fetchFn, createClient };
};

const post = (body: unknown, headers: Record<string, string> = { Authorization: "Bearer jwt", "x-forwarded-for": "203.0.113.9" }) =>
  new Request("https://functions.test/chamber-extract", { method: "POST", headers, body: JSON.stringify(body) });

const read = async (response: Response) => ({ status: response.status, body: await response.json() });

describe("chamber-extract handler: who may call it", () => {
  it("answers a preflight request without touching Supabase or the provider", async () => {
    const t = setup();
    const response = await handleRequest(new Request("https://functions.test/chamber-extract", { method: "OPTIONS" }), t.deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(t.createClient).not.toHaveBeenCalled();
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("refuses a request with no Authorization header", async () => {
    const t = setup();
    const { status } = await read(await handleRequest(post({ message: "hi" }, {}), t.deps));
    expect(status).toBe(401);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("refuses a caller with no signed-in user, such as the publishable anon key", async () => {
    const t = setup({ user: null });
    const { status } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(401);
    expect(t.rpcCalls).toEqual([]);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });
});

describe("chamber-extract handler: configuration and budget", () => {
  it("logs the missing provider key, tells the browser only that Lenore is unavailable, and spends no budget", async () => {
    const t = setup({ env: { LOVABLE_API_KEY: undefined } });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(503);
    expect(JSON.stringify(body)).not.toContain("LOVABLE_API_KEY");
    expect(t.logs).toEqual(["AI_CONFIG_MISSING: LOVABLE_API_KEY is not set"]);
    expect(t.rpcCalls).toEqual([]);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("refuses when the service-role key or the IP hashing secret is missing", async () => {
    for (const missing of ["SUPABASE_SERVICE_ROLE_KEY", "IP_HASH_SECRET"]) {
      const t = setup({ env: { [missing]: undefined } });
      const { status } = await read(await handleRequest(post({ message: "hi" }), t.deps));
      expect(status).toBe(503);
      expect(t.fetchFn).not.toHaveBeenCalled();
    }
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

  it("refuses an over-quota user with a 429, before the provider is called", async () => {
    const t = setup({ quota: { user: false } });
    const { status } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(429);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("says Lenore is resting once the global ceiling is hit", async () => {
    const t = setup({ quota: { global: false } });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(503);
    expect(body.error).toContain("resting");
    expect(t.fetchFn).not.toHaveBeenCalled();
  });
});

describe("chamber-extract handler: the request", () => {
  it("rejects a missing or blank message, and one that is too long", async () => {
    const t = setup();
    expect((await read(await handleRequest(post({}), t.deps))).status).toBe(400);
    expect((await read(await handleRequest(post({ message: "   " }), t.deps))).status).toBe(400);
    expect((await read(await handleRequest(post({ message: "x".repeat(2001) }), t.deps))).status).toBe(413);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("rejects a context that is too large", async () => {
    const t = setup();
    const { status } = await read(await handleRequest(post({ message: "hi", context: { key_challenges: "x".repeat(20001) } }), t.deps));
    expect(status).toBe(413);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("sends the system prompt, the captured context and the quoted message to the provider with its key", async () => {
    const t = setup();
    await handleRequest(post({ message: 'We have 40 "full time" people', context: { company_name: "Acme" } }), t.deps);
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
  });

  it("sends just the quoted message when there is no context", async () => {
    const t = setup();
    await handleRequest(post({ message: "hello" }), t.deps);
    const sent = JSON.parse(t.fetchFn.mock.calls[0][1]?.body as string);
    expect(sent.messages[1].content).toBe('User message: "hello"');
  });

  it("goes to Anthropic when AI_PROVIDER says so", async () => {
    const t = setup({
      env: { AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "anthropic-key", LOVABLE_API_KEY: undefined },
      responses: [new Response(JSON.stringify({ content: [{ type: "tool_use", name: "extract_chamber_data", input: { company_name: "Acme" } }] }), { status: 200 })],
    });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(t.fetchFn.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
    const sent = JSON.parse(t.fetchFn.mock.calls[0][1]?.body as string);
    expect(sent.tool_choice).toEqual({ type: "tool", name: "extract_chamber_data" });
    expect(sent.tools[0].input_schema).toEqual(EXTRACT_TOOL.parameters);
    expect(status).toBe(200);
    expect(body.extracted).toEqual({ company_name: "Acme" });
  });
});

describe("chamber-extract handler: the response", () => {
  it("returns what the model extracted with its status, evidence, corrections and reply", async () => {
    const t = setup({
      responses: [gatewayReply({
        employee_count: 45,
        field_status: { employee_count: "confirmed" },
        evidence: { employee_count: "actually it's 45 people" },
        corrected_fields: ["employee_count"],
        reply: "Thank you. And which states?",
      })],
    });
    const { status, body } = await read(await handleRequest(post({ message: "actually it's 45 people" }), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({
      extracted: { employee_count: 45 },
      field_status: { employee_count: "confirmed" },
      evidence: { employee_count: "actually it's 45 people" },
      corrected_fields: ["employee_count"],
      reply: "Thank you. And which states?",
    });
  });

  it("returns nothing extracted and no reply when the model made no tool call", async () => {
    const t = setup({ responses: [new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), { status: 200 })] });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ extracted: {}, field_status: {}, evidence: {}, corrected_fields: [], reply: null });
  });
});

describe("chamber-extract handler: when the provider fails", () => {
  it("retries once on a provider 429 and then succeeds", async () => {
    const t = setup({ responses: [providerError(429), gatewayReply({ company_name: "Acme" })] });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(200);
    expect(body.extracted).toEqual({ company_name: "Acme" });
    expect(t.fetchFn).toHaveBeenCalledTimes(2);
  });

  it("passes a persistent rate limit on as a 429, which the browser shows as 'try again shortly'", async () => {
    const t = setup({ responses: [providerError(429), providerError(429)] });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(429);
    expect(body.error).toContain("Rate limited");
  });

  it("gives a calm message and never logs or returns the provider's response body", async () => {
    const leak = "ACME-PAYROLL-SECRET";
    const t = setup({ responses: [providerError(500, `echoed: ${leak}`), providerError(500, `echoed: ${leak}`)] });
    const response = await handleRequest(post({ message: "our payroll is 12345" }), t.deps);
    const { status, body } = await read(response);
    expect(status).toBe(502);
    expect(body.error).toBe("Lenore couldn't respond. Please try again.");
    expect(t.logs).toEqual(["AI_CALL_FAILED request=req-1 provider=lovable kind=provider_error status=500 attempts=2 latency_ms=0"]);
    expect(JSON.stringify(body) + t.logs.join("\n")).not.toContain(leak);
  });

  it("reports exhausted provider credits as unavailable, without mentioning billing", async () => {
    const t = setup({ responses: [providerError(402)] });
    const { status, body } = await read(await handleRequest(post({ message: "hi" }), t.deps));
    expect(status).toBe(503);
    expect(body.error).not.toMatch(/credit|billing/i);
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
  });

  it("answers a stalled provider with a 504 instead of hanging", async () => {
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
      const { status } = await read(await pending);
      expect(status).toBe(504);
      expect(stalled).toHaveBeenCalledTimes(1);
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
    expect(body).toEqual({ error: "Internal error" });
    expect(t.logs).toEqual(["AI_UNEXPECTED_ERROR request=req-1 error=Error"]);
  });
});
