// Local stand-in for Supabase for driving the real app. Data calls run the real SQL in Postgres
// under the caller's claims; only auth tokens and CORS are faked. Mode is switchable at runtime.
import http from "node:http";
import { execFileSync } from "node:child_process";

const ADVISOR_ID = process.env.ADVISOR_ID;
const state = { advisor: "ok", log: [] };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub, email) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, email, role: "authenticated", is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const user = (id, email) => ({ id, email, aud: "authenticated", role: "authenticated", is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
const session = (id, email) => ({ access_token: jwt(id, email), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user: user(id, email) });

const psql = (sql) =>
  execFileSync("psql", ["-h", "localhost", "-U", "postgres", "-d", process.env.VERIFY_DB || "verify_db", "-qAt", "-c", sql], { env: { ...process.env, PGPASSWORD: "postgres" } }).toString().trim().split("\n").pop();

const claims = JSON.stringify({ sub: ADVISOR_ID, email: "adv@example.com", is_anonymous: false, role: "authenticated" });
const asAdvisor = (inner) => psql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '${claims}', true); ${inner}; COMMIT;`);

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
const send = (res, code, body) => { res.writeHead(code, { ...cors, "content-type": "application/json" }); res.end(body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body)); };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (req.method === "OPTIONS") return send(res, 204);
    const body = raw ? JSON.parse(raw) : {};
    const entry = `${req.method} ${url.pathname}${url.search} ${raw}`.trim();
    if (!url.pathname.startsWith("/__")) state.log.push(entry);
    try {
      if (url.pathname === "/__mode") { Object.assign(state, body); return send(res, 200, state); }
      if (url.pathname === "/__log") { const l = state.log; if (url.searchParams.get("clear")) state.log = []; return send(res, 200, l); }

      if (url.pathname === "/auth/v1/logout") return send(res, 204);
      if (url.pathname === "/auth/v1/token") return send(res, 200, session(ADVISOR_ID, body.email || "adv@example.com"));
      if (url.pathname === "/auth/v1/user") return send(res, 200, user(ADVISOR_ID, "adv@example.com"));

      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fn = url.pathname.split("/").pop();
        if (state.advisor === "expired") return send(res, 401, { code: "PGRST301", message: "JWT expired", details: null, hint: null });
        if (fn === "is_advisor") return send(res, 200, state.advisor === "ok" ? "true" : "false");
        if (fn === "advisor_list_submissions") {
          const st = body.p_status;
          if (st !== undefined && !/^[a-z_]+$/.test(st)) return send(res, 400, { code: "22023", message: "bad status" });
          const arg = st ? `'${st}'` : "NULL";
          const out = asAdvisor(`SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY rn), '[]'::jsonb) FROM (SELECT l.*, row_number() OVER () AS rn FROM public.advisor_list_submissions(${arg}) l) q`);
          return send(res, 200, out);
        }
      }
      if (url.pathname === "/rest/v1/chamber_sessions" && req.method === "GET") {
        const m = /^eq\.([0-9a-f-]{36})$/.exec(url.searchParams.get("id") || "");
        if (!m) return send(res, 400, { code: "22023", message: "id filter needed" });
        const out = asAdvisor(`SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'chamber_data', chamber_data, 'field_provenance', coalesce(field_provenance, '{}'::jsonb), 'transcript', transcript, 'status', status, 'submission', submission)), '[]'::jsonb) FROM public.chamber_sessions WHERE id = '${m[1]}'`);
        return send(res, 200, out);
      }
      if (url.pathname === "/rest/v1/chamber_sessions" && req.method === "PATCH") return send(res, 204);
      if (url.pathname === "/rest/v1/documents") return send(res, 200, []);
      return send(res, 404, { code: "PGRST116", message: "not stubbed: " + url.pathname });
    } catch (e) {
      return send(res, 500, { code: "XX000", message: String(e.message).slice(0, 300) });
    }
  });
}).listen(54321, "localhost", () => console.log("stub on 54321"));
