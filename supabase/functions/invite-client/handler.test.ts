import { describe, expect, it, vi } from "vitest";
import { handleInviteClientRequest, type InviteClientClient, type InviteClientDeps } from "./handler";

const SERVICE = "service-key-abc";
const USER_JWT = "user-jwt-xyz";
const TOKEN = "TOKEN-made-by-the-function-0123456789abcdefg";
const HASH = "c0ffee".padEnd(64, "0");
const INTAKE = "33333333-3333-4333-8333-333333333333";
const INVITATION = "22222222-2222-4222-8222-222222222222";
const ENV: Record<string, string> = {
  SUPABASE_URL: "https://p.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  RESEND_API_KEY: "re_key",
  EMAIL_FROM: "Nevermore <hello@mail.nevermorepeo.com>",
  APP_BASE_URL: "https://nevermorepeo.com",
};

type Rpc = { data?: unknown; error?: { code?: string; message?: string } | null };
type Provider = { status: number; body?: unknown } | "network";
interface Options {
  env?: Record<string, string | undefined>;
  rpc?: Record<string, Rpc>;
  provider?: Provider | Provider[];
}

// What the database answers for an invitation it made: the firm's own words, never the token.
const made = {
  invitation_id: INVITATION, email: "lucia@client.test", contact_name: "Lucia Perez", firm_name: "Acme <Brokers>", firm_address: "acme-brokers", expires_at: "2026-12-04T10:00:00Z",
};

// The seams are the request in, the database (as the caller or as the service role) and the mail provider out, all faked.
function setup(o: Options = {}) {
  const calls: { as: "user" | "service"; fn: string; args: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const sent: { url: string; headers: Record<string, string>; body: { to: string[]; subject: string; text: string; html: string; from: string } }[] = [];
  const client = (as: "user" | "service"): InviteClientClient => ({
    rpc: async (fn, args) => {
      calls.push({ as, fn, args });
      const r = o.rpc?.[fn] ?? { data: fn === "record_intake_invite_delivery" ? true : [made] };
      return { data: r.data ?? null, error: r.error ?? null };
    },
  });
  let attempts = 0;
  const fetchFake = vi.fn(async (url: string, init: RequestInit) => {
    const plan = Array.isArray(o.provider) ? o.provider : [o.provider ?? { status: 200, body: { id: "msg_1" } }];
    const p = plan[Math.min(attempts++, plan.length - 1)];
    sent.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    if (p === "network") throw new Error("down");
    return new Response(JSON.stringify(p.body ?? {}), { status: p.status });
  });
  const createClient = vi.fn((_url: string, key: string, _opts?: unknown) => client(key === SERVICE ? "service" : "user"));
  const deps: InviteClientDeps = {
    env: (n) => (o.env ?? ENV)[n],
    createClient,
    fetch: fetchFake as unknown as typeof fetch,
    newToken: async () => ({ token: TOKEN, hash: HASH }),
    log: (l) => logs.push(l),
  };
  return { deps, calls, logs, sent, createClient };
}

const post = (body: unknown, auth: string | null = `Bearer ${USER_JWT}`) =>
  new Request("https://f.example/invite-client", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
const invite = { action: "invite", intake_id: INTAKE, email: "Lucia@Client.Test", name: "Lucia Perez" };

describe("inviting the client to finish and certify (request and response)", () => {
  // Break caught: an invitation is made but the answer doesn't say so, or doesn't carry the invitation's id for the broker's screen.
  it("makes the invitation, emails it and answers its id and that it was sent", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, invitation_id: INVITATION, delivery: "sent" });
  });

  // Break caught: the database is asked as the service role (so any caller could invite for any firm), or is given the token itself, or the address as typed.
  it("asks the database as the caller, with the token's hash and the address in the form the database keeps", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    const asked = t.calls.find((c) => c.fn === "invite_intake_client")!;
    expect(asked.as).toBe("user");
    expect(asked.args).toEqual({ p_intake_id: INTAKE, p_email: "lucia@client.test", p_contact_name: "Lucia Perez", p_token_hash: HASH });
  });

  // Break caught: the link goes to the bare domain instead of the firm's own address, or the secret sits in the part of the link a server sees, or the mail goes to an address the database did not keep.
  it("emails the address the database kept a link at the firm's address, with the secret after the #", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].body.to).toEqual(["lucia@client.test"]);
    expect(t.sent[0].body.text).toContain(`https://acme-brokers.nevermorepeo.com/intake-invite#token=${TOKEN}`);
    expect(t.sent[0].body.html).toContain(`https://acme-brokers.nevermorepeo.com/intake-invite#token=${TOKEN}`);
  });
});
describe("Remind (request and response)", () => {
  // Break caught: Remind goes out under the old link (the old token reused), or is asked as the service role, or names the invite function (which the database refuses as a second invitation).
  it("makes a new token and asks the database as the caller to replace the old link", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post({ action: "remind", intake_id: INTAKE }), t.deps);
    expect(res.status).toBe(200);
    const asked = t.calls.find((c) => c.fn === "remind_intake_invite")!;
    expect(asked.as).toBe("user");
    expect(asked.args).toEqual({ p_intake_id: INTAKE, p_token_hash: HASH });
    expect(t.calls.some((c) => c.fn === "invite_intake_client")).toBe(false);
  });

  // Break caught: a reminder reads like the first invitation (the client doesn't know the old link is dead), or carries no link.
  it("emails the new link under a subject that says it is a reminder", async () => {
    const t = setup();
    await handleInviteClientRequest(post({ action: "remind", intake_id: INTAKE }), t.deps);
    expect(t.sent[0].body.text).toContain(`#token=${TOKEN}`);
    expect(t.sent[0].body.subject).toMatch(/^Reminder: /);
    expect(t.sent[0].body.text).toMatch(/replaces the one sent before/);
  });
});
describe("what the email says", () => {
  // Break caught: the client can't tell from the subject whose intake it is.
  it("names the firm in the subject of an invitation", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent[0].body.subject).toBe("Acme <Brokers> asked you to finish your PEO intake");
  });

  // Break caught: the mail doesn't say it is for the person it was made for.
  it("greets the contact by name", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent[0].body.text.startsWith("Hello Lucia Perez,")).toBe(true);
  });

  // Break caught: an invitation with no name greets "Hello null,".
  it("greets plainly when the invitation has no name", async () => {
    const t = setup({ rpc: { invite_intake_client: { data: [{ ...made, contact_name: null }] } } });
    await handleInviteClientRequest(post({ ...invite, name: undefined }), t.deps);
    expect(t.sent[0].body.text.startsWith("Hello,\n")).toBe(true);
  });

  // Break caught: the client isn't told the link works once, or until when, and tries it after it has lapsed.
  it("says the link works once and until the day the database gave", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent[0].body.text).toContain("The link works once, and until 2026-12-04.");
    expect(t.sent[0].body.html).toContain("The link works once, and until 2026-12-04.");
  });

  // Break caught: the firm's name, which a firm typed, goes into the html as markup.
  it("names the firm in the html with its name escaped", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent[0].body.html).toContain("Acme &lt;Brokers&gt;");
    expect(t.sent[0].body.html).not.toContain("<Brokers>");
  });

  // Break caught: the contact's name, which a broker typed, goes into the html as markup.
  it("escapes the contact's name in the html", async () => {
    const t = setup({ rpc: { invite_intake_client: { data: [{ ...made, contact_name: "Lucia <img src=x>" }] } } });
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent[0].body.html).toContain("Hello Lucia &lt;img src=x&gt;,");
    expect(t.sent[0].body.html).not.toContain("<img");
  });

  // Break caught: the mail looks as if it came from Nevermore alone (the client can't tell whose intake it is), or carries the firm's brackets into a header.
  it("comes from \"<Firm> via Nevermore\" at Nevermore's own sender address, with the firm's name cleaned", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent[0].body.from).toBe("Acme Brokers via Nevermore <hello@mail.nevermorepeo.com>");
  });

  // Break caught: a firm name with a line break adds a header (a Bcc) to the mail.
  it("keeps a firm name with a line break on one line in the sender", async () => {
    const t = setup({ rpc: { invite_intake_client: { data: [{ ...made, firm_name: "Acme\r\nBcc: x@y.test" }] } } });
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent[0].body.from).not.toMatch(/[\r\n]/);
    expect(t.sent[0].body.from).toBe("Acme Bcc: x@y.test via Nevermore <hello@mail.nevermorepeo.com>");
  });
});
describe("sending the link", () => {
  // Break caught: how the send went is never recorded (the broker's step shows a link as sent that was refused), or is recorded against another link, or as the caller.
  it("records a refused send, as the service role, against this link", async () => {
    const t = setup({ provider: { status: 422, body: { message: "rejected" } } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(await res.json()).toMatchObject({ ok: true, delivery: "failed" });
    const recorded = t.calls.find((c) => c.fn === "record_intake_invite_delivery")!;
    expect(recorded.as).toBe("service");
    expect(recorded.args).toEqual({ p_invitation_id: INVITATION, p_token_hash: HASH, p_outcome: "failed", p_error: "provider_error" });
  });

  // Break caught: a send that went is recorded with an error, or not recorded at all (the broker's step never shows it as sent).
  it("records a send that went as sent, with no error", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    const recorded = t.calls.find((c) => c.fn === "record_intake_invite_delivery")!;
    expect(recorded.args).toEqual({ p_invitation_id: INVITATION, p_token_hash: HASH, p_outcome: "sent", p_error: null });
  });

  // Break caught: an unclear answer from the provider is given up on (the client never hears), or tried again with another key (they hear twice).
  it("tries once more after an unclear answer, with the same message and key", async () => {
    const t = setup({ provider: ["network", { status: 200, body: { id: "msg_2" } }] });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(await res.json()).toMatchObject({ delivery: "sent" });
    expect(t.sent).toHaveLength(2);
    expect(t.sent[1].headers["Idempotency-Key"]).toBe(t.sent[0].headers["Idempotency-Key"]);
    expect(t.sent[1].body).toEqual(t.sent[0].body);
  });

  // Break caught: a send that may have gone is reported as refused, and the broker sends it again (the client hears twice) when it should be told it may have gone.
  it("says unknown, and records unknown, when both attempts were unclear", async () => {
    const t = setup({ provider: "network" });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(await res.json()).toMatchObject({ ok: true, delivery: "unknown" });
    expect(t.calls.find((c) => c.fn === "record_intake_invite_delivery")!.args).toMatchObject({ p_outcome: "unknown", p_error: "network" });
  });

  // Break caught: a refusal that proves nothing was sent is sent again anyway (a second attempt for no reason, and against a provider that is rate-limiting).
  it("does not try again after a refusal that proves nothing was sent", async () => {
    const t = setup({ provider: { status: 422, body: { message: "rejected" } } });
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.sent).toHaveLength(1);
  });
});
describe("what is refused before anything is made", () => {
  // Break caught: a request with no login reaches the database, or makes a token and sends mail.
  it("refuses a call with no login (401) and makes and sends nothing", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post(invite, null), t.deps);
    expect(res.status).toBe(401);
    expect(t.calls).toEqual([]);
    expect(t.sent).toEqual([]);
  });

  // Break caught: an intake id that isn't one is sent on to the database.
  it("refuses an intake id that isn't one (400)", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post({ ...invite, intake_id: "not-an-id" }), t.deps);
    expect(res.status).toBe(400);
    expect(t.calls).toEqual([]);
  });

  // Break caught: an address that could never be emailed becomes the waiting invitation, which blocks the corrected one (one waiting invitation per intake).
  it("refuses an address that could never be emailed (400) before anything is made", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post({ ...invite, email: "not an address" }), t.deps);
    expect(res.status).toBe(400);
    expect(t.calls).toEqual([]);
    expect(t.sent).toEqual([]);
  });

  // Break caught: a request that names no action is treated as an invitation.
  it("refuses a request with no action (400)", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post({ intake_id: INTAKE, email: "lucia@client.test" }), t.deps);
    expect(res.status).toBe(400);
    expect(t.calls).toEqual([]);
  });

  // Break caught: a body that isn't JSON crashes the function instead of being refused.
  it("refuses a body that isn't JSON (400)", async () => {
    const t = setup();
    const req = new Request("https://f.example/invite-client", { method: "POST", headers: { Authorization: `Bearer ${USER_JWT}` }, body: "not json" });
    const res = await handleInviteClientRequest(req, t.deps);
    expect(res.status).toBe(400);
    expect(t.calls).toEqual([]);
  });

  // Break caught: a remind with no intake is sent on to the database.
  it("refuses a remind with no intake (400)", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post({ action: "remind" }), t.deps);
    expect(res.status).toBe(400);
    expect(t.calls).toEqual([]);
  });

  // Break caught: an invitation is made that no email can carry, so it sits waiting and blocks the corrected one.
  it("makes nothing when the mail provider isn't set up (503)", async () => {
    const t = setup({ env: { ...ENV, RESEND_API_KEY: undefined } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.calls).toEqual([]);
  });

  // Break caught: a function that can't send says nothing in the log, so the missing setting is never found.
  it("logs what is missing when it can't send", async () => {
    const t = setup({ env: { ...ENV, RESEND_API_KEY: undefined } });
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.logs.join("\n")).toContain("INVITE_CLIENT_CONFIG_MISSING");
  });

  // Break caught: with no address for the app the link can't be made, and the function fails after the invitation was already made.
  it("makes nothing when the app's address isn't set (503)", async () => {
    const t = setup({ env: { ...ENV, APP_BASE_URL: undefined } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.calls).toEqual([]);
  });

  // Break caught: with no (or a malformed) sender address the mail can't be sent, and the function fails after the invitation was made.
  it("makes nothing when the sender address isn't set or isn't an address (503)", async () => {
    const t = setup({ env: { ...ENV, EMAIL_FROM: "not an address" } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.calls).toEqual([]);
  });

  // Break caught: with no service-role key the delivery can't be recorded, and the invitation is made and mailed with its outcome lost.
  it("makes nothing when the service-role key isn't set (503)", async () => {
    const t = setup({ env: { ...ENV, SUPABASE_SERVICE_ROLE_KEY: undefined } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.calls).toEqual([]);
    expect(t.sent).toEqual([]);
  });

  // Break caught: with no project address the database can't be reached, and the function answers a crash.
  it("answers 503 when the project's address isn't set", async () => {
    const t = setup({ env: { ...ENV, SUPABASE_URL: undefined } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.createClient).not.toHaveBeenCalled();
  });

  // Break caught: with no anon key the database is asked with no key at all, and refuses in a way that reads as the broker's fault.
  it("answers 503 when the anon key isn't set", async () => {
    const t = setup({ env: { ...ENV, SUPABASE_ANON_KEY: undefined } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(503);
    expect(t.calls).toEqual([]);
  });
});
describe("what the database refuses", () => {
  const refused = (code: string) => setup({ rpc: { invite_intake_client: { error: { code, message: "db words" } } } });

  // Break caught: an intake of another firm (or one that isn't there) is told apart from the other, or becomes a 500 the broker can't act on; or the link is emailed although the database refused it.
  it("answers PT404 as 404, in words, and emails nothing", async () => {
    const t = refused("PT404");
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("That intake isn't available.");
    expect(t.sent).toEqual([]);
    expect(t.calls.some((c) => c.fn === "record_intake_invite_delivery")).toBe(false);
  });

  // Break caught: a second invitation reads as "not available", so the broker never learns to use Remind.
  it("answers PT409 as 409 and says to remind them instead", async () => {
    const res = await handleInviteClientRequest(post(invite), refused("PT409").deps);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("This intake already has an invitation waiting. Remind them instead.");
  });

  // Break caught: a closed intake, or one that already has its employer, reads as "not available" and the broker tries another address.
  it("answers 55000 as 409 and says the intake is closed or already belongs to its employer", async () => {
    const res = await handleInviteClientRequest(post(invite), refused("55000").deps);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("This intake is closed, or already belongs to its employer.");
  });

  // Break caught: a closing firm's refusal reads as "not available".
  it("answers PT423 as 423 and says the firm is closing", async () => {
    const res = await handleInviteClientRequest(post(invite), refused("PT423").deps);
    expect(res.status).toBe(423);
    expect(((await res.json()) as { error: string }).error).toBe("This firm is closing and can't be changed.");
  });

  // Break caught: a caller who isn't a member of the firm is told the intake isn't available, and a broker without rights doesn't learn why.
  it("answers 42501 as 403 and says only members of the firm can invite", async () => {
    const res = await handleInviteClientRequest(post(invite), refused("42501").deps);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("Only members of the firm can invite the client.");
  });

  // Break caught: an address the database refuses (22023) is a 404 about the intake.
  it("answers 22023 as 400 and says to check the email address", async () => {
    const res = await handleInviteClientRequest(post(invite), refused("22023").deps);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("Check the email address.");
  });

  // Break caught: the database's check constraint on the address (23514) is a 404 about the intake.
  it("answers 23514 as 400 and says to check the email address", async () => {
    const res = await handleInviteClientRequest(post(invite), refused("23514").deps);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("Check the email address.");
  });

  // Break caught: a failure nobody planned for is blamed on the intake (404), so the broker looks for the wrong problem.
  it("answers anything else as a 500 to try again", async () => {
    const t = setup({ rpc: { remind_intake_invite: { error: { code: "XX000", message: `boom ${TOKEN}` } } } });
    const res = await handleInviteClientRequest(post({ action: "remind", intake_id: INTAKE }), t.deps);
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toBe("Something went wrong. Try again.");
  });

  // Break caught: a database error that quotes the request puts the token (or an address) in the log.
  it("logs the action and the code of a refusal and nothing the database said", async () => {
    const t = setup({ rpc: { remind_intake_invite: { error: { code: "XX000", message: `boom ${TOKEN} lucia@client.test` } } } });
    await handleInviteClientRequest(post({ action: "remind", intake_id: INTAKE }), t.deps);
    expect(t.logs).toEqual(["INVITE_CLIENT_REFUSED action=remind code=XX000"]);
  });

  // Break caught: an answer with no invitation in it crashes the function, or is emailed as an invitation with holes in it.
  it("answers 500 and sends nothing when the database's answer is missing what the email needs", async () => {
    const t = setup({ rpc: { invite_intake_client: { data: [{ invitation_id: INVITATION, email: "lucia@client.test" }] } } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(500);
    expect(t.sent).toEqual([]);
  });

  // Break caught: a malformed address in the database's answer is mailed anyway.
  it("answers 500 and sends nothing when the address the database kept can't be emailed", async () => {
    const t = setup({ rpc: { invite_intake_client: { data: [{ ...made, email: "not an address" }] } } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.status).toBe(500);
    expect(t.sent).toEqual([]);
  });

  // Break caught: an unreadable answer leaves nothing in the log to find it by.
  it("logs that it could not read the database's answer, with no address in it", async () => {
    const t = setup({ rpc: { invite_intake_client: { data: [{ invitation_id: INVITATION, email: "lucia@client.test" }] } } });
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.logs).toEqual(["INVITE_CLIENT_FAILED action=invite step=read_result"]);
  });

  // Break caught: a browser's preflight is refused, so no page can call the function.
  it("answers a browser's preflight with the headers it needs", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(new Request("https://f.example/invite-client", { method: "OPTIONS" }), t.deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
    expect(t.calls).toEqual([]);
  });

  // Break caught: the answer carries no origin header, so the page can't read the broker's refusal or success.
  it("lets the page read its answers", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  // Break caught: a GET is read as a request (and, with a login, made an invitation of an empty body).
  it("refuses any method but POST (405)", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(new Request("https://f.example/invite-client", { method: "GET", headers: { Authorization: `Bearer ${USER_JWT}` } }), t.deps);
    expect(res.status).toBe(405);
    expect(t.calls).toEqual([]);
  });

  // Break caught: the caller's login isn't passed to the database (so its checks of who may invite see no one), or the service key is used for the caller's questions.
  it("asks the database with the caller's own login and the anon key, never the service key", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    expect(t.createClient.mock.calls[0]).toEqual(["https://p.supabase.co", "anon", { global: { headers: { Authorization: `Bearer ${USER_JWT}` } } }]);
  });

  // Break caught: the one secret the link carries leaks into the answer or the log (on the path where the provider fails, which is the one that logs).
  it("never returns or logs the token", async () => {
    const t = setup({ provider: { status: 500 } });
    const res = await handleInviteClientRequest(post(invite), t.deps);
    expect(JSON.stringify(await res.json())).not.toContain(TOKEN);
    expect(t.logs.join("\n")).not.toContain(TOKEN);
  });

  // Break caught: a reminder (a new link on the same intake) is sent under the first email's key, which the provider treats as the same message and never delivers.
  it("sends each link under its own key, made from the link's hash and never from the token", async () => {
    const t = setup();
    await handleInviteClientRequest(post(invite), t.deps);
    const key = t.sent[0].headers["Idempotency-Key"];
    expect(key).toBe(`intake-invitation:${INVITATION}:${HASH.slice(0, 32)}`);
    expect(key).not.toContain(TOKEN);
  });

  // Break caught: a name with line breaks, or an enormous one, is stored as typed and later put into a mail's greeting.
  it("gives the database the contact's name on one line and capped", async () => {
    const t = setup();
    await handleInviteClientRequest(post({ ...invite, name: `Lucia\nPerez ${"x".repeat(300)}` }), t.deps);
    const name = t.calls.find((c) => c.fn === "invite_intake_client")!.args.p_contact_name as string;
    expect(name.startsWith("Lucia Perez x")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(200);
  });

  // Break caught: an address too long to be one passes the pattern and reaches the database.
  it("refuses an address longer than 254 characters (400)", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post({ ...invite, email: `${"a".repeat(250)}@client.test` }), t.deps);
    expect(res.status).toBe(400);
    expect(t.calls).toEqual([]);
  });

  // Break caught: an address that isn't text (a number, a list) crashes the function instead of being refused.
  it("refuses an address that isn't text (400)", async () => {
    const t = setup();
    const res = await handleInviteClientRequest(post({ ...invite, email: 12345 }), t.deps);
    expect(res.status).toBe(400);
  });
});
