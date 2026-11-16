// invite-client emails the client of a broker-started intake the link to finish and certify it, and sends it again (slice 5.3; P-2.2, D-1711, D-1712; migration 20261123120000_broker_intake.sql).
// A member of the firm calls it with their own login. The database decides everything (who may invite, one waiting invitation per intake, which intakes) and is asked as the caller; this
// function does what SQL can't, as invite-member does: it makes the token, gives the database only its hash, and emails the link. The token travels in that one email, after the # of the link
// so no server sees it, and is not stored, returned or logged. It goes out through Nevermore's own sender, as "<Firm> via Nevermore", not through the firm's mailbox, so a firm with no
// mailbox connected can still start quotes (D-1712).

import { parseBaseUrl, parseFrom } from "../dispatch-outbox/config.ts";
import { escapeHtml, EMAIL_PATTERN, oneLine } from "../dispatch-outbox/messages.ts";
import { selectEmailAdapter, sendEmail, type EmailMessage } from "../dispatch-outbox/providers.ts";
import { firmBaseUrl } from "../invite-member/handler.ts";
import { bearerToken } from "../_shared/serviceAuth.ts";
import { UUID } from "../_shared/uuid.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** What a database refusal means to the broker, in words they can act on. */
function refusal(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "PT404": return { status: 404, error: "That intake isn't available." };
    case "PT409": return { status: 409, error: "This intake already has an invitation waiting. Remind them instead." };
    case "55000": return { status: 409, error: "This intake is closed, or already belongs to its employer." };
    case "PT423": return { status: 423, error: "This firm is closing and can't be changed." };
    case "42501": return { status: 403, error: "Only members of the firm can invite the client." };
    case "22023":
    case "23514": return { status: 400, error: "Check the email address." };
    default: return { status: 500, error: "Something went wrong. Try again." };
  }
}

/** The sender's own address with the firm's name in front: `<Firm> via Nevermore <address>`. A name can't carry brackets, quotes or line breaks, and is kept short. */
function senderFor(from: string, firmName: string): string {
  const address = from.match(/<([^<>\s]+)>$/)?.[1] ?? from;
  const name = oneLine(firmName.replace(/[<>"]/g, ""), 60) ?? "Your broker";
  return `${name} via Nevermore <${address}>`;
}

function inviteMessage(from: string, row: { email: string; contact_name: string | null; firm_name: string }, link: string, expiresAt: string, reminder: boolean): EmailMessage {
  const firm = oneLine(row.firm_name, 80) ?? "Your broker";
  const until = expiresAt.slice(0, 10);
  const hello = row.contact_name ? `Hello ${oneLine(row.contact_name, 100)},` : "Hello,";
  const subject = reminder ? `Reminder: ${firm} asked you to finish your PEO intake` : `${firm} asked you to finish your PEO intake`;
  const text = [
    hello,
    "",
    reminder
      ? `${firm} is waiting for you to review your PEO intake, finish it and certify it. This link replaces the one sent before.`
      : `${firm} has started your PEO intake and asks you to review it, finish it and certify it.`,
    "",
    "Open this link, then sign in or create your account with this email address:",
    link,
    "",
    `The link works once, and until ${until}. If you weren't expecting it, you can ignore this email.`,
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937;line-height:1.5">
<p>${escapeHtml(hello)}</p>
<p><strong>${escapeHtml(firm)}</strong> has started your PEO intake and asks you to review it, finish it and certify it.</p>
<p><a href="${escapeHtml(link)}">Open your intake</a></p>
<p>Sign in or create your account with this email address. The link works once, and until ${escapeHtml(until)}. If you weren't expecting it, you can ignore this email.</p>
</body></html>`;
  return { from, to: [row.email], subject, text, html };
}

export async function handleInviteClientRequest(req: Request, deps: InviteClientDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!bearerToken(authorization)) return json({ error: "Sign in to invite your client." }, 401);

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const remind = raw?.action === "remind";
  const intakeId = typeof raw?.intake_id === "string" && UUID.test(raw.intake_id) ? raw.intake_id : "";
  // The address is checked with the mail sender's own rule and kept in the form the database keeps it (lower case, no surrounding spaces), before anything is made: an address that could never
  // be emailed must not become the waiting invitation, which would block the corrected one.
  const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
  const name = typeof raw?.name === "string" ? oneLine(raw.name, 200) : null;
  if (!intakeId || (raw?.action !== "invite" && !remind) || (!remind && !(email.length <= 254 && EMAIL_PATTERN.test(email)))) {
    return json({ error: "That request is not valid." }, 400);
  }

  const url = deps.env("SUPABASE_URL");
  const anonKey = deps.env("SUPABASE_ANON_KEY");
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  const appBase = parseBaseUrl(deps.env("APP_BASE_URL"));
  const from = parseFrom(deps.env("EMAIL_FROM"));
  const adapter = selectEmailAdapter(deps.env);
  // Nothing is made that could not be sent: an invitation with no email to carry it would sit waiting for no reason.
  if (!url || !anonKey || !serviceKey || !appBase || !from || !adapter.ok) {
    deps.log("INVITE_CLIENT_CONFIG_MISSING: SUPABASE_*, APP_BASE_URL, EMAIL_FROM and the mail provider's key must all be set");
    return json({ error: "Invitations can't be emailed right now." }, 503);
  }

  const { token, hash } = await deps.newToken();
  const asCaller = deps.createClient(url, anonKey, { global: { headers: { Authorization: authorization! } } });
  const made = remind
    ? await asCaller.rpc("remind_intake_invite", { p_intake_id: intakeId, p_token_hash: hash })
    : await asCaller.rpc("invite_intake_client", { p_intake_id: intakeId, p_email: email, p_contact_name: name, p_token_hash: hash });
  if (made.error) {
    const r = refusal(made.error.code);
    deps.log(`INVITE_CLIENT_REFUSED action=${remind ? "remind" : "invite"} code=${made.error.code ?? "unknown"}`);
    return json({ error: r.error }, r.status);
  }
  const row = (Array.isArray(made.data) ? made.data[0] : made.data) as
    { invitation_id?: string; email?: string; contact_name?: string | null; firm_name?: string; firm_address?: string; expires_at?: string } | null;
  if (!row?.invitation_id || !row.email || !row.firm_address || !row.firm_name || !row.expires_at || !EMAIL_PATTERN.test(row.email)) {
    deps.log(`INVITE_CLIENT_FAILED action=${remind ? "remind" : "invite"} step=read_result`);
    return json({ error: "Something went wrong. Try again." }, 500);
  }

  const link = `${firmBaseUrl(appBase, row.firm_address)}/intake-invite#token=${token}`;
  const message = inviteMessage(senderFor(from, row.firm_name), { email: row.email, contact_name: row.contact_name ?? null, firm_name: row.firm_name }, link, row.expires_at, remind);
  // One key for this link: the provider treats a repeat of it as the same message, so trying again after an unclear answer can't deliver it twice. A reminder makes a new link, so a new key
  // (and never the token in it: only the start of its hash).
  const key = `intake-invitation:${row.invitation_id}:${hash.slice(0, 32)}`;
  let sent = await sendEmail(adapter.adapter, message, key, { fetch: deps.fetch });
  // An answer that does not prove the provider refused (a timeout, a network failure, most server errors) may follow an accepted message: it is tried once more, with the same message and key.
  if (!sent.ok && sent.ambiguous) sent = await sendEmail(adapter.adapter, message, key, { fetch: deps.fetch });
  const outcome = sent.ok ? "sent" : sent.ambiguous ? "unknown" : "failed";
  const asService = deps.createClient(url, serviceKey);
  await asService.rpc("record_intake_invite_delivery", { p_invitation_id: row.invitation_id, p_token_hash: hash, p_outcome: outcome, p_error: sent.ok ? null : sent.kind });
  return json({ ok: true, invitation_id: row.invitation_id, delivery: outcome });
}
