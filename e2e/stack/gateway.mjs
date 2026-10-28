// The Supabase stand-in: one HTTP server answering where the app expects auth, REST and functions, plus
// a few test-only endpoints. It plays the part of Supabase's API gateway (CORS, API-key check) and
// hands each path to the service behind it.
import http from "node:http";
import { ANON_KEY, SERVICE_ROLE_KEY } from "./config.mjs";
import { createAuth } from "./auth.mjs";
import { createRest } from "./rest.mjs";

const MAX_BODY_BYTES = 10 * 1024 * 1024;
const CORS_PATHS = /^\/(auth\/v1|rest\/v1|__e2e)(\/|$)/;
const API_KEY_PATHS = /^\/(auth\/v1|rest\/v1|functions\/v1)(\/|$)/;

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function send(res, { status = 200, headers = {}, body, rawBody }) {
  const payload = rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
  const out = { ...headers };
  if (payload !== undefined && !Object.keys(out).some((name) => name.toLowerCase() === "content-type")) {
    out["Content-Type"] = "application/json; charset=utf-8";
  }
  res.writeHead(status, out);
  res.end(payload);
}

/**
 * @param {object} options
 * @param {number} options.port
 * @param {import("pg").Pool} options.pool  as created by createPool()
 * @param {{ handle: (req, res, url, body: Buffer) => Promise<void> }} options.functions  answers /functions/v1/*, including its own CORS
 * @param {(line: string) => void} [options.log]
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startGateway({ port, pool, functions, log = () => {} }) {
  const auth = createAuth({ pool, log });
  const rest = createRest({ pool, log });
  // Traffic from the app, for tests that assert what was (or was not) sent. The test endpoints and
  // CORS preflights are left out: they would drown the signal.
  const requests = [];

  async function route(req, res, url) {
    if (req.method === "OPTIONS" && CORS_PATHS.test(url.pathname)) {
      return send(res, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
          "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] ?? "authorization, apikey, content-type, x-client-info",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (url.pathname.startsWith("/__e2e/")) {
      if (url.pathname === "/__e2e/health") return send(res, { body: { ok: true } });
      if (url.pathname === "/__e2e/requests") return send(res, { body: requests });
      if (url.pathname === "/__e2e/otp") {
        const code = await auth.pendingCode(url.searchParams.get("email") ?? "");
        return send(res, code ? { body: { code } } : { status: 404, body: { message: "No email change is pending for that address" } });
      }
      return send(res, { status: 404, body: { message: `Unknown test endpoint ${url.pathname}` } });
    }

    // Supabase's gateway rejects a request without one of the project's keys before any service sees it.
    // Function preflights carry no key; the functions module answers them itself.
    if (API_KEY_PATHS.test(url.pathname) && req.method !== "OPTIONS") {
      const key = req.headers.apikey;
      if (key !== ANON_KEY && key !== SERVICE_ROLE_KEY) {
        return send(res, { status: 401, body: { message: "Invalid API key", hint: "Double check your Supabase `anon` or `service_role` API key." } });
      }
    }

    const body = await readBody(req);
    if (url.pathname.startsWith("/auth/v1/")) return send(res, await auth.handle(req, url, body));
    if (url.pathname.startsWith("/rest/v1/")) return send(res, await rest.handle(req, url, body));
    if (url.pathname.startsWith("/functions/v1/")) return functions.handle(req, res, url, body);
    return send(res, { status: 404, body: { message: `Nothing is served at ${url.pathname}` } });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://gateway.invalid");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "X-Supabase-Api-Version, Content-Range");
    if (req.method !== "OPTIONS" && !url.pathname.startsWith("/__e2e/")) {
      res.on("finish", () => requests.push({ method: req.method, path: url.pathname + url.search, status: res.statusCode, at: new Date().toISOString() }));
    }
    try {
      await route(req, res, url);
    } catch (error) {
      log(`gateway: ${req.method} ${url.pathname} failed: ${error.stack ?? error}`);
      if (!res.headersSent) send(res, { status: error.status ?? 500, body: { message: error.message } });
      else res.destroy();
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", (error) => reject(error.code === "EADDRINUSE" ? new Error(`Port ${port} is already in use; stop what is listening there or set E2E_GATEWAY_PORT`) : error));
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    port: server.address().port,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        // Browsers hold keep-alive connections open, which would otherwise stall the shutdown.
        server.closeAllConnections();
      }),
  };
}
