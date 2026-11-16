// The contact-request function through its request and response (D-13 seam 4), Turnstile and the database faked (slice 8.7b, D-1670 to D-1679).
import { describe, expect, it, vi } from "vitest";
import { handleContactRequest, type ContactRequestClient, type ContactRequestDeps } from "./handler";

const ENV: Record<string, string> = { SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key", TURNSTILE_SECRET_KEY: "turnstile-secret" };
const NOT_AVAILABLE = "Asking to be contacted isn't available right now";

interface Options {
  env?: Record<string, string | undefined>;
  rpc?: { data?: unknown; error?: { code?: string; message?: string } | null };
  /** What Turnstile's siteverify answers; a function to throw (the provider unreachable). */
  siteverify?: () => Promise<Response>;
}

function setup(o: Options = {}) {
  const logs: string[] = [];
  const env = { ...ENV, ...o.env };
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: o.rpc?.data ?? "taken", error: o.rpc?.error ?? null }));
  const db: ContactRequestClient = { rpc };
  const createClient = vi.fn((_url: string, _key: string) => db);
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => (o.siteverify ? o.siteverify() : new Response(JSON.stringify({ success: true }), { status: 200 })));
  const deps: ContactRequestDeps = { env: (n) => env[n], createClient, fetch, log: (l) => logs.push(l) };
  return { deps, rpc, createClient, fetch, logs };
}

const FORM = { address: "acme-brokers", name: "Pat Visitor", email: "pat@visitor.test", phone: "(503) 555-0142", business: "Visitor Co", message: "Please call me.", token: "turnstile-token-from-the-widget" };

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://p.supabase.co/functions/v1/contact-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.7, 10.0.0.1", ...headers },
    body: JSON.stringify(body),
  });

describe("contact-request: never open without the check", () => {
  // Break caught: with no Turnstile secret the function skips the check and takes the request (the captcha would be a switch anyone can find off).
  it("refuses, and calls neither Turnstile nor the database, when no secret is configured", async () => {
    for (const secret of [undefined, "", "   "]) {
      const t = setup({ env: { TURNSTILE_SECRET_KEY: secret } });
      const res = await handleContactRequest(post(FORM), t.deps);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: NOT_AVAILABLE });
      expect(t.fetch).not.toHaveBeenCalled();
      expect(t.rpc).not.toHaveBeenCalled();
    }
  });
});

describe("contact-request: a visitor who passes the check", () => {
  // Break caught: the token is not checked with Turnstile's own address and secret, the visitor's address is not passed on as remoteip, or the lead is made some other way than as the service role with the address the request came from.
  it("checks the token with Turnstile, with the visitor's address, and only then asks the database as the service role", async () => {
    const t = setup();
    const res = await handleContactRequest(post(FORM), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: "taken" });
    expect(t.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = t.fetch.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({ secret: "turnstile-secret", response: FORM.token, remoteip: "203.0.113.7" });
    expect(t.createClient).toHaveBeenCalledWith("https://p.supabase.co", "service-key");
    expect(t.rpc).toHaveBeenCalledWith("request_contact", {
      p_address: "acme-brokers", p_name: "Pat Visitor", p_email: "pat@visitor.test", p_phone: "(503) 555-0142", p_business: "Visitor Co", p_message: "Please call me.",
    });
  });
});

describe("contact-request: a visitor who does not pass the check", () => {
  // Break caught: a request whose token Turnstile rejects (a bot, a replayed or expired token) still makes a lead.
  it("is refused, and the database is never asked, when Turnstile says the token is no good", async () => {
    const t = setup({ siteverify: async () => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 }) });
    const res = await handleContactRequest(post(FORM), t.deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "The check didn't pass. Try again." });
    expect(t.rpc).not.toHaveBeenCalled();
  });
});

describe("contact-request: when the check cannot be made", () => {
  // Break caught: Turnstile is down or answers with something that is not a verdict, and the function lets the request through (open without the check), or dies with a raw error the visitor sees.
  it.each([
    ["the provider is unreachable", async () => { throw new TypeError("fetch failed"); }],
    ["the provider answers with an error status", async () => new Response("bad gateway", { status: 502 })],
    ["the provider's answer is not a verdict", async () => new Response("<html>nope</html>", { status: 200 })],
    ["the verdict says nothing of success", async () => new Response(JSON.stringify({}), { status: 200 })],
    ["an error status carries a success verdict", async () => new Response(JSON.stringify({ success: true }), { status: 500 })],
  ])("refuses, and the database is never asked, when %s", async (_why, siteverify) => {
    const t = setup({ siteverify });
    const res = await handleContactRequest(post(FORM), t.deps);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: NOT_AVAILABLE });
    expect(t.rpc).not.toHaveBeenCalled();
    expect(t.logs).toEqual(["CONTACT_REQUEST_FAILED step=turnstile"]);
  });
});

describe("contact-request: a request without a token", () => {
  // Break caught: a request that skipped the widget (no token, a blank one, a token that is not text, a body that is not JSON) is sent to Turnstile or the database, so a script with no widget costs a siteverify call each or gets through.
  it.each([
    ["no token", { ...FORM, token: undefined }],
    ["a blank token", { ...FORM, token: "  " }],
    ["a token that is not text", { ...FORM, token: 12345 }],
    ["a token of absurd size", { ...FORM, token: "x".repeat(5000) }],
  ])("is refused with %s, and neither Turnstile nor the database is asked", async (_why, body) => {
    const t = setup();
    const res = await handleContactRequest(post(body), t.deps);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Confirm you are not a robot, then try again." });
    expect(t.fetch).not.toHaveBeenCalled();
    expect(t.rpc).not.toHaveBeenCalled();
  });

  it("is refused when the body is not JSON", async () => {
    const t = setup();
    const res = await handleContactRequest(new Request("https://p.supabase.co/functions/v1/contact-request", { method: "POST", body: "not json" }), t.deps);
    expect(res.status).toBe(400);
    expect(t.fetch).not.toHaveBeenCalled();
    expect(t.rpc).not.toHaveBeenCalled();
  });
});

describe("contact-request: what the database answers", () => {
  // Break caught: a busy link is read as taken (the visitor is thanked for a request nobody will see), or an answer the database never gives is passed on as it is.
  it("passes on taken and busy as they are, and nothing else", async () => {
    expect(await (await handleContactRequest(post(FORM), setup({ rpc: { data: "busy" } }).deps)).json()).toEqual({ answer: "busy" });
    const odd = setup({ rpc: { data: { surprise: true } } });
    const res = await handleContactRequest(post(FORM), odd.deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Couldn't send your request. Try again." });
  });

  // Break caught: the words the database wrote for a visitor (a field to fix, a closing firm, an address no firm holds) are lost, so the form can only say "Couldn't send".
  it.each([
    ["22023", "Enter your name.", 422],
    ["PT423", "This firm is not taking requests right now.", 423],
    ["PT404", "No firm holds this address.", 404],
  ])("keeps the database's own words for a %s refusal", async (code, message, status) => {
    const t = setup({ rpc: { error: { code, message } } });
    const res = await handleContactRequest(post(FORM), t.deps);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
  });

  // Break caught: a database error ("relation leads does not exist", an internal message with the visitor's own email in it) reaches the visitor or the log.
  it("shows nothing of any other failure but a plain sentence, and logs only the code", async () => {
    const t = setup({ rpc: { error: { code: "42P01", message: 'relation "leads" does not exist, row pat@visitor.test' } } });
    const res = await handleContactRequest(post(FORM), t.deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Couldn't send your request. Try again." });
    expect(t.logs).toEqual(["CONTACT_REQUEST_FAILED step=request code=42P01"]);
    expect(JSON.stringify(t.logs)).not.toContain("pat@visitor.test");
  });
});

describe("contact-request: the edges", () => {
  // Break caught: the browser's preflight is refused (the form can never post), or a GET (a token in a URL, in the platform's log) is answered.
  it("answers a preflight, and nothing but a POST", async () => {
    const t = setup();
    const pre = await handleContactRequest(new Request("https://p.supabase.co/functions/v1/contact-request", { method: "OPTIONS" }), t.deps);
    expect(pre.status).toBe(200);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const get = await handleContactRequest(new Request("https://p.supabase.co/functions/v1/contact-request", { method: "GET" }), t.deps);
    expect(get.status).toBe(405);
    expect(t.fetch).not.toHaveBeenCalled();
  });

  // Break caught: the function is deployed without the database's address or the service role key and lets a visitor through to a call that cannot work, or spends a siteverify on it.
  it("refuses when the database is not configured", async () => {
    for (const missing of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
      const t = setup({ env: { [missing]: undefined } });
      const res = await handleContactRequest(post(FORM), t.deps);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: NOT_AVAILABLE });
      expect(t.fetch).not.toHaveBeenCalled();
      expect(t.rpc).not.toHaveBeenCalled();
    }
  });

  // Break caught: the token (a credential for one check) is passed to the database or written to a log.
  it("sends the token to Turnstile only, and logs nothing of it", async () => {
    const t = setup({ rpc: { error: { code: "XX000", message: "boom" } } });
    await handleContactRequest(post(FORM), t.deps);
    expect(JSON.stringify(t.rpc.mock.calls)).not.toContain(FORM.token);
    expect(JSON.stringify(t.logs)).not.toContain(FORM.token);
  });

  // Break caught: a field that is not text (a number, an object) reaches the database's typed parameters and dies as a raw error.
  it("passes a field that is not text as nothing", async () => {
    const t = setup();
    await handleContactRequest(post({ ...FORM, phone: 5035550142, business: { a: 1 }, message: null }), t.deps);
    expect(t.rpc).toHaveBeenCalledWith("request_contact", expect.objectContaining({ p_phone: null, p_business: null, p_message: null, p_email: "pat@visitor.test" }));
  });
});
