// contact-request takes the "contact me" form on a firm's public link (slice 8.7b, D-1670 to D-1679; amends D-1662 and D-1666). Nobody signs in: the page posts
// the visitor's words and the token Cloudflare Turnstile's widget gave, this function checks the token with Turnstile (siteverify, with the visitor's address) and
// only then asks the database, as the service role, to make the lead (public.request_contact). The database no longer answers a browser, so the check cannot be
// skipped. With no secret configured it refuses: it is never open without the check. index.ts wires in Deno and the real client; the tests wire in fakes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

export interface ContactRequestClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
}

export interface ContactRequestDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string) => ContactRequestClient;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  log: (line: string) => void;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** The words for a function that is not set up, or whose check cannot be made: the form shows them as they are. */
export const NOT_AVAILABLE = "Asking to be contacted isn't available right now";

const NO_TOKEN = "Confirm you are not a robot, then try again.";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The visitor's address as the platform's proxy passes it: the first of X-Forwarded-For. Turnstile weighs it as remoteip. */
const callerAddress = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

/**
 * Turnstile's verdict on a token: `passed`, `failed` (it says no), or `unavailable` (it could not be asked, or its answer is no verdict at all). Anything but a
 * plain success is never a pass, so a provider that is down closes the form rather than opening it.
 */
async function checkToken(deps: ContactRequestDeps, secret: string, token: string, remoteip: string): Promise<"passed" | "failed" | "unavailable"> {
  try {
    const res = await deps.fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip }).toString(),
    });
    if (!res.ok) return "unavailable";
    const verdict = (await res.json()) as { success?: unknown } | null;
    if (verdict?.success === true) return "passed";
    return verdict?.success === false ? "failed" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Something on our side failed: try again. The log names the step's code, never a message (it can hold what the visitor typed) and never the token. */
function failed(deps: ContactRequestDeps, code: string | undefined): Response {
  deps.log(`CONTACT_REQUEST_FAILED step=request code=${code ?? "unknown"}`);
  return json({ error: "Couldn't send your request. Try again." }, 500);
}

/** A field as the database takes it: text, or nothing. */
const text = (value: unknown) => (typeof value === "string" ? value : null);

export async function handleContactRequest(req: Request, deps: ContactRequestDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // A POST only: a token in a URL would be in the platform's request log.
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // Never open without the check: with no secret, or no database to write to, nothing is asked of anyone.
  const secret = deps.env("TURNSTILE_SECRET_KEY")?.trim();
  const url = deps.env("SUPABASE_URL")?.trim();
  const key = deps.env("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!secret || !url || !key) return json({ error: NOT_AVAILABLE }, 503);
  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: NO_TOKEN }, 400);
  }
  // Turnstile's tokens are at most 2,048 characters. A request with none, or with one that cannot be a token, is never sent on.
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 2048) return json({ error: NO_TOKEN }, 400);
  const verdict = await checkToken(deps, secret, token, callerAddress(req));
  if (verdict === "unavailable") {
    deps.log("CONTACT_REQUEST_FAILED step=turnstile");
    return json({ error: NOT_AVAILABLE }, 503);
  }
  if (verdict === "failed") return json({ error: "The check didn't pass. Try again." }, 403);
  const db = deps.createClient(url, key);
  const made = await db.rpc("request_contact", {
    p_address: text(body.address),
    p_name: text(body.name),
    p_email: text(body.email),
    p_phone: text(body.phone),
    p_business: text(body.business),
    p_message: text(body.message),
  });
  if (made.error) {
    // The database wrote the words of a refused field (22023), a closing firm (PT423) and an address no firm holds (PT404) for a visitor; nothing else is shown.
    const status = ({ "22023": 422, PT423: 423, PT404: 404 } as Record<string, number>)[made.error.code ?? ""];
    if (status && made.error.message) return json({ error: made.error.message }, status);
    return failed(deps, made.error.code);
  }
  if (made.data !== "taken" && made.data !== "busy") return failed(deps, "answer");
  return json({ answer: made.data });
}
