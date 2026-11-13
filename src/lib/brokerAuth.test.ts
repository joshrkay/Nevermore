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
    for (const bad of [null, undefined, "", "/start", "https://evil.example", "//evil.example", "/advisor/../start", "/advisor//x", "/advisorx", "/advisor\\x", "/advisor?next=//e"]) {
      expect(brokerNext(bad as string | null), String(bad)).toBe("/advisor");
    }
  });

  it("builds the address the provider returns to, carrying a non-default page", () => {
    expect(brokerCallbackUrl("https://app.example.com")).toBe("https://app.example.com/broker/callback");
    expect(brokerCallbackUrl("https://app.example.com", "/advisor/held")).toBe("https://app.example.com/broker/callback?next=%2Fadvisor%2Fheld");
    expect(brokerCallbackUrl("https://app.example.com", "https://evil.example")).toBe("https://app.example.com/broker/callback");
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
    rpc.mockReset().mockResolvedValue({ data: { granted: true }, error: null });
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

  it("claims the advisor role first: the database decides from what the provider vouched for, and the caller sends nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    exchangeCodeForSession.mockResolvedValueOnce(session());
    await finishBrokerSignIn("code-0");
    expect(rpc).toHaveBeenCalledWith("claim_advisor_role_by_organisation");
    expect(rpc.mock.calls[0]).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("connects the mailbox of someone who already had the role", async () => {
    rpc.mockResolvedValue({ data: { granted: false, reason: "already_has_role" }, error: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    exchangeCodeForSession.mockResolvedValueOnce(session());
    expect(await finishBrokerSignIn("code-7")).toEqual({ ok: true, mailbox: "connected" });
    vi.unstubAllGlobals();
  });

  it("connects nothing, and keeps nothing, for someone with no role yet: they wait for an administrator", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const claimed of [{ data: { granted: false, reason: "no_match" }, error: null }, { data: null, error: new Error("down") }]) {
      rpc.mockResolvedValueOnce(claimed);
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
