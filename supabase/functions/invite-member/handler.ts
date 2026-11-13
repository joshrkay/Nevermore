// invite-member sends an invitation to join a firm (story CRM-P1.2; migration 20261116190000_firm_invitations.sql). An owner
// calls it with their own login to invite an email address with a role, or to send an invitation again. The database decides
// everything (who may invite, one pending invitation per email, who is already a member) and is asked as the caller, so
// this function cannot be talked into doing more than the caller could. What it does is the part SQL can't: it makes the
// token, gives the database only the token's hash, and emails the link. The token travels in that one email and nowhere
// else: it is not stored, not returned to the caller and not logged, and it travels after the # of the link so no server sees it (D-34). The outcome of the send is recorded on the
// invitation (a time, or a short kind of failure), as the service role.
//
// It uses the same mail provider as the submission notifications (selectEmailAdapter, sendEmail) without touching how that
// pipeline works: that pipeline queues a payload in a row, and a link's token must not be kept in a row.

import { parseBaseUrl, parseFrom } from "../dispatch-outbox/config.ts";
import { escapeHtml, EMAIL_PATTERN, oneLine } from "../dispatch-outbox/messages.ts";
import { selectEmailAdapter, sendEmail, type EmailMessage } from "../dispatch-outbox/providers.ts";
import { bearerToken } from "../_shared/serviceAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

export interface InviteClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
}

export interface InviteDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers?: Record<string, string> } }) => InviteClient;
  fetch: typeof fetch;
  newToken: () => Promise<{ token: string; hash: string }>;
  log: (line: string) => void;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ROLES: readonly string[] = ["owner", "lead", "agent"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Request_ =
  | { action: "invite"; firmId: string; email: string; role: string; teamId: string | null }
  | { action: "resend"; invitationId: string };

function parseBody(raw: unknown): Request_ | "check_address_and_role" | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (b.action === "resend") {
    return typeof b.invitation_id === "string" && UUID.test(b.invitation_id) ? { action: "resend", invitationId: b.invitation_id } : null;
  }
  if (b.action === "invite") {
    const teamOk = b.team_id === undefined || b.team_id === null || (typeof b.team_id === "string" && UUID.test(b.team_id));
    // The address is checked with the mail sender's own rule and kept in the form the database keeps it (lower case, no
    // surrounding spaces), before anything is made: an address that could never be emailed must not become a pending
    // invitation, which would block the corrected one.
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    const addressOk = email.length <= 254 && EMAIL_PATTERN.test(email);
    if (typeof b.firm_id === "string" && UUID.test(b.firm_id) && teamOk) {
      if (!addressOk || typeof b.role !== "string" || !ROLES.includes(b.role)) return "check_address_and_role";
      return { action: "invite", firmId: b.firm_id, email, role: b.role, teamId: (b.team_id as string | null | undefined) ?? null };
    }
  }
  return null;
}

/** What a database refusal means to the caller. The database's own words are kept for the refusals an owner can act on. */
function refusal(code: string | undefined, message: string | undefined): { status: number; error: string } {
  switch (code) {
    case "42501": return { status: 403, error: "Only an owner of the firm can invite people." };
    case "PT409": return { status: 409, error: message || "That can't be done now." };
    case "PT410": return { status: 409, error: "That invitation has already been used or withdrawn." };
    case "PT403": return { status: 403, error: message || "This firm can't invite people." };
    case "23514":
    case "23502": return { status: 400, error: "Check the email address and the role." };
    case "23503": return { status: 400, error: "That team isn't in this firm." };
    default: return { status: 500, error: "Something went wrong. Try again." };
  }
}

/** Where a firm is reached, from the app's own address: `https://<address>.<its domain>`. A local or numeric host has no firm addresses, so the app's own origin is used. */
export function firmBaseUrl(appBaseUrl: string, address: string): string {
  const url = new URL(appBaseUrl);
  const local = url.hostname === "localhost" || /^[\d.]+$/.test(url.hostname) || url.hostname.endsWith(".localhost");
  if (local) return url.origin;
  return `${url.protocol}//${address}.${url.hostname.replace(/^www\./, "")}`;
}

function inviteMessage(from: string, to: string, firmName: string, link: string, expiresAt: string): EmailMessage {
  const firm = oneLine(firmName, 80) ?? "a firm";
  const until = expiresAt.slice(0, 10);
  const subject = `You're invited to join ${firm} on Nevermore`;
  const text = [
    `You've been invited to join ${firm} on Nevermore.`,
    "",
    "Open this link, then sign in or create your account with this email address:",
    link,
    "",
    `The link works once, and until ${until}. If you weren't expecting it, you can ignore this email.`,
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937;line-height:1.5">
<p>You've been invited to join <strong>${escapeHtml(firm)}</strong> on Nevermore.</p>
<p><a href="${escapeHtml(link)}">Accept the invitation</a></p>
<p>Sign in or create your account with this email address. The link works once, and until ${escapeHtml(until)}. If you weren't expecting it, you can ignore this email.</p>
</body></html>`;
  return { from, to: [to], subject, text, html };
}

export async function handleInviteRequest(req: Request, deps: InviteDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!bearerToken(authorization)) return json({ error: "Sign in to invite people." }, 401);

  const body = parseBody(await req.json().catch(() => null));
  if (body === "check_address_and_role") return json({ error: "Check the email address and the role." }, 400);
  if (!body) return json({ error: "That request is not valid." }, 400);

  const url = deps.env("SUPABASE_URL");
  const anonKey = deps.env("SUPABASE_ANON_KEY");
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  // The same rules as the dispatcher's own configuration: a sender that is an address, an app address that is https (plain http only
  // for localhost). A malformed value is found here, before a token is made, not after the invitation is committed.
  const appBase = parseBaseUrl(deps.env("APP_BASE_URL"));
  const from = parseFrom(deps.env("EMAIL_FROM"));
  const adapter = selectEmailAdapter(deps.env);
  // Nothing is made that could not be sent: an invitation with no email to carry it would sit as pending for no reason.
  if (!url || !anonKey || !serviceKey || !appBase || !from || !adapter.ok) {
    deps.log("INVITE_CONFIG_MISSING: SUPABASE_*, APP_BASE_URL, EMAIL_FROM and the mail provider's key must all be set");
    return json({ error: "Invitations can't be emailed right now." }, 503);
  }

  const { token, hash } = await deps.newToken();
  // Asked as the caller: the database checks that they own the firm.
  const asCaller = deps.createClient(url, anonKey, { global: { headers: { Authorization: authorization! } } });
  const made = body.action === "invite"
    ? await asCaller.rpc("invite_member", { p_firm_id: body.firmId, p_email: body.email, p_role: body.role, p_team_id: body.teamId, p_token_hash: hash })
    : await asCaller.rpc("resend_invitation", { p_invitation_id: body.invitationId, p_token_hash: hash });
  if (made.error) {
    const r = refusal(made.error.code, made.error.message);
    deps.log(`INVITE_REFUSED action=${body.action} code=${made.error.code ?? "unknown"}`);
    return json({ error: r.error }, r.status);
  }
  const row = (Array.isArray(made.data) ? made.data[0] : made.data) as
    { invitation_id?: string; email?: string; firm_name?: string; firm_address?: string; expires_at?: string } | null;
  if (!row?.invitation_id || !row.email || !row.firm_address || !EMAIL_PATTERN.test(row.email)) {
    deps.log(`INVITE_FAILED action=${body.action} step=read_result`);
    return json({ error: "Something went wrong. Try again." }, 500);
  }

  // The secret goes in the part after the #: a browser never sends it to a server, so it reaches no request log and no Referer (D-34).
  const link = `${firmBaseUrl(appBase, row.firm_address)}/join#token=${token}`;
  const message = inviteMessage(from, row.email, row.firm_name ?? "", link, row.expires_at ?? "");
  // One key for this link: the provider treats a repeat of it as the same message, so trying again after an unclear answer cannot
  // deliver it twice. A resend makes a new link, so a new key (and never the token in it: only the start of its hash).
  const key = `invitation:${row.invitation_id}:${hash.slice(0, 32)}`;
  let sent = await sendEmail(adapter.adapter, message, key, { fetch: deps.fetch });
  // An answer that does not prove the provider refused (a timeout, a network failure, most server errors) may follow an accepted
  // message: it is tried once more, with the same message and key, which the provider drops if the first was accepted.
  if (!sent.ok && sent.ambiguous) sent = await sendEmail(adapter.adapter, message, key, { fetch: deps.fetch });
  const outcome = sent.ok ? "sent" : sent.ambiguous ? "unknown" : "failed";

  // Recorded against this link: a result that arrives after the invitation was sent again is not the current link's, and is dropped.
  const asService = deps.createClient(url, serviceKey);
  const recorded = await asService.rpc("record_invitation_delivery", {
    p_invitation_id: row.invitation_id,
    p_token_hash: hash,
    p_outcome: outcome,
    p_error: sent.ok ? null : sent.kind,
  });
  if (recorded.error) deps.log(`INVITE_FAILED action=${body.action} step=record_delivery code=${recorded.error.code ?? "unknown"}`);
  if (!sent.ok) deps.log(`INVITE_EMAIL_${outcome === "unknown" ? "UNCLEAR" : "FAILED"} action=${body.action} kind=${sent.kind}`);
  return json({ ok: true, invitation_id: row.invitation_id, delivery: outcome });
}
