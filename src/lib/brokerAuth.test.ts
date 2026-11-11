import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.fn();
const exchangeCodeForSession = vi.fn();
const createClient = vi.fn(() => ({ auth: { signInWithOAuth, exchangeCodeForSession } }));
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

describe("signing in with a provider", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset().mockResolvedValue({ error: null });
    exchangeCodeForSession.mockReset();
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

  it("reports whether the broker let the product send, keeping nothing the provider returned", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ data: { session: { provider_refresh_token: "r", provider_token: "t" } }, error: null });
    expect(await finishBrokerSignIn("code-1")).toEqual({ ok: true, mailbox: "granted" });
    exchangeCodeForSession.mockResolvedValueOnce({ data: { session: { provider_token: "t" } }, error: null });
    expect(await finishBrokerSignIn("code-2")).toEqual({ ok: true, mailbox: "not_granted" });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("code-1");
  });

  it("fails without a session when the code can't be redeemed", async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("invalid grant") });
    expect(await finishBrokerSignIn("used")).toEqual({ ok: false });
    exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    expect(await finishBrokerSignIn("empty")).toEqual({ ok: false });
  });
});
