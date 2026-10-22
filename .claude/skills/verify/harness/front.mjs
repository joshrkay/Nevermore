// Stand-in for Supabase's gateway: GoTrue's GET /auth/v1/user and a pass-through of /rest/v1/* to PostgREST.
import http from "node:http";
import { verify } from "./jwt.mjs";
http.createServer((req, res) => {
  if (req.url.startsWith("/auth/v1/")) { // real GoTrue answers browsers with CORS headers; the stand-in must too
    res.setHeader("access-control-allow-origin", "*"); res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] ?? "*");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  }
  const auth = req.headers.authorization?.replace(/^Bearer /i, "");
  if (req.url.startsWith("/auth/v1/user")) {
    const c = auth && verify(auth);
    if (!c || !c.sub) { res.writeHead(401, { "content-type": "application/json" }); return res.end('{"code":401,"msg":"invalid JWT"}'); }
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id: c.sub, aud: "authenticated", role: c.role, email: c.email ?? "", is_anonymous: c.is_anonymous === true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }));
  }
  if (req.url.startsWith("/rest/v1/")) {
    const up = http.request({ host: "127.0.0.1", port: 3001, path: req.url.replace("/rest/v1", ""), method: req.method, headers: { ...req.headers, host: "127.0.0.1:3001" } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
    return req.pipe(up);
  }
  if (req.url.startsWith("/functions/v1/dispatch-outbox")) { console.log(`${req.method} ${req.url} origin=${req.headers.origin} acr-headers=${req.headers["access-control-request-headers"] ?? "-"}`); // Supabase's gateway maps /functions/v1/<name> to the function
    const up = http.request({ host: "127.0.0.1", port: 8000, path: "/", method: req.method, headers: { ...req.headers, host: "127.0.0.1:8000" } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
    return req.pipe(up);
  }
  res.writeHead(404); res.end();
}).listen(54321, "127.0.0.1", () => console.log("front on 54321"));
