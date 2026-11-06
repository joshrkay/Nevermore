import { describe, expect, it, vi } from "vitest";
import { handleDocumentRequest, MAX_REQUEST_BYTES, type DocumentClient, type DocumentHandlerDeps } from "./handler";
import type { AskModel, Outcome } from "./read";
import { PROMPT_VERSION } from "./schema";
import { INTAKE_SCHEMA_VERSION } from "../_shared/intakeSchema";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const INTAKE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOC = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const REQUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-11-03T12:00:00.000Z";
// Words from the document, which must never reach a log, an event or an answer.
const SECRET = "Acme Holdings pays Pinnacle Mutual 18400";

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  IP_HASH_SECRET: "ip-secret",
  ANTHROPIC_API_KEY: "anthropic-key",
};

// Anthropic's Messages API answers with the forced tool's input (decision D11: the only provider).
const anthropicReply = (input: Record<string, unknown>) =>
  new Response(JSON.stringify({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "report_document_fields", input }] }), { status: 200 });

type Reader = (bytes: Uint8Array, fileName: string, ask: AskModel) => Promise<Outcome>;
// A text document: the reader asks the model about its one section.
const asksTheModel: Reader = async (_bytes, _name, ask) => ({ status: "extracted", candidates: await ask([{ label: "Page 1", text: SECRET }]) });
// A census sheet: read by header, so the model is never asked.
const readsACensus: Reader = async () => ({
  status: "extracted",
  candidates: [
    { field: "census", value: [{ first_name: "Ann" }], location: "CSV, rows 2–3" },
    { field: "employee_count", value: 1, location: "CSV, rows 2–3" },
  ],
});

interface Setup {
  env?: Record<string, string | undefined>;
  user?: { id: string } | null;
  doc?: Record<string, unknown> | null;
  quota?: { user?: boolean; global?: boolean };
  responses?: Array<Response | Error>;
  reader?: Reader;
}

const setup = (opts: Setup = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const steps: string[] = [];
  const updates: Record<string, unknown>[] = [];
  const events: Array<{ key: string; row: Record<string, unknown> }> = [];
  const doc = opts.doc === undefined
    ? { id: DOC, user_id: USER, session_id: INTAKE, file_name: "benefits.pdf", storage_path: `${USER}/${INTAKE}/benefits.pdf`, size_bytes: 1000, status: "uploaded", category: "benefits_summary", file_sha256: null, scan_verdict: "clean" }
    : opts.doc;
  const queue = [...(opts.responses ?? [anthropicReply({ fields: [{ field: "current_carrier", value: "Pinnacle Mutual", section: 1 }] })])];
  const fetchFn = vi.fn(async () => {
    steps.push("model");
    const next = queue.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next instanceof Error) throw next;
    return next;
  });
  const allowed: Record<string, boolean> = {
    consume_ai_quota: opts.quota?.user ?? true,
    consume_ip_quota: true,
    consume_global_ai_budget: opts.quota?.global ?? true,
  };
  const createClient = vi.fn((_url: string, key: string): DocumentClient => ({
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: USER } : opts.user } }) },
    rpc: async (fn) => {
      steps.push(fn);
      return { data: allowed[fn], error: null };
    },
    from: (table) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "documents" ? doc : null, error: null }) }) }),
      update: (values) => ({
        eq: async () => {
          updates.push(values);
          return { error: null };
        },
      }),
      insert: async (row) => {
        events.push({ key, row });
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        download: async () => {
          steps.push("download");
          const bytes = new TextEncoder().encode(SECRET);
          // The test environment's Blob lacks arrayBuffer(); the handler needs only these two.
          return { data: { size: bytes.length, arrayBuffer: async () => bytes.buffer } as unknown as Blob, error: null };
        },
      }),
    },
  }));
  const readDocument = vi.fn(opts.reader ?? asksTheModel);
  const deps: DocumentHandlerDeps = {
    env: (name) => env[name],
    createClient,
    readDocument,
    fetch: fetchFn as unknown as typeof fetch,
    sleep: async () => {},
    now: () => 0,
    timestamp: () => NOW,
    logError: (line) => logs.push(line),
    newRequestId: () => REQUEST,
  };
  const event = () => {
    expect(events, "exactly one event").toHaveLength(1);
    expect(events[0].key).toBe("service-key");
    return events[0].row;
  };
  const finalStatus = () => updates.filter((u) => "status" in u).at(-1)?.status;
  return { deps, logs, steps, updates, events, event, finalStatus, fetchFn, readDocument };
};

const post = (body: unknown, headers: Record<string, string> = { Authorization: "Bearer jwt", "x-forwarded-for": "203.0.113.9" }) =>
  new Request("https://functions.test/document-extract", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });

const read = async (response: Response) => ({ status: response.status, body: await response.json(), headers: response.headers });

describe("document-extract handler: who may call it", () => {
  it("answers a preflight request without touching Supabase", async () => {
    const t = setup();
    const response = await handleDocumentRequest(new Request("https://functions.test/document-extract", { method: "OPTIONS" }), t.deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe("X-Request-Id");
    expect(t.events).toEqual([]);
  });

  it("refuses a request with no Authorization header, and records nothing", async () => {
    const t = setup();
    const { status, body } = await read(await handleDocumentRequest(post({ document_id: DOC }, {}), t.deps));
    expect(status).toBe(401);
    expect(body).toMatchObject({ code: "unauthorized", request_id: REQUEST });
    expect(t.events).toEqual([]);
    expect(t.readDocument).not.toHaveBeenCalled();
  });

  it("refuses a caller with no signed-in user, and records nothing", async () => {
    const t = setup({ user: null });
    const { status, body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(status).toBe(401);
    expect(body.code).toBe("unauthorized");
    expect(t.events).toEqual([]);
    expect(t.updates).toEqual([]);
  });
});

describe("document-extract handler: the request", () => {
  it.each([
    ["no document id", {}],
    ["a document id that isn't one", { document_id: "doc-1" }],
    ["a body that isn't JSON", "{document_id:"],
  ] as const)("%s: refused as bad_request, with nothing read or spent", async (_label, body) => {
    const t = setup();
    const { status, body: answer } = await read(await handleDocumentRequest(post(body), t.deps));
    expect(status).toBe(400);
    expect(answer).toMatchObject({ code: "bad_request", request_id: REQUEST });
    expect(t.steps).toEqual([]);
    expect(t.event()).toMatchObject({ function_name: "document-extract", error_code: "bad_request", user_id: USER, document_id: null });
  });

  it("refuses a body over the request limit as too large, while reading it, with nothing read or spent", async () => {
    const t = setup();
    const { status, body: answer } = await read(await handleDocumentRequest(post({ document_id: DOC, padding: "x".repeat(MAX_REQUEST_BYTES) }), t.deps));
    expect(status).toBe(413);
    expect(answer).toMatchObject({ code: "bad_request", request_id: REQUEST });
    expect(t.steps).toEqual([]);
    expect(t.readDocument).not.toHaveBeenCalled();
  });

  it.each([
    ["a document that doesn't exist", null],
    ["someone else's document, which an advisor can see", { id: DOC, user_id: OTHER_USER, session_id: INTAKE }],
    ["a document not attached to an intake", { id: DOC, user_id: USER, session_id: null }],
  ] as const)("%s: not found, and nothing changes", async (_label, doc) => {
    const t = setup({ doc });
    const { status, body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
    expect(t.updates).toEqual([]);
    expect(t.steps).toEqual([]);
    expect(t.event()).toMatchObject({ error_code: "not_found", session_id: null, document_id: null });
  });
});

describe("document-extract handler: files whose malware scan hasn't passed", () => {
  it.each(["pending", "infected", "failed", undefined])("never reads a %s file, and leaves its row as it is", async (verdict) => {
    const t = setup({ doc: { id: DOC, user_id: USER, session_id: INTAKE, file_name: "a.pdf", storage_path: "p", size_bytes: 10, status: "uploaded", category: "other", scan_verdict: verdict } });
    const { status, body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(status).toBe(409);
    expect(body.code).toBe("not_found");
    expect(t.steps).toEqual([]);
    expect(t.updates).toEqual([]);
    expect(t.event()).toMatchObject({ error_code: "not_found", document_id: DOC });
  });

  it("reads a file recorded as skipped (no scanner configured)", async () => {
    const t = setup({ reader: readsACensus, doc: { id: DOC, user_id: USER, session_id: INTAKE, file_name: "c.csv", storage_path: "p", size_bytes: 10, category: "other", scan_verdict: "skipped" } });
    expect((await handleDocumentRequest(post({ document_id: DOC }), t.deps)).status).toBe(200);
    expect(t.steps).toContain("download");
  });
});

describe("document-extract handler: reading", () => {
  it("reads a census by its headers without the model, spends no AI budget, and records the fields it proposes", async () => {
    const t = setup({ reader: readsACensus, doc: { id: DOC, user_id: USER, session_id: INTAKE, file_name: "census.csv", storage_path: "p", size_bytes: 10, category: "other", file_sha256: null, scan_verdict: "clean" } });
    const { status, body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ status: "extracted", request_id: REQUEST });
    expect(t.steps).toEqual(["download"]);
    // A census found in a file filed as Other is filed as a census.
    expect(t.updates.at(-1)).toMatchObject({ status: "extracted", category: "employee_census", extraction: { extracted_at: NOW } });
    expect(t.event()).toMatchObject({
      outcome: "ok", session_id: INTAKE, document_id: DOC, document_status: "extracted",
      fields: ["census", "employee_count"], provider: null, attempts: null,
      prompt_version: PROMPT_VERSION, contract_version: INTAKE_SCHEMA_VERSION,
    });
  });

  it("asks the model about free text only once the budget allows, and records how the call went", async () => {
    const t = setup();
    const { status } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(status).toBe(200);
    expect(t.steps).toEqual(["download", "consume_ai_quota", "consume_ip_quota", "consume_global_ai_budget", "model"]);
    expect(t.updates[0]).toEqual({ status: "processing", processing_started_at: NOW });
    expect(t.event()).toMatchObject({
      outcome: "ok", document_status: "extracted", fields: ["current_carrier"],
      provider: "anthropic", model: "claude-haiku-5-5", attempts: 1, latency_ms: 0,
    });
  });

  it("files a read with nothing in it as no_data", async () => {
    const t = setup({ responses: [anthropicReply({ fields: [] })] });
    const { body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(body.status).toBe("no_data");
    expect(t.event()).toMatchObject({ outcome: "ok", document_status: "no_data", fields: [] });
  });

  it("doesn't download a file that is too large to read", async () => {
    const t = setup({ doc: { id: DOC, user_id: USER, session_id: INTAKE, file_name: "big.pdf", storage_path: "p", size_bytes: 50 * 1024 * 1024, category: "other", scan_verdict: "clean" } });
    const { body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(body.status).toBe("too_large");
    expect(t.steps).toEqual([]);
    expect(t.event()).toMatchObject({ outcome: "ok", document_status: "too_large" });
  });
});

describe("document-extract handler: reading later", () => {
  it.each([
    ["the caller's rate limit", 429, "rate_limited", { quota: { user: false } }],
    ["the daily ceiling", 503, "daily_cap", { quota: { global: false } }],
    ["a missing provider key", 503, "unavailable", { env: { ANTHROPIC_API_KEY: undefined } }],
  ] as const)("%s: leaves the document ready to read again, answers %i %s, and never asks the model", async (_label, status, code, opts) => {
    const t = setup(opts);
    const { status: answered, body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(answered).toBe(status);
    expect(body).toMatchObject({ code, request_id: REQUEST });
    expect(t.finalStatus()).toBe("uploaded");
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.event()).toMatchObject({ outcome: "error", error_code: code, http_status: status, document_status: "uploaded", session_id: INTAKE });
  });
});

describe("document-extract handler: failed reads", () => {
  it("marks the document failed when the model fails, and says why in the answer and the event", async () => {
    const t = setup({ responses: [new Response(`echoed: ${SECRET}`, { status: 500 }), new Response(`echoed: ${SECRET}`, { status: 500 })] });
    const { status, body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ status: "failed", code: "provider_error", request_id: REQUEST });
    expect(t.finalStatus()).toBe("failed");
    expect(t.logs).toEqual([`AI_CALL_FAILED request=${REQUEST} session=${INTAKE} provider=anthropic kind=provider_error status=500 attempts=2 latency_ms=0`]);
    expect(t.event()).toMatchObject({ outcome: "error", error_code: "provider_error", http_status: 200, document_status: "failed", attempts: 2 });
  });

  it("logs only the class of an error the reader throws, never its message, which can quote the file", async () => {
    const t = setup({ reader: async () => { throw new TypeError(`could not parse: ${SECRET}`); } });
    const { body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(body).toMatchObject({ status: "failed", code: "internal" });
    expect(t.logs).toEqual([`DOCUMENT_READ_FAILED request=${REQUEST} session=${INTAKE} document=${DOC} error=TypeError`]);
    expect(t.event()).toMatchObject({ error_code: "internal", document_status: "failed" });
  });

  it("never lets the document's words into a log, an event or an answer", async () => {
    for (const t of [setup(), setup({ reader: async () => { throw new Error(SECRET); } }), setup({ responses: [new Response(SECRET, { status: 500 }), new Response(SECRET, { status: 500 })] })]) {
      const response = await handleDocumentRequest(post({ document_id: DOC }), t.deps);
      const text = (await response.text()) + t.logs.join("\n") + JSON.stringify(t.events);
      expect(text).not.toMatch(/Acme Holdings|18400/);
    }
  });

  it("answers an unexpected failure as internal, logging the class only", async () => {
    const t = setup();
    t.deps.createClient = () => {
      throw new Error(`boom: ${SECRET}`);
    };
    const { status, body } = await read(await handleDocumentRequest(post({ document_id: DOC }), t.deps));
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Internal error", code: "internal", request_id: REQUEST });
    expect(t.logs).toEqual([`AI_UNEXPECTED_ERROR request=${REQUEST} error=Error`]);
  });
});
