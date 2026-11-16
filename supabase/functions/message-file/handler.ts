// message-file serves a file link on a message to a contact (story CRM-E1.2b, slice 6.3; D-605; migration 20261122160000_conversation_files.sql). A file
// goes with a message as a link, never as an attachment: the page /f#<token> posts the token here, and this function, as the service role, hashes it (and
// the caller's address) and asks the database, which decides everything: whether the link is live, its 30 days, the virus check, the guessing limit
// (the bundle link's, D-644) and the download's log. The token is never logged and never sent to the database as it is. It reuses the bundle link's
// hashing and its client's shape (D-643). index.ts wires in Deno and the real Supabase client; the tests wire in fakes.

import { sha256Hex, type BundleLinkClient } from "../bundle-link/handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  // Every answer: kept in no cache, sent on in no Referer, indexed by no crawler.
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

export interface MessageFileDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string) => BundleLinkClient;
  fetch: (url: string) => Promise<Response>;
  log: (line: string) => void;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** The caller's address as the platform's proxy passes it: the first of X-Forwarded-For. */
const callerAddress = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/** A token as the database makes them: 32 random bytes in URL-safe base64, no padding. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** The one answer for every link that does not open: it names nobody and nothing. */
const gone = () => json({ state: "gone" }, 410);

function failed(deps: MessageFileDeps, step: string, code: string | undefined): Response {
  deps.log(`MESSAGE_FILE_FAILED step=${step} code=${code ?? "unknown"}`);
  return json({ error: "Something went wrong. Try again." }, 500);
}

export async function handleMessageFileRequest(req: Request, deps: MessageFileDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // A POST only: a token in a URL would be in the platform's request log.
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: { token?: unknown };
  try {
    body = ((await req.json()) ?? {}) as typeof body;
  } catch {
    return gone();
  }
  const token = body.token;
  if (typeof token !== "string" || !TOKEN_SHAPE.test(token)) return gone();
  const db = deps.createClient(deps.env("SUPABASE_URL") ?? "", deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const found = await db.rpc("conversation_file_open", { p_token_hash: await sha256Hex(token), p_address_hash: await sha256Hex(callerAddress(req)) });
  if (found.error) return failed(deps, "open", found.error.code);
  const file = found.data as { bucket?: unknown; path?: unknown; name?: unknown } | null;
  if (!file || typeof file.bucket !== "string" || typeof file.path !== "string" || typeof file.name !== "string") return gone();
  // Signed for 60 seconds and fetched here: the browser gets the bytes and the name, never the bucket, the path or a link.
  const signed = await db.storage.from(file.bucket).createSignedUrl(file.path, 60);
  if (signed.error || !signed.data?.signedUrl) return failed(deps, "sign", undefined);
  const bytes = await deps.fetch(signed.data.signedUrl);
  if (!bytes.ok || !bytes.body) return failed(deps, "fetch", String(bytes.status));
  return new Response(bytes.body, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}` },
  });
}
