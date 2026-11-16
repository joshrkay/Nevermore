// invite-client emails the client of a broker-started intake the link to finish and certify it, and sends it again (slice 5.3; P-2.2, D-1711, D-1712).

import { EMAIL_PATTERN, escapeHtml, oneLine } from "../dispatch-outbox/messages.ts";
import { firmBaseUrl } from "../invite-member/handler.ts";
import { UUID } from "../_shared/uuid.ts";
import { bearerToken } from "../_shared/serviceAuth.ts";
import { parseBaseUrl, parseFrom } from "../dispatch-outbox/config.ts";
import { selectEmailAdapter, sendEmail } from "../dispatch-outbox/providers.ts";

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

export interface InviteClientClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
}

export interface InviteClientDeps {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options?: { global?: { headers?: Record<string, string> } }) => InviteClientClient;
  fetch: typeof fetch;
  newToken: () => Promise<{ token: string; hash: string }>;
  log: (line: string) => void;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** What a database refusal means to the broker, in words they can act on. */
function refusal(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "PT409": return { status: 409, error: "This intake already has an invitation waiting. Remind them instead." };
    case "55000": return { status: 409, error: "This intake is closed, or already belongs to its employer." };
    case "PT423": return { status: 423, error: "This firm is closing and can't be changed." };
    case "42501": return { status: 403, error: "Only members of the firm can invite the client." };
    case "22023":
    case "23514": return { status: 400, error: "Check the email address." };
    case "PT404": return { status: 404, error: "That intake isn't available." };
    default: return { status: 500, error: "Something went wrong. Try again." };
  }
}

/** The sender's own address with the firm's name in front: `<Firm> via Nevermore <address>`. */
function senderFor(from: string, firmName: string): string {
  const address = from.match(/<([^<>\s]+)>$/)?.[1] ?? from;
  return `${oneLine(firmName.replace(/[<>"]/g, ""), 60)} via Nevermore <${address}>`;
}

export async function handleInviteClientRequest(req: Request, deps: InviteClientDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!bearerToken(req.headers.get("Authorization"))) return json({ error: "Sign in to invite your client." }, 401);
  const raw = ((await req.json().catch(() => null)) ?? {}) as { action: string; intake_id: string; email: string; name?: string };
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if ((raw.action !== "invite" && raw.action !== "remind") || !UUID.test(raw.intake_id) || (raw.action !== "remind" && !(email.length <= 254 && EMAIL_PATTERN.test(email)))) return json({ error: "That request is not valid." }, 400);
  const adapter = selectEmailAdapter(deps.env);
  const appBase = parseBaseUrl(deps.env("APP_BASE_URL"));
  const from = parseFrom(deps.env("EMAIL_FROM"));
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  const url = deps.env("SUPABASE_URL");
  const anonKey = deps.env("SUPABASE_ANON_KEY");
  if (!url || !anonKey || !appBase || !from || !serviceKey || !adapter.ok) {
    deps.log("INVITE_CLIENT_CONFIG_MISSING: SUPABASE_*, APP_BASE_URL, EMAIL_FROM and the mail provider's key must all be set");
    return json({ error: "Invitations can't be emailed right now." }, 503);
  }
  const { token, hash } = await deps.newToken();
  const asCaller = deps.createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });
  const made = raw.action === "remind"
    ? await asCaller.rpc("remind_intake_invite", { p_intake_id: raw.intake_id, p_token_hash: hash })
    : await asCaller.rpc("invite_intake_client", { p_intake_id: raw.intake_id, p_email: email, p_contact_name: oneLine(raw.name, 200), p_token_hash: hash });
  if (made.error) {
    const r = refusal(made.error.code);
    deps.log(`INVITE_CLIENT_REFUSED action=${raw.action} code=${made.error.code ?? "unknown"}`);
    return json({ error: r.error }, r.status);
  }
  const row = (Array.isArray(made.data) ? made.data[0] : made.data) as { invitation_id?: string; email?: string; firm_address?: string; firm_name?: string; contact_name?: string | null; expires_at?: string } | null;
  if (!row?.invitation_id || !row.email || !row.firm_address || !row.firm_name || !row.expires_at || !EMAIL_PATTERN.test(row.email)) {
    deps.log(`INVITE_CLIENT_FAILED action=${raw.action} step=read_result`);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
  const link = `${firmBaseUrl(appBase, row.firm_address)}/intake-invite#token=${token}`;
  const remind = raw.action === "remind";
  const hello = row.contact_name ? `Hello ${oneLine(row.contact_name, 100)},` : "Hello,";
  const until = "The link works once, and until " + row.expires_at.slice(0, 10) + ".";
  const text = [hello, "", remind ? "This link replaces the one sent before." : "", link, "", until].join("\n");
  const html = `<p>${escapeHtml(hello)}</p><p><strong>${escapeHtml(oneLine(row.firm_name, 80) ?? "")}</strong> has started your PEO intake.</p><p><a href="${link}">Open your intake</a></p><p>${until}</p>`;
  const message = { from: senderFor(from, row.firm_name), to: [row.email], subject: `${remind ? "Reminder: " : ""}${oneLine(row.firm_name, 80)} asked you to finish your PEO intake`, text, html };
  const key = `intake-invitation:${row.invitation_id}:${hash.slice(0, 32)}`;
  let sent = await sendEmail(adapter.adapter, message, key, { fetch: deps.fetch });
  if (!sent.ok && sent.ambiguous) sent = await sendEmail(adapter.adapter, message, key, { fetch: deps.fetch });
  const outcome = sent.ok ? "sent" : sent.ambiguous ? "unknown" : "failed";
  const asService = deps.createClient(url, serviceKey);
  await asService.rpc("record_intake_invite_delivery", { p_invitation_id: row.invitation_id, p_token_hash: hash, p_outcome: outcome, p_error: sent.ok ? null : sent.kind });
  return json({ ok: true, invitation_id: row.invitation_id, delivery: outcome });
}
