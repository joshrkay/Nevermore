// send-mail through its request and response (D-13 seam 4): the database is a fake that answers the function's own calls, and Google and
// Microsoft are faked at fetch, the HTTP seam. Each test names the break it catches.
import { describe, expect, it, vi } from "vitest";
import { MAILBOX_PROBLEMS } from "../_shared/mailbox";
import { parseTokenKey, sealToken } from "../_shared/mailboxCrypto";
import { GOOGLE_SEND_SCOPE, MICROSOFT_SEND_SCOPE } from "../_shared/mailboxScopes";
import { handleSendMailRequest, type SendMailClient, type SendMailDeps } from "./handler";

const KEY_B64 = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 7)));
const KEY = parseTokenKey(KEY_B64)!;
const ENV: Record<string, string> = {
  SUPABASE_URL: "https://p.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service-key", MAILBOX_TOKEN_KEY: KEY_B64,
  GOOGLE_OAUTH_CLIENT_ID: "gid", GOOGLE_OAUTH_CLIENT_SECRET: "gsecret", MICROSOFT_OAUTH_CLIENT_ID: "mid", MICROSOFT_OAUTH_CLIENT_SECRET: "msecret",
  QUOTE_REPLY_DOMAIN: "replies.nevermore.example",
};
const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

/** A message as claim_conversation_mail answers it. */
const MESSAGE = {
  id: "11111111-1111-4111-8111-111111111111",
  conversation_id: "22222222-2222-4222-8222-222222222222",
  direction: "outbound",
  from_address: "agent1@acme.example",
  to_addresses: ["lucia@reyes.example"],
  cc_addresses: [] as string[],
  subject: "Your renewal",
  body_text: "Hi Lucia,\nShall we talk?",
  message_id: "<11111111-1111-4111-8111-111111111111@acme.example>",
  in_reply_to: null as string | null,
  message_references: [] as string[],
  sender_id: "u1",
  status: "queued",
  reply_address: "c.reyesbakerysons.0123456789abcdef",
};

interface Options {
  env?: Record<string, string | undefined>;
  claimed?: { event_id: string; attempt: number; message: Record<string, unknown> }[];
  provider?: "google" | "microsoft";
  /** The mailbox row the database holds for the sender; null for none. */
  mailbox?: Record<string, unknown> | null;
  user?: { id: string; is_anonymous?: boolean } | null;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
}

async function setup(o: Options = {}) {
  const provider = o.provider ?? "google";
  const sealed = await sealToken(KEY, "u1", "refresh-token");
  const mailbox = o.mailbox === undefined
    ? { provider, address: "agent1@acme.example", scope: provider === "google" ? GOOGLE_SEND_SCOPE : MICROSOFT_SEND_SCOPE, token_ciphertext: sealed.ciphertext, token_iv: sealed.iv }
    : o.mailbox;
  const calls: [string, Record<string, unknown>][] = [];
  const logs: string[] = [];
  const service: SendMailClient = {
    rpc: async (fn, args) => {
      calls.push([fn, args]);
      if (fn === "claim_conversation_mail") return { data: o.claimed ?? [{ event_id: "e1", attempt: 1, message: MESSAGE }], error: null };
      if (fn === "mailbox_secret") return { data: mailbox, error: null };
      if (fn === "complete_conversation_mail" || fn === "fail_conversation_mail") return { data: true, error: null };
      return { data: null, error: null };
    },
    auth: { getUser: async () => ({ data: { user: null } }) },
  };
  const caller: SendMailClient = {
    rpc: async () => ({ data: null, error: null }),
    auth: { getUser: async () => ({ data: { user: o.user === undefined ? { id: "u1", is_anonymous: false } : o.user } }) },
  };
  const fetchFn = vi.fn(o.fetch ?? (async (url: string) => {
    if (url.includes("oauth2") || url.includes("login.microsoftonline.com")) {
      return reply(200, { access_token: "at", expires_in: 3600, scope: provider === "google" ? GOOGLE_SEND_SCOPE : MICROSOFT_SEND_SCOPE });
    }
    if (url.includes("gmail.googleapis.com")) return reply(200, { id: "gmail-18c2f", threadId: "t1" });
    if (url.includes("graph.microsoft.com")) return reply(202);
    return reply(404, {});
  }));
  const deps: SendMailDeps = {
    env: (n) => (o.env ?? ENV)[n],
    createClient: (_url, key) => (key === "service-key" ? service : caller),
    fetch: fetchFn as unknown as SendMailDeps["fetch"],
    now: () => new Date("2026-11-16T15:04:05Z"),
    log: (l) => logs.push(l),
  };
  return { deps, calls, logs, fetchFn };
}

const post = (token: string | null = "service-key", method = "POST") =>
  new Request("https://x.example/send-mail", { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, body: method === "POST" ? "{}" : undefined });

describe("send-mail: who may call", () => {
  // Break caught: anyone on the internet driving sends, or a guest token working the queue.
  it("answers preflights, refuses other methods, no login and a guest, and works for the service role and a signed-in person", async () => {
    const s = await setup();
    expect((await handleSendMailRequest(post(null, "OPTIONS"), s.deps)).status).toBe(204);
    expect((await handleSendMailRequest(post("x", "GET"), s.deps)).status).toBe(405);
    expect((await handleSendMailRequest(post(null), s.deps)).status).toBe(401);
    expect((await handleSendMailRequest(post("guest-jwt"), (await setup({ user: { id: "g", is_anonymous: true } })).deps)).status).toBe(401);
    expect((await handleSendMailRequest(post("nobody-jwt"), (await setup({ user: null })).deps)).status).toBe(401);
    expect(s.calls.length).toBe(0);
    expect((await handleSendMailRequest(post("service-key"), s.deps)).status).toBe(200);
    expect((await handleSendMailRequest(post("person-jwt"), (await setup()).deps)).status).toBe(200);
  });
});

/** The raw message Gmail was asked to send, decoded, with its headers by name and its body. */
function gmailRaw(fetchFn: ReturnType<typeof vi.fn>) {
  const call = fetchFn.mock.calls.find(([url]) => String(url).includes("gmail.googleapis.com"));
  if (!call) throw new Error("Gmail was not asked to send");
  const raw = JSON.parse(String((call[1] as RequestInit).body)).raw as string;
  const text = new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
  return { call, text, ...splitMessage(text) };
}

function splitMessage(text: string) {
  const [head, ...rest] = text.split("\r\n\r\n");
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r\n[ \t]/g, " ").split("\r\n")) {
    const i = line.indexOf(":");
    headers.set(line.slice(0, i).toLowerCase(), line.slice(i + 1).trim());
  }
  return { headers, body: rest.join("\r\n\r\n") };
}

const decodeBase64Body = (body: string) => new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\r\n/g, "")), (c) => c.charCodeAt(0)));

describe("send-mail: its settings", () => {
  // Break caught: messages claimed (and their attempts spent) while the reply domain or the mailbox key is missing, or a setting's value in the logs.
  it("claims nothing and says which setting is missing, by name, when the reply domain or the mailbox key is not set", async () => {
    for (const missing of ["QUOTE_REPLY_DOMAIN", "MAILBOX_TOKEN_KEY"]) {
      const s = await setup({ env: { ...ENV, [missing]: undefined } });
      const res = await handleSendMailRequest(post(), s.deps);
      expect(res.status).toBe(503);
      expect(s.calls.length).toBe(0);
      expect(s.logs.join("\n")).toContain(missing);
      expect(s.logs.join("\n")).not.toContain(KEY_B64);
    }
  });
});

describe("send-mail: a message through Gmail", () => {
  // Break caught: a message from the wrong address, replies that miss the conversation, a Message-ID other than the one recorded, or a sent
  // message never marked sent.
  it("sends one RFC 5322 message from the agent's mailbox, Reply-To the conversation first and the agent second, and marks it sent with Gmail's id", async () => {
    const s = await setup();
    const res = await handleSendMailRequest(post(), s.deps);
    expect(res.status).toBe(200);
    const sent = gmailRaw(s.fetchFn);
    expect(sent.call[0]).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect((sent.call[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer at", "Content-Type": "application/json" });
    expect(sent.headers.get("from")).toBe("agent1@acme.example");
    expect(sent.headers.get("to")).toBe("lucia@reyes.example");
    expect(sent.headers.get("reply-to")).toBe("c.reyesbakerysons.0123456789abcdef@replies.nevermore.example, agent1@acme.example");
    expect(sent.headers.get("subject")).toBe("Your renewal");
    expect(sent.headers.get("message-id")).toBe("<11111111-1111-4111-8111-111111111111@acme.example>");
    expect(sent.headers.get("date")).toBe("Mon, 16 Nov 2026 15:04:05 +0000");
    expect(sent.headers.get("mime-version")).toBe("1.0");
    expect(sent.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
    expect(sent.headers.get("content-transfer-encoding")).toBe("base64");
    expect(decodeBase64Body(sent.body)).toBe("Hi Lucia,\r\nShall we talk?");
    expect(sent.headers.has("in-reply-to")).toBe(false);
    expect(sent.headers.has("references")).toBe(false);
    expect(sent.headers.has("cc")).toBe(false);
    expect(s.calls.find(([fn]) => fn === "complete_conversation_mail")?.[1]).toEqual({ p_event_id: "e1", p_attempt: 1, p_provider_message_id: "gmail-18c2f" });
    expect(await res.json()).toEqual({ claimed: 1, sent: 1, retrying: 0, failed: 0 });
  });
});

describe("send-mail: files go as links (D-605)", () => {
  // Break caught: a file sent as an attachment, a link left out of the message, a link with the token where the host's request log keeps it (the path,
  // D-645), or a message with files that doesn't say its links run out.
  it("lists each file with its own link, the token after #, and says the links stop working after 30 days; nothing is attached", async () => {
    const files = [{ n: 1, file_name: "census.xlsx", token: "A".repeat(43) }, { n: 2, file_name: "loss-runs.pdf", token: "b".repeat(43) }];
    const s = await setup({ env: { ...ENV, APP_BASE_URL: "https://app.nevermore.example" }, claimed: [{ event_id: "e1", attempt: 1, message: { ...MESSAGE, files } }] });
    expect((await handleSendMailRequest(post(), s.deps)).status).toBe(200);
    const sent = gmailRaw(s.fetchFn);
    expect(sent.headers.get("content-type")).toBe("text/plain; charset=UTF-8");
    expect(decodeBase64Body(sent.body)).toBe(
      "Hi Lucia,\r\nShall we talk?\r\n\r\nFiles (each link stops working after 30 days):\r\n" +
      `census.xlsx: https://app.nevermore.example/f#${"A".repeat(43)}\r\nloss-runs.pdf: https://app.nevermore.example/f#${"b".repeat(43)}`,
    );
  });

  // Break caught: a message with files sent without its links when the app's address isn't set (the client would get a message promising files and none).
  it("sends nothing and tries again later when a message has files and the app's address isn't set", async () => {
    const files = [{ n: 1, file_name: "census.xlsx", token: "A".repeat(43) }];
    const s = await setup({ claimed: [{ event_id: "e1", attempt: 1, message: { ...MESSAGE, files } }] });
    expect(await (await handleSendMailRequest(post(), s.deps)).json()).toEqual({ claimed: 1, sent: 0, retrying: 1, failed: 0 });
    expect(s.fetchFn.mock.calls.some(([url]) => String(url).includes("gmail.googleapis.com"))).toBe(false);
    expect(s.calls.find(([fn]) => fn === "fail_conversation_mail")?.[1]).toMatchObject({ p_kind: "unavailable", p_retry_in_seconds: 60 });
    expect(s.logs.join("\n")).toContain("APP_BASE_URL");
  });
});

describe("send-mail: the message's other headers", () => {
  // Break caught: a reply that starts a new thread in the client's mail, a thread header on a message that answers none, or a CC dropped.
  it("carries the CC, and In-Reply-To and References only when the writer named the message it answers", async () => {
    const answer = {
      ...MESSAGE, cc_addresses: ["sam@reyes.example", "tom@reyes.example"], in_reply_to: "<a@acme.example>", message_references: ["<first@acme.example>", "<a@acme.example>"],
    };
    const s = await setup({ claimed: [{ event_id: "e2", attempt: 1, message: answer }] });
    await handleSendMailRequest(post(), s.deps);
    const sent = gmailRaw(s.fetchFn);
    expect(sent.headers.get("cc")).toBe("sam@reyes.example, tom@reyes.example");
    expect(sent.headers.get("in-reply-to")).toBe("<a@acme.example>");
    expect(sent.headers.get("references")).toBe("<first@acme.example> <a@acme.example>");
  });
});

describe("send-mail: a subject that is not plain ASCII", () => {
  // Break caught: a client's name or an accent arriving as mojibake, or a long subject breaking the 78-character line rule into a header nobody reads.
  it("encodes it as UTF-8 words of RFC 2047, folded, which read back as written", async () => {
    const subject = "Renouvellement pour Café Müller – 2027 plan, avec tous les détails dont nous avons parlé hier";
    const s = await setup({ claimed: [{ event_id: "e3", attempt: 1, message: { ...MESSAGE, subject } }] });
    await handleSendMailRequest(post(), s.deps);
    const sent = gmailRaw(s.fetchFn);
    const raw = sent.text.split("\r\n\r\n")[0].split("\r\n");
    for (const line of raw) expect(line.length).toBeLessThanOrEqual(78);
    const words = [...(sent.headers.get("subject") ?? "").matchAll(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g)].map((w) => w[1]);
    expect(words.length).toBeGreaterThan(1);
    const bytes = words.flatMap((w) => Array.from(atob(w), (c) => c.charCodeAt(0)));
    expect(new TextDecoder().decode(Uint8Array.from(bytes))).toBe(subject);
  });
});

describe("send-mail: the address rule", () => {
  // Break caught: an address the database's rule would have refused (a hand-made row, or a rule that drifted) smuggling a header into the message.
  it("sends nothing when any address fails the one rule, and fails the message for good, saying why", async () => {
    const bad = { ...MESSAGE, cc_addresses: ["sam@reyes.example\r\nBcc: everyone@evil.example"] };
    const s = await setup({ claimed: [{ event_id: "e4", attempt: 1, message: bad }] });
    const res = await handleSendMailRequest(post(), s.deps);
    expect(s.fetchFn.mock.calls.some(([url]) => String(url).includes("gmail.googleapis.com"))).toBe(false);
    expect(s.calls.find(([fn]) => fn === "fail_conversation_mail")?.[1]).toEqual({
      p_event_id: "e4", p_attempt: 1, p_kind: "refused", p_reason: "An address on this message can't be sent to. Nothing was sent; check the addresses and write it again.",
      p_retry_in_seconds: null,
    });
    expect(await res.json()).toEqual({ claimed: 1, sent: 0, retrying: 0, failed: 1 });
  });
});

describe("send-mail: the sender's mailbox", () => {
  const failed = (calls: [string, Record<string, unknown>][]) => calls.find(([fn]) => fn === "fail_conversation_mail")?.[1];

  // Break caught: a message retried for ever for a sender with no mailbox, or failed with no word on Reconnect (the place to write reads kind mailbox).
  it("fails for good, kind mailbox, when none is connected or Google took the permission back", async () => {
    const none = await setup({ mailbox: null });
    await handleSendMailRequest(post(), none.deps);
    expect(failed(none.calls)).toMatchObject({ p_kind: "mailbox", p_reason: MAILBOX_PROBLEMS.not_connected, p_retry_in_seconds: null });
    const revoked = await setup({ fetch: async (url) => (url.includes("oauth2") ? reply(400, { error: "invalid_grant" }) : reply(200, { id: "x" })) });
    await handleSendMailRequest(post(), revoked.deps);
    expect(failed(revoked.calls)).toMatchObject({ p_kind: "mailbox", p_reason: MAILBOX_PROBLEMS.revoked, p_retry_in_seconds: null });
    expect(revoked.fetchFn.mock.calls.some(([url]) => String(url).includes("gmail.googleapis.com"))).toBe(false);
  });

  // Break caught: a short outage at Google failing a message for good.
  it("tries again later when Google's sign-in service doesn't answer", async () => {
    const s = await setup({ fetch: async (url) => (url.includes("oauth2") ? reply(503, {}) : reply(200, { id: "x" })) });
    const res = await handleSendMailRequest(post(), s.deps);
    expect(failed(s.calls)).toMatchObject({ p_kind: "unavailable", p_retry_in_seconds: 60 });
    expect(await res.json()).toEqual({ claimed: 1, sent: 0, retrying: 1, failed: 0 });
  });
});

describe("send-mail: what Google or Microsoft answers", () => {
  const failed = (calls: [string, Record<string, unknown>][]) => calls.find(([fn]) => fn === "fail_conversation_mail")?.[1];
  const sendAnswers = (res: () => Response | Promise<Response>) => async (url: string) =>
    url.includes("oauth2") ? reply(200, { access_token: "at", expires_in: 3600, scope: GOOGLE_SEND_SCOPE }) : res();

  // Break caught: a busy provider failing a message for good, or one retried for ever (D-632: dispatch-outbox's delays, then final).
  it("tries a busy or failing provider again after dispatch-outbox's delays, and gives up after the last attempt", async () => {
    const busy = await setup({ fetch: sendAnswers(() => reply(429, {})) });
    await handleSendMailRequest(post(), busy.deps);
    expect(failed(busy.calls)).toMatchObject({ p_kind: "unavailable", p_retry_in_seconds: 60 });
    const last = await setup({ claimed: [{ event_id: "e5", attempt: 5, message: MESSAGE }], fetch: sendAnswers(() => reply(503, {})) });
    await handleSendMailRequest(post(), last.deps);
    expect(failed(last.calls)).toMatchObject({ p_kind: "unavailable", p_retry_in_seconds: null });
    expect(String(failed(last.calls)?.p_reason)).toContain("Nothing was sent");
  });

  // Break caught: a refused message retried (it will be refused again), or a refusal of the sender's permission not leading to Reconnect.
  it("fails a refused message for good: refused for a bad message, mailbox when the provider won't let the sender send", async () => {
    const bad = await setup({ fetch: sendAnswers(() => reply(400, { error: { message: "Invalid To header" } })) });
    const res = await handleSendMailRequest(post(), bad.deps);
    expect(failed(bad.calls)).toMatchObject({ p_kind: "refused", p_retry_in_seconds: null });
    expect(String(failed(bad.calls)?.p_reason)).not.toContain("Invalid To header");
    expect(await res.json()).toEqual({ claimed: 1, sent: 0, retrying: 0, failed: 1 });
    for (const status of [401, 403]) {
      const denied = await setup({ fetch: sendAnswers(() => reply(status, {})) });
      await handleSendMailRequest(post(), denied.deps);
      expect(failed(denied.calls)).toMatchObject({ p_kind: "mailbox", p_retry_in_seconds: null });
    }
  });

  // Break caught: a send whose answer was lost being sent a second time to the client (Gmail has no idempotency key), or a send that hangs the batch.
  it("never retries a send whose answer was lost: final, uncertain, and the sender is told to look in their Sent folder", async () => {
    const s = await setup({ fetch: sendAnswers(() => { throw new TypeError("connection reset"); }) });
    const res = await handleSendMailRequest(post(), s.deps);
    expect(failed(s.calls)).toMatchObject({ p_kind: "uncertain", p_retry_in_seconds: null });
    expect(String(failed(s.calls)?.p_reason)).toContain("Sent folder");
    const gmail = s.fetchFn.mock.calls.find(([url]) => String(url).includes("gmail.googleapis.com"));
    expect((gmail?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect(await res.json()).toEqual({ claimed: 1, sent: 0, retrying: 0, failed: 1 });
  });
});

describe("send-mail: a mailbox that changed since the message was written", () => {
  // Break caught: a message written from one address going out from another the agent connected since (the client sees a stranger), or a
  // Message-ID at a domain the message does not come from.
  it("sends nothing when the connected mailbox is not the message's From, and fails it for good, kind mailbox", async () => {
    const sealed = await sealToken(KEY, "u1", "refresh-token");
    const s = await setup({ mailbox: { provider: "google", address: "agent1@newfirm.example", scope: GOOGLE_SEND_SCOPE, token_ciphertext: sealed.ciphertext, token_iv: sealed.iv } });
    await handleSendMailRequest(post(), s.deps);
    expect(s.fetchFn.mock.calls.some(([url]) => String(url).includes("gmail.googleapis.com"))).toBe(false);
    expect(s.calls.find(([fn]) => fn === "fail_conversation_mail")?.[1]).toMatchObject({ p_kind: "mailbox", p_retry_in_seconds: null });
  });
});

describe("send-mail: permissions", () => {
  // Break caught: a request for any scope (a read permission above all) slipping into the send path (ADR 0005, M-4.3).
  it("asks Google and Microsoft for no scope on any request it makes", async () => {
    for (const provider of ["google", "microsoft"] as const) {
      const s = await setup({ provider });
      await handleSendMailRequest(post(), s.deps);
      expect(s.fetchFn).toHaveBeenCalled();
      for (const [url, init] of s.fetchFn.mock.calls) {
        expect(String(url)).not.toMatch(/scope/i);
        const body = (init as RequestInit | undefined)?.body;
        expect(body instanceof URLSearchParams ? [...body.keys()] : []).not.toContain("scope");
        if (typeof body === "string" && body.startsWith("{")) expect(Object.keys(JSON.parse(body))).toEqual(["raw"]);
      }
    }
  });
});

describe("send-mail: a Gmail answer with no id", () => {
  // Break caught: a sent message recorded with the provider id "undefined" (the second such send then collides on the unique id), or a sent message
  // left queued because the answer could not be read, and so sent again.
  it("still marks the message sent, with our own Message-ID", async () => {
    const s = await setup({ fetch: async (url) => (url.includes("oauth2") ? reply(200, { access_token: "at", expires_in: 3600, scope: GOOGLE_SEND_SCOPE }) : new Response("ok", { status: 200 })) });
    await handleSendMailRequest(post(), s.deps);
    expect(s.calls.find(([fn]) => fn === "complete_conversation_mail")?.[1]).toEqual({ p_event_id: "e1", p_attempt: 1, p_provider_message_id: MESSAGE.message_id });
  });
});

describe("send-mail: a message through Microsoft", () => {
  // Break caught: a Microsoft agent's mail sent through Gmail, or a sent message with no id at all, since Graph returns none (D-633).
  it("sends the same message through Graph sendMail and marks it sent with our own Message-ID", async () => {
    const s = await setup({ provider: "microsoft" });
    const res = await handleSendMailRequest(post(), s.deps);
    const call = s.fetchFn.mock.calls.find(([url]) => String(url).includes("graph.microsoft.com"));
    expect(call?.[0]).toBe("https://graph.microsoft.com/v1.0/me/sendMail");
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer at", "Content-Type": "text/plain" });
    const sent = splitMessage(new TextDecoder().decode(Uint8Array.from(atob(String(init.body)), (c) => c.charCodeAt(0))));
    expect(sent.headers.get("from")).toBe("agent1@acme.example");
    expect(sent.headers.get("reply-to")).toBe("c.reyesbakerysons.0123456789abcdef@replies.nevermore.example, agent1@acme.example");
    expect(sent.headers.get("message-id")).toBe(MESSAGE.message_id);
    expect(s.fetchFn.mock.calls.some(([url]) => String(url).includes("gmail"))).toBe(false);
    expect(s.calls.find(([fn]) => fn === "complete_conversation_mail")?.[1]).toEqual({ p_event_id: "e1", p_attempt: 1, p_provider_message_id: MESSAGE.message_id });
    expect(await res.json()).toEqual({ claimed: 1, sent: 1, retrying: 0, failed: 0 });
  });
});
