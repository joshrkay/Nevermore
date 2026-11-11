// held-mail looks after the holding list (joshrkay/Nevermore#92, story M-3.3; migration 20261111130000_held_mail.sql):
// an advisor moves a message off a thread, an admin assigns a held message to a quote request or discards it, and
// the schedule deletes what has waited 30 days. The database decides what may happen and keeps every rule; this
// function does the one part SQL can't, moving and removing the message's files in storage, in an order that never
// leaves a row pointing at a missing file or a file without a row:
//   * moving: plan (read-only) -> move the files -> apply; if the apply is refused the files are put back;
//   * discarding and expiring: plan -> remove the files -> finish (the database refuses while a file remains).
// A person calls it with their own login (advisor to move off, admin to assign or discard); the schedule calls it
// with the service-role key (purge only). It answers with ids and counts, never a name, a sender or a file name,
// and logs the same. index.ts wires in Deno and the real Supabase client; the tests wire in fakes.

import { bearerToken, isServiceCall } from "../_shared/serviceAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUCKET = "peo-mail";
export const PURGE_BATCH = 20;
const REMOVE_CHUNK = 100;
const MAX_BODY = 4096;

type RpcResult = { data: unknown; error: { code?: string } | null };

export interface HeldMailClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null } }> };
  storage: {
    from: (bucket: string) => {
      move: (from: string, to: string) => PromiseLike<{ error: unknown }>;
      remove: (paths: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
    };
  };
}

export interface HeldMailDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers?: Record<string, string> } }) => HeldMailClient;
  log: (line: string) => void;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** What each database refusal means to the caller. */
function refusal(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "42501": return { status: 403, error: "You can't do that." };
    case "PT404": return { status: 404, error: "That message or quote request was not found." };
    case "55000": return { status: 409, error: "That message is not where it was; reload the list." };
    case "22023": return { status: 400, error: "That request is not valid." };
    default: return { status: 500, error: "Something went wrong. Try again." };
  }
}

type Outcome = { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string; code: string };
const fail = (status: number, error: string, code: string): Outcome => ({ ok: false, status, error, code });
const refused = (code: string | undefined): Outcome => {
  const r = refusal(code);
  return fail(r.status, r.error, code ?? "unexpected");
};

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Moves a message (a target quote request assigns it; none moves it off its thread) with its files. */
async function moveMessage(db: HeldMailClient, deps: HeldMailDeps, messageId: number, target: number | null, actor: string, note: string | null): Promise<Outcome> {
  const planned = await db.rpc("plan_mail_move", { p_message_id: messageId, p_target: target, p_actor: actor });
  if (planned.error) return refused(planned.error.code);
  const moves = asArray((planned.data as { moves?: unknown } | null)?.moves)
    .map((m) => m as { from?: unknown; to?: unknown })
    .filter((m): m is { from: string; to: string } => typeof m.from === "string" && typeof m.to === "string");

  const done: { from: string; to: string }[] = [];
  const putBack = async () => {
    for (const m of done.reverse()) {
      const back = await db.storage.from(BUCKET).move(m.to, m.from);
      if (back.error) deps.log(`HELD_MAIL_ROLLBACK_FAILED message=${messageId}`);
    }
  };
  for (const m of moves) {
    const moved = await db.storage.from(BUCKET).move(m.from, m.to);
    if (moved.error) {
      deps.log(`HELD_MAIL_FAILED message=${messageId} step=storage_move`);
      await putBack();
      return fail(500, "The files could not be moved. Nothing changed; try again.", "storage_move");
    }
    done.push(m);
  }

  const applied = await db.rpc("apply_mail_move", { p_message_id: messageId, p_target: target, p_actor: actor, p_note: note });
  if (applied.error) {
    await putBack();
    return refused(applied.error.code);
  }
  deps.log(`HELD_MAIL_MOVED message=${messageId} to=${target === null ? "held" : "quote_request"} files=${moves.length}`);
  return { ok: true, body: { moved: true, held: target === null, files: moves.length } };
}

/** Discards a held message: its files first, then its rows. A null actor is the schedule's expiry. */
async function discardMessage(db: HeldMailClient, deps: HeldMailDeps, messageId: number, actor: string | null): Promise<Outcome> {
  const planned = await db.rpc("plan_held_mail_discard", { p_message_id: messageId, p_actor: actor });
  if (planned.error) return refused(planned.error.code);
  const paths = asArray((planned.data as { paths?: unknown } | null)?.paths).filter((p): p is string => typeof p === "string");
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    const removed = await db.storage.from(BUCKET).remove(paths.slice(i, i + REMOVE_CHUNK));
    if (removed.error) {
      deps.log(`HELD_MAIL_FAILED message=${messageId} step=storage_remove`);
      return fail(500, "The files could not be removed. Nothing was deleted; try again.", "storage_remove");
    }
  }
  const finished = await db.rpc("finish_held_mail_discard", { p_message_id: messageId, p_actor: actor });
  if (finished.error) {
    deps.log(`HELD_MAIL_FAILED message=${messageId} step=rpc_finish code=${finished.error.code ?? "unexpected"}`);
    return refused(finished.error.code === "EA006" ? undefined : finished.error.code);
  }
  deps.log(`HELD_MAIL_DISCARDED message=${messageId} by=${actor === null ? "schedule" : "admin"} files=${paths.length}`);
  return { ok: true, body: { deleted: true, files: paths.length } };
}

async function purge(db: HeldMailClient, deps: HeldMailDeps): Promise<Response> {
  const due = await db.rpc("held_mail_due", { p_limit: PURGE_BATCH });
  if (due.error) {
    deps.log(`HELD_MAIL_FAILED step=rpc_due code=${due.error.code ?? "unexpected"}`);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
  let purged = 0;
  let failed = 0;
  for (const row of asArray(due.data)) {
    const id = Number((row as { message_id?: unknown }).message_id);
    if (!Number.isSafeInteger(id)) continue;
    const out = await discardMessage(db, deps, id, null);
    if (out.ok) {
      purged += 1;
    } else {
      failed += 1;
      // The same alert a stuck deletion raises: expired mail that can't be removed is a retention failure.
      await db.rpc("record_ops_event", { p_kind: "deletion_failed", p_source: "held-mail", p_code: `held_mail:${out.code}`, p_detail: null, p_user_id: null, p_session_id: null });
    }
  }
  return json({ purged, failed });
}

const positiveInt = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null);

export async function handleHeldMailRequest(req: Request, deps: HeldMailDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = deps.env("SUPABASE_URL");
  const anonKey = deps.env("SUPABASE_ANON_KEY");
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    deps.log("HELD_MAIL_CONFIG_MISSING: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set");
    return json({ error: "Held mail isn't available right now." }, 503);
  }

  const authorization = req.headers.get("Authorization");
  if (!bearerToken(authorization)) return json({ error: "Unauthorized" }, 401);

  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: "Request too large" }, 413);
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Send a JSON object." }, 400);
  }
  const action = body.action;

  const service = deps.createClient(url, serviceKey);

  // The schedule: the service-role key, and only to purge.
  if (isServiceCall(authorization, serviceKey)) {
    if (action !== undefined && action !== "purge") return json({ error: "The schedule can only purge." }, 403);
    return purge(service, deps);
  }
  if (action === "purge") return json({ error: "Unauthorized" }, 401);

  // A person: who they are comes from their own login; what they may do is checked again in the database.
  const user = deps.createClient(url, anonKey, { global: { headers: { Authorization: authorization as string } } });
  const { data: { user: who } } = await user.auth.getUser();
  if (!who) return json({ error: "Unauthorized" }, 401);

  const messageId = positiveInt(body.message_id);
  if (messageId === null) return json({ error: "message_id is required." }, 400);

  let out: Outcome;
  if (action === "assign") {
    const target = positiveInt(body.quote_request_id);
    if (target === null) return json({ error: "quote_request_id is required." }, 400);
    out = await moveMessage(service, deps, messageId, target, who.id, null);
  } else if (action === "move_off") {
    const note = typeof body.note === "string" ? body.note : null;
    out = await moveMessage(service, deps, messageId, null, who.id, note);
  } else if (action === "discard") {
    out = await discardMessage(service, deps, messageId, who.id);
  } else {
    return json({ error: "Unknown action." }, 400);
  }
  return out.ok ? json(out.body) : json({ error: out.error, code: out.code }, out.status);
}
