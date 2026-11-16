// bundle-link serves the page a PEO opens from the link in an advisor's send (M-2.1, slice 6.6b; ADR 0003; D-609; migration
// 20261122110000_bundle_links.sql). Nobody signs in: the page /b/<token> posts the token here, and this function, as the service role,
// hashes it (and the caller's address) and asks the database. The token is never logged and never sent to the database as it is.
// The database decides everything: whether the link is live, the guessing limit, the PEO's authorization, and where a file is.
// index.ts wires in Deno and the real Supabase client; the tests wire in fakes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  // Every answer: kept in no cache, sent on in no Referer, indexed by no crawler.
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

export interface BundleLinkClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (path: string, seconds: number) => PromiseLike<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
}

export interface BundleLinkDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string) => BundleLinkClient;
  fetch: (url: string) => Promise<Response>;
  log: (line: string) => void;
}

/** The SHA-256 of a text, in lower-case hex: the only form of a token or an address the database is given. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** The caller's address as the platform's proxy passes it: the first of X-Forwarded-For. */
const callerAddress = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/** A token as the database makes them: 32 random bytes in URL-safe base64, no padding. Anything else is gone without a question. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** The one answer for every link that does not open: it names nobody. */
const gone = () => json({ state: "gone" }, 410);

/** Something on our side failed: try again. The log names the step and the database's code, never the token, its hash or the message. */
function failed(deps: BundleLinkDeps, step: string, code: string | undefined): Response {
  deps.log(`BUNDLE_LINK_FAILED step=${step} code=${code ?? "unknown"}`);
  return json({ error: "Something went wrong. Try again." }, 500);
}

/**
 * File n of a live link: the database checks the link and logs the download, then the file is signed for 60 seconds and its bytes passed on.
 * The browser gets the bytes and the name, never the bucket or the path (they name the quote request and the folder, or the intake).
 */
async function download(db: BundleLinkClient, deps: BundleLinkDeps, hashes: { p_token_hash: string; p_address_hash: string }, n: unknown): Promise<Response> {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 1000) return gone();
  const found = await db.rpc("bundle_link_file", { p_token_hash: hashes.p_token_hash, p_n: n, p_address_hash: hashes.p_address_hash });
  if (found.error) return failed(deps, "file", found.error.code);
  const file = found.data as { bucket?: unknown; path?: unknown; name?: unknown } | null;
  if (!file || typeof file.bucket !== "string" || typeof file.path !== "string" || typeof file.name !== "string") return gone();
  const signed = await db.storage.from(file.bucket).createSignedUrl(file.path, 60);
  if (signed.error || !signed.data?.signedUrl) return failed(deps, "sign", undefined);
  const bytes = await deps.fetch(signed.data.signedUrl);
  if (!bytes.ok || !bytes.body) return failed(deps, "fetch", String(bytes.status));
  return new Response(bytes.body, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}` },
  });
}

export async function handleBundleLinkRequest(req: Request, deps: BundleLinkDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // A POST only: a token in a URL would be in the platform's request log.
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: { token?: unknown; file?: unknown };
  try {
    body = ((await req.json()) ?? {}) as typeof body;
  } catch {
    return gone();
  }
  const token = body.token;
  if (typeof token !== "string" || !TOKEN_SHAPE.test(token)) return gone();
  const db = deps.createClient(deps.env("SUPABASE_URL") ?? "", deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const hashes = { p_token_hash: await sha256Hex(token), p_address_hash: await sha256Hex(callerAddress(req)) };
  if (body.file !== undefined) return download(db, deps, hashes, body.file);
  const opened = await db.rpc("bundle_link_open", hashes);
  if (opened.error) return failed(deps, "open", opened.error.code);
  const page = opened.data as { state?: string } | null;
  if (page?.state !== "open") return gone();
  return json(page);
}
