import { describe, expect, it, vi } from "vitest";
import { handleReadQuoteDocument, type QuoteReadClient, type QuoteReadDeps } from "./handler";
import type { AskModel, Outcome } from "../document-extract/read";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REQUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
// Words from the document, which must never reach a log or an answer.
const SECRET = "Pinnacle Mutual quote for Acme Holdings, admin fee 40 per employee per month";

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  IP_HASH_SECRET: "ip-secret",
  ANTHROPIC_API_KEY: "anthropic-key",
};

// Anthropic's Messages API answers with the forced tool's input.
const anthropicReply = (input: Record<string, unknown>) =>
  new Response(JSON.stringify({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "propose_quote", input }] }), { status: 200 });

type Reader = (bytes: Uint8Array, fileName: string, ask: AskModel) => Promise<Outcome>;
// The file reader is faked (read.ts needs Deno-only imports): a PDF whose two pages are read as text and handed to the model.
const readsTwoPages: Reader = async (_bytes, _name, ask) => {
  await ask([{ label: "Page 1", text: SECRET }, { label: "Page 2", text: "Effective January 1, 2027" }]);
  return { status: "extracted", candidates: [] };
};

interface Setup {
  env?: Record<string, string | undefined>;
  reader?: Reader;
  responses?: Array<Response | Error>;
  user?: { id: string } | null;
}

const setup = (opts: Setup = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const steps: string[] = [];
  const queue = [...(opts.responses ?? [anthropicReply({ admin_fee: { value: { amount: 40, basis: "per_employee_per_month" }, source: 1 }, start_on: { value: "2027-01-01", source: 2 } })])];
  const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => {
    steps.push("model");
    const next = queue.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next instanceof Error) throw next;
    return next;
  });
  const createClient = vi.fn((_url: string, key: string): QuoteReadClient => ({
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: USER } : opts.user } }) },
    rpc: async (fn) => {
      steps.push(`${key}:${fn}`);
      return { data: true, error: null };
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "quotes"
              ? { id: 7, document_attachment_id: 51 }
              : { id: 51, file_name: "quote.pdf", status: "stored", storage_bucket: "peo-mail", storage_path: "intake/9/51-quote.pdf", size_bytes: 1000 },
            error: null,
          }),
        }),
      }),
    }),
    storage: {
      from: (bucket) => ({
        download: async (path) => {
          steps.push(`download:${bucket}/${path}`);
          const bytes = new TextEncoder().encode(SECRET);
          return { data: { size: bytes.length, arrayBuffer: async () => bytes.buffer } as unknown as Blob, error: null };
        },
      }),
    },
  }));
  const readDocument = vi.fn(opts.reader ?? readsTwoPages);
  const deps: QuoteReadDeps = {
    env: (name) => env[name],
    createClient,
    readDocument,
    fetch: fetchFn as unknown as typeof fetch,
    sleep: async () => {},
    now: () => 0,
    logError: (line) => logs.push(line),
    newRequestId: () => REQUEST,
  };
  return { deps, logs, steps, fetchFn, readDocument };
};

const post = (body: unknown, headers: Record<string, string> = { Authorization: "Bearer jwt", "x-forwarded-for": "203.0.113.9" }) =>
  new Request("https://functions.test/read-quote-document", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
const read = async (response: Response) => ({ status: response.status, body: await response.json() });

describe("read-quote-document: a proposal from the quote's document", () => {
  it("reads the quote's own document and answers the figures it found with the page each came from, citing the model's section numbers", async () => {
    const t = setup();
    const { status, body } = await read(await handleReadQuoteDocument(post({ quote_id: 7 }), t.deps));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      status: "proposed",
      proposal: {
        draft: { adminFee: 40, adminFeeBasis: "per_employee_per_month", startOn: "2027-01-01" },
        sources: { adminFee: "Page 1", startOn: "Page 2" },
      },
      request_id: REQUEST,
    });
    expect(t.steps).toContain("download:peo-mail/intake/9/51-quote.pdf");
  });
});

describe("read-quote-document: who may call it", () => {
  it("refuses a request with no Authorization header or no signed-in user, before any quote, file or model is touched", async () => {
    const noHeader = setup();
    const a = await read(await handleReadQuoteDocument(post({ quote_id: 7 }, {}), noHeader.deps));
    expect(a.status).toBe(401);
    expect(a.body).toMatchObject({ code: "unauthorized", request_id: REQUEST });
    const noUser = setup({ user: null });
    const b = await read(await handleReadQuoteDocument(post({ quote_id: 7 }), noUser.deps));
    expect(b.status).toBe(401);
    for (const t of [noHeader, noUser]) {
      expect(t.steps).toEqual([]);
      expect(t.readDocument).not.toHaveBeenCalled();
    }
  });
});

describe("read-quote-document: the request", () => {
  it("answers a preflight without touching Supabase, refuses other methods (405) and a body that is not JSON with a positive whole quote_id (400) or is too large (413), reading nothing", async () => {
    const t = setup();
    const url = "https://functions.test/read-quote-document";
    const preflight = await handleReadQuoteDocument(new Request(url, { method: "OPTIONS" }), t.deps);
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get("Access-Control-Expose-Headers")).toBe("X-Request-Id");
    const get = await read(await handleReadQuoteDocument(new Request(url, { method: "GET", headers: { Authorization: "Bearer jwt" } }), t.deps));
    expect(get.status).toBe(405);
    for (const bad of ["not json", "[]", "{}", { quote_id: "7" }, { quote_id: 0 }, { quote_id: -3 }, { quote_id: 1.5 }, { quote_id: null }]) {
      const r = await read(await handleReadQuoteDocument(post(bad), t.deps));
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(r.body.code).toBe("bad_request");
    }
    expect((await handleReadQuoteDocument(post("x".repeat(5000)), t.deps)).status).toBe(413);
    expect(t.readDocument).not.toHaveBeenCalled();
    expect(t.steps.filter((s) => s.startsWith("download"))).toEqual([]);
  });
});
