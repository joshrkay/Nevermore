// Fake Resend. Records every request. Mimics the documented Idempotency-Key rule: same key + same body replays the
// stored response without delivering again; same key + different body is rejected. Behaviour is switchable at runtime.
import http from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";
const LOG = process.argv[2];
writeFileSync(LOG, "");
let mode = "ok"; let n = 0; const keys = new Map(); let deliveries = 0;
http.createServer((req, res) => {
  let body = ""; req.on("data", (d) => (body += d));
  req.on("end", () => {
    if (req.url === "/__mode") { mode = JSON.parse(body).mode; res.end("ok"); return; }
    if (req.url === "/__stats") { res.end(JSON.stringify({ deliveries, requests: n, mode })); return; }
    n += 1;
    const key = req.headers["idempotency-key"];
    const entry = { n, mode, method: req.method, url: req.url, auth: req.headers.authorization, key, body: JSON.parse(body || "{}"), replay: false, delivered: false };
    const reply = (status, json) => { entry.status = status; appendFileSync(LOG, JSON.stringify(entry) + "\n"); res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(json)); };
    if (req.url !== "/emails" || req.method !== "POST") return reply(404, { message: "not found" });
    // A rate limit is answered before the key is looked up, so a retry of an accepted message can still get a 429.
    if (mode === "429") return reply(429, { message: "rate limit" });
    if (key && keys.has(key)) {
      const k = keys.get(key);
      if (k.body !== body) return reply(409, { name: "invalid_idempotent_request", message: "same key, different payload for jo@acme.example" });
      entry.replay = true; return reply(200, k.response);
    }
    if (mode === "503") return reply(503, { message: "provider down; echoes jo@acme.example" });
    if (mode === "403") return reply(403, { message: "domain not verified" });
    deliveries += 1; entry.delivered = true;
    const response = { id: `msg_${deliveries}` };
    if (key) keys.set(key, { body, response });
    if (mode === "slow") return setTimeout(() => reply(200, response), 1000);
    if (mode === "accept_then_hang") { entry.status = "hung"; appendFileSync(LOG, JSON.stringify(entry) + "\n"); return; } // accepted, never answers
    reply(200, response);
  });
}).listen(54400, "127.0.0.1", () => console.log("resend on 54400"));
