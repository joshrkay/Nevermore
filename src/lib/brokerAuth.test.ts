import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.fn();
const exchangeCodeForSession = vi.fn();
const rpc = vi.fn();
const createClient = vi.fn(() => ({ auth: { signInWithOAuth, exchangeCodeForSession }, rpc }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { brokerCallbackUrl, brokerNext, finishBrokerSignIn, startBrokerSignIn } = await import("./brokerAuth");

describe("where a broker goes after signing in", () => {
  it("is a page of the advisor console and nothing else", () => {
    expect(brokerNext("/advisor/submissions/abc-123")).toBe("/advisor/submissions/abc-123");
    expect(brokerNext("/advisor")).toBe("/advisor");
    for (const bad of [null, undefined, "", "/start", "https://evil.example", "//evil.example", "/advisor/../start", "/advisor//x", "/advisorx", "/advisor\\x"]) {
      expect(brokerNext(bad as string | null), String(bad)).toBe("/advisor");
    }
  });

  // CRM-S3.8a: a broker who must sign in again for an export comes back to the page they were on, with its filters and its firm.
  it("keeps the page's query string, so the page and its filters come back", () => {
    for (const kept of [
      "/advisor/activity?person=5f1c2a9e-0000-4000-8000-000000000002&kind=send_recorded",
      "/advisor/partners?firm=0b5c1f2e-1111-4222-8333-444455556666",
      "/advisor?firm=abc",
      "/advisor/activity?kind=sign_in&person=nevermore",
      "/advisor/activity?q=a%20b%2Fc",
    ]) {
      expect(brokerNext(kept), kept).toBe(kept);
    }
  });

  // Catches: a broker who connects their mailbox from a place to write on a contact or a lead (CRM-E1.1, D-650) landing on the queue instead of back where they were writing.
  it("keeps a contact's page and the Leads page, with their query", () => {
    for (const kept of ["/contacts/5f1c2a9e-0000-4000-8000-000000000003", "/contacts/c1?tab=email", "/leads", "/leads?lead=5f1c2a9e-0000-4000-8000-000000000004"]) {
      expect(brokerNext(kept), kept).toBe(kept);
    }
    for (const bad of ["/contacts", "/contacts/a/b", "/contactsx/1", "/leadsx", "/leads/../advisor", "/contacts/1?x=//evil.example"]) {
      expect(brokerNext(bad), bad).toBe("/advisor");
    }
  });

  // Catches: a broker who connects their mailbox from the place to write on a lead's page (slice 8.5, D-603) landing on the queue instead of back on the lead.
  it("keeps a lead's page", () => {
    for (const kept of ["/leads/5f1c2a9e-0000-4000-8000-000000000004", "/leads/l1?x=1"]) expect(brokerNext(kept), kept).toBe(kept);
    for (const bad of ["/leads/a/b", "/leads/..", "/leads/l1?x=//evil.example"]) expect(brokerNext(bad), bad).toBe("/advisor");
  });

  // Catches: a broker who connects their mailbox from the inbox's banner (CRM-E1.4) landing on the queue instead of back in the inbox, with its view.
  it("keeps the inbox, with its query", () => {
    for (const kept of ["/inbox", "/inbox?view=new", "/inbox?view=sent&q=reyes"]) expect(brokerNext(kept), kept).toBe(kept);
    for (const bad of ["/inboxx", "/inbox/1", "/inbox/../advisor", "/inbox?x=//evil.example"]) expect(brokerNext(bad), bad).toBe("/advisor");
  });

  // Catches: a broker who signs in again for an Accounts export (or on an expired session) landing on the queue with the filters gone (D-223).
  it("keeps the Accounts page and an account's page, with their query", () => {
    for (const kept of [
      "/accounts",
      "/accounts?filter=status:any_of:client&q=elena",
      "/accounts?view=clients&sort=-last_activity_at&page=2",
      "/accounts/5f1c2a9e-0000-4000-8000-000000000002",
      "/accounts/5f1c2a9e-0000-4000-8000-000000000002?tab=contacts&contact=c1",
    ]) {
      expect(brokerNext(kept), kept).toBe(kept);
    }
  });

  it("refuses every way an Accounts address could lead off the site, and falls back to the console", () => {
    for (const bad of [
      "/accounts?next=//evil.example",
      "/accounts?x=https://evil.example",
      "/accounts?x=a\\b",
      "/accounts?x=a\nb",
      "/accounts?x=a\u0000b",
      "/accounts?x=a b",
      "/accounts?x=1#frag",
      "/accounts#frag",
      "/accounts?x=<script>",
      "/accounts//x",
      "/accounts/../start",
      "/accounts/a/../../start?x=1",
      "/accounts\\x",
      "/accountsx",
      "/accounts/a b",
    ]) {
      expect(brokerNext(bad), JSON.stringify(bad)).toBe("/advisor");
    }
  });

  it("refuses every other way a query could lead off the site or hide a control character, and falls back to the console", () => {
    for (const bad of [
      "/advisor?next=//evil.example",
      "/advisor/activity?x=https://evil.example",
      "/advisor/activity?x=a\\b",
      "/advisor/activity?x=a\nb",
      "/advisor/activity?x=a\rb",
      "/advisor/activity?x=a\tb",
      "/advisor/activity?x=a\u0000b",
      "/advisor/activity?x=a b",
      "/advisor/activity?x=1#frag",
      "/advisor/activity#frag",
      "/advisor/../start?x=1",
      "/advisorx?x=1",
      "/start?x=1",
      "//evil.example?x=1",
      "https://evil.example/advisor?x=1",
      "javascript:alert(1)",
      "/advisor/activity?x=<script>",
    ]) {
      expect(brokerNext(bad), JSON.stringify(bad)).toBe("/advisor");
    }
  });

  it("builds the address the provider returns to, carrying a non-default page and its query", () => {
    expect(brokerCallbackUrl("https://app.example.com")).toBe("https://app.example.com/broker/callback");
    expect(brokerCallbackUrl("https://app.example.com", "/advisor/held")).toBe("https://app.example.com/broker/callback?next=%2Fadvisor%2Fheld");
    expect(brokerCallbackUrl("https://app.example.com", "/advisor/activity?kind=sign_in&person=nevermore")).toBe(
      "https://app.example.com/broker/callback?next=%2Fadvisor%2Factivity%3Fkind%3Dsign_in%26person%3Dnevermore",
    );
    expect(brokerCallbackUrl("https://app.example.com", "https://evil.example")).toBe("https://app.example.com/broker/callback");
  });

  it("carries the Accounts page and its filters through the provider and back", () => {
    expect(brokerCallbackUrl("https://app.example.com", "/accounts?filter=status:any_of:client&q=elena")).toBe(
      "https://app.example.com/broker/callback?next=%2Faccounts%3Ffilter%3Dstatus%3Aany_of%3Aclient%26q%3Delena",
    );
    expect(brokerCallbackUrl("https://app.example.com", "/accounts/abc-123")).toBe("https://app.example.com/broker/callback?next=%2Faccounts%2Fabc-123");
  });

  // Catches: the queue ("/advisor") being left out of the address because it is the default, so the callback can't tell a sign-in for the queue from one for no page.
  it("carries the queue as a page too, so the return can tell it from no page at all", () => {
    expect(brokerCallbackUrl("https://app.example.com", "/advisor")).toBe("https://app.example.com/broker/callback?next=%2Fadvisor");
    expect(brokerCallbackUrl("https://app.example.com", null)).toBe("https://app.example.com/broker/callback");
    expect(brokerCallbackUrl("https://app.example.com", "")).toBe("https://app.example.com/broker/callback");
  });
});

describe("a session belongs to one firm address", () => {
  it("returns the provider to the address the broker started from, never to another firm's or the bare domain's", () => {
    expect(brokerCallbackUrl("https://acme-brokers.nevermorepeo.com", "/advisor/held")).toBe(
      "https://acme-brokers.nevermorepeo.com/broker/callback?next=%2Fadvisor%2Fheld",
    );
    expect(brokerCallbackUrl("https://birch-benefits.nevermorepeo.com")).toBe("https://birch-benefits.nevermorepeo.com/broker/callback");
    // A page to return to is a path of this address; a link naming another firm's address is no page to return to.
    expect(brokerCallbackUrl("https://acme-brokers.nevermorepeo.com", "https://birch-benefits.nevermorepeo.com/advisor")).toBe(
      "https://acme-brokers.nevermorepeo.com/broker/callback",
    );
  });

  it("starts the sign-in from the address the page is served on", async () => {
    signInWithOAuth.mockReset().mockResolvedValue({ error: null });
    const here = window.location;
    vi.stubGlobal("location", { ...here, origin: "https://acme-brokers.nevermorepeo.com" });
    try {
      await startBrokerSignIn("google");
    } finally {
      vi.unstubAllGlobals();
    }
    expect(signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe("https://acme-brokers.nevermorepeo.com/broker/callback");
  });
});

describe("signing in with a provider", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset().mockResolvedValue({ error: null });
    exchangeCodeForSession.mockReset();
    rpc.mockReset().mockResolvedValue({ data: [{ firm_id: "f1", name: "Acme Brokers", address: "acme-brokers", role: "agent", refused: false }], error: null });
  });

  it("uses the PKCE flow on its own client, which never reads a session out of the address", async () => {
    await startBrokerSignIn("google");
    expect(createClient).toHaveBeenCalledTimes(1);
    const options = (createClient.mock.calls[0] as unknown[])[2] as { auth: Record<string, unknown> };
    expect(options.auth).toMatchObject({ flowType: "pkce", detectSessionInUrl: false, autoRefreshToken: false });
  });

  it("asks Google for the send permission, offline, with consent", async () => {
    await startBrokerSignIn("google", "/advisor/held");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/broker/callback?next=%2Fadvisor%2Fheld`,
        scopes: "https://www.googleapis.com/auth/gmail.send",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  });

  it("asks Microsoft (Supabase's azure) for the send permission and offline access", async () => {
    await startBrokerSignIn("microsoft");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "azure",
      options: { redirectTo: `${window.location.origin}/broker/callback`, scopes: "Mail.Send offline_access", queryParams: undefined },
    });
  });

  it("throws when Supabase won't start the sign-in", async () => {
    signInWithOAuth.mockResolvedValue({ error: new Error("provider is not enabled") });
    await expect(startBrokerSignIn("google")).rejects.toThrow("provider is not enabled");
  });

  const session = (over: Record<string, unknown> = {}) => ({
    data: { session: { access_token: "sb-jwt", provider_token: "pt", provider_refresh_token: "1//refresh-from-google", user: { app_metadata: { provider: "google" } }, ...over } },
    error: null,
  });

  // Catches: sign-in still asks the retired platform list for the advisor role (the function is gone), or lets a person with no firm
  // connect a mailbox the database would refuse.
  it("asks which firms the broker belongs to, and sends nothing with the question", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    exchangeCodeForSession.mockResolvedValueOnce(session());
    await finishBrokerSignIn("code-0");
    expect(rpc).toHaveBeenCalledWith("my_firms");
    expect(rpc).not.toHaveBeenCalledWith("claim_advisor_role_by_organisation");
    expect(rpc.mock.calls[0]).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("connects the mailbox of someone who belongs to a firm", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    exchangeCodeForSession.mockResolvedValueOnce(session());
    expect(await finishBrokerSignIn("code-7")).toEqual({ ok: true, mailbox: "connected" });
    vi.unstubAllGlobals();
  });

  // Catches: a broker who has asked to join a firm but isn't a member yet has a mailbox stored, or is told it failed.
  it("connects nothing, and keeps nothing, for someone who belongs to no firm yet: they wait for an owner to approve them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const firms of [{ data: [], error: null }, { data: null, error: new Error("down") }]) {
      rpc.mockResolvedValueOnce(firms);
      exchangeCodeForSession.mockResolvedValueOnce(session());
      expect(await finishBrokerSignIn("code-8")).toEqual({ ok: true, mailbox: "waiting" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("hands the refresh token once to the mailbox function, as the broker, and says it is connected", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    exchangeCodeForSession.mockResolvedValueOnce(session());
    expect(await finishBrokerSignIn("code-1")).toEqual({ ok: true, mailbox: "connected" });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("code-1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toMatch(/\/functions\/v1\/mailbox$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sb-jwt");
    expect(JSON.parse(init.body as string)).toEqual({ action: "connect", provider: "google", refresh_token: "1//refresh-from-google" });
    vi.unstubAllGlobals();
  });

  it("names Microsoft's provider as microsoft", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    exchangeCodeForSession.mockResolvedValueOnce(session({ user: { app_metadata: { provider: "azure" } } }));
    await finishBrokerSignIn("code-2");
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).provider).toBe("microsoft");
    vi.unstubAllGlobals();
  });

  it("sends nothing when the broker didn't allow sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    exchangeCodeForSession.mockResolvedValueOnce(session({ provider_refresh_token: null }));
    expect(await finishBrokerSignIn("code-3")).toEqual({ ok: true, mailbox: "not_granted" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("still signs the broker in, and says the mailbox failed, when it can't be connected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    exchangeCodeForSession.mockResolvedValueOnce(session());
    expect(await finishBrokerSignIn("code-4")).toEqual({ ok: true, mailbox: "failed" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    exchangeCodeForSession.mockResolvedValueOnce(session());
    expect(await finishBrokerSignIn("code-5")).toEqual({ ok: true, mailbox: "failed" });
    exchangeCodeForSession.mockResolvedValueOnce(session({ user: { app_metadata: { provider: "github" } } }));
    expect(await finishBrokerSignIn("code-6")).toEqual({ ok: true, mailbox: "failed" });
    vi.unstubAllGlobals();
  });

  it("fails without a session when the code can't be redeemed", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("invalid grant") });
    expect(await finishBrokerSignIn("used")).toEqual({ ok: false });
    exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    expect(await finishBrokerSignIn("empty")).toEqual({ ok: false });
  });
});
