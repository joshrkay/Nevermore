// Edge functions for the e2e gateway. chamber-extract is the real handler, run in Node (which strips
// the TypeScript types itself) with a fake AI provider behind it; the rest are stubs or 404s.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createFakeAi } from "./fake-ai.mjs";

// handler.ts, not index.ts: index.ts imports from deno.land and reads Deno.env, handler.ts has neither.
// Loading it here rather than per request makes a broken import stop the gateway at startup.
const { handleRequest } = await import(new URL("../../supabase/functions/chamber-extract/handler.ts", import.meta.url).href);

// The headers both real functions answer with. The gateway adds no CORS of its own for /functions/v1.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_PROVIDERS = ["lovable", "anthropic"];

/** Node's request as a fetch Request, with the peer address as the last X-Forwarded-For hop, as Supabase's edge adds it. */
function toRequest(req, origin, pathAndQuery, body) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const v of [].concat(value)) headers.append(name, v);
  }
  headers.append("x-forwarded-for", req.socket.remoteAddress ?? "127.0.0.1");
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(new URL(pathAndQuery, origin), { method: req.method, headers, body: hasBody ? body : undefined });
}

/** The bytes the gateway already read, or else the request's own stream. */
async function readBody(req, body) {
  if (body !== undefined && body !== null) return body;
  if (req.readableEnded) return Buffer.alloc(0);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function send(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const jsonResponse = (body, status = 200) => Response.json(body, { status, headers: CORS_HEADERS });

/**
 * @param {object} options
 * @param {string} options.supabaseUrl      the gateway's own URL: the handler calls back into its /auth and /rest
 * @param {string} options.anonKey
 * @param {string} options.serviceRoleKey
 * @param {(line: string) => void} [options.log]
 * @returns {{ handle: (req, res, url, body) => Promise<void>, calls: { name: string, method: string, status: number, at: number }[], ai: ReturnType<typeof createFakeAi> }}
 *   `url` is a URL or a path string; `body` is a Buffer or string if the gateway already read the request body (otherwise it is read from `req`).
 *   `ai` is the fake provider, so a test can see which model calls the handler made.
 */
export function createFunctions({ supabaseUrl, anonKey, serviceRoleKey, log = (line) => console.error(`[functions] ${line}`) }) {
  const provider = process.env.E2E_AI_PROVIDER || "lovable";
  if (!AI_PROVIDERS.includes(provider)) throw new Error(`E2E_AI_PROVIDER must be one of ${AI_PROVIDERS.join(", ")}, got "${provider}"`);

  const fakeAi = createFakeAi({ log });
  const calls = [];

  // Only what chamber-extract reads. The ceilings are high so repeated runs never meet them; the
  // per-user ceiling (15 a minute) is fixed in the handler, and the database starts empty each run.
  const secrets = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    IP_HASH_SECRET: "e2e-ip-hash-secret",
    AI_PROVIDER: provider,
    LOVABLE_API_KEY: "e2e-fake-lovable-key",
    ANTHROPIC_API_KEY: "e2e-fake-anthropic-key",
    AI_IP_PER_MINUTE: "100000",
    AI_IP_PER_DAY: "1000000",
    AI_GLOBAL_DAILY_CALLS: "1000000",
  };
  const deps = {
    env: (name) => secrets[name],
    createClient,
    fetch: fakeAi.fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    logError: log,
    newRequestId: randomUUID,
  };

  async function respond(req, name, pathAndQuery, body) {
    switch (name) {
      case "chamber-extract":
        // OPTIONS included: the handler answers its own preflight.
        return await handleRequest(toRequest(req, supabaseUrl, pathAndQuery, await readBody(req, body)), deps);
      case "dispatch-outbox":
        // A stub: the real function needs Deno and an email provider, and the database has already
        // queued the emails when the certification was written.
        if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
        if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
        return jsonResponse({ claimed: 0, sent: 0, retrying: 0, dead: 0, unrecorded: 0, skipped: 0 });
      default:
        return jsonResponse({ code: "NOT_FOUND", message: "Requested function was not found" }, 404);
    }
  }

  async function handle(req, res, url, body) {
    const { pathname, search } = new URL(url ?? req.url, "http://gateway.invalid");
    const name = decodeURIComponent(pathname.split("/")[3] ?? "");
    let response;
    try {
      response = await respond(req, name, pathname + search, body);
    } catch (error) {
      log(`FUNCTION_ERROR ${name}: ${error instanceof Error ? error.message : String(error)}`);
      response = jsonResponse({ error: "Internal error" }, 500);
    }
    calls.push({ name, method: req.method, status: response.status, at: Date.now() });
    await send(res, response);
  }

  return { handle, calls, ai: fakeAi };
}
